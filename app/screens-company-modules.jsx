/* screens-company-modules.jsx — Módulos del Panel Empresarial.
   Exporta window.CoEmpresa, CoProductos, CoPromos, CoPopups, CoSolicitudes,
   CoStats, CoNotifs, CoBitacora. */
(function () {
  const { useState } = React;
  const I = window.Icon;
  const CO = () => window.COMPANY;
  const H = (p) => window.CoHeaderEl(p);
  const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 6 };
  const scroll = { className: 'su-app-scroll', style: { padding: 16 } };
  function Field({ label, value, onChange, area, ph }) {
    return React.createElement('div', { style: { marginBottom: 14 } },
      React.createElement('label', { style: lbl }, label),
      React.createElement(area ? 'textarea' : 'input', { value: value || '', placeholder: ph, onChange: (e) => onChange(e.target.value), rows: area ? 3 : undefined, style: { ...inputBase, minHeight: area ? 70 : undefined, resize: area ? 'vertical' : undefined, lineHeight: area ? 1.5 : undefined } }));
  }
  function Toggle({ on, onClick }) {
    return React.createElement(window.Toggle, { on: on, size: 'lg', onClick, 'aria-label': 'toggle', });
  }
  function SecTitle(icon, label) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' } },
      React.createElement('div', { style: { width: 26, height: 26, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 15, stroke: 2 })),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 900, color: 'var(--ink)' } }, label),
      React.createElement('div', { style: { flex: 1, height: 1, background: 'var(--hairline)' } }));
  }

  // ── Mi Empresa ──
  function CoEmpresa({ app, co, store, onBack }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(co)));
    const [okSave, runSave] = window.useBtnConfirm();
    const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
    const setRed = (k, v) => setD((p) => ({ ...p, redes: { ...p.redes, [k]: v } }));
    const setSuc = (i, k, v) => setD((p) => ({ ...p, sucursales: p.sucursales.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
    return React.createElement('div', null, H({ title: 'Mi Empresa', sub: 'Perfil público', onBack, co }),
      React.createElement('div', scroll,
        SecTitle('image', 'Logotipo'),
        React.createElement('div', { style: { width: 90, height: 90, borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--neo-sm)', position: 'relative', background: `hsl(${co.hue || 210},50%,45%)`, marginBottom: 16 } }, React.createElement('image-slot', { id: d.slotLogo, shape: 'rect', fit: 'cover', placeholder: 'Logo', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })),
        SecTitle('handshake', 'Datos generales'),
        Field({ label: 'Nombre comercial', value: d.name, onChange: (v) => set('name', v) }),
        Field({ label: 'Razón social', value: d.razon, onChange: (v) => set('razon', v) }),
        Field({ label: 'Giro', value: d.giro, onChange: (v) => set('giro', v) }),
        Field({ label: 'Descripción', value: d.desc, onChange: (v) => set('desc', v), area: true }),
        Field({ label: 'Historia', value: d.historia, onChange: (v) => set('historia', v), area: true, ph: 'Reseña de la empresa…' }),
        SecTitle('image', 'Galería de imágenes'),
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 16 } },
          (d.gallery || []).map((g) => React.createElement('div', { key: g, style: { flex: 1, height: 74, borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--neo-sm)', position: 'relative', background: 'var(--surface-2)' } }, React.createElement('image-slot', { id: g, shape: 'rect', fit: 'cover', placeholder: 'Foto', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })))),
        Field({ label: 'Video institucional (URL)', value: d.video, onChange: (v) => set('video', v), ph: 'https://…' }),
        SecTitle('phone', 'Contacto'),
        Field({ label: 'Teléfono', value: d.tel, onChange: (v) => set('tel', v) }),
        Field({ label: 'Correo', value: d.email, onChange: (v) => set('email', v) }),
        Field({ label: 'Página web', value: d.web, onChange: (v) => set('web', v) }),
        React.createElement('div', { style: { display: 'flex', gap: 12 } },
          React.createElement('div', { style: { flex: 1 } }, Field({ label: 'Facebook', value: d.redes && d.redes.fb, onChange: (v) => setRed('fb', v) })),
          React.createElement('div', { style: { flex: 1 } }, Field({ label: 'Instagram', value: d.redes && d.redes.ig, onChange: (v) => setRed('ig', v) }))),
        Field({ label: 'Horarios', value: d.horario, onChange: (v) => set('horario', v) }),
        SecTitle('pin', 'Sucursales y ubicación'),
        (d.sucursales || []).map((s, i) => React.createElement('div', { key: i, style: { background: 'var(--surface)', borderRadius: 14, padding: 12, boxShadow: 'var(--neo-sm)', marginBottom: 10 } },
          React.createElement('input', { value: s.nombre, placeholder: 'Nombre sucursal', onChange: (e) => setSuc(i, 'nombre', e.target.value), style: { ...inputBase, marginBottom: 8, padding: '10px 12px', fontWeight: 700 } }),
          React.createElement('input', { value: s.dir, placeholder: 'Dirección', onChange: (e) => setSuc(i, 'dir', e.target.value), style: { ...inputBase, padding: '10px 12px', fontSize: 13.5 } }))),
        React.createElement('button', { onClick: () => setD((p) => ({ ...p, sucursales: [...(p.sucursales || []), { nombre: '', dir: '' }] })), style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', borderRadius: 12, border: '1.5px dashed var(--hairline-strong)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8 } }, React.createElement(I, { name: 'plus', size: 16, stroke: 2.4 }), 'Agregar sucursal'),
        Field({ label: 'Ubicación en mapa (URL)', value: d.mapUrl, onChange: (v) => set('mapUrl', v), ph: 'https://maps…' }),
        React.createElement(window.Btn, { full: true, variant: 'dark', icon: 'check', success: okSave, style: { marginTop: 6 }, onClick: () => runSave(async() => { await store.save(d); app.toast('Información guardada'); }) }, 'Guardar cambios')));
  }

  // ── Productos y Servicios ──
  // Los productos del convenio se administran con el mismo módulo del Marketplace
  // que usa el sindicato: mismas imágenes, precios y detalle para el afiliado.
  function CoProductos({ app, co, store, onBack }) {
    const n = window.catalogStore ? window.catalogStore.byCompany(co.id).length : 0;
    return React.createElement('div', null, H({ title: 'Productos y Servicios', sub: n + ' en el Marketplace', onBack, co }),
      React.createElement('div', scroll,
        React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 14 } },
          'Lo que publiques aquí aparece en tu convenio dentro de la app, con galería de imágenes, detalle y botón para solicitar el beneficio.'),
        React.createElement(window.CatalogEditorList, { scope: 'convenio', scopeId: co.id, empresaId: co.id, editable: true, actor: 'Empresa · ' + co.name, dark: true })));
  }
  function ProductEditor({ co, store, item, onClose }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(item)));
    const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
    const isNew = !(co.products || []).some((p) => p.id === item.id);
    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 74, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: onClose, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16, fontWeight: 800 } }, isNew ? 'Nuevo' : 'Editar')),
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 14 } },
          ['producto', 'servicio'].map((k) => React.createElement('button', { key: k, onClick: () => set('kind', k), style: { flex: 1, height: 40, borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, textTransform: 'capitalize', background: d.kind === k ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: d.kind === k ? '#fff' : 'var(--ink-2)' } }, k))),
        React.createElement('div', { style: { height: 110, borderRadius: 14, overflow: 'hidden', position: 'relative', background: 'var(--surface-2)', boxShadow: 'var(--neo-sm)', marginBottom: 14 } }, React.createElement('image-slot', { id: d.slotId, shape: 'rect', fit: 'cover', placeholder: 'Fotografía', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })),
        Field({ label: 'Nombre', value: d.name, onChange: (v) => set('name', v) }),
        Field({ label: 'Categoría', value: d.cat, onChange: (v) => set('cat', v) }),
        React.createElement('div', { style: { display: 'flex', gap: 12 } },
          React.createElement('div', { style: { flex: 1 } }, Field({ label: d.cotizar ? 'Precio de referencia (opcional)' : 'Precio', value: d.price, onChange: (v) => set('price', parseFloat(v) || 0) })),
          React.createElement('div', { style: { width: 110 } }, Field({ label: '% Desc.', value: d.disc, onChange: (v) => set('disc', parseInt(v || '0', 10)) }))),
        // ── Cotizar primero: el precio no es fijo; el afiliado solicita y tú cotizas ──
        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--surface)', borderRadius: 14, padding: '12px 15px', boxShadow: 'var(--neo-sm)', marginBottom: 14 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 14, fontWeight: 800 } }, 'Cotizar primero'),
            React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3, lineHeight: 1.45 } }, 'Para precios variables (tipo de cambio, disponibilidad…). El afiliado envía una solicitud de interés, tú cargas la cotización y solo entonces podrá simular su financiamiento.')),
          Toggle({ on: !!d.cotizar, onClick: () => set('cotizar', !d.cotizar) })),
        Field({ label: 'Características / descripción', value: d.desc, onChange: (v) => set('desc', v), area: true }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 14, padding: '12px 15px', boxShadow: 'var(--neo-sm)' } },
          React.createElement('span', { style: { flex: 1, fontSize: 14, fontWeight: 800 } }, d.published ? 'Publicado' : 'Despublicado'), Toggle({ on: d.published, onClick: () => set('published', !d.published) }))),
      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)' } },
        !isNew && React.createElement('button', { onClick: () => { store.removeProduct(co.id, d.id); onClose(); }, style: { width: 50, height: 50, borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', display: 'grid', placeItems: 'center', cursor: 'pointer' } }, React.createElement(I, { name: 'trash', size: 20, stroke: 2 })),
        React.createElement(window.Btn, { variant: 'dark', icon: 'check', style: { flex: 1 }, disabled: !d.name.trim(), onClick: () => { store.saveProduct(co.id, d); onClose(); } }, 'Guardar')));
  }

  // ── Promociones ──
  function CoPromos({ app, co, store, onBack }) {
    const [edit, setEdit] = useState(null);
    const list = co.promos || [];
    return React.createElement('div', null, H({ title: 'Promociones', sub: list.filter((p) => p.active).length + ' activas', onBack, co }),
      React.createElement('div', scroll,
        React.createElement('button', { onClick: () => setEdit(store.blankPromo()), style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(145deg,#1b2c52,#14213d)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 14 } }, React.createElement(I, { name: 'plus', size: 18, stroke: 2.6 }), 'Nueva promoción'),
        list.length === 0 ? React.createElement(window.EmptyState, { icon: 'flame', title: 'Sin promociones', sub: 'Crea la primera.' }) :
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
            list.map((p) => React.createElement('div', { key: p.id, className: 'su-press', onClick: () => setEdit(p), style: { cursor: 'pointer', background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--neo-sm)', opacity: p.active ? 1 : .55 } },
              React.createElement('div', { style: { height: 90, position: 'relative', background: `linear-gradient(140deg, hsl(${co.hue || 210} 55% 46%), hsl(${co.hue || 210} 60% 30%))` } },
                React.createElement('image-slot', { id: p.slotId, shape: 'rect', fit: 'cover', placeholder: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } }),
                p.disc ? React.createElement('div', { style: { position: 'absolute', top: 10, left: 10 } }, React.createElement(window.Badge, { tone: 'red', solid: true }, p.disc + '% DESC.')) : null),
              React.createElement('div', { style: { padding: '11px 14px' } },
                React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, p.name || 'Sin nombre'),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 } }, (p.start || '?') + ' → ' + (p.end || '?')))))),
        edit && React.createElement(PromoEditor, { co, store, item: edit, onClose: () => setEdit(null) })));
  }
  function PromoEditor({ co, store, item, onClose }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(item)));
    const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
    const isNew = !(co.promos || []).some((p) => p.id === item.id);
    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 74, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: onClose, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16, fontWeight: 800 } }, isNew ? 'Nueva promoción' : 'Editar promoción')),
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        React.createElement('div', { style: { height: 110, borderRadius: 14, overflow: 'hidden', position: 'relative', background: `hsl(${co.hue || 210},55%,44%)`, boxShadow: 'var(--neo-sm)', marginBottom: 14 } }, React.createElement('image-slot', { id: d.slotId, shape: 'rect', fit: 'cover', placeholder: 'Imagen', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })),
        Field({ label: 'Nombre de la promoción', value: d.name, onChange: (v) => set('name', v) }),
        React.createElement('div', { style: { display: 'flex', gap: 12 } },
          React.createElement('div', { style: { flex: 1 } }, Field({ label: 'Inicio', value: d.start, onChange: (v) => set('start', v), ph: 'AAAA-MM-DD' })),
          React.createElement('div', { style: { flex: 1 } }, Field({ label: 'Fin', value: d.end, onChange: (v) => set('end', v), ph: 'AAAA-MM-DD' }))),
        React.createElement('div', { style: { width: 120 } }, Field({ label: '% Descuento', value: d.disc, onChange: (v) => set('disc', parseInt(v || '0', 10)) })),
        Field({ label: 'Descripción', value: d.desc, onChange: (v) => set('desc', v), area: true }),
        Field({ label: 'Restricciones', value: d.restric, onChange: (v) => set('restric', v), area: true }),
        Field({ label: 'Beneficio para el afiliado', value: d.beneficio, onChange: (v) => set('beneficio', v) }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 14, padding: '12px 15px', boxShadow: 'var(--neo-sm)' } },
          React.createElement('span', { style: { flex: 1, fontSize: 14, fontWeight: 800 } }, d.active ? 'Activa' : 'Inactiva'), Toggle({ on: d.active, onClick: () => set('active', !d.active) }))),
      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)' } },
        !isNew && React.createElement('button', { onClick: () => { store.removePromo(co.id, d.id); onClose(); }, style: { width: 50, height: 50, borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', display: 'grid', placeItems: 'center', cursor: 'pointer' } }, React.createElement(I, { name: 'trash', size: 20, stroke: 2 })),
        React.createElement(window.Btn, { variant: 'dark', icon: 'check', style: { flex: 1 }, disabled: !d.name.trim(), onClick: () => { store.savePromo(co.id, d); onClose(); } }, 'Guardar')));
  }

  // ── Pop-ups (flujo de aprobación) ──
  function CoPopups({ app, co, store, onBack }) {
    const [edit, setEdit] = useState(null);
    const allowed = store.planAllows(co, 'popups');
    const mine = store.myPopups(co.id);
    const stMap = { pending: ['En revisión', 'amber', 'clock'], approved: ['Aprobado', 'green', 'checkCircle'], rejected: ['Rechazado', 'red', 'close'] };
    return React.createElement('div', null, H({ title: 'Pop-ups', sub: allowed ? mine.length + ' creados' : 'No incluido en tu plan', onBack, co }),
      React.createElement('div', scroll,
        !allowed ? React.createElement('div', { style: { background: '#FFF3DC', color: '#7a5410', borderRadius: 16, padding: 16, fontSize: 13, fontWeight: 700, lineHeight: 1.5, display: 'flex', gap: 10 } }, React.createElement(I, { name: 'lock', size: 20, stroke: 2, style: { flexShrink: 0 } }), 'La administración de Pop-ups no está incluida en tu plan actual (' + CO().PLAN(co.plan).name + '). Contrata un plan Pro o Premium para habilitarla.') :
          React.createElement('div', null,
            React.createElement('div', { style: { background: '#E8F0FE', color: '#2456C7', borderRadius: 12, padding: '10px 13px', fontSize: 11.5, fontWeight: 700, lineHeight: 1.45, display: 'flex', gap: 8, marginBottom: 14 } }, React.createElement(I, { name: 'info', size: 15, stroke: 2.2, style: { flexShrink: 0, marginTop: 1 } }), 'Creas el contenido; el administrador debe aprobarlo antes de publicarse.'),
            React.createElement('button', { onClick: () => setEdit(blankCoPopup(co)), style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(145deg,#1b2c52,#14213d)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 14 } }, React.createElement(I, { name: 'plus', size: 18, stroke: 2.6 }), 'Nuevo pop-up'),
            mine.length === 0 ? React.createElement(window.EmptyState, { icon: 'message', title: 'Sin pop-ups', sub: 'Crea el primero para enviarlo a aprobación.' }) :
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
                mine.map((p) => { const s = stMap[p.status] || stMap.pending; return React.createElement('div', { key: p.id, style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 14, padding: 12, boxShadow: 'var(--neo-sm)' } },
                  React.createElement('div', { style: { width: 44, height: 44, borderRadius: 11, overflow: 'hidden', position: 'relative', background: `hsl(${p.hue || 345},60%,44%)`, flexShrink: 0 } }, React.createElement('image-slot', { id: p.slotId, shape: 'rect', fit: 'cover', placeholder: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })),
                  React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                    React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.titulo || 'Sin título'),
                    React.createElement('div', { style: { marginTop: 5 } }, React.createElement(window.Badge, { tone: s[1], icon: s[2] }, s[0]))),
                  p.status === 'rejected' && p.rejectReason ? React.createElement('span', { style: { fontSize: 11, color: '#C0341D', fontWeight: 600, maxWidth: 90, textAlign: 'right' } }, p.rejectReason) : null); }))),
        edit && React.createElement(CoPopupEditor, { co, store, item: edit, onClose: () => setEdit(null), app })));
  }
  function blankCoPopup(co) {
    const base = window.adminStore.blank('convenios');
    return { ...base, subtitulo: co.name, etiqueta: 'CONVENIO', hue: co.hue || 345, ctaText: 'Ver convenio', actionType: 'internal', actionTarget: 'convenios' };
  }
  function CoPopupEditor({ co, store, item, onClose, app }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(item)));
    const [csPreview, setCsPreview] = useState(false);
    const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
    const setCS = (patch) => setD((p) => ({ ...p, custom: { ...(p.custom || {}), ...patch } }));
    const pickAction = (t) => { if (t === 'custom' && !d.custom) setD((p) => ({ ...p, actionType: 'custom', custom: { slotId: 'cs_img_' + Math.random().toString(36).slice(2, 8), etiqueta: '', titulo: '', texto: '', botones: [] } })); else set('actionType', t); };
    const submit = async () => { try { await store.submitPopup(co.id,d); app.toast('Pop-up enviado a aprobación'); onClose(); } catch (_) { app.toast('No se pudo enviar el pop-up'); } };
    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 74, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: onClose, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16, fontWeight: 800 } }, 'Nuevo pop-up')),
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        React.createElement('div', { style: { height: 130, borderRadius: 14, overflow: 'hidden', position: 'relative', background: `linear-gradient(150deg, hsl(${d.hue},70%,42%), hsl(${d.hue},65%,26%))`, boxShadow: 'var(--neo-sm)', marginBottom: 14 } }, React.createElement('image-slot', { id: d.slotId, shape: 'rect', fit: 'cover', placeholder: 'Imagen de cabecera', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })),
        Field({ label: 'Título', value: d.titulo, onChange: (v) => set('titulo', v) }),
        Field({ label: 'Descripción', value: d.contenido, onChange: (v) => set('contenido', v), area: true }),
        Field({ label: 'Texto del botón', value: d.ctaText, onChange: (v) => set('ctaText', v) }),
        React.createElement('div', { style: { marginBottom: 14 } }, React.createElement('label', { style: lbl }, 'Acción del botón'),
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 } },
            [['internal', 'Pantalla'], ['custom', 'Nueva pantalla'], ['url', 'Enlace'], ['none', 'Ninguna']].map((o) => React.createElement('button', { key: o[0], onClick: () => pickAction(o[0]), style: { height: 40, borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, background: d.actionType === o[0] ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: d.actionType === o[0] ? '#fff' : 'var(--ink-2)' } }, o[1])))),
        d.actionType === 'internal' && React.createElement('div', { style: { position: 'relative', marginBottom: 14 } },
          React.createElement('select', { value: d.actionTarget || '', onChange: (e) => set('actionTarget', e.target.value), style: { ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 40, cursor: 'pointer' } },
            (window.ADMIN.NAV_TARGETS || []).map((s) => React.createElement('option', { key: s.id, value: s.id }, s.label))),
          React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } })),
        d.actionType === 'url' && Field({ label: 'URL externa', value: d.actionTarget, onChange: (v) => set('actionTarget', v), ph: 'https://…' }),
        d.actionType === 'custom' && window.CustomScreenBuilder && React.createElement(window.CustomScreenBuilder, { cs: d.custom || {}, hue: d.hue, setCS, onPreview: () => setCsPreview(true) }),
        React.createElement('div', { style: { display: 'flex', gap: 12 } },
          React.createElement('div', { style: { flex: 1 } }, Field({ label: 'Publicar desde', value: d.startDate, onChange: (v) => set('startDate', v), ph: 'AAAA-MM-DD' })),
          React.createElement('div', { style: { flex: 1 } }, Field({ label: 'Hasta', value: d.endDate, onChange: (v) => set('endDate', v), ph: 'AAAA-MM-DD' })))),
      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)' } },
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
        React.createElement(window.Btn, { variant: 'dark', icon: 'upload', style: { flex: 2 }, disabled: !d.titulo.trim(), onClick: submit }, 'Enviar a aprobación')),
      csPreview && window.CustomScreenView && React.createElement(window.CustomScreenView, { screen: d.custom, hue: d.hue, preview: true, onClose: () => setCsPreview(false) }));
  }

  // ── Solicitudes vía nómina ──
  function CoSolicitudes({ app, co, store, onBack }) {
    const [f, setF] = useState('todas');
    const [open, setOpen] = useState(null);
    const all = store.solicitudes(co.id);
    const list = f === 'todas' ? all : all.filter((s) => s.estado === f);
    return React.createElement('div', null, H({ title: 'Solicitudes vía nómina', sub: all.length + ' totales', onBack, co }),
      React.createElement('div', scroll,
        React.createElement('div', { style: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' } },
          [['todas', 'Todas']].concat(CO().ESTADOS.map((e) => [e.id, e.label])).map((o) => React.createElement('button', { key: o[0], onClick: () => setF(o[0]), style: { flexShrink: 0, height: 34, padding: '0 13px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: f === o[0] ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: f === o[0] ? '#fff' : 'var(--ink-2)' } }, o[1]))),
        list.length === 0 ? React.createElement(window.EmptyState, { icon: 'receipt', title: 'Sin solicitudes', sub: 'No hay solicitudes en este estado.' }) :
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            list.map((s) => { const e = CO().ESTADO(s.estado); return React.createElement('button', { key: s.id, onClick: () => setOpen(s.id), style: { textAlign: 'left', background: 'var(--surface)', borderRadius: 14, padding: 13, boxShadow: 'var(--neo-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                React.createElement('span', { style: { flex: 1, fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, s.nombre),
                React.createElement(window.Badge, { tone: e.tone, icon: e.icon }, e.label)),
              React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 4 } }, s.item + ' · ' + window.money(s.importe)),
              React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3 } }, s.sindicato + ' · ' + s.categoria + ' · ' + s.fecha)); })),
        open && React.createElement(SolicitudSheet, { store, s: store.solicitudes(co.id).find((x) => x.id === open), onClose: () => setOpen(null) })));
  }
  function SolicitudSheet({ store, s, onClose }) {
    const [cmt, setCmt] = useState('');
    if (!s) return null;
    const row = (k, v) => React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--hairline)' } }, React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 } }, k), React.createElement('span', { style: { fontSize: 13, color: 'var(--ink)', fontWeight: 700, textAlign: 'right' } }, v));
    return React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, zIndex: 76, background: 'rgba(16,12,14,.5)', display: 'flex', alignItems: 'flex-end' } },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '90%', overflowY: 'auto' } },
        React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
        React.createElement('div', { style: { fontSize: 18, fontWeight: 900, marginBottom: 12 } }, s.nombre),
        row('Sindicato', s.sindicato), row('Categoría laboral', s.categoria), row('Producto/servicio', s.item), row('Importe', window.money(s.importe)), row('Fecha', s.fecha),
        React.createElement('div', { style: { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', margin: '16px 0 8px' } }, 'Cambiar estado'),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          CO().ESTADOS.map((e) => React.createElement('button', { key: e.id, onClick: () => store.setEstado(s.id, e.id), style: { height: 34, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: s.estado === e.id ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: s.estado === e.id ? '#fff' : 'var(--ink-2)' } }, e.label))),
        React.createElement('div', { style: { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', margin: '18px 0 8px' } }, 'Comentarios internos'),
        (s.comentarios || []).map((c, i) => React.createElement('div', { key: i, style: { background: 'var(--surface-2)', borderRadius: 11, padding: '9px 12px', fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 8 } }, c.texto)),
        React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 4 } },
          React.createElement('input', { value: cmt, placeholder: 'Agregar comentario…', onChange: (e) => setCmt(e.target.value), style: { ...inputBase, flex: 1, padding: '11px 13px' } }),
          React.createElement('button', { onClick: () => { if (cmt.trim()) { store.addComentario(s.id, cmt); setCmt(''); } }, style: { width: 46, borderRadius: 12, border: 'none', background: 'linear-gradient(145deg,#1b2c52,#14213d)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: 'arrowR', size: 20, stroke: 2.4 })))));
  }

  // ── Cotizaciones (solicitudes de interés → cargar presupuesto) ──
  function CoCotizaciones({ app, co, store, onBack }) {
    const qs = window.useQuoteStore();
    const [open, setOpen] = useState(null);
    const list = qs.forCompany(co.id).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const pend = list.filter((r) => r.estado === 'solicitada').length;
    return React.createElement('div', null, H({ title: 'Cotizaciones', sub: pend + ' por cargar · ' + list.length + ' totales', onBack, co }),
      React.createElement('div', scroll,
        React.createElement('div', { style: { background: '#E8F0FE', color: '#2456C7', borderRadius: 12, padding: '10px 13px', fontSize: 11.5, fontWeight: 700, lineHeight: 1.45, display: 'flex', gap: 8, marginBottom: 14 } }, React.createElement(I, { name: 'info', size: 15, stroke: 2.2, style: { flexShrink: 0, marginTop: 1 } }), 'Los afiliados interesados en tus servicios de precio variable envían una solicitud. Carga aquí la cotización: el afiliado será notificado y podrá simular su financiamiento con ese monto.'),
        list.length === 0 ? React.createElement(window.EmptyState, { icon: 'doc', title: 'Sin solicitudes de cotización', sub: 'Cuando un afiliado muestre interés, aparecerá aquí.' }) :
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            list.map((r) => { const e = window.COTIZA.ESTADO(r.estado); return React.createElement('button', { key: r.id, onClick: () => setOpen(r.id), style: { textAlign: 'left', background: 'var(--surface)', borderRadius: 14, padding: 13, boxShadow: 'var(--neo-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                React.createElement('span', { style: { flex: 1, fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, r.usuario.nombre),
                React.createElement(window.Badge, { tone: e.tone, icon: e.icon }, e.label)),
              React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 4 } }, r.productoNombre + (r.cotizacion ? ' · ' + window.money(r.cotizacion.monto) : '')),
              React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3 } }, r.folio + ' · ' + r.fechaHora)); })),
        open && React.createElement(CotizarSheet, { r: qs.get(open), actor: co.name, onClose: () => setOpen(null), toast: app.toast })));
  }
  function CotizarSheet({ r, actor, onClose, toast }) {
    const [monto, setMonto] = useState('');
    const [nota, setNota] = useState('');
    const [vig, setVig] = useState('15 días');
    if (!r) return null;
    const row = (k, v) => React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--hairline)' } }, React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 } }, k), React.createElement('span', { style: { fontSize: 13, color: 'var(--ink)', fontWeight: 700, textAlign: 'right' } }, v));
    const enviar = async () => { const m = parseFloat(monto); if (!m || m <= 0) return; await window.quoteStore.cotizar(r.id, { monto: m, nota: nota.trim(), vigencia: vig }, actor); toast && toast('Cotización enviada al afiliado'); onClose(); };
    return React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, zIndex: 76, background: 'rgba(16,12,14,.5)', display: 'flex', alignItems: 'flex-end' } },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '90%', overflowY: 'auto' } },
        React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
        React.createElement('div', { style: { fontSize: 18, fontWeight: 900, marginBottom: 12 } }, 'Cotización ' + r.folio),
        row('Afiliado', r.usuario.nombre), row('Sindicato', r.usuario.sindicato), row('Servicio', r.productoNombre), row('Fecha de solicitud', r.fechaHora),
        r.mensaje && React.createElement('div', { style: { background: 'var(--surface-2)', borderRadius: 11, padding: '9px 12px', fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginTop: 10, lineHeight: 1.45 } }, '“' + r.mensaje + '”'),
        r.estado === 'cotizada'
          ? React.createElement('div', { style: { background: '#E7F6ED', borderRadius: 13, padding: '12px 14px', marginTop: 14 } },
            React.createElement('div', { style: { fontSize: 12, fontWeight: 800, color: '#0b5c37' } }, 'COTIZACIÓN ENVIADA'),
            React.createElement('div', { style: { fontSize: 22, fontWeight: 900, color: '#0b5c37', marginTop: 3 } }, window.money((r.cotizacion || {}).monto || 0)),
            React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: '#13794A', marginTop: 2 } }, (r.cotizacion || {}).fechaHora + ' · Vigencia ' + ((r.cotizacion || {}).vigencia || '')))
          : React.createElement('div', { style: { marginTop: 16 } },
            React.createElement('label', { style: lbl }, 'Monto cotizado (MXN)'),
            React.createElement('input', { type: 'number', value: monto, placeholder: 'Ej. 24500', onChange: (e) => setMonto(e.target.value), style: { ...inputBase, marginBottom: 12 } }),
            React.createElement('label', { style: lbl }, 'Vigencia'),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 12 } },
              ['7 días', '15 días', '30 días'].map((v) => React.createElement('button', { key: v, onClick: () => setVig(v), style: { flex: 1, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, background: vig === v ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: vig === v ? '#fff' : 'var(--ink-2)' } }, v))),
            React.createElement('label', { style: lbl }, 'Nota (opcional)'),
            React.createElement('textarea', { value: nota, rows: 2, placeholder: 'Detalle de lo cotizado…', onChange: (e) => setNota(e.target.value), style: { ...inputBase, resize: 'vertical', lineHeight: 1.5, marginBottom: 14 } }),
            React.createElement(window.Btn, { full: true, variant: 'dark', icon: 'upload', disabled: !parseFloat(monto), onClick: enviar }, 'Cargar cotización y notificar'))));
  }

  // ── Estadísticas ──
  function CoStats({ app, co, store, onBack }) {
    const st = co.stats || {};
    const operations = store.solicitudes(co.id);
    const prods = (co.products || []).slice().map((p) => ({ name: p.name, v: operations.filter((r) => r.product_id === p.id).length }));
    const max = Math.max.apply(null, prods.map((p) => p.v).concat([1]));
    const bar = (name, v, tone) => React.createElement('div', { style: { marginBottom: 12 } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 5 } }, React.createElement('span', { style: { color: 'var(--ink)' } }, name), React.createElement('span', { style: { color: 'var(--ink-3)' } }, v)),
      React.createElement('div', { style: { height: 9, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' } }, React.createElement('div', { style: { width: Math.round((v / max) * 100) + '%', height: '100%', borderRadius: 999, background: tone || 'var(--grad-guinda-soft)' } })));
    const card = (t, children) => React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: 16, boxShadow: 'var(--neo-sm)', marginBottom: 14 } }, React.createElement('div', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--ink)', marginBottom: 12 } }, t), children);
    return React.createElement('div', null, H({ title: 'Estadísticas', sub: 'Rendimiento de tu empresa', onBack, co }),
      React.createElement('div', scroll,
        card('Solicitudes por producto', prods.length ? prods.map((p) => bar(p.name || '—', p.v)) : React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 } }, 'Aún no hay productos con solicitudes.')),
        card('Interacción', [
          bar('Solicitudes recibidas', st.solicitudes || 0, 'linear-gradient(90deg,#2456C7,#1b2c52)'),
          bar('Cotizaciones recibidas', st.cotizaciones || 0, 'linear-gradient(90deg,#C8922F,#9A6B16)'),
          bar('Promociones activas', (co.promos || []).filter((p) => p.active).length, 'linear-gradient(90deg,#13794A,#0b5c37)'),
        ]),
        card('Operaciones comerciales', React.createElement('div', { style: { textAlign: 'center', padding: '6px 0' } },
          React.createElement('div', { style: { fontSize: 40, fontWeight: 900, color: 'var(--guinda)', letterSpacing: '-.03em' } }, (st.solicitudes || 0) + (st.cotizaciones || 0)),
          React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' } }, 'solicitudes y cotizaciones registradas en Supabase'))),
        React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, textAlign: 'center', lineHeight: 1.5 } }, store.planAllows(co, 'statsHistory') ? 'Historial mensual de actividad incluido en tu plan ' + window.COMPANY.PLAN(co.plan).name + '.' : 'Historial mensual de actividad disponible con un plan superior.')));
  }

  // ── Notificaciones ──
  function CoNotifs({ app, co, store, onBack }) {
    const list = store.notifs(co.id);
    const tones = { guinda: ['var(--guinda-50)', 'var(--guinda)'], green: ['#E7F6ED', '#13794A'], amber: ['#FFF3DC', '#9A6B16'], blue: ['#E8F0FE', '#2456C7'], red: ['#FDEAEA', '#C0341D'] };
    return React.createElement('div', null, H({ title: 'Notificaciones', sub: list.length + ' avisos', onBack, co }),
      React.createElement('div', scroll,
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          list.map((n, i) => { const t = tones[n.tone] || tones.guinda; return React.createElement('div', { key: i, style: { display: 'flex', gap: 12, background: 'var(--surface)', borderRadius: 14, padding: 13, boxShadow: 'var(--neo-sm)' } },
            React.createElement('div', { style: { width: 42, height: 42, borderRadius: 12, background: t[0], color: t[1], display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: n.icon, size: 21, stroke: 2 })),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, n.title),
              React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 2, lineHeight: 1.4 } }, n.body))); }))));
  }

  // ── Bitácora ──
  function CoBitacora({ app, co, store, onBack }) {
    const logs = (window.adminStore && window.adminStore.auditLog) ? window.adminStore.auditLog(co.name).concat(window.adminStore.auditLog('Empresa')).filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => y.ts - x.ts).slice(0, 60) : [];
    return React.createElement('div', null, H({ title: 'Bitácora de auditoría', sub: 'Registro de actividad', onBack, co }),
      React.createElement('div', scroll,
        logs.length === 0 ? React.createElement(window.EmptyState, { icon: 'doc', title: 'Sin registros', sub: 'Las acciones aparecerán aquí.' }) :
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            logs.map((e, i) => React.createElement('div', { key: i, style: { display: 'flex', gap: 11, background: 'var(--surface)', borderRadius: 12, padding: '11px 13px', boxShadow: 'var(--neo-sm)' } },
              React.createElement('div', { style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--guinda)', marginTop: 6, flexShrink: 0 } }),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: 800, color: 'var(--ink)' } }, e.action),
                e.detail && React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-2)', fontWeight: 500, marginTop: 1 } }, e.detail),
                React.createElement('div', { style: { fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3 } }, e.actor + ' · ' + new Date(e.ts).toLocaleString('es-MX'))))))));
  }

  Object.assign(window, { CoEmpresa, CoProductos, CoPromos, CoPopups, CoSolicitudes, CoCotizaciones, CoStats, CoNotifs, CoBitacora });
})();
