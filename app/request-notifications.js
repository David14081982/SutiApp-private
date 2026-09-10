/* Workflow event notifications. Durable read state belongs exclusively to Supabase. */
(function () {
  const h = React.createElement;
  async function list() {
    const { data, error } = await window.SutiSupabase.getClient().rpc('list_self_request_event_notifications');
    if (error) throw error;
    return data || [];
  }
  async function markSeen(id) {
    const { data, error } = await window.SutiSupabase.getClient().rpc('mark_self_request_event_seen', { p_event_id: id });
    if (error) throw error;
    return data === true;
  }
  function useRequestNotifications() {
    const [state, setState] = React.useState({ phase: 'loading', rows: [] });
    const [revision, setRevision] = React.useState(0);
    React.useEffect(() => {
      let active = true, loading = false, context = window.PrivateResourceDemand.context();
      const refresh = async () => {
        if (loading || document.hidden) return;
        loading = true;
        try {
          const rows = await list();
          if (active && context === window.PrivateResourceDemand.context()) setState({ phase: 'loaded', rows });
        } catch (_) { if (active) setState({ phase: 'error', rows: [] }); }
        finally { loading = false; }
      };
      setState({ phase: 'loading', rows: [] }); refresh();
      const unbind = window.PrivateResourceDemand.subscribe(() => { active = false; setState({ phase: 'loading', rows: [] }); setRevision(v => v + 1); });
      const timer = setInterval(refresh, 15000);
      window.addEventListener('focus', refresh); window.addEventListener('suti:request-changed', refresh); document.addEventListener('visibilitychange', refresh);
      return () => { active = false; clearInterval(timer); unbind(); window.removeEventListener('focus', refresh); window.removeEventListener('suti:request-changed', refresh); document.removeEventListener('visibilitychange', refresh); };
    }, [revision]);
    return { ...state, retry: () => setRevision(v => v + 1) };
  }
  function RequestAuthorizationNotice({ app, requests }) {
    const notifications = useRequestNotifications(), [notice, setNotice] = React.useState(null), [error, setError] = React.useState(false);
    const pending = React.useRef(new Set()), ref = React.useRef(null);
    React.useEffect(() => {
      if (notice) return;
      const event = notifications.rows.find(row => row.authorized && !row.seen_at && requests.some(request => request.sourceId === row.request_id && request.requestStatus === 'approved'));
      if (!event || pending.current.has(event.id) || document.hidden) return;
      const context = window.PrivateResourceDemand.context(); pending.current.add(event.id);
      markSeen(event.id).then(claimed => {
        // Only the transaction that first acknowledged this event may celebrate, across tabs/devices.
        if (claimed && context === window.PrivateResourceDemand.context()) { setNotice(event); setError(false); }
      }).catch(() => { pending.current.delete(event.id); setError(true); });
    }, [notifications.rows, requests, notice]);
    React.useEffect(() => window.PrivateResourceDemand.subscribe(() => { setNotice(null); setError(false); pending.current.clear(); }), []);
    React.useEffect(() => {
      if (!notice || !ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.MOTION && (window.MOTION.reduced() || window.MOTION.frozen())) return;
      const animations = Array.from(ref.current.querySelectorAll('i')).map((piece, i) => piece.animate([{ transform: 'translateY(-20px)', opacity: 0 }, { opacity: 1, offset: .1 }, { transform: 'translateY(190px) rotate(420deg)', opacity: 0 }], { duration: 1300, delay: i * 17, fill: 'both' }));
      return () => animations.forEach(animation => animation.cancel());
    }, [notice]);
    if (!notice) return (error || notifications.phase === 'error') ? h('p', { role: 'status', style: { margin: 16, color: 'var(--ink-2)' } }, 'No pudimos consultar los avisos de tus solicitudes. ', h('button', { onClick: notifications.retry }, 'Reintentar')) : null;
    const request = requests.find(row => row.sourceId === notice.request_id);
    return h('section', { ref, role: 'status', 'data-user-authorization': notice.id, style: { position: 'relative', overflow: 'hidden', background: '#E7F6ED', color: '#13794A', padding: 18, borderRadius: 18, margin: 16 } },
      h('div', { 'aria-hidden': 'true', style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, Array.from({ length: 24 }, (_, i) => h('i', { key: i, style: { position: 'absolute', top: 0, opacity: 0, left: ((i * 37) % 100) + '%', width: 6, height: 10, background: ['#901040', '#D9A441', '#13794A'][i % 3] } }))),
      h('strong', { style: { fontSize: 'var(--text-19, 19px)' } }, '¡Tu solicitud fue autorizada!'),
      h('p', null, notice.folio + ' · ' + (request ? request.tipo : notice.program_id)),
      request && request.steps.find(step => step.active) && h('p', null, 'Ahora continúa: ' + request.steps.find(step => step.active).label),
      h('button', { onClick: () => { setNotice(null); app.push('tracking', { s: { sourceId: notice.request_id } }); } }, 'Ver seguimiento'),
      h('button', { onClick: () => { setNotice(null); notifications.retry(); }, style: { marginLeft: 12 } }, 'Entendido'));
  }
  Object.assign(window, { RequestEventNotifications: { list, markSeen }, useRequestNotifications, RequestAuthorizationNotice });
})();
