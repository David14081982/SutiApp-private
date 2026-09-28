import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import * as PDFLib from 'https://esm.sh/pdf-lib@1.17.1';
import { createRenderer, syntheticSnapshot } from './renderer.mjs';
import {handleLayout} from './layout-service.mjs';

const render=createRenderer(PDFLib),bucket='generated-documents';
const origins=(Deno.env.get('ALLOWED_APP_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
const cleanError=(e:unknown)=>/^DOCUMENT_[A-Z0-9_]+$/.test(String((e as Error)?.message))?(e as Error).message:'DOCUMENT_PROCESSING_FAILED';
async function rpc(client:any,name:string,action:string,data:unknown={}){const r=await client.rpc(name,{p_action:action,p_data:data});if(r.error)throw Error(r.error.message);return r.data;}
const worker=(action:string,data:unknown={})=>rpc(service,'document_generation_worker',action,data);
async function loadAsset(asset:any){
 if(!asset||!/^assets\/[0-9a-f-]+\.(pdf|png|jpg)$/.test(asset.path))throw Error('DOCUMENT_ASSET_PATH_INVALID');
 const r=await service.storage.from(bucket).download(asset.path);if(r.error||!r.data)throw Error('DOCUMENT_ASSET_UNAVAILABLE');
 const bytes=new Uint8Array(await r.data.arrayBuffer());if(await hash(bytes)!==asset.sha256)throw Error('DOCUMENT_ASSET_HASH_MISMATCH');return bytes;
}
async function work(){
 // One PDF per invocation bounds memory/CPU. Cron provides durable independent dispatch.
 const job=await worker('CLAIM');if(!job||job.skipped)return {processed:0};
 try{
  const output=await render(job.document_snapshot,loadAsset),sha256=await hash(output.bytes),path='issued/'+job.id+'.pdf';
  const upload=await service.storage.from(bucket).upload(path,output.bytes,{contentType:'application/pdf',upsert:false,cacheControl:'0'});
  if(upload.error){const existing=await service.storage.from(bucket).download(path);if(existing.error||!existing.data||await hash(new Uint8Array(await existing.data.arrayBuffer()))!==sha256)throw Error('DOCUMENT_STORAGE_WRITE_FAILED');}
  await worker('READY',{id:job.id,lease_id:job.lease_id,path,sha256,snapshot_sha256:await hash(new TextEncoder().encode(JSON.stringify(job.document_snapshot)))});
  return {processed:1};
 }catch(e){await worker('FAILED',{id:job.id,lease_id:job.lease_id,error_code:cleanError(e)});return {processed:0,failed:1};}
}
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin');
 const headers={'Access-Control-Allow-Origin':origin&&origins.includes(origin)?origin:'','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'private, no-store, max-age=0'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
 if(origin&&!origins.includes(origin))return reply(403,{error:'DOCUMENT_ORIGIN_DENIED'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'DOCUMENT_METHOD_DENIED'});
 try{
  const key=req.headers.get('x-document-worker-key');
  if(key){const expected=Deno.env.get('DOCUMENT_GENERATION_WORKER_KEY');if(!expected||await hash(new TextEncoder().encode(key))!==await hash(new TextEncoder().encode(expected)))return reply(403,{error:'DOCUMENT_WORKER_DENIED'});return reply(200,await work());}
  const authorization=req.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return reply(401,{error:'DOCUMENT_AUTH_REQUIRED'});
  const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const user=await client.auth.getUser();if(user.error||!user.data.user)return reply(401,{error:'DOCUMENT_AUTH_INVALID'});
  if(Number(req.headers.get('content-length'))>12000000)return reply(413,{error:'DOCUMENT_UPLOAD_TOO_LARGE'});
  const body=await req.json(),command=(action:string,data:unknown={})=>rpc(client,'document_generation_command',action,data);
  if(['LAYOUT_MANIFEST','LAYOUT_SAVE','LAYOUT_ACTIVATE','LAYOUT_SYSTEM','LAYOUT_PREVIEW'].includes(body.action)){
   const result=await handleLayout(body,{contextCall:(action,data)=>rpc(client,'document_layout_context',action,data),command,persist:(action,data)=>rpc(service,'document_layout_persist',action,data),render,loadAsset});
   if(result.pdf)return new Response(result.pdf,{status:200,headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="distribucion.pdf"'}});
   return reply(result.status,result.data);
  }
  if(body.action==='UPLOAD'){
   const permission=await command('UPLOAD_PERMISSION',{kind:body.kind});
   if(typeof body.base64!=='string'||body.base64.length>11200000)throw Error('DOCUMENT_UPLOAD_TOO_LARGE');
   const bytes=Uint8Array.from(atob(body.base64),(v)=>v.charCodeAt(0));if(!bytes.length||bytes.length>8388608)throw Error('DOCUMENT_UPLOAD_TOO_LARGE');
   let dimensions,mime,extension;
   if(body.kind==='TEMPLATE'){
    if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('DOCUMENT_PDF_REQUIRED');
    const doc=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false});if(doc.getPageCount()!==1||doc.isEncrypted)throw Error('DOCUMENT_TEMPLATE_SINGLE_PAGE_REQUIRED');
    // Embed only page graphics during rendering; uploaded actions/scripts never reach issued PDFs.
    dimensions=doc.getPage(0).getSize();if(dimensions.width<250||dimensions.height<250||dimensions.width>1500||dimensions.height>1500)throw Error('DOCUMENT_PAGE_SIZE_INVALID');mime='application/pdf';extension='pdf';
   }else{
    const doc=await PDFLib.PDFDocument.create();const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
    if(!png&&!(bytes[0]===255&&bytes[1]===216))throw Error('DOCUMENT_SIGNATURE_FORMAT_INVALID');
    const image=png?await doc.embedPng(bytes):await doc.embedJpg(bytes);dimensions={width:image.width,height:image.height};
    if(image.width>4096||image.height>4096||image.width*image.height>8388608)throw Error('DOCUMENT_SIGNATURE_DIMENSIONS_INVALID');mime=png?'image/png':'image/jpeg';extension=png?'png':'jpg';
   }
   const path='assets/'+crypto.randomUUID()+'.'+extension;
   const uploaded=await service.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'0'});if(uploaded.error)throw Error('DOCUMENT_UPLOAD_FAILED');
   try{return reply(200,await worker('REGISTER_ASSET',{kind:body.kind,path,sha256:await hash(bytes),mime,size:bytes.length,dimensions,actor:permission.actor}));}
   catch(e){await service.storage.from(bucket).remove([path]);throw e;}
  }
  if(body.action==='ACCESS'||body.action==='ASSET_ACCESS'){
   const asset=await command(body.action,body.data||{});const signed=await service.storage.from(bucket).createSignedUrl(asset.path,120);
   if(signed.error)throw Error('DOCUMENT_ACCESS_UNAVAILABLE');return reply(200,{url:signed.data.signedUrl,expires_in:120,mime:asset.mime||'application/pdf'});
  }
  if(body.action==='PREVIEW'){
   const config=await command('PREVIEW_CONFIG',{...body.config,program:body.program,document_type:body.document_type});
   const output=await render(syntheticSnapshot(body.document_type,body.program,config),loadAsset,{preview:true});
   return new Response(output.bytes,{status:200,headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="vista-previa.pdf"'}});
  }
  return reply(400,{error:'DOCUMENT_ACTION_INVALID'});
 }catch(e){const code=cleanError(e);return reply(/DENIED|AUTH_/.test(code)?403:409,{error:code});}
});
