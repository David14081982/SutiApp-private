#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const BASELINE_SHA256 = '3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1';
const TABLES = [
  'savings_import_batches', 'savings_participants', 'savings_enrollments', 'savings_contribution_plans',
  'savings_contribution_overrides', 'savings_transactions', 'savings_action_availability',
  'savings_beneficiary_versions', 'savings_beneficiaries', 'savings_requests', 'savings_request_approvals',
  'savings_holds', 'savings_yield_periods', 'savings_yield_allocations', 'savings_process_change_events',
  'savings_legacy_evidence', 'savings_audit_events',
];

function environment() {
  const values = {};
  for (const line of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

async function management(values, query) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'SutiApp-SavingsRawShadowVerifier/1.0' },
    body: JSON.stringify({ query }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`MANAGEMENT_SQL_${response.status}:${JSON.stringify(data).slice(0, 1200)}`);
  return data;
}

function countSql() {
  return TABLES.map((table) => `select '${table}' table_name,count(*)::int row_count from public.${table}`).join(' union all ');
}

async function structuralState(values) {
  const structure = await management(values, `
    select c.relname table_name,c.relrowsecurity rls,c.relforcerowsecurity force_rls,
      has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon_direct,
      has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') authenticated_direct,
      has_table_privilege('service_role',c.oid,'SELECT') service_select,
      has_table_privilege('service_role',c.oid,'INSERT') service_insert,
      has_table_privilege('service_role',c.oid,'UPDATE') service_update,
      has_table_privilege('service_role',c.oid,'DELETE') service_delete
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any(array[${TABLES.map((table) => `'${table}'`).join(',')}])
    order by c.relname;
  `);
  const functions = await management(values, `
    select
      to_regprocedure('public.import_savings_shadow_manifest(jsonb,boolean)') is not null importer_exists,
      has_function_privilege('service_role','public.import_savings_shadow_manifest(jsonb,boolean)','execute') importer_service_role,
      has_function_privilege('authenticated','public.import_savings_shadow_manifest(jsonb,boolean)','execute') importer_authenticated,
      has_function_privilege('anon','public.import_savings_shadow_manifest(jsonb,boolean)','execute') importer_anon,
      encode(digest(pg_get_functiondef('public.import_savings_shadow_manifest(jsonb,boolean)'::regprocedure),'sha256'),'hex') importer_definition_sha256,
      position('auth.role()<>''service_role''' in replace(pg_get_functiondef('public.import_savings_shadow_manifest(jsonb,boolean)'::regprocedure),' ',''))>0 importer_role_guard,
      position('if not p_apply then' in lower(pg_get_functiondef('public.import_savings_shadow_manifest(jsonb,boolean)'::regprocedure)))>0 importer_dry_run_guard;
  `);
  const counts = await management(values, countSql());
  return { structure, functions: functions[0], counts: Object.fromEntries(counts.map((row) => [row.table_name, Number(row.row_count)])) };
}

function verifyStructure(state) {
  assert.strictEqual(state.structure.length, TABLES.length, 'Not all 17 savings tables exist');
  state.structure.forEach((row) => {
    assert.strictEqual(row.rls, true, `${row.table_name}: RLS disabled`);
    assert.strictEqual(row.force_rls, true, `${row.table_name}: FORCE RLS disabled`);
    assert.strictEqual(row.anon_direct, false, `${row.table_name}: anon direct DML exposed`);
    assert.strictEqual(row.authenticated_direct, false, `${row.table_name}: authenticated direct DML exposed`);
  });
  ['savings_import_batches', 'savings_participants', 'savings_legacy_evidence', 'savings_audit_events'].forEach((table) => {
    const row = state.structure.find((item) => item.table_name === table);
    assert(row && row.service_select && row.service_insert, `${table}: service_role import privileges missing`);
  });
  assert.strictEqual(state.functions.importer_exists, true, 'Importer RPC missing');
  assert.strictEqual(state.functions.importer_service_role, true, 'Importer RPC not granted to service_role');
  assert.strictEqual(state.functions.importer_authenticated, false, 'Importer RPC exposed to authenticated');
  assert.strictEqual(state.functions.importer_anon, false, 'Importer RPC exposed to anon');
  assert.strictEqual(state.functions.importer_role_guard, true, 'Importer RPC role guard missing');
  assert.strictEqual(state.functions.importer_dry_run_guard, true, 'Importer RPC dry-run guard missing');
}

async function preflight(values) {
  const state = await structuralState(values);
  verifyStructure(state);
  TABLES.forEach((table) => assert.strictEqual(state.counts[table], 0, `${table}: expected zero-state`));
  return {
    status: 'PASS', mode: 'PREFLIGHT_READ_ONLY', tables: TABLES.length,
    zero_state: true, counts: state.counts, rls_force_all: true, browser_direct_dml: false,
    importer: state.functions, baseline_sha256: BASELINE_SHA256,
    writes: { google: 0, supabase: 0 }, cutover: false,
  };
}

async function postflight(values) {
  const state = await structuralState(values);
  verifyStructure(state);
  const expectedCounts = Object.fromEntries(TABLES.map((table) => [table, 0]));
  Object.assign(expectedCounts, { savings_import_batches: 1, savings_participants: 363, savings_legacy_evidence: 42229, savings_audit_events: 1 });
  assert.deepStrictEqual(state.counts, expectedCounts, 'Savings table counts differ from the authorized batch');

  const batchRows = await management(values, `
    select id,source_snapshot_sha256,certification_status,status,row_counts,provenance,finished_at is not null finished
    from public.savings_import_batches where source_snapshot_sha256='${BASELINE_SHA256}';
  `);
  assert.strictEqual(batchRows.length, 1, 'Authorized import batch missing or duplicated');
  const batch = batchRows[0];
  assert.strictEqual(batch.certification_status, 'CERTIFIED');
  assert.strictEqual(batch.status, 'APPLIED');
  assert.strictEqual(batch.finished, true);
  assert.deepStrictEqual(batch.row_counts, { participants: 363, enrollments: 0, plans: 0, transactions: 0, requests: 0, evidence: 42229 });
  assert.strictEqual(String(batch.provenance.baseline_manifest_sha256).toUpperCase(), BASELINE_SHA256);
  assert.strictEqual(String(batch.provenance.destination_authority), 'SHADOW_ONLY');
  assert.strictEqual(batch.provenance.cutover, false);
  assert.strictEqual(batch.provenance.canonical_transactions_created, 0);
  assert.strictEqual(batch.provenance.yield_credits_created, 0);

  const identity = (await management(values, `
    select identity_status,certification_status,count(*)::int count,count(affiliate_id)::int linked
    from public.savings_participants group by identity_status,certification_status order by identity_status,certification_status;
  `));
  assert.deepStrictEqual(identity, [
    { identity_status: 'AMBIGUOUS', certification_status: 'PENDING_REVIEW', count: 5, linked: 0 },
    { identity_status: 'ORPHAN', certification_status: 'PENDING_REVIEW', count: 2, linked: 0 },
    { identity_status: 'RESOLVED', certification_status: 'PENDING_REVIEW', count: 356, linked: 356 },
  ]);

  const evidence = await management(values, `
    select source_sheet,record_type,count(*)::int row_count,count(distinct legacy_folio)::int folio_count,
      count(*) filter(where source_row_sha256!~'^[A-F0-9]{64}$')::int invalid_hashes
    from public.savings_legacy_evidence
    where import_batch_id='${batch.id}'::uuid
    group by source_sheet,record_type order by source_sheet,record_type;
  `);
  const find = (sheet, type) => evidence.find((row) => row.source_sheet === sheet && row.record_type === type);
  assert.strictEqual(find('Ahorro', 'AA_DO_CELL').row_count, 33852);
  assert.strictEqual(find('Ahorro', 'DP_DW_CELL').row_count, 1092);
  assert.strictEqual(find('Ahorro', 'PARTICIPANT').row_count, 364);
  assert.strictEqual(find('Ahorro', 'ENROLLMENT').row_count, 364);
  assert.strictEqual(find('Ahorro', 'PLAN').row_count, 364);
  assert.strictEqual(find('Ahorro', 'WITHDRAWAL').row_count, 364);
  assert.strictEqual(find('Ahorro', 'LEGACY_REPORTED_BALANCE').row_count, 364);
  assert.strictEqual(find('Reporte Ahorro', 'REPORT').row_count, 4049);
  assert.strictEqual(find('Reporte Ahorro', 'REPORT').folio_count, 317);
  assert.strictEqual(find('Reporte - RH', 'REPORT').row_count, 320);
  assert.strictEqual(find('Reporte - RH', 'REPORT').folio_count, 320);
  assert.strictEqual(evidence.reduce((sum, row) => sum + row.invalid_hashes, 0), 0);

  const invariants = (await management(values, `
    select
      (select count(*)::int from public.savings_participants where legacy_folio='1234009') invalid_test_participants,
      (select count(*)::int from public.savings_legacy_evidence where import_batch_id='${batch.id}'::uuid and legacy_folio='1234009') invalid_test_evidence,
      (select count(*)::int from public.savings_legacy_evidence where import_batch_id='${batch.id}'::uuid and record_type='LEGACY_REPORTED_BALANCE') legacy_reported_balance_evidence,
      (select count(*)::int from public.savings_transactions) canonical_transactions,
      (select count(*)::int from public.savings_transactions where transaction_type='YIELD_CREDIT') yield_credits,
      (select count(*)::int from public.savings_yield_periods where productive_enabled) productive_yields,
      (select count(*)::int from public.savings_action_availability where enabled) enabled_actions,
      (select count(*)::int from public.savings_participants where certification_status='CERTIFIED') user_certified_participants,
      (select count(*)::int from (
        select import_batch_id,source_sheet,source_column,source_row,record_type,count(*)
        from public.savings_legacy_evidence group by 1,2,3,4,5 having count(*)>1
      ) d) evidence_duplicate_keys;
  `))[0];
  assert.strictEqual(invariants.invalid_test_participants, 0);
  assert(invariants.invalid_test_evidence > 0, 'Invalid test Folio lacks RAW evidence');
  assert.strictEqual(invariants.legacy_reported_balance_evidence, 365);
  assert.strictEqual(invariants.canonical_transactions, 0);
  assert.strictEqual(invariants.yield_credits, 0);
  assert.strictEqual(invariants.productive_yields, 0);
  assert.strictEqual(invariants.enabled_actions, 0);
  assert.strictEqual(invariants.user_certified_participants, 0);
  assert.strictEqual(invariants.evidence_duplicate_keys, 0);

  return {
    status: 'PASS', mode: 'POSTFLIGHT_READ_ONLY', batch_id: batch.id,
    baseline_sha256: BASELINE_SHA256, payload_sha256: batch.provenance.payload_sha256,
    counts: state.counts, identities: identity, evidence_groups: evidence,
    invariants, rls_force_all: true, browser_direct_dml: false,
    authority: 'SHADOW_ONLY', google_authority_unchanged: true, cutover: false,
  };
}

async function main() {
  const values = environment();
  assert(values.SUPABASE_URL && values.SUPABASE_ACCESS_TOKEN, 'Supabase management configuration missing');
  const mode = process.argv.includes('--postflight') ? 'postflight' : 'preflight';
  const result = mode === 'postflight' ? await postflight(values) : await preflight(values);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
