#!/usr/bin/env node
'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { sha256, MANIFEST_VERSION } = require('./build-savings-financial-baseline.js');

const root = path.resolve(__dirname, '..');
const privateRoot = path.join(root, 'tmp/savings-current-baseline-20260902');
const manifestPath = path.join(privateRoot, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const before = JSON.parse(fs.readFileSync(path.join(privateRoot, 'supabase-before.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(privateRoot, 'supabase-after.json'), 'utf8'));
const folioDisplay = JSON.parse(fs.readFileSync(path.join(privateRoot, 'folio-display-evidence.json'), 'utf8'));

assert.equal(manifest.manifest_version, MANIFEST_VERSION);
const { manifest_sha256: manifestHash, ...manifestCore } = manifest;
assert.equal(manifestHash, sha256(manifestCore));
assert.equal(manifest.consistency.run_1, manifest.consistency.run_2);
assert.equal(manifest.consistency.consistent, true);
assert.equal(manifest.consistency.financial_scope_identical, true);
assert.equal(manifest.gates.google_writes, 0);
assert.equal(manifest.gates.supabase_writes, 0);
assert.equal(manifest.gates.schema_reapplied, false);
assert.equal(manifest.gates.import_executed, false);
assert.equal(manifest.gates.cutover_executed, false);
assert.equal(manifest.gates.safe_to_use_as_new_baseline, true);
assert.equal(manifest.gates.safe_to_import, false);
assert.equal(manifest.gates.safe_to_cutover, false);
assert.equal(before.rows_sha256, after.rows_sha256);
assert.deepEqual(before.selected_columns, ['id', 'numero_control']);
assert.deepEqual(after.selected_columns, ['id', 'numero_control']);
assert.deepEqual(Object.keys(before).sort(), ['captured_at', 'rows', 'rows_sha256', 'selected_columns', 'source', 'version', 'writes']);
assert.deepEqual(Object.keys(after).sort(), ['captured_at', 'rows', 'rows_sha256', 'selected_columns', 'source', 'version', 'writes']);
assert.equal(before.rows.length, 947);
assert.equal(after.rows.length, 947);
assert.equal(manifest.supabase_identity_evidence.row_count, 947);
assert.equal(manifest.supabase_identity_evidence.before_sha256, before.rows_sha256);
assert.equal(manifest.supabase_identity_evidence.after_sha256, after.rows_sha256);
assert.deepEqual(manifest.supabase_identity_evidence.selected_columns, ['id', 'numero_control']);
assert.equal(manifest.identity.RESOLVED.length, 356);
assert.equal(manifest.identity.AMBIGUOUS.length, 5);
assert.equal(manifest.identity.ORPHAN.length, 2);
assert.equal(manifest.identity.INVALID_TEST.length, 1);
assert.equal(manifest.identity.OTHER_INVALID.length, 0);
assert.equal(manifest.identity.classifications_preserved, true);
assert.equal(folioDisplay.reads_equal, true);
assert.deepEqual(folioDisplay.run_1_values, folioDisplay.run_2_values);
assert.equal(manifest.identity_display_evidence.run_1_sha256, sha256(folioDisplay.run_1_values));
assert.equal(manifest.identity_display_evidence.run_2_sha256, sha256(folioDisplay.run_2_values));
assert.equal(manifest.identity_display_evidence.matched_manifest_rows, manifest.identity.TOTAL);
assert.equal(manifest.identity_display_evidence.missing_rows, 0);
assert.equal(manifest.identity_display_evidence.mismatched_rows, 0);
assert.equal(manifest.identity_display_evidence.leading_zero_values, 0);
assert.ok(manifest.ahorro.every((row) => String(folioDisplay.run_1_values[row.source_row - 1]?.[0] ?? '').trim() === row.legacy_folio));
assert.equal(manifest.history.length, manifest.identity.TOTAL * 93);
assert.equal(manifest.historical_yields.length, manifest.identity.TOTAL * 3);
assert.ok(manifest.history.every((row) => ['FORMULA', 'MANUAL', 'EMPTY'].includes(row[3]) && /^[A-F0-9]{64}$/.test(row[4])));
assert.ok(manifest.historical_yields.every((row) => [row[3], row[5], row[7]].every((kind) => ['FORMULA', 'MANUAL', 'EMPTY'].includes(kind)) && /^[A-F0-9]{64}$/.test(row[8])));
assert.ok(Object.values(manifest.operational).every((sheet) => sheet.rows.every((row) => /^[A-F0-9]{64}$/.test(row[3]))));
assert.equal(manifest.reuse.formula_text_stored, 0);

function containsFormulaText(value) {
  if (typeof value === 'string') return value.startsWith('=');
  if (Array.isArray(value)) return value.some(containsFormulaText);
  if (value && typeof value === 'object') return Object.values(value).some(containsFormulaText);
  return false;
}
assert.equal(containsFormulaText(manifest), false);

const builder = fs.readFileSync(path.join(root, 'scripts/build-savings-financial-baseline.js'), 'utf8');
const supabase = fs.readFileSync(path.join(root, 'scripts/capture-savings-baseline-supabase-readonly.js'), 'utf8');
assert.doesNotMatch(builder, /googleapis\.com|supabase\.com|batchUpdate|values\.update|values\.append|import_savings/i);
const sql = supabase.match(/const sql = `([\s\S]*?)`;/)?.[1] || '';
assert.match(sql, /^select\s+coalesce/i);
assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|alter|drop|create)\b/i);
assert.doesNotMatch(sql, /savings_|pg_tables|schema_migrations/i);

console.log(JSON.stringify({ status: 'PASS', mode: 'FINANCIAL_BASELINE_VERIFY', manifest_sha256: manifestHash, capture_sha256: manifest.consistency.run_2, formula_text_stored: 0, google_writes: 0, supabase_writes: 0, import_executed: false, cutover_executed: false }));
