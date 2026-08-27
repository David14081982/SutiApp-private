'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const sql=read('supabase/migrations/20260825000400_personalized_financial_session_snapshots.sql');
const recovery=read('supabase/recovery/20260825000400_personalized_financial_session_snapshots_recovery.sql');
const edge=read('supabase/functions/financial-legacy/index.ts');
const repository=read('app/financial-legacy-repository.js');
const loan=read('app/screens-loan.jsx');
const requests=read('app/program-request-repository.js');
const applyScript=read('scripts/apply-personalized-financial-session-snapshot.py');
const rpcMigration=read('supabase/migrations/20260826000100_authenticated_loan_snapshot_quote_rpc.sql');
[repository,loan,requests].forEach((source)=>new vm.Script(source));

for(const token of [
  'create table public.financial_session_snapshots','affiliate_id uuid not null','actor_real_auth_user_id uuid not null',
  'impersonation_session_id uuid null','financial_profile_version integer not null','profile_fingerprint text not null',
  'eligible_rules jsonb not null','criteria_source_fingerprint text not null','term_policy_fingerprint text not null',
  "expires_at<=created_at+interval '15 minutes'",'force row level security',
  'revoke all on public.financial_session_snapshots from public,anon,authenticated',
  'grant select,insert,update,delete on public.financial_session_snapshots to service_role',
  'create_validated_financial_program_request','SERVICE_ROLE_REQUIRED','CONDITIONS_CHANGED',
  'FINANCIAL_SUBMISSION_SNAPSHOT_IMMUTABLE',
]) assert.ok(sql.includes(token),'migration contract missing: '+token);
assert.doesNotMatch(sql,/create table public\.(financial_rules|loan_rules|rates|fund_catalog)\b/i);
assert.match(recovery,/RECOVERY_BLOCKED_FINANCIAL_SUBMISSION_HISTORY_EXISTS/);
assert.match(recovery,/drop table if exists public\.financial_session_snapshots/);
assert.match(applyScript,/--recovery-dry-run/);
assert.match(applyScript,/rollback; select true as recovery_dry_run/);

for(const action of ['loanSessionOpen','loanSessionValidate','loanSessionQuote','loanSessionConfirm']) assert.ok(edge.includes(action),'Edge action missing: '+action);
assert.match(edge,/const \[rules, policy\] = await Promise\.all\(\[readCriteriaRules\(privileged\), readTermPolicy\(userClient\)\]\)/);
assert.match(edge,/const matched = rulesForProfile\(rules, context\.profile\)/);
assert.match(edge,/await resolveQuote\(privileged, snapshot\.eligible_rules, context\.profile, body, policy\)/);
assert.match(edge,/resolve_suti_loan_quote_contract/);
assert.match(rpcMigration,/resolve_current_loan_snapshot_quote/);
assert.match(edge,/googleResolutionCount: 0/);
assert.match(edge,/currentRules = await readCriteriaRules\(privileged\)/);
assert.match(edge,/create_validated_financial_program_request/);
assert.match(edge,/criteriaFingerprintPayload/);
assert.match(edge,/effective_visibility: rule\.effective_visibility/);
assert.match(edge,/snapshot\.financial_profile_version !== Number\(context\.profile\.financial_profile_version\)/);

assert.match(repository,/openLoanSession/);
assert.match(repository,/loanSessionValidate/);
assert.match(repository,/requestLoanSessionQuote/);
assert.match(repository,/confirmLoanSession/);
assert.match(repository,/p_snapshot_id: state\.loanSession\.id/);
assert.match(repository,/client\.rpc\('resolve_current_loan_snapshot_quote'/);
assert.doesNotMatch(repository,/action: 'loanSessionQuote'/);
assert.match(repository,/signal && signal\.aborted/);
assert.match(repository,/SIMULATION_REQUEST_ABORTED/);
assert.match(repository,/state\.status = state\.overview \? 'ready' : 'idle'/);
assert.doesNotMatch(repository,/administrativeFeeTotal\s*=|paymentPerPeriod\s*=/);
assert.match(loan,/requestLoanSessionQuote/);
assert.match(loan,/financialLegacyStore\.confirmLoanSession/);
assert.match(loan,/finally \{\s*running\.current = false/);
assert.match(loan,/displayedResult = result \|\|/);
assert.match(loan,/const delay = immediate\.current \? 0 : 320/);
assert.match(loan,/latestSelection\.current === request\.key/);
assert.match(loan,/activeRequest\.current\.controller\.abort\(\)/);
assert.match(loan,/quoteTimeoutMs = 6000/);
assert.match(loan,/maxQuoteAttempts = 5/);
assert.match(loan,/isRetryableQuoteTransportError\(snapshot\.error\)/);
assert.match(loan,/failed to send a request to the edge function/);
assert.match(loan,/SIMULATION_TIMEOUT/);
assert.match(loan,/Las condiciones de tu simulación cambiaron/);
assert.doesNotMatch(loan,/ProgramRequestRepository\.createFinancial|finalizeContext/);
assert.doesNotMatch(requests,/createFinancial|set_financial_program_request_terms/);

async function verifyAbortedQuoteRestoresReadyState(){
  let quoteSignal=null;
  const overview={status:'AVAILABLE',programs:[],loanSession:{id:'00000000-0000-4000-8000-000000000001',expires_at:new Date(Date.now()+60000).toISOString(),financial_profile_version:1}};
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'00000000-0000-4000-8000-000000000002'}}}})},functions:{invoke:async(_name,options)=>{
    if(options.body.action==='loanSessionOpen')return{data:{data:overview},error:null};
    throw new Error('UNEXPECTED_ACTION');
  }},rpc:(name)=>{assert.equal(name,'resolve_current_loan_snapshot_quote');let signal;const pending=new Promise((resolve)=>setImmediate(()=>{if(signal)signal.addEventListener('abort',()=>resolve({data:null,error:new Error('aborted')}),{once:true});}));return{abortSignal(value){signal=value;quoteSignal=value;return pending;}};}};
  const context={window:{SutiSupabase:{getClient:()=>client}},React:{useState:()=>[0,()=>{}],useEffect:()=>{}},console};
  vm.createContext(context);new vm.Script(repository).runInContext(context);
  const store=context.window.financialLegacyStore;
  assert.equal((await store.openLoanSession(false)).status,'ready');
  const controller=new AbortController(),pending=store.requestLoanSessionQuote('fund',5000,6,{signal:controller.signal});
  await new Promise((resolve)=>setImmediate(resolve));controller.abort();
  await assert.rejects(pending,(error)=>error&&error.code==='SIMULATION_REQUEST_ABORTED');
  assert.equal(quoteSignal,controller.signal);assert.equal(store.snapshot().status,'ready');assert.equal(store.snapshot().overview,overview);
}

verifyAbortedQuoteRestoresReadyState().then(()=>console.log('PERSONALIZED FINANCIAL SESSION SNAPSHOT STATIC CONTRACT: PASS')).catch((error)=>{console.error(error);process.exitCode=1;});
