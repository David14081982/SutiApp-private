/* Farma additions use the existing catalog/editor/gallery and submission celebration. */
(function(){
 const h=React.createElement,{useState,useEffect,useRef}=React,R=()=>window.FarmaRepository;
 const panel={background:'var(--surface)',borderRadius:18,padding:16,boxShadow:'var(--neo-sm)',marginBottom:12};
 const field={width:'100%',boxSizing:'border-box',border:0,borderRadius:12,padding:'12px 13px',background:'var(--surface-2)',color:'var(--ink)',font:'inherit',margin:'6px 0 12px',boxShadow:'var(--neo-inset)'};
 function useRows(kind){
  const [state,set]=useState({phase:'loading',rows:[]}),revision=useRef(0),epoch=window.PrivateResourceDemand.useContext();
  const load=()=>{const n=++revision.current;set(s=>({epoch,phase:'loading',rows:s.epoch===epoch?s.rows:[]}));return R()[kind]().then(rows=>{if(n===revision.current)set({epoch,phase:'ready',rows});},()=>{if(n===revision.current)set({epoch,phase:'error',rows:[]});});};
  useEffect(()=>{load();const refresh=()=>{if(!document.hidden)load();};window.addEventListener('suti:farma-changed',refresh);window.addEventListener('focus',refresh);const timer=setInterval(refresh,30000);return()=>{revision.current++;clearInterval(timer);window.removeEventListener('suti:farma-changed',refresh);window.removeEventListener('focus',refresh);};},[kind,epoch]);
  return {...(state.epoch===epoch?state:{phase:'loading',rows:[]}),retry:load};
 }
 function Failure({retry}){return h('div',{role:'alert',style:panel},h('p',null,'No pudimos consultar Suti Farma.'),h(window.Btn,{variant:'outline',onClick:retry},'Reintentar'));}
 function FarmaRequest({item,app}){
  const [open,setOpen]=useState(false),[contact,setContact]=useState(null),[phone,setPhone]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(null);
  const key=useRef(null),sending=useRef(false),epoch=window.PrivateResourceDemand.useContext();
  useEffect(()=>{setOpen(false);setSent(null);setContact(null);setBusy(false);setError('');sending.current=false;key.current=null;},[epoch,item.id]);
  const load=async()=>{const context=window.PrivateResourceDemand.context();setOpen(true);setError('');setContact(null);try{const c=await R().contact();if(context!==window.PrivateResourceDemand.context())return;setContact(c);setPhone(c.phone||'');}catch(e){setError(R().message(e));}};
  const submit=async()=>{if(sending.current)return;const context=window.PrivateResourceDemand.context();sending.current=true;setBusy(true);setError('');try{key.current=key.current||crypto.randomUUID();const result=await R().submit({item_id:item.id,phone,idempotency_key:key.current});if(context!==window.PrivateResourceDemand.context())return;setSent(result);}catch(e){setError(R().message(e));}finally{sending.current=false;setBusy(false);}};
  if(sent)return h(window.RequestSubmissionSuccess,{app,fullScreen:true,kind:'farma',subject:[sent.product.name,sent.product.presentation].filter(Boolean).join(' · '),folio:sent.folio,workflowState:R().workflow(sent),destination:sent.existing?'Ya tienes una solicitud abierta para este medicamento. Puedes seguirla en Mi Historial.':'Tu solicitud llegó al área de Suti Farma.',onBack:()=>{setSent(null);setOpen(false);}});
  return h('section',{'data-farma-request':true,style:{marginTop:18}},
   h(window.Btn,{full:true,size:'lg',icon:'plus',onClick:load,style:{height:'auto',minHeight:54,whiteSpace:'normal',padding:'12px 16px'}},'Solicitar '+item.nombre),
   open&&h(window.Sheet,{open,onClose:()=>{if(!busy)setOpen(false);},title:'Solicitar '+item.nombre},
    h('div',{style:{padding:16}},h('h3',null,item.nombre),h('p',null,item.presentation_raw||''),
     contact?h(React.Fragment,null,h('p',null,h('strong',null,contact.name),h('br'), 'Número de control: '+contact.numero_control),h('label',null,'Teléfono de contacto',h('input',{'data-farma-phone':true,type:'tel',inputMode:'tel',maxLength:10,value:phone,disabled:busy,onChange:e=>setPhone(e.target.value.replace(/\D/g,'')),style:field})),h('p',{style:{fontSize:13,color:'var(--ink-2)'}},'Usaremos este teléfono de tu registro de afiliación para brindarte atención personalizada. Donación sujeta a disponibilidad y confirmación de Suti Farma.'),h(window.Btn,{'data-farma-submit':true,full:true,disabled:busy||!/^\d{10}$/.test(phone),onClick:submit},busy?'Enviando…':'Confirmar solicitud')):h('p',null,error?'No se pudo cargar tu contacto.':'Cargando tus datos…'),
     error&&h('p',{role:'alert'},error),!contact&&error&&h(window.Btn,{onClick:load},'Reintentar'))));
 }
 function FarmaStockFields({draft,set}){return h('div',{'data-farma-stock-fields':true,style:panel},h(window.Badge,{tone:'green'},'Donación'),
  h('label',{style:{display:'block',marginTop:12}},'Presentación',h('input',{'data-farma-presentation':true,value:draft.presentation_raw||'',maxLength:240,onChange:e=>set('presentation_raw',e.target.value),style:field})),
  h('label',null,'Existencias (solo administración)',h('input',{'data-farma-stock':true,type:'number',min:0,max:1000000,step:1,value:draft.farmaQuantity??draft.farmaInventory?.quantity??0,onChange:e=>set('farmaQuantity',e.target.value===''?'':Number(e.target.value)),style:field})),
  h('label',null,'Unidad',h('select',{'data-farma-unit':true,value:draft.farmaUnit||draft.farmaInventory?.unit||'caja',onChange:e=>set('farmaUnit',e.target.value),style:field},h('option',{value:'caja'},'Caja'),h('option',{value:'frasco'},'Frasco'))));}
 function RequestCard({row,onOpen}){return h('button',{'data-farma-request-id':row.id,onClick:()=>onOpen(row),style:{...panel,width:'100%',border:0,font:'inherit',textAlign:'left',cursor:'pointer',color:'var(--ink)'}},h('div',{style:{display:'flex',justifyContent:'space-between',gap:10}},h('strong',null,row.product.name),h(window.Badge,{tone:row.status==='delivered'?'green':'amber'},R().states[row.status])),h('p',{style:{margin:'8px 0',fontSize:13}},row.product.presentation),h('div',{style:{fontSize:12,color:'var(--ink-3)'}},row.folio+' · '+new Date(row.created_at).toLocaleString('es-MX')));}
 function Detail({row,admin,onClose,onUpdated}){
  const [status,setStatus]=useState(''),[quantity,setQuantity]=useState(1),[note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),sending=useRef(false),key=useRef(null);
  const transitions={received:['in_progress','unavailable','cancelled'],in_progress:['ready','unavailable','cancelled'],ready:['delivered','unavailable','cancelled']};
  const options=transitions[row.status]||[];
  const submit=async()=>{if(sending.current)return;sending.current=true;setBusy(true);setError('');key.current=key.current||crypto.randomUUID();try{const updated=await R().transition({request_id:row.id,version:row.version,status,quantity,note,action_id:key.current});setStatus('');setNote('');key.current=null;onUpdated(updated);}catch(e){setError(R().message(e));}finally{sending.current=false;setBusy(false);}};
  return h(window.Sheet,{open:true,onClose:()=>{if(!busy)onClose();},title:'Solicitud Suti Farma'},h('div',{'data-farma-detail':true,style:{padding:16}},
   h('h3',null,row.product.name),h('p',null,row.product.presentation),h('p',{style:{overflowWrap:'anywhere'}},row.folio),h(window.Badge,{tone:'green'},R().states[row.status]),
   h('p',null,h('strong',null,row.contact.name),h('br'),'Número de control: '+row.contact.numero_control,h('br'),'Teléfono: '+row.contact.phone),
   admin&&h('div',{style:{display:'flex',gap:12,marginBottom:16}},h('a',{href:'tel:'+row.contact.phone},'Llamar'),h('a',{href:'https://wa.me/52'+row.contact.phone,target:'_blank',rel:'noopener noreferrer'},'Abrir WhatsApp')),
   h('h4',null,'Seguimiento'),h('ol',null,row.events.map(e=>h('li',{key:e.id,style:{marginBottom:12}},R().states[e.status]||e.action,' · ',new Date(e.created_at).toLocaleString('es-MX'),admin&&e.note&&h('p',null,e.note)))),
   row.delivered_quantity&&h('p',null,'Cantidad entregada: '+row.delivered_quantity),
   admin&&options.length>0&&h(React.Fragment,null,h('label',null,'Actualizar atención',h('select',{'data-farma-status':true,value:status,disabled:busy,onChange:e=>{setStatus(e.target.value);key.current=null;},style:field},h('option',{value:''},'Selecciona una acción'),options.map(value=>h('option',{key:value,value},R().states[value])))),
    status==='delivered'&&h('label',null,'Cantidad entregada',h('input',{'data-farma-delivery-quantity':true,type:'number',min:1,step:1,value:quantity,disabled:busy,onChange:e=>setQuantity(Number(e.target.value)),style:field})),
    h('label',null,'Nota interna',h('textarea',{value:note,disabled:busy,maxLength:2000,onChange:e=>setNote(e.target.value),style:field})),
    h(window.Btn,{'data-farma-transition':true,full:true,disabled:busy||!status,onClick:submit},busy?'Guardando…':status==='delivered'?'Registrar entrega y descontar existencias':'Guardar atención')),
   error&&h('p',{role:'alert'},error)));
 }
 function FarmaHistory(){const data=useRows('mine'),[selected,setSelected]=useState(null);if(data.phase==='error')return h('div',{style:{padding:16}},h(Failure,{retry:data.retry}));if(!data.rows.length)return null;return h('section',{'data-farma-history':true,style:{padding:16}},h(window.SectionHead,{title:'Mis solicitudes Suti Farma'}),data.rows.map(row=>h(RequestCard,{key:row.id,row,onOpen:setSelected})),selected&&h(Detail,{row:data.rows.find(r=>r.id===selected.id)||selected,onClose:()=>setSelected(null)}));}
 function FarmaAdmin({app,onBack,header,catalogEntry=false}){
  const [tab,setTab]=useState(catalogEntry?'Medicamentos':'Solicitudes'),[filter,setFilter]=useState('open'),[selected,setSelected]=useState(null),data=useRows('queue');
  useEffect(()=>{const id=new URLSearchParams(location.search).get('farma_request');if(id&&data.phase==='ready'){const row=data.rows.find(r=>r.id===id);if(row){setSelected(row);setTab('Solicitudes');const url=new URL(location.href);url.searchParams.delete('farma_request');history.replaceState(history.state,'',url);}}},[data.phase,data.rows]);
  const adminApp={...app,admin:{...app.admin,has:window.AdminRepository.has}};
  const open=data.rows.filter(r=>['received','in_progress','ready'].includes(r.status));
  const rows=filter==='all'?data.rows:filter==='open'?open:data.rows.filter(r=>r.status===filter);
  return h('div',{'data-farma-admin':true},header({title:'Suti Farma',sub:open.length+' solicitudes pendientes',onBack}),
   h(window.ChipBar,{items:catalogEntry?['Medicamentos','Solicitudes','Información general']:['Solicitudes','Medicamentos'],value:tab,onChange:setTab,style:{padding:16}}),
   tab==='Medicamentos'&&h(window.ProgramProductsModule,{app:adminApp,scopedProgram:'farma',onBack,header:()=>null}),
   tab==='Información general'&&h('div',{style:{padding:16}},h(window.ProgramGeneralInfo.Editor,{programKey:'farma',canWrite:window.AdminRepository.has('workflow.write')})),
   tab==='Solicitudes'&&h('div',{style:{padding:16}},h(window.RequestPushInvitation,{farma:true}),h('label',null,'Solicitudes',h('select',{value:filter,onChange:e=>setFilter(e.target.value),style:field},h('option',{value:'open'},'Pendientes'),h('option',{value:'all'},'Todas'),Object.entries(R().states).map(([value,label])=>h('option',{key:value,value},label)))),h(window.Btn,{variant:'outline',onClick:data.retry},'Actualizar'),
    data.phase==='error'?h(Failure,{retry:data.retry}):data.phase==='loading'&&!data.rows.length?h('p',null,'Cargando solicitudes…'):!rows.length?h(window.EmptyState,{icon:'receipt',title:'Sin solicitudes',sub:'Las solicitudes de medicamentos aparecerán aquí.'}):rows.map(row=>h('div',{key:row.id},h('p',{style:{fontSize:13}},row.contact.name),h(RequestCard,{row,onOpen:setSelected})))),
   selected&&h(Detail,{key:selected.id,row:data.rows.find(r=>r.id===selected.id)||selected,admin:true,onClose:()=>setSelected(null),onUpdated:setSelected}));
 }
 Object.assign(window,{FarmaRequest,FarmaStockFields,FarmaHistory,FarmaAdmin});
})();
