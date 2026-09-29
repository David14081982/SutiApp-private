'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const {stripTypeScriptTypes}=require('module');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),env={};
for(const line of read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0)env[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0],remote=process.argv.includes('--remote');
async function requestState(){
 const query="select id,status,financial_approval_snapshot is not null approved,md5(to_jsonb(r)::text) fingerprint from program_requests r where folio='SR-2026-000432'";
 const r=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:true})});assert(r.ok);return(await r.json())[0];
}
async function login(prefix){const r=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env[prefix+'_EMAIL'],password:env[prefix+'_PASSWORD']})});assert(r.ok,'LOGIN_FAILED');return r.json();}
async function main(){
 const before=await requestState(),session=await login('H005_TEST'),calls=[];
 let result,denied;
 if(remote){
  const invoke=async token=>{const response=await fetch(env.SUPABASE_URL+'/functions/v1/financial-legacy',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'approvalReview',request_id:before.id})});return{status:response.status,body:await response.json()};};
  result=await invoke(session.access_token);denied=await invoke(env.SUPABASE_PUBLISHABLE_KEY);
 }else{
  const lib=new Function(read('app/vendor/supabase-js-2.112.3/supabase.min.js')+';return supabase;')();
  const createClient=(url,key,options)=>lib.createClient(url,key,{...options,global:{...options?.global,fetch:async(url,init)=>{
   const route=String(url).split('/rest/v1/')[1]||'',method=init?.method||'GET';
   if(!['GET','HEAD'].includes(method)&&!/^rpc\/(has_admin_permission|get_current_loan_term_policy|get_financial_runtime_rules|resolve_suti_loan_quote_contract|required_guarantor_document_codes)$/.test(route))throw Error('AUDIT_WRITE_BLOCKED');
   calls.push({route:route.split('?')[0],method});return fetch(url,init);
  }}});
  const context={createClient,Deno:{env:{get:name=>name==='SUPABASE_ANON_KEY'?env.SUPABASE_PUBLISHABLE_KEY:env[name]},serve:()=>{}},crypto:globalThis.crypto,TextEncoder,URL,Request,Response,AbortController,setTimeout,clearTimeout,console,
   ...require(path.join(root,'supabase/functions/financial-legacy/visibility-policy.js')),...require(path.join(root,'supabase/functions/financial-legacy/request-google-sync.js'))};
  vm.createContext(context);vm.runInContext(stripTypeScriptTypes(read('supabase/functions/financial-legacy/index.ts').replace(/^import[^\n]+\n/gm,''))+';this.review=approveRequest;',context);
  result=await context.review({request_id:before.id},env.SUPABASE_URL,'Bearer '+session.access_token,session.user.id,true);
  denied=await context.review({request_id:before.id},env.SUPABASE_URL,'','',true);
 }
 assert.equal(result.status,200);assert.equal(result.body.data.phase,'NEW_REQUEST_REQUIRED');assert.equal(result.body.data.current.maxAmount,30000);assert.equal(result.body.data.submitted.amount,50000);assert([401,403].includes(denied.status));
 const after=await requestState();assert.equal(after.fingerprint,before.fingerprint);assert.equal(after.approved,false);
 const proof={status:'PASS',mode:remote?'deployed':'local-edge-real-reads',phase:result.body.data.phase,submittedAmount:50000,currentLimit:30000,anonymousDenied:true,requestUnchanged:true,approvalAttempts:0,productionBusinessWrites:0,calls};
 fs.mkdirSync(path.join(root,'docs/qa/evidence/loan-approval-resolution-20260928'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/evidence/loan-approval-resolution-20260928/'+(remote?'remote':'local')+'-preflight.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
