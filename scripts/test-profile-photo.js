'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');

const read = (file) => fs.readFileSync(file, 'utf8');
const cases = [];
async function check(name, test) {
  try { await test(); cases.push({ name, status: 'PASS' }); }
  catch (error) { cases.push({ name, status: 'FAIL', error: error.message }); }
}

// Synthetic adapters only: no Auth, Storage or database request leaves this VM.
function writerHarness(options = {}) {
  const affiliateId = '00000000-0000-4000-8000-000000000001';
  const relationId = '00000000-0000-4000-8000-000000000002';
  const calls = { upload: 0, register: 0, sign: 0, remove: 0 };
  let epoch = 1, saved = false;
  const stage = name => { if (options.changeAt === name) epoch++; };
  const affiliate = { id: affiliateId, auth_user_id: 'auth-self' };
  const row = { id: relationId, affiliate_id: affiliateId, private_asset_id: 'canonical-asset',
    storage_bucket: 'private-assets', storage_path: 'fixture/canonical.jpg', mime_type: 'image/jpeg' };
  const query = { select() { return this; }, eq() { return this; }, order() { return this; },
    maybeSingle: async () => ({ data: affiliate }), limit: async () => ({ data: saved ? [row] : [] }) };
  const client = {
    auth: { getUser: async () => { stage('auth'); return { data: { user: { id: 'auth-self' } } }; } },
    from: () => query,
    rpc: async name => {
      if (name === 'get_current_affiliate_access_state') return { data: 'ACTIVE' };
      if (name === 'get_effective_affiliate_id') return { data: affiliateId };
      if (name === 'get_impersonation_context') return { data: options.impersonation ? [{ actor_real_auth_user_id: 'auth-self', usuario_contexto_affiliate_id: affiliateId }] : [] };
      assert.equal(name, 'set_self_profile_photo'); calls.register++; stage('register');
      if (options.failRegister) return { error: new Error('synthetic registration failure') };
      saved = true;
      return { data: Object.hasOwn(options, 'receipt') ? options.receipt : relationId };
    },
    storage: { from: () => ({
      upload: async () => { calls.upload++; stage('upload'); return options.failUpload ? { error: new Error('synthetic upload failure') } : { data: {} }; },
      remove: async () => { calls.remove++; throw Error('Deletion is forbidden'); },
      createSignedUrl: async () => { calls.sign++; return options.failSign ? { error: new Error('synthetic signing failure') } : { data: { signedUrl: 'https://example.invalid/canonical-signed-photo' } }; },
    }) },
  };
  const blob = new Blob(['synthetic-jpeg'], { type: 'image/jpeg' });
  const context = { window: { PrivateResourceDemand: options.missingContext ? undefined : { context: () => epoch } },
    Map, Object, Error, String, Date, Uint8Array, crypto: crypto.webcrypto,
    createImageBitmap: async () => { stage('decode'); return { width: 100, height: 100, close() {} }; },
    document: { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: callback => callback(blob) }) } };
  vm.createContext(context);
  vm.runInContext(read('app/affiliate-repository.js'), context);
  return { repository: context.window.createAffiliateRepository(() => client), calls, affiliateId, relationId,
    file: { type: 'image/png', size: 10 }, saved: () => saved };
}

function handlerHarness(options = {}) {
  const affiliateId = '00000000-0000-4000-8000-000000000001';
  let epoch = 1, error = '', busy = false;
  const calls = { upload: 0, read: 0, refresh: 0, toast: [] };
  const app = { user: { id: affiliateId }, toast: text => calls.toast.push(text) };
  const context = {
    window: {
      PrivateResourceDemand: { context: () => epoch },
      AffiliateRepository: {
        updateProfilePhoto: async () => { calls.upload++; if (options.changeAfterSave) epoch++; if (options.failWrite) throw new Error('synthetic write failure'); return { saved: true, affiliateId: options.wrongAffiliate ? 'other' : affiliateId, relationId: '00000000-0000-4000-8000-000000000002' }; },
        getProfilePhoto: async () => { calls.read++; if (options.changeAfterRead) epoch++; if (options.failSign) throw new Error('synthetic signing failure'); return { affiliateId, signedUrl: 'https://example.invalid/canonical-signed-photo' }; },
      },
      AffiliateAuth: { refreshContext: async () => { calls.refresh++; if (options.failRefresh) throw new Error('synthetic auth refresh failure'); return { phase: options.errorState ? 'error' : 'authenticated', affiliate: { id: affiliateId } }; } },
    }, app, u: app.user, photoLock: { current: false }, setPhotoBusy: value => { busy = value; }, setPhotoError: value => { error = value; },
  };
  const source = read('app/app.jsx');
  const start = source.indexOf('    const changePhoto = async event => {');
  const end = source.indexOf('    const rows = [', start);
  assert(start > 0 && end > start);
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + '\nwindow.changePhoto = changePhoto;', context);
  return { calls, error: () => error, busy: () => busy,
    run: () => context.window.changePhoto({ target: { value: 'synthetic', files: [{ type: 'image/png', size: 10 }] } }) };
}

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
        && row.is_current_profile_photo === filters.is_current_profile_photo
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
    status: 'READY', url_order: 1, is_current_profile_photo: true,
  };
  h.setRows([row]);
  h.setRows([row, Object.assign({}, row, { id: 'historical-photo', is_current_profile_photo: false })]);
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
  cases.push({ name: 'existing canonical reader/cache/isolation/view/static regression', status: 'PASS' });
  await check('confirmed registration returns a minimal immutable receipt without signing', async () => {
    const h = writerHarness(); const receipt = await h.repository.updateProfilePhoto(h.file);
    assert.deepEqual(JSON.parse(JSON.stringify(receipt)), { saved: true, affiliateId: h.affiliateId, relationId: h.relationId });
    assert(Object.isFrozen(receipt)); assert.deepEqual(h.calls, { upload: 1, register: 1, sign: 0, remove: 0 });
    const photo = await h.repository.getProfilePhoto(h.affiliateId);
    assert.equal(photo.signedUrl, 'https://example.invalid/canonical-signed-photo'); assert.equal(photo.assetId, 'canonical-asset');
  });
  await check('saved registration remains successful when subsequent signing is unavailable', async () => {
    const h = writerHarness({ failSign: true }); const receipt = await h.repository.updateProfilePhoto(h.file);
    assert.equal(receipt.saved, true); assert.equal(h.calls.sign, 0);
    await assert.rejects(() => h.repository.getProfilePhoto(h.affiliateId));
    assert.equal(h.calls.upload, 1); assert.equal(h.calls.register, 1); assert.equal(h.calls.remove, 0);
  });
  for (const receipt of [null, '', 'photo-new', {}, '00000000-0000-4000-8000-000000000002-extra']) {
    await check('malformed registration receipt is unconfirmed: ' + JSON.stringify(receipt), async () => {
      const h = writerHarness({ receipt });
      await assert.rejects(() => h.repository.updateProfilePhoto(h.file), error => error.code === 'PROFILE_PHOTO_REGISTRATION_UNCONFIRMED');
      assert.equal(h.calls.upload, 1); assert.equal(h.calls.register, 1); assert.equal(h.calls.sign, 0); assert.equal(h.calls.remove, 0);
    });
  }
  for (const changeAt of ['auth', 'decode', 'upload', 'register']) {
    await check('context changes during ' + changeAt + ' cannot apply a stale photo', async () => {
      const h = writerHarness({ changeAt });
      await assert.rejects(() => h.repository.updateProfilePhoto(h.file), error => error.code === 'PROFILE_PHOTO_CONTEXT_CHANGED');
      assert.equal(h.calls.upload, ['upload', 'register'].includes(changeAt) ? 1 : 0);
      assert.equal(h.calls.register, changeAt === 'register' ? 1 : 0); assert.equal(h.calls.sign, 0); assert.equal(h.calls.remove, 0);
    });
  }
  await check('unavailable context fails closed before writing', async () => {
    const h = writerHarness({ missingContext: true });
    await assert.rejects(() => h.repository.updateProfilePhoto(h.file), error => error.code === 'PROFILE_PHOTO_CONTEXT_CHANGED');
    assert.equal(h.calls.upload, 0); assert.equal(h.calls.register, 0);
  });
  for (const option of ['failUpload', 'failRegister', 'impersonation']) {
    await check(option + ' preserves existing rejection with no automatic retry/delete', async () => {
      const h = writerHarness({ [option]: true }); await assert.rejects(() => h.repository.updateProfilePhoto(h.file));
      assert.equal(h.calls.upload, option === 'impersonation' ? 0 : 1);
      assert.equal(h.calls.register, option === 'failRegister' ? 1 : 0); assert.equal(h.calls.remove, 0);
    });
  }
  await check('handler consumes the canonical photo before its existing Auth projection refresh', async () => {
    const h = handlerHarness(); await h.run(); assert.equal(h.calls.read, 1); assert.equal(h.calls.refresh, 1);
    assert.equal(h.calls.toast.length, 1); assert.equal(h.error(), ''); assert.equal(h.busy(), false);
  });
  for (const option of ['failSign', 'failRefresh', 'errorState']) {
    await check('handler reports saved confirmation separately from ' + option, async () => {
      const h = handlerHarness({ [option]: true }); await h.run();
      assert.equal(h.calls.upload, 1); assert.equal(h.calls.toast.length, 1);
      assert.match(h.error(), /Tu foto se guardó/); assert(!h.error().includes('inténtalo de nuevo'));
      assert.equal(h.calls.refresh, option === 'failSign' ? 0 : 1); assert.equal(h.busy(), false);
    });
  }
  for (const option of ['changeAfterSave', 'wrongAffiliate']) {
    await check('handler suppresses mismatched confirmation: ' + option, async () => {
      const h = handlerHarness({ [option]: true }); await h.run();
      assert.equal(h.calls.toast.length, 0); assert.equal(h.calls.read, 0); assert.equal(h.calls.refresh, 0); assert.equal(h.busy(), false);
    });
  }
  await check('context change during canonical read prevents the Auth refresh', async () => {
    const h = handlerHarness({ changeAfterRead: true }); await h.run(); assert.equal(h.calls.refresh, 0); assert.equal(h.error(), '');
  });
  await check('handler write error never reports confirmed success', async () => {
    const h = handlerHarness({ failWrite: true }); await h.run(); assert.equal(h.calls.toast.length, 0); assert.equal(h.calls.read, 0);
    assert.match(h.error(), /No pudimos actualizar/); assert.equal(h.busy(), false);
  });
  const report = { status: cases.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL', isolation: 'VM; synthetic Auth/Storage/RPC; no network or personal data',
    sourceSha256: Object.fromEntries(['app/affiliate-repository.js', 'app/app.jsx'].map(file => [file, crypto.createHash('sha256').update(read(file)).digest('hex')])), cases };
  const outputIndex = process.argv.indexOf('--out');
  if (outputIndex >= 0) { const output = process.argv[outputIndex + 1]; fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); }
  console.log('PROFILE PHOTO unit/static tests: ' + report.status + ' (' + cases.filter(item => item.status === 'PASS').length + '/' + cases.length + ')');
  for (const item of cases.filter(item => item.status === 'FAIL')) console.error(item.name + ': ' + item.error);
  if (report.status !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
