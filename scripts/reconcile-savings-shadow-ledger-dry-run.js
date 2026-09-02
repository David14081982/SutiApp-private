#!/usr/bin/env node
'use strict';

/*
 * Deterministic, read-only Savings ledger reconstruction over the certified
 * Supabase SHADOW capture. It does not connect to Google or Supabase and does
 * not create canonical transactions, yield credits, plans, or enrollments.
 */

const fs = require('fs');
const path = require('path');
const { canonical, sha256 } = require('./import-savings-shadow.js');
const {
  BATCH_ID,
  MANIFEST_SHA256,
  TABLES,
} = require('./capture-savings-shadow-ledger-readonly.js');

const VERSION = 'SAVINGS_LEDGER_RECONCILIATION_DRY_RUN_V1';
const SOURCE_VERSION = 'SAVINGS_LEDGER_RECONCILIATION_SOURCE_V1';
const AS_OF_DATE = '2026-09-02';
const EXPECTED_COUNTS = Object.freeze({
  savings_import_batches: 1,
  savings_participants: 363,
  savings_enrollments: 0,
  savings_contribution_plans: 0,
  savings_contribution_overrides: 0,
  savings_transactions: 0,
  savings_action_availability: 0,
  savings_beneficiary_versions: 0,
  savings_beneficiaries: 0,
  savings_requests: 0,
  savings_request_approvals: 0,
  savings_holds: 0,
  savings_yield_periods: 0,
  savings_yield_allocations: 0,
  savings_process_change_events: 0,
  savings_legacy_evidence: 42229,
  savings_audit_events: 1,
});

function assert(condition, code, details) {
  if (!condition) {
    const error = new Error(code + (details != null ? `:${details}` : ''));
    error.code = code;
    throw error;
  }
}

function round(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function numeric(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

function folio(value) {
  const found = text(value);
  if (!found) return null;
  return /^\d+(?:\.0+)?$/.test(found) ? String(Math.trunc(Number(found))) : found;
}

function bool(value) {
  if (typeof value === 'boolean') return value;
  const found = text(value).toUpperCase();
  if (['TRUE', 'SI', 'SÍ', 'YES'].includes(found)) return true;
  if (['FALSE', 'NO'].includes(found)) return false;
  return null;
}

function isoDate(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86400000));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function priorDay(iso) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function normalizeProcess(value) {
  const found = text(value).toUpperCase().replace(/[ -]+/g, '_');
  if (found === 'JUB' || found.includes('JUBIL')) return 'JUB';
  if (['1', 'PROCESS_1', 'PROCESO_1'].includes(found)) return 'PROCESS_1';
  if (['3', 'PROCESS_3', 'PROCESO_3'].includes(found)) return 'PROCESS_3';
  return null;
}

function values(evidence) {
  return Array.isArray(evidence.raw_payload && evidence.raw_payload.values)
    ? evidence.raw_payload.values
    : [];
}

function countBy(rows, selector) {
  return rows.reduce((out, row) => {
    const key = selector(row) || 'UNKNOWN';
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

function sum(rows, selector) {
  return round(rows.reduce((total, row) => total + Number(selector(row) || 0), 0));
}

function groupBy(rows, selector) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = selector(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });
  return grouped;
}

function evidenceId(evidence) {
  return sha256(canonical([
    evidence.source_sheet,
    evidence.source_column,
    evidence.source_row,
    evidence.legacy_folio,
    evidence.observed_on,
    evidence.numeric_value,
    evidence.source_row_sha256,
  ]));
}

function readCapture(file) {
  const capture = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(capture.version === SOURCE_VERSION, 'SAVINGS_CAPTURE_VERSION_INVALID');
  assert(capture.batch_id === BATCH_ID, 'SAVINGS_CAPTURE_BATCH_INVALID');
  assert(capture.manifest_sha256 === MANIFEST_SHA256, 'SAVINGS_CAPTURE_MANIFEST_INVALID');
  assert(canonical(capture.counts_before) === canonical(EXPECTED_COUNTS), 'SAVINGS_CAPTURE_COUNTS_BEFORE_INVALID');
  assert(canonical(capture.counts_after) === canonical(EXPECTED_COUNTS), 'SAVINGS_CAPTURE_COUNTS_AFTER_INVALID');
  assert(capture.operations && capture.operations.supabase_writes === 0 && capture.operations.google_requests === 0, 'SAVINGS_CAPTURE_NOT_READ_ONLY');
  assert(capture.capture_sha256 === sha256(canonical(capture.financial_state)), 'SAVINGS_CAPTURE_HASH_INVALID');
  return capture;
}

function buildPlanSegments(initialRows, changeRows, participantByFolio) {
  const raw = [];
  initialRows.forEach((evidence) => {
    const row = values(evidence);
    const key = folio(row[0]) || folio(evidence.legacy_folio);
    const participant = participantByFolio.get(key);
    const effectiveDate = isoDate(row[2]);
    const amount = numeric(row[4]);
    const process = participant ? participant.legacy_process : null;
    const derivable = !!participant && !!effectiveDate && amount > 0 && !!process;
    raw.push({
      legacy_folio: key,
      source: 'SOLICITUD_DE_AHORRO',
      source_row: evidence.source_row,
      source_hash: evidence.source_row_sha256,
      effective_from: effectiveDate,
      effective_to: null,
      amount: amount == null ? null : round(amount),
      old_amount: null,
      applied: null,
      process,
      evidence_status: derivable ? 'DERIVABLE' : 'PENDING_REVIEW',
      confidence: derivable ? 'MEDIUM' : 'LOW',
      reason: !participant ? 'FOLIO_NOT_IN_SHADOW' : !effectiveDate ? 'EFFECTIVE_DATE_MISSING' : !(amount > 0) ? 'AMOUNT_INVALID' : !process ? 'PROCESS_MISSING_OR_CONFLICT' : null,
    });
  });

  const seenChanges = new Set();
  changeRows.forEach((evidence) => {
    const row = values(evidence);
    const key = folio(row[0]) || folio(evidence.legacy_folio);
    const participant = participantByFolio.get(key);
    const effectiveDate = isoDate(row[1]);
    const oldAmount = numeric(row[2]);
    const newAmount = numeric(row[3]);
    const applied = bool(row[4]);
    const businessKey = canonical([key, effectiveDate, oldAmount, newAmount, applied]);
    const duplicate = seenChanges.has(businessKey);
    seenChanges.add(businessKey);
    const process = participant ? participant.legacy_process : null;
    let reason = null;
    if (duplicate) reason = 'DUPLICATE_BUSINESS_KEY';
    else if (!participant) reason = 'FOLIO_NOT_IN_SHADOW';
    else if (!effectiveDate) reason = 'EFFECTIVE_DATE_MISSING';
    else if (!(newAmount > 0)) reason = 'NEW_AMOUNT_INVALID';
    else if (applied !== true) reason = 'CHANGE_NOT_DEMONSTRABLY_APPLIED';
    else if (oldAmount != null && round(oldAmount) === round(newAmount)) reason = 'NO_EFFECTIVE_AMOUNT_CHANGE';
    else if (!process) reason = 'PROCESS_MISSING_OR_CONFLICT';
    const derivable = reason == null;
    raw.push({
      legacy_folio: key,
      source: 'SOLICITUD_CAMBIO_AHORRO',
      source_row: evidence.source_row,
      source_hash: evidence.source_row_sha256,
      effective_from: effectiveDate,
      effective_to: null,
      amount: newAmount == null ? null : round(newAmount),
      old_amount: oldAmount == null ? null : round(oldAmount),
      applied,
      process,
      evidence_status: derivable ? 'DERIVABLE' : 'PENDING_REVIEW',
      confidence: derivable ? 'MEDIUM' : 'LOW',
      reason,
    });
  });

  const byFolio = groupBy(raw.filter((row) => row.legacy_folio), (row) => row.legacy_folio);
  byFolio.forEach((rows) => {
    const derivable = rows
      .filter((row) => row.evidence_status === 'DERIVABLE')
      .sort((a, b) => a.effective_from.localeCompare(b.effective_from) || a.source_row - b.source_row);
    for (let index = 0; index < derivable.length; index += 1) {
      const current = derivable[index];
      const next = derivable[index + 1];
      if (!next) continue;
      if (next.effective_from === current.effective_from) {
        current.evidence_status = 'PENDING_REVIEW';
        current.confidence = 'LOW';
        current.reason = 'OVERLAPPING_EFFECTIVE_DATE';
        next.evidence_status = 'PENDING_REVIEW';
        next.confidence = 'LOW';
        next.reason = 'OVERLAPPING_EFFECTIVE_DATE';
      } else {
        current.effective_to = priorDay(next.effective_from);
      }
    }
  });
  return raw.sort((a, b) => String(a.legacy_folio).localeCompare(String(b.legacy_folio)) || String(a.effective_from).localeCompare(String(b.effective_from)) || a.source_row - b.source_row);
}

function reconcile(runOne, runTwo) {
  assert(runOne.capture_sha256 === runTwo.capture_sha256, 'SAVINGS_CAPTURE_NOT_STABLE');
  assert(canonical(runOne.financial_state) === canonical(runTwo.financial_state), 'SAVINGS_FINANCIAL_STATE_NOT_STABLE');
  const state = runOne.financial_state;
  assert(state.batch.id === BATCH_ID && state.batch.source_snapshot_sha256 === MANIFEST_SHA256, 'SAVINGS_SOURCE_BATCH_MISMATCH');
  assert(state.batch.certification_status === 'CERTIFIED' && state.batch.status === 'APPLIED', 'SAVINGS_SOURCE_BATCH_NOT_CERTIFIED');
  assert(state.participants.length === 363 && state.evidence.length === 42229, 'SAVINGS_SOURCE_COUNTS_INVALID');

  const evidence = state.evidence.slice();
  const participantEvidence = evidence.filter((row) => row.source_sheet === 'Ahorro' && row.record_type === 'PARTICIPANT');
  const invalidParticipantEvidence = participantEvidence.filter((row) => row.raw_payload && row.raw_payload.invalid_test === true);
  assert(invalidParticipantEvidence.length === 1, 'SAVINGS_INVALID_TEST_COUNT_INVALID');

  const participantEvidenceByFolio = new Map(participantEvidence.filter((row) => !(row.raw_payload && row.raw_payload.invalid_test)).map((row) => [folio(row.legacy_folio), row]));
  const enrollmentByFolio = new Map(evidence.filter((row) => row.source_sheet === 'Ahorro' && row.record_type === 'ENROLLMENT' && participantEvidenceByFolio.has(folio(row.legacy_folio))).map((row) => [folio(row.legacy_folio), row]));
  const qEvidence = evidence.filter((row) => row.source_sheet === 'Ahorro' && row.record_type === 'LEGACY_REPORTED_BALANCE' && row.source_column === 'Q' && participantEvidenceByFolio.has(folio(row.legacy_folio)));
  assert(qEvidence.length === 363, 'SAVINGS_Q_EVIDENCE_COUNT_INVALID');
  const qValue = (row) => numeric(row.numeric_value) ?? numeric(row.raw_payload && row.raw_payload.legacy_reported_balance && row.raw_payload.legacy_reported_balance.value);
  const qByFolio = new Map(qEvidence.map((row) => [folio(row.legacy_folio), qValue(row)]));
  const participantByFolio = new Map();
  const participants = state.participants.map((participant) => {
    const key = folio(participant.legacy_folio);
    const participantSource = participantEvidenceByFolio.get(key);
    const enrollmentSource = enrollmentByFolio.get(key);
    assert(participantSource && enrollmentSource, 'SAVINGS_PARTICIPANT_EVIDENCE_MISSING', key);
    const rawParticipant = participantSource.raw_payload || {};
    const rawEnrollment = enrollmentSource.raw_payload || {};
    const processStatusRaw = text(rawParticipant.process_status).toUpperCase();
    const certifiedProcesses = ['JUB', 'PROCESS_1', 'PROCESS_3'];
    const process = certifiedProcesses.includes(processStatusRaw) ? processStatusRaw : null;
    const processStatus = certifiedProcesses.includes(processStatusRaw) || ['CONFLICT', 'INVALID'].includes(processStatusRaw)
      ? processStatusRaw
      : 'UNKNOWN';
    const rawStartStatus = text(rawEnrollment.start_date_status).toUpperCase();
    const startStatus = rawStartStatus.replace(/^START_DATE_/, '') || 'MISSING';
    const record = {
      legacy_folio: key,
      identity_status: participant.identity_status,
      legacy_process: process,
      process_evidence_status: processStatus,
      process_source: 'LEGACY_AHORRO_SNAPSHOT',
      start_date: isoDate(rawEnrollment.start_date),
      start_date_evidence_status: ['CERTIFIED', 'INFERRED', 'MISSING', 'CONFLICT'].includes(startStatus) ? startStatus : 'MISSING',
      enrollment_status: text(rawEnrollment.status) || null,
      legacy_reported_balance: qByFolio.get(key),
      participant_source_hash: participantSource.source_row_sha256,
      enrollment_source_hash: enrollmentSource.source_row_sha256,
    };
    participantByFolio.set(key, record);
    return record;
  }).sort((a, b) => a.legacy_folio.localeCompare(b.legacy_folio));
  assert(participantByFolio.size === 363, 'SAVINGS_PARTICIPANT_FOLIO_COUNT_INVALID');

  qEvidence.forEach((row) => {
    const participant = participantByFolio.get(folio(row.legacy_folio));
    assert(qValue(row) != null && round(qValue(row)) === round(participant.legacy_reported_balance), 'SAVINGS_Q_EVIDENCE_MISMATCH', participant.legacy_folio);
  });

  const allScheduleEvidence = evidence.filter((row) => row.source_sheet === 'Ahorro' && row.record_type === 'AA_DO_CELL');
  assert(allScheduleEvidence.length === 33852, 'SAVINGS_AA_DO_COUNT_INVALID');
  const historicalScheduleRecords = allScheduleEvidence.map((row) => {
    const key = folio(row.legacy_folio);
    const participantIncluded = participantByFolio.has(key);
    const amount = numeric(row.numeric_value);
    return {
      legacy_folio: key,
      date: isoDate(row.observed_on),
      value: amount == null ? null : round(amount),
      cell_kind: text(row.raw_payload && row.raw_payload.cell_kind).toUpperCase() || 'EMPTY',
      source_hash: row.source_row_sha256,
      evidence_id: evidenceId(row),
      financially_excluded: !participantIncluded,
    };
  });
  const includedSchedule = historicalScheduleRecords.filter((row) => !row.financially_excluded);
  assert(includedSchedule.length === 33759, 'SAVINGS_AA_DO_INCLUDED_COUNT_INVALID');

  const reportRows = evidence.filter((row) => row.source_sheet === 'Reporte Ahorro' && row.record_type === 'REPORT');
  assert(reportRows.length === 4049, 'SAVINGS_REPORT_AHORRO_COUNT_INVALID');
  const reportMovements = reportRows.map((row) => {
    const raw = values(row);
    const key = folio(raw[0]) || folio(row.legacy_folio);
    const date = isoDate(raw[1]);
    const amount = numeric(raw[2]);
    return {
      legacy_folio: key,
      date,
      amount: amount == null ? null : round(amount),
      status: text(raw[3]) || null,
      source_row: row.source_row,
      source_hash: row.source_row_sha256,
      valid_for_contrast: participantByFolio.has(key) && !!date && amount > 0,
    };
  });
  const validReportMovements = reportMovements.filter((row) => row.valid_for_contrast);
  const reportMatchQueues = groupBy(validReportMovements, (row) => canonical([row.legacy_folio, row.date, row.amount]));
  reportMatchQueues.forEach((rows) => rows.sort((a, b) => a.source_row - b.source_row));

  const pastPositiveSchedule = includedSchedule.filter((row) => row.date && row.date <= AS_OF_DATE && row.value > 0);
  const contributionCandidates = [];
  const scheduleOnly = [];
  const consumedReportRows = new Set();
  pastPositiveSchedule.forEach((scheduled) => {
    const key = canonical([scheduled.legacy_folio, scheduled.date, scheduled.value]);
    const match = (reportMatchQueues.get(key) || []).find((row) => !consumedReportRows.has(row.source_row));
    if (!match) {
      scheduleOnly.push({
        ...scheduled,
        classification: 'EXPECTED_SCHEDULE_EVIDENCE',
        expected_amount: scheduled.value,
        actual_amount: null,
        confidence: 'LOW',
        reason: 'NO_EXACT_REPORTE_AHORRO_CONTRAST',
      });
      return;
    }
    consumedReportRows.add(match.source_row);
    contributionCandidates.push({
      legacy_folio: scheduled.legacy_folio,
      contribution_date: scheduled.date,
      expected_amount: scheduled.value,
      actual_amount: match.amount,
      actual_amount_status: 'LEGACY_REPORTED_NOT_CANONICAL',
      cell_kind: scheduled.cell_kind,
      schedule_source_hash: scheduled.source_hash,
      report_source_hash: match.source_hash,
      classification: 'CONTRIBUTION_CANDIDATE',
      confidence: 'MEDIUM',
      materialization_authorized: false,
    });
  });
  const reportOnly = validReportMovements.filter((row) => !consumedReportRows.has(row.source_row)).map((row) => ({
    ...row,
    classification: 'REPORT_CONTRAST_ONLY',
    confidence: 'LOW',
    materialization_authorized: false,
  }));

  const withdrawalRows = evidence.filter((row) => row.source_sheet === 'Solicitud de retiro' && row.record_type === 'WITHDRAWAL');
  assert(withdrawalRows.length === 228, 'SAVINGS_WITHDRAWAL_EVIDENCE_COUNT_INVALID');
  const withdrawalBusinessKeys = new Set();
  const withdrawals = withdrawalRows.map((row) => {
    const raw = values(row);
    const key = folio(raw[0]) || folio(row.legacy_folio);
    const effectiveDate = isoDate(raw[3]);
    const category = text(raw[4]);
    const kind = /parcial/i.test(category) ? 'PARTIAL' : /complet|total/i.test(category) ? 'TOTAL' : 'UNKNOWN';
    const continuesSaving = bool(raw[5]);
    const amount = numeric(raw[6]);
    const businessKey = canonical([key, effectiveDate, kind, continuesSaving, amount]);
    const duplicate = withdrawalBusinessKeys.has(businessKey);
    withdrawalBusinessKeys.add(businessKey);
    let reason = null;
    if (duplicate) reason = 'DUPLICATE_BUSINESS_KEY';
    else if (!participantByFolio.has(key)) reason = 'FOLIO_NOT_IN_SHADOW';
    else if (!effectiveDate) reason = 'EFFECTIVE_DATE_MISSING';
    else if (!(amount > 0)) reason = 'AMOUNT_INVALID';
    else if (kind === 'UNKNOWN') reason = 'WITHDRAWAL_KIND_UNKNOWN';
    const candidate = reason == null;
    return {
      legacy_folio: key,
      effective_date: effectiveDate,
      amount: amount == null ? null : round(amount),
      withdrawal_kind: kind,
      continues_saving: continuesSaving,
      savings_outcome: kind === 'TOTAL' && continuesSaving === false ? 'TERMINATE' : continuesSaving === true ? 'CONTINUE' : 'UNRESOLVED',
      legacy_status: text(raw[7]) || null,
      source_row: row.source_row,
      source_hash: row.source_row_sha256,
      classification: candidate ? 'WITHDRAWAL_CANDIDATE' : 'PENDING_REVIEW',
      confidence: candidate ? 'MEDIUM' : 'LOW',
      reason,
      materialization_authorized: false,
    };
  });
  const withdrawalCandidates = withdrawals.filter((row) => row.classification === 'WITHDRAWAL_CANDIDATE');

  const initialPlanRows = evidence.filter((row) => row.source_sheet === 'Solicitud de Ahorro' && row.record_type === 'REQUEST');
  const changeRows = evidence.filter((row) => row.source_sheet === 'Solicitud Cambio ahorro' && row.record_type === 'AMOUNT_CHANGE');
  assert(changeRows.length === 126, 'SAVINGS_AMOUNT_CHANGE_COUNT_INVALID');
  const planSegments = buildPlanSegments(initialPlanRows, changeRows, participantByFolio);

  const yieldEvidence = evidence.filter((row) => row.source_sheet === 'Ahorro' && row.record_type === 'DP_DW_CELL');
  assert(yieldEvidence.length === 1092, 'SAVINGS_DP_DW_COUNT_INVALID');
  const historicalYieldRecords = yieldEvidence.map((row) => {
    const raw = row.raw_payload || {};
    const key = folio(row.legacy_folio);
    const capital = numeric(raw.capital);
    const yieldAmount = numeric(raw.yield);
    const subtotal = numeric(raw.subtotal);
    const arithmeticallyConsistent = capital != null && yieldAmount != null && subtotal != null && Math.abs(round(capital + yieldAmount - subtotal)) <= 0.01;
    const explicitPeriod = raw.period === '2025' || raw.period === '2026' || raw.period === '2026-H1';
    const candidate = participantByFolio.has(key) && explicitPeriod && yieldAmount !== 0 && yieldAmount != null && arithmeticallyConsistent;
    return {
      legacy_folio: key,
      period: raw.period || null,
      capital: capital == null ? null : round(capital),
      yield: yieldAmount == null ? null : round(yieldAmount),
      subtotal: subtotal == null ? null : round(subtotal),
      capital_cell_kind: raw.capital_cell_kind || 'EMPTY',
      yield_cell_kind: raw.yield_cell_kind || 'EMPTY',
      subtotal_cell_kind: raw.subtotal_cell_kind || 'EMPTY',
      arithmetically_consistent: arithmeticallyConsistent,
      classification: candidate ? 'YIELD_CANDIDATE' : raw.period === 'CUMULATIVE' ? 'CUMULATIVE_CONTRAST_EXCLUDED' : 'RAW_LEGACY_YIELD_EVIDENCE',
      confidence: candidate ? 'MEDIUM' : 'LOW',
      source_hash: row.source_row_sha256,
      evidence_id: evidenceId(row),
      credit_authorized: false,
      financially_excluded: !participantByFolio.has(key),
    };
  });
  const yieldCandidates = historicalYieldRecords.filter((row) => row.classification === 'YIELD_CANDIDATE');

  const manualRows = evidence.filter((row) => row.source_sheet === 'Saldo manual' && row.record_type === 'LEGACY_REPORTED_BALANCE');
  assert(manualRows.length === 1, 'SAVINGS_MANUAL_BALANCE_EVIDENCE_COUNT_INVALID');
  const attributableManualRows = manualRows.map((row) => {
    const raw = values(row);
    return { legacy_folio: folio(raw[0]) || folio(row.legacy_folio), added: numeric(raw[2]), withdrawn: numeric(raw[3]), total: numeric(raw[4]), source_hash: row.source_row_sha256 };
  }).filter((row) => participantByFolio.has(row.legacy_folio) && row.total != null);
  assert(attributableManualRows.length === 0, 'SAVINGS_UNEXPECTED_ATTRIBUTABLE_MANUAL_BALANCE');

  const reportsByFolio = groupBy(validReportMovements, (row) => row.legacy_folio);
  const withdrawalsByFolio = groupBy(withdrawalCandidates, (row) => row.legacy_folio);
  const yieldsByFolio = groupBy(yieldCandidates, (row) => row.legacy_folio);
  const balances = participants.map((participant) => {
    const key = participant.legacy_folio;
    const capital = sum(reportsByFolio.get(key) || [], (row) => row.amount);
    const withdrawalTotal = sum(withdrawalsByFolio.get(key) || [], (row) => row.amount);
    const yieldTotal = sum(yieldsByFolio.get(key) || [], (row) => row.yield);
    const manualAdjustment = 0;
    const candidateTotal = round(capital + manualAdjustment - withdrawalTotal);
    const q = participant.legacy_reported_balance;
    const difference = q == null ? null : round(candidateTotal - q);
    let financialClassification = 'INSUFFICIENT_EVIDENCE';
    if (difference != null && difference === 0) financialClassification = 'EXACT_MATCH';
    else if (difference != null && Math.abs(difference) <= 0.01) financialClassification = 'ROUNDING_MATCH';
    else if (difference != null) financialClassification = 'MISMATCH';
    const identityClassification = participant.identity_status === 'RESOLVED' ? 'IDENTITY_RESOLVED' : 'IDENTITY_UNRESOLVED';
    const confidence = ['EXACT_MATCH', 'ROUNDING_MATCH'].includes(financialClassification) ? 'MEDIUM' : 'LOW';
    const reviewLane = financialClassification === 'MISMATCH' || financialClassification === 'INSUFFICIENT_EVIDENCE' ? 'BLOCKED' : 'PENDING_REVIEW';
    let probableCause = null;
    if (financialClassification === 'MISMATCH') {
      if (/terminad/i.test(participant.enrollment_status || '') && q === 0 && capital > 0) probableCause = 'TERMINATED_ZERO_BALANCE_HISTORY_RETAINED';
      else if (withdrawalTotal > 0) probableCause = 'LEGACY_PROJECTION_OR_WITHDRAWAL_RECONSTRUCTION';
      else probableCause = 'LEGACY_Q_VS_REPORTE_AHORRO_CONTRAST';
    }
    const record = {
      legacy_folio: key,
      identity_status: participant.identity_status,
      identity_classification: identityClassification,
      candidate_capital: capital,
      candidate_capital_basis: 'REPORTE_AHORRO_CONTRAST_NOT_CANONICAL_LEDGER',
      candidate_yield: yieldTotal,
      yield_included_in_candidate_total: false,
      candidate_withdrawals: withdrawalTotal,
      candidate_manual_adjustment: manualAdjustment,
      manual_adjustment_evidence_status: 'MISSING_UNATTRIBUTABLE',
      candidate_total: candidateTotal,
      legacy_reported_balance_Q: q == null ? null : round(q),
      difference_candidate_minus_Q: difference,
      financial_classification: financialClassification,
      confidence,
      review_lane: reviewLane,
      probable_cause: probableCause,
      correction_applied: false,
    };
    record.record_sha256 = sha256(canonical(record));
    return record;
  });
  const mismatches = balances.filter((row) => row.financial_classification === 'MISMATCH');
  assert(mismatches.length === 20, 'SAVINGS_EXPECTED_20_MISMATCHES_NOT_REPRODUCED', mismatches.length);

  const reportRhRows = evidence.filter((row) => row.source_sheet === 'Reporte - RH' && row.record_type === 'REPORT');
  assert(reportRhRows.length === 320, 'SAVINGS_REPORT_RH_COUNT_INVALID');
  function reportIntegrity(rows, folioIndex) {
    const exactFolios = [...new Set(rows.map((row) => folio(values(row)[folioIndex]) || folio(row.legacy_folio)).filter(Boolean))].sort();
    const rowHashes = rows.map((row) => row.source_row_sha256).sort();
    return {
      rows: rows.length,
      unique_folios: exactFolios.length,
      exact_folios: exactFolios,
      exact_folio_set_sha256: sha256(canonical(exactFolios)),
      row_hashes: rowHashes,
      row_hash_set_sha256: sha256(canonical(rowHashes)),
    };
  }

  const mismatchCauseCounts = countBy(mismatches, (row) => row.probable_cause);
  const financialCounts = {
    EXACT_MATCH: balances.filter((row) => row.financial_classification === 'EXACT_MATCH').length,
    ROUNDING_MATCH: balances.filter((row) => row.financial_classification === 'ROUNDING_MATCH').length,
    MISMATCH: mismatches.length,
    INSUFFICIENT_EVIDENCE: balances.filter((row) => row.financial_classification === 'INSUFFICIENT_EVIDENCE').length,
  };
  const identityUnresolvedFinanciallyReconcilable = balances.filter((row) => row.identity_classification === 'IDENTITY_UNRESOLVED' && ['EXACT_MATCH', 'ROUNDING_MATCH'].includes(row.financial_classification));
  const confidenceCounts = countBy(balances, (row) => row.confidence);
  ['HIGH', 'MEDIUM', 'LOW'].forEach((level) => { if (!confidenceCounts[level]) confidenceCounts[level] = 0; });
  const reviewLaneCounts = countBy(balances, (row) => row.review_lane);
  reviewLaneCounts.CERTIFIABLE_NOW = 0;
  if (!reviewLaneCounts.PENDING_REVIEW) reviewLaneCounts.PENDING_REVIEW = 0;
  if (!reviewLaneCounts.BLOCKED) reviewLaneCounts.BLOCKED = 0;

  const result = {
    version: VERSION,
    as_of_date: AS_OF_DATE,
    mode: 'READ_ONLY_DRY_RUN_OVER_SUPABASE_SHADOW_EVIDENCE',
    source: {
      authority: 'GOOGLE_LEGACY_REMAINS_AUTHORITATIVE_SUPABASE_IS_SHADOW_ONLY',
      batch_id: BATCH_ID,
      manifest_sha256: MANIFEST_SHA256,
      capture_sha256: runOne.capture_sha256,
      stable_double_capture: true,
      capture_count: 2,
      table_counts_before: runOne.counts_before,
      table_counts_after: runTwo.counts_after,
    },
    controls: {
      google_reads: 0,
      google_writes: 0,
      supabase_raw_writes: 0,
      canonical_transactions_created: 0,
      yield_credits_created: 0,
      cutover: false,
      future_expected_actual_rule_applied_retroactively: false,
      report_ahorro_promoted_to_ledger: false,
      corrections_applied: 0,
    },
    population: {
      evidence_rows_analyzed: evidence.length,
      folios_evaluated: participants.length,
      invalid_test_rows_excluded: invalidParticipantEvidence.length,
      identity: countBy(participants, (row) => row.identity_status),
      historical_process: Object.assign({ JUB: 0, PROCESS_1: 0, PROCESS_3: 0, CONFLICT: 0, INVALID: 0, UNKNOWN: 0 }, countBy(participants, (row) => row.process_evidence_status)),
      start_date_evidence: Object.assign({ CERTIFIED: 0, INFERRED: 0, MISSING: 0, CONFLICT: 0 }, countBy(participants, (row) => row.start_date_evidence_status)),
    },
    evidence_summary: {
      aa_do: {
        analyzed: allScheduleEvidence.length,
        financially_included: includedSchedule.length,
        financially_excluded_invalid_test: allScheduleEvidence.length - includedSchedule.length,
        cell_kind: countBy(allScheduleEvidence, (row) => row.raw_payload && row.raw_payload.cell_kind),
        past_positive_expected_records: pastPositiveSchedule.length,
        exact_report_contrast_candidates: contributionCandidates.length,
        schedule_only_records: scheduleOnly.length,
        report_only_contrast_rows: reportOnly.length,
      },
      withdrawals: {
        analyzed: withdrawals.length,
        candidates: withdrawalCandidates.length,
        pending_review: withdrawals.length - withdrawalCandidates.length,
        partial: withdrawals.filter((row) => row.withdrawal_kind === 'PARTIAL').length,
        total: withdrawals.filter((row) => row.withdrawal_kind === 'TOTAL').length,
        continue: withdrawals.filter((row) => row.savings_outcome === 'CONTINUE').length,
        terminate: withdrawals.filter((row) => row.savings_outcome === 'TERMINATE').length,
        duplicates_excluded: withdrawals.filter((row) => row.reason === 'DUPLICATE_BUSINESS_KEY').length,
      },
      plan_segments: {
        initial_request_rows: initialPlanRows.length,
        amount_change_rows: changeRows.length,
        records_analyzed: planSegments.length,
        candidate_segments: planSegments.filter((row) => row.evidence_status === 'DERIVABLE').length,
        derivable: planSegments.filter((row) => row.evidence_status === 'DERIVABLE').length,
        pending_review: planSegments.filter((row) => row.evidence_status !== 'DERIVABLE').length,
        reason_counts: countBy(planSegments.filter((row) => row.reason), (row) => row.reason),
      },
      yields: {
        analyzed: historicalYieldRecords.length,
        candidates: yieldCandidates.length,
        explicit_nonzero_pending_review: historicalYieldRecords.filter((row) => ['2025', '2026', '2026-H1'].includes(row.period) && row.yield !== 0 && row.yield != null && row.classification !== 'YIELD_CANDIDATE').length,
        cumulative_records_excluded: historicalYieldRecords.filter((row) => String(row.period || '').startsWith('CUMULATIVE')).length,
        credits_created: 0,
      },
      reports: {
        reporte_ahorro: reportIntegrity(reportRows, 0),
        reporte_rh: reportIntegrity(reportRhRows, 2),
        usage: 'CONTRAST_ONLY_NOT_AUTOMATIC_LEDGER',
      },
    },
    reconciliation_summary: {
      financial_classification: financialCounts,
      identity_unresolved_but_financially_reconcilable: identityUnresolvedFinanciallyReconcilable.length,
      confidence: confidenceCounts,
      review_lanes: reviewLaneCounts,
      total_Q: sum(balances, (row) => row.legacy_reported_balance_Q),
      total_candidate_capital: sum(balances, (row) => row.candidate_capital),
      total_candidate_yield_not_in_Q_comparison: sum(balances, (row) => row.candidate_yield),
      total_candidate_withdrawals: sum(balances, (row) => row.candidate_withdrawals),
      total_candidate: sum(balances, (row) => row.candidate_total),
      total_difference_candidate_minus_Q: sum(balances, (row) => row.difference_candidate_minus_Q),
      mismatches_expected: 20,
      mismatches_reproduced: mismatches.length,
      mismatches_conclusively_explained: 0,
      mismatches_grouped_by_probable_cause: mismatches.length,
      mismatches_unresolved: mismatches.length,
      probable_cause_counts: mismatchCauseCounts,
      exact_mismatch_folio_set_sha256: sha256(canonical(mismatches.map((row) => row.legacy_folio).sort())),
    },
    safety_verdict: {
      safe_to_materialize_high_confidence_ledger: false,
      safe_to_make_supabase_authoritative: false,
      reason: 'NO_HIGH_CONFIDENCE_ACTUAL_CONTRIBUTION_AUTHORITY_AND_20_UNRESOLVED_MISMATCHES',
      next_step: 'H-SAVINGS-MISMATCH-EVIDENCE-RESOLUTION-001: confirm Reporte Ahorro movement semantics and resolve the 20 private mismatch cases without writes before proposing any materialization.',
    },
    private_detail: {
      participants,
      historical_schedule_records: historicalScheduleRecords,
      contribution_candidates: contributionCandidates,
      expected_schedule_only: scheduleOnly,
      report_movements_contrast: reportMovements,
      report_only_contrast: reportOnly,
      withdrawals,
      plan_segments: planSegments,
      historical_yield_records: historicalYieldRecords,
      balances,
      mismatches,
      identity_unresolved_but_financially_reconcilable: identityUnresolvedFinanciallyReconcilable.map((row) => row.legacy_folio),
    },
  };
  result.reconciliation_sha256 = sha256(canonical(result));
  return result;
}

function publicSummary(result) {
  return {
    version: result.version,
    as_of_date: result.as_of_date,
    mode: result.mode,
    source: result.source,
    controls: result.controls,
    population: result.population,
    evidence_summary: {
      ...result.evidence_summary,
      reports: {
        reporte_ahorro: {
          rows: result.evidence_summary.reports.reporte_ahorro.rows,
          unique_folios: result.evidence_summary.reports.reporte_ahorro.unique_folios,
          exact_folio_set_sha256: result.evidence_summary.reports.reporte_ahorro.exact_folio_set_sha256,
          row_hash_set_sha256: result.evidence_summary.reports.reporte_ahorro.row_hash_set_sha256,
        },
        reporte_rh: {
          rows: result.evidence_summary.reports.reporte_rh.rows,
          unique_folios: result.evidence_summary.reports.reporte_rh.unique_folios,
          exact_folio_set_sha256: result.evidence_summary.reports.reporte_rh.exact_folio_set_sha256,
          row_hash_set_sha256: result.evidence_summary.reports.reporte_rh.row_hash_set_sha256,
        },
        usage: result.evidence_summary.reports.usage,
      },
    },
    reconciliation_summary: result.reconciliation_summary,
    safety_verdict: result.safety_verdict,
    reconciliation_sha256: result.reconciliation_sha256,
  };
}

function main() {
  const sourceOnePath = path.resolve(process.argv[2] || '');
  const sourceTwoPath = path.resolve(process.argv[3] || '');
  const outputPath = path.resolve(process.argv[4] || '');
  const summaryPath = path.resolve(process.argv[5] || '');
  assert(process.argv[2] && process.argv[3] && process.argv[4] && process.argv[5], 'USAGE', 'node scripts/reconcile-savings-shadow-ledger-dry-run.js <capture-1.json> <capture-2.json> <private-output.json> <public-summary.json>');
  const result = reconcile(readCapture(sourceOnePath), readCapture(sourceTwoPath));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result) + '\n', { mode: 0o600 });
  fs.writeFileSync(summaryPath, JSON.stringify(publicSummary(result), null, 2) + '\n', { mode: 0o600 });
  process.stdout.write(JSON.stringify({
    status: 'PASS',
    mode: result.mode,
    reconciliation_sha256: result.reconciliation_sha256,
    folios_evaluated: result.population.folios_evaluated,
    invalid_test_excluded: result.population.invalid_test_rows_excluded,
    financial_classification: result.reconciliation_summary.financial_classification,
    candidate_counts: {
      contributions: result.evidence_summary.aa_do.exact_report_contrast_candidates,
      withdrawals: result.evidence_summary.withdrawals.candidates,
      yields: result.evidence_summary.yields.candidates,
      plan_segments: result.evidence_summary.plan_segments.candidate_segments,
    },
    google_writes: result.controls.google_writes,
    supabase_writes: result.controls.supabase_raw_writes,
    canonical_transactions: result.controls.canonical_transactions_created,
    cutover: result.controls.cutover,
  }, null, 2) + '\n');
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(JSON.stringify({ status: 'FAIL', error: error.message, google_writes: 0, supabase_writes: 0, canonical_transactions: 0, cutover: false }));
    process.exitCode = 1;
  }
}

module.exports = { reconcile, readCapture, publicSummary, VERSION, AS_OF_DATE, EXPECTED_COUNTS, TABLES };
