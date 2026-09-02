#!/usr/bin/env node
'use strict';

/* Controlled service-role loader for the certified Savings RAW SHADOW batch.
   It exists because the 42,229-row JSON manifest exceeds the production RPC's
   60-second monolithic request budget. Rows are resumable and remain attached
   to one VALIDATED batch until final counts pass. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { canonical, validateManifest } = require('./import-savings-shadow.js');

const root = path.resolve(__dirname, '..');
const BASELINE_SHA256 = '3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1';
const DEFAULT_MANIFEST = path.join(root, 'tmp', 'savings-raw-shadow-import-20260902', 'manifest.json');

function loadEnvironment() {
  const values = { ...process.env };
  const envPath = path.join(root, 'supabase.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !values[match[1]]) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    });
  }
  return values;
}

function parseArgs(argv) {
  const result = { apply: false, file: DEFAULT_MANIFEST, chunkSize: 500 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--apply') result.apply = true;
    else if (argv[index] === '--dry-run') result.apply = false;
    else if (argv[index] === '--chunk-size') result.chunkSize = Number(argv[++index]);
    else result.file = path.resolve(argv[index]);
  }
  assert(Number.isInteger(result.chunkSize) && result.chunkSize >= 100 && result.chunkSize <= 1000, 'Chunk size must be 100..1000');
  return result;
}

function connection(values) {
  const url = String(values.SUTI_SUPABASE_URL || values.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = values.SUTI_SUPABASE_SERVICE_ROLE_KEY || values.SUPABASE_SECRET_KEY || '';
  assert(/^https:\/\//.test(url) && serviceKey, 'Supabase service-role configuration missing');
  return { url, serviceKey };
}

async function rest(conn, method, table, query = {}, body = null, options = {}) {
  const search = new URLSearchParams(query);
  const headers = { apikey: conn.serviceKey, authorization: `Bearer ${conn.serviceKey}` };
  if (body != null) headers['content-type'] = 'application/json';
  if (options.prefer) headers.prefer = options.prefer;
  if (options.range) headers.range = options.range;
  const response = await fetch(`${conn.url}/rest/v1/${table}${search.size ? `?${search}` : ''}`, {
    method, headers, body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`${options.code || 'SAVINGS_BATCH_REST_FAILED'}:${response.status}:${data && (data.code || data.message) || 'UNKNOWN'}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return { data, headers: response.headers };
}

async function exactCount(conn, table, filters) {
  const response = await rest(conn, 'GET', table, { select: 'id', ...filters, limit: '1' }, null, { prefer: 'count=exact', range: '0-0', code: 'SAVINGS_COUNT_FAILED' });
  const contentRange = response.headers.get('content-range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  assert(match, `${table}: exact count unavailable`);
  return Number(match[1]);
}

async function getBatch(conn) {
  const response = await rest(conn, 'GET', 'savings_import_batches', {
    select: 'id,status,certification_status,row_counts,provenance,source_snapshot_sha256',
    source_snapshot_sha256: `eq.${BASELINE_SHA256}`, limit: '2',
  }, null, { code: 'SAVINGS_BATCH_LOOKUP_FAILED' });
  assert(Array.isArray(response.data) && response.data.length <= 1, 'Authorized batch is duplicated');
  return response.data[0] || null;
}

function equivalentBatch(batch, input, validation) {
  assert(batch.source_snapshot_sha256 === BASELINE_SHA256, 'Existing batch baseline mismatch');
  assert(batch.certification_status === 'CERTIFIED', 'Existing batch certification mismatch');
  assert(canonical(batch.row_counts) === canonical(validation.counts), 'Existing batch counts declaration mismatch');
  assert(String(batch.provenance.payload_sha256 || '').toUpperCase() === validation.actualHash, 'Existing batch payload mismatch');
  assert(String(batch.provenance.manifest_sha256 || '').toUpperCase() === String(input.manifest_sha256).toUpperCase(), 'Existing batch manifest mismatch');
}

async function createBatch(conn, input, validation) {
  const provenance = { ...input.provenance, manifest_sha256: input.manifest_sha256, transport: 'SERVICE_ROLE_RESUMABLE_BATCHES', cutover: false };
  const response = await rest(conn, 'POST', 'savings_import_batches', { select: 'id,status,certification_status,row_counts,provenance,source_snapshot_sha256' }, [{
    source_workbook_id: input.source_workbook_id,
    source_workbook_name: input.source_workbook_name,
    source_snapshot_sha256: BASELINE_SHA256,
    certification_status: 'CERTIFIED',
    status: 'VALIDATED',
    row_counts: validation.counts,
    provenance,
  }], { prefer: 'return=representation', code: 'SAVINGS_BATCH_CREATE_FAILED' });
  assert(Array.isArray(response.data) && response.data.length === 1, 'Import batch was not created');
  return response.data[0];
}

async function ensureParticipants(conn, batch, input) {
  const existing = await rest(conn, 'GET', 'savings_participants', {
    select: 'id,legacy_folio', import_batch_id: `eq.${batch.id}`, limit: '1000',
  }, null, { code: 'SAVINGS_PARTICIPANT_LOOKUP_FAILED' });
  const existingFolios = new Set(existing.data.map((row) => row.legacy_folio));
  const missing = input.snapshot.participants.filter((row) => !existingFolios.has(row.legacy_folio)).map((row) => ({
    participant_type: row.participant_type,
    affiliate_id: row.affiliate_id,
    legacy_folio: row.legacy_folio,
    display_name: row.display_name,
    identity_status: row.identity_status,
    certification_status: 'PENDING_REVIEW',
    current_process: row.current_process,
    process_source: row.process_source,
    data_classification: 'LEGACY',
    legacy_reported_balance: row.legacy_reported_balance,
    legacy_balance_status: 'PENDING_REVIEW',
    import_batch_id: batch.id,
  }));
  if (missing.length) await rest(conn, 'POST', 'savings_participants', {}, missing, { prefer: 'return=minimal', code: 'SAVINGS_PARTICIPANT_INSERT_FAILED' });
  const all = await rest(conn, 'GET', 'savings_participants', {
    select: 'id,legacy_folio', import_batch_id: `eq.${batch.id}`, limit: '1000',
  }, null, { code: 'SAVINGS_PARTICIPANT_RELOAD_FAILED' });
  assert.strictEqual(all.data.length, input.snapshot.participants.length, 'Participant count mismatch after load');
  return new Map(all.data.map((row) => [row.legacy_folio, row.id]));
}

function evidenceRow(row, batchId, participantIds, workbookId) {
  return {
    import_batch_id: batchId,
    participant_id: participantIds.get(row.legacy_folio) || null,
    source_workbook_id: workbookId,
    source_sheet: row.source_sheet,
    source_column: row.source_column,
    source_row: row.source_row,
    legacy_folio: row.legacy_folio || null,
    observed_on: row.observed_on || null,
    numeric_value: row.numeric_value == null ? null : row.numeric_value,
    record_type: row.record_type,
    data_classification: row.data_classification,
    source_row_sha256: row.source_row_sha256,
    raw_payload: row.raw_payload || {},
  };
}

async function loadEvidence(conn, batch, input, participantIds, chunkSize) {
  const rows = input.snapshot.evidence.map((row) => evidenceRow(row, batch.id, participantIds, input.source_workbook_id));
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    await rest(conn, 'POST', 'savings_legacy_evidence', {
      on_conflict: 'import_batch_id,source_sheet,source_column,source_row,record_type',
    }, chunk, { prefer: 'resolution=ignore-duplicates,return=minimal', code: `SAVINGS_EVIDENCE_INSERT_FAILED_AT_${start}` });
    if ((start / chunkSize + 1) % 10 === 0 || start + chunk.length === rows.length) {
      process.stderr.write(`SAVINGS_EVIDENCE_PROGRESS:${Math.min(start + chunk.length, rows.length)}/${rows.length}\n`);
    }
  }
}

async function finalize(conn, batch, input, validation) {
  const participantCount = await exactCount(conn, 'savings_participants', { import_batch_id: `eq.${batch.id}` });
  const evidenceCount = await exactCount(conn, 'savings_legacy_evidence', { import_batch_id: `eq.${batch.id}` });
  assert.strictEqual(participantCount, validation.counts.participants, 'Participant count differs before finalize');
  assert.strictEqual(evidenceCount, validation.counts.evidence, 'Evidence count differs before finalize');
  assert.strictEqual(await exactCount(conn, 'savings_transactions', { import_batch_id: `eq.${batch.id}` }), 0, 'Canonical transaction detected');
  assert.strictEqual(await exactCount(conn, 'savings_enrollments', { import_batch_id: `eq.${batch.id}` }), 0, 'Enrollment row detected');
  assert.strictEqual(await exactCount(conn, 'savings_contribution_plans', { import_batch_id: `eq.${batch.id}` }), 0, 'Plan row detected');

  const auditCount = await exactCount(conn, 'savings_audit_events', { resource: 'eq.savings_import_batches', action: 'eq.IMPORT_CERTIFIED_SHADOW', target_id: `eq.${batch.id}` });
  if (auditCount === 0) {
    await rest(conn, 'POST', 'savings_audit_events', {}, [{
      resource: 'savings_import_batches', action: 'IMPORT_CERTIFIED_SHADOW', target_id: batch.id,
      after_data: { hash: BASELINE_SHA256, payload_sha256: validation.actualHash, manifest_sha256: input.manifest_sha256, counts: validation.counts },
      reason: 'No cutover; Google remains productive authority',
    }], { prefer: 'return=minimal', code: 'SAVINGS_AUDIT_INSERT_FAILED' });
  } else assert.strictEqual(auditCount, 1, 'Import audit duplicated');
  await rest(conn, 'PATCH', 'savings_import_batches', { id: `eq.${batch.id}` }, {
    status: 'APPLIED', finished_at: new Date().toISOString(),
  }, { prefer: 'return=minimal', code: 'SAVINGS_BATCH_FINALIZE_FAILED' });
  return { participantCount, evidenceCount };
}

async function verifyApplied(conn, batch, validation) {
  assert.strictEqual(await exactCount(conn, 'savings_participants', { import_batch_id: `eq.${batch.id}` }), validation.counts.participants, 'Applied participant count mismatch');
  assert.strictEqual(await exactCount(conn, 'savings_legacy_evidence', { import_batch_id: `eq.${batch.id}` }), validation.counts.evidence, 'Applied evidence count mismatch');
  assert.strictEqual(await exactCount(conn, 'savings_transactions', { import_batch_id: `eq.${batch.id}` }), 0, 'Applied batch has transactions');
  assert.strictEqual(await exactCount(conn, 'savings_audit_events', { resource: 'eq.savings_import_batches', action: 'eq.IMPORT_CERTIFIED_SHADOW', target_id: `eq.${batch.id}` }), 1, 'Applied audit count mismatch');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fs.readFileSync(args.file, 'utf8'));
  const validation = validateManifest(input);
  assert.strictEqual(validation.rawShadowV3, true, 'Only SAVINGS_RAW_SHADOW_IMPORT_V3 is accepted');
  if (!args.apply) {
    process.stdout.write(JSON.stringify({
      status: 'PASS', mode: 'DRY_RUN_LOCAL', writes: 0, source_snapshot_sha256: validation.declaredHash,
      payload_sha256: validation.actualHash, manifest_sha256: validation.actualManifestHash,
      counts: validation.counts, chunk_size: args.chunkSize, chunks: Math.ceil(validation.counts.evidence / args.chunkSize),
      authority: 'SHADOW_ONLY', cutover: false,
    }, null, 2) + '\n');
    return;
  }

  const values = loadEnvironment();
  assert.strictEqual(values.SUTI_SAVINGS_IMPORT_CONFIRM, 'SHADOW_ONLY_NO_CUTOVER', 'SAVINGS_IMPORT_CONFIRMATION_REQUIRED');
  const conn = connection(values);
  let batch = await getBatch(conn);
  if (batch) {
    equivalentBatch(batch, input, validation);
    if (batch.status === 'APPLIED') {
      await verifyApplied(conn, batch, validation);
      process.stdout.write(JSON.stringify({ status: 'PASS', mode: 'ALREADY_APPLIED', writes: 0, batch_id: batch.id, counts: validation.counts, authority: 'SHADOW_ONLY', cutover: false }, null, 2) + '\n');
      return;
    }
    assert.strictEqual(batch.status, 'VALIDATED', 'Existing batch is not safely resumable');
  } else batch = await createBatch(conn, input, validation);

  equivalentBatch(batch, input, validation);
  const participantIds = await ensureParticipants(conn, batch, input);
  await loadEvidence(conn, batch, input, participantIds, args.chunkSize);
  const counts = await finalize(conn, batch, input, validation);
  batch = await getBatch(conn);
  assert.strictEqual(batch.status, 'APPLIED', 'Batch did not finalize');
  await verifyApplied(conn, batch, validation);
  process.stdout.write(JSON.stringify({
    status: 'PASS', mode: 'APPLIED', batch_id: batch.id,
    source_snapshot_sha256: BASELINE_SHA256, payload_sha256: validation.actualHash,
    manifest_sha256: validation.actualManifestHash, counts: validation.counts,
    verified: counts, canonical_transactions: 0, yield_credits: 0,
    authority: 'SHADOW_ONLY', google_authority_unchanged: true, cutover: false,
  }, null, 2) + '\n');
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, recovery: 'PREPARED_EXACT_BATCH_ONLY_NOT_AUTOMATIC' }));
  process.exitCode = 1;
});
