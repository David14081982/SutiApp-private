'use strict';
// Immutable, private, read-only external restoration point. No deployments,
// database queries, business reads, or Google Sheet/Script writes are executed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),cp=require('node:child_process');
const {environment}=require('./inspect-loan-history');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'.tmp/loan-available-credit/external-before');
const evidence=path.join(root,'docs/qa/evidence/loan-available-credit/restore-external.json');
const repo='David14081982/SutiApp-private';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const script='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o';
const deployment='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const norm=s=>String(s).replace(/\r/g,'').trim();
function save(name,value){
 const file=path.join(dir,name),bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 if(fs.existsSync(file))assert.equal(sha(fs.readFileSync(file)),sha(bytes),'BACKUP_DRIFT_'+name);
 else fs.writeFileSync(file,bytes,{flag:'wx'});
 return {file:path.relative(root,file).replace(/\\/g,'/'),bytes:bytes.length,sha256:sha(bytes)};
}
async function response(url,options={}){
 const result=await fetch(url,{...options,signal:AbortSignal.timeout(55000)});
 if(!result.ok)throw Error('REMOTE_HTTP_'+result.status+'_'+new URL(url).hostname);
 return result;
}
async function json(url,options){return (await response(url,options)).json();}
function ghJson(endpoint){
 try{return JSON.parse(cp.execFileSync(gh,['api',endpoint],{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:55000,maxBuffer:20*1024*1024}));}
 catch(e){throw Error('GITHUB_READ_FAILED_'+(e.status??'TIMEOUT'));}
}
async function ghDownload(endpoint,name){
 const target=path.join(dir,name);
 if(fs.existsSync(target))return {file:path.relative(root,target).replace(/\\/g,'/'),bytes:fs.statSync(target).size,sha256:sha(fs.readFileSync(target))};
 const fd=fs.openSync(target,'wx');
 try{await new Promise((resolve,reject)=>{
  const child=cp.spawn(gh,['api',endpoint],{cwd:root,windowsHide:true,stdio:['ignore',fd,'pipe']});
  child.stderr.resume();
  child.on('error',()=>reject(Error('GITHUB_DOWNLOAD_PROCESS')));
  child.on('close',code=>code===0?resolve():reject(Error('GITHUB_DOWNLOAD_'+code)));
 });}finally{fs.closeSync(fd);}
 const bytes=fs.readFileSync(target);assert(bytes.length>100,'GITHUB_ARCHIVE_EMPTY');
 assert.equal(bytes.subarray(0,2).toString(),'PK','GITHUB_ARCHIVE_NOT_ZIP');
 return {file:path.relative(root,target).replace(/\\/g,'/'),bytes:bytes.length,sha256:sha(bytes)};
}
function eszipSources(body){
 let p=0;const take=n=>{assert(n>=0&&p+n<=body.length,'ESZIP_BOUNDS');const b=body.subarray(p,p+n);p+=n;return b;};
 const u32=()=>take(4).readUInt32BE(),str=()=>take(u32()).toString('utf8');
 assert.equal(take(8).toString(),'ESZIP2.3');assert.equal(take(u32()).toString('hex'),'00000100');
 const end=p+4+body.readUInt32BE(p),entries=[];u32();
 while(p<end){const name=str(),kind=take(1)[0];if(kind===0)entries.push({name,offset:u32(),length:u32(),mapOffset:u32(),mapLength:u32(),kind:take(1)[0]});else if(kind===1)str();else throw Error('ESZIP_UNSUPPORTED_KIND');}
 assert.equal(p,end);assert.equal(u32(),0,'UNEXPECTED_NPM_SECTION');
 const sources=take(u32()),maps=take(u32());assert.equal(p,body.length);
 return entries.filter(e=>!e.name.includes('://')&&/\.(?:ts|js|mjs|json)$/.test(e.name)).map(e=>{
  assert(e.offset+e.length<=sources.length&&e.mapOffset+e.mapLength<=maps.length,'ESZIP_SOURCE_BOUNDS');
  const source=sources.subarray(e.offset,e.offset+e.length).toString('utf8');
  const map=e.mapLength?JSON.parse(maps.subarray(e.mapOffset,e.mapOffset+e.mapLength).toString('utf8')):null;
  const name=e.name.startsWith('source/')?e.name.slice(7):e.name;assert(/^[a-zA-Z0-9_./-]+$/.test(name)&&!name.includes('..'),'SOURCE_PATH_INVALID');
  return {name,source:map?.sourcesContent?.[0]||source};
 });
}
async function backupEdge(slug,env){
 const url='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/functions/'+slug;
 const options={headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}};
 const before=await json(url,options),body=Buffer.from(await(await response(url+'/body',options)).arrayBuffer());
 const after=await json(url,options);
 assert.equal(before.version,after.version,'EDGE_VERSION_DRIFT');assert.equal(before.ezbr_sha256,after.ezbr_sha256,'EDGE_BUNDLE_DRIFT');
 assert.equal(before.verify_jwt,true,'EDGE_AUTH_UNEXPECTED');
 const metadata=save('edge/'+slug+'/metadata.json',before),bundle=save('edge/'+slug+'/body.eszip',body);
 const entrypoint=before.entrypoint_path.split('/source/')[1];assert(entrypoint,'EDGE_ENTRYPOINT_PATH_UNSUPPORTED');
 const sources=eszipSources(body).map(s=>{const local=path.join(root,'supabase/functions',s.name.startsWith(slug+'/')?s.name:slug+'/'+s.name);return {...save('edge/'+slug+'/sources/'+s.name,s.source),name:s.name,
  localMatches:fs.existsSync(local)&&sha(fs.readFileSync(local))===sha(s.source)};});
 assert(sources.some(s=>s.name===entrypoint),'EDGE_RESTORABLE_ENTRYPOINT_MISSING');
 return {slug,version:before.version,verifyJwt:before.verify_jwt,status:before.status,entrypoint,metadata,bundle,sources,sourceRecovery:'Redeploy these captured source files with the captured metadata flags and relative entrypoint; original deployment version number is evidence, not reused.'};
}
async function backupGoogle(){
 const auth=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;
 const token=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:auth.client_id,client_secret:auth.client_secret,refresh_token:auth.refresh_token,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'})});
 const api='https://script.googleapis.com/v1/projects/'+script,headers={Authorization:'Bearer '+token.access_token};
 const dep=await json(api+'/deployments/'+deployment,{headers});
 const [content,head]=await Promise.all([json(api+'/content?versionNumber='+dep.deploymentConfig.versionNumber,{headers}),json(api+'/content',{headers})]);
 const again=await json(api+'/deployments/'+deployment,{headers});
 assert.equal(again.deploymentConfig.versionNumber,dep.deploymentConfig.versionNumber,'GOOGLE_VERSION_DRIFT');
 const canonical=c=>JSON.stringify(c.files.map(f=>({name:f.name,type:f.type,source:norm(f.source)})).sort((a,b)=>a.name.localeCompare(b.name)));
 const files=[save('google/deployment.json',dep),save('google/content-active.json',content),save('google/content-head.json',head)];
 return {activeVersion:dep.deploymentConfig.versionNumber,headMatchesActive:canonical(content)===canonical(head),sourceSha256:sha(canonical(content)),files,recovery:'Point the same existing deployment to the captured immutable version; restore HEAD only if this task actually changed it. No source data was read or changed.'};
}
async function backupGithub(){
 const head=ghJson('repos/'+repo+'/commits/main');
 const runs=ghJson('repos/'+repo+'/actions/workflows/deploy-pages.yml/runs?status=success&per_page=1');
 assert(runs.workflow_runs?.length,'PAGES_SUCCESS_RUN_MISSING');const run=runs.workflow_runs[0];
 const artifacts=ghJson('repos/'+repo+'/actions/runs/'+run.id+'/artifacts');
 const artifact=artifacts.artifacts.find(a=>a.name==='github-pages'&&!a.expired);assert(artifact,'PAGES_ARTIFACT_UNAVAILABLE');
 save('github/head.json',{sha:head.sha,html_url:head.html_url,commit:head.commit});
 save('github/pages-run.json',run);save('github/pages-artifact.json',artifact);
 const [sourceArchive,pagesArtifact]=await Promise.all([
  ghDownload('repos/'+repo+'/zipball/'+head.sha,'github/source-'+head.sha+'.zip'),
  ghDownload('repos/'+repo+'/actions/artifacts/'+artifact.id+'/zip','github/pages-artifact-'+artifact.id+'.zip')
 ]);
 assert.equal(ghJson('repos/'+repo+'/commits/main').sha,head.sha,'GITHUB_HEAD_DRIFT');
 return {repository:repo,mainCommit:head.sha,pagesCommit:run.head_sha,pagesRun:run.id,pagesConclusion:run.conclusion,sourceArchive,pagesArtifact,recovery:'Restore the captured source commit/artifact by a new reviewed deployment. Do not reset or force-push shared branch history.'};
}
async function backupPages(){
 const target='https://sutiapp.com/',html=await(await response(target,{cache:'no-store'})).text();
 const bundlePath=html.match(/src="(app\/bundle\.js\?v=[^"]+)"/)?.[1];assert(bundlePath,'PAGES_BUNDLE_MISSING');
 const urls=[...new Set(['SutiApp.html','sw.js',bundlePath,...[...html.matchAll(/(?:src|href)="((?:app|assets)\/[^"?#]+(?:\?[^"#]*)?)"/g)].map(m=>m[1])])];
 const files=[save('pages/index.html',html)];
 for(const file of urls){const responseValue=await response(new URL(file,target),{cache:'no-store'});files.push({...save('pages/'+file.split('?')[0],Buffer.from(await responseValue.arrayBuffer())),url:new URL(file,target).href});}
 const again=await(await response(target,{cache:'no-store'})).text();assert.equal(sha(html),sha(again),'PAGES_SHELL_DRIFT');
 return {url:target,version:bundlePath.split('?v=')[1],bundleSha256:files.find(f=>f.file.endsWith('/app/bundle.js')).sha256,files};
}
function verifyArchives(result){
 // Standard-library archive readers verify CRCs and compare the exact deployed
 // bundle against the source archive, Pages artifact, and HTTP download.
 const program=`import json,zipfile,tarfile,io,hashlib,sys
sha=lambda b:hashlib.sha256(b).hexdigest()
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 source_hash=sha(z.read(next(n for n in z.namelist() if n.endswith('/app/bundle.js'))))
with zipfile.ZipFile(sys.argv[2]) as z:
 assert z.testzip() is None
 assert z.namelist()==['artifact.tar']
 with tarfile.open(fileobj=io.BytesIO(z.read('artifact.tar'))) as t:
  member=next(m for m in t.getmembers() if m.name.lstrip('./')=='app/bundle.js')
  artifact_hash=sha(t.extractfile(member).read())
assert source_hash==artifact_hash==sys.argv[3]
print(json.dumps({'status':'PASS','sourceZipCRC':True,'pagesZipCRC':True,'bundleMatchesSourceAndPublishedArtifact':True,'bundleSha256':source_hash}))`;
 return JSON.parse(cp.execFileSync('python',['-c',program,path.join(root,result.github.sourceArchive.file),path.join(root,result.github.pagesArtifact.file),result.pages.bundleSha256],{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:55000}));
}
async function main(){
 if(process.argv[2]==='verify'){
  const result=JSON.parse(fs.readFileSync(evidence,'utf8')),verification=verifyArchives(result);
  if(result.archiveVerification)assert.deepEqual(result.archiveVerification,verification,'ARCHIVE_VERIFICATION_DRIFT');
  else fs.writeFileSync(evidence,JSON.stringify({...result,archiveVerification:verification},null,2)+'\n');
  console.log(JSON.stringify(verification));return;
 }
 assert(!process.argv[2],'MODE_INVALID');
 assert(!fs.existsSync(evidence),'EXTERNAL_RESTORE_ALREADY_CERTIFIED');
 fs.mkdirSync(dir,{recursive:true});
 const env=environment(),jobs=[['financial-legacy',()=>backupEdge('financial-legacy',env)],['loan-history',()=>backupEdge('loan-history',env)],['google',backupGoogle],['github',backupGithub],['pages',backupPages]];
 const results=await Promise.allSettled(jobs.map(async([name,run])=>{
  const result=await run();save(name+'-verified-summary.json',result);console.log(JSON.stringify({step:name,status:'PASS'}));return [name,result];
 }));
 const failures=results.flatMap((result,i)=>result.status==='rejected'?[{step:jobs[i][0],error:result.reason.message}]:[]);
 if(failures.length){console.error(JSON.stringify({status:'FAIL',failures,externalWrites:0}));process.exitCode=1;return;}
 const result={status:'PASS',capturedAt:new Date().toISOString(),scope:'External code/configuration restoration point; database baseline and workspace backup are separate artifacts.',privateDirectory:path.relative(root,dir).replace(/\\/g,'/'),...Object.fromEntries(results.map(r=>r.value)),externalWrites:0,googleSheetReads:0,googleWrites:0,secretLogged:false};
 result.archiveVerification=verifyArchives(result);
 fs.mkdirSync(path.dirname(evidence),{recursive:true});fs.writeFileSync(evidence,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:result.status,capturedAt:result.capturedAt,privateDirectory:result.privateDirectory,evidence:path.relative(root,evidence),externalWrites:0}));
}
if(require.main===module)main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,secretLogged:false}));process.exitCode=1;});
