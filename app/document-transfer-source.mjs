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
async function upload(client,prepared,file,check=()=>{}) {
 if(file.size>MAX_BYTES)throw Error('INVALID_DOCUMENT_FILE');
 const config=window.__SUTIAPP_CONFIG__.supabase,url=new URL(config.url);
 if(!/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname))throw Error('DOCUMENT_UPLOAD_ENDPOINT_INVALID');
 const endpoint='https://'+url.hostname.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable';
 return new Promise((resolve,reject)=>{
  const transfer=new Upload(file,{
   endpoint,chunkSize:6*1024*1024,retryDelays:[0,1000,3000,5000,10000],
   uploadDataDuringCreation:false,storeFingerprintForResuming:false,removeFingerprintOnSuccess:true,
   metadata:{bucketName:prepared.bucket,objectName:prepared.path,contentType:file.type,cacheControl:'3600'},
   onBeforeRequest:async request=>{check();const session=await client.auth.getSession();if(session.error||!session.data?.session?.access_token)throw Error('DOCUMENT_SESSION_UNAVAILABLE');request.setHeader('authorization','Bearer '+session.data.session.access_token);},
   onProgress:()=>{try{check();}catch(e){transfer.abort();reject(e);}},
   onError:error=>{const status=error.originalResponse?.getStatus();if(status===409||/already exists|duplicate/i.test(error.message||''))resolve({error:null});else reject(error);},
   onSuccess:()=>{try{check();resolve({error:null});}catch(e){reject(e);}}
  });transfer.start();
 });
}
window.DocumentTransfer=Object.freeze({hash,upload,MAX_BYTES});
