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
 const BENEFICIARY_CSS = `
.ben-v2{--guinda:#910022;--guinda-600:#7e0020;--guinda-50:#fbeef1;--guinda-100:#f3d6de;--grad-guinda:linear-gradient(150deg,#e8364f 0%,#c41230 42%,#910022 100%);--ink:#14213d;--ink-2:#5a6378;--ink-3:#97a0b3;--ink-4:#c4cad6;--surface:#fff;--surface-2:#eef1f6;--bg:#f2f3f5;--hairline:#e6eaf1;--line:rgba(20,33,61,.08);--neo-sm:0 6px 16px -8px rgba(20,33,61,.16),0 2px 5px rgba(20,33,61,.05);--neo-md:0 14px 30px -12px rgba(20,33,61,.2),0 4px 10px -2px rgba(20,33,61,.06);--neo-inset:inset 2px 2px 5px rgba(170,182,204,.3),inset -2px -2px 5px rgba(255,255,255,.9);--glow:0 10px 26px -6px rgba(209,31,58,.55);--ok:#13794A;--ok-bg:#E7F6ED;--bad:#C0341D;--bad-bg:#FDEAEA;--warn:#8A5A00;--warn-bg:#FDF3DC;--font:'Nunito',system-ui,sans-serif;--mono:'Spline Sans Mono',ui-monospace,monospace}
.ben-v2 *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.ben-v2 body{margin:0;font-family:var(--font);background:#d9dee8;color:var(--ink);display:grid;place-items:start center;min-height:100dvh;padding:24px 0}
.ben-v2{width:430px;max-width:100%;height:920px;background:var(--bg);border-radius:30px;overflow:hidden;box-shadow:0 40px 90px -30px rgba(20,33,61,.5);display:flex;flex-direction:column;position:relative}
.ben-v2 .top{background:var(--grad-guinda);color:#fff;padding:15px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0;position:relative;z-index:2}
.ben-v2 .top button{width:36px;height:36px;border-radius:11px;border:none;background:rgba(255,255,255,.18);color:#fff;display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.ben-v2 .top>div{flex:1;min-width:0}
.ben-v2 .top h1{font-size:calc(17.5px * var(--text-scale,1));font-weight:800;letter-spacing:-.02em;margin:0;line-height:1.18}
.ben-v2 .top .sub{font-size:calc(11.5px * var(--text-scale,1));font-weight:600;opacity:.85;margin-top:2px}
.ben-v2 .scroll{flex:1;overflow:auto;scrollbar-width:none;padding:0 0 24px}
.ben-v2 .scroll::-webkit-scrollbar{width:0}
.ben-v2 .pad{padding:0 16px}
.ben-v2 .bar{display:flex;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:var(--surface);border-top:1px solid var(--hairline);flex-shrink:0;align-items:center;position:relative;z-index:1}
.ben-v2 .btn{height:52px;border:none;border-radius:15px;font-family:inherit;font-size:calc(15px * var(--text-scale,1));font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px;transition:transform .16s cubic-bezier(.2,.7,.3,1)}
.ben-v2 .btn:active{transform:scale(.975)}
.ben-v2 .btn.pri{background:var(--grad-guinda);color:#fff;box-shadow:var(--glow)}
.ben-v2 .btn.sec{background:var(--surface-2);color:var(--ink)}
.ben-v2 .btn.out{background:transparent;color:var(--ink-2);box-shadow:inset 0 0 0 1.5px var(--hairline)}
.ben-v2 .btn.block{width:100%}
.ben-v2 .btn[disabled]{background:var(--surface-2);color:var(--ink-3);box-shadow:none;cursor:default;transform:none}
.ben-v2 .btn.sm{height:42px;font-size:calc(13.5px * var(--text-scale,1));padding:0 15px;border-radius:12px}
.ben-v2 .icobtn{width:34px;height:34px;border-radius:11px;border:none;background:var(--surface-2);color:var(--ink-2);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.ben-v2 .icobtn.danger{background:var(--bad-bg);color:var(--bad)}
.ben-v2 .icobtn[disabled]{color:var(--ink-4);cursor:default}
.ben-v2 .doc{background:var(--grad-guinda);color:#fff;padding:20px 20px 0;position:relative;overflow:hidden}
.ben-v2 .doc .seal{position:absolute;right:-30px;top:-34px;opacity:.12}
.ben-v2 .doc .k{font-size:calc(11px * var(--text-scale,1));font-weight:800;letter-spacing:.09em;opacity:.8;position:relative}
.ben-v2 .doc .money{font-size:calc(36px * var(--text-scale,1));font-weight:900;letter-spacing:-.035em;line-height:1.05;margin-top:3px;font-variant-numeric:tabular-nums;position:relative}
.ben-v2 .doc .note{font-size:calc(12.5px * var(--text-scale,1));font-weight:600;opacity:.84;margin-top:5px;line-height:1.4;position:relative;max-width:30ch}
.ben-v2 .doc .rail{display:flex;height:10px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.22);margin:18px 0 0;gap:2px;position:relative}
.ben-v2 .doc .rail i{display:block;height:100%;background:#fff;transition:flex-grow .32s cubic-bezier(.2,0,0,1)}
.ben-v2 .doc .rail i.rest{background:repeating-linear-gradient(115deg,rgba(255,255,255,.34) 0 5px,rgba(255,255,255,.14) 5px 10px)}
.ben-v2 .doc .veredicto{display:flex;align-items:center;gap:9px;margin:14px -20px 0;padding:11px 20px;font-size:calc(12.5px * var(--text-scale,1));font-weight:800;background:rgba(0,0,0,.16)}
.ben-v2 .doc .veredicto svg{flex-shrink:0}
.ben-v2 .state{display:flex;align-items:center;gap:11px;border-radius:16px;padding:12px 14px;font-weight:700;margin-bottom:14px}
.ben-v2 .state .ic{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
.ben-v2 .state b{display:block;font-size:calc(13.5px * var(--text-scale,1));font-weight:800}
.ben-v2 .state s{display:block;text-decoration:none;font-size:calc(11.5px * var(--text-scale,1));font-weight:600;opacity:.88;margin-top:1px;line-height:1.35}
.ben-v2 .state.ok{background:var(--ok-bg);color:var(--ok)}
.ben-v2 .state.ok .ic{background:rgba(19,121,74,.12)}
.ben-v2 .state.warn{background:var(--warn-bg);color:var(--warn)}
.ben-v2 .state.warn .ic{background:rgba(138,90,0,.12)}
.ben-v2 .state.bad{background:var(--bad-bg);color:var(--bad)}
.ben-v2 .state.bad .ic{background:rgba(192,52,29,.12)}
.ben-v2 .sh{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:20px 0 10px}
.ben-v2 .sh b{font-size:calc(12px * var(--text-scale,1));font-weight:800;color:var(--ink-3);letter-spacing:.07em}
.ben-v2 .sh s{font-size:calc(11.5px * var(--text-scale,1));font-weight:700;color:var(--ink-3);text-decoration:none}
.ben-v2 .list{background:var(--surface);border-radius:22px;box-shadow:var(--neo-md);overflow:hidden}
.ben-v2 .prow{display:flex;align-items:center;gap:13px;padding:15px 16px;width:100%;border:none;background:none;font-family:inherit;text-align:left;cursor:pointer;position:relative;transition:background .16s}
.ben-v2 .prow+.prow{border-top:1px solid var(--line)}
.ben-v2 .prow:active{background:var(--surface-2)}
.ben-v2 .prow .edge{position:absolute;left:0;top:0;bottom:0;width:4px}
.ben-v2 .av{width:46px;height:46px;border-radius:16px;display:grid;place-items:center;font-size:calc(15.5px * var(--text-scale,1));font-weight:900;color:#fff;flex-shrink:0;letter-spacing:-.02em}
.ben-v2 .pname{font-size:calc(15.5px * var(--text-scale,1));font-weight:800;line-height:1.22;text-wrap:pretty;display:block}
.ben-v2 .prel{font-size:calc(12px * var(--text-scale,1));font-weight:600;color:var(--ink-3);margin-top:2px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.ben-v2 .dot{width:3px;height:3px;border-radius:999px;background:var(--ink-4);flex-shrink:0}
.ben-v2 .prel .firm{display:inline-flex;align-items:center;gap:3px;font-weight:700}
.ben-v2 .prel .firm.ok{color:var(--ok)}
.ben-v2 .prel .firm.no{color:var(--warn)}
.ben-v2 .pamt{text-align:right;flex-shrink:0}
.ben-v2 .pamt .n{display:block;font-size:calc(21px * var(--text-scale,1));font-weight:900;letter-spacing:-.025em;font-variant-numeric:tabular-nums;line-height:1}
.ben-v2 .pamt .m{display:block;font-size:calc(11.5px * var(--text-scale,1));font-weight:700;color:var(--ink-3);margin-top:3px;font-variant-numeric:tabular-nums}
.ben-v2 .pname{display:block}
.ben-v2 .prel{display:flex}
.ben-v2 .empty{background:var(--surface);border-radius:22px;box-shadow:var(--neo-sm);padding:28px 22px;text-align:center}
.ben-v2 .empty .ic{width:56px;height:56px;border-radius:19px;background:var(--guinda-50);color:var(--guinda);display:grid;place-items:center;margin:0 auto 13px}
.ben-v2 .empty b{font-size:calc(16px * var(--text-scale,1));font-weight:800;display:block}
.ben-v2 .empty s{font-size:calc(12.5px * var(--text-scale,1));font-weight:600;color:var(--ink-3);text-decoration:none;display:block;margin-top:6px;line-height:1.5}
.ben-v2 .foot{display:flex;gap:9px;align-items:flex-start;font-size:calc(11.5px * var(--text-scale,1));font-weight:600;color:var(--ink-3);line-height:1.5;margin-top:18px}
.ben-v2 .foot svg{flex-shrink:0;margin-top:1px}
.ben-v2 .scroll svg,.ben-v2 .sheet svg,.ben-v2 .bar svg{flex-shrink:0}
.ben-v2 .hero{background:var(--surface);border-radius:24px;box-shadow:var(--neo-md);padding:18px;margin-bottom:14px}
.ben-v2 .hero .k{font-size:calc(11.5px * var(--text-scale,1));font-weight:800;color:var(--ink-3);letter-spacing:.04em}
.ben-v2 .hero .money{font-size:calc(31px * var(--text-scale,1));font-weight:900;letter-spacing:-.03em;margin-top:2px;font-variant-numeric:tabular-nums}
.ben-v2 .hero .note{font-size:calc(12px * var(--text-scale,1));font-weight:600;color:var(--ink-3);margin-top:3px;line-height:1.4}
.ben-v2 .split{display:flex;height:14px;border-radius:999px;overflow:hidden;background:var(--surface-2);margin-top:16px;gap:2px}
.ben-v2 .split i{display:block;height:100%;transition:flex-grow .32s cubic-bezier(.2,0,0,1)}
.ben-v2 .split i.rest{background:repeating-linear-gradient(115deg,#dfe4ee 0 6px,#eef1f6 6px 12px)}
.ben-v2 .legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}
.ben-v2 .legend span{display:inline-flex;align-items:center;gap:6px;font-size:calc(11.5px * var(--text-scale,1));font-weight:700;color:var(--ink-2)}
.ben-v2 .legend b{width:9px;height:9px;border-radius:3px;flex-shrink:0}
.ben-v2 .status{display:flex;align-items:center;gap:11px;border-radius:16px;padding:13px 15px;margin-bottom:14px;font-weight:700}
.ben-v2 .status .ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
.ben-v2 .status b{display:block;font-size:calc(13.5px * var(--text-scale,1));font-weight:800}
.ben-v2 .status s{display:block;text-decoration:none;font-size:calc(11.5px * var(--text-scale,1));font-weight:600;opacity:.85;margin-top:1px;line-height:1.35}
.ben-v2 .status.ok{background:var(--ok-bg);color:var(--ok)}
.ben-v2 .status.ok .ic{background:rgba(19,121,74,.12)}
.ben-v2 .status.warn{background:var(--warn-bg);color:var(--warn)}
.ben-v2 .status.warn .ic{background:rgba(138,90,0,.12)}
.ben-v2 .status.bad{background:var(--bad-bg);color:var(--bad)}
.ben-v2 .status.bad .ic{background:rgba(192,52,29,.12)}
.ben-v2 .chips{display:flex;flex-wrap:wrap;gap:6px}
.ben-v2 .edhead{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.ben-v2 .edhead .n{width:26px;height:26px;border-radius:9px;display:grid;place-items:center;font-size:calc(12.5px * var(--text-scale,1));font-weight:800;color:#fff;flex-shrink:0}
.ben-v2 .edhead b{flex:1;font-size:calc(13px * var(--text-scale,1));font-weight:800;color:var(--ink-2);letter-spacing:.01em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ben-v2 .lab{font-size:calc(11.5px * var(--text-scale,1));font-weight:800;color:var(--ink-3);display:block;margin:12px 0 5px;letter-spacing:.02em}
.ben-v2 .field{width:100%;border:none;outline:none;background:var(--surface-2);box-shadow:var(--neo-inset);border-radius:13px;padding:13px 14px;font-size:calc(15px * var(--text-scale,1));font-family:inherit;font-weight:600;color:var(--ink)}
.ben-v2 .field::placeholder{color:var(--ink-4);font-weight:500}
.ben-v2 .field:focus-visible{box-shadow:0 0 0 3px var(--guinda-100)}
.ben-v2 .tag{border:none;cursor:pointer;font-family:inherit;font-size:calc(12px * var(--text-scale,1));font-weight:700;padding:8px 13px;border-radius:999px;background:var(--surface-2);color:var(--ink-2)}
.ben-v2 .tag[aria-pressed="true"]{background:var(--guinda);color:#fff;box-shadow:var(--glow)}
.ben-v2 .pctrow{display:flex;align-items:center;gap:10px}
.ben-v2 .step{width:46px;height:46px;border-radius:14px;border:none;background:var(--surface-2);color:var(--ink);display:grid;place-items:center;cursor:pointer;flex-shrink:0;font-weight:800}
.ben-v2 .step[disabled]{color:var(--ink-4);cursor:default}
.ben-v2 .money-hint{font-size:calc(12px * var(--text-scale,1));font-weight:700;color:var(--ink-2);margin-top:9px;font-variant-numeric:tabular-nums}
.ben-v2 .quick{display:flex;gap:7px;flex-wrap:wrap}
.ben-v2 .quick:not(:empty){margin-top:11px}
.ben-v2 .sign{background:var(--surface-2);border-radius:14px;padding:12px;margin-top:12px;display:flex;align-items:center;gap:12px}
.ben-v2 .sign .thumb{width:74px;height:48px;border-radius:9px;background:#fff;box-shadow:var(--neo-sm);display:grid;place-items:center;overflow:hidden;flex-shrink:0}
.ben-v2 .sign .thumb svg{width:100%;height:100%}
.ben-v2 .sign b{display:block;font-size:calc(12.5px * var(--text-scale,1));font-weight:800}
.ben-v2 .sign s{display:block;text-decoration:none;font-size:calc(11.5px * var(--text-scale,1));font-weight:600;color:var(--ink-3);margin-top:1px}
.ben-v2 .smart{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:none;cursor:pointer;font-family:inherit;background:var(--surface);border-radius:18px;padding:13px 14px;box-shadow:var(--neo-md);margin-bottom:14px;position:relative;overflow:hidden;transition:transform .16s cubic-bezier(.2,.7,.3,1)}
.ben-v2 .smart:active{transform:scale(.985)}
.ben-v2 .smart .ic{width:40px;height:40px;border-radius:14px;background:var(--grad-guinda);color:#fff;display:grid;place-items:center;flex-shrink:0;position:relative}
.ben-v2 .smart b{display:block;font-size:calc(14.5px * var(--text-scale,1));font-weight:800;letter-spacing:-.01em}
.ben-v2 .smart s{display:block;text-decoration:none;font-size:calc(12px * var(--text-scale,1));font-weight:700;color:var(--ink-2);margin-top:2px;font-variant-numeric:tabular-nums}
.ben-v2 .smart .go{color:var(--guinda);flex-shrink:0}
.ben-v2 .smart .sheen{position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 30%,rgba(232,54,79,.14) 48%,transparent 66%);transform:translateX(-120%)}
.ben-v2 .smart.nuevo{animation:benSmartIn .42s cubic-bezier(.2,0,0,1) both}
.ben-v2 .smart.nuevo .sheen{animation:benSheen 1.25s cubic-bezier(.3,0,.2,1) .18s 2 both}
.ben-v2 .smart.nuevo .ic::after{content:'';position:absolute;inset:-5px;border-radius:18px;box-shadow:0 0 0 2px var(--guinda);opacity:0;animation:benRing 1.5s cubic-bezier(.2,0,0,1) .2s 2 both}
@keyframes benSmartIn{from{opacity:0;transform:translateY(-10px) scale(.97)}to{opacity:1;transform:none}}
@keyframes benSheen{from{transform:translateX(-120%)}to{transform:translateX(120%)}}
@keyframes benRing{0%{opacity:.85;transform:scale(.88)}70%{opacity:0;transform:scale(1.18)}100%{opacity:0;transform:scale(1.18)}}
.ben-v2 .ed{background:var(--surface);border-radius:20px;box-shadow:var(--neo-sm);padding:15px;position:relative}
.ben-v2 .ed+.ed{margin-top:12px}
.ben-v2 .rng{-webkit-appearance:none;appearance:none;width:100%;height:26px;background:transparent;margin:10px 0 0;cursor:pointer}
.ben-v2 .rng:focus{outline:none}
.ben-v2 .rng::-webkit-slider-runnable-track{-webkit-appearance:none;height:8px;border-radius:999px;background:var(--surface-2);box-shadow:var(--neo-inset)}
.ben-v2 .rng::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;margin-top:-9px;border-radius:999px;background:#fff;box-shadow:0 3px 10px rgba(20,33,61,.3),inset 0 0 0 5px var(--guinda)}
.ben-v2 .rng::-moz-range-track{height:8px;border-radius:999px;background:var(--surface-2)}
.ben-v2 .rng::-moz-range-thumb{width:26px;height:26px;border:none;border-radius:999px;background:#fff;box-shadow:0 3px 10px rgba(20,33,61,.3),inset 0 0 0 5px var(--guinda)}
.ben-v2 .pctbox{flex:1;min-width:0;background:var(--surface-2);box-shadow:var(--neo-inset);border-radius:14px;height:46px;display:flex;align-items:center;justify-content:center;gap:3px}
.ben-v2 .pctbox input{width:62px;border:none;background:transparent;outline:none;font-family:inherit;font-size:calc(22px * var(--text-scale,1));font-weight:900;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.02em;padding:0}
.ben-v2 .pctbox em{font-size:calc(15px * var(--text-scale,1));font-weight:800;color:var(--ink-3);font-style:normal}
.ben-v2 .confirm{display:flex;align-items:center;gap:9px;background:var(--bad-bg);border-radius:14px;padding:10px 11px;margin-top:11px}
.ben-v2 .confirm span{flex:1;font-size:calc(12.5px * var(--text-scale,1));font-weight:700;color:var(--bad);line-height:1.35}
.ben-v2 .revtot{display:flex;justify-content:space-between;align-items:baseline;padding:14px 16px;background:var(--surface-2);font-weight:800}
.ben-v2 .sheetpad{position:absolute;inset:0;background:rgba(20,33,61,.5);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .22s;z-index:30}
.ben-v2 .sheetpad.open{opacity:1;pointer-events:auto}
.ben-v2 .phone.sheeting .bar{visibility:hidden}
.ben-v2 .sheet{position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:26px 26px 0 0;padding:10px 20px calc(20px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .32s cubic-bezier(.32,.72,0,1);max-height:88%;overflow:auto;box-shadow:0 -18px 40px -14px rgba(20,33,61,.3)}
.ben-v2 .sheetpad.open .sheet{transform:none}
.ben-v2 .grab{width:42px;height:4px;border-radius:999px;background:var(--surface-2);margin:2px auto 14px}
.ben-v2 .stit{font-size:calc(17px * var(--text-scale,1));font-weight:800;letter-spacing:-.01em}
.ben-v2 .opt{display:flex;align-items:center;gap:12px;width:100%;border:none;cursor:pointer;font-family:inherit;background:var(--surface-2);border-radius:14px;padding:13px 14px;text-align:left;font-size:calc(14.5px * var(--text-scale,1));font-weight:700;color:var(--ink)}
.ben-v2 .opt+.opt{margin-top:8px}
.ben-v2 .opt[aria-pressed="true"]{background:var(--guinda);color:#fff;box-shadow:var(--glow)}
.ben-v2 .paper{background:#fff;border-radius:14px;box-shadow:var(--neo-inset);padding:8px;height:140px;display:grid;place-items:center}
.ben-v2 .paper svg{width:100%;height:100%}
.ben-v2 .canvaswrap{position:relative;background:#fff;border-radius:16px;box-shadow:var(--neo-inset);overflow:hidden;touch-action:none}
.ben-v2 .canvaswrap canvas{display:block;width:100%;height:200px;touch-action:none;cursor:crosshair}
.ben-v2 .canvaswrap .guia{position:absolute;left:18px;right:18px;bottom:52px;border-bottom:1.5px dashed var(--ink-4);pointer-events:none}
.ben-v2 .canvaswrap .hint{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:calc(12px * var(--text-scale,1));font-weight:700;color:var(--ink-4);pointer-events:none;transition:opacity .2s}
.ben-v2 .canvaswrap.trazando .hint,.ben-v2 .canvaswrap.trazando .guia{opacity:0}
.ben-v2 .sign.tocable{cursor:pointer;border:1.5px dashed transparent;transition:background .16s}
.ben-v2 .sign.tocable:active{background:var(--guinda-50)}
.ben-v2 .sign.pend{border-color:var(--ink-4);background:var(--surface)}
.ben-v2 .toast{position:absolute;left:50%;bottom:86px;transform:translate(-50%,16px);background:var(--ink);color:#fff;font-size:calc(13.5px * var(--text-scale,1));font-weight:700;padding:12px 18px;border-radius:14px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:40;max-width:88%;text-align:center}
.ben-v2 .toast.on{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){.ben-v2 *{transition:none!important;animation:none!important}}

`;
 const BEN_COLORS=['#910022','#1B6CA8','#13794A','#8A5A00','#6A3FA0','#B3261E'];
 const benColor=i=>BEN_COLORS[i%BEN_COLORS.length];
 const benMoney=n=>n==null||!Number.isFinite(n)?'No disponible':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
 const benProjection=(balance,pct)=>balance==null?null:balance*Number(pct)/100;
 const benTotal=rows=>rows.reduce((n,r)=>n+Math.round((Number(r.percentage)||0)*100),0);
 const benIcon=(name,size=18)=>name==='edit'?h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.1,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Z'}),h('path',{d:'m14.5 5.5 4 4'})):h(window.Icon,{name,size,'aria-hidden':true});
 const benInitials=name=>name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'—';
 // Styles copied from the approved HTML, scoped to this flow. Sizing follows the
 // existing text-scale preference; the standalone phone frame is not reproduced.
 const BEN_RESPONSIVE=`
 .ben-v2{position:absolute;inset:0;z-index:20;width:100%;height:100%;max-width:none;border-radius:0;box-shadow:none;background:var(--bg);color:var(--ink);font-family:var(--font);display:flex;flex-direction:column;overflow:hidden}
 .ben-v2 .top{padding-top:calc(15px + env(safe-area-inset-top))}.ben-v2 .scroll{min-height:0;overscroll-behavior:contain}.ben-v2 .pad{padding-bottom:24px}.ben-v2 .bar{gap:8px;flex-wrap:wrap}.ben-v2 .bar .btn{flex:1;min-width:0}
 .ben-v2 button,.ben-v2 input[type=range]{min-height:44px}.ben-v2 .top button,.ben-v2 .icobtn{min-width:44px;min-height:44px}.ben-v2 .btn{height:auto;min-height:52px;padding:12px;white-space:normal;line-height:1.35}.ben-v2 .tag{min-height:44px}
 .ben-v2 .pname,.ben-v2 .stit,.ben-v2 .money,.ben-v2 .money-hint{overflow-wrap:anywhere}.ben-v2 .prow{flex-wrap:wrap}.ben-v2 .pamt{max-width:100%}.ben-v2 .pamt .m{overflow-wrap:anywhere}.ben-v2 .edhead b{white-space:normal;overflow:visible}.ben-v2 .confirm{flex-wrap:wrap}.ben-v2 .confirm span{flex-basis:100%}
 .ben-v2 .pctbox{height:auto;min-height:46px;padding:8px}.ben-v2 .pctbox input{width:5ch;max-width:100%;font-size:calc(22px * var(--text-scale,1))}.ben-v2 fieldset.ed{border:0;margin:0 0 12px;min-width:0}.ben-v2 .field{min-width:0}.ben-v2 .sign{width:100%;border:0;text-align:left;font:inherit;color:inherit}.ben-v2 .sign.pend{border:1.5px dashed var(--ink-4)}
 .ben-v2 .sheetpad{position:absolute;display:flex;align-items:flex-end}.ben-v2 .sheet{position:relative;transform:none;width:100%;max-height:90%;padding-bottom:calc(20px + env(safe-area-inset-bottom))}.ben-v2 .sheet-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}.ben-v2 .sheet-head .stit{flex:1}.ben-v2 .detail-grid{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.ben-v2 .detail-grid>div{flex:1;min-width:120px;background:var(--surface-2);border-radius:16px;padding:13px}.ben-v2 .detail-grid strong{display:block;font-size:calc(24px * var(--text-scale,1));overflow-wrap:anywhere}.ben-v2 .detail-grid small{font-size:calc(11px * var(--text-scale,1))}
 .ben-v2 :focus-visible{outline:3px solid var(--guinda);outline-offset:3px}.ben-v2 .top :focus-visible{outline-color:white}.ben-v2 .consent{display:flex;gap:10px;align-items:flex-start;line-height:1.5;margin:16px 0}.ben-v2 .consent input{min-width:24px;min-height:24px}.ben-v2 .sign .thumb img{width:100%;height:100%;object-fit:contain}.ben-v2 .foot{font-size:calc(11.5px * var(--text-scale,1))}
 .ben-v2 .sav-retry{background:var(--guinda);min-height:44px}.ben-v2 .split{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--surface-2);gap:2px;margin-top:15px}.ben-v2 .split i{min-width:0}.ben-v2 .legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;font-size:calc(11px * var(--text-scale,1))}.ben-v2 .legend span{display:flex;gap:5px;align-items:center}.ben-v2 .legend b{width:8px;height:8px;border-radius:50%;flex-shrink:0}
 .ben-v2 .sheet{animation:benSheetIn .28s cubic-bezier(.32,.72,0,1) both}@keyframes benSheetIn{from{transform:translateY(100%)}to{transform:none}}
 @media(min-width:700px){.ben-v2 .scroll>.pad,.ben-v2 .doc,.ben-v2>.bar,.ben-v2>.top,.ben-v2 .sheet{width:min(100%,560px);margin-left:auto;margin-right:auto}.ben-v2>.top{width:100%;padding-left:max(18px,calc((100% - 524px)/2));padding-right:max(18px,calc((100% - 524px)/2))}}
 @media(prefers-reduced-motion:reduce){.ben-v2 *{animation:none!important;transition:none!important}}
 `;
 function BenDistribution({rows,hero=false}){
  const remaining=Math.max(0,10000-benTotal(rows))/100;
  return h(React.Fragment,null,h('div',{className:hero?'rail':'split','aria-hidden':true},rows.map((r,i)=>h('i',{key:i,style:{flexGrow:Math.max(0,Number(r.percentage)||0),flexBasis:0,background:hero?undefined:benColor(i)}})),remaining>0&&h('i',{className:'rest',style:{flexGrow:remaining,flexBasis:0,background:hero?undefined:'#dfe4ee'}})),!hero&&h('div',{className:'legend'},rows.map((r,i)=>h('span',{key:i},h('b',{style:{background:benColor(i)}}),(r.full_name.trim().split(/\s+/)[0]||'Sin nombre')+' · '+(Number(r.percentage)||0)+'%')),remaining>0&&h('span',null,'Sin asignar · '+remaining+'%')));
 }
 function BenSheet({title,onClose,children}){
  const ref=useRef(null),close=useRef(onClose);close.current=onClose;
  React.useEffect(()=>{const previous=document.activeElement,el=ref.current,overlay=el.parentElement;const siblings=[...overlay.parentElement.children].filter(node=>node!==overlay).map(node=>[node,node.inert]);siblings.forEach(([node])=>{node.inert=true;});el.focus();return()=>{siblings.forEach(([node,inert])=>{node.inert=inert;});if(previous&&previous.isConnected)previous.focus();};},[]);
  function keyboard(e){if(e.key==='Escape'){e.stopPropagation();close.current();}if(e.key==='Tab'){const controls=[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(x=>x.getClientRects().length);if(!controls.length){e.preventDefault();return;}const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus();}}}
  return h('div',{className:'sheetpad open',onMouseDown:e=>{if(e.target===e.currentTarget)close.current();}},h('section',{className:'sheet',role:'dialog','aria-modal':true,'aria-label':title,tabIndex:-1,ref,onKeyDown:keyboard},h('div',{className:'grab'}),h('div',{className:'sheet-head'},h('h2',{className:'stit',style:{margin:0}},title),h('button',{type:'button',className:'icobtn','aria-label':'Cerrar',onClick:onClose},benIcon('close'))),children));
 }
 function BenRow({row,index,balance,onClick,signatureText}){
  return h(onClick?'button':'div',{type:onClick?'button':undefined,className:'prow',onClick},h('span',{className:'edge',style:{background:benColor(index)}}),h('span',{className:'av',style:{background:benColor(index)}},benInitials(row.full_name)),h('span',{style:{flex:1,minWidth:90}},h('span',{className:'pname'},row.full_name),h('span',{className:'prel'},row.relationship||'Parentesco por confirmar',signatureText&&h('span',{className:'firm'},signatureText))),h('span',{className:'pamt'},h('span',{className:'n',style:{color:benColor(index)}},Number(row.percentage)+'%'),h('span',{className:'m'},benMoney(benProjection(balance,row.percentage)))),onClick&&benIcon('chevR'));
 }
 function SavingsBeneficiariesExperience({state,balanceView,onClose,onSaved}){
  const [editing,setEditing]=useState(false),[detail,setDetail]=useState(null),ref=useRef(null);
  React.useEffect(()=>{const previous=document.activeElement;ref.current?.focus();return()=>{if(previous&&previous.isConnected)previous.focus();};},[editing]);
  const data=state.data,rows=data?data.beneficiaries:[],balance=balanceView.value;
  const signatures=data?data.signatures:[],stored=signatures.filter(s=>s.status==='STORED'&&s.path).length;
  // The RPC exposes version documents, not a per-person signature mapping.
  const signatureText=stored?'Firma de designación disponible':'Falta firma';
  if(editing)return h(SavingsBeneficiariesForm,{beneficiaries:editing.beneficiaries,versionId:editing.version_id,balance,onSaved,onClose:()=>setEditing(false)});
  const remaining=(10000-benTotal(rows))/100;
  return h('section',{className:'ben-v2',ref,tabIndex:-1,'aria-label':'Beneficiarios','data-beneficiaries-v2':'summary'},h('style',null,BENEFICIARY_CSS+BEN_RESPONSIVE),h('header',{className:'top'},h('button',{type:'button',onClick:onClose,'aria-label':'Volver a Ahorro'},benIcon('arrowL')),h('div',null,h('h1',null,'Beneficiarios'),h('div',{className:'sub'},'Quién cobra tu ahorro'))),
   h('main',{className:'scroll'},h('div',{className:'doc'},h('div',{className:'seal'},h('svg',{width:150,height:150,viewBox:'0 0 100 100',fill:'none',stroke:'#fff',strokeWidth:1.6,'aria-hidden':true},h('circle',{cx:50,cy:50,r:46}),h('circle',{cx:50,cy:50,r:37}),h('path',{d:'M50 13v74M13 50h74'}))),h('div',{className:'k'},'TU AHORRO ACTUAL'),h('div',{className:'money','data-beneficiaries-balance':balance==null?'':balance},balanceView.label),h('div',{className:'note'},'Estimación con tu saldo actual y los porcentajes que tú decidas.'),state.phase==='ready'&&h(React.Fragment,null,h(BenDistribution,{rows,hero:true}),h('div',{className:'veredicto'},benIcon(remaining===0?'check':'info'),remaining===0?'Repartido al 100% entre '+rows.length+(rows.length===1?' persona':' personas'):'Falta repartir '+remaining+'% · '+benMoney(benProjection(balance,remaining))))),
    h('div',{className:'pad'},state.phase==='loading'&&h('p',{role:'status'},'Consultando tus beneficiarios…'),state.phase==='error'&&h('div',null,h('p',{role:'alert'},state.error),h('button',{className:'btn pri block',onClick:state.retry},'Reintentar')),
     state.phase==='ready'&&h(React.Fragment,null,h('div',{className:'sh'},h('b',null,'QUIÉN COBRA Y CUÁNTO'),h('s',null,'proyección actual')),rows.length?h('div',{className:'list','data-savings-beneficiaries':''},rows.map((row,index)=>h(BenRow,{key:row.id,row,index,balance,signatureText,onClick:()=>setDetail({row,index})}))):h('div',{className:'empty'},h('div',{className:'ic'},benIcon('users',26)),h('b',null,'Nadie designado todavía'),h('s',null,'No hay beneficiarios registrados.')),
      data.pending_count>0&&h('div',{className:'state warn',role:'status',style:{marginTop:16}},'Hay registros anteriores pendientes de revisión que no forman parte de tu distribución vigente.'),h('div',{className:'foot'},benIcon('info',14),h('span',null,'Los importes son proyecciones sobre el saldo actual, no cantidades futuras garantizadas. El cambio sustituye la designación vigente y conserva su historia.'))))),
   state.phase==='ready'&&data.can_edit&&h('footer',{className:'bar'},h('button',{className:'btn pri block',onClick:()=>setEditing(data)},benIcon('edit'),'Cambiar beneficiarios')),
   detail&&h(BenSheet,{title:detail.row.full_name,onClose:()=>setDetail(null)},h('div',{className:'prel'},detail.row.relationship||'Parentesco por confirmar'),h('div',{className:'detail-grid'},h('div',null,h('small',null,'LE CORRESPONDE'),h('strong',{style:{color:benColor(detail.index)}},Number(detail.row.percentage)+'%')),h('div',null,h('small',null,'RECIBIRÍA HOY · ESTIMACIÓN'),h('strong',null,benMoney(benProjection(balance,detail.row.percentage))))),h('div',{className:'state '+(stored?'ok':'warn')},signatureText),h('p',null,'Documentos de firma de esta designación. No acreditan la aceptación individual del beneficiario.'),h(SavingsBeneficiarySignatures,{signatures}),h('button',{className:'btn sec block',onClick:()=>setDetail(null)},'Cerrar detalle')));
 }
 function SavingsBeneficiariesForm({beneficiaries,versionId,onSaved,onClose,balance}){
  const [rows,setRows]=useState(()=>beneficiaries?.length?beneficiaries.map(x=>({full_name:x.full_name,relationship:x.relationship||'',percentage:String(x.percentage)})):[{full_name:'',relationship:'',percentage:'100'}]);
  const [busy,setBusy]=useState(false),[review,setReview]=useState(false),[error,setError]=useState(''),[signature,setSignature]=useState(''),[accepted,setAccepted]=useState(false),[signatureRevision,setSignatureRevision]=useState(0),[saved,setSaved]=useState(false);
  const [remove,setRemove]=useState(null),[signing,setSigning]=useState(false),[cancel,setCancel]=useState(false),[stroke,setStroke]=useState('');
  const heading=useRef(null),scroll=useRef(null);
  React.useEffect(()=>{heading.current?.focus();scroll.current?.scrollTo(0,0);},[review,saved]);
  const lock=useRef(false),attempt=useRef();
  function reset(){setReview(false);setError('');setSignature('');setAccepted(false);setSignatureRevision(v=>v+1);attempt.current=null;}
  const update=(i,k,v)=>{setRows(a=>a.map((r,n)=>n===i?{...r,[k]:v}:r));reset();};
  const cents=rows.reduce((n,r)=>n+Math.round(Number(r.percentage)*100),0);
  const valid=rows.length>0&&rows.length<=20&&cents===10000&&rows.every(r=>r.full_name.trim().length>=3&&r.full_name.trim().length<=180&&(!r.relationship.trim()||r.relationship.trim().length>=2&&r.relationship.trim().length<=80)&&/^\d+(\.\d{1,2})?$/.test(r.percentage)&&Number(r.percentage)>0&&Number(r.percentage)<=100);
  async function submit(e){e.preventDefault();if(e.nativeEvent&&e.nativeEvent.submitter&&e.nativeEvent.submitter.getAttribute('data-beneficiary-submit')!=='true')return;if(lock.current||!valid||saved)return;if(!review){setReview(true);return;}if(!signature||!accepted)return;
   lock.current=true;setBusy(true);setError('');if(!attempt.current)attempt.current=crypto.randomUUID();
   try{await window.SavingsRepository.replaceBeneficiaries(rows.map(r=>({full_name:r.full_name.trim(),relationship:r.relationship.trim()||null,percentage:Number(r.percentage)})),attempt.current,{signature,accepted,versionId});setSaved(true);onSaved();}
   catch(e){setError(/IDEMPOTENCY|CHANGED|STALE/.test(String(e.message))?'Los datos cambiaron. Cierra esta propuesta y actualiza tus beneficiarios antes de intentar de nuevo.':/OVER_100|INVALID/.test(String(e.message))?'Revisa nombres y porcentajes. El total no puede superar el 100 %.':'No se pudo confirmar el guardado. Conservamos tu captura y firma para reintentar.');}
   finally{lock.current=false;setBusy(false);}
  }
  const remaining=Number.isFinite(cents)?(10000-cents)/100:100;
  const signButton=()=>h('button',{type:'button',className:'sign tocable '+(signature?'':'pend'),disabled:busy||!valid,onClick:()=>{setStroke('');setSigning(true);}},h('span',{className:'thumb'},signature?h('img',{src:signature,alt:'Firma de autorización capturada'}):benIcon('edit',22)),h('span',{style:{flex:1}},h('b',null,signature?'Firma capturada':'Firmar aquí'),h('s',null,signature?'Toca para volver a firmar':'Una firma autoriza toda la designación')),benIcon('chevR'));
  return h('section',{className:'ben-v2','data-beneficiaries-v2':saved?'saved':review?'review':'editor'},h('style',null,BENEFICIARY_CSS+BEN_RESPONSIVE),
   h('header',{className:'top'},h('button',{type:'button',disabled:busy,onClick:()=>review?setReview(false):setCancel(true),'aria-label':'Regresar'},benIcon('arrowL')),h('div',null,h('h1',{ref:heading,tabIndex:-1},saved?'Cambio registrado':review?'Revisa el cambio':'Cambiar beneficiarios'),h('div',{className:'sub'},'Reparto de '+benMoney(balance)))),
   h('form',{onSubmit:submit,'data-beneficiaries-form':'',style:{display:'contents'}},h('main',{className:'scroll',ref:scroll},h('div',{className:'pad',style:{paddingTop:16}},saved?h('div',{className:'empty',role:'status'},h('div',{className:'ic'},benIcon('check',26)),h('b',null,'Tus beneficiarios quedaron guardados'),h('s',null,'La firma y el consentimiento quedaron registrados con la nueva designación.')):h(React.Fragment,null,
    h('div',{className:'hero'},h('div',{className:'k'},'REPARTO ASIGNADO'),h('div',{className:'money',style:{fontSize:'calc(27px * var(--text-scale,1))',color:remaining===0?'var(--ok)':remaining<0?'var(--bad)':'var(--ink)'}},(Number.isFinite(cents)?cents/100:0)+'%'),h('div',{className:'note'},'de 100% · '+benMoney(benProjection(balance,Math.min(100,cents/100)))),h(BenDistribution,{rows})),
    h('div',{className:'status '+(remaining===0?'ok':remaining<0?'bad':'warn'),role:remaining<0?'alert':'status','aria-live':'polite'},h('span',{className:'ic'},benIcon(remaining===0?'check':'info')),h('div',null,h('b',null,remaining===0?'Reparto completo · 100%':remaining<0?'Te pasaste por '+(-remaining)+'%':'Falta repartir '+remaining+'%'),h('s',null,remaining<0?'La suma de los porcentajes no puede superar el 100 %.':remaining>0?benMoney(benProjection(balance,remaining))+' por asignar. Completa el reparto antes de revisar.':'Revisa nombres y porcentajes antes de confirmar.'))),
    review?h(React.Fragment,null,h('div',{className:'list'},rows.map((row,index)=>h(BenRow,{key:index,row,index,balance})),h('div',{className:'revtot'},h('span',null,'Total repartido'),h('b',null,'100%'))),h('div',{className:'state warn',style:{marginTop:16}},benIcon('info'),h('div',null,h('b',null,'Sustituye la designación anterior'),h('s',null,'La distribución vigente será reemplazada. Su registro histórico se conserva.'))),signButton(),h('label',{className:'consent'},h('input',{type:'checkbox',checked:accepted,disabled:busy||!signature,onChange:e=>{setAccepted(e.target.checked);attempt.current=null;}}),'Autorizo esta distribución de mi ahorro entre los beneficiarios indicados en caso de fallecimiento.')):
    h(React.Fragment,null,rows.length>=2&&h('button',{type:'button',className:'smart nuevo',onClick:()=>{const base=Math.floor(10000/rows.length);setRows(a=>a.map((r,i)=>({...r,percentage:String((i===a.length-1?10000-base*(a.length-1):base)/100)})));reset();}},h('span',{className:'sheen'}),h('span',{className:'ic'},benIcon('users',20)),h('span',null,h('b',null,'Repartir en partes iguales'),h('s',null,'Reparto exacto del 100%'))),
     rows.map((r,i)=>h('fieldset',{className:'ed',key:i,disabled:busy},h('div',{className:'edhead'},h('span',{className:'n',style:{background:benColor(i)}},i+1),h('b',null,r.full_name||'Beneficiario '+(i+1)),h('button',{type:'button',className:'icobtn danger','aria-label':'Quitar beneficiario '+(i+1),onClick:()=>setRemove(i)},benIcon('trash'))),
      h('label',null,h('span',{className:'lab'},'Nombre completo'),h('input',{className:'field',value:r.full_name,maxLength:180,placeholder:'Nombre como aparece en su identificación',autoComplete:'off',onChange:e=>update(i,'full_name',e.target.value)})),
      h('span',{className:'lab'},'PARENTESCO'),h('div',{className:'chips',role:'group','aria-label':'Parentesco de beneficiario '+(i+1)},['Cónyuge','Hijo(a)','Madre','Padre','Hermano(a)','Otro'].map(p=>h('button',{type:'button',className:'tag',key:p,'aria-pressed':r.relationship===p,onClick:()=>update(i,'relationship',r.relationship===p?'':p)},p))),
      r.relationship&&!['Cónyuge','Hijo(a)','Madre','Padre','Hermano(a)','Otro'].includes(r.relationship)&&h('p',{className:'prel'},'Parentesco registrado: '+r.relationship),
      h('span',{className:'lab'},'LE CORRESPONDE'),h('div',{className:'pctrow'},h('button',{type:'button',className:'step','aria-label':'Bajar 5 por ciento',disabled:Number(r.percentage)<=0,onClick:()=>update(i,'percentage',String(Math.max(0,Math.round(((Number(r.percentage)||0)-5)*100)/100)))},'−5'),h('div',{className:'pctbox'},h('input',{'aria-label':'Porcentaje',inputMode:'decimal',value:r.percentage,maxLength:6,onChange:e=>update(i,'percentage',e.target.value.replace(',','.'))}),h('em',null,'%')),h('button',{type:'button',className:'step','aria-label':'Subir 5 por ciento',disabled:Number(r.percentage)>=100,onClick:()=>update(i,'percentage',String(Math.min(100,Math.round(((Number(r.percentage)||0)+5)*100)/100)))},'+5')),
      h('input',{type:'range',className:'rng',min:0,max:100,step:0.01,value:Number(r.percentage)||0,'aria-label':'Porcentaje con deslizador',onChange:e=>update(i,'percentage',e.target.value)}),h('div',{className:'money-hint'},'Recibiría ',h('b',null,benMoney(benProjection(balance,r.percentage))),' de tu ahorro actual · estimación'),
      remaining>0&&h('div',{className:'quick'},h('button',{type:'button',className:'tag',onClick:()=>update(i,'percentage',String(Math.round(((Number(r.percentage)||0)+remaining)*100)/100))},'Darle el '+remaining+'% restante')),
      remove===i&&h('div',{className:'confirm'},h('span',null,'¿Quitar a esta persona del reparto?'),h('button',{type:'button',className:'btn sm sec',onClick:()=>setRemove(null)},'No'),h('button',{type:'button',className:'btn sm pri',onClick:()=>{setRows(a=>a.filter((_,n)=>n!==i));setRemove(null);reset();}},'Quitar')))),
     h('button',{type:'button',className:'btn sec block',disabled:busy||rows.length>=20,onClick:()=>{setRows(a=>[...a,{full_name:'',relationship:'',percentage:String(Math.max(0,remaining))}]);setRemove(null);reset();}},benIcon('plus'),rows.length>=20?'Máximo 20 beneficiarios':'Agregar beneficiario'),
     signButton()),
    h('div',{className:'foot'},benIcon('info',14),h('span',null,'Los importes son proyecciones sobre tu saldo actual. Se guardan porcentajes, no cantidades monetarias.')),
    error&&h('p',{role:'alert'},error)))),
    h('footer',{className:'bar'},saved?h('button',{type:'button',className:'btn pri block',onClick:onClose},'Entendido'):h(React.Fragment,null,h('button',{type:'button',className:'btn out',disabled:busy,onClick:()=>review?setReview(false):setCancel(true)},review?'Volver a editar':'Cancelar'),review&&!signature?h('button',{type:'button',className:'btn pri',disabled:busy||!valid,onClick:()=>{setStroke('');setSigning(true);}},'Confirmar y firmar'):h('button',{type:'submit','data-beneficiary-submit':'true',className:'btn pri',disabled:!valid||busy||review&&(!signature||!accepted)},busy?'Guardando…':review?'Confirmar beneficiarios':'Revisar cambios')))),
   signing&&h(BenSheet,{title:'Firma de autorización',onClose:()=>{setSigning(false);setStroke('');}},h('p',null,'Traza tu firma con el dedo o el mouse. Autoriza la distribución completa; no representa la firma individual de cada beneficiario.'),h(SavingsBeneficiarySignaturePad,{key:signatureRevision,value:stroke,onChange:setStroke}),h('button',{type:'button',className:'btn pri block',disabled:!stroke,onClick:()=>{setSignature(stroke);setAccepted(false);attempt.current=null;setSigning(false);setStroke('');}},'Guardar firma')),
   cancel&&h(BenSheet,{title:'¿Descartar esta propuesta?',onClose:()=>setCancel(false)},h('p',null,'La designación guardada seguirá vigente.'),h('button',{type:'button',className:'btn sec block',onClick:()=>setCancel(false)},'Seguir editando'),h('button',{type:'button',className:'btn pri block',style:{marginTop:12},onClick:onClose},'Descartar cambios')));
 }
 window.useSavingsBeneficiaries=useSavingsBeneficiaries;
 window.SavingsBeneficiarySignatures=SavingsBeneficiarySignatures;
 window.SavingsBeneficiariesExperience=SavingsBeneficiariesExperience;

 function joinDate(value){return value?new Date(value+(String(value).length===10?'T12:00:00Z':'')).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Hermosillo'}):'Por confirmar';}
 function joinReason(reason){return {IDENTITY_REVIEW:'La encargada debe revisar la vinculaci?n de tu Folio.',OPENING_REVIEW:'Tu registro anterior est? en revisi?n. La encargada debe confirmarlo antes de un nuevo ingreso.',CATEGORY_REQUIRED:'Falta confirmar tu tipo de trabajador para calcular las fechas. Comun?cate con la encargada.',INTAKE_CLOSED:'Por el momento no se reciben nuevos ingresos al ahorro.',REQUEST_PENDING:'Tu solicitud de ingreso est? pendiente de revisi?n.'}[reason]||'';}
 function SavingsJoinSchedule({rows}){return h('details',{'data-savings-join-schedule':''},h('summary',null,'Pr?ximos descuentos previstos'),h('p',null,'Proyecci?n de un a?o. No es saldo recibido y no incluye rendimientos.'),(rows||[]).map(r=>h('div',{className:'sav-row',key:r.contribution_date},h('span',null,joinDate(r.contribution_date)),h('b',null,new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(r.expected_amount)))));}
 function SavingsJoinAccess({revision,onJoin,existing}){
  const [context,setContext]=useState(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  React.useEffect(()=>{let alive=true;setContext(null);setError(false);Promise.resolve().then(()=>window.SavingsRepository.getJoinContext()).then(v=>{if(alive)setContext(v);}).catch(()=>{if(alive)setError(true);});return()=>{alive=false;};},[revision,retry]);
  if(existing&&(!context||!context.request&&!context.can_join))return error?h('p',{role:'alert'},'No se pudo consultar el registro de ingreso.',h('button',{className:'sav-retry',onClick:()=>setRetry(v=>v+1)},'Reintentar')):null;
  const request=context&&context.request,states={SUBMITTED:'Recibida',UNDER_REVIEW:'En revisi?n',APPROVED:'Aprobada',REJECTED:'Rechazada',CANCELLED:'Cancelada',APPLIED:'Aplicada'};
  if(request&&['SUBMITTED','UNDER_REVIEW'].includes(request.status))return h('section',{'data-savings-join-access':'','data-savings-join-pending':'','aria-label':'Tu solicitud de ingreso',style:{margin:existing?'12px 16px':undefined,padding:16,border:'1px solid #e4e4e8',borderRadius:17,background:'#fff',boxShadow:'0 3px 8px rgba(20,33,61,.05)',color:'var(--ink, #14213d)',fontFamily:'inherit',textAlign:'left',flexShrink:0,maxHeight:existing?'45vh':undefined,overflowY:'auto',boxSizing:'border-box'}},
   h('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
    h('h3',{style:{margin:0,flex:'1 1 140px',fontSize:14,fontWeight:800}},'Tu solicitud de ingreso'),
    h('span',{style:{padding:'5px 9px',borderRadius:999,background:'#fff1d5',color:'#9a6813',fontSize:10,fontWeight:750}},request.status==='SUBMITTED'?'Recibida':'En revisi\u00f3n')),
   h('p',{style:{margin:'10px 0 14px',fontSize:12,lineHeight:1.5,color:'var(--muted, #85858d)'}},'Tu solicitud est\u00e1 pendiente de aprobaci\u00f3n.'),
   h('div',{style:{padding:'12px 14px',borderRadius:12,background:'var(--pink, #f9edf2)'}},
    h('span',{style:{display:'block',fontSize:11,color:'var(--muted, #85858d)',fontWeight:650}},'Monto por descuento'),
    h('strong',{style:{display:'block',marginTop:3,fontSize:24,fontWeight:800,fontVariantNumeric:'tabular-nums',color:'var(--wine, #a00042)'}},new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(request.amount))),
   h('dl',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,margin:'14px 0',fontSize:11}},
    [['Registrada',joinDate(request.submitted_at)],['Primer descuento previsto',joinDate(request.effective_from)]].map(([label,value])=>h('div',{key:label},h('dt',{style:{color:'var(--muted, #85858d)',lineHeight:1.4}},label),h('dd',{style:{margin:'4px 0 0',fontWeight:750,lineHeight:1.4}},value)))),
   h('details',{'data-savings-join-schedule':'',style:{borderTop:'1px solid var(--line, #e4e4e8)',paddingTop:12,fontSize:12}},
    h('summary',{style:{cursor:'pointer',color:'var(--wine, #a00042)',fontWeight:750,lineHeight:1.5}},'Pr\u00f3ximos descuentos previstos'),
    h('p',{style:{fontSize:11,lineHeight:1.5,color:'var(--muted, #85858d)'}},'Proyecci\u00f3n de un a\u00f1o. No es saldo recibido y no incluye rendimientos.'),
    (context.upcoming||[]).map(r=>h('div',{className:'sav-row',key:r.contribution_date},h('span',null,joinDate(r.contribution_date)),h('b',null,new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(r.expected_amount))))));
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
