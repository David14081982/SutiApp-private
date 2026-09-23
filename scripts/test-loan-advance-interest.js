'use strict';
// Actual SQL and Edge helpers; synthetic identities stay in isolated PostgreSQL.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto');
const {stripTypeScriptTypes}=require('module');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pglitePath=process.env.SUTIAPP_PGLITE_PATH||path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite');
const {PGlite}=require(pglitePath),{pgcrypto}=require(path.join(pglitePath,'dist/contrib/pgcrypto.cjs'));
const baseline=JSON.parse(read('scripts/test-loan-advance-fee-baseline.json'));
const migration=read('supabase/migrations/20260923000200_loan_advance_interest.sql');
const recovery=read('supabase/recovery/20260923000200_loan_advance_interest.sql');
const policy={source:'SUPABASE_LOAN_TERM_POLICY',standardTerms:[1,6,12,24],customMinTerm:1,customStep:1};
const base={id:'advance',program_id:'prestamo',status:'AVAILABLE',fund:'Isolated advance',union:'SUTISSSTESON',category:'Base',max_amount:25000,rate_factor:.06,rate:6,payment_count:1,payment_period:'quincenal',term_label:'1 Qnas'};
const actor='10000000-0000-0000-0000-000000000001',affiliate='20000000-0000-0000-0000-000000000001',session='30000000-0000-0000-0000-000000000001';
// Independent day-by-day oracle, not the SQL calendar's month-based algorithm.
function datesAfter(start,monthly=false){const out=[];for(let t=Date.parse(start+'T12:00:00Z')+86400000;out.length<12;t+=86400000){const d=new Date(t),day=d.getUTCDate();if(monthly?day===5:day===15||day===(d.getUTCMonth()===1?28:30))out.push(d.toISOString().slice(0,10));}return out;}
async function main(){
 const db=new PGlite({extensions:{pgcrypto}});let cases=0;
 const scalar=async(q,args=[])=>(await db.query(q,args)).rows[0].v;
 const check=(a,b,label)=>{assert.deepEqual(a,b,label);cases++;};
 const reject=async(work,pattern)=>{await assert.rejects(work,pattern);cases++;};
 const quote=(r,amount=10000,term=1)=>scalar('select public.resolve_suti_loan_quote_contract($1,$2,$3,$4,$5,$6,$7) v',[[r],r.union,r.category,r.id,amount,term,policy]);
 const definitions=()=>db.query("select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl,proowner from pg_proc where proname in ('resolve_suti_loan_quote_contract','resolve_current_loan_snapshot_quote','resolve_suti_loan_quote_contract_v1_engine','payroll_periods','enforce_request_date') order by 1");
 try{
  await db.exec(read('scripts/test-savings-loan-eligibility.sql').split('-- TESTS:')[0]);
  await db.exec('drop function extensions.gen_random_uuid(); create extension pgcrypto with schema extensions;');
  await db.exec(`alter table financial_session_snapshots add created_at timestamptz default now();
   alter table program_requests add created_at timestamptz default now();
   alter table affiliates add financial_union_code text,add financial_employee_category_code text,add financial_profile_version integer,
    add financial_affiliation_status text,add financial_employee_type text,add financial_employment_status text;
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
  await db.exec(read('supabase/migrations/20260922000300_loan_advance_admin_fee.sql'));
  const before=(await definitions()).rows;
  const today=await scalar("select (now() at time zone 'America/Hermosillo')::date::text v");
  const dates=datesAfter(today),due=dates[5],rule={...base,available_on:due};
  const old=await quote(rule);
  check([old.interest,old.administrativeFeeTotal,old.total],[600,90,10690],'reproduce current one-period interest');
  await db.query('insert into program_requests(id,financial_submission_snapshot) values(gen_random_uuid(),$1)',[{financialResult:old}]);
  const historyBefore=await scalar('select jsonb_agg(to_jsonb(t) order by id) v from program_requests t');
  const otherRules=[{...base,available_on:'2025-04-08'},{...base,available_on:null},{...base,payment_count:24,available_on:due},{...base,program_id:'caja',payment_count:24},{...base,program_id:'nomina',payment_count:12}];
  const otherBefore=await Promise.all(otherRules.map(r=>quote(r,4321.09,r.payment_count)));
  await db.exec(migration);
  const corrected=await quote(rule);
  check([corrected.interest,corrected.administrativeFeeTotal,corrected.total,corrected.paymentCount,corrected.paymentPerPeriod],[3600,90,13690,1,13690],'owner exact acceptance example');
  check(corrected.administrativeFeeCalendar.dates,dates.slice(0,6),'same calendar for both charges');
  check(corrected.interestPeriodCount,corrected.administrativeFeePeriodCount,'same number of periods');
  check(corrected.termOptions.map(q=>[q.interest,q.administrativeFeeTotal,q.total,q.paymentPerPeriod,q.paymentCount]),[[3600,90,13690,13690,1]],'term option agrees with quote');
  check(corrected.interestCalculationVersion,'ADVANCE_PAYROLL_INTEREST_V1','versioned result');
  check((await quote(rule,1234.56)).interest,444.44,'round once after full multiplication, not 444.42');
  check((await quote({...rule,rate:0,rate_factor:0})).total,10090,'explicit zero interest');
  for(const count of [0,1,2,6,12]){
   const q=await quote({...rule,available_on:count?dates[count-1]:today});
   check([q.interest,q.administrativeFeeTotal,q.paymentCount],[600*count,15*count,1],'zero/one/multiple periods');
  }
  for(const category of ['Base','Eventuales','Suplentes Fijos','Suplentes Variables','Confianza','Jubilados y Pens.']){
   const monthly=category==='Jubilados y Pens.',scheduled=datesAfter(today,monthly),n=monthly?3:6;
   const q=await quote({...rule,category,available_on:scheduled[n-1]});
   check([q.interest,q.administrativeFeeTotal,q.total,q.paymentCount],[600*n,15*n,10000+615*n,1],category);
   check(q.interestPeriod,monthly?'mensual':'quincenal','period follows existing fee calendar');
   check(q.ratePeriod,q.interestPeriod,'rate label agrees with calculation');
  }
  // All named event kinds/dates route through the same dated-fund criterion.
  for(const year of [2026,2027,2028])for(const [md,fund] of [['01-15','Incentivos trimestrales'],['03-15','Bono anual'],['03-30','Incentivos anuales'],['04-08','Anios de servicio'],['04-15','Anios de servicio'],['04-15','Incentivos trimestrales'],['04-30','Incentivos trimestrales'],['07-15','Incentivos trimestrales'],['10-15','Incentivos trimestrales'],['11-30','Aguinaldos'],['12-15','2da. Parte de aguinaldos']]){
   const available_on=year+'-'+md,r={...rule,available_on,fund};
   if(available_on<today){await reject(quote(r),/NOT_ELIGIBLE/);continue;}
   const q=await quote(r);check(q.interest,q.administrativeFeePeriodCount*600,'event '+available_on+' '+fund);check(q.paymentCount,1,'one payment for event');
  }
  for(const [start,end,category,n] of [['2028-02-01','2028-02-29','Base',2],['2028-02-28','2028-03-15','Base',1],['2026-12-15','2027-01-15','Base',2],['2026-09-05','2026-12-05','Jubilados y Pens.',3]]){
   const c=await scalar('select loan_advance_private.payroll_periods($1,$2,$3) v',[start,end,category]);check(c.periodCount,n,'calendar boundary retained');
  }
  for(let i=0;i<otherRules.length;i++){
   const q=await quote(otherRules[i],4321.09,otherRules[i].payment_count);delete q.resolved_at;delete otherBefore[i].resolved_at;
   check(q,otherBefore[i],'non-advance and 2025 entire result unchanged');
  }
  await reject(quote(rule,25001),/OUT_OF_RANGE/);await reject(quote(rule,10000,2),/OUT_OF_RANGE/);
  const after=(await definitions()).rows;
  check(after.map(({signature,acl,proowner})=>({signature,acl,proowner})),before.map(({signature,acl,proowner})=>({signature,acl,proowner})),'all owners/grants unchanged');
  for(const name of ['payroll_periods','enforce_request_date','resolve_suti_loan_quote_contract_v1_engine'])check(after.find(x=>x.signature.startsWith(name+'(')),before.find(x=>x.signature.startsWith(name+'(')),name+' unchanged');
  for(const role of ['anon','authenticated','service_role'])check(await scalar("select has_table_privilege($1,'loan_advance_private.interest_function_backup','select') v",[role]),false,'private backup denied '+role);
  check(await scalar("select relrowsecurity and relforcerowsecurity v from pg_class where oid='loan_advance_private.interest_function_backup'::regclass"),true,'backup forced RLS');
  check(await scalar('select jsonb_agg(to_jsonb(t) order by id) v from program_requests t'),historyBefore,'no historical row rewritten');
  await db.query("insert into affiliates(id,auth_user_id,financial_union_code,financial_employee_category_code,financial_profile_version) values($1,$2,'U','C',1)",[affiliate,actor]);
  await db.exec("insert into segmentation_catalog_entries values('union','U','SUTISSSTESON',true),('employment_category','C','Base',true)");
  await db.query("select set_config('test.actor',$1,false),set_config('test.affiliate',$2,false)",[actor,affiliate]);
  await db.query("insert into financial_session_snapshots(id,affiliate_id,actor_real_auth_user_id,financial_profile_version,expires_at,calculation_contract_version,session_purpose) values($1,$2,$3,1,now()+interval '10 minutes','SUTI_LOAN_QUOTE_V2','LOAN')",[session,affiliate,actor]);
  const interactive=()=>scalar('select resolve_current_loan_snapshot_quote($1,$2,10000,1) v',[session,rule.id]);
  await reject(interactive(),/SNAPSHOT_INVALID/);
  // Execute the complete authenticated RPC with real SHA256 fingerprint checks.
  // Savings access is an isolated dependency contract: this fund is not Savings.
  await db.exec(`create function public.assert_savings_loan_quote_access(uuid,text,jsonb) returns void language plpgsql as $$begin
   if $2<>'advance' then raise exception 'UNEXPECTED_SAVINGS_TEST_DEPENDENCY';end if;end$$;
   insert into loan_term_policy values('primary',array[1,6,12,24],1,1,true,'isolated');`);
  const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').toUpperCase();
  const profileHash=hash({actor_real_auth_user_id:actor,affiliate_id:affiliate,financial_affiliation_status:null,financial_employee_category:'Base',financial_employee_category_code:'C',financial_employee_type:null,financial_employment_status:null,financial_profile_version:1,financial_union:'SUTISSSTESON',financial_union_code:'U',impersonation_session_id:null});
  const policyHash=hash({customMinTerm:1,customStep:1,decisionReference:'isolated',source:policy.source,standardTerms:policy.standardTerms});
  await db.query("update financial_session_snapshots set calculation_contract_version='SUTI_LOAN_QUOTE_V3',profile_fingerprint=$1,term_policy_fingerprint=$2,eligible_rules=$3",[profileHash,policyHash,[rule]]);
  const rpc=await interactive();check([rpc.interest,rpc.administrativeFeeTotal,rpc.total,rpc.paymentCount],[3600,90,13690,1],'authenticated RPC exact owner example');
  await db.exec("update financial_session_snapshots set profile_fingerprint='INVALID'");await reject(interactive(),/SNAPSHOT_INVALID/);
  await db.query('update financial_session_snapshots set profile_fingerprint=$1',[profileHash]);
  await db.exec("update financial_session_snapshots set calculation_contract_version='SUTI_LOAN_QUOTE_V3',created_at=now()-interval '1 day'");await reject(interactive(),/SNAPSHOT_INVALID/);
  await db.exec("update financial_session_snapshots set created_at=now(),actor_real_auth_user_id=gen_random_uuid()");await reject(interactive(),/SNAPSHOT_INVALID/);
  await db.exec("select set_config('test.actor','',false)");await reject(interactive(),/AUTH_REQUIRED/);
  // A failed recovery is atomic even if one function was already restored.
  await db.exec('revoke execute on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) from authenticated');
  await reject(db.exec(recovery),/RECOVERY_BLOCKED_ADVANCE_INTEREST_PRIVILEGES/);await db.exec('rollback');
  await db.exec('grant execute on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) to authenticated');
  await db.exec(recovery);
  check((await definitions()).rows,before,'exact recovery including calendar, engine, ACL and owner');
  check(await scalar('select jsonb_agg(to_jsonb(t) order by id) v from program_requests t'),historyBefore,'recovery preserves old fee-version history');
  await db.exec(migration);
  const q=await quote(rule);
  await reject(db.query('insert into program_requests(id,financial_submission_snapshot) values(gen_random_uuid(),$1)',[{financialResult:{...q,administrativeFeeCalendar:{...q.administrativeFeeCalendar,anchorDate:'2026-01-01'}}}]),/CONDITIONS_CHANGED/);
  await db.query('insert into program_requests(id,financial_submission_snapshot) values(gen_random_uuid(),$1)',[{financialResult:q}]);
  await reject(db.exec(recovery),/RECOVERY_BLOCKED_ADVANCE_INTEREST_HISTORY/);await db.exec('rollback');
  const edge=read('supabase/functions/financial-legacy/index.ts'),extract=(a,b)=>edge.slice(edge.indexOf(a),edge.indexOf(b,edge.indexOf(a)));
  const sandbox={BUSINESS_TIME_ZONE:'America/Hermosillo',Date,Intl,rulesForProfile:r=>r};vm.createContext(sandbox);
  vm.runInContext(stripTypeScriptTypes(extract('function assertAdvanceSubmissionDate(', 'async function approveRequest(')+extract('function businessDateISO(', 'function cajaRuleForProfile(')+extract('async function resolveQuote(', 'async function readTermPolicy('))+';this.capture=capturedAdvanceApprovalResult;this.resolve=resolveQuote;',sandbox);
  for(const result of [old,q]){
   const request={created_at:today+'T12:00:00-07:00',requested_amount:10000,requested_term:1,financial_submission_snapshot:{financialResult:result}};
   check(sandbox.capture(rule,request),result,'approval preserves old/new contract');
   check(sandbox.capture({...rule,rate_factor:.09,rate:9,payment_count:12},request),result,'later rule/rate changes do not reprice');
   const historical={...result,administrativeFeeCalendar:{...result.administrativeFeeCalendar,anchorDate:'2026-01-01'}};
   check(sandbox.capture(rule,{...request,created_at:'2026-01-01T12:00:00-07:00',financial_submission_snapshot:{financialResult:historical}}),historical,'approval months later preserves both charges');
  }
  const profile={financial_union:rule.union,financial_employee_category:rule.category},body={program_id:rule.id,amount:10000,term:1};
  await reject(sandbox.resolve({rpc:async()=>({data:old,error:null})},[rule],profile,body,policy),/FINANCIAL_RESOLUTION_FAILED/);
  check(await sandbox.resolve({rpc:async()=>({data:q,error:null})},[rule],profile,body,policy),q,'matching SQL/Edge contract accepted');
  assert.match(edge,/ADVANCE_LOAN_CALCULATION_CONTRACT_VERSION = "SUTI_LOAN_QUOTE_V3"/);cases++;
  assert.match(edge,/LOAN_CALCULATION_CONTRACT_VERSION = "SUTI_LOAN_QUOTE_V1"/);cases++;
  console.log(JSON.stringify({status:'PASS',cases,example:{capital:10000,interest:3600,fee:90,total:13690,paymentCount:1},historyPreserved:true,exactRecovery:true,productionWrites:0}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message,e.where||'',e.position||'');process.exitCode=1;});
