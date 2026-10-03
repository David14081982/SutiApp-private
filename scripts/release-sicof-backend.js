'use strict';
// Owner-authorized activation. Credentials and row-level backups stay private.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/sicof/activation'),out=path.join(root,'docs/qa/evidence/sicof-release');
fs.mkdirSync(privateDir,{recursive:true});fs.mkdirSync(out,{recursive:true});
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
const env={};for(const line of read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const base='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0];
const migrations=['20261003000100_savings_period_composition','20261003000200_sicof_workspace'];
const tables=['savings_transactions','savings_requests','savings_participants','savings_enrollments','savings_holds','savings_yield_periods','savings_yield_allocations','savings_contribution_plans','savings_action_availability','savings_withdrawal_openings','savings_audit_events','savings_balance_certifications'];
const fingerprints=tables.map(n=>`select '${n}' resource,count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) fingerprint from public.${n} t`).join(' union all ');
const signatures=['public.admin_save_savings_operation(jsonb,uuid)','public.savings_canonical_user_projection(uuid)','admin_support_private.module_visible(uuid,text)','public.admin_module_boundary(text[],text)','public.has_admin_permission(text)'];
const meta=`select oid,oid::regprocedure::text signature,pg_get_userbyid(proowner) owner,proacl::text acl,md5(pg_get_functiondef(oid)) md5,pg_get_functiondef(oid) definition from pg_proc where oid in (${signatures.map(s=>quote(s)+'::regprocedure').join(',')}) order by oid`;
function proof(name,value){fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
async function management(url,options={}){const response=await fetch(base+url,{...options,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...options.headers},signal:AbortSignal.timeout(180000)});if(!response.ok){fs.writeFileSync(path.join(privateDir,'last-management-error.txt'),await response.text());throw Error('MANAGEMENT_HTTP_'+response.status);}return response;}
async function query(sql,write=false){return(await management('/database/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:!write})})).json();}
function checkManifest(){const m=JSON.parse(read('docs/qa/evidence/sicof/source-manifest.json')),d=JSON.parse(read('docs/qa/evidence/sicof-release/source-deltas.json'));assert.equal(d.status,'APPROVED');for(const f of m.files){const delta=d.files.find(x=>x.file===f.file);if(delta)assert.equal(delta.originalSha256,f.sha256,'DELTA_BASELINE_DRIFT '+f.file);assert.equal(sha(fs.readFileSync(path.join(root,f.file))),delta?.sha256||f.sha256,'CANDIDATE_DRIFT '+f.file);}return m;}
async function login(){const response=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});assert(response.ok,'ADMIN_LOGIN_FAILED');return response.json();}
async function rpc(token,name,args={}){const response=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(180000)});const data=await response.json();if(!response.ok){fs.writeFileSync(path.join(privateDir,'last-rpc-error.json'),JSON.stringify(data));throw Error('RPC_FAILED_'+name+'_'+response.status);}return data;}
async function main(){const mode=process.argv[2]||'preflight';checkManifest();
 if(mode==='edge-status'){
  const data=await(await management('/functions')).json(),fn=data.find(f=>f.slug==='sicof'||f.name==='sicof');
  proof(mode,{status:'PASS',installed:!!fn,version:fn?.version??null,cloudStatus:fn?.status??null,verifyJwt:fn?.verify_jwt??null});return;
 }
 if(mode==='preflight'){
  const before=await query('begin read only;'+meta+';commit;'),expected=JSON.parse(read('.tmp/sicof/install-guards.json'));
  for(const e of expected){const row=before.find(r=>r.signature===e.signature);assert(row,'MISSING_SIGNATURE');assert.equal(row.definition,e.definition,'LIVE_DEFINITION_DRIFT');assert.equal(row.owner,e.owner,'LIVE_OWNER_DRIFT');assert.equal(row.acl,e.acl,'LIVE_ACL_DRIFT');}
  const presence=(await query("select (select count(*)::int from supabase_migrations.schema_migrations where version in ('20261003000100','20261003000200')) collisions,to_regnamespace('sicof_private') is not null sicof,to_regnamespace('savings_period_private') is not null periods"))[0];assert.deepEqual(presence,{collisions:0,sicof:false,periods:false});
  const data=await query('begin read only;'+fingerprints+';commit;');
  const secrets=await(await management('/secrets')).json(),required=['GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_ID','GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_SECRET','GOOGLE_REQUEST_SYNC_OAUTH_REFRESH_TOKEN','FINANCIAL_LEGACY_API_URL','FINANCIAL_LEGACY_API_TOKEN','ALLOWED_APP_ORIGINS'];
  const missing=required.filter(n=>!secrets.some(s=>s.name===n));assert.equal(missing.length,0,'MISSING_REMOTE_SECRET_NAMES:'+missing.join(','));
  const functions=await(await management('/functions')).json();assert(!functions.some(f=>f.slug==='sicof'||f.name==='sicof'),'SICOF_EDGE_ALREADY_EXISTS');
  fs.writeFileSync(path.join(privateDir,'before.json'),JSON.stringify({functions:before,data,presence,edgeAbsent:true},null,2));
  proof('preflight',{status:'PASS',functionContracts:before.length,protectedTables:data.length,requiredSecretNamesPresent:required,edgeAbsent:true,versionCollisions:0,candidateUnchanged:true,financialWrites:0});return;
 }
 if(mode==='apply'){
  const before=JSON.parse(fs.readFileSync(path.join(privateDir,'before.json'),'utf8'));assert.deepEqual(await query(meta),before.functions,'LIVE_CONTRACT_DRIFT');
  const body=migrations.map(name=>{const sql=read('supabase/migrations/'+name+'.sql');return sql.replace(/^\s*begin;/i,'').replace(/commit;\s*$/i,'')+`\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(name.slice(0,14))},${quote(name.slice(15))},array[${quote('H-SICOF-RELEASE-001 sha256:'+sha(sql))}]);`;}).join('\n');
  const sql=`begin;set local lock_timeout='5s';set local statement_timeout='60s';
   lock table ${tables.map(t=>'public.'+t).join(',')} in share mode;
   create temp table sicof_release_data_before on commit drop as ${fingerprints};
   create temp table sicof_release_functions_before on commit drop as ${meta};
   ${body}
   do $guard$ begin
    if exists((select * from sicof_release_data_before) except (${fingerprints})) or exists((${fingerprints}) except (select * from sicof_release_data_before)) then raise exception 'SICOF_EXISTING_FINANCIAL_DATA_CHANGED';end if;
    if exists(select 1 from sicof_release_functions_before b left join pg_proc p on p.oid=b.oid where p.oid is null or p.proacl::text is distinct from b.acl or pg_get_userbyid(p.proowner) is distinct from b.owner) then raise exception 'SICOF_EXISTING_FUNCTION_METADATA_CHANGED';end if;
    if exists(select 1 from sicof_release_functions_before b join pg_proc p on p.oid=b.oid where p.proname in ('has_admin_permission','admin_module_boundary') and pg_get_functiondef(p.oid)<>b.definition) then raise exception 'SICOF_AUTH_HELPER_CHANGED';end if;
   end $guard$;
   select jsonb_build_object('before',(select jsonb_agg(t order by resource) from sicof_release_data_before t),'after',(select jsonb_agg(t order by resource) from (${fingerprints})t)) evidence;commit;`;
  const applied=await query(sql,true);const after=await query(meta);fs.writeFileSync(path.join(privateDir,'after-functions.json'),JSON.stringify(after,null,2));
  proof('migrations',{status:'PASS',versions:migrations.map(x=>x.slice(0,14)),protectedFinancialTablesUnchanged:true,existingOidsOwnersAclsPreserved:true,authHelpersUnchanged:true,financialWrites:0,evidence:applied});return;
 }
 if(mode==='context-apply'){
  const name='20261003000300_sicof_context_read_performance',sqlSource=read('supabase/migrations/'+name+'.sql');
  const candidate=JSON.parse(read('.tmp/sicof/context-performance-candidate.json'));
  assert.equal(candidate.status,'PASS');assert.equal(candidate.before.whole_json_md5,candidate.after.whole_json_md5);assert.equal(candidate.before.fingerprint,candidate.after.fingerprint);assert(candidate.after.context_ms<5000,'CONTEXT_NO_PERFORMANCE_MARGIN');
  const presence=(await query("select exists(select 1 from supabase_migrations.schema_migrations where version='20261003000300') collision,to_regclass('sicof_private.context_read_backup') is not null backup"))[0];assert.deepEqual(presence,{collision:false,backup:false});
  const privateTables=await query("select table_schema,table_name from information_schema.tables where table_schema in ('savings_period_private','sicof_private') and table_type='BASE TABLE' order by table_schema,table_name");
  const resources=tables.map(t=>'public.'+t).concat(privateTables.map(r=>r.table_schema+'.'+r.table_name));
  assert(resources.every(t=>/^[a-z_]+\.[a-z_]+$/.test(t)),'UNEXPECTED_TABLE_IDENTIFIER');
  const fp=resources.map(t=>`select '${t}' resource,count(*)::int count,md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by to_jsonb(r)::text),'')) fingerprint from ${t} r`).join(' union all ');
  const sigs=[...signatures,'sicof_private.context(date,date)','public.savings_context_before_source_refresh(uuid)','public.savings_certification_context(uuid)','public.savings_account_before_runtime(uuid,date)','public.savings_financial_before_accounts(uuid,date)','public.get_admin_savings_financial_account(uuid,date)','public.get_admin_savings_account(uuid,date)'];
  const fm=`select oid,oid::regprocedure::text signature,pg_get_userbyid(proowner) owner,proacl::text acl,md5(pg_get_functiondef(oid)) md5,pg_get_functiondef(oid) definition from pg_proc where oid in (${sigs.map(s=>quote(s)+'::regprocedure').join(',')}) order by oid`;
  const functions=await query(fm);fs.writeFileSync(path.join(privateDir,'context-before-functions.json'),JSON.stringify(functions,null,2));
  const body=sqlSource.replace(/^\s*begin;/i,'').replace(/commit;\s*$/i,'');
  const result=await query(`begin;set local lock_timeout='5s';set local statement_timeout='60s';
   lock table ${resources.join(',')} in share mode;
   create temp table sicof_context_data_before on commit drop as ${fp};
   create temp table sicof_context_functions_before on commit drop as ${fm};
   ${body}
   do $guard$ begin
    if exists((select * from sicof_context_data_before) except (${fp})) or exists((${fp}) except(select * from sicof_context_data_before)) then raise exception 'SICOF_CONTEXT_DATA_CHANGED';end if;
    if exists(select 1 from sicof_context_functions_before b left join pg_proc p on p.oid=b.oid where p.oid is null or p.proacl::text is distinct from b.acl or pg_get_userbyid(p.proowner) is distinct from b.owner) then raise exception 'SICOF_CONTEXT_FUNCTION_METADATA_CHANGED';end if;
    if exists(select 1 from sicof_context_functions_before b join pg_proc p on p.oid=b.oid where b.signature<>'sicof_private.context(date,date)' and pg_get_functiondef(p.oid)<>b.definition) then raise exception 'SICOF_CONTEXT_LEGACY_CHANGED';end if;
   end $guard$;
   insert into supabase_migrations.schema_migrations(version,name,statements) values('20261003000300','sicof_context_read_performance',array[${quote('H-SICOF-RELEASE-001 sha256:'+sha(sqlSource))}]);
   select jsonb_build_object('before',(select jsonb_agg(r order by resource) from sicof_context_data_before r),'after',(select jsonb_agg(r order by resource) from (${fp})r)) evidence;
   commit;`,true);
  proof('context-migration',{status:'PASS',version:'20261003000300',migrationSha256:sha(sqlSource),protectedTables:resources.length,financialAndPrivateHistoryUnchanged:true,legacyDefinitionsUnchanged:true,existingOidsOwnersAclsPreserved:true,financialWrites:0,evidence:result});return;
 }
 if(mode==='edge-bundle'||mode==='edge-deploy'){
  const names=fs.readdirSync(path.join(root,'supabase/functions/sicof')).filter(n=>/\.(ts|mjs)$/.test(n)),form=new FormData();
  form.append('metadata',JSON.stringify({name:'sicof',slug:'sicof',entrypoint_path:'index.ts',verify_jwt:true}));
  for(const name of names)form.append('file',new Blob([read('supabase/functions/sicof/'+name)],{type:name.endsWith('.ts')?'application/typescript':'application/javascript'}),name);
  const response=await management('/functions/deploy?slug=sicof'+(mode==='edge-bundle'?'&bundleOnly=true':''),{method:'POST',body:form});
  const data=await response.json(),listed=await(await management('/functions')).json();proof(mode,{status:'PASS',mode,version:data.version??null,cloudStatus:data.status??null,installed:listed.some(f=>f.slug==='sicof'||f.name==='sicof'),verifyJwt:true,sourceFiles:names,financialWrites:0});return;
 }
 if(mode==='import'){
  const report=JSON.parse(read('.tmp/sicof/historical-report.json')),bytes=Buffer.from(report.template_base64,'base64');assert.equal(report.sha256,'e9dc173869188990e23d71694a99af008d2b9190a301d1d71c90ff2764d18837');assert.equal(sha(bytes),report.sha256);assert.equal(report.rows.length,214);
  assert.equal(sha(fs.readFileSync('C:/Users/david/Downloads/Reporte Final Ahorro JC (3 reglas) .xlsx')),report.sha256,'ORIGINAL_WORKBOOK_CHANGED');
  const auth=await login(),claims=JSON.parse(Buffer.from(auth.access_token.split('.')[1],'base64url').toString()),affiliate=await rpc(auth.access_token,'get_effective_affiliate_id');
  for(const value of [auth.user.id,claims.session_id,affiliate])assert(/^[a-f0-9-]{36}$/.test(value),'ACTOR_CONTEXT_INVALID');
  const keyPath=path.join(privateDir,'import-key.txt');if(!fs.existsSync(keyPath))fs.writeFileSync(keyPath,crypto.randomUUID());const key=fs.readFileSync(keyPath,'utf8');
  const metadata={contract_version:report.contract_version,sheet_name:report.sheet_name,columns:report.columns,totals:report.totals,source_filename:report.filename};
  const sql=`begin;set local lock_timeout='5s';set local statement_timeout='60s';lock table ${tables.map(t=>'public.'+t).join(',')} in share mode;
   create temp table sicof_import_before on commit drop as ${fingerprints};select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
   select public.service_import_sicof_report(${[auth.user.id,claims.session_id,affiliate,key,report.filename,report.sha256,report.template_base64].map(quote).join(',')},${quote(JSON.stringify(report.rows))}::jsonb,${quote(JSON.stringify(metadata))}::jsonb);
   reset role;do $g$ begin if exists((select * from sicof_import_before) except (${fingerprints})) then raise exception 'SICOF_IMPORT_CHANGED_LEDGER';end if;end $g$;
   select id,sha256,jsonb_array_length(rows) row_count,classification,octet_length(template) bytes from sicof_private.historical_reports where sha256=${quote(report.sha256)};commit;`;
  const receipt=await query(sql,true);proof('historical-import',{status:'PASS',receipt,templateSha256:report.sha256,financialTablesUnchanged:true,financialWrites:0});return;
 }
 throw Error('MODE preflight|apply|edge-bundle|edge-deploy|import');
}
if(require.main===module)main().catch(error=>{fs.writeFileSync(path.join(privateDir,'release-error.txt'),error.stack||String(error));console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
module.exports={query,rpc,login,env};
