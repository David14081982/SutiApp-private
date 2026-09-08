import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const origins=new Set(['https://sutiapp.com','https://www.sutiapp.com','https://david14081982.github.io']);
const headers=(origin:string|null)=>({'Content-Type':'application/json','Cache-Control':'no-store',...(origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})});
const hash=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
async function google(payload:Record<string,unknown>){
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:Deno.env.get('GOOGLE_VISIBILITY_OAUTH_CLIENT_ID')||'',client_secret:Deno.env.get('GOOGLE_VISIBILITY_OAUTH_CLIENT_SECRET')||'',refresh_token:Deno.env.get('GOOGLE_VISIBILITY_OAUTH_REFRESH_TOKEN')||'',grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy'}),signal:AbortSignal.timeout(15000)});
  const token=await tokenResponse.json();if(!tokenResponse.ok||!token.access_token)throw Error('REQUEST_DELETE_GOOGLE_AUTH_FAILED');
  const response=await fetch(Deno.env.get('FINANCIAL_LEGACY_API_URL')||'',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token.access_token},body:JSON.stringify({...payload,secret:Deno.env.get('FINANCIAL_LEGACY_API_TOKEN')}),signal:AbortSignal.timeout(30000)});
  let result;try{result=JSON.parse(await response.text());}catch{throw Error('REQUEST_DELETE_GOOGLE_UNAVAILABLE');}
  if(!response.ok||!result?.ok)throw Error(/^[A-Z_]{3,100}$/.test(result?.error||'')?result.error:'REQUEST_DELETE_GOOGLE_UNAVAILABLE');
  if(result.action!=='delete_request'||result.program_request_id!==payload.program_request_id||result.operation_id!==payload.operation_id)throw Error('REQUEST_DELETE_RESPONSE_INVALID');
  return result;
}
Deno.serve(async(req)=>{
  const origin=req.headers.get('origin'),reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:headers(origin)});
  if(origin&&!origins.has(origin))return reply(403,{error:'ORIGIN_DENIED'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
  if(req.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return reply(401,{error:'AUTH_REQUIRED'});
  let body;try{body=await req.json();}catch{return reply(400,{error:'INVALID_JSON'});}
  if(!body||Object.keys(body).some(k=>!['request_id','folio','updated_at','reason'].includes(k))||typeof body.request_id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.request_id)||typeof body.folio!=='string'||typeof body.reason!=='string')return reply(400,{error:'INVALID_REQUEST'});
  const url=Deno.env.get('SUPABASE_URL')||'',client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:user,error:authError}=await client.auth.getUser();if(authError||!user.user)return reply(401,{error:'AUTH_INVALID'});
  const {data:prepared,error}=await client.rpc('prepare_admin_request_delete',{p_request_id:body.request_id,p_folio:body.folio,p_updated_at:body.updated_at||null,p_reason:body.reason});
  if(error)return reply(error.code==='42501'?403:409,{error:/^REQUEST_[A-Z_]+$/.test(error.message)?error.message:'REQUEST_DELETE_UNAVAILABLE'});
  if(prepared.phase==='completed')return reply(200,{data:{deleted:true,request_id:prepared.request_id,folio:prepared.folio}});
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SUPABASE_SECRET_KEY')||'',{auth:{persistSession:false}});
  try{
    const {data:job,error:jobError}=await service.from('program_request_deletions').select('id,request_id,folio,phase,snapshot,google_backup').eq('id',prepared.id).single();if(jobError||!job)throw Error('REQUEST_DELETE_UNAVAILABLE');
    if(job.phase!=='google_deleted'){
      const r=job.snapshot.request,initial=job.snapshot.sync?.initial_row;
      const payload={action:'delete_request',contract_version:'REQUEST_DELETE_V1',program_request_id:r.id,request_folio:r.folio,numero_control:r.numero_control,request_created_at:r.created_at,initial_sha256:initial?await hash(initial):null,operation_id:job.id};
      const inspected=await google({...payload,mode:'inspect'});
      if(job.google_backup&&!inspected.deleted&&!inspected.recovering&&job.google_backup.fingerprint!==inspected.fingerprint)throw Error('REQUEST_DELETE_CHANGED');
      if(!job.google_backup){if(!inspected.backup)throw Error('REQUEST_DELETE_BACKUP_REQUIRED');const saved=await service.rpc('record_request_delete_google',{p_deletion_id:job.id,p_backup:inspected.backup,p_deleted:false});if(saved.error)throw Error('REQUEST_DELETE_BACKUP_FAILED');}
      if(!inspected.deleted){const applied=await google({...payload,mode:'apply',fingerprint:inspected.fingerprint});if(applied.deleted!==true)throw Error('REQUEST_DELETE_GOOGLE_UNAVAILABLE');}
      const confirmed=await service.rpc('record_request_delete_google',{p_deletion_id:job.id,p_backup:null,p_deleted:true});if(confirmed.error)throw Error('REQUEST_DELETE_CONFIRMATION_FAILED');
    }
    const finished=await service.rpc('finish_admin_request_delete',{p_deletion_id:job.id});if(finished.error)throw Error('REQUEST_DELETE_FINALIZE_FAILED');
    return reply(200,{data:finished.data});
  }catch(error){const code=error instanceof Error?error.message:'';return reply(503,{error:/^[A-Z_]{3,100}$/.test(code)?code:'REQUEST_DELETE_RETRY_REQUIRED'});}
});
