/* Supabase Auth session boundary for affiliate access. */
(function () {
  'use strict';

  const listeners = new Set();
  let client = null;
  let bootstrapPromise = null;
  let authSubscription = null;
  let resolutionVersion = 0;
  let resolutionPromise = null;
  let resolutionUserId = null;
  let blockedPhase = null;
  let recoveryActive = false;
  let state = Object.freeze({
    phase: 'loading',
    session: null,
    affiliate: null,
    affiliateView: null,
    errorCode: null,
  });

  function publish(next) {
    state = Object.freeze(Object.assign({
      phase: 'unauthenticated',
      session: null,
      affiliate: null,
      affiliateView: null,
      errorCode: null,
    }, next || {}));
    listeners.forEach((listener) => listener(state));
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }

  function controlledErrorCode(error) {
    const code = String((error && error.code) || '').toLowerCase();
    const status = Number(error && error.status);
    if (code === 'invalid_credentials' || status === 400) return 'INVALID_CREDENTIALS';
    if (code === 'supabase_not_configured') return 'NOT_CONFIGURED';
    if (code === 'supabase_client_unavailable') return 'CLIENT_UNAVAILABLE';
    return 'CONNECTION_ERROR';
  }

  function emailDeliveryErrorCode(error, prefix) {
    const code = String((error && error.code) || '').toLowerCase();
    const message = String((error && error.message) || '').toLowerCase();
    const status = Number(error && error.status);
    if (status === 429 || /rate.?limit|too many|over_email_send_rate_limit/.test(code + ' ' + message)) return prefix + '_RATE_LIMIT';
    if (/not authorized|smtp|email provider|signup_disabled|otp_disabled|email_address_not_authorized/.test(code + ' ' + message)) return prefix + '_CONFIGURATION';
    if (code === 'supabase_not_configured' || code === 'supabase_client_unavailable' || code === 'pgrst202' || status === 404) return prefix + '_CONFIGURATION';
    return prefix + '_PROVIDER_ERROR';
  }

  function authFlowUrl(flow) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('auth_flow', flow);
    return url.toString();
  }

  function requestedAuthFlow() {
    try { return new URL(window.location.href).searchParams.get('auth_flow') || ''; }
    catch (_) { return ''; }
  }

  function isActivationSession(session) {
    return requestedAuthFlow() === 'activation' || Boolean(session && session.user && session.user.user_metadata && session.user.user_metadata.sutiapp_activation === true);
  }

  function recoveryRequested() {
    return requestedAuthFlow() === 'recovery';
  }

  function holdPasswordRecovery(session, errorCode) {
    const nextSession = session || state.session || null;
    if (!recoveryActive) {
      recoveryActive = true;
      // A normal resolution may already be awaiting repositories when the
      // recovery callback arrives. Invalidate it so it cannot publish an
      // authenticated state after PASSWORD_RECOVERY.
      resolutionVersion += 1;
    }
    if (state.phase === 'recovering' && !errorCode) return;
    publish({ phase: 'password_recovery', session: nextSession, errorCode: errorCode || null });
  }

  function clearAuthFlowUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('auth_flow');
      url.hash = '';
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    } catch (_) {}
  }

  function provideClient() {
    if (!client) client = window.SutiSupabase.getClient();
    return client;
  }

  async function rejectUnusableSession(phase, errorCode) {
    blockedPhase = phase;
    resolutionVersion += 1;
    try { await provideClient().auth.signOut(); } catch (_) {}
    if (window.AdminRepository && window.AdminRepository.clearAccessContext) window.AdminRepository.clearAccessContext();
    publish({ phase, errorCode });
  }

  async function resolveSessionOnce(session) {
    const version = ++resolutionVersion;
    if ((recoveryActive || recoveryRequested()) && session && session.user) {
      holdPasswordRecovery(session);
      return;
    }
    if (!session || !session.user) {
      publish({ phase: blockedPhase || 'unauthenticated' });
      return;
    }

    // Refreshes of the same authenticated identity (token rotation and
    // impersonation context changes) must not unmount App: unmounting loses the
    // active route after a real backend quote. Backend/RLS remains authoritative
    // while the context is re-resolved.
    const preservesAuthenticatedApp = state.phase === 'authenticated' &&
      state.session && state.session.user && state.session.user.id === session.user.id;
    if (!preservesAuthenticatedApp) publish({ phase: 'loading', session });
    try {
      let archivedIdentity = false;
      const affiliatePromise = (async () => {
        let affiliate = null;
        try { affiliate = await window.AffiliateRepository.getCurrentAffiliate(session.user); }
        catch (error) {
          if (error && error.code === 'AFFILIATE_ARCHIVED') { archivedIdentity = true; return null; }
          if (!error || error.code !== 'AUTH_IDENTITY_WITHOUT_AFFILIATE') throw error;
          try {
            await window.AffiliateRepository.claimCurrentIdentity();
            affiliate = await window.AffiliateRepository.getCurrentAffiliate(session.user);
          } catch (claimError) {
            if (claimError && claimError.code === 'AFFILIATE_ARCHIVED') { archivedIdentity = true; return null; }
            if (!claimError || claimError.code !== 'SOURCE_ERROR') throw claimError;
          }
        }
        return affiliate;
      })();
      const adminPromise = provideClient().rpc('get_admin_access_context');
      const [affiliate, adminResult] = await Promise.all([affiliatePromise, adminPromise]);
      if (adminResult.error) throw adminResult.error;
      const adminContext=adminResult.data||{};
      if (window.AdminRepository && window.AdminRepository.primeAccessContext) window.AdminRepository.primeAccessContext(adminContext);
      const isAdmin = Boolean(adminContext.role_code||adminContext.full_access||(adminContext.section_actions||[]).length);
      if (version !== resolutionVersion || recoveryActive) return;
      if (!affiliate && !isAdmin) {
        await rejectUnusableSession(archivedIdentity ? 'archived' : 'unlinked', archivedIdentity ? 'AFFILIATE_ARCHIVED' : 'AUTH_IDENTITY_WITHOUT_AFFILIATE');
        return;
      }
      if (affiliate && affiliate.auth_user_id !== session.user.id && !affiliate._impersonation) {
        await rejectUnusableSession('identity_error', 'AUTH_IDENTITY_MISMATCH');
        return;
      }
      if (affiliate && affiliate.auth_eligibility !== 'eligible' && !isAdmin) {
        await rejectUnusableSession('ineligible', 'AFFILIATE_NOT_ELIGIBLE');
        return;
      }
      blockedPhase = null;
      if (version !== resolutionVersion) return;
      const affiliateView = affiliate ? window.createAffiliateViewModel(affiliate, null) : null;
      publish({ phase: 'authenticated', session, affiliate, affiliateView, impersonation: affiliate && affiliate._impersonation || null, adminOnly: !affiliate && isAdmin });
      if (affiliate) window.AffiliateRepository.getProfilePhoto(affiliate.id, session.user).then((profilePhoto) => {
        if (version !== resolutionVersion || state.phase !== 'authenticated' || !state.session || state.session.user.id !== session.user.id) return;
        publish(Object.assign({}, state, { affiliateView: window.createAffiliateViewModel(affiliate, profilePhoto) }));
      }).catch(() => {});
    } catch (error) {
      if (version !== resolutionVersion) return;
      if (error && error.code === 'AUTH_IDENTITY_WITHOUT_AFFILIATE') {
        await rejectUnusableSession('unlinked', error.code);
        return;
      }
      if (error && error.code === 'AUTH_IDENTITY_MISMATCH') {
        await rejectUnusableSession('identity_error', error.code);
        return;
      }
      publish({ phase: 'error', session, errorCode: controlledErrorCode(error) });
    }
  }

  function resolveSession(session) {
    if ((recoveryActive || recoveryRequested()) && session && session.user) {
      holdPasswordRecovery(session);
      return Promise.resolve();
    }
    const userId = session && session.user && session.user.id || null;
    if (userId && resolutionPromise && resolutionUserId === userId) return resolutionPromise;
    const current = resolveSessionOnce(session);
    resolutionPromise = current;
    resolutionUserId = userId;
    current.finally(() => { if (resolutionPromise === current) { resolutionPromise = null; resolutionUserId = null; } });
    return current;
  }

  function listenForAuthChanges(authClient) {
    if (authSubscription) return;
    const result = authClient.auth.onAuthStateChange((event, session) => {
      const recoveryLockedAtDelivery = recoveryActive || recoveryRequested() || event === 'PASSWORD_RECOVERY';
      setTimeout(() => {
        if (event === 'SIGNED_OUT') {
          resolutionVersion += 1;
          const wasRecovering = recoveryActive;
          recoveryActive = false;
          if (wasRecovering) clearAuthFlowUrl();
          if (window.AdminRepository && window.AdminRepository.clearAccessContext) window.AdminRepository.clearAccessContext();
          // A recovery update publishes its success notice immediately after
          // signOut. Preserve it when Supabase delivers SIGNED_OUT on the next
          // task; otherwise the reset form remains without completion feedback.
          publish({ phase: blockedPhase || 'unauthenticated', notice: state.notice || null });
          return;
        }
        if (event === 'INITIAL_SESSION') {
          if (state.phase === 'loading') {
            if (session && isActivationSession(session)) publish({ phase: 'activation_password', session });
            else if (session && recoveryLockedAtDelivery) holdPasswordRecovery(session);
            else resolveSession(session);
          }
          return;
        }
        if (event === 'PASSWORD_RECOVERY') {
          holdPasswordRecovery(session);
          return;
        }
        if (event === 'SIGNED_IN' && session && isActivationSession(session)) {
          publish({ phase: 'activation_password', session });
          return;
        }
        if (event === 'USER_UPDATED' && (state.phase === 'activation_password' || state.phase === 'activating_password')) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (recoveryLockedAtDelivery && session) {
            if (recoveryActive || recoveryRequested()) holdPasswordRecovery(session);
            return;
          }
          resolveSession(session);
        }
      }, 0);
    });
    authSubscription = result && result.data && result.data.subscription;
  }

  async function bootstrap() {
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
      try {
        const authClient = provideClient();
        listenForAuthChanges(authClient);
        const result = await authClient.auth.getSession();
        if (result.error) throw result.error;
        const session = result.data && result.data.session;
        if (session && isActivationSession(session)) publish({ phase: 'activation_password', session });
        else if (session && recoveryRequested()) holdPasswordRecovery(session);
        else await resolveSession(session);
      } catch (error) {
        publish({ phase: 'error', errorCode: controlledErrorCode(error) });
      }
    })();
    return bootstrapPromise;
  }

  async function signIn(email, password) {
    blockedPhase = null;
    resolutionVersion += 1;
    window.AffiliateRepository.clearProfilePhotoCache();
    if (window.AdminRepository && window.AdminRepository.clearAccessContext) window.AdminRepository.clearAccessContext();
    publish({ phase: 'signing_in' });
    try {
      const authClient = provideClient();
      listenForAuthChanges(authClient);
      const result = await authClient.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || ''),
      });
      if (result.error) throw result.error;
      await resolveSession(result.data && result.data.session);
      return state.phase === 'authenticated';
    } catch (error) {
      publish({ phase: 'unauthenticated', errorCode: controlledErrorCode(error) });
      return false;
    }
  }

  async function signOut() {
    blockedPhase = null;
    resolutionVersion += 1;
    window.AffiliateRepository.clearProfilePhotoCache();
    publish({ phase: 'signing_out' });
    try {
      const result = await provideClient().auth.signOut();
      if (result.error) throw result.error;
      publish({ phase: 'unauthenticated' });
      return true;
    } catch (_) {
      publish({ phase: 'error', errorCode: 'LOGOUT_FAILED' });
      return false;
    }
  }

  async function retry() {
    try {
      const result = await provideClient().auth.getSession();
      if (result.error) throw result.error;
      await resolveSession(result.data && result.data.session);
    } catch (error) {
      publish({ phase: 'error', errorCode: controlledErrorCode(error) });
    }
  }

  async function activate(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    publish({ phase: 'activating' });
    try {
      const preflight = await provideClient().rpc('get_affiliate_activation_status', { p_email: normalizedEmail });
      if (preflight.error) throw preflight.error;
      const activationStatus = String(preflight.data && preflight.data.status || '');
      const blocked = {
        INVALID_EMAIL: 'ACTIVATION_NOT_ELIGIBLE',
        NOT_REGISTERED: 'ACTIVATION_NOT_REGISTERED',
        NOT_ELIGIBLE: 'ACTIVATION_NOT_ELIGIBLE',
        AMBIGUOUS: 'ACTIVATION_AMBIGUOUS',
        ALREADY_ACTIVATED: 'ACTIVATION_ALREADY_ACTIVE',
      };
      if (blocked[activationStatus]) {
        publish({ phase: 'activation_error', errorCode: blocked[activationStatus] });
        return false;
      }
      if (activationStatus !== 'ELIGIBLE') throw Object.assign(new Error('Activation preflight unavailable'), { code: 'ACTIVATION_PREFLIGHT_INVALID' });
      const result = await provideClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: authFlowUrl('activation'), shouldCreateUser: true, data: { sutiapp_activation: true } },
      });
      if (result.error) throw result.error;
      publish({ phase: 'activation_sent', notice: 'Correo de activación enviado. Revisa tu bandeja y abre el enlace para definir tu contraseña.' });
      return true;
    } catch (error) {
      publish({ phase: 'activation_error', errorCode: emailDeliveryErrorCode(error, 'ACTIVATION') });
      return false;
    }
  }

  async function completeActivation(password) {
    const session = state.session;
    if (!session || !session.user) {
      publish({ phase: 'unauthenticated', errorCode: 'ACTIVATION_CALLBACK_INVALID' });
      return false;
    }
    publish({ phase: 'activating_password', session });
    const update = await provideClient().auth.updateUser({ password: String(password || ''), data: { sutiapp_activation: false } });
    if (update.error) {
      publish({ phase: 'activation_password', session, errorCode: 'ACTIVATION_PASSWORD_FAILED' });
      return false;
    }
    try {
      await window.AffiliateRepository.claimCurrentIdentity();
      const affiliate = await window.AffiliateRepository.getCurrentAffiliate(session.user);
      if (!affiliate || affiliate.auth_user_id !== session.user.id) throw new Error('Activation link was not persisted');
    } catch (_) {
      publish({ phase: 'activation_password', session, errorCode: 'ACTIVATION_LINK_FAILED' });
      return false;
    }
    clearAuthFlowUrl();
    const signedOut = await provideClient().auth.signOut();
    if (signedOut.error) {
      publish({ phase: 'error', session, errorCode: 'LOGOUT_FAILED' });
      return false;
    }
    publish({ phase: 'unauthenticated', notice: 'Cuenta activada y contraseña definida. Ya puedes iniciar sesión.' });
    return true;
  }

  async function requestPasswordRecovery(email) {
    publish({ phase: 'recovering' });
    try {
      const result = await provideClient().auth.resetPasswordForEmail(String(email || '').trim(), { redirectTo: authFlowUrl('recovery') });
      if (result.error) throw result.error;
      publish({ phase: 'recovery_sent', notice: 'Si existe una cuenta para ese correo, recibirás instrucciones de recuperación.' });
      return true;
    } catch (error) {
      publish({ phase: 'recovery_error', errorCode: emailDeliveryErrorCode(error, 'RECOVERY') });
      return false;
    }
  }

  async function updateRecoveredPassword(password) {
    const recoverySession = state.session;
    recoveryActive = true;
    publish({ phase: 'recovering', session: recoverySession });
    const result = await provideClient().auth.updateUser({ password: String(password || '') });
    if (result.error) { holdPasswordRecovery(recoverySession, 'PASSWORD_UPDATE_FAILED'); return false; }
    const signedOut = await provideClient().auth.signOut();
    if (signedOut.error) { holdPasswordRecovery(recoverySession, 'LOGOUT_FAILED'); return false; }
    recoveryActive = false;
    resolutionVersion += 1;
    clearAuthFlowUrl();
    publish({ phase: 'unauthenticated', notice: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    return true;
  }

  async function refreshContext() {
    const result = await provideClient().auth.getSession();
    if (result.error) throw result.error;
    await resolveSession(result.data && result.data.session);
    return state;
  }

  function useAffiliateAuth() {
    const [snapshot, setSnapshot] = React.useState(state);
    React.useEffect(() => subscribe(setSnapshot), []);
    React.useEffect(() => { bootstrap(); }, []);
    return Object.assign({}, snapshot, { signIn, signOut, retry, activate, completeActivation, requestPasswordRecovery, updateRecoveredPassword, refreshContext });
  }

  function messageFor(stateValue) {
    if (stateValue.phase === 'identity_error') return 'No pudimos verificar que esta sesión corresponda exactamente a tu afiliación. La sesión se cerró por seguridad; contacta a soporte.';
    if (stateValue.phase === 'archived') return 'Tu afiliación está archivada. No puedes iniciar nuevas operaciones; solicita una restauración administrativa.';
    if (stateValue.phase === 'unlinked') return 'Tu cuenta no está vinculada con un afiliado habilitado.';
    if (stateValue.phase === 'ineligible') return 'Tu afiliación no está habilitada para iniciar sesión.';
    if (stateValue.errorCode === 'INVALID_CREDENTIALS') return 'Correo o contraseña incorrectos.';
    if (stateValue.errorCode === 'ACTIVATION_ALREADY_ACTIVE') return 'Esta cuenta ya está activada. Inicia sesión o recupera tu contraseña.';
    if (stateValue.errorCode === 'ACTIVATION_NOT_REGISTERED') return 'Este correo no está registrado en el padrón de afiliados.';
    if (stateValue.errorCode === 'ACTIVATION_NOT_ELIGIBLE') return 'Este correo no está habilitado para activar una cuenta.';
    if (stateValue.errorCode === 'ACTIVATION_AMBIGUOUS') return 'El correo coincide con más de un registro. Solicita revisión administrativa.';
    if (stateValue.errorCode === 'ACTIVATION_RATE_LIMIT' || stateValue.errorCode === 'RECOVERY_RATE_LIMIT') return 'Se alcanzó el límite temporal de correos. Espera un momento e intenta nuevamente.';
    if (stateValue.errorCode === 'ACTIVATION_CONFIGURATION' || stateValue.errorCode === 'RECOVERY_CONFIGURATION') return 'El correo de acceso no está configurado correctamente. Contacta a soporte.';
    if (stateValue.errorCode === 'ACTIVATION_PROVIDER_ERROR' || stateValue.errorCode === 'RECOVERY_PROVIDER_ERROR') return 'El proveedor de correo no respondió. Intenta nuevamente más tarde.';
    if (stateValue.errorCode === 'ACTIVATION_CALLBACK_INVALID') return 'El enlace de activación no es válido o expiró. Solicita uno nuevo.';
    if (stateValue.errorCode === 'ACTIVATION_PASSWORD_FAILED') return 'No fue posible definir la contraseña. Revisa los datos e intenta nuevamente.';
    if (stateValue.errorCode === 'ACTIVATION_LINK_FAILED') return 'La cuenta se confirmó, pero no pudo vincularse al padrón. Contacta a soporte.';
    if (stateValue.errorCode === 'PASSWORD_UPDATE_FAILED') return 'No fue posible actualizar la contraseña. Revisa los datos e intenta nuevamente.';
    if (stateValue.errorCode === 'NOT_CONFIGURED' || stateValue.errorCode === 'CLIENT_UNAVAILABLE') return 'El acceso no está configurado en este dispositivo.';
    if (stateValue.errorCode === 'LOGOUT_FAILED') return 'No fue posible cerrar la sesión. Revisa tu conexión e intenta nuevamente.';
    if (stateValue.errorCode === 'CONNECTION_ERROR') return 'No pudimos conectar con el servicio de acceso. Intenta nuevamente.';
    if (stateValue.phase === 'error') return 'No pudimos conectar con el servicio de acceso. Intenta nuevamente.';
    return '';
  }

  function field(icon, type, value, setValue, placeholder, autoComplete, disabled) {
    return React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 11, height: 52, padding: '0 15px', borderRadius: 14, background: 'var(--surface-2)', color: 'var(--ink-3)' } },
      window.Icon && React.createElement(window.Icon, { name: icon, size: 19, stroke: 2 }),
      React.createElement('input', {
        type, value, placeholder, autoComplete, disabled,
        onChange: (event) => setValue(event.target.value),
        style: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 16, fontWeight: 650 },
      }));
  }

  function AffiliateLoginScreen({ auth }) {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [mode, setMode] = React.useState(auth.phase === 'password_recovery' ? 'reset' : auth.phase === 'activation_password' ? 'activate_password' : 'login');
    React.useEffect(() => {
      if (auth.phase === 'password_recovery') setMode('reset');
      else if (auth.phase === 'activation_password') setMode('activate_password');
      else if (auth.phase === 'unauthenticated') setMode('login');
    }, [auth.phase]);
    const busy = ['loading','signing_in','signing_out','activating','activating_password','recovering'].includes(auth.phase);
    const message = messageFor(auth);
    const submit = (event) => {
      event.preventDefault();
      if (busy) return;
      if (mode === 'login' && email.trim() && password) auth.signIn(email, password);
      if (mode === 'activate' && email.trim()) auth.activate(email);
      if (mode === 'activate_password' && password.length >= 8 && password === confirmPassword) auth.completeActivation(password);
      if (mode === 'recover' && email.trim()) auth.requestPasswordRecovery(email);
      if (mode === 'reset' && password.length >= 8 && password === confirmPassword) auth.updateRecoveredPassword(password);
    };

    if (auth.phase === 'loading' && !email && !password) {
      return React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--bg)' } },
        React.createElement('div', { style: { textAlign: 'center', color: 'var(--ink-2)', fontWeight: 750 } },
          window.SutiSeal && React.createElement(window.SutiSeal, { size: 74 }),
          React.createElement('div', { style: { marginTop: 16 } }, 'Verificando sesión…')));
    }

    return React.createElement('div', { style: { position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--bg)', padding: 'max(34px, env(safe-area-inset-top)) 22px max(28px, env(safe-area-inset-bottom))' } },
      React.createElement('div', { style: { maxWidth: 380, minHeight: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' } },
        React.createElement('div', { style: { textAlign: 'center', marginBottom: 24 } },
          window.SutiSeal && React.createElement(window.SutiSeal, { size: 82 }),
          React.createElement('h1', { style: { margin: '15px 0 4px', fontSize: 27, color: 'var(--ink)', letterSpacing: '-.02em' } }, 'Bienvenido a SutiApp'),
          React.createElement('p', { style: { margin: 0, color: 'var(--ink-2)', fontSize: 14, fontWeight: 650 } }, mode === 'activate' ? 'Activa tu cuenta de afiliado' : mode === 'activate_password' ? 'Define la contraseña de tu cuenta' : mode === 'recover' ? 'Recupera el acceso a tu cuenta' : mode === 'reset' ? 'Define una contraseña nueva' : 'Ingresa con tu cuenta de afiliado')),
        React.createElement('form', { onSubmit: submit, style: { padding: 20, borderRadius: 22, background: 'var(--surface)', boxShadow: 'var(--neo-md)' } },
          React.createElement('div', { style: { display: 'grid', gap: 12 } },
            mode !== 'reset' && mode !== 'activate_password' && field('message', 'email', email, setEmail, 'Email', 'email', busy),
            mode !== 'recover' && mode !== 'activate' && field('lock', 'password', password, setPassword, mode === 'login' ? 'Contraseña' : 'Nueva contraseña', mode === 'login' ? 'current-password' : 'new-password', busy),
            (mode === 'activate_password' || mode === 'reset') && field('lock', 'password', confirmPassword, setConfirmPassword, 'Confirmar contraseña', 'new-password', busy)),
          auth.notice && React.createElement('div', { role: 'status', style: { marginTop: 13, padding: '10px 12px', borderRadius: 11, background: '#E7F5EE', color: '#176447', fontSize: 13, fontWeight: 750, lineHeight: 1.35 } }, auth.notice),
          message && React.createElement('div', { className: 'su-err', role: 'alert', style: { marginTop: 13, padding: '10px 12px', borderRadius: 11, background: '#FDEAEA', color: '#A32921', fontSize: 13, fontWeight: 750, lineHeight: 1.35 } }, message),
          React.createElement(window.Btn || 'button', {
            full: true,
            type: 'submit',
            loading: busy,
            disabled: busy || ((mode === 'login' || mode === 'activate' || mode === 'recover') && !email.trim()) || ((mode === 'login' || mode === 'reset' || mode === 'activate_password') && (!password || ((mode === 'activate_password' || mode === 'reset') && (password.length < 8 || password !== confirmPassword)))),
            style: { marginTop: 16 },
          }, busy ? 'Procesando…' : mode === 'activate' ? 'Enviar correo de activación' : mode === 'activate_password' ? 'Activar cuenta' : mode === 'recover' ? 'Enviar instrucciones' : mode === 'reset' ? 'Guardar contraseña' : 'Entrar'),
          mode === 'login' && React.createElement('button', { type: 'button', onClick: () => setMode('recover'), style: { width: '100%', marginTop: 12, border: 'none', background: 'none', color: 'var(--ink-3)', fontSize: 13, fontWeight: 750, cursor: 'pointer' } }, 'Olvidé mi contraseña'),
          mode === 'login' && React.createElement('button', { type: 'button', onClick: () => setMode('activate'), style: { width: '100%', marginTop: 8, border: 'none', background: 'none', color: 'var(--guinda)', fontSize: 13, fontWeight: 800, cursor: 'pointer' } }, 'Activar mi cuenta'),
          mode !== 'login' && mode !== 'reset' && mode !== 'activate_password' && React.createElement('button', { type: 'button', onClick: () => setMode('login'), style: { width: '100%', marginTop: 10, border: 'none', background: 'none', color: 'var(--ink-3)', fontSize: 13, fontWeight: 750, cursor: 'pointer' } }, 'Volver al inicio de sesión'),
          (auth.errorCode === 'CONNECTION_ERROR' || auth.phase === 'error' || auth.phase === 'unlinked' || auth.phase === 'ineligible' || auth.phase === 'archived') && React.createElement('button', { type: 'button', onClick: auth.retry, style: { width: '100%', marginTop: 8, border: 'none', background: 'none', color: 'var(--guinda)', fontSize: 13, fontWeight: 800, cursor: 'pointer' } }, 'Intentar nuevamente')),
        React.createElement('p', { style: { margin: '18px 12px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 650, lineHeight: 1.45 } }, 'Si todavía no activas tu cuenta, tu registro de afiliación permanece intacto.')));
  }

  window.AffiliateAuth = Object.freeze({ bootstrap, signIn, signOut, retry, activate, completeActivation, requestPasswordRecovery, updateRecoveredPassword, refreshContext, subscribe, getState: () => state });
  window.useAffiliateAuth = useAffiliateAuth;
  window.AffiliateLoginScreen = AffiliateLoginScreen;
})();
