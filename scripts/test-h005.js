'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('app/affiliate-auth.js', 'utf8');
const viewModelSource = fs.readFileSync('app/affiliate-view-model.js', 'utf8');

function createHarness(options = {}) {
  let session = options.session || null;
  let signOutCalls = 0;
  let otpCalls = 0;
  let updateUserCalls = 0;
  let authStateListener = null;
  let releaseRepository = null;
  const repositoryGate = options.delayRepository ? new Promise((resolve) => { releaseRepository = resolve; }) : null;
  const auth = {
    onAuthStateChange: (listener) => {
      authStateListener = listener;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    getSession: async () => ({ data: { session }, error: null }),
    signInWithPassword: async ({ email, password }) => {
      if (password !== 'correct') return { data: {}, error: { code: 'invalid_credentials', status: 400 } };
      session = { user: { id: 'auth-1', email } };
      return { data: { session }, error: null };
    },
    signInWithOtp: async ({ email, options: otpOptions }) => {
      otpCalls += 1;
      if (options.otpError) return { data: {}, error: options.otpError };
      assert.equal(otpOptions.shouldCreateUser, true);
      assert.match(otpOptions.emailRedirectTo, /auth_flow=activation/);
      return { data: { user: null, session: null }, error: null };
    },
    resetPasswordForEmail: async () => ({ data: {}, error: options.recoveryError || null }),
    updateUser: async () => {
      updateUserCalls += 1;
      return { data: { user: session && session.user }, error: options.updateError || null };
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
      if (repositoryGate) await repositoryGate;
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
      if (options.claimSucceeds) return 'affiliate-1';
      const error = new Error('claim unavailable in unit harness');
      error.code = 'SOURCE_ERROR';
      throw error;
    },
  };
  const location = {
    origin: 'https://example.test',
    pathname: '/SutiApp/',
    href: options.activationCallback ? 'https://example.test/SutiApp/?auth_flow=activation' : options.recoveryCallback ? 'https://example.test/SutiApp/?auth_flow=recovery' : 'https://example.test/SutiApp/',
  };
  const context = {
    console,
    URL,
    setTimeout,
    clearTimeout,
      window: {
      SutiSupabase: { getClient: () => ({ auth, rpc: async (name) => {
        if (name === 'get_affiliate_activation_status') return { data: { status: options.activationStatus || 'ELIGIBLE' }, error: options.preflightError || null };
        assert.equal(name, 'get_admin_access_context');
        return { data: { technical_permissions: [], section_actions: [] }, error: null };
      }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) },
      AffiliateRepository: repository,
      location,
      history: { replaceState(_state, _title, nextUrl) {
        const next = new URL(nextUrl, location.origin);
        location.href = next.toString();
        location.pathname = next.pathname;
      } },
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
    getOtpCalls: () => otpCalls,
    getUpdateUserCalls: () => updateUserCalls,
    emitAuthState: (event, nextSession = session) => {
      session = nextSession;
      assert(authStateListener, 'Auth state listener is not registered');
      authStateListener(event, nextSession);
    },
    releaseRepository: () => { if (releaseRepository) releaseRepository(); },
  };
}

const flushAuthEvents = () => new Promise((resolve) => setTimeout(resolve, 5));

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

  const activation = createHarness();
  assert.equal(await activation.controller.activate('owner@example.test'), true);
  assert.equal(activation.controller.getState().phase, 'activation_sent');
  assert.equal(activation.getOtpCalls(), 1);

  for (const [status, code] of [
    ['NOT_REGISTERED', 'ACTIVATION_NOT_REGISTERED'],
    ['NOT_ELIGIBLE', 'ACTIVATION_NOT_ELIGIBLE'],
    ['AMBIGUOUS', 'ACTIVATION_AMBIGUOUS'],
    ['ALREADY_ACTIVATED', 'ACTIVATION_ALREADY_ACTIVE'],
  ]) {
    const blocked = createHarness({ activationStatus: status });
    assert.equal(await blocked.controller.activate('owner@example.test'), false);
    assert.equal(blocked.controller.getState().errorCode, code);
    assert.equal(blocked.getOtpCalls(), 0);
  }

  const rateLimited = createHarness({ otpError: { status: 429, code: 'over_email_send_rate_limit' } });
  assert.equal(await rateLimited.controller.activate('owner@example.test'), false);
  assert.equal(rateLimited.controller.getState().errorCode, 'ACTIVATION_RATE_LIMIT');

  const providerFailure = createHarness({ otpError: { status: 503, code: 'unexpected_failure' } });
  assert.equal(await providerFailure.controller.activate('owner@example.test'), false);
  assert.equal(providerFailure.controller.getState().errorCode, 'ACTIVATION_PROVIDER_ERROR');

  const callback = createHarness({ session: { user: { id: 'auth-1', email: 'owner@example.test' } }, activationCallback: true, claimSucceeds: true });
  await callback.controller.bootstrap();
  assert.equal(callback.controller.getState().phase, 'activation_password');
  assert.equal(await callback.controller.completeActivation('NewPassword!123'), true);
  assert.equal(callback.controller.getState().phase, 'unauthenticated');
  assert.match(callback.controller.getState().notice, /Cuenta activada/);

  const metadataCallback = createHarness({ session: { user: { id: 'auth-2', email: 'owner@example.test', user_metadata: { sutiapp_activation: true } } }, claimSucceeds: true });
  await metadataCallback.controller.bootstrap();
  assert.equal(metadataCallback.controller.getState().phase, 'activation_password');

  const recoverySession = { user: { id: 'auth-1', email: 'owner@example.test' } };
  const recovery = createHarness({ session: recoverySession, recoveryCallback: true });
  await recovery.controller.bootstrap();
  assert.equal(recovery.controller.getState().phase, 'password_recovery');
  for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED']) {
    recovery.emitAuthState(event, recoverySession);
    await flushAuthEvents();
    assert.equal(recovery.controller.getState().phase, 'password_recovery', `${event} bypassed recovery`);
  }
  assert.equal(await recovery.controller.updateRecoveredPassword('NewPassword!123'), true);
  assert.equal(recovery.getUpdateUserCalls(), 1);
  assert.equal(recovery.getSignOutCalls(), 1);
  assert.equal(recovery.controller.getState().phase, 'unauthenticated');
  assert.match(recovery.controller.getState().notice, /Contraseña actualizada/);

  const queuedRecovery = createHarness({ session: recoverySession, recoveryCallback: true });
  await queuedRecovery.controller.bootstrap();
  queuedRecovery.emitAuthState('TOKEN_REFRESHED', recoverySession);
  assert.equal(await queuedRecovery.controller.updateRecoveredPassword('NewPassword!123'), true);
  await flushAuthEvents();
  assert.equal(queuedRecovery.controller.getState().phase, 'unauthenticated', 'queued recovery event reopened the app after completion');

  const failedRecovery = createHarness({ session: recoverySession, recoveryCallback: true, updateError: { code: 'weak_password', status: 422 } });
  await failedRecovery.controller.bootstrap();
  assert.equal(await failedRecovery.controller.updateRecoveredPassword('weakpass'), false);
  assert.equal(failedRecovery.controller.getState().phase, 'password_recovery');
  assert.equal(failedRecovery.controller.getState().errorCode, 'PASSWORD_UPDATE_FAILED');
  assert.equal(failedRecovery.getSignOutCalls(), 0);

  const racingRecovery = createHarness({ session: recoverySession, delayRepository: true });
  const racingBootstrap = racingRecovery.controller.bootstrap();
  await flushAuthEvents();
  racingRecovery.emitAuthState('PASSWORD_RECOVERY', recoverySession);
  await flushAuthEvents();
  assert.equal(racingRecovery.controller.getState().phase, 'password_recovery');
  racingRecovery.releaseRepository();
  await racingBootstrap;
  await flushAuthEvents();
  assert.equal(racingRecovery.controller.getState().phase, 'password_recovery', 'in-flight session resolution bypassed recovery');

  console.log('H-005 local Auth tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
