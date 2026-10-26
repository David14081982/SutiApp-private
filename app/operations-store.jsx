/* Request history projection. Supabase workflow snapshots own every timeline. */
(function(){
  const{useState,useEffect}=React;const listeners=new Set();let rows=[],phase='idle',error=null,promise=null;const emit=()=>listeners.forEach(fn=>fn());
  function timeline(r){const state=r.workflow_state||{};return{available:state.available===true,message:state.message||'Seguimiento no disponible',activeNote:state.active_note||null,workflowName:state.workflow_name||'',workflowVersion:state.workflow_version||null,steps:(state.stages||[]).map((stage)=>({id:stage.id,label:stage.label,desc:stage.description||'',responsable:stage.responsible||'',sla:stage.sla_days,date:stage.date?new Date(stage.date).toLocaleString('es-MX'):null,done:stage.state==='done',active:stage.state==='current'}))};}
  function common(r,kind){const state=r.status||'submitted',approved=['approved','completed'].includes(state),rejected=['rejected','cancelled'].includes(state),flow=timeline(r),isLoan=kind==='loan',isQuote=kind==='quote',isProductPayment=!isLoan&&!isQuote&&r.financial_processing_status!=null&&r.requested_amount!=null;return Object.freeze({id:r.folio||r.id,sourceId:r.id,ts:new Date(r.created_at).getTime(),kind,financial:r.financial_processing_status!=null&&!r.rental&&!r.rental_start,icon:isLoan?'receipt':isQuote?'doc':isProductPayment?'cash':'cart',tipo:r.productoNombre||(isLoan?'Suti Préstamo':isQuote?'Cotización comercial':'Solicitud de beneficio'),monto:isLoan||isProductPayment?(r.requested_amount==null?r.importe:Number(r.requested_amount)):isQuote?(approved&&r.quoted_amount!=null?Number(r.quoted_amount):null):(r.importe==null?null:Number(r.importe)*Number(r.quantity||1)),estado:rejected?'rechazado':approved?'aprobado':'revision',fecha:new Date(r.created_at).toLocaleDateString('es-MX'),plazo:(isLoan||isProductPayment)&&r.requested_term&&r.requested_term_semantics?`${r.requested_term} ${r.requested_term_semantics}`:isQuote?(approved?'Cotización recibida':'Por cotizar'):(state==='requires_financial_processing'?'Revisión financiera':'Solicitud registrada'),rental:r.rental||null,subtipo:r.rental?'Renta Car · Contado':isLoan?'Préstamo':isProductPayment?'Producto vía nómina':r.empresaNombre||r.program_id||'',motivo:rejected?(r.decision_comment||'La solicitud fue cerrada por el área responsable.'):'',steps:flow.steps,workflowAvailable:flow.available,workflowMessage:flow.message,activeNote:flow.activeNote,workflowName:flow.workflowName,workflowVersion:flow.workflowVersion});}
  const requestRow=(r)=>common(r,'benefit'),quoteRow=(r)=>common(r,'quote'),loanRow=(r)=>common(r,'loan');
  let epoch=null,generation=0,revision=0,refreshAgain=false,stopWatching=null;
  function invalidate(){generation++;promise=null;rows=[];phase='idle';error=null;refreshAgain=false;emit();}
  function syncContext(){const next=window.PrivateResourceDemand.context();if(next!==epoch){epoch=next;invalidate();}return next;}
  async function load(force){
    if(syncContext()===null)return store;
    if(force){revision++;rows=[];phase='loading';error=null;emit();}
    if(promise){if(force)refreshAgain=true;return promise;}
    const version=generation,requestEpoch=epoch,requestRevision=revision;phase=rows.length?'loaded':'loading';emit();
    const pending=(async()=>{try{
      const requests=await window.PrivateResourceDemand.run('self-native-history',()=>window.ProgramRequestRepository.listHistory());
      if(syncContext()!==requestEpoch||version!==generation||requestRevision!==revision)return store;
      rows=requests.map((r)=>Object.freeze(Object.assign({},r.program_id==='prestamo'?loanRow(r):r.request_type==='quote'?quoteRow(r):requestRow(r),{requestStatus:r.status}))).sort((a,b)=>b.ts-a.ts);phase='loaded';error=null;
    }catch(e){if(version!==generation||requestRevision!==revision)return store;rows=[];phase='error';error=e;}
    finally{if(version===generation){promise=null;emit();if(refreshAgain&&listeners.size){refreshAgain=false;load(false);}}}return store;})();
    promise=pending;return pending;
  }
  function watch(){
    let needed=false;
    const refresh=(force=true)=>{needed=true;if(!document.hidden&&listeners.size){needed=false;load(force);}};
    const connect=()=>{syncContext();if(epoch!==null)refresh(false);};
    const unbind=window.PrivateResourceDemand.subscribe(connect);
    const visible=()=>{if(needed&&!document.hidden)refresh();};
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('suti:request-changed',refresh);
    // Historial and Tracking read on entry, identity change, mutation or explicit retry.
    // They do not maintain an idle timer or a second Realtime connection.
    connect();
    return()=>{unbind();document.removeEventListener('visibilitychange',visible);window.removeEventListener('suti:request-changed',refresh);};
  }
  const store={state:()=>({phase,error}),all:()=>{syncContext();return rows.slice();},load,invalidate,retry:()=>load(true),subscribe:(fn)=>{listeners.add(fn);if(listeners.size===1)stopWatching=watch();return()=>{listeners.delete(fn);if(!listeners.size&&stopWatching){stopWatching();stopWatching=null;invalidate();}}}};
  window.operationsStore=store;window.useOperationsStore=function(){const[,setV]=useState(0);useEffect(()=>store.subscribe(()=>setV(n=>n+1)),[]);return store;};
})();
