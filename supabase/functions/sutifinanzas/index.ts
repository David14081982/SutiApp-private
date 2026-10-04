import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {loadReport,readGoogle,ReportError} from './report.mjs';
const origins=(Deno.env.get('ALLOWED_APP_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);
Deno.serve(async(request:Request)=>{
  const origin=request.headers.get('origin')||'';
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'});
  const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
  if(origin&&!origins.includes(origin))return json(403,{error:'ORIGIN_DENIED'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json(405,{error:'METHOD_INVALID'});
  const authorization=request.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return json(401,{error:'AUTH_REQUIRED'});
  try{
    const reader=request.body?.getReader();let raw='';
    if(reader)for(;;){const part=await reader.read();if(part.done)break;raw+=new TextDecoder().decode(part.value);if(raw.length>1024){await reader.cancel();return json(400,{error:'REQUEST_INVALID'});}}
    let body;try{body=JSON.parse(raw);}catch(_){return json(400,{error:'REQUEST_INVALID'});}
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    return json(200,await loadReport(body,client,()=>readGoogle((key:string)=>Deno.env.get(key))));
  }catch(error){
    const safe=error instanceof ReportError?error.message:'SOURCE_UNAVAILABLE';
    return json(safe==='AUTH_REQUIRED'?401:safe==='ADMIN_DENIED'?403:safe==='REQUEST_INVALID'?400:409,{error:safe,...(error instanceof ReportError?error.details:{})});
  }
});
