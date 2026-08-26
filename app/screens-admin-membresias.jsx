/* screens-admin-membresias.jsx — Panel Administrativo · Membresías.
   CRUD (crear, editar, eliminar, activar/desactivar) sobre membresías:
   empresa, concepto, logotipo, monto y pagos. La app consume las activas.
   Exporta window.MembresiasModule. */
(function () {
  const { useState, useEffect } = React;
  const I = window.Icon;
  const money = (n) => (window.money ? window.money(n) : '$' + n);

  function useStore() {
    const [, force] = useState(0);
    useEffect(() => window.membershipStore.subscribe(() => force((n) => n + 1)), []);
    return window.membershipStore;
  }

  function Logo({ src, size, radius }) {
    const [err, setErr] = useState(false);
    if (!src || err) return React.createElement('div', { style: { width: size, height: size, borderRadius: radius || 13, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'card', size: size * .45, stroke: 2 }));
    return React.createElement('div', { style: { width: size, height: size, borderRadius: radius || 13, background: '#fff', boxShadow: 'var(--neo-inset)', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 } },
      React.createElement('img', { src, alt: '', onError: () => setErr(true), style: { width: '86%', height: '86%', objectFit: 'contain' } }));
  }

  function MembresiasModule({ app, onBack, header }) {
    const store = useStore();
    const A = window.AdminRepository;
    const [editing, setEditing] = useState(null);
    const P = { crear: A.has('memberships.write'), editar: A.has('memberships.write'), eliminar: A.has('memberships.write') };
    const list = store.all();
    const activas = list.filter((m) => m.activo).length;
    const montoTotal = list.filter((m) => m.activo).reduce((s, m) => s + m.monto, 0);

    const kpi = (icon, n, label, accent) => React.createElement('div', { style: { flex: 1, background: accent ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: accent ? '#fff' : 'var(--ink)', borderRadius: 15, padding: '12px 13px', boxShadow: accent ? 'var(--glow-guinda)' : 'var(--neo-sm)' } },
      React.createElement(I, { name: icon, size: 18, stroke: 2, style: { opacity: accent ? .9 : .5 } }),
      React.createElement('div', { style: { fontSize: 19, fontWeight: 900, marginTop: 5, letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, n),
      React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, opacity: accent ? .9 : .6, marginTop: 1 } }, label));

    return React.createElement('div', null,
      header({ title: 'Membresías', sub: activas + ' activa(s) de ' + list.length, onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        store.state().phase==='loading'&&React.createElement('div',{'data-memberships-state':'loading',style:{padding:14,textAlign:'center',fontWeight:700,color:'var(--ink-3)'}},'Cargando membresías…'),
        store.state().phase==='error'&&React.createElement('div',{'data-memberships-state':'error',style:{padding:14,textAlign:'center',fontWeight:700,color:'#A32921'}},'No fue posible cargar el catálogo. ',React.createElement('button',{onClick:store.retry},'Reintentar')),
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 14 } },
          kpi('card', list.length, 'Membresías'),
          kpi('checkCircle', activas, 'Activas', true),
          kpi('cash', money(montoTotal).replace(/\.00$/, ''), 'Monto en catálogo')),
        React.createElement('div', { style: { background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 } },
          React.createElement(I, { name: 'info', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } }, 'Las membresías ', React.createElement('b', null, 'activas'), ' se muestran automáticamente en la página de Finanzas de la app. Los cambios se reflejan al instante.')),
        P.crear && React.createElement(window.Btn, { full: true, icon: 'plus', onClick: () => setEditing(store.blank()), style: { marginBottom: 16 } }, 'Nueva membresía'),
        list.length === 0
          ? React.createElement(window.EmptyState, { icon: 'card', title: 'Sin membresías', sub: 'Crea la primera membresía para mostrarla en la app.' })
          : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
            list.map((m) => React.createElement('div', { key: m.id, style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 16, padding: 13, boxShadow: 'var(--neo-sm)', opacity: m.activo ? 1 : .55 } },
              React.createElement(Logo, { src: m.logo, size: 48 }),
              React.createElement('div', { className: 'su-press', style: { flex: 1, minWidth: 0, cursor: P.editar ? 'pointer' : 'default' }, onClick: () => P.editar && setEditing(Object.assign({}, m)) },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
                  React.createElement('span', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, m.empresa),
                  !m.activo && React.createElement('span', { style: { fontSize: 9.5, fontWeight: 800, color: 'var(--ink-3)', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', padding: '3px 7px', borderRadius: 999, flexShrink: 0 } }, 'INACTIVA')),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, m.concepto),
                React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--guinda)', marginTop: 4 } }, money(m.monto), React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' } }, '  ·  ' + m.pagos + ' pago(s)'))),
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0, alignItems: 'center' } },
                React.createElement(window.Toggle, { on: m.activo, size: 'md', onClick: () => P.editar && store.toggle(m.id).catch(()=>app.toast('No se pudo actualizar')), 'aria-label': m.activo ? 'Desactivar' : 'Activar', disabled: !P.editar, glow: false, }),
                P.eliminar && m.record_origin==='ADMIN_PHASE4' && React.createElement('button', { onClick: async() => { if (confirm('¿Eliminar la membresía de ' + m.empresa + '?')) { try{await store.remove(m.id);app.toast&&app.toast('Membresía eliminada');}catch(_){app.toast&&app.toast('No se pudo eliminar');} } }, 'aria-label': 'Eliminar', style: { width: 32, height: 32, borderRadius: 10, border: 'none', background: '#FDEAEA', color: '#C0392B', display: 'grid', placeItems: 'center', cursor: 'pointer' } }, React.createElement(I, { name: 'trash', size: 15, stroke: 2 }))))))),
      editing && React.createElement(Editor, { app, store, m: editing, onClose: () => setEditing(null) }));
  }

  function Editor({ app, store, m, onClose }) {
    const [d, setD] = useState(m);
    const [logoFile,setLogoFile]=useState(null);const[busy,setBusy]=useState(false);
    const [okSave, runSave] = window.useBtnConfirm();
    const set = (k, v) => setD((p) => Object.assign({}, p, { [k]: v }));
    const isNew = !!m._new;
    const valid = d.empresa.trim() && d.concepto.trim() && +d.monto > 0 && parseInt(d.pagos, 10) >= 1;
    const inputStyle = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };
    const lbl = (t) => React.createElement('label', { style: { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', display: 'block', margin: '14px 0 7px' } }, t);
    const pickFile = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return;setLogoFile(f); const r = new FileReader(); r.onload = () => set('logo', r.result); r.readAsDataURL(f); };
    const save = async() => {let asset=null;setBusy(true);try{const rec=Object.assign({},d);delete rec._new;if(logoFile){asset=await store.uploadLogo(logoFile);rec.logo_asset_id=asset.id;}await store.save(rec);app.toast&&app.toast(isNew?'Membresía creada':'Cambios guardados');onClose();}catch(_){if(asset)await window.AdminRepository.discardAsset(asset).catch(()=>{});app.toast&&app.toast('No se pudo guardar');}finally{setBusy(false);} };

    return React.createElement('div', { onClick: onClose, style: { position: 'fixed', inset: 0, zIndex: 76, background: 'rgba(16,12,14,.5)', display: 'flex', alignItems: 'flex-end' } },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '90%', overflowY: 'auto' } },
        React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
        React.createElement('div', { style: { fontSize: 18, fontWeight: 900 } }, isNew ? 'Nueva membresía' : 'Editar membresía'),
        lbl('Empresa'),
        React.createElement('input', { value: d.empresa, placeholder: 'Nombre de la empresa', onChange: (e) => set('empresa', e.target.value), style: inputStyle }),
        lbl('Concepto'),
        React.createElement('input', { value: d.concepto, placeholder: 'Ej. Vales, Solicitud de membresía…', onChange: (e) => set('concepto', e.target.value), style: inputStyle }),
        lbl('Logotipo'),
        React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'center' } },
          React.createElement(Logo, { src: d.logo, size: 62, radius: 16 }),
          React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 } },
            React.createElement('input', { value: (d.logo || '').startsWith('data:') ? '(imagen lista para subir)' : (d.logo?'Imagen guardada':''), placeholder: 'Sin imagen', readOnly:true, style: inputStyle }),
            React.createElement('label', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', height: 34, padding: '0 13px', borderRadius: 999, background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', fontSize: 12.5, fontWeight: 700, color: 'var(--guinda)', cursor: 'pointer' } },
              React.createElement(I, { name: 'upload', size: 15, stroke: 2.2 }), 'Subir imagen',
              React.createElement('input', { type: 'file', accept: 'image/*', onChange: pickFile, style: { display: 'none' } })))),
        React.createElement('div', { style: { display: 'flex', gap: 12 } },
          React.createElement('div', { style: { flex: 1.4 } },
            lbl('Monto (MXN)'),
            React.createElement('input', { type: 'number', min: 0, step: '0.01', value: d.monto || '', placeholder: '0.00', onChange: (e) => set('monto', e.target.value), style: inputStyle })),
          React.createElement('div', { style: { flex: 1 } },
            lbl('Pagos'),
            React.createElement('input', { type: 'number', min: 1, step: 1, value: d.pagos, onChange: (e) => set('pagos', e.target.value), style: inputStyle }))),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 11, marginTop: 16, background: 'var(--surface-2)', borderRadius: 13, padding: '11px 13px', boxShadow: 'var(--neo-inset)' } },
          React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, 'Membresía activa'),
          React.createElement(window.Toggle, { on: d.activo, size: 'md', onClick: () => set('activo', !d.activo), 'aria-label': 'toggle activa', glow: false, })),
        React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 18 } },
          React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
          React.createElement(window.Btn, { icon: 'check', success: okSave, style: { flex: 2 }, disabled: !valid||busy, onClick: () => runSave(save) }, busy?'Guardando…':isNew ? 'Crear membresía' : 'Guardar cambios'))));
  }

  window.MembresiasModule = MembresiasModule;
})();
