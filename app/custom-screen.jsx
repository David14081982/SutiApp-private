/* custom-screen.jsx — Pantalla personalizada de un pop-up (tipo Glide).
   Estructura fija: imagen de cabecera, título, texto y botones de enlace.
   Solo se abre desde el pop-up que la define. Exporta window.CustomScreenView. */
(function () {
  const { useState, useEffect } = React;
  const I = window.Icon;

  function CustomScreenView({ screen, app, hue, preview, onClose }) {
    const cs = screen || {};
    const [show, setShow] = useState(false);
    useEffect(() => { const t = setTimeout(() => setShow(true), 20); return () => clearTimeout(t); }, []);
    const close = () => { setShow(false); setTimeout(() => onClose && onClose(), 220); };
    const runBtn = (b) => {
      if (preview) return;
      if (b.type === 'url' && b.target) window.open(b.target, '_blank', 'noopener');
      else if (b.type === 'screen' && b.target) { close(); setTimeout(() => window.adminStore.navTo(app, b.target), 240); }
    };
    const botones = (cs.botones || []).filter((b) => b.label);
    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 95, background: 'var(--bg)', display: 'flex', flexDirection: 'column', transform: show ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .3s cubic-bezier(.32,.72,.35,1)' } },
      // cabecera con imagen
      React.createElement('div', { style: { position: 'relative', height: 210, flexShrink: 0, background: `linear-gradient(150deg, hsl(${hue || 345},70%,42%), hsl(${hue || 345},65%,26%))` } },
        cs.slotId && React.createElement(window.ResSlot, { resKey: 'screen.' + cs.slotId, shape: 'rect', fit: 'cover', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } }),
        React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.25), transparent 40%)' } }),
        React.createElement('button', { onClick: close, 'aria-label': 'Volver', style: { position: 'absolute', top: 14, left: 14, zIndex: 3, width: 40, height: 40, borderRadius: 13, border: 'none', background: 'rgba(255,255,255,.92)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)', boxShadow: '0 4px 14px -4px rgba(0,0,0,.35)' } }, React.createElement(I, { name: 'arrowL', size: 21, stroke: 2.2 })),
        cs.etiqueta && React.createElement('div', { style: { position: 'absolute', left: 16, bottom: 14, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.92)', color: 'var(--guinda)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', padding: '6px 11px', borderRadius: 999 } }, cs.etiqueta)),
      // contenido
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: '22px 22px 26px' } },
        React.createElement('h2', { style: { fontSize: 24, fontWeight: 900, color: 'var(--ink)', margin: 0, lineHeight: 1.15, letterSpacing: '-.02em' } }, cs.titulo || 'Título de la pantalla'),
        cs.texto && React.createElement('p', { style: { fontSize: 14.5, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.65, margin: '12px 0 0', whiteSpace: 'pre-line' } }, cs.texto),
        botones.length > 0 && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 11, marginTop: 24 } },
          botones.map((b, i) => React.createElement('button', { key: b.id || i, onClick: () => runBtn(b), className: 'su-press', style: i === 0
            ? { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 52, borderRadius: 15, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, background: 'var(--grad-guinda-soft)', color: '#fff', boxShadow: 'var(--glow-guinda)' }
            : { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 50, borderRadius: 15, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, background: 'var(--surface)', color: 'var(--guinda)', boxShadow: 'var(--neo-sm)' } },
            React.createElement(I, { name: b.type === 'url' ? 'link' : 'arrowR', size: 17, stroke: 2.2 }), b.label))),
        preview && React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginTop: 22 } },
          React.createElement(I, { name: 'eye', size: 14, stroke: 2 }), 'Vista previa · los botones no navegan')));
  }

  window.CustomScreenView = CustomScreenView;
})();
