'use strict';
// Explicit release operations, no SQL mutations. Private artifacts stay ignored.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const {environment,query}=require('./inspect-loan-history');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/loan-historical-resolution'),release=path.join(dir,'release');
const out=path.join(release,'docs/qa/evidence/loan-historical-resolution');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>fs.readFileSync(path.join(release,f),'utf8');
const files=['financial-legacy/index.ts','financial-legacy/loan-capacity.mjs','financial-legacy/historical-obligation-map.mjs','financial-legacy/visibility-policy.js','financial-legacy/request-google-sync.js','financial-legacy/savings-eligibility.ts','loan-history/history.mjs'];
function save(name,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
function run(bin,args,options={}){return cp.execFileSync(bin,args,{cwd:release,windowsHide:true,maxBuffer:20e6,encoding:'utf8',...options});}
function form(){const data=new FormData();data.append('metadata',JSON.stringify({name:'financial-legacy',slug:'financial-legacy',entrypoint_path:'financial-legacy/index.ts',verify_jwt:true}));for(const file of files)data.append('file',new Blob([read('supabase/functions/'+file)]),file);return data;}
async function management(suffix,options={}){const env=environment();const response=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+suffix,{...options,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...options.headers},signal:AbortSignal.timeout(55000)});const body=Buffer.from(await response.arrayBuffer());if(!response.ok){fs.writeFileSync(path.join(dir,'management-error-private.txt'),body);throw Error('MANAGEMENT_HTTP_'+response.status);}return body;}
const metadata=async()=>JSON.parse(await management('/functions/financial-legacy'));
async function fingerprints(){return (await query(`select jsonb_build_object(
 'funds',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.financial_funds t),
 'rules',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.financial_rules t),
 'historical_sources',(select md5(coalesce(jsonb_agg(jsonb_build_object('folio',folio,'source',source) order by folio)::text,'')) from loan_history_private.observations where is_current),
 'requests',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.program_requests t)
 ) result`))[0].result;}
async function main(){const mode=process.argv[2];
 if(mode==='preflight'){
  const env=environment(),project=new URL(env.SUPABASE_URL).hostname.split('.')[0];
  assert.equal(project,'jsucdyothkuptosvskqf');
  const before=JSON.parse(fs.readFileSync(path.join(dir,'before/edge-metadata.json')));
  assert.equal(before.slug,'financial-legacy');assert.equal(before.version,65);
  assert(before.entrypoint_path.includes('user_fn_'+project+'_'));
  const config=fs.readFileSync(path.join(dir,'site/app/supabase-config.js'),'utf8');assert(config.includes(env.SUPABASE_URL));
  const entries=files.map(file=>{const content=read('supabase/functions/'+file);
   for(const [key,value]of Object.entries(env))if(value&&value.length>10&&/PASSWORD|SECRET|SERVICE_ROLE|ACCESS_TOKEN/i.test(key))assert(!content.includes(value),'SECRET_IN_PAYLOAD');
   const original=path.join(dir,'before/functions',file);
   return {file,bytes:Buffer.byteLength(content),sha256:sha(content),changed:!fs.existsSync(original)||sha(fs.readFileSync(original))!==sha(content)};
  });
  assert.deepEqual(entries.filter(x=>x.changed).map(x=>x.file),['financial-legacy/index.ts','financial-legacy/loan-capacity.mjs','financial-legacy/historical-obligation-map.mjs']);
  const cohort=JSON.parse(read('docs/qa/evidence/loan-historical-resolution/cohort.json'));assert.equal(cohort.status,'PASS');
  save('release-preflight',{status:'PASS',authorization:'User H-LOAN-HISTORICAL-FUND-RESOLUTION-COMPLETE-001: Si todos los casos determinísticos están PASS: publica la corrección, verifica producción y detente.',
   destination:'https://api.supabase.com/v1/projects/'+project+'/functions/deploy?slug=financial-legacy',
   destinationEvidence:'Existing ACTIVE financial-legacy v65 entrypoint project reference and built SutiApp Supabase URL match.',
   payload:'Only these seven backend source files; no environment file, credentials, raw cohort, names, balances or historical records.',
   files:entries,sourceChanges:3,unchangedDependencies:4,sqlMutations:0,financialBusinessWrites:0,cohortEvidence:'cohort.json',compileOnly:true});return;
 }
 if(mode==='build'){
  const base=run('git',['show','HEAD:app/bundle.js']);
  const rx=/\/\* @@file (.*?) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g;
  const before=new Map([...base.replace(/\r/g,'').matchAll(rx)].map(m=>[m[1],m[2]]));assert.equal(before.size,170);
  const name='screens-loan.jsx',code='(function(){\n'+read('app/'+name).replace(/\r/g,'').trimEnd()+'\n})();\n';
  const bundle=[...before].map(([n,b])=>'/* @@file '+n+' */\n'+(n===name?code:b)).join('');
  new(require('vm').Script)(bundle);fs.writeFileSync(path.join(release,'app/bundle.js'),bundle);
  const version='2026102801';for(const file of ['SutiApp.html','sw.js']){
   const original=run('git',['show','HEAD:'+file]);let next=original.replaceAll('2026102705',version);
   next=next.replace(/(app\/financial-legacy-repository\.js\?v=)[^"']+/g,'$1'+version);
   fs.writeFileSync(path.join(release,file),next);
  }
  const after=new Map([...bundle.matchAll(rx)].map(m=>[m[1],m[2]]));assert.equal(after.size,170);
  assert.deepEqual([...before].filter(([n,b])=>after.get(n)!==b).map(([n])=>n),[name]);
  const env=environment(),target=path.join(dir,'site');
  const build=JSON.parse(run(process.execPath,['scripts/build-pages-site.js',target],{env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY}}));
  assert.equal(build.status,'PASS');assert.equal(sha(fs.readFileSync(path.join(target,'app/bundle.js'))),sha(bundle));
  save('build',{status:'PASS',base:run('git',['rev-parse','HEAD']).trim(),version,changedChunks:[name],preservedModules:169,bundleSha256:sha(bundle),repositorySha256:sha(read('app/financial-legacy-repository.js')),build,globalSuitesRun:0});return;
 }
 if(mode==='compile'){
  const preflight=JSON.parse(read('docs/qa/evidence/loan-historical-resolution/release-preflight.json'));assert.equal(preflight.status,'PASS');
  assert.equal(new URL(environment().SUPABASE_URL).hostname,'jsucdyothkuptosvskqf.supabase.co');
  for(const file of preflight.files)assert.equal(sha(read('supabase/functions/'+file.file)),file.sha256,'PREFLIGHT_PAYLOAD_DRIFT');
  assert.equal((await metadata()).version,65,'EDGE_VERSION_DRIFT');
  const body=await management('/functions/deploy?slug=financial-legacy&bundleOnly=true',{method:'POST',body:form()});
  const receipt=JSON.parse(body);assert.equal(receipt.slug,'financial-legacy');assert.equal(receipt.version,66);assert.equal(receipt.verify_jwt,true);assert(/^[a-f0-9]{64}$/.test(receipt.ezbr_sha256));
  fs.writeFileSync(path.join(dir,'compiled-receipt.json'),body);
  assert.equal((await metadata()).version,65,'EDGE_VERSION_DRIFT');
  save('edge-compile',{status:'PASS',bundleOnly:true,installedVersionUnchanged:65,responseFormat:'JSON compilation receipt; not ESZIP payload',receiptBytes:body.length,receiptSha256:sha(body),compiledEzbrSha256:receipt.ezbr_sha256,files:files.map(file=>({file,sha256:sha(read('supabase/functions/'+file))}))});return;
 }
 if(mode==='publish-backend'){
  const compiled=JSON.parse(read('docs/qa/evidence/loan-historical-resolution/edge-compile.json'));
  assert.equal(compiled.status,'PASS');for(const f of compiled.files)assert.equal(sha(read('supabase/functions/'+f.file)),f.sha256,'COMPILED_SOURCE_DRIFT');
  const cohort=JSON.parse(read('docs/qa/evidence/loan-historical-resolution/cohort.json'));assert.equal(cohort.status,'PASS');
  const before=await metadata();assert.equal(before.version,65);assert.equal(before.verify_jwt,true);
  const snapshot=await fingerprints();fs.writeFileSync(path.join(dir,'business-fingerprints-before.json'),JSON.stringify(snapshot));
  const deployed=JSON.parse(await management('/functions/deploy?slug=financial-legacy',{method:'POST',body:form()}));
  assert.equal(deployed.version,66);assert.equal(deployed.verify_jwt,true);
  save('edge-deployed',{status:'PASS',at:new Date().toISOString(),version:deployed.version,verifyJwt:deployed.verify_jwt,files:compiled.files,businessWrites:0});return;
 }
 if(mode==='verify-backend'){
  const installed=await metadata();assert.equal(installed.version,66);assert.equal(installed.status,'ACTIVE');assert.equal(installed.verify_jwt,true);
  const helper=path.join(root,'scripts/backup-loan-available-credit.js');const parse=new Function('require','__dirname','module',fs.readFileSync(helper,'utf8')+'\nreturn eszipSources;')(require('module').createRequire(helper),path.dirname(helper),{});
  const body=await management('/functions/financial-legacy/body'),sources=parse(body);fs.writeFileSync(path.join(dir,'installed.eszip'),body);
  assert.deepEqual(sources.map(x=>x.name).sort(),[...files].sort());for(const source of sources)assert.equal(sha(source.source),sha(read('supabase/functions/'+source.name)),source.name+' DEPLOYED_SOURCE_DRIFT');
  const before=JSON.parse(fs.readFileSync(path.join(dir,'business-fingerprints-before.json'))),after=await fingerprints();assert.deepEqual(after,before,'BUSINESS_DATA_CHANGED_DURING_DEPLOYMENT');
  save('edge-production',{status:'PASS',at:new Date().toISOString(),version:66,verifyJwt:true,verifiedFiles:sources.map(x=>({file:x.name,sha256:sha(x.source)})),businessFingerprintsUnchanged:true,financialBalancesChanged:0,historicalRowsModified:0,businessWrites:0});return;
 }
 throw Error('MODE_NOT_SUPPORTED');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
