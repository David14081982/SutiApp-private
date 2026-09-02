#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSION = 'SAVINGS_FINANCIAL_CAPTURE_V1';
const MANIFEST_VERSION = 'SAVINGS_CURRENT_BASELINE_20260902_V2_FINANCIAL';
const WORKBOOK_ID = '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
const SHEET_IDS = {
  'Ingreso ahorro': 905910424,
  'Solicitud de Ahorro': 2131954019,
  Ahorro: 1410914017,
  'Solicitud Cambio ahorro': 66971095,
  'Solicitud de retiro': 959676992,
  'Saldo manual': 1851838534,
  'Reporte Ahorro': 1476609535,
  'Reporte - RH': 1432694647,
  Conciliacion: 1765882685,
};
const OPERATIONAL = [
  ['Ingreso ahorro', 0], ['Solicitud de Ahorro', 0], ['Solicitud Cambio ahorro', 0],
  ['Solicitud de retiro', 0], ['Saldo manual', 0], ['Reporte Ahorro', 0],
  ['Reporte - RH', 2], ['Conciliacion', 2],
];

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex').toUpperCase(); }
function assert(value, code, details = '') { if (!value) throw new Error(`${code}${details ? `: ${details}` : ''}`); }
function privateWrite(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) {}
}
function normalizeFolio(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(?:\.0+)?$/.test(text)) return String(Math.trunc(Number(text)));
  return text;
}
function googleDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000).toISOString().slice(0, 10);
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
  return null;
}
function stableFolios(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })); }
function at(matrix, row, column) { return matrix[row]?.[column] || [null, 'EMPTY']; }
function descriptor(matrix, row, column) {
  const [value, cellKind] = at(matrix, row, column);
  const core = { value: value === undefined ? null : value, cell_kind: cellKind };
  return { ...core, hash: sha256(core) };
}
function material(values) { return values.some((value) => value != null && String(value).trim() !== ''); }
function rowHash(sheet, rowNumber, values) { return sha256({ sheet, row_number: rowNumber, values }); }
function normalizeProcess(value) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if (!raw) return null;
  if (raw === 'JUB' || raw.includes('JUBIL')) return 'JUB';
  if (['1', 'PROCESS_1', 'PROCESO_1'].includes(raw)) return 'PROCESS_1';
  if (['3', 'PROCESS_3', 'PROCESO_3'].includes(raw)) return 'PROCESS_3';
  return 'INVALID';
}
function mapRows(values, sheet, folioColumn) {
  const header = values[0] || [];
  const rows = [];
  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] || [];
    if (!material(row)) continue;
    const normalized = row.map((value) => value === undefined ? null : value);
    rows.push([index + 1, normalizeFolio(row[folioColumn]), normalized, rowHash(sheet, index + 1, normalized)]);
  }
  const folios = rows.map((row) => row[1]).filter(Boolean);
  const frequency = {};
  folios.forEach((folio) => { frequency[folio] = (frequency[folio] || 0) + 1; });
  return {
    sheet_id: SHEET_IDS[sheet],
    header,
    header_hash: rowHash(sheet, 1, header),
    row_schema: ['source_row', 'legacy_folio', 'values', 'row_hash'],
    rows,
    row_count: rows.length,
    exact_folio_set: stableFolios(folios),
    folio_frequency: Object.fromEntries(Object.entries(frequency).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))),
  };
}

function assemble(rawFile, outputFile) {
  const raw = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
  assert(raw.version === VERSION, 'FINANCIAL_RAW_CAPTURE_VERSION_INVALID');
  const coreMatrix = raw.ranges.ahorro_core;
  const historyMatrix = raw.ranges.ahorro_history;
  const yieldMatrix = raw.ranges.ahorro_yield;
  assert(Array.isArray(coreMatrix) && Array.isArray(historyMatrix) && Array.isArray(yieldMatrix), 'AHORRO_FINANCIAL_RANGES_MISSING');
  const operational = {};
  OPERATIONAL.forEach(([sheet, folioColumn]) => {
    assert(Array.isArray(raw.ranges[sheet]), 'OPERATIONAL_RANGE_MISSING', sheet);
    operational[sheet] = mapRows(raw.ranges[sheet], sheet, folioColumn);
  });

  const ahorro = [];
  const history = [];
  const historicalYields = [];
  const historyDates = Array.from({ length: 93 }, (_, column) => googleDate(at(historyMatrix, 0, column)[0]));
  assert(historyDates.every(Boolean), 'HISTORY_DATE_HEADER_INVALID');
  const yieldHeaders = Array.from({ length: 8 }, (_, column) => at(yieldMatrix, 0, column)[0]);
  for (let row = 1; row < Math.max(coreMatrix.length, historyMatrix.length, yieldMatrix.length); row += 1) {
    const folio = normalizeFolio(at(coreMatrix, row, 0)[0]);
    if (!folio) continue;
    const fields = {
      legacy_folio: folio,
      email: at(coreMatrix, row, 1)[0] ?? null,
      legacy_name: at(coreMatrix, row, 2)[0] ?? null,
      process: descriptor(coreMatrix, row, 3),
      transactions: descriptor(coreMatrix, row, 4),
      first_discount: descriptor(coreMatrix, row, 5),
      accumulated_savings: descriptor(coreMatrix, row, 6),
      partial_withdrawals: descriptor(coreMatrix, row, 7),
      full_withdrawal_stopped: descriptor(coreMatrix, row, 8),
      full_withdrawal_continues: descriptor(coreMatrix, row, 9),
      withdrawal_category: descriptor(coreMatrix, row, 10),
      continues_saving: descriptor(coreMatrix, row, 11),
      full_withdrawal_date: descriptor(coreMatrix, row, 12),
      withdrawal_status: descriptor(coreMatrix, row, 13),
      manual_balance: descriptor(coreMatrix, row, 14),
      balance_with_withdrawals: descriptor(coreMatrix, row, 15),
      legacy_reported_balance: descriptor(coreMatrix, row, 16),
      current_amount: descriptor(coreMatrix, row, 17),
      new_amount: descriptor(coreMatrix, row, 18),
      amount_change_date: descriptor(coreMatrix, row, 19),
      amount_change_applied: descriptor(coreMatrix, row, 20),
      term: descriptor(coreMatrix, row, 21),
      status: descriptor(coreMatrix, row, 22),
      discount_start: descriptor(coreMatrix, row, 23),
      savings_end: descriptor(coreMatrix, row, 24),
      final_date: descriptor(coreMatrix, row, 25),
    };
    const recordCore = { source_row: row + 1, ...fields };
    ahorro.push({ ...recordCore, record_hash: sha256(recordCore) });
    for (let column = 0; column < 93; column += 1) {
      const item = descriptor(historyMatrix, row, column);
      const historyCore = [folio, historyDates[column], item.value, item.cell_kind];
      history.push([...historyCore, sha256(historyCore)]);
    }
    const groups = [
      ['2025', 0, 1, 2],
      ['2026', 3, 4, 5],
      ['CUMULATIVE_2025_2026', 6, 7, null],
    ];
    groups.forEach(([period, capitalColumn, yieldColumn, subtotalColumn]) => {
      const capital = descriptor(yieldMatrix, row, capitalColumn);
      const yieldValue = descriptor(yieldMatrix, row, yieldColumn);
      const subtotal = subtotalColumn == null ? { value: null, cell_kind: 'EMPTY', hash: sha256({ value: null, cell_kind: 'EMPTY' }) } : descriptor(yieldMatrix, row, subtotalColumn);
      const yieldCore = [folio, period, capital.value, capital.cell_kind, yieldValue.value, yieldValue.cell_kind, subtotal.value, subtotal.cell_kind];
      historicalYields.push([...yieldCore, sha256(yieldCore)]);
    });
  }
  const overlapCore = ahorro.map((row) => row.record_hash).concat(history.filter((row) => row[1] <= '2027-04-05').map((row) => row[4]));
  const logicalCore = {
    workbook_id: WORKBOOK_ID,
    sheets: Object.keys(SHEET_IDS),
    ahorro,
    history_schema: ['legacy_folio', 'date', 'value', 'cell_kind', 'record_hash'],
    history,
    yield_headers: yieldHeaders,
    yield_schema: ['legacy_folio', 'period', 'capital', 'capital_cell_kind', 'yield', 'yield_cell_kind', 'subtotal', 'subtotal_cell_kind', 'record_hash'],
    historical_yields: historicalYields,
    operational,
  };
  const capture = {
    version: VERSION,
    captured_at: raw.captured_at,
    metadata: raw.metadata,
    reuse_overlap_sha256: sha256(overlapCore),
    ...logicalCore,
    logical_sha256: sha256(logicalCore),
  };
  privateWrite(outputFile, capture);
  console.log(JSON.stringify({ status: 'PASS', mode: 'ASSEMBLE_FINANCIAL_CAPTURE', logical_sha256: capture.logical_sha256, ahorro_rows: ahorro.length, history_records: history.length, yield_records: historicalYields.length, operational_rows: Object.values(operational).reduce((sum, item) => sum + item.row_count, 0), formula_text_stored: 0, external_writes: 0 }));
}

function decodeScalar(value) {
  if (!value) return null;
  if (value[0] === 'e') return value[1];
  return value[1];
}
function decodeCompactCell(cell) {
  if (!cell) return [null, 'EMPTY'];
  const value = decodeScalar(cell[1]);
  const entered = cell[2];
  return [value, entered?.[0] === 'f' ? 'FORMULA' : entered ? 'MANUAL' : 'EMPTY'];
}
function reuse(chunkDir, outputFile) {
  const matrix = [];
  let sourceBytes = 0;
  const sourceFiles = [];
  for (let index = 3; index <= 11; index += 1) {
    const file = path.join(chunkDir, `chunk-${String(index).padStart(2, '0')}.json`);
    assert(fs.existsSync(file), 'REUSE_CHUNK_MISSING', path.basename(file));
    const stat = fs.statSync(file); sourceBytes += stat.size; sourceFiles.push(path.basename(file));
    const wrapper = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert(wrapper.data?.compact_cell_data_v1, 'REUSE_CHUNK_NOT_COMPACT', path.basename(file));
    const startColumn = (() => { let n = 0; for (const c of wrapper.capture.start_column) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; })();
    wrapper.data.sheet.blocks.forEach((block) => (block.rows || []).forEach((row, offset) => {
      const rowIndex = (block.startRow || 0) + offset;
      if (!matrix[rowIndex]) matrix[rowIndex] = [];
      row.forEach((cell, column) => { matrix[rowIndex][startColumn + column] = decodeCompactCell(cell); });
    }));
  }
  const hashes = [];
  for (let row = 1; row < matrix.length; row += 1) {
    const folio = normalizeFolio(at(matrix, row, 0)[0]);
    if (!folio) continue;
    const core = Array.from({ length: 26 }, (_, column) => at(matrix, row, column));
    hashes.push(sha256([folio, 'CORE_A_Z', core]));
    for (let column = 26; column <= 71; column += 1) hashes.push(sha256([folio, column, ...at(matrix, row, column)]));
  }
  const evidence = { version: 'SAVINGS_REUSED_CAPTURE_EVIDENCE_V1', source_files: sourceFiles, source_bytes: sourceBytes, covered: ['Ahorro!A:Z', 'Ahorro!AA:BT'], record_hashes: hashes, overlap_sha256: sha256(hashes), formula_text_stored: 0 };
  privateWrite(outputFile, evidence);
  console.log(JSON.stringify({ status: 'PASS', mode: 'REUSE_EXISTING_CAPTURE', source_files: sourceFiles.length, source_bytes: sourceBytes, reduced_bytes: fs.statSync(outputFile).size, records: hashes.length, formula_text_stored: 0 }));
}

function certify(run1File, run2File, affiliateFile, reuseFile, manifestFile, summaryFile) {
  const run1 = JSON.parse(fs.readFileSync(run1File, 'utf8'));
  const run2 = JSON.parse(fs.readFileSync(run2File, 'utf8'));
  const affiliates = JSON.parse(fs.readFileSync(affiliateFile, 'utf8'));
  const reused = JSON.parse(fs.readFileSync(reuseFile, 'utf8'));
  assert(run1.logical_sha256 === run2.logical_sha256, 'FINANCIAL_CAPTURE_CHANGED_BETWEEN_RUNS');
  assert(Array.isArray(affiliates.rows), 'AFFILIATE_SNAPSHOT_INVALID');
  const byControl = new Map();
  affiliates.rows.forEach((row) => {
    const folio = normalizeFolio(row.numero_control);
    if (!folio) return;
    if (!byControl.has(folio)) byControl.set(folio, []);
    byControl.get(folio).push(row.id);
  });
  const ingreso = new Map();
  run2.operational['Ingreso ahorro'].rows.forEach((row) => { if (row[1]) { if (!ingreso.has(row[1])) ingreso.set(row[1], []); ingreso.get(row[1]).push(row); } });
  const solicitudes = new Map();
  run2.operational['Solicitud de Ahorro'].rows.forEach((row) => { if (row[1]) { if (!solicitudes.has(row[1])) solicitudes.set(row[1], []); solicitudes.get(row[1]).push(row); } });
  const identity = { RESOLVED: [], AMBIGUOUS: [], ORPHAN: [], INVALID_TEST: [], OTHER_INVALID: [] };
  const starts = { START_DATE_CERTIFIED: [], START_DATE_INFERRED: [], START_DATE_MISSING: [], START_DATE_CONFLICT: [] };
  const processes = { JUB: [], PROCESS_1: [], PROCESS_3: [], UNKNOWN: [], INVALID: [], CONFLICT: [] };
  const classifications = [];
  run2.ahorro.forEach((row) => {
    const folio = row.legacy_folio;
    let identityStatus;
    if (String(row.legacy_name || '').toUpperCase().includes('TEST') && !(byControl.get(folio) || []).length) identityStatus = 'INVALID_TEST';
    else if (!/^\d+$/.test(folio)) identityStatus = 'OTHER_INVALID';
    else { const matches = byControl.get(folio) || []; identityStatus = matches.length === 1 ? 'RESOLVED' : matches.length > 1 ? 'AMBIGUOUS' : 'ORPHAN'; }
    identity[identityStatus].push(folio);
    if (identityStatus === 'INVALID_TEST' || identityStatus === 'OTHER_INVALID') return;
    const processEvidence = [row.process.value, ...(ingreso.get(folio) || []).map((candidate) => candidate[2][1])].filter((value) => value != null && String(value).trim());
    const normalized = [...new Set(processEvidence.map(normalizeProcess).filter(Boolean))];
    const processStatus = normalized.length === 0 ? 'UNKNOWN' : normalized.length === 1 ? normalized[0] : normalized.includes('INVALID') ? 'INVALID' : 'CONFLICT';
    processes[processStatus].push(folio);
    const requestRows = (solicitudes.get(folio) || []).slice().sort((a, b) => String(googleDate(a[2][1]) || '').localeCompare(String(googleDate(b[2][1]) || '')) || a[0] - b[0]);
    const latest = requestRows.at(-1);
    const direct = latest ? googleDate(latest[2][2]) : null;
    const formulaDates = [googleDate(row.first_discount.value), googleDate(row.discount_start.value)].filter(Boolean);
    let startStatus = 'START_DATE_MISSING', startDate = null;
    if (direct && formulaDates.some((date) => date !== direct)) startStatus = 'START_DATE_CONFLICT';
    else if (direct) { startStatus = 'START_DATE_CERTIFIED'; startDate = direct; }
    else if (formulaDates.length && formulaDates.every((date) => date === formulaDates[0])) { startStatus = 'START_DATE_INFERRED'; startDate = formulaDates[0]; }
    starts[startStatus].push(folio);
    classifications.push({ legacy_folio: folio, identity_status: identityStatus, process_status: processStatus, process_evidence: processEvidence, start_date_status: startStatus, start_date: startDate });
  });
  Object.values(identity).forEach((values) => values.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
  Object.values(starts).forEach((values) => values.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
  Object.values(processes).forEach((values) => values.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
  const knownPreserved = identity.RESOLVED.length === 356
    && identity.AMBIGUOUS.length === 5
    && identity.ORPHAN.length === 2
    && identity.INVALID_TEST.length === 1
    && identity.OTHER_INVALID.length === 0;
  const core = {
    manifest_version: MANIFEST_VERSION,
    classification: 'PRIVATE_FINANCIAL_PII_BASELINE',
    authority: 'GOOGLE_SHEETS_CURRENT_DERIVED_EVIDENCE_ONLY',
    source: { workbook_id: WORKBOOK_ID, workbook_name: 'SutiApp Final', captured_at: run2.captured_at, metadata: run2.metadata },
    consistency: {
      run_1: run1.logical_sha256,
      run_2: run2.logical_sha256,
      consistent: true,
      financial_scope_identical: true,
      workbook_modified_time_changed_between_runs: run1.metadata.after.modified_time !== run2.metadata.before.modified_time,
      run_1_modified_time: run1.metadata.after.modified_time,
      run_2_modified_time: run2.metadata.after.modified_time,
    },
    reuse: { source_bytes: reused.source_bytes, reduced_bytes: fs.statSync(reuseFile).size, source_files: reused.source_files, overlap_sha256: reused.overlap_sha256, covered: reused.covered, formula_text_stored: 0 },
    ahorro: run2.ahorro,
    history_schema: run2.history_schema,
    history: run2.history,
    yield_headers: run2.yield_headers,
    yield_schema: run2.yield_schema,
    historical_yields: run2.historical_yields,
    operational: run2.operational,
    identity: { TOTAL: run2.ahorro.length, ...identity, classifications_preserved: knownPreserved, automatic_resolution: false },
    start_dates: starts,
    process: processes,
    classifications,
    counts: {
      ahorro_rows: run2.ahorro.length,
      financial_history_records: run2.history.length,
      historical_yield_records: run2.historical_yields.length,
      operational_row_hashes: Object.values(run2.operational).reduce((sum, item) => sum + item.row_count, 0),
    },
    gates: {
      google_writes: 0,
      supabase_writes: 0,
      schema_reapplied: false,
      import_executed: false,
      cutover_executed: false,
      safe_to_use_as_new_baseline: knownPreserved,
      safe_to_import: false,
      safe_to_cutover: false,
    },
  };
  const manifest = { ...core, manifest_sha256: sha256(core) };
  privateWrite(manifestFile, manifest);
  const summary = {
    status: manifest.gates.safe_to_use_as_new_baseline ? 'PASS' : 'FAIL',
    manifest_version: MANIFEST_VERSION,
    manifest_sha256: manifest.manifest_sha256,
    capture_sha256: run2.logical_sha256,
    captured_at: run2.captured_at,
    ahorro_rows: run2.ahorro.length,
    history_records: run2.history.length,
    yield_records: run2.historical_yields.length,
    report_ahorro_rows: run2.operational['Reporte Ahorro'].row_count,
    report_ahorro_folios: run2.operational['Reporte Ahorro'].exact_folio_set.length,
    report_rh_rows: run2.operational['Reporte - RH'].row_count,
    report_rh_folios: run2.operational['Reporte - RH'].exact_folio_set.length,
    resolved: identity.RESOLVED.length,
    ambiguous: identity.AMBIGUOUS,
    orphan: identity.ORPHAN,
    invalid_test: identity.INVALID_TEST,
    start_dates: Object.fromEntries(Object.entries(starts).map(([key, values]) => [key, values.length])),
    process: Object.fromEntries(Object.entries(processes).map(([key, values]) => [key, values.length])),
    source_bytes_reused: reused.source_bytes,
    reusable_evidence_bytes: fs.statSync(reuseFile).size,
    final_manifest_bytes: fs.statSync(manifestFile).size,
    reusable_evidence_reduction_percent: Number((100 * (1 - fs.statSync(reuseFile).size / reused.source_bytes)).toFixed(2)),
    final_manifest_reduction_vs_captured_partial_percent: Number((100 * (1 - fs.statSync(manifestFile).size / reused.source_bytes)).toFixed(2)),
    formula_text_stored: 0,
    google_writes: 0,
    supabase_writes: 0,
    import_executed: false,
    cutover_executed: false,
  };
  privateWrite(summaryFile, summary);
  console.log(JSON.stringify(summary));
}

function attachIdentityEvidence(manifestFile, evidenceFile, summaryFile) {
  const original = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  assert(evidence.schema_version === 'SAVINGS_FOLIO_DISPLAY_EVIDENCE_V1', 'FOLIO_DISPLAY_EVIDENCE_INVALID');
  assert(evidence.reads_equal === true, 'FOLIO_DISPLAY_READS_DIFFER');
  assert(canonical(evidence.run_1_values) === canonical(evidence.run_2_values), 'FOLIO_DISPLAY_READS_DIFFER');
  let missing = 0;
  let mismatch = 0;
  let leadingZero = 0;
  original.ahorro.forEach((row) => {
    const displayed = String(evidence.run_1_values[row.source_row - 1]?.[0] ?? '').trim();
    if (!displayed) missing += 1;
    if (displayed !== String(row.legacy_folio ?? '')) mismatch += 1;
    if (/^0\d/.test(displayed)) leadingZero += 1;
  });
  assert(missing === 0, 'FOLIO_DISPLAY_MISSING');
  assert(mismatch === 0, 'FOLIO_DISPLAY_MISMATCH');
  const identityDisplayEvidence = {
    file: path.basename(evidenceFile),
    range: evidence.range,
    value_render_option: evidence.value_render_option,
    run_1_sha256: sha256(evidence.run_1_values),
    run_2_sha256: sha256(evidence.run_2_values),
    reads_equal: true,
    matched_manifest_rows: original.ahorro.length,
    missing_rows: missing,
    mismatched_rows: mismatch,
    leading_zero_values: leadingZero,
    google_writes: 0,
  };
  const { manifest_sha256: _oldHash, ...oldCore } = original;
  const core = { ...oldCore, identity_display_evidence: identityDisplayEvidence };
  const manifest = { ...core, manifest_sha256: sha256(core) };
  privateWrite(manifestFile, manifest);
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  summary.manifest_sha256 = manifest.manifest_sha256;
  summary.final_manifest_bytes = fs.statSync(manifestFile).size;
  summary.final_manifest_reduction_vs_captured_partial_percent = Number((100 * (1 - fs.statSync(manifestFile).size / summary.source_bytes_reused)).toFixed(2));
  summary.identity_display_evidence = identityDisplayEvidence;
  privateWrite(summaryFile, summary);
  console.log(JSON.stringify({ status: 'PASS', mode: 'ATTACH_IDENTITY_DISPLAY_EVIDENCE', manifest_sha256: manifest.manifest_sha256, matched_manifest_rows: original.ahorro.length, mismatch, google_writes: 0, supabase_writes: 0 }));
}

function attachSupabaseIdentityEvidence(manifestFile, beforeFile, afterFile, summaryFile) {
  const original = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
  const after = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
  const expectedVersion = 'SAVINGS_BASELINE_AFFILIATE_IDENTITY_V2_STRICT_COLUMNS';
  assert(before.version === expectedVersion && after.version === expectedVersion, 'SUPABASE_IDENTITY_VERSION_INVALID');
  assert(canonical(before.selected_columns) === canonical(['id', 'numero_control']), 'SUPABASE_COLUMNS_OUT_OF_SCOPE');
  assert(canonical(after.selected_columns) === canonical(['id', 'numero_control']), 'SUPABASE_COLUMNS_OUT_OF_SCOPE');
  assert(Array.isArray(before.rows) && Array.isArray(after.rows), 'SUPABASE_IDENTITY_ROWS_INVALID');
  assert(before.rows_sha256 === sha256(before.rows) && after.rows_sha256 === sha256(after.rows), 'SUPABASE_IDENTITY_HASH_INVALID');
  assert(before.rows_sha256 === after.rows_sha256, 'SUPABASE_IDENTITY_CHANGED_BETWEEN_RUNS');
  assert(before.rows.length === 947 && after.rows.length === 947, 'SUPABASE_IDENTITY_COUNT_UNEXPECTED');
  const identityEvidence = {
    selected_columns: ['id', 'numero_control'],
    before_sha256: before.rows_sha256,
    after_sha256: after.rows_sha256,
    consistent: true,
    row_count: after.rows.length,
    writes: 0,
  };
  const { manifest_sha256: _oldHash, ...oldCore } = original;
  const gates = { ...oldCore.gates };
  delete gates.supabase_savings_rows;
  delete gates.migration_objects_present;
  delete gates.migration_tracking_record;
  const core = { ...oldCore, supabase_identity_evidence: identityEvidence, gates };
  const manifest = { ...core, manifest_sha256: sha256(core) };
  privateWrite(manifestFile, manifest);
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  summary.manifest_sha256 = manifest.manifest_sha256;
  summary.final_manifest_bytes = fs.statSync(manifestFile).size;
  summary.final_manifest_reduction_vs_captured_partial_percent = Number((100 * (1 - fs.statSync(manifestFile).size / summary.source_bytes_reused)).toFixed(2));
  summary.supabase_identity_evidence = identityEvidence;
  privateWrite(summaryFile, summary);
  console.log(JSON.stringify({ status: 'PASS', mode: 'ATTACH_SUPABASE_IDENTITY_EVIDENCE', manifest_sha256: manifest.manifest_sha256, affiliates: after.rows.length, selected_columns: identityEvidence.selected_columns, supabase_writes: 0 }));
}

if (require.main === module) {
  const [mode, ...args] = process.argv.slice(2);
  try {
    if (mode === 'assemble') assemble(...args);
    else if (mode === 'reuse') reuse(...args);
    else if (mode === 'certify') certify(...args);
    else if (mode === 'attach-identity') attachIdentityEvidence(...args);
    else if (mode === 'attach-supabase-identity') attachSupabaseIdentityEvidence(...args);
    else throw new Error('USAGE: assemble <raw> <capture> | reuse <chunk-dir> <evidence> | certify <run1> <run2> <affiliates> <reuse> <manifest> <summary> | attach-identity <manifest> <evidence> <summary> | attach-supabase-identity <manifest> <before> <after> <summary>');
  } catch (error) {
    console.error(JSON.stringify({ status: 'FAIL', error: error.message, external_writes: 0 }));
    process.exit(1);
  }
}

module.exports = { canonical, sha256, VERSION, MANIFEST_VERSION };
