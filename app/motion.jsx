/* motion.jsx — SutiApp Motion System (M1)
   Fuente única de verdad del movimiento. No contiene ninguna animación de
   pantalla: solo tokens y primitivas. Cero dependencias externas.

   Superficie pública (congelada): window.MOTION
     tokens   dur · ease · spring · dist · scale · stagger
     estado   reduced() · onReduced(fn)
     A        shared.captureFrom / claimIn / claimOut / clear   (transiciones de ruta)
     B        onScroll(el, fn) · progress(v, dist)              (scroll compartido)
     C        flipCapture(container)                            (listas)
     util     animate(el, kf, opts) · springTo(opts) · reveal(container, opts)
   Hooks React: window.useReveal · window.useScrollDriver

   Reglas que el sistema impone por diseño:
   · Solo se animan transform y opacity (más border-radius, que no genera layout).
     Excepción ADR-055: el track interno de glifos del odómetro financiero puede
     animar filter: blur() junto con transform; ningún contenedor hereda esa excepción.
   · Una sola lectura de scroll por frame y por contenedor: medir → calcular → componer.
   · prefers-reduced-motion se resuelve aquí, una vez, no en cada pantalla.
*/
(function () {
  // ── Tokens ───────────────────────────────────────────────────────────────
  // D0 (11 ago 2026): `spatial` fijado en 420 ms por decisión de producto tras la
  // validación humana. Consumidores verificados: shared.claimIn (D = spatialMs())
  // y shared.claimOut (× .78 → 328 ms). Ninguna pantalla lo consume directamente.
  const dur = Object.freeze({ instant: 90, fast: 140, normal: 220, emphasized: 320, spatial: 420 });
  const ease = Object.freeze({
    standard: 'cubic-bezier(.2,.8,.2,1)',      // cambios de estado neutros
    emphasized: 'cubic-bezier(.22,1,.36,1)',   // la curva que ya usaba SutiApp
    enter: 'cubic-bezier(.05,.7,.1,1)',        // desacelera al llegar
    exit: 'cubic-bezier(.3,0,.8,.15)',         // acelera al salir
    spatial: 'cubic-bezier(.32,.72,0,1)',      // viajes largos (shared element)
  });
  // Springs para movimiento continuo (gesto, arrastre, rebote contenido).
  const spring = Object.freeze({
    gentle: Object.freeze({ stiffness: 170, damping: 26, mass: 1 }),
    snappy: Object.freeze({ stiffness: 320, damping: 30, mass: 1 }),
    firm: Object.freeze({ stiffness: 480, damping: 38, mass: 1 }),
  });
  const dist = Object.freeze({ xs: 8, sm: 14, md: 24 });
  const scale = Object.freeze({ press: 0.975, active: 0.99, elevated: 1.02, selected: 1.04, shared: 1 });
  const stagger = Object.freeze({ step: 35, max: 6 });
  const slot = Object.freeze({ duration: 1000, turns: 6, blur: 2.8 });

  // ── Reduced motion ───────────────────────────────────────────────────────
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reducedFlag = !!(mq && mq.matches);
  const reducedSubs = new Set();
  if (mq) {
    const onChange = () => { reducedFlag = mq.matches; reducedSubs.forEach((f) => { try { f(reducedFlag); } catch (e) {} }); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }
  const reduced = () => (qaState.reduced === 'on' ? true : qaState.reduced === 'off' ? false : reducedFlag);
  // El reloj de animación está congelado en documentos ocultos (pestaña en
  // segundo plano, iframe sin pintar): ahí NUNCA hay que ocultar nada para
  // animarlo después, o el contenido se queda invisible hasta volver a vista.
  const frozen = () => document.hidden === true;

  // ── QA / DEV ONLY ────────────────────────────────────────────────────────
  // Override de pruebas. Resolución: override de QA ?? preferencia del sistema.
  // NO altera la detección real (reducedFlag sigue reflejando el sistema).
  // Estado por defecto: reduced 'system', spatial nulo. Se activa desde el
  // panel de Tweaks → «QA de movimiento». Para retirarlo: borrar qaState, el
  // objeto MOTION.qa y esa sección de Tweaks.
  const qaState = { reduced: 'system', spatial: null };
  const live = new Set();          // animaciones creadas por el sistema
  const spatialMs = () => qaState.spatial || dur.spatial;

  // ── animate: WAAPI con política de reduced-motion ─────────────────────────
  // Con reduced-motion activo se conserva el FEEDBACK (opacidad) y se elimina
  // el desplazamiento: se filtran transform/translate/scale de los keyframes.
  function animate(el, kf, opts) {
    if (!el || !el.animate) return null;
    const o = Object.assign({ duration: dur.normal, easing: ease.standard, fill: 'both' }, opts || {});
    let frames = kf;
    if (reduced()) {
      frames = (Array.isArray(kf) ? kf : [kf]).map((f) => {
        const c = {};
        for (const k in f) if (!/^transform$|translate|scale|rotate/i.test(k)) c[k] = f[k];
        return c;
      });
      const empty = frames.every((f) => !Object.keys(f).length);
      if (empty) return null;
      o.duration = Math.min(o.duration, dur.fast);
      o.delay = 0;
    }
    try {
      const an = el.animate(frames, o);
      live.add(an);
      const drop = () => live.delete(an);
      an.addEventListener('finish', drop); an.addEventListener('cancel', drop);
      return an;
    } catch (e) { return null; }
  }

  // Odometer / slot-machine. Un solo escritor WAAPI por track de glifos:
  // compone transform + el blur autorizado por ADR-055 y no toca layout.
  function spinSlot(el, opts) {
    if (!el) return null;
    const o = Object.assign({ steps: slot.turns * 10, index: 0, loading: false, immediate: false }, opts || {});
    const end = 'translateY(-' + o.steps + 'em)';
    const finish = () => {
      el.style.transform = end;
      el.style.filter = 'blur(0px)';
      el.style.visibility = 'visible';
    };
    if (o.immediate || reduced() || frozen() || !el.animate) { finish(); return null; }
    el.style.visibility = 'visible';
    el.style.transform = 'translateY(0)';
    el.style.filter = 'blur(' + slot.blur + 'px)';
    const frames = o.loading ? [
      { transform: 'translateY(0)', filter: 'blur(' + slot.blur + 'px)' },
      { transform: end, filter: 'blur(' + slot.blur + 'px)' },
    ] : [
      { transform: 'translateY(0)', filter: 'blur(' + slot.blur + 'px)', offset: 0 },
      { transform: 'translateY(-' + (o.steps * .72) + 'em)', filter: 'blur(' + (slot.blur * .78) + 'px)', offset: .72 },
      { transform: 'translateY(-' + (o.steps * .91) + 'em)', filter: 'blur(' + (slot.blur * .34) + 'px)', offset: .91 },
      { transform: end, filter: 'blur(0px)', offset: 1 },
    ];
    const animation = animate(el, frames, {
      duration: slot.duration,
      easing: o.loading ? 'linear' : ease.enter,
      iterations: 1,
      fill: 'both',
    });
    if (animation && o.loading) animation.addEventListener('finish', () => { animation.cancel(); finish(); }, { once: true });
    return animation;
  }

  // ── springTo: integrador rAF (semi-implícito) ─────────────────────────────
  function springTo(opts) {
    const o = Object.assign({ from: 0, to: 1, spring: spring.gentle, onUpdate: null, onDone: null }, opts || {});
    const { stiffness, damping, mass } = o.spring;
    if (reduced()) { o.onUpdate && o.onUpdate(o.to); o.onDone && o.onDone(); return () => {}; }
    let x = o.from, v = 0, raf = 0, last = 0, alive = true;
    const step = (ts) => {
      if (!alive) return;
      const dt = Math.min(last ? (ts - last) / 1000 : 1 / 60, 1 / 30);
      last = ts;
      const a = (-stiffness * (x - o.to) - damping * v) / mass;
      v += a * dt; x += v * dt;
      if (Math.abs(x - o.to) < 0.0015 && Math.abs(v) < 0.02) {
        x = o.to; o.onUpdate && o.onUpdate(x); o.onDone && o.onDone(); alive = false; return;
      }
      o.onUpdate && o.onUpdate(x);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }

  // ── B · Driver de scroll compartido ──────────────────────────────────────
  // Un listener pasivo por contenedor, una lectura por frame, escrituras
  // después. Los suscriptores reciben scrollTop y componen con transform.
  const drivers = new Map();
  function onScroll(el, fn) {
    if (!el || typeof fn !== 'function') return () => {};
    let d = drivers.get(el);
    if (!d) {
      d = { subs: new Set(), raf: 0, handler: null };
      d.handler = () => {
        if (d.raf) return;
        // rAF no corre en documentos ocultos: ahí se agenda con timeout para que
        // un scroll programático (restaurar posición, tests) siga siendo coherente.
        const sched = (fn) => (document.hidden ? setTimeout(fn, 0) : requestAnimationFrame(fn));
        d.raf = sched(() => {
          d.raf = 0;
          const y = el.scrollTop;                      // ← única lectura vertical del frame
          const x = el.scrollLeft;                     // ← única lectura horizontal del frame
          d.subs.forEach((f) => { try { f(y, x); } catch (e) {} });
        });
      };
      el.addEventListener('scroll', d.handler, { passive: true });
      drivers.set(el, d);
    }
    d.subs.add(fn);
    try { fn(el.scrollTop, el.scrollLeft); } catch (e) {}
    return () => {
      d.subs.delete(fn);
      if (!d.subs.size) {
        el.removeEventListener('scroll', d.handler);
        if (d.raf) cancelAnimationFrame(d.raf);
        drivers.delete(el);
      }
    };
  }
  const progress = (v, distance) => (distance > 0 ? Math.max(0, Math.min(1, v / distance)) : 0);

  function useScrollDriver(ref, fn, deps) {
    const cb = React.useRef(fn); cb.current = fn;
    React.useLayoutEffect(() => {
      const node = ref && ref.current;
      if (!node) return;
      const sc = node.closest ? node.closest('.su-app-scroll') : null;
      if (!sc) return;
      return onScroll(sc, (y) => cb.current(y, sc));
    }, deps || []);
  }

  // ── C · FLIP para listas ─────────────────────────────────────────────────
  // Uso: const play = MOTION.flipCapture(container) ANTES del cambio de estado;
  // en useLayoutEffect posterior al commit, play().
  function flipCapture(container, selector) {
    if (!container || reduced()) return () => {};
    const sel = selector || '[data-flip-key]';
    const prev = new Map();
    container.querySelectorAll(sel).forEach((el) => {
      const k = el.getAttribute('data-flip-key');
      if (k) prev.set(k, el.getBoundingClientRect());
    });
    return function play(opts) {
      const o = Object.assign({ duration: dur.normal, easing: ease.standard }, opts || {});
      container.querySelectorAll(sel).forEach((el) => {
        const k = el.getAttribute('data-flip-key');
        const a = prev.get(k);
        if (!a) return;
        const b = el.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        if (!dx && !dy) return;
        animate(el, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], o);
      });
    };
  }

  // ── C5.1 · useFlipRows ────────────────────────────────────────────────────
  // FLIP sin captura previa: mide en cada commit y anima el delta contra la
  // medición anterior. Sirve tanto para arrastre (el orden ya cambió en
  // pointermove) como para botones subir/bajar. Único escritor de transform en
  // las filas que anima; la fila con `skip` (la arrastrada) no se toca.
  // ref: {current: {id: el}} o {current: contenedor} (+ selector).
  function useFlipRows(ref, skip, opts) {
    const prev = React.useRef(null);
    const skipRef = React.useRef(skip); skipRef.current = skip;
    const o = opts || {};
    React.useLayoutEffect(() => {
      const src = ref && ref.current;
      const now = new Map();
      if (src && src.nodeType === 1) {
        src.querySelectorAll(o.selector || '[data-flip-key]').forEach((el) => {
          const k = el.getAttribute('data-flip-key');
          if (k) now.set(k, { el, top: el.getBoundingClientRect().top });
        });
      } else if (src) {
        Object.keys(src).forEach((k) => {
          const el = src[k];
          if (el && el.isConnected) now.set(k, { el, top: el.getBoundingClientRect().top });
        });
      }
      const before = prev.current;
      prev.current = now;
      if (!before || reduced() || frozen()) return;
      now.forEach((cur, k) => {
        if (skipRef.current != null && String(skipRef.current) === String(k)) return;
        const a = before.get(k);
        if (!a) return;
        const dy = a.top - cur.top;
        if (Math.abs(dy) < 1) return;
        animate(cur.el, [{ transform: `translateY(${dy}px)` }, { transform: 'none' }],
          { duration: o.duration || dur.normal, easing: o.easing || ease.standard, fill: 'none' });
      });
    });
  }

  // ── A · Shared element ───────────────────────────────────────────────────
  // Sin clones: se transforma el elemento DESTINO desde la geometría del
  // origen hasta la suya (translate + scaleX/scaleY), y su contenido interno
  // recibe la escala inversa para que la imagen no se deforme: se percibe
  // como un recorte que crece, no como un estirón.
  let cap = null;    // captura del origen
  let active = null; // captura vigente para el viaje de vuelta

  function readTitle(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
    return { left: r.left, top: r.top, fs };
  }

  function captureFrom(root) {
    if (!root) return false;
    const el = root.matches && root.matches('[data-shared-key]') ? root : (root.querySelector ? root.querySelector('[data-shared-key]') : null);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    cap = {
      key: el.getAttribute('data-shared-key'),
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      radius: getComputedStyle(el).borderRadius,
      title: readTitle(root.querySelector ? root.querySelector('[data-shared-title]') : null),
      t: Date.now(),
    };
    return true;
  }

  function pair(from, to) {
    const sx = from.width / to.width, sy = from.height / to.height;
    return { sx, sy, dx: from.left - to.left, dy: from.top - to.top };
  }

  function claimIn(root) {
    if (!root || !cap) return 0;
    if (Date.now() - cap.t > 1200) { cap = null; return 0; }   // captura rancia
    const el = root.querySelector('[data-shared-key="' + cap.key + '"]');
    if (!el) { cap = null; return 0; }
    active = cap; cap = null;
    if (reduced() || frozen()) return 0;

    const to = el.getBoundingClientRect();
    if (!to.width || !to.height) return 0;
    const p = pair(active.rect, to);
    const D = spatialMs(), E = ease.spatial;
    const ownRadius = getComputedStyle(el).borderRadius;

    el.style.willChange = 'transform';
    el.style.transformOrigin = '0 0';
    animate(el, [
      { transform: `translate(${p.dx}px,${p.dy}px) scale(${p.sx},${p.sy})`, borderRadius: active.radius },
      { transform: 'none', borderRadius: ownRadius },
    ], { duration: D, easing: E });

    const inner = el.querySelector('[data-shared-inner]');
    if (inner) {
      inner.style.transformOrigin = '0 0';
      animate(inner, [
        { transform: `scale(${1 / p.sx},${1 / p.sy})` },
        { transform: 'none' },
      ], { duration: D, easing: E });
    }

    // El título viaja e interpola su tamaño (transform, no font-size).
    const tEl = root.querySelector('[data-shared-title]');
    if (tEl && active.title) {
      const tr = readTitle(tEl);
      const s = active.title.fs / tr.fs;
      tEl.style.transformOrigin = '0 0';
      animate(tEl, [
        { transform: `translate(${active.title.left - tr.left}px,${active.title.top - tr.top}px) scale(${s})`, opacity: 0.6 },
        { transform: 'none', opacity: 1 },
      ], { duration: D, easing: E });
    }

    // Contenido secundario: entra detrás, escalonado.
    const follow = root.querySelectorAll('[data-shared-follow]');
    follow.forEach((f, i) => animate(f, [
      { opacity: 0, transform: `translateY(${dist.sm}px)` },
      { opacity: 1, transform: 'none' },
    ], { duration: dur.emphasized, easing: ease.enter, delay: 120 + Math.min(i, stagger.max) * stagger.step }));

    setTimeout(() => { el.style.willChange = ''; }, D + 60);
    return D;
  }

  // Viaje de vuelta: el héroe regresa a la geometría del origen recordada.
  function claimOut(root) {
    if (!root) return 0;
    const a = active;
    const el = a ? root.querySelector('[data-shared-key="' + a.key + '"]') : null;
    if (!el || reduced() || frozen()) { active = null; return 0; }
    const from = el.getBoundingClientRect();
    if (!from.width || !from.height) { active = null; return 0; }
    const p = pair(a.rect, from);
    const D = Math.round(spatialMs() * 0.78), E = ease.spatial;

    el.style.transformOrigin = '0 0';
    animate(el, [
      { transform: 'none', borderRadius: getComputedStyle(el).borderRadius },
      { transform: `translate(${p.dx}px,${p.dy}px) scale(${p.sx},${p.sy})`, borderRadius: a.radius },
    ], { duration: D, easing: E });
    const inner = el.querySelector('[data-shared-inner]');
    if (inner) {
      inner.style.transformOrigin = '0 0';
      animate(inner, [{ transform: 'none' }, { transform: `scale(${1 / p.sx},${1 / p.sy})` }], { duration: D, easing: E });
    }
    root.querySelectorAll('[data-shared-follow],[data-shared-title]').forEach((f) => animate(f, [
      { opacity: 1 }, { opacity: 0 },
    ], { duration: dur.normal, easing: ease.exit }));
    active = null;
    return D;
  }

  function clearShared() { cap = null; active = null; }
  const pendingShared = () => !!cap;

  // ── reveal: entrada escalonada, una sola vez por elemento ────────────────
  const revealed = new Set();   // claves ya presentadas en la sesión
  // opts.offset(el, i) → {x, y}: desplazamiento inicial por elemento (permite
  // entradas laterales, p. ej. una retícula que se encuentra en el centro).
  // Por defecto es {x:0, y:o.distance} — el comportamiento histórico.
  // Contenedores que no pudieron animar por arrancar en documento oculto: el
  // reloj está congelado, así que se muestran de inmediato y se re-arman en
  // cuanto la pestaña vuelve a ser visible (mismo rescate que reveal-cards).
  const pendingReveal = new Set();
  let visHooked = false;
  function hookVisibility() {
    if (visHooked || typeof document === 'undefined') return;
    visHooked = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      Array.from(pendingReveal).forEach((p) => {
        pendingReveal.delete(p);
        const c = p.container;
        if (!c || !c.isConnected) return;
        Array.prototype.slice.call(c.children).forEach((k) => k.removeAttribute('data-m-revealed'));
        p.dispose = reveal(c, p.opts);
      });
    });
  }

  function reveal(container, opts) {
    if (!container) return () => {};
    const o = Object.assign({ key: '', step: stagger.step, max: stagger.max, distance: dist.sm, once: false, failsafe: 420 }, opts || {});
    const kids = Array.prototype.slice.call(container.children);
    if (reduced() || frozen()) {
      kids.forEach((k) => { k.style.opacity = ''; k.style.transform = ''; k.setAttribute('data-m-revealed', ''); });
      if (reduced() || o.once) return () => {};
      // Congelado (no es preferencia del usuario): reintentar al volver a vista.
      const entry = { container, opts, dispose: null };
      pendingReveal.add(entry);
      hookVisibility();
      return () => { pendingReveal.delete(entry); if (entry.dispose) entry.dispose(); };
    }
    const ios = [];
    const timers = [];
    kids.forEach((el, i) => {
      const rk = o.key + ':' + (el.getAttribute('data-reveal-key') || i);
      if (el.hasAttribute('data-m-revealed')) return;
      if (o.once && revealed.has(rk)) { el.setAttribute('data-m-revealed', ''); return; }
      const off = o.offset ? o.offset(el, i) : null;
      const ox = off && off.x ? off.x : 0;
      const oy = off ? (off.y || 0) : o.distance;
      const t0 = 'translate(' + ox + 'px,' + oy + 'px)';
      el.style.opacity = '0';
      el.style.transform = t0;
      let fired = false;
      const si = o.indexOf ? o.indexOf(el, i) : i;
      let timer = setTimeout(() => fire(), o.failsafe + Math.min(si, o.max) * o.step);
      timers.push(() => clearTimeout(timer));
      // Re-armado: al salir por completo de la vista la entrada vuelve a estar
      // disponible, así que el efecto se repite cada vez que se visita la zona.
      const rearm = () => {
        if (!fired || o.once || reduced() || frozen()) return;
        fired = false;
        el.removeAttribute('data-m-revealed');
        el.style.opacity = '0';
        el.style.transform = t0;
        clearTimeout(timer);
        timer = setTimeout(() => fire(), o.failsafe + Math.min(si, o.max) * o.step);
      };
      const fire = () => {
        if (fired) return;
        fired = true;
        el.setAttribute('data-m-revealed', '');
        revealed.add(rk);
        const an = animate(el, [
          { opacity: 0, transform: t0 },
          { opacity: 1, transform: 'none' },
        ], { duration: o.duration || dur.emphasized, easing: o.easing || ease.enter, delay: Math.min(si, o.max) * o.step });
        const done = () => { el.style.opacity = ''; el.style.transform = ''; };
        // La animación puede terminar, cancelarse o no arrancar nunca: en los
        // tres casos el contenido queda visible. MOTION MAY FAIL, CONTENT MUST NOT.
        if (an) { an.addEventListener('finish', done); an.addEventListener('cancel', done); } else done();
      };
      // El observer solo ADELANTA la entrada; nunca es condición necesaria.
      // Red de seguridad: si el contenedor está oculto, en un iframe fuera de
      // vista o el observer no dispara, el contenido se revela igualmente.
      // Un bloque nunca puede quedarse invisible por culpa del motion.
      try {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) { if (o.once) io.disconnect(); fire(); }
            else if (e.intersectionRatio === 0) rearm();
          });
        }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: [0, 0.01] });
        io.observe(el);
        ios.push(io);
      } catch (e) {}
    });
    return () => { ios.forEach((io) => io.disconnect()); timers.forEach((c) => c()); };
  }

  function useReveal(ref, opts) {
    const key = (opts && opts.key) || '';
    React.useLayoutEffect(() => {
      const node = ref && ref.current;
      if (!node) return;
      return reveal(node, opts);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
  }

  window.MOTION = Object.freeze({
    dur, ease, spring, dist, scale, stagger, slot,
    reduced, frozen,
    // QA / DEV ONLY — ver bloque de arriba. Retirable sin tocar el resto.
    qa: Object.freeze({
      mode: () => qaState.reduced,
      spatial: () => spatialMs(),
      setReduced: (m) => {
        qaState.reduced = (m === 'on' || m === 'off') ? m : 'system';
        // Cambiar de modo no puede dejar una transición a medias.
        live.forEach((a) => { try { a.finish(); } catch (e) { try { a.cancel(); } catch (e2) {} } });
        live.clear();
        clearShared();
        return qaState.reduced;
      },
      setSpatial: (ms) => { qaState.spatial = (ms > 0 ? Math.round(ms) : null); return spatialMs(); },
      // Ventana de medición de frames. Devuelve estadística, no un número suelto.
      fps: (windowMs) => new Promise((resolve) => {
        const W = Math.max(500, Math.min(20000, windowMs || 5000));
        const deltas = [];
        let t0 = 0, last = 0, hecho = false;
        const finish = (elapsed) => {
          if (hecho) return; hecho = true;
          const sorted = deltas.slice().sort((a, b) => a - b);
          const pct = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);
          const r1 = (v) => Math.round(v * 10) / 10;
          resolve({
            ventanaMs: Math.round(elapsed),
            framesEsperados: Math.round(elapsed / 16.7),
            framesObservados: deltas.length,
            fpsMedio: r1((deltas.length / Math.max(1, elapsed)) * 1000),
            frameMedioMs: r1(elapsed / Math.max(1, deltas.length)),
            peorFrameMs: r1(sorted[sorted.length - 1] || 0),
            p95Ms: r1(pct(0.95)),
            sobre16_7: deltas.filter((d) => d > 16.7).length,
            sobre33_3: deltas.filter((d) => d > 33.3).length,
            documentoOculto: document.hidden,
          });
        };
        // Red de seguridad: en documento oculto rAF no corre y la medición
        // nunca terminaría. Se resuelve igual, marcando documentoOculto.
        setTimeout(() => finish(W), W + 1500);
        const step = (ts) => {
          if (hecho) return;
          if (!t0) { t0 = last = ts; return requestAnimationFrame(step); }
          deltas.push(ts - last); last = ts;
          if (ts - t0 < W) return requestAnimationFrame(step);
          finish(ts - t0);
        };
        requestAnimationFrame(step);
      }),
    }),
    onReduced: (fn) => { if (typeof fn !== 'function') return () => {}; reducedSubs.add(fn); return () => reducedSubs.delete(fn); },
    animate, spinSlot, springTo,
    onScroll, progress,
    flipCapture,
    reveal,
    useFlipRows,
    shared: Object.freeze({ captureFrom, claimIn, claimOut, clear: clearShared, pending: pendingShared }),
  });
  Object.assign(window, { useReveal, useScrollDriver, useFlipRows });
})();
