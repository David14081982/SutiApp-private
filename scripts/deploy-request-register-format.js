'use strict';
// Existing deployments only. No SQL, secret rotation, workflow action or test request creation.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'),mode=process.argv[2],backup='C:/tmp/sutiapp-register-format-backup-20260908',evidence=path.join(root,'docs/qa/evidence/register-format-20260908');
const scriptId='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o',deploymentId='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),env={};
for(const l of fs.readFileSync('C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const base='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/functions/',headers={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN};
const google='https://script.googleapis.com/v1/projects/'+scriptId;
async function json(url,options){const r=await fetch(url,{...options,signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('REMOTE_HTTP_'+r.status);return r.json();}
async function oauth(){const a=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;return (await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:a.client_id,client_secret:a.client_secret,refresh_token:a.refresh_token,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'})})).access_token;}
const normalize=c=>JSON.stringify(c.files.map(f=>({name:f.name,type:f.type,source:f.source.replace(/\r/g,'').trim()})).sort((a,b)=>a.name.localeCompare(b.name)));
function proof(file,value){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,file),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
async function main(){
  assert(['backup','compile','deploy-google','deploy-edge','verify'].includes(mode),'MODE_REQUIRED');
  if(mode==='backup'){
    const edge=await json(base+'financial-legacy',{headers});const r=await fetch(base+'financial-legacy/body',{headers});assert(r.ok);const body=Buffer.from(await r.arrayBuffer());
    const gh={Authorization:'Bearer '+await oauth()},deployment=await json(google+'/deployments/'+deploymentId,{headers:gh});const content=await json(google+'/content?versionNumber='+deployment.deploymentConfig.versionNumber,{headers:gh});
    assert.equal(edge.version,40);assert.equal(deployment.deploymentConfig.versionNumber,13);
    assert.equal(edge.ezbr_sha256,'30cde69f66996f62fce42b75955d070c89df6966d46f25f6ccff73161cc3a91b','EDGE_AUDITED_SOURCE_DRIFT');
    const prior=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908/google-deploy.json')));assert.equal(sha(content.files.find(f=>f.name==='Code').source),prior.sourceSha256);
    assert.equal(normalize(await json(google+'/content',{headers:gh})),normalize(content),'UNPUBLISHED_GOOGLE_DRIFT');
    fs.mkdirSync(backup,{recursive:true});for(const [name,value] of [['edge-before.json',JSON.stringify(edge)],['edge-before.eszip',body],['google-deployment-before.json',JSON.stringify(deployment)],['google-content-before.json',JSON.stringify(content)]]){const file=path.join(backup,name);if(fs.existsSync(file))assert.equal(sha(fs.readFileSync(file)),sha(value));else fs.writeFileSync(file,value);}
    proof('backup.json',{status:'PASS',edgeVersion:edge.version,googleVersion:13,verifyJwt:edge.verify_jwt,privateBackup:backup,edgeSha256:sha(body),googleSourceSha256:sha(content.files.find(f=>f.name==='Code').source)});return;
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'format-tests.json'))).status,'PASS');
  assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'backup.json'))).status,'PASS');
  const sources=['index.ts','visibility-policy.js','request-google-sync.js'].map(name=>({name,source:fs.readFileSync(path.join(root,'supabase/functions/financial-legacy',name),'utf8')}));
  if(mode==='deploy-google'){
    const gh={Authorization:'Bearer '+await oauth(),'Content-Type':'application/json'},before=JSON.parse(fs.readFileSync(path.join(backup,'google-content-before.json'))),deployment=await json(google+'/deployments/'+deploymentId,{headers:gh});
    assert.equal(deployment.deploymentConfig.versionNumber,13,'DEPLOYMENT_DRIFT');assert.equal(normalize(await json(google+'/content',{headers:gh})),normalize(before));
    const files=before.files.map(f=>({name:f.name,type:f.type,source:f.name==='Code'?fs.readFileSync(path.join(root,'google-apps-script/financial-handoff/Code.gs'),'utf8'):f.source}));
    const manifest=JSON.parse(files.find(f=>f.name==='appsscript').source);assert.equal(manifest.webapp.access,'ANYONE');assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
    await json(google+'/content',{method:'PUT',headers:gh,body:JSON.stringify({files})});
    const v=await json(google+'/versions',{method:'POST',headers:gh,body:JSON.stringify({description:'H-REQUESTS-GOOGLE-REGISTER-FORMAT-001: folio, date, Aprobado'})});
    await json(google+'/deployments/'+deploymentId,{method:'PUT',headers:gh,body:JSON.stringify({deploymentConfig:{...deployment.deploymentConfig,versionNumber:v.versionNumber,description:'Request register: SR folio / dd-MM-yyyy / Aprobado'}})});
    assert.equal(normalize(await json(google+'/content?versionNumber='+v.versionNumber,{headers:gh})),normalize({files}));
    proof('google-deploy.json',{status:'PASS',version:v.versionNumber,sourceSha256:sha(files.find(f=>f.name==='Code').source),sameDeployment:true,access:manifest.webapp.access});return;
  }
  if(mode==='verify'){
    const g=JSON.parse(fs.readFileSync(path.join(evidence,'google-deploy.json'))),e=JSON.parse(fs.readFileSync(path.join(evidence,'edge-deploy.json'))),gh={Authorization:'Bearer '+await oauth()};
    const d=await json(google+'/deployments/'+deploymentId,{headers:gh}),c=await json(google+'/content?versionNumber='+d.deploymentConfig.versionNumber,{headers:gh}),edge=await json(base+'financial-legacy',{headers});
    assert.equal(d.deploymentConfig.versionNumber,g.version);assert.equal(sha(c.files.find(f=>f.name==='Code').source),g.sourceSha256);assert.equal(edge.version,e.version);assert.equal(edge.ezbr_sha256,e.bundleSha256);assert(edge.verify_jwt);
    proof('deployment-readback.json',{status:'PASS',googleVersion:g.version,edgeVersion:e.version,googleSourceSha256:g.sourceSha256,edgeBundleSha256:edge.ezbr_sha256,verifyJwt:edge.verify_jwt});return;
  }
  const before=await json(base+'financial-legacy',{headers});assert.equal(before.version,40,'EDGE_DRIFT');
  assert.equal(before.ezbr_sha256,JSON.parse(fs.readFileSync(path.join(backup,'edge-before.json'))).ezbr_sha256,'EDGE_BUNDLE_DRIFT');
  if(mode==='deploy-edge'){assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'google-deploy.json'))).status,'PASS');assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'edge-compile.json'))).status,'PASS');}
  const form=new FormData();form.append('metadata',JSON.stringify({name:'financial-legacy',slug:'financial-legacy',entrypoint_path:'index.ts',verify_jwt:true}));for(const s of sources)form.append('file',new Blob([s.source],{type:s.name.endsWith('.ts')?'application/typescript':'application/javascript'}),s.name);
  await json(base+'deploy?slug=financial-legacy'+(mode==='compile'?'&bundleOnly=true':''),{method:'POST',headers,body:form});
  const after=await json(base+'financial-legacy',{headers});if(mode==='compile')assert.equal(after.version,before.version);assert(after.verify_jwt);
  proof(mode==='compile'?'edge-compile.json':'edge-deploy.json',{status:'PASS',version:after.version,verifyJwt:after.verify_jwt,bundleSha256:after.ezbr_sha256,sourceSha256:sha(sources.map(s=>s.name+'\n'+s.source).join('\n'))});
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',mode,error:e.message}));process.exitCode=1;});
