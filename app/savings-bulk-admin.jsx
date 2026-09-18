/* Savings balance confirmation in a list. Every row calls the same per-person server
   functions, with the same validations and the same audit trail; it only removes the
   need to open and close 366 files one by one. No amount is decided here: capital and
   yield come from the reviewed file and Supabase still refuses anything that does not
   match the reviewed balance. */
(function(){
 'use strict';
 const h=React.createElement,{useState,useEffect,useRef,useCallback}=React;
 const {Tarjeta,Fila,M,fmt}=window.SavingsPanelVisual;
 const money=v=>v!==''&&v!=null&&/^\d+(?:\.\d{1,2})?$/.test(String(v))&&Number.isFinite(Number(v));
 // Same split the single-file panel proposes: the yield already included, the rest as capital.
 const cents=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Math.round(Number(v)*100);
 function split(p){
  const total=cents(p.saldo_revision),y=cents(p.rendimiento);
  if(total==null||total<0)return null;
  if(total===0)return {capital:'0.00',yield:'0.00'};
  if(y==null||y<0||y>total)return null;
  return {capital:((total-y)/100).toFixed(2),yield:(y/100).toFixed(2)};
 }
 function commandFor(p){
  const s=split(p);if(!s)return null;
  const process=String(p.proceso||'').toUpperCase()==='JUB'?'JUB':String(p.proceso)==='1'?'PROCESS_1':String(p.proceso)==='3'?'PROCESS_3':'';
  const active=p.estado==='ahorrando';
  if(active&&(!process||!p.prox||!money(p.aporte)))return null;
  if(!active&&(p.inicio||p.plan_inicio)&&!process)return null;
  return {capital:Number(s.capital),yield:Number(s.yield),amount:active?Number(p.aporte):null,
   first_date:p.inicio||null,enrollment_start:p.plan_inicio||null,plan_end:p.plan_fin||null,
   next_date:active?p.prox:null,process:process||null,active,observation:'',confirmed:true};
 }
 function reason(e){
  const s=String(e&&e.message||'');
  if(/42501|DENIED/.test(s))return 'Tu cuenta no tiene permiso para confirmar saldos.';
  if(/SOURCE_UPDATE_PENDING/.test(s))return 'Tiene una lectura del archivo sin aplicar.';
  if(/REVIEW_REQUIRED/.test(s))return 'Falta marcar el expediente como revisado.';
  if(/EXACT_IDENTITY|DUPLICATE|IDENTITY/.test(s))return 'Hay que resolver su Folio antes de confirmar.';
  if(/ALREADY_CONFIRMED/.test(s))return 'Su saldo ya estaba confirmado.';
  if(/REVIEWED_BALANCE_MISMATCH|DIFFERENCE/.test(s))return 'El capital y el rendimiento no cuadran con el saldo revisado.';
  if(/PLAN_FIELDS|PLAN_END/.test(s))return 'Le faltan datos del plan (aportación, fechas o tipo de descuento).';
  if(/CONFIRMATION_FIELDS/.test(s))return 'Le faltan datos para poder confirmar.';
  if(/STALE|CHANGED|VERSION/.test(s))return 'Cambió mientras se revisaba. Actualiza la lista.';
  if(/DATE_NOT_EXPECTED/.test(s))return 'Esa fecha no corresponde a su calendario.';
  if(/timeout|fetch|network/i.test(s))return 'La consulta tardó demasiado. Vuelve a intentar.';
  return 'No se pudo completar. Vuelve a cargar la lista para ver en qué quedó este expediente.';
 }
 function SavingsBulkAdmin({app,asOf,onSaved}){
  const [offset,setOffset]=useState(0),[search,setSearch]=useState(''),[query,setQuery]=useState('');
  const [page,setPage]=useState(null),[rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(''),[done,setDone]=useState({}),[amounts,setAmounts]=useState({}),[running,setRunning]=useState(false);
  const alive=useRef(true),generation=useRef(0);
  const canApprove=app.admin.has('savings.approve'),canWrite=app.admin.has('savings.write');
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
  useEffect(()=>{const t=setTimeout(()=>{setQuery(search);setOffset(0);},300);return()=>clearTimeout(t);},[search]);

  const load=useCallback(async()=>{
   const mine=++generation.current;setLoading(true);setError('');setRows([]);
   try{
    const list=await window.SavingsPanelRepository.list({tab:'padron',search:query,filter:'todos',offset});
    if(!alive.current||generation.current!==mine)return;
    setPage(list);
    const pending=(list.rows||[]).filter(r=>r.native===false);
    const built=await Promise.all(pending.map(async row=>{
     try{
      const account=await window.SavingsPanelRepository.financial(row.id);
      const person=account&&account.context&&account.context.person||{};
      if(account.certified===true){
       const falta=(account.schedule||[]).filter(s=>s.future===false&&s.confirmed!==true);
       return falta.length?{row,person,due:falta.map(s=>({date:s.date,expected:s.expected,version:s.version})),
        balance:account.balance,state:'solo_descuentos'}:{row,person,state:'listo_confirmado'};
      }
      const update=account&&account.context&&account.context.source_update;
      const command=commandFor(person);
      if(!command)return {row,person,state:'incompleto',detail:'Le faltan datos para proponer un saldo.'};
      const preview=await window.SavingsPanelRepository.previewBalance({id:row.id,command});
      const today=account.today||asOf;
      const due=(preview.schedule||[]).filter(s=>s.date<=today);
      return {row,person,command,preview,update,due,version:account.context.source_version,
       status:account.context.record_status,state:'listo'};
     }catch(e){return {row,state:'error',detail:reason(e)};}
    }));
    if(!alive.current||generation.current!==mine)return;
    setRows(built);
    setAmounts(a=>{const next={...a};built.forEach(b=>(b.due||[]).forEach(d=>{const k=b.row.id+':'+d.date;if(next[k]==null)next[k]=Number(d.expected).toFixed(2);}));return next;});
   }catch(e){if(alive.current&&generation.current===mine)setError(reason(e));}
   finally{if(alive.current&&generation.current===mine)setLoading(false);}
  },[query,offset,asOf]);
  useEffect(()=>{load();},[load]);

  const total=item=>{
   const base=item.preview?cents(item.preview.total):item.balance?cents(item.balance.total):null;
   if(base==null)return null;
   return (base+(item.due||[]).reduce((s,d)=>s+(cents(amounts[item.row.id+':'+d.date])||0),0))/100;
  };
  const ready=item=>!done[item.row.id]&&canWrite
   &&((item.state==='listo'&&canApprove&&Number(item.preview.difference)===0&&item.preview.already_confirmed!==true)
    ||(item.state==='solo_descuentos'&&(item.due||[]).length>0))
   &&(item.due||[]).every(d=>money(amounts[item.row.id+':'+d.date]));

  async function confirm(item){
   if(busy)return;setBusy(item.row.id);
   const key=()=>crypto.randomUUID();
   try{
    if(item.state==='solo_descuentos'){
     for(const d of item.due||[])
      await window.SavingsPanelRepository.receipt({id:item.row.id,date:d.date,actual:Number(amounts[item.row.id+':'+d.date]),version:d.version||0,observation:null,key:key()});
     if(!alive.current)return;
     setDone(v=>({...v,[item.row.id]:{ok:true,total:total(item)}}));
     if(onSaved)await onSaved();
     return;
    }
    let version=item.version;
    if(item.update&&item.update.pending===true){
     await window.SavingsPanelRepository.acceptSource({id:item.row.id,updateId:item.update.id,version,key:key()});
     const after=await window.SavingsPanelRepository.financial(item.row.id);version=after.context.source_version;
    }
    const state=await window.SavingsPanelRepository.financial(item.row.id);
    if(state.context.record_status!=='RESOLVED')
     await window.SavingsPanelRepository.save({id:item.row.id,version:state.context.source_version,changes:{},status:'RESOLVED',key:key()});
    const fresh=await window.SavingsPanelRepository.previewBalance({id:item.row.id,command:item.command});
    if(Number(fresh.difference)!==0)throw Object.assign(new Error('DIFFERENCE'),{});
    await window.SavingsPanelRepository.confirmBalance({id:item.row.id,command:item.command,fingerprint:fresh.fingerprint,key:key()});
    for(const d of item.due||[])
     await window.SavingsPanelRepository.receipt({id:item.row.id,date:d.date,actual:Number(amounts[item.row.id+':'+d.date]),version:0,observation:null,key:key()});
    if(!alive.current)return;
    setDone(v=>({...v,[item.row.id]:{ok:true,total:total(item)}}));
    if(onSaved)await onSaved();
   }catch(e){if(alive.current)setDone(v=>({...v,[item.row.id]:{ok:false,detail:reason(e)}}));}
   finally{if(alive.current)setBusy('');}
  }
  async function confirmPage(){
   if(running)return;setRunning(true);
   for(const item of rows){if(!alive.current)break;if(ready(item))await confirm(item);}
   if(alive.current)setRunning(false);
  }

  const pendientes=rows.filter(ready);
  return h(Tarjeta,{title:'Confirmar saldos en lista',icon:'checkCircle'},
   h('p',{className:'svp-note'},'Cada fila confirma el saldo al corte y registra los descuentos ya vencidos, dejando a la persona en el importe que le corresponde hoy. Puedes corregir el importe recibido antes de aceptar.'),
   !canApprove&&h('p',{className:'svp-note warn'},'Tu cuenta puede consultar esta lista. Confirmar saldos requiere permiso de autorización.'),
   h('label',{className:'svp-field'},'Buscar por nombre o folio',h('input',{value:search,onChange:e=>setSearch(e.target.value),autoComplete:'off'})),
   error&&h('div',{role:'alert',className:'svp-error'},error,h('button',{type:'button',className:'svp-btn',onClick:load},'Reintentar')),
   loading&&h('p',{role:'status',className:'svp-note'},'Preparando los importes de esta página…'),
   !loading&&page&&h(React.Fragment,null,
    h('p',{className:'svp-note'},'Página de '+rows.length+' de '+page.total+' · '+pendientes.length+' lista(s) para confirmar'),
    pendientes.length>1&&h('button',{type:'button',className:'svp-btn primary full',disabled:!!busy||running,onClick:confirmPage},
     running?'Confirmando…':'Confirmar las '+pendientes.length+' filas listas'),
    rows.map(item=>{
     const r=item.row,marca=done[r.id];
     return h('article',{key:r.id,className:'svp-audit'},
      h('b',null,r.nombre||('Folio '+r.folio)),
      h('p',{className:'svp-note'},'Folio '+r.folio+(item.person&&item.person.aporte?' · '+M(item.person.aporte)+(item.person.proceso==='JUB'?' mensual':' quincenal'):'')),
      item.state==='listo_confirmado'&&h('p',{className:'svp-note'},'Su saldo ya estaba confirmado.'),
      (item.state==='incompleto'||item.state==='error')&&h('p',{className:'svp-note warn'},item.detail),
      item.state==='solo_descuentos'&&h('p',{className:'svp-note'},'Su saldo ya está confirmado; sólo faltan descuentos por registrar.'),
      (item.state==='listo'||item.state==='solo_descuentos')&&h(React.Fragment,null,
       h(Fila,{label:item.preview?'Saldo al corte':'Saldo confirmado',valor:M(item.preview?item.preview.total:item.balance&&item.balance.total)}),
       item.preview&&Number(item.preview.difference)!==0&&h('p',{className:'svp-note warn'},'No cuadra con el saldo revisado; revísalo en su expediente.'),
       (item.due||[]).map(d=>h('label',{key:d.date,className:'svp-field'},'Descuento recibido del '+fmt(d.date),
        h('input',{type:'number',min:0,step:'.01',inputMode:'decimal',value:amounts[r.id+':'+d.date]??'',
         disabled:!!busy||running||!!marca,onChange:e=>setAmounts(a=>({...a,[r.id+':'+d.date]:e.target.value}))}))),
       !(item.due||[]).length&&h('p',{className:'svp-note'},'No tiene descuentos vencidos por registrar.'),
       h(Fila,{label:'Monto final',valor:M(total(item))}),
       item.preview&&item.update&&item.update.pending===true&&h('p',{className:'svp-note'},'Aplicará también la lectura pendiente del archivo.'),
       !marca&&h('button',{type:'button',className:'svp-btn primary',disabled:!ready(item)||!!busy||running,onClick:()=>confirm(item)},
        busy===r.id?'Confirmando…':'Confirmar')),
      marca&&h('p',{className:marca.ok?'svp-success':'svp-error',role:marca.ok?'status':'alert'},
       marca.ok?('Confirmado en '+M(marca.total)):marca.detail));
    }),
    h('div',{className:'svp-actions'},
     h('button',{type:'button',className:'svp-btn',disabled:offset<=0||!!busy||running,onClick:()=>setOffset(Math.max(0,offset-20))},'Anterior'),
     h('button',{type:'button',className:'svp-btn',disabled:offset+rows.length>=page.total||!!busy||running,onClick:()=>setOffset(offset+20)},'Siguiente'))));
 }
 window.SavingsBulkAdmin=SavingsBulkAdmin;
})();
