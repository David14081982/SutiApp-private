'use strict';
// Owner-authorized, fixed deployment release. No Sheet, property or business writer.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'.tmp/sicof/google-release-20261003'),evidence=path.join(root,'docs/qa/evidence/sicof');
const scriptId='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o';
const deploymentId='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g';
const api='https://script.googleapis.com/v1/projects/'+scriptId;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),normalized=s=>s.replace(/\r/g,'').trim();
const canonical=c=>JSON.stringify(c.files.map(({name,type,source})=>({name,type,source:normalized(source)})).sort((a,b)=>a.name.localeCompare(b.name)));
const candidate=()=>fs.readFileSync(path.join(root,'google-apps-script/financial-handoff/Code.gs'),'utf8');
const inverse=s=>normalized(s).replace(/\/\/ SICOF is a separate, fixed read contract\.[\s\S]*?(?=function doPost\(event\))/, '').replace("    if(payload.action==='read_sicof_financial')return readSicofFinancial_(payload);\n",'');
const files=c=>c.files.map(({name,type,source})=>({name,type,source}));
const load=n=>JSON.parse(fs.readFileSync(path.join(folder,n),'utf8'));
function save(n,data){fs.writeFileSync(path.join(folder,n),JSON.stringify(data,null,2)+'\n');}
function proof(n,data){fs.writeFileSync(path.join(evidence,'google-release-'+n+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)env[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
async function json(url,options={}){const response=await fetch(url,{...options,cache:'no-store',headers:{...options.headers,'Cache-Control':'no-cache'},signal:AbortSignal.timeout(55000)});const data=await response.json().catch(()=>null);assert(response.ok&&data,'REMOTE_HTTP_'+response.status);return data;}
async function oauth(scope){const auth=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;const body=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:auth.client_id,client_secret:auth.client_secret,refresh_token:auth.refresh_token,grant_type:'refresh_token',scope})});assert(body.access_token,'OAUTH_TOKEN_MISSING');return body.access_token;}
async function headers(){return{Authorization:'Bearer '+await oauth('https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'),'Content-Type':'application/json'};}
function compatible(before){
  const code=before.content.files.find(f=>f.name==='Code');assert(code&&inverse(candidate())===normalized(code.source),'LEGACY_SOURCE_DRIFT');
  assert(canonical(before.content)===canonical(before.head),'UNPUBLISHED_HEAD_DRIFT');
  const manifest=before.content.files.find(f=>f.name==='appsscript');assert(manifest,'MANIFEST_MISSING');
  assert(normalized(manifest.source)===normalized(fs.readFileSync(path.join(root,'google-apps-script/financial-handoff/appsscript.json'),'utf8')),'MANIFEST_DRIFT');
  const parsed=JSON.parse(manifest.source);assert(parsed.webapp.access==='ANYONE'&&parsed.webapp.executeAs==='USER_DEPLOYING','DEPLOYMENT_ACCESS_DRIFT');
  assert(before.deployment.deploymentId===deploymentId,'DEPLOYMENT_ID_DRIFT');
  const entry=before.deployment.entryPoints.find(e=>e.entryPointType==='WEB_APP');assert(entry&&entry.webApp.url==='https://script.google.com/macros/s/'+deploymentId+'/exec','DEPLOYMENT_URL_DRIFT');
  return files(before.content).map(f=>({...f,source:f.name==='Code'?candidate():f.source}));
}
async function credentials(){
  const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const remote=await json('https://api.supabase.com/v1/projects/'+ref+'/secrets',{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}});
  const auth=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;
  const pairs=[['GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_ID',auth.client_id],['GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_SECRET',auth.client_secret],['GOOGLE_REQUEST_SYNC_OAUTH_REFRESH_TOKEN',auth.refresh_token],['FINANCIAL_LEGACY_API_URL','https://script.google.com/macros/s/'+deploymentId+'/exec']];
  const checks=pairs.map(([name,value])=>({name,matched:remote.find(r=>r.name===name)?.value===sha(value)}));
  assert(checks.every(c=>c.matched),'RUNTIME_CREDENTIAL_DRIFT');assert(remote.some(r=>r.name==='FINANCIAL_LEGACY_API_TOKEN'&&r.value),'RECEIVER_SECRET_MISSING');
  return [...checks,{name:'FINANCIAL_LEGACY_API_TOKEN',present:true,unchanged:true}];
}
async function oldReader(){
  const url=env.SUPABASE_URL+'/functions/v1/savings-settlement/source-status';
  const data=await json(url,{headers:{Authorization:'Bearer '+env.SUPABASE_SECRET_KEY,apikey:env.SUPABASE_SECRET_KEY}});
  assert(data.status==='PASS'&&data.read_only===true&&data.source==='1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80:1245291756','PRIOR_READER_NOT_VERIFIED');
  return{status:data.status,scanned_rows:data.scanned_rows,overdue_loans:data.overdue_loans,read_only:data.read_only};
}
async function denial(){
  const data=await json('https://script.google.com/macros/s/'+deploymentId+'/exec',{method:'POST',headers:{Authorization:'Bearer '+await oauth('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy'),'Content-Type':'application/json'},body:JSON.stringify({action:'read_sicof_financial',contract_version:'SICOF_FINANCIAL_READ_V1',secret:'INVALID_READ_ONLY_SICOF_RELEASE_PROBE'})});
  assert(data.ok===false&&data.error==='UNAUTHORIZED','INVALID_SECRET_NOT_DENIED');return{status:'PASS',invalid_secret_denied:true};
}
async function snapshot(h){const deployment=await json(api+'/deployments/'+deploymentId,{headers:h}),content=await json(api+'/content?versionNumber='+deployment.deploymentConfig.versionNumber,{headers:h}),head=await json(api+'/content',{headers:h});return{deployment,content,head};}
async function assertCurrent(before,h){const current=await snapshot(h);assert(current.deployment.deploymentConfig.versionNumber===before.deployment.deploymentConfig.versionNumber,'ACTIVE_VERSION_DRIFT');assert(canonical(current.content)===canonical(before.content),'ACTIVE_SOURCE_DRIFT');assert(canonical(current.head)===canonical(before.head),'HEAD_SOURCE_DRIFT');return current;}
async function confirmedDeployment(h,before,next,version,otherVersion){
  let after,checks;
  for(let attempt=0;attempt<8;attempt++){
    after=await snapshot(h);checks={version:after.deployment.deploymentConfig.versionNumber,version_matches:after.deployment.deploymentConfig.versionNumber===version,active_matches:canonical(after.content)===canonical({files:next}),head_matches:canonical(after.head)===canonical({files:next})};
    if(checks.version_matches&&checks.active_matches&&checks.head_matches)return after;
    save('readback-pending.json',{checks,after});
    assert([before.deployment.deploymentConfig.versionNumber,version,otherVersion].includes(checks.version),'CONCURRENT_DEPLOYMENT_DRIFT');
    // A deployment switch can become visible after the update response. Retry
    // only reads; never repeat a write or ignore a content/version mismatch.
    if(attempt<7)await new Promise(resolve=>setTimeout(resolve,750));
  }
  proof('readback-failure',{status:'FAIL',checks,sheet_writes:0});throw Error('DEPLOYED_READBACK_FAILED');
}
async function rollback(h,before,expected,candidateFiles){
  const current=await snapshot(h),prior=before.deployment.deploymentConfig.versionNumber;
  assert([prior,expected].filter(Number.isInteger).includes(current.deployment.deploymentConfig.versionNumber),'ROLLBACK_ACTIVE_DRIFT');
  const next={files:candidateFiles||compatible(before)};assert([canonical(before.head),canonical(next)].includes(canonical(current.head)),'ROLLBACK_HEAD_DRIFT');
  // Do not omit this PUT based on a possibly stale pre-update GET. The response
  // must confirm the exact recovery target before fresh readback is considered.
  const restored=await json(api+'/deployments/'+deploymentId,{method:'PUT',headers:h,body:JSON.stringify({deploymentConfig:before.deployment.deploymentConfig})});
  assert(restored.deploymentConfig.versionNumber===prior,'ROLLBACK_RESPONSE_MISMATCH');
  await json(api+'/content',{method:'PUT',headers:h,body:JSON.stringify({files:files(before.head)})});
  await confirmedDeployment(h,before,files(before.head),prior,expected);
  await assertCurrent(before,h);proof('rollback',{status:'PASS',restored_version:prior,same_deployment:true,head_restored:true,sheet_writes:0});
}
async function main(){
  const mode=process.argv[2]||'backup';assert(['backup','deploy','verify','rollback','diagnose','complete','probe','source-headers','optimize'].includes(mode),'MODE_INVALID');
  fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(evidence,{recursive:true});const h=await headers();
  if(mode==='backup'){
    const before=await snapshot(h);compatible(before);
    if(fs.existsSync(path.join(folder,'before.json'))){const existing=load('before.json');assert(canonical(existing.content)===canonical(before.content)&&existing.deployment.deploymentConfig.versionNumber===before.deployment.deploymentConfig.versionNumber,'BACKUP_ALREADY_EXISTS_WITH_OTHER_VERSION');}
    else save('before.json',before);
    const checks=await credentials(),prior=await oldReader(),denied=await denial();
    save('recovery.json',{command:'node scripts/release-sicof-google.js rollback',scriptId,deploymentId,priorVersion:before.deployment.deploymentConfig.versionNumber,headSha256:sha(canonical(before.head)),deploymentConfig:before.deployment.deploymentConfig});
    proof('backup',{status:'PASS',version:before.deployment.deploymentConfig.versionNumber,source_sha256:sha(canonical(before.content)),candidate_sha256:sha(normalized(candidate())),private_backup:'.tmp/sicof/google-release-20261003/before.json',legacy_inverse_exact:true,head_equals_active:true,manifest_unchanged:true,credential_checks:checks,prior_reader:prior,denial:denied,recovery_prepared:true,sheet_writes:0});return;
  }
  const before=load('before.json'),next=compatible(before);
  if(mode==='optimize'){
    const active=await snapshot(h),baseline=load('after.json');
    assert(active.deployment.deploymentConfig.versionNumber===18&&canonical(active.content)===canonical(baseline.content)&&canonical(active.head)===canonical(baseline.content),'OPTIMIZATION_V18_DRIFT');
    const memo="      if(dateColumns.includes(column)&&Object.prototype.toString.call(value)==='[object Date]'&&!isNaN(value.getTime())){\n        const timestamp=value.getTime();\n        if(!formattedDates.has(timestamp))formattedDates.set(timestamp,Utilities.formatDate(value,zone,'yyyy-MM-dd'));\n        return formattedDates.get(timestamp);\n      }";
    const original="      if(dateColumns.includes(column)&&Object.prototype.toString.call(value)==='[object Date]'&&!isNaN(value.getTime()))return Utilities.formatDate(value,zone,'yyyy-MM-dd');";
    const stripped=normalized(candidate()).replace('  const formattedDates=new Map();\n','').replace(memo,original);
    assert(stripped===normalized(active.content.files.find(f=>f.name==='Code').source),'OPTIMIZATION_SCOPE_DRIFT');
    if(fs.existsSync(path.join(folder,'optimization-before.json')))assert(canonical(load('optimization-before.json').content)===canonical(active.content),'OPTIMIZATION_BACKUP_DRIFT');
    else save('optimization-before.json',active);
    await credentials();let version;
    try{
      await json(api+'/content',{method:'PUT',headers:h,body:JSON.stringify({files:next})});
      assert(canonical(await json(api+'/content',{headers:h}))===canonical({files:next}),'OPTIMIZATION_HEAD_READBACK');
      const created=await json(api+'/versions',{method:'POST',headers:h,body:JSON.stringify({description:'SICOF per-request date formatting memo; identical source, double read and legacy writers'})});version=created.versionNumber;
      save('deployment.json',{version,before_version:17,previous_version:18});
      const published=await json(api+'/deployments/'+deploymentId,{method:'PUT',headers:h,body:JSON.stringify({deploymentConfig:{...active.deployment.deploymentConfig,versionNumber:version}})});
      assert(published.deploymentConfig.versionNumber===version,'OPTIMIZATION_PUBLISH_RESPONSE');
      const after=await confirmedDeployment(h,active,next,version);save('optimization-after.json',after);
      proof('optimization',{status:'PASS',before_version:18,version,memo_inverse_exact:true,legacy_inverse_exact:true,same_manifest:true,same_deployment:true,double_read_retained:true,formatting_scope:'timestamp cache within one request only',formatter_fixture_before:90006,formatter_fixture_after:2,fixture_rows_identical:15001,source_sha256:sha(canonical(after.content)),code_sha256:sha(candidate()),sheet_writes:0});
    }catch(error){if(version){proof('optimization-pending',{status:'BLOCKED',version,reason:'VERIFY_PROPAGATION_BEFORE_ANY_FURTHER_MUTATION',sheet_writes:0});}else await rollback(h,active,version,next);throw error;}
    return;
  }
  if(mode==='source-headers'){
    const {SICOF_WORKBOOK,SICOF_COLUMNS}=await import('../supabase/functions/sicof/loan-source.mjs');
    const values=await json('https://sheets.googleapis.com/v4/spreadsheets/'+SICOF_WORKBOOK+'/values/'+encodeURIComponent("'HISTORIAL P V2'!A1:AG1")+'?valueRenderOption=FORMATTED_VALUE',{headers:{Authorization:'Bearer '+await oauth('https://www.googleapis.com/auth/drive.file')}});
    const expected=[...fs.readFileSync(path.join(root,'supabase/functions/sicof/loan-source.mjs'),'utf8').match(/const HEADERS = (\[[^\n]+\]);/)[1].matchAll(/'([^']*)'/g)].map(m=>m[1]);
    const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
    const idx=c=>[...c].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;
    const mismatches=SICOF_COLUMNS.map((c,i)=>({column:c,expected:expected[i],actual:values.values?.[0]?.[idx(c)]})).filter(x=>norm(x.expected)!==norm(x.actual));
    save('headers-private.json',{mismatches});proof('source-headers',{status:mismatches.length?'FAIL':'PASS',header_columns_compared:SICOF_COLUMNS.length,mismatched_columns:mismatches.map(x=>x.column),read_range:'HISTORIAL P V2!A1:AG1',source_not_used_as_fallback:true,sheet_writes:0});return;
  }
  if(mode==='probe'){
    const timings={},start=Date.now();
    const {login,rpc}=require('./release-sicof-backend');
    const auth=await login(),affiliate=await rpc(auth.access_token,'get_effective_affiliate_id');
    assert(typeof affiliate==='string'&&/^[a-f0-9-]{36}$/i.test(affiliate),'PROBE_SUBJECT_REQUIRED');
    const context=await rpc(auth.access_token,'get_admin_sicof_behavior_context',{p_affiliate_ids:[affiliate]});
    assert(context.context?.actor===auth.user.id&&context.subjects?.length===1,'PROBE_CONTEXT_REQUIRED');
    timings.context_ms=Date.now()-start;const readerStart=Date.now();
    const response=await fetch(env.SUPABASE_URL+'/functions/v1/sicof',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'BEHAVIOR',affiliate_ids:[affiliate]}),signal:AbortSignal.timeout(55000)});
    const body=await response.json();timings.behavior_ms=Date.now()-readerStart;save('sicof-behavior-private.json',{http_status:response.status,body,timings});
    if(response.status!==200)proof('sicof-read-attempt',{status:'FAIL',http_status:response.status,error:/^[A-Z_]+$/.test(body.error||'')?body.error:'UNAVAILABLE',timings,financial_writes:0});
    assert(response.status===200,'SICOF_BEHAVIOR_HTTP_'+response.status);
    const behavior=body.data?.[affiliate];assert(body.context?.actor===auth.user.id&&behavior&&['CURRENT','ARREARS','NO_HISTORY','REVIEW'].includes(behavior.status),'SICOF_BEHAVIOR_RESPONSE_INVALID');
    assert(Number.isFinite(Date.parse(behavior.observed_at))&&Math.abs(Date.now()-Date.parse(behavior.observed_at))<600000,'SICOF_SOURCE_NOT_FRESH');
    const anonymous=await fetch(env.SUPABASE_URL+'/functions/v1/sicof',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'BEHAVIOR',affiliate_ids:[affiliate]}),signal:AbortSignal.timeout(15000)});
    assert([401,403].includes(anonymous.status),'ANONYMOUS_READER_NOT_DENIED');
    proof('sicof-real-read',{status:'PASS',http_status:response.status,action:'BEHAVIOR',authenticated_context_verified:true,subjects_returned:1,source_fresh:true,observed_at:behavior.observed_at,source_path:'SICOF Edge -> existing authenticated Apps Script read_sicof_financial -> fixed HISTORIAL P V2',anonymous_http_status:anonymous.status,timings,financial_writes:0,private_payload_only:true});return;
  }
  if(mode==='complete'){
    const saved=load('deployment.json');let active;
    for(let i=0;i<3;i++){
      active=await snapshot(h);assert(active.deployment.deploymentConfig.versionNumber===saved.version&&canonical(active.content)===canonical({files:next}),'STABLE_ACTIVE_READBACK_REQUIRED');
      assert([canonical(before.head),canonical({files:next})].includes(canonical(active.head)),'UNRELATED_HEAD_DRIFT');
      if(i<2)await new Promise(resolve=>setTimeout(resolve,1000));
    }
    await credentials();
    if(canonical(active.head)!==canonical({files:next}))await json(api+'/content',{method:'PUT',headers:h,body:JSON.stringify({files:next})});
    const after=await confirmedDeployment(h,before,next,saved.version);
    assert(JSON.stringify(after.deployment.entryPoints)===JSON.stringify(before.deployment.entryPoints),'ENTRYPOINT_CONFIG_CHANGED');
    save('after.json',after);proof('deployment',{status:'PASS',before_version:before.deployment.deploymentConfig.versionNumber,version:saved.version,same_deployment:true,same_entrypoints:true,same_manifest:true,legacy_inverse_exact:true,stable_active_reads:3,head_matches_active:true,source_sha256:sha(canonical(after.content)),sheet_writes:0});return;
  }
  if(mode==='diagnose'){
    const saved=load('deployment.json'),active=await snapshot(h),version=await json(api+'/content?versionNumber='+saved.version,{headers:h});
    save('diagnosis.json',{active,version});
    proof('diagnosis',{status:'PASS',mode,active_version:active.deployment.deploymentConfig.versionNumber,created_version:saved.version,created_source_matches_candidate:canonical(version)===canonical({files:next}),head_matches_original:canonical(active.head)===canonical(before.head),active_matches_original:canonical(active.content)===canonical(before.content),file_checks:next.map(f=>({name:f.name,type:f.type,created_matches:normalized(version.files.find(x=>x.name===f.name)?.source||'')===normalized(f.source)})),sheet_writes:0});return;
  }
  if(mode==='rollback'){await rollback(h,before,load('deployment.json').version);return;}
  if(mode==='deploy'){
    const ready=JSON.parse(fs.readFileSync(path.join(evidence,'google-release-backup.json'),'utf8'));assert(ready.status==='PASS'&&ready.candidate_sha256===sha(normalized(candidate())),'BACKUP_OR_CANDIDATE_NOT_VERIFIED');
    await assertCurrent(before,h);await credentials();
    let version;try{
      await json(api+'/content',{method:'PUT',headers:h,body:JSON.stringify({files:next})});
      const head=await json(api+'/content',{headers:h});assert(canonical(head)===canonical({files:next}),'CANDIDATE_HEAD_READBACK_FAILED');
      const created=await json(api+'/versions',{method:'POST',headers:h,body:JSON.stringify({description:'H-SICOF-RELEASE-001: fixed authenticated financial read; existing writers unchanged'})});version=created.versionNumber;assert(Number.isInteger(version),'VERSION_MISSING');save('deployment.json',{version,before_version:before.deployment.deploymentConfig.versionNumber});
      await json(api+'/deployments/'+deploymentId,{method:'PUT',headers:h,body:JSON.stringify({deploymentConfig:{...before.deployment.deploymentConfig,versionNumber:version}})});
      const after=await confirmedDeployment(h,before,next,version);
      assert(JSON.stringify(after.deployment.entryPoints)===JSON.stringify(before.deployment.entryPoints),'ENTRYPOINT_CONFIG_CHANGED');
      save('after.json',after);proof('deployment',{status:'PASS',before_version:before.deployment.deploymentConfig.versionNumber,version,same_deployment:true,same_entrypoints:true,same_manifest:true,legacy_inverse_exact:true,source_sha256:sha(canonical(after.content)),sheet_writes:0});
    }catch(error){try{await rollback(h,before,version);}catch{proof('recovery-required',{status:'BLOCKED',reason:'VERIFY_REMOTE_DRIFT_BEFORE_RECOVERY',sheet_writes:0});}throw error;}
    return;
  }
  const saved=load('deployment.json'),after=await snapshot(h);assert(after.deployment.deploymentConfig.versionNumber===saved.version&&canonical(after.content)===canonical({files:next}),'VERIFY_RELEASE_DRIFT');
  const prior=await oldReader(),denied=await denial(),probePath=path.join(evidence,'google-release-sicof-real-read.json');
  const realRead=fs.existsSync(probePath)?JSON.parse(fs.readFileSync(probePath,'utf8')):null;
  proof('verification',{status:'PASS',version:saved.version,prior_reader:prior,denial:denied,source_readback_exact:true,sicof_real_read:realRead?.status==='PASS'?'PASS — google-release-sicof-real-read.json':'PENDING_EDGE_RELEASE_PROBE',sheet_writes:0});
}
main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:/^[A-Z_0-9]+$/.test(error.message)?error.message:'RELEASE_CHECK_FAILED',sheet_writes:0,secrets_logged:false}));process.exitCode=1;});
