'use strict';
// Isolated PostgreSQL/WASM. Synthetic fixtures only; no credentials or network.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {PGlite}=require(process.env.SUTIAPP_PGLITE_PATH||path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function main(){
 const db=new PGlite(),checks=[];let serial=1000;
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const val=async(sql,args=[]) => (await q(sql,args))[0].v;
 const actor=async(perms='savings.read,savings.write,savings.approve,savings.reports,program_requests.read',modules='savings,reportes_jc',id=1,context=1)=>{
  await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.affiliate',$2,false),set_config('test.permissions',$3,false),set_config('test.modules',$4,false)",[id?uid(id):'',context?uid(context):'',perms,modules]);await db.exec('set role authenticated');
 };
 const cmd=(command,key=uid(serial++))=>val('select public.save_admin_savings_refund($1,$2) v',[JSON.stringify(command),key]);
 const fail=async(body,pattern)=>{await db.exec('savepoint expected_failure');let error;try{await body();}catch(e){error=e;}await db.exec('rollback to expected_failure');assert(error,'expected rejection');assert.match(error.message,pattern);};
 const check=async(name,body)=>{await body();checks.push(name);console.log('PASS '+name);};
 const deduction=(ref,extra={})=>({source_reference:ref,deduction_on:'2026-09-30',sent_to_rh_on:'2026-09-15',expected_amount:100,actual_amount:300,confirmed_on:'2026-09-30',confirmation_reference:'NOMINA '+ref,balance_treatment:'NOT_CREDITED',balance_note:'El exceso no fue abonado al ahorro',...extra});
 const create=(ref,extra={})=>({kind:'CREATE',participant_id:uid(10),cause:'DUPLICATE_DISCOUNT',reason:'Descuento adicional registrado',deductions:[deduction(ref)],...extra});
 const action=(c,kind,extra={})=>({kind,case_id:c.id,expected_version:c.version,reason:'Registro administrativo verificable',...extra});
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema auth;create schema extensions;create schema savings_automatic_private;create schema admin_support_private;
   create function admin_support_private.context() returns table(id uuid) language sql stable as $$select nullif(current_setting('test.impersonation',true),'')::uuid where nullif(current_setting('test.impersonation',true),'') is not null$$;
   create table auth.users(id uuid primary key);insert into auth.users values('${uid(1)}'),('${uid(2)}');
   create function extensions.gen_random_uuid() returns uuid language sql volatile as $$select gen_random_uuid()$$;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
   create function public.has_admin_permission(text) returns boolean language sql stable as $$select coalesce($1=any(string_to_array(current_setting('test.permissions',true),',')),false)$$;
   create function public.admin_module_boundary(text[],text default 'read') returns boolean language sql stable as $$select coalesce($1&&string_to_array(current_setting('test.modules',true),','),false)$$;
   create function public.get_admin_reports_jc_context() returns jsonb language sql stable as $$select jsonb_build_object('actor',auth.uid(),'effective_affiliate',public.get_effective_affiliate_id())$$;
   create function public.savings_operation_today() returns date language sql stable as $$select coalesce(nullif(current_setting('test.today',true),'')::date,date '2026-10-27')$$;
   create function public.savings_panel_date(text) returns date language plpgsql immutable as $$begin return $1::date;exception when others then return null;end$$;
   create table affiliates(id uuid primary key,numero_control text,is_archived boolean default false);
   insert into affiliates values('${uid(1)}','001',false),('${uid(2)}','002',false);
   create table savings_participants(id uuid primary key,affiliate_id uuid,legacy_folio text,data_classification text,identity_status text);
   insert into savings_participants values('${uid(10)}','${uid(1)}','001','CANONICAL','RESOLVED');
   create table savings_transactions(id uuid primary key,participant_id uuid,data_classification text,transaction_type text,component text,direction text,amount numeric);
   create table savings_enrollments(id uuid primary key,participant_id uuid,data_classification text,status text,enrollment_started_at timestamptz,terminated_at timestamptz,process_snapshot text,sequence_number integer);
   create table savings_requests(id uuid primary key,participant_id uuid,data_classification text,request_type text,status text,submitted_at timestamptz,settled_at timestamptz,requested_capital_amount numeric,requested_yield_amount numeric,metadata jsonb default '{}',enrollment_id uuid);
   create table savings_contribution_plans(id uuid primary key,enrollment_id uuid,source_request_id uuid,data_classification text,effective_from date,effective_to date,amount numeric,process_snapshot text);
   create table savings_review_batches(id uuid primary key,observed_at timestamptz,source_name text default 'SutiApp Final',expected_records integer default 1,created_at timestamptz default now());
   create table savings_review_records(id uuid primary key,batch_id uuid,source_sheet text,source_row integer,source_folio text,source_data jsonb,proposed_data jsonb default '{}',updated_at timestamptz default now());
   create table savings_registration_removal_archive(id uuid primary key,snapshots jsonb);
   create table savings_balance_certifications(participant_id uuid,command jsonb,source_snapshot jsonb);
   create table fixture_history(participant_id uuid,id text,date date,amount numeric,expected numeric,status text,source text,includes_yield boolean,data_conflict boolean);
   create function public.savings_workspace_history(uuid) returns table(id text,date date,amount numeric,expected numeric,status text,source text,includes_yield boolean,data_conflict boolean) language sql as $$select id,date,amount,expected,status,source,includes_yield,data_conflict from public.fixture_history where participant_id=$1$$;
   create table fixture_schedule(enrollment_id uuid,contribution_date date,expected_amount numeric,process_snapshot text,plan_id uuid,scheduled_amount numeric);
   create function public.generate_savings_schedule(uuid,date,date) returns table(contribution_date date,expected_amount numeric,process_snapshot text,plan_id uuid) language sql as $$select contribution_date,expected_amount,process_snapshot,plan_id from public.fixture_schedule where enrollment_id=$1 and contribution_date between $2 and $3$$;
   create function savings_automatic_private.scheduled(uuid,date) returns jsonb language sql as $$select jsonb_build_object('scheduled_amount',scheduled_amount) from public.fixture_schedule where enrollment_id=$1 and contribution_date=$2$$;
   grant usage on schema public,auth to authenticated,anon,service_role;`);
  await db.exec(read('supabase/migrations/20261027000200_reports_jc_refunds.sql'));
  await db.exec('begin');
  let c;
  await check('anonymous, read-only and wrong-module writers denied',async()=>{
   await actor('', '',null,null);await fail(()=>cmd(create('REF-001')),/DENIED/);
   await actor('savings.read');await fail(()=>cmd(create('REF-001')),/DENIED/);
   await actor('savings.read,savings.write','reportes_jc');await fail(()=>cmd(create('REF-001')),/DENIED/);
  });
  await actor();
  await check('create retains raw control, context, actor and duplicate-command identity',async()=>{
   const input=create('REF-001'),key=uid(serial++);c=await cmd(input,key);assert.equal(c.numero_control,'001');assert.equal(c.version,1);
   assert.deepEqual(await cmd(input,key),c);await fail(()=>cmd({...input,reason:'Otro texto'},key),/IDEMPOTENCY/);
   assert.equal(c.actor_real_auth_user_id,uid(1));assert.equal(c.usuario_contexto_affiliate_id,uid(1));
  });
  await check('exact source discounts cannot be claimed in a second case',async()=>{
   await fail(()=>cmd(create(' ref-001 ')),/ALREADY_CLAIMED/);
   await fail(()=>cmd(create('REF-CENTS',{deductions:[deduction('REF-CENTS',{actual_amount:300.001})]})),/AMOUNT_INVALID/);
   await fail(()=>cmd(create('REF-EVIDENCE',{deductions:[deduction('REF-EVIDENCE',{confirmation_reference:null})]})),/check constraint/);
  });
  await check('version prevents lost updates and submitted future discounts cannot be approved',async()=>{
   await fail(()=>cmd(action(c,'SUBMIT',{expected_version:99})),/VERSION_CONFLICT/);
   let future=await cmd(create('REF-FUTURE',{deductions:[deduction('REF-FUTURE',{deduction_on:'2026-11-15',actual_amount:null,confirmed_on:null,confirmation_reference:null})]}));
   future=await cmd(action(future,'SUBMIT'));await fail(()=>cmd(action(future,'APPROVE',{authorized_amount:200})),/CONFIRM_DISCOUNTS/);
   await q("select set_config('test.today','2026-11-16',true)");
   future=await cmd({...create('REF-FUTURE'),...action(future,'SAVE'),deductions:[deduction('REF-FUTURE',{deduction_on:'2026-11-15',confirmed_on:'2026-11-15'})]});
   future=await cmd(action(future,'SUBMIT'));future=await cmd(action(future,'APPROVE',{authorized_amount:200}));assert.equal(future.status,'APPROVED');
   await q("select set_config('test.today','2026-10-27',true)");
   await fail(()=>cmd(action(future,'PAY',{amount:20,paid_on:'2026-10-27',bank_reference:'FUTURE-DENIED'})),/DATE_INVALID/);
  });
  await check('approval is permission protected and must cover the exact confirmed excess without forgiveness',async()=>{
   c=await cmd(action(c,'SUBMIT'));await actor('savings.read,savings.write');await fail(()=>cmd(action(c,'APPROVE',{authorized_amount:200})),/DENIED/);
   await actor();await fail(()=>cmd(action(c,'APPROVE',{authorized_amount:201})),/FULL_EXCESS_REQUIRED/);
   await fail(()=>cmd(action(c,'APPROVE',{authorized_amount:100})),/FULL_EXCESS_REQUIRED/);
   c=await cmd(action(c,'APPROVE',{authorized_amount:200}));assert.equal(c.pending_amount,200);
  });
  await check('historical partial payments retain dates, references and do not complete the case early',async()=>{
   await fail(()=>cmd(action(c,'PAY',{amount:10,paid_on:'2026-09-29',bank_reference:'BANK-EARLY'})),/DATE_INVALID/);
   await fail(()=>cmd(action(c,'PAY',{amount:10,paid_on:'2026-10-28',bank_reference:'BANK-FUTURE'})),/DATE_INVALID/);
   const input=action(c,'PAY',{amount:80,paid_on:'2026-10-01',bank_reference:'BANK-001'}),key=uid(serial++);
   c=await cmd(input,key);assert.equal(c.status,'PARTIAL');assert.equal(c.pending_amount,120);assert.equal(c.paid_at,null);
   assert.deepEqual(await cmd(input,key),c);await fail(()=>cmd(action(c,'CANCEL')),/STATE_INVALID/);
   await fail(()=>cmd(action(c,'PAY',{amount:121,paid_on:'2026-10-02',bank_reference:'BANK-002'})),/PAYMENT_EXCEEDED/);
   await fail(()=>cmd(action(c,'PAY',{amount:10,paid_on:'2026-10-02',bank_reference:'  bank-001  '})),/SAVINGS_REFUND_PAYMENT_ALREADY_RECORDED/);
  });
  await check('one normalized bank batch reference can pay separate cases without permitting a repeated payment within either case',async()=>{
   let other=await cmd(create('REF-SHARED-BANK-BATCH'));other=await cmd(action(other,'SUBMIT'));other=await cmd(action(other,'APPROVE'));
   other=await cmd(action(other,'PAY',{amount:80,paid_on:'2026-10-01',bank_reference:' bank-001 '}));
   assert.equal(other.status,'PARTIAL');assert.equal(other.pending_amount,120);assert.equal(other.payments.length,1);
   await fail(()=>cmd(action(other,'PAY',{amount:10,paid_on:'2026-10-02',bank_reference:'BANK-001'})),/SAVINGS_REFUND_PAYMENT_ALREADY_RECORDED/);
   const original=await val('select public.get_admin_savings_refunds($1) v',[c.id]);assert.equal(original.cases[0].payments.length,1);assert.equal(original.cases[0].pending_amount,120);
  });
  await check('completion is one case despite two partials; stale concurrent request rejected',async()=>{
   const stale=action(c,'PAY',{amount:120,paid_on:'2026-10-02',bank_reference:'BANK-002'});
   c=await cmd(stale);assert.equal(c.status,'PAID');assert.equal(c.payments.length,2);assert.equal(c.pending_amount,0);
   assert.equal(c.paid_at.slice(0,10),'2026-10-02');await fail(()=>cmd(stale),/VERSION_CONFLICT/);
  });
  await check('immutable payments/audit and no direct browser tables',async()=>{
   await fail(()=>q('select * from savings_refunds_private.cases'),/permission denied/);
   await db.exec('reset role');await fail(()=>q('update savings_refunds_private.payments set amount=1'),/IMMUTABLE/);
   await fail(()=>q('delete from savings_refunds_private.events'),/IMMUTABLE/);
   assert.equal(await val('select count(*)::integer v from savings_transactions'),0);
   assert.equal(await val("select has_function_privilege('anon','public.get_admin_savings_refunds(uuid,text)','EXECUTE') v"),false);
   assert.equal(await val("select has_function_privilege('service_role','public.save_admin_savings_refund(jsonb,uuid)','EXECUTE') v"),false);
   assert.equal(await val("select count(*)::integer v from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='savings_refunds_private' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)"),0);
  });
  await check('adjustment links require matching participant, debit capital and exclusive usage',async()=>{
   await q("insert into savings_transactions values($1,$2,'CANONICAL','ADJUSTMENT','CAPITAL','DEBIT',200)",[uid(80),uid(10)]);
   await q("insert into savings_transactions values($1,$2,'CANONICAL','ADJUSTMENT','CAPITAL','DEBIT',200)",[uid(81),uid(11)]);
   await actor();await fail(()=>cmd(create('REF-BAD-ADJ',{deductions:[deduction('REF-BAD-ADJ',{balance_treatment:'EXISTING_ADJUSTMENT',adjustment_id:uid(81)})]})),/ADJUSTMENT_INVALID/);
   await cmd(create('REF-ADJ',{deductions:[deduction('REF-ADJ',{balance_treatment:'EXISTING_ADJUSTMENT',adjustment_id:uid(80)})]}));
   await fail(()=>cmd(create('REF-ADJ-2',{deductions:[deduction('REF-ADJ-2',{balance_treatment:'EXISTING_ADJUSTMENT',adjustment_id:uid(80)})]})),/unique constraint/);
  });
  await check('report covers canonical and one imported representation, effective changes and full refund',async()=>{
   await db.exec('reset role');
   await q("insert into savings_enrollments values($1,$2,'CANONICAL','ACTIVE','2025-01-01',null,'PROCESS_1',1)",[uid(30),uid(10)]);
   await q("insert into savings_requests(id,participant_id,data_classification,request_type,status,submitted_at,settled_at,requested_capital_amount,requested_yield_amount,metadata) values($1,$2,'CANONICAL','WITHDRAW','SETTLED','2026-09-01','2026-10-03',150,50,'{}'),($3,$2,'CANONICAL','CHANGE_AMOUNT','APPROVED','2026-09-01',null,null,null,'{}')",[uid(40),uid(10),uid(41)]);
   await q("insert into savings_contribution_plans values($1,$2,$3,'CANONICAL','2026-10-01',null,500,'PROCESS_1')",[uid(50),uid(30),uid(41)]);
   await q("insert into savings_review_batches(id,observed_at) values($1,'2026-09-01'),($2,'2026-09-02')",[uid(60),uid(61)]);
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Solicitud de retiro',2,'001',$3),($4,$5,'Solicitud de retiro',2,'001',$3)",[uid(70),uid(60),JSON.stringify({A:'001',D:'2026-10-04',H:'Completado'}),uid(71),uid(61)]);
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Solicitud de retiro',3,'001',$3)",[uid(72),uid(60),JSON.stringify({A:'001',D:'2026-10-05',H:'Completado'})]);
   await q("insert into fixture_history values($1,'history:one','2026-10-15',500,500,'RECEIVED','CERTIFIED_HISTORY',false,false),($1,'history:zero','2026-10-16',0,500,'NO_DEDUCTION','CERTIFIED_HISTORY',false,false)",[uid(10)]);
   await q("insert into fixture_schedule values($1,'2026-11-15',500,'PROCESS_1',$2,350)",[uid(30),uid(50)]);
   await actor();const report=await val('select public.get_admin_reports_jc_savings(2026) v');
   const count=kind=>report.events.filter(e=>e.kind===kind).length;
   assert.equal(count('withdrawal_requested'),2);assert.equal(count('withdrawal_paid'),2);assert.equal(count('contribution_changed'),1);assert.equal(count('refund_paid'),1);assert.equal(count('payroll_discount'),2);
   assert.equal(report.events.find(e=>e.id.startsWith('schedule:')).detail.amount,350);
   assert.equal(report.events.find(e=>e.kind==='refund_paid').occurred_on,'2026-10-02');
   assert.equal(report.events.find(e=>e.kind==='refund_paid').detail.payroll_code,573);
   await actor('savings.read','savings');await fail(()=>val('select public.get_admin_reports_jc_savings(2026) v'),/DENIED/);
  });
  await check('monthly refund completeness is explicit, idempotent and invalidated by a new completed historical payment',async()=>{
   await actor();const report=await val('select public.get_admin_reports_jc_savings(2026) v');
   const missing=report.issues.find(i=>i.code==='REFUND_PERIOD_UNCONFIRMED');assert(missing.months.includes(9));assert(!missing.months.includes(10));assert.equal(missing.scope,'refund');
   await actor('savings.read,savings.approve');await fail(()=>cmd({kind:'CONFIRM_PERIOD',period:'2026-09-01',reason:'Todos los casos concluidos están registrados'}),/DENIED/);
   await actor();await fail(()=>cmd({kind:'CONFIRM_PERIOD',period:'2026-11-01',reason:'Periodo futuro'}),/PERIOD_INVALID/);
   const confirmation={kind:'CONFIRM_PERIOD',period:'2026-09-01',reason:'Todos los casos concluidos están registrados'},key=uid(serial++);
   const period=await cmd(confirmation,key);assert.equal(period.confirmed_case_count,0);assert.deepEqual(await cmd(confirmation,key),period);
   let snapshot=await val('select public.get_admin_reports_jc_savings(2026) v');assert(!snapshot.issues.find(i=>i.code==='REFUND_PERIOD_UNCONFIRMED').months.includes(9));
   let backfill=await cmd(create('REF-PAST'));backfill=await cmd(action(backfill,'SUBMIT'));backfill=await cmd(action(backfill,'APPROVE',{authorized_amount:200}));
   backfill=await cmd(action(backfill,'PAY',{amount:100,paid_on:'2026-09-30',bank_reference:'PAST-ONE'}));
   snapshot=await val('select public.get_admin_reports_jc_savings(2026) v');assert(!snapshot.issues.find(i=>i.code==='REFUND_PERIOD_UNCONFIRMED').months.includes(9));
   assert.equal(snapshot.events.filter(e=>e.kind==='refund_paid'&&e.source_id===backfill.id).length,0);
   const finalPayment=action(backfill,'PAY',{amount:100,paid_on:'2026-09-30',bank_reference:'PAST-TWO'}),paymentKey=uid(serial++);
   backfill=await cmd(finalPayment,paymentKey);
   snapshot=await val('select public.get_admin_reports_jc_savings(2026) v');assert(snapshot.issues.find(i=>i.code==='REFUND_PERIOD_UNCONFIRMED').months.includes(9));
   assert.equal(snapshot.events.filter(e=>e.kind==='refund_paid'&&e.source_id===backfill.id).length,1);
   const refreshed=await cmd(confirmation);assert.equal(refreshed.confirmed_case_count,1);assert.equal(refreshed.version,2);assert.equal(refreshed.invalidated_at,null);
   await cmd(finalPayment,paymentKey);snapshot=await val('select public.get_admin_reports_jc_savings(2026) v');assert(!snapshot.issues.find(i=>i.code==='REFUND_PERIOD_UNCONFIRMED').months.includes(9));
   const overview=await val('select public.get_admin_savings_refunds() v');assert.equal(overview.coveragePeriods[0].period,'2026-09-01');
  });
  await check('a newer partial import fails visibly and a completed empty sheet never resurrects an older sheet',async()=>{
   await db.exec('reset role;savepoint import_batch');
   await q("insert into savings_review_batches(id,observed_at,expected_records) values($1,'2026-10-01',2)",[uid(62)]);
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Ahorro',2,'001','{}')",[uid(73),uid(62)]);
   await actor();await fail(()=>val('select public.get_admin_reports_jc_savings(2026) v'),/IMPORT_INCOMPLETE/);
   await db.exec('reset role');await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Ahorro',3,'002','{}')",[uid(74),uid(62)]);
   await actor();const report=await val('select public.get_admin_reports_jc_savings(2026) v');
   assert.equal(report.events.filter(e=>e.kind==='withdrawal_paid').length,1);assert.equal(report.events.filter(e=>e.source_table==='savings_review_records').length,0);
   assert.equal(report.coverage.import_batch.id,uid(62));assert.equal(report.coverage.import_batch.record_count,2);
   await db.exec('reset role;rollback to import_batch');await actor();
  });
  await check('authorized removal archives prove batch completeness without restoring events or double counting restored IDs',async()=>{
   await db.exec('reset role;savepoint authorized_archive');
   await q("insert into savings_review_batches(id,observed_at,expected_records) values($1,'2026-10-02',2)",[uid(63)]);
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Ahorro',2,'001','{}')",[uid(76),uid(63)]);
   const removed={id:uid(77),batch_id:uid(63),source_sheet:'Solicitud de retiro',source_row:3,source_folio:'001',source_data:{A:'001',D:'2026-01-15',H:'Completado'}};
   const snapshot={savings_review_records:[removed,{...removed,id:uid(78),batch_id:uid(61)}]};
   await q('insert into savings_registration_removal_archive values($1,$2),($3,$2)',[uid(79),JSON.stringify(snapshot),uid(80)]);
   await actor();let report=await val('select public.get_admin_reports_jc_savings(2026) v');
   assert.equal(report.coverage.import_batch.record_count,1);assert.equal(report.coverage.import_batch.archived_record_count,1);assert.equal(report.coverage.import_batch.accounted_record_count,2);
   assert.equal(report.events.filter(e=>e.source_table==='savings_review_records').length,0);
   await db.exec('reset role');await q("update savings_review_batches set expected_records=3 where id=$1",[uid(63)]);
   await actor();await fail(()=>val('select public.get_admin_reports_jc_savings(2026) v'),/IMPORT_INCOMPLETE/);
   await db.exec('reset role');await q("update savings_review_batches set expected_records=2 where id=$1",[uid(63)]);
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,$3,3,'001',$4)",[removed.id,removed.batch_id,removed.source_sheet,JSON.stringify(removed.source_data)]);
   await actor();report=await val('select public.get_admin_reports_jc_savings(2026) v');
   assert.equal(report.coverage.import_batch.record_count,2);assert.equal(report.coverage.import_batch.archived_record_count,0);assert.equal(report.coverage.import_batch.accounted_record_count,2);
   assert.equal(report.events.filter(e=>e.source_id===removed.id&&e.kind==='withdrawal_paid').length,1);
   await db.exec('reset role;rollback to authorized_archive');await actor();
  });
  await check('legacy Terminado without an explicit canonical link flags only G/H and never invents a termination date',async()=>{
   await db.exec('reset role;savepoint legacy_termination');
   await q("update savings_review_batches set expected_records=2 where id=$1",[uid(61)]);
   await q("insert into savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data) values($1,$2,'Solicitud de Ahorro',2,'001',$3)",[uid(75),uid(61),JSON.stringify({A:'001',B:'2026-01-01',F:'2030-12-31',G:'Terminado'})]);
   await actor();const report=await val('select public.get_admin_reports_jc_savings(2026) v');
   const missing=report.issues.find(i=>i.code==='HISTORICAL_TERMINATION_UNMAPPED');assert.equal(missing.scope,'savings');assert.deepEqual(missing.detail.columns,['G','H']);assert.equal(missing.detail.metric,'cancellation');
   assert.equal(report.events.filter(e=>e.kind==='cancellation').length,0);
   const future=await val('select public.get_admin_reports_jc_savings(2027) v');assert(!future.issues.some(i=>i.code==='HISTORICAL_TERMINATION_UNMAPPED'));
   await db.exec('reset role;rollback to legacy_termination');await actor();
  });
  await check('ordinary context cannot replay an authorized idempotency key',async()=>{
   await actor();const key=uid(serial++),input=create('REF-CONTEXT');await cmd(input,key);
   await actor(undefined,undefined,2,2);await fail(()=>cmd(input,key),/IDEMPOTENCY_CONFLICT/);
  });
  // Retrospective workflows use the same tables and remain isolated from all
  // earlier scenarios. No real identity, credentials or network are involved.
  await db.exec('reset role;savepoint historical_cases');
  let historical,originalPayment,firstHistoricalKey;
  const historicalCommand=(ref,extra={})=>create(ref,{
   kind:'REGISTER_HISTORICAL',deductions:[deduction(ref,{deduction_on:'2024-12-30',sent_to_rh_on:null,sent_to_rh_unknown_reason:'No se conserva la fecha exacta del envio RH',confirmed_on:'2024-12-30',historical_payroll_code:573,historical_payroll_reference:'Recibo de nomina historico '+ref})],
   payments:[{amount:120,paid_on:'2025-01-02',bank_reference:'HIST-JAN-'+ref,reason:'Comprobante bancario de enero'},
    {amount:80,paid_on:'2024-12-31',bank_reference:'HIST-DEC-'+ref,reason:'Comprobante bancario de diciembre'}],...extra});
  const confirm=period=>cmd({kind:'CONFIRM_PERIOD',period,reason:'Todos los antecedentes del periodo estan registrados'});
  await check('historical people include exact archived identities without Auth and exclude missing or unresolved identities',async()=>{
   await q("insert into affiliates values($1,'003',true),($2,'004',false)",[uid(3),uid(4)]);
   await q("insert into savings_participants values($1,$2,'003','CANONICAL','RESOLVED'),($3,$4,'004','CANONICAL','AMBIGUOUS'),($5,$4,'MISMATCH','CANONICAL','RESOLVED')",[uid(13),uid(3),uid(14),uid(4),uid(15)]);
   await q('insert into savings_registration_removal_archive values($1,$2)',[uid(94),JSON.stringify({savings_participants:[{id:uid(16),legacy_folio:'REMOVED',data_classification:'CANONICAL',identity_status:'RESOLVED'}]})]);
   await actor();let result=await val('select public.get_admin_savings_refund_people() v');
   assert.deepEqual(result.rows.map(x=>x.participant_id),[uid(10),uid(13)]);assert.equal(result.rows[1].is_archived,true);assert.equal(result.rows[1].folio,'003');
   assert.equal((await val('select public.get_admin_savings_refund_people($1) v',['003'])).rows.length,1);
   assert.equal((await val('select public.get_admin_savings_refund_people($1) v',['REMOVED'])).rows.length,0);
   await fail(()=>cmd(create('ARCHIVED-NORMAL',{participant_id:uid(13)})),/EXACT_IDENTITY_REQUIRED/);
   const archived=historicalCommand('ARCHIVED-HISTORICAL',{participant_id:uid(13)});archived.deductions[0].historical_payroll_code=580;
   const saved=await cmd(archived);assert.equal(saved.affiliate_id,uid(3));assert.equal(saved.origin,'HISTORICAL');
   const report=await val('select public.get_admin_reports_jc_savings(2025) v');assert.equal(report.events.find(e=>e.kind==='refund_paid'&&e.source_id===saved.id).detail.payroll_code,580);
   assert(!report.issues.some(i=>i.code==='REFUND_PAYROLL_PROCESS_UNRESOLVED'&&i.sourceIds?.includes(saved.id)));
   await db.exec('reset role');assert.equal(await val('select is_archived v from affiliates where id=$1',[uid(3)]),true);
   assert.equal(await val('select count(*)::integer v from auth.users where id=$1',[uid(3)]),0);await actor();
  });
  await check('retrospective capture needs write and approve, module access and no impersonation',async()=>{
   await actor('savings.read,savings.write');await fail(()=>cmd(historicalCommand('DENIED-WRITE')),/DENIED/);
   await actor('savings.read,savings.approve');await fail(()=>cmd(historicalCommand('DENIED-APPROVE')),/DENIED/);
   await actor(undefined,'reportes_jc');await fail(()=>cmd(historicalCommand('DENIED-MODULE')),/DENIED/);
   await actor();await q("select set_config('test.impersonation',$1,true)",[uid(9)]);
   await fail(()=>cmd(historicalCommand('DENIED-IMPERSONATION')),/DENIED/);
   await fail(()=>val('select public.get_admin_savings_refund_people() v'),/DENIED/);
   await q("select set_config('test.impersonation','',true)");
  });
  await check('unknown RH dates are explicit historical evidence, never allowed for a current case or guessed',async()=>{
   await fail(()=>cmd(create('NO-RH',{deductions:[deduction('NO-RH',{sent_to_rh_on:null,sent_to_rh_unknown_reason:'No hay evidencia'})]})),/RH_DATE_REQUIRED/);
   const missing=historicalCommand('HIST-RH-MISSING');missing.deductions[0].sent_to_rh_unknown_reason='';await fail(()=>cmd(missing),/RH_DATE_REQUIRED/);
   const unconfirmed=historicalCommand('HIST-UNCONFIRMED');Object.assign(unconfirmed.deductions[0],{actual_amount:null,confirmed_on:null,confirmation_reference:null});
   await fail(()=>cmd(unconfirmed),/CONFIRM_DISCOUNTS/);
  });
  await check('historical multi-payment capture is atomic, chronologically sorted and closes the actual prior year/month',async()=>{
   await confirm('2024-12-01');await confirm('2025-01-01');
   const command=historicalCommand('CROSS-YEAR');firstHistoricalKey=uid(serial++);historical=await cmd(command,firstHistoricalKey);
   assert.equal(historical.status,'PAID');assert.equal(historical.origin,'HISTORICAL');assert.equal(historical.version,1);assert.equal(historical.paid_amount,200);assert.equal(historical.pending_amount,0);
   assert.equal(historical.paid_at.slice(0,10),'2025-01-02');assert.deepEqual(historical.payments.map(p=>p.paid_on),['2024-12-31','2025-01-02']);
   assert(historical.approved_at>'2026-01-01');assert(historical.created_at>'2026-01-01');assert.equal(historical.submitted_at,null);
   assert.equal(historical.deductions[0].sent_to_rh_on,null);assert(historical.deductions[0].sent_to_rh_unknown_reason);
   assert.deepEqual(historical.coverage_invalidated_periods,['2024-12-01','2025-01-01']);
   assert.deepEqual(await cmd(command,firstHistoricalKey),historical);await fail(()=>cmd({...command,reason:'Otra justificacion'},firstHistoricalKey),/IDEMPOTENCY_CONFLICT/);
   const year24=await val('select public.get_admin_reports_jc_savings(2024) v'),year25=await val('select public.get_admin_reports_jc_savings(2025) v');
   assert.equal(year24.events.filter(e=>e.kind==='refund_paid'&&e.source_id===historical.id).length,0);
   assert.equal(year25.events.filter(e=>e.kind==='refund_paid'&&e.source_id===historical.id).length,1);
   assert.equal(year25.events.find(e=>e.source_id===historical.id&&e.kind==='refund_paid').occurred_on,'2025-01-02');
   assert.equal(year25.events.find(e=>e.source_id===historical.id&&e.kind==='refund_paid').detail.payroll_code,573);
   assert.equal(year25.events.find(e=>e.source_id===historical.id&&e.kind==='refund_paid').detail.payroll_evidence[0].source,'HISTORICAL_ATTESTATION');
   assert(!year25.issues.some(i=>i.code==='REFUND_PAYROLL_PROCESS_UNRESOLVED'&&i.sourceIds?.includes(historical.id)));
   originalPayment=historical.payments[1];
  });
  await check('historical payroll evidence fills only an absent date-specific authority and rejects normal or conflicting annotations',async()=>{
   const noEvidence=historicalCommand('NO-PAYROLL-EVIDENCE');delete noEvidence.deductions[0].historical_payroll_code;delete noEvidence.deductions[0].historical_payroll_reference;
   await fail(()=>cmd(noEvidence),/PAYROLL_EVIDENCE_REQUIRED/);
   const invalid=historicalCommand('BAD-PAYROLL-EVIDENCE');invalid.deductions[0].historical_payroll_code=999;await fail(()=>cmd(invalid),/PAYROLL_EVIDENCE_INVALID/);
   invalid.deductions[0].historical_payroll_code=573;invalid.deductions[0].historical_payroll_reference='';await fail(()=>cmd(invalid),/PAYROLL_EVIDENCE_INVALID/);
   const normal=create('NORMAL-PAYROLL-EVIDENCE');Object.assign(normal.deductions[0],{historical_payroll_code:573,historical_payroll_reference:'Recibo de nomina'});await fail(()=>cmd(normal),/PAYROLL_EVIDENCE_INVALID/);
   const conflict=historicalCommand('CANONICAL-CONFLICT');Object.assign(conflict.deductions[0],{deduction_on:'2026-09-30',confirmed_on:'2026-09-30',historical_payroll_code:580});conflict.payments=[{amount:200,paid_on:'2026-10-01',bank_reference:'CANONICAL-CONFLICT',reason:'Pago historico comprobado'}];
   await fail(()=>cmd(conflict),/PAYROLL_EVIDENCE_CONFLICT/);
   delete conflict.deductions[0].historical_payroll_code;delete conflict.deductions[0].historical_payroll_reference;
   const resolved=await cmd(conflict);assert.equal(resolved.deductions[0].historical_payroll_code,null);
   const report=await val('select public.get_admin_reports_jc_savings(2026) v');assert.equal(report.events.find(e=>e.kind==='refund_paid'&&e.source_id===resolved.id).detail.payroll_code,573);
  });
  await check('a later canonical payroll contradiction stays visible and cannot silently replace the historical evidence',async()=>{
   await db.exec('reset role;savepoint canonical_conflict');
   await q("insert into savings_enrollments values($1,$2,'CANONICAL','TERMINATED','2024-01-01',null,'JUB',0)",[uid(95),uid(10)]);
   await actor();const report=await val('select public.get_admin_reports_jc_savings(2025) v');
   const refund=report.events.find(e=>e.kind==='refund_paid'&&e.source_id===historical.id);assert.equal(refund.detail.payroll_code,null);assert.equal(refund.detail.payroll_evidence[0].conflict,true);
   assert.equal(refund.detail.payroll_evidence[0].canonical_code,580);assert.equal(refund.detail.payroll_evidence[0].historical_code,573);
   assert(report.issues.some(i=>i.code==='REFUND_PAYROLL_PROCESS_UNRESOLVED'));
   assert.equal((await val('select public.get_admin_savings_refunds($1) v',[historical.id])).cases[0].deductions[0].payroll_resolution.conflict,true);
   await confirm('2025-01-01');
   const command=action(historical,'CORRECT_PAYROLL_EVIDENCE',{deduction_id:historical.deductions[0].id,historical_payroll_code:580,historical_payroll_reference:'Recibo de pension corregido',reason:'La nomina corresponde a pension en esa quincena'}),key=uid(serial++);
   await actor('savings.read,savings.write');await fail(()=>cmd(command),/DENIED/);await actor('savings.read,savings.approve');await fail(()=>cmd(command),/DENIED/);await actor();
   await fail(()=>cmd({...command,historical_payroll_code:573}),/PAYROLL_EVIDENCE_CONFLICT/);
   await fail(()=>cmd({...command,historical_payroll_reference:''}),/PAYROLL_EVIDENCE_INVALID/);
   await fail(()=>cmd({...command,deduction_id:c.deductions[0].id}),/DEDUCTION_REQUIRED/);
   await fail(()=>cmd({...command,case_id:c.id,expected_version:c.version}),/STATE_INVALID/);
   const corrected=await cmd(command,key),d=corrected.deductions[0];
   assert.equal(d.historical_payroll_code,573);assert.equal(d.effective_historical_payroll_code,580);assert.equal(d.payroll_resolution.conflict,false);assert.equal(d.payroll_history.length,1);
   assert.equal(d.payroll_history[0].historical_payroll_reference,'Recibo de pension corregido');assert.equal(d.payroll_history[0].actor_real_auth_user_id,uid(1));assert.equal(d.payroll_history[0].version,1);
   assert.equal(d.deduction_on,historical.deductions[0].deduction_on);assert.equal(d.actual_amount,historical.deductions[0].actual_amount);assert.equal(corrected.paid_at,historical.paid_at);assert.equal(corrected.paid_amount,200);
   assert.deepEqual(corrected.coverage_invalidated_periods,['2025-01-01']);assert.deepEqual(await cmd(command,key),corrected);await fail(()=>cmd(command),/VERSION_CONFLICT/);
   const resolved=await val('select public.get_admin_reports_jc_savings(2025) v');assert.equal(resolved.events.find(e=>e.kind==='refund_paid'&&e.source_id===historical.id).detail.payroll_code,580);
   assert(!resolved.issues.some(i=>i.code==='REFUND_PAYROLL_PROCESS_UNRESOLVED'&&i.detail.sourceIds?.includes(historical.id)));
   assert((await val('select public.get_admin_savings_refunds() v')).coveragePeriods.find(p=>p.period==='2025-01-01').invalidated_at);
   await db.exec('reset role');await fail(()=>q('update savings_refunds_private.payroll_evidence_versions set historical_payroll_code=573'),/IMMUTABLE/);
   await fail(()=>q('delete from savings_refunds_private.payroll_evidence_versions'),/IMMUTABLE/);
   await db.exec('reset role;rollback to canonical_conflict');await actor();
  });
  await check('dated payroll process uses the matching enrollment and never an old-cycle plan or future enrollment',async()=>{
   await db.exec('reset role;savepoint payroll_cycles');
   await q("insert into savings_enrollments values($1,$2,'CANONICAL','TERMINATED','2023-01-01 07:00Z','2024-12-31 07:00Z','PROCESS_1',1),($3,$2,'CANONICAL','TERMINATED','2025-01-01 07:00Z','2026-01-01 07:00Z','JUB',2),($4,$2,'CANONICAL','ACTIVE','2027-01-01 07:00Z',null,'PROCESS_3',3)",[uid(96),uid(13),uid(97),uid(98)]);
   await q("insert into savings_contribution_plans values($1,$2,null,'CANONICAL','2023-01-01','2024-12-31',100,'PROCESS_1')",[uid(99),uid(96)]);
   assert.equal((await val('select savings_refunds_private.payroll_source($1,$2) v',[uid(13),'2023-06-01'])).code,573);
   assert.equal((await val('select savings_refunds_private.payroll_source($1,$2) v',[uid(13),'2025-06-01'])).code,580);
   assert.equal((await val('select savings_refunds_private.payroll_source($1,$2) v',[uid(13),'2026-10-01'])).code,580);
   assert.equal((await val('select savings_refunds_private.payroll_source($1,$2) v',[uid(13),'2022-12-31'])).code,null);
   await db.exec('rollback to payroll_cycles');await actor();
  });
  await check('historical failures roll back the case and all installments; dates and full excess are mandatory',async()=>{
   const invalid=historicalCommand('ATOMIC-RETRY');invalid.payments[0].amount=119;
   await fail(()=>cmd(invalid),/FULL_EXCESS_REQUIRED/);
   assert.equal((await val('select public.get_admin_savings_refunds() v')).cases.filter(c=>c.deductions.some(d=>d.source_reference==='ATOMIC-RETRY')).length,0);
   const duplicate=historicalCommand('DUP-HISTORY');duplicate.payments[1].bank_reference=duplicate.payments[0].bank_reference.toLowerCase();
   await fail(()=>cmd(duplicate),/PAYMENT_ALREADY_RECORDED/);
   const future=historicalCommand('FUTURE-HISTORY');future.payments[0].paid_on='2026-10-28';await fail(()=>cmd(future),/PAYMENT_DATE_INVALID/);
   const early=historicalCommand('EARLY-HISTORY');early.payments[0].paid_on='2024-12-29';await fail(()=>cmd(early),/PAYMENT_DATE_INVALID/);
   await fail(()=>cmd(historicalCommand('CROSS-YEAR')),/DISCOUNT_ALREADY_CLAIMED/);
   const retried=await cmd(historicalCommand('ATOMIC-RETRY'));assert.equal(retried.status,'PAID');
  });
  await check('payment correction preserves the original, moves completion across years and invalidates both review periods',async()=>{
   await confirm('2024-12-01');await confirm('2025-01-01');
   const command=action(historical,'CORRECT_PAYMENT',{payment_id:originalPayment.id,amount:120,paid_on:'2024-12-31',bank_reference:originalPayment.bank_reference,reason:'La fecha del comprobante era diciembre'}),key=uid(serial++);
   historical=await cmd(command,key);assert.equal(historical.status,'PAID');assert.equal(historical.paid_at.slice(0,10),'2024-12-31');assert.equal(historical.paid_amount,200);assert.equal(historical.payments.length,3);
   const original=historical.payments.find(p=>p.id===originalPayment.id),replacement=historical.payments.find(p=>p.supersedes_payment_id===originalPayment.id);
   assert.equal(original.is_superseded,true);assert.equal(original.paid_on,'2025-01-02');assert.equal(original.amount,120);assert.equal(original.superseded_by_payment_id,replacement.id);assert.equal(replacement.is_superseded,false);
   assert.deepEqual(historical.coverage_invalidated_periods,['2024-12-01','2025-01-01']);assert.deepEqual(await cmd(command,key),historical);
   const periods=(await val('select public.get_admin_savings_refunds() v')).coveragePeriods;assert(periods.find(p=>p.period==='2024-12-01').invalidated_at);assert(periods.find(p=>p.period==='2025-01-01').invalidated_at);
   const year24=await val('select public.get_admin_reports_jc_savings(2024) v'),year25=await val('select public.get_admin_reports_jc_savings(2025) v');
   assert.equal(year24.events.filter(e=>e.kind==='refund_paid'&&e.source_id===historical.id).length,1);assert.equal(year25.events.filter(e=>e.kind==='refund_paid'&&e.source_id===historical.id).length,0);
   await fail(()=>cmd({...command,expected_version:historical.version}),/EFFECTIVE_PAYMENT_REQUIRED/);
   await fail(()=>cmd(command),/VERSION_CONFLICT/);
  });
  await check('reducing a corrected payment reopens the case and an actual missing payment completes it exactly once',async()=>{
   let selected=historical.payments.find(p=>p.supersedes_payment_id===originalPayment.id);
   historical=await cmd(action(historical,'CORRECT_PAYMENT',{payment_id:selected.id,amount:100,paid_on:'2024-12-31',bank_reference:selected.bank_reference,reason:'El comprobante original acredita cien pesos'}));
   assert.equal(historical.status,'PARTIAL');assert.equal(historical.paid_at,null);assert.equal(historical.paid_amount,180);assert.equal(historical.pending_amount,20);
   const report=await val('select public.get_admin_reports_jc_savings(2024) v');assert.equal(report.events.filter(e=>e.kind==='refund_paid'&&e.source_id===historical.id).length,0);
   await fail(()=>cmd(action(historical,'PAY',{amount:21,paid_on:'2025-02-01',bank_reference:'MISSING-OVER'})),/PAYMENT_EXCEEDED/);
   historical=await cmd(action(historical,'PAY',{amount:20,paid_on:'2025-02-01',bank_reference:'MISSING-ACTUAL'}));assert.equal(historical.status,'PAID');assert.equal(historical.paid_amount,200);assert.equal(historical.paid_at.slice(0,10),'2025-02-01');
   const completed=await val('select public.get_admin_reports_jc_savings(2025) v');assert.equal(completed.events.filter(e=>e.kind==='refund_paid'&&e.source_id===historical.id).length,1);
  });
  await check('correction requires current version, exact case payment, permission, cents, positive amount and unique active reference',async()=>{
   const selected=historical.payments.find(p=>!p.is_superseded),base=action(historical,'CORRECT_PAYMENT',{payment_id:selected.id,amount:selected.amount,paid_on:selected.paid_on,bank_reference:selected.bank_reference,reason:'Correccion administrativa con comprobante'});
   await actor('savings.read,savings.approve');await fail(()=>cmd(base),/DENIED/);await actor('savings.read,savings.write');await fail(()=>cmd(base),/DENIED/);await actor();
   await fail(()=>cmd({...base,payment_id:uid(888)}),/EFFECTIVE_PAYMENT_REQUIRED/);
   await fail(()=>cmd({...base,payment_id:c.payments[0].id}),/EFFECTIVE_PAYMENT_REQUIRED/);
   await fail(()=>cmd({...base,expected_version:1}),/VERSION_CONFLICT/);
   await fail(()=>cmd({...base,amount:0}),/PAYMENT_EXCEEDED/);await fail(()=>cmd({...base,amount:0.001}),/AMOUNT_INVALID/);
   await fail(()=>cmd({...base,amount:selected.amount+1}),/PAYMENT_EXCEEDED/);await fail(()=>cmd({...base,paid_on:'2026-10-28'}),/PAYMENT_DATE_INVALID/);
   await fail(()=>cmd({...base,bank_reference:historical.payments.find(p=>!p.is_superseded&&p.id!==selected.id).bank_reference}),/PAYMENT_ALREADY_RECORDED/);
   await db.exec('reset role');await fail(()=>q('update savings_refunds_private.payments set paid_on=$1 where id=$2',['2024-12-31',originalPayment.id]),/IMMUTABLE/);
   const raw=await q('select amount,paid_on::text from savings_refunds_private.payments where id=$1',[originalPayment.id]);assert.deepEqual(raw,[{amount:'120.00',paid_on:'2025-01-02'}]);await actor();
  });
  await check('monthly review rejects current or future month and historical commands never write the savings ledger',async()=>{
   await fail(()=>confirm('2026-10-01'),/PERIOD_INVALID/);await fail(()=>confirm('2026-11-01'),/PERIOD_INVALID/);
   const closed=await confirm('2025-02-01');assert.equal(closed.confirmed_case_count,1);
   const rows=(await val('select public.get_admin_savings_refunds($1) v',[historical.id])).cases[0];
   assert(rows.events.some(e=>e.action==='REGISTER_HISTORICAL'));assert.equal(rows.events.filter(e=>e.action==='CORRECT_PAYMENT').length,2);
   await db.exec('reset role');assert.equal(await val('select count(*)::integer v from savings_transactions'),2);
   assert.equal(await val("select has_function_privilege('anon','public.get_admin_savings_refund_people(text)','EXECUTE') v"),false);
   assert.equal(await val("select has_function_privilege('service_role','public.get_admin_savings_refund_people(text)','EXECUTE') v"),false);
  });
  await check('operational recovery preserves historical installments, replacements and audit while revoking the new lookup',async()=>{
   await db.exec('reset role;savepoint historical_recovery');
   const digest=()=>val("select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'')) v from savings_refunds_private.payments p");
   const before=await digest(),events=await val('select count(*)::integer v from savings_refunds_private.events');
   await db.exec(read('supabase/recovery/20261027000200_reports_jc_refunds.sql').replace(/^begin;|^commit;/gm,''));
   assert.equal(await digest(),before);assert.equal(await val('select count(*)::integer v from savings_refunds_private.events'),events);
   assert.equal(await val("select has_function_privilege('authenticated','public.get_admin_savings_refund_people(text)','EXECUTE') v"),false);
   await db.exec('rollback to historical_recovery');
  });
  await db.exec('reset role;rollback to historical_cases');await actor();
  await check('recovery removes only capabilities and preserves operational history',async()=>{
   await db.exec('reset role');const before=await val('select count(*)::integer v from savings_refunds_private.cases');
   await db.exec(read('supabase/recovery/20261027000200_reports_jc_refunds.sql').replace(/^begin;|^commit;/gm,''));
   assert.equal(await val('select count(*)::integer v from savings_refunds_private.cases'),before);
   assert.equal(await val("select has_function_privilege('authenticated','public.save_admin_savings_refund(jsonb,uuid)','EXECUTE') v"),false);
  });
  await db.exec('rollback');assert.equal(await val('select count(*)::integer v from savings_refunds_private.cases'),0);
  console.log(JSON.stringify({status:'PASS',environment:'isolated PGlite transaction rolled back',checks:checks.length,productionMutations:0}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
