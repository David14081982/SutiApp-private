/* screens-admin-content.jsx — Gestor de contenido del frontend:
   secciones, contenedores, botones, menús, componentes, banners y formularios.
   Reordenamiento drag & drop, visibilidad on/off y reglas de segmentación.
   Exporta window.ContentModule. */
(function () {
  const { useState, useRef, useEffect } = React;
  const I = window.Icon;
  const A = () => window.ADMIN;
  const S = () => window.adminStore;
  function useStore() { const [, f] = useState(0); useEffect(() => S().subscribe(() => f((n) => n + 1)), []); return S(); }

  const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };

  function ContentModule({ app, onBack, header, resourceId, typeFilter, title }) {
    const store = useStore();
    resourceId = resourceId || 'secciones';
    const [screen, setScreen] = useState('home');
    const [editing, setEditing] = useState(null);
    const [vOpen, setVOpen] = useState(false);
    const viewer = store.viewer();
    const P = { crear: store.can('crear', resourceId), editar: store.can('editar', resourceId), eliminar: store.can('eliminar', resourceId), reordenar: store.can('reordenar', resourceId) };

    const tops = store.contentChildren(screen, null).filter((n) => !typeFilter || n.type === typeFilter);

    return React.createElement('div', null,
      header({ title: title || 'Secciones y componentes', sub: A().SCREEN(screen).label, onBack }),
      React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: '16px 16px 26px' } },
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 12 } },
          React.createElement('div', { style: { flex: 1, position: 'relative' } },
            React.createElement('select', { value: screen, onChange: (e) => setScreen(e.target.value), style: { width: '100%', appearance: 'none', WebkitAppearance: 'none', border: 'none', outline: 'none', background: 'var(--surface)', boxShadow: 'var(--neo-sm)', borderRadius: 14, padding: '13px 40px 13px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: 'var(--ink)', cursor: 'pointer' } },
              A().SCREENS.map((s) => React.createElement('option', { key: s.id, value: s.id }, s.label))),
            React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } })),
          P.crear && React.createElement('button', { onClick: () => setEditing(store.blankNode(screen, null, typeFilter || 'section')), style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 48, padding: '0 16px', borderRadius: 14, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--glow-guinda)', flexShrink: 0 } },
            React.createElement(I, { name: 'plus', size: 19, stroke: 2.6 }), 'Nuevo')),

        React.createElement(ViewerBarMini, { open: vOpen, setOpen: setVOpen, viewer, store }),

        screen === 'home' && !typeFilter && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, background: '#E7F6ED', color: '#13794A', borderRadius: 12, padding: '9px 13px', margin: '14px 0 4px', fontSize: 11.5, fontWeight: 700, lineHeight: 1.4 } },
          React.createElement(I, { name: 'checkCircle', size: 15, stroke: 2.2, style: { flexShrink: 0 } }), 'Los cambios en Inicio se reflejan en vivo en la app.'),

        React.createElement('div', { style: { marginTop: 14 } },
          tops.length === 0
            ? React.createElement(window.EmptyState, { icon: 'grid', title: 'Sin elementos', sub: 'Agrega el primero con “Nuevo”.' })
            : React.createElement(ContentDragList, {
              nodes: tops, canReorder: P.reordenar && !typeFilter,
              onReorder: (ids) => store.reorderContent(screen, null, ids),
              renderRow: (n, onGrab, dragging) => React.createElement(NodeBlock, { key: n.id, node: n, screen, store, viewer, P, depth: 0, onEdit: setEditing, allowChildren: !typeFilter, onGrab, dragging }),
            }))),

      editing && React.createElement(NodeEditor, { node: editing, store, P, onClose: () => setEditing(null) }));
  }

  // Bloque de nodo: fila + (si es sección/contenedor) lista anidada de hijos
  function NodeBlock({ node, screen, store, viewer, P, depth, onEdit, allowChildren, onGrab, dragging }) {
    const canNest = allowChildren && (node.type === 'section' || node.type === 'container');
    const kids = canNest ? store.contentChildren(screen, node.id) : [];
    return React.createElement('div', null,
      React.createElement(NodeRow, { node, store, viewer, P, depth, onEdit, onGrab, dragging }),
      canNest && React.createElement('div', { style: { paddingLeft: 20, marginTop: 8, borderLeft: '2px dashed var(--hairline-strong)', marginLeft: 14 } },
        kids.length > 0 && React.createElement(ContentDragList, {
          nodes: kids, canReorder: P.reordenar,
          onReorder: (ids) => store.reorderContent(screen, node.id, ids),
          renderRow: (k, onGrab, dragging) => React.createElement(NodeRow, { key: k.id, node: k, store, viewer, P, depth: 1, onEdit, onGrab, dragging }),
        }),
        P.crear && React.createElement('button', { onClick: () => onEdit(store.blankNode(screen, node.id, 'button')), style: { display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: kids.length ? 8 : 0, height: 34, padding: '0 12px', borderRadius: 10, border: '1.5px dashed var(--hairline-strong)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' } },
          React.createElement(I, { name: 'plus', size: 15, stroke: 2.4 }), 'Elemento en “' + node.label + '”')));
  }

  function NodeRow({ node, store, viewer, P, depth, onEdit, onGrab, dragging }) {
    const t = A().CTYPE(node.type);
    const hiddenManual = node.visible === false;
    const hiddenSeg = !hiddenManual && !store.nodeVisible(node, viewer);
    const aud = node.audience || { mode: 'all' };
    const audLabel = { all: 'Todos', registered: 'Registrados', segment: 'Segmentado' }[aud.mode] || 'Todos';
    const iconBtn = (icon, onClick, tone) => React.createElement('button', { onClick: (e) => { e.stopPropagation(); onClick(); }, style: { width: 34, height: 34, borderRadius: 10, border: 'none', background: 'var(--surface-2)', color: tone || 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 17, stroke: 2 }));

    return React.createElement('div', { style: { display: 'flex', alignItems: 'stretch', background: 'var(--surface)', borderRadius: 14, boxShadow: dragging ? 'var(--shadow-lg)' : 'var(--neo-sm)', overflow: 'hidden', opacity: hiddenManual ? .55 : 1, marginBottom: 8 } },
      onGrab
        ? React.createElement('div', { onPointerDown: onGrab, onTouchStart: onGrab, style: { display: 'grid', placeItems: 'center', width: 30, background: 'var(--surface-2)', color: 'var(--ink-3)', cursor: 'grab', touchAction: 'none', flexShrink: 0 } }, React.createElement(I, { name: 'grip', size: 17, stroke: 2 }))
        : React.createElement('div', { style: { width: 8, flexShrink: 0 } }),
      React.createElement('button', { onClick: () => (P.editar ? onEdit(node) : null), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '10px 10px', cursor: P.editar ? 'pointer' : 'default', fontFamily: 'inherit' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('div', { style: { width: 28, height: 28, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: t.icon, size: 15, stroke: 2 })),
          React.createElement('span', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 } }, node.label || 'Sin nombre')),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 } },
          chip(t.label, 'grid'),
          chip(audLabel, aud.mode === 'segment' ? 'filter' : aud.mode === 'registered' ? 'user' : 'globe'),
          hiddenManual && chip('Oculto', 'ban', true),
          hiddenSeg && chip('Oculto en vista', 'eye', true))),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' } },
        P.crear && iconBtn('copy', () => store.duplicateNode(node.id)),
        React.createElement(window.Toggle, { on: !hiddenManual, size: 'md', onClick: (e) => { e.stopPropagation(); if (P.editar) store.toggleNode(node.id); }, disabled: !P.editar, 'aria-label': 'Visible', })));
  }
  function chip(label, icon, warn) {
    return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: warn ? '#FDEAEA' : 'var(--surface-2)', color: warn ? '#C0341D' : 'var(--ink-3)' } },
      React.createElement(I, { name: icon, size: 12, stroke: 2.2 }), label);
  }

  // ── Lista genérica con reordenamiento por arrastre ──
  function ContentDragList({ nodes, canReorder, onReorder, renderRow }) {
    const ids = nodes.map((n) => n.id);
    const [order, setOrder] = useState(ids);
    const orderRef = useRef(ids);
    const rowRefs = useRef({});
    const [dragId, setDragId] = useState(null);
    useEffect(() => { const j = ids.join(','); if (j !== orderRef.current.join(',')) { orderRef.current = ids; setOrder(ids); } }, [ids.join(',')]);
    const setBoth = (o) => { orderRef.current = o; setOrder(o); };
    const byId = {}; nodes.forEach((n) => { byId[n.id] = n; });

    const begin = (e, id) => {
      e.preventDefault(); setDragId(id);
      const move = (ev) => {
        const y = ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;
        const cur = orderRef.current; const from = cur.indexOf(id); if (from < 0) return;
        let target = cur.length - 1;
        for (let i = 0; i < cur.length; i++) { const el = rowRefs.current[cur[i]]; if (!el) continue; const r = el.getBoundingClientRect(); if (y < r.top + r.height / 2) { target = i; break; } }
        if (target !== from) { const next = cur.filter((x) => x !== id); next.splice(target, 0, id); setBoth(next); }
      };
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up);
        setDragId(null); onReorder(orderRef.current);
      };
      window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up);
      window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up);
    };

    window.useFlipRows(rowRefs, dragId);
    return React.createElement('div', null,
      order.map((id) => {
        const n = byId[id]; if (!n) return null;
        const dragging = dragId === id;
        return React.createElement('div', { key: id, ref: (el) => { rowRefs.current[id] = el; }, style: { position: 'relative', zIndex: dragging ? 6 : 1, transform: dragging ? 'scale(1.015)' : 'none', transition: dragging ? 'none' : 'transform .15s' } },
          renderRow(Object.assign({}, n), canReorder ? (e) => begin(e, id) : null, dragging));
      }));
  }

  function ViewerBarMini({ open, setOpen, viewer, store }) {
    const seg = (label, value, options, key) => React.createElement('div', { style: { marginBottom: 12 } },
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 7 } }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } },
        options.map((o) => React.createElement('button', { key: o, onClick: () => store.setViewer({ [key]: o }), style: { height: 32, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: value === o ? 'var(--guinda)' : 'var(--surface-2)', color: value === o ? '#fff' : 'var(--ink-2)', boxShadow: value === o ? 'none' : 'var(--neo-inset)' } }, o))));
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden' } },
      React.createElement('button', { onClick: () => setOpen(!open), style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '13px 15px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
        React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'eye', size: 18, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, 'Previsualizar como'),
          React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, viewer.cargo + ' · ' + viewer.sindicato + ' · ' + viewer.nivel)),
        React.createElement(I, { name: open ? 'chevD' : 'chevR', size: 18, stroke: 2.2, style: { color: 'var(--ink-3)' } })),
      open && React.createElement('div', { style: { padding: '10px 15px 14px', borderTop: '1px solid var(--hairline)' } },
        seg('Cargo', viewer.cargo, A().CARGOS, 'cargo'),
        seg('Tipo de sindicato', viewer.sindicato, A().SINDICATOS, 'sindicato'),
        seg('Nivel', viewer.nivel, A().NIVELES, 'nivel'),
        React.createElement('button', { onClick: () => store.setViewer({ registrado: !viewer.registrado }), style: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: 'none', borderRadius: 11, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--neo-inset)' } },
          React.createElement(window.Toggle, { on: viewer.registrado, size: 'sm', glow: false, }),
          React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)' } }, viewer.registrado ? 'Con sesión iniciada' : 'Sin sesión'))));
  }

  // ── Editor de nodo ──
  function NodeEditor({ node, store, P, onClose }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(node)));
    const isNew = !store.getNode(node.id);
    const set = (patch) => setD((p) => ({ ...p, ...patch }));
    const setAud = (patch) => setD((p) => ({ ...p, audience: { ...p.audience, ...patch } }));
    const save = () => { store.saveNode(d); onClose(); };
    const del = () => { store.removeNode(d.id); onClose(); };
    const lbl = { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 7 };

    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 72, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement('button', { onClick: onClose, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16.5, fontWeight: 800 } }, isNew ? 'Nuevo elemento' : 'Editar elemento')),

      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        React.createElement('div', { style: { marginBottom: 16 } },
          React.createElement('label', { style: lbl }, 'Nombre del elemento'),
          React.createElement('input', { value: d.label, placeholder: 'Ej. Botón Préstamo', onChange: (e) => set({ label: e.target.value }), style: inputBase })),
        React.createElement('div', { style: { marginBottom: 16 } },
          React.createElement('label', { style: lbl }, 'Tipo de elemento'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('select', { value: d.type, onChange: (e) => set({ type: e.target.value }), style: { ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 40, cursor: 'pointer' } },
              A().CONTENT_TYPES.map((c) => React.createElement('option', { key: c.id, value: c.id }, c.label))),
            React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }))),

        React.createElement('button', { onClick: () => set({ visible: d.visible === false }), style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--surface)', border: 'none', boxShadow: 'var(--neo-sm)', borderRadius: 15, padding: '13px 15px', cursor: 'pointer', marginBottom: 18 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, d.visible === false ? 'Oculto' : 'Visible'),
            React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2 } }, d.visible === false ? 'No se muestra en la app' : 'Se muestra según las reglas')),
          React.createElement(window.Toggle, { on: d.visible !== false, size: 'xl', })),

        React.createElement(SectionTitle, { icon: 'users', label: 'Visibilidad dinámica' }),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, marginBottom: 12 } }, 'Define quién ve este elemento según su perfil.'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 } },
          A().AUDIENCE_MODES.map((m) => {
            const on = (d.audience.mode || 'all') === m.value;
            return React.createElement('button', { key: m.value, onClick: () => setAud({ mode: m.value }), style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: on ? 'var(--guinda-50)' : 'var(--surface)', border: on ? '1.5px solid var(--guinda)' : '1.5px solid transparent', boxShadow: on ? 'none' : 'var(--neo-sm)', borderRadius: 13, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' } },
              React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: on ? 'var(--guinda)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: m.icon, size: 18, stroke: 2 })),
              React.createElement('div', { style: { flex: 1 } },
                React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, m.label),
                React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, m.desc)),
              on && React.createElement(I, { name: 'checkCircle', size: 20, stroke: 2, style: { color: 'var(--guinda)' } }));
          })),
        d.audience.mode === 'segment' && React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '16px 15px 4px', boxShadow: 'var(--neo-sm)', marginBottom: 18 } },
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.4 } }, 'Deja un grupo vacío para no filtrar por ese criterio.'),
          Chips('Cargo en la aplicación', A().CARGOS, d.audience.cargos, (v) => setAud({ cargos: v })),
          Chips('Tipo de sindicato', A().SINDICATOS, d.audience.sindicatos, (v) => setAud({ sindicatos: v })),
          Chips('Nivel de usuario', A().NIVELES, d.audience.niveles, (v) => setAud({ niveles: v }))),

        !isNew && P.eliminar && React.createElement('button', { onClick: del, style: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 18px', borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', marginTop: 4 } },
          React.createElement(I, { name: 'trash', size: 18, stroke: 2 }), 'Eliminar elemento'),
        React.createElement('div', { style: { height: 18 } })),

      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
        React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, disabled: !d.label.trim(), onClick: save }, 'Guardar')));
  }

  function Chips(label, options, values, onChange) {
    const list = values || [];
    const toggle = (o) => onChange(list.indexOf(o) !== -1 ? list.filter((x) => x !== o) : [...list, o]);
    return React.createElement('div', { style: { marginBottom: 14 } },
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 7 } }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        options.map((o) => {
          const on = list.indexOf(o) !== -1;
          return React.createElement('button', { key: o, onClick: () => toggle(o), style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 13px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: on ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-2)', boxShadow: on ? 'var(--glow-guinda)' : 'var(--neo-inset)' } },
            on && React.createElement(I, { name: 'check', size: 14, stroke: 3 }), o);
        })));
  }
  function SectionTitle({ icon, label }) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 12px' } },
      React.createElement('div', { style: { width: 26, height: 26, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 16, stroke: 2 })),
      React.createElement('span', { style: { fontSize: 14.5, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.01em' } }, label),
      React.createElement('div', { style: { flex: 1, height: 1, background: 'var(--hairline)' } }));
  }

  window.ContentModule = ContentModule;
})();
