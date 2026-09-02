#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || path.join(root, 'tmp/savings-shadow-certified-dry-run/source-projection.json'));
const outputDir = path.resolve(process.argv[3] || path.join(root, 'tmp/savings-shadow-certified-dry-run'));
const builder = path.join(root, 'scripts/build-savings-shadow-certified-manifest.js');
const importer = path.join(root, 'scripts/import-savings-shadow.js');

function execute(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'COMMAND_FAILED').trim());
  return result.stdout;
}
function executeFailure(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.notStrictEqual(result.status, 0, 'COMMAND_WAS_EXPECTED_TO_FAIL');
  return (result.stderr || result.stdout || '').trim();
}
function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase(); }

fs.mkdirSync(outputDir, { recursive: true });
const manifest1 = path.join(outputDir, 'manifest-run-1.json');
const manifest2 = path.join(outputDir, 'manifest-run-2.json');
const build1 = JSON.parse(execute([builder, source, manifest1]));
const build2 = JSON.parse(execute([builder, source, manifest2]));
const manifestBytes1 = fs.readFileSync(manifest1);
const manifestBytes2 = fs.readFileSync(manifest2);
assert.deepStrictEqual(manifestBytes1, manifestBytes2, 'SAVINGS_MANIFEST_BYTES_CHANGED');
assert.strictEqual(digest(manifest1), digest(manifest2), 'SAVINGS_MANIFEST_FILE_HASH_CHANGED');
assert.deepStrictEqual(build1, build2, 'SAVINGS_BUILD_RESULT_CHANGED');

const dry1Text = execute([importer, manifest1, '--dry-run']);
const dry2Text = execute([importer, manifest2, '--dry-run']);
const dry1 = JSON.parse(dry1Text), dry2 = JSON.parse(dry2Text);
assert.deepStrictEqual(dry1, dry2, 'SAVINGS_DRY_RUN_RESULT_CHANGED');
assert.strictEqual(dry1.mode, 'DRY_RUN');
assert.strictEqual(dry1.writes, 0);
assert.strictEqual(dry1.cutover, false);
assert.strictEqual(dry1.ready_for_apply, false);
assert.strictEqual(dry1.counts.transactions, 0);

const manifest = JSON.parse(manifestBytes1);
assert.strictEqual(manifest.source_changed_since_forensic_audit, true);
assert.strictEqual(manifest.ready_for_owner_review, true);
assert.strictEqual(manifest.ready_for_apply, false);
assert.strictEqual(manifest.transaction_candidate_counts.ledger_rows_authorized, 0);
assert.strictEqual(manifest.yield_legacy_counts.credits_authorized, 0);
assert.strictEqual(manifest.analysis.beneficiaries.invented, 0);
assert.strictEqual(manifest.snapshot.transactions.length, 0);
assert.strictEqual(manifest.snapshot.requests.length, 0);
assert.strictEqual(manifest.folio_counts.importable, 363);
assert.strictEqual(manifest.folio_counts.invalid, 1);
assert.strictEqual(manifest.analysis.historical_dated_values.formula_derived_values + manifest.analysis.historical_dated_values.manual_values + manifest.analysis.historical_dated_values.blank_values, manifest.analysis.historical_dated_values.total_dated_cells);
assert.match(executeFailure([importer, manifest1, '--apply']), /SAVINGS_MANIFEST_NOT_READY_FOR_APPLY/);

fs.writeFileSync(path.join(outputDir, 'dry-run-1.json'), dry1Text, { encoding: 'utf8', mode: 0o600 });
fs.writeFileSync(path.join(outputDir, 'dry-run-2.json'), dry2Text, { encoding: 'utf8', mode: 0o600 });
const evidence = {
  status: 'PASS', dry_run_1: 'PASS', dry_run_2: 'PASS', idempotent: 'PASS',
  source_projection_sha256: dry1.source_projection_sha256,
  source_snapshot_sha256: dry1.source_snapshot_sha256,
  manifest_sha256: dry1.manifest_sha256,
  manifest_file_sha256: digest(manifest1),
  manifest_bytes_identical: true, dry_run_results_identical: true,
  apply_guard: 'PASS — SAVINGS_MANIFEST_NOT_READY_FOR_APPLY',
  counts: dry1.counts, identities: dry1.identities, candidate_counts: dry1.candidate_counts,
  writes: { supabase_business: 0, google: 0, storage: 0, auth: 0, git_commit: 0, git_push: 0 },
  production_migration_applied: false, cutover: false, yield_credited: 0,
};
fs.writeFileSync(path.join(outputDir, 'idempotency-result.json'), JSON.stringify(evidence, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
process.stdout.write(JSON.stringify(evidence, null, 2) + '\n');
