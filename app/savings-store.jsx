/* Observable savings state. Backend failures remain visible; there is no local
   financial fallback and previous users' data is never reused. */
(function () {
  'use strict';
  const { useEffect, useState } = React;
  const listeners = new Set();
  let self = null, admin = null, selfPhase = 'idle', adminPhase = 'idle', selfError = null, adminError = null;
  let selfPromise = null, adminPromise = null, adminParticipant = null;
  let selfGeneration = 0, adminGeneration = 0, identity = '', authSubscribed = false, projectionSubscribed = false;
  function currentIdentity() {
    if (window.SavingsRepository && window.SavingsRepository.getSelfIdentityKey) return window.SavingsRepository.getSelfIdentityKey();
    const auth = window.AffiliateAuth && window.AffiliateAuth.getState();
    return auth && auth.phase === 'authenticated' ? [auth.session && auth.session.user && auth.session.user.id, auth.affiliate && auth.affiliate.id, auth.impersonation && (auth.impersonation.id || auth.impersonation.session_id)].join(':') : '';
  }
  function ensureIdentity() {
    if (!projectionSubscribed && window.SavingsRepository && window.SavingsRepository.subscribeSelfInvalidation) {
      projectionSubscribed = true; window.SavingsRepository.subscribeSelfInvalidation(() => { store.clearSelf(); store.clearAdmin(); });
    }
    if (window.SavingsRepository && window.SavingsRepository.prepareSelfContext) window.SavingsRepository.prepareSelfContext();
    if (!authSubscribed && window.AffiliateAuth) {
      authSubscribed = true;
      window.AffiliateAuth.subscribe(() => {
        const next = currentIdentity();
        if (identity !== next) { identity = next; store.clearSelf(); store.clearAdmin(); }
      });
    }
    const next = currentIdentity();
    if (identity !== next) { identity = next; store.clearSelf(); store.clearAdmin(); }
    return identity;
  }
  const emit = () => listeners.forEach((fn) => fn());
  const balanceFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function selectSelfBalance(snapshot) {
    const current = snapshot || {};
    if (current.selfPhase === 'loading' || current.selfPhase === 'idle') return Object.freeze({ status: current.selfPhase || 'idle', value: null, label: '—' });
    if (current.selfPhase === 'error') return Object.freeze({ status: 'error', value: null, label: '—' });
    const dashboard = current.self;
    if (!dashboard || !dashboard.participant) return Object.freeze({ status: 'empty', value: null, label: '—' });
    const raw = dashboard.balances && dashboard.balances.total;
    const value = raw == null || raw === '' ? null : Number(raw);
    if (!Number.isFinite(value)) return Object.freeze({ status: 'invalid', value: null, label: 'Por confirmar' });
    return Object.freeze({ status: 'ready', value, label: balanceFormatter.format(value) });
  }

  const balanceReadModel = Object.freeze({ select: selectSelfBalance });

  async function loadSelf(force) {
    ensureIdentity();
    if (selfPromise && !force) return selfPromise;
    const generation = ++selfGeneration;
    selfPhase = 'loading'; selfError = null; self = null; emit();
    selfPromise = window.SavingsRepository.getSelfDashboard({ force: Boolean(force) }).then((value) => {
      if (generation !== selfGeneration) return null;
      self = Object.freeze(value || {}); selfPhase = 'ready'; return self;
    }).catch((error) => {
      if (generation !== selfGeneration) return null;
      self = null; selfError = error; selfPhase = 'error'; throw error;
    }).finally(() => { if (generation === selfGeneration) { selfPromise = null; emit(); } });
    return selfPromise;
  }

  async function loadAdmin(participantId, force) {
    ensureIdentity();
    const normalized = participantId || null;
    if (adminPromise && !force && normalized === adminParticipant) return adminPromise;
    const generation = ++adminGeneration;
    adminParticipant = normalized; admin = null; adminPhase = 'loading'; adminError = null; emit();
    adminPromise = window.SavingsRepository.getAdminDashboard(normalized).then((value) => {
      if (generation !== adminGeneration) return null;
      admin = Object.freeze(value || {}); adminPhase = 'ready'; return admin;
    }).catch((error) => {
      if (generation !== adminGeneration) return null;
      admin = null; adminError = error; adminPhase = 'error'; throw error;
    }).finally(() => { if (generation === adminGeneration) { adminPromise = null; emit(); } });
    return adminPromise;
  }

  const store = {
    state: () => ({ self, admin, selfPhase, adminPhase, selfError, adminError, adminParticipant }),
    loadSelf: (force) => loadSelf(Boolean(force)),
    loadAdmin: (participantId, force) => loadAdmin(participantId, Boolean(force)),
    clearSelf: () => { if (window.SavingsRepository && window.SavingsRepository.clearSelfCache) window.SavingsRepository.clearSelfCache(); selfGeneration++; selfPromise = null; self = null; selfPhase = 'idle'; selfError = null; emit(); },
    clearAdmin: () => { adminGeneration++; adminPromise = null; admin = null; adminPhase = 'idle'; adminError = null; adminParticipant = null; emit(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  window.savingsStore = store;
  window.SavingsBalanceReadModel = balanceReadModel;
  window.useSavingsStore = function (mode, participantId) {
    const [, force] = useState(0);
    const identityKey = currentIdentity();
    useEffect(() => store.subscribe(() => force((value) => value + 1)), []);
    useEffect(() => {
      if (mode === 'disabled') return undefined;
      const request = mode === 'admin' ? store.loadAdmin(participantId) : store.loadSelf();
      request.catch(() => {});
    }, [mode, participantId, identityKey]);
    return store;
  };
  window.useSelfSavingsBalance = function (enabled) {
    const active = enabled !== false;
    const currentStore = window.useSavingsStore(active ? 'self' : 'disabled');
    return active ? balanceReadModel.select(currentStore.state()) : balanceReadModel.select({ self: null, selfPhase: 'idle' });
  };
})();
