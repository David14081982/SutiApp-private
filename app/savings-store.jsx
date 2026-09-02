/* Observable savings state. Backend failures remain visible; there is no local
   financial fallback and previous users' data is never reused. */
(function () {
  'use strict';
  const { useEffect, useState } = React;
  const listeners = new Set();
  let self = null, admin = null, selfPhase = 'idle', adminPhase = 'idle', selfError = null, adminError = null;
  let selfPromise = null, adminPromise = null, adminParticipant = null;
  const emit = () => listeners.forEach((fn) => fn());

  async function loadSelf(force) {
    if (selfPromise && !force) return selfPromise;
    selfPhase = 'loading'; selfError = null; self = null; emit();
    selfPromise = window.SavingsRepository.getSelfDashboard().then((value) => {
      self = Object.freeze(value || {}); selfPhase = 'ready'; return self;
    }).catch((error) => {
      self = null; selfError = error; selfPhase = 'error'; throw error;
    }).finally(() => { selfPromise = null; emit(); });
    return selfPromise;
  }

  async function loadAdmin(participantId, force) {
    const normalized = participantId || null;
    if (adminPromise && !force && normalized === adminParticipant) return adminPromise;
    adminParticipant = normalized; adminPhase = 'loading'; adminError = null; emit();
    adminPromise = window.SavingsRepository.getAdminDashboard(normalized).then((value) => {
      admin = Object.freeze(value || {}); adminPhase = 'ready'; return admin;
    }).catch((error) => {
      admin = null; adminError = error; adminPhase = 'error'; throw error;
    }).finally(() => { adminPromise = null; emit(); });
    return adminPromise;
  }

  const store = {
    state: () => ({ self, admin, selfPhase, adminPhase, selfError, adminError, adminParticipant }),
    loadSelf: (force) => loadSelf(Boolean(force)),
    loadAdmin: (participantId, force) => loadAdmin(participantId, Boolean(force)),
    clearSelf: () => { self = null; selfPhase = 'idle'; selfError = null; emit(); },
    clearAdmin: () => { admin = null; adminPhase = 'idle'; adminError = null; adminParticipant = null; emit(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  window.savingsStore = store;
  window.useSavingsStore = function (mode, participantId) {
    const [, force] = useState(0);
    useEffect(() => store.subscribe(() => force((value) => value + 1)), []);
    useEffect(() => {
      const request = mode === 'admin' ? store.loadAdmin(participantId) : store.loadSelf();
      request.catch(() => {});
    }, [mode, participantId]);
    return store;
  };
})();
