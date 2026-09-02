#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const {
  reconcile,
  readCapture,
  publicSummary,
  VERSION,
} = require('./reconcile-savings-shadow-ledger-dry-run.js');

const root = path.resolve(__dirname, '..');
const sourceOne = readCapture(path.join(root, 'tmp/savings-ledger-reconciliation-20260902/source-run-1.json'));
const sourceTwo = readCapture(path.join(root, 'tmp/savings-ledger-reconciliation-20260902/source-run-2.json'));
const result = reconcile(sourceOne, sourceTwo);
const summary = publicSummary(result);

assert.strictEqual(result.version, VERSION);
assert.strictEqual(sourceOne.capture_sha256, 'E378B0F41C0D4C20D2EF88E5A69B94A4A5291B97461A66716DCA8C3981335C49');
assert.strictEqual(sourceOne.capture_sha256, sourceTwo.capture_sha256);
assert.strictEqual(result.source.stable_double_capture, true);
assert.deepStrictEqual(result.source.table_counts_before, result.source.table_counts_after);

assert.strictEqual(result.population.folios_evaluated, 363);
assert.strictEqual(result.population.invalid_test_rows_excluded, 1);
assert.deepStrictEqual(result.population.identity, { RESOLVED: 356, AMBIGUOUS: 5, ORPHAN: 2 });
assert.deepStrictEqual(result.population.historical_process, { JUB: 13, PROCESS_1: 287, PROCESS_3: 51, CONFLICT: 7, INVALID: 5, UNKNOWN: 0 });
assert.deepStrictEqual(result.population.start_date_evidence, { CERTIFIED: 329, INFERRED: 0, MISSING: 34, CONFLICT: 0 });

assert.strictEqual(result.evidence_summary.aa_do.analyzed, 33852);
assert.strictEqual(result.evidence_summary.aa_do.financially_excluded_invalid_test, 93);
assert.strictEqual(result.evidence_summary.aa_do.exact_report_contrast_candidates, 4049);
assert.strictEqual(result.evidence_summary.withdrawals.analyzed, 228);
assert.strictEqual(result.evidence_summary.withdrawals.candidates, 226);
assert.strictEqual(result.evidence_summary.withdrawals.duplicates_excluded, 0);
assert.strictEqual(result.evidence_summary.plan_segments.amount_change_rows, 126);
assert.strictEqual(result.evidence_summary.plan_segments.candidate_segments, 419);
assert.strictEqual(result.evidence_summary.yields.analyzed, 1092);
assert.strictEqual(result.evidence_summary.yields.candidates, 393);
assert.strictEqual(result.evidence_summary.yields.explicit_nonzero_pending_review, 2);
assert.strictEqual(result.evidence_summary.yields.credits_created, 0);
assert.strictEqual(result.evidence_summary.reports.reporte_ahorro.rows, 4049);
assert.strictEqual(result.evidence_summary.reports.reporte_rh.rows, 320);
assert.strictEqual(result.evidence_summary.reports.usage, 'CONTRAST_ONLY_NOT_AUTOMATIC_LEDGER');

assert.deepStrictEqual(result.reconciliation_summary.financial_classification, {
  EXACT_MATCH: 343,
  ROUNDING_MATCH: 0,
  MISMATCH: 20,
  INSUFFICIENT_EVIDENCE: 0,
});
assert.strictEqual(result.reconciliation_summary.identity_unresolved_but_financially_reconcilable, 7);
assert.deepStrictEqual(result.reconciliation_summary.confidence, { MEDIUM: 343, LOW: 20, HIGH: 0 });
assert.deepStrictEqual(result.reconciliation_summary.review_lanes, { PENDING_REVIEW: 343, BLOCKED: 20, CERTIFIABLE_NOW: 0 });
assert.strictEqual(result.reconciliation_summary.total_Q, 1986073.5);
assert.strictEqual(result.reconciliation_summary.total_candidate_capital, 4531170.96);
assert.strictEqual(result.reconciliation_summary.total_candidate_yield_not_in_Q_comparison, 381366.72);
assert.strictEqual(result.reconciliation_summary.total_candidate_withdrawals, 2572847.46);
assert.strictEqual(result.reconciliation_summary.total_candidate, 1958323.5);
assert.strictEqual(result.reconciliation_summary.total_difference_candidate_minus_Q, -27750);
assert.strictEqual(result.reconciliation_summary.exact_mismatch_folio_set_sha256, '6C9CD2B29A1D5C15E52A6566FC2313B98D9FFA670BF0129406D05CD16C4B24EA');
assert.strictEqual(result.private_detail.mismatches.length, 20);
assert(result.private_detail.mismatches.every((row) => row.correction_applied === false && row.record_sha256));

assert.strictEqual(result.controls.google_reads, 0);
assert.strictEqual(result.controls.google_writes, 0);
assert.strictEqual(result.controls.supabase_raw_writes, 0);
assert.strictEqual(result.controls.canonical_transactions_created, 0);
assert.strictEqual(result.controls.yield_credits_created, 0);
assert.strictEqual(result.controls.cutover, false);
assert.strictEqual(result.safety_verdict.safe_to_materialize_high_confidence_ledger, false);
assert.strictEqual(result.safety_verdict.safe_to_make_supabase_authoritative, false);
assert(!Object.prototype.hasOwnProperty.call(summary.evidence_summary.reports.reporte_ahorro, 'exact_folios'));
assert(!Object.prototype.hasOwnProperty.call(summary.evidence_summary.reports.reporte_ahorro, 'row_hashes'));

process.stdout.write(JSON.stringify({
  status: 'PASS',
  test: 'SAVINGS_LEDGER_RECONCILIATION_DRY_RUN',
  reconciliation_sha256: result.reconciliation_sha256,
  folios: result.population.folios_evaluated,
  mismatches: result.reconciliation_summary.financial_classification.MISMATCH,
  google_writes: result.controls.google_writes,
  supabase_writes: result.controls.supabase_raw_writes,
  canonical_transactions: result.controls.canonical_transactions_created,
  cutover: result.controls.cutover,
}, null, 2) + '\n');
