'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const repositorySource = fs.readFileSync('app/affiliate-repository.js', 'utf8');
const authSource = fs.readFileSync('app/affiliate-auth.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260904000100_cross_user_identity_fail_closed.sql', 'utf8');
const recovery = fs.readFileSync('supabase/recovery/20260904000100_cross_user_identity_fail_closed_recovery.sql', 'utf8');

function clientFor({ access = 'ACTIVE', effective = 'affiliate-1', row, context = [] }) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    rpc: async (name) => {
      calls.push(['rpc', name]);
      if (name === 'get_current_affiliate_access_state') return { data: access, error: null };
      if (name === 'get_effective_affiliate_id') return { data: effective, error: null };
      if (name === 'get_impersonation_context') return { data: context, error: null };
      throw new Error('Unexpected RPC: ' + name);
    },
    from: (table) => {
      calls.push(['from', table]);
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: row || null, error: null }),
      };
      return chain;
    },
  };
}

(async () => {
  const context = vm.createContext({ window: {}, Error, Map, Object, Promise, String });
  vm.runInContext(repositorySource, context, { filename: 'affiliate-repository.js' });
  const principal = { id: 'auth-1', email: 'one@example.test', email_confirmed_at: '2026-09-04T00:00:00Z' };
  const ownRow = { id: 'affiliate-1', auth_user_id: 'auth-1', historical_email_normalized: 'one@example.test' };

  const exactClient = clientFor({ row: ownRow });
  const exact = await context.window.createAffiliateRepository(() => exactClient).getCurrentAffiliate(principal);
  assert.equal(exact.id, 'affiliate-1');
  assert.equal(exact._impersonation, null);

  for (const access of ['IDENTITY_MISMATCH', 'AMBIGUOUS_IDENTITY']) {
    const deniedClient = clientFor({ access, row: ownRow });
    await assert.rejects(
      () => context.window.createAffiliateRepository(() => deniedClient).getCurrentAffiliate(principal),
      { code: 'AUTH_IDENTITY_MISMATCH' }
    );
    assert.equal(deniedClient.calls.some((call) => call[0] === 'from'), false);
  }

  const foreignRow = { id: 'affiliate-2', auth_user_id: 'auth-2', historical_email_normalized: 'two@example.test' };
  await assert.rejects(
    () => context.window.createAffiliateRepository(() => clientFor({ row: foreignRow })).getCurrentAffiliate(principal),
    { code: 'AUTH_IDENTITY_MISMATCH' }
  );

  const impersonation = [{ actor_real_auth_user_id: 'auth-1', usuario_contexto_affiliate_id: 'affiliate-2' }];
  const impersonated = await context.window.createAffiliateRepository(() => clientFor({ effective: 'affiliate-2', row: foreignRow, context: impersonation })).getCurrentAffiliate(principal);
  assert.equal(impersonated.id, 'affiliate-2');
  assert.equal(impersonated._impersonation.actor_real_auth_user_id, 'auth-1');

  const invalidContext = [{ actor_real_auth_user_id: 'auth-other', usuario_contexto_affiliate_id: 'affiliate-2' }];
  await assert.rejects(
    () => context.window.createAffiliateRepository(() => clientFor({ effective: 'affiliate-2', row: foreignRow, context: invalidContext })).getCurrentAffiliate(principal),
    { code: 'AUTH_IDENTITY_MISMATCH' }
  );

  assert.match(authSource, /rejectUnusableSession\('identity_error',\s*'AUTH_IDENTITY_MISMATCH'\)/);
  assert.match(authSource, /phase === 'identity_error'/);
  assert.match(migration, /where candidate\.historical_email_normalized = lower\(btrim\(u\.email\)\)[\s\S]*?\) = 1/i);
  assert.match(migration, /if matches <> 1 then[\s\S]*?AFFILIATE_IDENTITY_AMBIGUOUS/i);
  assert.match(migration, /actor_auth_session_id = nullif\(\(select auth\.jwt\(\)->>'session_id'\), ''\)/i);
  assert.match(recovery, /^begin;[\s\S]*commit;\s*$/i);
  assert.doesNotMatch(repositorySource + authSource, /window\.DATA|localStorage|sessionStorage|\|\|\s*mock/i);

  const html = fs.readFileSync('SutiApp.html', 'utf8');
  const worker = fs.readFileSync('sw.js', 'utf8');
  assert.match(html, /affiliate-repository\.js\?v=4/);
  assert.match(html, /bundle\.js\?v=205/);
  assert.match(worker, /sutiapp-v150/);
  assert.match(worker, /affiliate-repository\.js\?v=4/);
  assert.match(worker, /bundle\.js\?v=205/);

  console.log(JSON.stringify({ status: 'PASS', matrix: ['exact', 'mismatch', 'ambiguous', 'foreign', 'impersonation', 'invalid_impersonation'], fallback: false }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
