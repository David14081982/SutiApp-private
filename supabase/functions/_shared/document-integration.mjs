import {verifyStoredDocument} from './document-stream.mjs';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
﻿// Shared by the prepared Edge entries and the real local integration gateway.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(code,status=409)=>Object.assign(new Error(code),{status});
const strict=(body,keys)=>body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>keys.includes(k));
async function rpc(client,name,args){const r=await client.rpc(name,args);if(r.error)throw r.error;return r.data;}
export function internalVerificationSignature(body,key){return createHmac('sha256',key).update(JSON.stringify(body)).digest('hex');}
export function internalVerificationAuthorized(body,key,signature){return !!key&&Number.isSafeInteger(body?.issued_at)&&Math.abs(Date.now()-body.issued_at)<120000&&/^[a-f0-9]{64}$/.test(signature||'')&&timingSafeEqual(Buffer.from(signature),Buffer.from(internalVerificationSignature(body,key)));}
async function verifyObject(service,descriptor,verify,options){
 if(options?.isolated){const key=globalThis.Deno?.env.get('DOCUMENT_VERIFIER_SECRET')||service.documentVerifierKey;if(!key)throw fail('DOCUMENT_BYTES_UNAVAILABLE',503);const body={action:'VERIFY_INTERNAL',descriptor,existing_read:true,issued_at:Date.now()},r=await service.functions.invoke('document-operation',{headers:{'x-document-verifier-signature':internalVerificationSignature(body,key)},body});if(r.error){let code=r.data?.error;try{code=code||(await r.error.context.json()).error;}catch{}throw fail(code||'DOCUMENT_BYTES_UNAVAILABLE',503);}if(!r.data?.verified||r.data.sha256!==descriptor.sha256||Number(r.data.size)!==Number(descriptor.size)||r.data.mime!==descriptor.mime)throw fail('BYTE_INTEGRITY_MISMATCH',422);return r.data;}
 return verifyStoredDocument(service,descriptor,options);
}
export function documentError(e){
 const text=String(e?.message||'');
 const rejected=['INVALID_DOCUMENT_FILE','INVALID_DOCUMENT_TRAILER','TRUNCATED_DOCUMENT','INVALID_IMAGE_DIMENSIONS','UNSUPPORTED_MIME','BYTE_INTEGRITY_MISMATCH','INVALID_PNG_CRC','INVALID_PNG_DATA','INVALID_PNG_FILTER','INVALID_PNG_CHUNK','INVALID_PNG','INVALID_JPEG','INVALID_WEBP','INVALID_PDF'].find(x=>text===x);
 const code=['DOCUMENT_VERSION_CONFLICT','IDEMPOTENCY_ARGUMENT_MISMATCH','DOCUMENT_BYTES_UNAVAILABLE','BYTE_INTEGRITY_MISMATCH','VERIFIED_UPLOAD_REQUIRED','EVIDENCE_NOT_SEALED','PHYSICAL_PURGE_DISABLED'].find(x=>text.includes(x));
 const denied=e?.code==='42501'||/DENIED|AUTH_INVALID|AUTH_REQUIRED/.test(text);
 if(rejected&&!denied)return{status:422,body:{error:rejected,recoverable:false}};
 return {status:denied?403:e?.status||(/INTEGRITY|INVALID_PNG|INVALID_JPEG|INVALID_PDF/.test(text)?422:409),body:{error:denied?'DOCUMENT_CONTEXT_DENIED':code||'DOCUMENT_OPERATION_UNAVAILABLE',recoverable:true}};
}
export async function documentOperation(body,user,service,verify){
 try{
  if(!body||!['PREPARE','COMPLETE','WITHDRAW','SUBMIT'].includes(body.action))throw fail('INVALID_OPERATION',400);
  if(body.action==='SUBMIT'){
   if(!strict(body,['action','operation_id','function_name','arguments'])||!UUID.test(body.operation_id||''))throw fail('INVALID_OPERATION',400);
   const args={p_id:body.operation_id,p_function:body.function_name,p_arguments:body.arguments};
   const prepared=await rpc(user,'prepare_document_submission',args),receipts=[];
   for(const d of prepared.documents){const receipt=await verifyObject(service,d,verify,{existingRead:true,isolated:prepared.documents.reduce((n,x)=>n+Number(x.size),0)>16*1024*1024});receipts.push({...receipt,document_id:d.document_id});}
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
  const receipt=await verifyObject(service,d,verify);
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
 let phase='PREPARE';
 try{
  if(!['create_validated_financial_program_request','confirm_program_product_financing'].includes(name))throw fail('FINANCIAL_WRITER_REQUIRED',403);
  const id=crypto.randomUUID(),payload={p_id:id,p_function:name,p_arguments:args};
  const prepared=await rpc(user,'prepare_document_submission',payload),receipts=[];
  phase='VERIFY';
  for(const d of prepared.documents)receipts.push({...await verifyObject(service,d,verify,{existingRead:true,isolated:prepared.documents.reduce((n,x)=>n+Number(x.size),0)>16*1024*1024}),document_id:d.document_id});
  phase='PREPARE';
  const current=await rpc(user,'prepare_document_submission',payload);if(JSON.stringify(current)!==JSON.stringify(prepared))throw fail('DOCUMENT_OPERATION_CHANGED');
  phase='COMPLETE';
  return{data:await rpc(service,'complete_document_financial_submission',{p_id:id,p_receipts:receipts}),error:null};
 }catch(error){return{data:null,error:{...error,message:error?.message,documentPhase:phase}};}
}

