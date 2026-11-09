import {Buffer} from 'node:buffer';
﻿// Shared by the prepared Edge entries and the real local integration gateway.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(code,status=409)=>Object.assign(new Error(code),{status});
const strict=(body,keys)=>body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>keys.includes(k));
async function rpc(client,name,args){const r=await client.rpc(name,args);if(r.error)throw r.error;return r.data;}
async function verifyObject(service,descriptor,verify,options){
 const result=await service.storage.from(descriptor.bucket).download(descriptor.path);if(result.error||!result.data)throw fail('DOCUMENT_BYTES_UNAVAILABLE',503);
 return verify(Buffer.from(await result.data.arrayBuffer()),descriptor.mime,descriptor.sha256,Number(descriptor.size),options);
}
export function documentError(e){
 const text=String(e?.message||'');
 const code=['DOCUMENT_VERSION_CONFLICT','IDEMPOTENCY_ARGUMENT_MISMATCH','DOCUMENT_BYTES_UNAVAILABLE','BYTE_INTEGRITY_MISMATCH','VERIFIED_UPLOAD_REQUIRED','EVIDENCE_NOT_SEALED','PHYSICAL_PURGE_DISABLED'].find(x=>text.includes(x));
 const denied=e?.code==='42501'||/DENIED|AUTH_INVALID|AUTH_REQUIRED/.test(text);
 return {status:denied?403:e?.status||(/INTEGRITY|INVALID_PNG|INVALID_JPEG|INVALID_PDF/.test(text)?422:409),body:{error:denied?'DOCUMENT_CONTEXT_DENIED':code||'DOCUMENT_OPERATION_UNAVAILABLE',recoverable:true}};
}
export async function documentOperation(body,user,service,verify){
 try{
  if(!body||!['PREPARE','COMPLETE','WITHDRAW','SUBMIT'].includes(body.action))throw fail('INVALID_OPERATION',400);
  if(body.action==='SUBMIT'){
   if(!strict(body,['action','operation_id','function_name','arguments'])||!UUID.test(body.operation_id||''))throw fail('INVALID_OPERATION',400);
   const args={p_id:body.operation_id,p_function:body.function_name,p_arguments:body.arguments};
   const prepared=await rpc(user,'prepare_document_submission',args),receipts=[];
   for(const d of prepared.documents){const receipt=await verifyObject(service,d,verify);receipts.push({...receipt,document_id:d.document_id});}
   const current=await rpc(user,'prepare_document_submission',args);if(JSON.stringify(current)!==JSON.stringify(prepared))throw fail('DOCUMENT_OPERATION_CHANGED');
   return{status:200,body:await rpc(service,'complete_document_submission',{p_id:body.operation_id,p_receipts:receipts})};
  }
  if(body.action==='PREPARE'){
   if(!strict(body,['action','operation_id','mode','affiliate_id','document_type_id','mime','size','sha256','expected_document_id','source','reason'])||!UUID.test(body.operation_id||'')||!UUID.test(body.document_type_id||'')||!['SELF_SERVICE','ADMIN'].includes(body.mode))throw fail('INVALID_OPERATION',400);
   const data=await rpc(user,'prepare_document_operation',{p_id:body.operation_id,p_mode:body.mode,p_affiliate:body.affiliate_id||null,p_type:body.document_type_id,p_mime:body.mime,p_size:body.size,p_sha:body.sha256,p_expected:body.expected_document_id||null,p_source:body.source||'FILE',p_reason:body.reason||''});
   return {status:200,body:data};
  }
  if(body.action==='WITHDRAW'){
   if(!strict(body,['action','operation_id','document_id','reason'])||!UUID.test(body.operation_id||'')||!UUID.test(body.document_id||''))throw fail('INVALID_OPERATION',400);
   return{status:200,body:await rpc(user,'withdraw_document',{p_document:body.document_id,p_operation:body.operation_id,p_reason:body.reason||''})};
  }
  if(!strict(body,['action','operation_id'])||!UUID.test(body.operation_id||''))throw fail('INVALID_OPERATION',400);
  const d=await rpc(user,'get_document_operation',{p_id:body.operation_id});
  await verifyObject(service,d,verify);const receipt=await verifyObject(service,d,verify);
  const current=await rpc(user,'get_document_operation',{p_id:body.operation_id});
  if(JSON.stringify(current)!==JSON.stringify(d))throw fail('DOCUMENT_OPERATION_CHANGED');
  return{status:200,body:await rpc(service,'complete_document_operation',{p_id:body.operation_id,p_receipt:receipt})};
 }catch(e){return documentError(e);}
}
export async function documentAccess(body,user,service,verify){
 try{
  if(!strict(body,['source','association_id','mode'])||!['EXPEDIENTE','AFFILIATE_FILE','REQUEST','SAVINGS','GENERATED'].includes(body.source)||!['SELF_SERVICE','ADMIN'].includes(body.mode)||!UUID.test(body.association_id||''))throw fail('INVALID_ACCESS_REQUEST',400);
  const args={p_source:body.source,p_association:body.association_id,p_mode:body.mode};
  const d=await rpc(user,'resolve_document_access',args);await verifyObject(service,d,verify,{existingRead:true});
  const current=await rpc(user,'resolve_document_access',args);if(JSON.stringify(current)!==JSON.stringify(d))throw fail('DOCUMENT_CONTEXT_DENIED',403);
  const signed=await service.storage.from(d.bucket).createSignedUrl(d.path,30);if(signed.error||!signed.data?.signedUrl)throw fail('DOCUMENT_BYTES_UNAVAILABLE',503);
  return{status:200,body:{signedUrl:signed.data.signedUrl,expiresIn:30,mimeType:d.mime,sha256:d.sha256,associationId:body.association_id}};
 }catch(e){return documentError(e);}
}

export async function verifiedFinancialDocumentRpc(user,service,name,args,verify){
 try{
  if(!['create_validated_financial_program_request','confirm_program_product_financing'].includes(name))throw fail('FINANCIAL_WRITER_REQUIRED',403);
  const id=crypto.randomUUID(),payload={p_id:id,p_function:name,p_arguments:args};
  const prepared=await rpc(user,'prepare_document_submission',payload),receipts=[];
  for(const d of prepared.documents)receipts.push({...await verifyObject(service,d,verify),document_id:d.document_id});
  const current=await rpc(user,'prepare_document_submission',payload);if(JSON.stringify(current)!==JSON.stringify(prepared))throw fail('DOCUMENT_OPERATION_CHANGED');
  return{data:await rpc(service,'complete_document_financial_submission',{p_id:id,p_receipts:receipts}),error:null};
 }catch(error){return{data:null,error};}
}
