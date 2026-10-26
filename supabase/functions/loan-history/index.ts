import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {loadHistory,HistoryError} from './history.mjs';
import {readHistorySource} from './source.mjs';
const origins=(Deno.env.get('ALLOWED_APP_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('origin')||'',headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(origins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'});
 const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.includes(origin))return json(403,{error:'HISTORY_ORIGIN_DENIED'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return json(405,{error:'HISTORY_METHOD_INVALID'});
 const authorization=request.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return json(401,{error:'HISTORY_AUTH_REQUIRED'});
 try{
  const reader=request.body?.getReader();let raw='';
  if(reader)for(;;){const part=await reader.read();if(part.done)break;raw+=new TextDecoder().decode(part.value);if(raw.length>1024){await reader.cancel();return json(400,{error:'HISTORY_REQUEST_INVALID'});}}
  let body;try{body=JSON.parse(raw);}catch(_){return json(400,{error:'HISTORY_REQUEST_INVALID'});}
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  return json(200,await loadHistory(body,client,(folio:string)=>readHistorySource(folio,(key:string)=>Deno.env.get(key))));
 }catch(error){const code=error instanceof HistoryError?error.message:'HISTORY_UNAVAILABLE';
  return json(code.endsWith('AUTH_REQUIRED')?401:code.endsWith('DENIED')||code.endsWith('CONTEXT_CHANGED')?403:code.endsWith('REQUEST_INVALID')?400:409,{error:code});}
});
