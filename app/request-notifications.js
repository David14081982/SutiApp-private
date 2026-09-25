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
  // Visual/motion contract: owner-supplied authorization HTML, isolated from History.
  const celebrationCSS = `.suti-au-ov{--guinda:#910022;--guinda-600:#7e0020;--guinda-700:#6a001b;--guinda-50:#fbeef1;--guinda-100:#f3d6de;--guinda-glow:#d11f3a;--grad-guinda:linear-gradient(150deg,#e8364f 0%,#c41230 42%,#910022 100%);--grad-guinda-soft:linear-gradient(145deg,#d11f3a,#910022);--ink:#14213d;--ink-2:#5a6378;--ink-3:#97a0b3;--pos:#13794a;--pos-50:#e7f6ed;--gold:#c8922f;--surface:#fff;--surface-2:#eef1f6;--bg:#f2f3f5;--hairline:#e6eaf1;--hairline-strong:#d6dbe6;--shadow-lg:0 30px 70px -24px rgba(20,33,61,.45),0 6px 18px -6px rgba(20,33,61,.18);--glow-guinda:0 10px 26px -6px rgba(209,31,58,.55),0 4px 10px -2px rgba(145,0,34,.4);--font:'Nunito',system-ui,sans-serif;--mono:'Spline Sans Mono',ui-monospace,monospace}
.suti-au-ov{position:absolute;inset:0;z-index:20;display:grid;place-items:center;padding:22px;background:rgba(20,33,61,.46);backdrop-filter:blur(0px);opacity:0;pointer-events:none;transition:opacity .28s ease,backdrop-filter .28s ease}
.suti-au-ov.is-open{opacity:1;pointer-events:auto;backdrop-filter:blur(3px)}
.suti-au{position:relative;width:100%;max-width:340px;background:var(--surface);border-radius:30px;box-shadow:var(--shadow-lg);overflow:hidden;text-align:center;transform:translateY(26px) scale(.94);opacity:0;transition:transform .5s cubic-bezier(.34,1.56,.64,1),opacity .24s ease}
.suti-au-ov.is-open .suti-au{transform:none;opacity:1}
/* cabecera guinda con halo */
.suti-au-hero{position:relative;background:var(--grad-guinda);padding:34px 20px 50px;overflow:hidden}
.suti-au-hero::before{content:"";position:absolute;width:260px;height:260px;border-radius:50%;left:50%;top:-120px;transform:translateX(-50%);background:radial-gradient(circle,rgba(255,255,255,.22),rgba(255,255,255,0) 68%)}
.suti-au-hero::after{content:"";position:absolute;left:-10%;right:-10%;bottom:-34px;height:62px;background:var(--surface);border-radius:50% 50% 0 0}
.suti-au-badge{position:relative;z-index:1;width:88px;height:88px;margin:0 auto;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 14px 30px -10px rgba(60,0,15,.55),0 0 0 8px rgba(255,255,255,.16);transform:scale(.4);opacity:0}
.suti-au-ov.is-open .suti-au-badge{animation:suti-au-pop .6s .16s cubic-bezier(.34,1.56,.64,1) forwards}
.suti-au-badge svg{width:46px;height:46px}
.suti-au-badge circle{fill:var(--pos-50)}
.suti-au-badge path{fill:none;stroke:var(--pos);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:30;stroke-dashoffset:30}
.suti-au-ov.is-open .suti-au-badge path{animation:suti-au-draw .42s .5s cubic-bezier(.65,0,.35,1) forwards}
.suti-au-ring{position:absolute;left:50%;top:34px;width:88px;height:88px;margin-left:-44px;border-radius:50%;border:2px solid rgba(255,255,255,.7);opacity:0;z-index:0}
.suti-au-ov.is-open .suti-au-ring{animation:suti-au-ring 1.1s .55s cubic-bezier(.2,.7,.3,1) forwards}
/* cuerpo */
.suti-au-body{padding:4px 24px 24px;position:relative}
.suti-au-kick{display:inline-flex;align-items:center;gap:6px;font-size:var(--text-11-5, 11.5px);font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--pos);background:var(--pos-50);border-radius:999px;padding:5px 11px}
.suti-au-kick i{width:6px;height:6px;border-radius:50%;background:var(--pos)}
.suti-au-t{font-size:var(--text-24, 24px);font-weight:900;letter-spacing:-.025em;line-height:1.15;margin-top:12px;text-wrap:balance}
.suti-au-s{font-size:var(--text-14-5, 14.5px);color:var(--ink-2);line-height:1.5;margin-top:8px;text-wrap:pretty}
.suti-au-ref{display:flex;align-items:center;gap:12px;margin-top:18px;padding:12px 14px;background:var(--surface-2);border-radius:16px;text-align:left}
.suti-au-ref__ico{width:40px;height:40px;border-radius:13px;background:var(--grad-guinda-soft);display:grid;place-items:center;flex-shrink:0;color:#fff}
.suti-au-ref__p{font-size:var(--text-14-5, 14.5px);font-weight:900}
.suti-au-ref__f{font-family:var(--mono);font-size:var(--text-12-5, 12.5px);font-weight:600;color:var(--ink-2);margin-top:1px}
.suti-au-actions{display:grid;gap:8px;margin-top:20px}
.suti-au-btn{min-height:50px;border-radius:15px;border:1px solid transparent;font-size:var(--text-15-5, 15.5px);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .16s cubic-bezier(.2,.7,.3,1)}
.suti-au-btn:active{transform:scale(.975)}
.suti-au-btn--pri{background:var(--grad-guinda-soft);color:#fff;box-shadow:var(--glow-guinda)}
.suti-au-btn--sec{background:transparent;color:var(--ink-2)}
.suti-au-btn:focus-visible{outline:2px solid var(--guinda);outline-offset:2px}
/* entrada escalonada del contenido */
.suti-au-body>*{opacity:0;transform:translateY(10px)}
.suti-au-ov.is-open .suti-au-body>*{animation:suti-au-rise .46s cubic-bezier(.22,1,.36,1) forwards}
.suti-au-ov.is-open .suti-au-body>*:nth-child(1){animation-delay:.34s}
.suti-au-ov.is-open .suti-au-body>*:nth-child(2){animation-delay:.40s}
.suti-au-ov.is-open .suti-au-body>*:nth-child(3){animation-delay:.46s}
.suti-au-ov.is-open .suti-au-body>*:nth-child(4){animation-delay:.52s}
.suti-au-ov.is-open .suti-au-body>*:nth-child(5){animation-delay:.58s}
@keyframes suti-au-pop{0%{transform:scale(.4);opacity:0}60%{opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes suti-au-draw{to{stroke-dashoffset:0}}
@keyframes suti-au-ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.1);opacity:0}}
@keyframes suti-au-rise{to{opacity:1;transform:none}}
/* confeti: lienzo sobre todo el teléfono */
.suti-au-fx{position:absolute;inset:0;z-index:30;pointer-events:none;width:100%;height:100%}
@media (prefers-reduced-motion:reduce){.suti-au,.suti-au-ov,.suti-au-badge,.suti-au-body>*{transition:none!important;animation:none!important;transform:none!important;opacity:1!important}.suti-au-ov:not(.is-open){opacity:0!important}.suti-au-badge path{stroke-dashoffset:0}.suti-au-ring{display:none}}


.suti-au-ov,.suti-au-ov *{box-sizing:border-box}
.suti-au-ov{position:fixed;z-index:10000;font-family:var(--font);color:var(--ink);padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));height:100%;height:100dvh;overscroll-behavior:contain}
.suti-au{max-height:100%;overflow-y:auto;overscroll-behavior:contain;min-height:0}
.suti-au p,.suti-au h2{margin:0}.suti-au .suti-au-t{margin-top:12px}.suti-au .suti-au-s{margin-top:8px}
.suti-au-ref>div{min-width:0}.suti-au-ref__f{overflow-wrap:anywhere}
.suti-au-btn{font-family:inherit;cursor:pointer;padding:10px 12px;flex-wrap:wrap}.suti-au-btn svg{flex-shrink:0}
.suti-au-fx{position:fixed;z-index:1}
.suti-au-ov[data-still] *{animation:none!important;transition:none!important;transform:none!important;opacity:1!important}
.suti-au-ov[data-still] .suti-au-badge path{stroke-dashoffset:0}.suti-au-ov[data-still] .suti-au-ring{display:none}
`;
  function startConfetti(host) {
    const cv = document.createElement('canvas');
    cv.className = 'suti-au-fx'; cv.setAttribute('aria-hidden', 'true');
    cv.dataset.approvedConfetti = 'two-jets'; host.appendChild(cv);
    const ctx = cv.getContext('2d');
    if (!ctx) { cv.remove(); return () => {}; }
    const DELAY_DERECHA = 300, DURACION_CHORRO = 950, POR_FRAME = 7;
    const COLORES = ['#910022','#d11f3a','#c8922f','#e8c37a','#f3d6de','#ffffff','#13794a'];
    let W = 0, H = 0, parts = [], raf = 0, t0 = performance.now(), lastFrame = 0;
    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = host.clientWidth; H = host.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    }
  function rnd(a,b){ return a + Math.random() * (b - a); }

  /* una partícula: sale de la boquilla con alta presión y se abre en abanico estrecho */
  function spawn(lado, t){
    var izq = lado === 'L';
    var bamboleo = Math.sin(t / 90) * 3;                 /* la manguera "vibra" un poco */
    var ang = (izq ? -70 : -110) + bamboleo + rnd(-5, 5); /* grados, 0 = derecha */
    var rad = ang * Math.PI / 180;
    var v = rnd(23, 31) * (H / 800);                      /* presión escalada a la altura */
    var s = rnd(6, 11);
    parts.push({
      x: izq ? rnd(-6, 10) : W - rnd(-6, 10), y: H + rnd(0, 8),
      vx: Math.cos(rad) * v, vy: Math.sin(rad) * v,
      w: s, h: s * rnd(1.3, 2), r: rnd(0, Math.PI * 2), vr: rnd(-.25, .25),
      flip: rnd(0, Math.PI * 2), vf: rnd(.12, .3),
      c: COLORES[(Math.random() * COLORES.length) | 0],
      forma: Math.random() < .18 ? 'o' : 'r', vida: 0
    });
  }

  function tick(now){
    if (now - lastFrame < 1000 / 60 - 1) { raf = requestAnimationFrame(tick); return; }
    lastFrame = now;
    var t = now - t0;
    if (t < DURACION_CHORRO) for (var i = 0; i < POR_FRAME; i++) spawn('L', t);
    var t2 = t - DELAY_DERECHA;
    if (t2 >= 0 && t2 < DURACION_CHORRO) for (var j = 0; j < POR_FRAME; j++) spawn('R', t2);

    ctx.clearRect(0, 0, W, H);
    for (var k = parts.length - 1; k >= 0; k--){
      var p = parts[k];
      p.vida++;
      p.vy += .3 * (H / 800);            /* gravedad */
      p.vx *= .985; p.vy *= .985;        /* resistencia del aire */
      if (p.vy > 0) { p.vx *= .97; p.vx += Math.sin(p.flip) * .12; } /* al caer, planea y se mece */
      p.x += p.vx; p.y += p.vy; p.r += p.vr; p.flip += p.vf;
      var alpha = p.vida > 150 ? Math.max(0, 1 - (p.vida - 150) / 40) : 1;
      if (p.y > H + 40 || alpha <= 0) { parts.splice(k, 1); continue; }
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.flip));    /* giro en 3D: la tira se voltea */
      ctx.fillStyle = p.c;
      if (p.c === '#ffffff') { ctx.shadowColor = 'rgba(20,33,61,.25)'; ctx.shadowBlur = 2; }
      if (p.forma === 'o') { ctx.beginPath(); ctx.arc(0, 0, p.w * .45, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (parts.length || t < DELAY_DERECHA + DURACION_CHORRO) raf = requestAnimationFrame(tick);
    else { ctx.clearRect(0, 0, W, H); window.removeEventListener('resize', size); cv.remove(); }
  }


    size(); raf = requestAnimationFrame(tick); window.addEventListener('resize', size);
    return () => { cancelAnimationFrame(raf); parts = []; window.removeEventListener('resize', size); cv.remove(); };
  }
  function ApprovedRequestCelebration({ event, request, onClose, onTrack }) {
    const overlay = React.useRef(null), primary = React.useRef(null);
    const titleId = React.useId();
    const callbacks = React.useRef({ onClose, onTrack }); callbacks.current = { onClose, onTrack };
    React.useLayoutEffect(() => {
      const host = overlay.current, previous = document.activeElement;
      const scope = document.querySelector('[data-text-size]:not(.suti-au-ov)');
      const typography = () => host.setAttribute('data-text-size', scope ? scope.getAttribute('data-text-size') : 'normal');
      typography();
      const observer = new MutationObserver(typography);
      if (scope) observer.observe(scope, { attributes: true, attributeFilter: ['data-text-size'] });
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      let stop = () => {}, timer = 0;
      const still = () => media.matches || window.MOTION && (window.MOTION.reduced() || window.MOTION.frozen());
      const motionChanged = () => { if (still()) { host.setAttribute('data-still', ''); clearTimeout(timer); stop(); } };
      motionChanged(); media.addEventListener('change', motionChanged);
      const frame = requestAnimationFrame(() => host.classList.add('is-open'));
      if (!still()) timer = setTimeout(() => { if (!still()) stop = startConfetti(host); }, 380);
      const keydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); callbacks.current.onClose(); }
        if (e.key === 'Tab') {
          const buttons = host.querySelectorAll('button'), first = buttons[0], last = buttons[buttons.length - 1];
          if (e.shiftKey && (document.activeElement === first || !host.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || !host.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', keydown, true);
      primary.current.focus({ preventScroll: true });
      return () => {
        clearTimeout(timer); cancelAnimationFrame(frame); stop(); observer.disconnect();
        media.removeEventListener('change', motionChanged); document.removeEventListener('keydown', keydown, true);
        if (previous && previous.isConnected) previous.focus({ preventScroll: true });
      };
    }, []);
    const current = (request.steps || []).find(step => step.active);
    const message = current ? 'Consulta el seguimiento de tu solicitud. Etapa actual: ' + current.label + '.' : 'Tu solicitud fue autorizada. Puedes consultar el seguimiento aquí.';
    const icon = h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('rect', { x: 5, y: 3, width: 14, height: 18, rx: 2 }), h('path', { d: 'M9 8h6M9 12h6M9 16h4' }));
    return ReactDOM.createPortal(h('div', { ref: overlay, className: 'suti-au-ov', 'data-user-authorization': event.id,
      onClick: e => { if (e.target === e.currentTarget) onClose(); } },
      h('style', null, celebrationCSS),
      h('div', { className: 'suti-au', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': titleId + '-description' },
        h('div', { className: 'suti-au-hero', 'aria-hidden': true },
          h('span', { className: 'suti-au-ring' }),
          h('div', { className: 'suti-au-badge' }, h('svg', { viewBox: '0 0 48 48' }, h('circle', { cx: 24, cy: 24, r: 22 }), h('path', { d: 'M14.5 24.5l6.5 6.5 12.5-13' })))),
        h('div', { className: 'suti-au-body' },
          h('span', { className: 'suti-au-kick' }, h('i'), 'Autorizada'),
          h('h2', { className: 'suti-au-t', id: titleId }, '¡Tu solicitud fue autorizada!'),
          h('p', { className: 'suti-au-s', id: titleId + '-description' }, message),
          h('div', { className: 'suti-au-ref' }, h('span', { className: 'suti-au-ref__ico' }, icon),
            h('div', null, h('p', { className: 'suti-au-ref__p' }, request.tipo), h('p', { className: 'suti-au-ref__f' }, event.folio))),
          h('div', { className: 'suti-au-actions' },
            h('button', { ref: primary, className: 'suti-au-btn suti-au-btn--pri', type: 'button', onClick: onTrack }, 'Ver seguimiento',
              h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'M5 12h14m-6-6 6 6-6 6' }))),
            h('button', { className: 'suti-au-btn suti-au-btn--sec', type: 'button', onClick: onClose }, 'Entendido'))))), document.body);
  }
  function RequestAuthorizationNotice({ app, requests }) {
    // Token refresh changes the private resource generation, not who owns a
    // successfully claimed celebration. Never carry it across a real identity change.
    const ownerKey = () => {
      const auth = window.AffiliateAuth.getState();
      if (auth.phase !== 'authenticated' || !auth.session || !auth.session.user || !auth.affiliate) return null;
      const acting = auth.impersonation || auth.affiliate._impersonation;
      return JSON.stringify([auth.session.user.id, auth.affiliate.id, acting && acting.session_id || null]);
    };
    const notifications = useRequestNotifications(), [notice, setNotice] = React.useState(null), [error, setError] = React.useState(false);
    const pending = React.useRef(new Set()), busy = React.useRef(false), leaving = React.useRef(false), mounted = React.useRef(false), generation = React.useRef(0);
    const owner = React.useRef(ownerKey());
    React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++generation.current; }; }, []);
    // History stays mounted under tracking. Resume the queue only after returning.
    React.useEffect(() => { leaving.current = !!document.querySelector('[data-app-route]:not([aria-hidden="true"])'); }, [app]);
    React.useEffect(() => {
      if (notice || busy.current || leaving.current || document.querySelector('[data-app-route]:not([aria-hidden="true"])')) return;
      const event = notifications.rows.find(row => row.authorized && !row.seen_at && !pending.current.has(row.id) && requests.some(request => request.sourceId === row.request_id && request.requestStatus === 'approved'));
      if (!event || document.hidden) return;
      const claimOwner = ownerKey(), ticket = generation.current;
      if (!claimOwner) return;
      pending.current.add(event.id); busy.current = true;
      markSeen(event.id).then(claimed => {
        if (!mounted.current || ticket !== generation.current || claimOwner !== ownerKey()) return;
        busy.current = false;
        // Preserve the existing atomic BEFORE-display receipt: only its winner celebrates.
        if (claimed) { setNotice(event); setError(false); }
        else notifications.retry();
      }).catch(() => {
        if (!mounted.current || ticket !== generation.current) return;
        busy.current = false; pending.current.delete(event.id); setError(true);
      });
    }, [notifications.rows, requests, notice, app]);
    React.useEffect(() => window.PrivateResourceDemand.subscribe(() => {
      const next = ownerKey();
      if (next && next === owner.current) return;
      owner.current = next; ++generation.current; busy.current = false; leaving.current = false;
      setNotice(null); setError(false); pending.current.clear();
    }), []);
    if (!notice) return (error || notifications.phase === 'error') ? h('p', { role: 'status', style: { margin: 16, color: 'var(--ink-2)' } }, 'No pudimos consultar los avisos de tus solicitudes. ', h('button', { onClick: notifications.retry }, 'Reintentar')) : null;
    const request = requests.find(row => row.sourceId === notice.request_id);
    if (!request) return null;
    return h(ApprovedRequestCelebration, { key: notice.id, event: notice, request,
      onClose: () => { setNotice(null); notifications.retry(); },
      onTrack: () => { leaving.current = true; setNotice(null); app.push('tracking', { s: { sourceId: notice.request_id } }); } });
  }
  Object.assign(window, { RequestEventNotifications: { list, markSeen }, useRequestNotifications, RequestAuthorizationNotice });
})();
