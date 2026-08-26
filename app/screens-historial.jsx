/* screens-historial.jsx — Mi Historial: solicitudes + tracking timeline */
(function () {
  const { useState } = React;
  const I = window.Icon;
  const META={revision:{tone:'amber',icon:'clock',label:'En revisión'},aprobado:{tone:'green',icon:'checkCircle',label:'Aprobada'},depositado:{tone:'green',icon:'checkCircle',label:'Completada'},rechazado:{tone:'red',icon:'close',label:'No aprobada'}};

  function StatusPill({ estado }) {
    const m = META[estado]||META.revision;
    // Icono v\u00eda registro (F1.6): 'hist.estado.<estado>' \u2192 icono de estadoMeta.
    const r = window.AssetsResolver ? window.AssetsResolver.resolve('hist.estado.' + estado) : null;
    return React.createElement(window.Badge, { tone: m.tone, icon: (r && r.icon) || m.icon }, m.label);
  }

  function HistorialScreen({ app }) {
    const operations=window.useOperationsStore();
    const [filter, setFilter] = useState('Todas');
    const filters = ['Todas', 'En proceso', 'Aprobadas', 'No aprobadas'];
    const mine = operations.all();
    let list = mine.slice();
    if (filter === 'En proceso') list = list.filter((s) => s.estado === 'revision');
    if (filter === 'Aprobadas') list = list.filter((s) => s.estado === 'aprobado' || s.estado === 'depositado');
    if (filter === 'No aprobadas') list = list.filter((s) => s.estado === 'rechazado');

    const activa = mine.find((s) => s.estado === 'revision');
    // El progreso se LLENA al aparecer (una sola vez): la barra deja de leerse
    // como gráfico y pasa a leerse como avance.
    const progRef = React.useRef(null);
    React.useEffect(() => {
      const el = progRef.current, M = window.MOTION;
      if (!el || !M || M.reduced() || M.frozen() || el.hasAttribute('data-m-filled')) return;
      el.setAttribute('data-m-filled', '');
      Array.prototype.forEach.call(el.children, (seg, i) => {
        M.animate(seg, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 400, easing: M.ease.enter, delay: i * 70, fill: 'backwards' });
      });
    }, [activa && activa.id]);

    return React.createElement('div', { className: 'su-route', style: { paddingBottom: 18 } },
      React.createElement(window.TopBar, { app, variant: 'historial' }),
      // active tracker hero
      activa && React.createElement('div', { style: { padding: '4px 16px 0' } },
        React.createElement('div', { onClick: () => app.push('tracking', { s: activa }), className: 'su-press', style: { cursor: 'pointer', background: 'linear-gradient(135deg,var(--guinda),var(--guinda-700))', borderRadius: 22, padding: 18, color: '#fff', boxShadow: 'var(--neo-md)', position: 'relative', overflow: 'hidden' } },
          React.createElement('div', { style: { position: 'absolute', right: -20, top: -20, opacity: .12 } }, React.createElement(I, { name: 'clock', size: 130, stroke: 1.2, style: { color: '#fff' } })),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            React.createElement('span', { style: { fontSize: 12.5, fontWeight: 700, opacity: .85, letterSpacing: '.04em' } }, 'SOLICITUD EN CURSO'),
            React.createElement('span', { style: { fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', opacity: .85 } }, activa.id)),
          React.createElement('div', { style: { fontSize: 20, fontWeight: 800, marginTop: 8 } }, activa.tipo),
          React.createElement('div', { style: { fontSize: 26, fontWeight: 800, marginTop: 2, letterSpacing: '-.02em' } }, activa.monto==null?'Por cotizar':window.money(activa.monto)),
          // mini progress
          React.createElement('div', { ref: progRef, style: { display: 'flex', gap: 5, marginTop: 14 } },
            activa.steps.map((st, i) => React.createElement('div', { key: i, style: { flex: 1, height: 5, borderRadius: 999, transformOrigin: 'left center', background: st.done ? '#fff' : st.active ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.22)' } }))),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 } },
            React.createElement('span', { style: { fontSize: 13, fontWeight: 700 } }, 'En revisión'),
            React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700 } }, 'Ver seguimiento', React.createElement(I, { name: 'arrowR', size: 15, stroke: 2.2 }))))),
      // filters (C5.2 · indicador deslizante compartido)
      React.createElement(window.ChipBar, { items: filters, value: filter, onChange: setFilter, style: { padding: '16px 16px 2px' } }),
      React.createElement('div',{style:{margin:'12px 16px 0',background:'#EEF3FF',border:'1px solid #D6E2FB',borderRadius:14,padding:'11px 13px',fontSize:11.5,fontWeight:650,color:'var(--ink-2)',lineHeight:1.45}},'Aquí puedes consultar tus solicitudes, cotizaciones y su avance.'),
      operations.state().phase==='loading'&&React.createElement('div',{'data-operations-state':'loading',style:{padding:24,textAlign:'center',fontWeight:700,color:'var(--ink-3)'}},'Cargando solicitudes…'),
      operations.state().phase==='error'&&React.createElement('div',{'data-operations-state':'error',style:{padding:24,textAlign:'center',fontWeight:700,color:'#A32921'}},'No pudimos cargar tu historial. ',React.createElement('button',{onClick:operations.retry},'Reintentar')),
      // list
      React.createElement('div', { style: { padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 } },
        list.map((s) => React.createElement('div', { key: s.id, onClick: () => app.push('tracking', { s }), className: 'su-press', style: { display: 'flex', gap: 13, alignItems: 'center', background: 'var(--surface)', borderRadius: 18, padding: 14, boxShadow: 'var(--neo-sm)', cursor: 'pointer' } },
          React.createElement(window.IconTile, { icon: s.icon, size: 50 }),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
              React.createElement('span', { style: { fontSize: 15, fontWeight: 800, color: 'var(--ink)' } }, s.tipo),
              React.createElement('span', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 700, fontFamily: 'var(--mono)' } }, s.id)),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 } },
              React.createElement('span', { style: { fontSize: 16, fontWeight: 800, color: 'var(--guinda)' } }, s.monto==null?'Por cotizar':window.money(s.monto)),
              React.createElement(StatusPill, { estado: s.estado })),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 5 } }, s.fecha + ' · ' + s.plazo + (s.subtipo ? ' · ' + s.subtipo : ''))))),
          list.length === 0 && React.createElement(window.EmptyState, { icon: 'receipt', title: 'Sin solicitudes aquí', sub: 'Cuando solicites un beneficio aparecerá en esta lista.' })),
    );
  }

  // ---------- TRACKING DETAIL ----------
  function TrackingScreen({ app, params }) {
    const s = params.s;
    const m = META[s.estado]||META.revision;
    return React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: app.back, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 16.5, fontWeight: 800 } }, 'Seguimiento')),
      React.createElement('div', { className: 'su-app-scroll su-route', style: { flex: 1, overflowY: 'auto', padding: 20 } },
        // summary card
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 20, padding: 18, boxShadow: 'var(--neo-md)' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 13 } },
            React.createElement(window.IconTile, { icon: s.icon, size: 52, glow: true }),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontSize: 17, fontWeight: 800 } }, s.tipo),
              React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700, fontFamily: 'var(--mono)' } }, s.id)),
            React.createElement(StatusPill, { estado: s.estado })),
          React.createElement('div', { style: { display: 'flex', gap: 18, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hairline)' } },
            React.createElement('div', null, React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 } }, 'Monto'), React.createElement('div', { style: { fontSize: 18, fontWeight: 800, color: 'var(--guinda)', marginTop: 2 } }, s.monto==null?'Por cotizar':window.money(s.monto))),
            React.createElement('div', null, React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 } }, 'Plazo'), React.createElement('div', { style: { fontSize: 18, fontWeight: 800, marginTop: 2 } }, s.plazo)),
            React.createElement('div', null, React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 } }, 'Fecha'), React.createElement('div', { style: { fontSize: 15, fontWeight: 800, marginTop: 4 } }, s.fecha)))),
        // rejection reason
        s.motivo && React.createElement('div', { style: { marginTop: 16, background: '#FDEAEA', border: '1px solid #F6CBC6', borderRadius: 16, padding: 16, display: 'flex', gap: 11 } },
          React.createElement(I, { name: 'info', size: 20, stroke: 2, style: { color: '#C0341D', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', null, React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: '#C0341D' } }, 'Motivo'), React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5, marginTop: 3 } }, s.motivo))),
        // timeline (etapas administrables por tipo de servicio/solicitud)
        (function () {
          const steps=s.steps||[];const nota=s.estado==='revision'?'La empresa o proveedor está revisando tu solicitud comercial.':null;
          return React.createElement('div', { style: { marginTop: 22 } },
            React.createElement(window.SectionHead, { title: 'Línea de tiempo', icon: 'clock' }),
            React.createElement(window.Timeline, { steps, activeNote: nota }));
        })(),
        s.estado === 'rechazado'
          ? React.createElement(window.Btn, { full: true, size: 'lg', icon: 'refresh', style: { marginTop: 22 }, onClick: () => { app.back(); app.setTab('convenios'); } }, 'Volver a explorar beneficios')
          : React.createElement(window.Btn, { full: true, size: 'lg', variant: 'outline', icon: 'headset', style: { marginTop: 22 }, onClick: () => app.toast('Conectando con soporte sindical…') }, 'Contactar a un asesor'),
      ),
    );
  }

  Object.assign(window, { HistorialScreen, TrackingScreen });
})();
