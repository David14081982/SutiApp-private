'use strict';
// Focused PostgreSQL/WASM test. Synthetic records only; no network or credentials.
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
  await db.exec(read(migration));
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
  const before=await snapshot();await actor();
  await check('existing reports authorization, impersonation denial and no direct-table grants',async()=>{
   await actor('savings.read');await reject(()=>report(),/DENIED/);await actor(undefined,'savings');await reject(()=>report(),/DENIED/);
   await actor(undefined,undefined,1,true);await reject(()=>report(),/DENIED/);await actor(undefined,undefined,null);await reject(()=>report(),/AUTH_REQUIRED/);
   await actor();await reject(()=>q('select * from savings_transactions'),/permission denied/);
   await db.exec('reset role;set role anon');await reject(()=>report(),/permission denied/);
   await db.exec('reset role;set role service_role');await reject(()=>report(),/permission denied/);await actor();
  });
  await check('twelve months, real dates, invalid ranges and unknown future balances',async()=>{
   await reject(()=>report('2026-10-02'),/RANGE_INVALID/);await reject(()=>report('2101-01-01'),/RANGE_INVALID/);assert.equal((await report('2100-12-01')).balances[0].month,'2100-12-01');const r=await report();assert.equal(r.as_of,'2026-10-30');assert.equal(r.balances.length,12);
   assert.equal(r.balances[0].month,'2026-10-01');assert.equal(r.balances[11].month,'2027-09-01');assert.equal(r.balances[0].amount,1156);
   assert(r.balances.slice(1).every(b=>b.amount===null&&b.known_amount===null));
  });
  await check('latest correction is counted once and no opening is invented as cash or yield',async()=>{
   const r=await report(),received=r.events.filter(e=>e.kind==='contribution'&&e.status==='RECORDED');assert.equal(received.length,1);assert.equal(received[0].amount,80);
   assert.equal(r.events.filter(e=>e.kind==='yield_credited').reduce((s,e)=>s+e.amount,0),8);
   assert.equal(r.events.filter(e=>e.kind==='adjustment').reduce((s,e)=>s+e.amount,0),3);assert(!r.events.some(e=>e.source_id===uid(40)||e.source_id===uid(41)));
   assert(r.events.some(e=>e.kind==='contribution'&&e.amount===null&&e.status==='UNKNOWN'));
  });
  await check('withdrawal ledger components and historical references never double count',async()=>{
   const r=await report(),withdrawals=r.events.filter(e=>e.kind==='withdrawal_partial');assert.equal(withdrawals.length,2);assert.equal(withdrawals.reduce((s,e)=>s+e.amount,0),35);
   assert(!r.events.some(e=>e.source_id===uid(12)));const ambiguous=r.events.find(e=>e.source_id===uid(14));assert.equal(ambiguous.amount,null);assert.equal(ambiguous.status,'UNKNOWN');
   const history=await report('2026-01-01'),record=history.events.find(e=>e.source_id===uid(13));assert.equal(record.kind,'withdrawal_unspecified');assert.equal(record.amount,55);
   assert.equal(history.events.find(e=>e.source_id===uid(15)).amount,null);assert(history.issues.some(i=>i.code==='SAVINGS_WITHDRAWAL_KIND_UNKNOWN'));
  });
  await check('mixed historical receipt stays mixed and pre-opening balance stays unknown',async()=>{
   const r=await report('2026-01-01'),mixed=r.events.filter(e=>e.kind==='contribution_mixed');assert.equal(mixed.length,1);assert.equal(mixed[0].amount,150);assert.equal(mixed[0].includes_yield,true);
   assert.equal(r.balances[0].amount,null);assert(r.balances[0].unknown_count>0);assert.equal(r.balances[0].known_amount,0);
   assert(r.issues.some(i=>i.code==='SAVINGS_MIXED_CONTRIBUTION_YIELD'));
  });
  await check('future plan overrides and authorized undated withdrawals remain projections',async()=>{
   const r=await report(),scheduled=r.events.find(e=>e.id==='scheduled:'+uid(21)+':2026-11-15');assert.equal(scheduled.amount,25);assert.equal(scheduled.status,'SCHEDULED');
   const pending=r.events.filter(e=>e.kind==='withdrawal_pending');assert.equal(pending.length,3);assert.equal(pending.find(e=>e.source_id===uid(52)).date,null);assert.equal(pending.find(e=>e.source_id===uid(53)).date,'2026-09-15');assert.equal(pending.reduce((s,e)=>s+e.amount,0),180);
   assert.deepEqual(r.issues.find(i=>i.code==='SAVINGS_PENDING_WITHDRAWAL_UNDATED').sourceIds,[uid(52)]);
  });
  await check('plan drift and incomplete historical imports never silently return zero or stale fallback',async()=>{
   await db.exec('reset role;begin');await q("update savings_contribution_plans set amount=200 where id=$1",[uid(31)]);await actor();
   let r=await report();assert.equal(r.events.find(e=>e.id==='scheduled:'+uid(21)+':2026-11-15').amount,null);assert(r.issues.some(i=>i.code==='SAVINGS_SCHEDULE_UNRESOLVED'));
   await db.exec('rollback;reset role;begin');await q('update savings_review_batches set expected_records=999');await actor();r=await report('2026-01-01');
   assert(!r.events.some(e=>e.source_id===uid(13)));assert(r.issues.some(i=>i.code==='SAVINGS_HISTORICAL_IMPORT_UNAVAILABLE'));
   await db.exec('rollback;reset role');await actor();
  });
  await check('current balance accepts 35 future empty accounts without invalidating canonical amounts',async()=>{
   await db.exec('reset role;begin');
   for(let n=200;n<235;n++){
    await q("insert into savings_participants values($1,$2,'CANONICAL')",[uid(n),'SYNTHETIC_'+n]);
    await q("insert into savings_enrollments values($1,$2,'CANONICAL','ACTIVE','2026-11-15 07:00Z','2026-11-15',null)",[uid(n+100),uid(n)]);
   }
   await actor();const r=await report(),current=r.balances[0];assert.equal(current.amount,1156);assert.equal(current.known_amount,1156);assert.equal(current.unknown_count,0);
   assert(r.balances.slice(1).every(b=>b.amount===null));const historical=await report('2026-01-01');assert.equal(historical.balances[8].amount,null);assert(historical.balances[8].unknown_count>=35);
   await db.exec('rollback;reset role');await actor();
  });
  await check('source SELECT is equivalent to the RPC for both report horizons',async()=>{
   const {savingsSourceSelect}=await import('./verify-cash-flow-sources.mjs');
   const canonical=value=>({...value,issues:value.issues.map(issue=>({...issue,months:[...issue.months].sort(),sourceIds:[...issue.sourceIds].sort(),affectedKinds:[...issue.affectedKinds].sort()}))});
   for(const from of ['2026-01','2026-10']){
    await actor();const expected=await report(from+'-01');await db.exec('reset role');
    const actual=(await q(savingsSourceSelect(from)))[0].report;assert.deepEqual(canonical(actual),canonical(expected));
   }
   await actor();
  });
  await check('read-only source invariants and recovery preserve every original function',async()=>{
   assert.deepEqual(await snapshot(),before);const flags=await q("select provolatile,prosecdef,proconfig from pg_proc where oid='public.get_admin_reports_jc_cash_flow(date)'::regprocedure");assert.equal(flags[0].provolatile,'s');assert.equal(flags[0].prosecdef,true);assert.deepEqual(flags[0].proconfig,['search_path=""']);
   await db.exec(read('supabase/recovery/20261030000100_reports_jc_cash_flow.sql'));assert.equal(await val("select to_regprocedure('public.get_admin_reports_jc_cash_flow(date)') v"),null);
   assert.equal(await val("select md5(string_agg(pg_get_functiondef(p.oid),'|' order by p.oid)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','savings_automatic_private','admin_support_private','auth')"),original);assert.deepEqual(await snapshot(),before);
  });
  console.log(JSON.stringify({status:'PASS',checks:checks.length,financialWrites:false,productionCalls:0}));
 }finally{await db.close();}
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
