/* Request history projection. Supabase workflow snapshots own every timeline. */
(function(){
  const{useState,useEffect}=React;const listeners=new Set();let rows=[],phase='idle',error=null,promise=null;const emit=()=>listeners.forEach(fn=>fn());
  function timeline(r){const state=r.workflow_state||{};return{available:state.available===true,message:state.message||'Seguimiento no disponible',activeNote:state.active_note||null,workflowName:state.workflow_name||'',workflowVersion:state.workflow_version||null,steps:(state.stages||[]).map((stage)=>({id:stage.id,label:stage.label,desc:stage.description||'',responsable:stage.responsible||'',sla:stage.sla_days,date:stage.date?new Date(stage.date).toLocaleString('es-MX'):null,done:stage.state==='done',active:stage.state==='current'}))};}
  function common(r,kind){const state=r.status||'submitted',approved=['approved','completed'].includes(state),rejected=['rejected','cancelled'].includes(state),flow=timeline(r),isLoan=kind==='loan',isQuote=kind==='quote',isProductPayment=!isLoan&&!isQuote&&r.financial_processing_status!=null&&r.requested_amount!=null;return Object.freeze({id:r.folio||r.id,sourceId:r.id,ts:new Date(r.created_at).getTime(),kind,icon:isLoan?'receipt':isQuote?'doc':isProductPayment?'cash':'cart',tipo:r.productoNombre||(isLoan?'Suti Préstamo':isQuote?'Cotización comercial':'Solicitud de beneficio'),monto:isLoan||isProductPayment?(r.requested_amount==null?r.importe:Number(r.requested_amount)):isQuote?(approved&&r.quoted_amount!=null?Number(r.quoted_amount):null):(r.importe==null?null:Number(r.importe)*Number(r.quantity||1)),estado:rejected?'rechazado':approved?'aprobado':'revision',fecha:new Date(r.created_at).toLocaleDateString('es-MX'),plazo:(isLoan||isProductPayment)&&r.requested_term&&r.requested_term_semantics?`${r.requested_term} ${r.requested_term_semantics}`:isQuote?(approved?'Cotización recibida':'Por cotizar'):(state==='requires_financial_processing'?'Revisión financiera':'Solicitud registrada'),subtipo:isLoan?'Préstamo':isProductPayment?'Producto vía nómina':r.empresaNombre||r.program_id||'',motivo:rejected?(r.decision_comment||'La solicitud fue cerrada por el área responsable.'):'',steps:flow.steps,workflowAvailable:flow.available,workflowMessage:flow.message,activeNote:flow.activeNote,workflowName:flow.workflowName,workflowVersion:flow.workflowVersion});}
  const requestRow=(r)=>common(r,'benefit'),quoteRow=(r)=>common(r,'quote'),loanRow=(r)=>common(r,'loan');
  let epoch=null,generation=0,refreshAgain=false,stopWatching=null;
  function invalidate(){generation++;promise=null;rows=[];phase='idle';error=null;refreshAgain=false;emit();}
  function syncContext(){const next=window.PrivateResourceDemand.context();if(next!==epoch){epoch=next;invalidate();}return next;}
  async function load(force){
    if(syncContext()===null)return store;
    if(promise){if(force)refreshAgain=true;return promise;}
    const version=generation,requestEpoch=epoch;phase=rows.length?'loaded':'loading';emit();
    const pending=(async()=>{try{
      const requests=await window.ProgramRequestRepository.listHistory();
      if(syncContext()!==requestEpoch||version!==generation)return store;
      rows=requests.map((r)=>Object.freeze(Object.assign({},r.program_id==='prestamo'?loanRow(r):r.request_type==='quote'?quoteRow(r):requestRow(r),{requestStatus:r.status}))).sort((a,b)=>b.ts-a.ts);phase='loaded';error=null;
    }catch(e){if(version!==generation)return store;rows=[];phase='error';error=e;}
    finally{if(version===generation){promise=null;emit();if(refreshAgain&&listeners.size){refreshAgain=false;load(false);}}}return store;})();
    promise=pending;return pending;
  }
  function watch(){
    let channel=null;
    const refresh=()=>{if(!document.hidden&&listeners.size)load(true);};
    const connect=()=>{
      if(channel){window.SutiSupabase.getClient().removeChannel(channel);channel=null;}
      syncContext();if(epoch===null)return;
      channel=window.SutiSupabase.getClient().channel('self-request-history-'+epoch)
        .on('postgres_changes',{event:'*',schema:'public',table:'program_requests'},refresh)
        .subscribe((status)=>{if(status==='SUBSCRIBED')refresh();});
      refresh();
    };
    const unbind=window.PrivateResourceDemand.subscribe(connect);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    window.addEventListener('suti:request-changed',refresh);
    // A bounded foreground refresh also recovers a temporarily disconnected realtime channel.
    const timer=setInterval(refresh,15000);connect();
    return()=>{unbind();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('suti:request-changed',refresh);if(channel)window.SutiSupabase.getClient().removeChannel(channel);};
  }
  const store={state:()=>({phase,error}),all:()=>{syncContext();return rows.slice();},load,invalidate,retry:()=>load(true),subscribe:(fn)=>{listeners.add(fn);if(listeners.size===1)stopWatching=watch();return()=>{listeners.delete(fn);if(!listeners.size&&stopWatching){stopWatching();stopWatching=null;}}}};
  window.operationsStore=store;window.useOperationsStore=function(){const[,setV]=useState(0);useEffect(()=>store.subscribe(()=>setV(n=>n+1)),[]);return store;};
})();
