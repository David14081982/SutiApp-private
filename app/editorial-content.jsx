/* Safe renderer + approved ContentModule adapter. No HTML/JS from editorial data. */
(function(){
 'use strict';
 const R=window.EditorialRepository,store=window.adminStore,{useState,useEffect}=React;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const message=e=>String(e&&e.message||e).includes('VERSION_CONFLICT')?'Otra persona modificó esta pantalla. Recarga para revisar sus cambios.':String(e&&e.message||e).includes('FORM_CHANGED')?'El formulario cambió. Recarga antes de enviarlo.':String(e&&e.message||e).includes('DURING_IMPERSONATION')?'Finaliza la sesión de asistencia para enviar una respuesta propia.':'No se pudo completar la operación. Intenta de nuevo.';
 function useEditorial(screen,admin=false){
  const [state,setState]=useState(()=>R.snapshot(screen,admin));
  useEffect(()=>{const update=()=>{const s=R.snapshot(screen,admin);setState(s);if(s.phase==='idle')R.load(screen,admin).catch(()=>{});};const off=R.subscribe(update);update();return off;},[screen,admin]);
  return state;
 }
 function Status({state,screen,admin}){return React.createElement('div',{role:state.phase==='error'?'alert':'status',style:{padding:16,color:'var(--ink-2)'}},state.phase==='error'?'No se pudo cargar el contenido de esta pantalla.':'Cargando contenido…',state.phase==='error'&&React.createElement('button',{onClick:()=>R.load(screen,admin,true).catch(()=>{}),style:{marginLeft:10}},'Reintentar'));}
 const fieldStyle={width:'100%',boxSizing:'border-box',padding:12,border:'1px solid var(--hairline)',borderRadius:12,background:'var(--surface-2)',color:'var(--ink)',font:'inherit'};
 function EditorialForm({node,screen,version}){
  const [answers,setAnswers]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
  const id=React.useRef(crypto.randomUUID());
  const submit=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await R.submit(screen,version,node.id,answers,id.current);setSent(true);}catch(e){setError(message(e));}finally{setBusy(false);}};
  if(sent)return React.createElement('div',{role:'status'},'Respuesta enviada. Gracias.');
  return React.createElement('form',{onSubmit:submit},node.fields.map(f=>React.createElement('label',{key:f.id,style:{display:'block',marginBottom:14}},f.label+(f.required?' *':''),
   f.type==='select'?React.createElement('select',{required:f.required,value:answers[f.id]||'',onChange:e=>setAnswers({...answers,[f.id]:e.target.value}),style:fieldStyle},React.createElement('option',{value:''},'Selecciona'),f.options.map(o=>React.createElement('option',{key:o,value:o},o))):
   React.createElement(f.type==='textarea'?'textarea':'input',{type:f.type==='textarea'?undefined:f.type,required:f.required,maxLength:4000,value:f.type==='checkbox'?undefined:answers[f.id]||'',checked:f.type==='checkbox'?!!answers[f.id]:undefined,onChange:e=>setAnswers({...answers,[f.id]:f.type==='checkbox'?e.target.checked:e.target.value}),style:f.type==='checkbox'?{marginLeft:10}:fieldStyle}))),
   error&&React.createElement('p',{role:'alert'},error),React.createElement(window.Btn,{variant:'primary',type:'submit',disabled:busy},busy?'Enviando…':node.submitLabel||'Enviar'));
 }
 function EditorialNode({node,nodes,screen,version,app}){
  const children=nodes.filter(n=>n.parentId===node.id).sort((a,b)=>a.order-b.order);
  const navigate=()=>{const target=node.target;if(['home','financiera','convenios','historial','credencial'].includes(target))app.setTab(target);else app.push(target);};
  const body=node.type==='form'?React.createElement(EditorialForm,{key:node.id+':'+version,node,screen,version}):node.type==='menu'||node.type==='button'?React.createElement(window.Btn,{variant:'primary',onClick:navigate},node.label):React.createElement(React.Fragment,null,React.createElement('h3',{style:{margin:'0 0 10px'}},node.label),node.text&&React.createElement('p',{style:{whiteSpace:'pre-wrap',margin:0}},node.text));
  return React.createElement('section',{'data-editorial-node':node.id,style:{margin:'12px 16px',padding:16,borderRadius:16,background:'var(--surface)',boxShadow:'var(--neo-sm)'}},node.type==='form'&&React.createElement('h3',{style:{margin:'0 0 12px'}},node.label),body,children.map(n=>React.createElement(EditorialNode,{key:n.id,node:n,nodes,screen,version,app})));
 }
 function EditorialRegion({screen,app,builtins,wrap}){
  const state=useEditorial(screen);if(state.phase!=='ready')return React.createElement(Status,{state,screen});
  return React.createElement(React.Fragment,null,state.nodes.filter(n=>!n.parentId).sort((a,b)=>a.order-b.order).map(n=>{
   if(n.builtin&&builtins&&builtins[n.builtin])return wrap(n.id,builtins[n.builtin]());
   return React.createElement(EditorialNode,{key:n.id,node:n,nodes:state.nodes,screen,version:state.version,app});
  }));
 }
 // Pushed routes own their scroll container; attach the additive region inside it.
 // No existing node is moved or recreated. Empty configuration adds no visible UI.
 function EditorialRouteSlot({screen,app,container}){
  const [host,setHost]=useState(null);
  useEffect(()=>{const root=container.current;if(!root)return;let el=null;
   const attach=()=>{if(el&&root.contains(el))return;const scroll=root.querySelector('.su-app-scroll')||Array.from(root.querySelectorAll('*')).find(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY));if(!scroll)return;el=document.createElement('div');el.dataset.editorialSlot=screen;scroll.appendChild(el);setHost(el);};
   attach();const observer=new MutationObserver(attach);observer.observe(root,{childList:true,subtree:true});return()=>{observer.disconnect();if(el)el.remove();};
  },[screen,container]);
  return host?ReactDOM.createPortal(React.createElement(EditorialRegion,{screen,app}),host):null;
 }
 let segments=[];
 const labels=(type,values)=>(values||[]).map(v=>(segments.find(s=>s.type===type&&s.code===v)||{label:v}).label);
 const codes=(type,values)=>(values||[]).map(v=>(segments.find(s=>s.type===type&&(s.label===v||s.code===v))||{code:v}).code);
 const fromNode=(n,screen,version)=>{const a=n.audience||{};return {...clone(n),screen,_version:version,audience:{mode:a.mode||'all',sindicatos:labels('union',a.union_codes),niveles:labels('employment_category',a.employment_category_codes),cargos:labels('tag',a.tag_codes),generos:labels('gender',a.gender_codes)}};};
 const toNode=n=>{const d=clone(n),a=n.audience||{};delete d.screen;delete d._version;delete d.locked;d.audience={mode:a.mode||'all',union_codes:codes('union',a.sindicatos),employment_category_codes:codes('employment_category',a.niveles),gender_codes:codes('gender',a.generos),tag_codes:codes('tag',a.cargos)};return d;};
 let editorScreens=window.ADMIN.SCREENS;
 const states=()=>editorScreens.map(s=>R.snapshot(s.id,true)).filter(s=>s.phase==='ready');
 store.contentAll=()=>states().flatMap(s=>s.nodes.map(n=>fromNode(n,s.screen,s.version)));
 store.getNode=id=>store.contentAll().find(n=>n.id===id);
 store.contentChildren=(screen,parentId)=>{const s=R.snapshot(screen,true);return s.nodes.filter(n=>(n.parentId||null)===(parentId||null)).map(n=>fromNode(n,screen,s.version)).sort((a,b)=>a.order-b.order);};
 store.blankNode=(screen,parentId,type)=>({id:crypto.randomUUID(),screen,_version:R.snapshot(screen,true).version,parentId:parentId||null,type:type||'section',label:'',visible:true,order:Math.max(0,...R.snapshot(screen,true).nodes.filter(n=>(n.parentId||null)===(parentId||null)).map(n=>n.order))+1,audience:{mode:'all'},text:'',...(type==='menu'||type==='button'?{target:'home'}:{}),...(type==='form'?{fields:[{id:'respuesta',label:'Respuesta',type:'text',required:true}]}:{})});
 store.saveNode=async node=>{const s=R.snapshot(node.screen,true);if(s.phase!=='ready'||s.version!==node._version)throw new Error('EDITORIAL_VERSION_CONFLICT');const n=toNode(node);return R.save(node.screen,node._version,s.nodes.some(x=>x.id===n.id)?s.nodes.map(x=>x.id===n.id?n:x):[...s.nodes,n]);};
 store.removeNode=async id=>{const n=store.getNode(id);if(!n)throw new Error('EDITORIAL_NODE_MISSING');const s=R.snapshot(n.screen,true),ids=new Set([id]);let changed=true;while(changed){changed=false;s.nodes.forEach(x=>{if(ids.has(x.parentId)&&!ids.has(x.id)){ids.add(x.id);changed=true;}});}return R.save(n.screen,n._version,s.nodes.filter(x=>!ids.has(x.id)));};
 store.toggleNode=id=>{const n=store.getNode(id);return store.saveNode({...n,visible:!n.visible});};
 store.duplicateNode=id=>{const n=store.getNode(id);if(n.builtin)throw new Error('EDITORIAL_BUILTIN_CREATE_DENIED');return store.saveNode({...n,id:crypto.randomUUID(),label:n.label+' (copia)',visible:false});};
 store.reorderContent=(screen,parentId,ids)=>{
  const s=R.snapshot(screen,true),ordered=ids.map(id=>s.nodes.find(n=>n.id===id));
  if(ordered.some(n=>!n||(n.parentId||null)!==(parentId||null)))throw new Error('EDITORIAL_ORDER_INVALID');
  const ranks=new Map();let lower=0,run=[];
  const flush=upper=>{run.forEach((n,i)=>ranks.set(n.id,lower+(upper-lower)*(i+1)/(run.length+1)));run=[];};
  ordered.forEach(n=>{if(s.editableTypes.includes(n.type))run.push(n);else{flush(n.order);lower=n.order;}});flush(lower+run.length+1);
  return R.save(screen,s.version,s.nodes.map(n=>ranks.has(n.id)?{...n,order:ranks.get(n.id)}:n));
 };
 const originalCan=store.can;store.can=(action,resource)=>{if(!['secciones','menus','formularios'].includes(resource))return originalCan(action,resource);const types={secciones:'section',menus:'menu',formularios:'form'};return action==='ver'?states().length>0:states().some(s=>s.editableTypes.includes(types[resource]));};
 window.AppScreenLayout=Object.freeze({useEditorial,Status,Region:EditorialRegion,RouteSlot:EditorialRouteSlot,message,
  segmentOptions:type=>segments.filter(s=>s.type===type).map(s=>s.label),
  async loadCatalog(){const result=await Promise.all([R.catalog(),R.segments()]);editorScreens=result[0];segments=result[1];return editorScreens;}
 });
})();
