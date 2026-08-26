/* Admin view for the unified initial-request authority. */
(function(){
  const I=window.Icon;
  const labels={submitted:'Recibida',in_review:'En revisión',approved:'Aprobada',rejected:'Rechazada',cancelled:'Cancelada',requires_financial_processing:'Revisión financiera'};
  const exportLabels={pending:'Pendiente de aprobación',ready_for_handoff:'Lista para enviar',in_progress:'Enviando a gestión…',handed_off:'Enviada a gestión',failed:'No se pudo enviar'};
  const exportErrorCopy=(code)=>({REQUIRED_PRIVATE_DOCUMENT_MISSING:'Falta un documento requerido.',PRIVATE_DOCUMENT_AMBIGUOUS:'Hay documentos duplicados que deben revisarse.',HANDOFF_UNAVAILABLE:'El servicio de envío no está disponible.',HANDOFF_REJECTED:'El destino rechazó el envío.',HANDOFF_CONTRACT_MISMATCH:'La verificación del envío no coincidió.'}[code]||'Revisa los datos y documentos antes de reintentar.');
  function RequestsModule({app,onBack,header}){
    const[rows,setRows]=React.useState([]),[phase,setPhase]=React.useState('loading'),[error,setError]=React.useState(''),[busy,setBusy]=React.useState('');
    const load=React.useCallback(async()=>{try{setPhase('loading');setRows((await window.ProgramRequestRepository.list()).slice());setError('');setPhase('loaded');}catch(_){setRows([]);setError('No fue posible cargar las solicitudes.');setPhase('error');}},[]);
    React.useEffect(()=>{load();},[load]);
    const change=async(row,status)=>{try{setBusy(row.id);if(status==='approved'&&row.financial_processing_status!=null){await window.FinancialLegacyRepository.approveRequest(row.id);app.toast&&app.toast('Solicitud aprobada y enviada a gestión.');}else{await window.ProgramRequestRepository.update(row.id,status,row.notes||'');app.toast&&app.toast('Estado actualizado');}await load();}catch(_){app.toast&&app.toast('No se completó el envío. Revisa los datos y documentos requeridos; puedes reintentar sin duplicar la solicitud.');}finally{setBusy('');}};
    const retry=async(row)=>{try{setBusy(row.id);await window.FinancialLegacyRepository.handoffRequest(row.id);await load();app.toast&&app.toast('Solicitud enviada a gestión.');}catch(_){app.toast&&app.toast('El envío sigue pendiente. No se creó una solicitud duplicada; puedes reintentar.');}finally{setBusy('');}};
    return React.createElement('div',null,
      header({title:'Solicitudes',sub:rows.length+' trámite(s) registrado(s)',onBack}),
      window.ActingBanner&&React.createElement(window.ActingBanner,{}),
      React.createElement('div',{className:'su-app-scroll',style:{padding:16,paddingBottom:28}},
        React.createElement('div',{style:{background:'#EEF3FF',border:'1px solid #D6E2FB',borderRadius:14,padding:'11px 13px',display:'flex',gap:10,alignItems:'flex-start',marginBottom:16}},
          React.createElement(I,{name:'info',size:17,stroke:2,style:{color:'#2456C7',flexShrink:0,marginTop:1}}),
          React.createElement('div',{style:{fontSize:11.5,color:'var(--ink-2)',fontWeight:600,lineHeight:1.5}},'Aquí se consultan las solicitudes iniciales de programas, productos y cotizaciones. Los procesos financieros posteriores se gestionan por separado.')),
        phase==='loading'?React.createElement('div',{'data-program-requests-state':'loading',style:{padding:18,textAlign:'center',fontWeight:700,color:'var(--ink-3)'}},'Cargando solicitudes…'):
        phase==='error'?React.createElement('div',{'data-program-requests-state':'error',style:{padding:18,textAlign:'center',fontWeight:700,color:'#A32921'}},error,' ',React.createElement('button',{onClick:load},'Reintentar')):
        rows.length===0?React.createElement(window.EmptyState,{icon:'receipt',title:'Sin solicitudes',sub:'Cuando un afiliado envíe una solicitud, aparecerá aquí.'}):
        React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:11}},rows.map((r)=>React.createElement('div',{key:r.id,style:{background:'var(--surface)',borderRadius:16,padding:14,boxShadow:'var(--neo-sm)'}},
          React.createElement('div',{style:{display:'flex',alignItems:'flex-start',gap:11}},
            React.createElement('div',{style:{width:42,height:42,borderRadius:12,background:'var(--guinda-50)',color:'var(--guinda)',display:'grid',placeItems:'center',flexShrink:0}},React.createElement(I,{name:r.request_type==='quote'?'doc':'receipt',size:21,stroke:2})),
            React.createElement('div',{style:{flex:1,minWidth:0}},
              React.createElement('div',{style:{fontSize:14.5,fontWeight:800,color:'var(--ink)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},r.productoNombre||r.program_id),
              React.createElement('div',{style:{fontSize:12,color:'var(--ink-3)',fontWeight:600,marginTop:3}},r.nombre+' · '+r.numero_control),
              React.createElement('div',{style:{fontSize:11.5,color:'var(--ink-3)',fontWeight:600,marginTop:3}},r.program_id+(r.empresaNombre?' · '+r.empresaNombre:'')+' · '+r.fecha)),
            React.createElement('span',{style:{fontFamily:'var(--mono)',fontSize:10.5,fontWeight:700,color:'var(--guinda)',flexShrink:0}},r.folio)),
          r.financial_processing_status!=null&&React.createElement('div',{'data-financial-export-state':r.financial_processing_status,style:{marginTop:10,fontSize:11.5,fontWeight:800,color:r.financial_processing_status==='failed'?'#A32921':r.financial_processing_status==='handed_off'?'#18734A':'var(--ink-3)'}},exportLabels[r.financial_processing_status]||'Procesamiento financiero'),
          r.financial_processing_status==='failed'&&React.createElement('div',{style:{marginTop:4,fontSize:11.5,fontWeight:600,color:'#7C332E'}},exportErrorCopy(r.financial_export&&r.financial_export.error_code)),
          React.createElement('select',{value:r.status,disabled:!app.admin.has('program_requests.write')||busy===r.id||r.financial_processing_status==='handed_off',onChange:(e)=>change(r,e.target.value),style:{width:'100%',marginTop:12,border:'none',outline:'none',background:'var(--surface-2)',boxShadow:'var(--neo-inset)',borderRadius:11,padding:'10px 12px',fontSize:12.5,fontWeight:700,fontFamily:'inherit',color:'var(--ink)'}},
            Object.keys(labels).map((status)=>React.createElement('option',{key:status,value:status},labels[status]))),
          r.status==='approved'&&['ready_for_handoff','failed'].includes(r.financial_processing_status)&&React.createElement('button',{type:'button',disabled:busy===r.id||!app.admin.has('program_requests.write'),onClick:()=>retry(r),style:{width:'100%',marginTop:9,border:'none',borderRadius:11,padding:'10px 12px',background:'var(--guinda)',color:'#fff',fontSize:12.5,fontWeight:800,fontFamily:'inherit'}},busy===r.id?'Enviando…':'Reintentar envío'))))));
  }
  window.RequestsModule=RequestsModule;
})();
