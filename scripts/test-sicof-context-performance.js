'use strict';
// Isolated PostgreSQL; captured functions, synthetic source records only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {fixture}=require('./test-savings-period-composition');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const schema=JSON.parse(read('scripts/fixtures/sicof-context-performance-schema.json'));
const workspace=JSON.parse(read('scripts/fixtures/sicof-workspace-schema.json'));
const file='20261003000300_sicof_context_read_performance.sql';
async function main(){
 const f=await fixture(),{db,q,value,as,tx}=f,checks=[];
 const test=async(name,run)=>{await run();checks.push(name);console.log('PASS '+name);};
 const compare=async()=>{
  const r=await q("select sicof_private.context_reference('2026-01-01','2026-10-03') old,sicof_private.context('2026-01-01','2026-10-03') updated");
  assert.deepEqual(r[0].updated,r[0].old);return r[0].updated.participants.find(p=>p.id===uid(1));
 };
 try{
  await db.exec('reset role');
  for(const table of new Set(schema.columns.map(c=>c.table_name))){
   const cols=schema.columns.filter(c=>c.table_name===table).map(c=>'"'+c.column_name+'" '+c.type+(c.default_value?' default '+c.default_value:'')+(c.required?' not null':''));
   await db.exec('create table public.'+table+'('+cols.join(',')+')');
  }
  for(const c of schema.constraints)await db.exec('alter table public.'+c.table_name+' add constraint '+c.conname+' '+c.definition);
  await db.exec(`create schema sicof_private;
   alter table public.affiliates add column auth_user_id uuid;
   create function public.savings_panel_people(uuid) returns setof jsonb language sql stable as $$select '{}'::jsonb$$;
   create function public.savings_review_edit_allowed() returns boolean language sql stable as $$select true$$;
   create function public.savings_balance_review_version(uuid) returns bigint language sql stable as $$select 0::bigint$$;
   create function public.savings_enrollment_effective_status(text,timestamptz,date) returns text language sql stable as $$select $1$$;
   create function public.savings_review_identity(text) returns jsonb language sql stable as $$select '{"match_count":1,"active_match_count":1}'::jsonb$$;`);
  for(const fn of [...workspace.definitions,...schema.definitions]){
   await db.exec(fn.definition);await db.exec('revoke all on function public.'+fn.signature+' from public,anon,authenticated,service_role');
  }
  await db.exec('grant execute on function public.get_admin_savings_financial_account(uuid,date) to authenticated');
  await db.exec('grant execute on function public.get_admin_savings_account(uuid,date) to authenticated');
  await db.exec(read('supabase/migrations/20261003000100_savings_period_composition.sql'));
  await db.exec(schema.reader.definition);await db.exec('revoke all on function sicof_private.context(date,date) from public,anon,authenticated,service_role');
  await db.exec(schema.reader.definition.replace('FUNCTION sicof_private.context(','FUNCTION sicof_private.context_reference('));
  const metadata=()=>value("select jsonb_build_object('definition',pg_get_functiondef(oid),'oid',oid,'owner',pg_get_userbyid(proowner),'acl',proacl) v from pg_proc where oid='sicof_private.context(date,date)'::regprocedure");
  const before=await metadata();
  await test('installation rejects drift before backup or reader replacement',async()=>{
   for(const mutation of ["alter function sicof_private.context(date,date) set search_path='public'","grant execute on function sicof_private.context(date,date) to anon","alter function sicof_private.context(date,date) owner to authenticated"]){
    await db.exec('begin');await db.exec(mutation);
    await assert.rejects(db.exec(read('supabase/migrations/'+file).replace(/^begin;/,'').replace(/commit;\s*$/,'')),/INSTALL_BASELINE_DRIFT/);await db.exec('rollback');
    assert.deepEqual(await metadata(),before);assert.equal(await value("select to_regclass('sicof_private.context_read_backup')::text v"),null);
   }
  });
  await db.exec(read('supabase/migrations/'+file));
  await test('only reader body changes; OID owner ACL and private backup are preserved',async()=>{
   const after=await metadata();for(const key of ['oid','owner','acl'])assert.deepEqual(after[key],before[key]);
   assert.notEqual(after.definition,before.definition);
   assert.equal(await value("select relrowsecurity and relforcerowsecurity v from pg_class where oid='sicof_private.context_read_backup'::regclass"),true);
   for(const role of ['anon','authenticated','service_role'])assert.equal(await value("select has_table_privilege($1,'sicof_private.context_read_backup','select') v",[role]),false);
  });
  await tx({amount:1000});await tx({type:'CONTRIBUTION',amount:100,contribution:'2026-09-05',day:'2026-09-05'});await db.exec('reset role');
  await test('uncertified-source and canonical-only participant JSON and fingerprints are identical',compare);
  const record=uid(500),related=uid(501),batch=uid(502);
  await q("insert into public.savings_review_batches(id,source_sha256,source_name,observed_at,expected_records) values($1,$2,'Synthetic source','2026-09-06',2)",[batch,'a'.repeat(64)]);
  await q(`insert into public.savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data,field_defs,raw_source)
   values($1,$3,'Ahorro',2,'001','{"A":"001","D":"JUB","S":100}','[]','{}'),($2,$3,'Solicitud de retiro',3,'001','{"A":"001","G":0}','[]','{}')`,[record,related,batch]);
  const currentRelated=()=>value("select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'source',source_data,'proposal',proposed_data,'status',status) order by id),'[]') v from public.savings_review_records where source_folio='001'");
  const snapshot=()=>currentRelated().then(r=>({source:{A:'001',D:'JUB',S:100},proposal:{},related:r}));
  await q(`insert into public.savings_balance_certifications(record_id,participant_id,enrollment_id,cutoff_on,source_version,source_snapshot,command,capital,yield_amount,actor_real_auth_user_id,client_action_id)
   values($1,$2,$2,'2026-09-06',0,$3,'{"process":"JUB"}',1000,0,$2,$1)`,[record,uid(1),JSON.stringify(await snapshot())]);
  await test('accepted unchanged source keeps source review clear and all DTO fields identical',async()=>{assert(!(await compare()).eligibility.reasons.includes('SOURCE_REVIEW_REQUIRED'));});
  await q("update public.savings_review_records set source_data='{"+'"A":"001","G":50' +"}' where id=$1",[related]);
  await test('changed related withdrawal flags source review without changing any other result',async()=>{assert((await compare()).eligibility.reasons.includes('SOURCE_REVIEW_REQUIRED'));});
  await q(`insert into public.savings_audit_events(participant_id,action,after_data,actor_real_auth_user_id,reason,resource)
   values($1,'ADJUST_CONFIRMED_BALANCE',$2,$1,'Synthetic accepted source','savings')`,[uid(1),JSON.stringify({source_snapshot:await snapshot()})]);
  await test('latest accepted balance snapshot overrides original certificate identically',async()=>{assert(!(await compare()).eligibility.reasons.includes('SOURCE_REVIEW_REQUIRED'));});
  const observation=uid(510);
  await q(`insert into public.savings_source_observations(id,record_id,source_sha,observed_at,source_total,changes)
   values($1,$2,$3,'2026-10-03',0,'[]')`,[observation,record,'b'.repeat(64)]);
  await test('new pending observation flags source review even when related records match',async()=>{assert((await compare()).eligibility.reasons.includes('SOURCE_REVIEW_REQUIRED'));});
  await q(`insert into public.savings_source_acceptances(observation_id,actor_real_auth_user_id,client_action_id,record_version) values($1,$2,$3,0)`,[observation,uid(1),uid(511)]);
  await test('accepted observation clears pending with byte-equivalent JSON and fingerprint',async()=>{assert(!(await compare()).eligibility.reasons.includes('SOURCE_REVIEW_REQUIRED'));});
  await q("update public.savings_review_records set source_folio='999' where id=$1",[record]);
  const mismatchRelated=await value("select jsonb_agg(jsonb_build_object('id',id,'version',version,'source',source_data,'proposal',proposed_data,'status',status) order by id) v from public.savings_review_records where source_folio='999'");
  await q(`insert into public.savings_audit_events(participant_id,action,after_data,actor_real_auth_user_id,reason,resource)
   values($1,'ADJUST_CONFIRMED_BALANCE',$2,$1,'Synthetic differing source folio','savings')`,[uid(1),JSON.stringify({source_snapshot:{source:{A:'001'},proposal:{},related:mismatchRelated}})]);
  await test('source record folio governs related comparison even when it differs from participant folio',async()=>{assert(!(await compare()).eligibility.reasons.includes('SOURCE_REVIEW_REQUIRED'));});
  await q("update public.savings_review_records set source_sheet='Solicitud de retiro' where id=$1",[record]);
  await test('missing Ahorro source record preserves the original error',async()=>{
   for(const name of ['context_reference','context'])await assert.rejects(q("select sicof_private."+name+"('2026-01-01','2026-10-03')"),/SAVINGS_RECORD_REQUIRED/);
  });
  await q("update public.savings_review_records set source_sheet='Ahorro',source_folio='001' where id=$1",[record]);
  await q("update public.savings_balance_certifications set cutoff_on='2028-01-01' where record_id=$1",[record]);
  await test('invalid future certificate preserves the original projection-range refusal',async()=>{
   for(const name of ['context_reference','context'])await assert.rejects(q("select sicof_private."+name+"('2026-01-01','2026-10-03')"),/SAVINGS_PROJECTION_RANGE_INVALID/);
  });
  await q("update public.savings_balance_certifications set cutoff_on='2026-09-06' where record_id=$1",[record]);
  await test('recovery fails on drift and restores exact reader without touching source records',async()=>{
   await db.exec("begin;alter function sicof_private.context(date,date) set search_path='public'");
   await assert.rejects(db.exec(read('supabase/recovery/'+file).replace(/^begin;/,'').replace(/commit;\s*$/,'')),/RECOVERY_DRIFT/);await db.exec('rollback');
   const rows=await currentRelated();await db.exec(read('supabase/recovery/'+file));assert.deepEqual(await metadata(),before);assert.deepEqual(await currentRelated(),rows);
  });
  console.log(JSON.stringify({status:'PASS',checks:checks.length,environment:'isolated PostgreSQL',productionWrites:0}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
