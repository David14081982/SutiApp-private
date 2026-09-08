'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const folder=path.resolve(__dirname,'../docs/qa/evidence/requests-workflow-google-sync-20260908'),env={};
for(const line of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE||'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)env[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
async function request(route,body,token){const r=await fetch(env.SUPABASE_URL+route,{method:body===undefined?'GET':'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});return {http:r.status,data:await r.json().catch(()=>null)};}
async function main(){
 const tests=[],id=JSON.parse(fs.readFileSync(path.join(folder,'live-requests.json'),'utf8'))[0].id;
 const session=await request('/auth/v1/token?grant_type=password',{email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD});assert.equal(session.http,200);const token=session.data.access_token;
 for(const [name,route,body,auth] of [
 ['anonymous summary denied','/rest/v1/rpc/get_program_request_google_sync',{p_request_id:id},null],
 ['browser transport claim denied','/rest/v1/rpc/claim_program_request_google_sync',{p_request_id:id},token],
 ['browser outbox table denied','/rest/v1/program_request_google_sync?select=request_id&limit=1',undefined,token],
 ['unauthenticated Edge denied','/functions/v1/financial-legacy',{action:'syncRequest',request_id:id},null]]){
  const result=await request(route,body,auth);assert([401,403].includes(result.http),name);tests.push({test:name,http:result.http,result:'PASS'});
 }
 const worker=JSON.parse(fs.readFileSync('C:/tmp/sutiapp-requests-workflow-sync-backup-20260908/worker-config.json','utf8'));
 const denied=await fetch(worker.url,{method:'POST',headers:{Authorization:'Bearer '+worker.gatewayJwt,'Content-Type':'application/json','x-request-sync-key':'deliberately-invalid-key'},body:'{"action":"syncRequestQueue"}',signal:AbortSignal.timeout(45000)});assert([401,403].includes(denied.status));tests.push({test:'valid gateway JWT without worker secret denied',http:denied.status,result:'PASS'});
 const proof={status:'PASS',tests,unlinkedIdentity:'PASS in installed-sql.json; real SECURITY DEFINER functions, transaction rolled back',secretsLogged:false,permissionWrites:0};fs.writeFileSync(path.join(folder,'security-live.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(()=>{console.error(JSON.stringify({status:'FAIL',error:'SECURITY_ASSERTION_FAILED'}));process.exitCode=1;});
