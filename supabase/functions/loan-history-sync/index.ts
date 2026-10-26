import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {authorizeSync,claimSync,runClaimedSync} from './worker.mjs';
declare const EdgeRuntime:{waitUntil:(task:Promise<unknown>)=>void};
Deno.serve(async(request:Request)=>{
 const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.method!=='POST')return json(405,{error:'HISTORY_SYNC_METHOD_INVALID'});
 // This worker has no browser CORS entry point. The gateway JWT and a separate
 // Vault/runtime secret are both required by its scheduler/manual DB caller.
 if(request.headers.get('origin'))return json(403,{error:'HISTORY_SYNC_DENIED'});
 try{
  const reader=request.body?.getReader();let raw='';
  if(reader)for(;;){const part=await reader.read();if(part.done)break;raw+=new TextDecoder().decode(part.value);if(raw.length>512){await reader.cancel();return json(400,{error:'HISTORY_SYNC_REQUEST_INVALID'});}}
  let body;try{body=JSON.parse(raw);}catch(_){return json(400,{error:'HISTORY_SYNC_REQUEST_INVALID'});}
  const runId=authorizeSync(body,request.headers.get('x-history-sync-secret'),Deno.env.get('LOAN_HISTORY_SYNC_SECRET'));
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const claim=await claimSync(client,runId);
  if(!claim.claimed)return json(200,{accepted:false,coalesced:true});
  EdgeRuntime.waitUntil(runClaimedSync(client,runId,claim,(key:string)=>Deno.env.get(key)));
  return json(202,{accepted:true});
 }catch(error){
  const message=error instanceof Error?error.message:'';
  const code=/^HISTORY_SYNC_[A-Z_]+$/.test(message)?message:'HISTORY_SYNC_UNAVAILABLE';
  return json(code.endsWith('DENIED')?403:code.endsWith('REQUEST_INVALID')?400:409,{error:code});
 }
});
