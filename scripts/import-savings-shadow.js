#!/usr/bin/env node
'use strict';

/* Certified, idempotent Savings shadow importer.
   - Never connects to Google.
   - Dry-run is the default and performs no network request.
   - --apply requires an explicit confirmation plus service_role in process env.
   - The service key is never printed or written to browser assets. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TYPES = new Set(['AFFILIATE', 'NON_AFFILIATE', 'LEGACY_UNRESOLVED']);
const IDENTITIES = new Set(['RESOLVED', 'AMBIGUOUS', 'ORPHAN', 'NON_AFFILIATE']);
const PROCESSES = new Set(['JUB', 'PROCESS_1', 'PROCESS_3']);
const TRANSACTIONS = new Set(['CONTRIBUTION', 'YIELD_CREDIT', 'WITHDRAWAL', 'REGULARIZATION', 'ADJUSTMENT', 'REVERSAL', 'HOLD_SETTLEMENT']);
const COMPONENTS = new Set(['CAPITAL', 'YIELD']);
const DIRECTIONS = new Set(['CREDIT', 'DEBIT']);
const EVIDENCE_CLASSES = new Set(['RAW_LEGACY', 'EXPECTED', 'ACTUAL', 'LEGACY_SNAPSHOT', 'CANONICAL', 'PENDING_REVIEW']);
const SHA256 = /^[A-F0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RAW_SHADOW_VERSION = 'SAVINGS_RAW_SHADOW_IMPORT_V3';
const AUTHORIZED_BASELINE_SHA256 = '3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1';

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
}

function assert(condition, code, details) {
  if (!condition) { const error = new Error(code + (details ? ': ' + details : '')); error.code = code; throw error; }
}

function validateManifest(input) {
  assert(input && typeof input === 'object' && !Array.isArray(input), 'SAVINGS_MANIFEST_OBJECT_REQUIRED');
  assert(input.snapshot && typeof input.snapshot === 'object' && !Array.isArray(input.snapshot), 'SAVINGS_SNAPSHOT_OBJECT_REQUIRED');
  const declaredManifestHash = String(input.manifest_sha256 || '').toUpperCase();
  const manifestWithoutHash = Object.assign({}, input);
  delete manifestWithoutHash.manifest_sha256;
  const actualManifestHash = sha256(canonical(manifestWithoutHash));
  assert(SHA256.test(declaredManifestHash) && actualManifestHash === declaredManifestHash, 'SAVINGS_MANIFEST_HASH_MISMATCH', actualManifestHash);
  assert(String(input.import_version || '').trim() && String(input.schema_version || '').trim(), 'SAVINGS_MANIFEST_VERSION_REQUIRED');
  assert(SHA256.test(String(input.source_projection_sha256 || '').toUpperCase()), 'SAVINGS_SOURCE_PROJECTION_HASH_INVALID');
  const actualHash = sha256(canonical(input.snapshot));
  const declaredHash = String(input.source_snapshot_sha256 || '').toUpperCase();
  const evidenceHash = String(input.certification && input.certification.evidence_sha256 || '').toUpperCase();
  assert(SHA256.test(declaredHash), 'SAVINGS_SNAPSHOT_HASH_INVALID');
  const rawShadowV3 = String(input.import_version) === RAW_SHADOW_VERSION;
  if (rawShadowV3) {
    const baselineHash = String(input.source_baseline_manifest_sha256 || '').toUpperCase();
    const payloadHash = String(input.payload_sha256 || '').toUpperCase();
    assert(baselineHash === AUTHORIZED_BASELINE_SHA256 && declaredHash === AUTHORIZED_BASELINE_SHA256, 'SAVINGS_AUTHORIZED_BASELINE_REQUIRED');
    assert(SHA256.test(payloadHash) && actualHash === payloadHash, 'SAVINGS_PAYLOAD_HASH_MISMATCH', actualHash);
    assert(evidenceHash === baselineHash, 'SAVINGS_CERTIFIED_BASELINE_REQUIRED');
  } else {
    assert(actualHash === declaredHash, 'SAVINGS_SNAPSHOT_HASH_MISMATCH', actualHash);
    assert(evidenceHash === declaredHash, 'SAVINGS_CERTIFIED_SNAPSHOT_REQUIRED');
  }
  assert(input.certification && String(input.certification.status).toUpperCase() === 'CERTIFIED', 'SAVINGS_CERTIFIED_SNAPSHOT_REQUIRED');
  assert(String(input.source_workbook_id || '').trim() && String(input.source_workbook_name || '').trim(), 'SAVINGS_SOURCE_PROVENANCE_REQUIRED');

  const snapshot = input.snapshot;
  const arrays = ['participants', 'enrollments', 'plans', 'transactions', 'requests', 'evidence'];
  arrays.forEach((name) => assert(Array.isArray(snapshot[name]), 'SAVINGS_ARRAY_REQUIRED', name));
  const folios = new Set();
  snapshot.participants.forEach((row, index) => {
    const type = String(row.participant_type || '').toUpperCase();
    const identity = String(row.identity_status || '').toUpperCase();
    assert(TYPES.has(type) && IDENTITIES.has(identity), 'SAVINGS_PARTICIPANT_CLASSIFICATION_INVALID', String(index));
    assert(row.legacy_folio && !folios.has(String(row.legacy_folio)), 'SAVINGS_LEGACY_FOLIO_DUPLICATE', String(row.legacy_folio));
    folios.add(String(row.legacy_folio));
    if (identity === 'RESOLVED') assert(type === 'AFFILIATE' && UUID.test(String(row.affiliate_id || '')), 'SAVINGS_RESOLVED_AFFILIATE_REQUIRED', row.legacy_folio);
    if (identity === 'AMBIGUOUS' || identity === 'ORPHAN') assert(type === 'LEGACY_UNRESOLVED' && !row.affiliate_id, 'SAVINGS_UNRESOLVED_IDENTITY_MUST_BE_NULL', row.legacy_folio);
    if (identity === 'NON_AFFILIATE') assert(type === 'NON_AFFILIATE' && !row.affiliate_id, 'SAVINGS_NON_AFFILIATE_LINK_INVALID', row.legacy_folio);
    if (row.current_process) assert(PROCESSES.has(String(row.current_process).toUpperCase()), 'SAVINGS_PROCESS_INVALID', row.legacy_folio);
  });
  snapshot.enrollments.forEach((row) => {
    assert(folios.has(String(row.legacy_folio)), 'SAVINGS_ENROLLMENT_PARTICIPANT_MISSING', row.legacy_folio);
    assert(Number.isInteger(Number(row.sequence_number)) && Number(row.sequence_number) > 0, 'SAVINGS_ENROLLMENT_SEQUENCE_INVALID', row.legacy_folio);
    if (['ACTIVE', 'TERMINATION_PENDING'].includes(String(row.status).toUpperCase())) {
      assert(row.approved_at && row.first_expected_contribution_date && PROCESSES.has(String(row.process_snapshot || '').toUpperCase()), 'SAVINGS_ACTIVE_ENROLLMENT_INCOMPLETE', row.legacy_folio);
    }
  });
  snapshot.plans.forEach((row) => {
    assert(folios.has(String(row.legacy_folio)) && Number(row.amount) > 0 && PROCESSES.has(String(row.process_snapshot || '').toUpperCase()), 'SAVINGS_PLAN_INVALID', row.legacy_folio);
    assert(row.effective_from, 'SAVINGS_PLAN_EFFECTIVE_FROM_REQUIRED', row.legacy_folio);
  });
  const transactionKeys = new Set();
  snapshot.transactions.forEach((row, index) => {
    assert(folios.has(String(row.legacy_folio)), 'SAVINGS_TRANSACTION_PARTICIPANT_MISSING', String(index));
    assert(TRANSACTIONS.has(String(row.transaction_type || '').toUpperCase()) && COMPONENTS.has(String(row.component || '').toUpperCase()) && DIRECTIONS.has(String(row.direction || '').toUpperCase()), 'SAVINGS_TRANSACTION_CLASSIFICATION_INVALID', String(index));
    assert(Number(row.amount) > 0 && row.effective_date && row.source_key, 'SAVINGS_TRANSACTION_INVALID', String(index));
    assert(!transactionKeys.has(String(row.source_key)), 'SAVINGS_TRANSACTION_SOURCE_KEY_DUPLICATE', String(row.source_key));
    transactionKeys.add(String(row.source_key));
    const expected = row.expected_amount, actual = row.actual_amount, difference = row.difference_amount;
    if (expected != null || actual != null || difference != null) assert(expected != null && actual != null && Number(difference) === Number(actual) - Number(expected), 'SAVINGS_EXPECTED_ACTUAL_DIFFERENCE_INVALID', String(index));
  });
  const evidenceKeys = new Set();
  snapshot.evidence.forEach((row, index) => {
    assert(row.source_sheet && row.source_column && Number(row.source_row) > 0 && SHA256.test(String(row.source_row_sha256 || '').toUpperCase()), 'SAVINGS_EVIDENCE_PROVENANCE_INVALID', String(index));
    assert(EVIDENCE_CLASSES.has(String(row.data_classification || '').toUpperCase()), 'SAVINGS_EVIDENCE_CLASSIFICATION_INVALID', String(index));
    const evidenceKey = canonical([row.source_sheet, row.source_column, Number(row.source_row), String(row.record_type || '').toUpperCase()]);
    assert(!evidenceKeys.has(evidenceKey), 'SAVINGS_EVIDENCE_KEY_DUPLICATE', evidenceKey);
    evidenceKeys.add(evidenceKey);
  });
  const identities = snapshot.participants.reduce((out, row) => { const key = String(row.identity_status).toUpperCase(); out[key] = (out[key] || 0) + 1; return out; }, {});
  const counts = Object.fromEntries(arrays.map((name) => [name, snapshot[name].length]));
  if (rawShadowV3) {
    assert(canonical(counts) === canonical(input.exact_counts), 'SAVINGS_EXACT_COUNTS_MISMATCH');
    assert(canonical(counts) === canonical({ participants: 363, enrollments: 0, plans: 0, transactions: 0, requests: 0, evidence: 42229 }), 'SAVINGS_RAW_SHADOW_COUNTS_INVALID');
    assert(canonical(identities) === canonical({ RESOLVED: 356, AMBIGUOUS: 5, ORPHAN: 2 }), 'SAVINGS_RAW_SHADOW_IDENTITIES_INVALID');
    assert(input.financial_guards && input.financial_guards.google_authority_unchanged === true && input.financial_guards.google_writes === 0 && input.financial_guards.canonical_transactions === 0 && input.financial_guards.yield_credits === 0 && input.financial_guards.productive_yields_enabled === false && input.financial_guards.cutover === false && input.financial_guards.user_actions_enabled === false && input.financial_guards.q_is_legacy_reported_balance_only === true, 'SAVINGS_FINANCIAL_GUARDS_REQUIRED');
  }
  return Object.freeze({
    actualHash, actualManifestHash, declaredHash, rawShadowV3,
    identities,
    counts,
    rpcManifest: Object.assign({}, input, snapshot, { source_snapshot_sha256: declaredHash, snapshot: undefined }),
  });
}

function parseArgs(argv) {
  const args = { apply: false, remoteDryRun: false, file: '' };
  argv.forEach((value) => {
    if (value === '--apply') args.apply = true;
    else if (value === '--remote-dry-run') args.remoteDryRun = true;
    else if (value !== '--dry-run' && !args.file) args.file = value;
  });
  assert(!(args.apply && args.remoteDryRun), 'SAVINGS_IMPORT_MODE_CONFLICT');
  assert(args.file, 'USAGE', 'node scripts/import-savings-shadow.js <manifest.json> [--dry-run|--remote-dry-run|--apply]');
  return args;
}

function loadLocalEnvFile() {
  const envPath = path.resolve('supabase.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) return;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  });
}

function getConnection() {
  loadLocalEnvFile();
  assert(process.env.SUTI_SAVINGS_IMPORT_CONFIRM === 'SHADOW_ONLY_NO_CUTOVER', 'SAVINGS_IMPORT_CONFIRMATION_REQUIRED');
  const url = String(process.env.SUTI_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUTI_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  assert(/^https:\/\//.test(url) && serviceKey, 'SAVINGS_IMPORT_ENV_REQUIRED');
  return { url, serviceKey };
}

async function rpc(connection, rpcManifest, apply) {
  const { url, serviceKey } = connection;
  const response = await fetch(url + '/rest/v1/rpc/import_savings_shadow_manifest', {
    method: 'POST', headers: { apikey: serviceKey, authorization: 'Bearer ' + serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ p_manifest: rpcManifest, p_apply: apply }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.message || 'SAVINGS_IMPORT_RPC_FAILED'); error.code = body.code || 'SAVINGS_IMPORT_RPC_FAILED'; throw error; }
  return body;
}

async function findExistingBatch(connection, validation) {
  const { url, serviceKey } = connection;
  const query = new URLSearchParams({
    select: 'id,source_snapshot_sha256,status,row_counts,provenance',
    source_snapshot_sha256: 'eq.' + validation.declaredHash,
    limit: '1',
  });
  const response = await fetch(url + '/rest/v1/savings_import_batches?' + query.toString(), {
    headers: { apikey: serviceKey, authorization: 'Bearer ' + serviceKey },
  });
  const body = await response.json().catch(() => []);
  if (!response.ok) { const error = new Error(body.message || 'SAVINGS_IMPORT_PREFLIGHT_FAILED'); error.code = body.code || 'SAVINGS_IMPORT_PREFLIGHT_FAILED'; throw error; }
  if (!Array.isArray(body) || body.length === 0) return null;
  const row = body[0];
  const provenance = row.provenance || {};
  assert(row.status === 'APPLIED' && canonical(row.row_counts) === canonical(validation.counts), 'SAVINGS_EXISTING_BATCH_NOT_EQUIVALENT');
  if (validation.rawShadowV3) assert(String(provenance.payload_sha256 || '').toUpperCase() === validation.actualHash, 'SAVINGS_EXISTING_BATCH_PAYLOAD_MISMATCH');
  return row;
}

async function applyManifest(validation) {
  const connection = getConnection();
  const existing = await findExistingBatch(connection, validation);
  if (existing) return {
    mode: 'ALREADY_APPLIED', authority: 'SHADOW', cutover: false, writes: 0,
    batch_id: existing.id, source_snapshot_sha256: validation.declaredHash, counts: validation.counts,
  };
  const remoteDryRun = await rpc(connection, validation.rpcManifest, false);
  assert(remoteDryRun && remoteDryRun.mode === 'DRY_RUN' && remoteDryRun.authority === 'SHADOW' && remoteDryRun.certified === true, 'SAVINGS_REMOTE_DRY_RUN_INVALID');
  assert(String(remoteDryRun.source_snapshot_sha256 || '').toUpperCase() === validation.declaredHash && canonical(remoteDryRun.counts) === canonical(validation.counts), 'SAVINGS_REMOTE_DRY_RUN_MISMATCH');
  try {
    return await rpc(connection, validation.rpcManifest, true);
  } catch (error) {
    if (error.code !== '23505') throw error;
    const raced = await findExistingBatch(connection, validation);
    if (!raced) throw error;
    return {
      mode: 'ALREADY_APPLIED', authority: 'SHADOW', cutover: false, writes: 0,
      batch_id: raced.id, source_snapshot_sha256: validation.declaredHash, counts: validation.counts,
    };
  }
}

async function remoteDryRunManifest(validation) {
  const connection = getConnection();
  const existing = await findExistingBatch(connection, validation);
  if (existing) return {
    mode: 'ALREADY_APPLIED', authority: 'SHADOW', cutover: false, writes: 0,
    batch_id: existing.id, source_snapshot_sha256: validation.declaredHash, counts: validation.counts,
  };
  const result = await rpc(connection, validation.rpcManifest, false);
  assert(result && result.mode === 'DRY_RUN' && result.authority === 'SHADOW' && result.certified === true, 'SAVINGS_REMOTE_DRY_RUN_INVALID');
  assert(String(result.source_snapshot_sha256 || '').toUpperCase() === validation.declaredHash && canonical(result.counts) === canonical(validation.counts), 'SAVINGS_REMOTE_DRY_RUN_MISMATCH');
  return Object.assign({}, result, { cutover: false, writes: 0, payload_sha256: validation.actualHash });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(args.file);
  const input = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const validation = validateManifest(input);
  if (args.apply) assert(input.ready_for_apply === true, 'SAVINGS_MANIFEST_NOT_READY_FOR_APPLY');
  const result = args.apply ? await applyManifest(validation) : args.remoteDryRun ? await remoteDryRunManifest(validation) : {
    mode: 'DRY_RUN', authority: 'SHADOW', cutover: false, writes: 0,
    import_version: input.import_version, schema_version: input.schema_version,
    source_projection_sha256: String(input.source_projection_sha256).toUpperCase(),
    source_snapshot_sha256: validation.declaredHash, payload_sha256: validation.actualHash, manifest_sha256: validation.actualManifestHash,
    source_changed_since_forensic_audit: input.source_changed_since_forensic_audit === true,
    counts: validation.counts, identities: validation.identities,
    candidate_counts: input.transaction_candidate_counts || {},
    ready_for_owner_review: input.ready_for_owner_review === true,
    ready_for_apply: input.ready_for_apply === true,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (require.main === module) main().catch((error) => { process.stderr.write(String(error.code || error.message || error) + '\n'); process.exitCode = 1; });
module.exports = { canonical, sha256, validateManifest };
