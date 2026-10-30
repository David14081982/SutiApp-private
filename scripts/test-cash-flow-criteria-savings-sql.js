'use strict';
// H-FLUJO-EFECTIVO-CRITERIO-001: changed report-reader criteria only.
// Existing fixture setup is reused; no old suite, network, credentials or production writes.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {PGlite}=require(process.env.SUTIAPP_PGLITE_PATH||path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const migration='supabase/migrations/20261030000100_reports_jc_cash_flow.sql';
function definition(file,name,tag='$$'){
 const source=read(file),start=source.search(new RegExp('create (?:or replace )?function '+name.replaceAll('.','\\.')+'\\(', 'i'));
 assert(start>=0,name);const body=source.indexOf(tag,start),end=source.indexOf(tag+';',body+tag.length);
 assert(end>body,name);return source.slice(start,end+tag.length+1);
}
async function main(){
 const db=new PGlite(),checks=[];
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const val=async(sql,args=[])=>(await q(sql,args))[0].v;
 const report=(from='2026-10-01')=>val('select public.get_admin_reports_jc_cash_flow($1) v',[from]);
 const actor=async(perms='program_requests.read,savings.read,savings.reports',module='reportes_jc',id=1,imp=false)=>{
  await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false),set_config('test.module',$3,false),set_config('test.impersonation',$4,false)",[id?uid(id):'',perms,module,imp?'yes':'']);await db.exec('set role authenticated');
 };
 const check=async(name,fn)=>{if(process.env.SUTIAPP_CASH_FLOW_SQL_CHECK&&!process.env.SUTIAPP_CASH_FLOW_SQL_CHECK.split('|').some(filter=>name.includes(filter)))return;await fn();checks.push(name);console.log('PASS '+name);};
 const reject=async(fn,pattern)=>{let error;try{await fn();}catch(e){error=e;}assert(error);assert.match(error.message,pattern);};
 const tables=['savings_participants','savings_enrollments','savings_contribution_plans','savings_contribution_overrides','savings_transactions','savings_requests','savings_balance_certifications','savings_review_records','savings_review_batches','savings_registration_removal_archive'];
 const snapshot=async()=>{await db.exec('reset role');const out={};for(const table of tables)out[table]=await val(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) v from public.${table} t`);return out;};
 const history='supabase/migrations/20261001000200_savings_admin_workspace.sql';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema admin_support_private;create schema savings_automatic_private;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
   create function public.has_admin_permission(text) returns boolean language sql stable as $$select $1=any(string_to_array(coalesce(current_setting('test.permissions',true),''),','))$$;
   create function public.admin_module_boundary(text[],text) returns boolean language sql stable as $$select current_setting('test.module',true)=any($1)$$;
   create function admin_support_private.module_visible(uuid,text) returns boolean language sql stable as $$select current_setting('test.module',true)=$2$$;
   create function admin_support_private.context() returns table(id text) language sql stable as $$select 'impersonation' where current_setting('test.impersonation',true)='yes'$$;
   create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select auth.uid()$$;
   create function public.savings_operation_today() returns date language sql stable as $$select date '2026-10-30'$$;
   create table public.savings_participants(id uuid primary key,legacy_folio text,data_classification text);
   create table public.savings_review_batches(id uuid primary key,source_name text default 'SutiApp Final',observed_at timestamptz default now(),created_at timestamptz default now(),expected_records integer);
   create table public.savings_review_records(id uuid primary key,batch_id uuid,source_sheet text,source_folio text,source_data jsonb default '{}',proposed_data jsonb default '{}',field_defs jsonb default '[]');
   create table public.savings_registration_removal_archive(snapshots jsonb);
   create table public.savings_balance_certifications(participant_id uuid primary key,record_id uuid,cutoff_on date,source_snapshot jsonb,command jsonb);
   create table public.savings_enrollments(id uuid primary key,participant_id uuid,data_classification text,status text,enrollment_started_at timestamptz,first_expected_contribution_date date,terminated_at timestamptz);
   create table public.savings_contribution_plans(id uuid primary key,enrollment_id uuid,amount numeric,process_snapshot text,effective_from date,effective_to date,source_request_id uuid,data_classification text,created_by_auth_user_id uuid);
   create table public.savings_contribution_overrides(enrollment_id uuid,contribution_date date,expected_amount numeric,actual_amount numeric,version_number integer);
   create table public.savings_transactions(id uuid primary key,participant_id uuid,enrollment_id uuid,data_classification text,transaction_type text,component text,direction text,amount numeric,effective_date date,contribution_date date,idempotency_key text);
   create table public.savings_holds(participant_id uuid,component text,amount numeric,status text);
   create table public.savings_requests(id uuid primary key,participant_id uuid,data_classification text,status text,request_type text,withdrawal_kind text,requested_amount numeric,effective_from date,metadata jsonb default '{}');
   create table savings_automatic_private.instructions(id uuid primary key,enrollment_id uuid,contribution_date date,version integer,plan_id uuid,plan_hash text,amount numeric);
   grant usage on schema public,auth to authenticated,anon,service_role;
  `);
  for(const name of ['public.savings_panel_number','public.savings_panel_date'])await db.exec(definition('supabase/migrations/20260906001000_savings_reference_panel.sql',name));
  for(const name of ['public.savings_next_contribution_date','public.generate_savings_schedule'])await db.exec(definition('supabase/migrations/20260906000100_savings_operations.sql',name));
  for(const name of ['public.savings_workspace_receipts','public.savings_workspace_history'])await db.exec(definition(history,name));
  await db.exec(definition('supabase/migrations/20260902000100_savings_shadow_foundation.sql','public.savings_participant_balance'));
  for(const name of ['savings_automatic_private.plan_hash','savings_automatic_private.scheduled'])await db.exec(definition('supabase/migrations/20261003000400_savings_automatic_contributions.sql',name));
  await db.exec(definition('supabase/migrations/20261027000300_reports_jc_screen.sql','public.get_admin_reports_jc_context','$jc$'));
  const original=await val("select md5(string_agg(pg_get_functiondef(p.oid),'|' order by p.oid)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','savings_automatic_private','admin_support_private','auth')");
  for(const table of tables)await db.exec('alter table public.'+table+' enable row level security;alter table public.'+table+' force row level security;revoke all on public.'+table+' from public,anon,authenticated,service_role;');
  await db.exec(read(migration).replaceAll('\r\n','\n'));
  await q("insert into savings_participants values($1,'001','CANONICAL'),($2,'002','CANONICAL')",[uid(1),uid(2)]);
  await q("insert into savings_review_batches(id,expected_records) values($1,5)",[uid(10)]);
  await q("insert into savings_review_records(id,batch_id,source_sheet,source_folio,source_data,field_defs) values($1,$2,'Ahorro','001',$3,$4)",[uid(11),uid(10),JSON.stringify({D:'1',AA:500,AR:150}),JSON.stringify([{key:'AA',label:'2026-06-15 · Descuento registrado'},{key:'AR',label:'2026-09-15 · Descuento registrado (incluye rendimiento DT)'}])]);
  await q("insert into savings_balance_certifications values($1,$2,'2026-09-30',$3,'{\"process\":\"1\"}')",[uid(1),uid(11),JSON.stringify({source:{D:'1',AA:500,AR:150},proposal:{}})]);
  for(const [id,person,first] of [[21,1,'2026-11-15'],[22,2,'2026-10-15']]){
   await q("insert into savings_enrollments values($1,$2,'CANONICAL','ACTIVE','2026-09-01 07:00Z',$3,null)",[uid(id),uid(person),first]);
   await q("insert into savings_contribution_plans values($1,$2,100,'PROCESS_1',$3,null,null,'CANONICAL',$4)",[uid(id+10),uid(id),first,uid(1)]);
  }
  for(const [version,amount] of [[1,100],[2,80]])await q("insert into savings_contribution_overrides values($1,'2026-10-15',100,$2,$3)",[uid(22),amount,version]);
  const tx=async(id,p,type,component,direction,amount,date,en=null,contribution=null,key='synthetic:'+id)=>q('insert into savings_transactions values($1,$2,$3,\'CANONICAL\',$4,$5,$6,$7,$8,$9,$10)',[uid(id),uid(p),en&&uid(en),type,component,direction,amount,date,contribution,key]);
  await tx(40,1,'REGULARIZATION','CAPITAL','CREDIT',1000,'2026-09-30');await tx(41,1,'REGULARIZATION','YIELD','CREDIT',100,'2026-09-30');
  await tx(42,2,'CONTRIBUTION','CAPITAL','CREDIT',100,'2026-10-15',22,'2026-10-15');await tx(43,2,'ADJUSTMENT','CAPITAL','DEBIT',20,'2026-10-15',22,'2026-10-15');
  await q("insert into savings_requests values($1,$2,'CANONICAL','SETTLED','WITHDRAW','PARTIAL',35,'2026-10-15',$3)",[uid(50),uid(1),JSON.stringify({source_record_id:uid(12)})]);
  await tx(44,1,'WITHDRAWAL','CAPITAL','DEBIT',30,'2026-10-15',21,null,'SAVINGS_RUNTIME_PAYMENT:'+uid(50)+':CAPITAL');
  await tx(45,1,'WITHDRAWAL','YIELD','DEBIT',5,'2026-10-15',21,null,'SAVINGS_RUNTIME_PAYMENT:'+uid(50)+':YIELD');
  await tx(46,1,'YIELD_CREDIT','YIELD','CREDIT',8,'2026-10-20');await tx(47,1,'ADJUSTMENT','CAPITAL','CREDIT',3,'2026-10-22');
  for(const [id,data] of [[12,{A:'001',D:'2026-10-15',G:35,H:'Completado'}],[13,{A:'001',D:'2026-08-15',G:55,H:'Completado'}],[14,{A:'001',D:'2026-10-15',G:35,H:'Completado'}],[15,{A:'001',D:'2026-07-15',G:null,H:'Completado'}]])await q("insert into savings_review_records(id,batch_id,source_sheet,source_folio,source_data) values($1,$2,'Solicitud de retiro','001',$3)",[uid(id),uid(10),JSON.stringify(data)]);
  for(const [id,amount,date] of [[51,50,'2026-11-15'],[52,60,null],[53,70,'2026-09-15']])await q("insert into savings_requests(id,participant_id,data_classification,status,request_type,withdrawal_kind,requested_amount,effective_from) values($1,$2,'CANONICAL','APPROVED','WITHDRAW','TOTAL',$3,$4)",[uid(id),uid(1),amount,date]);
  await q("insert into savings_automatic_private.instructions select $1,$2,'2026-11-15',1,$3,savings_automatic_private.plan_hash($3),25",[uid(60),uid(21),uid(31)]);
  const metadata=()=>q("select oid,proowner,proacl,provolatile,prosecdef,proconfig,md5(pg_get_functiondef(oid)) hash from pg_proc where oid='public.get_admin_reports_jc_cash_flow(date)'::regprocedure").then(rows=>rows[0]);
  const before=await snapshot(),beforeFunction=await metadata();
  const oldReports={};await actor();for(const from of ['2026-01-01','2026-10-01'])oldReports[from]=await report(from);
  await db.exec('reset role');
  const nextMigration='supabase/migrations/20261030000500_reports_jc_cash_flow_criteria_savings.sql';
  const recovery='supabase/recovery/20261030000500_reports_jc_cash_flow_criteria_savings.sql';
  await db.exec(read(nextMigration));const afterFunction=await metadata();await actor();
  const savepoint=async fn=>{await db.exec('reset role;begin');try{await fn();}finally{await db.exec('rollback;reset role');await actor();}};
  const event=(r,id)=>r.events.find(e=>e.source_id===uid(id));
  const balance=(r,month)=>r.balances.find(b=>b.month===month+'-01');
  await check('reader replacement preserves OID, owner, ACL, security and every business helper',async()=>{
   assert.equal(beforeFunction.hash,'544ddf4e1946ff5cf5ea760bf154fc58');
   assert.equal(afterFunction.hash,'94b10b95af8b16883ace97c8f85f67ab');
   const clean=m=>{const {hash,...rest}=m;return rest;};assert.deepEqual(clean(afterFunction),clean(beforeFunction));
   assert.equal(afterFunction.provolatile,'s');assert.equal(afterFunction.prosecdef,true);assert.deepEqual(afterFunction.proconfig,['search_path=""']);
   assert.equal(await val("select md5(string_agg(pg_get_functiondef(p.oid),'|' order by p.oid)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','savings_automatic_private','admin_support_private','auth') and p.oid<>'public.get_admin_reports_jc_cash_flow(date)'::regprocedure"),original);
  });
  await check('incomplete import is an observation and available withdrawals remain recorded',()=>savepoint(async()=>{
   await q('update savings_review_batches set expected_records=999');await actor();
   const r=await report('2026-01-01');assert.equal(event(r,13).amount,55);assert.equal(event(r,13).status,'RECORDED');
   assert.deepEqual(r.issues.find(i=>i.code==='SAVINGS_HISTORICAL_IMPORT_UNAVAILABLE').affectedKinds,[]);
  }));
  await check('only explicit source-record and payment-idempotency links deduplicate withdrawals',async()=>{
   const r=await report(),paid=r.events.filter(e=>e.kind==='withdrawal_partial');
   assert.equal(paid.length,2);assert.equal(paid.reduce((s,e)=>s+e.amount,0),35);assert(!event(r,12));
   assert.equal(event(r,14).amount,35);assert.equal(event(r,14).status,'RECORDED');
   assert.deepEqual(r.issues.find(i=>i.code==='SAVINGS_WITHDRAWAL_KIND_UNKNOWN').affectedKinds,[]);
   assert.equal(event(r,44).withdrawal_component,'CAPITAL');assert.equal(event(r,45).withdrawal_component,'YIELD');
   assert.equal(paid.filter(e=>e.withdrawal_component==='YIELD').reduce((s,e)=>s+e.amount,0),5);
   await savepoint(async()=>{
    await q("insert into savings_requests values($1,$2,'CANONICAL','APPROVED','WITHDRAW','PARTIAL',55,'2026-08-15',$3)",[uid(54),uid(1),JSON.stringify({source_record_id:uid(13)})]);await actor();
    assert.equal(event(await report('2026-01-01'),13).amount,55);
   });
  });
  await check('uncertified registered contributions and current corrections retain official amounts',()=>savepoint(async()=>{
   await q('delete from savings_balance_certifications');
   await q("update savings_review_records set proposed_data='{\"AA\":525}' where id=$1",[uid(11)]);await actor();
   const r=await report('2026-01-01'),june=r.events.filter(e=>e.kind==='contribution'&&e.date==='2026-06-15');
   assert.equal(june.length,1);assert.equal(june[0].amount,525);assert.equal(june[0].source,'savings_review_records');
   assert.equal(r.events.filter(e=>e.kind==='contribution_mixed').reduce((s,e)=>s+e.amount,0),150);
   assert.equal(balance(r,'2026-06').known_amount,525);
  }));
  await check('native correction replaces the same receipt instead of duplicating imported representation',()=>savepoint(async()=>{
   await q('delete from savings_balance_certifications');
   await q("update savings_review_records set source_data=source_data||'{\"ZZ\":75}',field_defs=field_defs||$1::jsonb where id=$2",[JSON.stringify([{key:'ZZ',label:'2026-10-15 Descuento registrado'}]),uid(11)]);
   await q("insert into savings_contribution_overrides values($1,'2026-10-15',100,90,1)",[uid(21)]);await actor();
   const r=await report(),rows=r.events.filter(e=>e.date==='2026-10-15'&&e.kind==='contribution');
   assert.equal(rows.length,2);assert.deepEqual(rows.map(e=>e.amount).sort((a,b)=>a-b),[80,90]);
   assert(!r.events.some(e=>e.id.includes(':ZZ')));
  }));
  await check('historical balances retain dated known amounts without retroactive regularization',async()=>{
   const r=await report('2026-01-01');
   assert.equal(balance(r,'2026-06').known_amount,500);assert.equal(balance(r,'2026-08').known_amount,445);
   assert.equal(balance(r,'2026-09').amount,1100);assert.equal(balance(r,'2026-10').amount,1156);
   assert.equal(balance(r,'2026-01').known_amount,0);assert.equal(balance(r,'2026-01').amount,null);
   assert(!r.events.some(e=>e.source_id===uid(40)||e.source_id===uid(41)));
   await savepoint(async()=>{
    await q("update savings_review_records set source_data=source_data||'{\"F\":\"2026-06-15\"}' where id=$1",[uid(11)]);await actor();
    const revised=await report('2026-01-01');assert.equal(balance(revised,'2026-06').amount,500);
    assert.equal(balance(revised,'2026-07').amount,null);assert.equal(balance(revised,'2026-07').known_amount,500);
    assert.equal(balance(revised,'2026-01').amount,0);
   });
  });
  await check('history beginning after account start preserves known sum and marks incomplete opening',()=>savepoint(async()=>{
   await q("update savings_review_records set source_data=source_data||'{\"F\":\"2025-01-15\"}' where id=$1",[uid(11)]);await actor();
   const r=await report('2026-01-01');assert.equal(balance(r,'2026-06').known_amount,500);
   assert.equal(balance(r,'2026-06').amount,null);assert.equal(balance(r,'2026-06').unknown_count,1);
   assert.equal(balance(r,'2026-09').amount,1100);assert.equal(balance(r,'2026-10').amount,1156);
  }));
  await check('future paid-marked withdrawals retain amount but never count as recovered cash',()=>savepoint(async()=>{
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_folio,source_data) values($1,$2,'Solicitud de retiro','001',$3)",[uid(70),uid(10),JSON.stringify({A:'001',D:'2026-11-15',G:45,H:'Completado'})]);
   await tx(71,1,'WITHDRAWAL','YIELD','DEBIT',12,'2026-11-15');await actor();
   const r=await report();assert.equal(event(r,70).amount,45);assert.equal(event(r,70).status,'SCHEDULED');assert(!event(r,71));
   assert.equal(balance(r,'2026-10').amount,1156);assert(r.balances.slice(1).every(b=>b.amount===null&&b.known_amount===null));
  }));
  await check('missing dates retain available amounts unassigned and missing amounts never become zero',()=>savepoint(async()=>{
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_folio,source_data) values($1,$2,'Solicitud de retiro','001',$3)",[uid(72),uid(10),JSON.stringify({A:'001',D:null,G:65,H:'Completado'})]);
   await q("update savings_review_records set source_data=source_data||'{\"ZZ\":27}',field_defs=field_defs||$1::jsonb where id=$2",[JSON.stringify([{key:'ZZ',label:'Fecha ausente Descuento registrado'}]),uid(11)]);await actor();
   const r=await report('2026-01-01'),undated=r.events.find(e=>e.id.includes(':ZZ'));
   assert.equal(event(r,72).amount,65);assert.equal(event(r,72).date,null);assert.equal(event(r,72).status,'UNKNOWN');
   assert.equal(undated.amount,27);assert.equal(undated.date,null);assert.equal(undated.status,'UNKNOWN');
   assert.equal(event(r,15).amount,null);assert.equal(event(r,15).status,'UNKNOWN');
   assert.equal(balance(r,'2026-06').known_amount,500);
  }));
  await check('unlinked official account retains registered balance and dated contributions without certification',()=>savepoint(async()=>{
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_folio,source_data,proposed_data,field_defs) values($1,$2,'Ahorro','003',$3,$4,$5)",[uid(73),uid(10),JSON.stringify({A:'003',F:'2026-06-15',Q:200,W:'Ahorrando',X:'2026-06-15',AA:200}),JSON.stringify({AA:225}),JSON.stringify([{key:'AA',label:'2026-06-15 Descuento registrado'}])]);await actor();
   const r=await report('2026-01-01');assert(r.events.some(e=>e.id.includes(uid(73))&&e.amount===225));
   assert.equal(balance(r,'2026-06').known_amount,725);assert.equal(balance(r,'2026-10').amount,1381);
  }));
  await check('new import batch uses unique business folio without duplicating an older certified account',()=>savepoint(async()=>{
   await q("update savings_review_batches set observed_at='2026-09-30' where id=$1",[uid(10)]);
   await q("insert into savings_review_batches(id,expected_records,observed_at) values($1,1,'2026-10-30')",[uid(74)]);
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_folio,source_data,field_defs) values($1,$2,'Ahorro','001',$3,$4)",[uid(75),uid(74),JSON.stringify({A:'001',F:'2026-06-15',Q:9999,ZZ:70}),JSON.stringify([{key:'ZZ',label:'2026-10-16 Descuento registrado'}])]);await actor();
   const r=await report();assert.equal(balance(r,'2026-10').amount,1156);
   assert.equal(r.events.filter(e=>e.id.includes(uid(75))).length,1);assert.equal(r.events.find(e=>e.id.includes(uid(75))).amount,70);
  }));
  await check('withdrawal with no identifiable account remains cash and makes historic balance partial',()=>savepoint(async()=>{
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_folio,source_data) values($1,$2,'Solicitud de retiro','999',$3)",[uid(76),uid(10),JSON.stringify({A:'999',D:'2026-08-15',G:22,H:'Completado'})]);await actor();
   const r=await report('2026-01-01');assert.equal(event(r,76).amount,22);assert.equal(balance(r,'2026-08').known_amount,445);
   assert.equal(balance(r,'2026-08').amount,null);assert.equal(balance(r,'2026-08').unknown_count,2);
  }));
  await check('existing authorization and direct-table denials remain enforced after replacement',async()=>{
   await actor('savings.read');await reject(()=>report(),/DENIED/);await actor(undefined,undefined,1,true);await reject(()=>report(),/DENIED/);
   await actor(undefined,undefined,null);await reject(()=>report(),/AUTH_REQUIRED/);await actor();await reject(()=>q('select * from savings_transactions'),/permission denied/);
   await db.exec('reset role;set role anon');await reject(()=>report(),/permission denied/);
   await db.exec('reset role;set role service_role');await reject(()=>report(),/permission denied/);await actor();
  });
  await check('single live SELECT plan is equivalent to the proposed RPC',async()=>{
   const {savingsCriteriaSourceSelect}=await import('./verify-cash-flow-criteria-savings-source.mjs');
   const expected=await report('2026-01-01');await db.exec('reset role');
   const canonical=value=>({...value,issues:value.issues.map(i=>({...i,months:[...i.months].sort(),sourceIds:[...i.sourceIds].sort(),affectedKinds:[...i.affectedKinds].sort()}))});
   const actual=(await q(savingsCriteriaSourceSelect('2026-01')))[0].report;assert.deepEqual(canonical(actual),canonical(expected));await actor();
  });
  await check('definition drift blocks safely, recovery is exact and no financial source changed',async()=>{
   assert.deepEqual(await snapshot(),before);
   await reject(()=>db.exec(read(nextMigration)),/DEFINITION_DRIFT/);await db.exec('rollback');assert.deepEqual(await metadata(),afterFunction);
   await db.exec(read(recovery));assert.deepEqual(await metadata(),beforeFunction);
   await actor();for(const from of Object.keys(oldReports))assert.deepEqual(await report(from),oldReports[from]);
   assert.deepEqual(await snapshot(),before);
  });
  const evidence={status:'PASS',task:'H-FLUJO-EFECTIVO-CRITERIO-001',scope:'Savings report SQL reader only',checkedAt:new Date().toISOString(),checks,
   sourceAuthority:'Official recorded savings values; no certification gate',oldDefinitionMd5:beforeFunction.hash,newDefinitionMd5:afterFunction.hash,
   sameOidOwnerAcl:true,exactRecovery:true,financialWrites:false,productionCalls:0,testsUseSyntheticRecords:true};
  const dir=path.join(root,'docs/qa/evidence/cash-flow-criteria');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'savings-sql.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',checks:checks.length,financialWrites:false,productionCalls:0}));
 }finally{await db.close();}
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
