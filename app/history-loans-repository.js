/* Own loan history. Bounded context memory only; no persistence or client target. */
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
    schedule:(entry.schedule||[]).map(row=>({...row,state:row.date?row.date<=today?'Pagada':'Pendiente':'Fecha por revisar'}))};
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
 const MAX_REUSE_MS=5*60*1000,listeners=new Set();
 let context=null,revision=0,pending=null,needed=false,bound=false,data=null,summary=null,anchor=0,phase='idle';
 const changed=()=>Error('HISTORY_CONTEXT_CHANGED');
 function identity(){
  const epoch=window.PrivateResourceDemand.context();
  if(epoch===null)return null;
  const auth=window.AffiliateAuth.getState();
  // A control correction can retain the same affiliate UUID. It invalidates
  // this derived copy but is never sent to the server as an identity selector.
  return JSON.stringify([epoch,auth.affiliate?.numero_control??null]);
 }
 function emit(){listeners.forEach(fn=>fn());}
 function clear(nextPhase='idle'){
  revision++;data=null;summary=null;anchor=0;phase=nextPhase;
 }
 function syncContext(){
  const next=identity();
  if(next===context)return false;
  context=next;pending=null;needed=false;clear();emit();return true;
 }
 function view(key){
  if(!data)return null;
  if(!key)return summary;
  const entries=data.entries.filter(entry=>entry.key===key),ids=new Set(entries.map(entry=>entry.sourceId).filter(Boolean));
  return {...data,entries,covered_request_ids:data.covered_request_ids.filter(id=>ids.has(id)),financial_request_ids:data.financial_request_ids.filter(id=>ids.has(id))};
 }
 function bind(){
  if(bound)return;bound=true;
  const onContext=()=>{if(syncContext()&&listeners.size)ensure().catch(()=>{});};
  window.PrivateResourceDemand.subscribe(onContext);
  window.AffiliateAuth.subscribe(onContext);
  // These lightweight invalidators remain bound while no History view is
  // mounted, so a removed request or previous identity cannot reappear later.
  window.addEventListener('suti:request-changed',()=>refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&listeners.size)ensure().catch(()=>{});});
 }
 function ensure(){
  bind();syncContext();
  if(context===null)return Promise.reject(changed());
  if(data&&performance.now()-anchor<MAX_REUSE_MS)return Promise.resolve(data);
  if(data){clear();needed=true;emit();}
  if(pending)return pending.promise;
  if(phase==='error')return Promise.reject(Error('HISTORY_UNAVAILABLE'));
  if(document.hidden){needed=true;return Promise.resolve(null);}
  const request={context,revision,promise:null};pending=request;needed=false;phase='loading';emit();
  request.promise=window.PrivateResourceDemand.run('self-loan-history:LOAD:'+request.context+':'+request.revision,async()=>{
   const result=await window.SutiSupabase.getClient().functions.invoke('loan-history',{body:{action:'LOAD'}});
   const value=result.data;
   if(result.error||!value||value.error||value.version!==1||!Array.isArray(value.entries)||value.entries.some(entry=>!Array.isArray(entry.schedule))||!Array.isArray(value.covered_request_ids)||!Array.isArray(value.financial_request_ids)||!Number.isFinite(Date.parse(value.server_now)))throw Error('HISTORY_UNAVAILABLE');
   return value;
  }).then(value=>{
   syncContext();
   if(pending!==request||revision!==request.revision||context!==request.context)throw changed();
   data=value;anchor=performance.now();phase='loaded';
   // Cards do not traverse every installment on each local clock tick.
   summary={...value,entries:value.entries.map(({schedule,total,paid_to_date,expected_to_date,...entry})=>entry)};
   emit();return value;
  }).catch(error=>{
   if(pending===request&&revision===request.revision&&context===request.context){clear('error');needed=false;emit();}
   throw error;
  }).finally(()=>{
   if(pending!==request)return;
   pending=null;
   if(needed&&listeners.size)ensure().catch(()=>{});
  });
  return request.promise;
 }
 function refresh(){
  syncContext();clear(pending?'loading':'idle');needed=context!==null;emit();
  if(listeners.size)ensure().catch(()=>{});
 }
 async function load(key){
  const expected=identity();await ensure();
  if(expected===null||expected!==identity()||context!==expected||!data)throw changed();
  return view(key||null);
 }
 function useHistory(key=null){
  const epoch=window.PrivateResourceDemand.useContext(),control=window.AffiliateAuth.getState().affiliate?.numero_control??null;
  const currentIdentity=identity(),[result,setResult]=React.useState(null),[,tick]=React.useState(0);
  React.useEffect(()=>{
   bind();let active=true;
   const update=()=>{if(active)setResult({context,key,data:view(key),anchor,phase:phase==='idle'?'loading':phase});};
   listeners.add(update);ensure().catch(()=>{});update();
   const clock=setInterval(()=>tick(n=>n+1),1000);
   return()=>{active=false;listeners.delete(update);clearInterval(clock);};
  },[epoch,control,key]);
  const current=result&&result.context===currentIdentity&&result.key===key?result:null;
  return {data:current?.data||null,elapsed:current?.anchor==null?0:Math.max(0,performance.now()-current.anchor),phase:current?.phase||'loading',retry:refresh};
 }
 window.LoanHistory=Object.freeze({load,project,merge,formatDate,normalize,useHistory});
})();
