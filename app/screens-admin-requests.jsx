/* Admin requests: mobile flow preserved; desktop gets a metadata-first operational queue. */
(function(){
  'use strict';
  const h=React.createElement,I=window.Icon;
  const mobileLabels={submitted:'Recibida',in_review:'En revisión',approved:'Aprobada',rejected:'Rechazada',cancelled:'Cancelada',requires_financial_processing:'Revisión financiera'};
  const statusMeta={submitted:{label:'Pendiente',tone:'#8A5A00',bg:'#FFF4D6'},in_review:{label:'En revisión',tone:'#2456C7',bg:'#EAF0FF'},approved:{label:'Aprobada',tone:'#18734A',bg:'#E7F6ED'},rejected:{label:'Rechazada',tone:'#A32921',bg:'#FDEAEA'},cancelled:{label:'Cancelada',tone:'#5B6470',bg:'#EEF0F3'},requires_financial_processing:{label:'Revisión financiera',tone:'#7445A8',bg:'#F2EAFB'}};
  const actionStatuses=['submitted','in_review','approved','rejected','cancelled'];
  const exportLabels={pending:'Pendiente de aprobación',ready_for_handoff:'Lista para enviar',in_progress:'Enviando a gestión…',handed_off:'Enviada a gestión',failed:'No se pudo enviar'};
  const exportErrorCopy=(code)=>({REQUIRED_PRIVATE_DOCUMENT_MISSING:'Falta un documento requerido.',PRIVATE_DOCUMENT_AMBIGUOUS:'Hay documentos duplicados que deben revisarse.',HANDOFF_UNAVAILABLE:'El servicio de envío no está disponible.',HANDOFF_REJECTED:'El destino rechazó el envío.',HANDOFF_CONTRACT_MISMATCH:'La verificación del envío no coincidió.'}[code]||'Revisa los datos y documentos antes de reintentar.');
  const normalize=(value)=>String(value==null?'':value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const humanCode=(value)=>String(value||'Solicitud').replace(/[_-]+/g,' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
  const requestType=(value)=>({benefit:'Solicitud de beneficio',quote:'Solicitud de cotización',interest:'Solicitud de interés'}[value]||humanCode(value));
  const procedure=(row)=>row&&((row.membership&&row.membership.concept)||(row.product&&row.product.name)||(row.program_item&&row.program_item.name)||row.productoNombre||humanCode(row.program_id));
  const person=(row)=>row&&row.affiliate&&(row.affiliate.display_name||row.affiliate.full_name)||'Afiliado';
  const maskedControl=(value)=>{const text=String(value||'');return text?'•••• '+text.slice(-4):'Sin referencia';};
  const dateTime=(value)=>value?new Date(value).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):'—';
  const age=(value)=>{const ms=Math.max(0,Date.now()-new Date(value).getTime()),hours=Math.floor(ms/3600000),days=Math.floor(hours/24);if(hours<1)return Math.max(1,Math.floor(ms/60000))+' min';if(hours<24)return hours+' h';return days+' d';};
  const ageBucket=(value)=>{const days=Math.floor(Math.max(0,Date.now()-new Date(value).getTime())/86400000);return days===0?'today':days<=3?'1-3':days<=7?'4-7':'8+';};
  const stateLabel=(value)=>(statusMeta[value]||{label:humanCode(value)}).label;
  const documentStateLabel=(value)=>({PENDING_REVIEW:'Pendiente',UNDER_REVIEW:'En revisión',VERIFIED:'Verificado',REUPLOAD_REQUIRED:'Requiere nueva carga',REJECTED:'Rechazado'}[value]||humanCode(String(value||'').toLowerCase()));

  function useRequestsDesktop(){
    const query=()=>window.matchMedia&&window.matchMedia('(min-width: 1024px)').matches;
    const[desktop,setDesktop]=React.useState(query);
    React.useEffect(()=>{const media=window.matchMedia('(min-width: 1024px)'),change=()=>setDesktop(media.matches);change();media.addEventListener?media.addEventListener('change',change):media.addListener(change);return()=>media.removeEventListener?media.removeEventListener('change',change):media.removeListener(change);},[]);
    return desktop;
  }

  function StatusBadge({status}){const meta=statusMeta[status]||{label:humanCode(status),tone:'#5B6470',bg:'#EEF0F3'};return h('span',{'data-request-human-status':meta.label,style:{display:'inline-flex',alignItems:'center',minHeight:25,padding:'0 9px',borderRadius:999,background:meta.bg,color:meta.tone,fontSize:11,fontWeight:850,whiteSpace:'nowrap'}},meta.label);}

  function AdminQueueToolbar({allRows,rows,filters,setFilters}){
    const statuses=Array.from(new Set(allRows.map((row)=>row.status))).sort(),types=Array.from(new Set(allRows.map((row)=>row.request_type))).sort();
    const field=(label,control)=>h('label',{className:'reqwb-field'},h('span',null,label),control);
    const select=(label,value,onChange,items)=>h('select',{'aria-label':label,value,onChange},h('option',{value:''},'Todos'),items.map((item)=>h('option',{key:item.value,value:item.value},item.label)));
    return h('section',{'data-request-toolbar':'true',className:'reqwb-toolbar'},
      h('div',{className:'reqwb-filters'},
        field('Buscar',h('input',{'aria-label':'Buscar solicitudes',value:filters.search,placeholder:'Folio, afiliado o trámite',onChange:(e)=>setFilters(Object.assign({},filters,{search:e.target.value}))})),
        field('Estado',select('Filtrar por estado',filters.status,(e)=>setFilters(Object.assign({},filters,{status:e.target.value})),statuses.map((value)=>({value,label:stateLabel(value)})))),
        field('Tipo',select('Filtrar por tipo',filters.type,(e)=>setFilters(Object.assign({},filters,{type:e.target.value})),types.map((value)=>({value,label:requestType(value)})))),
        field('Antigüedad',select('Filtrar por antigüedad',filters.age,(e)=>setFilters(Object.assign({},filters,{age:e.target.value})),[{value:'today',label:'Hoy'},{value:'1-3',label:'1–3 días'},{value:'4-7',label:'4–7 días'},{value:'8+',label:'8 días o más'}])),
        field('Fecha',h('input',{type:'date','aria-label':'Filtrar por fecha',value:filters.date,onChange:(e)=>setFilters(Object.assign({},filters,{date:e.target.value}))}))),
      h('div',{className:'reqwb-toolbar-foot'},h('div',null,h('strong',{'data-request-result-count':'true'},rows.length),' resultados'),h('button',{type:'button',onClick:()=>setFilters({search:'',status:'',type:'',age:'',date:''})},'Limpiar filtros')));
  }

  function AdminQueueTable({rows,selectedId,onSelect,feedback}){
    if(rows.length===0)return h('div',{'data-request-queue':'true',className:'reqwb-table-wrap'},h('div',{className:'reqwb-empty'},h(I,{name:'receipt',size:28,stroke:1.8}),h('strong',null,'No hay solicitudes con estos filtros.'),h('span',null,'Ajusta o limpia los filtros para continuar.')));
    return h('div',{'data-request-queue':'true',className:'reqwb-table-wrap'},h('table',{className:'reqwb-table'},
      h('thead',null,h('tr',null,h('th',null,'Folio'),h('th',null,'Solicitante / trámite'),h('th',null,'Estado'),h('th',null,'Antigüedad'))),
      h('tbody',null,rows.map((row)=>{const current=row.id===selectedId,notice=feedback[row.id];return h('tr',{key:row.id,'data-request-queue-row':row.id,'aria-selected':current?'true':'false',className:current?'is-selected':'',onClick:()=>onSelect(row.id)},
        h('td',null,h('strong',null,row.folio||'Sin folio')),
        h('td',null,h('div',{'data-request-person':'true',className:'reqwb-person'},person(row)),h('div',{className:'reqwb-procedure'},procedure(row)),h('div',{className:'reqwb-secondary'},requestType(row.request_type)+' · '+dateTime(row.created_at))),
        h('td',null,h(StatusBadge,{status:row.status}),notice&&h('div',{'data-request-inline-feedback':notice.phase,className:'reqwb-inline '+notice.phase},notice.phase==='saving'?'Guardando…':notice.phase==='success'?'✓ Estado actualizado':'! No se pudo guardar')),
        h('td',null,h('strong',null,age(row.created_at))));}))));
  }

  function timelineEntries(detail){
    if(!detail)return[];
    const entries=[{key:'created',label:'Solicitud enviada',date:detail.created_at,kind:'done'}],tracking=detail.tracking,dates=tracking&&tracking.stage_dates||{};
    if(tracking&&Array.isArray(tracking.stages))tracking.stages.forEach((stage)=>{const raw=dates[stage.id]||dates[stage.name]||null,current=tracking.current_stage_id===stage.id;if(raw||current)entries.push({key:stage.id,label:stage.name,date:raw||tracking.updated_at,description:stage.description,responsible:stage.responsible,kind:current?'active':'done'});});
    if(entries.length===1&&detail.updated_at&&detail.updated_at!==detail.created_at)entries.push({key:'updated',label:'Estado actual: '+stateLabel(detail.status),date:detail.updated_at,kind:'active'});
    return entries;
  }

  function AdminTimeline({detail}){const entries=timelineEntries(detail);return h('section',{className:'reqwb-section','data-request-timeline':'true'},h('h3',null,h(I,{name:'clock',size:17,stroke:2}),'Actividad registrada'),detail.tracking_available===false&&h('div',{'data-request-tracking-unavailable':'true',className:'reqwb-empty-small'},'El flujo configurado no está disponible con la proyección autorizada actual.'),h('div',{className:'reqwb-timeline'},entries.map((entry)=>h('div',{key:entry.key,className:'reqwb-event '+entry.kind},h('span',{className:'reqwb-event-dot'}),h('div',null,h('strong',null,entry.label),h('time',null,dateTime(entry.date)),entry.responsible&&h('span',null,'Área responsable: '+entry.responsible),entry.description&&h('span',null,entry.description))))));}

  function DocumentSummary({detail}){
    const docs=detail.request_documents||[],requirements=detail.requirements||[],byType=new Map(docs.map((doc)=>[doc.document_type&&doc.document_type.id,doc]));
    if(detail.documents_available===false)return h('div',{'data-request-document-summary':'true',className:'reqwb-empty-small'},'El resumen documental no está disponible con la proyección autorizada actual.');
    if(!docs.length&&!requirements.length)return h('div',{'data-request-document-summary':'true',className:'reqwb-empty-small'},detail.requirements_available===false?'Los requisitos específicos de esta solicitud no están expuestos en la proyección autorizada actual.':'Esta solicitud no tiene documentos ni requisitos asociados.');
    const rows=requirements.length?requirements.map((req)=>({key:req.id,label:req.document_type&&req.document_type.label||'Documento',required:req.required,doc:byType.get(req.document_type&&req.document_type.id)})):docs.map((doc)=>({key:doc.id,label:doc.document_type&&doc.document_type.label||'Documento',required:false,doc}));
    return h('div',{'data-request-document-summary':'true',className:'reqwb-doc-list'},rows.map((item)=>h('div',{key:item.key},h(I,{name:item.doc?'checkCircle':'doc',size:16,stroke:2}),h('span',null,h('strong',null,item.label),h('small',null,item.doc?('Adjunto · '+documentStateLabel(item.doc.status_at_submission)):item.required?'Requerido · sin evidencia adjunta':'Sin evidencia adjunta')))));
  }

  function AdminSafeActionBar({row,draft,onDraft,canWrite,ready,busy,feedback,onSave,onPrevious,onNext,position,total}){
    const changed=draft!==row.status;
    return h('section',{'data-request-safe-action-bar':'true',className:'reqwb-actions'},
      h('div',{className:'reqwb-current-state'},h('span',null,'Estado actual'),h(StatusBadge,{status:row.status})),
      h('label',{className:'reqwb-field'},h('span',null,'Acción: cambiar estado'),h('select',{'aria-label':'Nuevo estado de la solicitud',value:draft,onChange:(e)=>onDraft(e.target.value),disabled:!canWrite||!ready||busy},actionStatuses.map((status)=>h('option',{key:status,value:status},stateLabel(status))))),
      !canWrite&&h('div',{className:'reqwb-permission-note'},'Solo lectura. Se requiere program_requests.write.'),
      feedback&&h('div',{'data-request-action-feedback':feedback.phase,className:'reqwb-action-feedback '+feedback.phase},feedback.phase==='saving'?'Guardando…':feedback.phase==='success'?'✓ Estado actualizado y verificado.':h(React.Fragment,null,'No se pudo guardar. ',h('button',{type:'button',onClick:()=>onSave(false)},'Reintentar'))),
      h('div',{className:'reqwb-save-row'},h('button',{type:'button',onClick:()=>onSave(false),disabled:!canWrite||!ready||busy||!changed},busy?'Guardando…':'Guardar'),h('button',{type:'button',className:'primary',onClick:()=>onSave(true),disabled:!canWrite||!ready||busy||!changed},'Guardar y siguiente')),
      h('div',{className:'reqwb-nav'},h('button',{type:'button',onClick:onPrevious,disabled:position<=1},'Anterior'),h('span',null,position+' de '+total),h('button',{type:'button',onClick:onNext,disabled:position>=total},'Siguiente')));
  }

  function AdminDetailPanel({row,detail,phase,error,draft,onDraft,canWrite,busy,feedback,onSave,onPrevious,onNext,position,total,detailRef}){
    if(!row)return h('aside',{'data-request-detail-panel':'true',className:'reqwb-detail'},h('div',{className:'reqwb-empty'},h(I,{name:'receipt',size:30,stroke:1.8}),h('strong',null,'Selecciona una solicitud'),h('span',null,'El detalle permanecerá visible mientras trabajas la cola.')));
    const loaded=detail&&detail.id===row.id;
    let body=null;
    if(phase==='loading'&&!loaded){
      body=h('div',{className:'reqwb-empty'},'Cargando detalle…');
    }else if(phase==='error'&&!loaded){
      body=h('div',{className:'reqwb-empty'},h('strong',null,'No fue posible cargar el detalle.'),h('span',null,error||'Conservamos tu selección y filtros.'));
    }else if(loaded){
      body=h(React.Fragment,null,
        h('div',{className:'reqwb-detail-scroll'},
          h('section',{className:'reqwb-section'},h('h3',null,h(I,{name:'user',size:17,stroke:2}),'Solicitante'),h('div',{'data-request-detail-person':'true',className:'reqwb-identity'},h('strong',null,person(detail)),h('span',null,maskedControl(detail.numero_control)))),
          h('section',{className:'reqwb-section'},h('h3',null,h(I,{name:'receipt',size:17,stroke:2}),'Trámite'),h('dl',{className:'reqwb-facts'},h('div',null,h('dt',null,'Tipo'),h('dd',null,requestType(detail.request_type))),h('div',null,h('dt',null,'Trámite'),h('dd',null,procedure(detail))),h('div',null,h('dt',null,'Fecha'),h('dd',null,dateTime(detail.created_at))),h('div',null,h('dt',null,'Cantidad'),h('dd',null,detail.quantity||1)),h('div',null,h('dt',null,'Empresa'),h('dd',null,detail.empresaNombre||'No aplica'))),detail.notes&&h('div',{className:'reqwb-notes'},h('strong',null,'Descripción / notas registradas'),h('p',null,detail.notes))),
          h('section',{className:'reqwb-section'},h('h3',null,h(I,{name:'doc',size:17,stroke:2}),'Requisitos y documentos'),h(DocumentSummary,{detail})),
          h('section',{className:'reqwb-section'},h('h3',null,h(I,{name:'checkCircle',size:17,stroke:2}),'Términos aceptados'),h('div',{className:'reqwb-terms'},h('strong',null,detail.terms_accepted?'Sí':'No registrados'),detail.terms_version?h('span',null,detail.terms_version.title+' · versión '+detail.terms_version.version):h('span',null,'Versión no expuesta en la proyección autorizada'))),
          h(AdminTimeline,{detail}),
          h('details',{className:'reqwb-technical'},h('summary',null,'Detalles técnicos'),h('div',null,h('span',null,'ID interno'),h('code',null,detail.id),h('span',null,'Código de programa'),h('code',null,detail.program_id)))
        ),
        h(AdminSafeActionBar,{row,draft,onDraft,canWrite,ready:loaded,busy,feedback,onSave,onPrevious,onNext,position,total})
      );
    }
    return h('aside',{'data-request-detail-panel':'true',className:'reqwb-detail',ref:detailRef,tabIndex:-1},
      h('div',{className:'reqwb-detail-head'},h('div',null,h('span',null,'SOLICITUD'),h('strong',null,row.folio)),h(StatusBadge,{status:row.status})),
      body
    );
  }

  function DesktopRequests({app,onBack,header,rows,phase,error,reload}){
    const[filters,setFilters]=React.useState({search:'',status:'',type:'',age:'',date:''}),[selectedId,setSelectedId]=React.useState(''),[detail,setDetail]=React.useState(null),[detailPhase,setDetailPhase]=React.useState('idle'),[detailError,setDetailError]=React.useState(''),[detailNonce,setDetailNonce]=React.useState(0),[drafts,setDrafts]=React.useState({}),[busy,setBusy]=React.useState(''),[feedback,setFeedback]=React.useState({});
    const detailRef=React.useRef(null),canWrite=app.admin.has('program_requests.write');
    const visible=React.useMemo(()=>rows.filter((row)=>{const query=normalize(filters.search),haystack=normalize([row.folio,person(row),row.numero_control,procedure(row),requestType(row.request_type),row.program_id,row.empresaNombre].join(' '));return(!query||haystack.includes(query))&&(!filters.status||row.status===filters.status)&&(!filters.type||row.request_type===filters.type)&&(!filters.age||ageBucket(row.created_at)===filters.age)&&(!filters.date||String(row.created_at||'').slice(0,10)===filters.date);}),[rows,filters]);
    React.useEffect(()=>{if(!visible.some((row)=>row.id===selectedId))setSelectedId(visible[0]&&visible[0].id||'');},[visible.map((row)=>row.id).join('|'),selectedId]);
    const selected=visible.find((row)=>row.id===selectedId)||null,index=selected?visible.indexOf(selected):-1;
    React.useEffect(()=>{if(!selectedId){setDetail(null);setDetailPhase('idle');return;}let active=true;setDetailPhase('loading');setDetailError('');window.ProgramRequestRepository.detail(selectedId).then((value)=>{if(active){setDetail(value);setDrafts((current)=>Object.assign({},current,{[selectedId]:current[selectedId]||value.status}));setDetailPhase('loaded');}}).catch(()=>{if(active){setDetailError('La fuente autoritativa no respondió.');setDetailPhase('error');}});return()=>{active=false;};},[selectedId,detailNonce]);
    const move=(offset)=>{if(!visible.length)return;const next=Math.max(0,Math.min(visible.length-1,(index<0?0:index)+offset));setSelectedId(visible[next].id);};
    const save=async(moveNext)=>{if(!selected||busy||!detail||detail.id!==selected.id)return;const status=drafts[selected.id]||selected.status,nextId=visible[index+1]&&visible[index+1].id||visible[index-1]&&visible[index-1].id||selected.id;if(status===selected.status)return;setBusy(selected.id);setFeedback((current)=>Object.assign({},current,{[selected.id]:{phase:'saving'}}));try{await window.ProgramRequestRepository.update(selected.id,status,detail.notes||'');const refreshed=await reload(true),verified=refreshed.find((row)=>row.id===selected.id&&row.status===status);if(!verified)throw new Error('REQUEST_UPDATE_READBACK_FAILED');if(moveNext&&nextId!==selected.id)setSelectedId(nextId);else setDetailNonce((value)=>value+1);setFeedback((current)=>Object.assign({},current,{[selected.id]:{phase:'success'}}));}catch(_){setFeedback((current)=>Object.assign({},current,{[selected.id]:{phase:'error'}}));}finally{setBusy('');}};
    const onKeyDown=(event)=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName))return;if(event.key==='ArrowDown'){event.preventDefault();move(1);}else if(event.key==='ArrowUp'){event.preventDefault();move(-1);}else if(event.key==='Enter'&&selected){event.preventDefault();detailRef.current&&detailRef.current.focus();}};
    let content=null;
    if(phase==='loading'&&!rows.length){
      content=h('div',{className:'reqwb-empty'},'Cargando solicitudes…');
    }else if(phase==='error'&&!rows.length){
      content=h('div',{className:'reqwb-empty'},h('strong',null,'No fue posible cargar las solicitudes.'),h('button',{type:'button',onClick:()=>reload(false)},'Reintentar'));
    }else{
      content=h(React.Fragment,null,
        h('div',{className:'reqwb-metrics'},
          h('div',null,h('strong',null,rows.filter((row)=>row.status==='submitted').length),h('span',null,'Pendientes')),
          h('div',null,h('strong',null,rows.filter((row)=>row.status==='in_review').length),h('span',null,'En revisión'))
        ),
        h(AdminQueueToolbar,{allRows:rows,rows:visible,filters,setFilters}),
        h('div',{className:'reqwb-grid'},
          h(AdminQueueTable,{rows:visible,selectedId,onSelect:setSelectedId,feedback}),
          h(AdminDetailPanel,{row:selected,detail,phase:detailPhase,error:detailError,draft:selected?drafts[selected.id]||selected.status:'',onDraft:(value)=>selected&&setDrafts((current)=>Object.assign({},current,{[selected.id]:value})),canWrite,busy:busy===selectedId,feedback:selected&&feedback[selected.id],onSave:save,onPrevious:()=>move(-1),onNext:()=>move(1),position:index+1,total:visible.length,detailRef})
        )
      );
    }
    return h('div',{'data-admin-requests-workbench':'true',className:'reqwb-root',tabIndex:0,onKeyDown},
      h(DesktopStyles),
      header({title:'Solicitudes',sub:rows.length+' solicitudes generales · finanzas separadas',onBack}),
      window.ActingBanner&&h(window.ActingBanner,{}),
      h('div',{className:'su-app-scroll reqwb-scroll'},
        h('div',{className:'reqwb-boundary'},h(I,{name:'info',size:17,stroke:2}),h('span',null,'Bandeja de solicitudes generales. Los financiamientos y su procesamiento continúan en “Finanzas · Solicitudes”.')),
        content
      )
    );
  }

  function DesktopStyles(){return h('style',null,`
    .reqwb-root{min-width:0;outline:none}.reqwb-scroll{padding:14px 16px 22px!important}.reqwb-boundary{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;margin-bottom:12px;border:1px solid #D6E2FB;border-radius:13px;background:#EEF3FF;color:var(--ink-2);font-size:11.5px;font-weight:650;line-height:1.45}.reqwb-metrics{display:flex;gap:9px;margin-bottom:10px}.reqwb-metrics>div{display:flex;align-items:baseline;gap:7px;padding:8px 11px;background:var(--surface);border-radius:12px;box-shadow:var(--neo-sm)}.reqwb-metrics strong{font-size:17px}.reqwb-metrics span{font-size:11px;font-weight:750;color:var(--ink-3)}
    .reqwb-toolbar{background:var(--surface);border:1px solid var(--hairline);border-radius:15px;padding:11px;margin-bottom:12px;box-shadow:var(--neo-sm)}.reqwb-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.reqwb-field{display:flex;flex-direction:column;gap:5px;min-width:0}.reqwb-field>span{font-size:10.5px;font-weight:800;color:var(--ink-3)}.reqwb-field input,.reqwb-field select{width:100%;min-width:0;height:36px;box-sizing:border-box;border:1px solid var(--hairline);border-radius:10px;background:var(--surface-2);padding:0 10px;color:var(--ink);font:650 11.5px inherit;outline:none}.reqwb-field input:focus,.reqwb-field select:focus{border-color:var(--guinda);box-shadow:0 0 0 2px rgba(122,21,59,.1)}.reqwb-toolbar-foot{display:flex;align-items:center;justify-content:space-between;margin-top:9px;color:var(--ink-3);font-size:11.5px}.reqwb-toolbar-foot strong{color:var(--ink);font-size:13px}.reqwb-toolbar-foot button,.reqwb-empty button{border:0;background:transparent;color:var(--guinda);font:800 11.5px inherit;cursor:pointer}
    .reqwb-grid{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(300px,.82fr);gap:12px;min-height:530px;height:calc(100vh - 286px)}.reqwb-table-wrap,.reqwb-detail{min-width:0;background:var(--surface);border:1px solid var(--hairline);border-radius:16px;box-shadow:var(--neo-sm);overflow:hidden}.reqwb-table-wrap{overflow-y:auto}.reqwb-table{width:100%;border-collapse:collapse;table-layout:fixed}.reqwb-table th{position:sticky;top:0;z-index:2;padding:10px 9px;background:var(--surface-2);border-bottom:1px solid var(--hairline);color:var(--ink-3);font-size:9.5px;font-weight:850;letter-spacing:.045em;text-align:left;text-transform:uppercase}.reqwb-table th:nth-child(1){width:76px}.reqwb-table th:nth-child(3){width:100px}.reqwb-table th:nth-child(4){width:62px}.reqwb-table td{padding:10px 9px;border-bottom:1px solid var(--hairline);vertical-align:top;font-size:11.5px;cursor:pointer}.reqwb-table tr:hover td{background:var(--surface-2)}.reqwb-table tr.is-selected td{background:#F7EDF1}.reqwb-table tr.is-selected td:first-child{box-shadow:inset 3px 0 var(--guinda)}.reqwb-table td>strong{font:800 11px var(--mono);color:var(--guinda)}.reqwb-person{font-size:12px;font-weight:850;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reqwb-procedure{margin-top:2px;font-size:11.5px;font-weight:700;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reqwb-secondary{margin-top:3px;font-size:9.8px;font-weight:600;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reqwb-inline{margin-top:5px;font-size:9.5px;font-weight:800}.reqwb-inline.saving{color:#6A5A00}.reqwb-inline.success{color:#18734A}.reqwb-inline.error{color:#A32921}.reqwb-empty{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:24px;text-align:center;color:var(--ink-3);font-size:12px}.reqwb-empty strong{color:var(--ink);font-size:14px}
    .reqwb-detail{display:flex;flex-direction:column}.reqwb-detail:focus{outline:2px solid rgba(122,21,59,.25);outline-offset:-2px}.reqwb-detail-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--hairline);background:var(--surface-2)}.reqwb-detail-head>div{display:flex;flex-direction:column;gap:2px}.reqwb-detail-head span:first-child{font-size:9px;font-weight:850;letter-spacing:.08em;color:var(--ink-3)}.reqwb-detail-head strong{font:850 13px var(--mono);color:var(--ink)}.reqwb-detail-scroll{flex:1;overflow-y:auto;padding:12px}.reqwb-section{padding:12px;margin-bottom:10px;border:1px solid var(--hairline);border-radius:13px;background:var(--surface)}.reqwb-section h3{display:flex;align-items:center;gap:7px;margin:0 0 9px;color:var(--ink);font-size:12.5px}.reqwb-identity{display:flex;align-items:center;justify-content:space-between;gap:10px}.reqwb-identity strong{font-size:13px}.reqwb-identity span{font:750 10.5px var(--mono);color:var(--ink-3)}.reqwb-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0}.reqwb-facts div{min-width:0}.reqwb-facts dt{font-size:9.5px;font-weight:750;color:var(--ink-3)}.reqwb-facts dd{margin:2px 0 0;font-size:11px;font-weight:750;color:var(--ink);overflow-wrap:anywhere}.reqwb-notes{margin-top:10px;padding:9px 10px;border-radius:10px;background:var(--surface-2)}.reqwb-notes strong{font-size:10.5px}.reqwb-notes p{margin:4px 0 0;font-size:11px;line-height:1.45;color:var(--ink-2);white-space:pre-wrap}.reqwb-doc-list{display:flex;flex-direction:column;gap:7px}.reqwb-doc-list>div{display:flex;gap:8px;align-items:flex-start}.reqwb-doc-list>div>span{display:flex;flex-direction:column;gap:2px}.reqwb-doc-list strong{font-size:11px}.reqwb-doc-list small,.reqwb-terms span,.reqwb-empty-small{font-size:10px;color:var(--ink-3);font-weight:650}.reqwb-terms{display:flex;justify-content:space-between;gap:10px}.reqwb-terms strong{font-size:11.5px}.reqwb-timeline{display:flex;flex-direction:column;gap:10px}.reqwb-event{position:relative;display:grid;grid-template-columns:12px 1fr;gap:7px}.reqwb-event-dot{width:8px;height:8px;margin-top:3px;border-radius:50%;background:#8CA0BE}.reqwb-event.active .reqwb-event-dot{background:var(--guinda);box-shadow:0 0 0 4px var(--guinda-50)}.reqwb-event>div{display:flex;flex-direction:column;gap:2px}.reqwb-event strong{font-size:11px}.reqwb-event time,.reqwb-event span{font-size:9.5px;color:var(--ink-3);font-weight:650}.reqwb-technical{margin:4px 0 8px;color:var(--ink-3);font-size:10px}.reqwb-technical summary{cursor:pointer;font-weight:750}.reqwb-technical div{display:grid;grid-template-columns:auto 1fr;gap:5px 8px;margin-top:7px}.reqwb-technical code{overflow-wrap:anywhere;color:var(--ink-2)}
    .reqwb-actions{border-top:1px solid var(--hairline);padding:12px 13px;background:var(--surface-2)}.reqwb-current-state{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.reqwb-current-state>span{font-size:10.5px;font-weight:800;color:var(--ink-3)}.reqwb-permission-note{margin-top:7px;font-size:10px;font-weight:700;color:#8A5A00}.reqwb-action-feedback{margin-top:7px;font-size:10.5px;font-weight:750}.reqwb-action-feedback.success{color:#18734A}.reqwb-action-feedback.error{color:#A32921}.reqwb-action-feedback button{border:0;background:transparent;color:inherit;text-decoration:underline;font:inherit;cursor:pointer}.reqwb-save-row{display:grid;grid-template-columns:1fr 1.25fr;gap:7px;margin-top:9px}.reqwb-save-row button,.reqwb-nav button{min-height:34px;border:1px solid var(--hairline);border-radius:10px;background:var(--surface);color:var(--ink-2);font:800 10.5px inherit;cursor:pointer}.reqwb-save-row button.primary{border-color:var(--guinda);background:var(--guinda);color:#fff}.reqwb-save-row button:disabled,.reqwb-nav button:disabled{opacity:.45;cursor:not-allowed}.reqwb-nav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:7px;margin-top:8px}.reqwb-nav span{text-align:center;font:750 10px var(--mono);color:var(--ink-3)}
    @media(max-width:1279px){.reqwb-grid{grid-template-columns:minmax(0,1.08fr) minmax(300px,.92fr)}.reqwb-table th:nth-child(2){width:auto}.reqwb-filters{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(min-width:1280px){.reqwb-scroll{padding-left:18px!important;padding-right:18px!important}.reqwb-filters{grid-template-columns:repeat(5,minmax(0,1fr))}.reqwb-grid{grid-template-columns:minmax(0,1.42fr) minmax(360px,.78fr);height:calc(100vh - 270px)}}
  `);}

  function MobileRequests({app,onBack,header,rows,phase,error,load,busy}){
    const change=async(row,status)=>{try{busy.set(row.id);if(status==='approved'&&row.financial_processing_status!=null){await window.FinancialLegacyRepository.approveRequest(row.id);app.toast&&app.toast('Solicitud aprobada y enviada a gestión.');}else{await window.ProgramRequestRepository.update(row.id,status,row.notes||'');app.toast&&app.toast('Estado actualizado');}await load(false);}catch(_){app.toast&&app.toast('No se completó el envío. Revisa los datos y documentos requeridos; puedes reintentar sin duplicar la solicitud.');}finally{busy.set('');}};
    const retry=async(row)=>{try{busy.set(row.id);await window.FinancialLegacyRepository.handoffRequest(row.id);await load(false);app.toast&&app.toast('Solicitud enviada a gestión.');}catch(_){app.toast&&app.toast('El envío sigue pendiente. No se creó una solicitud duplicada; puedes reintentar.');}finally{busy.set('');}};
    return h('div',null,header({title:'Solicitudes',sub:rows.length+' trámite(s) registrado(s)',onBack}),window.ActingBanner&&h(window.ActingBanner,{}),h('div',{className:'su-app-scroll',style:{padding:16,paddingBottom:28}},h('div',{style:{background:'#EEF3FF',border:'1px solid #D6E2FB',borderRadius:14,padding:'11px 13px',display:'flex',gap:10,alignItems:'flex-start',marginBottom:16}},h(I,{name:'info',size:17,stroke:2,style:{color:'#2456C7',flexShrink:0,marginTop:1}}),h('div',{style:{fontSize:11.5,color:'var(--ink-2)',fontWeight:600,lineHeight:1.5}},'Aquí se consultan las solicitudes iniciales de programas, productos y cotizaciones. Los procesos financieros posteriores se gestionan por separado.')),phase==='loading'?h('div',{'data-program-requests-state':'loading',style:{padding:18,textAlign:'center',fontWeight:700,color:'var(--ink-3)'}},'Cargando solicitudes…'):phase==='error'?h('div',{'data-program-requests-state':'error',style:{padding:18,textAlign:'center',fontWeight:700,color:'#A32921'}},error,' ',h('button',{onClick:()=>load(false)},'Reintentar')):rows.length===0?h(window.EmptyState,{icon:'receipt',title:'Sin solicitudes',sub:'Cuando un afiliado envíe una solicitud, aparecerá aquí.'}):h('div',{style:{display:'flex',flexDirection:'column',gap:11}},rows.map((row)=>h('div',{key:row.id,style:{background:'var(--surface)',borderRadius:16,padding:14,boxShadow:'var(--neo-sm)'}},h('div',{style:{display:'flex',alignItems:'flex-start',gap:11}},h('div',{style:{width:42,height:42,borderRadius:12,background:'var(--guinda-50)',color:'var(--guinda)',display:'grid',placeItems:'center',flexShrink:0}},h(I,{name:row.request_type==='quote'?'doc':'receipt',size:21,stroke:2})),h('div',{style:{flex:1,minWidth:0}},h('div',{style:{fontSize:14.5,fontWeight:800,color:'var(--ink)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},row.productoNombre||row.program_id),h('div',{'data-request-person':'true',style:{fontSize:12,color:'var(--ink-3)',fontWeight:600,marginTop:3}},row.nombre+' · '+row.numero_control),h('div',{style:{fontSize:11.5,color:'var(--ink-3)',fontWeight:600,marginTop:3}},row.program_id+(row.empresaNombre?' · '+row.empresaNombre:'')+' · '+row.fecha)),h('span',{style:{fontFamily:'var(--mono)',fontSize:10.5,fontWeight:700,color:'var(--guinda)',flexShrink:0}},row.folio)),row.financial_processing_status!=null&&h('div',{'data-financial-export-state':row.financial_processing_status,style:{marginTop:10,fontSize:11.5,fontWeight:800,color:row.financial_processing_status==='failed'?'#A32921':row.financial_processing_status==='handed_off'?'#18734A':'var(--ink-3)'}},exportLabels[row.financial_processing_status]||'Procesamiento financiero'),row.financial_processing_status==='failed'&&h('div',{style:{marginTop:4,fontSize:11.5,fontWeight:600,color:'#7C332E'}},exportErrorCopy(row.financial_export&&row.financial_export.error_code)),h('select',{value:row.status,disabled:!app.admin.has('program_requests.write')||busy.value===row.id||row.financial_processing_status==='handed_off',onChange:(event)=>change(row,event.target.value),style:{width:'100%',marginTop:12,border:'none',outline:'none',background:'var(--surface-2)',boxShadow:'var(--neo-inset)',borderRadius:11,padding:'10px 12px',fontSize:12.5,fontWeight:700,fontFamily:'inherit',color:'var(--ink)'}},Object.keys(mobileLabels).map((status)=>h('option',{key:status,value:status},mobileLabels[status]))),row.status==='approved'&&['ready_for_handoff','failed'].includes(row.financial_processing_status)&&h('button',{type:'button',disabled:busy.value===row.id||!app.admin.has('program_requests.write'),onClick:()=>retry(row),style:{width:'100%',marginTop:9,border:'none',borderRadius:11,padding:'10px 12px',background:'var(--guinda)',color:'#fff',fontSize:12.5,fontWeight:800,fontFamily:'inherit'}},busy.value===row.id?'Enviando…':'Reintentar envío'))))));
  }

  function RequestsModule({app,onBack,header}){
    const desktop=useRequestsDesktop(),[rows,setRows]=React.useState([]),[phase,setPhase]=React.useState('loading'),[error,setError]=React.useState(''),[busyValue,setBusyValue]=React.useState('');
    const load=React.useCallback(async(quiet)=>{try{if(!quiet)setPhase('loading');const source=desktop?await window.ProgramRequestRepository.listGeneralQueue():await window.ProgramRequestRepository.listMobile();setRows(source.slice());setError('');setPhase('loaded');return source;}catch(_){if(!quiet)setRows([]);setError('No fue posible cargar las solicitudes.');setPhase('error');return[];}},[desktop]);
    React.useEffect(()=>{load(false);},[load]);
    return desktop?h(DesktopRequests,{app,onBack,header,rows,phase,error,reload:load}):h(MobileRequests,{app,onBack,header,rows,phase,error,load,busy:{value:busyValue,set:setBusyValue}});
  }
  window.RequestsModule=RequestsModule;
})();
