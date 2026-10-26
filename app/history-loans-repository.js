/* Own published loan history. Context memory only; backend owns authorization. */
(function(){
 'use strict';
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 const formatDate=v=>v?new Date(v.length===10?v+'T12:00:00-07:00':v).toLocaleDateString('es-MX',{timeZone:'America/Hermosillo'}):'Fecha no registrada';
 function project(data,elapsed){
  const now=Date.parse(data.server_now)+Math.max(0,elapsed),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  return data.entries.map(entry=>{
   let category=entry.category;
   if(category==='Aprobadas'&&entry.expires_at&&now>=Date.parse(entry.expires_at))category=entry.preparing?'Estado por revisar':'En pago';
   return {...entry,category,remaining:category==='Aprobadas'?Math.max(0,Date.parse(entry.expires_at)-now):null,
    schedule:(entry.schedule||[]).map((row,index,rows)=>({...row,
     state:!row.date?'Fecha por revisar':row.date>today?'Pendiente':row.amount===0?'No se descontó':typeof row.amount==='number'&&row.amount>0?'Pagada':'Importe por revisar',
     upcoming:!!row.date&&row.date>today,closure:index===rows.length-1}))};
  });
 }
 function merge(existing,data,elapsed){
  // Native workflows are independent of Google. Financial statuses still require their source.
  if(!data)return existing.filter(row=>row.kind!=='loan'&&!row.financial);
  const financial=new Set(data?data.financial_request_ids:[]),covered=new Set(data?data.covered_request_ids:[]);
  const originals=new Map(existing.map(row=>[row.sourceId,row]));
  const rows=existing.filter(row=>row.kind!=='loan'&&!row.financial&&!financial.has(row.sourceId)&&!covered.has(row.sourceId));
  for(const entry of data?project(data,elapsed):[]){
   const original=originals.get(entry.sourceId),state={'En proceso':'revision','Aprobadas':'aprobado','En pago':'en_pago','Liquidadas':'liquidada','No aprobadas':'rechazado'}[entry.category]||'por_revisar';
   rows.push({...original,id:entry.id,sourceId:entry.sourceId,historyKey:entry.key,history:entry,kind:'history',
    tipo:entry.fund,icon:original?.icon||'receipt',monto:entry.principal,estado:state,requestStatus:undefined,
    fecha:formatDate(entry.date),plazo:entry.term==null?'Plazo no registrado':entry.term+' pagos',subtipo:'',
    steps:original?.steps||[],ts:Date.parse(entry.approved_at||entry.date||'')||0});
  }
  return rows.sort((a,b)=>b.ts-a.ts);
 }
 function metrics(entry){
  const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const usable=valid(entry.total)&&entry.total>0&&valid(entry.paid_to_date);
  return {progress:usable?entry.paid_to_date/entry.total*100:null,
   balance:usable?Math.max(0,entry.total-entry.paid_to_date):null,
   overpaid:usable?Math.max(0,entry.paid_to_date-entry.total):null};
 }
 const listeners=new Set();
 let context=null,epoch=null,revision=0,pending=null,metadata=null,needed=false,bound=false,data=null,summary=null,anchor=0,phase='idle',channel=null,signaledVersion=null;
 const changed=()=>Error('HISTORY_CONTEXT_CHANGED');
 function identity(){
  const auth=window.AffiliateAuth.getState();
  if(auth.phase!=='authenticated'||!auth.session?.user?.id||!(auth.session.access_token||auth.session.session_id))return null;
  const affiliate=auth.affiliate||{},imp=auth.impersonation||affiliate._impersonation||{},admin=window.AdminRepository?.getState?.()||{};
  let sessionId=auth.session.session_id||'';
  if(!sessionId&&auth.session.access_token){try{sessionId=JSON.parse(atob(auth.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id||'';}catch(_){}}
  // Token rotation is transport state, not a different business identity. None
  // of these local guards is sent as an affiliate selector to the backend.
  return JSON.stringify([auth.session.user.id,sessionId,affiliate.id||'',affiliate.numero_control??null,
   imp.id||imp.session_id||null,admin.subjectKey||null,admin.assignment||null]);
 }
 function emit(){listeners.forEach(fn=>fn());}
 function clear(nextPhase='idle'){
  revision++;data=null;summary=null;anchor=0;phase=nextPhase;signaledVersion=null;
 }
 function syncContext(){
  const next=identity(),nextEpoch=window.PrivateResourceDemand.context();
  if(next!==context){context=next;epoch=nextEpoch;pending=null;metadata=null;needed=false;clear();stopSignal();emit();return true;}
  if(nextEpoch!==epoch){epoch=nextEpoch;revision++;pending=null;metadata=null;needed=next!==null;phase=data?'refreshing':'idle';emit();return true;}
  return false;
 }
 function view(key){
  if(!data)return null;
  if(!key)return summary;
  const entries=data.entries.filter(entry=>entry.key===key),ids=new Set(entries.map(entry=>entry.sourceId).filter(Boolean));
  return {...data,entries,covered_request_ids:data.covered_request_ids.filter(id=>ids.has(id)),financial_request_ids:data.financial_request_ids.filter(id=>ids.has(id))};
 }
 function bind(){
  if(bound)return;bound=true;
  const onContext=()=>{if(syncContext()&&listeners.size){startSignal();ensure().catch(()=>{});}};
  window.PrivateResourceDemand.subscribe(onContext);
  window.AffiliateAuth.subscribe(onContext);
  window.addEventListener('suti:request-changed',()=>refresh());
  window.addEventListener('suti:history-snapshot-changed',()=>{if(listeners.size)checkVersion();else needed=true;});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&listeners.size){if(data&&!needed)checkVersion();else ensure().catch(()=>{});}});
 }
 function denied(error){return [401,403].includes(Number(error?.context?.status||error?.status))||['UNAUTHORIZED','FORBIDDEN','AUTH_REQUIRED','HISTORY_CONTEXT_INVALID'].includes(error?.code);}
 function fail(error){
  if(denied(error)){clear('error');needed=false;stopSignal();}
  else{phase='error';needed=false;}
  emit();
 }
 function stopSignal(){
  if(!channel)return;const old=channel;channel=null;
  try{Promise.resolve(window.SutiSupabase.getClient().removeChannel(old)).catch(()=>{});}catch(_){}
 }
 function startSignal(){
  if(channel||!listeners.size||context===null)return;
  const owner=context;
  channel=window.SutiSupabase.getClient().channel('own-history-publication').on('postgres_changes',
   {event:'UPDATE',schema:'public',table:'loan_history_publication',filter:'id=eq.true'},event=>{
    if(identity()!==owner||context!==owner||!listeners.size)return;
    const version=event.new?.version;
    if(version&&version!==data?.sync_version&&version!==signaledVersion){signaledVersion=version;refresh();}
   }).subscribe();
 }
 function checkVersion(){
  syncContext();
  if(context===null||!listeners.size||document.hidden)return;
  if(!data||needed){ensure().catch(()=>{});return;}
  if(pending||metadata)return;
  const request={context,revision};metadata=request;
  window.SutiSupabase.getClient().from('loan_history_publication').select('version,source_updated_at').eq('id',true).maybeSingle()
   .then(result=>{
    syncContext();if(metadata!==request||context!==request.context||revision!==request.revision)return;
    if(result.error)throw Object.assign(result.error,{status:result.status||result.error.status});
    if(!result.data||result.data.version!==data?.sync_version)refresh();
   }).catch(error=>{if(metadata===request&&context===request.context&&revision===request.revision)fail(error);})
   .finally(()=>{if(metadata===request)metadata=null;});
 }
 function ensure(){
  bind();syncContext();
  if(context===null)return Promise.reject(changed());
  if(pending)return pending.promise;
  if(data&&!needed)return Promise.resolve(data);
  if(phase==='error')return Promise.reject(Error('HISTORY_UNAVAILABLE'));
  if(document.hidden){needed=true;return Promise.resolve(null);}
  const request={context,revision,promise:null};pending=request;needed=false;phase=data?'refreshing':'loading';emit();
  request.promise=window.PrivateResourceDemand.run('self-loan-history:LOAD:'+request.context+':'+request.revision,async()=>{
   const result=await window.SutiSupabase.getClient().functions.invoke('loan-history',{body:{action:'LOAD'}});
   const value=result.data;
   if(result.error)throw result.error;
   if(value?.error)throw Object.assign(Error('HISTORY_UNAVAILABLE'),{code:value.error});
   if(!value||value.version!==1||!Array.isArray(value.entries)||value.entries.some(entry=>!Array.isArray(entry.schedule))||!Array.isArray(value.covered_request_ids)||!Array.isArray(value.financial_request_ids)||!Number.isFinite(Date.parse(value.server_now))||!value.sync_state)throw Error('HISTORY_UNAVAILABLE');
   return value;
  }).then(value=>{
   syncContext();
   if(pending!==request||revision!==request.revision||context!==request.context)throw changed();
   data=value;anchor=performance.now();phase='loaded';
   // Cards do not traverse every installment on each local clock tick.
   summary={...value,entries:value.entries.map(({schedule,total,paid_to_date,expected_to_date,...entry})=>entry)};
   startSignal();emit();return value;
  }).catch(error=>{
   if(pending===request&&revision===request.revision&&context===request.context)fail(error);
   throw error;
  }).finally(()=>{
   if(pending!==request)return;
   pending=null;
   if(needed&&listeners.size)ensure().catch(()=>{});
  });
  return request.promise;
 }
 function refresh(){
  syncContext();revision++;metadata=null;needed=context!==null;phase=data?'refreshing':'idle';emit();
  if(listeners.size)ensure().catch(()=>{});
 }
 async function load(key){
  const expected=identity();await ensure();
  if(expected===null||expected!==identity()||context!==expected||!data)throw changed();
  return view(key||null);
 }
 function useHistory(key=null){
  window.PrivateResourceDemand.useContext();
  const currentIdentity=identity(),[result,setResult]=React.useState(null),[,tick]=React.useState(0);
  React.useEffect(()=>{
   bind();let active=true;
   const update=()=>{if(active)setResult({context,key,data:view(key),anchor,phase:phase==='idle'?'loading':phase});};
   const first=listeners.size===0,hadData=!!data;
   listeners.add(update);ensure().catch(()=>{});startSignal();update();
   if(first&&hadData&&!needed)checkVersion();
   const clock=setInterval(()=>tick(n=>n+1),1000);
   return()=>{active=false;listeners.delete(update);clearInterval(clock);if(!listeners.size)stopSignal();};
  },[currentIdentity,key]);
  const current=result&&result.context===currentIdentity&&result.key===key?result:null;
  return {data:current?.data||null,elapsed:current?.anchor==null?0:Math.max(0,performance.now()-current.anchor),phase:current?.phase||'loading',retry:refresh};
 }
 window.LoanHistory=Object.freeze({load,project,merge,formatDate,normalize,metrics,useHistory});
})();
