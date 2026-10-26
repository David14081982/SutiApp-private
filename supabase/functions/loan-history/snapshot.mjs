import {HistoryError,projectHistory} from './history.mjs';
const fail=code=>{throw new HistoryError('HISTORY_'+code);};

// One authenticated SQL statement resolves effective identity and its published
// observation. Neither the caller nor this Edge function chooses a Folio.
export async function loadPublishedHistory(body,client){
 if(!body||typeof body!=='object'||Array.isArray(body)||!['LOAD','SUMMARY','DETAIL'].includes(body.action))fail('REQUEST_INVALID');
 const detail=body.action==='DETAIL';
 if(Object.keys(body).some(k=>k!=='action'&&!(detail&&k==='key'))||detail&&(typeof body.key!=='string'||!/^(?:loan|request):[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(body.key)))fail('REQUEST_INVALID');
 const result=await client.rpc('get_self_loan_history_snapshot');
 if(result.error){
  if(result.status===401||['PGRST301','PGRST303','28000'].includes(result.error.code))fail('AUTH_REQUIRED');
  if(result.error.code==='42501'||/HISTORY_(?:IDENTITY|AUTH|CONTEXT)/.test(result.error.message||''))fail('IDENTITY_DENIED');
  if(/HISTORY_SNAPSHOT_(?:NOT_READY|DISABLED)/.test(result.error.message||''))fail('SNAPSHOT_NOT_READY');
  fail('UNAVAILABLE');
 }
 const value=result.data,context=value?.context,source=value?.source;
 if(value&&value.sync_version===null&&source===null)fail('SNAPSHOT_NOT_READY');
 if(!context?.actor||!context.affiliate_id||!context.folio||!source||!Array.isArray(source.issues)||
  typeof value.source_updated_at!=='string'||!Number.isFinite(Date.parse(value.source_updated_at))||typeof value.sync_version!=='string')fail('SOURCE_INVALID');
 // A malformed transfer note must not silently sever the original approval
 // identity. Other users' groups remain independently readable.
 if(source.issues.length)fail('TRANSFER_IDENTITY_INVALID');
 if(source.folio!==undefined&&source.folio!==context.folio)fail('SOURCE_IDENTITY_MISMATCH');
 const projected=projectHistory({...source,folio:context.folio},context,context.server_now);
 const state=value.sync_state||{};
 const history={...projected,source_updated_at:value.source_updated_at,sync_version:value.sync_version,
  sync_state:{status:state.status||'READY',last_attempt_at:state.last_attempt_at||null,last_error_code:state.last_error_code||null}};
 if(body.action==='SUMMARY')return {...history,entries:history.entries.map(entry=>{
  const {key,id,sourceId,kind,category,fund,principal,term,date,status,approved_at,expires_at}=entry;
  return {key,id,sourceId,kind,category,fund,principal,term,date,status,approved_at,expires_at,...(entry.preparing?{preparing:true}:{})};
 })};
 if(detail){
  const entries=history.entries.filter(entry=>entry.key===body.key),ids=new Set(entries.map(entry=>entry.sourceId).filter(Boolean));
  return {...history,entries,covered_request_ids:history.covered_request_ids.filter(id=>ids.has(id)),financial_request_ids:history.financial_request_ids.filter(id=>ids.has(id))};
 }
 return history;
}
