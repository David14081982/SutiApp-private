'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const migration=read('supabase/migrations/20260822000420_affiliate_financial_profile_authority.sql');
const recovery=read('supabase/recovery/20260822000420_affiliate_financial_profile_authority_recovery.sql');
const admin=read('app/admin-repository.js'),screen=read('app/screens-admin-identity.jsx');
const edge=read('supabase/functions/financial-legacy/index.ts'),requests=read('app/program-request-repository.js');
const seed=read('scripts/seed-affiliate-financial-profiles.py');
for(const source of [admin,screen,requests])new vm.Script(source);
[
  "'affiliates.write'","create table public.affiliate_profile_audit_log","changed_by uuid not null",
  'create function public.update_affiliate_admin_profile','PROFILE_VERSION_CONFLICT','financial_union_code',
  'financial_employee_category_code','create function public.protect_financial_request_snapshots',
  'FINANCIAL_SNAPSHOT_IMMUTABLE','FINANCIAL_APPROVAL_SNAPSHOT_REQUIRED','create function public.approve_financial_program_request',
  "coalesce(auth.role(),'')<>'service_role'",'FINANCIAL_APPROVAL_SNAPSHOT_INCOMPLETE',
].forEach(token=>assert(migration.includes(token),`migration missing ${token}`));
assert(!migration.includes('alter table public.affiliates add column fund'), 'derived fund must not be affiliate identity');
assert(!migration.includes('alter table public.affiliates add column rate'), 'derived rate must not be affiliate identity');
assert(recovery.includes('revoke execute')&&!recovery.includes('drop table')&&!recovery.includes('drop column'),'recovery must revoke writers without deleting data');
assert(admin.includes("requirePermission('affiliates.write')")&&admin.includes('update_affiliate_admin_profile'));
assert(screen.includes("data-affiliate-editable-file':'supabase")&&screen.includes("app.admin.has('affiliates.write')"));
assert(edge.includes('get_current_affiliate_financial_context')&&edge.includes('AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE'));
assert(edge.includes('administrativeFeeRule')&&edge.includes('administrativeFeeVersion')&&edge.includes('approve_financial_program_request'));
assert(!requests.includes('createFinancial')&&!requests.includes('set_financial_program_request_terms'));
assert(edge.includes('create_validated_financial_program_request')&&edge.includes('loanSessionConfirm'));
assert(seed.includes('F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591'));
assert(seed.includes('CATEGORY_COLUMN=58')&&seed.includes('UNION_COLUMN=60')&&seed.includes('--apply'));
assert(edge.includes('readCriteriaRules(privileged)')&&edge.includes('get_financial_runtime_rules')&&edge.includes('SUPABASE_FINANCIAL_CRITERIA'));
assert(!/FINANCIAL_CRITERIA_SPREADSHEET_ID|FINANCIAL_CRITERIA_RANGE|docs\.google\.com|sheets\.googleapis\.com/.test(edge));
assert(edge.includes('legacy_reference !== `Historial de solicitudes!A${result.google_row}`'));
assert(edge.includes('rulesForProfile')&&edge.includes('normalize(rule.category) === category')&&edge.includes('normalize(rule.union) === union'));
console.log('AFFILIATE FINANCIAL PROFILE STATIC CONTRACT: PASS');
