'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),dir='C:/tmp/sutiapp-reference-reconcile-20260908',out=path.join(root,'docs/qa/evidence/reference-reconciliation-20260908'),mode=process.argv[2],env={};
const migration='20260908000300_request_google_reference_reconciliation',rpc="public.finish_program_request_google_sync(uuid,bigint,jsonb,integer,text)",scriptId='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o',deploymentId='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g';
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
for(const l of fs.readFileSync('C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const api='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0],headers={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},google='https://script.googleapis.com/v1/projects/'+scriptId;
async function json(url,options){const r=await fetch(url,{...options,signal:AbortSignal.timeout(60000)});const d=await r.json().catch(()=>null);if(!r.ok){fs.writeFileSync(path.join(dir,'last-private-error.json'),JSON.stringify(d));throw Error('HTTP_'+r.status);}return d;}
async function sql(query){return json(api+'/database/query',{method:'POST',headers,body:JSON.stringify({query})});}
async function oauth(){const a=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;return (await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:a.client_id,client_secret:a.client_secret,refresh_token:a.refresh_token,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'})})).access_token;}
const normalized=c=>JSON.stringify(c.files.map(f=>({name:f.name,type:f.type,source:f.source.replace(/\r/g,'').trim()})).sort((a,b)=>a.name.localeCompare(b.name)));
function proof(name,data){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
async function main(){
  if(mode==='backup'){
    const functions=await sql(`select p.oid,pg_get_functiondef(p.oid) as definition,p.proacl::text as acl from pg_proc p where p.oid=${quote(rpc)}::regprocedure`);
    assert.equal(functions.length,1);const gh={Authorization:'Bearer '+await oauth()},deployment=await json(google+'/deployments/'+deploymentId,{headers:gh}),content=await json(google+'/content?versionNumber='+deployment.deploymentConfig.versionNumber,{headers:gh});assert.equal(deployment.deploymentConfig.versionNumber,14);assert.equal(normalized(await json(google+'/content',{headers:gh})),normalized(content));
    const oldProof=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/evidence/register-format-20260908/google-deploy.json')));assert.equal(sha(content.files.find(f=>f.name==='Code').source),oldProof.sourceSha256);
    const hashes=await sql(`select r.id,md5((to_jsonb(r)-'legacy_reference'-'updated_at')::text) as business_hash,r.legacy_reference from public.program_requests r where r.id in(select request_id from public.program_request_google_sync)`);
    for(const [file,value] of [['function-before.json',functions[0]],['google-deployment-before.json',deployment],['google-content-before.json',content],['business-before.json',hashes]]){const destination=path.join(dir,file);if(fs.existsSync(destination))assert.equal(sha(fs.readFileSync(destination)),sha(JSON.stringify(value)));else fs.writeFileSync(destination,JSON.stringify(value));}
    const recovery='begin;\n-- Restore behavior only. Preserve all reconciliation audit history.\n'+functions[0].definition+';\ncommit;\n';fs.mkdirSync(path.join(root,'supabase/recovery'),{recursive:true});fs.writeFileSync(path.join(root,'supabase/recovery/'+migration+'_recovery.sql'),recovery);
    proof('backup',{status:'PASS',googleVersion:14,rpcOid:functions[0].oid,rpcSha256:sha(functions[0].definition),businessRows:hashes.length,privateBackup:dir});return;
  }
  const before=read('function-before.json'),migrationText=fs.readFileSync(path.join(root,'supabase/migrations/'+migration+'.sql'),'utf8'),body=migrationText.replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
  const guard=`do $guard$ begin if pg_get_functiondef(${quote(rpc)}::regprocedure)<>${quote(before.definition)} then raise exception 'RPC_DRIFT';end if;end $guard$;`;
  if(mode==='dry-run'){
    const tests=fs.readFileSync(path.join(root,'scripts/test-request-google-reference-reconciliation.sql'),'utf8');
    const result=await sql('begin;'+guard+body+'savepoint before_tests;'+tests+'rollback to before_tests;'+before.definition+`;do $verify$ begin if (select proacl::text from pg_proc where oid=${quote(rpc)}::regprocedure) is distinct from ${quote(before.acl)} then raise exception 'ACL_DRIFT';end if;end $verify$;select 'PASS' as result;rollback;`);
    proof('sql-dry-run',{status:'PASS',migrationSha256:sha(migrationText),checks:['actual SQL relocation','equal-revision retry success/error lease release','immutable payload','stale lease denied','business fields unchanged','audit provenance','service-only / forced RLS','recovery restores same OID/grants'],persistentWrites:0,result});return;
  }
  if(mode==='apply-sql'){
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'sql-dry-run.json'))).migrationSha256,sha(migrationText));
    await sql('begin;'+guard+body+`insert into supabase_migrations.schema_migrations(version,name,statements) values('20260908000300','request_google_reference_reconciliation',array[${quote(migrationText)}]);commit;`);
    const installed=(await sql(`select p.oid,pg_get_functiondef(p.oid) as definition,p.proacl::text as acl from pg_proc p where p.oid=${quote(rpc)}::regprocedure`))[0];assert.equal(installed.oid,before.oid);assert.equal(installed.acl,before.acl);fs.writeFileSync(path.join(dir,'function-installed.json'),JSON.stringify(installed));proof('sql-apply',{status:'PASS',version:'20260908000300',sameOidAndGrants:true,installedSha256:sha(installed.definition),dataReconciled:false});return;
  }
  if(mode==='deploy-google'){
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'sql-apply.json'))).status,'PASS');assert.equal(JSON.parse(fs.readFileSync(path.join(out,'receiver-tests.json'))).status,'PASS');
    const gh={Authorization:'Bearer '+await oauth(),'Content-Type':'application/json'},old=read('google-content-before.json'),d=await json(google+'/deployments/'+deploymentId,{headers:gh});assert.equal(d.deploymentConfig.versionNumber,14);assert.equal(normalized(await json(google+'/content',{headers:gh})),normalized(old));
    const files=old.files.map(f=>({name:f.name,type:f.type,source:f.name==='Code'?fs.readFileSync(path.join(root,'google-apps-script/financial-handoff/Code.gs'),'utf8'):f.source}));await json(google+'/content',{method:'PUT',headers:gh,body:JSON.stringify({files})});
    const v=await json(google+'/versions',{method:'POST',headers:gh,body:JSON.stringify({description:'Verified request row relocation; missing rows fail closed'})});await json(google+'/deployments/'+deploymentId,{method:'PUT',headers:gh,body:JSON.stringify({deploymentConfig:{...d.deploymentConfig,versionNumber:v.versionNumber,description:'Verified request reference reconciliation'}})});
    assert.equal(normalized(await json(google+'/content?versionNumber='+v.versionNumber,{headers:gh})),normalized({files}));proof('google-deploy',{status:'PASS',version:v.versionNumber,sameDeploymentAndManifest:true,sourceSha256:sha(files.find(f=>f.name==='Code').source)});return;
  }
  if(mode==='apply-references'){
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'google-deploy.json'))).status,'PASS');const query=fs.readFileSync(path.join(dir,'reconcile.sql'),'utf8');await sql(query);proof('references-apply',{status:'PASS',querySha256:sha(query),plan:read('plan.json')});return;
  }
  if(mode==='verify-sql'){
    const baseline=read('business-before.json'),rows=await sql(`select r.id,r.folio,r.legacy_reference,md5((to_jsonb(r)-'legacy_reference'-'updated_at')::text) as business_hash,s.google_row,s.phase,s.error_code,s.revision,s.synced_revision,s.lease_until from public.program_requests r join public.program_request_google_sync s on s.request_id=r.id`);for(const b of baseline)assert.equal(rows.find(r=>r.id===b.id)?.business_hash,b.business_hash,'BUSINESS_CHANGED');const plan=read('plan.json');for(const p of plan.rows){const r=rows.find(r=>r.id===p.id);assert(r);if(p.row){assert.equal(r.google_row,p.row);assert.equal(r.phase,'synced');if(p.legacyReference)assert.equal(r.legacy_reference,'Historial de solicitudes!A'+p.row);}else{assert.equal(r.phase,'error');assert.equal(r.error_code,'REQUEST_SYNC_TARGET_MISSING');}assert.equal(r.lease_until,null);}
    const audit=await sql("select action,actor_kind,count(*)::int as count from public.program_request_google_reference_audit group by action,actor_kind");fs.writeFileSync(path.join(dir,'source-after.json'),JSON.stringify(rows));proof('sql-readback',{status:'PASS',businessRowsUnchanged:baseline.length,rows:rows.filter(r=>plan.rows.some(p=>p.id===r.id)).map(({business_hash,...r})=>r),audit});return;
  }
  throw Error('INVALID_MODE');
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',mode,error:e.message}));process.exitCode=1;});
