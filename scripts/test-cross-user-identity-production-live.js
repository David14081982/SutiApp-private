'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');

function env() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = raw.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function mask(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 4)}…${crypto.createHash('sha256').update(text).digest('hex').slice(0, 8)}` : null;
}

async function request(url, key, { method = 'GET', token, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: Object.assign({ apikey: key, Accept: 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {}, body === undefined ? {} : { 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(values, alias) {
  const base = values.SUPABASE_URL.replace(/\/$/, '');
  const result = await request(`${base}/auth/v1/token?grant_type=password`, values.SUPABASE_PUBLISHABLE_KEY, {
    method: 'POST', body: { email: values[`${alias}_EMAIL`], password: values[`${alias}_PASSWORD`] },
  });
  assert.equal(result.status, 200, `${alias}_LOGIN_FAILED`);
  assert(result.data && result.data.access_token && result.data.refresh_token && result.data.user && result.data.user.id, `${alias}_SESSION_MISSING`);
  return { alias, token: result.data.access_token, refresh: result.data.refresh_token, userId: result.data.user.id, affiliateId: values[`${alias}_AFFILIATE_ID`] };
}

async function rpc(values, actor, name, body = {}) {
  return request(`${values.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${name}`, values.SUPABASE_PUBLISHABLE_KEY, { method: 'POST', token: actor.token, body });
}

async function verifyIdentity(values, actor, label) {
  const state = await rpc(values, actor, 'get_current_affiliate_access_state');
  const effective = await rpc(values, actor, 'get_effective_affiliate_id');
  assert.equal(state.status, 200, `${label}_STATE_FAILED`);
  assert.equal(state.data, 'ACTIVE', `${label}_STATE_NOT_ACTIVE`);
  assert.equal(effective.status, 200, `${label}_EFFECTIVE_FAILED`);
  assert.equal(effective.data, actor.affiliateId, `${label}_EFFECTIVE_MISMATCH`);
  return { auth_user_id: mask(actor.userId), expected_affiliate_id: mask(actor.affiliateId), resolved_affiliate_id: mask(effective.data), match: 'PASS' };
}

async function main() {
  const values = env();
  const aliases = ['H005_TEST', 'H005_TEST2', 'H005_TEST3'].filter((alias) => values[`${alias}_EMAIL`] && values[`${alias}_PASSWORD`] && values[`${alias}_AFFILIATE_ID`]);
  assert(aliases.length >= 2, 'AT_LEAST_TWO_IDENTITY_FIXTURES_REQUIRED');
  const actors = [];
  const unavailable = [];
  for (const alias of aliases) {
    try { actors.push(await login(values, alias)); }
    catch (_) { unavailable.push(alias); }
  }
  assert(actors.length >= 2, 'AT_LEAST_TWO_VALID_IDENTITY_FIXTURES_REQUIRED');

  const samples = [];
  for (const actor of actors) samples.push(await verifyIdentity(values, actor, `${actor.alias}_LOGIN`));

  const normal = actors.find((actor) => actor.alias !== 'H005_TEST') || actors[0];
  const foreign = actors.find((actor) => actor.affiliateId !== normal.affiliateId);
  assert(foreign, 'FOREIGN_AFFILIATE_FIXTURE_REQUIRED');
  const base = values.SUPABASE_URL.replace(/\/$/, '');
  const encoded = encodeURIComponent(foreign.affiliateId);
  for (const [label, query] of [
    ['PROFILE', `/rest/v1/affiliates?select=id&id=eq.${encoded}`],
    ['PHOTO', `/rest/v1/affiliate_files?select=id&affiliate_id=eq.${encoded}&file_key=eq.profile_photo`],
    ['DOCUMENTS', `/rest/v1/affiliate_files?select=id&affiliate_id=eq.${encoded}&file_key=neq.profile_photo`],
    ['REQUESTS', `/rest/v1/program_requests?select=id&affiliate_id=eq.${encoded}`],
  ]) {
    const result = await request(base + query, values.SUPABASE_PUBLISHABLE_KEY, { token: normal.token });
    assert.equal(result.status, 200, `${label}_READ_FAILED`);
    assert.deepEqual(result.data, [], `FOREIGN_${label}_VISIBLE`);
  }
  const savings = await request(`${base}/rest/v1/savings_participants?select=id&affiliate_id=eq.${encoded}`, values.SUPABASE_PUBLISHABLE_KEY, { token: normal.token });
  assert([401, 403].includes(savings.status) || (savings.status === 200 && Array.isArray(savings.data) && savings.data.length === 0), 'FOREIGN_SAVINGS_VISIBLE');

  const refreshed = await request(`${base}/auth/v1/token?grant_type=refresh_token`, values.SUPABASE_PUBLISHABLE_KEY, { method: 'POST', body: { refresh_token: normal.refresh } });
  assert.equal(refreshed.status, 200, 'REFRESH_FAILED');
  normal.token = refreshed.data.access_token;
  normal.refresh = refreshed.data.refresh_token;
  samples.push(await verifyIdentity(values, normal, `${normal.alias}_REFRESH`));

  const logout = await request(`${base}/auth/v1/logout`, values.SUPABASE_PUBLISHABLE_KEY, { method: 'POST', token: normal.token });
  assert([200, 204].includes(logout.status), 'LOGOUT_FAILED');
  const relogged = await login(values, normal.alias);
  samples.push(await verifyIdentity(values, relogged, `${normal.alias}_RELOGIN`));

  console.log(JSON.stringify({ status: 'PASS', production: true, valid_accounts: actors.length, unavailable_aliases: unavailable, samples, foreign_profile: 'DENIED', foreign_profile_photo: 'DENIED', foreign_documents: 'DENIED', foreign_requests: 'DENIED', foreign_savings: 'DENIED', refresh_logout_login: 'PASS', pii_logged: false }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, pii_logged: false }));
  process.exitCode = 1;
});
