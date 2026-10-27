'use strict';
// H-LOAN-AVAILABLE-CREDIT-001: read-only schema/configuration restoration baseline.
// No customer rows, credentials, source-history rows, or remote mutations.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { query } = require('./inspect-loan-history');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.tmp/loan-available-credit');
const functionNames = [
  'get_financial_runtime_rules', 'financial_runtime_rules_for_batch', 'resolve_current_loan_snapshot_quote',
  'resolve_suti_loan_quote_contract', 'resolve_suti_loan_quote_contract_v1_engine',
  'create_validated_financial_program_request', 'create_validated_financial_program_request_bank_required',
  'enforce_personalized_financial_submission', 'get_self_loan_history_context',
  'get_current_affiliate_financial_context', 'get_effective_affiliate_id',
  'admin_module_boundary', 'has_admin_permission', 'savings_loan_eligibility',
  'assert_savings_loan_quote_access', 'enforce_savings_loan_request_access',
  'enforce_finance_request_block', 'get_admin_savings_loan_access',
  'set_admin_savings_loan_policy', 'set_admin_savings_loan_authorization',
  'prepare_program_request_register', 'record_program_request_admin_action',
];
const tableNames = [
  'financial_session_snapshots', 'financial_funds', 'financial_rules',
  'financial_programs', 'financial_criteria_authority', 'program_requests',
  'affiliates', 'savings_loan_authorizations', 'finance_blocks',
];
const sqlList = values => values.map(v => "'" + v.replace(/'/g, "''") + "'").join(',');
async function main() {
  if (process.argv.includes('--history-baseline')) {
    const historyBaseline=(await query(`select jsonb_build_object(
     'captured_at',clock_timestamp(),
     'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'hash',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'oid',p.oid) order by p.oid::regprocedure::text)
      from pg_proc p where p.oid in ('public.get_self_loan_history_snapshot()'::regprocedure,'public.can_read_loan_history_publication()'::regprocedure,'public.configure_loan_history_sync(boolean)'::regprocedure)),
     'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'oid',c.oid,'acl',c.relacl::text,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
      'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
      'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname),'[]') from pg_constraint where conrelid=c.oid),
      'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by policyname),'[]') from pg_policies p where schemaname=n.nspname and tablename=c.relname)) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid in ('public.loan_history_publication'::regclass,'loan_history_private.state'::regclass,'loan_history_private.observations'::regclass)),
     'publication',(select to_jsonb(p) from public.loan_history_publication p where id),
     'sync_enabled',(select enabled from loan_history_private.state where id)) baseline`))[0].baseline;
    fs.writeFileSync(path.join(directory,'history-publication-before.json'),JSON.stringify(historyBaseline,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({status:'PASS',mode:'READ_ONLY_HISTORY_PUBLICATION_BASELINE',functions:historyBaseline.functions.length,tables:historyBaseline.tables.length,syncEnabled:historyBaseline.sync_enabled,publicationPresent:!!historyBaseline.publication.version,productionMutations:0}));
    return;
  }
  if (process.argv.includes('--preflight')) {
    const preflight = (await query(`select jsonb_build_object(
      'checked_at',clock_timestamp(),
      'migration_available',not exists(select 1 from supabase_migrations.schema_migrations where version='20261027000100'),
      'schema_available',to_regnamespace('loan_capacity_private') is null,
      'tables_available',to_regclass('public.loan_capacity_policy') is null and to_regclass('public.loan_capacity_overrides') is null and to_regclass('public.loan_capacity_events') is null,
      'column_available',not exists(select 1 from information_schema.columns where table_schema='public' and table_name='financial_session_snapshots' and column_name='loan_capacity'),
      'quote_hash',md5(pg_get_functiondef('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)'::regprocedure)),
      'invalid_pending_principal',(select count(*) from public.program_requests r where r.program_id='prestamo' and r.status in('submitted','in_review','requires_financial_processing','approved') and (r.requested_amount is null or r.requested_amount<=0 or r.requested_amount::text in('NaN','Infinity','-Infinity'))),
      'unresolved_request_funds',(select count(*) from public.program_requests request where request.program_id='prestamo' and request.status in('submitted','in_review','requires_financial_processing','approved') and
       (select count(distinct r.fund_id) from public.financial_rules r where coalesce(r.legacy_criterion_identity,'SUPABASE_RULE:'||r.id::text)=request.financial_submission_snapshot->>'criterion_identity')<>1)
    ) result`))[0].result;
    const expected = {migration_available:true,schema_available:true,tables_available:true,column_available:true,quote_hash:'caa656046218f8956bf40f93c6d8a688',invalid_pending_principal:0,unresolved_request_funds:0};
    for (const [key,value] of Object.entries(expected)) if(preflight[key]!==value) throw Error('LOAN_CAPACITY_PREFLIGHT_'+key.toUpperCase());
    fs.writeFileSync(path.join(directory,'preflight.json'),JSON.stringify({status:'PASS',...preflight,productionMutations:0},null,2)+'\n');
    console.log(JSON.stringify({status:'PASS',...preflight,productionMutations:0}));
    return;
  }
  if (process.argv.includes('--supplement')) {
    const before = JSON.parse(fs.readFileSync(path.join(directory, 'catalog-before.json'), 'utf8'));
    const triggerSignatures = before.tables.flatMap(t => t.triggers.map(t => t.function));
    const data = await query(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,
      md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl,pg_get_userbyid(p.proowner) owner,p.oid
      from pg_proc p where p.proname in ('financial_runtime_rules_for_batch','admin_actor_can_impersonate')
      or p.oid::regprocedure::text in (${sqlList(triggerSignatures)}) order by 1`);
    fs.writeFileSync(path.join(directory, 'catalog-supplement-before.json'), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({status:'PASS',mode:'READ_ONLY_SUPPLEMENT',functions:data.length,productionMutations:0}));
    return;
  }
  const target = path.join(directory, 'catalog-before.json');
  if (fs.existsSync(target)) throw Error('LOAN_CAPACITY_BASELINE_ALREADY_EXISTS');
  const baseline = (await query(`select jsonb_build_object(
    'captured_at',clock_timestamp(),
    'migrations',(select coalesce(jsonb_agg(version order by version),'[]') from supabase_migrations.schema_migrations),
    'functions',(select coalesce(jsonb_agg(jsonb_build_object(
      'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
      'hash',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,
      'owner',pg_get_userbyid(p.proowner),'oid',p.oid,'security_definer',p.prosecdef,
      'volatility',p.provolatile,'config',p.proconfig) order by p.oid::regprocedure::text),'[]')
      from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (${sqlList(functionNames)})),
    'tables',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'oid',c.oid,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
      'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
      'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
        'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
        from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
      'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname),'[]') from pg_constraint where conrelid=c.oid),
      'indexes',(select coalesce(jsonb_agg(pg_get_indexdef(indexrelid) order by indexrelid),'[]') from pg_index where indrelid=c.oid),
      'triggers',(select coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text) order by t.tgname),'[]') from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),
      'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.policyname),'[]') from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
      ) order by c.relname),'[]') from pg_class c where c.relnamespace='public'::regnamespace and c.relname in (${sqlList(tableNames)})),
    'funds',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'program_id',f.program_id,'code',f.code,'name',f.name,'enabled',f.enabled,'publication_status',f.publication_status,'version',f.version) order by f.program_id,f.code),'[]') from public.financial_funds f),
    'rules',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'lineage_id',r.lineage_id,'version',r.version,
      'program_id',r.program_id,'fund_id',r.fund_id,'financial_union_code',r.financial_union_code,
      'financial_employee_category_code',r.financial_employee_category_code,'max_amount',r.max_amount,
      'legacy_criterion_identity',r.legacy_criterion_identity,'enabled',r.enabled,'lifecycle_status',r.lifecycle_status) order by r.id),'[]') from public.financial_rules r),
    'request_aggregate',(select coalesce(jsonb_agg(to_jsonb(t) order by t.program_id,t.status,t.processing),'[]') from
      (select program_id,status,coalesce(financial_processing_status,'') processing,count(*) records,
        count(*) filter(where financial_submission_snapshot->>'criterion_identity' is not null) with_criterion,
        count(*) filter(where financial_submission_snapshot->'financialResult'->>'total' is not null) with_total
        from public.program_requests where financial_processing_status is not null group by program_id,status,financial_processing_status)t)
  ) baseline`))[0].baseline;
  fs.mkdirSync(directory, { recursive: true });
  const text = JSON.stringify(baseline, null, 2) + '\n';
  fs.writeFileSync(target, text, { flag: 'wx' });
  const result = { status: 'PASS', mode: 'READ_ONLY_BASELINE', capturedAt: baseline.captured_at,
    sha256: crypto.createHash('sha256').update(text).digest('hex'), functions: baseline.functions.length,
    tables: baseline.tables.length, funds: baseline.funds.length, rules: baseline.rules.length,
    latestMigration: baseline.migrations.at(-1), productionMutations: 0 };
  fs.writeFileSync(path.join(directory, 'catalog-before-manifest.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { functionNames, tableNames };
