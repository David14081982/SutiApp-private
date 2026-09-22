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
  let repositoryCalls = 0;
  let releaseRepository = null;
  let repositoryGate = options.delayRepository ? new Promise((resolve) => { releaseRepository = resolve; }) : null;
  let failRemaining = 0;
  let failError = null;
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
      repositoryCalls += 1;
      if (repositoryGate) await repositoryGate;
      if (failRemaining > 0) { failRemaining -= 1; throw failError || Object.assign(new Error('network down'), { code: 'NETWORK_FAILURE' }); }
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
    href: options.activationCallback ? 'https://example.test/SutiApp/?auth_flow=activation' : options.recoveryCallback ? 'https://example.test/SutiApp/?auth_flow=recovery' : options.legacyRecoveryCallback ? 'https://example.test/SutiApp/#type=recovery&access_token=isolated' : 'https://example.test/SutiApp/',
  };
  const context = {
    console,
    URL,
    setTimeout: options.fastTimers ? (fn, ms) => setTimeout(fn, Math.min(ms || 0, 10)) : setTimeout,
    clearTimeout,
      window: {
      SutiSupabase: { getClient: () => ({ auth, rpc: async (name) => {
        if (name === 'get_affiliate_activation_status') return { data: { status: options.activationStatus || 'ELIGIBLE' }, error: options.preflightError || null };
        if (name === 'get_current_company_access') return { data: [], error: null };
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
    getRepositoryCalls: () => repositoryCalls,
    getUrl: () => location.href,
    emitAuthState: (event, nextSession = session) => {
      session = nextSession;
      assert(authStateListener, 'Auth state listener is not registered');
      authStateListener(event, nextSession);
    },
    releaseRepository: () => { if (releaseRepository) releaseRepository(); },
    failNext: (count, error) => { failRemaining = count; failError = error || null; },
    holdRepository: () => { repositoryGate = new Promise((resolve) => { releaseRepository = resolve; }); },
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

  const identityMismatch = createHarness({ repositoryError: Object.assign(new Error('identity mismatch'), { code: 'AUTH_IDENTITY_MISMATCH' }) });
  await identityMismatch.controller.signIn('owner@example.test', 'correct');
  assert.equal(identityMismatch.controller.getState().phase, 'identity_error');
  assert.equal(identityMismatch.controller.getState().errorCode, 'AUTH_IDENTITY_MISMATCH');
  assert.equal(identityMismatch.controller.getState().affiliate, null);
  assert.equal(identityMismatch.getSignOutCalls(), 1);

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
  callback.emitAuthState('TOKEN_REFRESHED');
  await flushAuthEvents();
  assert.equal(callback.controller.getState().phase, 'activation_password', 'Explicit activation must survive token refresh');
  callback.emitAuthState('SIGNED_IN');
  assert.equal(await callback.controller.completeActivation('NewPassword!123'), true);
  await flushAuthEvents();
  assert.equal(callback.controller.getState().phase, 'unauthenticated');
  assert.match(callback.controller.getState().notice, /Cuenta activada/);

  const metadataCallback = createHarness({ session: { user: { id: 'auth-2', email: 'owner@example.test', user_metadata: { sutiapp_activation: true } } }, claimSucceeds: true });
  await metadataCallback.controller.bootstrap();
  assert.equal(metadataCallback.controller.getState().phase, 'authenticated', 'Historical metadata must not reopen password setup on normal entry');
  metadataCallback.emitAuthState('SIGNED_IN');
  await flushAuthEvents();
  assert.equal(metadataCallback.controller.getState().phase, 'authenticated');

  const focusedSession = { access_token: 'isolated-session-token', user: { id: 'auth-1', user_metadata: { sutiapp_activation: true } } };
  const focused = createHarness({ session: focusedSession });
  await focused.controller.bootstrap();
  const initialCalls = focused.getRepositoryCalls();
  const phases = [];
  focused.controller.subscribe(state => phases.push(state.phase));
  for (let i = 0; i < 10; i++) focused.emitAuthState('SIGNED_IN', focusedSession);
  await flushAuthEvents();
  assert.equal(focused.getRepositoryCalls(), initialCalls, 'Repeated focus events must not refetch the same resolved identity');
  assert(phases.every(phase => phase === 'authenticated'), 'Focus must not unmount the authenticated app');
  focused.emitAuthState('TOKEN_REFRESHED', { ...focusedSession, access_token: 'rotated-session-token' });
  await flushAuthEvents();
  assert(focused.getRepositoryCalls() > initialCalls, 'Token rotation must still revalidate backend context');

  const cancelled = createHarness({ session: { user: { id: 'auth-1' } }, activationCallback: true });
  await cancelled.controller.bootstrap();
  cancelled.emitAuthState('SIGNED_IN');
  assert.equal(await cancelled.controller.signOut(), true);
  await flushAuthEvents();
  assert.equal(cancelled.controller.getState().phase, 'unauthenticated', 'A queued event must not reopen a cancelled flow');
  assert(!cancelled.getUrl().includes('auth_flow'));
  assert.equal(cancelled.getUpdateUserCalls(), 0);

  const staleActivationUrl = createHarness({ activationCallback: true });
  await staleActivationUrl.controller.bootstrap();
  assert.equal(await staleActivationUrl.controller.signIn('owner@example.test', 'correct'), true);
  staleActivationUrl.emitAuthState('SIGNED_IN');
  await flushAuthEvents();
  assert.equal(staleActivationUrl.controller.getState().phase, 'authenticated');
  assert(!staleActivationUrl.getUrl().includes('auth_flow'));

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

  const cancelledRecovery = createHarness({ session: recoverySession, recoveryCallback: true });
  await cancelledRecovery.controller.bootstrap();
  cancelledRecovery.emitAuthState('PASSWORD_RECOVERY', recoverySession);
  assert.equal(await cancelledRecovery.controller.signOut(), true);
  await flushAuthEvents();
  assert.equal(cancelledRecovery.controller.getState().phase, 'unauthenticated');
  assert(!cancelledRecovery.getUrl().includes('auth_flow'));
  assert.equal(await cancelledRecovery.controller.signIn('owner@example.test', 'correct'), true);
  assert.equal(cancelledRecovery.getUpdateUserCalls(), 0);

  const queuedRecovery = createHarness({ session: recoverySession, recoveryCallback: true });
  await queuedRecovery.controller.bootstrap();
  queuedRecovery.emitAuthState('TOKEN_REFRESHED', recoverySession);
  queuedRecovery.emitAuthState('PASSWORD_RECOVERY', recoverySession);
  assert.equal(await queuedRecovery.controller.updateRecoveredPassword('NewPassword!123'), true);
  await flushAuthEvents();
  assert.equal(queuedRecovery.controller.getState().phase, 'unauthenticated', 'queued recovery event reopened the app after completion');

  const failedRecovery = createHarness({ session: recoverySession, recoveryCallback: true, updateError: { code: 'weak_password', status: 422 } });
  await failedRecovery.controller.bootstrap();
  assert.equal(await failedRecovery.controller.updateRecoveredPassword('weakpass'), false);
  assert.equal(failedRecovery.controller.getState().phase, 'password_recovery');
  assert.equal(failedRecovery.controller.getState().errorCode, 'PASSWORD_UPDATE_FAILED');
  assert.equal(failedRecovery.getSignOutCalls(), 0);

  const otherTab = createHarness({ session: recoverySession });
  await otherTab.controller.bootstrap();
  otherTab.emitAuthState('PASSWORD_RECOVERY', recoverySession);
  await flushAuthEvents();
  assert.equal(otherTab.controller.getState().phase, 'authenticated', 'Recovery in another tab must not select this tab’s reset form');

  const racingRecovery = createHarness({ session: recoverySession, delayRepository: true, legacyRecoveryCallback: true });
  const racingBootstrap = racingRecovery.controller.bootstrap();
  await flushAuthEvents();
  racingRecovery.emitAuthState('PASSWORD_RECOVERY', recoverySession);
  await flushAuthEvents();
  assert.equal(racingRecovery.controller.getState().phase, 'password_recovery');
  racingRecovery.releaseRepository();
  await racingBootstrap;
  await flushAuthEvents();
  assert.equal(racingRecovery.controller.getState().phase, 'password_recovery', 'in-flight session resolution bypassed recovery');

  // Token rotation re-validation of the SAME mounted identity: a transient
  // failure keeps the app mounted and retries; it never publishes 'error'.
  const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const mountedSession = { access_token: 'token-1', user: { id: 'auth-1' } };
  const rotatedSession = { access_token: 'token-2', user: { id: 'auth-1' } };
  const transient = createHarness({ session: mountedSession, fastTimers: true });
  await transient.controller.bootstrap();
  const transientPhases = [];
  transient.controller.subscribe(state => transientPhases.push(state.phase));
  const transientBase = transient.getRepositoryCalls();
  transient.failNext(2);
  transient.emitAuthState('TOKEN_REFRESHED', rotatedSession);
  await settle(300);
  assert(transientPhases.every(phase => phase === 'authenticated'), 'A transient re-validation failure must not unmount the app');
  assert.equal(transient.getRepositoryCalls() - transientBase, 3, 'Two failed attempts, then one successful retry');
  assert.equal(transient.controller.getState().session.access_token, 'token-2');

  // A persistent failure still fails closed after the bounded retries.
  const persistent = createHarness({ session: mountedSession, fastTimers: true });
  await persistent.controller.bootstrap();
  const persistentBase = persistent.getRepositoryCalls();
  persistent.failNext(99);
  persistent.emitAuthState('TOKEN_REFRESHED', rotatedSession);
  await settle(400);
  assert.equal(persistent.controller.getState().phase, 'error');
  assert.equal(persistent.getRepositoryCalls() - persistentBase, 4, 'One attempt plus three bounded retries');

  // Explicit refreshContext (impersonation start/stop, expiry) never tolerates failure.
  const explicit = createHarness({ session: mountedSession, fastTimers: true });
  await explicit.controller.bootstrap();
  explicit.failNext(1);
  await explicit.controller.refreshContext();
  assert.equal(explicit.controller.getState().phase, 'error', 'Explicit context refresh must fail closed');

  // An explicit refresh must not join an in-flight quiet re-validation.
  const joined = createHarness({ session: mountedSession, fastTimers: true });
  await joined.controller.bootstrap();
  joined.holdRepository();
  joined.failNext(2);
  joined.emitAuthState('TOKEN_REFRESHED', rotatedSession);
  await flushAuthEvents();
  const explicitRefresh = joined.controller.refreshContext();
  await flushAuthEvents();
  joined.releaseRepository();
  await explicitRefresh;
  assert.equal(joined.controller.getState().phase, 'error', 'Explicit refresh inherited quiet tolerance');

  // Authoritative rejections during quiet re-validation still apply at once.
  const rejected = createHarness({ session: mountedSession, fastTimers: true });
  await rejected.controller.bootstrap();
  rejected.failNext(1, Object.assign(new Error('identity mismatch'), { code: 'AUTH_IDENTITY_MISMATCH' }));
  rejected.emitAuthState('TOKEN_REFRESHED', rotatedSession);
  await settle(100);
  assert.equal(rejected.controller.getState().phase, 'identity_error');
  assert.equal(rejected.getSignOutCalls(), 1);

  console.log('H-005 local Auth tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
