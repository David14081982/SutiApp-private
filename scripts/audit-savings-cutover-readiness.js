'use strict';
// Read-only audit of privately captured sources. Never imports or certifies money.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CLEARED = new Set(['LIQUIDADO', 'PAGÓ DE MÁS']);
function exact(value) { return typeof value === 'string' && value.length > 0 ? value : null; }
function cents(value, blankIsZero = false) {
  if (value === '' || value == null) return blankIsZero ? 0 : null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const number = Number(raw);
  if (!Number.isFinite(number) || !Number.isSafeInteger(Math.round(number * 100))) return null;
  return Math.round((number + Math.sign(number) * Number.EPSILON) * 100);
}
function col(name) { return [...name].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1; }
function excelDate(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10) : null;
}
function group(items, key) {
  const groups = new Map();
  for (const item of items) { const k = key(item); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(item); }
  return groups;
}
function summarizeLoans(rows) {
  const missing = rows.filter(row => !exact(row.id));
  const loans = [...group(rows.filter(row => exact(row.id)), row => row.id)].map(([id, entries]) => {
    const folios = [...new Set(entries.map(row => exact(row.folio)))];
    // Preserve the source spelling: variants and blank statuses require review.
    const statuses = [...new Set(entries.map(row => row.status == null ? '' : row.status))];
    const issues = [];
    if (folios.length !== 1 || folios[0] === null) issues.push('LOAN_FOLIO_CONFLICT_OR_MISSING');
    if (statuses.length !== 1) issues.push('LOAN_STATUS_CONFLICT');
    if (statuses.includes('')) issues.push('LOAN_STATUS_MISSING');
    return { id, folios, statuses, source_rows: entries.map(row => row.row), issues,
      outcome: issues.length ? 'REVIEW_REQUIRED' : CLEARED.has(statuses[0]) ? 'CLEARED' : 'NOT_CLEARED' };
  });
  const byFolio = new Map();
  for (const loan of loans) for (const folio of loan.folios.filter(Boolean)) {
    if (!byFolio.has(folio)) byFolio.set(folio, []); byFolio.get(folio).push(loan);
  }
  return { loans, missing, byFolio };
}
function loanOutcome(folio, data) {
  const loans = data.byFolio.get(folio) || [];
  const unidentified = data.missing.some(row => !exact(row.folio) || row.folio === folio) || data.loans.some(row => row.folios.includes(null));
  if (unidentified || loans.some(row => row.outcome === 'REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  if (loans.some(row => row.outcome === 'NOT_CLEARED')) return 'NOT_CLEARED';
  return loans.length ? 'ALL_RECORDED_LOANS_CLEARED' : 'NO_RECORDED_LOAN';
}
function loanRows(snapshot) {
  const cells = new Map();
  const seen = { ids: new Set(), status: new Set() };
  for (const capture of snapshot.loans) {
    const kind = /!C\d+:D\d+$/.test(capture.range) ? 'ids' : /!X\d+:X\d+$/.test(capture.range) ? 'status' : null;
    if (!kind) throw new Error('UNEXPECTED_LOAN_RANGE');
    if (capture.values.length !== capture.end - capture.start + 1) throw new Error('INCOMPLETE_LOAN_CAPTURE');
    for (let row = Math.max(2, capture.start); row <= capture.end; row++) {
      if (seen[kind].has(row)) throw new Error('OVERLAPPING_LOAN_CAPTURE');
      seen[kind].add(row);
      const item = cells.get(row) || { row };
      const values = capture.values[row - capture.start] || [];
      if (kind === 'ids') { item.id = values[0]; item.folio = values[1]; } else item.status = values[0];
      cells.set(row, item);
    }
  }
  const max = Math.max(1, ...cells.keys());
  for (let row = 2; row <= max; row++) if (!seen.ids.has(row) || !seen.status.has(row)) throw new Error('LOAN_CAPTURE_GAP');
  if (max === 1) throw new Error('LOAN_CAPTURE_EMPTY');
  return [...cells.values()].sort((a, b) => a.row - b.row);
}
function audit(snapshot, database) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.as_of)) throw new Error('AS_OF_REQUIRED');
  const captures = snapshot.savings.filter(row => row.sheet === 'Ahorro');
  const identities = captures.find(row => /!A1:A\d+$/.test(row.range));
  const finances = captures.find(row => /!D1:DW\d+$/.test(row.range));
  if (!identities || !finances || identities.values.length !== finances.values.length) throw new Error('SAVINGS_CAPTURE_MISMATCH');
  const affiliates = group(database.affiliates, row => exact(row.numero_control));
  const imported = group(database.participants, row => exact(row.legacy_folio));
  const balanceEvidence = group(database.balance_evidence || [], row => row.participant_id);
  const sourceFolios = group(identities.values.slice(1).map((values, index) => ({ folio: exact(values[0]), row: index + 2 })), row => row.folio);
  const loans = summarizeLoans(loanRows(snapshot));
  const headers = finances.values[0];
  const rows = [];
  for (let i = 1; i < identities.values.length; i++) {
    const folio = exact(identities.values[i][0]), source = finances.values[i] || [];
    const value = name => source[col(name) - col('D')];
    const amount = (name, empty = false) => cents(value(name), empty);
    const issues = [];
    if (!folio) issues.push('FOLIO_MISSING_OR_NOT_TEXT');
    if (folio && folio !== folio.trim()) issues.push('FOLIO_WHITESPACE_REVIEW');
    if ((sourceFolios.get(folio) || []).length > 1) issues.push('DUPLICATE_SAVINGS_FOLIO');
    const matches = folio ? affiliates.get(folio) || [] : [];
    const prior = folio ? imported.get(folio) || [] : [];
    const identity = !matches.length ? 'SIN REGISTRO' : matches.length > 1 ? 'DUPLICADO' : matches[0].is_archived ? 'ARCHIVED' : 'EXACT_UNIQUE';
    if (identity !== 'EXACT_UNIQUE') issues.push('IDENTITY_' + identity.replace(/ /g, '_'));
    if (!['1','3','JUB'].includes(String(value('D')).toUpperCase())) issues.push('PROCESS_REVIEW');
    if (prior.length > 1) issues.push('DUPLICATE_IMPORTED_FOLIO');
    if (prior.length === 1 && matches.length === 1 && prior[0].affiliate_id !== matches[0].id) issues.push('IMPORTED_LINK_MISMATCH');
    const q = amount('Q'), g = amount('G', true), o = amount('O', true), h = amount('H', true), w1 = amount('I', true), w2 = amount('J', true);
    const components = [g, o, h, w1, w2];
    const reconstructed = components.includes(null) ? null : g + o - h - w1 - w2;
    if (q === null) issues.push('Q_INVALID');
    if (reconstructed === null || q !== reconstructed) issues.push('Q_ARITHMETIC_REVIEW');
    if (o !== 0) issues.push('LEGACY_MANUAL_BALANCE_PRESENT');
    if (q < 0) issues.push('NEGATIVE_Q');
    const annual = {};
    for (const [target, left, right] of [['DR','DP','DQ'], ['DU','DS','DT'], ['DV','DP','DS'], ['DW','DQ','DT']]) {
      const values = [amount(target, true), amount(left, true), amount(right, true)];
      annual[target] = values.includes(null) ? null : values[0] - values[1] - values[2];
      if (annual[target] !== 0) issues.push('ANNUAL_' + target + '_REVIEW');
    }
    let included = 0, future = 0, invalidMatrix = false;
    const start = excelDate(value('X'));
    for (let index = col('AA') - col('D'); index <= col('DO') - col('D'); index++) {
      const day = excelDate(headers[index]), money = cents(source[index], true);
      if (!day || money === null) { invalidMatrix = true; continue; }
      if (day > snapshot.as_of) future += money;
      if (start && value('W') === 'Ahorrando' && day >= start && day <= snapshot.as_of) included += money;
    }
    if (invalidMatrix) issues.push('MATRIX_VALUE_REVIEW');
    if (value('W') === 'Ahorrando' && !start) issues.push('START_DATE_REVIEW');
    if (g !== included) issues.push('G_DATED_MATRIX_REVIEW');
    const priorEvidence = prior.length === 1 ? (balanceEvidence.get(prior[0].id) || []).slice().sort((a,b) => b.source_row-a.source_row) : [];
    if (priorEvidence.length > 1) issues.push('MULTIPLE_IMPORTED_BALANCE_EVIDENCE');
    if (priorEvidence.some(row => row.legacy_folio !== folio)) issues.push('IMPORTED_EVIDENCE_FOLIO_MISMATCH');
    // Match the currently deployed reader's explicit legacy evidence projection.
    const priorRaw = prior.length === 1 ? prior[0].legacy_reported_balance ?? priorEvidence[0]?.numeric_value ?? priorEvidence[0]?.payload_balance : null;
    const priorBalance = cents(priorRaw);
    const change = q !== null && priorBalance !== null ? q - priorBalance : null;
    const septemberIndex = headers.findIndex(header => excelDate(header) === '2026-09-05');
    const septemberAmount = septemberIndex < 0 ? null : cents(source[septemberIndex], true);
    const debt = folio ? loanOutcome(folio, loans) : 'REVIEW_REQUIRED';
    rows.push({ source_row: i + 1, folio, identity, affiliate_match_count: matches.length,
      imported_count: prior.length, import_status: prior.length === 0 ? 'NOT_IMPORTED' : prior.length > 1 ? 'AMBIGUOUS_IMPORT' : change === null ? 'BALANCE_UNAVAILABLE' : change === 0 ? 'BALANCE_MATCH' : 'BALANCE_CHANGED',
      q_cents: q, q_reconstructed_cents: reconstructed, prior_balance_cents: priorBalance, difference_cents: change,
      imported_balance_evidence_count: priorEvidence.length,
      september5_cents: septemberAmount,
      difference_matches_september5: change !== null && change !== 0 && change === septemberAmount && String(value('D')).toUpperCase() === 'JUB',
      matrix_until_as_of_cents: included, future_projection_cents: future, annual_differences_cents: annual,
      june30_combined_cents: amount('AR', true), historical_yield_2026_cents: amount('DT', true),
      historical_withdrawals_cents: [h,w1,w2].includes(null) ? null : h+w1+w2,
      process: value('D'), savings_status: value('W'), loan_snapshot_outcome: debt,
      loan_ids: (loans.byFolio.get(folio) || []).map(row => row.id), issues,
      certification_status: 'NOT_CERTIFIED', credit_to_create_cents: null });
  }
  const countBy = (items, selector) => Object.fromEntries([...group(items, selector)].map(([key, values]) => [key, values.length]));
  const missingFromSource = database.participants.filter(row => !sourceFolios.has(exact(row.legacy_folio)));
  const allAmountsValid = rows.every(row => row.q_cents !== null);
  const relatedSheets = snapshot.savings.filter(capture => capture.sheet !== 'Ahorro').map(capture => {
    const entries = capture.values.slice(1);
    const populated = entries.filter(values => values.some(value => value !== '' && value != null));
    return { sheet: capture.sheet, captured_rows: entries.length, populated_rows: populated.length,
      empty_rows: entries.length-populated.length, rows_without_exact_text_folio: populated.filter(values => !exact(values[0])).length,
      unique_folios: new Set(populated.map(values => exact(values[0])).filter(Boolean)).size,
      rows_with_folio_not_in_ahorro: populated.filter(values => exact(values[0]) && !sourceFolios.has(values[0])).length,
      repeated_folios_are_not_automatically_duplicate_requests: true };
  });
  const summary = {
    as_of: snapshot.as_of, source_observed_at: snapshot.observed_at, database_observed_at: database.observed_at,
    source_rows: rows.length, imported_participants: database.participants.length, affiliate_rows: database.affiliates.length,
    identity: countBy(rows, row => row.identity), imports: countBy(rows, row => row.import_status),
    processes: countBy(rows, row => String(row.process)), savings_states: countBy(rows, row => String(row.savings_status)),
    q_total_cents: allAmountsValid ? rows.reduce((sum,row) => sum + row.q_cents,0) : null,
    rows_with_issues: rows.filter(row => row.issues.length).length,
    issues: countBy(rows.flatMap(row => row.issues), issue => issue),
    imported_not_in_current_source: missingFromSource.length,
    balance_changes_matching_september5: rows.filter(row => row.difference_matches_september5).length,
    related_sheets: relatedSheets,
    loan_rows: loanRows(snapshot).length, loan_ids: loans.loans.length,
    loans: countBy(loans.loans, row => row.outcome), loans_by_status: countBy(loans.loans, row => row.statuses.join(' | ')),
    loan_ids_with_identity_incidents: loans.loans.filter(row => row.issues.includes('LOAN_FOLIO_CONFLICT_OR_MISSING')).length,
    loan_rows_without_id: loans.missing.length, savings_loan_outcomes: countBy(rows, row => row.loan_snapshot_outcome),
    certification: 'NOT_CERTIFIED', production_writes: 0, ready_for_full_cutover: false,
    limitations: ['READ_ONLY_SNAPSHOT_NOT_LIVE_DEBT_AUTHORITY','Q_INCLUDES_DT_DO_NOT_CREDIT_AGAIN','FUTURE_MATRIX_IS_PROJECTION_NOT_CASH','HISTORICAL_CAPITAL_YIELD_REMAINDER_NOT_CERTIFIED','FORMULA_AND_SCRIPT_EQUIVALENCE_NOT_PROVEN','IDENTITY_INCIDENTS_RETAINED_WITHOUT_AUTOLINK']
  };
  return { summary, rows, loan_incidents: loans.loans.filter(row => row.issues.length), loan_rows_without_id: loans.missing,
    imported_not_in_current_source: missingFromSource.map(row => ({ id: row.id, folio: row.legacy_folio })) };
}
function main() {
  const [privateDirectory, aggregateFile, databaseName = 'supabase-readonly.json'] = process.argv.slice(2);
  if (!privateDirectory || !aggregateFile) throw new Error('Usage: node audit-savings-cutover-readiness.js PRIVATE_DIRECTORY AGGREGATE_FILE');
  const privatePath = path.resolve(privateDirectory), root = path.resolve(__dirname, '..');
  if (privatePath === root || !path.relative(root, privatePath).startsWith('..')) throw new Error('PRIVATE_DIRECTORY_MUST_BE_OUTSIDE_REPO');
  const sourceBytes = fs.readFileSync(path.join(privatePath, 'source-snapshot.json'));
  if (databaseName !== path.basename(databaseName)) throw new Error('DATABASE_NAME_MUST_BE_BASENAME');
  const databaseBytes = fs.readFileSync(path.join(privatePath, databaseName));
  const report = audit(JSON.parse(sourceBytes), JSON.parse(databaseBytes));
  report.summary.sha256 = { source: crypto.createHash('sha256').update(sourceBytes).digest('hex'), database: crypto.createHash('sha256').update(databaseBytes).digest('hex') };
  fs.writeFileSync(path.join(privatePath, path.basename(aggregateFile, '.json') + '-private.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  fs.mkdirSync(path.dirname(path.resolve(aggregateFile)), { recursive: true });
  fs.writeFileSync(aggregateFile, JSON.stringify(report.summary, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report.summary, null, 2));
}
module.exports = { exact, cents, col, excelDate, summarizeLoans, loanOutcome, loanRows, audit };
if (require.main === module) main();
