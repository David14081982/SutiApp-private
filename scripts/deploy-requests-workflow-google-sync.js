'use strict';
// Scoped release preparation. Default is a read-only backup/probe; mutations require an explicit mode.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'backup',env={};
const backup=process.env.REQUEST_SYNC_BACKUP_DIR||'C:/tmp/sutiapp-requests-workflow-sync-backup-20260908';
const evidence=path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908');
const scriptId='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o';
const deploymentId='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
for(const line of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE||'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0)env[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0],base='https://api.supabase.com/v1/projects/'+ref+'/functions/';
const headers={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN};
async function json(url,options){const response=await fetch(url,{...options,signal:AbortSignal.timeout(45000)});const data=await response.json().catch(()=>null);if(!response.ok)throw Error('REMOTE_HTTP_'+response.status);return data;}
async function oauth(scope){
  const auth=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;
  const token=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:auth.client_id,client_secret:auth.client_secret,refresh_token:auth.refresh_token,grant_type:'refresh_token',scope})});
  assert(token?.access_token,'GOOGLE_OAUTH_FAILED');return token.access_token;
}
async function database(query){return json('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({query})});}
const sqlString=value=>"'"+String(value).replace(/'/g,"''")+"'";
async function main(){
  if(mode==='register-sql'){
    const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260908000100_requests_workflow_google_sync.sql'),'utf8');
    const applied=JSON.parse(fs.readFileSync(path.join(evidence,'backend-apply.json'),'utf8'));assert.equal(applied.migrationSha256,sha(migration));
    assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'installed-sql.json'),'utf8')).status,'PASS');
    await database(`begin;insert into supabase_migrations.schema_migrations(version,name,statements) values('20260908000100','requests_workflow_google_sync',array[${sqlString(migration)}]) on conflict(version) do nothing;do $verify$ begin if not exists(select 1 from supabase_migrations.schema_migrations where version='20260908000100' and name='requests_workflow_google_sync' and statements=array[${sqlString(migration)}]) then raise exception 'MIGRATION_HISTORY_DRIFT';end if;end $verify$;commit;`);
    const proof={status:'PASS',version:'20260908000100',migrationSha256:sha(migration),schemaReapplied:false};fs.writeFileSync(path.join(evidence,'migration-history.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));return;
  }
  if(mode==='backup'){
    fs.mkdirSync(backup,{recursive:true});
    const status=await json(base+'financial-legacy',{headers});
    const response=await fetch(base+'financial-legacy/body',{headers});assert(response.ok,'EDGE_BACKUP_FAILED');const edge=Buffer.from(await response.arrayBuffer());
    const token=await oauth('https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments');
    const googleHeaders={Authorization:'Bearer '+token};
    const deployment=await json('https://script.googleapis.com/v1/projects/'+scriptId+'/deployments/'+deploymentId,{headers:googleHeaders});
    const content=await json('https://script.googleapis.com/v1/projects/'+scriptId+'/content?versionNumber='+deployment.deploymentConfig.versionNumber,{headers:googleHeaders});
    // Full backups may contain internal configuration; keep them outside the repository and do not overwrite.
    for(const [file,value] of [['edge-before.eszip',edge],['edge-before.json',JSON.stringify(status,null,2)],['google-deployment-before.json',JSON.stringify(deployment,null,2)],['google-content-before.json',JSON.stringify(content,null,2)]]){
      const target=path.join(backup,file);if(!fs.existsSync(target))fs.writeFileSync(target,value);else assert.equal(sha(fs.readFileSync(target)),sha(value),'REMOTE_BASELINE_CHANGED_'+file);
    }
    const receiverToken=await oauth('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy');
    // Invalid shared secret guarantees this authenticated receiver probe cannot write any sheet.
    const probe=await json('https://script.google.com/macros/s/'+deploymentId+'/exec',{method:'POST',headers:{Authorization:'Bearer '+receiverToken,'Content-Type':'application/json'},body:JSON.stringify({action:'handoff',secret:'INVALID_READ_ONLY_PROBE'})});
    assert(probe?.ok===false&&probe.error==='UNAUTHORIZED','GOOGLE_AUTHENTICATED_RECEIVER_PROBE_FAILED_'+(probe===null?'NON_JSON':JSON.stringify({ok:probe?.ok,error:probe?.error,action:probe?.action})));
    const proof={status:'PASS',mode,edgeVersion:status.version,verifyJwt:status.verify_jwt,edgeSha256:sha(edge),googleVersion:deployment.deploymentConfig.versionNumber,googleSourceSha256:sha(JSON.stringify(content)),authenticatedReceiverJson:true,sheetWrites:0,backupDirectory:backup};
    fs.writeFileSync(path.join(evidence,'release-backup.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));return;
  }
  if(['apply-sql','deploy-google','configure-worker'].includes(mode)){
    assert(JSON.parse(fs.readFileSync(path.join(evidence,'release-backup.json'),'utf8')).authenticatedReceiverJson,'AUTHENTICATED_BACKUP_REQUIRED');
    assert(JSON.parse(fs.readFileSync(path.join(evidence,'candidate-sql.json'),'utf8')).status==='PASS','SQL_VERIFICATION_REQUIRED');
    assert(JSON.parse(fs.readFileSync(path.join(evidence,'candidate-bridge.json'),'utf8')).ownerColumnBoundary==='A:AG; AH onward excluded','A_AG_VERIFICATION_REQUIRED');
    if(mode==='apply-sql'){
      const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260908000100_requests_workflow_google_sync.sql'),'utf8');
      const before=JSON.parse(fs.readFileSync(path.join(evidence,'before-functions.json'),'utf8')).concat(JSON.parse(fs.readFileSync(path.join(evidence,'before-quote-functions.json'),'utf8')));
      const names=['sync_program_request_tracking_from_status','resolve_program_request_workflow_state','transition_program_request_workflow','list_self_program_request_history','create_program_request'];
      const guard=names.map(name=>{const definition=before.find(f=>f.proname===name).definition;return `if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=${sqlString(name)} and pg_get_functiondef(p.oid)=${sqlString(definition)}) then raise exception 'LIVE_FUNCTION_DRIFT_${name}';end if;`;}).join('\n');
      await database(migration.replace(/^begin;/,'begin;\ndo $guard$ begin\n'+guard+'\nend $guard$;'));
      const proof={status:'PASS',mode,migrationSha256:sha(migration),beforeFunctionsVerified:names,requestRowsRewritten:0};fs.writeFileSync(path.join(evidence,'backend-apply.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));return;
    }
    if(mode==='deploy-google'){
      const token=await oauth('https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments');const googleHeaders={Authorization:'Bearer '+token,'Content-Type':'application/json'};
      const priorProofPath=path.join(evidence,'google-deploy.json');
      const priorProof=fs.existsSync(priorProofPath)?JSON.parse(fs.readFileSync(priorProofPath,'utf8')):null;
      const currentDeployment=await json('https://script.googleapis.com/v1/projects/'+scriptId+'/deployments/'+deploymentId,{headers:googleHeaders});
      if(priorProof)assert.equal(currentDeployment.deploymentConfig.versionNumber,priorProof.version,'GOOGLE_DEPLOYMENT_DRIFT');
      const before=priorProof?await json('https://script.googleapis.com/v1/projects/'+scriptId+'/content?versionNumber='+priorProof.version,{headers:googleHeaders}):JSON.parse(fs.readFileSync(path.join(backup,'google-content-before.json'),'utf8'));
      if(priorProof)assert.equal(sha(before.files.find(f=>f.name==='Code').source),priorProof.sourceSha256,'GOOGLE_DEPLOYED_SOURCE_DRIFT');
      const head=await json('https://script.googleapis.com/v1/projects/'+scriptId+'/content',{headers:googleHeaders});
      const normalize=content=>JSON.stringify(content.files.map(f=>({name:f.name,type:f.type,source:f.source.replace(/\r/g,'').trim()})).sort((a,b)=>a.name.localeCompare(b.name)));
      assert.equal(normalize(head),normalize(before),'UNPUBLISHED_GOOGLE_SOURCE_DRIFT');
      const files=before.files.map(f=>({name:f.name,type:f.type,source:f.name==='Code'?fs.readFileSync(path.join(root,'google-apps-script/financial-handoff/Code.gs'),'utf8'):f.source}));
      const manifest=JSON.parse(files.find(f=>f.name==='appsscript').source);assert.equal(manifest.webapp.access,'ANYONE','GOOGLE_ACCESS_CHANGED');
      await json('https://script.googleapis.com/v1/projects/'+scriptId+'/content',{method:'PUT',headers:googleHeaders,body:JSON.stringify({files})});
      const version=await json('https://script.googleapis.com/v1/projects/'+scriptId+'/versions',{method:'POST',headers:googleHeaders,body:JSON.stringify({description:'H-REQUESTS-WORKFLOW-HISTORY-GOOGLE-SYNC-001; A:AG only'})});
      await json('https://script.googleapis.com/v1/projects/'+scriptId+'/deployments/'+deploymentId,{method:'PUT',headers:googleHeaders,body:JSON.stringify({deploymentConfig:{scriptId,versionNumber:version.versionNumber,manifestFileName:'appsscript',description:'Request register A:AG; authenticated OAuth; idempotent Y'}})});
      const deployed=await json('https://script.googleapis.com/v1/projects/'+scriptId+'/content?versionNumber='+version.versionNumber,{headers:googleHeaders});assert.equal(normalize(deployed),normalize({files}),'GOOGLE_SOURCE_READBACK_FAILED');
      const proof={status:'PASS',mode,version:version.versionNumber,sourceSha256:sha(files.find(f=>f.name==='Code').source),sameDeployment:true,access:manifest.webapp.access,writeBoundary:'A:AG, then Y only'};fs.writeFileSync(path.join(evidence,'google-deploy.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));return;
    }
    const configPath=path.join(backup,'worker-config.json');let config;
    if(fs.existsSync(configPath))config=JSON.parse(fs.readFileSync(configPath,'utf8'));else{
      const keys=await json('https://api.supabase.com/v1/projects/'+ref+'/api-keys',{headers});const key=keys.find(k=>k.name==='anon'&&String(k.api_key).startsWith('eyJ'));assert(key,'GATEWAY_ANON_JWT_REQUIRED');
      config={url:env.SUPABASE_URL+'/functions/v1/financial-legacy',gatewayJwt:key.api_key,secret:crypto.randomBytes(32).toString('hex')};fs.writeFileSync(configPath,JSON.stringify(config));
    }
    await json('https://api.supabase.com/v1/projects/'+ref+'/secrets',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify([{name:'REQUEST_GOOGLE_SYNC_WORKER_SECRET',value:config.secret}])});
    const secretPairs=[['request_google_sync_edge_url',config.url],['request_google_sync_gateway_jwt',config.gatewayJwt],['request_google_sync_worker_secret',config.secret]];
    await database('begin;'+secretPairs.map(([name,value])=>`do $vault$ declare v_id uuid;begin select id into v_id from vault.secrets where name=${sqlString(name)};if v_id is null then perform vault.create_secret(${sqlString(value)},${sqlString(name)},'Required request register transport');else perform vault.update_secret(v_id,${sqlString(value)});end if;end $vault$;`).join('\n')+'commit;');
    const probe=await json(config.url,{method:'POST',headers:{Authorization:'Bearer '+config.gatewayJwt,'Content-Type':'application/json','x-request-sync-key':config.secret},body:'{"action":"syncRequestQueue"}'});assert(Number.isInteger(probe?.data?.processed),'WORKER_PROBE_FAILED');
    const proof={status:'PASS',mode,workerProbe:true,cron:'program-request-google-sync',secretsLogged:false};fs.writeFileSync(path.join(evidence,'worker-configure.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));return;
  }
  if(!['bundle','deploy-edge'].includes(mode))throw Error('USAGE: backup|bundle|apply-sql|deploy-google|deploy-edge|configure-worker');
  const files=['index.ts','visibility-policy.js','request-google-sync.js'];
  const sources=files.map(name=>({name,source:fs.readFileSync(path.join(root,'supabase/functions/financial-legacy',name),'utf8')}));
  if(mode==='deploy-edge'){
    assert(/REQUEST_REGISTER_WIDTH\s*=\s*33/.test(sources[2].source),'OWNER_A_AG_BOUNDARY_REQUIRED');
    assert(fs.existsSync(path.join(backup,'edge-before.eszip')),'REMOTE_BACKUP_REQUIRED');
  }
  const before=await json(base+'financial-legacy',{headers});
  const form=new FormData();form.append('metadata',JSON.stringify({name:'financial-legacy',slug:'financial-legacy',entrypoint_path:'index.ts',verify_jwt:true}));
  for(const file of sources)form.append('file',new Blob([file.source],{type:file.name.endsWith('.ts')?'application/typescript':'application/javascript'}),file.name);
  const result=await json(base+'deploy?slug=financial-legacy'+(mode==='bundle'?'&bundleOnly=true':''),{method:'POST',headers,body:form});
  const after=await json(base+'financial-legacy',{headers});if(mode==='bundle')assert.equal(after.version,before.version,'BUNDLE_MUTATED_LIVE_VERSION');
  const proof={status:'PASS',mode,files,sourceSha256:sha(sources.map(f=>f.name+'\n'+f.source).join('\n')),liveVersionBefore:before.version,liveVersionAfter:after.version,verifyJwt:after.verify_jwt,resultVersion:result?.version||null};
  fs.writeFileSync(path.join(evidence,'edge-'+mode+'.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',mode,error:e.message}));process.exitCode=1;});
