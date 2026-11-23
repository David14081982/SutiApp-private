'use strict';
// H-REQUEST-DATE-SONORA-001: publish the financial-handoff Apps Script with J in Sonora time.
// Modes: preflight | deploy-google | verify | rollback. No Supabase, SQL or sheet data writes.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'),mode=process.argv[2];
const backup='C:/tmp/sutiapp-request-date-sonora-backup-20261123',evidence=path.join(root,'docs/qa/evidence/request-date-sonora-20261123');
const scriptId='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o',deploymentId='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g';
const BASE_VERSION=30,google='https://script.googleapis.com/v1/projects/'+scriptId;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),norm=s=>s.replace(/\r/g,'').trim();
const normalize=c=>JSON.stringify(c.files.map(f=>({name:f.name,type:f.type,source:norm(f.source)})).sort((a,b)=>a.name.localeCompare(b.name)));
async function json(url,options){const r=await fetch(url,{...options,signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('REMOTE_HTTP_'+r.status);return r.json();}
async function oauth(){const a=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;return (await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:a.client_id,client_secret:a.client_secret,refresh_token:a.refresh_token,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'})})).access_token;}
function proof(file,value){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,file),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
const local=name=>fs.readFileSync(path.join(root,'google-apps-script/financial-handoff',name),'utf8');
async function main(){
  assert(['preflight','deploy-google','verify','rollback'].includes(mode),'MODE_REQUIRED');
  const gh={Authorization:'Bearer '+await oauth(),'Content-Type':'application/json'};
  const before=JSON.parse(fs.readFileSync(path.join(backup,'google-content-before.json'),'utf8'));
  const deployment=await json(google+'/deployments/'+deploymentId,{headers:gh});
  if(mode==='rollback'){
    await json(google+'/deployments/'+deploymentId,{method:'PUT',headers:gh,body:JSON.stringify({deploymentConfig:{...deployment.deploymentConfig,versionNumber:BASE_VERSION,description:'Rollback H-REQUEST-DATE-SONORA-001 to v'+BASE_VERSION}})});
    const after=await json(google+'/deployments/'+deploymentId,{headers:gh});assert.equal(after.deploymentConfig.versionNumber,BASE_VERSION);
    proof('rollback.json',{status:'PASS',version:BASE_VERSION});return;
  }
  if(mode==='verify'){
    const g=JSON.parse(fs.readFileSync(path.join(evidence,'google-deploy.json'),'utf8')),c=await json(google+'/content?versionNumber='+deployment.deploymentConfig.versionNumber,{headers:gh});
    assert.equal(deployment.deploymentConfig.versionNumber,g.version);assert.equal(sha(norm(c.files.find(f=>f.name==='Code').source)),g.codeSha256);
    assert.equal(sha(norm(c.files.find(f=>f.name==='LoanTransfer').source)),sha(norm(before.files.find(f=>f.name==='LoanTransfer').source)));
    proof('deployment-readback.json',{status:'PASS',version:g.version,codeSha256:g.codeSha256,loanTransferUnchanged:true,sameDeployment:deploymentId.slice(0,12)+'…'});return;
  }
  // Drift guards: the live deployment and the editable HEAD must still equal the backed-up v30.
  assert.equal(deployment.deploymentConfig.versionNumber,BASE_VERSION,'DEPLOYMENT_DRIFT');
  assert.equal(normalize(await json(google+'/content',{headers:gh})),normalize(before),'UNPUBLISHED_GOOGLE_DRIFT');
  assert.equal(normalize(await json(google+'/content?versionNumber='+BASE_VERSION,{headers:gh})),normalize(before),'DEPLOYED_SOURCE_DRIFT');
  assert.equal(norm(local('LoanTransfer.gs')),norm(before.files.find(f=>f.name==='LoanTransfer').source),'LOAN_TRANSFER_MUST_NOT_CHANGE');
  const code=local('Code.gs'),files=before.files.map(f=>({name:f.name,type:f.type,source:f.name==='Code'?code:f.source}));
  const manifest=JSON.parse(files.find(f=>f.name==='appsscript').source);assert.equal(manifest.webapp.access,'ANYONE');assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
  for(const name of ['test-request-register-sonora-date.js'])assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'gas-tests.json'),'utf8')).status,'PASS',name);
  if(mode==='preflight'){proof('preflight.json',{status:'PASS',baseVersion:BASE_VERSION,baseCodeSha256:sha(norm(before.files.find(f=>f.name==='Code').source)),candidateCodeSha256:sha(norm(code)),files:files.map(f=>f.name)});return;}
  await json(google+'/content',{method:'PUT',headers:gh,body:JSON.stringify({files})});
  const v=await json(google+'/versions',{method:'POST',headers:gh,body:JSON.stringify({description:'H-REQUEST-DATE-SONORA-001: Fecha solicitud (J) en hora de Sonora'})});
  await json(google+'/deployments/'+deploymentId,{method:'PUT',headers:gh,body:JSON.stringify({deploymentConfig:{...deployment.deploymentConfig,versionNumber:v.versionNumber,description:'Request register: J en hora de Sonora'}})});
  assert.equal(normalize(await json(google+'/content?versionNumber='+v.versionNumber,{headers:gh})),normalize({files}));
  proof('google-deploy.json',{status:'PASS',previousVersion:BASE_VERSION,version:v.versionNumber,codeSha256:sha(norm(code)),sameDeployment:true,access:manifest.webapp.access});
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',mode,error:e.message}));process.exitCode=1;});
