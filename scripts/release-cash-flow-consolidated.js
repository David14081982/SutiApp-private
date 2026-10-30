'use strict';
// Explicit deployment commands for the additive consolidated report only.
// No command writes financial data, Google Sheets, Apps Script or loan settings.
const fs=require('fs'),path=require('path');
const {api,query,env,sha}=require('./release-cash-flow.js');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/cash-flow-consolidated/backend'),out=path.join(root,'docs/qa/evidence/cash-flow-consolidated');
const edgeFiles=['index.ts','report.mjs','google-auth.mjs','template.mjs','cash-flow.mjs','cash-flow-google.mjs','cash-flow-consolidated.mjs','cash-flow-contracts.mjs','cash-flow-pv2-engine.mjs','cash-flow-investors.mjs'];
const oldFiles=edgeFiles.slice(0,6),migrationNames=['20261030000200_reports_jc_cash_flow_investors.sql','20261030000300_reports_jc_cash_flow_contracts.sql'];
const newFunctions=['public.get_admin_reports_jc_cash_flow_investors(date)','public.get_admin_reports_jc_cash_flow_contracts()'];
const originalFunctions=['public.get_admin_reports_jc_context()','public.get_admin_reports_jc_cash_flow(date)','public.savings_workspace_history(uuid)',
 'public.get_admin_investors(uuid)','public.get_admin_investors_source(text,integer)','public.save_admin_investors(text,jsonb,uuid)','public.investors_document(uuid,jsonb,uuid)',
 'investors_private.guard(boolean)','investors_private.balance(uuid,date)','investors_private.schedule(uuid,date,text)','investors_private.log(text,uuid,text,text,jsonb,jsonb)'];
const requiredEvidence=['adapter-verification','assembly-live','contracts-focused','contracts-sql','investors-reader','investors-sql','investors-balance-detail','investors-source-live-readonly'];
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const need=(condition,code)=>{if(!condition)throw Error(code);};
function write(name,value){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');}
function proof(name,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'backend-'+name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
const saved=name=>json(path.join(dir,name));
function sourceHashes(){return Object.fromEntries(edgeFiles.map(n=>[n,sha(read('supabase/functions/reports-jc/'+n))]));}
function sqlHashes(){return Object.fromEntries(migrationNames.flatMap(n=>['migrations','recovery'].map(folder=>[folder+'/'+n,sha(read('supabase/'+folder+'/'+n))])));}
function evidence(){for(const n of requiredEvidence)need(json(path.join(out,n+'.json')).status==='PASS','FOCAL_EVIDENCE_REQUIRED_'+n);}
function matches(a,b,code){need(JSON.stringify(a)===JSON.stringify(b),code);}
const stateSQL=`select jsonb_build_object(
 'originals',(select jsonb_agg(jsonb_build_object('signature',s.signature,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text,'owner',p.proowner::regrole::text) order by s.signature)
   from unnest(array[${originalFunctions.map(quote).join(',')}]::text[]) s(signature) left join pg_proc p on p.oid=to_regprocedure(s.signature)),
 'newFunctions',(select jsonb_agg(jsonb_build_object('signature',s.signature,'exists',to_regprocedure(s.signature) is not null) order by s.signature) from unnest(array[${newFunctions.map(quote).join(',')}]::text[]) s(signature)),
 'migrationIds',(select coalesce(jsonb_agg(version order by version),'[]'::jsonb) from supabase_migrations.schema_migrations where version in('20261030000200','20261030000300'))
 ) state`;
async function state(){const rows=await query(stateSQL);need(rows.length===1&&rows[0].state,'DATABASE_STATE_UNAVAILABLE');return rows[0].state;}
function originalsPresent(s){need(s.originals.length===originalFunctions.length&&s.originals.every(f=>typeof f.definition==='string'),'ORIGINAL_DEPENDENCY_MISSING');}
function absent(s){need(s.newFunctions.every(f=>!f.exists)&&s.migrationIds.length===0,'ADDITIVE_RPC_OR_MIGRATION_ALREADY_EXISTS');}
function summary(s){return s.originals.map(f=>({signature:f.signature,definitionHash:sha(f.definition),aclHash:sha(f.acl||'DEFAULT'),ownerHash:sha(f.owner)}));}
async function unchanged(){const current=await state(),before=saved('database-before.json');matches(current.originals,before.originals,'ORIGINAL_FUNCTION_OR_ACL_CHANGED');return current;}
function sqlBody(file){const sql=read(file);need(/^begin;\s*/i.test(sql)&&/commit;\s*$/i.test(sql),'TRANSACTION_WRAPPER_INVALID');return sql.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');}
function validatedMigrations(){return migrationNames.map((name,i)=>{
 const body=sqlBody('supabase/migrations/'+name),functionName=newFunctions[i].split('(')[0];
 need((body.match(/create\s+function\s+/gi)||[]).length===1&&body.includes('create function '+functionName+'('),'ONLY_ADDITIVE_RPC_ALLOWED');
 need(!/\b(create\s+or\s+replace|alter|drop|truncate|insert\s+into|update\s+\S+\s+set|delete\s+from)\b/i.test(body),'MIGRATION_OUTSIDE_READER_SCOPE');
 need(/stable\s+security\s+definer\s+set\s+search_path=''/i.test(body)&&body.includes('perform public.get_admin_reports_jc_context()'),'READER_SECURITY_GUARD_REQUIRED');
 return {name,version:name.slice(0,14),body};
});}
function form(files=edgeFiles,directory=path.join(root,'supabase/functions/reports-jc'),expectedHashes=null){
 const result=new FormData();result.append('metadata',JSON.stringify({name:'reports-jc',slug:'reports-jc',entrypoint_path:'index.ts',verify_jwt:true}));
 for(const name of files){const bytes=fs.readFileSync(path.join(directory,name));if(expectedHashes)need(sha(bytes)===expectedHashes[name],'EDGE_BODY_HASH_CHANGED');result.append('file',new Blob([bytes],{type:name.endsWith('.ts')?'application/typescript':'application/javascript'}),name);}
 return result;
}
function checkedCandidate(){const approved=json(path.join(out,'backend-compile.json'));need(approved.status==='PASS','COMPILE_REQUIRED');matches(sourceHashes(),approved.sourceHashes,'EDGE_SOURCE_CHANGED_AFTER_COMPILE');matches(sqlHashes(),approved.sqlHashes,'SQL_CHANGED_AFTER_COMPILE');return approved;}
function restoreSources(){
 const approval=json(path.join(root,'docs/qa/evidence/cash-flow/edge-compile.json'));need(approval.status==='PASS','PREVIOUS_COMPILE_EVIDENCE_REQUIRED');
 for(const name of oldFiles){
  const candidates=[path.join(root,'.tmp/cash-flow/release/supabase/functions/reports-jc',name),path.join(root,'supabase/functions/reports-jc',name)];
  const source=candidates.find(p=>fs.existsSync(p)&&sha(fs.readFileSync(p))===approval.hashes[name]);need(source,'PREVIOUS_SOURCE_NOT_RECOVERABLE_'+name);
  fs.mkdirSync(path.join(dir,'edge-before-source'),{recursive:true});fs.copyFileSync(source,path.join(dir,'edge-before-source',name));
 }
 write('edge-before-source-hashes.json',approval.hashes);return approval.hashes;
}
function validatedRestore(){const hashes=saved('edge-before-source-hashes.json');for(const n of oldFiles)need(sha(fs.readFileSync(path.join(dir,'edge-before-source',n)))===hashes[n],'RESTORE_SOURCE_HASH_CHANGED');need(saved('edge-before-metadata.json').verify_jwt===true,'RESTORE_JWT_REQUIRED');return hashes;}
async function main(mode=process.argv[2]){
 if(mode==='preflight'){
  validatedMigrations();const current=await state();originalsPresent(current);absent(current);
  const metadata=await(await api('/functions/reports-jc')).json();need(metadata.version===3&&metadata.verify_jwt===true,'EXPECTED_REPORTS_JC_V3_REQUIRED');
  const body=Buffer.from(await(await api('/functions/reports-jc/body')).arrayBuffer());need(body.length>0,'EDGE_BACKUP_EMPTY');
  const priorBody=path.join(root,'.tmp/cash-flow/edge-after.eszip');if(fs.existsSync(priorBody))need(sha(body)===sha(fs.readFileSync(priorBody)),'EDGE_V3_BODY_DIFFERS_FROM_VERIFIED_BACKUP');
  const restoreHashes=restoreSources();write('database-before.json',current);write('edge-before-metadata.json',metadata);write('edge-before.eszip',body);
  write('preflight.json',{sourceHashes:sourceHashes(),sqlHashes:sqlHashes(),bodyHash:sha(body),restoreHashes});
  write('RECOVERY.txt','Run node scripts/release-cash-flow-consolidated.js rollback\nThis redeploys the verified previous six source files with verify_jwt=true, then executes only RPC002/003 recovery in one transaction. Financial tables, original functions, triggers and migration history are preserved. The old edge uses only existing RPC001. Do not delete source data or migration records.\n');
  proof('preflight',{status:'PASS',previousVersion:metadata.version,verifyJwt:true,additiveRpcsAbsent:true,migrationIdsAbsent:true,originals:summary(current),backupBodyHash:sha(body),restorableSources:oldFiles.length,financialWrites:0});return;
 }
 if(mode==='compile'){
  evidence();validatedMigrations();validatedRestore();await unchanged();
  const sources=sourceHashes(),sql=sqlHashes();await api('/functions/deploy?slug=reports-jc&bundleOnly=true',{method:'POST',body:form(edgeFiles,undefined,sources)});
  matches(sourceHashes(),sources,'EDGE_CHANGED_DURING_COMPILE');matches(sqlHashes(),sql,'SQL_CHANGED_DURING_COMPILE');
  proof('compile',{status:'PASS',files:edgeFiles,sourceHashes:sources,sqlHashes:sql,verifyJwt:true,financialWrites:0,productionDeployment:false});return;
 }
 if(mode==='apply'){
  evidence();checkedCandidate();validatedRestore();const before=await unchanged();absent(before);
  const metadata=await(await api('/functions/reports-jc')).json();need(metadata.version===saved('edge-before-metadata.json').version&&metadata.verify_jwt===true,'EDGE_CHANGED_BEFORE_DATABASE_APPLY');
  const migrations=validatedMigrations(),sql='begin;\n'+migrations.map(m=>m.body+`\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(m.version)},${quote(m.name.slice(15,-4))},array[${quote(m.body)}]);`).join('\n')+'\ncommit;';checkedCandidate();
  await query(sql,true);const after=await unchanged();need(after.newFunctions.every(f=>f.exists)&&after.migrationIds.length===2,'ADDITIVE_DATABASE_VERIFICATION_FAILED');
  proof('applied',{status:'PASS',migrations:migrations.map(m=>m.version),sqlHashes:sqlHashes(),originalFunctionsAndAclPreserved:true,financialWrites:0,migrationMetadataWrites:2});return;
 }
 if(mode==='deploy'){
  evidence();const approved=checkedCandidate();validatedRestore();need(json(path.join(out,'backend-applied.json')).status==='PASS','ADDITIVE_DATABASE_APPLY_REQUIRED');
  const before=await unchanged();need(before.newFunctions.every(f=>f.exists)&&before.migrationIds.length===2,'ADDITIVE_DATABASE_NOT_READY');
  const current=await(await api('/functions/reports-jc')).json(),previousDeployment=path.join(out,'backend-deployed.json');
  const expectedVersion=fs.existsSync(previousDeployment)?json(previousDeployment).version:saved('edge-before-metadata.json').version;
  need(current.version===expectedVersion&&current.verify_jwt===true,'EDGE_CHANGED_BEFORE_DEPLOY');
  const deployed=await(await api('/functions/deploy?slug=reports-jc',{method:'POST',body:form(edgeFiles,undefined,approved.sourceHashes)})).json();need(deployed.verify_jwt===true,'DEPLOY_JWT_REQUIRED');
  proof('deployed',{status:'PASS',version:deployed.version,verifyJwt:true,sourceHashes:approved.sourceHashes,financialWrites:0});return;
 }
 if(mode==='verify'){
  const current=await unchanged();need(current.newFunctions.every(f=>f.exists)&&current.migrationIds.length===2,'ADDITIVE_DATABASE_NOT_PRESENT');
  const acl=await query(`select p.oid::regprocedure::text signature,p.provolatile='s' stable,p.prosecdef security_definer,p.proconfig,
   has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service_role
   from pg_proc p where p.oid in(${newFunctions.map(f=>'to_regprocedure('+quote(f)+')').join(',')}) order by 1`);
  need(acl.length===2&&acl.every(f=>f.stable&&f.security_definer&&!f.anon&&f.authenticated&&!f.service_role&&f.proconfig?.some(s=>s==='search_path=""'||s==='search_path=')),'ADDITIVE_READER_ACL_INVALID');
  const metadata=await(await api('/functions/reports-jc')).json(),deployment=json(path.join(out,'backend-deployed.json'));need(metadata.verify_jwt===true&&metadata.version===deployment.version,'EDGE_DEPLOYMENT_VERSION_MISMATCH');
  proof('verified',{status:'PASS',version:metadata.version,verifyJwt:true,originalFunctionsAndAclPreserved:true,originals:summary(current),newReaderPermissions:acl.map(f=>({signature:f.signature,authenticatedOnly:true,stable:true,securityDefiner:true,emptySearchPath:true})),financialWrites:0});return;
 }
 if(mode==='rollback'){
  const restoreHashes=validatedRestore();await unchanged();const metadata=await(await api('/functions/reports-jc')).json();
  const deployedFile=path.join(out,'backend-deployed.json');if(fs.existsSync(deployedFile))need(metadata.version===json(deployedFile).version,'ROLLBACK_EDGE_VERSION_DRIFT');else need(metadata.version===saved('edge-before-metadata.json').version,'ROLLBACK_EDGE_VERSION_DRIFT');
  const stateBefore=await state(),exists=new Map(stateBefore.newFunctions.map(f=>[f.signature,f.exists]));
  const compileFile=path.join(out,'backend-compile.json'),expectedSQL=fs.existsSync(compileFile)?json(compileFile).sqlHashes:saved('preflight.json').sqlHashes;
  const recovery=migrationNames.filter((n,i)=>exists.get(newFunctions[i])).map(n=>{const rel='recovery/'+n;need(sha(read('supabase/'+rel))===expectedSQL[rel],'RECOVERY_HASH_CHANGED');return sqlBody('supabase/'+rel);});
  // Recovery files affect only the two additive RPCs, never original functions or rows.
  for(const body of recovery)need(!/\b(insert\s+into|update\s+\S+\s+set|delete\s+from|truncate|alter|create)\b/i.test(body),'RECOVERY_OUTSIDE_SCOPE');
  const restored=await(await api('/functions/deploy?slug=reports-jc',{method:'POST',body:form(oldFiles,path.join(dir,'edge-before-source'),restoreHashes)})).json();need(restored.verify_jwt===true,'RESTORED_JWT_REQUIRED');
  if(recovery.length)await query('begin;\n'+recovery.join('\n')+'\ncommit;',true);
  await unchanged();const enabled=await query(`select has_function_privilege('authenticated',to_regprocedure(${quote(newFunctions[0])}),'EXECUTE') investor_access,to_regprocedure(${quote(newFunctions[1])})::text contracts_reader`);need(enabled[0].investor_access!==true&&enabled[0].contracts_reader===null,'RECOVERY_READERS_STILL_ACTIVE');
  proof('rollback',{status:'PASS',restoredVersion:restored.version,restoredPreviousSource:true,verifyJwt:true,additiveReadersDisabled:true,originalFunctionsAndAclPreserved:true,migrationHistoryPreserved:true,financialWrites:0});return;
 }
 throw Error('MODE_REQUIRED_preflight_compile_apply_deploy_verify_rollback');
}
if(require.main===module)main().catch(e=>{const message=typeof e.message==='string'&&/^[A-Za-z0-9_.| -]{1,180}$/.test(e.message)?e.message:'BACKEND_RELEASE_FAILED';console.error(JSON.stringify({status:'FAIL',error:message}));process.exitCode=1;});
module.exports={main,stateSQL,edgeFiles,migrationNames,originalFunctions,sourceHashes,sqlHashes,validatedMigrations};
