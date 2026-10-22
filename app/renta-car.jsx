/* Renta Car only. Supabase owns prices, dates, bookings and immutable requests. */
(function(){
 'use strict';
 const h=React.createElement,{useState,useEffect,useRef}=React;
 const money=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(v));
 const date=v=>new Date(v+'T12:00:00Z').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
 const dayNumber=s=>Date.parse(s+'T00:00:00Z')/86400000;
 const days=(start,end)=>start&&end?dayNumber(end)-dayNumber(start)+1:0;
 const overlaps=(start,end,booked)=>(booked||[]).some(b=>start<=b.end&&end>=b.start);
 const contextKey=()=>window.PrivateResourceDemand.context();
 async function rpc(name,data){const context=contextKey(),r=await window.SutiSupabase.getClient().rpc(name,data);if(context!==contextKey())throw Error('RENTA_CONTEXT_CHANGED');if(r.error)throw r.error;return r.data;}
 const refresh=()=>{window.operationsStore?.invalidate();window.dispatchEvent(new Event('suti:request-changed'));};
 const repository=Object.freeze({
  context:item=>rpc('renta_car_context',{p_item:item}),
  quote:(item,start,end)=>rpc('renta_car_quote',{p_item:item,p_start:start,p_end:end}),
  submit:async v=>{await window.FinanceBlocksRepository.assertAllowed();const result=await rpc('renta_car_submit',v);refresh();return result;},
  admin:async(id,action,comment,actionId)=>{const r=await rpc('renta_car_admin',{p_request:id,p_action:action,p_comment:comment,p_action_id:actionId});refresh();return r;},
  detail:id=>rpc('renta_car_detail',{p_request:id})
 });
 const message=e=>{
  const code=String(e?.message||e?.code||'');
  if(/RENTA_DATES_UNAVAILABLE|renta_car_no_overlap/.test(code))return 'Esas fechas ya están reservadas. Elige otro periodo.';
  if(/RENTA_DATES_INVALID|RENTA_APPROVAL_INVALID/.test(code))return 'Revisa las fechas: la entrega no puede ser anterior a hoy y la devolución debe ser igual o posterior.';
  if(/CONDITIONS_CHANGED/.test(code))return 'La tarifa cambió. Regresa al calendario para revisar el nuevo total.';
  if(/REQUIRED_DOCUMENTS_MISSING/.test(code))return 'Falta un documento vigente. Regresa a Documentos y revisa tu expediente.';
  if(/RENTA_VEHICLE_UNAVAILABLE/.test(code))return 'Esta unidad no está disponible para renta.';
  if(/RENTA_CONTEXT_CHANGED/.test(code))return 'La sesión cambió. Vuelve a abrir Renta Car.';
  return 'No se pudo completar la operación. Reintenta; no se enviará una solicitud duplicada.';
 };
 const card={background:'var(--surface)',borderRadius:18,padding:16,boxShadow:'var(--neo-sm)',marginTop:16};
 const DOCUMENT_CSS=`
  [data-renta-application] .mr-doc-pick{aspect-ratio:1/1;min-height:185px;padding:12px;font-family:inherit}
  [data-renta-application] .has-thumbnail .mr-doc-badge{display:none}
  [data-renta-application] .has-thumbnail .mr-doc-meta{margin-top:auto;padding-bottom:90px;text-shadow:0 1px 3px rgba(0,0,0,.58)}
  [data-renta-application] .has-thumbnail .mr-doc-meta strong{color:#fff;font-weight:800}
  [data-renta-application] .has-thumbnail .mr-doc-file{display:none}
  [data-renta-application] .mr-doc-replace{bottom:30px}
  [data-renta-application] .mr-doc-status{left:8px;right:8px;bottom:8px;border-radius:99px;background:rgba(255,255,255,.92);padding:4px 6px;font-size:10px;line-height:1.2}
 `;
 function Values({rows}){return h('dl',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,margin:'14px 0 0'}},rows.map(([label,value])=>h('div',{key:label,style:{minWidth:0}},h('dt',{style:{fontSize:12,fontWeight:700,color:'var(--ink-3)'}},label),h('dd',{style:{fontSize:15,fontWeight:850,margin:'4px 0 0',overflowWrap:'anywhere'}},value??'No registrado'))));}
 function Summary({snapshot,showApplicant=true}){
  const r=snapshot.rental||snapshot,a=snapshot.applicant;
  return h('section',{'data-renta-summary':true,style:card},h('h3',{style:{margin:0,fontSize:18}},snapshot.product?.name||'Renta Car'),
   h(Values,{rows:[['Entrega',date(r.start_date)],['Devolución',date(r.end_date)],['Días de renta',r.days],['Costo por día',money(r.daily_rate)],['Total de contado',money(r.total)],['Fecha límite de pago',date(r.payment_due_date)],['Número de pagos','1 · Contado']]}),
   h('p',{style:{fontSize:13,color:'var(--ink-2)',lineHeight:1.5}},'El pago completo debe realizarse antes de entregar la unidad. La reserva se confirma al aprobar Finanzas.'),
   showApplicant&&a&&h(React.Fragment,null,h('h4',null,'Datos de la persona firmante'),h(Values,{rows:[['Nombre',a.full_name],['Número de control',a.numero_control],['RFC',a.rfc],['CURP',a.curp],['Teléfono',a.phone],['Correo',a.email],['Domicilio',a.address],['Ciudad',a.city]]})),
   h('div',{'data-renta-contract':'pending',style:{marginTop:16,borderTop:'1px solid var(--hairline)',paddingTop:14}},h('strong',null,'Contrato de arrendamiento'),h('p',{style:{fontSize:13,lineHeight:1.5,marginBottom:0}},'Pendiente de creación. Las fechas, tarifa, total y datos de la persona solicitante quedan registrados. El documento físico requerirá firma original; la firma trazada en la app no se incluirá en el PDF.')));
 }
 function Application({item,quote,app,onClose}){
  const [step,setStep]=useState('documents'),[documents,setDocuments]=useState({phase:'loading',requirements:[],rows:[]}),[signature,setSignature]=useState(''),[accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(null),idem=useRef(crypto.randomUUID());
  const load=React.useCallback(async()=>{setDocuments(s=>({...s,phase:'loading'}));try{const [requirements,rows]=await Promise.all([window.DocumentWorkflowRepository.resolveRequirements('PROGRAM',item.id),window.DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_EXPEDIENTE')]);setDocuments({phase:'ready',requirements,rows});}catch(e){setDocuments({phase:'error',requirements:[],rows:[]});}},[item.id]);
  useEffect(()=>{load();},[load]);
  const latest=new Map();documents.rows.forEach(d=>{const old=latest.get(d.document_type_id);if(!old||d.created_at>old.created_at||(d.created_at===old.created_at&&d.id>old.id))latest.set(d.document_type_id,d);});
  const selected=documents.requirements.filter(r=>r.required!==false).map(r=>latest.get(r.document_type_id)).filter(d=>d?.available===true&&['PENDING_REVIEW','UNDER_REVIEW','VERIFIED'].includes(d.status));
  const ready=documents.phase==='ready'&&selected.length===documents.requirements.filter(r=>r.required!==false).length;
  const send=async()=>{if(!ready||!signature||!accepted||busy)return;setBusy(true);setError('');try{setSent(await repository.submit({p_item:item.id,p_start:quote.rental.start_date,p_end:quote.rental.end_date,p_daily_rate:quote.rental.daily_rate,p_signature:signature,p_accepted:true,p_documents:selected.map(d=>d.id),p_idempotency:idem.current}));}catch(e){setError(message(e));}finally{setBusy(false);}};
  if(sent)return h(window.RequestSubmissionSuccess,{app,folio:sent.folio,kind:'benefit',subject:item.nombre,workflowState:sent.workflow_state,onBack:onClose,fullScreen:true,destination:'Tu solicitud de Renta Car fue enviada a Finanzas. Las fechas quedarán reservadas cuando sea aprobada.'});
  return h('div',{'data-renta-application':step,style:{position:'absolute',inset:0,zIndex:88,background:'var(--bg)',display:'flex',flexDirection:'column',overflow:'hidden'}},
   h('style',null,DOCUMENT_CSS),
   h('header',{style:{background:'var(--surface)',padding:'16px',display:'flex',alignItems:'center',gap:12}},h('button',{'aria-label':'Atrás',onClick:()=>step==='summary'?setStep('documents'):onClose(),style:{border:0,borderRadius:12,padding:12,background:'var(--surface-2)'}},h(window.Icon,{name:'arrowL',size:20})),h('div',null,h('strong',null,step==='documents'?'Documentos':'Revisa y firma'),h('div',{style:{fontSize:12,color:'var(--ink-3)'}},step==='documents'?'Paso 1 de 2 · Expediente vigente':'Paso 2 de 2 · Renta Car'))),
   h('div',{className:'su-app-scroll',style:{flex:1,overflowY:'auto',padding:'16px 17px 130px'}},step==='documents'?h(window.UnifiedDocumentPhase,{requirements:documents.requirements,documents:documents.rows,onChanged:load,phase:documents.phase,onRetry:load,error:'No fue posible consultar el expediente.',accessPurpose:'SELF_SERVICE_EXPEDIENTE',title:'Verifica tus documentos'}):
    h(React.Fragment,null,h(Summary,{snapshot:quote}),h('section',{style:card},h('h3',null,'Firma electrónica'),h(window.SignaturePad,{value:signature,onChange:setSignature}),h('label',{style:{display:'flex',gap:10,fontSize:13,lineHeight:1.5,marginTop:16}},h('input',{type:'checkbox',checked:accepted,onChange:e=>setAccepted(e.target.checked)}),'Confirmo las fechas y el total de esta solicitud, y que el pago completo debe realizarse antes de la entrega.')),error&&h('p',{role:'alert',style:{color:'#A32921'}},error))),
   h('footer',{style:{position:'absolute',bottom:0,left:0,right:0,padding:'22px 17px calc(16px + env(safe-area-inset-bottom))',background:'linear-gradient(transparent,var(--surface) 20px)'}},h(window.Btn,{full:true,size:'lg',icon:step==='documents'?'arrowR':'check',disabled:step==='documents'?!ready:busy||!ready||!signature||!accepted,onClick:step==='documents'?()=>setStep('summary'):send},step==='documents'?'Continuar al resumen':busy?'Enviando solicitud…':'Enviar solicitud')));
 }
 function Flow({item,app}){
  const [state,setState]=useState({phase:'loading'}),[month,setMonth]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[pickingEnd,setPickingEnd]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[quote,setQuote]=useState(null),seq=useRef(0);
  const load=React.useCallback(async()=>{const current=++seq.current;setState({phase:'loading'});try{const data=await repository.context(item.id);if(seq.current!==current)return;setState({phase:'ready',...data});setMonth(data.today.slice(0,7));}catch(e){if(seq.current===current)setState({phase:'error',error:message(e)});}},[item.id]);
  useEffect(()=>{load();return()=>{seq.current++;};},[load]);
  useEffect(()=>{const focus=()=>load();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[load]);
  const count=days(start,end),valid=state.phase==='ready'&&count>0&&start>=state.today&&!overlaps(start,end,state.booked);
  const choose=value=>{setError('');if(pickingEnd&&value>=start){if(overlaps(start,value,state.booked)){setError('El periodo incluye días reservados. Elige fechas continuas disponibles.');return;}setEnd(value);setPickingEnd(false);}else{setStart(value);setEnd(value);setPickingEnd(true);}};
  const nextMonth=delta=>{const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));setMonth(d.toISOString().slice(0,7));};
  const continueFlow=async()=>{if(!valid||busy)return;setBusy(true);setError('');try{setQuote(await repository.quote(item.id,start,end));}catch(e){setError(message(e));await load();}finally{setBusy(false);}};
  if(state.phase==='loading')return h('section',{style:card,'data-renta-state':'loading'},'Consultando disponibilidad…');
  if(state.phase==='error')return h('section',{style:card,'data-renta-state':'error'},h('p',{role:'alert'},state.error),h(window.Btn,{onClick:load},'Reintentar'));
  const [y,m]=month.split('-').map(Number),offset=new Date(Date.UTC(y,m-1,1)).getUTCDay(),last=new Date(Date.UTC(y,m,0)).getUTCDate();
  return h(React.Fragment,null,h('section',{'data-renta-calendar':true,style:card},
   h('h3',{style:{margin:'0 0 5px'}},'Elige tus días de renta'),h('p',{style:{fontSize:12,color:'var(--ink-3)',marginTop:0}},'Selecciona entrega y devolución. Ambos días se cobran.'),
   h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',margin:'16px 0'}},h('button',{'aria-label':'Mes anterior',disabled:month<=state.today.slice(0,7),onClick:()=>nextMonth(-1)},'‹'),h('strong',null,new Date(Date.UTC(y,m-1,1)).toLocaleDateString('es-MX',{month:'long',year:'numeric',timeZone:'UTC'})),h('button',{'aria-label':'Mes siguiente',onClick:()=>nextMonth(1)},'›')),
   h('div',{role:'group','aria-label':'Calendario de disponibilidad',style:{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:4}},['D','L','M','M','J','V','S'].map((d,i)=>h('span',{key:'h'+i,style:{textAlign:'center',fontSize:11,color:'var(--ink-3)'}},d)),Array.from({length:offset},(_,i)=>h('span',{key:'empty'+i})),Array.from({length:last},(_,i)=>{
    const value=month+'-'+String(i+1).padStart(2,'0'),booked=overlaps(value,value,state.booked),past=value<state.today,chosen=start&&value>=start&&value<=end;
    return h('button',{key:value,type:'button','data-renta-day':value,'aria-label':date(value)+(booked?' · Reservado':past?' · Fecha pasada':''),'aria-pressed':Boolean(chosen),disabled:past||booked,onClick:()=>choose(value),style:{minHeight:44,border:chosen?'1px solid var(--guinda)':'1px solid var(--hairline)',borderRadius:9,background:chosen?'var(--guinda)':booked?'var(--surface-2)':'var(--surface)',color:chosen?'#fff':past||booked?'var(--ink-3)':'var(--ink)',textDecoration:booked?'line-through':'none',opacity:past?.45:1,fontFamily:'inherit',fontWeight:750}},i+1,booked&&h('small',{style:{display:'block',fontSize:7}},'Ocupado'));
   })),
   h('p',{style:{fontSize:12,color:'var(--ink-3)'}},'Tachado: reservado · Los días pasados no se pueden elegir.'),
   start&&h('p',{'data-renta-range':true,style:{fontSize:13,fontWeight:750}},date(start)+' → '+date(end)),
   h('div',{'aria-live':'polite',style:{textAlign:'center',padding:'15px 0'}},h('div',{style:{fontSize:13}},count+' '+(count===1?'día':'días')+' × '+money(state.daily_rate)),h('strong',{'data-renta-total':true,style:{display:'block',fontSize:32,color:'var(--guinda)',marginTop:5}},money(count*state.daily_rate)),h('small',null,'Pago único de contado antes de la entrega')),
   error&&h('p',{role:'alert',style:{fontSize:13,color:'#A32921'}},error),h(window.Btn,{full:true,icon:'arrowR',disabled:!valid||busy,onClick:continueFlow},busy?'Validando fechas…':'Continuar con esta simulación')),
   quote&&h(Application,{item,quote,app,onClose:()=>{setQuote(null);load();}}));
 }
 window.RentaCarRepository=repository;window.RentaCarFlow=Flow;window.RentaCarSummary=Summary;
 window.RentaCarMath=Object.freeze({days,overlaps});window.rentaCarError=message;
})();
