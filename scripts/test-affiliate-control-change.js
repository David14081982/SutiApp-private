'use strict';
// Real isolated PostgreSQL engine; synthetic rows only. Never connects to Supabase.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),{PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),checks=[];
async function main(){
 const db=new PGlite(),q=async(s,p=[])=>(await db.query(s,p)).rows,v=async(s,p=[])=>(await q(s,p))[0].v;
 const test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const actor=async(permissions=['affiliates.read','affiliates.write'],boundary=true,uid=id(9))=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false),set_config('test.boundary',$3,false)",[uid,JSON.stringify(permissions),String(boundary)]);await db.exec('set role authenticated');};
 const preview=(number='00009',affiliate=id(1))=>v('select preview_admin_affiliate_control($1,$2) v',[affiliate,number]);
 const save=(r,action=id(101),reason='')=>v('select change_admin_affiliate_control($1,$2,$3,$4,$5,$6) v',[r.affiliate_id,r.new_control,r.expected_updated_at,r.fingerprint,reason,action]);
 const denied=(fn,pattern)=>assert.rejects(fn,pattern);
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema savings_private;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.has_admin_permission(p text) returns boolean language sql stable as $$select coalesce(current_setting('test.permissions',true),'[]')::jsonb ? p$$;
 create function public.admin_module_boundary(text[],text) returns boolean language sql stable as $$select current_setting('test.boundary',true)='true'$$;
 create function public.has_certified_affiliate_auth_link(uuid,uuid,text) returns boolean language sql stable as $$select coalesce(current_setting('test.certified',true),'false')='true'$$;
 create table affiliates(id uuid primary key default gen_random_uuid(),numero_control text,is_archived boolean default false,
  auth_user_id uuid references auth.users(id),historical_email_normalized text,updated_at timestamptz default now(),
  financial_profile_version integer not null default 1,financial_profile_updated_at timestamptz,financial_profile_updated_by uuid);
 create table affiliate_admin_events(event_id uuid primary key default gen_random_uuid(),affiliate_id uuid references affiliates(id),actor_auth_user_id uuid references auth.users(id),action text,before_values jsonb,after_values jsonb,changed_fields text[],reason text);
 create table program_requests(id uuid primary key,affiliate_id uuid references affiliates(id),numero_control text,payload jsonb);
 create table request_documents(id uuid primary key,request_id uuid references program_requests(id),private_note text);
 create table savings_private.participants(id uuid primary key,affiliate_id uuid references affiliates(id),legacy_folio text);
 create table savings_private.entries(id uuid primary key,participant_id uuid references savings_private.participants(id),secret_amount numeric);
 create table raw_imports(source_folio text);
 create table cycle_a(id uuid primary key,b_id uuid);
 create table cycle_b(id uuid primary key,a_id uuid references cycle_a(id));
 alter table cycle_a add foreign key(b_id) references cycle_b(id);
 grant usage on schema public,auth to anon,authenticated;
 insert into auth.users values('${id(9)}','admin@example.test'),('${id(8)}','person@example.test');
 insert into affiliates(id,numero_control,auth_user_id,historical_email_normalized) values('${id(1)}','00007','${id(8)}','person@example.test'),('${id(2)}','00008',null,null);
 insert into program_requests values('${id(10)}','${id(1)}','00007','{"secret":"never disclose"}'),('${id(11)}','${id(2)}','00044','{}');
 insert into request_documents values('${id(20)}','${id(10)}','private never disclose');
 insert into savings_private.participants values('${id(30)}','${id(1)}','00007');
 insert into savings_private.entries values('${id(40)}','${id(30)}',9876.54);
 insert into raw_imports values('00007'),('00055');`);
 await db.exec('alter table affiliates enable row level security;alter table affiliates force row level security');
 const before=await v("select jsonb_build_object('requests',(select jsonb_agg(r) from program_requests r),'documents',(select jsonb_agg(r) from request_documents r),'savings',(select jsonb_agg(r) from savings_private.participants r),'entries',(select jsonb_agg(r) from savings_private.entries r)) v");
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261015000100_affiliate_control_change.sql'),'utf8');
 await test('migration compiles without changing business rows',async()=>{await db.exec(sql);assert.equal(await v('select numero_control v from affiliates where id=$1',[id(1)]),'00007');assert.equal(await v('select count(*)::int v from affiliate_control_changes'),0);});
 await test('anonymous, ordinary affiliates, read-only admins and wrong module cannot preview/change/history',async()=>{
  for(const permissions of [[],['affiliates.read'],['affiliates.write']]){await actor(permissions);await denied(()=>preview(),/DENIED/);await denied(()=>v('select list_admin_affiliate_control_changes($1) v',[id(1)]),/DENIED/);await denied(()=>save({affiliate_id:id(1),new_control:'X'}),/DENIED/);}
  await actor(['affiliates.read','affiliates.write'],false);await denied(()=>preview(),/DENIED/);
  await db.exec('reset role;set role anon');await denied(()=>preview(),/permission denied/);
 });
 await actor();let report;
 await test('raw text validation preserves leading zeroes and rejects blank/padded/control input',async()=>{
  for(const number of ['',null,' 00009','00009 ','a\nb','x'.repeat(81)])await denied(()=>preview(number),/INVALID/);
  await denied(()=>preview('00007'),/NO_CHANGE/);report=await preview();assert.equal(report.new_control,'00009');assert.equal(report.blockers.length,0);
 });
 await test('inventory follows direct/indirect FKs, raw matches, unkeyed rows; no private values leak',async()=>{
  assert.equal(report.groups.find(g=>g.source==='public.request_documents').count,1);
  assert.equal(report.groups.find(g=>g.source==='savings_private.entries').records[0].key.id,id(40));
  assert.equal(report.groups.find(g=>g.source==='public.raw_imports').has_primary_key,false);
  assert.equal(report.excluded.length,4);assert(!JSON.stringify(report).includes('9876'));assert(!JSON.stringify(report).includes('never disclose'));
 });
 await test('current/archived and unrelated/orphan historical numbers are blocked',async()=>{
  assert((await preview('00008')).blockers.includes('NUMBER_ALREADY_ASSIGNED'));
  assert((await preview('00044')).blockers.includes('NUMBER_HAS_UNRELATED_RECORDS'));
  assert((await preview('00055')).blockers.includes('NUMBER_HAS_UNRELATED_RECORDS'));
  await denied(async()=>save(await preview('00044')),/BLOCKED/);
  await db.exec('reset role');await q('update affiliates set is_archived=true where id=$1',[id(2)]);await actor();
  assert((await preview('00008')).blockers.includes('NUMBER_ALREADY_ASSIGNED'));
  await denied(()=>preview('X',id(2)),/ARCHIVED/);
 });
 await test('access certification that depends on old number requires access repair first',async()=>{
  await db.exec('reset role');await q("select set_config('test.certified','true',false)");await q("update affiliates set historical_email_normalized='other@example.test' where id=$1",[id(1)]);await actor();
  assert((await preview()).blockers.includes('ACCESS_REPAIR_REQUIRED'));
  await db.exec('reset role');await q("update affiliates set historical_email_normalized='person@example.test' where id=$1",[id(1)]);await actor();assert(!(await preview()).blockers.includes('ACCESS_REPAIR_REQUIRED'));
 });
 await test('stale profile, changed inventory and missing acknowledgement hash fail atomically',async()=>{
  report=await preview();await denied(()=>save({...report,expected_updated_at:'2000-01-01'}),/VERSION_CONFLICT/);
  await denied(()=>save({...report,fingerprint:null}),/IMPACT_CHANGED/);
  await db.exec('reset role');await q('insert into request_documents values($1,$2,$3)',[id(21),id(10),'new private document']);await actor();
  await denied(()=>save(report),/IMPACT_CHANGED/);
  await db.exec('reset role');await q('delete from request_documents where id=$1',[id(21)]);await actor();
 });
 await test('audit failure rolls back identity, version and change record together',async()=>{
  await db.exec("reset role;create function test_audit_failure() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC_AUDIT_FAILURE';end$$;create trigger test_audit_failure before insert on affiliate_admin_events for each row execute function test_audit_failure()");
  await actor();report=await preview();await denied(()=>save(report),/SYNTHETIC_AUDIT_FAILURE/);
  await db.exec('reset role');assert.equal(await v('select numero_control v from affiliates where id=$1',[id(1)]),'00007');assert.equal(await v('select count(*)::int v from affiliate_control_changes'),0);
  await db.exec('drop trigger test_audit_failure on affiliate_admin_events;drop function test_audit_failure()');await actor();
 });
 let result;
 await test('confirmed change updates only current identity/version and stores full durable report + real actor',async()=>{
  report=await preview();result=await save(report);assert.equal(result.change.new_control,'00009');assert.equal(result.change.actor_auth_user_id,id(9));assert.deepEqual(result.change.impact,report);
  await db.exec('reset role');const a=await v('select to_jsonb(a) v from affiliates a where id=$1',[id(1)]);assert.equal(a.auth_user_id,id(8));assert.equal(a.financial_profile_version,2);assert.equal(a.numero_control,'00009');
  const after=await v("select jsonb_build_object('requests',(select jsonb_agg(r) from program_requests r),'documents',(select jsonb_agg(r) from request_documents r),'savings',(select jsonb_agg(r) from savings_private.participants r),'entries',(select jsonb_agg(r) from savings_private.entries r)) v");assert.deepEqual(after,before);
  assert.equal(await v("select count(*)::int v from affiliate_admin_events where changed_fields=array['numero_control']"),1);await actor();
 });
 await test('network retry is idempotent; key reuse with other target/reason is denied',async()=>{
  const retry=await save(report);assert(retry.replayed);assert.equal(retry.change.id,result.change.id);
  await denied(()=>save(report,id(101),'changed reason'),/ACTION_CONFLICT/);
  assert.equal((await v('select list_admin_affiliate_control_changes($1) v',[id(1)])).length,1);
 });
 await test('direct reads/writes/helpers forbidden, history immutable, reserved number protected on ordinary creation',async()=>{
  for(const query of ['select * from affiliate_control_changes','update affiliates set numero_control=\'HACK\'','select affiliate_control_inventory(null,null,null)','select affiliate_control_relation(0)'])await denied(()=>q(query),/permission denied/);
  await db.exec('reset role');await denied(()=>q("insert into affiliates(numero_control) values('00007')"),/RESERVED/);
  await denied(()=>q("update affiliate_control_changes set reason='rewrite'"),/IMMUTABLE/);await denied(()=>q('delete from affiliate_control_changes'),/IMMUTABLE/);await actor();
 });
 await test('same affiliate can correct back without changing historical financial rows',async()=>{
  const back=await preview('00007');
  // The unlinked historical import is deliberately ambiguous, requiring manual review.
  assert(back.blockers.includes('NUMBER_HAS_UNRELATED_RECORDS'));
  await db.exec('reset role');await q("delete from raw_imports where source_folio='00007'");await actor();
  const fixed=await preview('00007');assert.equal(fixed.blockers.length,0);await save(fixed,id(102));
 });
 await test('recovery disables entry points while preserving all evidence and reservations',async()=>{
  await db.exec('reset role');await db.exec(fs.readFileSync(path.join(root,'supabase/recovery/20261015000100_affiliate_control_change.sql'),'utf8'));
  assert.equal(await v('select count(*)::int v from affiliate_control_changes'),2);
  assert.equal(await v('select numero_control v from affiliates where id=$1',[id(1)]),'00007');
  await denied(()=>q("insert into affiliates(numero_control) values('00009')"),/RESERVED/);
  await actor();await denied(()=>preview(),/does not exist/);
 });
 const evidence={status:'PASS',engine:'PGlite / isolated PostgreSQL',checks,productionWrites:0,liveSchemaVerified:false,concurrentSessionsTested:false};
 const dir=path.join(root,'docs/qa/evidence/affiliate-control-change');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'database.json'),JSON.stringify(evidence,null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
