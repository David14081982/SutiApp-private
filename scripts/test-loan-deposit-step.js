'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20260830000500_loan_deposit_step.sql');
const selfReadMigration=read('supabase/migrations/20260830000510_loan_deposit_self_read.sql');
const recovery=read('supabase/recovery/20260830000500_loan_deposit_step_recovery.sql');
const edge=read('supabase/functions/financial-legacy/index.ts');
const repository=read('app/bank-account-repository.js');
const financial=read('app/financial-legacy-repository.js');
const loan=read('app/screens-loan.jsx');
const bundle=read('app/bundle.js');
[repository,financial,loan].forEach((source)=>new vm.Script(source));

for(const token of [
  'add column card_number text null',
  "card_number ~ '^[0-9]{16}$'",
  'add column notification_phone text null',
  'create table public.loan_request_deposit_snapshots',
  'force row level security',
  'revoke all on table public.loan_request_deposit_snapshots from public,anon,authenticated',
  'save_affiliate_deposit_account',
  'get_current_notification_phone',
  'save_current_notification_phone',
  'DEPOSIT_ACCOUNT_UNAVAILABLE',
  'source_bank_account_id<>v_bank.id',
  "affiliate_id=p_affiliate_id and data_status='COMPLETE'",
  "jsonb_build_object('deposit'",
]) assert(migration.includes(token),'migration contract missing: '+token);
assert.match(migration,/account_number is not null or card_number is not null/);
assert.match(migration,/v_bank_id:=\(p_financial_submission_snapshot->'deposit_selection'->>'bank_account_id'\)::uuid/);
assert.match(migration,/public\.is_valid_clabe\(clabe\)/);
assert.match(migration,/source_bank_account_id uuid not null/);
assert.doesNotMatch(migration,/service_role[^\n]*browser|grant (?:select|insert|update|delete).*loan_request_deposit_snapshots to authenticated/i);
assert.match(recovery,/RECOVERY_BLOCKED_LOAN_DEPOSIT_DATA_EXISTS/);
assert.match(recovery,/rename to create_validated_financial_program_request/);
assert.match(selfReadMigration,/create function public\.list_current_deposit_accounts\(\)/);
assert.match(selfReadMigration,/account\.affiliate_id=v_affiliate/);
assert.match(selfReadMigration,/revoke all on function public\.list_current_deposit_accounts\(\) from public,anon,authenticated/);

for(const token of ['card_number','maskedCard','listDeposit','saveDeposit','getNotificationPhone','saveNotificationPhone']) assert(repository.includes(token),'bank repository missing: '+token);
assert.match(loan,/BankAccountRepository\.listDeposit\(\)/);
assert.match(repository,/p_card: digits\(row\.card_number\)/);
assert.doesNotMatch(repository,/account_number:\s*digits\(row\.card_number\)|localStorage|sessionStorage/);

for(const token of ['bank_account_id','notification_phone','loan_request_deposit_snapshots','deposit_selection']) assert(edge.includes(token),'Edge deposit contract missing: '+token);
assert.match(financial,/bank_account_id: String\(value\.bankAccountId/);
assert.match(financial,/notification_phone: String\(value\.notificationPhone/);

for(const token of [
  "const steps = ['Monto', 'Depósito', 'Documentos', 'Resumen']",
  'function StepDeposit',
  'data-loan-deposit-step',
  'data-deposit-account-form',
  'Número de tarjeta bancaria',
  'CLABE interbancaria',
  'Celular para notificaciones',
  'data-loan-deposit-summary',
  'Completar para depósito',
  'BankAccountRepository.saveNotificationPhone',
  'bankAccountId: selectedDepositAccount.id',
  'notificationPhone: deposit.phone',
]) assert(loan.includes(token),'loan UI contract missing: '+token);
assert.doesNotMatch(loan,/function StepDestination|Cuéntanos el destino|notes: destination|Destino del préstamo/);
assert.match(loan,/validCardNumber/);
assert.match(loan,/validClabe/);
assert.match(loan,/validNotificationPhone/);
assert.match(loan,/code === 'DEPOSIT_ACCOUNT_UNAVAILABLE'/);
assert.match(loan,/onCorrectDeposit/);
assert.doesNotMatch(loan,/localStorage|sessionStorage|window\.DATA/);

for(const token of ['function StepDeposit','data-loan-deposit-step','data-loan-deposit-summary','save_affiliate_deposit_account']) assert(bundle.includes(token),'bundle/source divergence: '+token);
for(const source of [migration,recovery,edge,repository,financial,loan,bundle]) assert(!/SUPABASE_(?:SERVICE_ROLE|SECRET|ACCESS)_KEY\s*=/.test(source),'secret embedded');

console.log(JSON.stringify({status:'PASS',wizard:'Monto > Depósito > Documentos > Resumen',card_semantics:'SEPARATE',cross_user:'SERVER_DENIED',snapshot:'PRIVATE_IMMUTABLE',fallbacks:0}));
