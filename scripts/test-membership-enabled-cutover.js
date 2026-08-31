'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const repositorySource = fs.readFileSync(path.join(root, 'app', 'membership-repository.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'app', 'membership-store.jsx'), 'utf8');
const writes = [];

function query(result) {
  let response = result;
  return {
    update(values) { writes.push(values); response = { data: Object.assign({ id: 'bud' }, values), error: null }; return this; },
    insert(values) { writes.push(values); return this; },
    eq() { return this; },
    select() { return this; },
    order() { return Promise.resolve(result); },
    single() { return Promise.resolve(response); },
  };
}

const context = {
  console,
  window: {
    SutiSupabase: { getClient: () => ({
      from: () => query({ data: { id: 'bud', enabled: true }, error: null }),
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'asset' } }) }) },
    }) },
    AdminRepository: { uploadManagedAsset() {} },
  },
};
vm.createContext(context);
vm.runInContext(repositorySource, context, { filename: 'membership-repository.js' });

(async () => {
  await context.window.MembershipRepository.save({
    id: 'bud', empresa: 'Bud Tv Ultra', concepto: 'Películas y series', monto: 200,
    pagos: 2, activo: true, enabled: false, sort_order: 1,
  });
  if (writes[0].enabled !== true) throw new Error('stale enabled overrode the UI value');

  writes.length = 0;
  await context.window.MembershipRepository.setEnabled('bud', false);
  if (JSON.stringify(writes[0]) !== JSON.stringify({ enabled: false })) throw new Error('toggle wrote fields beyond enabled');

  let toggleArgs = null;
  context.React = { useState: () => [0, () => {}], useEffect: () => {} };
  context.window.MembershipRepository = {
    list: async () => [{ id: 'bud', activo: false }],
    setEnabled: async (id, enabled) => { toggleArgs = { id, enabled }; },
  };
  vm.runInContext(storeSource, context, { filename: 'membership-store.jsx' });
  await context.window.membershipStore.load(true);
  await context.window.membershipStore.toggle('bud');
  if (!toggleArgs || toggleArgs.id !== 'bud' || toggleArgs.enabled !== true) throw new Error('store did not request activation');

  console.log('Membership enabled cutover static verification PASS.');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
