'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readEnv() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    const separator = line.indexOf('=');
    if (separator > 0 && !line.startsWith('#')) {
      values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return values;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

async function signIn(values, email, password) {
  const result = await request(values.SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.access_token;
}

function headers(values, token) {
  return { apikey: values.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
}

async function management(values, query) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const result = await request('https://api.supabase.com/v1/projects/' + ref + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + values.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'SutiApp-LoanDeposit-Security/1.0' },
    body: JSON.stringify({ query }),
  });
  assert(result.ok, JSON.stringify(result.body));
  return result.body;
}

async function run() {
  const values = readEnv();
  const rows = await management(values, `select id from public.affiliate_bank_accounts where affiliate_id='${values.H005_TEST_AFFILIATE_ID}'::uuid order by is_primary desc,created_at limit 1`);
  assert.equal(rows.length, 1, 'H005_TEST requires one existing bank account');
  const accountId = rows[0].id;
  const [ownerToken, otherToken] = await Promise.all([
    signIn(values, values.H005_TEST_EMAIL, values.H005_TEST_PASSWORD),
    signIn(values, values.H005_TEST2_EMAIL, values.H005_TEST2_PASSWORD),
  ]);
  const ownerSelfRead = await request(values.SUPABASE_URL + '/rest/v1/rpc/list_current_deposit_accounts', { method: 'POST', headers: headers(values, ownerToken), body: '{}' });
  assert.equal(ownerSelfRead.status, 200, JSON.stringify(ownerSelfRead.body));
  assert(ownerSelfRead.body.length >= 1 && ownerSelfRead.body.every((row) => row.affiliate_id === values.H005_TEST_AFFILIATE_ID), 'Admin self-service read leaked another affiliate');
  const otherSelfRead = await request(values.SUPABASE_URL + '/rest/v1/rpc/list_current_deposit_accounts', { method: 'POST', headers: headers(values, otherToken), body: '{}' });
  assert.equal(otherSelfRead.status, 200, JSON.stringify(otherSelfRead.body));
  assert(otherSelfRead.body.every((row) => row.affiliate_id === values.H005_TEST2_AFFILIATE_ID), 'Normal self-service read leaked another affiliate');
  const own = await request(values.SUPABASE_URL + '/rest/v1/affiliate_bank_accounts?select=id&id=eq.' + accountId, { headers: headers(values, ownerToken) });
  assert.equal(own.status, 200, JSON.stringify(own.body));
  assert.equal(own.body.length, 1, 'owner must read own account');
  const crossRead = await request(values.SUPABASE_URL + '/rest/v1/affiliate_bank_accounts?select=id&id=eq.' + accountId, { headers: headers(values, otherToken) });
  assert.equal(crossRead.status, 200, JSON.stringify(crossRead.body));
  assert.equal(crossRead.body.length, 0, 'RLS must hide cross-affiliate account');
  const crossWrite = await request(values.SUPABASE_URL + '/rest/v1/rpc/save_affiliate_deposit_account', {
    method: 'POST', headers: headers(values, otherToken),
    body: JSON.stringify({ p_id: accountId, p_bank: 'Banco Denegado', p_card: '4111111111111111', p_clabe: '032180000118359719' }),
  });
  assert.equal(crossWrite.ok, false, 'cross-affiliate writer must fail');
  assert.match(JSON.stringify(crossWrite.body), /BANK_ACCOUNT_NOT_FOUND/);
  const privateRead = await request(values.SUPABASE_URL + '/rest/v1/loan_request_deposit_snapshots?select=request_id&limit=1', { headers: headers(values, ownerToken) });
  assert([401, 403].includes(privateRead.status), JSON.stringify(privateRead));
  const anonHeaders = { apikey: values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  const anonRead = await request(values.SUPABASE_URL + '/rest/v1/affiliate_bank_accounts?select=id&limit=1', { headers: anonHeaders });
  assert([401, 403].includes(anonRead.status), JSON.stringify(anonRead));
  const anonRpc = await request(values.SUPABASE_URL + '/rest/v1/rpc/get_current_notification_phone', { method: 'POST', headers: anonHeaders, body: '{}' });
  assert([401, 403].includes(anonRpc.status), JSON.stringify(anonRpc));
  console.log(JSON.stringify({ status: 'PASS', self_read: 'EFFECTIVE_AFFILIATE_ONLY', owner_read: 'ALLOWED', cross_read: 'DENIED_BY_RLS', cross_write: 'DENIED_BY_RPC', private_snapshot: 'DENIED', anonymous: 'DENIED', fixture_writes: 0 }));
}

run().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
