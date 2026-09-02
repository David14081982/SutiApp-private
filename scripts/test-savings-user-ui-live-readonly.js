'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
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
async function json(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}
async function login(values, alias) {
  const result = await json(values.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: values[alias + '_EMAIL'], password: values[alias + '_PASSWORD'] }),
  });
  assert(result.ok, alias + '_LOGIN_' + result.status);
  return result.data.access_token;
}
async function rest(values, route, token, method, body) {
  return json(values.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + route, {
    method: method || 'GET',
    headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function management(values, query) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const result = await json(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + values.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  });
  assert(result.ok, 'MANAGEMENT_' + result.status);
  return result.data;
}
async function snapshot(values) {
  const query = tables.map((table) => `select '${table}' table_name,count(*)::bigint row_count from public.${table}`).join(' union all ') + ' order by table_name';
  const rows = await management(values, query);
  return Object.fromEntries(rows.map((row) => [row.table_name, Number(row.row_count)]));
}

async function main() {
  const values = env();
  ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ACCESS_TOKEN', 'H005_TEST_EMAIL', 'H005_TEST_PASSWORD', 'H005_TEST2_EMAIL', 'H005_TEST2_PASSWORD', 'H005_TEST3_EMAIL', 'H005_TEST3_PASSWORD'].forEach((key) => assert(values[key], key + '_MISSING'));
  const before = await snapshot(values);
  const [activeToken, noSavingsToken, otherToken] = await Promise.all([login(values, 'H005_TEST2'), login(values, 'H005_TEST'), login(values, 'H005_TEST3')]);
  const [activeResult, noSavingsResult, otherResult, anonymousResult] = await Promise.all([
    rest(values, 'rpc/get_self_savings_live_readonly', activeToken, 'POST', {}),
    rest(values, 'rpc/get_self_savings_live_readonly', noSavingsToken, 'POST', {}),
    rest(values, 'rpc/get_self_savings_live_readonly', otherToken, 'POST', {}),
    json(values.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/get_self_savings_live_readonly', { method: 'POST', headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: '{}' }),
  ]);
  assert(activeResult.ok, 'ACTIVE_RPC_' + activeResult.status + '_' + JSON.stringify(activeResult.data));
  assert(noSavingsResult.ok, 'NO_SAVINGS_RPC_' + noSavingsResult.status);
  assert(otherResult.ok, 'OTHER_SELF_RPC_' + otherResult.status);
  assert(!anonymousResult.ok && [401, 403].includes(anonymousResult.status), 'ANONYMOUS_NOT_DENIED_' + anonymousResult.status);
  const active = activeResult.data;
  const empty = noSavingsResult.data;
  assert.equal(active.schema_version, 'SAVINGS_USER_LIVE_READONLY_V1');
  assert.equal(active.authority, 'GOOGLE_LEGACY_AUTHORITY');
  assert.equal(active.projection, 'SHADOW_MIRROR');
  assert.equal(active.cutover_status, 'NOT_CUTOVER');
  assert.equal(active.canonical_ledger_used, false);
  assert.equal(active.yield_calculated, false);
  assert.equal(active.mismatches_block_ui, false);
  assert(active.participant && active.participant.identity_status === 'RESOLVED', 'ACTIVE_PARTICIPANT_MISSING');
  assert.equal(active.participant.legacy_folio, '5685', 'ACTIVE_FOLIO_5685_REQUIRED');
  assert(active.source_batch && /^[A-F0-9]{64}$/.test(active.source_batch.manifest_sha256), 'CERTIFIED_BATCH_HASH_MISSING');
  assert(active.balances && active.balances.total_source === 'LEGACY_REPORTED_BALANCE_Q', 'Q_NOT_DISPLAY_BALANCE');
  assert.strictEqual(active.balances.total, active.balances.legacy_reported_balance_Q);
  assert.strictEqual(active.balances.total, 8000, 'FOLIO_5685_Q_MUST_BE_8000');
  assert.equal(active.balances.canonical, false);
  assert(active.enrollment && active.enrollment.status && active.enrollment.enrollment_started_at, 'ENROLLMENT_EVIDENCE_INCOMPLETE');
  assert(active.enrollment.historical_process || active.enrollment.current_process, 'PROCESS_MISSING');
  assert(active.enrollment.current_contribution_amount !== null, 'CURRENT_AMOUNT_MISSING');
  assert(Array.isArray(active.history) && active.history.length > 0, 'AA_DO_HISTORY_MISSING');
  assert(active.history.every((row) => ['FORMULA', 'MANUAL', 'EMPTY'].includes(row.cell_kind)), 'AA_DO_CELL_KIND_INVALID');
  assert(active.history.every((row) => row.cell_kind !== 'FORMULA' || row.expected_amount !== null), 'FORMULA_NOT_EXPECTED');
  assert(active.history.every((row) => row.cell_kind !== 'MANUAL' || row.recorded_amount !== null), 'MANUAL_NOT_RECORDED');
  assert(Array.isArray(active.annual) && active.annual.length > 0, 'DP_DW_HISTORY_MISSING');
  assert(active.annual.every((row) => Object.hasOwn(row, 'capital') && Object.hasOwn(row, 'yield')), 'DP_DW_COMPONENTS_MISSING');
  const annual2026 = active.annual.find((row) => String(row.year).startsWith('2026'));
  assert(annual2026 && annual2026.capital === 44000 && annual2026.yield === 5315.2, 'FOLIO_5685_2026_HISTORY_INVALID');
  assert(Array.isArray(active.withdrawals) && active.withdrawals.length > 0, 'WITHDRAWALS_MISSING');
  assert(active.withdrawals.some((row) => row.amount === 49315.2), 'FOLIO_5685_COMPLETE_WITHDRAWAL_MISSING');
  assert(Object.values(active.actions).every((value) => value === false), 'ACTION_AVAILABILITY_EXPECTED_DISABLED');
  assert.deepStrictEqual(active.write_capabilities, { requests: false, beneficiaries: false });
  assert.equal(empty.authority, 'GOOGLE_LEGACY_AUTHORITY');
  assert.equal(empty.projection, 'SHADOW_MIRROR');
  assert.equal(empty.participant, null);
  assert.equal(empty.balances, null);
  ['history', 'annual', 'upcoming', 'withdrawals', 'plan_changes', 'beneficiaries'].forEach((key) => assert.deepStrictEqual(empty[key], [], 'NO_SAVINGS_' + key));

  assert(otherResult.data.participant && otherResult.data.participant.id !== active.participant.id, 'SELF_RPC_CROSSED_USERS');
  const injectedTarget = await rest(values, 'rpc/get_self_savings_live_readonly', otherToken, 'POST', { p_participant_id: active.participant.id });
  assert(!injectedTarget.ok && [400, 404].includes(injectedTarget.status), 'SELF_RPC_ACCEPTED_CROSS_USER_TARGET');
  const after = await snapshot(values);
  assert.deepStrictEqual(after, before, 'SAVINGS_ROWS_CHANGED_DURING_READ_TEST');
  console.log(JSON.stringify({
    status: 'PASS', mode: 'LIVE_READ_ONLY', activeParticipant: true, noSavingsParticipant: true,
    authority: active.authority, projection: active.projection, qIsDisplayedTotal: true, qReported: active.balances.legacy_reported_balance_Q !== null, folio5685Q: active.balances.total,
    historyRows: active.history.length, annualPeriods: active.annual.length, withdrawals: active.withdrawals.length,
    planChanges: active.plan_changes.length, beneficiaries: active.beneficiaries.length,
    allActionsDisabled: true, anonymousDenied: true, crossUserDenied: true, targetParameterRejected: true,
    tablesChecked: tables.length, dataRowsChanged: 0, googleReads: 0, googleWrites: 0,
  }));
}
main().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message })); process.exitCode = 1; });
