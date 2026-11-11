// Bundled locally with pinned @noble/hashes 1.8.0 and tus-js-client 4.3.1.
import {sha256} from '@noble/hashes/sha256';
import {Upload} from 'tus-js-client';
const MAX_BYTES=100*1024*1024;
async function hash(file,check=()=>{}) {
 if(!file||file.size<1||file.size>MAX_BYTES)throw Error('INVALID_DOCUMENT_FILE');
 const digest=sha256.create();
 for(let offset=0;offset<file.size;offset+=2*1024*1024){check();digest.update(new Uint8Array(await file.slice(offset,offset+2*1024*1024).arrayBuffer()));await new Promise(resolve=>setTimeout(resolve,0));}
 check();return Array.from(digest.digest(),x=>x.toString(16).padStart(2,'0')).join('');
}
async function upload(client,prepared,file,check=()=>{},resume={}) {
 if(file.size>MAX_BYTES)throw Error('INVALID_DOCUMENT_FILE');
 const config=window.__SUTIAPP_CONFIG__.supabase,url=new URL(config.url);
 if(!/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname))throw Error('DOCUMENT_UPLOAD_ENDPOINT_INVALID');
 const endpoint='https://'+url.hostname.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable';
 const allowed=value=>{try{const target=new URL(value);return !target.username&&!target.password&&!target.search&&!target.hash&&target.origin===new URL(endpoint).origin&&(target.pathname==='/storage/v1/upload/resumable'||target.pathname.startsWith('/storage/v1/upload/resumable/'));}catch(_){return false;}};
 if(resume.url&&!allowed(resume.url))throw Error('DOCUMENT_UPLOAD_ENDPOINT_INVALID');
 return new Promise((resolve,reject)=>{
  let timer,settled=false;
  const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve({error:null});};
  const active=()=>{if(settled)throw Error('DOCUMENT_TRANSFER_STOPPED');check();};
  const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>{finish(Object.assign(Error('DOCUMENT_TRANSFER_TIMEOUT'),{code:'DOCUMENT_TRANSFER_TIMEOUT'}));transfer.abort().catch(()=>{});},120000);};
  const transfer=new Upload(file,{
   endpoint,uploadUrl:resume.url||null,chunkSize:6*1024*1024,retryDelays:[0,1000,3000,5000,10000],
   uploadDataDuringCreation:false,storeFingerprintForResuming:false,removeFingerprintOnSuccess:true,
   metadata:{bucketName:prepared.bucket,objectName:prepared.path,contentType:file.type,cacheControl:'3600'},
   onBeforeRequest:async request=>{active();if(!allowed(request.getURL()))throw Error('DOCUMENT_UPLOAD_ENDPOINT_INVALID');touch();const session=await client.auth.getSession();active();if(session.error||!session.data?.session?.access_token)throw Error('DOCUMENT_SESSION_UNAVAILABLE');request.setHeader('authorization','Bearer '+session.data.session.access_token);touch();},
   onAfterResponse:()=>{active();touch();},
   onUploadUrlAvailable:()=>{active();if(!allowed(transfer.url))throw Error('DOCUMENT_UPLOAD_ENDPOINT_INVALID');if(resume.onUrl)resume.onUrl(transfer.url);touch();},
   onProgress:()=>{try{active();touch();}catch(e){finish(e);transfer.abort().catch(()=>{});}},
   onError:error=>{const status=error.originalResponse?.getStatus();if(status===409||/already exists|duplicate/i.test(error.message||''))finish();else finish(error);},
   onSuccess:()=>{try{active();finish();}catch(e){finish(e);}}
  });touch();transfer.start();
 });
}
window.DocumentTransfer=Object.freeze({hash,upload,MAX_BYTES});
