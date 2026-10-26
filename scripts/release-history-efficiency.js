'use strict';
// Focal code release. No Sheet, database, identity-assistance or business writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {environment}=require('./inspect-loan-history');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/history-read-efficiency'),out=path.join(root,'docs/qa/evidence/history-read-efficiency'),e=environment();
const mode=process.argv[2],read=f=>fs.readFileSync(path.join(root,f),'utf8'),norm=s=>s.replace(/\r/g,'').trim(),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const script='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o',deployment='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g';
const google='https://script.googleapis.com/v1/projects/'+script,api='https://api.supabase.com/v1/projects/'+new URL(e.SUPABASE_URL).hostname.split('.')[0],admin={Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN};
const canonical=c=>JSON.stringify(c.files.map(({name,type,source})=>({name,type,source:norm(source)})).sort((a,b)=>a.name.localeCompare(b.name)));
function proof(name,data){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(55000)});if(!r.ok){fs.writeFileSync(path.join(dir,'private-error.txt'),await r.text());throw Error('HTTP_'+r.status);}return r.json();}
async function gh(){const a=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default,t=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:a.client_id,client_secret:a.client_secret,refresh_token:a.refresh_token,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'})});return {Authorization:'Bearer '+t.access_token,'Content-Type':'application/json'};}
async function snapshot(h){const dep=await json(google+'/deployments/'+deployment,{headers:h}),content=await json(google+'/content?versionNumber='+dep.deploymentConfig.versionNumber,{headers:h}),head=await json(google+'/content',{headers:h});return {deployment:dep,content,head};}
function edgeForm(){const form=new FormData();form.append('metadata',JSON.stringify({name:'loan-history',slug:'loan-history',entrypoint_path:'index.ts',verify_jwt:true}));for(const name of ['index.ts','history.mjs','source.mjs'])form.append('file',new Blob([read('supabase/functions/loan-history/'+name)],{type:name.endsWith('.ts')?'application/typescript':'application/javascript'}),name);return form;}
async function ownProbe(action){
 const h={apikey:e.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},login=await json(e.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:h,body:JSON.stringify({email:e.H005_TEST_EMAIL,password:e.H005_TEST_PASSWORD})});
 const headers={...h,Authorization:'Bearer '+login.access_token,Origin:'https://sutiapp.com'};
 async function invoke(body,custom=headers){const start=Date.now(),r=await fetch(e.SUPABASE_URL+'/functions/v1/loan-history',{method:'POST',headers:custom,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)}),text=await r.text();return {status:r.status,body:JSON.parse(text),bytes:Buffer.byteLength(text),ms:Date.now()-start,noStore:r.headers.get('cache-control')==='no-store'};}
 const own=await invoke({action});assert.equal(own.status,200);assert.equal(own.body.version,1);assert(own.noStore);
 const result={status:'PASS',action,elapsedMs:own.ms,jsonBytes:own.bytes,entries:own.body.entries.length,noStore:true,businessWrites:0,identityAssistanceWrites:0};
 if(action==='SUMMARY'){
  assert(own.body.entries.every(x=>!Object.hasOwn(x,'schedule')));
  const forged=await invoke({action,folio:'OTHER_ACCOUNT'}),anonymous=await invoke({action},h);assert.equal(forged.status,400);assert.equal(anonymous.status,401);
  const key=own.body.entries[0]?.key||'loan:NOT_OWNED',detail=await invoke({action:'DETAIL',key});assert.equal(detail.status,200);assert(detail.body.entries.every(x=>x.key===key));if(!own.body.entries.length)assert.equal(detail.body.entries.length,0);
  Object.assign(result,{summaryExcludesSchedules:true,forgedTargetStatus:forged.status,anonymousStatus:anonymous.status,detailOwnSelection:true,detailEntries:detail.body.entries.length,populatedLiveAccount:own.body.entries.length>0});
 }
 proof(action==='LOAD'?'before-live':'after-live',result);
}
async function main(){
 if(mode==='serve'){
  const site=path.join(dir,'site'),mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
  require('http').createServer((req,res)=>{const file=path.resolve(site,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);}).listen(8080,'127.0.0.1',()=>console.log('HISTORY_EFFICIENCY_PREVIEW http://localhost:8080/'));return;
 }
 if(mode==='preflight'){
  const h=await gh(),before=await snapshot(h);assert.equal(canonical(before.content),canonical(before.head),'UNPUBLISHED_GOOGLE_HEAD');
  assert.equal(norm(before.content.files.find(x=>x.name==='Code').source),norm(read('.tmp/history-read-efficiency/before/google-apps-script__financial-handoff__Code.gs')),'GOOGLE_DRIFT');
  fs.writeFileSync(path.join(dir,'google-before.json'),JSON.stringify(before));
  const edge=(await json(api+'/functions',{headers:admin})).find(x=>x.slug==='loan-history');assert(edge&&edge.verify_jwt&&edge.status==='ACTIVE');fs.writeFileSync(path.join(dir,'edge-before.json'),JSON.stringify(edge));
  const backup=await fetch(api+'/functions/loan-history/body',{headers:admin});assert(backup.ok,'EDGE_BACKUP_FAILED');fs.writeFileSync(path.join(dir,'edge-before-body.bin'),Buffer.from(await backup.arrayBuffer()));
  const compiled=await fetch(api+'/functions/deploy?slug=loan-history&bundleOnly=true',{method:'POST',headers:admin,body:edgeForm(),signal:AbortSignal.timeout(55000)});assert(compiled.ok,'EDGE_COMPILE_FAILED');await compiled.arrayBuffer();
  const after=(await json(api+'/functions',{headers:admin})).find(x=>x.slug==='loan-history');assert.equal(after.version,edge.version,'PREFLIGHT_MUTATED_EDGE');
  proof('preflight',{status:'PASS',googleVersion:before.deployment.deploymentConfig.versionNumber,googleBackup:true,edgeVersion:edge.version,edgeBackup:true,edgeBundleValid:true,businessWrites:0});await ownProbe('LOAD');return;
 }
 if(mode==='google'){
  const before=JSON.parse(read('.tmp/history-read-efficiency/google-before.json')),h=await gh(),current=await snapshot(h);
  assert.equal(canonical(current.content),canonical(before.content));assert.equal(canonical(current.head),canonical(before.head));assert.equal(current.deployment.deploymentConfig.versionNumber,before.deployment.deploymentConfig.versionNumber);
  const files=before.content.files.map(({name,type,source})=>({name,type,source:name==='Code'?read('google-apps-script/financial-handoff/Code.gs'):source}));
  const outside=s=>s.replace(/function readSelfHistory_\(payload\) \{[\s\S]*?(?=\nfunction doPost\(event\))/,'');assert.equal(outside(norm(files.find(x=>x.name==='Code').source)),outside(norm(before.content.files.find(x=>x.name==='Code').source)),'WRITER_DRIFT');
  await json(google+'/content',{method:'PUT',headers:h,body:JSON.stringify({files})});assert.equal(canonical(await json(google+'/content',{headers:h})),canonical({files}));
  const version=(await json(google+'/versions',{method:'POST',headers:h,body:JSON.stringify({description:'Own Historial bounded read only; preserve Sheets and writers'})})).versionNumber;
  await json(google+'/deployments/'+deployment,{method:'PUT',headers:h,body:JSON.stringify({deploymentConfig:{...before.deployment.deploymentConfig,versionNumber:version}})});
  fs.writeFileSync(path.join(dir,'google-version.json'),JSON.stringify({version,previous:before.deployment.deploymentConfig.versionNumber}));
  let after;for(let i=0;i<8;i++){after=await snapshot(h);if(after.deployment.deploymentConfig.versionNumber===version&&canonical(after.content)===canonical({files})&&canonical(after.head)===canonical({files}))break;if(i===7)throw Error('GOOGLE_READBACK_PENDING');await new Promise(r=>setTimeout(r,1000));}
  assert.deepEqual(after.deployment.entryPoints,before.deployment.entryPoints);fs.writeFileSync(path.join(dir,'google-after.json'),JSON.stringify(after));
  proof('google-deployed',{status:'PASS',version,previous:before.deployment.deploymentConfig.versionNumber,exactReadback:true,allOtherFunctionsPreserved:true,manifestAndEntrypointsPreserved:true,sheetWrites:0});return;
 }
 if(mode==='edge'){
  assert.equal(JSON.parse(read('docs/qa/evidence/history-read-efficiency/google-deployed.json')).status,'PASS');const before=JSON.parse(read('.tmp/history-read-efficiency/edge-before.json')),current=(await json(api+'/functions',{headers:admin})).find(x=>x.slug==='loan-history');assert.equal(current.version,before.version);
  await json(api+'/functions/deploy?slug=loan-history',{method:'POST',headers:admin,body:edgeForm()});
  const after=(await json(api+'/functions',{headers:admin})).find(x=>x.slug==='loan-history');assert(after.verify_jwt&&after.status==='ACTIVE'&&after.version>before.version);
  proof('edge-deployed',{status:'PASS',version:after.version,previous:before.version,verifyJwt:after.verify_jwt,sourceFiles:['index.ts','history.mjs','source.mjs'].map(name=>({name,sha256:sha(read('supabase/functions/loan-history/'+name))})),businessWrites:0});return;
 }
 if(mode==='verify'){await ownProbe('SUMMARY');return;}
 throw Error('UNKNOWN_MODE');
}
main().catch(e=>{console.error((e.message||'FAILED').split('\n')[0]);process.exitCode=1;});
