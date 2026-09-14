/* Private Savings balance confirmation and actual receipts. All amounts and dates are resolved by Supabase. */
(function(){
 'use strict';
 const h=React.createElement,{useState,useEffect,useRef}=React;
 const {Tarjeta,Fila,M,fmt}=window.SavingsPanelVisual;
 const money=v=>v!==''&&v!=null&&/^\d+(?:\.\d{1,2})?$/.test(String(v))&&Number.isFinite(Number(v));
 const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
 const text=v=>v==null?'':String(v);
 function message(e){
  const s=String(e&&e.message||'');
  if(/42501|DENIED/.test(s))return 'Tu cuenta no tiene permiso para realizar esta acción.';
  if(/STALE|CHANGED|VERSION/.test(s))return 'El expediente cambió. Actualiza los datos y revisa de nuevo antes de guardar. Conservamos tu captura.';
  if(/EXACT_IDENTITY|IDENTITY|DUPLICATE/.test(s))return 'Hay que resolver la coincidencia del Folio antes de confirmar este saldo.';
  if(/PLAN_REVIEW_REQUIRED/.test(s))return 'El monto, estado o fecha del plan cambiaron en los datos anteriores. Revisa esa corrección; los cambios del plan deben autorizarse desde las opciones de Ahorro.';
  if(/YIELD_PERIOD_CLOSED/.test(s))return 'Este descuento pertenece a un periodo con rendimiento confirmado. Revisa la diferencia mediante una corrección del saldo para conservar lo ya entregado.';
  if(/REVIEW_REQUIRED/.test(s))return 'Primero revisa el expediente y márcalo como revisado.';
  if(/ALREADY_CONFIRMED/.test(s))return 'El saldo ya fue confirmado. Actualiza los datos para consultarlo.';
  if(/DIFFERENCE|BALANCE_MISMATCH|COMPONENT/.test(s))return 'Revisa los importes: capital y rendimiento deben coincidir con el saldo revisado.';
  if(/PLAN_FIELDS/.test(s))return 'Revisa la aportación y el primer descuento después del corte. La fecha debe corresponder al calendario de esa persona.';
  if(/FUTURE/.test(s))return 'Sólo se pueden registrar como recibidos los descuentos que ya hayan ocurrido.';
  if(/DATE/.test(s))return 'Revisa las fechas del ahorro y el intervalo de la proyección.';
  if(/FIELDS|AMOUNT|MONEY/.test(s))return 'Completa las fechas e importes; usa cantidades sin negativos y con un máximo de dos decimales.';
  if(/IDEMPOTENCY/.test(s))return 'Esta operación ya tiene una respuesta registrada. Actualiza el expediente antes de realizar otra.';
  return 'No se pudo confirmar la operación. Tu captura se conserva; puedes volver a intentar.';
 }
 function Btn({children,tone='',...props}){return h('button',{type:'button',className:'svp-btn '+tone,...props},children);}
 function Field({label,value,onChange,type='text',disabled=false,...props}){return h('label',{className:'svp-field'},label,h('input',{type,value:text(value),disabled,onChange:e=>onChange(e.target.value),...(type==='number'?{min:0,step:'.01',inputMode:'decimal'}:{}),...props}));}
 function Notes({value,onChange,disabled}){return h('label',{className:'svp-field'},'Observaciones (opcional)',h('textarea',{value,maxLength:1000,disabled,onChange:e=>onChange(e.target.value)}));}
 function defaults(d){const p=d.context.person||{};return {capital:'',yield:'',amount:text(p.aporte),first_date:p.inicio||'',enrollment_start:p.plan_inicio||'',plan_end:p.plan_fin||'',next_date:p.prox||'',process:String(p.proceso||'').toUpperCase()==='JUB'?'JUB':String(p.proceso)==='1'?'PROCESS_1':String(p.proceso)==='3'?'PROCESS_3':'',active:p.estado==='ahorrando',observation:''};}
 function Retirement({participantId,app,onSaved}){
  const [opened,setOpened]=useState(false),[revision,setRevision]=useState(0),[state,setState]=useState({});
  useEffect(()=>{if(!opened)return;let active=true;setState({loading:true});window.SavingsRepository.getAdminDashboard(null).then(data=>{if(active)setState({data});}).catch(error=>{if(active)setState({error:message(error)});});return()=>{active=false;};},[opened,participantId,revision]);
  const selected=state.data&&(state.data.participants||[]).find(row=>row.id===participantId);
  return h('details',{onToggle:e=>setOpened(e.currentTarget.open)},h('summary',{className:'svp-note'},'Cambio de descuento por jubilación'),opened&&h(React.Fragment,null,state.loading&&h('p',{role:'status',className:'svp-note'},'Consultando el plan de esta persona…'),state.error&&h('div',{role:'alert',className:'svp-error'},state.error,h(Btn,{onClick:()=>setRevision(x=>x+1)},'Reintentar consulta')),state.data&&!selected&&h('p',{className:'svp-note warn'},'No se encontró el plan de esta persona. Actualiza el expediente antes de continuar.'),selected&&h(window.SavingsRetirementAdmin,{key:participantId,app,selected,rows:(state.data.process_changes||[]).filter(row=>row.participant_id===participantId),onSaved:async()=>{setRevision(x=>x+1);if(onSaved)await onSaved();}})));
 }
 function SavingsCertificationAdmin({recordId,participantId,version,onSaved,app}){
  const recordKey=participantId?'participant:'+participantId:recordId;
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [draft,setDraft]=useState(null),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[horizon,setHorizon]=useState(''),[edit,setEdit]=useState(null),[adjust,setAdjust]=useState(null),[limit,setLimit]=useState(6);
  const mounted=useRef(false),loadSequence=useRef(0),identity=useRef(recordKey),lock=useRef(false),retry=useRef(null),draftDirty=useRef(false),horizonRef=useRef('');
  identity.current=recordKey;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;loadSequence.current++;};},[]);
  async function load(reset=false,refreshCapture=false){
   const id=recordKey,seq=++loadSequence.current;setLoading(true);setLoadError('');
   try{const result=await (participantId?window.SavingsPanelRepository.nativeFinancial(participantId,horizonRef.current||undefined):window.SavingsPanelRepository.financial(recordId,horizonRef.current||undefined));
    if(!mounted.current||identity.current!==id||seq!==loadSequence.current)return;
    setData(result);if(reset||!draftDirty.current)setDraft(defaults(result));
    if(refreshCapture){setEdit(previous=>{if(!previous)return previous;const current=(result.schedule||[]).find(row=>row.date===previous.date&&row.enrollment_id===previous.enrollmentId);return current?{...previous,version:current.version}:previous;});setError('');setNotice('Datos actualizados. Compara lo registrado con tu captura antes de guardar.');}
   }catch(e){if(mounted.current&&identity.current===id&&seq===loadSequence.current)setLoadError(message(e));}
   finally{if(mounted.current&&identity.current===id&&seq===loadSequence.current)setLoading(false);}
  }
  useEffect(()=>{draftDirty.current=false;retry.current=null;lock.current=false;setBusy(false);horizonRef.current='';setHorizon('');setData(null);setDraft(null);setPreview(null);setEdit(null);setAdjust(null);setError('');setNotice('');setLimit(6);load(true);return()=>{loadSequence.current++;};},[recordKey]);
  const lastVersion=useRef(version);useEffect(()=>{if(lastVersion.current===version)return;lastVersion.current=version;setPreview(null);retry.current=null;load(false);},[version]);
  function change(key,value){draftDirty.current=true;setDraft(d=>({...d,[key]:value}));setPreview(null);setError('');retry.current=null;}
  async function run(kind,payload,success){
   if(lock.current)return;const operation={id:recordKey};lock.current=operation;setBusy(true);setError('');setNotice('');const id=recordKey;
   const signature=JSON.stringify({kind,id,payload});
   if(!retry.current||retry.current.signature!==signature)retry.current={signature,command:{id:recordId,...payload,key:crypto.randomUUID()}};
   try{
    const result=await window.SavingsPanelRepository[kind](retry.current.command);
    if(!mounted.current||identity.current!==id)return;
    retry.current=null;success(result);
    if(kind!=='previewBalance'){await load(false);if(mounted.current&&identity.current===id&&onSaved)await onSaved();}
   }catch(e){if(mounted.current&&identity.current===id)setError(message(e));}
   finally{if(lock.current===operation){lock.current=false;if(mounted.current&&identity.current===id)setBusy(false);}}
  }
  function command(){return {...draft,capital:Number(draft.capital),yield:Number(draft.yield),first_date:draft.first_date||null,enrollment_start:draft.enrollment_start||null,amount:draft.active?Number(draft.amount):null,plan_end:draft.plan_end||null,next_date:draft.active?draft.next_date:null,confirmed:true};}
  const valid=draft&&money(draft.capital)&&money(draft.yield)&&((!draft.active&&!draft.first_date&&!draft.enrollment_start)||(date(draft.first_date)&&date(draft.enrollment_start)))&&(!draft.plan_end||date(draft.plan_end))&&(!!draft.process||!draft.active&&!draft.first_date&&!draft.enrollment_start)&&(!draft.active||(money(draft.amount)&&date(draft.next_date)));
  const ctx=data&&data.context,p=ctx&&ctx.person||{},schedule=data&&data.schedule||[],blocked=busy||loading||!!loadError;
  const allowed=data&&data.can_confirm===true,sourceUpdate=ctx&&ctx.source_update,mayConfirm=allowed&&ctx.record_status==='RESOLVED'&&!(sourceUpdate&&sourceUpdate.pending)&&preview&&preview.can_confirm===true&&!preview.already_confirmed&&preview.difference===0;
  function updateReceipt(k,v){setEdit(e=>({...e,[k]:v}));retry.current=null;setError('');}
  function updateAdjustment(k,v){setAdjust(a=>({...a,[k]:v}));retry.current=null;setError('');}
  return h('div',{className:'svp-wide','data-savings-certification':recordKey,'aria-busy':loading||busy},
   h(Tarjeta,{title:'Saldo definitivo y próximos descuentos',icon:'checkCircle'},
    h('p',{className:'svp-note'},data&&data.publication==='PUBLISHED'?'Los saldos confirmados de esta cuenta ya se muestran al ahorrador. Se guardará un registro de cada corrección.':'Preparación privada. Estos cambios se mostrarán a los ahorradores cuando se autorice la publicación.'),
    loading&&h('p',{role:'status',className:'svp-note'},'Consultando saldo y calendario…'),
    loadError&&h('div',{role:'alert',className:'svp-error'},loadError,h(Btn,{onClick:()=>load(false),disabled:busy},'Reintentar consulta')),
    data&&h(React.Fragment,null,
     h(Fila,{label:'Folio',valor:p.folio||'SIN REGISTRO'}),!data.native&&h(React.Fragment,null,h(Fila,{label:'Saldo reconocido del archivo',valor:M(p.saldo)}),h(Fila,{label:'Saldo con descuentos corregidos',valor:M(p.saldo_revision)}),h(Fila,{label:'Fecha de corte',valor:fmt(ctx.cutoff_on)})),
     sourceUpdate&&sourceUpdate.pending&&h('div',null,
      h('p',{className:'svp-note warn'},sourceUpdate.conflict?'Hay descuentos nuevos en el archivo que coinciden con una corrección manual. Compara ambas capturas antes de continuar; se conserva la revisión del encargado.':'Hay descuentos nuevos en el archivo por revisar antes de confirmar el saldo.'),
      h('details',null,h('summary',{className:'svp-note'},'Ver descuentos nuevos del archivo'),h(Fila,{label:'Saldo de la consulta reciente',valor:M(sourceUpdate.source_total)}),h(Fila,{label:'Consultado el',valor:fmt(String(sourceUpdate.observed_at||'').slice(0,10))}),
       (sourceUpdate.changes||[]).map(change=>h('div',{className:'svp-audit',key:change.key},h('b',null,fmt(change.date)),h(Fila,{label:'Importe anterior',valor:M(change.previous)}),h(Fila,{label:'Importe en el archivo',valor:M(change.current)})))),
      ctx.can_accept_source_update===true&&!sourceUpdate.conflict&&h(Btn,{tone:'outline full',disabled:blocked,onClick:()=>run('acceptSource',{updateId:sourceUpdate.id,version:ctx.source_version},()=>{setPreview(null);setNotice('Descuentos del archivo aplicados. Revisa el saldo actualizado antes de confirmarlo.');})},'Aplicar descuentos del archivo')),
     data.certified?h(React.Fragment,null,
      h('p',{className:'svp-note'},'Saldo confirmado. Cada descuento recibido y corrección queda registrado por separado.'),
      h(Fila,{label:'Capital disponible',valor:M(data.balance&&data.balance.capital)}),h(Fila,{label:'Rendimiento ya incluido',valor:M(data.balance&&data.balance.yield_amount)}),h(Fila,{label:'Saldo definitivo',valor:M(data.balance&&data.balance.total)}),
      data.source_changed&&h('p',{className:'svp-note warn'},'La revisión del archivo cambió después de confirmar este saldo. Compara ambos importes; las correcciones no se aplican dos veces ni cambian el saldo confirmado automáticamente.'),
      allowed&&!adjust&&h(Btn,{tone:'outline',disabled:blocked,onClick:()=>{setEdit(null);setAdjust({capital:text(data.balance.capital),yield:text(data.balance.yield_amount),observation:'',confirmed:false});setError('');retry.current=null;}},'Corregir saldo confirmado'),
      adjust&&h('div',null,h('p',{className:'svp-note'},'Captura los importes disponibles correctos. Se conservarán el saldo anterior, la persona y la fecha del cambio.'),
       h(Field,{label:'Capital disponible correcto',type:'number',value:adjust.capital,disabled:blocked,onChange:v=>updateAdjustment('capital',v)}),
       h(Field,{label:'Rendimiento disponible correcto',type:'number',value:adjust.yield,disabled:blocked,onChange:v=>updateAdjustment('yield',v)}),h(Notes,{value:adjust.observation,disabled:blocked,onChange:v=>updateAdjustment('observation',v)}),
       h('label',{className:'svp-note',style:{display:'flex',gap:8,alignItems:'flex-start'}},h('input',{type:'checkbox',checked:adjust.confirmed,disabled:blocked,onChange:e=>updateAdjustment('confirmed',e.target.checked)}),'He comprobado los importes de esta corrección.'),
       h('div',{className:'svp-actions'},h(Btn,{disabled:blocked,onClick:()=>{setAdjust(null);setError('');retry.current=null;}},'Cancelar corrección'),h(Btn,{tone:'primary',disabled:blocked||!adjust.confirmed||!money(adjust.capital)||!money(adjust.yield)||(!data.source_changed&&text(data.balance.capital)===adjust.capital&&text(data.balance.yield_amount)===adjust.yield),onClick:()=>run('adjustBalance',{capital:Number(adjust.capital),yield:Number(adjust.yield),version:data.balance_version,observation:adjust.observation},()=>{setAdjust(null);setNotice('Saldo corregido. Se conservó el registro anterior.');})},'Guardar saldo corregido')))):
     h(React.Fragment,null,
      h('p',{className:'svp-note'},'El saldo del archivo ya incluye los rendimientos y retiros registrados. Confirma cómo se divide el importe disponible; no vuelvas a sumar el rendimiento histórico.'),
      ctx.record_status!=='RESOLVED'&&h('p',{className:'svp-note warn'},'Primero comprueba el expediente y márcalo como revisado. Después podrás confirmar su saldo.'),
      !allowed&&h('p',{className:'svp-note'},'Tu cuenta puede consultar esta información. La confirmación del saldo requiere permiso de autorización.'),
      allowed&&draft&&h(React.Fragment,null,
       h(Field,{label:'Capital disponible al corte',type:'number',value:draft.capital,disabled:blocked,onChange:v=>change('capital',v)}),h(Field,{label:'Rendimiento incluido al corte',type:'number',value:draft.yield,disabled:blocked,onChange:v=>change('yield',v)}),
       h(Field,{label:'Primera fecha de ahorro',type:'date',max:ctx.cutoff_on,value:draft.first_date,disabled:blocked,onChange:v=>change('first_date',v)}),
       h(Field,{label:'Inicio del plan actual',type:'date',value:draft.enrollment_start,disabled:blocked,onChange:v=>change('enrollment_start',v)}),h(Field,{label:'Última fecha del plan (opcional)',type:'date',value:draft.plan_end,disabled:blocked,onChange:v=>change('plan_end',v)}),h('p',{className:'svp-note'},'La primera fecha de ahorro conserva su antigüedad. El inicio y la última fecha del plan delimitan sus descuentos actuales.'),
       !draft.active&&!draft.first_date&&!draft.enrollment_start&&h('p',{className:'svp-note'},'Si nunca empezó a ahorrar, conserva ambas fechas vacías. No se inventará una fecha de inicio.'),
       h('label',{className:'svp-field'},'Tipo de descuento',h('select',{value:draft.process,disabled:blocked,onChange:e=>change('process',e.target.value)},h('option',{value:''},'Selecciona una opción'),h('option',{value:'PROCESS_1'},'Quincenal · Clave 1'),h('option',{value:'PROCESS_3'},'Quincenal · Suplente variable'),h('option',{value:'JUB'},'Mensual · Jubilado o pensionado'))),
       h('label',{className:'svp-field'},'Continuidad del ahorro',h('select',{value:draft.active?'true':'false',disabled:blocked,onChange:e=>change('active',e.target.value==='true')},h('option',{value:'true'},'Continúa ahorrando'),h('option',{value:'false'},'Dejó de ahorrar'))),
       draft.active&&h(React.Fragment,null,h(Field,{label:draft.process==='JUB'?'Aportación mensual':'Aportación por quincena',type:'number',value:draft.amount,disabled:blocked,onChange:v=>change('amount',v)}),h(Field,{label:'Primer descuento después del corte',type:'date',value:draft.next_date,disabled:blocked,onChange:v=>change('next_date',v)})),
       h(Notes,{value:draft.observation,disabled:blocked,onChange:v=>change('observation',v)}),
       h(Btn,{tone:'outline full',disabled:blocked||!valid,onClick:()=>run('previewBalance',{command:command()},result=>setPreview(result))},busy?'Revisando…':'Revisar saldo y calendario'),
       preview&&h('div',null,h(Fila,{label:'Saldo para confirmar',valor:M(preview.total)}),h(Fila,{label:'Diferencia con el saldo revisado',valor:M(preview.difference)}),
        preview.difference!==0&&h('p',{className:'svp-note warn'},'Los importes no coinciden. Revisa el capital, el rendimiento o los descuentos corregidos antes de confirmar.'),
        h('p',{className:'svp-note'},'Próximas fechas previstas. Confirmar el saldo no registra estos descuentos como recibidos.'),
        (preview.schedule||[]).slice(0,6).map(row=>h(Fila,{key:row.date,label:fmt(row.date),valor:M(row.expected)})),
        !(preview.schedule||[]).length&&h('p',{className:'svp-note'},'No hay descuentos programados con estos datos.'),
        h(Btn,{tone:'primary full',disabled:blocked||!mayConfirm,onClick:()=>run('confirmBalance',{command:command(),fingerprint:preview.fingerprint},()=>{draftDirty.current=false;setPreview(null);setNotice('Saldo confirmado. Continúa en preparación privada.');})},'Confirmar saldo definitivo')))),
     data.certified&&h(React.Fragment,null,
      h('h3',{style:{fontSize:14,marginTop:22}},'Descuentos reales y proyección'),
      h('p',{className:'svp-note'},'Sólo los descuentos confirmados aumentan el saldo. Las fechas pendientes y futuras son una previsión, sin rendimientos nuevos.'),
      h(Field,{label:'Proyectar hasta',type:'date',value:horizon,disabled:blocked,onChange:v=>{setHorizon(v);}}),h(Btn,{tone:'outline',disabled:blocked||!date(horizon),onClick:()=>{horizonRef.current=horizon;setLimit(6);load(false);}},'Recalcular proyección'),
      h(Fila,{label:'Saldo previsto a esa fecha',valor:M(data.projected_total)}),
      data.unconfirmed_dates>0&&h('p',{className:'svp-note warn'},data.unconfirmed_dates+' fecha(s) vencida(s) pendiente(s) de comprobar.'),
      !schedule.length&&h('p',{className:'svp-note'},'No hay descuentos programados para el intervalo consultado.'),
      schedule.slice(0,limit).map(row=>h('div',{key:(row.enrollment_id||'')+':'+row.date,className:'svp-audit'},h('b',null,fmt(row.date)),h(Fila,{label:'Descuento previsto',valor:M(row.expected)}),h(Fila,{label:row.confirmed?'Descuento confirmado':'Descuento recibido',valor:row.confirmed?M(row.actual):'Pendiente de comprobar'}),
       row.future===true&&h('p',{className:'svp-note'},'Fecha futura. Aún no se puede registrar un descuento recibido.'),
       data.can_write&&row.future===false&&(!edit||edit.date!==row.date||edit.enrollmentId!==row.enrollment_id)&&h(Btn,{tone:'outline',disabled:blocked,onClick:()=>{setAdjust(null);setEdit({date:row.date,enrollmentId:row.enrollment_id,actual:row.confirmed?text(row.actual):'',observation:'',version:row.version});retry.current=null;setError('');}},row.confirmed?'Corregir descuento recibido':'Registrar descuento recibido'),
       edit&&edit.date===row.date&&edit.enrollmentId===row.enrollment_id&&h('div',null,h(Field,{label:'Importe realmente recibido',type:'number',value:edit.actual,disabled:blocked,onChange:v=>updateReceipt('actual',v)}),h('p',{className:'svp-note'},'Captura 0 si comprobaste que no hubo descuento. Una casilla vacía queda pendiente.'),h(Notes,{value:edit.observation,disabled:blocked,onChange:v=>updateReceipt('observation',v)}),h('div',{className:'svp-actions'},h(Btn,{disabled:blocked,onClick:()=>{setEdit(null);retry.current=null;setError('');}},'Cancelar captura'),h(Btn,{tone:'primary',disabled:blocked||!money(edit.actual),onClick:()=>run(participantId?'nativeReceipt':'receipt',{...(participantId?{participantId,enrollmentId:edit.enrollmentId}:{}),date:edit.date,actual:Number(edit.actual),version:edit.version,observation:edit.observation},()=>{setEdit(null);setNotice('Descuento guardado. El saldo y la proyección se actualizaron.');})},'Guardar descuento'))))),
      schedule.length>limit&&h(Btn,{tone:'full',disabled:blocked,onClick:()=>setLimit(n=>n+12)},'Ver más fechas'),
      (data.history||[]).length>0&&h('details',{className:'svp-note'},h('summary',null,'Ver cambios del saldo'),data.history.map((event,i)=>h('div',{className:'svp-audit',key:event.id||i},h('b',null,event.actor_name||'Cambio registrado'),h('small',null,event.at||event.created_at?new Date(event.at||event.created_at).toLocaleString('es-MX'):'Fecha no disponible'),event.observation&&h('p',null,event.observation)))),app&&(participantId||data.certificate&&data.certificate.participant_id)&&h(Retirement,{participantId:participantId||data.certificate.participant_id,app,onSaved:async()=>{await load(false);if(onSaved)await onSaved();}}))),
    error&&h('div',{role:'alert',className:'svp-error'},error,/cambió|Actualiza/.test(error)&&h(Btn,{disabled:blocked,onClick:()=>{setPreview(null);retry.current=null;load(false,true);}},'Actualizar datos')),
    notice&&h('div',{role:'status',className:'svp-success'},notice)));
 }
 window.SavingsCertificationAdmin=SavingsCertificationAdmin;
})();
