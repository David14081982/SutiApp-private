'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const migrationName = '20260830000400_request_workflow_timeline_cutover.sql';
const recoveryName = '20260830000400_request_workflow_timeline_cutover_recovery.sql';
const hardeningName = '20260830000410_harden_request_workflow_assignment.sql';
const hardeningRecoveryName = '20260830000410_harden_request_workflow_assignment_recovery.sql';

function env() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    const at = line.indexOf('=');
    if (at > 0 && !line.startsWith('#')) values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function body(sql) {
  return sql.replace(/^\s*begin;\s*/i, '').replace(/\s*commit;\s*$/i, '');
}

async function management(values, query) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SutiApp-Request-Workflow-Cutover/1.0',
    },
    body: JSON.stringify({ query }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`MANAGEMENT_SQL_${response.status}:${data && (data.message || data.error) || 'UNKNOWN'}`);
  return data;
}

const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', migrationName), 'utf8');
const recovery = fs.readFileSync(path.join(root, 'supabase', 'recovery', recoveryName), 'utf8');
const hardening = fs.readFileSync(path.join(root, 'supabase', 'migrations', hardeningName), 'utf8');
const hardeningRecovery = fs.readFileSync(path.join(root, 'supabase', 'recovery', hardeningRecoveryName), 'utf8');
const hardeningChecks = `
do $verify$
begin
  begin
    update public.operational_workflows set service_keys=array['request:loan'] where id='10000000-0000-4000-8000-000000000002';
    perform public.validate_operational_workflow_configuration('10000000-0000-4000-8000-000000000002');
    raise exception 'WORKFLOW_SERVICE_CONFLICT_NOT_ENFORCED';
  exception when sqlstate '22023' then
    if sqlerrm<>'WORKFLOW_SERVICE_CONFLICT' then raise; end if;
  end;
end $verify$;`;
const forwardChecks = `
do $verify$
declare r record;v_state jsonb;v_requests integer;v_tracking integer;
begin
  if to_regprocedure('public.get_self_request_workflow_state(uuid)') is null or to_regprocedure('public.list_admin_request_workflow_tracking()') is null then raise exception 'WORKFLOW_RPC_MISSING'; end if;
  if has_function_privilege('anon','public.get_self_request_workflow_state(uuid)','execute') then raise exception 'ANON_WORKFLOW_EXECUTE'; end if;
  if has_table_privilege('authenticated','public.operational_workflows','delete') or has_table_privilege('authenticated','public.operational_workflow_stages','delete') then raise exception 'PHYSICAL_DELETE_ALLOWED'; end if;
  if (select count(*) from public.operational_workflows where enabled)<4 or (select count(*) from public.operational_workflow_stages where enabled)<20 then raise exception 'BASE_WORKFLOW_INCOMPLETE'; end if;
  if exists(select 1 from public.program_requests where workflow_id is null or workflow_version is null or workflow_snapshot is null) then raise exception 'REQUEST_WITHOUT_SNAPSHOT'; end if;
  select count(*) into v_requests from public.program_requests;
  select count(*) into v_tracking from public.operational_request_tracking;
  if v_tracking<v_requests then raise exception 'TRACKING_BACKFILL_INCOMPLETE'; end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  for r in select id from public.program_requests loop
    v_state:=public.resolve_program_request_workflow_state(r.id);
    if not coalesce((v_state->>'available')::boolean,false) or jsonb_array_length(v_state->'stages')<3 then raise exception 'WORKFLOW_RESOLUTION_FAILED'; end if;
  end loop;
end $verify$;`;
const recoveryChecks = `
do $verify$
begin
  if to_regprocedure('public.get_self_request_workflow_state(uuid)') is not null then raise exception 'RECOVERY_RPC_REMAINS'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_requests' and column_name='workflow_snapshot') then raise exception 'RECOVERY_COLUMN_REMAINS'; end if;
  if exists(select 1 from public.operational_workflows where id::text like '10000000-0000-4000-8000-00000000000%') then raise exception 'RECOVERY_SEED_REMAINS'; end if;
  if not has_table_privilege('authenticated','public.operational_workflows','delete') then raise exception 'RECOVERY_DELETE_GRANT_MISSING'; end if;
end $verify$;`;

async function main() {
  const values = env();
  assert(values.SUPABASE_URL && values.SUPABASE_ACCESS_TOKEN, 'Supabase management configuration missing');
  if (process.argv.includes('--apply')) {
    await management(values, migration);
    await management(values, `begin;${forwardChecks}rollback;`);
    console.log(JSON.stringify({ status: 'PASS', mode: 'APPLIED', migration: '20260830000400', googleReads: 0, googleWrites: 0 }));
    return;
  }
  if (process.argv.includes('--apply-hardening')) {
    await management(values, hardening);
    await management(values, `begin;${hardeningChecks}rollback;`);
    console.log(JSON.stringify({ status: 'PASS', mode: 'APPLIED', migration: '20260830000410', googleReads: 0, googleWrites: 0 }));
    return;
  }
  if (process.argv.includes('--dry-hardening')) {
    await management(values, `begin;${body(hardening)}${hardeningChecks}${body(hardeningRecovery)}rollback;`);
    console.log(JSON.stringify({ status: 'PASS', mode: 'DRY_RUN_HARDENING_RECOVERY', migration: '20260830000410', googleReads: 0, googleWrites: 0 }));
    return;
  }
  await management(values, `begin;${body(migration)}${forwardChecks}${body(recovery)}${recoveryChecks}rollback;`);
  console.log(JSON.stringify({ status: 'PASS', mode: 'DRY_RUN_FORWARD_RECOVERY', migration: '20260830000400', googleReads: 0, googleWrites: 0 }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
