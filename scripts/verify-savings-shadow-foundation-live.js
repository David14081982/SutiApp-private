'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readEnvironment() {
  const values = {};
  const envPath = path.join(root, 'supabase.env');
  for (const line of fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function transactionalBody(sql) {
  return sql.replace(/^\s*begin;\s*/i, '').replace(/\s*commit;\s*$/i, '');
}

async function managementQuery(values, query) {
  const projectRef = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SutiApp-SavingsShadowVerifier/1.0',
    },
    body: JSON.stringify({ query }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`MANAGEMENT_SQL_${response.status}:${JSON.stringify(data).slice(0, 1600)}`);
  }
  return data;
}

const savingsTables = [
  'savings_import_batches',
  'savings_participants',
  'savings_enrollments',
  'savings_contribution_plans',
  'savings_contribution_overrides',
  'savings_transactions',
  'savings_action_availability',
  'savings_beneficiary_versions',
  'savings_beneficiaries',
  'savings_requests',
  'savings_request_approvals',
  'savings_holds',
  'savings_yield_periods',
  'savings_yield_allocations',
  'savings_process_change_events',
  'savings_legacy_evidence',
  'savings_audit_events',
];

const forwardChecks = `
do $verify$
declare
  v_table text;
  v_rls boolean;
  v_force boolean;
begin
  foreach v_table in array array[${savingsTables.map((name) => `'${name}'`).join(',')}]
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'SAVINGS_TABLE_MISSING:%', v_table;
    end if;
    select relrowsecurity, relforcerowsecurity
      into v_rls, v_force
      from pg_class
      where oid = to_regclass('public.' || v_table);
    if not v_rls or not v_force then
      raise exception 'SAVINGS_RLS_OR_FORCE_MISSING:%', v_table;
    end if;
    if has_table_privilege('anon', 'public.' || v_table, 'select')
       or has_table_privilege('authenticated', 'public.' || v_table, 'select') then
      raise exception 'SAVINGS_BROWSER_TABLE_EXPOSED:%', v_table;
    end if;
  end loop;

  if to_regprocedure('public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid)') is null then
    raise exception 'SAVINGS_SELF_REQUEST_RPC_MISSING';
  end if;
  if to_regprocedure('public.get_self_savings_dashboard()') is null
     or to_regprocedure('public.get_admin_savings_dashboard(uuid)') is null
     or to_regprocedure('public.import_savings_shadow_manifest(jsonb,boolean)') is null then
    raise exception 'SAVINGS_REQUIRED_RPC_MISSING';
  end if;
  if not exists(
    select 1 from pg_trigger
    where tgrelid = 'public.affiliates'::regclass
      and tgname = 'savings_capture_affiliate_process_change'
      and not tgisinternal
  ) then
    raise exception 'SAVINGS_PROCESS_TRIGGER_MISSING';
  end if;
  if has_function_privilege('anon', 'public.get_self_savings_dashboard()', 'execute')
     or not has_function_privilege('authenticated', 'public.get_self_savings_dashboard()', 'execute') then
    raise exception 'SAVINGS_SELF_RPC_GRANT_INVALID';
  end if;
  if has_function_privilege('authenticated', 'public.import_savings_shadow_manifest(jsonb,boolean)', 'execute')
     or not has_function_privilege('service_role', 'public.import_savings_shadow_manifest(jsonb,boolean)', 'execute') then
    raise exception 'SAVINGS_IMPORT_RPC_GRANT_INVALID';
  end if;
  if (select count(*) from public.admin_role_permissions where permission like 'savings.%') < 6 then
    raise exception 'SAVINGS_ADMIN_PERMISSIONS_MISSING';
  end if;
end $verify$;`;

const recoveryChecks = `
do $verify$
declare v_table text;
begin
  foreach v_table in array array[${savingsTables.map((name) => `'${name}'`).join(',')}]
  loop
    if to_regclass('public.' || v_table) is not null then
      raise exception 'SAVINGS_RECOVERY_TABLE_REMAINS:%', v_table;
    end if;
  end loop;
  if to_regprocedure('public.get_self_savings_dashboard()') is not null
     or to_regprocedure('public.import_savings_shadow_manifest(jsonb,boolean)') is not null then
    raise exception 'SAVINGS_RECOVERY_RPC_REMAINS';
  end if;
  if exists(
    select 1 from pg_trigger
    where tgrelid = 'public.affiliates'::regclass
      and tgname = 'savings_capture_affiliate_process_change'
      and not tgisinternal
  ) then
    raise exception 'SAVINGS_RECOVERY_TRIGGER_REMAINS';
  end if;
  if exists(select 1 from public.admin_role_permissions where permission like 'savings.%') then
    raise exception 'SAVINGS_RECOVERY_PERMISSION_REMAINS';
  end if;
end $verify$;`;

const functionalChecks = `
savepoint savings_functional_fixture;
do $verify$
declare
  v_affiliate uuid;
  v_auth uuid;
  v_other_auth uuid;
  v_admin_auth uuid;
  v_participant uuid;
  v_process_participant uuid;
  v_enrollment uuid;
  v_process_enrollment uuid;
  v_balance record;
  v_dashboard jsonb;
  v_admin_dashboard jsonb;
  v_import_result jsonb;
  v_materialized jsonb;
  v_february_transactions integer;
  v_append_only_denied boolean := false;
begin
  select id, auth_user_id into v_affiliate, v_auth
    from public.affiliates where auth_user_id is not null order by id limit 1;
  if v_auth is null then raise exception 'SAVINGS_TEST_LINKED_AFFILIATE_MISSING'; end if;

  insert into public.savings_participants(
    participant_type, affiliate_id, legacy_folio, display_name, identity_status,
    certification_status, current_process, process_source, data_classification
  ) values(
    'AFFILIATE', v_affiliate, 'QA-SAVINGS-SHADOW-001', 'QA Savings', 'RESOLVED',
    'CERTIFIED', 'JUB', 'SHADOW', 'SHADOW'
  ) returning id into v_participant;
  insert into public.savings_enrollments(
    participant_id, sequence_number, status, enrollment_started_at, approved_at,
    first_expected_contribution_date, process_snapshot, data_classification
  ) values(v_participant, 1, 'ACTIVE', now(), now(), date '2026-01-05', 'JUB', 'SHADOW')
  returning id into v_enrollment;
  insert into public.savings_contribution_plans(enrollment_id, amount, process_snapshot, effective_from, data_classification)
  values(v_enrollment, 500, 'JUB', date '2026-01-01', 'SHADOW');
  insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification)
  values
    (v_participant,v_enrollment,'CONTRIBUTION','CAPITAL','CREDIT',1000,date '2026-01-05','QA:SAVINGS:CAPITAL','SHADOW'),
    (v_participant,v_enrollment,'YIELD_CREDIT','YIELD','CREDIT',50,date '2026-01-05','QA:SAVINGS:YIELD','SHADOW');
  insert into public.savings_holds(participant_id,enrollment_id,component,amount,reason,created_by_auth_user_id)
  values(v_participant,v_enrollment,'CAPITAL',200,'QA hold verification',v_auth);

  select * into v_balance from public.savings_participant_balance(v_participant);
  if v_balance.capital<>1000 or v_balance.yield_amount<>50 or v_balance.held<>200 or v_balance.available<>850 then
    raise exception 'SAVINGS_BALANCE_COMPONENTS_INVALID:%', row_to_json(v_balance);
  end if;
  if (select count(*) from public.generate_savings_schedule(v_enrollment,date '2026-02-01',date '2026-02-28'))<>1
     or not exists(select 1 from public.generate_savings_schedule(v_enrollment,date '2026-02-01',date '2026-02-28') where contribution_date=date '2026-02-05') then
    raise exception 'SAVINGS_JUB_SCHEDULE_INVALID';
  end if;

  insert into public.savings_participants(participant_type,legacy_folio,display_name,identity_status,certification_status,current_process,process_source,data_classification)
  values('LEGACY_UNRESOLVED','QA-SAVINGS-SHADOW-002','QA Process','ORPHAN','CERTIFIED','PROCESS_1','SHADOW','SHADOW')
  returning id into v_process_participant;
  insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,approved_at,first_expected_contribution_date,process_snapshot,data_classification)
  values(v_process_participant,1,'ACTIVE',now(),now(),date '2026-01-15','PROCESS_1','SHADOW') returning id into v_process_enrollment;
  insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,data_classification)
  values(v_process_enrollment,300,'PROCESS_1',date '2026-01-01','SHADOW');
  if (select count(*) from public.generate_savings_schedule(v_process_enrollment,date '2026-02-01',date '2026-02-28'))<>2
     or not exists(select 1 from public.generate_savings_schedule(v_process_enrollment,date '2026-02-01',date '2026-02-28') where contribution_date=date '2026-02-15')
     or not exists(select 1 from public.generate_savings_schedule(v_process_enrollment,date '2026-02-01',date '2026-02-28') where contribution_date=date '2026-02-28') then
    raise exception 'SAVINGS_PROCESS_SCHEDULE_INVALID';
  end if;

  insert into public.savings_action_availability(action_code,scope_type,enabled,reason,effective_from,configured_by_auth_user_id)
  values('WITHDRAW','GLOBAL',true,'QA global enabled',now()-interval '1 minute',v_auth);
  insert into public.savings_action_availability(action_code,scope_type,participant_id,enabled,reason,effective_from,configured_by_auth_user_id)
  values('WITHDRAW','PARTICIPANT',v_participant,false,'QA participant disabled',now(),v_auth);
  if public.savings_effective_action('WITHDRAW',v_participant) then raise exception 'SAVINGS_PARTICIPANT_ACTION_OVERRIDE_INVALID'; end if;
  if not public.savings_effective_action('WITHDRAW',v_process_participant) then raise exception 'SAVINGS_GLOBAL_ACTION_INVALID'; end if;

  perform set_config('request.jwt.claim.sub',v_auth::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_auth::text,'role','authenticated')::text,true);
  v_dashboard:=public.get_self_savings_dashboard();
  if (v_dashboard#>>'{balances,capital}')::numeric<>1000
     or (v_dashboard#>>'{balances,yield}')::numeric<>50
     or (v_dashboard#>>'{balances,available}')::numeric<>850 then
    raise exception 'SAVINGS_SELF_DASHBOARD_INVALID:%',v_dashboard;
  end if;

  select auth_user_id into v_other_auth from public.affiliates
    where auth_user_id is not null and auth_user_id<>v_auth order by id limit 1;
  if v_other_auth is null then raise exception 'SAVINGS_TEST_SECOND_AFFILIATE_MISSING'; end if;
  perform set_config('request.jwt.claim.sub',v_other_auth::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other_auth::text,'role','authenticated')::text,true);
  v_dashboard:=public.get_self_savings_dashboard();
  if v_dashboard->'participant'<>'null'::jsonb or v_dashboard->'balances'<>'null'::jsonb then
    raise exception 'SAVINGS_CROSS_AFFILIATE_EXPOSURE:%',v_dashboard;
  end if;

  select auth_user_id into v_admin_auth from public.admin_assignments
    where enabled and 'savings.read'=any(permissions) and 'savings.write'=any(permissions) order by auth_user_id limit 1;
  if v_admin_auth is null then raise exception 'SAVINGS_TEST_ADMIN_PERMISSION_MISSING'; end if;
  perform set_config('request.jwt.claim.sub',v_admin_auth::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin_auth::text,'role','authenticated')::text,true);
  v_admin_dashboard:=public.get_admin_savings_dashboard(v_participant);
  if jsonb_array_length(v_admin_dashboard->'participants')<>1
     or (v_admin_dashboard#>>'{kpis,balance_total}')::numeric<>1050 then
    raise exception 'SAVINGS_ADMIN_DASHBOARD_INVALID:%',v_admin_dashboard;
  end if;

  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  if (public.materialize_savings_contributions(date '2026-01-05')->>'inserted')::integer<>1 then
    raise exception 'SAVINGS_EXPECTED_ACTUAL_DEFAULT_INVALID';
  end if;
  if not exists(
    select 1 from public.savings_transactions
    where enrollment_id=v_enrollment and contribution_date=date '2026-01-05'
      and transaction_type='CONTRIBUTION' and expected_amount=500 and actual_amount=500 and difference_amount=0 and amount=500
  ) then raise exception 'SAVINGS_EXPECTED_ACTUAL_TRANSACTION_INVALID'; end if;

  perform set_config('request.jwt.claim.sub',v_admin_auth::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin_auth::text,'role','authenticated')::text,true);
  perform public.admin_override_savings_contribution(v_enrollment,date '2026-01-05',350,'QA actual 350','11111111-1111-4111-8111-111111111111'::uuid);
  perform public.admin_override_savings_contribution(v_enrollment,date '2026-02-05',0,'QA actual zero','22222222-2222-4222-8222-222222222222'::uuid);
  if not exists(select 1 from public.savings_contribution_overrides where enrollment_id=v_enrollment and contribution_date=date '2026-01-05' and expected_amount=500 and actual_amount=350)
     or not exists(select 1 from public.savings_contribution_overrides where enrollment_id=v_enrollment and contribution_date=date '2026-02-05' and expected_amount=500 and actual_amount=0) then
    raise exception 'SAVINGS_MANUAL_ACTUAL_OVERRIDE_INVALID';
  end if;
  if (select count(*) from public.savings_audit_events where participant_id=v_participant and resource='savings_contribution_overrides' and action='INSERT_VERSION')<>2 then
    raise exception 'SAVINGS_OVERRIDE_AUDIT_INVALID';
  end if;
  if (select sum(case direction when 'CREDIT' then amount else -amount end) from public.savings_transactions where enrollment_id=v_enrollment and contribution_date=date '2026-01-05')<>350 then
    raise exception 'SAVINGS_OVERRIDE_LEDGER_DELTA_INVALID';
  end if;

  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  v_materialized:=public.materialize_savings_contributions(date '2026-02-05');
  select count(*) into v_february_transactions from public.savings_transactions where enrollment_id=v_enrollment and contribution_date=date '2026-02-05' and transaction_type='CONTRIBUTION';
  if (v_materialized->>'inserted')::integer<>2 or v_february_transactions<>0 then
    raise exception 'SAVINGS_ZERO_ACTUAL_INVALID result=% february_transactions=%',v_materialized,v_february_transactions;
  end if;
  v_materialized:=public.materialize_savings_contributions(date '2026-02-05');
  if (v_materialized->>'inserted')::integer<>0 then
    raise exception 'SAVINGS_MATERIALIZE_IDEMPOTENCY_INVALID result=%',v_materialized;
  end if;

  v_import_result:=public.import_savings_shadow_manifest(
    jsonb_build_object(
      'source_snapshot_sha256',repeat('A',64),
      'certification',jsonb_build_object('status','CERTIFIED','evidence_sha256',repeat('A',64)),
      'participants','[]'::jsonb
    ),false
  );
  if v_import_result->>'mode'<>'DRY_RUN' then raise exception 'SAVINGS_IMPORT_DRY_RUN_INVALID'; end if;

  begin
    update public.savings_transactions set amount=1001 where idempotency_key='QA:SAVINGS:CAPITAL';
  exception when others then
    v_append_only_denied:=sqlerrm like 'SAVINGS_APPEND_ONLY%';
  end;
  if not v_append_only_denied then raise exception 'SAVINGS_APPEND_ONLY_TRIGGER_INVALID'; end if;
end $verify$;
rollback to savings_functional_fixture;`;

async function main() {
  const values = readEnvironment();
  assert(values.SUPABASE_URL && values.SUPABASE_ACCESS_TOKEN, 'Supabase management configuration missing');
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260902000100_savings_shadow_foundation.sql'), 'utf8');
  const recovery = fs.readFileSync(path.join(root, 'supabase/recovery/20260902000100_savings_shadow_foundation_recovery.sql'), 'utf8');
  const installed = await managementQuery(values, "select to_regclass('public.savings_import_batches') is not null as applied");
  assert(!(installed[0] && installed[0].applied === true), 'Savings shadow migration is already installed; dry-run recovery must not target a live installation');
  const permissionState = await managementQuery(values, `
    select
      (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check') constraint_definition,
      (select jsonb_agg(permission order by permission) from (select distinct unnest(permissions) permission from public.admin_assignments) p) assigned_permissions,
      (select jsonb_agg(permission order by permission) from (select distinct permission from public.admin_role_permissions) p) role_permissions
  `);
  console.log(JSON.stringify({ preflight: 'ADMIN_PERMISSION_CONTRACT', state: permissionState[0] }));
  await managementQuery(
    values,
    `begin;${transactionalBody(migration)}${forwardChecks}${functionalChecks}${transactionalBody(recovery)}${recoveryChecks}rollback;`,
  );
  console.log(JSON.stringify({
    status: 'PASS',
    mode: 'DRY_RUN_FORWARD_RECOVERY',
    migration: '20260902000100',
    tablesVerified: savingsTables.length,
    functionalChecks: ['BALANCE_COMPONENTS', 'JUB_SCHEDULE', 'PROCESS_SCHEDULE', 'ACTION_OVERRIDE', 'SELF_ISOLATION', 'ADMIN_READ', 'EXPECTED_ACTUAL_DEFAULT', 'MANUAL_ACTUAL_350', 'MANUAL_ACTUAL_0', 'MATERIALIZE_IDEMPOTENCY', 'IMPORT_DRY_RUN', 'APPEND_ONLY'],
    dataRowsChanged: 0,
    productionApplied: false,
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
