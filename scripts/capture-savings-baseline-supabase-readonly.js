#!/usr/bin/env node
'use strict';

const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = process.argv[2] && path.resolve(process.argv[2]);
assert(output, 'USAGE: node scripts/capture-savings-baseline-supabase-readonly.js <private-output.json>');

function environment() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim(), at = line.indexOf('=');
    if (at > 0 && !line.startsWith('#')) values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^["']|["']$/g, '');
  }
  return values;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function hash(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex').toUpperCase(); }
async function query(values, sql) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'SutiApp-SavingsBaselineReadOnly/1.0' },
    body: JSON.stringify({ query: sql }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`MANAGEMENT_SQL_${response.status}:${JSON.stringify(data).slice(0, 600)}`);
  return data;
}

(async () => {
  const values = environment();
  assert(values.SUPABASE_URL && values.SUPABASE_ACCESS_TOKEN, 'SUPABASE_MANAGEMENT_CONFIGURATION_MISSING');
  const sql = `select coalesce(
    jsonb_agg(jsonb_build_object('id',id::text,'numero_control',numero_control) order by id),
    '[]'::jsonb
  ) as rows from public.affiliates`;
  const result = await query(values, sql);
  const rows = result[0] && result[0].rows;
  assert(Array.isArray(rows), 'SUPABASE_SNAPSHOT_INVALID');
  const snapshot = {
    version: 'SAVINGS_BASELINE_AFFILIATE_IDENTITY_V2_STRICT_COLUMNS',
    captured_at: new Date().toISOString(),
    source: 'public.affiliates SELECT id,numero_control via management SQL',
    selected_columns: ['id', 'numero_control'],
    rows,
    rows_sha256: hash(rows),
    writes: 0,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(JSON.stringify({ status: snapshot.rows.length > 0 ? 'PASS' : 'FAIL', mode: 'SUPABASE_READ_ONLY_BASELINE_SNAPSHOT_STRICT_COLUMNS', affiliates: snapshot.rows.length, selected_columns: snapshot.selected_columns, rows_sha256: snapshot.rows_sha256, writes: 0 }));
  if (!snapshot.rows.length) process.exitCode = 2;
})().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message, writes: 0 })); process.exitCode = 1; });
