/* press.jsx — C1 · Pressable global (Microinteraction System).
   UNA sola fuente de feedback táctil para toda la app. Sustituye a
   `.su-press:active` y `.su-btn:active`; no se apila sobre ellos.

   Modelo: delegación. Un solo juego de listeners en `document` marca el
   elemento presionado con `data-pressed`; el movimiento lo hace CSS
   (`transform`/`box-shadow`, nunca layout). Coste por elemento: cero.

   Superficie cubierta automáticamente:
     - todo <button> no deshabilitado
     - cualquier nodo con `.su-press` (compatibilidad hacia atrás)
     - cualquier nodo con `data-press="subtle|standard|strong"`
   Exclusión explícita: `data-press="none"`.

   Intensidades (tokens, no números por pantalla):
     subtle   .988  superficies grandes (cards, filas de admin)
     standard .975  botones y controles (por defecto)
     strong   .955  icon buttons y controles pequeños

   Garantías duras:
     - el estado se libera en pointerup, pointercancel, lostpointercapture,
       movimiento > 10 px (scroll), blur, cambio de visibilidad, y por red de
       seguridad a los 700 ms: un elemento NUNCA se queda escalado.
     - teclado: Enter/Space sobre el elemento enfocado presionan y sueltan.
     - reduced-motion: no se marca nada (`frozen()` NO apaga el press: es CSS puro).
     - no añade `will-change`, ni rAF, ni observers, ni WAAPI.
*/
(function () {
  const SEL = 'button,.su-press,[data-press]';
  let cur = null, safety = 0, startX = 0, startY = 0, keyEl = null;

  // Solo reduced-motion apaga el press. `frozen()` NO: el press es CSS puro
  // (sin reloj de animación), y apagarlo en documento oculto dejaba la app sin
  // feedback en previews y pestañas en segundo plano.
  const off = () => {
    const m = window.MOTION;
    return !!(m && m.reduced());
  };
  const disabled = (el) => el.disabled === true || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('data-press') === 'none';

  function release() {
    if (safety) { clearTimeout(safety); safety = 0; }
    if (cur) {
      cur.removeAttribute('data-pressed');
      if (cur.hasAttribute('data-press-auto')) { cur.removeAttribute('data-press-auto'); cur.style.removeProperty('--press-s'); }
      cur = null;
    }
  }
  function hold(el) {
    if (!el || cur === el) return;
    release();
    cur = el;
    // Icon button: botón compacto sin texto → intensidad `strong` sin que cada
    // pantalla tenga que declararla. Una medición por press, sin observers.
    if (!el.hasAttribute('data-press') && el.tagName === 'BUTTON' && !(el.textContent || '').trim() && el.offsetWidth <= 52) {
      el.style.setProperty('--press-s', '.955');
      el.setAttribute('data-press-auto', '');
    }
    el.setAttribute('data-pressed', '');
    safety = setTimeout(release, 700);
  }
  function target(e) {
    const t = e.target;
    if (!t || !t.closest) return null;
    const el = t.closest(SEL);
    if (!el || disabled(el)) return null;
    return el;
  }

  document.addEventListener('pointerdown', (e) => {
    if (off() || e.button > 0) return;
    startX = e.clientX; startY = e.clientY;
    hold(target(e));
  }, { capture: true, passive: true });

  // Un desplazamiento del dedo = el usuario está haciendo scroll, no pulsando.
  document.addEventListener('pointermove', (e) => {
    if (!cur) return;
    if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) release();
  }, { capture: true, passive: true });

  ['pointerup', 'pointercancel', 'lostpointercapture', 'dragstart', 'contextmenu'].forEach((t) => {
    document.addEventListener(t, release, { capture: true, passive: true });
  });
  window.addEventListener('blur', release, true);
  document.addEventListener('visibilitychange', release);
  // Scroll dentro de cualquier contenedor: cancela el press (pasivo, sin coste).
  document.addEventListener('scroll', () => { if (cur) release(); }, { capture: true, passive: true });

  // Teclado: la activación por Enter/Space debe verse igual que un tap.
  document.addEventListener('keydown', (e) => {
    if (off() || e.repeat) return;
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const el = document.activeElement;
    if (!el || !el.closest || !el.matches(SEL) || disabled(el)) return;
    keyEl = el;
    hold(el);
  }, true);
  document.addEventListener('keyup', () => { if (keyEl) { keyEl = null; release(); } }, true);

  // Superficie mínima de lectura (QA). No expone internos.
  window.Pressable = Object.freeze({
    version: 1,
    selector: SEL,
    levels: Object.freeze({ subtle: 0.988, standard: 0.975, strong: 0.955 }),
    pressed: () => cur,
  });
})();
