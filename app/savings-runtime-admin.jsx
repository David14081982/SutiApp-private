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
 function Requests({onSaved}){
  const [filter,setFilter]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(8),[draft,setDraft]=useState(null),[action,setAction]=useState(null);
  const [state,reload]=useRemote(()=>window.SavingsPanelRepository.runtimeRequests(query||undefined),[query]);
  const command=useCommand(async()=>{setDraft(null);setAction(null);reload();if(onSaved)await onSaved();});
  const data=state.data,rows=(data&&data.requests||[]).map(row=>({...row,request_code:row.folio,folio:row.saver_folio,type:row.request_type,amount:row.requested_amount,new_amount:row.new_contribution_amount,effective_date:row.effective_from})),blocked=command.busy||state.loading||!!state.error;
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
  return h(Tarjeta,{title:'Operaciones de Ahorro',icon:'receipt'},h('details',null,h('summary',{className:'svp-note'},'Abrir solicitudes nuevas y su seguimiento'),
   h('p',{className:'svp-note'},'Aquí se tramitan las operaciones del nuevo sistema. El historial importado se conserva en su lista de revisión.'),
   h(Field,{label:'Buscar operaciones por Folio exacto',value:filter,disabled:blocked,onChange:setFilter,autoComplete:'off'}),h(Btn,{disabled:blocked,onClick:()=>{setQuery(filter);setLimit(8);command.clear();}},'Buscar operaciones'),h(Btn,{disabled:blocked,onClick:reload},'Actualizar operaciones'),h(Feedback,{state,reload}),
   data&&data.can_create&&!draft&&!action&&h('div',{className:'svp-actions'},h(Btn,{tone:'primary',disabled:blocked,onClick:()=>{setDraft({folio:query,type:'JOIN',new_amount:'',amount:'',continue_saving:true,process:'',observation:''});command.clear();}},'Registrar nueva solicitud')),
   draft&&h('div',null,h(RequestForm,{draft,setDraft:changeDraft,disabled:blocked}),h('div',{className:'svp-actions'},h(Btn,{disabled:blocked,onClick:()=>{setDraft(null);command.clear();}},'Cancelar captura'),h(Btn,{tone:'primary',disabled:blocked||!valid,onClick:submit},'Guardar solicitud'))),
   data&&!rows.length&&h('p',{className:'svp-note'},'No hay operaciones registradas para esta consulta.'),
   rows.slice(0,limit).map(row=>h('article',{key:row.id,className:'svp-audit'},h('b',null,row.name||'Folio '+row.folio),h('p',{className:'svp-note'},'Folio '+row.folio+' · '+(types[row.type]||'Operación de ahorro')+' · '+(states[row.status]||'Por revisar')),
    row.request_code&&h(Fila,{label:'Solicitud',valor:row.request_code}),row.amount!=null&&h(Fila,{label:'Importe solicitado',valor:M(row.amount)}),row.new_amount!=null&&h(Fila,{label:'Nueva aportación',valor:M(row.new_amount)}),['WITHDRAW','EXTRAORDINARY_WITHDRAWAL'].includes(row.type)&&h(Fila,{label:'Después del retiro',valor:row.continue_saving===true?'Continuará ahorrando':row.continue_saving===false?'Dejará de ahorrar':'Por confirmar'}),row.effective_date&&h(Fila,{label:'Fecha de aplicación',valor:fmt(row.effective_date)}),row.settlement_block_reason&&h('p',{className:'svp-note warn'},row.settlement_block_reason),
    !draft&&!action&&h('div',{className:'svp-actions'},row.can_review===true&&h(Btn,{tone:'outline',disabled:blocked,onClick:()=>select(row,'REVIEW')},'Revisar solicitud'),row.can_settle===true&&h(Btn,{tone:'primary',disabled:blocked,onClick:()=>select(row,'SETTLE')},'Registrar entrega'),row.can_cancel===true&&h(Btn,{tone:'outline',disabled:blocked,onClick:()=>select(row,'CANCEL')},'Cancelar solicitud')),
    action&&action.row.id===row.id&&h('div',null,
     action.kind==='REVIEW'?h(React.Fragment,null,h(Select,{label:'Decisión de la solicitud',value:action.decision,disabled:blocked,onChange:v=>changeAction('decision',v),options:[['APPROVE','Aprobar'],['REJECT','Rechazar']]}),
      action.decision==='APPROVE'&&['JOIN','CHANGE_AMOUNT'].includes(row.type)&&h(React.Fragment,null,h(Field,{label:'Fecha excepcional (opcional)',type:'date',value:action.effective_date,onChange:v=>changeAction('effective_date',v),disabled:blocked}),h('p',{className:'svp-note'},'Déjala vacía para usar la fecha calculada. Si la cambias, explica el motivo.'),row.type==='JOIN'&&h(Select,{label:'Tipo de descuento autorizado',value:action.process,disabled:blocked,onChange:v=>changeAction('process',v),options:[['','Selecciona una opción'],['PROCESS_1','Quincenal · Clave 1'],['PROCESS_3','Quincenal · Suplente variable'],['JUB','Mensual · Jubilado o pensionado']]})),
      h(Notes,{label:action.decision==='REJECT'||action.effective_date?'Motivo de esta decisión':'Observaciones (opcional)',value:action.observation,onChange:v=>changeAction('observation',v),disabled:blocked})):action.kind==='CANCEL'?h(React.Fragment,null,h('p',{className:'svp-note'},'La solicitud quedará cancelada y se conservará su historial. Esta acción no registra una entrega de dinero.'),h(Notes,{value:action.observation,onChange:v=>changeAction('observation',v),disabled:blocked})):
     h(React.Fragment,null,h('p',{className:'svp-note'},'Registra el capital y rendimiento efectivamente entregados. El sistema comprobará el saldo y conservará el pago en el historial.'),h(Field,{label:'Capital que se entrega',type:'number',value:action.capital,onChange:v=>changeAction('capital',v),disabled:blocked}),h(Field,{label:'Rendimiento que se entrega',type:'number',value:action.yield,onChange:v=>changeAction('yield',v),disabled:blocked}),h(Notes,{value:action.observation,onChange:v=>changeAction('observation',v),disabled:blocked}),h('label',{className:'svp-note',style:{display:'flex',gap:8}},h('input',{type:'checkbox',checked:action.confirmed,disabled:blocked,onChange:e=>changeAction('confirmed',e.target.checked)}),'He comprobado los importes de la entrega.')),
     h('div',{className:'svp-actions'},h(Btn,{disabled:blocked,onClick:()=>{setAction(null);command.clear();}},'Cancelar operación'),h(Btn,{tone:'primary',disabled:blocked||(action.kind==='SETTLE'?(!validMoney(action.capital)||!validMoney(action.yield)||!action.confirmed):action.kind==='REVIEW'&&((action.decision==='REJECT'||!!action.effective_date)&&!action.observation.trim()||action.decision==='APPROVE'&&row.type==='JOIN'&&!action.process)),onClick:()=>command.run('operation',{command:action.kind==='SETTLE'?{kind:'SETTLE',request_id:row.id,capital:Number(action.capital),yield:Number(action.yield),observation:action.observation}:action.kind==='CANCEL'?{kind:'CANCEL',request_id:row.id,observation:action.observation}:{kind:'REVIEW',request_id:row.id,decision:action.decision,effective_date:action.effective_date||null,process:action.process||null,observation:action.observation}},action.kind==='SETTLE'?'Entrega registrada. Se actualizó el saldo y el historial.':action.kind==='CANCEL'?'Solicitud cancelada. Su historial se conserva.':'Decisión guardada. Se actualizó la solicitud.')},action.kind==='SETTLE'?'Confirmar entrega':action.kind==='CANCEL'?'Confirmar cancelación':'Guardar decisión'))))),
   rows.length>limit&&h(Btn,{tone:'full',disabled:blocked,onClick:()=>setLimit(x=>x+16)},'Ver más operaciones'),h(Notice,{command})));
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
 function SavingsRuntimeAdmin({tab,onSaved,app}){return tab==='configuracion'?h(Settings,{app,onSaved,defaultOpen:true}):tab==='cobranza'?h(Reports):tab==='solicitudes'?h(Requests,{onSaved}):tab==='revision'?h(React.Fragment,null,h(Publication,{onSaved}),h(Settings,{app,onSaved})):null;}
 window.SavingsRuntimeAdmin=SavingsRuntimeAdmin;
})();
