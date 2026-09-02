'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(file, context) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

function queryClient(rows, authUser = { id: 'auth-1' }) {
  const calls = [];
  function chain() {
    const q = {
      select(value) { calls.push(['select', value]); return q; },
      eq(field, value) { calls.push(['eq', field, value]); return q; },
      order(field) { calls.push(['order', field]); return q; },
      limit() { return Promise.resolve({ data: rows, error: null }); },
      maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
    };
    return q;
  }
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: authUser }, error: null }) },
    rpc: async (name) => {
      calls.push(['rpc', name]);
      if (name === 'get_current_affiliate_access_state') return { data: rows[0] ? 'ACTIVE' : 'UNLINKED', error: null };
      if (name === 'get_effective_affiliate_id') return { data: rows[0] && rows[0].id || null, error: null };
      if (name === 'get_impersonation_context') return { data: [], error: null };
      return { data: null, error: null };
    },
    from(table) { calls.push(['from', table]); return chain(); },
  };
}

(async () => {
  let created = 0;
  const context = vm.createContext({
    window: {
      __SUTIAPP_CONFIG__: { supabase: { url: 'https://example.supabase.co', publishableKey: 'public' } },
      supabase: { createClient() { created += 1; return queryClient([]); } },
    },
    Error,
  });
  load('app/supabase-client.js', context);
  load('app/affiliate-repository.js', context);

  assert.equal(context.window.SutiSupabase.isConfigured(), true);
  assert.equal(context.window.SutiSupabase.getClient(), context.window.SutiSupabase.getClient());
  assert.equal(created, 1);

  const row = { id: 'affiliate-1', auth_user_id: 'auth-1' };
  const currentClient = queryClient([row]);
  const repository = context.window.createAffiliateRepository(() => currentClient);
  const current = await repository.getCurrentAffiliate();
  assert.equal(current.id, row.id);
  assert.equal(current.auth_user_id, row.auth_user_id);
  assert.equal(current._impersonation, null);
  assert.deepEqual(currentClient.calls.find((call) => call[0] === 'eq'), ['eq', 'id', 'affiliate-1']);

  const ambiguous = context.window.createAffiliateRepository(() => queryClient([{ id: '1' }, { id: '2' }]));
  await assert.rejects(() => ambiguous.getByNumeroControl('0'), { code: 'AMBIGUOUS_NUMERO_CONTROL' });
  await assert.rejects(() => repository.getByNumeroControl(123), { code: 'INVALID_ARGUMENT' });

  const repositorySource = fs.readFileSync('app/affiliate-repository.js', 'utf8');
  assert.doesNotMatch(repositorySource, /window\.DATA|localStorage|sessionStorage|\|\|\s*mock/i);

  const migration = fs.readFileSync('supabase/migrations/20260821000100_create_affiliates.sql', 'utf8');
  assert.match(migration, /numero_control text null/i);
  assert.doesNotMatch(migration, /unique\s*\(\s*numero_control\s*\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /auth\.uid\(\).*auth_user_id/is);
  assert.match(migration, /revoke all .* anon, authenticated/is);

  const html = fs.readFileSync('SutiApp.html', 'utf8');
  assert.ok(html.indexOf('supabase-client.js') < html.indexOf('affiliate-repository.js'));
  assert.ok(html.indexOf('affiliate-repository.js') < html.indexOf('app/bundle.js'));

  const ignore = fs.readFileSync('.gitignore', 'utf8');
  assert.match(ignore, /^supabase\.env$/m);
  assert.match(ignore, /^app\/supabase-config\.js$/m);

  const worker = fs.readFileSync('sw.js', 'utf8');
  assert.match(worker, /staticCdnHosts/);
  assert.match(worker, /cdn\.jsdelivr\.net/);
  assert.match(worker, /!sameOrigin && !staticCdnHosts\.has/);
  assert.match(worker, /supabase-config\.js/);

  const importer = fs.readFileSync('scripts/import-affiliates.py', 'utf8');
  assert.match(importer, /SUPABASE_SECRET_KEY/);
  assert.match(importer, /if not admin_key\.startswith\("sb_secret_"\)/);

  console.log('H-004 local tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
