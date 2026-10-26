/* Own published loan history. Context memory only; backend owns authorization. */
(function(){
 'use strict';
 const normalize=v=>String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
 const formatDate=v=>v?new Date(v.length===10?v+'T12:00:00-07:00':v).toLocaleDateString('es-MX',{timeZone:'America/Hermosillo'}):'Fecha no registrada';
 function approvalCategory(entry,now){
  const status=normalize(entry.status),approved=Date.parse(entry.approved_at),age=now-approved;
  if(['LIQUIDADO','PAGO DE MAS'].includes(status))return 'Liquidadas';
  if(Number.isFinite(approved)&&age>=0&&age<86400000)return 'Aprobadas';
  return ['AL CORRIENTE','SALDO ATRASADO'].includes(status)?'En pago':'Estado por revisar';
 }
 function compose(value,now){
  let entries=value.entries.slice();
  for(const approval of value.approvals||[]){
   const matches=entries.filter(entry=>entry.sourceId===approval.sourceId),loans=matches.filter(entry=>entry.kind==='loan'&&!entry.preparing);
   const existing=loans.length===1?loans[0]:matches.length===1?matches[0]:null;
   // Ambiguous identities cannot be repaired by guessing a date or amount.
   if(matches.length&&!existing)continue;
   if(existing){
    const updated={...existing,approved_at:approval.approved_at,expires_at:approval.expires_at};
    if(existing.kind==='request'){updated.kind='loan';updated.preparing=true;updated.status=null;}
    updated.category=approvalCategory(updated,now);
    entries=entries.filter(entry=>entry===existing||entry.sourceId!==approval.sourceId).map(entry=>entry===existing?updated:entry);
   }else{
    const age=now-Date.parse(approval.approved_at),recent=age>=0&&age<86400000;
    // Only a recent approval or an approval newer than the observation may
    // add a preparing card. A later complete publication owns absence.
    if(!recent&&!(Date.parse(approval.approved_at)>Date.parse(value.source_updated_at)))continue;
    const entry={...approval,key:'request:'+approval.id,kind:'loan',preparing:true,status:null,
     paid_to_date:null,expected_to_date:null,schedule:[]};
    entries.push({...entry,category:approvalCategory(entry,now)});
   }
  }
  return entries;
 }
 function project(data,elapsed){
  const now=Date.parse(data.server_now)+Math.max(0,elapsed),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  return compose(data,now).map(entry=>{
   let category=entry.category;
   if(entry.kind==='loan'&&(entry.approved_at||category==='Aprobadas'))category=approvalCategory(entry,now);
   return {...entry,category,remaining:category==='Aprobadas'?Math.max(0,Date.parse(entry.expires_at)-now):null,
    schedule:(entry.schedule||[]).map((row,index,rows)=>({...row,
     state:!row.date?'Fecha por revisar':row.date>today?'Pendiente':row.amount===0?'No se descontó':typeof row.amount==='number'&&row.amount>0?'Pagada':'Importe por revisar',
     upcoming:!!row.date&&row.date>today,closure:index===rows.length-1}))};
  });
 }
 function merge(existing,data,elapsed){
  // Native workflows are independent of Google. Financial statuses still require their source.
  if(!data)return existing.filter(row=>row.kind!=='loan'&&!row.financial);
  const projected=project(data,elapsed),financial=new Set(data.financial_request_ids),covered=new Set([...data.covered_request_ids,...projected.map(entry=>entry.sourceId).filter(Boolean)]);
  const originals=new Map(existing.map(row=>[row.sourceId,row]));
  const rows=existing.filter(row=>row.kind!=='loan'&&!row.financial&&!financial.has(row.sourceId)&&!covered.has(row.sourceId));
  for(const entry of projected){
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
 const listeners=new Set(),aliases=new Map();
 let context=null,epoch=null,revision=0,pending=null,metadata=null,needed=false,bound=false,data=null,summary=null,anchor=0,phase='idle',channel=null,signaledVersion=null;
 let approvalPending=null,approvalMetadata=null,approvalNeeded=false,approvalSerial=0,approvalPhase='idle',approvalSignal=null,approvalReconcile=false;
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
 function summarize(){summary=data&&{...data,entries:data.entries.map(({schedule,total,paid_to_date,expected_to_date,...entry})=>entry)};}
 function rememberKeys(){
  if(data)for(const entry of compose(data,Date.parse(data.server_now)+Math.max(0,performance.now()-anchor)))if(entry.sourceId)aliases.set(entry.key,entry.sourceId);
 }
 function resetApproval(){approvalSerial++;approvalPending=null;approvalMetadata=null;approvalNeeded=false;approvalPhase='idle';approvalSignal=null;}
 function clear(nextPhase='idle'){
  revision++;data=null;summary=null;anchor=0;phase=nextPhase;signaledVersion=null;approvalReconcile=false;aliases.clear();resetApproval();
 }
 function syncContext(){
  const next=identity(),nextEpoch=window.PrivateResourceDemand.context();
  if(next!==context){context=next;epoch=nextEpoch;pending=null;metadata=null;needed=false;clear();stopSignal();emit();return true;}
  if(nextEpoch!==epoch){epoch=nextEpoch;revision++;pending=null;metadata=null;resetApproval();needed=next!==null;phase=data?'refreshing':'idle';emit();return true;}
  return false;
 }
 function view(key){
  if(!data)return null;
  if(!key)return summary;
  const composed=compose(data,Date.parse(data.server_now)+Math.max(0,performance.now()-anchor));
  let entries=composed.filter(entry=>entry.key===key);
  if(!entries.length&&aliases.has(key)){
   const linked=composed.filter(entry=>entry.sourceId===aliases.get(key));
   if(linked.length===1)entries=linked.map(entry=>({...entry,key}));
  }
  const ids=new Set(entries.map(entry=>entry.sourceId).filter(Boolean));
  return {...data,entries,approvals:[],covered_request_ids:data.covered_request_ids.filter(id=>ids.has(id)),financial_request_ids:data.financial_request_ids.filter(id=>ids.has(id))};
 }
 function bind(){
  if(bound)return;bound=true;
  const onContext=()=>{if(syncContext()&&listeners.size){startSignal();ensure().catch(()=>{});}};
  window.PrivateResourceDemand.subscribe(onContext);
  window.AffiliateAuth.subscribe(onContext);
  window.addEventListener('suti:request-changed',()=>refreshApprovals());
  window.addEventListener('suti:history-snapshot-changed',()=>{if(listeners.size)checkVersion();else needed=true;});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&listeners.size){if(data&&!needed)checkVersion();else ensure().catch(()=>{});}});
 }
 function denied(error){return [401,403].includes(Number(error?.context?.status||error?.status))||['UNAUTHORIZED','FORBIDDEN','AUTH_REQUIRED','HISTORY_AUTH_REQUIRED','HISTORY_IDENTITY_DENIED','HISTORY_CONTEXT_INVALID'].includes(error?.code);}
 function fail(error,approvalOnly=false){
  if(denied(error)){clear('error');needed=false;stopSignal();}
  else if(approvalOnly){approvalPhase='error';approvalNeeded=false;}
  else{phase='error';needed=false;}
  emit();
 }
 function stopSignal(){
  if(!channel)return;const old=channel;channel=null;
  try{Promise.resolve(window.SutiSupabase.getClient().removeChannel(old)).catch(()=>{});}catch(_){}
 }
 function startSignal(){
  if(channel||!listeners.size||context===null)return;
  const owner=context,affiliate=window.AffiliateAuth.getState().affiliate?.id;
  channel=window.SutiSupabase.getClient().channel('own-history-publication').on('postgres_changes',
   {event:'UPDATE',schema:'public',table:'loan_history_publication',filter:'id=eq.true'},event=>{
    if(identity()!==owner||context!==owner||!listeners.size)return;
    const version=event.new?.version;
    if(version&&version!==data?.sync_version&&version!==signaledVersion){signaledVersion=version;refresh();}
   });
  if(affiliate)channel=channel.on('postgres_changes',
   {event:'*',schema:'public',table:'loan_history_approval_publication',filter:'affiliate_id=eq.'+affiliate},event=>{
    if(identity()!==owner||context!==owner||!listeners.size||event.new?.affiliate_id!==affiliate)return;
    const version=event.new?.version;
    if(version&&version!==data?.approval_revision&&version!==approvalSignal)refreshApprovals(version);
   });
  const connection=channel;
  channel=connection.subscribe(status=>{
   if(status==='SUBSCRIBED'&&channel===connection&&context===owner&&identity()===owner&&listeners.size){
    // Reconcile after the connection is established even if LOAD captured an
    // earlier revision and is still in flight. No schedule reload is needed.
    approvalReconcile=true;checkApprovalVersion();
   }
  });
 }
 function checkApprovalVersion(){
  if(context===null||!listeners.size||document.hidden||!data||pending||approvalPending||approvalMetadata)return;
  const affiliate=window.AffiliateAuth.getState().affiliate?.id;if(!affiliate)return;
  const request={context,serial:approvalSerial,version:data.approval_revision};approvalMetadata=request;approvalReconcile=false;
  window.SutiSupabase.getClient().from('loan_history_approval_publication').select('version').eq('affiliate_id',affiliate).maybeSingle()
   .then(result=>{
    syncContext();if(approvalMetadata!==request||context!==request.context||approvalSerial!==request.serial||data?.approval_revision!==request.version)return;
    if(result.error)throw Object.assign(result.error,{status:result.status||result.error.status});
    if((result.data?.version||null)!==(data?.approval_revision||null))refreshApprovals(result.data?.version||null);
   }).catch(error=>{if(approvalMetadata===request&&context===request.context&&approvalSerial===request.serial)fail(error,true);})
   .finally(()=>{if(approvalMetadata===request){approvalMetadata=null;if(approvalReconcile)checkApprovalVersion();}});
 }
 function checkVersion(){
  syncContext();
  if(context===null||!listeners.size||document.hidden)return;
  if(!data||needed){ensure().catch(()=>{});return;}
  if(pending)return;
  if(approvalNeeded)ensureApprovals();else checkApprovalVersion();
  if(metadata)return;
  const request={context,revision};metadata=request;
  window.SutiSupabase.getClient().from('loan_history_publication').select('version,source_updated_at').eq('id',true).maybeSingle()
   .then(result=>{
    syncContext();if(metadata!==request||context!==request.context||revision!==request.revision)return;
    if(result.error)throw Object.assign(result.error,{status:result.status||result.error.status});
    if(!result.data||result.data.version!==data?.sync_version)refresh();
   }).catch(error=>{if(metadata===request&&context===request.context&&revision===request.revision)fail(error);})
   .finally(()=>{if(metadata===request)metadata=null;});
 }
 function validApprovals(value){
  if(!Array.isArray(value.approvals)||!('approval_revision'in value)||!(value.approval_revision===null||typeof value.approval_revision==='string'))return false;
  const ids=new Set(),sources=new Set();
  for(const entry of value.approvals){
   if(!entry||typeof entry.id!=='string'||!/^SR-/.test(entry.id)||typeof entry.sourceId!=='string'||!entry.sourceId||ids.has(entry.id)||sources.has(entry.sourceId)||
    !Number.isFinite(Date.parse(entry.approved_at))||Date.parse(entry.expires_at)!==Date.parse(entry.approved_at)+86400000)return false;
   ids.add(entry.id);sources.add(entry.sourceId);
  }
  return true;
 }
 function ensureApprovals(){
  syncContext();
  if(context===null||!listeners.size||!data||pending||approvalPending||document.hidden)return;
  if(!approvalNeeded)return;
  const request={context,serial:approvalSerial,signal:approvalSignal};approvalPending=request;approvalNeeded=false;approvalPhase='refreshing';emit();
  window.PrivateResourceDemand.run('self-loan-history:APPROVALS:'+request.context+':'+request.serial,async()=>{
   const result=await window.SutiSupabase.getClient().functions.invoke('loan-history',{body:{action:'APPROVALS'}}),value=result.data;
   if(result.error)throw result.error;
   if(value?.error)throw Object.assign(Error('HISTORY_UNAVAILABLE'),{code:value.error});
   if(!value||value.version!==1||!Number.isFinite(Date.parse(value.server_now))||!validApprovals(value)||'entries'in value)throw Error('HISTORY_UNAVAILABLE');
   return value;
  }).then(value=>{
   syncContext();if(approvalPending!==request||context!==request.context||approvalSerial!==request.serial||!data)return;
   if(request.signal!==approvalSignal&&value.approval_revision!==approvalSignal){approvalNeeded=true;return;}
   rememberKeys();
   const previous=new Set(data.approvals.map(entry=>entry.sourceId)),current=new Set(value.approvals.map(entry=>entry.sourceId));
   const entries=data.entries.map(entry=>{
    if(!previous.has(entry.sourceId)||current.has(entry.sourceId))return entry;
    const updated={...entry,approved_at:null,expires_at:null};
    if(entry.kind==='loan')updated.category=approvalCategory(updated,Date.parse(value.server_now));
    return updated;
   });
   data={...data,entries,approvals:value.approvals,approval_revision:value.approval_revision,server_now:value.server_now};
   anchor=performance.now();summarize();rememberKeys();approvalPhase='loaded';
   if(value.approval_revision===approvalSignal)approvalNeeded=false;
   emit();
  }).catch(error=>{if(approvalPending===request&&context===request.context&&approvalSerial===request.serial)fail(error,true);})
   .finally(()=>{if(approvalPending===request){approvalPending=null;if(approvalNeeded)ensureApprovals();else if(approvalReconcile)checkApprovalVersion();}});
 }
 function refreshApprovals(version){
  syncContext();if(context===null)return;
  if(version!==undefined)approvalSignal=version;
  approvalNeeded=true;
  if(listeners.size){if(data)ensureApprovals();else ensure().catch(()=>{});}
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
   if(!value||value.version!==1||!Array.isArray(value.entries)||value.entries.some(entry=>!Array.isArray(entry.schedule))||!Array.isArray(value.covered_request_ids)||!Array.isArray(value.financial_request_ids)||!Number.isFinite(Date.parse(value.server_now))||!value.sync_state||('approvals'in value&&!validApprovals(value)))throw Error('HISTORY_UNAVAILABLE');
   return {...value,approvals:value.approvals||[],approval_revision:value.approval_revision||null};
  }).then(value=>{
   syncContext();
   if(pending!==request||revision!==request.revision||context!==request.context)throw changed();
   rememberKeys();data=value;anchor=performance.now();phase='loaded';approvalPhase='loaded';
   if(approvalSignal&&approvalSignal===value.approval_revision)approvalNeeded=false;
   // Cards do not traverse every installment on each local clock tick.
   summarize();rememberKeys();
   startSignal();emit();return value;
  }).catch(error=>{
   if(pending===request&&revision===request.revision&&context===request.context)fail(error);
   throw error;
  }).finally(()=>{
   if(pending!==request)return;
   pending=null;
   if(needed&&listeners.size)ensure().catch(()=>{});else if(approvalNeeded)ensureApprovals();else if(approvalReconcile)checkApprovalVersion();
  });
  return request.promise;
 }
 function refresh(){
  syncContext();revision++;metadata=null;resetApproval();needed=context!==null;phase=data?'refreshing':'idle';emit();
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
   const update=()=>{if(active)setResult({context,key,data:view(key),anchor,phase:phase==='error'||approvalPhase==='error'?'error':phase==='idle'?'loading':phase==='loaded'&&approvalPhase==='refreshing'?'refreshing':phase});};
   const first=listeners.size===0,hadData=!!data;
   listeners.add(update);ensure().catch(()=>{});startSignal();update();
   if(first&&hadData&&!needed)checkVersion();
   const clock=setInterval(()=>tick(n=>n+1),1000);
   return()=>{active=false;listeners.delete(update);clearInterval(clock);if(!listeners.size)stopSignal();};
  },[currentIdentity,key]);
  const current=result&&result.context===currentIdentity&&result.key===key?result:null;
  return {data:current?.data||null,elapsed:current?.anchor==null?0:Math.max(0,performance.now()-current.anchor),phase:current?.phase||'loading',retry:()=>{if(approvalPhase==='error'&&phase!=='error')refreshApprovals();else refresh();}};
 }
 window.LoanHistory=Object.freeze({load,project,merge,formatDate,normalize,metrics,useHistory});
})();
