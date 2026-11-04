import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { deleteDocument, validRequest } from './handler.mjs';
const origins=(Deno.env.get('ALLOWED_APP_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 const headers={'Access-Control-Allow-Origin':origin&&origins.includes(origin)?origin:origins[0]||'', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json','Cache-Control':'private, no-store, max-age=0'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.includes(origin))return reply(403,{error:'ORIGIN_DENIED'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return reply(401,{error:'AUTH_REQUIRED'});
 const body=await req.json().catch(()=>null);if(!validRequest(body))return reply(400,{error:'INVALID_DOCUMENT_DELETE_REQUEST'});
 const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_ANON_KEY')||'',secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SUPABASE_SECRET_KEY')||'';
 if(!url||!key||!secret)return reply(503,{error:'DOCUMENT_DELETE_UNAVAILABLE'});
 const user=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const authenticated=await user.auth.getUser(authorization.slice(7));
 if(authenticated.error||!authenticated.data.user)return reply(401,{error:'AUTH_INVALID'});
 const service=createClient(url,secret,{auth:{persistSession:false}});
 try{const result=await deleteDocument(user,service,authenticated.data.user.id,body);return reply(result.status,result.body);}
 catch{return reply(503,{error:'DOCUMENT_DELETE_UNAVAILABLE'});}
});
