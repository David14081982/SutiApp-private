'use strict';
// Owner-authorized correction of two report readers and reports-jc only.
// No financial table writes, Apps Script operations, or trigger activation.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {api,query,sha}=require('./release-cash-flow.js');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/cash-flow-criteria/backend'),out=path.join(root,'docs/qa/evidence/cash-flow-criteria');
const release=path.join(root,'.tmp/cash-flow-consolidated/release');
const edgeFiles=['index.ts','report.mjs','google-auth.mjs','template.mjs','cash-flow.mjs','cash-flow-google.mjs','cash-flow-consolidated.mjs','cash-flow-contracts.mjs','cash-flow-pv2-engine.mjs','cash-flow-investors.mjs'];
const migrations=['20261030000400_reports_jc_cash_flow_investor_criteria.sql','20261030000500_reports_jc_cash_flow_criteria_savings.sql','20261030000600_reports_jc_cash_flow_savings_query.sql'];
const targets=['public.get_admin_reports_jc_cash_flow_investors(date)','public.get_admin_reports_jc_cash_flow(date)'];
const protectedFunctions=require('./release-cash-flow-consolidated.js').originalFunctions.filter(f=>!targets.includes(f)).concat('public.get_admin_reports_jc_cash_flow_contracts()');
const quote=s=>"'"+s.replaceAll("'","''")+"'",json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const saved=name=>json(path.join(dir,name));
function write(name,value){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name),Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');}
function proof(name,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'backend-'+name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
const hashes=()=>Object.fromEntries(edgeFiles.map(n=>[n,sha(fs.readFileSync(path.join(root,'supabase/functions/reports-jc',n)))]));
const sqlHashes=()=>Object.fromEntries(migrations.flatMap(n=>['migrations','recovery'].map(d=>[d+'/'+n,sha(fs.readFileSync(path.join(root,'supabase',d,n)))])));
async function state(){const rows=await query(`select (case when n.nspname='public' then 'public.' else '' end)||p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl,p.proowner::regrole::text owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in (${[...protectedFunctions,...targets].map(f=>'to_regprocedure('+quote(f)+')').join(',')}) order by 1`);return rows.sort((a,b)=>a.signature<b.signature?-1:a.signature>b.signature?1:0);}
function unchanged(current,before){assert.equal(current.length,before.length);for(const f of before)if(!targets.includes(f.signature))assert.deepEqual(current.find(x=>x.signature===f.signature),f,'PROTECTED_FUNCTION_CHANGED');for(const f of before.filter(x=>targets.includes(x.signature))){const after=current.find(x=>x.signature===f.signature);assert.equal(after.acl,f.acl,'READER_ACL_CHANGED');assert.equal(after.owner,f.owner,'READER_OWNER_CHANGED');}}
function sqlBody(folder,name){const s=fs.readFileSync(path.join(root,'supabase',folder,name),'utf8');assert(/^begin;/i.test(s)&&/commit;\s*$/i.test(s),'TRANSACTION_REQUIRED');return s.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');}
function validateSQL(){return migrations.map((name,i)=>{const body=sqlBody('migrations',name);assert.equal((body.match(/create\s+or\s+replace\s+function/gi)||[]).length,1);assert(body.includes('create or replace function '+targets[i===0?0:1].split('(')[0]+'('));assert(!/\b(insert\s+into|update\s+\S+\s+set|delete\s+from|truncate|drop\s+table|alter\s+table)\b/i.test(body),'OUTSIDE_READERS');assert(body.includes('perform public.get_admin_reports_jc_context()'),'CONTEXT_GUARD_REQUIRED');return {name,body};});}
function expectedVersion(){return Math.max(5,...['backend-deployed.json','backend-rollback.json'].filter(n=>fs.existsSync(path.join(out,n))).map(n=>{const p=json(path.join(out,n));assert.equal(p.status,'PASS');return p.version;}));}
function form(directory=path.join(root,'supabase/functions/reports-jc'),expected=hashes()){const form=new FormData();form.append('metadata',JSON.stringify({name:'reports-jc',slug:'reports-jc',entrypoint_path:'index.ts',verify_jwt:true}));for(const n of edgeFiles){const bytes=fs.readFileSync(path.join(directory,n));assert.equal(sha(bytes),expected[n],'EDGE_SOURCE_DRIFT');form.append('file',new Blob([bytes],{type:n.endsWith('.ts')?'application/typescript':'application/javascript'}),n);}return form;}
function frozen(){const c=json(path.join(out,'backend-compile.json'));assert.equal(c.status,'PASS');assert.deepEqual(hashes(),c.sourceHashes);assert.deepEqual(sqlHashes(),c.sqlHashes);return c;}
async function main(mode=process.argv[2]){
 if(mode==='preflight'){
  const metadata=await(await api('/functions/reports-jc')).json();assert.equal(metadata.version,5);assert.equal(metadata.verify_jwt,true);
  const previous=json(path.join(root,'docs/qa/evidence/cash-flow-consolidated/backend-deployed.json'));assert.equal(previous.version,5);
  fs.mkdirSync(path.join(dir,'edge-before-source'),{recursive:true});
  for(const n of edgeFiles){const p=n==='template.mjs'?path.join(root,'supabase/functions/reports-jc',n):path.join(release,'supabase/functions/reports-jc',n),b=fs.readFileSync(p);assert.equal(sha(b),previous.sourceHashes[n],'V5_RESTORE_SOURCE_MISMATCH');fs.writeFileSync(path.join(dir,'edge-before-source',n),b);}
  const current=await state();assert.equal(current.length,protectedFunctions.length+targets.length);write('database-before.json',current);write('edge-before-metadata.json',metadata);write('edge-before-source-hashes.json',previous.sourceHashes);write('edge-before.eszip',Buffer.from(await(await api('/functions/reports-jc/body')).arrayBuffer()));
  write('RECOVERY.txt','node scripts/release-cash-flow-criteria.js rollback\nRestore only report readers and exact v5 Edge source. No financial records or triggers are changed. Frontend recovery: restore owned report files from commit 183177cdb7b46668c70090cc737fc8cb75ad569c and publish with a fresh cache version.\n');
  proof('preflight',{status:'PASS',previousVersion:5,verifyJwt:true,restorableSourceFiles:10,protectedFunctions:protectedFunctions.length,reportReaders:2,financialWrites:0});return;
 }
 if(mode==='check'){const current=await state(),before=saved('database-before.json');assert.deepEqual(current,before,'READER_DRIFT_BEFORE_APPLY');proof('check',{status:'PASS',definitionsAndPermissionsUnchanged:true,financialWrites:0});return;}
 if(mode==='compile'){
  validateSQL();unchanged(await state(),saved('database-before.json'));const sourceHashes=hashes(),sql=sqlHashes();await api('/functions/deploy?slug=reports-jc&bundleOnly=true',{method:'POST',body:form(undefined,sourceHashes)});assert.deepEqual(hashes(),sourceHashes);assert.deepEqual(sqlHashes(),sql);proof('compile',{status:'PASS',sourceHashes,sqlHashes:sql,verifyJwt:true,productionDeployment:false,financialWrites:0});return;
 }
 if(mode==='apply'){
  frozen();const current=await state(),before=saved('database-before.json');assert.deepEqual(current,before,'READER_DRIFT_BEFORE_APPLY');const metadata=await(await api('/functions/reports-jc')).json();assert.equal(metadata.version,expectedVersion());
  const sql=validateSQL(),recorded=await query(`select version,name,statements from supabase_migrations.schema_migrations where version in (${migrations.map(n=>quote(n.slice(0,14))).join(',')})`);
  const statements=sql.map(m=>{const prior=recorded.find(p=>p.version===m.name.slice(0,14));if(prior){assert.equal(prior.name,m.name.slice(15,-4),'MIGRATION_NAME_DRIFT');assert.deepEqual(prior.statements,[m.body],'MIGRATION_BODY_DRIFT');return m.body;}return m.body+`\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(m.name.slice(0,14))},${quote(m.name.slice(15,-4))},array[${quote(m.body)}]);`;});
  await query('begin;\n'+statements.join('\n')+'\ncommit;',true);
  const after=await state();unchanged(after,before);write('database-after.json',after);proof('applied',{status:'PASS',migrations:migrations.map(n=>n.slice(0,14)),reportReadersOnly:true,protectedFunctionsPreserved:true,financialWrites:0});return;
 }
 if(mode==='deploy'){
  const compiled=frozen();assert.equal(json(path.join(out,'backend-applied.json')).status,'PASS');unchanged(await state(),saved('database-before.json'));const metadata=await(await api('/functions/reports-jc')).json();assert.equal(metadata.version,expectedVersion());
  const deployed=await(await api('/functions/deploy?slug=reports-jc',{method:'POST',body:form(undefined,compiled.sourceHashes)})).json();assert.equal(deployed.verify_jwt,true);proof('deployed',{status:'PASS',version:deployed.version,verifyJwt:true,sourceHashes:compiled.sourceHashes,financialWrites:0});return;
 }
 if(mode==='verify'){
  const current=await state();unchanged(current,saved('database-before.json'));assert.deepEqual(current,saved('database-after.json'));
  const acl=await query(`select p.oid::regprocedure::text signature,p.provolatile='s' stable,p.prosecdef security_definer,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service_role from pg_proc p where p.oid in (${targets.map(f=>'to_regprocedure('+quote(f)+')').join(',')}) order by 1`);
  assert(acl.length===2&&acl.every(f=>f.stable&&f.security_definer&&!f.anon&&f.authenticated&&!f.service_role&&f.proconfig.some(s=>s==='search_path=""'||s==='search_path=')));
  const metadata=await(await api('/functions/reports-jc')).json();assert.equal(metadata.version,json(path.join(out,'backend-deployed.json')).version);assert.equal(metadata.verify_jwt,true);proof('verified',{status:'PASS',version:metadata.version,verifyJwt:true,reportReadersAuthenticatedOnly:true,protectedFunctionsPreserved:true,financialWrites:0});return;
 }
 if(mode==='restore-readers'){const metadata=await(await api('/functions/reports-jc')).json();assert.equal(metadata.version,7,'EXPECTED_RESTORED_V5_PACKAGE');await query('begin;\n'+saved('database-before.json').filter(f=>targets.includes(f.signature)).map(f=>f.definition+';').join('\n')+'\ncommit;',true);assert.deepEqual(await state(),saved('database-before.json'));proof('rollback',{status:'PASS',version:metadata.version,restoredV5Source:true,reportReadersRestored:true,financialWrites:0});return;}
 if(mode==='rollback'){
  const current=await state();unchanged(current,saved('database-before.json'));const deployed=path.join(out,'backend-deployed.json'),metadata=await(await api('/functions/reports-jc')).json();assert.equal(metadata.version,fs.existsSync(deployed)?json(deployed).version:5);
  const oldHashes=saved('edge-before-source-hashes.json'),restored=await(await api('/functions/deploy?slug=reports-jc',{method:'POST',body:form(path.join(dir,'edge-before-source'),oldHashes)})).json();assert.equal(restored.verify_jwt,true);
  await query('begin;\n'+saved('database-before.json').filter(f=>targets.includes(f.signature)).map(f=>f.definition+';').join('\n')+'\ncommit;',true);assert.deepEqual(await state(),saved('database-before.json'));proof('rollback',{status:'PASS',version:restored.version,restoredV5Source:true,financialWrites:0});return;
 }
 throw Error('MODE_REQUIRED');
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:/^[A-Z0-9_]+$/.test((e.message||'').split('\n')[0])?e.message.split('\n')[0]:'CRITERIA_BACKEND_FAILED',detailType:e.name}));process.exitCode=1;});
module.exports={main,edgeFiles,migrations,targets,protectedFunctions};
