'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');

const read = (file) => fs.readFileSync(file, 'utf8');

function repositoryHarness() {
  let principalId = 'auth-a';
  let effectiveAffiliateId = 'affiliate-a';
  let rows = [];
  let signCalls = 0;
  const filters = {};
  const query = {
    select() { return this; },
    eq(key, value) { filters[key] = value; return this; },
    order() { return this; },
    limit() {
      const visible = rows.filter((row) => row.affiliate_id === filters.affiliate_id
        && row.file_key === filters.file_key && row.source_column === filters.source_column
        && row.source_column_letter === filters.source_column_letter
        && row.classification === filters.classification && row.file_type === filters.file_type
        && row.status === filters.status
        && (principalId === 'auth-admin' || row.affiliate_id === effectiveAffiliateId));
      return Promise.resolve({ data: visible.slice(0, 2), error: null });
    },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: principalId } }, error: null }) },
    rpc: async () => ({ data: effectiveAffiliateId, error: null }),
    from: (table) => { assert.equal(table, 'affiliate_files'); return query; },
    storage: { from: (bucket) => ({ createSignedUrl: async (path, ttl) => {
      signCalls += 1;
      assert.equal(bucket, 'private-assets');
      assert.equal(ttl, 3600);
      return { data: { signedUrl: `https://example.test/object/sign/${path}?token=${principalId}` }, error: null };
    } }) },
  };
  const context = { window: {}, Map, Object, Error, String, Date };
  vm.createContext(context);
  vm.runInContext(read('app/affiliate-repository.js'), context, { filename: 'affiliate-repository.js' });
  return {
    repository: context.window.createAffiliateRepository(() => client),
    setPrincipal(value) { principalId = value; },
    setEffective(value) { effectiveAffiliateId = value; },
    setRows(value) { rows = value; },
    signCalls: () => signCalls,
  };
}

(async () => {
  const h = repositoryHarness();
  const row = {
    id: 'relation-a', affiliate_id: 'affiliate-a', private_asset_id: 'asset-a',
    classification: 'PRIVATE', file_key: 'profile_photo', file_type: 'image',
    source_column: 'Photo', source_column_letter: 'DK', storage_bucket: 'private-assets',
    storage_path: 'master/private/AA/hash.jpeg', mime_type: 'image/jpeg', sha256: 'A'.repeat(64),
    status: 'READY', url_order: 1,
  };
  h.setRows([row]);
  const first = await h.repository.getProfilePhoto('affiliate-a');
  assert.equal(first.affiliateId, 'affiliate-a');
  assert.equal(first.assetId, 'asset-a');
  assert(first.signedUrl.includes('/object/sign/'));
  assert.equal(h.signCalls(), 1);
  assert.strictEqual(await h.repository.getProfilePhoto('affiliate-a'), first, 'same-principal memory cache must be reused');
  assert.equal(h.signCalls(), 1);

  h.setPrincipal('auth-b');
  h.setEffective('affiliate-b');
  assert.equal(await h.repository.getProfilePhoto('affiliate-a'), null, 'cache must not leak across principals');
  assert.equal(h.signCalls(), 1);

  h.repository.clearProfilePhotoCache();
  h.setPrincipal('auth-a');
  h.setEffective('affiliate-a');
  h.setRows([row, Object.assign({}, row, { id: 'relation-a-2', private_asset_id: 'asset-a-2', url_order: 2 })]);
  await assert.rejects(() => h.repository.getProfilePhoto('affiliate-a'), (error) => error.code === 'AMBIGUOUS_PROFILE_PHOTO');

  const viewContext = { window: {}, Object, Error, String };
  vm.createContext(viewContext);
  vm.runInContext(read('app/affiliate-view-model.js'), viewContext, { filename: 'affiliate-view-model.js' });
  const affiliate = { id: 'affiliate-a', numero_control: '001-A', full_name: 'Nombre Real' };
  const view = viewContext.window.createAffiliateViewModel(affiliate, first);
  assert.equal(view.photoUrl, first.signedUrl);
  assert.equal(view.profilePhotoAssetId, 'asset-a');
  assert.equal(viewContext.window.createAffiliateViewModel(affiliate, null).photoUrl, null);
  assert.equal(viewContext.window.createAffiliateViewModel(affiliate, Object.assign({}, first, { affiliateId: 'other' })).photoUrl, null);

  const runtime = ['app/affiliate-repository.js','app/affiliate-auth.js','app/affiliate-view-model.js','app/app.jsx','app/screens-credencial.jsx','app/screens-admin-identity.jsx','app/ui.jsx'].map(read).join('\n');
  for (const forbidden of ['suti_user_photo','glide-prod.appspot.com','DATA.user']) {
    assert(!runtime.includes(forbidden), `forbidden profile-photo runtime source: ${forbidden}`);
  }
  for (const marker of ["'header'", "'profile'", "'credential'", "'admin-affiliate'"]) {
    assert(runtime.includes(marker), `missing profile-photo consumer marker ${marker}`);
  }
  assert(read('app/affiliate-auth.js').includes('clearProfilePhotoCache()'));
  assert(read('app/ui.jsx').includes("onError: () => setFailed(true)"));
  console.log('PROFILE PHOTO unit/static tests: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
