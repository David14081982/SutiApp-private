'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { REQUIRED_AUTH_RPCS, classifyProbe, verifyAuthDeploymentContract } = require('./verify-auth-deployment-contract-live');

const root = path.resolve(__dirname, '..');
const repositorySource = fs.readFileSync(path.join(root, 'app', 'affiliate-repository.js'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'app', 'affiliate-auth.js'), 'utf8');
const workflowSource = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');

for (const rpc of REQUIRED_AUTH_RPCS) {
  assert(repositorySource.includes(`rpc('${rpc}')`) || authSource.includes(`rpc('${rpc}')`), `Required Auth RPC is absent from the actual Auth path: ${rpc}`);
}

function rpcCallsBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `Unable to isolate Auth contract between ${start} and ${end}`);
  return [...source.slice(from, to).matchAll(/\.rpc\('([^']+)'/g)].map((match) => match[1]);
}

const actualSessionRpcs = [
  ...rpcCallsBetween(repositorySource, 'async function getCurrentAffiliate', 'async function getById'),
  ...rpcCallsBetween(authSource, 'async function resolveSessionOnce', 'function resolveSession'),
].sort();
assert.deepEqual(actualSessionRpcs, [...REQUIRED_AUTH_RPCS].sort(), 'Every required RPC in the actual session path must be covered by the predeploy gate');

assert.equal(classifyProbe({ status: 404, ok: false }, { code: 'PGRST202' }), 'MISSING');
assert.equal(classifyProbe({ status: 403, ok: false }, { code: '42501', message: 'permission denied for function' }), 'PRESENT_DENIED');
assert.equal(classifyProbe({ status: 200, ok: true }, {}), 'ANON_EXPOSED');
assert.equal(classifyProbe({ status: 503, ok: false }, {}), 'UNEXPECTED');

function response(status, payload) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload };
}

(async () => {
  const deniedFetch = async () => response(401, { code: '42501', message: 'permission denied for function' });
  const results = await verifyAuthDeploymentContract({ fetchImpl: deniedFetch, url: 'https://example.supabase.co', publishableKey: 'public-test-key' });
  assert.equal(results.length, REQUIRED_AUTH_RPCS.length);

  let missingRejected = false;
  try {
    await verifyAuthDeploymentContract({
      fetchImpl: async (url) => url.endsWith('/get_current_affiliate_access_state')
        ? response(404, { code: 'PGRST202', message: 'Could not find the function' })
        : response(401, { code: '42501', message: 'permission denied for function' }),
      url: 'https://example.supabase.co', publishableKey: 'public-test-key',
    });
  } catch (error) { missingRejected = /get_current_affiliate_access_state:MISSING/.test(error.message); }
  assert.equal(missingRejected, true, 'Missing Auth RPC must block deployment');

  let exposedRejected = false;
  try {
    await verifyAuthDeploymentContract({
      fetchImpl: async () => response(200, {}),
      url: 'https://example.supabase.co', publishableKey: 'public-test-key',
    });
  } catch (error) { exposedRejected = /ANON_EXPOSED/.test(error.message); }
  assert.equal(exposedRejected, true, 'Anonymous Auth RPC exposure must block deployment');

  const gateIndex = workflowSource.indexOf('node scripts/verify-auth-deployment-contract-live.js');
  const buildIndex = workflowSource.indexOf('node scripts/build-pages-site.js');
  const deployIndex = workflowSource.indexOf('actions/deploy-pages@');
  assert(gateIndex >= 0, 'Pages workflow must execute the Auth compatibility gate');
  assert(gateIndex < buildIndex && gateIndex < deployIndex, 'Auth compatibility gate must precede build and deploy');
  console.log(JSON.stringify({ status: 'PASS', requiredRpcs: REQUIRED_AUTH_RPCS.length, missingSchemaBlocked: true, anonymousExposureBlocked: true }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
