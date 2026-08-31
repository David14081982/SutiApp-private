'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'status';
if (!new Set(['status', 'bundle', 'deploy', 'verify']).has(mode)) throw new Error('USAGE: status|bundle|deploy|verify');
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'supabase', 'functions', 'financial-legacy', 'index.ts');
const policyPath = path.join(root, 'supabase', 'functions', 'financial-legacy', 'visibility-policy.js');
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

function env() {
  const result = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    const separator = line.indexOf('=');
    if (separator > 0 && !line.startsWith('#')) result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return result;
}

(async () => {
  const values = env();
  const source = fs.readFileSync(sourcePath, 'utf8');
  const policy = fs.readFileSync(policyPath, 'utf8');
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const slug = 'financial-legacy';
  const base = 'https://api.supabase.com/v1/projects/' + ref + '/functions/';
  const headers = { Authorization: 'Bearer ' + values.SUPABASE_ACCESS_TOKEN, 'User-Agent': 'SutiApp-Financial-Legacy/1.0' };
  if (mode === 'status') {
    const response = await fetch(base + slug, { headers });
    const body = await response.json();
    if (!response.ok) throw new Error('SUPABASE_STATUS_' + response.status);
    console.log(JSON.stringify({ status: 'PASS', mode, slug, deployed: true, version: body.version || null, cloudStatus: body.status || null, verifyJwt: body.verify_jwt, secretLogged: false }));
    return;
  }
  if (mode === 'verify') {
    const response = await fetch(base + slug + '/body', { headers });
    if (!response.ok) throw new Error('SUPABASE_VERIFY_' + response.status);
    const remote = Buffer.from(await response.arrayBuffer());
    const markers = ['source/index.ts', 'deposit_selection', 'bank_account_id', 'notification_phone', 'create_validated_financial_program_request'];
    const magic = remote.subarray(0, 12).toString('ascii');
    const compiled = magic.startsWith('ESZIP') || remote.includes(Buffer.from('source/index.ts'));
    if (compiled) {
      for (const marker of markers) if (!remote.includes(Buffer.from(marker))) throw new Error('DEPLOYED_BUNDLE_MARKER_MISSING_' + marker);
    } else if (sha(remote) !== sha(Buffer.from(source))) {
      throw new Error('DEPLOYED_SOURCE_MISMATCH_remote=' + sha(remote) + '_bytes=' + remote.length + '_magic=' + remote.subarray(0, 12).toString('hex'));
    }
    console.log(JSON.stringify({ status: 'PASS', mode, slug, bytes: remote.length, sha256: sha(remote), compiledBundle: compiled, requiredMarkers: markers.length, secretLogged: false }));
    return;
  }
  const form = new FormData();
  form.append('metadata', JSON.stringify({ name: slug, slug, entrypoint_path: 'index.ts', verify_jwt: true }));
  form.append('file', new Blob([source], { type: 'application/typescript' }), 'index.ts');
  form.append('file', new Blob([policy], { type: 'application/javascript' }), 'visibility-policy.js');
  const suffix = mode === 'bundle' ? '&bundleOnly=true' : '';
  const response = await fetch(base + 'deploy?slug=' + slug + suffix, { method: 'POST', headers, body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(body.message || body.error || body.msg || '').replace(/[\r\n]+/g, ' ').slice(0, 400);
    throw new Error('SUPABASE_' + mode.toUpperCase() + '_' + response.status + (detail ? '_' + detail : ''));
  }
  console.log(JSON.stringify({ status: 'PASS', mode, slug, httpStatus: response.status, version: body.version || null, cloudStatus: body.status || null, sourceSha256: sha(source + '\n--visibility-policy--\n' + policy), verifyJwt: true, secretLogged: false }));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, secretLogged: false }));
  process.exitCode = 1;
});
