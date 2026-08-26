/* screens-admin-convenios.jsx — Segmentación de Convenios por Sindicato y
   Categoría de empleado. Reutiliza el motor único audienceMatch. Incluye
   gestión de catálogos dinámicos (sindicatos / categorías).
   Exporta window.ConveniosModule. */
(function () {
  const { useState, useRef, useEffect } = React;
  const I = window.Icon;
  const A = () => window.ADMIN;
  const S = () => window.adminStore;
  function useStore() { const [, f] = useState(0); useEffect(() => S().subscribe(() => f((n) => n + 1)), []); return S(); }
  const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };
  const HUES = [345, 36, 150, 210, 280, 24, 200];

  function ConveniosModule({ app, onBack, header }) {
    const store = useStore();
    const [tab, setTab] = useState('list');       // 'list' | 'anuncios' | 'catalogos'
    const [editing, setEditing] = useState(null);
    const [adEditing, setAdEditing] = useState(null);
    const viewer = store.viewer();
    const P = { crear: app.admin.has('agreements.create'), editar: app.admin.has('agreements.update'), eliminar: app.admin.has('agreements.delete'), publicar:app.admin.has('agreements.publish'),reordenar: app.admin.has('agreements.order'),baseCreate:app.admin.has('companies.create'),baseDelete:app.admin.has('companies.delete'),basePublish:app.admin.has('companies.publish'),baseOrder:app.admin.has('companies.order') };
    const items = store.conveniosAll();
    const ads = store.anunciosAll();

    const seg = (id, label) => (id==='anuncios'&&!app.admin.has('banners.read'))||(id==='catalogos'&&!app.admin.has('segmentation.read'))?null:React.createElement('button', { onClick: () => setTab(id), style: { flex: 1, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, background: tab === id ? 'var(--surface)' : 'transparent', color: tab === id ? 'var(--guinda)' : 'var(--ink-3)', boxShadow: tab === id ? 'var(--neo-sm)' : 'none' } }, label);

    return React.createElement('div', null,
      header({ title: 'Convenios y beneficios', sub: items.length + ' convenios · ' + items.filter((c) => c.visible !== false).length + ' visibles', onBack }),
      React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: '16px 16px 26px' } },
        React.createElement(window.SectionResponsibilityPanel,{sectionKey:'agreements',allowedActions:['read','create','update','delete','publish','order'],app}),
        React.createElement('div', { style: { display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 13, padding: 4, marginBottom: 16 } },
          seg('list', 'Convenios'), seg('anuncios', 'Anuncios'), seg('catalogos', 'Catálogos')),

        tab === 'catalogos'
          ? React.createElement(CatalogsManager, { store, P })
          : tab === 'anuncios'
          ? React.createElement('div', null,
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 } },
              React.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em' } }, 'CAMPAÑAS / ANUNCIOS'),
              P.crear && React.createElement('button', { onClick: () => setAdEditing(store.blankAnuncio()), style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 38, padding: '0 14px', borderRadius: 12, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--glow-guinda)' } },
                React.createElement(I, { name: 'plus', size: 17, stroke: 2.6 }), 'Nuevo')),
            ads.length === 0
              ? React.createElement(window.EmptyState, { icon: 'image', title: 'Sin anuncios', sub: 'Crea el primero con “Nuevo”.' })
              : React.createElement(CvDragList, {
                ids: ads.map((a) => a.id), canReorder: P.reordenar, store,
                onReorder: (ids) => store.reorderAnuncios(ids),
                renderRow: (id, onGrab, dragging) => React.createElement(AdRow, { key: id, a: store.getAnuncio(id), store, viewer, P, onGrab, dragging, onEdit: setAdEditing }),
              }),
            React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 7, background: '#E7F6ED', color: '#13794A', borderRadius: 12, padding: '10px 13px', marginTop: 18, fontSize: 11.5, fontWeight: 700, lineHeight: 1.45 } },
              React.createElement(I, { name: 'checkCircle', size: 15, stroke: 2.2, style: { flexShrink: 0, marginTop: 1 } }), 'El carrusel “Espacio publicitario” de Convenios muestra a cada usuario solo los anuncios de su perfil.'))
          : React.createElement('div', null,
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 } },
              React.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em' } }, 'CONVENIOS'),
              P.baseCreate && React.createElement('button', { onClick: () => setEditing(store.blankConvenio()), style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 38, padding: '0 14px', borderRadius: 12, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--glow-guinda)' } },
                React.createElement(I, { name: 'plus', size: 17, stroke: 2.6 }), 'Nuevo')),
            items.length > 1 && P.baseOrder && React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 } }, React.createElement(I, { name: 'grip', size: 13, stroke: 2 }), 'arrastra para reordenar'),
            items.length === 0
              ? React.createElement(window.EmptyState, { icon: 'tag', title: 'Sin convenios', sub: 'Crea el primero con “Nuevo”.' })
              : React.createElement(CvDragList, {
                ids: items.map((c) => c.id), canReorder: P.baseOrder, store,
                onReorder: (ids) => store.reorderConvenios(ids),
                renderRow: (id, onGrab, dragging) => React.createElement(CvRow, { key: id, c: store.getConvenio(id), store, viewer, P, onGrab, dragging, onEdit: setEditing }),
              }),
            React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 7, background: '#E7F6ED', color: '#13794A', borderRadius: 12, padding: '10px 13px', marginTop: 18, fontSize: 11.5, fontWeight: 700, lineHeight: 1.45 } },
              React.createElement(I, { name: 'checkCircle', size: 15, stroke: 2.2, style: { flexShrink: 0, marginTop: 1 } }), 'Cada usuario ve solo los convenios de su sindicato y categoría. Se refleja en vivo en la pestaña Convenios.'))),

      editing && React.createElement(CvEditor, { item: editing, store, P, onClose: () => setEditing(null) }),
      adEditing && React.createElement(AdEditor, { item: adEditing, store, P, onClose: () => setAdEditing(null) }));
  }

  // ── Catálogos dinámicos ──
  function CatalogsManager({ store, P }) {
    const cats = store.catalogs();
    return React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 14 } }, 'Administra los catálogos que alimentan la segmentación en toda la app. Agregar, renombrar o eliminar aquí actualiza los filtros de convenios, pop-ups, noticias y contenido.'),
      React.createElement(CatalogList, { title: 'Sindicatos', kind: 'sindicatos', items: cats.sindicatos, store, P, icon: 'shield' }),
      React.createElement('div', { style: { height: 18 } }),
      React.createElement(CatalogList, { title: 'Categorías de empleado', kind: 'categorias', items: cats.categorias, store, P, icon: 'users' }));
  }
  function CatalogList({ title, kind, items, store, P, icon }) {
    const [val, setVal] = useState('');
    const [clave, setClave] = useState('');
    const [edit, setEdit] = useState(null);
    const [editVal, setEditVal] = useState('');
    const [editClave, setEditClave] = useState('');
    const add = () => { if (val.trim()) { store.addCatalog(kind, val, clave); setVal(''); setClave(''); } };
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', padding: 15 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 } },
        React.createElement('div', { style: { width: 30, height: 30, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: icon, size: 17, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 14.5, fontWeight: 900, color: 'var(--ink)' } }, title),
        React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999, marginLeft: 'auto' } }, items.length)),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: items.length ? 12 : 0 } },
        items.map((it) => edit === it
          ? React.createElement('div', { key: it, style: { display: 'flex', gap: 8 } },
            React.createElement('input', { value: editVal, autoFocus: true, onChange: (e) => setEditVal(e.target.value), style: { ...inputBase, flex: 1, padding: '10px 12px' } }),
            React.createElement('input', { value: editClave, placeholder: 'Clave', onChange: (e) => setEditClave(e.target.value), style: { ...inputBase, width: 74, flexShrink: 0, padding: '10px 12px', textAlign: 'center' } }),
            React.createElement('button', { onClick: () => { store.renameCatalog(kind, it, editVal); store.setCatalogClave(kind, editVal.trim() || it, editClave); setEdit(null); }, style: { width: 40, borderRadius: 11, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: 'check', size: 18, stroke: 2.5 })))
          : React.createElement('div', { key: it, style: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 11, padding: '9px 12px' } },
            React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, it),
            store.catalogClave(kind, it) && React.createElement('span', { style: { fontSize: 10.5, fontWeight: 800, color: 'var(--guinda)', background: 'var(--guinda-50)', padding: '3px 8px', borderRadius: 999, fontFamily: 'var(--mono)', flexShrink: 0 } }, 'Clave ' + store.catalogClave(kind, it)),
            P.editar && React.createElement('button', { onClick: () => { setEdit(it); setEditVal(it); setEditClave(store.catalogClave(kind, it)); }, style: { width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--ink-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: 'settings', size: 15, stroke: 2 })),
            P.eliminar && React.createElement('button', { onClick: () => store.removeCatalog(kind, it), style: { width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--surface)', color: '#C0341D', cursor: 'pointer', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: 'trash', size: 15, stroke: 2 }))))),
      P.crear && React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('input', { value: val, placeholder: 'Agregar a ' + title.toLowerCase() + '…', onChange: (e) => setVal(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') add(); }, style: { ...inputBase, flex: 1, padding: '11px 13px' } }),
        React.createElement('input', { value: clave, placeholder: 'Clave', onChange: (e) => setClave(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') add(); }, style: { ...inputBase, width: 74, flexShrink: 0, padding: '11px 10px', textAlign: 'center' } }),
        React.createElement('button', { onClick: add, style: { width: 46, borderRadius: 12, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--glow-guinda)' } }, React.createElement(I, { name: 'plus', size: 20, stroke: 2.6 }))));
  }

  // ── Fila de convenio ──
  function CvRow({ c, store, viewer, P, onGrab, dragging, onEdit }) {
    if (!c) return null;
    const aud = c.audience || { mode: 'all' };
    const segTxt = aud.mode === 'segment'
      ? [(aud.sindicatos || []).length ? (aud.sindicatos.length + ' sind.') : null, (aud.niveles || []).length ? (aud.niveles.length + ' cat.') : null].filter(Boolean).join(' · ') || 'Segmentado'
      : { all: 'Todos', registered: 'Registrados' }[aud.mode];
    const hiddenSeg = c.visible !== false && !store.convenioVisibleFor(c, viewer);
    const iconBtn = (icon, onClick, tone) => React.createElement('button', { onClick: (e) => { e.stopPropagation(); onClick(); }, style: { width: 34, height: 34, borderRadius: 10, border: 'none', background: 'var(--surface-2)', color: tone || 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 17, stroke: 2 }));
    return React.createElement('div', { style: { display: 'flex', alignItems: 'stretch', background: 'var(--surface)', borderRadius: 14, boxShadow: dragging ? 'var(--shadow-lg)' : 'var(--neo-sm)', overflow: 'hidden', opacity: c.visible === false ? .55 : 1, marginBottom: 8 } },
      onGrab
        ? React.createElement('div', { onPointerDown: onGrab, onTouchStart: onGrab, style: { display: 'grid', placeItems: 'center', width: 30, background: 'var(--surface-2)', color: 'var(--ink-3)', cursor: 'grab', touchAction: 'none', flexShrink: 0 } }, React.createElement(I, { name: 'grip', size: 17, stroke: 2 }))
        : React.createElement('div', { style: { width: 8, flexShrink: 0 } }),
      React.createElement('div', { style: { width: 44, alignSelf: 'stretch', background: `linear-gradient(150deg, hsl(${c.hue || 210},55%,46%), hsl(${c.hue || 210},60%,30%))`, position: 'relative', flexShrink: 0, overflow: 'hidden' } },
        React.createElement('image-slot', { id: c.slotId, shape: 'rect', fit: 'cover', placeholder: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })),
      React.createElement('button', { onClick: () => (P.editar ? onEdit(c) : null), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '10px 11px', cursor: P.editar ? 'pointer' : 'default', fontFamily: 'inherit' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 } }, c.name || 'Sin nombre'),
          React.createElement('span', { style: { fontSize: 10.5, fontWeight: 800, color: '#C0341D', background: '#FDEAEA', padding: '2px 7px', borderRadius: 6, flexShrink: 0 } }, (c.disc || 0) + '%')),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 } },
          chip(c.cat || '—', 'tag'),
          chip(segTxt, aud.mode === 'segment' ? 'filter' : aud.mode === 'registered' ? 'user' : 'globe'),
          c.visible === false && chip('Oculto', 'ban', true),
          hiddenSeg && chip('Oculto en vista', 'eye', true))),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' } },
        P.baseCreate && iconBtn('copy', () => store.duplicateConvenio(c.id)),
        React.createElement(window.Toggle, { on: c.visible !== false, size: 'md', onClick: (e) => { e.stopPropagation(); if (P.basePublish) store.toggleConvenio(c.id); }, disabled: !P.basePublish, 'aria-label': 'Visible', })));
  }
  function chip(label, icon, warn) {
    return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: warn ? '#FDEAEA' : 'var(--surface-2)', color: warn ? '#C0341D' : 'var(--ink-3)' } },
      React.createElement(I, { name: icon, size: 12, stroke: 2.2 }), label);
  }

  function CvDragList({ ids, canReorder, store, onReorder, renderRow }) {
    const [order, setOrder] = useState(ids);
    const orderRef = useRef(ids);
    const rowRefs = useRef({});
    const [dragId, setDragId] = useState(null);
    useEffect(() => { const j = ids.join(','); if (j !== orderRef.current.join(',')) { orderRef.current = ids; setOrder(ids); } }, [ids.join(',')]);
    const setBoth = (o) => { orderRef.current = o; setOrder(o); };
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
        const dragging = dragId === id;
        return React.createElement('div', { key: id, ref: (el) => { rowRefs.current[id] = el; }, style: { position: 'relative', zIndex: dragging ? 6 : 1, transform: dragging ? 'scale(1.015)' : 'none', transition: dragging ? 'none' : 'transform .15s' } },
          renderRow(id, canReorder ? (e) => begin(e, id) : null, dragging));
      }));
  }

  // ── Editor de convenio ──
  function CvEditor({ item, store, P, onClose }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(item)));
    const isNew = !store.getConvenio(item.id);
    const set = (patch) => setD((p) => ({ ...p, ...patch }));
    const setAud = (patch) => setD((p) => ({ ...p, audience: { ...p.audience, ...patch } }));
    const save = () => { store.saveConvenio(d); onClose(); };
    const del = () => { store.removeConvenio(d.id); onClose(); };
    const lbl = { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 7 };
    const cats = (window.catalogStore && window.catalogStore.categories ? window.catalogStore.categories() : []);

    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 72, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement('button', { onClick: onClose, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16.5, fontWeight: 800 } }, isNew ? 'Nuevo convenio' : 'Editar convenio')),

      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Empresa / convenio'), React.createElement('input', { value: d.name, placeholder: 'Ej. Farmacias del Ahorro', onChange: (e) => set({ name: e.target.value }), style: inputBase })),
        React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 16 } },
          React.createElement('div', { style: { flex: 1 } }, React.createElement('label', { style: lbl }, 'Categoría'),
            React.createElement('div', { style: { position: 'relative' } },
              React.createElement('select', { value: d.cat, onChange: (e) => set({ cat: e.target.value }), style: { ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 36, cursor: 'pointer' } },
                cats.map((c) => React.createElement('option', { key: c.id, value: c.label }, c.label))),
              React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }))),
          React.createElement('div', { style: { width: 100 } }, React.createElement('label', { style: lbl }, '% Desc.'), React.createElement('input', { type: 'number', min: 0, max: 100, value: d.disc, onChange: (e) => set({ disc: parseInt(e.target.value || '0', 10) }), style: inputBase }))),
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Dirección / cobertura'), React.createElement('input', { value: d.addr, placeholder: 'Ej. 120 sucursales en Sonora', onChange: (e) => set({ addr: e.target.value }), style: inputBase })),
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Etiquetas (separadas por coma)'), React.createElement('input', { value: (d.tags || []).join(', '), placeholder: 'Medicamento, Consulta', onChange: (e) => set({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }), style: inputBase })),
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Imagen'),
          React.createElement('div', { style: { borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--neo-sm)', height: 110, position: 'relative', background: `linear-gradient(150deg, hsl(${d.hue},60%,46%), hsl(${d.hue},62%,30%))` } },
            React.createElement('image-slot', { id: d.slotId, shape: 'rect', fit: 'cover', placeholder: 'Arrastra una imagen', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } }))),
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Color de acento'),
          React.createElement('div', { style: { display: 'flex', gap: 9, flexWrap: 'wrap' } },
            HUES.map((h) => React.createElement('button', { key: h, onClick: () => set({ hue: h }), style: { width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', background: `hsl(${h},68%,45%)`, border: d.hue === h ? '3px solid var(--ink)' : '3px solid transparent', boxShadow: 'var(--neo-sm)' } })))),
        React.createElement('button', { onClick: () => set({ featured: !d.featured }), style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--surface)', border: 'none', boxShadow: 'var(--neo-sm)', borderRadius: 15, padding: '12px 15px', cursor: 'pointer', marginBottom: 12 } },
          React.createElement('div', { style: { flex: 1, fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, 'Destacado'),
          toggleDot(d.featured)),
        React.createElement('button', { onClick: () => set({ visible: d.visible === false }), style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--surface)', border: 'none', boxShadow: 'var(--neo-sm)', borderRadius: 15, padding: '12px 15px', cursor: 'pointer', marginBottom: 18 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, d.visible === false ? 'Oculto' : 'Visible'),
            React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, 'En la pestaña Convenios')),
          toggleDot(d.visible !== false)),

        React.createElement(SectionTitle, { icon: 'filter', label: 'Segmentación (Sindicato + Categoría)' }),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 } },
          A().AUDIENCE_MODES.map((m) => {
            const on = (d.audience.mode || 'all') === m.value;
            return React.createElement('button', { key: m.value, onClick: () => setAud({ mode: m.value }), style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: on ? 'var(--guinda-50)' : 'var(--surface)', border: on ? '1.5px solid var(--guinda)' : '1.5px solid transparent', boxShadow: on ? 'none' : 'var(--neo-sm)', borderRadius: 13, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' } },
              React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: on ? 'var(--guinda)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: m.icon, size: 18, stroke: 2 })),
              React.createElement('div', { style: { flex: 1 } },
                React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, m.label),
                React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, m.value === 'segment' ? 'Por sindicato y/o categoría' : m.desc)),
              on && React.createElement(I, { name: 'checkCircle', size: 20, stroke: 2, style: { color: 'var(--guinda)' } }));
          })),
        d.audience.mode === 'segment' && React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '16px 15px 4px', boxShadow: 'var(--neo-sm)', marginBottom: 18 } },
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.4 } }, 'Deja un grupo vacío para no filtrar por ese criterio. Se combinan (Sindicato Y Categoría Y Cargo).'),
          Chips('Sindicato', A().SINDICATOS, d.audience.sindicatos, (v) => setAud({ sindicatos: v })),
          Chips('Categoría de empleado', A().NIVELES, d.audience.niveles, (v) => setAud({ niveles: v })),
          Chips('Cargo en la aplicación', A().CARGOS, d.audience.cargos, (v) => setAud({ cargos: v }))),

        React.createElement(SectionTitle, { icon: 'gift', label: 'Beneficios / planes' }),
        React.createElement(BeneficiosBlock, { list: d.beneficios || [], convId: d.id, store, onChange: (v) => set({ beneficios: v }) }),

        !isNew && P.baseDelete && React.createElement('button', { onClick: del, style: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 18px', borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', marginTop: 4 } },
          React.createElement(I, { name: 'trash', size: 18, stroke: 2 }), 'Eliminar convenio'),
        React.createElement('div', { style: { height: 18 } })),

      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
        React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, disabled: !d.name.trim(), onClick: save }, 'Guardar convenio')));
  }
  function toggleDot(on) {
    return React.createElement(window.Toggle, { on: on, size: 'xl', });
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

  // ── Módulo propio del panel: Catálogos de segmentación (global) ──
  function CatalogosModule({ app, onBack, header }) {
    const store = useStore();
    const can = (a) => store.can(a, 'catalogos') || store.can(a, 'convenios');
    const P = { crear: can('crear'), editar: can('editar'), eliminar: can('eliminar') };
    return React.createElement('div', null,
      header({ title: 'Catálogos de segmentación', sub: 'Sindicatos y categorías de empleado', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll su-stagger', style: { padding: '16px 16px 26px' } },
        React.createElement(CatalogsManager, { store, P })));
  }

  window.ConveniosModule = ConveniosModule;
  window.CatalogosModule = CatalogosModule;

  // Beneficios/planes segmentables dentro de un convenio
  function BeneficiosBlock({ list, convId, store, onChange }) {
    const [exp, setExp] = useState(null);
    const upd = (i, patch) => onChange(list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    const updAud = (i, patch) => onChange(list.map((b, j) => (j === i ? { ...b, audience: { ...b.audience, ...patch } } : b)));
    const add = () => onChange([...list, store.blankBeneficio(convId)]);
    const remove = (i) => onChange(list.filter((_, j) => j !== i));
    return React.createElement('div', { style: { marginBottom: 18 } },
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, marginBottom: 12 } }, 'Cada beneficio se filtra con el mismo motor: define a quién se muestra dentro del detalle del convenio.'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        list.map((b, i) => React.createElement('div', { key: b.id, style: { background: 'var(--surface)', borderRadius: 14, boxShadow: 'var(--neo-sm)', padding: 13 } },
          React.createElement('input', { value: b.label, placeholder: 'Nombre del beneficio', onChange: (e) => upd(i, { label: e.target.value }), style: { ...inputBase, marginBottom: 8, padding: '10px 12px' } }),
          React.createElement('input', { value: b.desc, placeholder: 'Descripción corta', onChange: (e) => upd(i, { desc: e.target.value }), style: { ...inputBase, marginBottom: 10, padding: '10px 12px', fontSize: 13.5 } }),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('button', { onClick: () => setExp(exp === i ? null : i), style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 11px', borderRadius: 9, border: 'none', background: (b.audience && b.audience.mode !== 'all') ? 'var(--guinda-50)' : 'var(--surface-2)', color: (b.audience && b.audience.mode !== 'all') ? 'var(--guinda)' : 'var(--ink-2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' } },
              React.createElement(I, { name: 'filter', size: 14, stroke: 2 }), (b.audience && b.audience.mode === 'segment') ? 'Segmentado' : (b.audience && b.audience.mode === 'registered') ? 'Registrados' : 'Todos'),
            React.createElement('div', { style: { flex: 1 } }),
            React.createElement(window.Toggle, { on: b.visible !== false, size: 'sm', onClick: () => upd(i, { visible: b.visible === false }), 'aria-label': 'Visible', glow: false, }),
            React.createElement('button', { onClick: () => remove(i), style: { width: 32, height: 32, borderRadius: 9, border: 'none', background: 'var(--surface-2)', color: '#C0341D', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'trash', size: 16, stroke: 2 }))),
          exp === i && React.createElement('div', { style: { marginTop: 12, borderTop: '1px solid var(--hairline)', paddingTop: 12 } },
            React.createElement(AudiencePicker, { d: b, setAud: (patch) => updAud(i, patch) })))),
        React.createElement('button', { onClick: add, style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 15px', borderRadius: 12, border: '1.5px dashed var(--hairline-strong)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' } },
          React.createElement(I, { name: 'plus', size: 17, stroke: 2.4 }), 'Agregar beneficio')));
  }

  // ── Fila y editor de Anuncio ──
  function AdRow({ a, store, viewer, P, onGrab, dragging, onEdit }) {
    if (!a) return null;
    const aud = a.audience || { mode: 'all' };
    const audLabel = { all: 'Todos', registered: 'Registrados', segment: 'Segmentado' }[aud.mode] || 'Todos';
    const hiddenSeg = a.visible !== false && !store.anuncioVisibleFor(a, viewer);
    const iconBtn = (icon, onClick, tone) => React.createElement('button', { onClick: (e) => { e.stopPropagation(); onClick(); }, style: { width: 34, height: 34, borderRadius: 10, border: 'none', background: 'var(--surface-2)', color: tone || 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 17, stroke: 2 }));
    return React.createElement('div', { style: { display: 'flex', alignItems: 'stretch', background: 'var(--surface)', borderRadius: 14, boxShadow: dragging ? 'var(--shadow-lg)' : 'var(--neo-sm)', overflow: 'hidden', opacity: a.visible === false ? .55 : 1, marginBottom: 8 } },
      onGrab
        ? React.createElement('div', { onPointerDown: onGrab, onTouchStart: onGrab, style: { display: 'grid', placeItems: 'center', width: 30, background: 'var(--surface-2)', color: 'var(--ink-3)', cursor: 'grab', touchAction: 'none', flexShrink: 0 } }, React.createElement(I, { name: 'grip', size: 17, stroke: 2 }))
        : React.createElement('div', { style: { width: 8, flexShrink: 0 } }),
      React.createElement('div', { style: { width: 44, alignSelf: 'stretch', background: `linear-gradient(150deg, hsl(${a.hue || 215},55%,46%), hsl(${a.hue || 215},60%,30%))`, position: 'relative', flexShrink: 0, overflow: 'hidden' } },
        React.createElement('image-slot', { id: a.slotId, shape: 'rect', fit: 'cover', placeholder: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })),
      React.createElement('button', { onClick: () => (P.editar ? onEdit(a) : null), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '10px 11px', cursor: P.editar ? 'pointer' : 'default', fontFamily: 'inherit' } },
        React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, a.empresa || 'Sin nombre'),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, a.etiqueta || ''),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 } },
          chip(audLabel, aud.mode === 'segment' ? 'filter' : aud.mode === 'registered' ? 'user' : 'globe'),
          a.visible === false && chip('Oculto', 'ban', true),
          hiddenSeg && chip('Oculto en vista', 'eye', true))),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' } },
        P.crear && iconBtn('copy', () => store.duplicateAnuncio(a.id)),
        React.createElement(window.Toggle, { on: a.visible !== false, size: 'md', onClick: (e) => { e.stopPropagation(); if (P.editar) store.toggleAnuncio(a.id); }, disabled: !P.editar, 'aria-label': 'Visible', })));
  }

  function AdEditor({ item, store, P, onClose }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(item)));
    const isNew = !store.getAnuncio(item.id);
    const set = (patch) => setD((p) => ({ ...p, ...patch }));
    const setAud = (patch) => setD((p) => ({ ...p, audience: { ...p.audience, ...patch } }));
    const lbl = { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 7 };
    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 72, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement('button', { onClick: onClose, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16.5, fontWeight: 800 } }, isNew ? 'Nuevo anuncio' : 'Editar anuncio')),
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Empresa'), React.createElement('input', { value: d.empresa, placeholder: 'Ej. Coppel', onChange: (e) => set({ empresa: e.target.value }), style: inputBase })),
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Etiqueta / mensaje'), React.createElement('input', { value: d.etiqueta, placeholder: 'Ej. Hasta 18 meses sin intereses', onChange: (e) => set({ etiqueta: e.target.value }), style: inputBase })),
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Enlace (URL)'), React.createElement('input', { value: d.link, placeholder: 'https://…', onChange: (e) => set({ link: e.target.value }), style: inputBase })),
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Imagen'),
          React.createElement('div', { style: { borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--neo-sm)', height: 120, position: 'relative', background: `linear-gradient(140deg, hsl(${d.hue} 55% 46%), hsl(${d.hue} 60% 28%))` } },
            React.createElement('image-slot', { id: d.slotId, shape: 'rect', fit: 'cover', placeholder: 'Arrastra una imagen', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } }))),
        React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: lbl }, 'Color de acento'),
          React.createElement('div', { style: { display: 'flex', gap: 9, flexWrap: 'wrap' } },
            HUES.map((h) => React.createElement('button', { key: h, onClick: () => set({ hue: h }), style: { width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', background: `hsl(${h},68%,45%)`, border: d.hue === h ? '3px solid var(--ink)' : '3px solid transparent', boxShadow: 'var(--neo-sm)' } })))),
        React.createElement('button', { onClick: () => set({ visible: d.visible === false }), style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--surface)', border: 'none', boxShadow: 'var(--neo-sm)', borderRadius: 15, padding: '12px 15px', cursor: 'pointer', marginBottom: 18 } },
          React.createElement('div', { style: { flex: 1, fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, d.visible === false ? 'Oculto' : 'Visible'), toggleDot(d.visible !== false)),
        React.createElement(SectionTitle, { icon: 'filter', label: 'Segmentaci\u00f3n' }),
        React.createElement(AudiencePicker, { d, setAud })),
      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)', flexShrink: 0 } },
        !isNew && P.eliminar && React.createElement('button', { onClick: () => { store.removeAnuncio(d.id); onClose(); }, style: { width: 50, height: 50, borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(I, { name: 'trash', size: 20, stroke: 2 })),
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
        React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, disabled: !d.empresa.trim(), onClick: () => { store.saveAnuncio(d); onClose(); } }, 'Guardar')));
  }

  // Selector de audiencia reutilizable (modos + chips segmentación)
  function AudiencePicker({ d, setAud }) {
    return React.createElement('div', null,
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 } },
        A().AUDIENCE_MODES.map((m) => {
          const on = (d.audience.mode || 'all') === m.value;
          return React.createElement('button', { key: m.value, onClick: () => setAud({ mode: m.value }), style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: on ? 'var(--guinda-50)' : 'var(--surface)', border: on ? '1.5px solid var(--guinda)' : '1.5px solid transparent', boxShadow: on ? 'none' : 'var(--neo-sm)', borderRadius: 13, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' } },
            React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: on ? 'var(--guinda)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: m.icon, size: 18, stroke: 2 })),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, m.label),
              React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, m.value === 'segment' ? 'Por sindicato y/o categor\u00eda' : m.desc)),
            on && React.createElement(I, { name: 'checkCircle', size: 20, stroke: 2, style: { color: 'var(--guinda)' } }));
        })),
      d.audience.mode === 'segment' && React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '16px 15px 4px', boxShadow: 'var(--neo-sm)', marginBottom: 18 } },
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.4 } }, 'Deja un grupo vac\u00edo para no filtrar por ese criterio.'),
        Chips('Sindicato', A().SINDICATOS, d.audience.sindicatos, (v) => setAud({ sindicatos: v })),
        Chips('Categor\u00eda de empleado', A().NIVELES, d.audience.niveles, (v) => setAud({ niveles: v })),
        Chips('Cargo en la aplicaci\u00f3n', A().CARGOS, d.audience.cargos, (v) => setAud({ cargos: v }))));
  }
})();
