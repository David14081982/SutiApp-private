/* Own loan history. Component memory only; no persistent cache or client target. */
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
 async function load(key){return window.PrivateResourceDemand.run('self-loan-history:'+JSON.stringify(key||null),async()=>{
  const {data,error}=await window.SutiSupabase.getClient().functions.invoke('loan-history',{body:key?{action:'DETAIL',key}:{action:'SUMMARY'}});
  if(error||!data||data.error||data.version!==1||!Array.isArray(data.entries)||!Array.isArray(data.covered_request_ids)||!Array.isArray(data.financial_request_ids)||!Number.isFinite(Date.parse(data.server_now)))throw Error('HISTORY_UNAVAILABLE');
  return data;
 });}
 function useHistory(key=null){
  const epoch=window.PrivateResourceDemand.useContext(),[result,setResult]=React.useState(null),[retry,setRetry]=React.useState(0),[,tick]=React.useState(0);
  React.useEffect(()=>{
   if(epoch===null){setResult(null);return;}
   let active=true,busy=false,needed=true,revision=0;
   async function refresh(){
    if(!active||busy||document.hidden||!needed)return;busy=true;needed=false;
    const started=revision;
    try{const data=await load(key);if(active&&started===revision&&window.PrivateResourceDemand.context()===epoch)setResult({epoch,key,data,anchor:performance.now(),phase:'loaded'});}
    catch(_){if(active&&started===revision&&window.PrivateResourceDemand.context()===epoch)setResult({epoch,key,data:null,phase:'error'});}
    finally{busy=false;if(active&&needed)refresh();}
   }
   refresh();const clock=setInterval(()=>tick(n=>n+1),1000);
   const changed=()=>{revision++;needed=true;setResult(null);refresh();};
   // Visibility only completes an already pending intention; it does not poll the source.
   document.addEventListener('visibilitychange',refresh);window.addEventListener('suti:request-changed',changed);
   return()=>{active=false;clearInterval(clock);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('suti:request-changed',changed);};
  },[epoch,key,retry]);
  const current=result&&result.epoch===epoch&&result.key===key?result:null;
  return {data:current?.data||null,elapsed:current?.anchor==null?0:Math.max(0,performance.now()-current.anchor),phase:current?.phase||'loading',retry:()=>{setResult(null);setRetry(n=>n+1);}};
 }
 window.LoanHistory=Object.freeze({load,project,merge,formatDate,normalize,useHistory});
})();
