/* screens-admin-pantallas.jsx — Bloqueo de pantallas completas por tipo de
   sindicato / categoría de empleo, con apertura a público general y a
   usuarios no agremiados. Exporta window.PantallasModule y window.ScreenLocked. */
(function () {
  const { useState } = React;
  const I = window.Icon;
  const S = () => window.useAdminStore();
  const A = () => window.ADMIN;

  const MODE_TONE = {
    public: { bg: '#E7F6ED', fg: '#0b5c37' },
    guest: { bg: '#E8F0FE', fg: '#2456C7' },
    registered: { bg: 'var(--guinda-50)', fg: 'var(--guinda)' },
    segment: { bg: '#FFF3DC', fg: '#7a5410' },
  };
  const modeDef = (v) => (A().SCREEN_MODES || []).find((m) => m.value === v) || A().SCREEN_MODES[0];

  // ── Pantalla que ve el usuario cuando no tiene acceso ──
  function ScreenLocked({ screen, onBack }) {
    const store = window.adminStore;
    const label = (window.ADMIN ? window.ADMIN.SCREEN(screen).label : screen);
    const motivo = store ? store.screenBlockReason(screen) : '';
    const esInvitado = store && store.screenAccess(screen).mode === 'guest';
    return React.createElement('div', { style: { minHeight: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      onBack && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(10px + env(safe-area-inset-top)) 14px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: onBack, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'var(--surface-2)', color: 'var(--ink)', display: 'grid', placeItems: 'center', cursor: 'pointer' } },
          React.createElement(I, { name: 'arrowL', size: 20, stroke: 2.2 })),
        React.createElement('span', { style: { fontSize: 16, fontWeight: 800 } }, label)),
      React.createElement('div', { className: 'su-route', style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 34px' } },
        React.createElement('div', { style: { width: 86, height: 86, borderRadius: '50%', background: 'var(--surface)', boxShadow: 'var(--neo-md)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } },
          React.createElement(I, { name: esInvitado ? 'user' : 'lock', size: 38, stroke: 1.9 })),
        React.createElement('h2', { style: { fontSize: 20, fontWeight: 900, letterSpacing: '-.02em', margin: '20px 0 0' } }, esInvitado ? 'Contenido para visitantes' : 'Sección restringida'),
        React.createElement('p', { style: { fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.55, margin: '9px 0 0', maxWidth: 300, textWrap: 'pretty' } }, motivo),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 18, fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' } },
          React.createElement(I, { name: 'shield', size: 14, stroke: 2 }), 'SUTISSSTESON')));
  }

  // ── Chips de selección múltiple ──
  function Chips({ label, options, values, onChange, editable }) {
    const on = values || [];
    const toggle = (o) => { if (!editable) return; onChange(on.indexOf(o) === -1 ? on.concat(o) : on.filter((x) => x !== o)); };
    return React.createElement('div', { style: { marginBottom: 13 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 7 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' } }, label),
        React.createElement('span', { style: { fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' } }, on.length ? on.length + ' seleccionados' : 'Todos')),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } },
        options.map((o) => {
          const sel = on.indexOf(o) !== -1;
          return React.createElement('button', {
            key: o, onClick: () => toggle(o), disabled: !editable,
            style: { border: 'none', cursor: editable ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, padding: '7px 12px', borderRadius: 999, background: sel ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: sel ? '#fff' : 'var(--ink-2)', boxShadow: sel ? 'var(--glow-guinda)' : 'none', opacity: editable ? 1 : .6 },
          }, o);
        })));
  }

  // ── Hoja de edición del acceso de una pantalla ──
  function AccessSheet({ screen, onClose, editable, toast }) {
    const store = S();
    const meta = A().SCREEN(screen);
    const [d, setD] = useState(() => store.screenAccess(screen));
    const set = (patch) => setD((p) => Object.assign({}, p, patch));
    const guardar = () => { store.saveScreenAccess(screen, d); toast && toast('Acceso actualizado'); onClose(); };
    const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 12, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };

    return React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, zIndex: 78, background: 'rgba(16,12,14,.5)', display: 'flex', alignItems: 'flex-end' } },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), className: 'su-app-scroll', style: { width: '100%', maxHeight: '88%', overflowY: 'auto', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))' } },
        React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 } },
          React.createElement('div', { style: { width: 42, height: 42, borderRadius: 13, background: 'var(--grad-guinda-soft)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: 'var(--glow-guinda)' } },
            React.createElement(I, { name: meta.icon, size: 21, stroke: 2 })),
          React.createElement('div', { style: { minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 17, fontWeight: 900, letterSpacing: '-.01em' } }, meta.label),
            React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginTop: 1 } }, meta.nav === 'tab' ? 'Pestaña del menú inferior' : 'Pantalla interna'))),

        React.createElement('div', { style: { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 8 } }, '¿Quién puede entrar?'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 } },
          (A().SCREEN_MODES || []).map((m) => {
            const sel = d.mode === m.value;
            const tone = MODE_TONE[m.value] || MODE_TONE.public;
            return React.createElement('button', {
              key: m.value, onClick: () => (editable ? set({ mode: m.value }) : null), disabled: !editable,
              style: { display: 'flex', gap: 11, alignItems: 'flex-start', textAlign: 'left', width: '100%', border: sel ? '2px solid var(--guinda)' : '2px solid transparent', background: sel ? 'var(--guinda-50)' : 'var(--surface-2)', borderRadius: 15, padding: '12px 13px', cursor: editable ? 'pointer' : 'default', fontFamily: 'inherit', opacity: editable ? 1 : .65 },
            },
              React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: tone.bg, color: tone.fg, display: 'grid', placeItems: 'center', flexShrink: 0 } },
                React.createElement(I, { name: m.icon, size: 18, stroke: 2.1 })),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, m.label),
                React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 } }, m.desc)),
              React.createElement('div', { style: { width: 21, height: 21, borderRadius: '50%', flexShrink: 0, marginTop: 6, border: sel ? 'none' : '2px solid var(--hairline-strong)', background: sel ? 'var(--guinda)' : 'transparent', display: 'grid', placeItems: 'center', color: '#fff' } },
                sel && React.createElement(I, { name: 'check', size: 13, stroke: 3 })));
          })),

        d.mode === 'segment' && React.createElement('div', { style: { background: 'var(--surface-2)', borderRadius: 16, padding: '13px 14px 4px', marginBottom: 16 } },
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 11, lineHeight: 1.45 } }, 'Deja un grupo vacío para no filtrar por ese criterio.'),
          React.createElement(Chips, { label: 'Tipo de sindicato', options: A().SINDICATOS, values: d.sindicatos, editable, onChange: (v) => set({ sindicatos: v }) }),
          React.createElement(Chips, { label: 'Categoría de empleo', options: A().NIVELES, values: d.niveles, editable, onChange: (v) => set({ niveles: v }) }),
          React.createElement(Chips, { label: 'Cargo en la app', options: A().CARGOS, values: d.cargos, editable, onChange: (v) => set({ cargos: v }) })),

        meta.nav === 'tab' && d.mode !== 'public' && React.createElement('button', {
          onClick: () => (editable ? set({ hideTab: d.hideTab === false }) : null), disabled: !editable,
          style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: 'var(--surface-2)', border: 'none', borderRadius: 15, padding: '12px 13px', marginBottom: 14, cursor: editable ? 'pointer' : 'default', fontFamily: 'inherit' },
        },
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, 'Ocultar la pestaña del menú'),
            React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 } }, d.hideTab !== false ? 'Quien no tenga acceso no verá la pestaña' : 'La pestaña se ve, pero al entrar aparece el aviso')),
          React.createElement(window.Toggle, { on: d.hideTab !== false, size: 'md', })),

        d.mode !== 'public' && React.createElement('div', { style: { marginBottom: 16 } },
          React.createElement('label', { style: { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 6 } }, 'Mensaje al bloquear (opcional)'),
          React.createElement('textarea', { value: d.mensaje || '', rows: 2, disabled: !editable, placeholder: 'Ej. Esta sección es exclusiva para afiliados de SUTISSSTESON.', onChange: (e) => set({ mensaje: e.target.value }), style: Object.assign({}, inputBase, { resize: 'vertical', lineHeight: 1.5 }) })),

        editable && React.createElement('div', { style: { display: 'flex', gap: 10 } },
          React.createElement(window.Btn, { full: true, variant: 'outline', onClick: onClose }, 'Cancelar'),
          React.createElement(window.Btn, { full: true, variant: 'dark', icon: 'check', onClick: guardar }, 'Guardar acceso'))));
  }

  // ── Fila de pantalla ──
  function ScreenRow({ s, acc, viewer, editable, onOpen }) {
    const m = modeDef(acc.mode);
    const tone = MODE_TONE[acc.mode] || MODE_TONE.public;
    const bloqueada = window.adminStore && !window.adminStore.screenAllowed(s.id, viewer);
    const extra = acc.mode === 'segment'
      ? [(acc.sindicatos || []).length ? acc.sindicatos.length + ' sind.' : null, (acc.niveles || []).length ? acc.niveles.length + ' cat.' : null, (acc.cargos || []).length ? acc.cargos.length + ' cargos' : null].filter(Boolean).join(' · ')
      : '';
    return React.createElement('button', {
      onClick: onOpen,
      style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: 'var(--surface)', border: 'none', borderRadius: 14, padding: '11px 12px', marginBottom: 8, boxShadow: 'var(--neo-sm)', cursor: 'pointer', fontFamily: 'inherit' },
    },
      React.createElement('div', { style: { width: 38, height: 38, borderRadius: 11, background: tone.bg, color: tone.fg, display: 'grid', placeItems: 'center', flexShrink: 0 } },
        React.createElement(I, { name: s.icon, size: 19, stroke: 2 })),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.label),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 } },
          React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: tone.bg, color: tone.fg } },
            React.createElement(I, { name: m.icon, size: 12, stroke: 2.2 }), m.label),
          extra && React.createElement('span', { style: { fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--ink-3)' } }, extra),
          bloqueada && React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#FDEAEA', color: '#C0341D' } },
            React.createElement(I, { name: 'ban', size: 12, stroke: 2.2 }), 'Bloqueada en vista'))),
      React.createElement(I, { name: editable ? 'chevR' : 'eye', size: 18, stroke: 2.2, style: { color: 'var(--ink-3)', flexShrink: 0 } }));
  }

  // ── Previsualizar como… ──
  function ViewerCard({ store, viewer }) {
    const [open, setOpen] = useState(false);
    const seg = (label, value, options, key) => React.createElement('div', { style: { marginBottom: 11 } },
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 6 } }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
        options.map((o) => React.createElement('button', {
          key: o, onClick: () => store.setViewer({ [key]: o }),
          style: { border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, padding: '6px 11px', borderRadius: 999, background: value === o ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: value === o ? '#fff' : 'var(--ink-2)' },
        }, o))));
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', marginBottom: 16, overflow: 'hidden' } },
      React.createElement('button', { onClick: () => setOpen(!open), style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '13px 15px', cursor: 'pointer', fontFamily: 'inherit' } },
        React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', flexShrink: 0 } },
          React.createElement(I, { name: 'eye', size: 17, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, 'Previsualizar como'),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
            (viewer.registrado ? viewer.sindicato + ' · ' + viewer.nivel : 'Visitante no agremiado'))),
        React.createElement(I, { name: open ? 'chevD' : 'chevR', size: 18, stroke: 2.2, style: { color: 'var(--ink-3)' } })),
      open && React.createElement('div', { style: { padding: '4px 15px 14px', borderTop: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: () => store.setViewer({ registrado: !viewer.registrado }), style: { display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', border: 'none', borderRadius: 12, padding: '10px 12px', width: '100%', cursor: 'pointer', fontFamily: 'inherit', margin: '10px 0 12px' } },
          React.createElement(window.Toggle, { on: viewer.registrado, size: 'sm', glow: false, }),
          React.createElement('span', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' } }, viewer.registrado ? 'Agremiado con sesión iniciada' : 'Visitante sin afiliación')),
        viewer.registrado && seg('Tipo de sindicato', viewer.sindicato, A().SINDICATOS, 'sindicato'),
        viewer.registrado && seg('Categoría de empleo', viewer.nivel, A().NIVELES, 'nivel'),
        viewer.registrado && seg('Cargo', viewer.cargo, A().CARGOS, 'cargo')));
  }

  // ── Módulo ──
  function PantallasModule({ app, onBack, header }) {
    const store = S();
    const viewer = store.viewer();
    const [edit, setEdit] = useState(null);
    const editable = store.can('editar', 'pantallas');
    const screens = A().SCREENS;
    const groups = screens.reduce((a, s) => { (a[s.group] = a[s.group] || []).push(s); return a; }, {});
    const abiertas = screens.filter((s) => store.screenAccess(s.id).mode === 'public').length;

    return React.createElement('div', null,
      header({ title: 'Acceso a pantallas', sub: 'Bloqueo por sindicato, categoría y público', onBack }),
      React.createElement('div', { className: 'su-app-scroll su-stagger', style: { padding: 16, paddingBottom: 28 } },
        React.createElement('div', { style: { display: 'flex', gap: 9, background: 'var(--surface)', borderRadius: 15, padding: '12px 14px', marginBottom: 16, boxShadow: 'var(--neo-sm)' } },
          React.createElement(I, { name: 'info', size: 17, stroke: 2.2, style: { color: 'var(--guinda)', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5 } },
            abiertas + ' de ' + screens.length + ' pantallas están abiertas a público general. Las demás piden afiliación o cumplir con el sindicato y la categoría que definas.')),
        React.createElement(ViewerCard, { store, viewer }),
        Object.keys(groups).map((g) => React.createElement('div', { key: g },
          React.createElement('div', { style: { fontSize: 12, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '6px 0 10px' } }, g.toUpperCase()),
          groups[g].map((s) => React.createElement(ScreenRow, {
            key: s.id, s, acc: store.screenAccess(s.id), viewer, editable,
            onOpen: () => setEdit(s.id),
          })))),
        editable && React.createElement('button', {
          onClick: () => { store.resetScreenAccess(); app.toast('Todas las pantallas quedaron abiertas a público general'); },
          style: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px', borderRadius: 13, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginTop: 10 },
        }, React.createElement(I, { name: 'refresh', size: 16, stroke: 2.2 }), 'Restablecer todo a público')),
      edit && React.createElement(AccessSheet, { screen: edit, editable, toast: app.toast, onClose: () => setEdit(null) }));
  }

  Object.assign(window, { PantallasModule, ScreenLocked });
})();
