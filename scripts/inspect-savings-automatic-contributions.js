'use strict';
// Read-only live discovery. Row-level evidence remains in the ignored workspace.
const fs=require('fs'),path=require('path');
const {query,rpc,login}=require('./release-sicof-backend.js');
const root=path.resolve(__dirname,'..'),priv=path.join(root,'.tmp/savings-auto-contributions'),out=path.join(root,'docs/qa/evidence/savings-automatic-contributions');
fs.mkdirSync(priv,{recursive:true});fs.mkdirSync(out,{recursive:true});
const names=['savings_participants','savings_enrollments','savings_contribution_plans','savings_contribution_overrides','savings_transactions','savings_balance_certifications','savings_audit_events','savings_yield_allocations','savings_yield_periods','savings_withdrawal_openings','savings_holds','savings_requests','savings_publication_state'];
const q=s=>"'"+s.replace(/'/g,"''")+"'";
async function main(){
 const catalog=await query(`select n.nspname schema,p.oid,p.oid::regprocedure::text signature,p.proname name,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef security_definer,md5(pg_get_functiondef(p.oid)) md5,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname like '%savings%' order by p.proname,p.oid`);
 const privateFunctions=await query(`select n.nspname schema,p.oid,p.oid::regprocedure::text signature,p.proname name,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef security_definer,md5(pg_get_functiondef(p.oid)) md5,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname like 'savings%' and p.prokind='f' order by n.nspname,p.proname,p.oid`);
 const tables=await query(`select c.relname name,pg_get_userbyid(c.relowner) owner,c.relrowsecurity rls,c.relforcerowsecurity force_rls,c.relacl::text acl,
 (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) columns,
 (select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid))) from pg_constraint where conrelid=c.oid) constraints,
 (select jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid))) from pg_trigger where tgrelid=c.oid and not tgisinternal) triggers
 from pg_class c where c.relnamespace='public'::regnamespace and c.relname in (${names.map(q).join(',')}) order by c.relname`);
 const state=await query(`select (now() at time zone 'America/Hermosillo')::date today,(select mode from public.savings_publication_state where id) publication,
 exists(select 1 from supabase_migrations.schema_migrations where version='20261003000400') migration_collision,to_regnamespace('cron') is not null cron_available`);
 const auth=await login(),receipts=await rpc(auth.access_token,'get_admin_savings_reconciliation',{p_date:'2026-09-30'});
 const accounts=receipts.rows.filter(r=>r.route==='ACCOUNT'),due=[{contribution_date:'2026-09-30',rows:accounts.length,actual:accounts.filter(r=>r.confirmed).length,pending:accounts.filter(r=>!r.confirmed).length}];
 const people=await rpc(auth.access_token,'get_admin_savings_workspace_people',{p_search:'4944',p_limit:50,p_offset:0,p_filter:'todos'});
 const target=people.rows.filter(r=>r.folio==='4944').map(person=>({person}));
 const cron=await query(`select jobid,jobname,schedule,command,active,username from cron.job order by jobid`);
 const fingerprints=await query(names.map(n=>`select '${n}' resource,count(*)::int rows,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) fingerprint from public.${n} t`).join(' union all '));
 fs.writeFileSync(path.join(priv,'functions.json'),JSON.stringify(catalog,null,2));fs.writeFileSync(path.join(priv,'private-functions.json'),JSON.stringify(privateFunctions,null,2));fs.writeFileSync(path.join(priv,'tables.json'),JSON.stringify(tables,null,2));
 fs.writeFileSync(path.join(priv,'preflight-private.json'),JSON.stringify({state,due,target,receipts,cron,fingerprints},null,2));
 const proof={status:'PASS',at:new Date().toISOString(),readOnly:true,financialWrites:0,functions:catalog.length,tables:tables.length,state,due,cronJobs:cron.length,savingsJobs:cron.filter(j=>/savings|ahorro/i.test(j.jobname+' '+j.command)).map(j=>({name:j.jobname,schedule:j.schedule,active:j.active})),targetFound:target.length===1,targetPendingCount:target[0]?.person?.pending?.count,baselineFingerprints: fingerprints.map(({resource,rows})=>({resource,rows}))};
 fs.writeFileSync(path.join(out,'preflight.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{fs.writeFileSync(path.join(priv,'inspect-error.txt'),e.stack||String(e));console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;});
