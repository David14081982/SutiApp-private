import {readSicofLoanSource,SICOF_LOAN_CONTRACT,SICOF_WORKBOOK,SICOF_SHEET_ID} from './loan-source.mjs';

const safeCode=value=>typeof value==='string'&&value.length<=96&&/^SICOF_[A-Z_]+$/.test(value)?value:'SICOF_SOURCE_REFRESH_FAILED';
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
// Only operational metadata may cross the Edge boundary, never RPC diagnostics.
export function sourceCacheState(value) {
  const state=['READY','STALE','EMPTY'].includes(value?.state)?value.state:'EMPTY';
  return {state,version:Number.isSafeInteger(value?.version)&&value.version>=0?value.version:null,
    observed_at:instant(value?.observed_at),expires_at:instant(value?.expires_at),
    last_attempt_at:instant(value?.last_attempt_at),last_success_at:instant(value?.last_success_at),
    last_error:value?.last_error?safeCode(value.last_error):null,refreshing:value?.refreshing===true};
}
async function cacheRpc(client,name,args={}) {
  const response=await client.rpc(name,args);
  if(response.error||!response.data)throw Error('SICOF_SOURCE_CACHE_UNAVAILABLE');
  return response.data;
}
function unavailable(meta,code) {
  const error=Error(code||'SICOF_SOURCE_CACHE_'+(meta.refreshing?'REFRESHING':meta.state));
  error.sourceState=meta.state==='READY'?{...meta,state:'STALE'}:meta;return error;
}
export function requireCurrentSicofSource(source,dependencies) {
  // Original direct-reader fixtures and the historical savings export have no
  // cache metadata. Production cached reads always attach this server metadata.
  if(!source?.cache_meta)return;
  const meta=source.cache_meta,now=dependencies.now?dependencies.now():Date.now();
  if(meta.state!=='READY')throw unavailable(meta);
  const observed=Date.parse(meta.observed_at),expires=Date.parse(meta.expires_at);
  if(!Number.isFinite(observed)||!Number.isFinite(expires)||observed>now+5000||expires!==observed+300000||now>=expires)
    throw unavailable({...meta,state:'STALE'},'SICOF_SOURCE_CACHE_STALE');
}
export async function readCachedSicofSource(dependencies) {
  const result=await cacheRpc(dependencies.createServiceClient(),'service_sicof_source_read');
  const meta=sourceCacheState(result.meta);
  if(meta.state!=='READY')throw unavailable(meta);
  if(!result.source)throw unavailable(meta,'SICOF_SOURCE_CACHE_INVALID');
  // Fail closed even if metadata is malformed or the copy expires in transit.
  const observed=Date.parse(meta.observed_at),source={...result.source,cache_meta:meta};
  requireCurrentSicofSource(source,dependencies);
  if(source.contract_version!==SICOF_LOAN_CONTRACT||source.source!==SICOF_WORKBOOK+':'+SICOF_SHEET_ID||
    (source.observed_at!==meta.observed_at&&Date.parse(source.observed_at)!==observed)||
    !/^[a-f0-9]{64}$/i.test(source.source_fingerprint||'')||!Array.isArray(source.rows))
    throw unavailable(meta,'SICOF_SOURCE_CACHE_INVALID');
  return source;
}
export async function refreshCachedSicofSource(dependencies,force=false) {
  const client=dependencies.createServiceClient();
  const claim=await cacheRpc(client,'service_sicof_source_claim',{p_force:force});
  if(claim.claimed!==true)return {refreshed:false,meta:sourceCacheState(claim.meta)};
  if(typeof claim.lease!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(claim.lease))throw Error('SICOF_SOURCE_CACHE_INVALID');
  let source,error=null;
  try {source=await (dependencies.upstreamSourceReader||readSicofLoanSource)(dependencies.env);}
  catch(failure){error=safeCode(failure?.message);}
  const finished=await cacheRpc(client,'service_sicof_source_finish',{p_lease:claim.lease,p_source:error?null:source,p_error:error});
  return {refreshed:!error,meta:sourceCacheState(finished.meta),...(error?{error}:{})};
}
export async function dispatchSicofSourceRefreshJob(body,request,dependencies) {
  // The gateway independently verifies the bearer JWT. Scheduled jobs also
  // require a private server secret and cannot be invoked from a browser origin.
  const expected=dependencies.env('SICOF_SOURCE_REFRESH_SECRET'),given=request.headers.get('x-sicof-source-refresh-secret')||'';
  if(request.headers.get('origin')||!request.headers.get('authorization')?.startsWith('Bearer ')||
    typeof expected!=='string'||expected.length<32||given.length>512)throw Error('SICOF_SOURCE_REFRESH_DENIED');
  const encode=new TextEncoder(),digest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(value)));
  const [left,right]=await Promise.all([digest(expected),digest(given)]);
  let different=0;for(let index=0;index<left.length;index++)different|=left[index]^right[index];
  if(different!==0)throw Error('SICOF_SOURCE_REFRESH_DENIED');
  if(!body||body.action!=='REFRESH_SOURCE_JOB'||Object.keys(body).length!==1)throw Error('SICOF_COMMAND_INVALID');
  return {data:await refreshCachedSicofSource(dependencies,false)};
}
