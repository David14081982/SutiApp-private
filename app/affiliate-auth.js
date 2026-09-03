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
      if (version !== resolutionVersion) return;
      if (!affiliate && !isAdmin) {
        await rejectUnusableSession(archivedIdentity ? 'archived' : 'unlinked', archivedIdentity ? 'AFFILIATE_ARCHIVED' : 'AUTH_IDENTITY_WITHOUT_AFFILIATE');
        return;
      }
      if (affiliate && affiliate.auth_user_id !== session.user.id && !affiliate._impersonation) {
        await rejectUnusableSession('unlinked', 'AUTH_IDENTITY_WITHOUT_AFFILIATE');
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
      publish({ phase: 'error', session, errorCode: controlledErrorCode(error) });
    }
  }

  function resolveSession(session) {
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
      setTimeout(() => {
        if (event === 'SIGNED_OUT') {
          resolutionVersion += 1;
          if (window.AdminRepository && window.AdminRepository.clearAccessContext) window.AdminRepository.clearAccessContext();
          // A recovery update publishes its success notice immediately after
          // signOut. Preserve it when Supabase delivers SIGNED_OUT on the next
          // task; otherwise the reset form remains without completion feedback.
          publish({ phase: blockedPhase || 'unauthenticated', notice: state.notice || null });
          return;
        }
        if (event === 'INITIAL_SESSION') {
          if (state.phase === 'loading') resolveSession(session);
          return;
        }
        if (event === 'PASSWORD_RECOVERY') {
          publish({ phase: 'password_recovery', session });
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
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
        await resolveSession(result.data && result.data.session);
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

  async function activate(email, password) {
    publish({ phase: 'activating' });
    try {
      const result = await provideClient().auth.signUp({
        email: String(email || '').trim(), password: String(password || ''),
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (result.error) throw result.error;
      publish({ phase: 'activation_sent', notice: 'Revisa tu correo para confirmar y completar la activación.' });
      return true;
    } catch (_) {
      publish({ phase: 'activation_sent', notice: 'Si el correo es elegible, recibirás instrucciones para completar la activación.' });
      return true;
    }
  }

  async function requestPasswordRecovery(email) {
    publish({ phase: 'recovering' });
    try {
      await provideClient().auth.resetPasswordForEmail(String(email || '').trim(), { redirectTo: window.location.origin + window.location.pathname });
    } catch (_) {}
    publish({ phase: 'recovery_sent', notice: 'Si existe una cuenta para ese correo, recibirás instrucciones de recuperación.' });
    return true;
  }

  async function updateRecoveredPassword(password) {
    publish({ phase: 'recovering', session: state.session });
    const result = await provideClient().auth.updateUser({ password: String(password || '') });
    if (result.error) { publish({ phase: 'password_recovery', session: state.session, errorCode: 'PASSWORD_UPDATE_FAILED' }); return false; }
    await signOut();
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
    return Object.assign({}, snapshot, { signIn, signOut, retry, activate, requestPasswordRecovery, updateRecoveredPassword, refreshContext });
  }

  function messageFor(stateValue) {
    if (stateValue.phase === 'archived') return 'Tu afiliación está archivada. No puedes iniciar nuevas operaciones; solicita una restauración administrativa.';
    if (stateValue.phase === 'unlinked') return 'Tu cuenta no está vinculada con un afiliado habilitado.';
    if (stateValue.phase === 'ineligible') return 'Tu afiliación no está habilitada para iniciar sesión.';
    if (stateValue.errorCode === 'INVALID_CREDENTIALS') return 'Correo o contraseña incorrectos.';
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
    const [mode, setMode] = React.useState(auth.phase === 'password_recovery' ? 'reset' : 'login');
    React.useEffect(() => {
      if (auth.phase === 'password_recovery') setMode('reset');
      else if (auth.phase === 'unauthenticated') setMode('login');
    }, [auth.phase]);
    const busy = ['loading','signing_in','signing_out','activating','recovering'].includes(auth.phase);
    const message = messageFor(auth);
    const submit = (event) => {
      event.preventDefault();
      if (busy) return;
      if (mode === 'login' && email.trim() && password) auth.signIn(email, password);
      if (mode === 'activate' && email.trim() && password.length >= 8 && password === confirmPassword) auth.activate(email, password);
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
          React.createElement('p', { style: { margin: 0, color: 'var(--ink-2)', fontSize: 14, fontWeight: 650 } }, mode === 'activate' ? 'Activa tu cuenta de afiliado' : mode === 'recover' ? 'Recupera el acceso a tu cuenta' : mode === 'reset' ? 'Define una contraseña nueva' : 'Ingresa con tu cuenta de afiliado')),
        React.createElement('form', { onSubmit: submit, style: { padding: 20, borderRadius: 22, background: 'var(--surface)', boxShadow: 'var(--neo-md)' } },
          React.createElement('div', { style: { display: 'grid', gap: 12 } },
            mode !== 'reset' && field('message', 'email', email, setEmail, 'Email', 'email', busy),
            mode !== 'recover' && field('lock', 'password', password, setPassword, mode === 'reset' ? 'Nueva contraseña' : 'Contraseña', mode === 'login' ? 'current-password' : 'new-password', busy),
            (mode === 'activate' || mode === 'reset') && field('lock', 'password', confirmPassword, setConfirmPassword, 'Confirmar contraseña', 'new-password', busy)),
          auth.notice && React.createElement('div', { role: 'status', style: { marginTop: 13, padding: '10px 12px', borderRadius: 11, background: '#E7F5EE', color: '#176447', fontSize: 13, fontWeight: 750, lineHeight: 1.35 } }, auth.notice),
          message && React.createElement('div', { className: 'su-err', role: 'alert', style: { marginTop: 13, padding: '10px 12px', borderRadius: 11, background: '#FDEAEA', color: '#A32921', fontSize: 13, fontWeight: 750, lineHeight: 1.35 } }, message),
          React.createElement(window.Btn || 'button', {
            full: true,
            type: 'submit',
            loading: busy,
            disabled: busy || (mode !== 'reset' && !email.trim()) || (mode !== 'recover' && (!password || ((mode === 'activate' || mode === 'reset') && (password.length < 8 || password !== confirmPassword)))),
            style: { marginTop: 16 },
          }, busy ? 'Procesando…' : mode === 'activate' ? 'Activar cuenta' : mode === 'recover' ? 'Enviar instrucciones' : mode === 'reset' ? 'Guardar contraseña' : 'Entrar'),
          mode === 'login' && React.createElement('button', { type: 'button', onClick: () => setMode('recover'), style: { width: '100%', marginTop: 12, border: 'none', background: 'none', color: 'var(--ink-3)', fontSize: 13, fontWeight: 750, cursor: 'pointer' } }, 'Olvidé mi contraseña'),
          mode === 'login' && React.createElement('button', { type: 'button', onClick: () => setMode('activate'), style: { width: '100%', marginTop: 8, border: 'none', background: 'none', color: 'var(--guinda)', fontSize: 13, fontWeight: 800, cursor: 'pointer' } }, 'Activar mi cuenta'),
          mode !== 'login' && mode !== 'reset' && React.createElement('button', { type: 'button', onClick: () => setMode('login'), style: { width: '100%', marginTop: 10, border: 'none', background: 'none', color: 'var(--ink-3)', fontSize: 13, fontWeight: 750, cursor: 'pointer' } }, 'Volver al inicio de sesión'),
          (auth.errorCode === 'CONNECTION_ERROR' || auth.phase === 'error' || auth.phase === 'unlinked' || auth.phase === 'ineligible' || auth.phase === 'archived') && React.createElement('button', { type: 'button', onClick: auth.retry, style: { width: '100%', marginTop: 8, border: 'none', background: 'none', color: 'var(--guinda)', fontSize: 13, fontWeight: 800, cursor: 'pointer' } }, 'Intentar nuevamente')),
        React.createElement('p', { style: { margin: '18px 12px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 650, lineHeight: 1.45 } }, 'Si todavía no activas tu cuenta, tu registro de afiliación permanece intacto.')));
  }

  window.AffiliateAuth = Object.freeze({ bootstrap, signIn, signOut, retry, activate, requestPasswordRecovery, updateRecoveredPassword, refreshContext, subscribe, getState: () => state });
  window.useAffiliateAuth = useAffiliateAuth;
  window.AffiliateLoginScreen = AffiliateLoginScreen;
})();
