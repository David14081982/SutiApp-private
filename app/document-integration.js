/* Documentary operations over the existing authenticated Supabase authority. */
(function(){
 'use strict';
 const db=()=>window.SutiSupabase.getClient(),pending=new Map();let previous='';
 function enabled(){const c=window.__SUTIAPP_CONFIG__||{};let host='';try{host=new URL(c.supabase&&c.supabase.url).hostname;}catch(_){}return c.documentIntegration==='DOCUMENT_V1'&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c.supabase.url)||c.documentIntegration==='LOCAL_PHASE4'&&['localhost','127.0.0.1'].includes(location.hostname)&&['localhost','127.0.0.1'].includes(host);}
 function context(){const c=window.PrivateResourceDemand.context();if(c!==previous){pending.clear();previous=c;}return c;}
 function checked(before){if(context()!==before)throw Error('DOCUMENT_CONTEXT_CHANGED');}
 async function invoke(name,body){const before=context(),r=await db().functions.invoke(name,{body,timeout:180000});checked(before);if(r.error){let code=r.data&&r.data.error;try{code=code||(await r.error.context.clone().json()).error;}catch(_){}throw Object.assign(Error(code||'DOCUMENT_OPERATION_UNAVAILABLE'),{code:code||'DOCUMENT_OPERATION_UNAVAILABLE'});}return r.data;}
 async function rpc(name,args){const before=context(),r=await db().rpc(name,args);checked(before);if(r.error)throw r.error;return r.data;}
 async function recoveryKey(parts){
  const auth=window.AffiliateAuth.getState(),session=auth.session||{};let claims;
  try{claims=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch(_){throw Error('DOCUMENT_SESSION_UNAVAILABLE');}
  if(!claims.session_id||!session.user?.id)throw Error('DOCUMENT_SESSION_UNAVAILABLE');
  const text=JSON.stringify([session.user.id,claims.session_id,auth.affiliate?.id||'',auth.impersonation||auth.affiliate?._impersonation||null,...parts]);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return 'suti.document.operation.v1.'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 }
 function normalizeFile(file){return file&&/\.jfif$/i.test(file.name||'')&&['','application/octet-stream','image/jfif','image/pjpeg'].includes(file.type)?new File([file],file.name,{type:'image/jpeg',lastModified:file.lastModified}):file;}
 function access(source,id,mode){return window.PrivateResourceDemand.run(JSON.stringify(['document-association',source,id,mode]),()=>invoke('document-access',{source,association_id:id,mode:mode||'SELF_SERVICE'}));}
 async function upload(type,file,options){
  let phase='preparing';const o=options||{},before=context(),progress=value=>{phase=value;if(o.onProgress)o.onProgress(value);},mode=o.mode||'SELF_SERVICE';
  const sha=await window.DocumentTransfer.hash(file,()=>checked(before));checked(before);
  const key=await recoveryKey([mode,o.affiliateId||null,type.id,sha,file.size,String(o.source||'FILE').toUpperCase(),o.reason||'']);checked(before);
  let job=pending.get(key);
  if(!job){const saved=sessionStorage.getItem(key);if(saved){try{const value=JSON.parse(saved);if(/^[0-9a-f-]{36}$/i.test(value.id)&&(!value.expected||/^[0-9a-f-]{36}$/i.test(value.expected)))job=value;}catch(_){}if(!job)sessionStorage.removeItem(key);}}
  try{
  if(!job){const current=await rpc('document_upload_context',{p_mode:mode,p_affiliate:o.affiliateId||null,p_type:type.id});checked(before);job={id:crypto.randomUUID(),expected:current.document_id||null};pending.set(key,job);sessionStorage.setItem(key,JSON.stringify(job));}
  progress('preparing');const prepared=await invoke('document-operation',{action:'PREPARE',operation_id:job.id,mode,affiliate_id:o.affiliateId||null,document_type_id:type.id,mime:file.type,size:file.size,sha256:sha,expected_document_id:job.expected,source:String(o.source||'FILE').toUpperCase(),reason:o.reason||''});
  if(prepared.state!=='COMPLETE'){
   progress('uploading');const result=await window.DocumentTransfer.upload(db(),prepared,file,()=>checked(before),{url:job.uploadUrl,onUrl:url=>{checked(before);job.uploadUrl=url;pending.set(key,job);try{sessionStorage.setItem(key,JSON.stringify(job));}catch(_){}}});checked(before);
   // Duplicate at the exact operation path is verified server-side; never overwrite or remove it.
   if(result.error&&!['409','400'].includes(String(result.error.statusCode||result.error.status))&&!/already exists|duplicate/i.test(String(result.error.message||'')))throw result.error;
  }
  progress('verifying');const result=await invoke('document-operation',{action:'COMPLETE',operation_id:job.id});
  if(result.status!=='COMPLETE'||!result.document||!result.document.id)throw Error('DOCUMENT_REGISTRATION_INCOMPLETE');
  checked(before);pending.delete(key);try{sessionStorage.removeItem(key);}catch(_){}progress('complete');return Object.freeze(result.document);
  }catch(error){if(error.code==='DOCUMENT_VERSION_CONFLICT'){pending.delete(key);sessionStorage.removeItem(key);}if(error&&typeof error==='object')error.documentPhase=phase;throw error;}
 }
 async function submission(name,args){const key=JSON.stringify(['submission',context(),name,args]);let job=pending.get(key);if(!job){job={id:crypto.randomUUID()};pending.set(key,job);}try{const data=await invoke('document-operation',{action:'SUBMIT',operation_id:job.id,function_name:name,arguments:args});return{data,error:null};}catch(error){return{data:null,error};}}
 function withdraw(id,operation,reason){return invoke('document-operation',{action:'WITHDRAW',document_id:id,operation_id:operation||crypto.randomUUID(),reason:reason||'Retiro del expediente'});}
 function evidence(contextId,source,mode){return rpc('list_document_evidence',{p_context:contextId,p_source:source||'REQUEST',p_mode:mode||'SELF_SERVICE'});}
 function generated(contextId,domain,mode){return rpc('list_generated_document_evidence',{p_context:contextId,p_domain:domain,p_mode:mode});}
 window.DocumentIntegration=Object.freeze({enabled,normalizeFile,access,upload,withdraw,evidence,submission,generated});
})();

