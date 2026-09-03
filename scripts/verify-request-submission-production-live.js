'use strict';

const assert = require('assert').strict;
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const site = (process.argv[2] || process.env.SUTIAPP_PRODUCTION_URL || '').replace(/\/?$/, '/');

async function fetchText(relative) {
  const url = `${site}${relative}?request-guard=${Date.now()}`;
  let last;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    last = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
    if (last.ok) return last.text();
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`PRODUCTION_ASSET_${relative}_${last && last.status}`);
}

async function main() {
  assert(/^https:\/\//.test(site), 'production HTTPS URL missing');
  const [html, repository, bundle] = await Promise.all([
    fetchText('SutiApp.html'),
    fetchText('app/financial-legacy-repository.js'),
    fetchText('app/bundle.js'),
  ]);
  assert(html.includes('app/bundle.js'), 'PRODUCTION_BUNDLE_NOT_LINKED');
  for (const marker of ['loanSessionConfirm', 'idempotency_key', 'request_id', 'workflow_state']) {
    assert(repository.includes(marker), `PRODUCTION_REPOSITORY_MARKER_MISSING_${marker}`);
  }
  for (const marker of ['RequestSubmissionSuccess', 'confetti', 'reference']) {
    assert(bundle.includes(marker), `PRODUCTION_SUCCESS_MARKER_MISSING_${marker}`);
  }
  const contract = spawnSync(process.execPath, ['scripts/verify-request-submission-deployment-contract-live.js'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(contract.status, 0, contract.stderr || contract.stdout || 'BACKEND_CONTRACT_FAILED');
  console.log(JSON.stringify({
    status: 'PASS',
    target: site,
    publicArtifact: true,
    repositoryContract: true,
    successContract: true,
    backendCompatibility: true,
    privilegedCredentialsUsed: false,
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
