/* screens-admin-flujos.jsx — Panel: ETAPAS Y SEGUIMIENTO.
   Estructura administrable de flujos: qué etapas aplican a cada servicio,
   solicitud o convenio, en qué orden, con qué descripción y con qué fechas
   reales. Sin reglas de negocio: solo la estructura UI/UX que después se
   conecta a Supabase. Exporta window.FlujosModule. */
(function () {
  const { useState } = React;
  const I = window.Icon;
  const S = () => window.flowStore;

  const card = { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)' };
  const inputSt = { width: '100%', border: '1px solid var(--hairline)', borderRadius: 12, padding: '11px 13px', fontSize: 14, fontWeight: 600, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', fontFamily: 'inherit' };

  function Field({ label, value, onChange, ph, area, type }) {
    return React.createElement('div', { style: { marginBottom: 12 } },
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 6, textTransform: 'uppercase' } }, label),
      area
        ? React.createElement('textarea', { value: value || '', onChange: (e) => onChange(e.target.value), placeholder: ph, rows: 3, style: Object.assign({}, inputSt, { resize: 'vertical', lineHeight: 1.45 }) })
        : React.createElement('input', { value: value == null ? '' : value, type: type || 'text', onChange: (e) => onChange(e.target.value), placeholder: ph, style: inputSt }));
  }

  function Chip({ on, label, icon, onClick, tone }) {
    return React.createElement('button', {
      onClick, type: 'button',
      style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999, border: 'none', cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: on ? (tone || 'var(--guinda)') : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-2)', boxShadow: on ? 'var(--glow-guinda)' : 'none', flexShrink: 0, maxWidth: '100%' },
    }, icon && React.createElement(I, { name: icon, size: 14, stroke: 2.2 }), React.createElement('span', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, label));
  }

  function Seg({ value, options, onChange }) {
    return React.createElement('div', { style: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 } },
      options.map((o) => React.createElement(Chip, { key: o.id, on: value === o.id, label: o.label, icon: o.icon, onClick: () => onChange(o.id) })));
  }

  function Toggle({ on, onClick }) {
    return React.createElement(window.Toggle, { on: on, size: 'lg', onClick, 'aria-label': 'toggle', glow: false, });
  }

  function ServicePicker({ value, onChange, note }) {
    const cat = S().servicesCatalog();
    const groups = [];
    cat.forEach((s) => { let g = groups.find((x) => x.name === s.grupo); if (!g) { g = { name: s.grupo, items: [] }; groups.push(g); } g.items.push(s); });
    const toggle = (id) => onChange(value.indexOf(id) >= 0 ? value.filter((x) => x !== id) : value.concat([id]));
    return React.createElement('div', { style: { marginBottom: 12 } },
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 4, textTransform: 'uppercase' } }, 'Servicios a los que aplica'),
      note && React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, lineHeight: 1.45, marginBottom: 8 } }, note),
      groups.map((g) => React.createElement('div', { key: g.name, style: { marginBottom: 10 } },
        React.createElement('div', { style: { fontSize: 11, fontWeight: 800, color: 'var(--ink-3)', marginBottom: 6 } }, g.name),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } },
          g.items.map((s) => React.createElement(Chip, { key: s.id, on: value.indexOf(s.id) >= 0, label: s.label, icon: s.icon, onClick: () => toggle(s.id) }))))));
  }

  // ── Hoja de edición de una etapa ──
  function EtapaSheet({ flow, etapa, onClose }) {
    const [d, setD] = useState(Object.assign({}, etapa));
    const [todos, setTodos] = useState(!(etapa.servicios || []).length);
    const [error, setError] = useState('');
    const set = (k, v) => setD(Object.assign({}, d, { [k]: v }));
    const estados = S().REQUEST_STATUSES || [];
    const toggleEstado = (id) => set('estadoRefs',(d.estadoRefs||[]).includes(id)?(d.estadoRefs||[]).filter((value)=>value!==id):(d.estadoRefs||[]).concat(id));
    const save = async () => { try{setError('');await S().saveEtapa(flow.id, Object.assign({}, d, { servicios: todos ? [] : (d.servicios || []) })); onClose();}catch(_){setError('No fue posible guardar: revisa el orden, los estados mapeados y que el flujo conserve etapas activas.');} };

    return React.createElement('div', { onClick: onClose, 'data-workflow-stage-editor':etapa.id||'new', style: { position: 'absolute', inset: 0, zIndex: 78, background: 'rgba(16,12,14,.5)', display: 'flex', alignItems: 'flex-end' } },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), className: 'su-app-scroll', style: { width: '100%', maxHeight: '92%', overflowY: 'auto', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))' } },
        React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
        React.createElement('div', { style: { fontSize: 17, fontWeight: 900, marginBottom: 14 } }, etapa.nombre ? 'Editar etapa' : 'Nueva etapa'),
        Field({ label: 'Nombre de la etapa', value: d.nombre, onChange: (v) => set('nombre', v), ph: 'Ej. Revisión de documentos' }),
        Field({ label: 'Descripción para el afiliado', value: d.descripcion, onChange: (v) => set('descripcion', v), ph: 'Qué ocurre en esta etapa', area: true }),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 6, textTransform: 'uppercase' } }, 'Resultado de la etapa'),
        React.createElement(Seg, { value: d.resultado, options: S().RESULTADOS.map((r) => ({ id: r.id, label: r.label, icon: r.icon })), onChange: (v) => set('resultado', v) }),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 6, textTransform: 'uppercase' } }, 'Responsable'),
        React.createElement(Seg, { value: d.responsable, options: S().RESPONSABLES.map((r) => ({ id: r, label: r })), onChange: (v) => set('responsable', v) }),
        Field({ label: 'Tiempo estimado (días hábiles)', value: d.slaDias, onChange: (v) => set('slaDias', v === '' ? null : parseInt(v, 10) || 0), ph: 'Opcional', type: 'number' }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', borderRadius: 14, padding: '12px 14px', marginBottom: 12 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800 } }, 'Registra fecha real'),
            React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2, lineHeight: 1.4 } }, 'Se guardará la fecha y hora en que la solicitud llegó a esta etapa.')),
          React.createElement(Toggle, { on: d.registraFecha !== false, onClick: () => set('registraFecha', !(d.registraFecha !== false)) })),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', borderRadius: 14, padding: '12px 14px', marginBottom: 12 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800 } }, d.activo !== false ? 'Etapa activa' : 'Etapa retirada'),
            React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2, lineHeight: 1.4 } }, 'Las solicitudes anteriores conservan su snapshot; reactivar solo afecta solicitudes nuevas.')),
          React.createElement(Toggle, { on: d.activo !== false, onClick: () => set('activo', !(d.activo !== false)) })),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', borderRadius: 14, padding: '12px 14px', marginBottom: 12 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800 } }, 'Aplica a todos los servicios del flujo'),
            React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2, lineHeight: 1.4 } }, 'Desactívalo para que la etapa solo aparezca en ciertos servicios.')),
          React.createElement(Toggle, { on: todos, onClick: () => setTodos(!todos) })),
        !todos && React.createElement(ServicePicker, { value: d.servicios || [], onChange: (v) => set('servicios', v), note: 'Solo se mostrará en las solicitudes de estos servicios.' }),
        estados.length > 0 && React.createElement('div', { style: { marginBottom: 12 } },
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 4, textTransform: 'uppercase' } }, 'Estado del sistema (mapeo)'),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, lineHeight: 1.45, marginBottom: 8 } }, 'Vincula la etapa con uno o más estados reales de program_requests. El backend valida conflictos.'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } },
            estados.map((o) => React.createElement(Chip, { key: o.id, on: (d.estadoRefs || []).includes(o.id), label: o.label, onClick: () => toggleEstado(o.id) })))),
        error&&React.createElement('div',{role:'alert',style:{marginBottom:10,padding:11,borderRadius:12,background:'#FDEAEA',color:'#A32921',fontSize:12,fontWeight:700,lineHeight:1.4}},error),
        React.createElement('div', { style: { display: 'flex', gap: 12, paddingTop: 4 } },
          React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
          React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, disabled: !(d.nombre || '').trim(), onClick: save, 'data-workflow-stage-save':'' }, 'Guardar etapa'))));
  }

  // ── Editor de un flujo ──
  function FlowEditor({ flow, onClose, header, canEdit, toast }) {
    const store = window.useFlowStore();
    const [okSave, runSave] = window.useBtnConfirm();
    const [d, setD] = useState(Object.assign({}, flow));
    const live = d.id ? store.get(d.id) : null;
    const [etapa, setEtapa] = useState(null);
    const [preview, setPreview] = useState(false);
    const [saveError, setSaveError] = useState('');
    const set = (k, v) => setD(Object.assign({}, d, { [k]: v }));
    const etapas = live ? store.etapas(live.id) : (d.etapas || []);

    const guardar = async () => {
      try{setSaveError('');const id = await store.save(Object.assign({}, d, { etapas: live ? live.etapas : d.etapas }), 'Admin');
      toast && toast('Flujo guardado');
      if (!d.id) setD(Object.assign({}, d, { id })); else onClose();}catch(_){setSaveError('No fue posible guardar. Un flujo activo requiere servicios y al menos una etapa válida, sin conflictos de orden o estado.');}
    };

    return React.createElement('div', null,
      header({ title: d.id ? 'Editar flujo' : 'Nuevo flujo', sub: d.id ? etapas.length + ' etapa(s)' : 'Define nombre, tipo y servicios', onBack: onClose }),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        React.createElement('div', { style: Object.assign({}, card, { padding: 15, marginBottom: 14 }) },
          Field({ label: 'Nombre del flujo', value: d.nombre, onChange: (v) => set('nombre', v), ph: 'Ej. Financiamiento vía nómina' }),
          Field({ label: 'Descripción', value: d.descripcion, onChange: (v) => set('descripcion', v), ph: 'Para qué sirve este flujo', area: true }),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 6, textTransform: 'uppercase' } }, 'Tipo de flujo'),
          React.createElement(Seg, { value: d.tipo, options: store.TIPOS.map((t) => ({ id: t.id, label: t.label, icon: t.icon })), onChange: (v) => set('tipo', v) }),
          React.createElement(ServicePicker, { value: d.servicios || [], onChange: (v) => set('servicios', v), note: 'Las solicitudes de estos servicios usarán este flujo de etapas.' }),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', borderRadius: 14, padding: '12px 14px' } },
            React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 800 } }, d.activo !== false ? 'Flujo activo' : 'Flujo inactivo'),
            React.createElement(Toggle, { on: d.activo !== false, onClick: () => set('activo', !(d.activo !== false)) }))),

        // Etapas
        live && React.createElement('div', { style: Object.assign({}, card, { padding: '14px 15px', marginBottom: 14 }) },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } },
            React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 900 } }, 'Etapas del flujo'),
            React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' } }, etapas.length + ' etapa(s)')),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, lineHeight: 1.45, marginBottom: 12 } }, 'El orden define la línea de tiempo que ve el afiliado.'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            etapas.map((e, i) => {
              const r = store.RESULTADO(e.resultado);
              return React.createElement('div', { key: e.id, 'data-workflow-stage-id':e.id, style: { border: '1px solid var(--hairline)', borderRadius: 14, padding: 12, opacity:e.activo===false ? .62 : 1 } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 10 } },
                  React.createElement('div', { style: { width: 26, height: 26, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 900, flexShrink: 0 } }, i + 1),
                  React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                    React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, e.nombre),
                    e.descripcion && React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.45, marginTop: 3 } }, e.descripcion),
                    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 } },
                      React.createElement(window.Badge, { tone: r.tone, icon: r.icon }, r.label),
                      e.activo===false ? React.createElement(window.Badge, { tone: 'gray', icon: 'close' }, 'Retirada') : null,
                      React.createElement(window.Badge, { tone: 'blue', icon: 'user' }, e.responsable),
                      e.slaDias ? React.createElement(window.Badge, { tone: 'amber', icon: 'clock' }, e.slaDias + ' días') : null,
                      e.registraFecha !== false ? React.createElement(window.Badge, { tone: 'green', icon: 'calendar' }, 'Fecha real') : null),
                    (e.servicios && e.servicios.length) ? React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 } },
                      e.servicios.map((sid) => React.createElement('span', { key: sid, style: { fontSize: 10.5, fontWeight: 800, color: 'var(--guinda)', background: 'var(--guinda-50)', borderRadius: 999, padding: '4px 9px' } }, store.serviceLabel(sid)))) : null),
                  canEdit && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                    React.createElement('button', { onClick: () => store.moveEtapa(live.id, e.id, -1), style: { width: 30, height: 26, borderRadius: 8, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--ink-2)' } }, React.createElement(I, { name: 'chevU', size: 15, stroke: 2.4 })),
                    React.createElement('button', { onClick: () => store.moveEtapa(live.id, e.id, 1), style: { width: 30, height: 26, borderRadius: 8, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--ink-2)' } }, React.createElement(I, { name: 'chevD', size: 15, stroke: 2.4 })))),
                canEdit && React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 10 } },
                  React.createElement('button', { onClick: () => setEtapa(e), 'data-workflow-stage-edit':e.id, style: { flex: 1, height: 34, borderRadius: 10, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' } }, 'Editar'),
                  e.activo!==false&&React.createElement('button', { onClick: () => store.removeEtapa(live.id, e.id), title:'Retirar etapa', style: { width: 44, height: 34, borderRadius: 10, border: 'none', background: '#FDEAEA', color: '#C0341D', cursor: 'pointer' } }, React.createElement(I, { name: 'close', size: 16, stroke: 2 }))));
            })),
          canEdit && React.createElement(window.Btn, { full: true, variant: 'outline', icon: 'plus', style: { marginTop: 12 }, onClick: () => setEtapa(store.blankEtapa()) }, 'Agregar etapa'),
          etapas.length > 0 && React.createElement(window.Btn, { full: true, variant: 'outline', icon: 'eye', style: { marginTop: 10 }, onClick: () => setPreview(true) }, 'Vista previa del seguimiento')),

        !live && React.createElement('div', { style: { background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 } },
          React.createElement(I, { name: 'info', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } }, 'Guarda el flujo para poder agregar sus etapas.')),

        saveError&&React.createElement('div',{role:'alert',style:{marginBottom:10,padding:11,borderRadius:12,background:'#FDEAEA',color:'#A32921',fontSize:12,fontWeight:700,lineHeight:1.4}},saveError),
        canEdit && React.createElement(window.Btn, { full: true, size: 'lg', icon: 'check', success: okSave, disabled: !(d.nombre || '').trim(), onClick: () => runSave(guardar) }, d.id ? 'Guardar cambios' : 'Crear flujo'),
        d.id && canEdit && d.activo!==false && React.createElement(window.Btn, { full: true, variant: 'outline', icon: 'close', style: { marginTop: 10 }, onClick: async () => { await store.remove(d.id, 'Admin'); onClose(); } }, 'Retirar flujo')),

      etapa && React.createElement(EtapaSheet, { flow: live || d, etapa, onClose: () => setEtapa(null) }),
      preview && React.createElement(PreviewSheet, { flow: live, onClose: () => setPreview(false) }));
  }

  function PreviewSheet({ flow, onClose }) {
    const store = S();
    const etapas = store.etapasActivas(flow.id);
    const mid = Math.min(1, Math.max(0, etapas.length - 1));
    const fechas = {}; if (etapas[0]) fechas[etapas[0].id] = store.stamp();
    const steps = store.steps(flow.id, { etapaId: (etapas[mid] || {}).id, fechas });
    return React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, zIndex: 79, background: 'rgba(16,12,14,.5)', display: 'flex', alignItems: 'flex-end' } },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), className: 'su-app-scroll', style: { width: '100%', maxHeight: '88%', overflowY: 'auto', background: 'var(--bg)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))' } },
        React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
        React.createElement('div', { style: { fontSize: 17, fontWeight: 900, marginBottom: 4 } }, 'Así lo ve el afiliado'),
        React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 14 } }, flow.nombre),
        React.createElement(window.Timeline, { steps })));
  }

  function SeguimientoTab({ toast }) {
    const store=window.useFlowStore();
    const requests=store.requests();
    const [open,setOpen]=useState(null);
    if(store.state().phase==='loading')return React.createElement('div',{style:{padding:24,textAlign:'center',fontWeight:700,color:'var(--ink-3)'}},'Cargando seguimiento…');
    if(store.state().phase==='error')return React.createElement('div',{style:{padding:24,textAlign:'center',fontWeight:700,color:'#A32921'}},'No fue posible cargar el seguimiento autorizado.');
    if(!requests.length)return React.createElement(window.EmptyState,{icon:'clock',title:'Sin solicitudes en seguimiento',sub:'Cuando un afiliado envíe una solicitud aparecerá aquí con el snapshot que le corresponde.'});
    const request=open?requests.find((item)=>item.id===open):null;
    if(request){
      const workflow=request.workflow_state||{},stages=workflow.stages||[],tracking=store.track(request.id)||{fechas:{}};
      return React.createElement('div',null,
        React.createElement('button',{onClick:()=>setOpen(null),style:{display:'inline-flex',alignItems:'center',gap:7,height:34,padding:'0 12px',borderRadius:10,border:'none',background:'var(--surface)',boxShadow:'var(--neo-sm)',color:'var(--ink-2)',fontFamily:'inherit',fontSize:12.5,fontWeight:800,cursor:'pointer',marginBottom:14}},React.createElement(I,{name:'arrowL',size:16,stroke:2.2}),'Todas las solicitudes'),
        React.createElement('div',{style:Object.assign({},card,{padding:15,marginBottom:14})},
          React.createElement('div',{style:{fontSize:16,fontWeight:900}},request.context_label||request.program_id),
          React.createElement('div',{style:{fontSize:12.5,color:'var(--ink-3)',fontWeight:700,fontFamily:'var(--mono)',marginTop:2}},request.folio),
          React.createElement('div',{style:{fontSize:12.5,color:'var(--ink-2)',fontWeight:600,marginTop:8}},'Flujo aplicado: ',React.createElement('b',null,workflow.available?workflow.workflow_name:'Seguimiento no disponible'),workflow.workflow_version&&(' · versión '+workflow.workflow_version))),
        !workflow.available?React.createElement('div',{'data-admin-workflow-unavailable':'',style:Object.assign({},card,{padding:18,textAlign:'center',fontSize:13,fontWeight:700,color:'var(--ink-3)'})},workflow.message||'Seguimiento no disponible'):
        React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:10}},stages.map((stage,index)=>{
          const current=stage.state==='current',date=tracking.fechas&&tracking.fechas[stage.id]||stage.date;
          return React.createElement('div',{key:stage.id,style:Object.assign({},card,{padding:13,border:current?'2px solid var(--guinda)':'2px solid transparent'})},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:10}},
              React.createElement('div',{style:{width:24,height:24,borderRadius:8,background:'var(--guinda-50)',color:'var(--guinda)',display:'grid',placeItems:'center',fontSize:12,fontWeight:900}},index+1),
              React.createElement('span',{style:{flex:1,fontSize:14,fontWeight:800}},stage.label),current&&React.createElement(window.Badge,{tone:'guinda',icon:'clock'},'Actual')),
            stage.description&&React.createElement('div',{style:{fontSize:12,color:'var(--ink-2)',fontWeight:600,lineHeight:1.45,marginTop:6}},stage.description),
            React.createElement('div',{style:{fontSize:12,color:'var(--ink-3)',fontWeight:600,marginTop:6}},date?'Fecha real: '+new Date(date).toLocaleString('es-MX'):'Sin fecha registrada'),
            React.createElement('div',{style:{display:'flex',gap:8,marginTop:10}},
              React.createElement('button',{onClick:async()=>{await store.setEtapaActual(request.id,workflow.workflow_id,stage.id);toast&&toast('Etapa actual actualizada');},style:{flex:1,height:34,borderRadius:10,border:'none',background:'var(--surface-2)',color:'var(--ink-2)',fontFamily:'inherit',fontSize:12.5,fontWeight:800,cursor:'pointer'}},'Marcar como actual'),
              date?React.createElement('button',{onClick:()=>store.setFecha(request.id,stage.id,''),title:'Quitar fecha',style:{width:44,height:34,borderRadius:10,border:'none',background:'#FDEAEA',color:'#C0341D',cursor:'pointer'}},React.createElement(I,{name:'close',size:16,stroke:2})):
                React.createElement('button',{onClick:()=>store.setFecha(request.id,stage.id,store.stamp()),style:{flex:1,height:34,borderRadius:10,border:'none',background:'var(--guinda-50)',color:'var(--guinda)',fontFamily:'inherit',fontSize:12.5,fontWeight:800,cursor:'pointer'}},'Registrar fecha')));
        })));
    }
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:10}},requests.map((request)=>{
      const workflow=request.workflow_state||{},current=workflow.current_stage||{};
      return React.createElement('button',{key:request.id,onClick:()=>setOpen(request.id),style:Object.assign({},card,{textAlign:'left',border:'none',padding:13,cursor:'pointer',fontFamily:'inherit'})},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8}},React.createElement('span',{style:{flex:1,fontSize:14,fontWeight:800,color:'var(--ink)'}},request.context_label||request.program_id),React.createElement('span',{style:{fontSize:11,fontWeight:700,color:'var(--ink-3)',fontFamily:'var(--mono)'}},request.folio)),
        React.createElement('div',{style:{fontSize:12,color:'var(--ink-2)',fontWeight:600,marginTop:4}},workflow.available?(workflow.workflow_name+' · '+(current.label||'Sin etapa actual')):'Seguimiento no disponible'));
    }));
  }

  // ── Módulo ──
  function FlujosModule({ app, onBack, header, canEdit }) {
    const store = window.useFlowStore();
    const [tab, setTab] = useState('flujos');
    const [edit, setEdit] = useState(null);
    const toast = app && app.toast;

    if (edit) return React.createElement(FlowEditor, { flow: edit, header, canEdit: canEdit !== false, toast, onClose: () => setEdit(null) });

    const flows = store.all();
    const segBtn = (id, label) => React.createElement('button', { key: id, onClick: () => setTab(id), style: { flex: 1, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, background: tab === id ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: tab === id ? '#fff' : 'var(--ink-2)', boxShadow: tab === id ? 'var(--glow-guinda)' : 'var(--neo-sm)' } }, label);

    return React.createElement('div', null,
      header({ title: 'Etapas y seguimiento', sub: flows.length + ' flujo(s) · ' + store.etapasCount() + ' etapa(s)', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 16 } }, segBtn('flujos', 'Flujos'), segBtn('seguimiento', 'Seguimiento')),
        React.createElement('div', { style: { background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 } },
          React.createElement(I, { name: 'info', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } }, 'Autoridad activa en Supabase: ', React.createElement('b', null, 'servicio → versión → snapshot → estado actual → fechas reales'), '. Los cambios aplican únicamente a solicitudes nuevas; el histórico conserva su versión.')),

        tab === 'seguimiento' ? React.createElement(SeguimientoTab, { toast }) : React.createElement(React.Fragment, null,
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
            flows.map((f) => {
              const tipo = store.TIPO(f.tipo);
              const servicios = (f.servicios || []).slice(0, 4);
              const extra = (f.servicios || []).length - servicios.length;
              return React.createElement('div', { key: f.id, 'data-workflow-id':f.id, style: Object.assign({}, card, { padding: 14, opacity: f.activo === false ? .6 : 1 }) },
                React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 10 } },
                  React.createElement('div', { style: { width: 42, height: 42, borderRadius: 13, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: tipo.icon, size: 21, stroke: 2 })),
                  React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                    React.createElement('div', { style: { fontSize: 15, fontWeight: 900, color: 'var(--ink)' } }, f.nombre),
                    React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.45, marginTop: 3 } }, f.descripcion)),
                  canEdit !== false && React.createElement(Toggle, { on: f.activo !== false, onClick: () => store.setActivo(f.id, !(f.activo !== false)) })),
                React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 11 } },
                  React.createElement(window.Badge, { tone: 'blue', icon: tipo.icon }, tipo.label),
                  React.createElement(window.Badge, { tone: 'guinda', icon: 'clock' }, (f.etapas || []).length + ' etapas')),
                React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 } },
                  servicios.map((sid) => React.createElement('span', { key: sid, style: { fontSize: 10.5, fontWeight: 800, color: 'var(--guinda)', background: 'var(--guinda-50)', borderRadius: 999, padding: '5px 10px' } }, store.serviceLabel(sid))),
                  extra > 0 && React.createElement('span', { style: { fontSize: 10.5, fontWeight: 800, color: 'var(--ink-3)', background: 'var(--surface-2)', borderRadius: 999, padding: '5px 10px' } }, '+' + extra + ' más')),
                React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 12 } },
                  React.createElement('button', { onClick: () => setEdit(f), 'data-workflow-admin':f.id, style: { flex: 1, height: 36, borderRadius: 11, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' } }, canEdit !== false ? 'Administrar etapas' : 'Ver etapas'),
                  canEdit !== false && React.createElement('button', { onClick: () => store.moveFlow(f.id, -1), style: { width: 40, height: 36, borderRadius: 11, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-2)', cursor: 'pointer' } }, React.createElement(I, { name: 'chevU', size: 16, stroke: 2.2 })),
                  canEdit !== false && React.createElement('button', { onClick: () => store.moveFlow(f.id, 1), style: { width: 40, height: 36, borderRadius: 11, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-2)', cursor: 'pointer' } }, React.createElement(I, { name: 'chevD', size: 16, stroke: 2.2 }))));
            })),
          canEdit !== false && React.createElement(window.Btn, { full: true, icon: 'plus', style: { marginTop: 14 }, onClick: () => setEdit(store.blank()) }, 'Nuevo flujo de etapas'),
          canEdit !== false && React.createElement(window.Btn, { full: true, variant: 'outline', icon: 'refresh', style: { marginTop: 10 }, onClick: () => { store.restore(); toast && toast('Configuración recargada'); } }, 'Recargar configuración'))));
  }

  window.FlujosModule = FlujosModule;
})();
