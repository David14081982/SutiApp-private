'use strict';
// Controlled candidate operations. Remote mutations are separate explicit modes.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const {environment,query}=require('./inspect-loan-history');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/loan-available-credit'),isolated=path.join(dir,'release'),release=path.resolve(process.env.SUTI_RELEASE_ROOT||(fs.existsSync(isolated)?isolated:root)),out=path.join(root,'docs/qa/evidence/loan-available-credit');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=f=>fs.readFileSync(path.join(release,f),'utf8');
function save(name,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
function copy(file){if(root===release)return;const target=path.join(release,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
function shell(cmd,args,options={}){return cp.execFileSync(cmd,args,{cwd:release,windowsHide:true,maxBuffer:64*1024*1024,...options});}
const chunks=s=>new Map([...s.replace(/\r/g,'').matchAll(/\/\* @@file (.*?) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)].map(m=>[m[1],m[2]]));
const edgeFiles=['financial-legacy/index.ts','financial-legacy/loan-capacity.mjs','financial-legacy/visibility-policy.js','financial-legacy/request-google-sync.js','financial-legacy/savings-eligibility.ts','loan-history/history.mjs'];
function edgeForm(){const form=new FormData();form.append('metadata',JSON.stringify({name:'financial-legacy',slug:'financial-legacy',entrypoint_path:'financial-legacy/index.ts',verify_jwt:true}));for(const f of edgeFiles)form.append('file',new Blob([read('supabase/functions/'+f)]),f);return form;}
async function management(env,suffix,options={}){
 const response=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+suffix,{...options,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...options.headers},signal:AbortSignal.timeout(75000)});
 const body=await response.text();if(!response.ok){fs.writeFileSync(path.join(dir,'last-management-error.json'),body);throw Error('MANAGEMENT_HTTP_'+response.status);}
 return JSON.parse(body);
}
async function main(){
 const mode=process.argv[2],env=environment();
 if(mode==='publish-backend'){
  const compilation=JSON.parse(fs.readFileSync(path.join(out,'edge-compile.json'),'utf8'));assert.equal(compilation.status,'PASS');
  for(const file of compilation.files)assert.equal(sha(read('supabase/functions/'+file.file)),file.sha256,'COMPILED_SOURCE_DRIFT');
  const source=read('supabase/migrations/20261027000100_loan_available_credit.sql');
  assert.equal(sha(source),'203826dd3e9a703785495dced45bcfb86a6a5294a5e07ae0478014ebf84c60ff');
  assert.equal((await management(env,'/functions/financial-legacy')).version,64,'EDGE_VERSION_DRIFT');
  assert.equal((await management(env,'/functions/loan-history')).version,7,'HISTORY_VERSION_DRIFT');
  cp.execFileSync(process.execPath,[path.join(root,'scripts/inspect-loan-available-credit.js'),'--preflight'],{cwd:root,windowsHide:true,stdio:'pipe'});
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  assert(/commit;\s*$/i.test(source));
  const sql=source.replace(/commit;\s*$/i,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('20261027000100','loan_available_credit',array[${quote(source)}]);\nselect 'PASS' status;\ncommit;`);
  // One transaction includes schema and migration registration. Never retry a
  // mutation after transport uncertainty; inspect the installed state first.
  const receipt=await management(env,'/database/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:false})});
  assert.equal(receipt[0]?.status,'PASS');
  save('migration-applied',{status:'PASS',at:new Date().toISOString(),version:'20261027000100',sha256:sha(source),trackingAtomic:true,historicalBusinessRowsWritten:0});
  const deployed=await management(env,'/functions/deploy?slug=financial-legacy',{method:'POST',body:edgeForm()});
  assert.equal(deployed.version,65);assert.equal(deployed.verify_jwt,true);
  const installed=await management(env,'/functions/financial-legacy');assert.equal(installed.version,65);assert.equal(installed.status,'ACTIVE');assert.equal(installed.verify_jwt,true);
  save('edge-deployed',{status:'PASS',at:new Date().toISOString(),version:installed.version,verifyJwt:installed.verify_jwt,statusRemote:installed.status,ezbrSha256:deployed.ezbr_sha256,files:compilation.files});return;
 }
 if(mode==='build'){
  const base=shell('git',['show','HEAD:app/bundle.js'],{encoding:'utf8'}),generated=read('app/bundle.js'),before=chunks(base),after=chunks(generated);
  const focal=new Set(['loan-availability-admin.js','screens-loan.jsx','screens-admin-finanzas.jsx','screens-financiera.jsx','app.jsx']);
  assert(after.has('loan-availability-admin.js'));
  const newNames=[...after.keys()].filter(n=>!before.has(n));assert.deepEqual(newNames,['loan-availability-admin.js']);
  const preserved=[];let bundle='';
  for(const [name,code]of after){
   if(!focal.has(name)&&before.get(name)!==code)preserved.push(name);
   bundle+='/* @@file '+name+' */\n'+(focal.has(name)?code:before.get(name));
  }
  new(require('vm').Script)(bundle);fs.writeFileSync(path.join(release,'app/bundle.js'),bundle);
  const next='2026102609';for(const f of ['SutiApp.html','sw.js']){
   let value=read(f);value=value.replaceAll('2026102608',next);
   if(f==='SutiApp.html')value=value.replace(/(app\/financial-legacy-repository\.js\?v=)[^"']+/,'$1'+next);
   fs.writeFileSync(path.join(release,f),value);
  }
  for(const f of ['supabase/functions/financial-legacy/loan-capacity.mjs','supabase/migrations/20261027000100_loan_available_credit.sql','supabase/recovery/20261027000100_loan_available_credit.sql','scripts/test-loan-available-credit.js'])copy(f);
  const target=path.join(dir,'site-'+sha(bundle).slice(0,12));
  shell(process.execPath,['scripts/build-pages-site.js',target],{env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe'});
  assert.equal(sha(fs.readFileSync(path.join(target,'app/bundle.js'))),sha(bundle));
  fs.writeFileSync(path.join(dir,'site-path.txt'),target);
  save('build',{status:'PASS',base:'dad2cdfbc3c6bd86806faebd1a6c3f09b503b7ba',version:next,bundleSha256:sha(bundle),site:target,changedChunks:[...focal],nonfocalCompiledDifferencesPreserved:preserved});return;
 }
 if(mode==='compile'){
  const base='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0],headers={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN};
  const files=['financial-legacy/index.ts','financial-legacy/loan-capacity.mjs','financial-legacy/visibility-policy.js','financial-legacy/request-google-sync.js','financial-legacy/savings-eligibility.ts','loan-history/history.mjs'];
  const form=new FormData();form.append('metadata',JSON.stringify({name:'financial-legacy',slug:'financial-legacy',entrypoint_path:'financial-legacy/index.ts',verify_jwt:true}));
  for(const f of files)form.append('file',new Blob([read('supabase/functions/'+f)]),f);
  const response=await fetch(base+'/functions/deploy?slug=financial-legacy&bundleOnly=true',{method:'POST',headers,body:form,signal:AbortSignal.timeout(55000)});
  const body=Buffer.from(await response.arrayBuffer());fs.writeFileSync(path.join(dir,'edge-compiled.bin'),body);
  if(!response.ok)throw Error('EDGE_COMPILE_HTTP_'+response.status);
  const meta=await(await fetch(base+'/functions/financial-legacy',{headers})).json();assert.equal(meta.version,64);
  save('edge-compile',{status:'PASS',bundleOnly:true,installedVersionUnchanged:meta.version,bytes:body.length,sha256:sha(body),files:files.map(file=>({file,sha256:sha(read('supabase/functions/'+file))}))});return;
 }
 throw Error('MODE_NOT_SUPPORTED');
}
main().catch(e=>{console.error(e.code==='ERR_ASSERTION'?'ASSERTION: '+e.message.split('\n')[0]:e.message);process.exitCode=1;});
