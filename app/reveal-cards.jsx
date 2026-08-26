/* reveal-cards.jsx — C7-lite · reveal de tarjetas al desplazar.
   Una sola instancia global: un IntersectionObserver + un MutationObserver para
   inscribir las tarjetas que aparecen al navegar. Cero listeners por elemento.

     Qué revela: `.su-card`, `.su-press` y `[data-reveal]`, cada vez que entran
     en pantalla (al salir por completo de la vista vuelven a quedar armadas).
   Qué NO revela (y por qué):
     - nodos con `transform` inline: ya los gobierna un driver de scroll
       (carruseles de Inicio y Convenios) — un segundo escritor de transform
       está prohibido por el sistema.
     - `[data-noreveal]`, y todo lo que viva dentro de un nodo con ese atributo
       (nav, toast, sheets, pop-ups: aparecen por su propia presencia).
     - nodos de menos de 24 px de alto (chips, pills, iconos sueltos).

   MOTION MAY FAIL, CONTENT MUST NOT: con `reduced()` o `frozen()` no se oculta
   nada; y todo elemento inscrito tiene red de seguridad por timeout, así que no
   puede quedarse invisible aunque el observer nunca dispare.
*/
(function () {
  const SEL = '.su-card,.su-press,[data-reveal]';
  const seen = new WeakSet();
  let io = null, mo = null, batch = [], flushT = 0;

  const M = () => window.MOTION;
  const off = () => { const m = M(); return !m || m.reduced() || m.frozen(); };

  function eligible(el) {
    if (seen.has(el) || el.hasAttribute('data-noreveal')) return false;
    if (el.style && el.style.transform) return false;          // driver ya escribe transform
    if (el.style && el.style.opacity === '0') return false;    // ya lo gestiona reveal()
    if (el.hasAttribute('data-m-revealed')) return false;
    if (el.closest('[data-noreveal]')) return false;
    if (el.offsetHeight < 24) return false;
    return true;
  }

  // El contenido se hace visible ANTES de animar: la animación WAAPI parte de sus
  // propios keyframes, así que su ciclo de vida no puede dejar nada invisible.
  function show(el, i) {
    const m = M();
    el.style.opacity = '';
    el.style.transform = '';
    el.setAttribute('data-m-revealed', '');
    if (!m || m.reduced() || m.frozen()) return;
    m.animate(el, [
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: m.dur.emphasized, easing: m.ease.enter, delay: Math.min(i, m.stagger.max) * m.stagger.step });
  }

  function flush() {
    flushT = 0;
    const list = batch.filter((el) => !el.hasAttribute('data-m-revealed')); batch = [];
    list.forEach((el, i) => show(el, i));
  }

  // ÚNICA ruta de inscripción. Nadie escribe `opacity: 0` sin pasar por aquí:
  // en documento oculto o con movimiento reducido no se oculta nada (la regla dura
  // del proyecto), porque el reloj de animación está congelado y los timers se
  // estrangulan — el failsafe no puede ser el único rescate.
  function enrollOne(el) {
    if (!io || off() || !eligible(el)) return;
    seen.add(el);
    io.observe(el);
    el.style.opacity = '0';
    arm(el);
  }

  // Red de seguridad por elemento: si el observer no dispara, el contenido se
  // muestra igual. Se re-arma en cada ciclo (la entrada puede repetirse).
  const timers = new WeakMap();
  function arm(el) {
    clearTimeout(timers.get(el));
    timers.set(el, setTimeout(() => { if (el.style.opacity === '0') show(el, 0); }, 1400));
  }

  // Al salir por completo de la vista la tarjeta vuelve a quedar lista: el
  // reveal se repite cada vez que se visita esa zona, no una sola vez.
  function rearm(el) {
    if (off() || !el.hasAttribute('data-m-revealed')) return;
    if (el.style && el.style.transform) return;
    el.removeAttribute('data-m-revealed');
    el.style.opacity = '0';
    arm(el);
  }

  function enroll(root) {
    if (off()) return;
    const nodes = root.querySelectorAll ? root.querySelectorAll(SEL) : [];
    for (let k = 0; k < nodes.length; k++) enrollOne(nodes[k]);
  }

  function start() {
    if (typeof IntersectionObserver === 'undefined') return;
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) batch.push(e.target);
        else if (e.intersectionRatio === 0) rearm(e.target);
      });
      if (batch.length && !flushT) flushT = setTimeout(flush, 16);
    }, { threshold: [0, 0.08], rootMargin: '0px 0px -6% 0px' });

    enroll(document);
    mo = new MutationObserver((muts) => {
      for (let i = 0; i < muts.length; i++) {
        const added = muts[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          const n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches(SEL)) enrollOne(n);
          enroll(n);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // Cargar en segundo plano no puede dejar la función muerta toda la sesión:
    // al pasar a visible se inscribe lo que ya está montado.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) enroll(document); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);

  window.RevealCards = Object.freeze({ version: 1, selector: SEL, enroll, enrollOne });
})();
