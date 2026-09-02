'use strict';

const REQUIRED_AUTH_RPCS = Object.freeze([
  'get_current_affiliate_access_state',
  'get_effective_affiliate_id',
  'get_impersonation_context',
  'get_admin_access_context',
]);

function classifyProbe(response, payload) {
  const code = String(payload && payload.code || '').toUpperCase();
  const message = String(payload && payload.message || '').toLowerCase();
  if (response.status === 404 || code === 'PGRST202' || message.includes('could not find the function')) return 'MISSING';
  if (response.ok) return 'ANON_EXPOSED';
  if ((response.status === 401 || response.status === 403) && (code === '42501' || message.includes('permission denied'))) return 'PRESENT_DENIED';
  return 'UNEXPECTED';
}

async function probeRpc(fetchImpl, url, publishableKey, rpc) {
  const response = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/rpc/${rpc}`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  let payload = {};
  try { payload = await response.json(); } catch (_) {}
  return { rpc, status: response.status, code: payload && payload.code || null, verdict: classifyProbe(response, payload) };
}

async function verifyAuthDeploymentContract(options) {
  const fetchImpl = options.fetchImpl;
  const url = options.url;
  const publishableKey = options.publishableKey;
  if (!url || !publishableKey) throw new Error('Supabase public deployment configuration is missing');
  const results = [];
  for (const rpc of REQUIRED_AUTH_RPCS) results.push(await probeRpc(fetchImpl, url, publishableKey, rpc));
  const failures = results.filter((result) => result.verdict !== 'PRESENT_DENIED');
  if (failures.length) throw new Error(`Auth backend contract incompatible: ${failures.map((item) => `${item.rpc}:${item.verdict}:${item.status}`).join(', ')}`);
  return results;
}

async function main() {
  const results = await verifyAuthDeploymentContract({
    fetchImpl: fetch,
    url: process.env.SUTIAPP_SUPABASE_URL,
    publishableKey: process.env.SUTIAPP_SUPABASE_PUBLISHABLE_KEY,
  });
  console.log(JSON.stringify({
    status: 'PASS',
    contract: 'AUTH_BACKEND_COMPATIBLE_AND_ANON_DENIED',
    rpcs: results.map(({ rpc, status, verdict }) => ({ rpc, status, verdict })),
  }));
}

module.exports = { REQUIRED_AUTH_RPCS, classifyProbe, probeRpc, verifyAuthDeploymentContract };

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
    process.exitCode = 1;
  });
}
