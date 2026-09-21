'use strict';
// Fixed Google reader transport repair; no financial operation or Sheet mutation.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),crypto=require('crypto');
const {modules}=require('./repair-request-google-oauth');
const mode=process.argv[2],dir=path.join(os.tmpdir(),'sutiapp-savings-google-reader-20260921'),env={};
for(const l of fs.readFileSync('supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const api='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0],sh={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN};
const scriptId='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o',deployment='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g',gas='https://script.googleapis.com/v1/projects/'+scriptId;
const normalize=s=>s.replace(/\r/g,'').trim(),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),load=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(55000)});const d=await r.json().catch(()=>null);if(!r.ok)throw Error('HTTP_'+r.status+'_'+(d?.error?.status||''));return d;}
async function googleHeaders(){const a=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;const d=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:a.client_id,client_secret:a.client_secret,refresh_token:a.refresh_token,grant_type:'refresh_token'})});assert(d.access_token);return{Authorization:'Bearer '+d.access_token,'Content-Type':'application/json'};}
function save(name,data){fs.writeFileSync(path.join(dir,name),JSON.stringify(data,null,2));}
function sources(){const old=load('edge-before.json'),local=fs.readFileSync('supabase/functions/savings-settlement/loan-status.js','utf8');assert.equal(normalize(local.split('export async function readLoanSource')[0]),normalize(old.sources['loan-status.js'].split('export async function readLoanSource')[0]),'FINANCIAL_EVALUATOR_CHANGED');assert.equal(normalize(fs.readFileSync('supabase/functions/savings-settlement/index.ts','utf8')),normalize(old.sources['index.ts']),'BUSINESS_EDGE_CHANGED');return{'index.ts':old.sources['index.ts'],'loan-status.js':local};}
async function edgeBody(){const r=await fetch(api+'/functions/savings-settlement/body',{headers:sh});assert(r.ok);return Buffer.from(await r.arrayBuffer());}
async function main(){
 fs.mkdirSync(dir,{recursive:true});assert(['backup','compile','deploy-google','deploy-edge','verify'].includes(mode));
 if(mode==='backup'){
  assert(!fs.existsSync(path.join(dir,'edge-before.json')),'BACKUP_EXISTS');const metadata=await json(api+'/functions/savings-settlement',{headers:sh}),body=await edgeBody(),m=modules(body),src={};assert(metadata.verify_jwt);
  for(const name of ['index.ts','loan-status.js']){const key=Object.keys(m).find(k=>k==='source/'+name||k.endsWith('/savings-settlement/'+name));assert(key,'MODULE_MISSING');src[name]=m[key];}
  const h=await googleHeaders(),d=await json(gas+'/deployments/'+deployment,{headers:h}),content=await json(gas+'/content?versionNumber='+d.deploymentConfig.versionNumber,{headers:h}),head=await json(gas+'/content',{headers:h});
  const canonical=c=>JSON.stringify(c.files.map(f=>({name:f.name,type:f.type,source:normalize(f.source)})).sort((a,b)=>a.name.localeCompare(b.name)));
  assert.equal(canonical(content),canonical(head),'GOOGLE_HEAD_DRIFT');const candidate=fs.readFileSync('google-apps-script/financial-handoff/Code.gs','utf8');
  const reversed=candidate.replace(/\/\/ Fixed, read-only access for the existing Savings loan guard\.[\s\S]*?(?=function doPost\(event\))/, '').replace("    if(payload.action==='read_loan_status')return readLoanStatus_(payload);\n",'');
  assert.equal(normalize(reversed),normalize(content.files.find(f=>f.name==='Code').source),'GOOGLE_SCOPE_DRIFT');
  save('edge-before.json',{metadata,sources:src});fs.writeFileSync(path.join(dir,'edge-before.eszip'),body);save('google-before.json',{deployment:d,content});sources();
  console.log(JSON.stringify({status:'PASS',mode,edgeVersion:metadata.version,googleVersion:d.deploymentConfig.versionNumber,edgeSha:sha(body),privateBackup:dir}));return;
 }
 if(mode==='deploy-google'){
  const h=await googleHeaders(),old=load('google-before.json'),d=await json(gas+'/deployments/'+deployment,{headers:h});assert.equal(d.deploymentConfig.versionNumber,old.deployment.deploymentConfig.versionNumber,'GOOGLE_VERSION_DRIFT');
  const files=old.content.files.map(f=>({name:f.name,type:f.type,source:f.name==='Code'?fs.readFileSync('google-apps-script/financial-handoff/Code.gs','utf8'):f.source}));
  await json(gas+'/content',{method:'PUT',headers:h,body:JSON.stringify({files})});
  const v=await json(gas+'/versions',{method:'POST',headers:h,body:JSON.stringify({description:'Fixed read-only loan source through existing authenticated receiver'})});
  await json(gas+'/deployments/'+deployment,{method:'PUT',headers:h,body:JSON.stringify({deploymentConfig:{...d.deploymentConfig,versionNumber:v.versionNumber}})});
  const active=await json(gas+'/content?versionNumber='+v.versionNumber,{headers:h});for(const f of files)assert.equal(normalize(active.files.find(x=>x.name===f.name).source),normalize(f.source));
  const proof={status:'PASS',mode,version:v.versionNumber,sameDeployment:true,sameManifest:true,sha:sha(files.find(f=>f.name==='Code').source)};save('google-deployed.json',proof);console.log(JSON.stringify(proof));return;
 }
 const src=sources(),fingerprint=sha(JSON.stringify(src)),current=await json(api+'/functions/savings-settlement',{headers:sh});
 if(mode==='compile'||mode==='deploy-edge'){
  const old=load('edge-before.json'),live=modules(await edgeBody());for(const [name,source] of Object.entries(old.sources)){const key=Object.keys(live).find(k=>k==='source/'+name||k.endsWith('/savings-settlement/'+name));assert.equal(live[key],source,'LIVE_EDGE_DRIFT');}
  if(mode==='deploy-edge'){assert.equal(load('compile.json').fingerprint,fingerprint);assert.equal(load('google-deployed.json').status,'PASS');}
  const form=new FormData();form.append('metadata',JSON.stringify({name:'savings-settlement',slug:'savings-settlement',entrypoint_path:'index.ts',verify_jwt:true}));for(const[name,source]of Object.entries(src))form.append('file',new Blob([source],{type:name.endsWith('.ts')?'application/typescript':'application/javascript'}),name);
  await json(api+'/functions/deploy?slug=savings-settlement'+(mode==='compile'?'&bundleOnly=true':''),{method:'POST',headers:sh,body:form});const after=await json(api+'/functions/savings-settlement',{headers:sh});assert(after.verify_jwt);assert.equal(after.version,current.version+(mode==='compile'?0:1));
  const proof={status:'PASS',mode,before:current.version,after:after.version,fingerprint};save(mode+'.json',proof);console.log(JSON.stringify(proof));return;
 }
 const live=modules(await edgeBody());for(const[name,source]of Object.entries(src)){const key=Object.keys(live).find(k=>k==='source/'+name||k.endsWith('/savings-settlement/'+name));assert.equal(live[key],source,'EDGE_READBACK');}assert(current.verify_jwt);
 const r=await fetch(env.SUPABASE_URL+'/functions/v1/savings-settlement/source-status',{headers:{Authorization:'Bearer '+env.SUPABASE_SECRET_KEY,apikey:env.SUPABASE_SECRET_KEY},signal:AbortSignal.timeout(55000)}),body=await r.json();
 const anonymous=await fetch(env.SUPABASE_URL+'/functions/v1/savings-settlement/source-status');assert.equal(anonymous.status,401);
 const proof={status:r.status===200&&body.status==='PASS'?'PASS':'FAIL',mode,edgeVersion:current.version,sourceStatusHttp:r.status,sourceStatus:body,anonymousHttp:anonymous.status,exactSourceReadback:true,financialWrites:0};save('verified.json',proof);console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
