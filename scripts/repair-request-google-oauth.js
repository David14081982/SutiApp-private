'use strict';
// Existing receiver credential separation. No business SQL or Google writes.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),crypto=require('crypto');
const mode=process.argv[2],dir=path.join(os.tmpdir(),'sutiapp-request-oauth-20260921'),env={};
for(const l of fs.readFileSync('supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const base='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0],headers={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN};
const plans={'financial-legacy':['index.ts','visibility-policy.js','request-google-sync.js'],'request-delete':['index.ts']};
const changed={'financial-legacy':'request-google-sync.js','request-delete':'index.ts'};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function get(url,opt={}){const r=await fetch(url,{...opt,headers:{...headers,...opt.headers},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('HTTP_'+r.status);return r;}
function modules(body){
 let p=0;const take=n=>{assert(n>=0&&p+n<=body.length);const b=body.subarray(p,p+n);p+=n;return b;},u32=()=>take(4).readUInt32BE(),str=()=>take(u32()).toString();
 assert.equal(take(8).toString(),'ESZIP2.3');assert.equal(take(u32()).toString('hex'),'00000100');
 const end=p+4+body.readUInt32BE(p),entries=[];u32();
 while(p<end){const name=str(),kind=take(1)[0];if(kind===0)entries.push({name,offset:u32(),length:u32(),mapOffset:u32(),mapLength:u32(),kind:take(1)[0]});else if(kind===1)str();else throw Error('ESZIP_KIND');}
 assert.equal(p,end);assert.equal(u32(),0);const sources=take(u32()),maps=take(u32());assert.equal(p,body.length);
 return Object.fromEntries(entries.map(e=>[e.name,e.mapLength?JSON.parse(maps.subarray(e.mapOffset,e.mapOffset+e.mapLength).toString()).sourcesContent?.[0]||sources.subarray(e.offset,e.offset+e.length).toString():sources.subarray(e.offset,e.offset+e.length).toString()]));
}
async function main(){
 assert(['backup','compile','configure','deploy','inspect'].includes(mode));fs.mkdirSync(dir,{recursive:true});
 if(mode==='configure'){
  const a=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;
  const secrets=[['CLIENT_ID','client_id'],['CLIENT_SECRET','client_secret'],['REFRESH_TOKEN','refresh_token']].map(([suffix,key])=>({name:'GOOGLE_REQUEST_SYNC_OAUTH_'+suffix,value:a[key]}));
  assert(secrets.every(x=>x.value));await get(base+'/secrets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(secrets)});
  console.log(JSON.stringify({status:'PASS',mode,names:secrets.map(x=>x.name)}));return;
 }
 for(const [slug,names] of Object.entries(plans)){
  const current=await(await get(base+'/functions/'+slug)).json(),file=path.join(dir,slug+'.json');assert(current.verify_jwt);if(mode==='inspect'){const old=JSON.parse(fs.readFileSync(file,'utf8')),m=modules(Buffer.from(await(await get(base+'/functions/'+slug+'/body')).arrayBuffer()));console.log(JSON.stringify({slug,version:current.version,updated_at:current.updated_at,checks:names.map(name=>{const key=Object.keys(m).find(k=>k==='source/'+name||k.endsWith('/'+slug+'/'+name));return{name,baselineEqual:m[key]===old.sources[name],candidateEqual:m[key]===old.sources[name].replaceAll('GOOGLE_VISIBILITY_OAUTH_','GOOGLE_REQUEST_SYNC_OAUTH_')};})}));continue;}
  if(mode==='backup'){
   assert(!fs.existsSync(file),'BACKUP_EXISTS');const bytes=Buffer.from(await(await get(base+'/functions/'+slug+'/body')).arrayBuffer()),m=modules(bytes),sources={};
   for(const name of names){const key=Object.keys(m).find(k=>k==='source/'+name||k.endsWith('/'+slug+'/'+name));assert(key,'MODULE_'+name);sources[name]=m[key];const local=fs.readFileSync('supabase/functions/'+slug+'/'+name,'utf8');assert(local.replaceAll('GOOGLE_REQUEST_SYNC_OAUTH_','GOOGLE_VISIBILITY_OAUTH_').replace(/\r/g,'')===sources[name].replace(/\r/g,''),'BASELINE_DRIFT_'+name);}
   fs.writeFileSync(path.join(dir,slug+'.eszip'),bytes);fs.writeFileSync(file,JSON.stringify({metadata:current,sources}));console.log(JSON.stringify({mode,slug,version:current.version,backupSha:sha(bytes)}));continue;
  }
  const prior=JSON.parse(fs.readFileSync(file,'utf8'));assert(current.version>=prior.metadata.version,'REMOTE_VERSION_REWOUND');const live=modules(Buffer.from(await(await get(base+'/functions/'+slug+'/body')).arrayBuffer()));for(const name of names){const key=Object.keys(live).find(k=>k==='source/'+name||k.endsWith('/'+slug+'/'+name));assert(live[key]===prior.sources[name],'REMOTE_SOURCE_DRIFT_'+name);}
  const sources=Object.fromEntries(names.map(name=>{const local=fs.readFileSync('supabase/functions/'+slug+'/'+name,'utf8'),expected=name===changed[slug]?prior.sources[name].replaceAll('GOOGLE_VISIBILITY_OAUTH_','GOOGLE_REQUEST_SYNC_OAUTH_'):prior.sources[name];assert(local.replace(/\r/g,'')===expected.replace(/\r/g,''),'SCOPE_DRIFT');return[name,expected];}));
  const fingerprint=sha(JSON.stringify(sources)),compileFile=path.join(dir,slug+'-compile.json');
  if(mode==='deploy')assert.equal(JSON.parse(fs.readFileSync(compileFile,'utf8')).fingerprint,fingerprint);
  const form=new FormData();form.append('metadata',JSON.stringify({name:slug,slug,entrypoint_path:'index.ts',verify_jwt:true}));for(const [name,source] of Object.entries(sources))form.append('file',new Blob([source],{type:name.endsWith('.ts')?'application/typescript':'application/javascript'}),name);
  await get(base+'/functions/deploy?slug='+slug+(mode==='compile'?'&bundleOnly=true':''),{method:'POST',body:form});
  const after=await(await get(base+'/functions/'+slug)).json();assert(after.verify_jwt);assert.equal(after.version,current.version+(mode==='compile'?0:1));
  if(mode==='compile')fs.writeFileSync(compileFile,JSON.stringify({fingerprint}));
  else{const m=modules(Buffer.from(await(await get(base+'/functions/'+slug+'/body')).arrayBuffer()));for(const [name,source] of Object.entries(sources)){const key=Object.keys(m).find(k=>k==='source/'+name||k.endsWith('/'+slug+'/'+name));assert.equal(m[key],source,'READBACK');}}
  const proof={status:'PASS',mode,slug,before:current.version,after:after.version,fingerprint,verifyJwt:true};fs.writeFileSync(path.join(dir,slug+'-'+mode+'.json'),JSON.stringify(proof));console.log(JSON.stringify(proof));
 }
}
module.exports={modules};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
