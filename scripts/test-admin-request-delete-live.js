'use strict';
// Production negatives/read-only preview. Never sends a valid deletion confirmation.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,cp=require('child_process');
const root=path.resolve(__dirname,'..'),env={},dir='C:/tmp/sutiapp-request-delete-20260908';
for(const l of fs.readFileSync('C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const base=env.SUPABASE_URL,api='https://api.supabase.com/v1/projects/'+new URL(base).hostname.split('.')[0];
async function call(url,body,token){const r=await fetch(url,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),Origin:'https://sutiapp.com'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});return{status:r.status,data:await r.json()};}
async function sql(query){const r=await fetch(api+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:true})});assert(r.ok);return r.json();}
async function main(){
 if(process.argv[2]==='build'){
  cp.execFileSync(process.execPath,[root+'/scripts/build-pages-site.js',dir+'/site'],{env:{...process.env,SUTIAPP_SUPABASE_URL:base,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'inherit'});return;
 }
 const checksum="select (select count(*) from public.program_request_deletions) as jobs,(select md5(string_agg(to_jsonb(r)::text,',' order by id)) from public.program_requests r) as requests,(select count(*) from public.request_documents) as documents,(select count(*) from public.affiliate_documents) as dossier,(select count(*) from public.affiliate_files) as files,(select count(*) from public.private_assets) as assets";
 const before=(await sql(checksum))[0],r=(await sql("select id,folio,updated_at from public.program_requests where folio='SR-2026-000175'"))[0];assert(r);
 const auth=await call(base+'/auth/v1/token?grant_type=password',{email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD});assert.equal(auth.status,200);const token=auth.data.access_token;
 const preview=await call(base+'/rest/v1/rpc/get_admin_request_delete_preview',{p_request_id:r.id},token);assert.equal(preview.status,200);assert.equal(preview.data.folio,r.folio);assert.equal(preview.data.phase,'available');
 const anon=await call(base+'/rest/v1/rpc/get_admin_request_delete_preview',{p_request_id:r.id});assert(anon.status>=400);
 // Guaranteed mismatch: no prepared job, no Google request, no DELETE.
 const denied=await call(base+'/functions/v1/request-delete',{request_id:r.id,folio:'INVALID_CONFIRMATION',updated_at:r.updated_at,reason:'Negative test; must fail before prepare'},token);
 fs.writeFileSync(dir+'/edge-negative.json',JSON.stringify(denied));assert.equal(denied.status,409);assert.equal(denied.data.error,'REQUEST_DELETE_CONFIRMATION_MISMATCH');
 const unauthorized=await call(base+'/functions/v1/request-delete',{request_id:r.id,folio:'INVALID_CONFIRMATION',reason:'Negative test'});assert(unauthorized.status>=400);
 const table=await fetch(base+'/rest/v1/program_request_deletions?select=id',{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token}});assert.equal(table.status,403);
 const after=(await sql(checksum))[0];assert.deepEqual(after,before);
 const proof={status:'PASS',adminPreview:true,anonymousDenied:true,invalidConfirmationDenied:true,journalBrowserDenied:true,businessHashesUnchanged:true,deletionJobs:after.jobs,productionDeletes:0,documents:after.documents,dossier:after.dossier,files:after.files,assets:after.assets};
 fs.writeFileSync(root+'/docs/qa/evidence/admin-request-delete-20260908/backend-live.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;});
