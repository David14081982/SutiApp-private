/* live-text.jsx — Motor de edición de textos en vivo.
   Aplica los overrides de copyStore sobre cualquier texto del frontend y, en
   modo edición, convierte el nodo tocado en editable (un clic sobre la palabra).
   Un solo listener delegado por tipo de evento; un solo MutationObserver.
   Exporta window.LiveText y window.TextEditBar. */
(function () {
  const CS = () => window.copyStore;
  const SKIP_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, SCRIPT: 1, STYLE: 1, 'IMAGE-SLOT': 1, CANVAS: 1 };
  let scope = 'home';
  let editing = null;      // { el, from, prev }
  let queued = false;
  let observer = null;

  function injectCSS() {
    if (document.getElementById('su-livetext-css')) return;
    const s = document.createElement('style');
    s.id = 'su-livetext-css';
    s.textContent = '.su-te{outline:1.5px dashed rgba(145,0,34,.45);outline-offset:2px;border-radius:5px;cursor:text}.su-te:hover{outline-color:var(--guinda,#910022);background:rgba(145,0,34,.06)}.su-te-active{outline:2px solid var(--guinda,#910022);outline-offset:2px;background:#fff;box-shadow:0 6px 20px -8px rgba(0,0,0,.35);cursor:text}[data-copy-edited]{}';
    document.head.appendChild(s);
  }

  function eligible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS[el.tagName] || el.ownerSVGElement || el.tagName === 'svg') return false;
    if (el.childNodes.length !== 1 || el.childNodes[0].nodeType !== 3) return false;
    const t = el.textContent;
    if (!t) return false;
    const len = t.trim().length;
    if (len < 1 || len > 400) return false;
    if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(t)) return false;   // números y símbolos sueltos no son copy
    // Structured records keep their table as the sole content authority.
    // managed_copy_overrides is reserved for explicit UI copy.
    if (el.closest('[data-notext],[data-lt-ui],[data-structured-content]')) return false;
    return true;
  }

  function apply() {
    const cs = CS();
    if (!cs) return;
    const root = document.getElementById('root');
    if (!root) return;
    const live = cs.live();
    const has = cs.count() > 0;
    // Restaurar textos cuyo override ya no existe (restablecer individual o total)
    const marked = root.querySelectorAll('[data-copy-edited]');
    for (let i = 0; i < marked.length; i++) {
      const el = marked[i];
      if (el === (editing && editing.el)) continue;
      const from = el.getAttribute('data-copy-edited');
      if (!cs.lookupFrom(scope, from) && !cs.lookupTo(scope, el.textContent)) { el.textContent = from; el.removeAttribute('data-copy-edited'); }
    }
    if (!live) root.querySelectorAll('.su-te').forEach((n) => n.classList.remove('su-te'));
    if (!live && !has) return;
    if (scope === 'admin') { root.querySelectorAll('.su-te').forEach((n) => n.classList.remove('su-te')); return; }
    const nodes = root.querySelectorAll('*');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el === (editing && editing.el)) continue;
      if (!eligible(el)) { if (el.classList && el.classList.contains('su-te')) el.classList.remove('su-te'); continue; }
      const text = el.textContent;
      const done = cs.lookupTo(scope, text);
      if (done) el.setAttribute('data-copy-edited', done.from);
      else {
        const o = cs.lookupFrom(scope, text);
        if (o) { el.textContent = o.to; el.setAttribute('data-copy-edited', o.from); }
        else if (el.hasAttribute('data-copy-edited')) el.removeAttribute('data-copy-edited');
      }
      if (live) el.classList.add('su-te'); else el.classList.remove('su-te');
    }
  }
  // Un frame no entregado (documento oculto) no puede dejar los textos sin
  // aplicar: el rAF lleva red de seguridad por timeout y el que llegue primero
  // libera la cola.
  function schedule() {
    if (queued) return;
    queued = true;
    const run = () => { if (!queued) return; queued = false; apply(); };
    requestAnimationFrame(run);
    setTimeout(run, 120);
  }

  // ── edición de un nodo ──
  function startEdit(el) {
    const cs = CS();
    if (!cs || !cs.live()) return;
    if (editing) commit();
    const from = el.getAttribute('data-copy-edited') || el.textContent;
    editing = { el, from, prev: el.textContent };
    el.classList.add('su-te-active');
    el.setAttribute('contenteditable', 'plaintext-only');
    el.setAttribute('spellcheck', 'false');
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  function finish(el) {
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.classList.remove('su-te-active');
  }
  function commit() {
    if (!editing) return;
    const { el, from, prev } = editing;
    editing = null;
    const next = (el.textContent || '').replace(/\s+/g, ' ').trim();
    finish(el);
    if (!next) { el.textContent = prev; schedule(); return; }
    if (next !== prev) CS().set(scope, from, next, CS().meName());
    else schedule();
  }
  function cancel() {
    if (!editing) return;
    const { el, prev } = editing;
    editing = null;
    el.textContent = prev;
    finish(el);
  }

  function hit(target) {
    let el = target;
    for (let i = 0; el && i < 4; i++) { if (eligible(el)) return el; el = el.parentElement; }
    return null;
  }
  function guard(e) {
    const cs = CS();
    if (!cs || !cs.live()) return;
    if (editing && (e.target === editing.el || editing.el.contains(e.target))) return;
    const el = hit(e.target);
    if (!el) { if (editing) commit(); return; }
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'click') startEdit(el);
  }

  function init() {
    injectCSS();
    ['pointerdown', 'mousedown', 'click'].forEach((t) => document.addEventListener(t, guard, true));
    document.addEventListener('keydown', (e) => {
      if (!editing) return;
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    }, true);
    document.addEventListener('focusout', (e) => { if (editing && e.target === editing.el) commit(); }, true);
    const root = document.getElementById('root');
    if (root) {
      observer = new MutationObserver(schedule);
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    }
    if (CS()) CS().subscribe(() => { queued = false; apply(); });
    apply();
    schedule();
  }

  const scopeSubs = new Set();
  window.LiveText = {
    setScope: (s) => { if (s === scope) return; if (editing) cancel(); scope = s || 'home'; queued = false; apply(); schedule(); scopeSubs.forEach((f) => f(scope)); },
    scope: () => scope,
    onScope: (fn) => { scopeSubs.add(fn); return () => scopeSubs.delete(fn); },
    refresh: schedule,
  };

  if (document.getElementById('root')) init();
  else document.addEventListener('DOMContentLoaded', init);

  // ─────────────────────────────────────────────────────────────
  // Barra flotante de edición (solo para quien tiene permiso)
  // ─────────────────────────────────────────────────────────────
  function TextEditBar() {
    const I = window.Icon;
    const [, force] = React.useState(0);
    React.useEffect(() => CS().subscribe(() => force((n) => n + 1)), []);
    React.useEffect(() => window.LiveText.onScope(() => force((n) => n + 1)), []);
    if (window.adminStore) window.useAdminStore && window.useAdminStore();
    const cs = CS();
    if (!cs.canEdit() || scope === 'admin') return null;
    const live = cs.live();
    const n = cs.count();

    const shell = { position: 'absolute', left: 14, right: 14, bottom: 'calc(78px + env(safe-area-inset-bottom))', zIndex: 55, display: 'flex', justifyContent: live ? 'stretch' : 'flex-end', pointerEvents: 'none' };
    const pill = { pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 15px', borderRadius: 999, border: 'none', background: 'var(--surface)', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 14px 30px -12px rgba(16,12,14,.45)' };

    if (!live) {
      return React.createElement('div', { 'data-lt-ui': '1', 'data-notext': '1', style: shell },
        React.createElement('button', { onClick: () => cs.setLive(true), style: pill },
          React.createElement(I, { name: 'pencil', size: 17, stroke: 2.2 }), 'Editar textos',
          n > 0 && React.createElement('span', { style: { minWidth: 20, height: 20, borderRadius: 999, background: 'var(--guinda-50)', color: 'var(--guinda)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center', padding: '0 6px' } }, n)));
    }
    return React.createElement('div', { 'data-lt-ui': '1', 'data-notext': '1', style: shell },
      React.createElement('div', { style: { pointerEvents: 'auto', flex: 1, background: 'var(--surface)', borderRadius: 18, boxShadow: '0 18px 40px -14px rgba(16,12,14,.5)', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 } },
        React.createElement('div', { style: { width: 34, height: 34, borderRadius: 11, background: 'var(--grad-guinda-soft)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'pencil', size: 17, stroke: 2.2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' } }, 'Toca un texto para editarlo'),
          React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, cs.meName() + ' · ' + n + (n === 1 ? ' texto editado' : ' textos editados'))),
        React.createElement('button', { onClick: () => cs.setLive(false), style: { border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, height: 36, padding: '0 15px', borderRadius: 12, cursor: 'pointer', flexShrink: 0 } }, 'Listo')));
  }
  window.TextEditBar = TextEditBar;
})();
