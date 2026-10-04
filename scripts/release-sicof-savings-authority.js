'use strict';
// Owner-authorized SICOF V4 deployment only. No SQL or financial data writes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..');
const releaseRoot = path.join(root, '.tmp/sicof/release');
const privateDir = path.join(root, '.tmp/sicof-authority-release');
const outputDir = path.join(root, 'docs/qa/evidence/sicof-authority-release');
const modulePath = 'supabase/functions/sicof';
const engineVersion = 'SICOF_2026_10_04_V4';
const baselineVersion = 15;
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = relative => JSON.parse(read(relative));
const proof = (name, value) => {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, name + '.json'), JSON.stringify(value, null, 2) + '\n');
  console.log(JSON.stringify(value));
};

function requireTests() {
  for (const name of ['engine', 'build', 'live-comparison']) {
    assert.equal(json('docs/qa/evidence/sicof-savings-authority/' + name + '.json').status,
      'PASS', 'REQUIRED_EVIDENCE_' + name);
  }
  assert.equal(json('docs/qa/evidence/sicof-savings-authority/engine.json').engine_version,
    engineVersion, 'TESTED_ENGINE_VERSION');
  assert.equal(json('docs/qa/evidence/sicof-savings-authority/live-comparison.json').engine,
    engineVersion, 'COMPARED_ENGINE_VERSION');
}

function sourcePackage() {
  const list = directory => fs.readdirSync(directory).filter(name => /\.(ts|mjs)$/.test(name)).sort();
  const names = list(path.join(root, modulePath));
  assert.deepEqual(names, list(path.join(releaseRoot, modulePath)), 'RELEASE_MODULE_SET_DRIFT');
  assert(names.includes('index.ts') && names.includes('engine.mjs'), 'REQUIRED_EDGE_MODULES');
  const hashes = {}, sources = [];
  for (const name of names) {
    const bytes = fs.readFileSync(path.join(root, modulePath, name));
    const releaseBytes = fs.readFileSync(path.join(releaseRoot, modulePath, name));
    assert(bytes.equals(releaseBytes), 'RELEASE_MODULE_BYTES_DRIFT_' + name);
    hashes[name] = sha(bytes);
    sources.push({ name, bytes });
  }
  assert(read(modulePath + '/engine.mjs').includes("export const ENGINE_VERSION = '" + engineVersion + "';"),
    'ENGINE_V4_REQUIRED');
  return { hashes, sources };
}

function baselineMetadata(metadata) {
  assert.equal(metadata.slug, 'sicof', 'EDGE_SLUG');
  assert.equal(metadata.version, baselineVersion, 'EXPECTED_EDGE_15');
  assert.equal(metadata.status, 'ACTIVE', 'EXPECTED_ACTIVE_EDGE');
  assert.equal(metadata.verify_jwt, true, 'JWT_REQUIRED');
  assert(typeof metadata.id === 'string' && metadata.id.length > 0, 'EDGE_ID_REQUIRED');
}

async function main() {
  const mode = process.argv[2];
  assert(['backup', 'compile', 'deploy'].includes(mode), 'MODE_REQUIRED_backup_compile_deploy');
  requireTests();
  const { hashes, sources } = sourcePackage();
  const env = Object.fromEntries(read('supabase.env').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map(line => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map(match => [match[1], match[2].trim().replace(/^['"]|['"]$/g, '')]));
  assert(env.SUPABASE_URL && env.SUPABASE_ACCESS_TOKEN, 'RELEASE_CREDENTIALS_REQUIRED');
  const hostname = new URL(env.SUPABASE_URL).hostname;
  assert(/^[a-z0-9]+\.supabase\.co$/.test(hostname), 'SUPABASE_PROJECT_HOST');
  const base = 'https://api.supabase.com/v1/projects/' + hostname.split('.')[0];
  async function api(route, options = {}) {
    const response = await fetch(base + route, {
      ...options,
      headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, ...options.headers },
      signal: AbortSignal.timeout(180000)
    });
    if (!response.ok) throw Error('SICOF_AUTHORITY_RELEASE_HTTP_' + response.status);
    return response;
  }
  const metadata = async () => (await api('/functions/sicof')).json();
  const body = async () => Buffer.from(await (await api('/functions/sicof/body')).arrayBuffer());
  const backupMetadataPath = path.join(privateDir, 'edge-before.json');
  const backupBodyPath = path.join(privateDir, 'edge-before.eszip');

  if (mode === 'backup') {
    assert(!fs.existsSync(backupMetadataPath) && !fs.existsSync(backupBodyPath), 'BACKUP_EXISTS');
    const before = await metadata();
    baselineMetadata(before);
    const bytes = await body();
    assert(bytes.length > 1000, 'BACKUP_BODY_EMPTY');
    const after = await metadata();
    assert.deepEqual(after, before, 'EDGE_CHANGED_DURING_BACKUP');
    fs.mkdirSync(privateDir, { recursive: true });
    fs.writeFileSync(backupBodyPath, bytes, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(backupMetadataPath, JSON.stringify(before, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    proof('release-backup', {
      status: 'PASS', at: new Date().toISOString(), version: before.version,
      cloudStatus: before.status, verifyJwt: true, bodySha256: sha(bytes), bodyBytes: bytes.length,
      financialWrites: 0
    });
    return;
  }

  const backup = JSON.parse(fs.readFileSync(backupMetadataPath, 'utf8'));
  baselineMetadata(backup);
  const backupProof = json('docs/qa/evidence/sicof-authority-release/release-backup.json');
  assert.equal(backupProof.status, 'PASS', 'BACKUP_EVIDENCE_REQUIRED');
  assert.equal(backupProof.version, baselineVersion, 'BACKUP_VERSION');
  const backupHash = sha(fs.readFileSync(backupBodyPath));
  assert.equal(backupHash, backupProof.bodySha256, 'BACKUP_BODY_DRIFT');
  const current = await metadata();
  baselineMetadata(current);
  assert.deepEqual(current, backup, 'EDGE_METADATA_DRIFT');
  assert.equal(sha(await body()), backupHash, 'EDGE_BODY_DRIFT');
  assert.deepEqual(await metadata(), backup, 'EDGE_CHANGED_DURING_BASELINE_CHECK');

  if (mode === 'deploy') {
    const compiled = json('docs/qa/evidence/sicof-authority-release/edge-compile.json');
    assert.equal(compiled.status, 'PASS', 'COMPILE_REQUIRED');
    assert.equal(compiled.engineVersion, engineVersion, 'COMPILED_ENGINE_VERSION');
    assert.equal(compiled.baselineVersion, baselineVersion, 'COMPILED_BASELINE_VERSION');
    assert.equal(compiled.baselineBodySha256, backupHash, 'COMPILED_BASELINE_DRIFT');
    assert.deepEqual(hashes, compiled.hashes, 'COMPILED_SOURCE_DRIFT');
  }
  const form = new FormData();
  for (const { name, bytes } of sources) {
    form.append('file', new Blob([bytes], {
      type: name.endsWith('.ts') ? 'application/typescript' : 'application/javascript'
    }), name);
  }
  form.append('metadata', JSON.stringify({
    name: 'sicof', slug: 'sicof', entrypoint_path: 'index.ts', verify_jwt: true
  }));
  await (await api('/functions/deploy?slug=sicof' + (mode === 'compile' ? '&bundleOnly=true' : ''), {
    method: 'POST', body: form
  })).json();
  const after = await metadata();
  assert.equal(after.id, backup.id, 'EDGE_ID_CHANGED');
  assert.equal(after.slug, 'sicof', 'EDGE_SLUG_CHANGED');
  assert.equal(after.verify_jwt, true, 'JWT_CHANGED');
  assert.equal(after.status, 'ACTIVE', 'EDGE_NOT_ACTIVE');
  if (mode === 'compile') {
    assert.deepEqual(after, backup, 'COMPILE_CHANGED_ACTIVE_EDGE');
  } else {
    assert.equal(after.version, baselineVersion + 1, 'UNEXPECTED_DEPLOYED_VERSION');
  }
  proof('edge-' + mode, {
    status: 'PASS', at: new Date().toISOString(), engineVersion,
    baselineVersion, baselineBodySha256: backupHash, version: after.version,
    cloudStatus: after.status, verifyJwt: true, hashes,
    isolatedCheckoutByteMatch: true, financialWrites: 0,
    productionDeployment: mode === 'deploy'
  });
}

if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
