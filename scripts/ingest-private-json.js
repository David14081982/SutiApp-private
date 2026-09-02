#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const output = process.argv[2];
if (!output) throw new Error('USAGE: output-file');

async function main() {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') process.stdin.setRawMode(true);
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const line = await new Promise((resolve, reject) => {
    input.once('line', resolve);
    input.once('error', reject);
    input.once('close', () => reject(new Error('INGEST_PAYLOAD_MISSING')));
  });
  input.close();
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') process.stdin.setRawMode(false);
  process.stdin.pause();
  const parsed = JSON.parse(line);
  const resolved = path.resolve(output);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(parsed), { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) {}
  console.log(JSON.stringify({ status: 'PASS', mode: 'INGEST_PRIVATE_JSON', file: path.basename(output), bytes: Buffer.byteLength(line), external_writes: 0 }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, external_writes: 0 }));
  process.exit(1);
});
