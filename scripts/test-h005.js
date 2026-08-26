'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('app/affiliate-auth.js', 'utf8');
const viewModelSource = fs.readFileSync('app/affiliate-view-model.js', 'utf8');

function createHarness(options = {}) {
  let session = options.session || null;
  let signOutCalls = 0;
  const auth = {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getSession: async () => ({ data: { session }, error: null }),
    signInWithPassword: async ({ email, password }) => {
      if (password !== 'correct') return { data: {}, error: { code: 'invalid_credentials', status: 400 } };
      session = { user: { id: 'auth-1', email } };
      return { data: { session }, error: null };
    },
    signOut: async () => {
      signOutCalls += 1;
      session = null;
      return { error: null };
    },
  };
  const repository = {
    clearProfilePhotoCache() {},
    getProfilePhoto: async () => null,
    getCurrentAffiliate: async () => {
      if (options.repositoryError) throw options.repositoryError;
      if (options.unlinked) {
        const error = new Error('unlinked');
        error.code = 'AUTH_IDENTITY_WITHOUT_AFFILIATE';
        throw error;
      }
      return {
        id: 'affiliate-1',
        auth_user_id: session && session.user.id,
        auth_eligibility: options.eligibility || 'eligible',
      };
    },
    claimCurrentIdentity: async () => {
      const error = new Error('claim unavailable in unit harness');
      error.code = 'SOURCE_ERROR';
      throw error;
    },
  };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    window: {
      SutiSupabase: { getClient: () => ({ auth, rpc: async (name) => {
        assert.equal(name, 'get_admin_access_context');
        return { data: { technical_permissions: [], section_actions: [] }, error: null };
      }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) },
      AffiliateRepository: repository,
    },
    React: {
      useState() { throw new Error('React hook not expected in controller test'); },
      useEffect() { throw new Error('React hook not expected in controller test'); },
      createElement() { return null; },
    },
  };
  vm.createContext(context);
  vm.runInContext(viewModelSource, context, { filename: 'affiliate-view-model.js' });
  vm.runInContext(source, context, { filename: 'affiliate-auth.js' });
  return {
    controller: context.window.AffiliateAuth,
    getSignOutCalls: () => signOutCalls,
  };
}

(async () => {
  const empty = createHarness();
  await empty.controller.bootstrap();
  assert.equal(empty.controller.getState().phase, 'unauthenticated');

  const login = createHarness();
  assert.equal(await login.controller.signIn('owner@example.test', 'correct'), true);
  assert.equal(login.controller.getState().phase, 'authenticated');
  assert.equal(login.controller.getState().affiliate.auth_user_id, 'auth-1');

  const restored = createHarness({ session: { user: { id: 'auth-1' } } });
  await restored.controller.bootstrap();
  assert.equal(restored.controller.getState().phase, 'authenticated');
  assert.equal(await restored.controller.signOut(), true);
  assert.equal(restored.controller.getState().phase, 'unauthenticated');

  const wrong = createHarness();
  assert.equal(await wrong.controller.signIn('owner@example.test', 'wrong'), false);
  assert.equal(wrong.controller.getState().errorCode, 'INVALID_CREDENTIALS');

  const unlinked = createHarness({ unlinked: true });
  await unlinked.controller.signIn('owner@example.test', 'correct');
  assert.equal(unlinked.controller.getState().phase, 'unlinked');
  assert.equal(unlinked.getSignOutCalls(), 1);

  const ineligible = createHarness({ eligibility: 'invalid_email' });
  await ineligible.controller.signIn('owner@example.test', 'correct');
  assert.equal(ineligible.controller.getState().phase, 'ineligible');
  assert.equal(ineligible.getSignOutCalls(), 1);

  const failure = createHarness({ repositoryError: Object.assign(new Error('network'), { code: 'SOURCE_ERROR' }) });
  await failure.controller.signIn('owner@example.test', 'correct');
  assert.equal(failure.controller.getState().phase, 'error');
  assert.equal(failure.controller.getState().errorCode, 'CONNECTION_ERROR');

  console.log('H-005 local Auth tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
