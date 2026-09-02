#!/usr/bin/env node
'use strict';

/* Read-only capture of the certified Savings SHADOW batch. This script only
   issues GET requests and writes the derived PII snapshot under ignored tmp/. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { canonical, sha256 } = require('./import-savings-shadow.js');

const root = path.resolve(__dirname, '..');
const BATCH_ID = '9b20b0cc-456b-4ad7-8058-c8ebe551dc31';
const MANIFEST_SHA256 = '3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1';
const TABLES = [
  'savings_import_batches', 'savings_participants', 'savings_enrollments', 'savings_contribution_plans',
  'savings_contribution_overrides', 'savings_transactions', 'savings_action_availability',
  'savings_beneficiary_versions', 'savings_beneficiaries', 'savings_requests', 'savings_request_approvals',
  'savings_holds', 'savings_yield_periods', 'savings_yield_allocations', 'savings_process_change_events',
  'savings_legacy_evidence', 'savings_audit_events',
];

function env() {
  const values = { ...process.env };
  const file = path.join(root, 'supabase.env');
  for (const line of fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !values[match[1]]) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function connection() {
  const values = env();
  const url = String(values.SUPABASE_URL || '').replace(/\/$/, '');
  const key = values.SUPABASE_SECRET_KEY || '';
  assert(/^https:\/\//.test(url) && key, 'SUPABASE_READONLY_CONFIGURATION_MISSING');
  return { url, key };
}

async function get(conn, table, query, range, count = false) {
  const headers = { apikey: conn.key, authorization: `Bearer ${conn.key}` };
  if (range) headers.range = range;
  if (count) headers.prefer = 'count=exact';
  const search = new URLSearchParams(query);
  const response = await fetch(`${conn.url}/rest/v1/${table}?${search}`, { method: 'GET', headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`SAVINGS_READ_FAILED:${table}:${response.status}:${body && (body.code || body.message) || 'UNKNOWN'}`);
  return { body, contentRange: response.headers.get('content-range') || '' };
}

async function exactCount(conn, table) {
  const result = await get(conn, table, { select: 'id', limit: '1' }, '0-0', true);
  const match = result.contentRange.match(/\/(\d+)$/);
  assert(match, `${table}:COUNT_UNAVAILABLE`);
  return Number(match[1]);
}

async function allCounts(conn) {
  const pairs = await Promise.all(TABLES.map(async (table) => [table, await exactCount(conn, table)]));
  return Object.fromEntries(pairs);
}

async function paged(conn, table, query, expected, pageSize = 1000) {
  const rows = [];
  for (let start = 0; start < expected; start += pageSize) {
    const result = await get(conn, table, query, `${start}-${Math.min(start + pageSize - 1, expected - 1)}`);
    assert(Array.isArray(result.body), `${table}:ROWS_NOT_ARRAY`);
    rows.push(...result.body);
  }
  assert.strictEqual(rows.length, expected, `${table}:ROW_COUNT_CHANGED_DURING_CAPTURE`);
  return rows;
}

async function capture(outputFile) {
  const conn = connection();
  const countsBefore = await allCounts(conn);
  assert.deepStrictEqual(countsBefore, {
    savings_import_batches: 1, savings_participants: 363, savings_enrollments: 0,
    savings_contribution_plans: 0, savings_contribution_overrides: 0, savings_transactions: 0,
    savings_action_availability: 0, savings_beneficiary_versions: 0, savings_beneficiaries: 0,
    savings_requests: 0, savings_request_approvals: 0, savings_holds: 0, savings_yield_periods: 0,
    savings_yield_allocations: 0, savings_process_change_events: 0, savings_legacy_evidence: 42229,
    savings_audit_events: 1,
  }, 'SAVINGS_SHADOW_STATE_UNEXPECTED');

  const batchRows = (await get(conn, 'savings_import_batches', {
    select: 'id,source_workbook_id,source_workbook_name,source_snapshot_sha256,certification_status,status,row_counts,provenance,started_at,finished_at',
    id: `eq.${BATCH_ID}`, limit: '2',
  })).body;
  assert(Array.isArray(batchRows) && batchRows.length === 1, 'SAVINGS_CERTIFIED_BATCH_MISSING');
  const batch = batchRows[0];
  assert.strictEqual(batch.source_snapshot_sha256, MANIFEST_SHA256, 'SAVINGS_MANIFEST_SHA_MISMATCH');
  assert.strictEqual(batch.certification_status, 'CERTIFIED');
  assert.strictEqual(batch.status, 'APPLIED');

  const participants = await paged(conn, 'savings_participants', {
    select: 'legacy_folio,identity_status,current_process,legacy_reported_balance,certification_status',
    import_batch_id: `eq.${BATCH_ID}`, order: 'legacy_folio.asc',
  }, countsBefore.savings_participants);
  const evidence = await paged(conn, 'savings_legacy_evidence', {
    select: 'source_sheet,source_column,source_row,legacy_folio,observed_on,numeric_value,record_type,data_classification,source_row_sha256,raw_payload',
    import_batch_id: `eq.${BATCH_ID}`, order: 'id.asc',
  }, countsBefore.savings_legacy_evidence);

  const countsAfter = await allCounts(conn);
  assert.deepStrictEqual(countsAfter, countsBefore, 'SAVINGS_TABLE_COUNTS_CHANGED_DURING_CAPTURE');
  const financialState = { batch, table_counts: countsAfter, participants, evidence };
  const captureSha256 = sha256(canonical(financialState));
  const output = {
    version: 'SAVINGS_LEDGER_RECONCILIATION_SOURCE_V1', captured_at: new Date().toISOString(),
    source: 'SUPABASE_SHADOW_READ_ONLY', batch_id: BATCH_ID, manifest_sha256: MANIFEST_SHA256,
    operations: { http_get: true, google_requests: 0, supabase_writes: 0 },
    counts_before: countsBefore, counts_after: countsAfter,
    capture_sha256: captureSha256, financial_state: financialState,
  };
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(output) + '\n', { mode: 0o600 });
  return { output: outputFile, capture_sha256: captureSha256, participants: participants.length, evidence: evidence.length, writes: 0 };
}

async function main() {
  const output = path.resolve(process.argv[2] || path.join(root, 'tmp/savings-ledger-reconciliation-20260902/source-run-1.json'));
  process.stdout.write(JSON.stringify(await capture(output), null, 2) + '\n');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: 'FAIL', error: error.message, supabase_writes: 0, google_writes: 0 }));
    process.exitCode = 1;
  });
}

module.exports = { capture, BATCH_ID, MANIFEST_SHA256, TABLES };
