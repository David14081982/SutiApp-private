#!/usr/bin/env node
'use strict';

/* Build the authorized RAW Savings SHADOW import from the private certified
   baseline. This script is local-only: it performs no Google/Supabase calls. */

const fs = require('fs');
const path = require('path');
const { canonical, sha256 } = require('./import-savings-shadow.js');

const EXPECTED_BASELINE_SHA256 = '3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1';
const EXPECTED_FINANCIAL_CAPTURE_SHA256 = 'AF10C2D8FC591E430AA70EE9BBBD8BFF9DC1236FF298CEBF93D76874FD3821D6';
const VERSION = 'SAVINGS_RAW_SHADOW_IMPORT_V3';
const SCHEMA_VERSION = '20260902000100';
const DEFAULT_BASELINE = path.join('tmp', 'savings-current-baseline-20260902', 'manifest.json');
const DEFAULT_IDENTITY = path.join('tmp', 'savings-current-baseline-20260902', 'supabase-after.json');
const DEFAULT_OUTPUT = path.join('tmp', 'savings-raw-shadow-import-20260902', 'manifest.json');
const PROCESS_VALUES = new Set(['JUB', 'PROCESS_1', 'PROCESS_3']);

function assert(condition, code, details) {
  if (!condition) {
    const error = new Error(code + (details ? ': ' + details : ''));
    error.code = code;
    throw error;
  }
}

function parseArgs(argv) {
  const args = { baseline: DEFAULT_BASELINE, identity: DEFAULT_IDENTITY, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--baseline') args.baseline = argv[++index];
    else if (value === '--identity') args.identity = argv[++index];
    else if (value === '--output') args.output = argv[++index];
    else throw new Error('USAGE: node scripts/build-savings-raw-shadow-import.js [--baseline file] [--identity file] [--output file]');
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function column(index) {
  let result = '';
  for (let cursor = index + 1; cursor > 0; cursor = Math.floor((cursor - 1) / 26)) {
    result = String.fromCharCode(65 + ((cursor - 1) % 26)) + result;
  }
  return result;
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round((value + Number.EPSILON) * 100) / 100;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : null;
}

function dateOrNull(value) {
  const raw = text(value);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
}

function hashObject(value) {
  return sha256(canonical(value));
}

function indexBySchema(schema) {
  return Object.fromEntries(schema.map((name, index) => [name, index]));
}

function rowObject(schema, values) {
  return Object.fromEntries(schema.map((name, index) => [name, values[index] == null ? null : values[index]]));
}

function verifyBaseline(baseline) {
  const declared = text(baseline.manifest_sha256).toUpperCase();
  const withoutHash = { ...baseline };
  delete withoutHash.manifest_sha256;
  const actual = hashObject(withoutHash);
  assert(declared === EXPECTED_BASELINE_SHA256, 'SAVINGS_BASELINE_DECLARED_SHA_MISMATCH', declared);
  assert(actual === EXPECTED_BASELINE_SHA256, 'SAVINGS_BASELINE_CONTENT_SHA_MISMATCH', actual);
  assert(baseline.classification === 'PRIVATE_FINANCIAL_PII_BASELINE', 'SAVINGS_BASELINE_CLASSIFICATION_INVALID');
  assert(baseline.authority === 'GOOGLE_SHEETS_CURRENT_DERIVED_EVIDENCE_ONLY', 'SAVINGS_BASELINE_AUTHORITY_INVALID');
  assert(baseline.consistency && baseline.consistency.consistent === true && baseline.consistency.financial_scope_identical === true, 'SAVINGS_BASELINE_NOT_REPRODUCIBLE');
  assert(text(baseline.consistency.run_1).toUpperCase() === EXPECTED_FINANCIAL_CAPTURE_SHA256 && text(baseline.consistency.run_2).toUpperCase() === EXPECTED_FINANCIAL_CAPTURE_SHA256, 'SAVINGS_FINANCIAL_CAPTURE_SHA_MISMATCH');
  assert(baseline.counts && baseline.counts.ahorro_rows === 364 && baseline.counts.financial_history_records === 33852 && baseline.counts.historical_yield_records === 1092 && baseline.counts.operational_row_hashes === 5465, 'SAVINGS_BASELINE_COUNTS_INVALID');
  assert(Array.isArray(baseline.ahorro) && Array.isArray(baseline.history) && Array.isArray(baseline.historical_yields) && Array.isArray(baseline.classifications), 'SAVINGS_BASELINE_ARRAYS_REQUIRED');
}

function verifyIdentitySnapshot(identity) {
  assert(identity && identity.version === 'SAVINGS_BASELINE_AFFILIATE_IDENTITY_V2_STRICT_COLUMNS', 'SAVINGS_IDENTITY_SNAPSHOT_VERSION_INVALID');
  assert(canonical(identity.selected_columns) === canonical(['id', 'numero_control']), 'SAVINGS_IDENTITY_COLUMNS_INVALID');
  assert(Array.isArray(identity.rows) && identity.rows.length === 947 && identity.writes === 0, 'SAVINGS_IDENTITY_SNAPSHOT_INVALID');
  assert(hashObject(identity.rows) === text(identity.rows_sha256).toUpperCase(), 'SAVINGS_IDENTITY_ROWS_SHA_MISMATCH');
}

function build(baseline, identity) {
  verifyBaseline(baseline);
  verifyIdentitySnapshot(identity);

  const classifications = new Map(baseline.classifications.map((item) => [text(item.legacy_folio), item]));
  const invalidFolios = new Set((baseline.identity.INVALID_TEST || []).map(text));
  const savingsByFolio = new Map(baseline.ahorro.map((item) => [text(item.legacy_folio), item]));
  const affiliatesByControl = new Map();
  identity.rows.forEach((item) => {
    const key = text(item.numero_control);
    if (!affiliatesByControl.has(key)) affiliatesByControl.set(key, []);
    affiliatesByControl.get(key).push(item);
  });

  const participants = [];
  for (const savings of baseline.ahorro) {
    const folio = text(savings.legacy_folio);
    if (invalidFolios.has(folio)) continue;
    const classification = classifications.get(folio);
    assert(classification, 'SAVINGS_CLASSIFICATION_MISSING', folio);
    const identityStatus = text(classification.identity_status).toUpperCase();
    const matches = affiliatesByControl.get(folio) || [];
    if (identityStatus === 'RESOLVED') assert(matches.length === 1, 'SAVINGS_RESOLVED_IDENTITY_NOT_EXACT', folio);
    if (identityStatus === 'AMBIGUOUS') assert(matches.length > 1, 'SAVINGS_AMBIGUOUS_IDENTITY_NOT_PROVEN', folio);
    if (identityStatus === 'ORPHAN') assert(matches.length === 0, 'SAVINGS_ORPHAN_IDENTITY_NOT_PROVEN', folio);
    assert(['RESOLVED', 'AMBIGUOUS', 'ORPHAN'].includes(identityStatus), 'SAVINGS_IDENTITY_STATUS_INVALID', folio);
    const processStatus = text(classification.process_status).toUpperCase();
    participants.push({
      participant_type: identityStatus === 'RESOLVED' ? 'AFFILIATE' : 'LEGACY_UNRESOLVED',
      affiliate_id: identityStatus === 'RESOLVED' ? matches[0].id : null,
      legacy_folio: folio,
      identity_status: identityStatus,
      current_process: PROCESS_VALUES.has(processStatus) ? processStatus : null,
      process_source: 'LEGACY',
      display_name: null,
      legacy_reported_balance: numberOrNull(savings.legacy_reported_balance),
    });
  }

  const evidence = [];
  function addEvidence(entry) {
    const item = {
      source_sheet: entry.source_sheet,
      source_column: entry.source_column,
      source_row: Number(entry.source_row),
      record_type: entry.record_type,
      data_classification: entry.data_classification,
      source_row_sha256: text(entry.source_row_sha256).toUpperCase(),
    };
    if (entry.legacy_folio) item.legacy_folio = entry.legacy_folio;
    if (entry.observed_on) item.observed_on = entry.observed_on;
    if (entry.numeric_value != null) item.numeric_value = numberOrNull(entry.numeric_value);
    if (entry.raw_payload && Object.keys(entry.raw_payload).length) item.raw_payload = entry.raw_payload;
    assert(item.source_row > 0 && /^[A-F0-9]{64}$/.test(item.source_row_sha256), 'SAVINGS_EVIDENCE_PROVENANCE_INVALID', `${item.source_sheet}:${item.source_row}:${item.source_column}`);
    evidence.push(item);
  }

  baseline.ahorro.forEach((savings) => {
    const folio = text(savings.legacy_folio);
    const classification = classifications.get(folio) || { identity_status: 'INVALID_TEST', process_status: 'INVALID', start_date_status: 'START_DATE_MISSING', start_date: null, process_evidence: [] };
    const common = {
      source_sheet: 'Ahorro', source_row: savings.source_row, legacy_folio: folio,
      source_row_sha256: savings.record_hash,
    };
    const rawClass = invalidFolios.has(folio) ? 'RAW_LEGACY' : 'LEGACY_SNAPSHOT';
    addEvidence({ ...common, source_column: 'A:Z', record_type: 'PARTICIPANT', data_classification: rawClass, raw_payload: {
      identity_status: classification.identity_status, invalid_test: invalidFolios.has(folio), process_status: classification.process_status,
      source_record_hash: savings.record_hash, canonical: false,
    } });
    addEvidence({ ...common, source_column: 'F:X', record_type: 'ENROLLMENT', data_classification: rawClass, observed_on: dateOrNull(classification.start_date), raw_payload: {
      start_date: classification.start_date || null, start_date_status: classification.start_date_status,
      status: savings.status || null, term: savings.term || null, process: savings.process || null,
      discount_start: savings.discount_start || null, savings_end: savings.savings_end || null, final_date: savings.final_date || null,
      canonical: false,
    } });
    addEvidence({ ...common, source_column: 'R:U', record_type: 'PLAN', data_classification: rawClass, observed_on: dateOrNull(savings.amount_change_date), numeric_value: savings.new_amount, raw_payload: {
      current_amount: savings.current_amount, new_amount: savings.new_amount, amount_change_date: savings.amount_change_date,
      amount_change_applied: savings.amount_change_applied, process_status: classification.process_status, canonical: false,
    } });
    addEvidence({ ...common, source_column: 'H:N', record_type: 'WITHDRAWAL', data_classification: rawClass, observed_on: dateOrNull(savings.full_withdrawal_date), raw_payload: {
      partial_withdrawals: savings.partial_withdrawals, full_withdrawal_stopped: savings.full_withdrawal_stopped,
      full_withdrawal_continues: savings.full_withdrawal_continues, withdrawal_category: savings.withdrawal_category,
      continues_saving: savings.continues_saving, withdrawal_status: savings.withdrawal_status, canonical: false,
    } });
    addEvidence({ ...common, source_column: 'Q', record_type: 'LEGACY_REPORTED_BALANCE', data_classification: 'LEGACY_SNAPSHOT', numeric_value: savings.legacy_reported_balance, raw_payload: {
      legacy_reported_balance: savings.legacy_reported_balance, canonical_balance: false, transaction: false,
    } });
  });

  const historyIndex = indexBySchema(baseline.history_schema);
  const historyDates = [];
  const historyDateSet = new Set();
  baseline.history.forEach((values) => {
    const date = text(values[historyIndex.date]);
    if (!historyDateSet.has(date)) { historyDateSet.add(date); historyDates.push(date); }
  });
  assert(historyDates.length === 93, 'SAVINGS_AA_DO_DATE_COUNT_INVALID', String(historyDates.length));
  const historyColumn = new Map(historyDates.map((date, index) => [date, column(26 + index)]));
  baseline.history.forEach((values) => {
    const row = rowObject(baseline.history_schema, values);
    const savings = savingsByFolio.get(text(row.legacy_folio));
    assert(savings, 'SAVINGS_AA_DO_FOLIO_MISSING', text(row.legacy_folio));
    addEvidence({
      source_sheet: 'Ahorro', source_column: historyColumn.get(text(row.date)), source_row: savings.source_row,
      legacy_folio: text(row.legacy_folio), observed_on: dateOrNull(row.date), numeric_value: row.value,
      record_type: 'AA_DO_CELL', data_classification: row.cell_kind === 'FORMULA' ? 'EXPECTED' : row.cell_kind === 'MANUAL' ? 'PENDING_REVIEW' : 'RAW_LEGACY',
      source_row_sha256: row.record_hash,
      raw_payload: { cell_kind: row.cell_kind },
    });
  });

  const yieldIndex = indexBySchema(baseline.yield_schema);
  const yieldPeriods = [];
  const yieldPeriodSet = new Set();
  baseline.historical_yields.forEach((values) => {
    const period = text(values[yieldIndex.period]);
    if (!yieldPeriodSet.has(period)) { yieldPeriodSet.add(period); yieldPeriods.push(period); }
  });
  assert(yieldPeriods.length === 3, 'SAVINGS_DP_DW_PERIOD_COUNT_INVALID', String(yieldPeriods.length));
  const yieldColumns = new Map(yieldPeriods.map((period, index) => [period, ['DP:DR', 'DS:DU', 'DV:DW'][index]]));
  baseline.historical_yields.forEach((values) => {
    const row = rowObject(baseline.yield_schema, values);
    const savings = savingsByFolio.get(text(row.legacy_folio));
    assert(savings, 'SAVINGS_DP_DW_FOLIO_MISSING', text(row.legacy_folio));
    addEvidence({
      source_sheet: 'Ahorro', source_column: yieldColumns.get(text(row.period)), source_row: savings.source_row,
      legacy_folio: text(row.legacy_folio), record_type: 'DP_DW_CELL', data_classification: 'LEGACY_SNAPSHOT',
      source_row_sha256: row.record_hash,
      raw_payload: {
        period: row.period, capital: row.capital, capital_cell_kind: row.capital_cell_kind,
        yield: row.yield, yield_cell_kind: row.yield_cell_kind, subtotal: row.subtotal,
        subtotal_cell_kind: row.subtotal_cell_kind,
      },
    });
  });

  const operationalTypes = {
    'Ingreso ahorro': 'REQUEST', 'Solicitud de Ahorro': 'REQUEST', 'Solicitud Cambio ahorro': 'AMOUNT_CHANGE',
    'Solicitud de retiro': 'WITHDRAWAL', 'Saldo manual': 'LEGACY_REPORTED_BALANCE',
    'Reporte Ahorro': 'REPORT', 'Reporte - RH': 'REPORT', Conciliacion: 'REPORT',
  };
  const operationalCounts = {};
  Object.entries(baseline.operational).forEach(([sheet, capture]) => {
    assert(Array.isArray(capture.rows) && Array.isArray(capture.row_schema) && Array.isArray(capture.header), 'SAVINGS_OPERATIONAL_CAPTURE_INVALID', sheet);
    const rowIndex = indexBySchema(capture.row_schema);
    operationalCounts[sheet] = capture.rows.length;
    capture.rows.forEach((values) => {
      const sourceRow = Number(values[rowIndex.source_row]);
      const folio = text(values[rowIndex.legacy_folio]) || null;
      const capturedValues = values[rowIndex.values];
      const recordHash = values[rowIndex.row_hash];
      assert(Array.isArray(capturedValues) && capturedValues.length === capture.header.length, 'SAVINGS_OPERATIONAL_ROW_WIDTH_INVALID', `${sheet}:${sourceRow}`);
      const amountIndex = capture.header.findIndex((header) => /monto|saldo/i.test(text(header)));
      const dateIndex = capture.header.findIndex((header) => /fecha/i.test(text(header)));
      addEvidence({
        source_sheet: sheet, source_column: `A:${column(capture.header.length - 1)}`, source_row: sourceRow,
        legacy_folio: folio, observed_on: dateIndex >= 0 ? dateOrNull(capturedValues[dateIndex]) : null,
        numeric_value: amountIndex >= 0 ? numberOrNull(capturedValues[amountIndex]) : null,
        record_type: operationalTypes[sheet], data_classification: sheet.startsWith('Reporte') ? 'LEGACY_SNAPSHOT' : 'RAW_LEGACY',
        source_row_sha256: recordHash,
        raw_payload: { values: capturedValues },
      });
    });
  });

  const exactCounts = {
    participants: participants.length, enrollments: 0, plans: 0, transactions: 0, requests: 0, evidence: evidence.length,
  };
  const logicalCounts = {
    ahorro_rows: baseline.ahorro.length,
    ahorro_evidence_records: baseline.ahorro.length * 5,
    aa_do_cells: baseline.history.length,
    dp_dw_records: baseline.historical_yields.length,
    operational_rows: Object.values(operationalCounts).reduce((sum, value) => sum + value, 0),
    operational_by_sheet: operationalCounts,
    reporte_ahorro_rows: baseline.operational['Reporte Ahorro'].rows.length,
    reporte_ahorro_folios: baseline.operational['Reporte Ahorro'].exact_folio_set.length,
    reporte_rh_rows: baseline.operational['Reporte - RH'].rows.length,
    reporte_rh_folios: baseline.operational['Reporte - RH'].exact_folio_set.length,
    invalid_test_raw_only: invalidFolios.size,
  };
  assert(canonical(exactCounts) === canonical({ participants: 363, enrollments: 0, plans: 0, transactions: 0, requests: 0, evidence: 42229 }), 'SAVINGS_IMPORT_EXACT_COUNTS_INVALID', canonical(exactCounts));
  assert(logicalCounts.reporte_ahorro_rows === 4049 && logicalCounts.reporte_ahorro_folios === 317 && logicalCounts.reporte_rh_rows === 320 && logicalCounts.reporte_rh_folios === 320, 'SAVINGS_REPORT_COUNTS_INVALID');
  assert(logicalCounts.invalid_test_raw_only === 1, 'SAVINGS_INVALID_TEST_COUNT_INVALID');

  const snapshot = { participants, enrollments: [], plans: [], transactions: [], requests: [], evidence };
  const payloadSha256 = hashObject(snapshot);
  const manifest = {
    import_version: VERSION,
    schema_version: SCHEMA_VERSION,
    source_workbook_id: baseline.source.workbook_id,
    source_workbook_name: baseline.source.workbook_name,
    source_baseline_manifest_sha256: EXPECTED_BASELINE_SHA256,
    source_snapshot_sha256: EXPECTED_BASELINE_SHA256,
    source_projection_sha256: EXPECTED_FINANCIAL_CAPTURE_SHA256,
    payload_sha256: payloadSha256,
    certification: { status: 'CERTIFIED', evidence_sha256: EXPECTED_BASELINE_SHA256 },
    authority: 'SHADOW',
    cutover_status: 'NOT_CUTOVER',
    ready_for_owner_review: true,
    ready_for_apply: true,
    source_changed_since_forensic_audit: true,
    exact_counts: exactCounts,
    logical_counts: logicalCounts,
    identity_counts: { RESOLVED: 356, AMBIGUOUS: 5, ORPHAN: 2, INVALID_TEST_RAW_ONLY: 1 },
    financial_guards: {
      google_authority_unchanged: true, google_writes: 0, canonical_transactions: 0,
      yield_credits: 0, productive_yields_enabled: false, cutover: false, user_actions_enabled: false,
      q_is_legacy_reported_balance_only: true,
    },
    provenance: {
      import_version: VERSION, schema_version: SCHEMA_VERSION,
      baseline_manifest_sha256: EXPECTED_BASELINE_SHA256, payload_sha256: payloadSha256,
      financial_capture_sha256: EXPECTED_FINANCIAL_CAPTURE_SHA256,
      source_authority: 'GOOGLE_SHEETS', destination_authority: 'SHADOW_ONLY', cutover: false,
      invalid_test_policy: 'RAW_EVIDENCE_ONLY_NO_PARTICIPANT', unresolved_identity_policy: 'NO_AUTOMATIC_RESOLUTION',
      canonical_transactions_created: 0, yield_credits_created: 0,
      report_folio_sets: {
        reporte_ahorro: baseline.operational['Reporte Ahorro'].exact_folio_set,
        reporte_rh: baseline.operational['Reporte - RH'].exact_folio_set,
      },
      report_folio_set_sha256: {
        reporte_ahorro: hashObject(baseline.operational['Reporte Ahorro'].exact_folio_set),
        reporte_rh: hashObject(baseline.operational['Reporte - RH'].exact_folio_set),
      },
      operational_schemas: Object.fromEntries(Object.entries(baseline.operational).map(([sheet, capture]) => [sheet, {
        header: capture.header, header_sha256: capture.header_hash, row_schema: capture.row_schema,
      }])),
    },
    snapshot,
  };
  manifest.manifest_sha256 = hashObject(manifest);
  return manifest;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = build(readJson(args.baseline), readJson(args.identity));
  const output = path.resolve(args.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(manifest) + '\n', { mode: 0o600 });
  const result = {
    status: 'BUILT', output, manifest_sha256: manifest.manifest_sha256,
    source_baseline_manifest_sha256: manifest.source_baseline_manifest_sha256,
    payload_sha256: manifest.payload_sha256, exact_counts: manifest.exact_counts,
    logical_counts: manifest.logical_counts, identity_counts: manifest.identity_counts,
    writes: { google: 0, supabase: 0 }, cutover: false,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { build, EXPECTED_BASELINE_SHA256, EXPECTED_FINANCIAL_CAPTURE_SHA256 };
