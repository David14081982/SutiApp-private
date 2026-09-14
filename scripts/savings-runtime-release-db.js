'use strict';
// Savings-only additive delivery. This script never certifies accounts or publishes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,body,chain:core}=require('./savings-runtime-db');
const sourceInput=require('./savings-source-observation-input');
const chain=[...core,'20260913000200_savings_publication','20260913000300_savings_requests_runtime','20260913000400_savings_source_refresh','20260913000500_savings_account_receipts','20260913000600_savings_admin_current_summary'];
const out=path.resolve('tmp/savings-runtime-20260913');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const fingerprint=`select (select md5(string_agg(to_jsonb(r)::text,'' order by id)) from public.savings_review_records r) reviews,(select md5(string_agg(to_jsonb(e)::text,'' order by id)) from public.savings_review_events e) events,(select md5(string_agg((to_jsonb(p)-'historical_yield_reconciled_through')::text,'' order by id)) from public.savings_participants p) participants,(select count(*) from public.savings_transactions) transactions`;
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const inputs=chain.map(n=>({name:n,sha256:sha(fs.readFileSync('supabase/migrations/'+n+'.sql'))}));
 const before=await query(fingerprint);
 const backup=await query(`select 'function' kind,p.oid::regprocedure::text name,pg_get_functiondef(p.oid) definition from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like '%savings%' union all select 'table',c.relname,(select coalesce(jsonb_agg(x),'[]')::text from public.savings_review_records x) from pg_class c where c.oid='public.savings_review_records'::regclass`);
 const backupPath=path.join(out,'pre-application-backup.json'),backupBytes=JSON.stringify({captured_at:new Date().toISOString(),before,inputs,backup});
 fs.writeFileSync(backupPath+'.tmp',backupBytes);fs.renameSync(backupPath+'.tmp',backupPath);assert.equal(sha(fs.readFileSync(backupPath)),sha(backupBytes));
 const forward=chain.map(n=>body('supabase/migrations/'+n+'.sql')).join('\n');
 const recovery=chain.slice().reverse().map(n=>body('supabase/recovery/'+n+'_recovery.sql')).join('\n');
 if(!process.argv.includes('--apply')){
  await query('begin;'+forward+recovery+'rollback;');assert.deepEqual(await query(fingerprint),before);
  console.log('PASS complete Savings chain and reverse recovery; persistent changes 0');return;
 }
 const source=sourceInput(),sqlText=x=>"'"+String(x).replaceAll("'","''")+"'";
 const registry=chain.map(n=>"insert into supabase_migrations.schema_migrations(version,name,statements) values("+sqlText(n.slice(0,14))+","+sqlText(n.slice(15))+",array["+sqlText(body('supabase/migrations/'+n+'.sql'))+"]);" ).join('\n');
 const sourceGuard="lock table public.savings_review_records,public.savings_review_events,public.savings_participants,public.savings_transactions in share mode;do $source$ begin if (select md5(string_agg(to_jsonb(r)::text,'' order by id)) from public.savings_review_records r) is distinct from "+sqlText(before[0].reviews)+" then raise exception 'SAVINGS_SOURCE_CHANGED_RETRY';end if;end $source$;";

 const guard=`do $guard$ begin if to_regclass('public.savings_publication_state') is not null or to_regclass('public.savings_balance_certifications') is not null then raise exception 'SAVINGS_ALREADY_APPLIED';end if;end $guard$;`;
 await query('begin;'+sourceGuard+guard+forward+registry+`select set_config('request.jwt.claims','{"role":"service_role"}',true);select public.import_savings_source_observations('${source.sha}','${source.observed_at}',${literal(source.rows)});commit;`);
 const after=await query(fingerprint);assert.deepEqual(after,before);
 const status=await query("select (select mode from public.savings_publication_state where id) mode,(select count(*) from public.savings_balance_certifications) certifications,(select count(*) from public.savings_publication_events) publications,(select count(*) from public.savings_source_observations) observations,(select count(*) from public.savings_source_acceptances) accepted_observations,(select count(*) from public.savings_transactions) transactions");
 assert.equal(status[0].mode,'PRIVATE');assert.equal(status[0].certifications,0);assert.equal(status[0].publications,0);assert.equal(status[0].observations,3);assert.equal(status[0].accepted_observations,0);
 const evidence={status:'PASS',applied_at:new Date().toISOString(),inputs,backup_sha256:sha(backupBytes),before,after,result:status[0],google_writes:0};
 fs.writeFileSync(path.join(out,'database-application.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({status:'PASS',...status[0],original_records_unchanged:true}));
}
module.exports={chain};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
