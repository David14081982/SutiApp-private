#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { build, EXPECTED_BASELINE_SHA256 } = require('./build-savings-raw-shadow-import.js');
const { canonical, validateManifest } = require('./import-savings-shadow.js');

const root = path.resolve(__dirname, '..');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tmp/savings-current-baseline-20260902/manifest.json'), 'utf8'));
const identity = JSON.parse(fs.readFileSync(path.join(root, 'tmp/savings-current-baseline-20260902/supabase-after.json'), 'utf8'));
const first = build(baseline, identity);
const second = build(baseline, identity);

assert.strictEqual(canonical(first), canonical(second), 'Build is not deterministic');
assert.strictEqual(first.source_baseline_manifest_sha256, EXPECTED_BASELINE_SHA256);
const validation = validateManifest(first);
assert.deepStrictEqual(validation.counts, { participants: 363, enrollments: 0, plans: 0, transactions: 0, requests: 0, evidence: 42229 });
assert.deepStrictEqual(validation.identities, { RESOLVED: 356, AMBIGUOUS: 5, ORPHAN: 2 });
assert.strictEqual(first.snapshot.participants.some((row) => row.legacy_folio === '1234009'), false);
assert.strictEqual(first.snapshot.evidence.filter((row) => row.legacy_folio === '1234009').length, 101);

const groupCount = (sheet, type) => first.snapshot.evidence.filter((row) => row.source_sheet === sheet && row.record_type === type).length;
assert.strictEqual(groupCount('Ahorro', 'AA_DO_CELL'), 33852);
assert.strictEqual(groupCount('Ahorro', 'DP_DW_CELL'), 1092);
assert.strictEqual(groupCount('Reporte Ahorro', 'REPORT'), 4049);
assert.strictEqual(groupCount('Reporte - RH', 'REPORT'), 320);
assert.strictEqual(groupCount('Solicitud Cambio ahorro', 'AMOUNT_CHANGE'), 126);
assert.strictEqual(groupCount('Solicitud de retiro', 'WITHDRAWAL'), 228);
assert(first.snapshot.evidence.filter((row) => row.record_type === 'AA_DO_CELL').every((row) => ['FORMULA', 'MANUAL', 'EMPTY'].includes(row.raw_payload.cell_kind)));
assert(first.snapshot.evidence.filter((row) => row.record_type === 'DP_DW_CELL').every((row) => row.raw_payload.period != null && Object.prototype.hasOwnProperty.call(row.raw_payload, 'capital') && Object.prototype.hasOwnProperty.call(row.raw_payload, 'yield')));

const keys = new Set();
first.snapshot.evidence.forEach((row) => {
  const key = canonical([row.source_sheet, row.source_column, row.source_row, row.record_type]);
  assert(!keys.has(key), `Duplicate evidence key: ${key}`);
  keys.add(key);
});
assert.strictEqual(first.financial_guards.google_writes, 0);
assert.strictEqual(first.financial_guards.canonical_transactions, 0);
assert.strictEqual(first.financial_guards.yield_credits, 0);
assert.strictEqual(first.financial_guards.cutover, false);

const recovery = fs.readFileSync(path.join(root, 'supabase/recovery/20260902000200_savings_raw_shadow_import_recovery.sql'), 'utf8');
assert(recovery.includes(EXPECTED_BASELINE_SHA256));
assert(!/\bdrop\s+(table|function|schema)\b/i.test(recovery));
assert(recovery.includes('SAVINGS_RAW_RECOVERY_EXACT_BATCH_REQUIRED'));
assert(recovery.includes('SAVINGS_RAW_RECOVERY_CANONICAL_ROWS_PRESENT'));

process.stdout.write(JSON.stringify({
  status: 'PASS', deterministic_builds: 2, baseline_sha256: EXPECTED_BASELINE_SHA256,
  manifest_sha256: first.manifest_sha256, payload_sha256: first.payload_sha256,
  counts: validation.counts, identities: validation.identities,
  recovery: 'EXACT_BATCH_ONLY_PREPARED_NOT_EXECUTED', google_writes: 0, cutover: false,
}, null, 2) + '\n');
