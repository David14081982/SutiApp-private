import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { documentOperation, documentError, internalVerificationAuthorized } from '../_shared/document-integration.mjs';
import {verifyStoredDocument} from '../_shared/document-stream.mjs';
const verify=null;
Deno.serve(async(req)=>{
 const url=Deno.env.get('SUPABASE_URL')||'';
 const allowed=(Deno.env.get('ALLOWED_APP_ORIGINS')||'').split(',').map(x=>x.trim());
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'private, no-store','Access-Control-Allow-Origin':allowed.includes(origin)?origin:'','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const out=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(!(Deno.env.get('DOCUMENT_PHASE4')==='PRODUCTION_V1'&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))&&(Deno.env.get('DOCUMENT_PHASE4')!=='LOCAL_ONLY'||!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(url)))return out(503,{error:'DOCUMENT_INTEGRATION_NOT_ACTIVATED'});
 if(origin&&!allowed.includes(origin))return out(403,{error:'ORIGIN_DENIED'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out(405,{error:'METHOD_NOT_ALLOWED'});
 const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return out(401,{error:'AUTH_REQUIRED'});
 const body=await req.json().catch(()=>null),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(body?.action==='VERIFY_INTERNAL'){
  if(!internalVerificationAuthorized(body,Deno.env.get('DOCUMENT_VERIFIER_SECRET')||'',req.headers.get('x-document-verifier-signature')))return out(403,{error:'DOCUMENT_CONTEXT_DENIED'});
  if(body.existing_read!==true||!body.descriptor||!['private-assets','documents','generated-documents'].includes(body.descriptor.bucket))return out(400,{error:'INVALID_OPERATION'});
  try{const privileged=createClient(url,serviceKey,{auth:{persistSession:false}});return out(200,await verifyStoredDocument(privileged,body.descriptor,{existingRead:true}));}catch(e){const r=documentError(e);return out(r.status,r.body);}
 }
 const user=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const identity=await user.auth.getUser(auth.slice(7));if(identity.error||!identity.data.user)return out(401,{error:'AUTH_INVALID'});
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
 const result=await documentOperation(body,user,service,verify);return out(result.status,result.body);
});

