'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');

const repositorySource = fs.readFileSync('app/affiliate-repository.js', 'utf8');
const viewModelSource = fs.readFileSync('app/affiliate-view-model.js', 'utf8');
const authSource = fs.readFileSync('app/affiliate-auth.js', 'utf8');

function createHarness(options = {}) {
  let session = options.session || null;
  let signOutCalls = 0;
  const rpcCalls = [];
  const affiliate = {
    id: 'affiliate-1',
    numero_control: 'CONTROLLED-TEST',
    full_name: 'Controlled Test',
    auth_user_id: 'auth-1',
    auth_eligibility: 'eligible',
  };
  const auth = {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getUser: async () => ({ data: { user: session && session.user }, error: null }),
    getSession: async () => ({ data: { session }, error: null }),
    signInWithPassword: async ({ email, password }) => {
      if (password !== 'correct') return { data: {}, error: { code: 'invalid_credentials', status: 400 } };
      session = { user: { id: 'auth-1', email } };
      return { data: { session }, error: null };
    },
    signOut: async () => { signOutCalls += 1; session = null; return { error: null }; },
  };
  const client = {
    auth,
    rpc: async (name) => {
      rpcCalls.push(name);
      if (name === 'get_current_affiliate_access_state') {
        if (options.missingAccessRpc) return { data: null, error: { code: 'PGRST202', status: 404 } };
        return { data: 'ACTIVE', error: null };
      }
      if (name === 'get_effective_affiliate_id') return { data: affiliate.id, error: null };
      if (name === 'get_impersonation_context') return { data: [], error: null };
      if (name === 'get_admin_access_context') return { data: { technical_permissions: [], section_actions: [] }, error: null };
      if (name === 'claim_affiliate_identity') return { data: affiliate.id, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: table === 'affiliates' ? affiliate : null, error: null }),
          order: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      }),
    }),
  };
  const React = {
    useState(initial) { return [initial, () => {}]; },
    useEffect() {},
    createElement(type, props, ...children) { return { type, props: props || {}, children }; },
  };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    React,
    window: {
      SutiSupabase: { getClient: () => client },
      AdminRepository: { primeAccessContext() {}, clearAccessContext() {} },
    },
  };
  vm.createContext(context);
  vm.runInContext(repositorySource, context, { filename: 'affiliate-repository.js' });
  vm.runInContext(viewModelSource, context, { filename: 'affiliate-view-model.js' });
  vm.runInContext(authSource, context, { filename: 'affiliate-auth.js' });
  return { context, controller: context.window.AffiliateAuth, rpcCalls, getSignOutCalls: () => signOutCalls };
}

function findByRole(node, role) {
  if (!node || typeof node !== 'object') return null;
  if (node.props && node.props.role === role) return node;
  for (const child of node.children || []) {
    const found = findByRole(child, role);
    if (found) return found;
  }
  return null;
}

(async () => {
  const valid = createHarness();
  assert.equal(await valid.controller.signIn('controlled@example.test', 'correct'), true);
  assert.equal(valid.controller.getState().phase, 'authenticated');
  assert.deepEqual(valid.rpcCalls.slice(0, 4).sort(), [
    'get_admin_access_context',
    'get_current_affiliate_access_state',
    'get_effective_affiliate_id',
    'get_impersonation_context',
  ].sort());

  const invalid = createHarness();
  assert.equal(await invalid.controller.signIn('controlled@example.test', 'wrong'), false);
  assert.equal(invalid.controller.getState().phase, 'unauthenticated');
  assert.equal(invalid.controller.getState().errorCode, 'INVALID_CREDENTIALS');

  const unavailable = createHarness({ missingAccessRpc: true });
  assert.equal(await unavailable.controller.signIn('controlled@example.test', 'correct'), false);
  assert.equal(unavailable.controller.getState().phase, 'error');
  assert.equal(unavailable.controller.getState().errorCode, 'CONNECTION_ERROR');
  const errorScreen = unavailable.context.window.AffiliateLoginScreen({
    auth: Object.assign({}, unavailable.controller.getState(), { signIn() {}, retry() {} }),
  });
  const alert = findByRole(errorScreen, 'alert');
  assert(alert && alert.children.join('').includes('No pudimos conectar'), 'Service outage must render the controlled connection message');

  const restored = createHarness({ session: { user: { id: 'auth-1', email: 'controlled@example.test' } } });
  await restored.controller.bootstrap();
  assert.equal(restored.controller.getState().phase, 'authenticated');
  await restored.controller.refreshContext();
  assert.equal(restored.controller.getState().phase, 'authenticated');
  assert.equal(await restored.controller.signOut(), true);
  assert.equal(restored.controller.getState().phase, 'unauthenticated');
  assert.equal(restored.getSignOutCalls(), 1);

  console.log(JSON.stringify({
    status: 'PASS',
    repository: 'ACTUAL_AFFILIATE_REPOSITORY',
    validLogin: true,
    invalidCredentials: true,
    missingRpcControlled: true,
    restoredSession: true,
    refresh: true,
    logout: true,
  }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
