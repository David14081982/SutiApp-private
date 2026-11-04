// Only opaque operation identifiers leave this boundary. Storage keys never do.
export function validRequest(body) {
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!body||typeof body!=='object'||Array.isArray(body)||!uuid.test(body.affiliate_id||''))return false;
 const allowed=body.action==='RESUME'?['action','affiliate_id','operation_id']:['action','affiliate_id','document_id','fingerprint','reason','operation_id'];
 if(Object.keys(body).some(k=>!allowed.includes(k))||!uuid.test(body.operation_id||''))return false;
 return body.action==='RESUME'||(body.action==='DELETE'&&uuid.test(body.document_id||'')&&/^[a-f0-9]{32}$/.test(body.fingerprint||'')&&typeof body.reason==='string'&&body.reason.trim().length>=8&&body.reason.trim().length<=500);
}
export async function deleteDocument(user,service,actor,body){
 if(!validRequest(body))return {status:400,body:{error:'INVALID_DOCUMENT_DELETE_REQUEST'}};
 const started=body.action==='RESUME'
  ?await user.rpc('resume_admin_affiliate_document_delete',{p_affiliate_id:body.affiliate_id,p_operation_id:body.operation_id})
  :await user.rpc('prepare_admin_affiliate_document_delete',{p_affiliate_id:body.affiliate_id,p_document_id:body.document_id,p_fingerprint:body.fingerprint,p_reason:body.reason,p_action_id:body.operation_id});
 if(started.error){
  const message=String(started.error.message||'');
  const code=['DOCUMENT_SHARED_REFERENCE','DOCUMENT_DELETE_PREVIEW_STALE','DOCUMENT_CONTEXT_MISMATCH','DOCUMENT_DELETE_REASON_REQUIRED','DOCUMENT_DELETE_RETRY_MISMATCH','DOCUMENT_VERSION_SCOPE_INVALID'].find(c=>message.includes(c));
  return {status:started.error.code==='42501'?403:409,body:{error:code||'DOCUMENT_DELETE_DENIED'}};
 }
 if(!started.data||started.data.operation_id!==body.operation_id)return {status:503,body:{error:'DOCUMENT_DELETE_UNAVAILABLE'}};
 if(started.data.status==='COMPLETE')return {status:200,body:started.data};
 const pending=()=>({status:202,body:{operation_id:body.operation_id,status:'PENDING_STORAGE',error:'DOCUMENT_DELETE_STORAGE_PENDING'}});
 try{
  const plan=await service.rpc('affiliate_document_delete_storage',{p_operation_id:body.operation_id,p_actor_id:actor,p_finish:false});
  if(plan.error||!plan.data)return pending();
  for(const asset of plan.data.assets||[]){
   if(!asset.source_exists)continue; // Already moved (or absent before retirement).
   if(asset.destination_exists)return pending(); // Never overwrite retained bytes.
   const moved=await service.storage.from(asset.bucket).move(asset.source,asset.destination);
   if(moved.error)return pending();
  }
  const finished=await service.rpc('affiliate_document_delete_storage',{p_operation_id:body.operation_id,p_actor_id:actor,p_finish:true});
  if(finished.error||finished.data?.status!=='COMPLETE')return pending();
  return {status:200,body:finished.data};
 }catch{return pending();}
}
