/* Hybrid request projection: Supabase owns requests; Google owns financial processing. */
(function () {
  const {useEffect,useState}=React;
  const listeners=new Set();let rows=[],phase='idle',error=null,promise=null;
  const ESTADOS=[
    {id:'pendiente',label:'Pendiente',tone:'amber',icon:'clock',meta:'submitted'},
    {id:'revision',label:'En revisión',tone:'blue',icon:'eye',meta:'in_review'},
    {id:'aprobada',label:'Aprobada',tone:'green',icon:'checkCircle',meta:'approved'},
    {id:'depositada',label:'Depositada',tone:'guinda',icon:'check',meta:'approved'},
    {id:'rechazada',label:'Rechazada',tone:'red',icon:'close',meta:'rejected'},
    {id:'cancelada',label:'Cancelada',tone:'gray',icon:'close',meta:'cancelled'},
  ];
  const ESTADO=(id)=>ESTADOS.find((item)=>item.id===id)||ESTADOS[0];
  const emit=()=>listeners.forEach((fn)=>fn());
  function project(r){const submission=r.financial_submission_snapshot&&r.financial_submission_snapshot.financialResult||null,approval=r.financial_approval_snapshot&&r.financial_approval_snapshot.financialResult||null,result=submission||approval||{},amount=r.requested_amount!=null?Number(r.requested_amount):result.amount!=null?Number(result.amount):r.importe==null?0:Number(r.importe)*Number(r.quantity||1),adminObservations=(r.admin_events||[]).filter((event)=>event.comment).map((event)=>({texto:event.comment,actor:event.actor_label||'Personal autorizado',fechaHora:event.created_at}));return Object.freeze(Object.assign({},r,{
    estado:r.estado||'pendiente',programa:r.program_id||'',productoTipo:r.request_type==='quote'?'Cotización':'Solicitud',convenioId:r.company_id||'',destino:r.notes||'',
    simulacion:{montoSolicitado:amount,montoAutorizado:result.maxAmount==null?null:Number(result.maxAmount),plazoQuincenas:result.paymentCount==null?r.requested_term:Number(result.paymentCount),plazo:r.requested_term,paymentPeriod:result.paymentPeriod||r.requested_term_semantics||'',tasa:result.rate==null?null:Number(result.rate),ratePeriod:result.ratePeriod||'',pagoQuincenal:result.paymentPerPeriod==null?null:Number(result.paymentPerPeriod),interesTotal:result.interest==null?null:Number(result.interest),gastoAdministrativo:result.administrativeFeeTotal==null?null:Number(result.administrativeFeeTotal),totalPagar:result.total==null?null:Number(result.total),fondo:result.fund||''},
    observaciones:(r.notes?[{texto:r.notes,actor:'Solicitud',fechaHora:r.fechaHora}]:[]).concat(adminObservations),firma:r.signature_data||null,
  }));}
  async function load(force){if(promise&&!force)return promise;phase='loading';error=null;emit();promise=(async()=>{try{const all=await window.ProgramRequestRepository.listFinancialMobile();rows=all.map(project);phase='loaded';}catch(e){rows=[];phase='error';error=e;}finally{promise=null;emit();}return store;})();return promise;}
  const store={ESTADOS,ESTADO,state:()=>({phase,error}),bootstrap:()=>load(false),retry:()=>load(true),
    all:()=>rows.slice(),byEstado:(id)=>id==='all'?rows.slice():rows.filter((r)=>r.estado===id),get:(id)=>rows.find((r)=>r.id===id||r.folio===id)||null,forCompany:(id)=>rows.filter((r)=>r.company_id===id),mine:()=>rows.slice(),count:()=>rows.length,pendientes:()=>rows.filter((r)=>r.estado==='pendiente'||r.estado==='revision').length,
    loadDetail:async(id)=>{const detail=await window.ProgramRequestRepository.financialDetail(id);rows=rows.map((row)=>row.id===id?project(Object.assign({},row,detail)):row);emit();return store.get(id);},
    setEstado:async(id,status,comment)=>{if(status==='depositada'||status==='pendiente')throw new Error('FINANCIAL_LEGACY_READ_ONLY');const row=store.get(id);if(!row)throw new Error('REQUEST_NOT_FOUND');if(status==='aprobada')await window.FinancialLegacyRepository.approveRequest(row.id,String(comment||''));else {const action={revision:'MARK_IN_REVIEW',rechazada:'REJECT',cancelada:'CANCEL'}[status];if(!action)throw new Error('FINANCIAL_REQUEST_TRANSITION_INVALID');await window.ProgramRequestRepository.recordAdminAction(row.id,action,String(comment||''),window.ProgramRequestRepository.newIdempotencyKey());}await load(true);await store.loadDetail(row.id);},
    addObs:async(id,text)=>{const row=store.get(id),comment=String(text||'').trim();if(!row||comment.length<3)return;await window.ProgramRequestRepository.recordAdminAction(row.id,'COMMENT',comment,window.ProgramRequestRepository.newIdempotencyKey());await load(true);await store.loadDetail(row.id);},
    actor:()=>({name:'Área de Finanzas'}),build:()=>{throw new Error('FINANCIAL_LEGACY_READ_ONLY');},submit:()=>{throw new Error('FINANCIAL_LEGACY_READ_ONLY');},resetAll:()=>Promise.reject(new Error('NO_PRODUCTIVE_REQUEST_RESET')),
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  };
  window.FINANZAS={ESTADOS,ESTADO};window.financeStore=store;
  window.useFinanceStore=function(){const[,force]=useState(0);useEffect(()=>store.subscribe(()=>force((n)=>n+1)),[]);useEffect(()=>{store.bootstrap();},[]);return store;};
})();
