/* screens-admin-sindicato.jsx — Módulo del panel: gestión del contenido local
   de las pantallas no migradas de "Tu Sindicato". Editar textos, subir/reemplazar/eliminar
   imágenes y documentos, agregar enlaces (URL) y segmentar por sindicato y
   categoría de empleado. Exporta window.SindicatoModule. */
(function () {
  const { useState, useRef, useEffect } = React;
  const I = window.Icon;
  const A = () => window.ADMIN;
  const S = () => window.sindicatoStore;

  function useStore() {
    const [, force] = useState(0);
    useEffect(() => S().subscribe(() => force((n) => n + 1)), []);
    return S();
  }

  const lbl = { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 7 };
  const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };

  // ─────────────────────────────────────────────────────────────
  // Raíz del módulo: lista de pantallas locales no migradas → detalle
  // ─────────────────────────────────────────────────────────────
  function SindicatoModule({ app, onBack, header, onOpenEditor }) {
    const store = useStore();
    const [openId, setOpenId] = useState(null);
    const P = permset();

    if (openId) return React.createElement(ModuleDetail, { app, id: openId, onBack: () => setOpenId(null), header, perms: P });

    const mods = window.UNION_SCREEN_REGISTRY;
    const v = store.viewer();
    return React.createElement('div', null,
      header({ title: 'Tu Sindicato', sub: mods.length + ' pantallas administrables', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll su-stagger', style: { padding: 16 } },
        React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 14 } },
          'Dashboard canónico de las nueve experiencias de ',
          React.createElement('b', { style: { color: 'var(--ink-2)' } }, '“Tu Sindicato”'), '. Cada tarjeta abre directamente su editor autoritativo.'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
          mods.map((m) => {
            const local = m.admin_editor.view === 'union';
            const total = local ? store.blocks(m.screen_key).length : null;
            const vis = local ? store.visibleCount(m.screen_key, v) : null;
            const allowed = app.admin.has(m.section_permission);
            return React.createElement('button', {
              key: m.screen_key, 'data-union-admin-card':m.screen_key, 'data-union-authority':m.authority_resource,
              onClick: () => { if (!allowed) return app.toast('Tu cuenta no tiene acceso a este editor'); if (local) setOpenId(m.screen_key); else onOpenEditor(m.admin_editor.view, m.admin_editor); },
              style: { display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', background: 'var(--surface)', border: 'none', borderRadius: 16, padding: '13px 14px', boxShadow: 'var(--neo-sm)', cursor: allowed?'pointer':'default', opacity:allowed?1:.55, fontFamily: 'inherit' },
            },
              React.createElement('div', { style: { width: 46, height: 46, borderRadius: 13, background: 'var(--grad-guinda-soft)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: 'var(--glow-guinda)', flexShrink: 0 } }, React.createElement(I, { name: m.icon, size: 23, stroke: 2 })),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 15, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, m.title),
                React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' } },
                  local ? React.createElement('span', null, total + ' bloque' + (total === 1 ? '' : 's') + ' · ' + vis + ' visible' + (vis === 1 ? '' : 's')) : React.createElement('span', null, m.authority_resource))),
              React.createElement(I, { name: allowed?'chevR':'lock', size: 20, stroke: 2.2, style: { color: 'var(--ink-3)', flexShrink: 0 } }));
          }))));
  }

  function permset() {
    const store = window.adminStore;
    const can = (a) => (store && store.can ? store.can(a, 'sindicato') : true);
    return { crear: can('crear'), editar: can('editar'), eliminar: can('eliminar'), reordenar: can('reordenar') };
  }

  // ─────────────────────────────────────────────────────────────
  // Detalle de una pantalla: encabezado + bloques + segmentación
  // ─────────────────────────────────────────────────────────────
  function ModuleDetail({ app, id, onBack, header, perms }) {
    const store = useStore();
    const [editing, setEditing] = useState(null);    // bloque en edición
    const [addOpen, setAddOpen] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const mod = store.modules().find((m) => m.id === id) || { label: id, icon: 'grid' };
    const hdr = store.header(id);
    const v = store.viewer();
    const blocks = store.blocks(id);

    return React.createElement('div', null,
      header({ title: mod.label, sub: 'Contenido de la pantalla', onBack }),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },

        // Encabezado de la pantalla
        React.createElement(SectionTitle, { icon: 'grid', label: 'Encabezado de la pantalla' }),
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: 15, boxShadow: 'var(--neo-sm)', marginBottom: 20 } },
          React.createElement(ManagedAssetField, { label: 'Imagen de cabecera (opcional)', url: hdr.imageUrl, accept: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml', bucket: 'app-assets', assetType: 'UNION_HEADER_IMAGE', purpose: 'sindicato.header', disabled: !perms.editar, onUploaded: (asset) => store.saveHeader(id, { assetId: asset.id }), onRemove: () => store.saveHeader(id, { assetId: null }) }),
          React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 14 } }, 'Se muestra en la cabecera de esta pantalla. Si no subes ninguna, se usa el color institucional.'),
          React.createElement('label', { style: lbl }, 'Título'),
          React.createElement('input', { value: hdr.titulo || '', disabled: !perms.editar, placeholder: 'Título de la pantalla', onChange: (e) => store.saveHeader(id, { titulo: e.target.value }), style: Object.assign({}, inputBase, { marginBottom: 12 }) }),
          React.createElement('label', { style: lbl }, 'Descripción'),
          React.createElement('input', { value: hdr.desc || '', disabled: !perms.editar, placeholder: 'Descripción corta', onChange: (e) => store.saveHeader(id, { desc: e.target.value }), style: inputBase })),

        // Previsualizar como (segmentación)
        React.createElement(ViewerBar, { open: viewerOpen, setOpen: setViewerOpen, viewer: v }),

        // Bloques de contenido
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 12px' } },
          React.createElement('div', { style: { width: 26, height: 26, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: 'menu', size: 16, stroke: 2 })),
          React.createElement('span', { style: { fontSize: 14.5, fontWeight: 900, color: 'var(--ink)' } }, 'Bloques de contenido'),
          React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999 } }, blocks.length),
          blocks.length > 1 && perms.reordenar && React.createElement('span', { style: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' } }, React.createElement(I, { name: 'grip', size: 13, stroke: 2 }), 'arrastra')),

        blocks.length === 0
          ? React.createElement(window.EmptyState, { icon: 'doc', title: 'Sin contenido', sub: 'Agrega el primer bloque.' })
          : React.createElement(DragList, { id, ids: blocks.map((b) => b.id), store, viewer: v, perms, onEdit: (b) => setEditing(b) }),

        perms.crear && React.createElement('button', {
          onClick: () => setAddOpen(true),
          style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 14, height: 50, borderRadius: 14, border: '1.5px dashed var(--hairline-strong)', background: 'var(--surface)', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' },
        }, React.createElement(I, { name: 'plus', size: 20, stroke: 2.6 }), 'Agregar bloque'),

        React.createElement('button', {
          onClick: () => { if (window.confirm('¿Restaurar el contenido original de esta pantalla?')) store.resetModule(id); },
          style: { display: 'flex', alignItems: 'center', gap: 7, margin: '18px auto 0', background: 'none', border: 'none', color: 'var(--ink-3)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
        }, React.createElement(I, { name: 'refresh', size: 15, stroke: 2 }), 'Restaurar contenido original')),

      addOpen && React.createElement(KindPicker, { onClose: () => setAddOpen(false), onPick: (k) => { setAddOpen(false); setEditing(store.blank(id, k)); } }),
      editing && React.createElement(BlockEditor, { id, block: editing, perms, onClose: () => setEditing(null) }));
  }

  // ── Selector de tipo de bloque ──
  function KindPicker({ onClose, onPick }) {
    return React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, zIndex: 72, background: 'rgba(16,12,14,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end' } },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 16px calc(20px + env(safe-area-inset-bottom))', animation: 'su-slideup .28s cubic-bezier(.22,1,.36,1)' } },
        React.createElement('div', { style: { width: 40, height: 4, borderRadius: 999, background: 'var(--hairline-strong)', margin: '0 auto 14px' } }),
        React.createElement('div', { style: { fontSize: 16.5, fontWeight: 900, color: 'var(--ink)', marginBottom: 12 } }, 'Tipo de bloque'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          S().KINDS.map((k) => React.createElement('button', {
            key: k.id, onClick: () => onPick(k.id),
            style: { display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', background: 'var(--surface-2)', border: 'none', borderRadius: 14, padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit' },
          },
            React.createElement('div', { style: { width: 42, height: 42, borderRadius: 12, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: k.icon, size: 21, stroke: 2 })),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, k.label),
              React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, k.desc)),
            React.createElement(I, { name: 'chevR', size: 18, stroke: 2.2, style: { color: 'var(--ink-3)' } }))))));
  }

  // ── Previsualizar como (reutiliza el espectador global del panel) ──
  function ViewerBar({ open, setOpen, viewer }) {
    const setViewer = (patch) => window.adminStore && window.adminStore.setViewer(patch);
    const seg = (label, value, options, key) => React.createElement('div', { style: { marginBottom: 12 } },
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 7 } }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } },
        options.map((o) => React.createElement('button', {
          key: o, onClick: () => setViewer({ [key]: o }),
          style: { height: 32, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: value === o ? 'var(--guinda)' : 'var(--surface-2)', color: value === o ? '#fff' : 'var(--ink-2)', boxShadow: value === o ? 'none' : 'var(--neo-inset)' },
        }, o))));
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden' } },
      React.createElement('button', { onClick: () => setOpen(!open), style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '13px 15px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
        React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'eye', size: 18, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, 'Previsualizar como'),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, viewer.sindicato + ' · ' + viewer.nivel)),
        React.createElement(I, { name: open ? 'chevD' : 'chevR', size: 18, stroke: 2.2, style: { color: 'var(--ink-3)' } })),
      open && React.createElement('div', { style: { padding: '2px 15px 14px', borderTop: '1px solid var(--hairline)' } },
        React.createElement('div', { style: { height: 12 } }),
        seg('Cargo', viewer.cargo, A().CARGOS, 'cargo'),
        seg('Tipo de sindicato', viewer.sindicato, A().SINDICATOS, 'sindicato'),
        seg('Categoría de empleado', viewer.nivel, A().NIVELES, 'nivel')));
  }

  // ── Lista de bloques con reordenamiento por arrastre (pointer/táctil) ──
  function DragList({ id, ids, store, viewer, perms, onEdit }) {
    const [order, setOrder] = useState(ids);
    const orderRef = useRef(ids);
    const rowRefs = useRef({});
    const [dragId, setDragId] = useState(null);
    useEffect(() => { const j = ids.join(','); if (j !== orderRef.current.join(',')) { orderRef.current = ids; setOrder(ids); } }, [ids.join(',')]);
    const setBoth = (o) => { orderRef.current = o; setOrder(o); };
    const begin = (e, bid) => {
      e.preventDefault(); setDragId(bid);
      const move = (ev) => {
        const y = ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;
        const cur = orderRef.current; const from = cur.indexOf(bid); if (from < 0) return;
        let target = cur.length - 1;
        for (let i = 0; i < cur.length; i++) { const el = rowRefs.current[cur[i]]; if (!el) continue; const r = el.getBoundingClientRect(); if (y < r.top + r.height / 2) { target = i; break; } }
        if (target !== from) { const next = cur.filter((x) => x !== bid); next.splice(target, 0, bid); setBoth(next); }
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); setDragId(null); store.reorder(id, orderRef.current); };
      window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up);
      window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up);
    };
    window.useFlipRows(rowRefs, dragId);
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      order.map((bid) => {
        const b = store.getBlock(id, bid); if (!b) return null;
        const dragging = dragId === bid;
        const hidden = b.visible !== false && !store.audienceMatch(b, viewer);
        return React.createElement('div', {
          key: bid, ref: (el) => { rowRefs.current[bid] = el; },
          style: { position: 'relative', zIndex: dragging ? 6 : 1, transform: dragging ? 'scale(1.02)' : 'none', transition: dragging ? 'none' : 'transform .16s', boxShadow: dragging ? 'var(--shadow-lg)' : 'none', borderRadius: 16 },
        }, React.createElement(BlockRow, { id, b, hidden, perms, store, onGrab: perms.reordenar ? (e) => begin(e, bid) : null, onEdit }));
      }));
  }

  function BlockRow({ id, b, hidden, perms, store, onGrab, onEdit }) {
    const kind = store.KIND(b.kind);
    const aud = b.audience || { mode: 'all' };
    const audLabel = { all: 'Todos', registered: 'Registrados', segment: 'Segmentado' }[aud.mode] || 'Todos';
    return React.createElement('div', { style: { display: 'flex', alignItems: 'stretch', background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden', opacity: b.visible === false ? .6 : 1 } },
      onGrab
        ? React.createElement('div', { onPointerDown: onGrab, onTouchStart: onGrab, style: { display: 'grid', placeItems: 'center', width: 34, background: 'var(--surface-2)', color: 'var(--ink-3)', cursor: 'grab', touchAction: 'none', flexShrink: 0 } }, React.createElement(I, { name: 'grip', size: 18, stroke: 2 }))
        : React.createElement('div', { style: { width: 10, flexShrink: 0 } }),
      React.createElement('button', { onClick: () => onEdit(b), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '11px 10px', cursor: 'pointer', fontFamily: 'inherit' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('div', { style: { width: 28, height: 28, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: kind.icon, size: 16, stroke: 2 })),
          React.createElement('span', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 } }, b.titulo || kind.label)),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 } },
          chip(kind.icon, kind.label),
          chip(aud.mode === 'segment' ? 'filter' : aud.mode === 'registered' ? 'user' : 'globe', audLabel),
          b.file && chip('download', b.file.name && b.file.name.length > 14 ? b.file.name.slice(0, 12) + '…' : (b.file.name || 'archivo')),
          b.url && chip('link', 'Enlace'),
          hidden && chip('ban', 'Oculto', true),
          b.visible === false && chip('power', 'Inactivo'))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '9px 9px', justifyContent: 'center' } },
        perms.crear && iconBtn('copy', () => store.duplicateBlock(id, b.id))),
      React.createElement('div', { style: { display: 'grid', placeItems: 'center', padding: '0 12px 0 2px' } },
        React.createElement(window.Toggle, { on: b.visible !== false, size: 'lg', onClick: (e) => { e.stopPropagation(); if (perms.editar) store.toggleBlock(id, b.id); }, disabled: !perms.editar, 'aria-label': 'Visible', })));
  }
  function iconBtn(icon, onClick) {
    return React.createElement('button', { onClick: (e) => { e.stopPropagation(); onClick(); }, style: { width: 36, height: 36, borderRadius: 11, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' } }, React.createElement(I, { name: icon, size: 18, stroke: 2 }));
  }
  function chip(icon, label, warn) {
    return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: warn ? '#FDEAEA' : 'var(--surface-2)', color: warn ? '#C0341D' : 'var(--ink-3)' } },
      React.createElement(I, { name: icon, size: 12, stroke: 2.2 }), label);
  }

  function SectionTitle({ icon, label }) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 12px' } },
      React.createElement('div', { style: { width: 26, height: 26, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 16, stroke: 2 })),
      React.createElement('span', { style: { fontSize: 14.5, fontWeight: 900, color: 'var(--ink)' } }, label),
      React.createElement('div', { style: { flex: 1, height: 1, background: 'var(--hairline)' } }));
  }

  // ─────────────────────────────────────────────────────────────
  // Editor de bloque (overlay pantalla completa)
  // ─────────────────────────────────────────────────────────────
  function BlockEditor({ id, block, perms, onClose }) {
    const store = S();
    const [d, setD] = useState(block);
    const [pendingAsset, setPendingAsset] = useState(null);
    const isNew = !store.getBlock(id, block.id);
    const set = (patch) => setD((p) => Object.assign({}, p, patch));
    const setAud = (patch) => setD((p) => Object.assign({}, p, { audience: Object.assign({}, p.audience, patch) }));
    const kind = store.KIND(d.kind);
    const uploaded = async (asset) => { if (pendingAsset) await window.AdminRepository.discardAsset(pendingAsset); setPendingAsset(asset); set({ assetId: asset.id, imageUrl: asset.url }); return true; };
    const removeAsset = async () => { if (pendingAsset) await window.AdminRepository.discardAsset(pendingAsset); setPendingAsset(null); set({ assetId: null, imageUrl: null }); };
    const cancel = async () => { if (pendingAsset) await window.AdminRepository.discardAsset(pendingAsset); onClose(); };
    const save = async () => { if (await store.saveBlock(id, d)) { setPendingAsset(null); onClose(); } };
    const del = async () => { if (pendingAsset) await window.AdminRepository.discardAsset(pendingAsset); store.removeBlock(id, d.id); onClose(); };

    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 74, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement('button', { onClick: cancel, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('div', { style: { width: 30, height: 30, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: kind.icon, size: 17, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16, fontWeight: 800 } }, (isNew ? 'Nuevo bloque · ' : 'Editar · ') + kind.label)),

      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        // Tipo (cambiable)
        React.createElement('div', { style: { marginBottom: 18 } },
          React.createElement('label', { style: lbl }, 'Tipo de bloque'),
          React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            store.KINDS.map((k) => React.createElement('button', {
              key: k.id, onClick: () => set({ kind: k.id, assetId: (k.id==='imagen'||k.id==='documento')?d.assetId:null, imageUrl:(k.id==='imagen'||k.id==='documento')?d.imageUrl:null }),
              style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 13px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: d.kind === k.id ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: d.kind === k.id ? '#fff' : 'var(--ink-2)', boxShadow: d.kind === k.id ? 'var(--glow-guinda)' : 'var(--neo-inset)' },
            }, React.createElement(I, { name: k.icon, size: 15, stroke: 2.2 }), k.label)))),

        // Título (siempre)
        React.createElement('div', { style: { marginBottom: 18 } },
          React.createElement('label', { style: lbl }, d.kind === 'texto' ? 'Título' : 'Título / etiqueta'),
          React.createElement('input', { value: d.titulo || '', placeholder: 'Escribe el título…', onChange: (e) => set({ titulo: e.target.value }), style: inputBase })),

        // Texto (texto y enlace = descripción)
        (d.kind === 'texto' || d.kind === 'enlace' || d.kind === 'documento') && React.createElement('div', { style: { marginBottom: 18 } },
          React.createElement('label', { style: lbl }, d.kind === 'texto' ? 'Contenido' : 'Descripción'),
          React.createElement('textarea', { value: d.texto || '', rows: d.kind === 'texto' ? 5 : 2, placeholder: d.kind === 'texto' ? 'Escribe el texto que verán los afiliados…' : 'Texto de apoyo (opcional)', onChange: (e) => set({ texto: e.target.value }), style: Object.assign({}, inputBase, { resize: 'vertical', minHeight: d.kind === 'texto' ? 110 : 62, lineHeight: 1.5 }) })),

        // Imagen
        d.kind === 'imagen' && React.createElement(ManagedAssetField, { label: 'Imagen', url: d.imageUrl, accept: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml', bucket: 'app-assets', assetType: 'UNION_BLOCK_IMAGE', purpose: 'sindicato.block-image', onUploaded: uploaded, onRemove: removeAsset }),

        // Documento / archivo
        d.kind === 'documento' && React.createElement(ManagedAssetField, { label: 'Archivo PDF', url: d.imageUrl, accept: 'application/pdf', bucket: 'documents', assetType: 'UNION_BLOCK_DOCUMENT', purpose: 'sindicato.block-document', onUploaded: uploaded, onRemove: removeAsset }),

        // Enlace (URL) — visible para enlace, y opcional en imagen/documento
        (d.kind === 'enlace' || d.kind === 'imagen' || d.kind === 'documento') && React.createElement('div', { style: { marginBottom: 18 } },
          React.createElement('label', { style: lbl }, d.kind === 'enlace' ? 'URL de destino' : 'Enlace (opcional)'),
          React.createElement('input', { value: d.url || '', placeholder: 'https://…  (web, formulario o recurso)', inputMode: 'url', onChange: (e) => set({ url: e.target.value }), style: inputBase }),
          d.kind !== 'enlace' && React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 7, lineHeight: 1.4 } }, 'Si agregas un enlace, el bloque abrirá esta dirección al tocarlo.')),

        // Segmentación
        React.createElement(SectionTitle, { icon: 'users', label: 'Visibilidad y segmentación' }),
        React.createElement('div', { style: { marginBottom: 14 } },
          React.createElement('label', { style: lbl }, '¿A quién se muestra?'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            A().AUDIENCE_MODES.map((m) => {
              const on = (d.audience.mode || 'all') === m.value;
              return React.createElement('button', {
                key: m.value, onClick: () => setAud({ mode: m.value }),
                style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: on ? 'var(--guinda-50)' : 'var(--surface)', border: on ? '1.5px solid var(--guinda)' : '1.5px solid transparent', boxShadow: on ? 'none' : 'var(--neo-sm)', borderRadius: 13, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' },
              },
                React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: on ? 'var(--guinda)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: m.icon, size: 18, stroke: 2 })),
                React.createElement('div', { style: { flex: 1 } },
                  React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, m.label),
                  React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, m.desc)),
                on && React.createElement(I, { name: 'checkCircle', size: 20, stroke: 2, style: { color: 'var(--guinda)' } }));
            }))),
        d.audience.mode === 'segment' && React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '16px 15px 4px', boxShadow: 'var(--neo-sm)', marginBottom: 8 } },
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.4 } }, 'Deja un grupo vacío para no filtrar por ese criterio.'),
          React.createElement(Chips, { label: 'Sindicato', options: A().SINDICATOS, values: d.audience.sindicatos, onChange: (val) => setAud({ sindicatos: val }) }),
          React.createElement(Chips, { label: 'Categoría / tipo de empleado', options: A().NIVELES, values: d.audience.niveles, onChange: (val) => setAud({ niveles: val }) }),
          React.createElement(Chips, { label: 'Cargo en la app', options: A().CARGOS, values: d.audience.cargos, onChange: (val) => setAud({ cargos: val }) })),

        !isNew && perms.eliminar && React.createElement('button', { onClick: del, style: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 18px', borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', marginTop: 8 } },
          React.createElement(I, { name: 'trash', size: 18, stroke: 2 }), 'Eliminar bloque'),
        React.createElement('div', { style: { height: 16 } })),

      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: cancel }, 'Cancelar'),
        React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, onClick: save }, 'Guardar bloque')));
  }

  // ── Asset autoritativo: Storage -> app_assets -> relation ID ──
  function ManagedAssetField({ label, url, accept, bucket, assetType, purpose, onUploaded, onRemove, disabled }) {
    const inputRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const onFile = async (file) => {
      if (!file) return;
      setErr(''); setBusy(true);
      try {
        const asset = await window.AdminRepository.uploadManagedAsset(file, bucket, assetType, purpose);
        if ((await onUploaded(asset)) === false) await window.AdminRepository.discardAsset(asset);
      } catch (_) { setErr('No se pudo subir el archivo.'); }
      finally { setBusy(false); }
    };
    return React.createElement('div', { style: { marginBottom: 18 } },
      React.createElement('label', { style: lbl }, label),
      React.createElement('input', { ref: inputRef, type: 'file', accept, hidden: true, disabled:disabled||busy, onChange: (e) => { onFile(e.target.files && e.target.files[0]); e.target.value = ''; } }),
      url
        ? React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 14, padding: '12px 13px', boxShadow: 'var(--neo-sm)' } },
          accept==='application/pdf' ? React.createElement('div', { style: { width: 42, height: 42, borderRadius: 11, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'doc', size: 21, stroke: 1.9 })) : React.createElement('img', { src:url, alt:'', style:{width:54,height:42,borderRadius:9,objectFit:'cover'} }),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, accept==='application/pdf'?'PDF configurado':'Imagen configurada')),
          !disabled && React.createElement('button', { onClick: () => inputRef.current && inputRef.current.click(), disabled:busy, style: { width: 36, height: 36, borderRadius: 10, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }, title: 'Reemplazar' }, React.createElement(I, { name: 'refresh', size: 17, stroke: 2 })),
          !disabled && React.createElement('button', { onClick:onRemove, disabled:busy, style: { width: 36, height: 36, borderRadius: 10, border: 'none', background: '#FDEAEA', color: '#C0341D', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }, title: 'Quitar' }, React.createElement(I, { name: 'trash', size: 17, stroke: 2 })))
        : !disabled && React.createElement('button', { onClick: () => inputRef.current && inputRef.current.click(), disabled:busy, style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 54, borderRadius: 14, border: '1.5px dashed var(--hairline-strong)', background: 'var(--surface)', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' } },
          React.createElement(I, { name: 'download', size: 20, stroke: 2.2, style: { transform: 'rotate(180deg)' } }), busy?'Subiendo…':'Subir archivo'),
      err && React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: '#C0341D', marginTop: 8 } }, err),
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.4 } }, 'El archivo se guarda en Supabase Storage y la pantalla conserva únicamente su relación de asset.'));
  }

  function Chips({ label, options, values, onChange }) {
    const list = values || [];
    const toggle = (o) => onChange(list.indexOf(o) !== -1 ? list.filter((x) => x !== o) : [...list, o]);
    return React.createElement('div', { style: { marginBottom: 14 } },
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 8 } }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        options.map((o) => {
          const on = list.indexOf(o) !== -1;
          return React.createElement('button', {
            key: o, onClick: () => toggle(o),
            style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 13px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: on ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-2)', boxShadow: on ? 'var(--glow-guinda)' : 'var(--neo-inset)' },
          }, on && React.createElement(I, { name: 'check', size: 14, stroke: 3 }), o);
        })));
  }

  window.SindicatoModule = SindicatoModule;
})();
