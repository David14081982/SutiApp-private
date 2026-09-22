/* Savings-only operational forms. Supabase owns decisions, amounts, reports and publication. */
(function(){
 'use strict';
 const h=React.createElement,{useState,useEffect,useRef}=React,{Tarjeta,Fila,M,fmt}=window.SavingsPanelVisual;
 const validMoney=v=>v!==''&&v!=null&&/^\d+(?:\.\d{1,2})?$/.test(String(v))&&Number.isFinite(Number(v));
 const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
 const types={JOIN:'Nuevo ahorrador',CHANGE_AMOUNT:'Cambio de monto',WITHDRAW:'Retiro de ahorro',TERMINATE:'Dejar de ahorrar',EXTRAORDINARY_WITHDRAWAL:'Retiro especial'};
 const states={SUBMITTED:'Recibida',UNDER_REVIEW:'En revisión',APPROVED:'Aprobada',REJECTED:'Rechazada',SETTLED:'Pagada',APPLIED:'Aplicada',CANCELLED:'Cancelada',PENDING:'Pendiente'};
 const columns=[['capital_delivered','Capital entregado'],['yield_delivered','Rendimiento entregado'],['actual_received','Descuentos recibidos'],['yield_credited','Rendimiento abonado']];
 function explain(e){const s=String(e&&e.message||'');
  if(/WITHDRAWAL_BLOCKED_BY_OVERDUE_LOAN/.test(s))return 'Retiro bloqueado por préstamo con saldo atrasado.';
  if(/LOAN_STATUS_DATA_INCONSISTENCY/.test(s))return 'Los estados del préstamo no coinciden. La entrega queda bloqueada hasta aclarar la información de origen.';
  if(/LOAN_VERIFICATION_UNAVAILABLE/.test(s))return 'No se pudo comprobar si esta persona tiene adeudos. La entrega queda pendiente hasta que la consulta esté disponible.';
  if(/42501|DENIED/.test(s))return 'Tu cuenta no tiene permiso para realizar esta acción.';
  if(/STALE|VERSION|CHANGED/.test(s))return 'La información cambió. Actualiza la consulta y comprueba los datos antes de continuar.';
  if(/PUBLICATION_REVIEW_REQUIRED/.test(s))return 'Todavía hay expedientes pendientes. Deben resolverse antes de publicar.';
  if(/IDENTITY|FOLIO|DUPLICATE/.test(s))return 'Revisa el Folio y su coincidencia única en el padrón. No se asignará información a otra persona.';
  if(/CERTIFICATION|UNCERTIFIED/.test(s))return 'Primero confirma el saldo de este ahorrador en su expediente.';
  if(/REASON|JUSTIFICATION/.test(s))return 'Esta excepción o rechazo requiere explicar el motivo.';
  if(/WINDOW|CLOSED|DISABLED|NOT_OPEN/.test(s))return 'Esta operación no está habilitada para esa persona o fecha. Revisa la apertura de Ahorro.';
  if(/BALANCE|AMOUNT|MINIMUM|COMPONENT/.test(s))return 'Revisa los importes y el saldo disponible. El sistema comprobará que la operación sea válida.';
  if(/DATE|RANGE|PROCESS/.test(s))return 'Revisa las fechas y el tipo de descuento seleccionados.';
  if(/STATUS|STATE|ALREADY/.test(s))return 'La solicitud ya cambió de estado. Actualiza la lista antes de continuar.';
  return 'No se pudo confirmar la operación. Conservamos tu captura; puedes volver a intentar.';
 }
 function Btn({children,tone='',...props}){return h('button',{type:'button',className:'svp-btn '+tone,...props},children);}
 function Field({label,value,onChange,type='text',disabled,...props}){return h('label',{className:'svp-field'},label,h('input',{type,value:value==null?'':String(value),onChange:e=>onChange(e.target.value),disabled,...(type==='number'?{min:0,step:'.01',inputMode:'decimal'}:{}),...props}));}
 function Select({label,value,onChange,disabled,options}){return h('label',{className:'svp-field'},label,h('select',{'aria-label':label,value,disabled,onChange:e=>onChange(e.target.value)},options.map(([value,name])=>h('option',{key:value,value},name))));}
 function Notes({value,onChange,disabled,label='Observaciones (opcional)'}){return h('label',{className:'svp-field'},label,h('textarea',{value,disabled,maxLength:1000,onChange:e=>onChange(e.target.value)}));}
 function useRemote(loader,deps,enabled=true){
  const [state,setState]=useState({loading:enabled}),[revision,setRevision]=useState(0);
  useEffect(()=>{if(!enabled)return;let active=true;setState(old=>({...old,loading:true,error:''}));loader().then(data=>{if(active)setState({data,loading:false,error:''});}).catch(error=>{if(active)setState(old=>({...old,loading:false,error:explain(error)}));});return()=>{active=false;};},[...deps,revision,enabled]);
  return [state,()=>setRevision(x=>x+1)];
 }
 function Feedback({state,reload}){return h(React.Fragment,null,state.loading&&h('p',{role:'status',className:'svp-note'},'Consultando información…'),state.error&&h('div',{role:'alert',className:'svp-error'},state.error,h(Btn,{disabled:state.loading,onClick:reload},'Reintentar consulta')));}
 function useCommand(onSuccess){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const lock=useRef(false),attempt=useRef(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function run(method,payload,successText){
   if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');const signature=JSON.stringify({method,payload});
   if(!attempt.current||attempt.current.signature!==signature)attempt.current={signature,request:{...payload,key:crypto.randomUUID()}};
   try{const result=await window.SavingsPanelRepository[method](attempt.current.request);if(!alive.current)return;attempt.current=null;setNotice(successText);await onSuccess(result);}
   catch(e){if(alive.current)setError(explain(e));}finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  return {busy,error,notice,run,clear(){attempt.current=null;setError('');setNotice('');}};
 }
 function Notice({command}){return h(React.Fragment,null,command.error&&h('div',{role:'alert',className:'svp-error'},command.error),command.notice&&h('p',{role:'status',className:'svp-success'},command.notice));}
 function ExceptionDialog({children,onClose,busy}){
  const ref=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{const previous=document.activeElement,el=ref.current;el.showModal();return()=>{el.close();previous&&previous.isConnected&&previous.focus();};},[]);
  return h('dialog',{ref,className:'svp svp-modal',style:{maxWidth:'min(560px, calc(100vw - 32px))',boxSizing:'border-box'},onCancel:e=>{e.preventDefault();if(!busy)close.current();}},h('h2',null,'AUTORIZAR RETIRO EXCEPCIONAL'),children,h(Btn,{disabled:busy,onClick:onClose},'Cerrar'));
 }
 function WithdrawalCheck({row,disabled,onSettle}){
  const [data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[form,setForm]=useState(null),[revoke,setRevoke]=useState('');
  const alive=useRef(true),lock=useRef(false);
  useEffect(()=>()=>{alive.current=false;},[]);
  async function check(){if(lock.current)return;lock.current=true;setLoading(true);setData(null);setError('');try{const value=await window.SavingsPanelRepository.checkWithdrawal(row.id);if(alive.current)setData(value);}catch(e){if(alive.current)setError(explain(e));}finally{lock.current=false;if(alive.current)setLoading(false);}}
  const command=useCommand(async()=>{setForm(null);setRevoke('');await check();});
  const busy=disabled||loading||command.busy,update=(key,value)=>{setForm(old=>({...old,[key]:value}));command.clear();};
  return h('div',{'data-withdrawal-check':row.id},h(Btn,{disabled:busy,onClick:check},'Comprobar préstamos para entrega'),
   loading&&h('p',{role:'status'},'Consultando todos los préstamos del ahorrador…'),error&&h('p',{role:'alert',className:'svp-error'},error),
   data&&h(React.Fragment,null,
    (data.overdue_loans||[]).length>0&&h('p',{className:'svp-note warn'},data.override?'Existe una autorización excepcional para este retiro.':'Retiro bloqueado por préstamo con saldo atrasado.'),
    !(data.loans||[]).length&&h('p',{className:'svp-note'},'No se encontraron préstamos para este Folio.'),
    (data.loans||[]).map(loan=>h('p',{key:loan.id,className:'svp-note'},'Préstamo '+loan.id+' · '+loan.fund+' · '+loan.status)),
    !data.can_settle&&data.code!=='WITHDRAWAL_BLOCKED_BY_OVERDUE_LOAN'&&h('p',{className:'svp-note'},'La entrega sigue pendiente de cumplir los requisitos de la solicitud.'),
    data.can_settle&&h(Btn,{tone:'primary',disabled:busy,onClick:onSettle},'Registrar entrega'),
    data.can_override&&!data.override&&h(Btn,{tone:'outline',disabled:busy,onClick:()=>{command.clear();setForm({reason:'',justification:'',confirmed:false});}},'AUTORIZAR RETIRO EXCEPCIONAL'),
    data.override&&data.can_override&&h('details',null,h('summary',null,'Revocar autorización excepcional'),h(Notes,{label:'Motivo de revocación',value:revoke,onChange:setRevoke,disabled:busy}),h(Btn,{disabled:busy||revoke.trim().length<3,onClick:()=>command.run('revokeException',{eventId:data.override.id,reason:revoke.trim()},'Autorización revocada.')},'Confirmar revocación'))),
   form&&h(ExceptionDialog,{busy,onClose:()=>setForm(null)},
    h('p',null,'Esta autorización permitirá continuar el retiro a pesar de existir un préstamo con saldo atrasado. La excepción quedará registrada en la bitácora.'),
    h(Select,{label:'Motivo de la excepción',value:form.reason,onChange:v=>update('reason',v),disabled:busy,options:[['','Selecciona un motivo'],['DESPIDO','Despido'],['RENUNCIA','Renuncia'],['FALLECIMIENTO','Fallecimiento'],['CONTINGENCIA','Contingencia / Emergencia'],['OTRO','Otro caso especial']]}),
    h(Notes,{label:form.reason==='OTRO'?'Justificación obligatoria':'Justificación (opcional)',value:form.justification,onChange:v=>update('justification',v),disabled:busy}),
    h('label',{className:'svp-note'},h('input',{type:'checkbox',checked:form.confirmed,disabled:busy,onChange:e=>update('confirmed',e.target.checked)}),'Confirmo la autorización excepcional de este retiro.'),
    h(Notice,{command}),h(Btn,{tone:'primary',disabled:busy||!form.reason||!form.confirmed||(form.reason==='OTRO'&&form.justification.trim().length<3),onClick:()=>command.run('authorizeWithdrawal',{requestId:row.id,command:{...form,justification:form.justification.trim(),fingerprint:data.fingerprint}},'Excepción autorizada para esta solicitud.')},'Confirmar autorización excepcional')),
   !form&&h(Notice,{command}));
 }
 function RequestForm({draft,setDraft,disabled}){
  const update=(key,value)=>setDraft(old=>({...old,[key]:value}));
  const contribution=['JOIN','CHANGE_AMOUNT'].includes(draft.type),withdrawal=draft.type==='WITHDRAW';
  return h(React.Fragment,null,h(Field,{label:'Folio exacto del ahorrador',value:draft.folio,onChange:v=>update('folio',v),disabled,autoComplete:'off'}),
   h(Select,{label:'Operación',value:draft.type,onChange:v=>update('type',v),disabled,options:Object.entries(types).filter(([code])=>code!=='EXTRAORDINARY_WITHDRAWAL')}),
   contribution&&h(Field,{label:'Nueva aportación por descuento',type:'number',value:draft.new_amount,onChange:v=>update('new_amount',v),disabled}),
   draft.type==='JOIN'&&h(Select,{label:'Tipo de descuento',value:draft.process,onChange:v=>update('process',v),disabled,options:[['','Selecciona una opción'],['PROCESS_1','Quincenal · Clave 1'],['PROCESS_3','Quincenal · Suplente variable'],['JUB','Mensual · Jubilado o pensionado']]}),
   withdrawal&&h(Field,{label:'Importe solicitado para retirar',type:'number',value:draft.amount,onChange:v=>update('amount',v),disabled}),
   draft.type==='WITHDRAW'&&h(Select,{label:'Después del retiro',value:draft.continue_saving?'true':'false',onChange:v=>update('continue_saving',v==='true'),disabled,options:[['true','Continuará ahorrando'],['false','Dejará de ahorrar']]}),
   withdrawal&&h('p',{className:'svp-note'},'El sistema comprueba el saldo disponible. Un retiro parcial conserva la aportación; una solicitud no reserva dinero.'),
   draft.type==='TERMINATE'&&h('p',{className:'svp-note'},'Esta solicitud detiene los descuentos futuros y conserva el dinero ahorrado. Para retirar dinero, registra una solicitud de retiro.'),
   contribution&&h('p',{className:'svp-note'},'La fecha de aplicación se calculará con el plazo y el calendario de descuentos de esa persona.'),
   h(Notes,{value:draft.observation,onChange:v=>update('observation',v),disabled}));
 }
 function Requests({onSaved,expanded=false,folio=null,requestId=null,onOpenPerson,initialNavigation,onNavigationChange}){
  const [filter,setFilter]=useState(folio||initialNavigation?.filter||''),[query,setQuery]=useState(folio||initialNavigation?.query||''),[limit,setLimit]=useState(initialNavigation?.limit||8),[draft,setDraft]=useState(null),[action,setAction]=useState(null);
  const [category,setCategory]=useState(initialNavigation?.category||'ALL'),[statusFilter,setStatusFilter]=useState(initialNavigation?.statusFilter||(expanded&&!folio?'pending':'all'));
  const [focusedRequest,setFocusedRequest]=useState(requestId);
  const focus=useRef(null);
  useEffect(()=>{if(onNavigationChange)onNavigationChange({filter,query,limit,category,statusFilter});},[filter,query,limit,category,statusFilter,onNavigationChange]);

  const [state,reload]=useRemote(()=>window.SavingsPanelRepository.runtimeRequests(query||undefined),[query]);
  const command=useCommand(async()=>{setDraft(null);setAction(null);reload();if(onSaved)await onSaved();});
  const data=state.data,allRows=(data&&data.requests||[]).map(row=>({...row,request_code:row.folio,folio:row.saver_folio,type:row.request_type,amount:row.requested_amount,new_amount:row.new_contribution_amount,effective_date:row.effective_from})),blocked=command.busy||state.loading||!!state.error;
  const needsAttention=row=>['SUBMITTED','UNDER_REVIEW'].includes(row.status)||(row.status==='APPROVED'&&['WITHDRAW','EXTRAORDINARY_WITHDRAWAL'].includes(row.type));
  const rows=allRows.filter(row=>(category==='ALL'||row.type===category)&&(statusFilter==='all'||needsAttention(row)));
  // A request deep link always reveals its current state after readback, even after approval.
  const visibleRows=focusedRequest?allRows.filter(row=>row.id===focusedRequest):rows.slice(0,limit);
  useEffect(()=>{if(requestId&&focus.current)focus.current.focus();},[requestId,!!data]);
  const changeDraft=update=>{setDraft(update);command.clear();};
  function select(row,kind){setDraft(null);setAction({row,kind,decision:'APPROVE',effective_date:'',process:row.process||'',observation:'',capital:'',yield:'',confirmed:false});command.clear();}
  function changeAction(key,value){setAction(old=>({...old,[key]:value}));command.clear();}
  function submit(){const c={kind:'SUBMIT',folio:draft.folio,type:draft.type,observation:draft.observation};
   if(['JOIN','CHANGE_AMOUNT'].includes(draft.type))c.new_amount=Number(draft.new_amount);
   if(draft.type==='JOIN')c.process=draft.process;
   if(draft.type==='WITHDRAW'){c.amount=Number(draft.amount);c.continue_saving=draft.continue_saving;}
   if(draft.type==='TERMINATE'){c.amount=0;c.continue_saving=false;}
   command.run('operation',{command:c},'Solicitud guardada. Puedes seguirla en esta lista.');
  }
  const valid=draft&&draft.folio!==''&&(draft.type==='TERMINATE'||(['JOIN','CHANGE_AMOUNT'].includes(draft.type)?validMoney(draft.new_amount):validMoney(draft.amount)))&&(draft.type!=='JOIN'||!!draft.process);
  return h(Tarjeta,{title:folio?'Solicitudes de esta persona':'Solicitudes de ahorro',icon:'receipt'},h(expanded?'div':'details',null,!expanded&&h('summary',{className:'svp-note'},'Abrir solicitudes nuevas y su seguimiento'),
   h('p',{className:'svp-note'},folio?'Revisa y resuelve las solicitudes sin salir del expediente.':'Los nuevos ingresos requieren autorización. Abre una solicitud para revisar a la persona y tomar una decisión.'),
   !folio&&h(expanded?'details':React.Fragment,expanded?{className:'svp-request-search'}:null,expanded&&h('summary',{className:'svp-note'},'Buscar solicitudes por Folio'),h(Field,{label:'Buscar operaciones por Folio exacto',value:filter,disabled:blocked,onChange:setFilter,autoComplete:'off'}),h(Btn,{disabled:blocked,onClick:()=>{setQuery(filter);setLimit(8);command.clear();}},'Buscar operaciones')),h(Btn,{disabled:blocked,onClick:reload},'Actualizar operaciones'),h(Feedback,{state,reload}),
   expanded&&!focusedRequest&&h('div',{className:'svp-request-filters'},h(Select,{label:'Tipo de solicitud',value:category,disabled:blocked||!!draft||!!action,onChange:v=>{setCategory(v);setLimit(8);},options:[['ALL','Todas las solicitudes'],...Object.entries(types)]}),h(Select,{label:'Estado de las solicitudes',value:statusFilter,disabled:blocked||!!draft||!!action,onChange:v=>{setStatusFilter(v);setLimit(8);},options:[['pending','Pendientes de atención'],['all','Todos los estados']]})),
   expanded&&!folio&&data&&!state.loading&&!state.error&&h('p',{className:'svp-note'},allRows.filter(r=>r.type==='JOIN'&&needsAttention(r)).length+' solicitudes de nuevo ingreso pendientes en esta consulta.'),
   focusedRequest&&folio&&!draft&&!action&&h(Btn,{tone:'outline',disabled:blocked,onClick:()=>setFocusedRequest(null)},'Ver todas las solicitudes de esta persona'),
   data&&data.can_create&&!draft&&!action&&h('div',{className:'svp-actions'},h(Btn,{tone:'primary',disabled:blocked,onClick:()=>{setDraft({folio:query,type:'JOIN',new_amount:'',amount:'',continue_saving:true,process:'',observation:''});command.clear();}},'Registrar nueva solicitud')),
   draft&&h('div',null,h(RequestForm,{draft,setDraft:changeDraft,disabled:blocked}),h('div',{className:'svp-actions'},h(Btn,{disabled:blocked,onClick:()=>{setDraft(null);command.clear();}},'Cancelar captura'),h(Btn,{tone:'primary',disabled:blocked||!valid,onClick:submit},'Guardar solicitud'))),
   data&&!state.loading&&!state.error&&!visibleRows.length&&h('p',{className:'svp-note'},requestId?'Esta solicitud ya no está disponible en la consulta. Actualiza o vuelve a la lista.':statusFilter==='pending'?'Sin solicitudes pendientes para este filtro. Puedes consultar todos los estados.':'No hay operaciones registradas para esta consulta.'),
   visibleRows.map(row=>h('article',{key:row.id,className:'svp-audit',ref:requestId===row.id?focus:null,tabIndex:requestId===row.id?-1:undefined,'data-request-id':row.id},h('b',null,row.name||'Folio '+row.folio),h('p',{className:'svp-note'},'Folio '+row.folio+' · '+(types[row.type]||'Operación de ahorro')+' · '+(states[row.status]||'Por revisar')),
    row.request_code&&h(Fila,{label:'Solicitud',valor:row.request_code}),row.amount!=null&&h(Fila,{label:'Importe solicitado',valor:M(row.amount)}),row.new_amount!=null&&h(Fila,{label:'Nueva aportación',valor:M(row.new_amount)}),['WITHDRAW','EXTRAORDINARY_WITHDRAWAL'].includes(row.type)&&h(Fila,{label:'Después del retiro',valor:row.continue_saving===true?'Continuará ahorrando':row.continue_saving===false?'Dejará de ahorrar':'Por confirmar'}),row.effective_date&&h(Fila,{label:'Fecha de aplicación',valor:fmt(row.effective_date)}),row.settlement_block_reason&&h('p',{className:'svp-note warn'},row.settlement_block_reason),
    !draft&&!action&&onOpenPerson&&h(Btn,{tone:'outline',disabled:blocked,onClick:()=>onOpenPerson(row)},'Abrir expediente y revisar'),
    !onOpenPerson&&!draft&&!action&&h('div',{className:'svp-actions'},row.can_review===true&&h(Btn,{tone:'outline',disabled:blocked,onClick:()=>select(row,'REVIEW')},'Revisar solicitud'),row.can_settle===true&&h(Btn,{tone:'primary',disabled:blocked,onClick:()=>select(row,'SETTLE')},'Registrar entrega'),row.can_cancel===true&&h(Btn,{tone:'outline',disabled:blocked,onClick:()=>select(row,'CANCEL')},'Cancelar solicitud')),
    !onOpenPerson&&!draft&&!action&&row.requires_loan_verification===true&&h(WithdrawalCheck,{key:row.id+':'+row.status,row,disabled:blocked,onSettle:()=>select(row,'SETTLE')}),
    action&&action.row.id===row.id&&h('div',null,
     action.kind==='REVIEW'?h(React.Fragment,null,h(Select,{label:'Decisión de la solicitud',value:action.decision,disabled:blocked,onChange:v=>changeAction('decision',v),options:[['APPROVE','Aprobar'],['REJECT','Rechazar']]}),
      action.decision==='APPROVE'&&['JOIN','CHANGE_AMOUNT'].includes(row.type)&&h(React.Fragment,null,h(Field,{label:'Fecha excepcional (opcional)',type:'date',value:action.effective_date,onChange:v=>changeAction('effective_date',v),disabled:blocked}),h('p',{className:'svp-note'},'Déjala vacía para usar la fecha calculada. Si la cambias, explica el motivo.'),row.type==='JOIN'&&h(Select,{label:'Tipo de descuento autorizado',value:action.process,disabled:blocked,onChange:v=>changeAction('process',v),options:[['','Selecciona una opción'],['PROCESS_1','Quincenal · Clave 1'],['PROCESS_3','Quincenal · Suplente variable'],['JUB','Mensual · Jubilado o pensionado']]})),
      h(Notes,{label:action.decision==='REJECT'||action.effective_date?'Motivo de esta decisión':'Observaciones (opcional)',value:action.observation,onChange:v=>changeAction('observation',v),disabled:blocked})):action.kind==='CANCEL'?h(React.Fragment,null,h('p',{className:'svp-note'},'La solicitud quedará cancelada y se conservará su historial. Esta acción no registra una entrega de dinero.'),h(Notes,{value:action.observation,onChange:v=>changeAction('observation',v),disabled:blocked})):
     h(React.Fragment,null,h('p',{className:'svp-note'},'Registra el capital y rendimiento efectivamente entregados. El sistema comprobará el saldo y conservará el pago en el historial.'),h(Field,{label:'Capital que se entrega',type:'number',value:action.capital,onChange:v=>changeAction('capital',v),disabled:blocked}),h(Field,{label:'Rendimiento que se entrega',type:'number',value:action.yield,onChange:v=>changeAction('yield',v),disabled:blocked}),h(Notes,{value:action.observation,onChange:v=>changeAction('observation',v),disabled:blocked}),h('label',{className:'svp-note',style:{display:'flex',gap:8}},h('input',{type:'checkbox',checked:action.confirmed,disabled:blocked,onChange:e=>changeAction('confirmed',e.target.checked)}),'He comprobado los importes de la entrega.')),
     h('div',{className:'svp-actions'},h(Btn,{disabled:blocked,onClick:()=>{setAction(null);command.clear();}},'Cancelar operación'),h(Btn,{tone:'primary',disabled:blocked||(action.kind==='SETTLE'?(!validMoney(action.capital)||!validMoney(action.yield)||!action.confirmed):action.kind==='REVIEW'&&((action.decision==='REJECT'||!!action.effective_date)&&!action.observation.trim()||action.decision==='APPROVE'&&row.type==='JOIN'&&!action.process)),onClick:()=>command.run('operation',{command:action.kind==='SETTLE'?{kind:'SETTLE',request_id:row.id,capital:Number(action.capital),yield:Number(action.yield),observation:action.observation}:action.kind==='CANCEL'?{kind:'CANCEL',request_id:row.id,observation:action.observation}:{kind:'REVIEW',request_id:row.id,decision:action.decision,effective_date:action.effective_date||null,process:action.process||null,observation:action.observation}},action.kind==='SETTLE'?'Entrega registrada. Se actualizó el saldo y el historial.':action.kind==='CANCEL'?'Solicitud cancelada. Su historial se conserva.':'Decisión guardada. Se actualizó la solicitud.')},action.kind==='SETTLE'?'Confirmar entrega':action.kind==='CANCEL'?'Confirmar cancelación':'Guardar decisión'))))),
   !focusedRequest&&rows.length>limit&&h(Btn,{tone:'full',disabled:blocked,onClick:()=>setLimit(x=>x+16)},'Ver más operaciones'),h(Notice,{command})));
 }
 function csvCell(value,folio=false){let s=value==null?'':String(value);if(folio||typeof value==='string'&&/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function downloadReport(data){const rows=[['Folio','Nombre',...columns.map(c=>c[1])],...(data.rows||[]).map(row=>[row.folio,row.name,...columns.map(([key])=>row[key])])];
  const csv='\uFEFF'+rows.map((row,i)=>row.map((value,j)=>csvCell(value,i>0&&j===0)).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Ahorro-'+data.from+'-a-'+data.to+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function Reports(){
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[range,setRange]=useState(null),[limit,setLimit]=useState(8);
  const [state,reload]=useRemote(()=>window.SavingsPanelRepository.report(range),[range],!!range),d=state.data;
  return h(Tarjeta,{title:'Reportes de Ahorro',icon:'receipt'},h('details',null,h('summary',{className:'svp-note'},'Consultar descuentos, capital y rendimientos por periodo'),
   h(Field,{label:'Reporte desde',type:'date',value:from,onChange:setFrom,disabled:state.loading}),h(Field,{label:'Reporte hasta',type:'date',value:to,onChange:setTo,disabled:state.loading}),
   h(Btn,{tone:'outline',disabled:state.loading||!validDate(from)||!validDate(to)||to<from,onClick:()=>{setLimit(8);setRange({from,to});}},'Consultar reporte'),h(Feedback,{state,reload}),
   d&&!state.loading&&!state.error&&h(React.Fragment,null,h('p',{className:'svp-note'},fmt(d.from)+' al '+fmt(d.to)),columns.map(([key,label])=>h(Fila,{key,label,valor:M(d.totals&&d.totals[key])})),d.historical_note&&h('p',{className:'svp-note'},d.historical_note),
    h(Btn,{tone:'outline',onClick:()=>downloadReport(d)},'Descargar reporte CSV'),
    !(d.rows||[]).length&&h('p',{className:'svp-note'},'No hay movimientos para el periodo consultado.'),
    (d.rows||[]).slice(0,limit).map(row=>h('article',{key:row.folio,className:'svp-audit'},h('b',null,row.name||'SIN REGISTRO'),h('p',{className:'svp-note'},'Folio '+row.folio),columns.map(([key,label])=>h(Fila,{key,label,valor:M(row[key])})))),
    (d.rows||[]).length>limit&&h(Btn,{tone:'full',onClick:()=>setLimit(x=>x+20)},'Ver más ahorradores'))));
 }
 function Publication({onSaved}){
  const [state,reload]=useRemote(()=>window.SavingsPanelRepository.publicationStatus(),[]),[checked,setChecked]=useState(false),[limit,setLimit]=useState(8),[selected,setSelected]=useState(null);
  const [preview,refreshPreview]=useRemote(()=>(selected.record_id ? window.SavingsPanelRepository.publicationPreview(selected.record_id) : window.SavingsPanelRepository.publicationAccountPreview(selected.participant_id)),[selected],!!selected);
  const command=useCommand(async()=>{setChecked(false);reload();if(onSaved)await onSaved();});
  const d=state.data,blocked=state.loading||command.busy||!!state.error,rows=d&&d.rows||[];
  function refresh(){setChecked(false);setSelected(null);command.clear();reload();}
  return h(Tarjeta,{title:'Publicación de Ahorro',icon:'checkCircle'},h('details',null,h('summary',{className:'svp-note'},'Comprobar pendientes y preparar la publicación'),h(Feedback,{state,reload:refresh}),
   d&&h(React.Fragment,null,h(Fila,{label:'Visibilidad',valor:d.mode==='PUBLISHED'?'Publicado a los ahorradores':'Preparación privada'}),h(Fila,{label:'Expedientes comprobados',valor:d.total}),h(Fila,{label:'Expedientes pendientes',valor:d.pending}),h(Btn,{tone:'outline',disabled:blocked,onClick:refresh},'Comprobar pendientes'),
    h('p',{className:'svp-note'},'La publicación sustituirá juntos los valores de Ahorro que se muestran en Ahorro, Inicio y Finanzas. Primero termina la revisión y las pruebas.'),
    rows.slice(0,limit).map(row=>h('div',{key:row.record_id||row.participant_id,className:'svp-audit'},h('b',null,'Folio '+row.folio),h('p',{className:'svp-note'},row.ready?'Preparado':(row.reasons||[]).join('. ')||'Pendiente de revisión'),row.ready&&h(Btn,{tone:'outline',disabled:blocked,onClick:()=>setSelected(row)},'Comprobar importes · '+row.folio))),
    rows.length>limit&&h(Btn,{tone:'full',disabled:blocked,onClick:()=>setLimit(x=>x+24)},'Ver más expedientes'),
    selected&&h('div',null,h('h3',{style:{fontSize:14}},'Importes que verá el ahorrador · Folio '+selected.folio),h(Feedback,{state:preview,reload:refreshPreview}),preview.data&&!preview.loading&&!preview.error&&h(React.Fragment,null,h(Fila,{label:'Saldo disponible',valor:M(preview.data.balances&&preview.data.balances.total)}),h(Fila,{label:'Capital',valor:M(preview.data.balances&&preview.data.balances.capital)}),h(Fila,{label:'Rendimiento incluido',valor:M(preview.data.balances&&preview.data.balances.yield_amount)}),h(Fila,{label:'Aportación',valor:M(preview.data.enrollment&&preview.data.enrollment.current_contribution_amount)}))),
    d.mode==='PRIVATE'&&h(React.Fragment,null,!d.ready&&h('p',{className:'svp-note warn'},'La publicación estará disponible cuando todos los expedientes estén preparados.'),d.can_publish&&h('label',{className:'svp-note',style:{display:'flex',gap:8,alignItems:'flex-start'}},h('input',{type:'checkbox',disabled:blocked||!d.ready,checked,onChange:e=>{setChecked(e.target.checked);command.clear();}}),'Ya probé el sistema y autorizo mostrar los saldos definitivos a los ahorradores.'),d.can_publish&&h(Btn,{tone:'primary full',disabled:blocked||!d.ready||!checked,onClick:()=>command.run('publish',{version:d.version,fingerprint:d.fingerprint,confirmed:true},'Ahorro publicado. Los ahorradores ya consultan la información confirmada.')},'Publicar Ahorro para los usuarios'),!d.can_publish&&h('p',{className:'svp-note'},'La publicación requiere permiso de configuración y autorización.'))),h(Notice,{command})));
 }
 function Settings({app,onSaved,defaultOpen=false}){
  const [opened,setOpened]=useState(defaultOpen),[state,reload]=useRemote(()=>window.SavingsRepository.getAdminDashboard(null),[],opened);
  async function saved(){reload();if(onSaved)await onSaved();}
  return h(Tarjeta,{title:'Aperturas, cambios y rendimientos',icon:'calendar'},h('details',{open:opened,onToggle:e=>setOpened(e.currentTarget.open)},h('summary',{className:'svp-note'},'Administrar fechas, opciones y tasa de rendimiento'),opened&&h(React.Fragment,null,h(Feedback,{state,reload}),state.data&&!state.loading&&!state.error&&h(React.Fragment,null,h('p',{className:'svp-note'},'Define la tasa del periodo y revisa quién cumple las reglas. Al abrir retiros puedes elegir todos los ahorradores o sólo una persona. Estos controles no entregan dinero automáticamente.'),h('h3',null,'Habilitar retiros para todos o para una persona'),h(window.SavingsOperationsAdmin,{app,participants:state.data.participants,periods:state.data.yield_periods,onSaved:saved}),h('h3',null,'Tasa y rendimientos por periodo'),h(window.SavingsYieldAdmin,{app,periods:state.data.yield_periods,onSaved:saved})))));
 }
 function SavingsRuntimeAdmin({tab,onSaved,app,onOpenPerson,initialNavigation,onNavigationChange}){return tab==='configuracion'?h(Settings,{app,onSaved,defaultOpen:true}):tab==='reportes'||tab==='cobranza'?h(Reports):tab==='pendientes'?h(Requests,{onSaved,expanded:true,onOpenPerson,initialNavigation,onNavigationChange}):tab==='solicitudes'?h(Requests,{onSaved}):tab==='publicacion'?h(Publication,{onSaved}):tab==='revision'?h(React.Fragment,null,h(Publication,{onSaved}),h(Settings,{app,onSaved})):null;}
 window.SavingsRequestsAdmin=Requests;
 window.SavingsRuntimeAdmin=SavingsRuntimeAdmin;
})();
