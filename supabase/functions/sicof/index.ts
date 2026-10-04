import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {dispatchSicof} from './handler.mjs';
import {dispatchSicofSourceRefreshJob,sourceCacheState} from './source-cache.mjs';
import {readSicofRequestBody} from './file-workspace.mjs';
const origins=(Deno.env.get('ALLOWED_APP_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);
Deno.serve(async (request:Request)=>{
  const origin=request.headers.get('origin')||'',headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'});
  const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
  if(origin&&!origins.includes(origin))return json(403,{error:'SICOF_ORIGIN_DENIED'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json(405,{error:'SICOF_METHOD_INVALID'});
  const authorization=request.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return json(401,{error:'SICOF_AUTH_REQUIRED'});
  try {
    const body=await readSicofRequestBody(request),dependencies={
      env:(key:string)=>Deno.env.get(key),loadExcelJS:async()=>(await import('npm:exceljs@4.4.0')).default,
      createUserClient:(auth:string)=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}}),
      createServiceClient:()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
    };
    const data=body?.action==='REFRESH_SOURCE_JOB'?
      await dispatchSicofSourceRefreshJob(body,request,dependencies):await dispatchSicof(body,authorization,dependencies);
    return json(200,data);
  } catch(error) {
    const message=error instanceof Error?error.message:'',safe=/^(SICOF|SAVINGS)_[A-Z_]+$/.test(message)?message:'SICOF_UNAVAILABLE';
    const sourceState=error instanceof Error&&'sourceState' in error?sourceCacheState(error.sourceState):null;
    return json(safe.includes('AUTH_REQUIRED')?401:safe.includes('DENIED')?403:409,{error:safe,...(sourceState?{source:sourceState}:{})});
  }
});
