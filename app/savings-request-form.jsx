/* Functional Savings actions inside the existing Savings sheet. */
(function(){
 'use strict';const h=React.createElement,{useState,useRef}=React;
 function SavingsRequestForm({type,dashboard,onSaved,onClose}){
  const [amount,setAmount]=useState(''),[continuing,setContinuing]=useState(true),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(null);
  const attempt=useRef(),lock=useRef(false),available=dashboard.balances&&dashboard.balances.available;
  const money=n=>typeof n==='number'?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n):'Por confirmar';
  const valid=/^\d+(\.\d{1,2})?$/.test(amount),isWithdrawal=type==='WITHDRAW',isStop=type==='TERMINATE';
  const number=valid?Number(amount):null;
  const allowed=dashboard.write_capabilities&&dashboard.write_capabilities.requests&&dashboard.actions&&dashboard.actions[type];
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
  if(done)return h('div',{role:'status'},h('p',null,'Solicitud registrada. Puedes consultar su estado en tu ahorro.'),h('p',null,done.folio||done.request&&done.request.folio||''),h('button',{className:'sav-primary',onClick:onClose},'Entendido'));
  return h('form',{onSubmit:submit},isWithdrawal&&h('p',null,'Saldo disponible: ',h('strong',null,money(available))),
   !isStop&&h('label',{style:{display:'grid',gap:8,margin:'12px 0'}},isWithdrawal?'Importe a retirar':'Monto de cada descuento',h('input',{type:'text',inputMode:'decimal',value:amount,onChange:e=>change(setAmount,e.target.value),disabled:busy,'aria-label':isWithdrawal?'Importe a retirar':'Monto de cada descuento',style:{padding:12,border:'1px solid var(--line)',borderRadius:12,font:'inherit'}})),
   isWithdrawal&&number!==null&&typeof available==='number'&&(number<available?h('p',null,'Es un retiro parcial. Seguirás ahorrando con el mismo monto y el resto permanecerá en tu ahorro.'):number===available&&h('label',{style:{display:'grid',gap:8}},'Después de retirar todo',h('select',{value:continuing?'yes':'no',disabled:busy,onChange:e=>change(setContinuing,e.target.value==='yes'),style:{padding:12,border:'1px solid var(--line)',borderRadius:12}},h('option',{value:'yes'},'Continuar ahorrando'),h('option',{value:'no'},'Dejar de ahorrar')))),
   isStop&&h('p',null,'Solicitarás dejar de ahorrar. Tu saldo permanecerá en la cuenta; esta solicitud no retira dinero.'),
   !isWithdrawal&&!isStop&&h('p',null,'La fecha de inicio se calculará al enviar: 30 días después de la solicitud y la siguiente fecha de descuento que corresponda.'),
   h('label',{style:{display:'grid',gap:8,margin:'12px 0'}},'Observaciones (opcional)',h('textarea',{value:reason,maxLength:1000,disabled:busy,onChange:e=>change(setReason,e.target.value),style:{padding:12,border:'1px solid var(--line)',borderRadius:12,font:'inherit'}})),
   reviewed&&h('p',{role:'status'},'Revisa los datos. Al confirmar se registrará la solicitud; no se reserva ni se entrega dinero en este paso.'),
   error&&h('p',{role:'alert'},error),h('button',{type:'submit',className:'sav-primary',disabled:!ready||busy},busy?'Enviando…':reviewed?'Confirmar solicitud':'Revisar solicitud'));
 }
 function SavingsRequestHistory({requests}){
  const names={JOIN:'Ingreso al ahorro',WITHDRAW:'Retiro de ahorro',CHANGE_AMOUNT:'Cambio de monto',TERMINATE:'Dejar de ahorrar',EXTRAORDINARY_WITHDRAWAL:'Retiro especial'};
  const states={SUBMITTED:'Recibida',UNDER_REVIEW:'En revisi?n',APPROVED:'Aprobada',APPLIED:'Aplicada',SETTLED:'Pagada',CANCELLED:'Cancelada',REJECTED:'Rechazada'};
  return h('div',{'data-savings-request-history':''},(requests||[]).map(r=>h('div',{className:'sav-tx',key:r.id},h('div',null,h('b',null,names[r.request_type]||'Solicitud de ahorro'),h('span',null,r.folio+' ? '+(states[r.status]||'Por confirmar')),r.effective_from&&h('span',null,'Fecha prevista: '+new Date(r.effective_from+'T12:00:00').toLocaleDateString('es-MX'))),h('strong',null,r.new_contribution_amount||r.requested_amount?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(r.new_contribution_amount||r.requested_amount):''))));
 }
 function SavingsBeneficiariesForm({beneficiaries,onSaved,onClose}){
  const [rows,setRows]=useState(()=>(beneficiaries||[]).map(x=>({full_name:x.full_name,relationship:x.relationship,percentage:String(x.percentage)}))),[busy,setBusy]=useState(false),[review,setReview]=useState(false),[error,setError]=useState('');
  const lock=useRef(false),attempt=useRef();const update=(i,k,v)=>{setRows(a=>a.map((r,n)=>n===i?{...r,[k]:v}:r));setReview(false);attempt.current=null;};
  const cents=rows.reduce((n,r)=>n+Math.round(Number(r.percentage)*100),0),valid=rows.length>0&&rows.length<=10&&cents===10000&&rows.every(r=>r.full_name.trim().length>=3&&r.relationship.trim().length>=2&&/^\d+(\.\d{1,2})?$/.test(r.percentage)&&Number(r.percentage)>0&&Number(r.percentage)<=100);
  async function submit(e){e.preventDefault();if(lock.current||!valid)return;if(!review){setReview(true);return;}lock.current=true;setBusy(true);setError('');if(!attempt.current)attempt.current=crypto.randomUUID();try{await window.SavingsRepository.replaceBeneficiaries(rows.map(r=>({...r,percentage:Number(r.percentage)})),attempt.current);await onSaved();onClose();}catch(e){setError(/IDEMPOTENCY|CHANGED|STALE/.test(String(e.message))?'Los datos cambiaron. Actualiza tu ahorro y vuelve a revisar.':'No se pudieron guardar los beneficiarios. Conservamos tu captura para reintentar.');}finally{lock.current=false;setBusy(false);}}
  return h('form',{onSubmit:submit},rows.map((r,i)=>h('fieldset',{key:i,disabled:busy,style:{border:'1px solid var(--line)',borderRadius:12,margin:'12px 0',padding:12}},h('legend',null,'Beneficiario '+(i+1)),[['full_name','Nombre completo'],['relationship','Parentesco'],['percentage','Porcentaje']].map(([k,label])=>h('label',{key:k,style:{display:'grid',gap:6,marginBottom:10}},label,h('input',{value:r[k],maxLength:k==='full_name'?180:k==='relationship'?80:6,inputMode:k==='percentage'?'decimal':undefined,onChange:e=>update(i,k,e.target.value),style:{font:'inherit',padding:10,border:'1px solid var(--line)',borderRadius:8}}))),h('button',{type:'button',className:'sav-retry',onClick:()=>{setRows(a=>a.filter((_,n)=>n!==i));setReview(false);attempt.current=null;}},'Quitar de esta propuesta'))),h('button',{type:'button',className:'sav-retry',disabled:busy||rows.length>=10,onClick:()=>{setRows(a=>[...a,{full_name:'',relationship:'',percentage:''}]);setReview(false);attempt.current=null;}},'Agregar beneficiario'),h('p',null,'Los porcentajes deben sumar 100%. Total: '+(Number.isFinite(cents)?(cents/100).toFixed(2):'0')+'%'),review&&h('p',{role:'status'},'Al confirmar se guardar? esta distribuci?n. Se conservar? el registro anterior.'),error&&h('p',{role:'alert'},error),h('button',{type:'submit',className:'sav-primary',disabled:!valid||busy},busy?'Guardando?':review?'Confirmar beneficiarios':'Revisar beneficiarios'));
 }
 window.SavingsRequestHistory=SavingsRequestHistory;
 window.SavingsBeneficiariesForm=SavingsBeneficiariesForm;
 window.SavingsRequestForm=SavingsRequestForm;
})();
