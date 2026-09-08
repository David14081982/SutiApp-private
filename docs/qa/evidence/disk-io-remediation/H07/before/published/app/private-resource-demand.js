/* Ephemeral request coordination. Backend authorization remains authoritative. */
(function () {
  'use strict';
  const pending = new Map(), listeners = new Set();
  let subject = '', generation = 0, authBound = false, adminBound = false;
  function context() {
    const auth = window.AffiliateAuth && window.AffiliateAuth.getState();
    if (!auth || auth.phase !== 'authenticated' || !auth.session || !auth.session.user || !auth.session.user.id || !(auth.session.access_token || auth.session.session_id)) return '';
    const affiliate = auth.affiliate || {}, imp = auth.impersonation || affiliate._impersonation || {};
    const admin = window.AdminRepository && window.AdminRepository.getState ? window.AdminRepository.getState() : {};
    // The token is used only inside this closure, never returned, persisted or logged.
    return JSON.stringify([auth.session.user.id, auth.session.access_token || auth.session.session_id || '', affiliate.id || '', imp,
      admin.phase || '', admin.subjectKey || '', admin.assignment || null]);
  }
  function sync() {
    if (!authBound && window.AffiliateAuth) { authBound = true; window.AffiliateAuth.subscribe(sync); }
    if (!adminBound && window.AdminRepository && window.AdminRepository.subscribe) { adminBound = true; window.AdminRepository.subscribe(sync); }
    const next = context();
    if (next !== subject) { subject = next; generation++; pending.clear(); listeners.forEach(fn => fn()); }
    return subject ? generation : null;
  }
  const changed = () => Object.assign(new Error('PRIVATE_RESOURCE_CONTEXT_CHANGED'), {code:'PRIVATE_RESOURCE_CONTEXT_CHANGED'});
  function run(key, load) {
    const epoch = sync();
    if (epoch === null) return Promise.reject(changed());
    if (pending.has(key)) return pending.get(key);
    const request = Promise.resolve().then(() => {
      if (sync() !== epoch) throw changed();
      return load();
    }).then(value => { if (sync() !== epoch) throw changed(); return value; })
      .finally(() => { if (pending.get(key) === request) pending.delete(key); });
    pending.set(key, request);
    return request;
  }
  function subscribe(fn) { sync(); listeners.add(fn); return () => listeners.delete(fn); }
  function useContext() {
    const [,render] = React.useState(0);
    React.useEffect(() => subscribe(() => render(n => n + 1)), []);
    return sync();
  }
  function useVisible(ref) {
    const [intersects,setIntersects] = React.useState(false), [foreground,setForeground] = React.useState(!document.hidden);
    React.useEffect(() => {
      const node = ref.current;
      if (!node) return;
      const visibility = () => setForeground(!document.hidden);
      document.addEventListener('visibilitychange', visibility);
      const observer = window.IntersectionObserver ? new IntersectionObserver(entries => setIntersects(entries.some(e => e.isIntersecting && e.intersectionRatio > 0))) : null;
      if (observer) observer.observe(node); else setIntersects(true);
      return () => { if (observer) observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
    }, [ref]);
    return intersects && foreground;
  }
  // One component intention, no shared settled cache. Expired sources are removed;
  // signing resumes only while visible. A failed image gets one fresh attempt.
  function useSource(key, load, visible, ttlSeconds) {
    const epoch = useContext(), loader = React.useRef(load), [result,setResult] = React.useState(null), [retry,setRetry] = React.useState(0);
    loader.current = load;
    const identity = JSON.stringify([epoch,key,retry]);
    React.useEffect(() => {
      if (!visible || !key || epoch === null) return;
      let active = true, timer;
      const expire = () => { if (active) { setResult(null); setRetry(n => n + 1); } };
      if (result && result.identity === identity && result.expires > Date.now()) {
        timer = setTimeout(expire, result.expires - Date.now());
        return () => { active = false; clearTimeout(timer); };
      }
      if (result && result.identity === identity && result.error) return;
      const started = Date.now();
      loader.current().then(value => {
        if (!active || sync() !== epoch) return;
        const url = typeof value === 'string' ? value : value.signedUrl;
        const expires = started + Math.min(ttlSeconds, Number(value.expiresIn) || ttlSeconds) * 1000;
        if (expires <= Date.now()) { setResult({identity,error:true}); return; }
        setResult({identity,url,expires});
        timer = setTimeout(expire, expires - Date.now());
      }, () => { if (active) setResult({identity,error:true}); });
      return () => { active = false; clearTimeout(timer); };
    }, [identity,visible]);
    // Retain only this mounted intention within its original deadline. Remounts
    // authorize afresh; no expired source can be returned after visibility changes.
    const valid = result && result.identity === identity && result.expires > Date.now();
    const failed = result && result.identity === identity && result.error;
    const attempted = React.useRef('');
    return {url:valid ? result.url : '',error:!!failed,onError:() => {
      if (attempted.current === key + ':' + epoch) { setResult({identity,error:true}); return; }
      attempted.current = key + ':' + epoch; setResult(null); setRetry(n => n + 1);
    }};
  }
  window.PrivateResourceDemand = Object.freeze({run,context:sync,subscribe,useContext,useVisible,useSource});
})();
