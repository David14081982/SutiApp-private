/* Functional Savings actions inside the existing Savings sheet. */
(function(){
 'use strict';const h=React.createElement,{useState,useRef}=React;
 function SavingsRequestForm({type,dashboard,onSaved,onClose}){
  const [amount,setAmount]=useState(''),[continuing,setContinuing]=useState(true),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(null);
  const attempt=useRef(),lock=useRef(false),available=dashboard.balances&&dashboard.balances.available;
  const money=n=>typeof n==='number'?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n):'Por confirmar';
  const valid=/^\d+(\.\d{1,2})?$/.test(amount),isWithdrawal=type==='WITHDRAW',isStop=type==='TERMINATE';
  const number=valid?Number(amount):null;
  const [quote,setQuote]=useState(null),[quoteError,setQuoteError]=useState('');
  React.useEffect(()=>{if(type!=='JOIN'||!valid||number<200){setQuote(null);return;}let alive=true;setQuote(null);setQuoteError('');const timer=setTimeout(()=>{Promise.resolve().then(()=>window.SavingsRepository.getJoinContext(number)).then(v=>{if(alive)setQuote(v);}).catch(()=>{if(alive)setQuoteError('No se pudieron consultar las fechas. Cambia el importe o vuelve a abrir la solicitud para reintentar.');});},250);return()=>{alive=false;clearTimeout(timer);};},[type,amount]);
  const allowed=type==='JOIN'?Boolean((dashboard.join_context&&dashboard.join_context.can_join||dashboard.write_capabilities&&dashboard.write_capabilities.requests&&dashboard.actions&&dashboard.actions.JOIN)&&quote&&quote.can_join&&quote.amount===number):dashboard.write_capabilities&&dashboard.write_capabilities.requests&&dashboard.actions&&dashboard.actions[type];
  const ready=allowed&&(isStop||valid&&number>0&&(isWithdrawal?typeof available==='number'&&number<=available:number>=200));
  function change(fn,value){fn(value);setReviewed(false);attempt.current=null;setError('');}
  async function submit(event){event.preventDefault();if(!ready||lock.current)return;if(!reviewed){setReviewed(true);return;}
   const payload={requestType:type,amount:isWithdrawal?number:isStop?0:null,newContributionAmount:!isWithdrawal&&!isStop?number:null,
    component:isWithdrawal?'BOTH':null,continueSaving:isStop?false:isWithdrawal?(number<available?true:continuing):true,reason};
   const serial=JSON.stringify(payload);if(!attempt.current||attempt.current.serial!==serial)attempt.current={serial,key:crypto.randomUUID()};
   lock.current=true;setBusy(true);setError('');try{const result=await window.SavingsRepository.submitRequest({...payload,idempotencyKey:attempt.current.key});setDone(result);await onSaved();}
   catch(e){const raw=String(e&&e.message||'');setError(/CLOSED|DISABLED|NOT_AVAILABLE|ACTION/.test(raw)?'Esta opción ya no está habilitada. Actualiza tu ahorro.':/BALANCE|AMOUNT|AVAILABLE/.test(raw)?'Revisa el importe y el saldo disponible antes de enviar.':/PRIVATE|PUBLISHED/.test(raw)?'El programa está en revisión. Aún no se reciben solicitudes desde esta pantalla.':/PENDING|EXISTS/.test(raw)?'Ya tienes una solicitud pendiente de este tipo. Revisa su estado.':'No se pudo confirmar el envío. Conservamos tu captura para que puedas reintentar.');}
   finally{lock.current=false;setBusy(false);}
  }
  if(done)return h('div',{role:'status'},h('p',null,'Solicitud registrada. Puedes consultar su estado en tu ahorro.'),type==='JOIN'&&h('p',null,'Primer descuento previsto: '+joinDate(done.effective_from)+'. La encargada revisar? tu solicitud.'),h('p',null,done.folio||done.request&&done.request.folio||''),h('button',{className:'sav-primary',onClick:onClose},'Entendido'));
  return h('form',{onSubmit:submit},isWithdrawal&&h('p',null,'Saldo disponible: ',h('strong',null,money(available))),
   !isStop&&h('label',{style:{display:'grid',gap:8,margin:'12px 0'}},isWithdrawal?'Importe a retirar':'Monto de cada descuento',h('input',{type:'text',inputMode:'decimal',value:amount,onChange:e=>change(setAmount,e.target.value),disabled:busy,'aria-label':isWithdrawal?'Importe a retirar':'Monto de cada descuento',style:{padding:12,border:'1px solid var(--line)',borderRadius:12,font:'inherit'}})),
   isWithdrawal&&number!==null&&typeof available==='number'&&(number<available?h('p',null,'Es un retiro parcial. Seguirás ahorrando con el mismo monto y el resto permanecerá en tu ahorro.'):number===available&&h('label',{style:{display:'grid',gap:8}},'Después de retirar todo',h('select',{value:continuing?'yes':'no',disabled:busy,onChange:e=>change(setContinuing,e.target.value==='yes'),style:{padding:12,border:'1px solid var(--line)',borderRadius:12}},h('option',{value:'yes'},'Continuar ahorrando'),h('option',{value:'no'},'Dejar de ahorrar')))),
   isStop&&h('p',null,'Solicitarás dejar de ahorrar. Tu saldo permanecerá en la cuenta; esta solicitud no retira dinero.'),
   !isWithdrawal&&!isStop&&h('p',null,'La fecha de inicio se calculará al enviar: 30 días después de la solicitud y la siguiente fecha de descuento que corresponda.'),
   type==='JOIN'&&h('div',{'data-savings-join-preview':''},quoteError&&h('p',{role:'alert'},quoteError),valid&&number>=200&&!quote&&!quoteError&&h('p',null,'Consultando fechas?'),quote&&h(React.Fragment,null,h('p',null,'Descuento '+(quote.frequency==='MONTHLY'?'mensual, el d?a 5.':'quincenal, los d?as 15 y 30; en febrero, 15 y 28.')),h('p',null,'Fecha de registro prevista: '+joinDate(quote.registration_date)),h('p',null,'Primer descuento previsto: '+joinDate(quote.first_discount_on)),!quote.can_join&&h('p',{role:'alert'},joinReason(quote.reason)),h(SavingsJoinSchedule,{rows:quote.upcoming}))),
   h('label',{style:{display:'grid',gap:8,margin:'12px 0'}},'Observaciones (opcional)',h('textarea',{value:reason,maxLength:1000,disabled:busy,onChange:e=>change(setReason,e.target.value),style:{padding:12,border:'1px solid var(--line)',borderRadius:12,font:'inherit'}})),
   reviewed&&h('p',{role:'status'},'Revisa los datos. Al confirmar se registrará la solicitud; no se reserva ni se entrega dinero en este paso.'),
   error&&h('p',{role:'alert'},error),h('button',{type:'submit',className:'sav-primary',disabled:!ready||busy},busy?'Enviando…':reviewed?'Confirmar solicitud':'Revisar solicitud'));
 }
 function SavingsRequestHistory({requests}){
  const names={JOIN:'Ingreso al ahorro',WITHDRAW:'Retiro de ahorro',CHANGE_AMOUNT:'Cambio de monto',TERMINATE:'Dejar de ahorrar',EXTRAORDINARY_WITHDRAWAL:'Retiro especial'};
  const states={SUBMITTED:'Recibida',UNDER_REVIEW:'En revisi?n',APPROVED:'Aprobada',APPLIED:'Aplicada',SETTLED:'Pagada',CANCELLED:'Cancelada',REJECTED:'Rechazada'};
  return h('div',{'data-savings-request-history':''},(requests||[]).map(r=>h('div',{className:'sav-tx',key:r.id},h('div',null,h('b',null,names[r.request_type]||'Solicitud de ahorro'),h('span',null,r.folio+' ? '+(states[r.status]||'Por confirmar')),r.effective_from&&h('span',null,'Fecha prevista: '+new Date(r.effective_from+'T12:00:00').toLocaleDateString('es-MX'))),h('strong',null,r.new_contribution_amount||r.requested_amount?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(r.new_contribution_amount||r.requested_amount):''))));
 }
 function useSavingsBeneficiaries(identityKey,revision){
  const [state,setState]=useState({phase:'loading'}),[retry,setRetry]=useState(0);
  React.useEffect(()=>{let alive=true;setState({phase:'loading',identityKey});
   Promise.resolve().then(()=>window.SavingsRepository.getBeneficiaries()).then(data=>{if(alive)setState({phase:'ready',data,identityKey});})
    .catch(e=>{if(alive)setState({phase:'error',identityKey,error:/IDENTITY|AFFILIATE/.test(String(e.message))?'Tu registro de ahorro necesita revisión antes de consultar o cambiar beneficiarios. Comunícate con la encargada.':'No fue posible consultar tus beneficiarios. Intenta de nuevo.'});});
   return()=>{alive=false;};
  },[identityKey,revision,retry]);
  return {...(state.identityKey===identityKey?state:{phase:'loading'}),retry:()=>setRetry(v=>v+1)};
 }
 function SavingsBeneficiarySignatures({signatures}){
  const [image,setImage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const mounted=useRef(true);React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function open(path){setError('');setBusy(true);setImage('');try{const url=await window.SavingsRepository.getBeneficiarySignature(path);if(mounted.current)setImage(url);}catch(e){if(mounted.current)setError('No se pudo abrir la firma. Intenta de nuevo.');}finally{if(mounted.current)setBusy(false);}}
  const files=(signatures||[]).filter(s=>s.status==='STORED'&&s.path),missing=(signatures||[]).filter(s=>s.status!=='STORED').length;
  return h('div',{'data-beneficiary-signatures':''},files.map((s,i)=>h('button',{type:'button',className:'sav-retry',key:s.path,disabled:busy,onClick:()=>open(s.path),style:{margin:'8px 8px 8px 0'}},'Ver firma'+(files.length>1?' '+(i+1):''))),
   missing>0&&h('p',null,'Hay '+missing+' registro(s) histórico(s) sin firma disponible. Al actualizar, se solicitará una nueva firma.'),
   busy&&h('p',{role:'status'},'Abriendo firma…'),error&&h('p',{role:'alert'},error),image&&h('div',null,h('img',{src:image,alt:'Firma de autorización de beneficiarios',style:{display:'block',maxWidth:'100%',background:'#fff',border:'1px solid var(--line)',borderRadius:12},onError:()=>{setImage('');setError('La firma no se pudo mostrar. Vuelve a abrirla.');}}),h('button',{type:'button',className:'sav-retry',onClick:()=>setImage('')},'Cerrar firma')));
 }
 function SavingsBeneficiarySignaturePad({value,onChange}){
  const wrap=useRef(null),change=useRef(onChange),[revision,setRevision]=useState(0);change.current=onChange;
  React.useEffect(()=>{let width=wrap.current.clientWidth;const observer=new ResizeObserver(()=>{const next=wrap.current.clientWidth;if(next!==width){width=next;change.current('');setRevision(v=>v+1);}});observer.observe(wrap.current);return()=>observer.disconnect();},[]);
  return h('div',{ref:wrap},h(window.SignaturePad,{key:revision,value,onChange,label:'Firma de autorización'}));
 }
 function SavingsBeneficiariesForm({beneficiaries,versionId,onSaved,onClose}){
  const [rows,setRows]=useState(()=>(beneficiaries||[]).map(x=>({full_name:x.full_name,relationship:x.relationship||'',percentage:String(x.percentage)})));
  const [busy,setBusy]=useState(false),[review,setReview]=useState(false),[error,setError]=useState(''),[signature,setSignature]=useState(''),[accepted,setAccepted]=useState(false),[signatureRevision,setSignatureRevision]=useState(0),[saved,setSaved]=useState(false);
  const lock=useRef(false),attempt=useRef();
  function reset(){setReview(false);setError('');setSignature('');setAccepted(false);setSignatureRevision(v=>v+1);attempt.current=null;}
  const update=(i,k,v)=>{setRows(a=>a.map((r,n)=>n===i?{...r,[k]:v}:r));reset();};
  const cents=rows.reduce((n,r)=>n+Math.round(Number(r.percentage)*100),0);
  const valid=rows.length<=20&&cents<=10000&&rows.every(r=>r.full_name.trim().length>=3&&r.full_name.trim().length<=180&&(!r.relationship.trim()||r.relationship.trim().length>=2)&&/^\d+(\.\d{1,2})?$/.test(r.percentage)&&Number(r.percentage)>0&&Number(r.percentage)<=100);
  async function submit(e){e.preventDefault();if(e.nativeEvent&&e.nativeEvent.submitter&&e.nativeEvent.submitter.getAttribute('data-beneficiary-submit')!=='true')return;if(lock.current||!valid||saved)return;if(!review){setReview(true);return;}if(!signature||!accepted)return;
   lock.current=true;setBusy(true);setError('');if(!attempt.current)attempt.current=crypto.randomUUID();
   try{await window.SavingsRepository.replaceBeneficiaries(rows.map(r=>({full_name:r.full_name.trim(),relationship:r.relationship.trim()||null,percentage:Number(r.percentage)})),attempt.current,{signature,accepted,versionId});setSaved(true);onSaved();}
   catch(e){setError(/IDEMPOTENCY|CHANGED|STALE/.test(String(e.message))?'Los datos cambiaron. Cierra esta propuesta y actualiza tus beneficiarios antes de intentar de nuevo.':/OVER_100|INVALID/.test(String(e.message))?'Revisa nombres y porcentajes. El total no puede superar el 100 %.':'No se pudo confirmar el guardado. Conservamos tu captura y firma para reintentar.');}
   finally{lock.current=false;setBusy(false);}
  }
  if(saved)return h('div',{role:'status'},h('p',null,'Tus beneficiarios y la firma de autorización quedaron guardados.'),h('button',{type:'button',className:'sav-primary',onClick:onClose},'Entendido'));
  return h('form',{onSubmit:submit,'data-beneficiaries-form':'',style:{fontSize:'var(--text-13, 13px)'}},rows.map((r,i)=>h('fieldset',{key:i,disabled:busy,style:{border:'1px solid var(--line)',borderRadius:12,margin:'12px 0',padding:12,minWidth:0}},h('legend',null,'Beneficiario '+(i+1)),
   [['full_name','Nombre completo'],['relationship','Parentesco (opcional)'],['percentage','Porcentaje']].map(([k,label])=>h('label',{key:k,style:{display:'grid',gap:6,marginBottom:10}},label,h('input',{value:r[k],maxLength:k==='full_name'?180:k==='relationship'?80:6,inputMode:k==='percentage'?'decimal':undefined,onChange:e=>update(i,k,e.target.value),style:{font:'inherit',padding:10,border:'1px solid var(--line)',borderRadius:8,minWidth:0,width:'100%'}}))),
   h('button',{type:'button',className:'sav-retry',onClick:()=>{setRows(a=>a.filter((_,n)=>n!==i));reset();}},'Quitar de esta propuesta'))),
   h('button',{type:'button',className:'sav-retry',disabled:busy||rows.length>=20,onClick:()=>{setRows(a=>[...a,{full_name:'',relationship:'',percentage:''}]);reset();}},'Agregar beneficiario'),
   h('p',{'aria-live':'polite'},'Total asignado: '+(Number.isFinite(cents)?(cents/100).toFixed(2):'0')+' %. Máximo: 100 %.'),
   cents>10000&&h('p',{role:'alert'},'La suma de los porcentajes no puede superar el 100 %.'),
   rows.length===0&&h('p',null,'Esta propuesta dejará tu ahorro sin beneficiarios registrados.'),
   review&&h('fieldset',{disabled:busy,style:{border:0,padding:0,margin:'14px 0',minWidth:0}},
    h('p',null,'Revisa la distribución. Esta autorización reemplaza la distribución vigente y conserva el registro anterior.'),
    h('div',{style:busy?{pointerEvents:'none',opacity:.65}:undefined},h(SavingsBeneficiarySignaturePad,{key:signatureRevision,value:signature,onChange:value=>{setSignature(value);setAccepted(false);attempt.current=null;},label:'Firma de autorización'})),
    h('label',{style:{display:'flex',alignItems:'flex-start',gap:10,fontSize:'var(--text-13, 13px)',lineHeight:1.5,margin:'14px 0'}},h('input',{type:'checkbox',checked:accepted,onChange:e=>{setAccepted(e.target.checked);attempt.current=null;}}),'Autorizo esta distribución de mi ahorro entre los beneficiarios indicados en caso de fallecimiento.')),
   error&&h('p',{role:'alert'},error),h('button',{type:'submit','data-beneficiary-submit':'true',className:'sav-primary',disabled:!valid||busy||review&&(!signature||!accepted)},busy?'Guardando…':review?'Confirmar beneficiarios':'Revisar beneficiarios'));
 }
 window.useSavingsBeneficiaries=useSavingsBeneficiaries;
 window.SavingsBeneficiarySignatures=SavingsBeneficiarySignatures;

 function joinDate(value){return value?new Date(value+(String(value).length===10?'T12:00:00Z':'')).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Hermosillo'}):'Por confirmar';}
 function joinReason(reason){return {IDENTITY_REVIEW:'La encargada debe revisar la vinculaci?n de tu Folio.',OPENING_REVIEW:'Tu registro anterior est? en revisi?n. La encargada debe confirmarlo antes de un nuevo ingreso.',CATEGORY_REQUIRED:'Falta confirmar tu tipo de trabajador para calcular las fechas. Comun?cate con la encargada.',INTAKE_CLOSED:'Por el momento no se reciben nuevos ingresos al ahorro.',REQUEST_PENDING:'Tu solicitud de ingreso est? pendiente de revisi?n.'}[reason]||'';}
 function SavingsJoinSchedule({rows}){return h('details',{'data-savings-join-schedule':''},h('summary',null,'Pr?ximos descuentos previstos'),h('p',null,'Proyecci?n de un a?o. No es saldo recibido y no incluye rendimientos.'),(rows||[]).map(r=>h('div',{className:'sav-row',key:r.contribution_date},h('span',null,joinDate(r.contribution_date)),h('b',null,new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(r.expected_amount)))));}
 function SavingsJoinAccess({revision,onJoin,existing}){
  const [context,setContext]=useState(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  React.useEffect(()=>{let alive=true;setContext(null);setError(false);Promise.resolve().then(()=>window.SavingsRepository.getJoinContext()).then(v=>{if(alive)setContext(v);}).catch(()=>{if(alive)setError(true);});return()=>{alive=false;};},[revision,retry]);
  if(existing&&(!context||!context.request&&!context.can_join))return error?h('p',{role:'alert'},'No se pudo consultar el registro de ingreso.',h('button',{className:'sav-retry',onClick:()=>setRetry(v=>v+1)},'Reintentar')):null;
  const request=context&&context.request,states={SUBMITTED:'Recibida',UNDER_REVIEW:'En revisi?n',APPROVED:'Aprobada',REJECTED:'Rechazada',CANCELLED:'Cancelada',APPLIED:'Aplicada'};
  return h('div',{'data-savings-join-access':'',style:existing?{margin:'12px 16px'}:undefined},
   (!existing||context.can_join)&&h('button',{type:'button',className:'sav-primary',disabled:!context||!context.can_join,onClick:()=>onJoin(context)},'Ingresar al ahorro'),
   !context&&!error&&!existing&&h('p',{role:'status'},'Consultando disponibilidad?'),error&&h('p',{role:'alert'},'No se pudo consultar el ingreso al ahorro. ',h('button',{className:'sav-retry',onClick:()=>setRetry(v=>v+1)},'Reintentar')),
   context&&joinReason(context.reason)&&h('p',null,joinReason(context.reason)),request&&h('div',{style:{textAlign:'left'}},h('h3',null,'Tu solicitud de ingreso'),h('p',null,states[request.status]||'Por confirmar'),h('p',null,'Registrada: '+joinDate(request.submitted_at)),h('p',null,'Monto por descuento: '+new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(request.amount)),h('p',null,'Primer descuento previsto: '+joinDate(request.effective_from)),h(SavingsJoinSchedule,{rows:context.upcoming})));
 }
 window.SavingsJoinAccess=SavingsJoinAccess;
 window.SavingsRequestHistory=SavingsRequestHistory;
 window.SavingsBeneficiariesForm=SavingsBeneficiariesForm;
 window.SavingsRequestForm=SavingsRequestForm;
})();
