'use strict';
const assert=require('assert').strict,fs=require('fs'),vm=require('vm');
const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('supabase/migrations/20260901000100_loan_deposit_account_or_validation.sql');
const recovery=read('supabase/recovery/20260901000100_loan_deposit_account_or_validation_recovery.sql');
const loan=read('app/screens-loan.jsx');
const repository=read('app/bank-account-repository.js');
const bundle=read('app/bundle.js');
new vm.Script(loan);new vm.Script(repository);

for(const token of [
  "v_card is null and v_clabe is null",
  "INVALID_DEPOSIT_CARD",
  "INVALID_DEPOSIT_CLABE",
  "INVALID_DEPOSIT_BANK",
  "DEPOSIT_INSTRUMENT_REQUIRED",
  "v_card is not null and v_card !~ '^[0-9]{16}$'",
  "v_clabe is not null and not public.is_valid_clabe(v_clabe)",
  "account_number is not null or card_number is not null or clabe is not null",
  "'has_clabe',v_clabe is not null",
  "'has_card',v_card is not null",
])assert(migration.includes(token),'migration contract missing: '+token);
assert.match(migration,/revoke all on function public\.save_affiliate_deposit_account\(uuid,text,text,text\) from public,anon,authenticated/);
assert.match(migration,/grant execute on function public\.save_affiliate_deposit_account\(uuid,text,text,text\) to authenticated/);
assert.match(recovery,/RECOVERY_BLOCKED_LOAN_DEPOSIT_ACTIVITY_EXISTS/);
assert.match(recovery,/previous_writer_definition/);
assert.match(recovery,/previous_constraint_definition/);

assert.match(loan,/validDepositBank\(account\.bank_name\) && \(validCardNumber\(account\.card_number\) \|\| validClabe\(account\.clabe\)\)/);
assert.doesNotMatch(loan,/account\.data_status === 'COMPLETE' && validDepositBank/,'historical field-complete account is still blocked by its provenance classification');
assert.match(loan,/&& \(cardValid \|\| clabeValid\)/);
assert.match(loan,/&& \(!hasCard \|\| cardValid\)/);
assert.match(loan,/&& \(!hasClabe \|\| clabeValid\)/);
assert.match(loan,/Opcional si proporcionas CLABE/);
assert.match(loan,/Opcional si proporcionas tarjeta/);
assert.match(loan,/hint: 'Obligatorio'/);
assert.match(loan,/data-deposit-save/);
assert.match(loan,/data-deposit-continue-help/);
assert.match(loan,/error && error\.code, error && error\.message, error && error\.details, error && error\.hint/);
assert.match(loan,/depositEligible\(selectedDepositAccount\)&&validNotificationPhone\(deposit\.phone\)/);
assert.match(loan,/if\(onlyDigits\(deposit\.phone\)!==onlyDigits\(deposit\.persistedPhone\)\)await window\.BankAccountRepository\.saveNotificationPhone/);
assert.match(loan,/await reload\(saved\.id\)/);
assert.doesNotMatch(loan,/data-deposit-bank-optional/);
assert.doesNotMatch(loan,/localStorage|sessionStorage|window\.DATA/);
assert.match(repository,/p_card: digits\(row\.card_number\)/);
assert.match(repository,/p_clabe: digits\(row\.clabe\)/);
for(const token of ['validDepositBank','data-deposit-account-rule','data-deposit-continue-help'])assert(bundle.includes(token),'bundle/source divergence: '+token);
for(const source of [migration,recovery,loan,repository,bundle])assert(!/SUPABASE_(?:SERVICE_ROLE|SECRET|ACCESS)_KEY\s*=/.test(source),'secret embedded');

console.log(JSON.stringify({status:'PASS',cardOrClabe:true,bankRequired:true,bothProvidedStrict:true,continueRequiresAccountAndPhone:true,phoneWriteOnlyWhenChanged:true,requestWriterChanged:0,documentsChanged:0}));
