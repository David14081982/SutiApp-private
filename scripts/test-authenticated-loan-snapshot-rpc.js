'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20260826000100_authenticated_loan_snapshot_quote_rpc.sql');
const recovery=read('supabase/recovery/20260826000100_authenticated_loan_snapshot_quote_rpc_recovery.sql');
const repository=read('app/financial-legacy-repository.js');
new vm.Script(repository);
for(const token of [
  'resolve_current_loan_snapshot_quote','resolve_suti_loan_quote_contract','auth.uid()',"auth.role(),'') <> 'authenticated'",
  'public.get_effective_affiliate_id()','actor_real_auth_user_id<>v_actor','affiliate_id<>v_affiliate_id',
  'impersonation_session_id is distinct from v_impersonation_id','expires_at<=now()',
  'financial_profile_version<>v_affiliate.financial_profile_version',"calculation_contract_version<>'SUTI_LOAN_QUOTE_V1'",
  'profile_fingerprint<>v_profile_fingerprint','term_policy_fingerprint<>v_policy_fingerprint',
  "p_amount <= 0 or p_amount > v_max_amount","mod(p_term-v_custom_min,v_custom_step) <> 0",
  'round(p_amount*v_rate_factor*p_term,2)','round(v_total/p_term,2)',
  'grant execute on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) to authenticated',
  'revoke all on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) from public,anon',
]) assert.ok(migration.includes(token),'migration contract missing: '+token);
assert.doesNotMatch(migration,/grant\s+(select|insert|update|delete).*financial_session_snapshots.*authenticated/i);
assert.doesNotMatch(migration,/\b(update|insert into|delete from)\s+public\.financial_session_snapshots\b/i);
for(const signature of ['resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)','resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)','normalize_suti_financial_key(text)'])
  assert.ok(recovery.includes('drop function if exists public.'+signature),'recovery missing '+signature);
assert.match(repository,/requestLoanSessionQuote/);
assert.doesNotMatch(repository,/administrativeFeeTotal\s*=|paymentPerPeriod\s*=/);
assert.match(read('docs/INVARIANTS.md'),/INV-088/);
assert.match(read('docs/INVARIANTS.md'),/INV-107/);
console.log(JSON.stringify({status:'PASS',migration_contract:true,recovery_contract:true,frontend_financial_calculations:0}));
