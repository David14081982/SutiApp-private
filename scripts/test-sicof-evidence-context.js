'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {fixture}=require('./test-savings-period-composition');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const captured=JSON.parse(read('scripts/fixtures/sicof-evidence-schema.json'));
const schema=JSON.parse(read('scripts/fixtures/sicof-context-performance-schema.json'));
const workspace=JSON.parse(read('scripts/fixtures/sicof-workspace-schema.json'));
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const file='20261004000100_sicof_evidence_integration.sql';
(async()=>{
 const {db,q,value}=await fixture();const checks=[];
 const test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 try{
  await db.exec('reset role');
  for(const table of new Set(schema.columns.map(c=>c.table_name))){
   const cols=schema.columns.filter(c=>c.table_name===table).map(c=>'"'+c.column_name+'" '+c.type+(c.default_value?' default '+c.default_value:'')+(c.required?' not null':''));
   await db.exec('create table public.'+table+'('+cols.join(',')+')');
  }
  for(const c of schema.constraints)await db.exec('alter table public.'+c.table_name+' add constraint '+c.conname+' '+c.definition);
  await db.exec('create schema sicof_private;');
  for(const f of workspace.definitions)await db.exec(f.definition);
  for(const f of captured.functions){await db.exec(f.definition);await db.exec('revoke all on function '+f.signature+' from public,anon,authenticated,service_role');if(f.acl.includes('service_role'))await db.exec('grant execute on function '+f.signature+' to service_role');}
  const metadata=()=>value("select jsonb_build_object('definition',pg_get_functiondef(oid),'oid',oid,'owner',pg_get_userbyid(proowner),'acl',proacl) v from pg_proc where oid='sicof_private.context(date,date)'::regprocedure");
  const original=await metadata();
  await test('migration refuses definition/ACL drift before mutation',async()=>{
   for(const mutation of ["grant execute on function sicof_private.context(date,date) to anon","alter function sicof_private.context(date,date) set search_path='public'"]){
    await db.exec('begin;'+mutation);
    await assert.rejects(db.exec(read('supabase/migrations/'+file).replace(/^begin;/,'').replace(/commit;\s*$/,'')),/BASELINE_DRIFT/);await db.exec('rollback');
    assert.equal(await value("select to_regclass('sicof_private.evidence_reader_backup')::text v"),null);
   }
  });
  await db.exec(read('supabase/migrations/'+file));
  const record=uid(500);
  await q("insert into public.savings_review_batches(id,source_sha256,source_name,observed_at,expected_records) values($1,$2,'Synthetic','2026-09-06',1)",[uid(501),'a'.repeat(64)]);
  await q("insert into public.savings_review_records(id,batch_id,source_sheet,source_row,source_folio,field_defs,source_data,raw_source) values($1,$2,'Ahorro',2,'001',$3,'{}','{}')",[record,uid(501),JSON.stringify([{key:'AS',label:'2026-07-05 · Descuento registrado'}])]);
  await q(`insert into public.savings_balance_certifications(record_id,participant_id,enrollment_id,cutoff_on,source_version,source_snapshot,command,capital,yield_amount,actor_real_auth_user_id,client_action_id)
   values($1,$2,$2,'2026-09-06',0,'{"source":{"D":"JUB","AS":100},"proposal":{}}','{"process":"JUB"}',1000,0,$2,$1)`,[record,uid(1)]);
  const history=()=>value('select to_jsonb(h) v from sicof_private.evidence_history($1)h',[uid(1)]);
  await test('existing canonical plan at exact date resolves only expected with provenance',async()=>{
   const h=await history();assert.equal(h.expected,100);assert.equal(h.amount,100);assert.equal(h.expected_source,'CANONICAL_PLAN_AT_DATE');assert(h.expected_plan_id);
   assert.equal(await value('select expected v from public.savings_workspace_history($1)',[uid(1)]),null);
  });
  await test('current plan is never projected into the past',async()=>{
   await db.exec("begin;update public.savings_contribution_plans set effective_from='2026-09-15'");assert.equal((await history()).expected,null);await db.exec('rollback');
  });
  await test('ambiguous plans, mixed yield, conflicts and unknown amount stay pending',async()=>{
   await db.exec('begin');await q("insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,data_classification) values($1,200,'JUB','2026-06-05','CANONICAL')",[uid(1)]);assert.equal((await history()).expected,null);await db.exec('rollback');
   for(const update of ["update public.savings_balance_certifications set source_snapshot='{}'", "update public.savings_enrollments set first_expected_contribution_date='2026-09-05'", "update public.savings_enrollments set enrollment_started_at='2026-09-05'", "update public.savings_enrollments set terminated_at='2026-07-01'"]){await db.exec('begin;'+update);const h=await history();assert(!h||h.expected===null);await db.exec('rollback');}
   for(const flags of [[true,false],[false,true]]){
    await db.exec(`begin;create or replace function public.savings_workspace_history(p_participant_id uuid)
     returns table(id text,date date,amount numeric,expected numeric,status text,source text,includes_yield boolean,data_conflict boolean)
     language sql stable security definer set search_path='' as $$select 'synthetic',date '2026-07-05',100::numeric,null::numeric,'RECEIVED','CERTIFIED_HISTORY',${flags[0]},${flags[1]}$$;`);
    assert.equal((await history()).expected,null);await db.exec('rollback');
   }
  });
  await test('private ACL, backup RLS and context identity are conserved',async()=>{
   const now=await metadata();for(const k of ['oid','owner','acl'])assert.deepEqual(now[k],original[k]);
   assert.equal(now.definition.replace('sicof_private.evidence_history(p.id)h','public.savings_workspace_history(p.id)h'),original.definition);
   for(const role of ['anon','authenticated','service_role']){
    assert.equal(await value("select has_function_privilege($1,'sicof_private.evidence_history(uuid)','execute') v",[role]),false);
    assert.equal(await value("select has_table_privilege($1,'sicof_private.evidence_reader_backup','select') v",[role]),false);
   }
   assert.equal(await value("select relrowsecurity and relforcerowsecurity v from pg_class where oid='sicof_private.evidence_reader_backup'::regclass"),true);
  });
  await test('recovery refuses drift and restores exact original reader',async()=>{
   await db.exec("begin;grant execute on function sicof_private.evidence_history(uuid) to anon");
   await assert.rejects(db.exec(read('supabase/recovery/'+file).replace(/^begin;/,'').replace(/commit;\s*$/,'')),/RECOVERY_DRIFT/);await db.exec('rollback');
   await db.exec(read('supabase/recovery/'+file));assert.deepEqual(await metadata(),original);
   assert.equal(await value("select to_regprocedure('sicof_private.evidence_history(uuid)')::text v"),null);
  });
  const proof={status:'PASS',checks,productionWrites:0};const out=path.join(root,'docs/qa/evidence/sicof-evidence-integration');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sql.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }finally{await db.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
