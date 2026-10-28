'use strict';
// Isolated PostgreSQL/WASM, synthetic records only. No network/credentials.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {PGlite}=require(process.env.SUTIAPP_PGLITE_PATH||path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function main(){
 const db=new PGlite(),checks=[];let serial=1000;
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const val=async(sql,args=[]) => (await q(sql,args))[0].v;
 const actor=async(perms='savings.read,savings.write,savings.approve,savings.reports,program_requests.read',modules='savings,reportes_jc',id=1,imp=false)=>{
  await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.affiliate',$2,false),set_config('test.permissions',$3,false),set_config('test.modules',$4,false),set_config('test.impersonation',$5,false)",[id?uid(id):'',id?uid(id):'',perms,modules,imp?uid(90):'']);await db.exec('set role authenticated');
 };
 const fail=async(body,pattern)=>{await db.exec('savepoint expected_failure');let error;try{await body();}catch(e){error=e;}await db.exec('rollback to expected_failure');assert(error,'expected rejection');assert.match(error.message,pattern);};
 const check=async(name,body)=>{await body();checks.push(name);console.log('PASS '+name);};
 const overview=(year=2026)=>val('select public.get_admin_savings_regularization($1) v',[year]);
 const report=(year=2026)=>val('select public.get_admin_reports_jc_savings($1) v',[year]);
 const command=(entry,extra={})=>({kind:'SAVE_TERMINATION',source_record_id:entry.source_record_id,source_fingerprint:entry.source_fingerprint,expected_version:entry.version,mode:'ATTESTED',enrollment_id:null,effective_on:'2026-03-15',reason:'Constancia historica revisada',evidence_reference:'EXPEDIENTE-SINTETICO-001',...extra});
 const save=(command,key=uid(serial++))=>val('select public.save_admin_savings_termination($1,$2) v',[JSON.stringify(command),key]);
 const entry=async(id=70)=>(await overview()).terminations.find(r=>r.source_record_id===uid(id));
 try{
  // Reuse the isolated foundation of the direct dependency, never its test data.
  const fixture=read('scripts/test-savings-refunds.js').match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
  await db.exec(new Function('uid','return `'+fixture+'`;')(uid));
  // Match the source's production columns, especially its independent review
  // version: the termination version must never inherit or collide with it.
  await db.exec(`alter table public.savings_review_records
   add column field_defs jsonb not null default '[]',
   add column raw_source jsonb not null default '{}',
   add column issues jsonb not null default '[]',
   add column status text not null default 'PENDING',
   add column version integer not null default 11;`);
  await db.exec(`create function public.get_impersonation_context() returns table(session_id uuid) language sql stable as $$select '${uid(90)}'::uuid where nullif(current_setting('test.impersonation',true),'') is not null$$;`);
  await db.exec(read('supabase/migrations/20261027000200_reports_jc_refunds.sql'));
  const original=await val("select pg_get_functiondef('public.get_admin_reports_jc_savings(integer)'::regprocedure) v");
  await db.exec(read('supabase/migrations/20261027000400_reports_jc_historical.sql'));
  await db.exec('begin');
  await q("insert into savings_review_batches(id,observed_at,expected_records) values($1,'2026-10-01',3)",[uid(60)]);
  for(const [id,control,start] of [[70,'001','2025-01-01'],[71,'002','2026-02-01'],[72,'003','2026-04-01']]){
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Solicitud de Ahorro',$3,$4,$5)",[uid(id),uid(60),id-68,control,JSON.stringify({A:control,B:start,G:'Terminado'})]);
  }
  await actor();
  await check('dashboard reads under savings-only permission; report still requires report permissions',async()=>{
   await actor('savings.read','savings');const result=await overview();assert.equal(result.terminations.length,3);assert.equal(result.months.length,12);assert.equal(result.permissions.can_write,false);
   assert(result.terminations.every(r=>r.version===0&&r.status==='PENDING'));
   await fail(()=>report(),/DENIED/);await fail(()=>save(command(result.terminations[0])),/DENIED/);
   await actor('savings.read,savings.write','savings');await fail(()=>save(command(result.terminations[0])),/DENIED/);
   await actor('savings.read,savings.write,savings.approve','reportes_jc');await fail(()=>overview(),/DENIED/);
   await actor('', '',null);await fail(()=>overview(),/DENIED/);
   await actor(undefined,undefined,1,true);await fail(()=>overview(),/IMPERSONATION|DENIED/);await fail(()=>save(command(result.terminations[0])),/IMPERSONATION|DENIED/);await actor();
  });
  await check('unmapped historic dates block all relevant years, never an invented zero/date',async()=>{
   const old=await report(2025);assert(old.issues.some(i=>i.code==='HISTORICAL_TERMINATION_UNMAPPED'&&i.count===1));
   const result=await report();assert.equal(result.events.filter(e=>e.kind==='cancellation').length,0);assert.equal(result.regularization.pending_termination_count,3);
   assert.equal((await overview()).months[0].pending_termination_count,1);assert.equal((await overview()).months[10].status,'FUTURE');assert.equal((await overview()).months[9].status,'CURRENT');
   const filtered=await val('select public.get_admin_savings_regularization(2026,$1) v',['003']);assert.equal(filtered.terminations.length,1);assert.equal(filtered.months[0].pending_termination_count,1);
  });
  let first;
  await check('attestation dates, evidence, fingerprint, source and optimistic version are validated',async()=>{
   first=await entry();await fail(()=>save(command(first,{effective_on:'2024-12-31'})),/DATE_INVALID/);
   await fail(()=>save(command(first,{effective_on:'2026-10-28'})),/DATE_INVALID/);
   await fail(()=>save(command(first,{evidence_reference:''})),/COMMAND_INVALID/);
   await fail(()=>save(command(first,{source_fingerprint:'stale'})),/SOURCE_CONFLICT/);
   await fail(()=>save(command(first,{expected_version:9})),/VERSION_CONFLICT/);
   await fail(()=>save(command(first,{source_record_id:uid(999)})),/SOURCE_INVALID/);
   const input=command(first),key=uid(serial++),result=await save(input,key);assert.equal(result.version,1);assert.equal(result.numero_control,'001');assert.equal(result.effective_on,'2026-03-15');
   assert.equal(result.actor_real_auth_user_id,uid(1));assert.equal(result.usuario_contexto_affiliate_id,uid(1));assert(result.created_at);assert.deepEqual(await save(input,key),result);
   await fail(()=>save({...input,reason:'Otra constancia'},key),/IDEMPOTENCY_CONFLICT/);await fail(()=>save(input),/VERSION_CONFLICT/);
   assert.equal((await entry()).status,'RESOLVED');assert.equal((await entry()).version,1);
   assert.equal((await report()).events.filter(e=>e.kind==='cancellation'&&e.source_id===uid(70)).length,1);
   assert(!(await report(2025)).issues.some(i=>i.code==='HISTORICAL_TERMINATION_UNMAPPED'));
  });
  await check('correction appends a version, reopens both periods and moves one event across years',async()=>{
   await db.exec('reset role');
   for(const period of ['2026-03-01','2025-12-01'])await q("insert into savings_refunds_private.reporting_periods(period,version,confirmed_at,confirmed_case_count,reason,actor_real_auth_user_id) values($1,1,now(),0,'Revision completa',$2)",[period,uid(1)]);
   await actor();const result=await save(command(await entry(),{effective_on:'2025-12-31',reason:'Correccion de fecha con evidencia'}));assert.equal(result.version,2);
   assert.equal((await report()).events.filter(e=>e.kind==='cancellation'&&e.source_id===uid(70)).length,0);
   assert.equal((await report(2025)).events.filter(e=>e.kind==='cancellation'&&e.source_id===uid(70)).length,1);
   const historical=(await overview(2025)).terminations.find(r=>r.source_record_id===uid(70));assert.equal(historical.history.length,2);assert.equal(historical.history[1].effective_on,'2026-03-15');
   assert.equal((await overview(2025)).months[11].status,'REOPENED');assert.equal((await overview()).months[2].status,'REOPENED');
  });
  await check('source changes become visible conflicts until explicitly revalidated, no stale event fallback',async()=>{
   await db.exec('reset role');await q("update savings_review_records set proposed_data='{"+'"H":99'+"}' where id=$1",[uid(70)]);await actor();
   const conflicted=(await overview(2025)).terminations.find(r=>r.source_record_id===uid(70));assert.equal(conflicted.status,'CONFLICT');
   assert.equal((await report(2025)).events.filter(e=>e.kind==='cancellation'&&e.source_id===uid(70)).length,0);
   await save(command(conflicted,{effective_on:'2025-12-31'}));assert.equal((await overview(2025)).terminations.find(r=>r.source_record_id===uid(70)).version,3);
  });
  await check('existing canonical termination must be linked with the exact same identity and cycle, never duplicated',async()=>{
   await db.exec('reset role');await q("insert into savings_participants values($1,$2,'002','CANONICAL','RESOLVED')",[uid(11),uid(2)]);
   // A real savings cycle can begin after its application date. It must still
   // be offered for explicit linking, never duplicated by a free attestation.
   await q("insert into savings_enrollments values($1,$2,'CANONICAL','TERMINATED','2026-03-01 07:00Z','2026-05-15 07:00Z','PROCESS_1',1)",[uid(30),uid(11)]);
   await actor();const r=await entry(71);assert.equal(r.candidates.length,1);
   assert.equal(r.requested_on,'2026-02-01');assert.equal(r.candidates[0].started_on,'2026-03-01');
   await fail(()=>save(command(r,{effective_on:'2026-05-15'})),/USE_CANONICAL_LINK/);
   await fail(()=>save(command(r,{mode:'LINK',enrollment_id:uid(30),effective_on:'2026-05-16'})),/CANONICAL_DATE_REQUIRED/);
   await fail(async()=>save(command(await entry(72),{mode:'LINK',enrollment_id:uid(30),effective_on:'2026-05-15'})),/CYCLE_MISMATCH/);
   await save(command(r,{mode:'LINK',enrollment_id:uid(30),effective_on:'2026-05-15'}));
   const rows=(await report()).events.filter(e=>e.kind==='cancellation'&&e.numero_control==='002');assert.equal(rows.length,1);assert.equal(rows[0].source_table,'savings_enrollments');
   assert.equal((await entry(71)).status,'RESOLVED');
  });
  await check('multiple original source rows can explicitly link one canonical termination without duplicating it',async()=>{
   await db.exec('reset role');await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Solicitud de Ahorro',9,'002',$3)",[uid(73),uid(60),JSON.stringify({A:'002',B:'2026-02-01',G:'Terminado'})]);await q('update savings_review_batches set expected_records=4 where id=$1',[uid(60)]);
   await actor();await save(command(await entry(73),{mode:'LINK',enrollment_id:uid(30),effective_on:'2026-05-15'}));
   assert.equal((await entry(71)).status,'RESOLVED');assert.equal((await entry(73)).status,'RESOLVED');
   assert.equal((await report()).events.filter(e=>e.kind==='cancellation'&&e.numero_control==='002').length,1);
  });
  await check('attestation with an existing open cycle keeps its exact enrollment; later canonical termination requires review',async()=>{
   await db.exec('reset role;savepoint open_cycle');
   await q("insert into savings_participants values($1,null,'003','CANONICAL','RESOLVED')",[uid(12)]);
   await q("insert into savings_enrollments values($1,$2,'CANONICAL','ACTIVE','2026-05-01 07:00Z',null,'PROCESS_1',1)",[uid(31),uid(12)]);
   await actor();const r=await entry(72);
   await fail(()=>save(command(r,{effective_on:'2026-06-15'})),/CYCLE_REQUIRED/);
   await fail(()=>save(command(r,{enrollment_id:uid(31),effective_on:'2026-04-15'})),/DATE_INVALID/);
   await save(command(r,{enrollment_id:uid(31),effective_on:'2026-06-15'}));
   assert.equal((await entry(72)).status,'RESOLVED');assert.equal((await report()).events.filter(e=>e.kind==='cancellation'&&e.numero_control==='003').length,1);
   await db.exec('reset role');await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Solicitud de Ahorro',10,'003',$3)",[uid(74),uid(60),JSON.stringify({A:'003',B:'2026-04-01',G:'Terminado'})]);await q('update savings_review_batches set expected_records=5 where id=$1',[uid(60)]);await actor();
   await fail(async()=>save(command(await entry(74),{enrollment_id:uid(31),effective_on:'2026-06-15'})),/ENROLLMENT_ALREADY_LINKED/);
   await db.exec('reset role');await q("update savings_enrollments set terminated_at='2026-06-15 07:00Z',status='TERMINATED' where id=$1",[uid(31)]);await actor();
   const conflict=await entry(72);assert.equal(conflict.status,'CONFLICT');
   assert.equal((await report()).events.filter(e=>e.kind==='cancellation'&&e.numero_control==='003').length,1);
   assert((await report()).issues.some(i=>i.code==='HISTORICAL_TERMINATION_UNMAPPED'&&i.detail.records.some(x=>x.source_record_id===uid(72)&&x.status==='CONFLICT')));
   await save(command(conflict,{mode:'LINK',enrollment_id:uid(31),effective_on:'2026-06-15'}));assert.equal((await entry(72)).status,'RESOLVED');
   assert.equal((await report()).events.filter(e=>e.kind==='cancellation'&&e.numero_control==='003').length,1);
   await db.exec('reset role;rollback to open_cycle');await actor();
  });
  await check('canonical source-linked enrollment resolves without a manual duplicate and conflicting identity is blocked',async()=>{
   await db.exec('reset role');await q("insert into savings_participants values($1,null,'003','CANONICAL','RESOLVED')",[uid(12)]);
   await q("insert into savings_enrollments values($1,$2,'CANONICAL','TERMINATED','2026-04-01 07:00Z','2026-08-15 07:00Z','PROCESS_1',1)",[uid(31),uid(12)]);
   await q("insert into savings_requests(id,participant_id,data_classification,request_type,status,submitted_at,metadata,enrollment_id) values($1,$2,'CANONICAL','JOIN','APPROVED','2026-04-01',$3,$4)",[uid(40),uid(12),JSON.stringify({source_record_id:uid(72)}),uid(31)]);
   await actor();assert.equal((await entry(72)).status,'RESOLVED');assert.equal((await entry(72)).version,0);
   await db.exec('reset role');await q("update savings_participants set legacy_folio='WRONG' where id=$1",[uid(12)]);await actor();
   assert.equal((await entry(72)).status,'CONFLICT');await fail(async()=>save(command(await entry(72),{effective_on:'2026-08-15'})),/IDENTITY_CONFLICT/);
  });
  await check('closed zero months require explicit review; current/future months never claim completion',async()=>{
   let result=await overview();assert.equal(result.months[0].status,'PENDING');
   await val('select public.save_admin_savings_refund($1,$2) v',[JSON.stringify({kind:'CONFIRM_PERIOD',period:'2026-01-01',reason:'Todos los antecedentes completos sin reembolsos'}),uid(serial++)]);
   result=await overview();assert.equal(result.months[0].status,'REVIEWED_ZERO');assert.equal(result.months[9].status,'CURRENT');assert.equal(result.months[11].status,'FUTURE');
  });
  await check('latest import completeness fails closed, archives never resurrect source rows or attestations',async()=>{
   await db.exec('reset role;savepoint import_test');await q("insert into savings_review_batches(id,observed_at,expected_records) values($1,'2026-10-02',1)",[uid(61)]);await actor();await fail(()=>overview(),/IMPORT_INCOMPLETE/);
   await db.exec('reset role');await q("insert into savings_registration_removal_archive values($1,$2)",[uid(80),JSON.stringify({savings_review_records:[{id:uid(81),batch_id:uid(61),source_sheet:'Solicitud de Ahorro',source_data:{A:'001',G:'Terminado'}}]})]);
   await actor();assert.equal((await overview()).terminations.length,0);assert.equal((await report()).events.filter(e=>e.kind==='cancellation'&&e.source_table==='savings_refunds_private.termination_versions').length,0);
   await db.exec('reset role;rollback to import_test');await actor();
  });
  await check('unknown termination affects only months from its request through today in the selected year',async()=>{
   await db.exec('reset role;savepoint focused_months');
   await q("insert into savings_review_batches(id,observed_at,expected_records) values($1,'2026-10-03',1)",[uid(62)]);
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Solicitud de Ahorro',2,'JULY',$3)",[uid(82),uid(62),JSON.stringify({A:'JULY',B:'2026-07-15',G:'Terminado'})]);
   await actor();assert.deepEqual((await report()).issues.find(i=>i.code==='HISTORICAL_TERMINATION_UNMAPPED').months,[7,8,9,10]);
   const months=(await overview()).months;assert.equal(months[5].pending_termination_count,0);assert.equal(months[6].pending_termination_count,1);assert.equal(months[10].pending_termination_count,0);
   await db.exec('reset role;rollback to focused_months');await actor();
  });
  await check('explicit withdrawal of stale evidence preserves versions and never voids a canonical financial event',async()=>{
   await fail(async()=>save(command(await entry(71),{mode:'VOID',effective_on:null})),/VOID_INVALID/);
   await db.exec('reset role;savepoint void_evidence');
   await q("update savings_review_records set proposed_data=proposed_data||'{\"G\":\"Activo\"}' where id in ($1,$2)",[uid(70),uid(71)]);await actor();
   const stale=(await overview(2025)).terminations.find(r=>r.source_record_id===uid(70));assert.equal(stale.status,'CONFLICT');assert.equal(stale.can_void,true);assert.equal(stale.source_state,'Activo');
   const input=command(stale,{mode:'VOID',effective_on:null,enrollment_id:null}),key=uid(serial++),withdrawn=await save(input,key);assert.equal(withdrawn.mode,'VOID');assert.equal(withdrawn.effective_on,'2025-12-31');assert.deepEqual(await save(input,key),withdrawn);
   const retained=(await overview(2025)).terminations.find(r=>r.source_record_id===uid(70));assert.equal(retained.status,'VOIDED');assert.equal(retained.history.length,4);assert.equal(retained.history[1].mode,'ATTESTED');assert.equal(retained.can_void,false);
   assert.equal((await report(2025)).events.filter(e=>e.kind==='cancellation'&&e.source_id===uid(70)).length,0);
   const linked=await entry(71);await save(command(linked,{mode:'VOID',effective_on:null}));assert.equal((await entry(71)).status,'VOIDED');
   assert.equal((await report()).events.filter(e=>e.kind==='cancellation'&&e.numero_control==='002').length,1);
   await db.exec('reset role');assert.equal(await val('select (terminated_at is not null) v from savings_enrollments where id=$1',[uid(30)]),true);
   // Restoring Terminado requires a new date assertion; a past withdrawal must
   // never suppress a newly relevant source fact.
   await q("update savings_review_records set proposed_data=proposed_data||'{\"G\":\"Terminado\"}' where id=$1",[uid(70)]);await actor();
   const restored=(await overview(2025)).terminations.find(r=>r.source_record_id===uid(70));assert.equal(restored.status,'CONFLICT');assert.equal(restored.can_void,false);
   await save(command(restored,{effective_on:'2025-12-31'}));assert.equal((await overview(2025)).terminations.find(r=>r.source_record_id===uid(70)).status,'RESOLVED');
   await db.exec('reset role;rollback to void_evidence');await actor();
  });
  await check('history immutable, private RLS/grants, source/financial tables untouched by commands',async()=>{
   await fail(()=>q('select * from savings_refunds_private.termination_versions'),/permission denied/);await db.exec('reset role');
   await fail(()=>q("update savings_refunds_private.termination_versions set reason='altered'"),/IMMUTABLE/);await fail(()=>q('delete from savings_refunds_private.termination_versions'),/IMMUTABLE/);
   assert.equal(await val('select count(*)::integer v from savings_transactions'),0);
   assert.equal(await val("select count(*)::integer v from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='savings_refunds_private' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)"),0);
   for(const role of ['anon','service_role'])assert.equal(await val("select has_function_privilege($1,'public.save_admin_savings_termination(jsonb,uuid)','EXECUTE') v",[role]),false);
   assert.equal(await val("select has_function_privilege('authenticated','savings_refunds_private.reports_base(integer)','EXECUTE') v"),false);
   assert.equal((await val("select pg_get_functiondef('savings_refunds_private.reports_base(integer)'::regprocedure) v")).replace('savings_refunds_private.reports_base','public.get_admin_reports_jc_savings'),original);
  });
  await check('recovery preserves all attestation versions and disables external entry points',async()=>{
   const count=await val('select count(*)::integer v from savings_refunds_private.termination_versions');await db.exec(read('supabase/recovery/20261027000400_reports_jc_historical.sql'));
   assert.equal(await val('select count(*)::integer v from savings_refunds_private.termination_versions'),count);
   for(const signature of ['public.save_admin_savings_termination(jsonb,uuid)','public.get_admin_savings_regularization(integer,text)','public.get_admin_reports_jc_savings(integer)'])assert.equal(await val("select has_function_privilege('authenticated',$1,'EXECUTE') v",[signature]),false);
  });
  const result={status:'PASS',checks:checks.length,names:checks,environment:'ISOLATED_PGLITE_SYNTHETIC',liveWrites:0};
  const out=process.env.SUTIAPP_HISTORICAL_EVIDENCE;if(out)fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

