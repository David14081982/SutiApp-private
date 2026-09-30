/* Account-scoped availability; the existing request and payment flows remain authoritative. */
(function(){
 'use strict';
 const h=React.createElement,{useState,useRef,useEffect}=React;
 function message(e){const s=String(e&&e.message||'');
  if(/CHANGED|IDEMPOTENCY_CONFLICT/.test(s))return 'La habilitación cambió. Actualiza su estado y revisa la decisión antes de confirmar.';
  if(/DENIED|42501/.test(s))return 'Tu cuenta no tiene permiso para habilitar retiros.';
  if(/DATE_INVALID/.test(s))return 'Selecciona hoy o una fecha posterior para el vencimiento.';
  if(/NOT_READY|IDENTITY/.test(s))return 'Primero revisa la identidad y la certificación de esta cuenta.';
  return 'No pudimos confirmar la habilitación. Conservamos tu captura; reintenta o actualiza el estado.';
 }
 function SavingsIndividualWithdrawal({folio,onRequest}){
  const [state,setState]=useState({loading:true}),[form,setForm]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const generation=useRef(0),lock=useRef(false),attempt=useRef(null),formRef=useRef(null);
  async function load(){const seq=++generation.current;setState({loading:true});setError('');
   try{const data=await window.SavingsIndividualWithdrawalRepository.get(folio);if(generation.current===seq)setState({data});}
   catch(e){if(generation.current===seq)setState({error:message(e)});}
  }
  useEffect(()=>{setForm(null);setNotice('');attempt.current=null;load();return()=>{generation.current++;};},[folio]);
  useEffect(()=>{if(form&&formRef.current)formRef.current.focus();},[!!form]);
  const data=state.data,blocked=busy||state.loading||!!state.error;
  function open(enabled){attempt.current=null;setError('');setNotice('');setForm({enabled,until:enabled?data.suggested_until:'',reason:'',version:data.version});}
  function edit(key,value){setForm(old=>({...old,[key]:value}));attempt.current=null;setError('');}
  async function save(e){e.preventDefault();if(lock.current||blocked)return;lock.current=true;setBusy(true);setError('');setNotice('');
   const seq=generation.current,values={folio,enabled:form.enabled,until:form.enabled?form.until:null,reason:form.reason.trim(),version:form.version};
   if(!attempt.current)attempt.current={...values,key:crypto.randomUUID()};
   try{await window.SavingsIndividualWithdrawalRepository.set(attempt.current);
    const current=await window.SavingsIndividualWithdrawalRepository.get(folio);
    if(generation.current!==seq)return;
    setState({data:current});
    if(current.enabled!==values.enabled||!current.ready){setError('El estado actual ya cambió. Revisa la habilitación antes de continuar.');return;}
    attempt.current=null;setForm(null);setNotice(values.enabled?'Retiro habilitado para esta persona. Ya puedes registrar su solicitud.':'Retiro deshabilitado para esta persona. Las solicitudes existentes conservan su historial.');
   }catch(e){if(generation.current===seq)setError(message(e));}
   finally{lock.current=false;if(generation.current===seq)setBusy(false);}
  }
  const button=(label,onClick,disabled=false,primary=false)=>h('button',{type:'button',className:'svp-btn'+(primary?' primary':''),onClick,disabled},label);
  const reasons={IDENTITY:'Primero revisa la identidad de este expediente.',CERTIFICATION:'Primero confirma el saldo de esta cuenta en “Saldo, descuentos y conciliación”.',ENROLLMENT:'Esta persona todavía no tiene una cuenta de ahorro confirmada.'};
  return h(window.SavingsPanelVisual.Tarjeta,{title:'Retiro individual',icon:'download'},h('div',{'data-individual-withdrawal':folio},
   h('p',{className:'svp-note'},'Habilita el retiro únicamente para esta persona. Después registra la solicitud y continúa con su revisión y entrega.'),
   state.loading&&h('p',{role:'status'},'Consultando habilitación…'),
   state.error&&h('div',{role:'alert',className:'svp-error'},state.error),
   data&&h(React.Fragment,null,h('p',{className:'svp-note'},h('b',null,data.name||'Ahorrador'),' · Folio '+folio),
    h('p',{role:'status',className:'svp-note'},!data.ready?reasons[data.block_reason]||'Revisa la cuenta antes de habilitar un retiro.':data.enabled?'Retiro habilitado'+(data.ends_at?' hasta '+new Date(new Date(data.ends_at).getTime()-1).toLocaleString('es-MX',{timeZone:'America/Hermosillo',dateStyle:'medium',timeStyle:'short'}):'')+'.':'Retiro no habilitado para esta persona.'),
    data.ready&&!data.can_configure&&h('p',{className:'svp-note'},'Para cambiar esta habilitación se necesita permiso de configuración de Ahorro.'),
    !form&&h('div',{className:'svp-actions'},data.can_configure&&button(data.enabled?'Deshabilitar retiro':'Habilitar retiro',()=>open(!data.enabled),blocked,!data.enabled),data.ready&&data.enabled&&data.can_create&&button('Registrar retiro',onRequest,blocked,true)),
    form&&h('form',{onSubmit:save},h('p',{className:'svp-note'},form.enabled?'Se habilitará sólo el retiro de esta persona. Esta acción no entrega dinero ni genera rendimientos.':'Se cerrará el retiro sólo para esta persona, aunque exista una apertura general. No cancela solicitudes ni modifica saldos.'),
     form.enabled&&h('label',{className:'svp-field'},'Habilitado hasta · fin del día en Hermosillo',h('input',{type:'date',required:true,min:data.today,value:form.until,disabled:busy,onChange:e=>edit('until',e.target.value)})),
     h('label',{className:'svp-field'},'Motivo',h('textarea',{'aria-label':'Motivo',ref:formRef,required:true,minLength:3,maxLength:1000,value:form.reason,disabled:busy,onChange:e=>edit('reason',e.target.value)})),
     h('div',{className:'svp-actions'},button('Cancelar',()=>{setForm(null);attempt.current=null;setError('');},busy),h('button',{type:'submit',className:'svp-btn primary',disabled:blocked||form.reason.trim().length<3||(form.enabled&&!form.until)},busy?'Guardando…':form.enabled?'Confirmar habilitación':'Confirmar deshabilitación')))),
   error&&h('div',{role:'alert',className:'svp-error'},error),notice&&h('p',{role:'status',className:'svp-success'},notice),
   button('Actualizar habilitación',()=>{setForm(null);attempt.current=null;setNotice('');load();},busy||state.loading)));
 }
 window.SavingsIndividualWithdrawal=SavingsIndividualWithdrawal;
})();
