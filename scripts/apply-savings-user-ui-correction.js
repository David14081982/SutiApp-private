'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const migrationId = '20260902000400_savings_user_ui_correction';
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', migrationId + '.sql'), 'utf8');
const recovery = fs.readFileSync(path.join(root, 'supabase', 'recovery', migrationId + '_recovery.sql'), 'utf8');
const tables = [
  'savings_import_batches', 'savings_participants', 'savings_enrollments', 'savings_contribution_plans',
  'savings_contribution_overrides', 'savings_transactions', 'savings_action_availability',
  'savings_beneficiary_versions', 'savings_beneficiaries', 'savings_requests', 'savings_request_approvals',
  'savings_holds', 'savings_yield_periods', 'savings_yield_allocations', 'savings_process_change_events',
  'savings_legacy_evidence', 'savings_audit_events',
];

function env() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = raw.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}
function body(sql) { return sql.replace(/^\s*begin;\s*/i, '').replace(/\s*commit;\s*$/i, ''); }
async function management(values, query) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + values.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'SutiApp-SavingsUiCorrection/1.0' },
    body: JSON.stringify({ query }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error('MANAGEMENT_SQL_' + response.status + ':' + JSON.stringify(data).slice(0, 700));
  return data;
}
async function snapshot(values) {
  const unions = tables.map((table) => `select '${table}' as table_name,count(*)::bigint as row_count from public.${table}`).join(' union all ');
  const rows = await management(values, unions + ' order by table_name');
  return Object.fromEntries(rows.map((row) => [row.table_name, Number(row.row_count)]));
}
const correctedChecks = `do $verify$ declare v_def text; begin
  if to_regprocedure('public.get_self_savings_live_readonly()') is null then raise exception 'SELF_LIVE_READ_RPC_MISSING'; end if;
  if has_function_privilege('anon','public.get_self_savings_live_readonly()','execute') then raise exception 'ANON_SELF_LIVE_READ_EXECUTE'; end if;
  if not has_function_privilege('authenticated','public.get_self_savings_live_readonly()','execute') then raise exception 'AUTH_SELF_LIVE_READ_DENIED'; end if;
  select pg_get_functiondef('public.get_self_savings_live_readonly()'::regprocedure) into v_def;
  if position('security definer' in lower(v_def))=0 or position('stable' in lower(v_def))=0 then raise exception 'RPC_SECURITY_OR_VOLATILITY_INVALID'; end if;
  if position('v_balance_evidence' in v_def)=0 or position('legacy_reported_balance,value' in v_def)=0 then raise exception 'CERTIFIED_Q_FALLBACK_MISSING'; end if;
  if position('savings_transactions' in v_def)>0 or position('Reporte Ahorro' in v_def)>0 then raise exception 'FORBIDDEN_BALANCE_SOURCE'; end if;
end $verify$;`;
const restoredChecks = `do $verify$ declare v_def text; begin
  select pg_get_functiondef('public.get_self_savings_live_readonly()'::regprocedure) into v_def;
  if position('v_balance_evidence' in v_def)>0 then raise exception 'RECOVERY_DID_NOT_RESTORE_PRIOR_READER'; end if;
end $verify$;`;

async function main() {
  const values = env();
  assert(values.SUPABASE_URL && values.SUPABASE_ACCESS_TOKEN, 'Supabase management environment unavailable');
  const before = await snapshot(values);
  let mode;
  if (process.argv.includes('--apply')) {
    await management(values, migration);
    await management(values, 'begin;' + correctedChecks + 'rollback;');
    mode = 'APPLIED';
  } else {
    await management(values, 'begin;' + body(migration) + correctedChecks + body(recovery) + restoredChecks + 'rollback;');
    mode = 'DRY_RUN_FORWARD_RECOVERY';
  }
  const after = await snapshot(values);
  assert.deepStrictEqual(after, before, 'Savings table row counts changed');
  console.log(JSON.stringify({ status: 'PASS', mode, migration: migrationId, tablesChecked: tables.length, dataRowsChanged: 0, countsUnchanged: true }));
}
main().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message })); process.exitCode = 1; });
