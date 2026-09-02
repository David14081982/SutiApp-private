#!/usr/bin/env node
'use strict';

/* Builds a deterministic, review-only Savings import manifest from a bounded
   Google projection captured by the connected Sheets reader. It never calls
   Google or Supabase and never promotes legacy candidates into the ledger. */

const fs = require('fs');
const path = require('path');
const { canonical, sha256 } = require('./import-savings-shadow.js');

const VERSION = 'SAVINGS_SHADOW_IMPORT_V2';
const SCHEMA_VERSION = '20260902000100_PREPARED_NOT_APPLIED';
const SOURCE_VERSION = 'SAVINGS_GOOGLE_IMPORT_PROJECTION_V1';
const WORKBOOK_ID = '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
const REQUIRED_SHEETS = [
  'Ingreso ahorro', 'Solicitud de Ahorro', 'Ahorro', 'Solicitud Cambio ahorro',
  'Solicitud de retiro', 'Saldo manual', 'Reporte Ahorro', 'Reporte - RH', 'Conciliacion',
];
const BASELINE = Object.freeze({
  'Ingreso ahorro': { folio_rows: 393, unique_folios: 389 },
  'Solicitud de Ahorro': { folio_rows: 341, unique_folios: 338 },
  Ahorro: { folio_rows: 363, unique_folios: 363 },
  'Solicitud Cambio ahorro': { folio_rows: 123, unique_folios: 112 },
  'Solicitud de retiro': { folio_rows: 228, unique_folios: 220 },
  'Reporte Ahorro': { folio_rows: 4047, unique_folios: 317 },
  'Reporte - RH': { folio_rows: 320, unique_folios: 320 },
  Conciliacion: { folio_rows: 0, unique_folios: 0 },
});

function assert(condition, code, details) {
  if (!condition) { const error = new Error(code + (details ? ': ' + details : '')); error.code = code; throw error; }
}
function value(cell) {
  if (cell == null) return null;
  if (typeof cell !== 'object' || Array.isArray(cell)) return cell;
  if (Object.prototype.hasOwnProperty.call(cell, 'e')) return cell.e;
  return cell;
}
function isFormula(cell) { return !!(cell && typeof cell === 'object' && Number.isInteger(cell.f)); }
function text(cell) { const found = value(cell); return found == null ? '' : String(found).trim(); }
function folio(cell) {
  const found = text(cell); if (!found) return null;
  return /^\d+(?:\.0+)?$/.test(found) ? String(Math.trunc(Number(found))) : found;
}
function amount(cell) {
  const found = value(cell);
  if (typeof found === 'number' && Number.isFinite(found)) return found;
  if (typeof found !== 'string' || !found.trim()) return null;
  const parsed = Number(found.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
function bool(cell) {
  const found = value(cell);
  if (typeof found === 'boolean') return found;
  const normalized = String(found == null ? '' : found).trim().toUpperCase();
  if (['TRUE', 'SI', 'SÍ', 'YES'].includes(normalized)) return true;
  if (['FALSE', 'NO'].includes(normalized)) return false;
  return null;
}
function isoDate(cell) {
  const found = value(cell);
  if (typeof found === 'number' && Number.isFinite(found)) {
    const date = new Date(Math.round((found - 25569) * 86400000));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const raw = String(found == null ? '' : found).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
}
function round(valueToRound) { return Math.round((Number(valueToRound) + Number.EPSILON) * 100) / 100; }
function column(index) {
  let out = '', cursor = index + 1;
  while (cursor > 0) { const rem = (cursor - 1) % 26; out = String.fromCharCode(65 + rem) + out; cursor = Math.floor((cursor - 1) / 26); }
  return out;
}
function normalizeProcess(raw) {
  const found = String(raw == null ? '' : raw).trim().toUpperCase().replace(/[ -]+/g, '_');
  if (found === 'JUB' || found.includes('JUBIL')) return 'JUB';
  if (['1', 'PROCESS_1', 'PROCESO_1'].includes(found)) return 'PROCESS_1';
  if (['3', 'PROCESS_3', 'PROCESO_3'].includes(found)) return 'PROCESS_3';
  return null;
}
function probableCause(row) {
  if (row.status === 'Terminado' && row.legacy_Q === 0 && row.candidate_capital > 0) return 'TERMINATED_ZERO_BALANCE_HISTORY_RETAINED';
  if (row.candidate_withdrawals > 0) return 'LEGACY_PROJECTION_OR_WITHDRAWAL_RECONSTRUCTION';
  return 'LEGACY_PROJECTION_VS_REPORTED_CONTRIBUTIONS';
}

function build(input) {
  assert(input && input.version === SOURCE_VERSION, 'SAVINGS_SOURCE_PROJECTION_VERSION_INVALID');
  assert(input.source && input.source.workbook_id === WORKBOOK_ID && input.source.workbook_name === 'SutiApp Final', 'SAVINGS_SOURCE_WORKBOOK_INVALID');
  REQUIRED_SHEETS.forEach((name) => assert(input.sheets && input.sheets[name] && Array.isArray(input.sheets[name].rows), 'SAVINGS_SOURCE_SHEET_REQUIRED', name));
  assert(input.affiliate_snapshot && Array.isArray(input.affiliate_snapshot.rows), 'SAVINGS_AFFILIATE_SNAPSHOT_REQUIRED');

  const sourceProjection = {
    version: input.version,
    source: { workbook_id: input.source.workbook_id, workbook_name: input.source.workbook_name, locale: input.source.locale, time_zone: input.source.time_zone },
    sheet_order: input.sheet_order,
    formula_dictionary: input.formula_dictionary, sheets: input.sheets,
  };
  const sourceProjectionSha256 = sha256(canonical(sourceProjection));
  const affiliateRows = input.affiliate_snapshot.rows.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const identitySnapshotSha256 = sha256(canonical(affiliateRows));
  const rows = (name) => input.sheets[name].rows.slice(1);
  const headers = (name) => input.sheets[name].rows[0].cells.map(value);

  assert(canonical(headers('Ingreso ahorro')) === canonical(['Folio', 'Proceso', 'Estado']), 'SAVINGS_HEADERS_CHANGED', 'Ingreso ahorro');
  assert(headers('Ahorro')[0] === 'Folio' && headers('Ahorro')[16] === 'Saldo (HOY)' && isoDate(input.sheets.Ahorro.rows[0].cells[26]) === '2026-01-05' && headers('Ahorro')[119] === 'AHORRO 2025' && headers('Ahorro')[126] === '2025 + 2026 RENDIMIENTO', 'SAVINGS_HEADERS_CHANGED', 'Ahorro');
  assert(canonical(headers('Reporte Ahorro')) === canonical(['Folio', 'Fecha', 'Monto', 'Estatus']), 'SAVINGS_HEADERS_CHANGED', 'Reporte Ahorro');

  const rowHash = (sheet, row) => sha256(canonical({ sheet, source_row: row.source_row, cells: row.cells }));
  const byControl = new Map();
  affiliateRows.forEach((row) => { const key = folio(row.numero_control); if (key) { if (!byControl.has(key)) byControl.set(key, []); byControl.get(key).push(row); } });

  const ahorroRows = rows('Ahorro');
  const folioRows = ahorroRows.filter((row) => folio(row.cells[0]));
  const invalidFolios = folioRows.filter((row) => row.invalid_reason).map((row) => folio(row.cells[0]));
  const noFolioRows = ahorroRows.filter((row) => !folio(row.cells[0]) && row.cells.some((cell) => cell != null));
  const duplicates = [];
  const seen = new Set();
  folioRows.filter((row) => !row.invalid_reason).forEach((row) => { const key = folio(row.cells[0]); if (seen.has(key)) duplicates.push(key); else seen.add(key); });
  const importRows = folioRows.filter((row) => !row.invalid_reason && !duplicates.includes(folio(row.cells[0])));
  const participantRowByFolio = new Map(importRows.map((row) => [folio(row.cells[0]), row]));

  const ingresosByFolio = new Map();
  rows('Ingreso ahorro').forEach((row) => { const key = folio(row.cells[0]); if (key) { if (!ingresosByFolio.has(key)) ingresosByFolio.set(key, []); ingresosByFolio.get(key).push(row); } });
  const solicitudesByFolio = new Map();
  rows('Solicitud de Ahorro').forEach((row) => { const key = folio(row.cells[0]); if (key) { if (!solicitudesByFolio.has(key)) solicitudesByFolio.set(key, []); solicitudesByFolio.get(key).push(row); } });

  const identityLists = { RESOLVED: [], AMBIGUOUS: [], ORPHAN: [] };
  const processLists = { JUB: [], PROCESS_1: [], PROCESS_3: [], UNKNOWN: [], CONFLICT: [] };
  const startLists = { START_DATE_CERTIFIED: [], START_DATE_INFERRED: [], START_DATE_MISSING: [], START_DATE_CONFLICT: [] };
  const participants = [];
  const participantMeta = new Map();

  importRows.forEach((row) => {
    const key = folio(row.cells[0]);
    const matches = byControl.get(key) || [];
    const identity = matches.length === 1 ? 'RESOLVED' : matches.length > 1 ? 'AMBIGUOUS' : 'ORPHAN';
    identityLists[identity].push(key);

    const rawProcesses = [value(row.cells[3]), ...(ingresosByFolio.get(key) || []).map((entry) => value(entry.cells[1]))].filter((entry) => entry != null && String(entry).trim());
    const normalizedProcesses = [...new Set(rawProcesses.map(normalizeProcess).filter(Boolean))];
    let processStatus = 'UNKNOWN', process = null;
    if (normalizedProcesses.length === 1) { process = normalizedProcesses[0]; processStatus = process; }
    if (normalizedProcesses.length > 1) processStatus = 'CONFLICT';
    processLists[processStatus].push(key);

    const requests = (solicitudesByFolio.get(key) || []).slice().sort((a, b) => {
      const left = isoDate(a.cells[1]) || ''; const right = isoDate(b.cells[1]) || '';
      return left.localeCompare(right) || a.source_row - b.source_row;
    });
    const latest = requests[requests.length - 1];
    const direct = latest ? isoDate(latest.cells[2]) : null;
    const formulaDates = [isoDate(row.cells[5]), isoDate(row.cells[23])].filter(Boolean);
    let startStatus = 'START_DATE_MISSING', startDate = null;
    if (direct && formulaDates.some((candidate) => candidate !== direct)) startStatus = 'START_DATE_CONFLICT';
    else if (direct) { startStatus = 'START_DATE_CERTIFIED'; startDate = direct; }
    else if (formulaDates.length && formulaDates.every((candidate) => candidate === formulaDates[0])) { startStatus = 'START_DATE_INFERRED'; startDate = formulaDates[0]; }
    startLists[startStatus].push(key);

    const q = amount(row.cells[16]);
    participants.push({
      participant_type: identity === 'RESOLVED' ? 'AFFILIATE' : 'LEGACY_UNRESOLVED',
      affiliate_id: identity === 'RESOLVED' ? matches[0].id : null,
      legacy_folio: key, identity_status: identity, current_process: process,
      process_source: 'LEGACY', display_name: null,
      legacy_reported_balance: q == null ? null : round(q),
    });
    participantMeta.set(key, { row, identity, process, process_status: processStatus, start_date: startDate, start_status: startStatus });
  });

  const evidence = [];
  function addEvidence(sheet, row, sourceColumn, recordType, dataClassification, options = {}) {
    const item = {
      source_workbook_id: WORKBOOK_ID, source_sheet: sheet, source_column: sourceColumn,
      source_row: row.source_row, legacy_folio: options.legacy_folio || null,
      observed_on: options.observed_on || null,
      numeric_value: options.numeric_value == null ? null : round(options.numeric_value),
      record_type: recordType, data_classification: dataClassification,
      source_row_sha256: rowHash(sheet, row), raw_payload: options.raw_payload || {},
    };
    evidence.push(item); return item;
  }

  const qSummary = { folios_with_Q: 0, folios_without_Q: 0, total_Q: 0, negative_Q: 0, zero_Q: 0, unexpected_values: 0 };
  importRows.forEach((row) => {
    const key = folio(row.cells[0]); const q = amount(row.cells[16]);
    if (q == null) { qSummary.folios_without_Q++; qSummary.unexpected_values++; }
    else { qSummary.folios_with_Q++; qSummary.total_Q += q; if (q < 0) qSummary.negative_Q++; if (q === 0) qSummary.zero_Q++; }
    addEvidence('Ahorro', row, 'Q', 'LEGACY_REPORTED_BALANCE', 'LEGACY_SNAPSHOT', { legacy_folio: key, numeric_value: q, raw_payload: { canonical_balance: false } });
  });
  qSummary.total_Q = round(qSummary.total_Q);

  const dated = { total_dated_cells: 0, non_zero_values: 0, zero_values: 0, formula_derived_values: 0, formula_blank_outputs: 0, manual_values: 0, blank_values: 0, conflicts: 0 };
  ahorroRows.forEach((row) => {
    for (let index = 26; index <= 118; index++) {
      dated.total_dated_cells++;
      const cell = row.cells[index], numeric = amount(cell), blank = cell == null || value(cell) == null || value(cell) === '';
      if (numeric === 0) dated.zero_values++;
      else if (numeric != null) dated.non_zero_values++;
      if (isFormula(cell)) { dated.formula_derived_values++; if (blank) dated.formula_blank_outputs++; }
      else if (blank) dated.blank_values++;
      else dated.manual_values++;
      const key = folio(row.cells[0]);
      if (participantMeta.has(key)) addEvidence('Ahorro', row, column(index), 'AA_DO_CELL', isFormula(cell) ? 'EXPECTED' : 'PENDING_REVIEW', {
        legacy_folio: key, observed_on: isoDate(input.sheets.Ahorro.rows[0].cells[index]), numeric_value: numeric,
        raw_payload: { semantic_class: blank ? 'UNKNOWN' : isFormula(cell) ? 'LEGACY_EXPECTED' : 'MANUAL_OVERRIDE', formula_derived: isFormula(cell) },
      });
    }
  });

  const contributionCandidates = [], contributionTotals = new Map(), contributionKeys = new Set();
  let contributionDuplicates = 0, contributionInvalid = 0;
  rows('Reporte Ahorro').forEach((row) => {
    const key = folio(row.cells[0]), date = isoDate(row.cells[1]), numeric = amount(row.cells[2]), status = text(row.cells[3]);
    const businessKey = canonical([key, date, numeric, status]);
    if (contributionKeys.has(businessKey)) contributionDuplicates++; else contributionKeys.add(businessKey);
    if (!key || !participantMeta.has(key) || !date || !(numeric > 0)) { contributionInvalid++; return; }
    const sourceKey = 'REPORTE_AHORRO:' + sha256(canonical([WORKBOOK_ID, row.source_row, key, date, round(numeric)])).slice(0, 32);
    contributionCandidates.push({ legacy_folio: key, contribution_date: date, amount: round(numeric), source_row: row.source_row, source_key: sourceKey, classification: 'PENDING_REVIEW' });
    contributionTotals.set(key, round((contributionTotals.get(key) || 0) + numeric));
    addEvidence('Reporte Ahorro', row, 'A:D', 'CONTRIBUTION', 'PENDING_REVIEW', { legacy_folio: key, observed_on: date, numeric_value: numeric, raw_payload: { status, source_key: sourceKey, canonical: false } });
  });

  const withdrawalCandidates = [], withdrawalTotals = new Map(), withdrawalKeys = new Set();
  const withdrawalSummary = { records: 0, partial: 0, total: 0, continue_saving: 0, terminate: 0, duplicates: 0, missing_dates: 0, missing_amounts: 0, ambiguous_linkage: 0, candidate_transactions: 0 };
  rows('Solicitud de retiro').forEach((row) => {
    const key = folio(row.cells[0]); if (!key) return; withdrawalSummary.records++;
    const date = isoDate(row.cells[3]), categoryRaw = text(row.cells[4]), keepSaving = bool(row.cells[5]), numeric = amount(row.cells[6]);
    const kind = /parcial/i.test(categoryRaw) ? 'PARTIAL' : /complet/i.test(categoryRaw) ? 'TOTAL' : 'UNKNOWN';
    if (kind === 'PARTIAL') withdrawalSummary.partial++; if (kind === 'TOTAL') withdrawalSummary.total++;
    if (keepSaving === true) withdrawalSummary.continue_saving++; if (keepSaving === false) withdrawalSummary.terminate++;
    if (!date) withdrawalSummary.missing_dates++; if (!(numeric > 0)) withdrawalSummary.missing_amounts++;
    const meta = participantMeta.get(key); if (meta && meta.identity !== 'RESOLVED') withdrawalSummary.ambiguous_linkage++;
    const businessKey = canonical([key, date, kind, keepSaving, numeric]);
    if (withdrawalKeys.has(businessKey)) withdrawalSummary.duplicates++; else withdrawalKeys.add(businessKey);
    const documentReference = text(row.cells[9]);
    if (meta) addEvidence('Solicitud de retiro', row, 'A:L', 'WITHDRAWAL', 'PENDING_REVIEW', {
      legacy_folio: key, observed_on: date, numeric_value: numeric,
      raw_payload: { withdrawal_kind: kind, continue_saving: keepSaving, document_reference_sha256: documentReference ? sha256(documentReference) : null, canonical: false },
    });
    if (!meta || !date || !(numeric > 0) || kind === 'UNKNOWN') return;
    const sourceKey = 'RETIRO:' + sha256(canonical([WORKBOOK_ID, row.source_row, key, date, kind, round(numeric)])).slice(0, 32);
    withdrawalCandidates.push({ legacy_folio: key, effective_date: date, amount: round(numeric), withdrawal_kind: kind, continue_saving: keepSaving, source_row: row.source_row, source_key: sourceKey, classification: 'PENDING_REVIEW' });
    withdrawalTotals.set(key, round((withdrawalTotals.get(key) || 0) + numeric));
  });
  withdrawalSummary.candidate_transactions = withdrawalCandidates.length;

  const initialPlanCandidates = [];
  rows('Solicitud de Ahorro').forEach((row) => {
    const key = folio(row.cells[0]), meta = participantMeta.get(key), numeric = amount(row.cells[4]);
    if (!meta || !(numeric > 0)) return;
    const effective = isoDate(row.cells[2]);
    const status = !effective ? 'EFFECTIVE_DATE_UNCERTAIN' : !meta.process ? 'CONFLICT' : 'CERTIFIED';
    initialPlanCandidates.push({ legacy_folio: key, source_row: row.source_row, amount: round(numeric), effective_date: effective, status, process: meta.process });
    addEvidence('Solicitud de Ahorro', row, 'A:J', 'PLAN', effective && meta.process ? 'RAW_LEGACY' : 'PENDING_REVIEW', { legacy_folio: key, observed_on: effective, numeric_value: numeric, raw_payload: { candidate_only: true } });
  });
  const changeCandidates = [], changeKeys = new Set();
  const changeSummary = { requests: 0, certified: 0, effective_date_uncertain: 0, duplicate: 0, conflict: 0 };
  rows('Solicitud Cambio ahorro').forEach((row) => {
    const key = folio(row.cells[0]); if (!key) return; changeSummary.requests++;
    const meta = participantMeta.get(key), date = isoDate(row.cells[1]), oldAmount = amount(row.cells[2]), newAmount = amount(row.cells[3]), applied = bool(row.cells[4]);
    const businessKey = canonical([key, date, oldAmount, newAmount, applied]);
    const duplicate = changeKeys.has(businessKey); if (!duplicate) changeKeys.add(businessKey);
    let status = 'CERTIFIED';
    if (duplicate) status = 'DUPLICATE';
    else if (!date) status = 'EFFECTIVE_DATE_UNCERTAIN';
    else if (!(newAmount > 0) || !meta || !meta.process || applied !== true || (oldAmount != null && newAmount === oldAmount)) status = 'CONFLICT';
    changeSummary[status === 'CERTIFIED' ? 'certified' : status === 'EFFECTIVE_DATE_UNCERTAIN' ? 'effective_date_uncertain' : status.toLowerCase()]++;
    const documentReference = text(row.cells[5]);
    changeCandidates.push({ legacy_folio: key, source_row: row.source_row, old_amount: oldAmount == null ? null : round(oldAmount), new_amount: newAmount == null ? null : round(newAmount), effective_date: date, applied, document_reference_sha256: documentReference ? sha256(documentReference) : null, status });
    if (meta) addEvidence('Solicitud Cambio ahorro', row, 'A:F', 'AMOUNT_CHANGE', status === 'CERTIFIED' ? 'RAW_LEGACY' : 'PENDING_REVIEW', { legacy_folio: key, observed_on: date, numeric_value: newAmount, raw_payload: { old_amount: oldAmount, applied, status, document_reference_sha256: documentReference ? sha256(documentReference) : null } });
  });
  const contributionPlans = initialPlanCandidates.concat(changeCandidates.map((row) => ({ legacy_folio: row.legacy_folio, source_row: row.source_row, amount: row.new_amount, effective_date: row.effective_date, status: row.status, process: participantMeta.get(row.legacy_folio) && participantMeta.get(row.legacy_folio).process, source: 'AMOUNT_CHANGE' })));

  const yieldColumns = [
    { index: 119, period: '2025', component: 'CAPITAL', header: 'AHORRO 2025' },
    { index: 120, period: '2025', component: 'YIELD', header: 'RENDIMIENTO 2025' },
    { index: 121, period: '2025', component: 'SUBTOTAL', header: 'SUBTOTAL 2025 Y ANTERIORES' },
    { index: 122, period: '2026-H1', component: 'CAPITAL', header: '2026 AHORRO 30 EN A 30 JUN' },
    { index: 123, period: '2026-H1', component: 'YIELD', header: '2026 RENDIMIENTO' },
    { index: 124, period: '2026-H1', component: 'SUBTOTAL', header: '2026 SUBTOTAL' },
    { index: 125, period: 'CUMULATIVE', component: 'CAPITAL', header: '2025 + 2026 AHORRO' },
    { index: 126, period: 'CUMULATIVE', component: 'YIELD', header: '2025 + 2026 RENDIMIENTO' },
  ];
  const yieldSummary = {}, yieldCandidates = [], yieldTotals = new Map();
  yieldColumns.forEach((definition) => { yieldSummary[definition.header] = { source_column: column(definition.index), period: definition.period, component: definition.component, rows_with_value: 0, non_zero: 0, total: 0 }; });
  importRows.forEach((row) => {
    const key = folio(row.cells[0]);
    yieldColumns.forEach((definition) => {
      const cell = row.cells[definition.index], numeric = amount(cell), summary = yieldSummary[definition.header];
      if (cell != null && value(cell) != null && value(cell) !== '') summary.rows_with_value++;
      if (numeric) { summary.non_zero++; summary.total += numeric; }
      addEvidence('Ahorro', row, column(definition.index), definition.component === 'YIELD' ? 'YIELD' : 'REPORT', 'RAW_LEGACY', { legacy_folio: key, numeric_value: numeric, raw_payload: { period: definition.period, component: definition.component, classification: definition.component === 'YIELD' ? 'RAW_LEGACY_YIELD' : 'RAW_LEGACY_AGGREGATE', canonical: false } });
      if (definition.component === 'YIELD' && numeric && definition.period !== 'CUMULATIVE') {
        yieldCandidates.push({ legacy_folio: key, source_row: row.source_row, period: definition.period, source_column: column(definition.index), amount: round(numeric), classification: 'RAW_LEGACY_YIELD', credit_allowed: false });
        yieldTotals.set(key, round((yieldTotals.get(key) || 0) + numeric));
      }
    });
  });
  Object.values(yieldSummary).forEach((entry) => { entry.total = round(entry.total); });

  const balancePreview = [], mismatches = [];
  participants.forEach((participant) => {
    const key = participant.legacy_folio, row = participantRowByFolio.get(key), legacyQ = participant.legacy_reported_balance;
    const candidateCapital = round(contributionTotals.get(key) || 0), candidateWithdrawals = round(withdrawalTotals.get(key) || 0), candidateYield = round(yieldTotals.get(key) || 0), manual = round(amount(row.cells[14]) || 0);
    const candidateTotal = round(candidateCapital + manual - candidateWithdrawals);
    const difference = legacyQ == null ? null : round(candidateTotal - legacyQ);
    const classification = difference == null ? 'INSUFFICIENT_EVIDENCE' : Math.abs(difference) < 0.005 ? 'MATCH' : 'MISMATCH';
    const preview = { legacy_folio: key, legacy_Q: legacyQ, candidate_capital: candidateCapital, candidate_yield: candidateYield, candidate_withdrawals: candidateWithdrawals, candidate_manual_adjustment: manual, candidate_total: candidateTotal, yield_included_in_candidate_total: false, difference_vs_Q: difference, classification, evidence_status: classification === 'MATCH' ? 'ARITHMETIC_MATCH_ONLY' : 'PENDING_REVIEW', status: text(row.cells[22]) };
    balancePreview.push(preview);
    if (classification === 'MISMATCH') mismatches.push({ legacy_folio: key, difference, classification, probable_cause: probableCause(preview), evidence_status: 'PENDING_REVIEW' });
  });

  const currentCounts = {};
  const sheetFolioColumn = { 'Reporte - RH': 2 };
  Object.keys(BASELINE).forEach((name) => {
    const found = rows(name).map((row) => folio(row.cells[sheetFolioColumn[name] || 0])).filter(Boolean);
    currentCounts[name] = { folio_rows: found.length, unique_folios: new Set(found).size };
  });
  const sourceDifferences = Object.keys(BASELINE).filter((name) => canonical(BASELINE[name]) !== canonical(currentCounts[name])).map((name) => ({ sheet: name, previous: BASELINE[name], current: currentCounts[name] }));
  const sourceChanged = sourceDifferences.length > 0;

  const snapshot = { participants, enrollments: [], plans: [], transactions: [], requests: [], evidence };
  const snapshotSha256 = sha256(canonical(snapshot));
  const identities = Object.fromEntries(Object.entries(identityLists).map(([key, list]) => [key, list.length]));
  const processCounts = Object.fromEntries(Object.entries(processLists).map(([key, list]) => [key, list.length]));
  const startCounts = Object.fromEntries(Object.entries(startLists).map(([key, list]) => [key, list.length]));
  const manifest = {
    import_version: VERSION, schema_version: SCHEMA_VERSION,
    source_workbook_id: input.source.workbook_id, source_workbook_name: input.source.workbook_name,
    source_projection_sha256: sourceProjectionSha256, identity_snapshot_sha256: identitySnapshotSha256,
    source_snapshot_sha256: snapshotSha256, timestamp: input.captured_at,
    certification: { status: 'CERTIFIED', evidence_sha256: snapshotSha256, source_projection_sha256: sourceProjectionSha256, scope: 'DRY_RUN_OWNER_REVIEW_ONLY', writes_authorized: false },
    provenance: { source_modified_time: input.source.modified_time, source_locale: input.source.locale, source_time_zone: input.source.time_zone, read_mode: 'GOOGLE_SHEETS_BOUNDED_READ_ONLY', sheets: REQUIRED_SHEETS.map((name) => ({ name, sheet_id: input.sheets[name].sheet_id, grid_rows: input.sheets[name].grid_rows, grid_columns: input.sheets[name].grid_columns, header_sha256: sha256(canonical(headers(name))) })), identity_read: input.affiliate_snapshot.source },
    source_changed_since_forensic_audit: sourceChanged, source_differences: sourceDifferences,
    row_counts: Object.fromEntries(REQUIRED_SHEETS.map((name) => [name, rows(name).length])),
    folio_counts: { total_found: folioRows.length, importable: participants.length, resolved: identities.RESOLVED, ambiguous: identities.AMBIGUOUS, orphan: identities.ORPHAN, duplicate_source: duplicates.length, invalid: invalidFolios.length, invalid_rows_without_folio: noFolioRows.length },
    transaction_candidate_counts: { contributions: contributionCandidates.length, contribution_duplicates: contributionDuplicates, contribution_invalid: contributionInvalid, withdrawals: withdrawalCandidates.length, yield_legacy_records: yieldCandidates.length, ledger_rows_authorized: 0 },
    plan_counts: { plans_detected: contributionPlans.length, initial_plan_candidates: initialPlanCandidates.length, plan_changes_detected: changeCandidates.length, certified_segments: contributionPlans.filter((row) => row.status === 'CERTIFIED').length, effective_date_known: contributionPlans.filter((row) => row.effective_date).length, effective_date_uncertain: contributionPlans.filter((row) => !row.effective_date).length, process_or_other_conflicts: contributionPlans.filter((row) => row.status === 'CONFLICT').length, duplicates: contributionPlans.filter((row) => row.status === 'DUPLICATE').length },
    withdrawal_counts: withdrawalSummary,
    yield_legacy_counts: { records: yieldCandidates.length, credits_authorized: 0 },
    ambiguous_orphan_counts: { ambiguous: identities.AMBIGUOUS, orphan: identities.ORPHAN },
    analysis: {
      folios: { resolved: identityLists.RESOLVED, ambiguous: identityLists.AMBIGUOUS, orphan: identityLists.ORPHAN, duplicate_source: duplicates, invalid: invalidFolios },
      start_dates: { counts: startCounts, certified: startLists.START_DATE_CERTIFIED, inferred: startLists.START_DATE_INFERRED, missing: startLists.START_DATE_MISSING, conflicts: startLists.START_DATE_CONFLICT },
      processes: { counts: processCounts, conflicts: processLists.CONFLICT, unknown: processLists.UNKNOWN, lowercase_jub_rows: importRows.filter((row) => text(row.cells[3]) === 'jub').length },
      contribution_plans: contributionPlans, initial_plan_candidates: initialPlanCandidates, amount_changes: { counts: changeSummary, candidates: changeCandidates },
      historical_dated_values: dated, expected_actual_boundary: { historical_legacy_reinterpreted: false, new_operational_rule_applied_to_legacy: false },
      legacy_q: qSummary, contribution_candidates: contributionCandidates, withdrawal_candidates: withdrawalCandidates,
      yield_legacy: { columns: yieldSummary, candidates: yieldCandidates, credits_authorized: 0 },
      beneficiaries: { source_found: false, records: 0, invented: 0 },
      balance_reconstruction: { rows: balancePreview, match: balancePreview.filter((row) => row.classification === 'MATCH').length, mismatch: mismatches.length, pending_review: mismatches.length, insufficient_evidence: balancePreview.filter((row) => row.classification === 'INSUFFICIENT_EVIDENCE').length, mismatches, previous_mismatch_count: 21, current_mismatch_count: mismatches.length, previous_exact_folio_set_available: false, previous_21_mismatches_still_present: 'NOT_VERIFIABLE' },
      identity: { counts: identities, candidate_links_only: true, automatic_resolution: false },
    },
    snapshot,
    ready_for_owner_review: true, ready_for_apply: false,
    apply_blockers: ['AUTHORITATIVE_BALANCE_UNRESOLVED', 'CONTRIBUTION_AUTHORITY_UNRESOLVED', 'SOURCE_CHANGED', 'PREVIOUS_MISMATCH_SET_NOT_AVAILABLE', 'MIGRATION_NOT_APPLIED'],
    exact_next_authorization_required: 'AUTORIZO APLICAR EN PRODUCCIÓN ÚNICAMENTE LA MIGRACIÓN 20260902000100_savings_shadow_foundation.sql, SIN IMPORTAR DATOS, SIN CUTOVER, SIN ESCRIBIR GOOGLE Y SIN ACTIVAR RENDIMIENTOS; VERIFICA Y DETENTE.',
  };
  const normalizedManifest = JSON.parse(JSON.stringify(manifest));
  normalizedManifest.manifest_sha256 = sha256(canonical(normalizedManifest));
  return normalizedManifest;
}

function main() {
  const sourcePath = path.resolve(process.argv[2] || '');
  const outputPath = path.resolve(process.argv[3] || '');
  assert(process.argv[2] && process.argv[3], 'USAGE', 'node scripts/build-savings-shadow-certified-manifest.js <source-projection.json> <manifest.json>');
  const manifest = build(JSON.parse(fs.readFileSync(sourcePath, 'utf8')));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(JSON.stringify({
    status: 'PASS', mode: 'DRY_RUN_MANIFEST_BUILD', source_projection_sha256: manifest.source_projection_sha256,
    source_snapshot_sha256: manifest.source_snapshot_sha256, manifest_sha256: manifest.manifest_sha256,
    source_changed: manifest.source_changed_since_forensic_audit, folio_counts: manifest.folio_counts,
    candidate_counts: manifest.transaction_candidate_counts, import_counts: Object.fromEntries(Object.entries(manifest.snapshot).map(([key, rows]) => [key, rows.length])),
    ready_for_owner_review: manifest.ready_for_owner_review, ready_for_apply: manifest.ready_for_apply, writes: 0,
  }, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { build, VERSION, SCHEMA_VERSION };
