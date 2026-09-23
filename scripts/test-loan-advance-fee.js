'use strict';
// Execute actual deployed SQL plus the candidate in isolated PostgreSQL/WASM.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {stripTypeScriptTypes}=require('module');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {PGlite}=require(process.env.SUTIAPP_PGLITE_PATH||path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const baseline=JSON.parse(read('scripts/test-loan-advance-fee-baseline.json'));
const migration=read('supabase/migrations/20260922000300_loan_advance_admin_fee.sql');
const recovery=read('supabase/recovery/20260922000300_loan_advance_admin_fee.sql');
const policy={source:'SUPABASE_LOAN_TERM_POLICY',standardTerms:[1,6,12,24],customMinTerm:1,customStep:1};
const base={id:'advance',program_id:'prestamo',status:'AVAILABLE',fund:'Evento sintético',union:'SUTISSSTESON',category:'Base',max_amount:25000,rate_factor:.06,rate:6,payment_count:1,payment_period:'quincenal',term_label:'1 Qnas'};
const actor='10000000-0000-0000-0000-000000000001',affiliate='20000000-0000-0000-0000-000000000001',session='30000000-0000-0000-0000-000000000001';
function oracle(start,end,monthly=false){const dates=[];for(let t=Date.parse(start+'T12:00:00Z')+86400000;t<=Date.parse(end+'T12:00:00Z');t+=86400000){const d=new Date(t),day=d.getUTCDate();if(monthly?day===5:day===15||day===(d.getUTCMonth()===1?28:30))dates.push(d.toISOString().slice(0,10));}return dates;}
async function main(){
 const db=new PGlite();let cases=0;
 const scalar=async(q,args=[])=>(await db.query(q,args)).rows[0].v;
 const calendar=(a,b,c='Base')=>scalar('select loan_advance_private.payroll_periods($1,$2,$3) v',[a,b,c]);
 const quote=(rule,amount=5000,term=1,name='resolve_suti_loan_quote_contract')=>scalar(`select public.${name}($1,$2,$3,$4,$5,$6,$7) v`,[[rule],rule.union,rule.category,rule.id,amount,term,policy]);
 const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);cases++;};
 try{
  await db.exec(read('scripts/test-savings-loan-eligibility.sql').split('-- TESTS:')[0]);
  await db.exec(`alter table financial_session_snapshots add created_at timestamptz default now();
   alter table program_requests add created_at timestamptz default now();
   alter table affiliates add financial_union_code text,add financial_employee_category_code text,add financial_profile_version integer;
   create table impersonation_sessions(id uuid,actor_real_auth_user_id uuid,ended_at timestamptz,expires_at timestamptz);
   create table segmentation_catalog_entries(catalog_type text,code text,label text,enabled boolean);
   create function public.get_effective_affiliate_id() returns uuid language sql as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
   create function public.admin_actor_can_impersonate() returns boolean language sql as $$select false$$;
   grant usage on schema public,auth to authenticated,anon,service_role;`);
  for(const name of ['normalize_suti_financial_key','resolve_suti_loan_quote_contract_v1_engine','resolve_suti_loan_quote_contract','resolve_current_loan_snapshot_quote']){
   const d=baseline.definitions.find(x=>x.signature.startsWith(name+'('));await db.exec(d.definition);
   await db.exec(`revoke all on function ${d.signature} from public,anon,authenticated,service_role;`);
   if(name!=='resolve_suti_loan_quote_contract_v1_engine')await db.exec(`grant execute on function ${d.signature} to service_role;`);
   if(name==='resolve_current_loan_snapshot_quote')await db.exec(`grant execute on function ${d.signature} to authenticated;`);
  }
  const oldAcl=await scalar("select jsonb_object_agg(oid::regprocedure::text,proacl::text) v from pg_proc where proname in ('resolve_suti_loan_quote_contract','resolve_current_loan_snapshot_quote')");
  // First prove the production defect with the actual old engine.
  const today=await scalar("select (now() at time zone 'America/Hermosillo')::date::text v");
  const future=await scalar("select ((now() at time zone 'America/Hermosillo')::date+interval '3 months')::date::text v");
  const rule={...base,available_on:future};
  check((await quote(rule)).administrativeFeeTotal,15,'reproduced old undercharge');
  await db.exec(migration);
  const calendars=[
   ['2026-01-01','2026-04-01','Base',6],['2026-01-01','2026-04-01','Jubilados y Pens.',3],
   ['2026-02-01','2026-02-28','Base',2],['2028-02-01','2028-02-29','Base',2],
   ['2028-02-28','2028-03-15','Base',1],['2026-12-15','2027-01-15','Base',2],
   ['2026-09-15','2026-09-15','Base',0],['2026-09-14','2026-09-15','Base',1],
   ['2026-09-15','2026-09-30','Base',1],['2026-09-30','2026-10-15','Base',1],
   ['2026-09-05','2026-12-05','Jubilados y Pens.',3],['2026-09-04','2026-09-05','Jubilados y Pens.',1],
   ['2026-09-05','2026-09-05','Jubilados y Pens.',0],['2026-09-22','2026-11-30','Base',5],
  ];
  for(const [a,b,c,n] of calendars){const r=await calendar(a,b,c);check(r.periodCount,n,a+' -> '+b);check(r.dates,oracle(a,b,c.startsWith('Jubilados')),'exact payroll dates');}
  check((await calendar('2026-01-01','2026-04-01')).periodCount*15,90,'six charges, $90');
  await assert.rejects(calendar('2026-09-22','2026-09-21'),/NOT_ELIGIBLE/);cases++;
  await assert.rejects(calendar('2026-09-22','2026-11-30','UNKNOWN'),/PROFILE_INCOMPLETE/);cases++;
  await assert.rejects(calendar(null,'2026-11-30'),/RULES_INVALID/);cases++;
  for(const category of ['Base','Eventuales','Suplentes Fijos','Suplentes Variables','Confianza','Jubilados y Pens.']){
   const r=await quote({...rule,category},1234.56),expected=oracle(today,future,category==='Jubilados y Pens.').length*15;
   check(r.paymentCount,1,'one final payment');check(r.administrativeFeeTotal,expected,'fee calendar');
   check(r.interest,74.07,'interest unchanged');check(r.total,Math.round((1234.56+74.07+expected)*100)/100,'total');
   check(r.paymentPerPeriod,r.total,'single final amount');check(r.termOptions[0].total,r.total,'one-term option');
  }
  check((await quote({...rule,available_on:today})).administrativeFeeTotal,0,'no future payroll dates on due day');
  await assert.rejects(quote({...rule,available_on:'2026-01-01'}),/NOT_ELIGIBLE/);cases++;
  for(const r of [{...base,available_on:'2025-04-08'},{...base,available_on:null},{...base,payment_count:24,available_on:future},{...base,program_id:'caja',payment_count:24},{...base,program_id:'nomina',payment_count:12}]){
   for(const term of [...new Set([1,r.payment_count])]){
    const actual=await quote(r,5000,term),old=await quote(r,5000,term,'resolve_suti_loan_quote_contract_v1_engine');
    delete actual.resolved_at;delete old.resolved_at;old.source='SUPABASE_FINANCIAL_CRITERIA';
    check(actual,old,'other contracts unchanged');
   }
  }
  check(await scalar("select jsonb_object_agg(oid::regprocedure::text,proacl::text) v from pg_proc where proname in ('resolve_suti_loan_quote_contract','resolve_current_loan_snapshot_quote')"),oldAcl,'ACLs unchanged');
  for(const role of ['anon','authenticated','service_role'])check(await scalar("select has_function_privilege($1,'loan_advance_private.payroll_periods(date,date,text)','execute') v",[role]),false,'internal calendar denied '+role);
  check(await scalar("select bool_and(relrowsecurity and relforcerowsecurity) v from pg_class where oid='loan_advance_private.function_backup'::regclass"),true,'backup RLS forced');
  // Execute the real authenticated entrypoint up to the stale-session boundary.
  await db.query("insert into affiliates(id,auth_user_id,financial_union_code,financial_employee_category_code,financial_profile_version) values($1,$2,'U','C',1)",[affiliate,actor]);
  await db.exec("insert into segmentation_catalog_entries values('union','U','SUTISSSTESON',true),('employment_category','C','Base',true)");
  await db.query("select set_config('test.actor',$1,false),set_config('test.affiliate',$2,false)",[actor,affiliate]);
  await db.query("insert into financial_session_snapshots(id,affiliate_id,actor_real_auth_user_id,financial_profile_version,expires_at,calculation_contract_version,session_purpose) values($1,$2,$3,1,now()+interval '10 minutes','SUTI_LOAN_QUOTE_V1','LOAN')",[session,affiliate,actor]);
  const interactive=()=>scalar('select resolve_current_loan_snapshot_quote($1,$2,5000,1) v',[session,base.id]);
  await assert.rejects(interactive(),/SNAPSHOT_INVALID/);cases++;
  await db.exec("update financial_session_snapshots set calculation_contract_version='SUTI_LOAN_QUOTE_V2',created_at=now()-interval '1 day'");
  await assert.rejects(interactive(),/SNAPSHOT_INVALID/);cases++;
  await db.exec("update financial_session_snapshots set created_at=now(),actor_real_auth_user_id=gen_random_uuid()");
  await assert.rejects(interactive(),/SNAPSHOT_INVALID/);cases++;
  await db.exec("select set_config('test.actor','',false)");await assert.rejects(interactive(),/AUTH_REQUIRED/);cases++;
  await db.exec(recovery);
  for(const d of baseline.definitions)check(await scalar('select pg_get_functiondef($1::regprocedure) v',[d.signature]),d.definition,'exact recovery '+d.signature);
  await db.exec(migration);
  const fixedQuote=await quote(rule);
  await assert.rejects(db.query("insert into program_requests(id,financial_submission_snapshot) values(gen_random_uuid(),$1)",[
   {financialResult:{...fixedQuote,administrativeFeeCalendar:{...fixedQuote.administrativeFeeCalendar,anchorDate:'2026-01-01'}}}
  ]),/CONDITIONS_CHANGED/);cases++;
  await assert.rejects(db.query("insert into program_requests(id,created_at,financial_submission_snapshot) values(gen_random_uuid(),now()-interval '1 day',$1)",[{financialResult:fixedQuote}]),/CONDITIONS_CHANGED/);cases++;
  await db.query("insert into program_requests(id,financial_submission_snapshot) values(gen_random_uuid(),$1)",[{financialResult:fixedQuote}]);
  check(await scalar("select bool_and((financial_submission_snapshot#>>'{financialResult,administrativeFeeCalendar,anchorDate}')::date=(created_at at time zone 'America/Hermosillo')::date) v from program_requests"),true,'atomic request date equals fee anchor');
  await assert.rejects(db.exec(recovery),/RECOVERY_BLOCKED_ADVANCE_FEE_HISTORY/);await db.exec('rollback');cases++;
  // Edge runtime behavior, using its actual functions, not a second implementation.
  const edge=read('supabase/functions/financial-legacy/index.ts');
  const extract=(a,b)=>edge.slice(edge.indexOf(a),edge.indexOf(b,edge.indexOf(a)));
  const sandbox={BUSINESS_TIME_ZONE:'America/Hermosillo',Date,Intl};vm.createContext(sandbox);
  vm.runInContext(stripTypeScriptTypes(extract('function assertAdvanceSubmissionDate(', 'async function approveRequest(')+extract('function businessDateISO(', 'function cajaRuleForProfile('))+';this.capture=capturedAdvanceApprovalResult;this.date=businessDateISO;this.assertDate=assertAdvanceSubmissionDate;',sandbox);
  const captured=await quote(rule);const request={created_at:today+'T12:00:00-07:00',requested_amount:5000,requested_term:1,financial_submission_snapshot:{financialResult:captured}};
  check(sandbox.capture(rule,request),captured,'approval keeps exact captured result');
  assert.doesNotThrow(()=>sandbox.assertDate(captured,request.created_at));cases++;
  assert.throws(()=>sandbox.assertDate(captured,'2026-01-01T12:00:00-07:00'),/CONDITIONS_CHANGED/);cases++;
  const historical={...captured,administrativeFeeTotal:15,total:5315,paymentPerPeriod:5315,administrativeFeeVersion:'LEGACY_EQUIVALENCE_2026-08-23'};
  check(sandbox.capture(rule,{...request,financial_submission_snapshot:{financialResult:historical}}),historical,'old advance not repriced');
  check(sandbox.capture({...rule,payment_count:12},request),captured,'later criteria cannot reprice fixed advance');
  check(sandbox.capture({...rule,program_id:'caja'},{...request,financial_submission_snapshot:{financialResult:historical}}),null,'ordinary approval unchanged');
  const priorDate='2026-01-01',priorQuote={...captured,administrativeFeeCalendar:{...captured.administrativeFeeCalendar,anchorDate:priorDate}};
  check(sandbox.capture(rule,{...request,created_at:priorDate+'T18:00:00-07:00',financial_submission_snapshot:{financialResult:priorQuote}}),priorQuote,'approval months later preserves request-date fee');
  assert.throws(()=>sandbox.capture(rule,{...request,created_at:'2026-01-01T12:00:00-07:00'}),/CONTRACT_MISMATCH/);cases++;
  assert.throws(()=>sandbox.capture(rule,{...request,requested_amount:1}),/CONTRACT_MISMATCH/);cases++;
  check(sandbox.date(new Date('2026-09-23T06:59:59Z')),'2026-09-22','Hermosillo before midnight');
  check(sandbox.date(new Date('2026-09-23T07:00:00Z')),'2026-09-23','Hermosillo midnight');
  assert.match(edge,/businessDateISO\(new Date\(snapshot.created_at\)\) !== businessDateISO\(\)/);
  assert.match(edge,/result = capturedAdvance \|\| await resolveQuote/);
  assert.match(edge,/assertAdvanceSubmissionDate\(result, snapshot.created_at\)/);
  sandbox.rulesForProfile=rules=>rules;
  vm.runInContext(stripTypeScriptTypes(extract('async function resolveQuote(', 'async function readTermPolicy('))+';this.resolve=resolveQuote;',sandbox);
  const profile={financial_union:base.union,financial_employee_category:base.category},body={program_id:base.id,amount:5000,term:1};
  await assert.rejects(sandbox.resolve({rpc:async()=>({data:historical,error:null})},[rule],profile,body,policy),/FINANCIAL_RESOLUTION_FAILED/);cases++;
  await assert.rejects(sandbox.resolve({rpc:async()=>({data:captured,error:null})},[rule],profile,body,policy),/FINANCIAL_RESOLUTION_FAILED/);cases++;
  await db.exec(read('supabase/migrations/20260923000200_loan_advance_interest.sql'));
  const interestQuote=await quote(rule);
  check(await sandbox.resolve({rpc:async()=>({data:interestQuote,error:null})},[rule],profile,body,policy),interestQuote,'current backend accepted');
  check(await sandbox.resolve({rpc:async()=>({data:historical,error:null})},[{...base,program_id:'caja'}],profile,body,policy),historical,'ordinary contract compatible during release');
  console.log(JSON.stringify({status:'PASS',cases,oldFee:15,threeMonthFortnightlyFee:90,threeMonthMonthlyFee:45,oneFinalPayment:true,historyPreserved:true,exactRecovery:true,productionWrites:0}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message,e.where||'',e.position||'');process.exitCode=1;});
