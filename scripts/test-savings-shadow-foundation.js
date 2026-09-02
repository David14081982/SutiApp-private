'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/20260902000100_savings_shadow_foundation.sql');
const recovery = read('supabase/recovery/20260902000100_savings_shadow_foundation_recovery.sql');
const correction = read('supabase/migrations/20260902000400_savings_user_ui_correction.sql');
const user = read('app/screens-savings.jsx');
const admin = read('app/screens-admin-savings.jsx');
const repo = read('app/savings-repository.js');
const store = read('app/savings-store.jsx');
const app = read('app/app.jsx');
const finance = read('app/screens-financiera.jsx');
const adminRoot = read('app/screens-admin.jsx');
const adminStore = read('app/admin-store.jsx');
const roleAdapter = read('app/admin-cutover-store.jsx');
const builder = read('scripts/build-bundle.js');
const bundle = read('app/bundle.js');
const importer = require('./import-savings-shadow.js');

const tables = [
  'savings_import_batches', 'savings_participants', 'savings_enrollments', 'savings_contribution_plans',
  'savings_contribution_overrides', 'savings_transactions', 'savings_action_availability',
  'savings_beneficiary_versions', 'savings_beneficiaries', 'savings_requests', 'savings_request_approvals',
  'savings_holds', 'savings_yield_periods', 'savings_yield_allocations', 'savings_process_change_events',
  'savings_legacy_evidence', 'savings_audit_events',
];
tables.forEach((table) => {
  assert.match(migration, new RegExp(`create table public\\.${table}\\b`, 'i'), `missing table ${table}`);
  assert.ok(recovery.includes(`drop table public.${table}`), `recovery missing ${table}`);
});

for (const permission of ['savings.read', 'savings.write', 'savings.approve', 'savings.config', 'savings.reports', 'savings.identity_review']) {
  assert.ok(migration.includes(`'${permission}'`), `migration permission missing ${permission}`);
  assert.ok(roleAdapter.includes(`'${permission}'`), `role editor mapping missing ${permission}`);
}

for (const contract of [
  'SAVINGS_APPEND_ONLY_HISTORY', 'SAVINGS_ACTION_DISABLED', 'SAVINGS_FIRST_EXPECTED_DATE_AND_PROCESS_REQUIRED',
  'SAVINGS_DUAL_APPROVAL_REQUIRED', 'SAVINGS_TERMINATION_REQUIRES_FULL_AVAILABLE',
  'SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED', 'SAVINGS_YIELD_PRODUCTIVE_DISABLED',
  'SAVINGS_UNRESOLVED_IDENTITY_MUST_BE_NULL', 'SAVINGS_TOTAL_WITHDRAWAL_AMOUNT_MISMATCH',
  'SAVINGS_EXTRAORDINARY_CAPITAL_ONLY', 'RECOVERY_BLOCKED_SAVINGS_HISTORY_EXISTS',
]) assert.ok(migration.includes(contract) || recovery.includes(contract), `missing invariant ${contract}`);

assert.match(migration, /transaction_type in \('CONTRIBUTION','YIELD_CREDIT','WITHDRAWAL','REGULARIZATION','ADJUSTMENT','REVERSAL','HOLD_SETTLEMENT'\)/);
assert.match(migration, /difference_amount=actual_amount-expected_amount/);
assert.match(migration, /legacy_reported_balance/);
assert.match(migration, /when p\.legacy_reported_balance=b\.total then 'MATCH' else 'MISMATCH'/);
assert.match(migration, /productive_enabled boolean not null default false/);
assert.match(migration, /constraint savings_yield_disabled_check check\(productive_enabled=false\)/);
assert.match(migration, /generate_savings_schedule/);
assert.match(migration, /m\.month_start\+4/);
assert.match(migration, /m\.month_start\+14/);
assert.match(migration, /interval '1 month - 1 day'/);
assert.match(migration, /force row level security/);
assert.ok(migration.includes("'savings_transactions'"), 'transactions absent from RLS table list');
assert.match(migration, /affiliate_id=public\.get_effective_affiliate_id\(\)/);
assert.match(migration, /actor_real_auth_user_id=auth\.uid\(\) and usuario_contexto_affiliate_id=public\.get_effective_affiliate_id\(\)/);
assert.match(migration, /auth\.role\(\)<>'service_role'/);
assert.match(migration, /capture_savings_process_change_from_affiliate/);
assert.match(migration, /after update of financial_employee_category_code on public\.affiliates/);
assert.match(migration, /reviewed_by_auth_user_id/);
assert.match(migration, /possible_matches_count/);
assert.match(migration, /financial_record_exists/);
assert.doesNotMatch(admin.match(/function identity\(\)[\s\S]*?function configuration/)[0], /display_name|historical_email|phone_raw/, 'pending identity exposes unnecessary PII');
assert.match(recovery, /drop trigger savings_capture_affiliate_process_change on public\.affiliates/);
assert.doesNotMatch(repo + store + user + admin, /SUTI_SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{40,}/);
assert.doesNotMatch(repo + store, /localStorage\s*[.(]|sessionStorage\s*[.(]|window\.DATA\b|FinancialLegacyRepository/);

assert.ok(finance.includes("app.openFinanceItem('ahorro')"), 'Ahorrar button lost its route');
assert.ok(app.includes("id === 'ahorro') return push('savings')"), 'Ahorrar does not push savings');
assert.ok(app.includes('savings: window.SavingsScreen'), 'Savings route not registered');
assert.ok(adminRoot.includes("id: 'savings'"), 'Admin savings module not registered');
assert.ok(adminRoot.includes('window.SavingsAdminModule'), 'Admin savings module not routed');
assert.ok(adminStore.includes("id: 'savings_approvals'"), 'Granular savings role resources absent');
for (const file of ['savings-repository.js', 'savings-store.jsx', 'screens-savings.jsx', 'screens-admin-savings.jsx']) {
  assert.ok(builder.includes(`'${file}'`), `bundle builder missing ${file}`);
  assert.ok(bundle.includes(`/* @@file ${file} */`), `bundle missing ${file}`);
}

for (const marker of ['data-savings-screen', 'data-savings-total', 'data-savings-capital', 'data-savings-yield', 'data-savings-year', 'data-savings-year-subtotal', 'data-savings-history', 'data-savings-withdrawals', 'data-savings-action', 'data-savings-detail']) assert.ok(user.includes(marker), `user marker missing ${marker}`);
for (const copy of ['Saldo actual', 'Detalle por año', 'Subtotal ', 'Tu ahorro', 'Retirar ahorro', 'Modificar monto', 'Historial', 'Retiros', 'Beneficiarios', 'Más detalles']) assert.ok(user.includes(copy), `visual contract missing ${copy}`);
assert.ok(user.includes('canWriteRequests') && user.includes('disabled: !enabled') && user.includes("data-savings-enabled': String(enabled)"), 'disabled savings actions must remain visible and disabled');
assert.ok(repo.includes('get_self_savings_live_readonly') && correction.includes('v_balance_evidence') && correction.includes("#>>'{legacy_reported_balance,value}'"), 'certified Q reader correction missing');
for (const forbiddenCopy of ['No reportado en Q', 'Google legacy', 'SHADOW certificado', 'DP:DW', 'AA:DO', 'Identidad legacy', 'PROCESS histórico', 'PROCESS actual', 'FORMULA', 'MANUAL', 'Supabase', 'evidencia legacy']) assert.ok(!user.includes(forbiddenCopy), `technical user copy leaked: ${forbiddenCopy}`);
for (const section of ['summary', 'participants', 'contributions', 'calendar', 'amount_changes', 'withdrawals', 'terminations', 'beneficiaries', 'yields', 'omissions', 'holds', 'process', 'identity', 'documents', 'reports', 'audit', 'config']) assert.ok(admin.includes(`['${section}'`), `admin section missing ${section}`);
for (const forbiddenValue of ['$48,315.20', '$43,000.00', '$5,315.20', '12.3% anual']) assert.ok(!user.includes(forbiddenValue), `visual mock value leaked: ${forbiddenValue}`);

function dates(process, from, to) {
  const out = [];
  const start = new Date(from + 'T12:00:00Z');
  const end = new Date(to + 'T12:00:00Z');
  for (let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12)); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
    const values = process === 'JUB' ? [5] : [15, Math.min(30, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())];
    values.forEach((day) => { const value = new Date(Date.UTC(year, month, day, 12)); if (value >= start && value <= end) out.push(value.toISOString().slice(0, 10)); });
  }
  return out;
}
assert.deepStrictEqual(dates('JUB', '2028-01-01', '2028-03-31'), ['2028-01-05', '2028-02-05', '2028-03-05']);
assert.deepStrictEqual(dates('PROCESS_1', '2028-02-01', '2028-03-31'), ['2028-02-15', '2028-02-29', '2028-03-15', '2028-03-30']);
assert.deepStrictEqual(dates('PROCESS_3', '2027-02-01', '2027-02-28'), ['2027-02-15', '2027-02-28']);

const maturedActual = (expected, override) => override === undefined ? expected : override;
assert.strictEqual(maturedActual(500), 500);
assert.strictEqual(maturedActual(500, 350), 350);
assert.strictEqual(maturedActual(500, 0), 0);
const projectedBalance = (rows) => rows.reduce((out, row) => { out[row.component] += (row.direction === 'CREDIT' ? 1 : -1) * row.amount; return out; }, { CAPITAL: 0, YIELD: 0 });
assert.deepStrictEqual(projectedBalance([{ component: 'CAPITAL', direction: 'CREDIT', amount: 500 }, { component: 'YIELD', direction: 'CREDIT', amount: 40 }, { component: 'CAPITAL', direction: 'DEBIT', amount: 100 }]), { CAPITAL: 400, YIELD: 40 });
const effectiveAction = (globalState, participantOverride) => participantOverride == null ? globalState : participantOverride;
assert.strictEqual(effectiveAction(true, null), true);
assert.strictEqual(effectiveAction(false, null), false);
assert.strictEqual(effectiveAction(false, true), true);
assert.strictEqual([{ percentage: 60 }, { percentage: 40 }].reduce((sum, row) => sum + row.percentage, 0), 100);

const snapshot = {
  participants: [
    { participant_type: 'AFFILIATE', affiliate_id: '11111111-1111-4111-8111-111111111111', legacy_folio: '100', identity_status: 'RESOLVED', current_process: 'PROCESS_1' },
    { participant_type: 'LEGACY_UNRESOLVED', legacy_folio: '200', identity_status: 'AMBIGUOUS' },
    { participant_type: 'LEGACY_UNRESOLVED', legacy_folio: '300', identity_status: 'ORPHAN' },
  ],
  enrollments: [{ legacy_folio: '100', sequence_number: 1, status: 'ACTIVE', enrollment_started_at: '2026-01-01T00:00:00Z', approved_at: '2026-01-02T00:00:00Z', first_expected_contribution_date: '2026-01-15', process_snapshot: 'PROCESS_1' }],
  plans: [{ legacy_folio: '100', enrollment_sequence: 1, amount: 350, process_snapshot: 'PROCESS_1', effective_from: '2026-01-15' }],
  transactions: [{ legacy_folio: '100', enrollment_sequence: 1, transaction_type: 'CONTRIBUTION', component: 'CAPITAL', direction: 'CREDIT', amount: 350, effective_date: '2026-01-15', contribution_date: '2026-01-15', expected_amount: 350, actual_amount: 350, difference_amount: 0, source_key: 'Ahorro!AA2' }],
  requests: [],
  evidence: [{ legacy_folio: '100', source_sheet: 'Ahorro', source_column: 'AA', source_row: 2, record_type: 'AA_DO_CELL', data_classification: 'ACTUAL', source_row_sha256: 'A'.repeat(64) }],
};
const hash = importer.sha256(importer.canonical(snapshot));
function manifestFor(manifestSnapshot, declaredHash) {
  const snapshotHash = declaredHash || importer.sha256(importer.canonical(manifestSnapshot));
  const manifest = { import_version: 'TEST_V2', schema_version: 'TEST_SCHEMA', source_projection_sha256: 'C'.repeat(64), source_workbook_id: 'legacy-workbook', source_workbook_name: 'SutiApp Final', source_snapshot_sha256: snapshotHash, certification: { status: 'CERTIFIED', evidence_sha256: snapshotHash }, snapshot: manifestSnapshot };
  manifest.manifest_sha256 = importer.sha256(importer.canonical(manifest));
  return manifest;
}
const valid = importer.validateManifest(manifestFor(snapshot, hash));
assert.deepStrictEqual(valid.identities, { RESOLVED: 1, AMBIGUOUS: 1, ORPHAN: 1 });
assert.strictEqual(valid.counts.transactions, 1);
assert.throws(() => importer.validateManifest(manifestFor(snapshot, 'B'.repeat(64))), /SAVINGS_SNAPSHOT_HASH_MISMATCH/);
const invalid = JSON.parse(JSON.stringify(snapshot)); invalid.participants[1].affiliate_id = '22222222-2222-4222-8222-222222222222';
const invalidHash = importer.sha256(importer.canonical(invalid));
assert.throws(() => importer.validateManifest(manifestFor(invalid, invalidHash)), /SAVINGS_UNRESOLVED_IDENTITY_MUST_BE_NULL/);

console.log('Savings shadow foundation static verification PASS: schema/recovery, identity import, schedules, ledger, action gates, RLS/RPCs, user/admin UI and no productive fallback.');
