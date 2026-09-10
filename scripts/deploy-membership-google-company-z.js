'use strict';
// Scoped Edge deployment. No SQL, Google writes, request actions or secret changes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),mode=process.argv[2];
const backup='C:/tmp/sutiapp-membership-company-z-20260910';
const out=path.join(root,'docs/qa/evidence/membership-google-company-z-20260910');
const names=['index.ts','visibility-policy.js','request-google-sync.js'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// ESZIP 2.3, checksum-free variant returned by Management API. Reject other formats.
// Layout: denoland/deno libs/eszip/v2.rs (module header, npm, sources, source maps).
function modules(body){
 let p=0;const take=n=>{assert(n>=0&&p+n<=body.length,'ESZIP_BOUNDS');const b=body.subarray(p,p+n);p+=n;return b;},u32=()=>take(4).readUInt32BE(),str=()=>take(u32()).toString('utf8');
 assert.equal(take(8).toString(),'ESZIP2.3');assert.equal(take(u32()).toString('hex'),'00000100');
 const end=p+4+body.readUInt32BE(p),entries=[];
 u32();while(p<end){const name=str(),kind=take(1)[0];if(kind===0)entries.push({name,offset:u32(),length:u32(),mapOffset:u32(),mapLength:u32(),kind:take(1)[0]});else if(kind===1)entries.push({name,redirect:str()});else throw Error('ESZIP_UNSUPPORTED_KIND');}
 assert.equal(p,end);assert.equal(u32(),0,'UNEXPECTED_NPM_SECTION');
 const sources=take(u32()),maps=take(u32());assert.equal(p,body.length);
 return Object.fromEntries(entries.map(e=>{if(e.redirect)return[e.name,e];assert(e.offset+e.length<=sources.length&&e.mapOffset+e.mapLength<=maps.length);return[e.name,{...e,source:sources.subarray(e.offset,e.offset+e.length).toString('utf8'),map:e.mapLength?JSON.parse(maps.subarray(e.mapOffset,e.mapOffset+e.mapLength).toString('utf8')):null}];}));
}
const env={};for(const l of fs.readFileSync(process.env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0&&!l.trim().startsWith('#'))env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const base='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/functions/';
const headers={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN};
async function get(url,options={}){const r=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(60000)});if(!r.ok){fs.mkdirSync(backup,{recursive:true});fs.writeFileSync(path.join(backup,'last-management-error.txt'),await r.text());throw Error('MANAGEMENT_HTTP_'+r.status);}return r;}
async function json(url,options){return (await get(url,options)).json();}
function save(name,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
async function bundle(sources,bundleOnly){const form=new FormData();form.append('metadata',JSON.stringify({name:'financial-legacy',slug:'financial-legacy',entrypoint_path:'index.ts',verify_jwt:true}));for(const s of sources)form.append('file',new Blob([s.source],{type:s.name.endsWith('.ts')?'application/typescript':'application/javascript'}),s.name);return json(base+'deploy?slug=financial-legacy'+(bundleOnly?'&bundleOnly=true':''),{method:'POST',body:form});}
async function main(){
 if(mode==='candidate-compile'||mode==='deploy'||mode==='verify'){
  const before=JSON.parse(fs.readFileSync(path.join(backup,'edge-before.json'))),current=await json(base+'financial-legacy');
  if(mode!=='verify'){assert.equal(current.version,before.version,'LIVE_VERSION_CHANGED');assert.equal(current.ezbr_sha256,before.ezbr_sha256);}assert.equal(current.import_map,false);assert.equal(current.verify_jwt,true);
  for(const check of ['projection-tests.json','contracts.json','source-parity.json'])assert.equal(JSON.parse(fs.readFileSync(path.join(out,check))).status,'PASS',check);
  const sources=names.map(name=>({name,source:fs.readFileSync(path.join(root,'supabase/functions/financial-legacy',name),'utf8')})),hashes=Object.fromEntries(sources.map(s=>[s.name,sha(s.source)]));
  for(const s of sources.filter(s=>s.name!=='request-google-sync.js'))assert.equal(s.source,fs.readFileSync(path.join(backup,s.name),'utf8'));
  if(mode==='candidate-compile'){
   const result=await bundle(sources,true),after=await json(base+'financial-legacy');assert.equal(after.version,before.version);assert.equal(after.ezbr_sha256,before.ezbr_sha256);
   save('candidate-compile.json',{status:'PASS',activeVersion:after.version,compiledHash:result.ezbr_sha256,sourceHashes:hashes});return;
  }
  assert.deepEqual(hashes,JSON.parse(fs.readFileSync(path.join(out,'candidate-compile.json'))).sourceHashes,'COMPILED_SOURCE_CHANGED');
  const result=mode==='verify'?JSON.parse(fs.readFileSync(path.join(backup,'deploy-result.json'))):await bundle(sources,false);if(mode!=='verify')fs.writeFileSync(path.join(backup,'deploy-result.json'),JSON.stringify(result));
  const after=await json(base+'financial-legacy'),body=Buffer.from(await(await get(base+'financial-legacy/body')).arrayBuffer());
  fs.writeFileSync(path.join(backup,'edge-after.eszip'),body);fs.writeFileSync(path.join(backup,'edge-after.json'),JSON.stringify(after));
  const old=modules(fs.readFileSync(path.join(backup,'edge-before.eszip'))),active=modules(body);
  assert.deepEqual(Object.keys(active).sort(),Object.keys(old).sort());
  const preserved=[];for(const key of Object.keys(old)){
   if(key==='source/request-google-sync.js')continue;
   if(key==='---EDGE-RUNTIME-METADATA---'){
    const token='user_fn_'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'_'+before.id+'_';
    assert.equal(active[key].source.replace(token+after.version,token+before.version),old[key].source,'RUNTIME_METADATA_CHANGE_BEYOND_VERSION');continue;
   }
   assert.equal(active[key].source,old[key].source,'UNEXPECTED_MODULE_CHANGE_'+key);assert.equal(active[key].redirect,old[key].redirect);preserved.push(key);
  }
  for(const s of sources){const m=active['source/'+s.name];assert.equal(m.map?.sourcesContent?.[0]||m.source,s.source,'DEPLOYED_SOURCE_MISMATCH');}
  assert.equal(after.verify_jwt,true);assert.equal(after.import_map,false);assert.equal(after.version,before.version+1);assert.equal(after.ezbr_sha256,result.ezbr_sha256);
  const probe=await fetch(env.SUPABASE_URL+'/functions/v1/financial-legacy',{signal:AbortSignal.timeout(30000)});assert.equal(probe.status,401,'UNAUTHENTICATED_ACCESS');
  save('deployment.json',{status:'PASS',beforeVersion:before.version,afterVersion:after.version,verifyJwt:after.verify_jwt,bundleSha256:after.ezbr_sha256,downloadSha256:sha(body),sourceHashes:hashes,onlyChangedCodeModule:'source/request-google-sync.js',runtimeMetadataOnlyVersionChanged:true,unchangedModules:preserved,unauthenticatedHttpStatus:probe.status,businessActionsInvoked:0});return;
 }
 if(mode==='source-parity'){
  const active=modules(fs.readFileSync(path.join(backup,'edge-before.eszip'))),checks={};
  for(const name of names){const m=active['source/'+name];assert(m,'MODULE_MISSING_'+name);const original=m.map?.sourcesContent?.[0]||m.source,local=fs.readFileSync(path.join(backup,name),'utf8');assert.equal(original,local,'ACTIVE_SOURCE_DIFFERS_'+name);checks[name]={exact:true,sha256:sha(local)};}
  save('source-parity.json',{status:'PASS',moduleCount:Object.keys(active).length,checks});return;
 }
 if(mode==='backup'){
  assert(!fs.existsSync(path.join(backup,'edge-before.json')),'BACKUP_ALREADY_EXISTS');
  const before=await json(base+'financial-legacy'),body=Buffer.from(await (await get(base+'financial-legacy/body')).arrayBuffer());
  assert(before.verify_jwt===true);fs.mkdirSync(backup,{recursive:true});
  fs.writeFileSync(path.join(backup,'edge-before.json'),JSON.stringify(before));fs.writeFileSync(path.join(backup,'edge-before.eszip'),body);
  for(const name of names)fs.copyFileSync(path.join(root,'supabase/functions/financial-legacy',name),path.join(backup,name));
  save('backup.json',{status:'PASS',version:before.version,verifyJwt:before.verify_jwt,bundleSha256:before.ezbr_sha256,downloadSha256:sha(body),format:body.subarray(0,8).toString('hex'),localSources:Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(backup,n)))]))});return;
 }
 if(mode==='baseline-compile'){
  const before=JSON.parse(fs.readFileSync(path.join(backup,'edge-before.json'))),sources=names.map(name=>({name,source:fs.readFileSync(path.join(backup,name),'utf8')}));
  const result=await bundle(sources,true),after=await json(base+'financial-legacy');
  assert.equal(after.version,before.version);assert.equal(after.ezbr_sha256,before.ezbr_sha256);
  fs.writeFileSync(path.join(backup,'baseline-compile-result.json'),JSON.stringify(result));
  save('baseline-compile.json',{status:'PASS',version:after.version,resultKeys:Object.keys(result),compiledHash:result.ezbr_sha256||null,liveHash:before.ezbr_sha256});return;
 }
 throw Error('MODE_NOT_IMPLEMENTED');
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',mode,error:e.message}));process.exitCode=1;});
