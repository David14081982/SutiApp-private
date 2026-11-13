// H-DOCUMENT-JPEG-TRAILER-001: one Edge function, no SQL/Storage/business writes.
// Build from the backed-up deployed artifact; never overwrite unrelated drift.
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),area=path.join(root,'.tmp'),evidence=path.join(root,'docs/qa/evidence/document-jpeg-trailer');
const baselineCommit='3259c8f05f58a40033a7dcc7aba5426c0194dab1';
const slug='document-operation',backup=path.join(area,'edge-before',slug),stage=path.join(area,'edge-candidate/supabase/functions');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),norm=x=>x.replace(/\r/g,'').trim();
const read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),save=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');};
function artifactSources(b){let p=0;const take=n=>{assert(n>=0&&p+n<=b.length);const x=b.subarray(p,p+n);p+=n;return x;},u32=()=>take(4).readUInt32BE(),str=()=>take(u32()).toString();assert.equal(take(8).toString(),'ESZIP2.3');assert.equal(take(u32()).toString('hex'),'00000100');const end=p+4+b.readUInt32BE(p),entries=[];u32();while(p<end){const name=str(),kind=take(1)[0];if(kind===0)entries.push({name,offset:u32(),length:u32(),mapOffset:u32(),mapLength:u32(),kind:take(1)[0]});else if(kind===1)str();else throw Error('ESZIP_KIND');}assert.equal(p,end);assert.equal(u32(),0);const source=take(u32()),maps=take(u32());assert.equal(p,b.length);return entries.filter(e=>!e.name.includes('://')).map(e=>({name:e.name.replace(/^source\//,''),source:e.mapLength?(JSON.parse(maps.subarray(e.mapOffset,e.mapOffset+e.mapLength)).sourcesContent?.[0]||source.subarray(e.offset,e.offset+e.length).toString()):source.subarray(e.offset,e.offset+e.length).toString()}));}
const allowed=['document-operation/index.ts','_shared/document-integration.mjs','_shared/document-stream.mjs','_shared/document-crc.mjs'];
const original=()=>new Map(artifactSources(fs.readFileSync(path.join(backup,'body.eszip'))).filter(x=>allowed.includes(x.name)).map(x=>[x.name,x.source]));
const errorFunction=s=>s.slice(s.indexOf('export function documentError('),s.indexOf('export async function documentOperation('));
function prepare(){
 const files=original();assert.equal(files.size,allowed.length);const changes=[];
 for(const[file,before]of files){let after=before;
  if(file==='_shared/document-stream.mjs'){
   const baseline=cp.execFileSync('git',['show',baselineCommit+':supabase/functions/'+file],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(norm(before),norm(baseline),'PARSER_BASELINE_DRIFT');after=read(path.join(root,'supabase/functions',file));
  }else if(file==='_shared/document-integration.mjs'){
   const baseline=cp.execFileSync('git',['show',baselineCommit+':supabase/functions/'+file],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(norm(errorFunction(before)),norm(errorFunction(baseline)),'ERROR_CONTRACT_DRIFT');
   const replacement=errorFunction(read(path.join(root,'supabase/functions',file)));assert(replacement.includes('recoverable:false'));after=before.replace(errorFunction(before),replacement);
   assert.equal(after.slice(after.indexOf('export async function documentOperation(')),before.slice(before.indexOf('export async function documentOperation(')),'UNRELATED_RUNTIME_CHANGE');
  }
  save(path.join(stage,file),after);changes.push({file,changed:norm(before)!==norm(after),before:sha(norm(before)),after:sha(norm(after))});
 }
 const result={status:'PASS',slug,baselineVersion:json(path.join(backup,'metadata.json')).version,changes};save(path.join(evidence,'edge-candidate.json'),result);console.log(JSON.stringify(result));
}
async function remote(mode){
 assert(['bundle','deploy','verify','rollback'].includes(mode));
 const env={},envFile=process.env.SUTIAPP_ENV_FILE||path.resolve(root,'../../supabase.env');for(const line of read(envFile).replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 const api='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/functions';
 const request=async(suffix,options={})=>{const r=await fetch(api+suffix,{...options,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('EDGE_HTTP_'+r.status);return r;};
 const before=json(path.join(backup,'metadata.json')),current=await(await request('/'+slug)).json(),body=Buffer.from(await(await request('/'+slug+'/body')).arrayBuffer());
 const manifest=json(path.join(evidence,'edge-candidate.json'));
 const files=mode==='rollback'?original():new Map(allowed.map(file=>[file,read(path.join(stage,file))]));
 if(mode!=='rollback')for(const c of manifest.changes)assert.equal(sha(norm(files.get(c.file))),c.after,'CANDIDATE_CHANGED');
 if(['bundle','deploy'].includes(mode)){assert.equal(current.version,before.version,'CONCURRENT_EDGE_VERSION');assert.equal(sha(body),sha(fs.readFileSync(path.join(backup,'body.eszip'))),'CONCURRENT_EDGE_SOURCE');}
 if(mode==='deploy'){
  for(const f of ['stream.json','client.json','staged-stream.json','edge-bundle.json'])assert.equal(json(path.join(evidence,f)).status,'PASS',f);
  for(const f of ['global-pages.log','global-local.log']){const result=read(path.join(evidence,f)).trim().split(/\r?\n/).map(x=>JSON.parse(x)).at(-1);assert.equal(result.status,'PASS',f);if(f.includes('local'))assert.equal(result.verifiedBundleSha256,sha(fs.readFileSync(path.join(root,'app/bundle.js'))));}
 }
 if(mode==='rollback')assert.equal(current.version,json(path.join(evidence,'edge-deploy.json')).version,'CONCURRENT_ROLLBACK_VERSION');
 if(mode!=='verify'){
  const form=new FormData();form.append('metadata',JSON.stringify({name:slug,slug,entrypoint_path:slug+'/index.ts',verify_jwt:before.verify_jwt}));for(const[file,data]of files)form.append('file',new Blob([data],{type:file.endsWith('.ts')?'application/typescript':'application/javascript'}),file);
  await request('/deploy?slug='+slug+(mode==='bundle'?'&bundleOnly=true':''),{method:'POST',body:form});
 }
 const after=await(await request('/'+slug)).json();assert.equal(after.verify_jwt,before.verify_jwt);
 if(mode==='bundle')assert.equal(after.version,current.version);else{
  const actual=artifactSources(Buffer.from(await(await request('/'+slug+'/body')).arrayBuffer()));for(const[file,data]of files){const found=actual.find(x=>x.name===file);assert(found,'SOURCE_MISSING_'+file);assert.equal(sha(norm(found.source)),sha(norm(data)),'DEPLOYED_SOURCE_MISMATCH_'+file);}
 }
 const result={status:'PASS',mode,slug,version:after.version,verify_jwt:after.verify_jwt,files:[...files].map(([file,data])=>({file,sha256:sha(norm(data))})),businessDataWrites:0,deployments:['deploy','rollback'].includes(mode)?1:0};save(path.join(evidence,'edge-'+mode+'.json'),result);console.log(JSON.stringify(result));
}
if(require.main===module)(async()=>{if(process.argv[2]==='prepare')prepare();else await remote(process.argv[2]);})().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;});
