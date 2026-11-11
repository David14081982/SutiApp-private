'use strict';
// One reusable loopback cluster; captured schema definitions and synthetic rows only.
// No .env, credentials, external fetch, production DB or real loan requests.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),http=require('node:http');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),workspace=path.resolve(root,'../..');
const L=require(path.join(workspace,'scripts/document-lab/local.cjs'));
const uuid=()=>crypto.randomUUID(),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const evidence=path.join(root,'docs/qa/evidence/loan-impersonation-context');
const tmp=path.join(root,'.tmp/loan-impersonation-context'),manifestFile=path.join(tmp,'cluster.json');
const report={startedAt:new Date().toISOString(),status:'RUNNING',scope:'LOCAL_SYNTHETIC_ONLY',checks:[],sources:{},limitations:[
 'Historical schema-only restore aligned with 15 captured current function definitions; not a complete live schema certification.',
 'Auth, users, bank details, documents, financial criteria and requests are synthetic. Storage is loopback HTTP.',
 'Real SQL writer, bank-required writer, document byte verification and finalizer execute. No real financial submission is claimed.',
 'Session-ID mismatch is rejected by the full authorization path; this does not claim the historical trigger selector alone checks session ID.'
]};
let db,cluster,f,server,outer=false,principal='self',sessionOverride=null,manifest,originalFetch;
const objects=new Map(),trace=[];
function save(){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'synthetic-sql.json'),JSON.stringify(report,null,2)+'\n');}
function source(file){const s=fs.readFileSync(file,'utf8');report.sources[path.relative(root,file).replaceAll('\\','/')]=sha(s);return s;}
function persist(){fs.mkdirSync(tmp,{recursive:true});fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');}
async function test(name,fn){const t=performance.now();try{const detail=await fn();report.checks.push({name,status:'PASS',ms:Math.round(performance.now()-t),detail});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'FAIL',error:e.message,code:e.code||null,context:e.where||null});throw e;}finally{save();}}
async function transaction(fn){assert(!outer);await db.query('begin');outer=true;try{return await fn();}finally{await db.query('rollback');outer=false;principal='self';sessionOverride=null;}}
async function start(){
 assert.equal(root,path.join(workspace,'.tmp/document-flow-surgical'));
 for(const file of [path.join(L.bin,'initdb.exe'),path.join(L.bin,'pg_ctl.exe'),path.join(L.base,'catalog/schema.sql'),path.join(L.base,'deps/node_modules/pngjs')])assert(fs.existsSync(file),'MISSING_DEPENDENCY '+file);
 if(fs.existsSync(manifestFile)){
  manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  assert.equal(manifest.marker,'SYNTHETIC_LOAN_IMPERSONATION_ONLY');
  const dir=path.resolve(manifest.dir);assert(dir.startsWith(tmp+path.sep+'run-'));
  const config=manifest.config;assert.equal(config.host,'127.0.0.1');assert.equal(config.database,'document_lab_impersonation');
  const data=path.join(dir,'pgdata'),log=fs.openSync(path.join(dir,'pg-control.log'),'a');
  try{L.command('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o','-h 127.0.0.1 -p '+config.port,'-w','start'],{stdio:['ignore',log,log]});}finally{fs.closeSync(log);}
  cluster={dir,config,stop:()=>L.command('pg_ctl',['-D',data,'-m','fast','-w','stop'])};
  db=L.connect(config);await db.connect();f=manifest.fixture;report.reusedCluster=true;
 }else{
  // Import bootstrap/seed only. The previous suite's main and assertions never run.
  const base=source(path.join(root,'scripts/test-document-flow-surgical-sql.cjs'));
  const end=base.indexOf('\nasync function main(){');assert(end>0);
  const prelude=base.slice(0,end).replace("path.join(root,'.tmp/synthetic-sql')","path.join(root,'.tmp/loan-impersonation-context')").replaceAll('document_lab_surgical','document_lab_impersonation');
  const api=new Function('require','__dirname',prelude+'\nreturn {startCluster,seed,state:()=>({cluster,db,fixture,report})};')(require,__dirname);
  try{await api.startCluster();await api.seed();}finally{const state=api.state();cluster=state.cluster;db=state.db;f=state.fixture;report.bootstrap=state.report;}
  manifest={marker:'SYNTHETIC_LOAN_IMPERSONATION_ONLY',dir:cluster.dir,config:cluster.config,fixture:f};persist();report.reusedCluster=false;
 }
 const endpoint=(await db.query('select host(inet_server_addr()) host,current_database() name')).rows[0];
 assert.equal(endpoint.host,'127.0.0.1');assert.equal(endpoint.name,'document_lab_impersonation');
 report.safety={host:endpoint.host,database:endpoint.name,oneCluster:true,productionRowsImported:0,externalFetchBlocked:true,businessCasesRolledBack:true,clusterStopped:false};
 const captured=JSON.parse(source(path.join(root,'scripts/fixtures/loan-impersonation-context-before.json')));
 assert.equal(captured.functions.length,15);
 for(const definition of captured.functions)await db.query(definition.definition);
 report.capturedFunctions=captured.functions.map(x=>({signature:x.signature,sha256:sha(x.definition)}));
 // Restartable seed additions use only IDs belonging to this synthetic fixture.
 await db.query("insert into public.admin_role_permissions(role_id,permission) values($1,'affiliates.impersonate') on conflict do nothing",[f.adminRole]);
 await db.query("update public.admin_assignments set permissions=array_append(permissions,'affiliates.impersonate') where auth_user_id=$1 and not ('affiliates.impersonate'=any(permissions))",[f.admin]);
 f.secondAdminSession=f.secondAdminSession||uuid();
 await db.query("insert into auth.sessions(id,user_id,created_at,not_after) values($1,$2,now(),now()+interval '1 hour') on conflict(id) do update set not_after=excluded.not_after",[f.secondAdminSession,f.admin]);
 await db.query("update auth.sessions set not_after=now()+interval '1 hour' where id=any($1::uuid[])",[[f.session,f.otherSession,f.adminSession]]);
 f.bank=f.bank||uuid();const first17='00201000000000001',weights=[3,7,1];const digit=(10-[...first17].reduce((n,v,i)=>n+(Number(v)*weights[i%3])%10,0)%10)%10;
 await db.query("insert into public.affiliate_bank_accounts(id,affiliate_id,account_holder,bank_name,clabe,card_number,is_primary) values($1,$2,'SYNTHETIC HOLDER','SYNTHETIC BANK',$3,'4000000000000002',true) on conflict(id) do nothing",[f.bank,f.affiliate,first17+digit]);
 manifest.fixture=f;persist();
 return{reusedCluster:report.reusedCluster,capturedCurrentDefinitions:15,syntheticBank:true};
}
function who(){return principal==='admin'?{actor:f.admin,session:sessionOverride||f.adminSession}:principal==='other'?{actor:f.otherActor,session:sessionOverride||f.otherSession}:{actor:f.actor,session:sessionOverride||f.session};}
async function rpc(role,name,args){
 assert(['authenticated','service_role'].includes(role));assert(/^[a-z_]+$/.test(name));
 const {actor,session}=who(),nested=outer;await db.query(nested?'savepoint rpc_call':'begin');
 try{
  const claims=role==='service_role'?{role}:{sub:actor,role,session_id:session};
  await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.role',$3,true)",[JSON.stringify(claims),role==='service_role'?'':actor,role]);
  await db.query('set local role '+role);
  const entries=Object.entries(args);assert(entries.every(([k])=>/^p_[a-z_]+$/.test(k)));
  const rows=(await db.query('select to_jsonb(public.'+name+'('+entries.map(([k],i)=>k+' => $'+(i+1)).join(',')+')) result',entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows;
  const data=name.startsWith('list_')?rows.map(r=>r.result):rows[0]?.result;
  await db.query(nested?'release savepoint rpc_call':'commit');if(nested)await db.query('reset role');
  trace.push({role,name,status:'SUCCEEDED'});return{data,error:null};
 }catch(error){await db.query(nested?'rollback to savepoint rpc_call':'rollback');if(nested){await db.query('release savepoint rpc_call');await db.query('reset role');}trace.push({role,name,status:'FAILED',code:error.code,message:error.message,context:error.where||null});return{data:null,error};}
}
async function checkedRpc(role,name,args={}){const r=await rpc(role,name,args);if(r.error)throw r.error;return r.data;}
async function setupTransport(){
 server=http.createServer((req,res)=>{const body=objects.get(decodeURIComponent(req.url.slice(1)));if(!body){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':'application/octet-stream'});res.end(body);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 originalFetch=globalThis.fetch;globalThis.fetch=(url,options)=>{const u=new URL(String(url));assert(u.hostname==='127.0.0.1'&&Number(u.port)===port,'EXTERNAL_FETCH_REFUSED');return originalFetch(url,options);};
 const shared=path.join(root,'supabase/functions/_shared/document-integration.mjs');source(shared);
 const {documentOperation,verifiedFinancialDocumentRpc}=await import(pathToFileURL(shared));
 const user={rpc:(n,a)=>rpc('authenticated',n,a)},service={rpc:(n,a)=>rpc('service_role',n,a),storage:{from:bucket=>({createSignedUrl:async name=>({data:{signedUrl:'http://127.0.0.1:'+port+'/'+encodeURIComponent(bucket+'/'+name)},error:null})})}};
 const {PNG}=require(path.join(L.base,'deps/node_modules/pngjs'));const png=new PNG({width:8,height:8});png.data.fill(127);for(let i=3;i<png.data.length;i+=4)png.data[i]=255;
 const imageBytes=PNG.sync.write(png);
 if(manifest.document){objects.set(manifest.document.key,Buffer.from(manifest.document.bytesBase64,'base64'));}
 else{
  principal='self';const operation=uuid();
  const pre=await documentOperation({action:'PREPARE',operation_id:operation,mode:'SELF_SERVICE',document_type_id:f.type,mime:'image/png',size:imageBytes.length,sha256:sha(imageBytes),expected_document_id:null,source:'FILE',reason:'SYNTHETIC LOCAL TEST'},user,service);
  assert.equal(pre.status,200,JSON.stringify(pre));const descriptor=pre.body,key=descriptor.bucket+'/'+descriptor.path;objects.set(key,imageBytes);
  await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[descriptor.bucket,descriptor.path,f.actor,{size:imageBytes.length,mimetype:'image/png'}]);
  const done=await documentOperation({action:'COMPLETE',operation_id:operation},user,service);assert.equal(done.status,200,JSON.stringify(done));
  const doc=(await db.query('select * from public.affiliate_documents where id=(select document_id from document_lab_integrity.operations where id=$1)',[operation])).rows[0];assert(doc);
  manifest.document={id:doc.id,asset:doc.private_asset_id,key,bytesBase64:imageBytes.toString('base64'),sha256:sha(imageBytes)};persist();
 }
 return{user,service,imageBytes,submit:args=>verifiedFinancialDocumentRpc(user,service,'create_validated_financial_program_request',args)};
}
async function assistance(){
 const id=uuid();await db.query("insert into public.impersonation_sessions(id,actor_real_auth_user_id,usuario_contexto_affiliate_id,reason,started_at,expires_at,actor_auth_session_id) values($1,$2,$3,'SYNTHETIC ASSISTANCE',clock_timestamp(),clock_timestamp()+interval '20 minutes',$4)",[id,f.admin,f.affiliate,f.adminSession]);principal='admin';return id;
}
async function argsFor(actor,impersonation,imageBytes){
 const rule=(await db.query('select * from public.financial_rules where id=$1',[f.rule])).rows[0];
 const publication=(await db.query("select *,source_updated_at::text source_updated_at,(clock_timestamp() at time zone 'America/Hermosillo')::date::text business_day from public.loan_history_publication where id")).rows[0];
 const profile=(await db.query('select financial_profile_version from public.affiliates where id=$1',[f.affiliate])).rows[0].financial_profile_version;
 return{p_actor_real_auth_user_id:actor,p_affiliate_id:f.affiliate,p_impersonation_session_id:impersonation,p_program_item_id:f.item,p_notes:'SYNTHETIC LOCAL TEST',p_signature_data:'data:image/png;base64,'+imageBytes.toString('base64'),p_terms_version_id:f.term,p_document_ids:[manifest.document.id],p_idempotency_key:uuid(),p_amount:1000,p_term:6,p_term_semantics:'QUINCENAL',p_expected_profile_version:profile,p_financial_submission_snapshot:{affiliate_id:f.affiliate,actor_real_auth_user_id:actor,impersonation_session_id:impersonation,profile_version:profile,profile_fingerprint:'synthetic-local',criteria_source_fingerprint:'synthetic-local',term_policy_fingerprint:'synthetic-local',calculation_contract_version:'LOCAL_TEST',criterion_identity:rule.legacy_criterion_identity||'SUPABASE_RULE:'+rule.id,financialResult:{amount:1000,paymentCount:6},confirmed_at:new Date().toISOString(),deposit_selection:{bank_account_id:f.bank,notification_phone:'6620000000'},loan_capacity:{version:1,affiliate_id:f.affiliate,numero_control:'SYNTHETIC-'+f.affiliate,observed_at:new Date().toISOString(),business_day:publication.business_day,source_version:publication.version,source_updated_at:publication.source_updated_at,funds:[{fund_id:f.fund,pending_amount:0,active_loans:0}],represented_request_ids:[]}}};
}
async function counts(){return(await db.query('select (select count(*) from public.program_requests) requests,(select count(*) from public.request_documents) documents,(select count(*) from public.loan_request_deposit_snapshots) deposits')).rows[0];}
async function metadata(){return(await db.query("select pg_get_functiondef(p.oid) definition,to_jsonb(p)-'prosrc' metadata,(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_trigger t where t.tgfoid=p.oid) bindings from pg_proc p where p.oid='public.capture_program_request_impersonation()'::regprocedure")).rows[0];}
async function writerHashes(){return(await db.query("select p.proname,md5(pg_get_functiondef(p.oid)) hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'create_validated_financial_program_request%' or p.proname in('is_active_admin','admin_actor_can_impersonate','prepare_document_submission','complete_document_financial_submission')) order by p.proname,p.oid")).rows;}
async function catalogFingerprint(){return(await db.query("select count(*) functions,md5(jsonb_agg(case when p.oid='public.capture_program_request_impersonation()'::regprocedure then to_jsonb(p)-'prosrc' else to_jsonb(p) end order by p.oid)::text) metadata_and_unrelated_bodies_md5 from pg_proc p")).rows[0];}
async function main(){
 await test('One isolated cluster and current captured authorization/writer definitions',start);
 const io=await setupTransport();const before=await metadata(),untouched=await writerHashes(),initialCounts=await counts(),allFunctions=await catalogFingerprint();report.allFunctionsBefore=allFunctions;
 await test('BEFORE: valid permitted actor and nonadmin target reproduce 42501 at COMPLETE bank writer trigger',()=>transaction(async()=>{
  const imp=await assistance();assert.equal(await checkedRpc('authenticated','admin_actor_can_impersonate'),true);assert.equal(await checkedRpc('authenticated','is_active_admin'),false);assert.equal(await checkedRpc('authenticated','get_effective_affiliate_id'),f.affiliate);
  const args=await argsFor(f.admin,imp,io.imageBytes),prior=await counts(),r=await io.submit(args);assert(r.error);assert.equal(r.error.code,'42501');assert.equal(r.error.message,'IMPERSONATION_CONTEXT_INVALID');assert.equal(r.error.documentPhase,'COMPLETE');
  assert.match(r.error.where,/capture_program_request_impersonation/);assert.match(r.error.where,/create_validated_financial_program_request_bank_required/);assert.deepEqual(await counts(),prior);
  report.before={status:'REPRODUCED_FAILURE',code:r.error.code,message:r.error.message,phase:r.error.documentPhase,postgresContext:r.error.where,requestsCreated:0};fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'before.json'),JSON.stringify(report.before,null,2)+'\n');return report.before;
 }));
 const forward=source(path.join(root,'supabase/migrations/20261111000100_loan_impersonation_actor.sql'));
 const recovery=source(path.join(root,'supabase/recovery/20261111000100_loan_impersonation_actor.sql'));
 await test('Forward migration changes only trigger body and preserves metadata, bindings and rows',async()=>{await db.query(forward);const after=await metadata();assert.deepEqual(after.metadata,before.metadata);assert.deepEqual(after.bindings,before.bindings);assert.equal(after.definition,before.definition.replace('not public.is_active_admin()','public.admin_actor_can_impersonate() IS NOT TRUE'));assert.deepEqual(await counts(),initialCounts);assert.deepEqual(await writerHashes(),untouched);assert.deepEqual(await catalogFingerprint(),allFunctions);report.afterDefinitionSha256=sha(after.definition);return{onlyExactPermissionExpressionChanged:true,allPgProcMetadataPreserved:true,allOtherFunctionBodiesPreserved:true,allBindingsPreserved:true,businessRowsUnchanged:true};});
 async function success(assisted,noAuth){return transaction(async()=>{
  if(noAuth)await db.query('update public.affiliates set auth_user_id=null where id=$1',[f.affiliate]);
  const imp=assisted?await assistance():null;principal=assisted?'admin':'self';const actor=assisted?f.admin:f.actor,args=await argsFor(actor,imp,io.imageBytes);
  const r=await io.submit(args);assert.equal(r.error,null,JSON.stringify(r.error));
  const row=(await db.query('select * from public.program_requests where idempotency_key=$1',[args.p_idempotency_key])).rows[0];assert(row&&row.folio);assert.equal(row.actor_real_auth_user_id,actor);assert.equal(row.affiliate_id,f.affiliate);assert.equal(row.impersonation_session_id,imp);assert.equal(Number(row.requested_amount),1000);assert.equal(Number(row.requested_term),6);
  if(assisted){assert.equal(row.usuario_contexto_affiliate_id,f.affiliate);assert.equal(row.impersonation_reason,'SYNTHETIC ASSISTANCE');assert.equal(row.source_context.actor_real_auth_user_id,actor);assert.equal(row.source_context.impersonation_session_id,imp);}
  const doc=(await db.query('select affiliate_document_id,private_asset_id,asset_sha256 from public.request_documents where request_id=$1',[row.id])).rows;assert.equal(doc.length,1);assert.equal(doc[0].affiliate_document_id,manifest.document.id);assert.equal(doc[0].private_asset_id,manifest.document.asset);assert.equal(doc[0].asset_sha256.toLowerCase(),manifest.document.sha256);
  const bank=(await db.query('select source_bank_account_id,notification_phone from public.loan_request_deposit_snapshots where request_id=$1',[row.id])).rows;assert.equal(bank.length,1);assert.equal(bank[0].source_bank_account_id,f.bank);assert.equal(bank[0].notification_phone,'6620000000');
  const replay=await io.submit(args);assert.equal(replay.error,null,JSON.stringify(replay.error));assert.equal(replay.data.id,row.id);assert.equal((await db.query('select count(*) n from public.program_requests where idempotency_key=$1',[args.p_idempotency_key])).rows[0].n,'1');assert.equal((await db.query('select count(*) n from public.request_documents where request_id=$1',[row.id])).rows[0].n,'1');
  return{actualBankWriter:true,own:!assisted,targetHasAuth:!noAuth,actorAndTargetPreserved:true,assistanceMetadataPreserved:assisted,folioPresent:true,oneRequestAfterReplay:true,oneOriginalDocumentEvidence:true,bankSnapshotPreserved:true,amount:1000,term:6};
 });}
 await test('AFTER: own bank loan remains valid and idempotent',()=>success(false,false));
 await test('AFTER: assisted bank loan for ordinary authenticated nonadmin preserves attribution and idempotency',()=>success(true,false));
 await test('AFTER: assisted bank loan for nonadmin without Auth remains valid',()=>success(true,true));
 await test('Shared trigger denies another target and active admin lacking the impersonation permission',()=>transaction(async()=>{
  await assistance();
  await db.query('create temporary table synthetic_trigger_input(affiliate_id uuid,usuario_contexto_affiliate_id uuid,impersonation_session_id uuid,impersonation_reason text,source_context jsonb)');
  await db.query('create trigger synthetic_impersonation before insert on synthetic_trigger_input for each row execute function public.capture_program_request_impersonation()');
  await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.role','authenticated',true)",[JSON.stringify({sub:f.admin,role:'authenticated',session_id:f.adminSession}),f.admin]);
  async function denied(target){await db.query('savepoint direct_guard');try{await db.query('insert into synthetic_trigger_input(affiliate_id) values($1)',[target]);throw Error('DIRECT_TRIGGER_ACCEPTED_INVALID_CONTEXT');}catch(e){await db.query('rollback to savepoint direct_guard');assert.equal(e.code,'42501');assert.equal(e.message,'IMPERSONATION_CONTEXT_INVALID');}finally{await db.query('release savepoint direct_guard');}}
  await denied(f.other);
  await db.query('insert into public.admin_assignments(auth_user_id,permissions,role_id) values($1,ARRAY[]::text[],$2)',[f.actor,f.adminRole]);
  await db.query("delete from public.admin_role_permissions where role_id=$1 and permission='affiliates.impersonate'",[f.adminRole]);
  await db.query("update public.admin_assignments set permissions=array_remove(permissions,'affiliates.impersonate') where auth_user_id=$1",[f.admin]);
  assert.deepEqual((await db.query('select admin_support_private.is_active_admin($1) actor,admin_support_private.is_active_admin($2) target,public.admin_actor_can_impersonate() permitted',[f.admin,f.actor])).rows[0],{actor:true,target:true,permitted:false});
  await denied(f.affiliate);assert.equal((await db.query('select count(*) n from synthetic_trigger_input')).rows[0].n,'0');
  return{mismatchedTargetDenied:true,activeActorAndTargetAdminsWithoutPermissionDenied:true,temporaryTriggerCallsOnly:true,zeroRows:true};
 }));
 const negatives=[
  ['actor permission revoked',async()=>{await db.query("delete from public.admin_role_permissions where role_id=$1 and permission='affiliates.impersonate'",[f.adminRole]);await db.query("update public.admin_assignments set permissions=array_remove(permissions,'affiliates.impersonate') where auth_user_id=$1",[f.admin]);}],
  ['actor assignment disabled',async()=>{await db.query('update public.admin_assignments set enabled=false,revoked_at=clock_timestamp(),revoked_by_auth_user_id=$1 where auth_user_id=$1',[f.admin]);}],
  ['actor role disabled',async()=>{await db.query('update public.admin_roles set enabled=false where id=$1',[f.adminRole]);}],
  ['assistance expired',async id=>{await db.query("update public.impersonation_sessions set started_at=clock_timestamp()-interval '25 minutes',expires_at=clock_timestamp()-interval '1 minute' where id=$1",[id]);}],
  ['assistance ended',async id=>{await db.query('update public.impersonation_sessions set ended_at=clock_timestamp(),ended_by_auth_user_id=$2 where id=$1',[id,f.admin]);}],
  ['valid different Auth session ID',async()=>{sessionOverride=f.secondAdminSession;}],
  ['cross-account actor',async()=>{principal='other';}]
 ];
 for(const [name,invalidate] of negatives)await test('DENY: '+name+' creates no request, evidence or bank snapshot',()=>transaction(async()=>{
  const imp=await assistance(),args=await argsFor(f.admin,imp,io.imageBytes),prior=await counts();
  // Prepare under valid authority; invalidate before finalization, then exercise
  // the existing real recheck. New invalid preparation is tested as well.
  const submissionId=uuid();const prepared=await checkedRpc('authenticated','prepare_document_submission',{p_id:submissionId,p_function:'create_validated_financial_program_request',p_arguments:args});assert.equal(prepared.documents.length,1);
  await invalidate(imp);
  const denied=await io.submit(args);assert(denied.error,'INVALID_CONTEXT_ACCEPTED');assert.equal(denied.error.code,'42501');assert.deepEqual(await counts(),prior);
  // Different caller/session is stopped before service finalization. COMPLETE
  // deliberately restores the operation's original claims, so do not forge or
  // mutate those claims to invent an additional denial in this test.
  if(['valid different Auth session ID','cross-account actor'].includes(name))return{prepareDenied:true,prepareCode:denied.error.message,completeReached:false,zeroBusinessWrites:true,originalStoredClaimsUnmodified:true};
  const d=prepared.documents[0],receipts=[{document_id:d.document_id,verified:true,sha256:d.sha256,size:Number(d.size),mime:d.mime}];
  const completed=await rpc('service_role','complete_document_financial_submission',{p_id:submissionId,p_receipts:receipts});assert(completed.error,'INVALID_FINAL_CONTEXT_ACCEPTED');assert.equal(completed.error.code,'42501');assert.deepEqual(await counts(),prior);
  return{prepareDenied:true,prepareCode:denied.error.message,completeDenied:true,completeCode:completed.error.message,zeroBusinessWrites:true,originalStoredClaimsUnmodified:true};
 }));
 await test('Recovery restores exact definition, metadata and trigger bindings without row changes',async()=>{const rows=await counts();await db.query(recovery);assert.deepEqual(await metadata(),before);assert.deepEqual(await counts(),rows);assert.deepEqual(await writerHashes(),untouched);assert.deepEqual(await catalogFingerprint(),allFunctions);return{exactDefinition:true,allMetadata:true,allOtherFunctionBodies:true,allBindings:true,rowsUnchanged:true};});
 await test('Recovered trigger reproduces original defect; reapplying forward remains valid',async()=>{await transaction(async()=>{const imp=await assistance(),r=await io.submit(await argsFor(f.admin,imp,io.imageBytes));assert.equal(r.error?.message,'IMPERSONATION_CONTEXT_INVALID');assert.equal(r.error?.documentPhase,'COMPLETE');});await db.query(forward);assert.deepEqual(await counts(),initialCounts);assert.deepEqual(await writerHashes(),untouched);return{originalDefectRestored:true,forwardReapplied:true,financialWritersAndGlobalHelpersUnchanged:true};});
}
(async()=>{try{await main();report.status='PASS';}catch(e){report.status='FAIL';report.error={message:e.message,code:e.code||null,context:e.where||null,stack:e.stack};process.exitCode=1;}finally{
 if(originalFetch)globalThis.fetch=originalFetch;if(db)await db.end().catch(()=>{});if(server)await new Promise(r=>server.close(r));
 if(cluster){try{cluster.stop();if(report.safety)report.safety.clusterStopped=true;}catch(e){report.status='FAIL';report.stopError=e.message;process.exitCode=1;}}
 report.completedAt=new Date().toISOString();report.scriptSha256=sha(fs.readFileSync(__filename));report.rpcTrace=trace;save();console.log(JSON.stringify({status:report.status,passed:report.checks.filter(x=>x.status==='PASS').length,total:report.checks.length,error:report.error||null}));
}})();
