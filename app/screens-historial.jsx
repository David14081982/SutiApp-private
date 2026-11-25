/* screens-historial.jsx — Mi Historial: solicitudes + tracking timeline */
(function () {
  const { useState } = React;
  const I = window.Icon;
  const REQUEST_LABELS={submitted:'Enviada',requires_financial_processing:'Pendiente de revisión',in_review:'En revisión',approved:'Aprobada',rejected:'Rechazada',cancelled:'Cancelada'};
  const META={revision:{tone:'amber',icon:'clock',label:'En revisión'},aprobado:{tone:'green',icon:'checkCircle',label:'Aprobada'},depositado:{tone:'green',icon:'checkCircle',label:'Completada'},rechazado:{tone:'red',icon:'close',label:'No aprobada'}};

  function StatusPill({ estado, requestStatus }) {
    const m = META[estado]||META.revision;
    // Icono v\u00eda registro (F1.6): 'hist.estado.<estado>' \u2192 icono de estadoMeta.
    const r = window.AssetsResolver ? window.AssetsResolver.resolve('hist.estado.' + estado) : null;
    const label=REQUEST_LABELS[requestStatus]||m.label;
    return React.createElement(window.Badge, { tone: m.tone, icon: (r && r.icon) || m.icon }, label);
  }

  function HistorialScreen({ app }) {
    const operations=window.useOperationsStore();
    const history=window.LoanHistory.useHistory();
    const [filter, setFilter] = useState('Todas');
    const filters = ['Todas', 'En proceso', 'Aprobadas', 'En pago', 'Liquidadas', 'No aprobadas'];
    const mine = window.LoanHistory.merge(operations.all(),history.data,history.elapsed);
    let list = mine.slice();
    if (filter === 'En proceso') list = list.filter((s) => s.estado === 'revision');
    if (filter === 'Aprobadas') list = list.filter((s) => s.estado === 'aprobado' || s.estado === 'depositado');
    if (filter === 'En pago') list = list.filter((s) => s.estado === 'en_pago');
    if (filter === 'Liquidadas') list = list.filter((s) => s.estado === 'liquidada');
    if (filter === 'No aprobadas') list = list.filter((s) => s.estado === 'rechazado');

    const openEntry=s=>app.push('tracking',s.history&&(s.history.kind==='loan'||!s.sourceId)?{loanKey:s.historyKey}:{s});

    return React.createElement('div', { className: 'su-route', style: { paddingBottom: 18 } },
      React.createElement(window.TopBar, { app, variant: 'historial' }),
      React.createElement(window.RequestAuthorizationNotice, { app, requests: operations.all() }),
      React.createElement(window.FarmaHistory,{app}),
      React.createElement(window.HistoryDebtCard,{history}),
      // filters (C5.2 · indicador deslizante compartido)
      React.createElement(window.ChipBar, { items: filters, value: filter, onChange: setFilter, style: { padding: '16px 16px 2px' } }),
      React.createElement('div',{style:{margin:'12px 16px 0',background:'#EEF3FF',border:'1px solid #D6E2FB',borderRadius:14,padding:'11px 13px',fontSize: 'var(--text-11-5, 11.5px)',fontWeight:650,color:'var(--ink-2)',lineHeight:1.45}},'Aquí puedes consultar tus solicitudes, cotizaciones y su avance.'),
      operations.state().phase==='loading'&&React.createElement('div',{'data-operations-state':'loading',style:{padding:24,textAlign:'center',fontWeight:700,color:'var(--ink-3)'}},'Cargando solicitudes…'),
      React.createElement(window.HistorySourceState,{history}),
      operations.state().phase==='error'&&React.createElement('div',{'data-operations-state':'error',style:{padding:24,textAlign:'center',fontWeight:700,color:'#A32921'}},'No pudimos cargar tu historial. ',React.createElement('button',{onClick:operations.retry},'Reintentar')),
      // list
      React.createElement('div', { style: { padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 } },
        list.map((s) => React.createElement('div', { key: s.historyKey||s.id, onClick: () => openEntry(s), className: 'su-press su-history-entry', style: { display: 'flex', gap: 13, alignItems: 'center', background: 'var(--surface)', borderRadius: 18, padding: 14, boxShadow: 'var(--neo-sm)', cursor: 'pointer' } },
          React.createElement(window.IconTile, { icon: s.icon, size: 50 }),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
              React.createElement('span', { style: { fontSize: 'var(--text-15, 15px)', fontWeight: 800, color: 'var(--ink)' } }, s.tipo),
              React.createElement('span', { style: { fontSize: 'var(--text-11-5, 11.5px)', color: 'var(--ink-3)', fontWeight: 700, fontFamily: 'var(--mono)' } }, s.id)),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 } },
              React.createElement('span', { style: { fontSize: 'var(--text-16, 16px)', fontWeight: 800, color: 'var(--guinda)' } }, s.monto==null?'Por cotizar':window.money(s.monto)),
              s.history?React.createElement(window.HistoryPill,{entry:s.history}):React.createElement(StatusPill, { estado: s.estado, requestStatus: s.requestStatus })),
            s.history&&React.createElement(window.ApprovalClock,{entry:s.history}),
            React.createElement('div', { style: { fontSize: 'var(--text-12, 12px)', color: 'var(--ink-3)', fontWeight: 600, marginTop: 5 } }, s.fecha + ' · ' + s.plazo + (s.subtipo ? ' · ' + s.subtipo : '') + ((s.steps.find(step => step.active) || {}).label ? ' · Etapa: ' + s.steps.find(step => step.active).label : ''))))),
          list.length === 0 && history.phase==='loaded' && operations.state().phase==='loaded' && React.createElement(window.EmptyState, { icon: 'receipt', title: 'Sin solicitudes aquí', sub: 'Cuando solicites un beneficio aparecerá en esta lista.' })),
    );
  }

  // ---------- TRACKING DETAIL ----------
  function TrackingScreen({ app, params }) {
    if(params.loanKey)return React.createElement(window.LoanHistoryDetail,{app,loanKey:params.loanKey});
    return React.createElement(RequestTrackingScreen,{app,params});
  }
  function RequestTrackingScreen({ app, params }) {
    const operations=window.useOperationsStore();
    const requestId=params.s&&params.s.sourceId;
    const s=operations.all().find((row)=>row.sourceId===requestId);
    if(!s)return React.createElement('div',{style:{padding:20}},
      React.createElement('button',{onClick:app.back},'Volver al historial'),
      React.createElement('p',{role:'status'},operations.state().phase==='error'?'No pudimos actualizar el seguimiento.':operations.state().phase==='loaded'?'La solicitud no está disponible en tu historial.':'Actualizando seguimiento…'),
      operations.state().phase==='error'&&React.createElement('button',{onClick:operations.retry},'Reintentar'));
    const m = META[s.estado]||META.revision;
    return React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: app.back, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 'var(--text-16-5, 16.5px)', fontWeight: 800 } }, 'Seguimiento')),
      React.createElement('div', { className: 'su-app-scroll su-route', style: { flex: 1, overflowY: 'auto', padding: 20 } },
        // summary card
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 20, padding: 18, boxShadow: 'var(--neo-md)' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 13 } },
            React.createElement(window.IconTile, { icon: s.icon, size: 52, glow: true }),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontSize: 'var(--text-17, 17px)', fontWeight: 800 } }, s.tipo),
              React.createElement('div', { style: { fontSize: 'var(--text-12-5, 12.5px)', color: 'var(--ink-3)', fontWeight: 700, fontFamily: 'var(--mono)' } }, s.id)),
            React.createElement(StatusPill, { estado: s.estado, requestStatus: s.requestStatus })),
          React.createElement('div', { style: { display: 'flex', gap: 18, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hairline)' } },
            React.createElement('div', null, React.createElement('div', { style: { fontSize: 'var(--text-11-5, 11.5px)', color: 'var(--ink-3)', fontWeight: 600 } }, 'Monto'), React.createElement('div', { style: { fontSize: 'var(--text-18, 18px)', fontWeight: 800, color: 'var(--guinda)', marginTop: 2 } }, s.monto==null?'Por cotizar':window.money(s.monto))),
            React.createElement('div', null, React.createElement('div', { style: { fontSize: 'var(--text-11-5, 11.5px)', color: 'var(--ink-3)', fontWeight: 600 } }, 'Plazo'), React.createElement('div', { style: { fontSize: 'var(--text-18, 18px)', fontWeight: 800, marginTop: 2 } }, s.plazo)),
            React.createElement('div', null, React.createElement('div', { style: { fontSize: 'var(--text-11-5, 11.5px)', color: 'var(--ink-3)', fontWeight: 600 } }, 'Fecha'), React.createElement('div', { style: { fontSize: 'var(--text-15, 15px)', fontWeight: 800, marginTop: 4 } }, s.fecha)))),
        s.rental&&React.createElement(window.RentaCarSummary,{snapshot:{rental:s.rental,product:{name:s.tipo}},showApplicant:false}),
        window.DocumentIntegration&&window.DocumentIntegration.enabled()&&React.createElement(window.DocumentEvidencePanel,{contextId:requestId}),
        window.FinancialDocumentCorrections&&React.createElement(window.FinancialDocumentCorrections,{requestId}),
        // rejection reason
        s.motivo && React.createElement('div', { style: { marginTop: 16, background: '#FDEAEA', border: '1px solid #F6CBC6', borderRadius: 16, padding: 16, display: 'flex', gap: 11 } },
          React.createElement(I, { name: 'info', size: 20, stroke: 2, style: { color: '#C0341D', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', null, React.createElement('div', { style: { fontSize: 'var(--text-13-5, 13.5px)', fontWeight: 800, color: '#C0341D' } }, 'Motivo'), React.createElement('div', { style: { fontSize: 'var(--text-13, 13px)', color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5, marginTop: 3 } }, s.motivo))),
        // timeline (etapas administrables por tipo de servicio/solicitud)
        (function () {
          const steps=s.steps||[];
          return React.createElement('div', { style: { marginTop: 22 } },
            React.createElement(window.SectionHead, { title: 'Línea de tiempo', icon: 'clock' }),
            s.workflowAvailable
              ? React.createElement(window.Timeline, { steps, activeNote: s.activeNote })
              : React.createElement('div',{'data-workflow-unavailable':'',style:{background:'var(--surface)',borderRadius:18,padding:18,textAlign:'center',fontSize: 'var(--text-13, 13px)',fontWeight:700,color:'var(--ink-3)',boxShadow:'var(--neo-sm)'}},s.workflowMessage||'Seguimiento no disponible'));
        })(),
        s.estado === 'rechazado'
          ? React.createElement(window.Btn, { full: true, size: 'lg', icon: 'refresh', style: { marginTop: 22 }, onClick: () => { app.back(); app.setTab('convenios'); } }, 'Volver a explorar beneficios')
          : React.createElement(window.Btn, { full: true, size: 'lg', variant: 'outline', icon: 'headset', style: { marginTop: 22 }, onClick: () => window.open('https://wa.me/526626727130', '_blank', 'noopener,noreferrer') }, 'Contactar a un asesor'),
      ),
    );
  }

  Object.assign(window, { HistorialScreen, TrackingScreen });
})();
