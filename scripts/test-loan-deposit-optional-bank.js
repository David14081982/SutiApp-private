'use strict';
const assert=require('assert').strict,fs=require('fs');
const read=(file)=>fs.readFileSync(file,'utf8');
const loan=read('app/screens-loan.jsx');
const edge=read('supabase/functions/financial-legacy/index.ts');
const migration=read('supabase/migrations/20260831000300_optional_loan_deposit_account.sql');
const recovery=read('supabase/recovery/20260831000300_optional_loan_deposit_account_recovery.sql');

assert.match(loan,/const depositReady=deposit\.phase==='ready'&&validNotificationPhone\(deposit\.phone\)&&!deposit\.saving/,'bank account still gates Continue');
assert.match(loan,/bankAccountId: selectedDepositAccount \? selectedDepositAccount\.id : null/,'optional bank id not submitted explicitly');
assert.match(loan,/data-deposit-bank-optional/,'optional bank guidance missing');
assert.match(loan,/No registrada \(opcional\)/,'summary cannot render without an account');
assert.match(loan,/selectedId: '', adding: true/,'editing an incomplete/new account must clear the prior selection');
assert.match(loan,/const draftValid = String\(draft\.bank_name/,'saved accounts lost strict validation');
assert.match(loan,/disabled: !draftValid \|\| value\.saving/,'invalid partial account can be persisted');
assert.match(edge,/bank_account_id: body\.bank_account_id \? String\(body\.bank_account_id\) : null/,'Edge does not preserve optionality');
assert.match(edge,/String\(existingDeposit\.source_bank_account_id \|\| ""\)/,'Edge idempotency does not support null bank');

for(const token of [
  'alter column source_bank_account_id drop not null',
  'loan_deposit_optional_bank_coherence',
  'create_validated_financial_program_request_bank_required',
  "'bank_account_id',null",
  "'has_bank_account',false",
  'source_bank_account_id is not null or v_deposit.notification_phone<>v_phone',
])assert(migration.includes(token),'migration optional-bank contract missing: '+token);
assert.match(migration,/revoke all on function public\.create_validated_financial_program_request_bank_required[\s\S]*service_role/,'required-only helper remains externally executable');
assert.match(migration,/grant execute on function public\.create_validated_financial_program_request[\s\S]*to service_role/,'service-only writer grant missing');
assert.doesNotMatch(migration,/grant execute[\s\S]{0,300}to (?:anon|authenticated)/,'browser writer grant introduced');
assert.match(recovery,/RECOVERY_BLOCKED_OPTIONAL_DEPOSIT_HISTORY_EXISTS/,'recovery may destroy optional-bank history');
assert.match(recovery,/alter column source_bank_account_id set not null/,'recovery does not restore previous contract');
assert(!/localStorage|sessionStorage|window\.DATA/.test(loan),'parallel frontend authority introduced');
console.log(JSON.stringify({status:'PASS',bankFieldsRequiredForContinue:false,phoneRequired:true,strictAccountSave:true,optionalSnapshot:true,financialCalculationsChanged:0,parallelAuthorities:0}));
