/* screens-admin-fincat.jsx — Módulo "Catálogo de Finanzas": secciones y
   productos de la pantalla Finanzas, editables. Exporta window.FinCatModule. */
(function () {
  const { useState } = React;
  const I = window.Icon;
  const A = () => window.ADMIN;
  const S = () => window.finCatStore;
  const lbl = { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 6 };
  const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 12, padding: '11px 13px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };
  const toneColor = (t) => ({ guinda: 'var(--guinda)', green: '#13794A', blue: '#2456C7', amber: '#9A6B16' }[t] || 'var(--guinda)');

  function FinCatModule({ app, onBack, header, canEdit }) {
    const store = window.useFinCatStore();
    const editable = canEdit !== false;
    const [editing, setEditing] = useState(null); // { gid, item }
    const [recEditing, setRecEditing] = useState(null); // regla de recomendación
    return React.createElement('div', null,
      header({ title: 'Catálogo de Finanzas', sub: 'Secciones y productos de la pantalla Finanzas', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll su-stagger', style: { padding: 16 } },
        React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 14 } },
          'Edita títulos, descripciones, etiquetas, orden y visibilidad. Los cambios se reflejan al instante en la pantalla ', React.createElement('b', { style: { color: 'var(--ink-2)' } }, 'Finanzas'), '.'),
        React.createElement(RecsCard, { store, editable, onEdit: setRecEditing }),
        store.groups().map((g) => React.createElement(GroupCard, { key: g.id, g, editable, onEdit: (item) => setEditing({ gid: g.id, item }), store })),
        React.createElement('button', {
          onClick: () => { if (window.confirm('¿Restaurar el catálogo original de Finanzas?')) store.resetAll(); },
          style: { display: 'flex', alignItems: 'center', gap: 7, margin: '18px auto 0', background: 'none', border: 'none', color: 'var(--ink-3)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
        }, React.createElement(I, { name: 'refresh', size: 15, stroke: 2 }), 'Restaurar contenido original')),
      editing && React.createElement(ItemSheet, { gid: editing.gid, item: editing.item, editable, onClose: () => setEditing(null) }),
      recEditing && React.createElement(RecSheet, { rec: recEditing, editable, onClose: () => setRecEditing(null) }));
  }

  // ── Sección "Recomendado para ti": reglas segmentables ──
  function RecsCard({ store, editable, onEdit }) {
    const list = store.recs();
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 18, padding: 15, boxShadow: 'var(--neo-sm)', marginBottom: 14 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 } },
        React.createElement('div', { style: { width: 30, height: 30, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'sparkle', size: 17, stroke: 2 })),
        React.createElement('div', { style: { fontSize: 14.5, fontWeight: 900, color: 'var(--ink)' } }, 'Recomendado para ti'),
        React.createElement('span', { style: { marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999 } }, list.length)),
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, marginBottom: 12 } }, 'Define qué servicios se recomiendan y a quién, por tipo de sindicato y categoría de empleado. Cada usuario ve solo las recomendaciones de su perfil.'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        list.map((r, i) => {
          const it = store.findItem(r.itemId);
          return React.createElement('div', { key: r.id, style: { display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', borderRadius: 13, padding: '9px 11px', boxShadow: 'var(--neo-inset)', opacity: r.visible === false ? .55 : 1 } },
            React.createElement(window.IconTile, { icon: (it && it.icon) || 'sparkle', size: 36 }),
            React.createElement('button', { onClick: () => onEdit(r), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                React.createElement('span', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, it ? it.label : '(producto eliminado)'),
                r.audience && r.audience.mode === 'segment' && React.createElement(window.Badge, { tone: 'blue' }, 'SEGMENTADO')),
              React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, (r.reason || 'Sin etiqueta') + ' · ' + (r.cta || 'Ver'))),
            editable && React.createElement('div', { style: { display: 'flex', gap: 4, flexShrink: 0 } },
              miniBtn('chevD', () => store.moveRec(r.id, 1), i === list.length - 1, 'Bajar', true),
              miniBtn('chevD', () => store.moveRec(r.id, -1), i === 0, 'Subir'),
              React.createElement('button', { onClick: () => store.toggleRec(r.id), 'aria-label': 'Mostrar u ocultar', style: { width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: r.visible === false ? 'var(--surface)' : 'var(--guinda-50)', color: r.visible === false ? 'var(--ink-3)' : 'var(--guinda)' } }, React.createElement(I, { name: r.visible === false ? 'ban' : 'eye', size: 15, stroke: 2 }))));
        })),
      editable && React.createElement('button', {
        onClick: () => onEdit(S().blankRec()),
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 10, height: 44, borderRadius: 13, border: '1.5px dashed var(--hairline-strong)', background: 'var(--surface)', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' },
      }, React.createElement(I, { name: 'plus', size: 18, stroke: 2.6 }), 'Agregar recomendación'));
  }

  function RecSheet({ rec, editable, onClose }) {
    const [d, setD] = useState(() => ({ audience: { mode: 'all', cargos: [], sindicatos: [], niveles: [] }, ...rec }));
    const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
    const setAud = (patch) => setD((p) => ({ ...p, audience: { ...p.audience, ...patch } }));
    const isNew = !S().getRec(rec.id);
    const allItems = S().groups().reduce((a, g) => a.concat(g.items.map((it) => ({ ...it, gTitle: g.title }))), []);
    const save = () => { if (!d.itemId) return; S().saveRec(d); onClose(); };
    const del = () => { S().removeRec(d.id); onClose(); };
    return React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, zIndex: 76, background: 'rgba(16,12,14,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end' } },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '90%', overflowY: 'auto' } },
        React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
        React.createElement('div', { style: { fontSize: 17, fontWeight: 900, color: 'var(--ink)', marginBottom: 14 } }, isNew ? 'Nueva recomendación' : 'Editar recomendación'),
        React.createElement('label', { style: lbl }, 'Producto o servicio'),
        React.createElement('select', { value: d.itemId || '', disabled: !editable, onChange: (e) => set('itemId', e.target.value), style: { ...inputBase, marginBottom: 12, appearance: 'auto' } },
          React.createElement('option', { value: '' }, 'Selecciona un producto…'),
          allItems.map((it) => React.createElement('option', { key: it.id, value: it.id }, it.label + ' — ' + it.gTitle))),
        React.createElement('label', { style: lbl }, 'Etiqueta (por qué se recomienda)'),
        React.createElement('input', { value: d.reason || '', disabled: !editable, maxLength: 26, placeholder: 'Ej. Eres elegible hoy', onChange: (e) => set('reason', e.target.value), style: { ...inputBase, marginBottom: 12 } }),
        React.createElement('label', { style: lbl }, 'Texto del botón'),
        React.createElement('input', { value: d.cta || '', disabled: !editable, maxLength: 14, placeholder: 'Ej. Simular', onChange: (e) => set('cta', e.target.value), style: { ...inputBase, marginBottom: 14 } }),
        React.createElement('label', { style: lbl }, '¿A quién se recomienda?'),
        React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 } },
          (A() ? A().AUDIENCE_MODES : []).map((m) => React.createElement('button', {
            key: m.value, onClick: () => editable && setAud({ mode: m.value }), disabled: !editable,
            style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 13px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: d.audience.mode === m.value ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: d.audience.mode === m.value ? '#fff' : 'var(--ink-2)', boxShadow: d.audience.mode === m.value ? 'var(--glow-guinda)' : 'var(--neo-inset)' },
          }, React.createElement(I, { name: m.icon, size: 14, stroke: 2.2 }), m.label))),
        d.audience.mode === 'segment' && React.createElement('div', { style: { background: 'var(--surface-2)', borderRadius: 14, padding: '13px 13px 3px', boxShadow: 'var(--neo-inset)', marginBottom: 12 } },
          React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.4 } }, 'Deja un grupo vacío para no filtrar por ese criterio.'),
          React.createElement(AudChips, { label: 'Tipo de sindicato', options: A().SINDICATOS, values: d.audience.sindicatos, editable, onChange: (v) => setAud({ sindicatos: v }) }),
          React.createElement(AudChips, { label: 'Categoría de empleado', options: A().NIVELES, values: d.audience.niveles, editable, onChange: (v) => setAud({ niveles: v }) })),
        React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, marginBottom: 14 } }, 'Además del filtro de la recomendación, el producto debe ser visible para ese perfil en el catálogo.'),
        editable
          ? React.createElement('div', { style: { display: 'flex', gap: 10 } },
            !isNew && React.createElement('button', { onClick: del, style: { width: 46, borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', cursor: 'pointer', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: 'trash', size: 18, stroke: 2 })),
            React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
            React.createElement(window.Btn, { icon: 'check', style: { flex: 2 }, onClick: save }, 'Guardar'))
          : React.createElement(window.Btn, { full: true, variant: 'outline', onClick: onClose }, 'Cerrar')));
  }

  function GroupCard({ g, editable, onEdit, store }) {
    const items = g.items.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 18, padding: 15, boxShadow: 'var(--neo-sm)', marginBottom: 14 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 } },
        React.createElement('div', { style: { width: 6, height: 24, borderRadius: 999, background: toneColor(g.tone), flexShrink: 0 } }),
        React.createElement('div', { style: { fontSize: 14.5, fontWeight: 900, color: 'var(--ink)' } }, 'Sección'),
        React.createElement('span', { style: { marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999 } }, items.length + ' productos')),
      React.createElement('label', { style: lbl }, 'Título de la sección'),
      React.createElement('input', { value: g.title, disabled: !editable, onChange: (e) => store.saveGroup(g.id, { title: e.target.value }), style: { ...inputBase, marginBottom: 10 } }),
      React.createElement('label', { style: lbl }, 'Subtítulo'),
      React.createElement('input', { value: g.sub, disabled: !editable, onChange: (e) => store.saveGroup(g.id, { sub: e.target.value }), style: { ...inputBase, marginBottom: 14 } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        items.map((it, i) => React.createElement('div', { key: it.id, style: { display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', borderRadius: 13, padding: '9px 11px', boxShadow: 'var(--neo-inset)', opacity: it.visible === false ? .55 : 1 } },
          React.createElement(window.IconTile, { icon: it.icon, size: 36 }),
          React.createElement('button', { onClick: () => onEdit(it), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              React.createElement('span', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, it.label),
              it.hero && React.createElement(window.Badge, { tone: 'gold', solid: true }, 'POPULAR'),
              it.audience && it.audience.mode === 'segment' && React.createElement(window.Badge, { tone: 'blue' }, 'SEGMENTADO'),
              it.audience && it.audience.mode === 'registered' && React.createElement(window.Badge, { tone: 'blue' }, 'REGISTRADOS')),
            React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, (it.tagline || '') + (it.meta ? ' · ' + it.meta : ''))),
          editable && React.createElement('div', { style: { display: 'flex', gap: 4, flexShrink: 0 } },
            miniBtn('chevD', () => store.moveItem(g.id, it.id, 1), i === items.length - 1, 'Bajar', true),
            miniBtn('chevD', () => store.moveItem(g.id, it.id, -1), i === 0, 'Subir'),
            React.createElement('button', { onClick: () => store.toggleItem(g.id, it.id), 'aria-label': 'Mostrar u ocultar', style: { width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: it.visible === false ? 'var(--surface)' : 'var(--guinda-50)', color: it.visible === false ? 'var(--ink-3)' : 'var(--guinda)' } }, React.createElement(I, { name: it.visible === false ? 'ban' : 'eye', size: 15, stroke: 2 })))))));
  }
  function miniBtn(icon, onClick, disabled, label, flip) {
    return React.createElement('button', { onClick, disabled, 'aria-label': label, style: { width: 30, height: 30, borderRadius: 9, border: 'none', cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', background: 'var(--surface)', color: 'var(--ink-3)', opacity: disabled ? .35 : 1, transform: flip ? 'none' : 'rotate(180deg)' } }, React.createElement(I, { name: icon, size: 15, stroke: 2.2 }));
  }

  function ItemSheet({ gid, item, editable, onClose }) {
    const [d, setD] = useState(() => ({ audience: { mode: 'all', cargos: [], sindicatos: [], niveles: [] }, ...item }));
    const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
    const setAud = (patch) => setD((p) => ({ ...p, audience: { ...p.audience, ...patch } }));
    const save = () => { S().saveItem(gid, d); onClose(); };
    const sw = (label, key) => React.createElement('button', { onClick: () => set(key, !d[key]), disabled: !editable, style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'var(--surface-2)', border: 'none', borderRadius: 12, padding: '11px 13px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--neo-inset)', marginBottom: 12 } },
      React.createElement('span', { style: { flex: 1, textAlign: 'left', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, label),
      React.createElement(window.Toggle, { on: d[key], size: 'sm', glow: false, }));
    return React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, zIndex: 76, background: 'rgba(16,12,14,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end' } },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '90%', overflowY: 'auto' } },
        React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 } },
          React.createElement(window.IconTile, { icon: d.icon, size: 40 }),
          React.createElement('div', { style: { fontSize: 17, fontWeight: 900, color: 'var(--ink)' } }, 'Editar producto')),
        d.id !== 'terrenos' && React.createElement(React.Fragment, null,
          React.createElement('label', { style: lbl }, 'Imagen de cabecera (opcional)'),
          React.createElement('div', { style: { borderRadius: 13, overflow: 'hidden', boxShadow: 'var(--neo-inset)', marginBottom: 6, height: 110, position: 'relative', background: 'linear-gradient(135deg,var(--guinda),var(--guinda-700))' } },
            React.createElement('image-slot', { id: 'fin_hdr_' + d.id, shape: 'rect', fit: 'cover', placeholder: editable ? 'Arrastra una imagen' : '', style: Object.assign({ position: 'absolute', inset: 0, width: '100%', height: '100%' }, editable ? {} : { pointerEvents: 'none' }) })),
          React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 12 } }, 'Se muestra en la cabecera de la pantalla de este producto. Si no subes ninguna, se usa el color de la sección.')),
        React.createElement('label', { style: lbl }, 'Nombre'),
        React.createElement('input', { value: d.label || '', disabled: !editable, maxLength: 40, onChange: (e) => set('label', e.target.value), style: { ...inputBase, marginBottom: 12 } }),
        React.createElement('label', { style: lbl }, 'Tagline (línea principal)'),
        React.createElement('input', { value: d.tagline || '', disabled: !editable, maxLength: 40, onChange: (e) => set('tagline', e.target.value), style: { ...inputBase, marginBottom: 12 } }),
        React.createElement('label', { style: lbl }, 'Detalle (línea secundaria)'),
        React.createElement('input', { value: d.meta || '', disabled: !editable, maxLength: 48, onChange: (e) => set('meta', e.target.value), style: { ...inputBase, marginBottom: 14 } }),
        sw('Insignia "POPULAR"', 'hero'),
        sw('Visible en la app', 'visible'),
        React.createElement('label', { style: lbl }, '¿A quién se muestra?'),
        React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 } },
          (A() ? A().AUDIENCE_MODES : []).map((m) => React.createElement('button', {
            key: m.value, onClick: () => editable && setAud({ mode: m.value }), disabled: !editable,
            style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 13px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: d.audience.mode === m.value ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: d.audience.mode === m.value ? '#fff' : 'var(--ink-2)', boxShadow: d.audience.mode === m.value ? 'var(--glow-guinda)' : 'var(--neo-inset)' },
          }, React.createElement(I, { name: m.icon, size: 14, stroke: 2.2 }), m.label))),
        d.audience.mode === 'segment' && React.createElement('div', { style: { background: 'var(--surface-2)', borderRadius: 14, padding: '13px 13px 3px', boxShadow: 'var(--neo-inset)', marginBottom: 12 } },
          React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.4 } }, 'Deja un grupo vacío para no filtrar por ese criterio.'),
          React.createElement(AudChips, { label: 'Tipo de sindicato', options: A().SINDICATOS, values: d.audience.sindicatos, editable, onChange: (v) => setAud({ sindicatos: v }) }),
          React.createElement(AudChips, { label: 'Categoría de empleado', options: A().NIVELES, values: d.audience.niveles, editable, onChange: (v) => setAud({ niveles: v }) })),
        React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, marginBottom: 14 } }, 'La insignia "SE COTIZA" y la acción del producto se administran en el módulo Fondos y reglas.'),
        editable
          ? React.createElement('div', { style: { display: 'flex', gap: 10 } },
            React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
            React.createElement(window.Btn, { icon: 'check', style: { flex: 2 }, onClick: save }, 'Guardar'))
          : React.createElement(window.Btn, { full: true, variant: 'outline', onClick: onClose }, 'Cerrar')));
  }

  function AudChips({ label, options, values, editable, onChange }) {
    const list = values || [];
    const toggle = (o) => editable && onChange(list.indexOf(o) !== -1 ? list.filter((x) => x !== o) : [...list, o]);
    return React.createElement('div', { style: { marginBottom: 10 } },
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 7 } }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } },
        (options || []).map((o) => {
          const on = list.indexOf(o) !== -1;
          return React.createElement('button', {
            key: o, onClick: () => toggle(o), disabled: !editable,
            style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 11px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: on ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink-2)', boxShadow: on ? 'var(--glow-guinda)' : 'var(--neo-sm)' },
          }, on && React.createElement(I, { name: 'check', size: 13, stroke: 3 }), o);
        })));
  }

  window.FinCatModule = FinCatModule;
})();
