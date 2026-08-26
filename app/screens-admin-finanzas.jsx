/* screens-admin-finanzas.jsx — Panel de Finanzas (base). Concentra TODAS las
   solicitudes de financiamiento enviadas por los usuarios tras simular un
   producto/servicio con descuento vía nómina. Vincula por ID usuario, empresa,
   programa/convenio, producto y simulación. Visualizar, administrar y dar
   seguimiento. Exporta window.FinanzasModule. */
(function () {
  const { useState, useEffect } = React;
  const I = window.Icon;
  const F = () => window.financeStore;
  const money = (n) => (window.money ? window.money(n) : '$' + n);

  function useStore() {
    const [, force] = useState(0);
    useEffect(() => F().subscribe(() => force((n) => n + 1)), []);
    return F();
  }

  function EstadoBadge({ estado }) {
    const e = window.FINANZAS.ESTADO(estado);
    return React.createElement(window.Badge, { tone: e.tone, icon: e.icon }, e.label);
  }

  function FinanzasModule({ app, onBack, header }) {
    const store = useStore();
    const qs = window.useQuoteStore ? window.useQuoteStore() : null;
    const [tab, setTab] = useState('sols');       // 'sols' | 'cots'
    const [openId, setOpenId] = useState(null);
    const [filter, setFilter] = useState('all');

    if (openId) { const r = store.get(openId); if (r) return React.createElement(RequestDetail, { app, r, onBack: () => setOpenId(null), header }); }

    const all = store.all();
    const list = store.byEstado(filter).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const montoTotal = all.reduce((s, r) => s + (r.simulacion.montoSolicitado || 0), 0);
    const chips = [{ id: 'all', label: 'Todas' }].concat(window.FINANZAS.ESTADOS.map((e) => ({ id: e.id, label: e.label })));
    const cotPend = qs ? qs.pendientes() : 0;
    const source=store.state?store.state():{phase:'loaded'};

    const segBtn = (id, label, badge) => React.createElement('button', { key: id, onClick: () => setTab(id), style: { flex: 1, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: tab === id ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: tab === id ? '#fff' : 'var(--ink-2)', boxShadow: tab === id ? 'var(--glow-guinda)' : 'var(--neo-sm)' } },
      label, badge ? React.createElement('span', { style: { minWidth: 19, height: 19, borderRadius: 999, background: tab === id ? 'rgba(255,255,255,.25)' : 'var(--guinda)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px' } }, badge) : null);

    return React.createElement('div', { 'data-admin-view':'finanzas' },
      header({ title: 'Finanzas · Solicitudes', sub: all.length + ' solicitud(es) · ' + (qs ? qs.all().length : 0) + ' cotización(es)', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 16 } },
          segBtn('sols', 'Financiamientos', store.pendientes() || null),
          segBtn('cots', 'Cotizaciones', cotPend || null)),
        source.phase==='error' ? React.createElement(window.EmptyState,{icon:'warning',title:'No fue posible cargar solicitudes',sub:'La fuente productiva no respondió.',actionLabel:'Reintentar',onAction:()=>store.retry()}) :
        source.phase==='loading' ? React.createElement(window.EmptyState,{icon:'clock',title:'Cargando solicitudes',sub:'Consultando información vigente.'}) :
        tab === 'cots' ? React.createElement(CotizacionesAdmin, { qs, app }) : React.createElement(React.Fragment, null,
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 14 } },
          kpi('receipt', all.length, 'Recibidas'),
          kpi('clock', store.pendientes(), 'Pendientes', true),
          kpi('cash', money(montoTotal).replace(/\.00$/, ''), 'Monto solicitado')),
        React.createElement('div', { style: { background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 } },
          React.createElement(I, { name: 'info', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } }, 'El ', React.createElement('b', null, 'Panel de Finanzas'), ' concentra las solicitudes enviadas desde la app, vinculadas al usuario, empresa, programa y simulación.')),
        React.createElement('div', { style: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' } },
          chips.map((c) => React.createElement('button', { key: c.id, onClick: () => setFilter(c.id), style: { flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: filter === c.id ? 'var(--guinda)' : 'var(--surface)', color: filter === c.id ? '#fff' : 'var(--ink-2)', boxShadow: filter === c.id ? 'none' : 'var(--neo-sm)' } }, c.label))),
        list.length === 0
          ? React.createElement(window.EmptyState, { icon: 'receipt', title: 'Sin solicitudes', sub: 'Cuando un afiliado envíe una solicitud tras simular, aparecerá aquí.' })
          : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
            list.map((r) => React.createElement('button', {
              key: r.id, onClick: () => setOpenId(r.id),
              style: { display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', background: 'var(--surface)', border: 'none', borderRadius: 16, padding: 14, boxShadow: 'var(--neo-sm)', cursor: 'pointer', fontFamily: 'inherit' },
            },
              React.createElement('div', { style: { width: 46, height: 46, borderRadius: 13, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: r.icon || 'cash', size: 23, stroke: 2 })),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
                  React.createElement('span', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, r.productoNombre || r.programa || 'Préstamo'),
                  React.createElement('span', { style: { fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, fontFamily: 'var(--mono)', flexShrink: 0 } }, r.folio)),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, r.usuario.nombre + ' · ' + r.usuario.sindicato),
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 } },
                  React.createElement('span', { style: { fontSize: 15, fontWeight: 800, color: 'var(--guinda)' } }, money(r.simulacion.montoSolicitado)),
                  React.createElement(EstadoBadge, { estado: r.estado }))))))
      )));
  }

  // ── Cotizaciones: solicitudes de interés + configuración de servicios ──
  function CotizacionesAdmin({ qs, app }) {
    const [open, setOpen] = useState(null);
    const [monto, setMonto] = useState('');
    const [nota, setNota] = useState('');
    const list = qs.all().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const items = [];
    // F1.2 — autoridad finCatStore; DATA.finanzasGroups solo como arranque controlado.
    ((window.finCatStore && window.finCatStore.allItems) ? window.finCatStore.allItems()
      : ((window.DATA && window.DATA.finanzasGroups) || []).reduce((a, g) => a.concat(g.items || []), [])
    ).forEach((it) => items.push(it));
    const r = open ? qs.get(open) : null;

    const cargar = async () => { const m = parseFloat(monto); if (!r || !m || m <= 0) return; try{await qs.cotizar(r.id, { monto: m, nota: nota.trim() }, 'Área de Finanzas');setOpen(null);setMonto('');setNota('');app.toast&&app.toast('Cotización cargada y notificada');}catch(_){app.toast&&app.toast('No se pudo guardar la cotización');} };

    return React.createElement('div', null,
      React.createElement('div', { style: { background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 } },
        React.createElement(I, { name: 'info', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
        React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } }, 'Servicios con ', React.createElement('b', null, 'cotización previa'), ': el afiliado solicita, el proveedor (o Finanzas) cotiza, y solo entonces se habilita el simulador con el monto real.')),

      // Config: switch por servicio del catálogo
      React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '13px 15px', boxShadow: 'var(--neo-sm)', marginBottom: 16 } },
        React.createElement('div', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 } }, 'Requieren cotización previa'),
        React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 10, lineHeight: 1.45 } }, 'Actívalo para servicios sin precio fijo. Con el switch apagado, el afiliado simula de inmediato.'),
        items.map((it) => React.createElement('div', { key: it.id, style: { display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderBottom: '1px solid var(--hairline)' } },
          React.createElement('div', { style: { width: 32, height: 32, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: it.icon, size: 17, stroke: 2 })),
          React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, it.label),
          React.createElement(window.Toggle, { on: qs.requiresQuote(it.id), size: 'md', disabled:true, 'aria-label': 'Configuración de catálogo en solo lectura', glow: false, })))),

      // Listado de solicitudes de cotización
      React.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '0 0 10px' } }, 'SOLICITUDES DE COTIZACIÓN'),
      list.length === 0
        ? React.createElement(window.EmptyState, { icon: 'doc', title: 'Sin solicitudes', sub: 'Cuando un afiliado pida cotización, aparecerá aquí.' })
        : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          list.map((c) => { const e = window.COTIZA.ESTADO(c.estado); return React.createElement('button', { key: c.id, onClick: () => { setOpen(c.id); setMonto(''); setNota(''); }, style: { textAlign: 'left', background: 'var(--surface)', borderRadius: 14, padding: 13, boxShadow: 'var(--neo-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement('span', { style: { flex: 1, fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, c.productoNombre),
              React.createElement(window.Badge, { tone: e.tone, icon: e.icon }, e.label)),
            React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 4 } }, c.usuario.nombre + ' · ' + (c.empresaNombre ? 'Atiende: ' + c.empresaNombre : 'Atiende: Finanzas') + (c.cotizacion ? ' · ' + money(c.cotizacion.monto) : '')),
            React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3 } }, c.folio + ' · ' + c.fechaHora)); })),

      // Detalle / captura de cotización
      r && React.createElement('div', { onClick: () => setOpen(null), style: { position: 'fixed', inset: 0, zIndex: 76, background: 'rgba(16,12,14,.5)', display: 'flex', alignItems: 'flex-end' } },
        React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '88%', overflowY: 'auto' } },
          React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
          React.createElement('div', { style: { fontSize: 18, fontWeight: 900, marginBottom: 12 } }, 'Cotización ' + r.folio),
          [['Afiliado', r.usuario.nombre], ['Servicio', r.productoNombre], ['Proveedor asignado', r.empresaNombre || 'Área de Finanzas'], ['Fecha', r.fechaHora]].map((x) => React.createElement('div', { key: x[0], style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--hairline)' } },
            React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 } }, x[0]),
            React.createElement('span', { style: { fontSize: 13, color: 'var(--ink)', fontWeight: 700, textAlign: 'right' } }, x[1]))),
          r.mensaje && React.createElement('div', { style: { background: 'var(--surface-2)', borderRadius: 11, padding: '9px 12px', fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginTop: 10, lineHeight: 1.45 } }, '“' + r.mensaje + '”'),
          r.estado === 'cotizada'
            ? React.createElement('div', { style: { background: '#E7F6ED', borderRadius: 13, padding: '12px 14px', marginTop: 14 } },
              React.createElement('div', { style: { fontSize: 12, fontWeight: 800, color: '#0b5c37' } }, 'COTIZACIÓN CARGADA'),
              React.createElement('div', { style: { fontSize: 22, fontWeight: 900, color: '#0b5c37', marginTop: 3 } }, money((r.cotizacion || {}).monto || 0)),
              React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: '#13794A', marginTop: 2 } }, 'Por ' + ((r.cotizacion || {}).actor || '') + ' · ' + ((r.cotizacion || {}).fechaHora || '')))
            : React.createElement('div', { style: { marginTop: 14 } },
              r.empresaNombre && React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 10, lineHeight: 1.45 } }, 'Normalmente ' + r.empresaNombre + ' carga la cotización desde su Panel Empresarial; Finanzas puede capturarla en su nombre.'),
              React.createElement('input', { type: 'number', value: monto, placeholder: 'Monto cotizado (MXN)', onChange: (e) => setMonto(e.target.value), style: { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 10 } }),
              React.createElement('input', { value: nota, placeholder: 'Nota (opcional)', onChange: (e) => setNota(e.target.value), style: { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 12 } }),
              React.createElement(window.Btn, { full: true, icon: 'upload', disabled: !parseFloat(monto), onClick: cargar }, 'Cargar cotización y notificar')))));
  }
  function kpi(icon, n, label, accent) {
    return React.createElement('div', { style: { flex: 1, background: accent ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: accent ? '#fff' : 'var(--ink)', borderRadius: 15, padding: '12px 13px', boxShadow: accent ? 'var(--glow-guinda)' : 'var(--neo-sm)' } },
      React.createElement(I, { name: icon, size: 18, stroke: 2, style: { opacity: accent ? .9 : .5 } }),
      React.createElement('div', { style: { fontSize: 19, fontWeight: 900, marginTop: 5, letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, n),
      React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, opacity: accent ? .9 : .6, marginTop: 1 } }, label));
  }

  // ── Detalle completo: toda la información capturada + seguimiento ──
  function RequestDetail({ app, r, onBack, header }) {
    const store = useStore();
    const [obs, setObs] = useState('');
    const sim = r.simulacion;
    const fld = (label, value, mono) => React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--hairline)' } },
      React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 } }, label),
      React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)', textAlign: 'right', fontFamily: mono ? 'var(--mono)' : 'inherit' } }, value == null || value === '' ? '—' : value));
    const card = (title, icon, rows) => React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '4px 15px 8px', boxShadow: 'var(--neo-sm)', marginBottom: 14 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 6px' } },
        React.createElement('div', { style: { width: 26, height: 26, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: icon, size: 15, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--ink)' } }, title)),
      rows);

    return React.createElement('div', null,
      header({ title: 'Solicitud ' + r.folio, sub: r.fechaHora, onBack }),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 18, fontWeight: 800, color: 'var(--ink)' } }, r.productoNombre || r.programa || 'Suti Préstamo'),
            React.createElement('div', { style: { fontSize: 20, fontWeight: 900, color: 'var(--guinda)', marginTop: 2 } }, money(sim.montoSolicitado))),
          React.createElement(EstadoBadge, { estado: r.estado })),

        card('Solicitante', 'user', React.createElement('div', null,
          fld('Usuario', r.usuario.nombre),
          fld('No. de afiliado', r.usuario.numAfiliado, true),
          fld('Tipo de sindicato', r.usuario.sindicato),
          fld('Tipo de empleado', r.usuario.tipoEmpleado),
          fld('Categoría laboral', r.usuario.categoria))),

        card('Origen del financiamiento', 'grid', React.createElement('div', null,
          fld('Empresa / proveedor', r.empresaNombre),
          fld('Programa / convenio', r.programa),
          fld('Producto / servicio', r.productoNombre),
          fld('Tipo', r.productoTipo),
          r.cotizacion && fld('Cotización previa', r.cotizacion.folio + ' · ' + money(r.cotizacion.monto)),
          r.destino && fld('Destino', r.destino),
          fld('ID convenio', r.convenioId, true),
          fld('ID producto', r.productoId, true))),

        card('Simulación (descuento vía nómina)', 'cash', React.createElement('div', null,
          fld('Monto solicitado', money(sim.montoSolicitado)),
          fld('Monto autorizado (perfil)', sim.montoAutorizado != null ? money(sim.montoAutorizado) : '—'),
          fld('Plazo', sim.plazoQuincenas + ' quincenas'),
          fld('Tasa', sim.tasaMensual != null ? sim.tasaMensual + '% mensual' : '—'),
          fld('Pago por quincena', money(sim.pagoQuincenal)),
          fld('Interés total', money(sim.interesTotal)),
          fld('Total a pagar', money(sim.totalPagar)),
          sim.ratioNomina != null && fld('% de la quincena', sim.ratioNomina + '%'))),

        // Seguimiento: cambio de estado
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: 15, boxShadow: 'var(--neo-sm)', marginBottom: 14 } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--ink)', marginBottom: 11 } }, 'Estado de la solicitud'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
            window.FINANZAS.ESTADOS.map((e) => React.createElement('button', {
              key: e.id, disabled:e.id==='depositada', title:e.id==='depositada'?'La confirmación del depósito se realiza por separado':'', onClick: async () => {try{await store.setEstado(r.id,e.id);app.toast&&app.toast('Estado actualizado');}catch(_){app.toast&&app.toast(e.id==='depositada'?'El depósito se confirma en el sistema financiero':'No se pudo actualizar');}},
              style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: r.estado === e.id ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: r.estado === e.id ? '#fff' : 'var(--ink-2)', boxShadow: r.estado === e.id ? 'var(--glow-guinda)' : 'var(--neo-inset)' },
            }, React.createElement(I, { name: e.icon, size: 14, stroke: 2.2 }), e.label)))),

        // Observaciones y documentación
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: 15, boxShadow: 'var(--neo-sm)' } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--ink)', marginBottom: 11 } }, 'Observaciones y documentación'),
          (r.comentarios && r.comentarios.length)
            ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 } },
              r.comentarios.map((c, i) => React.createElement('div', { key: i, style: { background: 'var(--surface-2)', borderRadius: 11, padding: '9px 12px' } },
                React.createElement('div', { style: { fontSize: 13, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.45 } }, c.texto),
                React.createElement('div', { style: { fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3 } }, (c.actor || 'Finanzas')))))
            : React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 12 } }, 'Sin observaciones registradas.'),
          React.createElement('div', { style: { display: 'flex', gap: 8 } },
            React.createElement('input', { value: obs, placeholder: 'Agregar observación…', onChange: (e) => setObs(e.target.value), onKeyDown: async(e) => { if (e.key === 'Enter' && obs.trim()) { try{await store.addObs(r.id,obs.trim());setObs('');}catch(_){app.toast&&app.toast('No se pudo guardar la observación');} } }, style: { flex: 1, border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 11, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--ink)' } }),
            React.createElement('button', { onClick: async() => { if(obs.trim()){try{await store.addObs(r.id,obs.trim());setObs('');}catch(_){app.toast&&app.toast('No se pudo guardar la observación');}} }, style: { width: 44, borderRadius: 11, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: 'var(--glow-guinda)' } }, React.createElement(I, { name: 'plus', size: 19, stroke: 2.4 }))))));
  }

  window.FinanzasModule = FinanzasModule;
})();
