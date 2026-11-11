'use strict';
// Isolated test only: new loopback PostgreSQL cluster, schema-only catalog and
// synthetic fixtures. No environment files, production clients or existing DBs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),http=require('node:http');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),workspace=path.resolve(root,'../..');
const L=require(path.join(workspace,'scripts/document-lab/local.cjs'));
const uuid=()=>crypto.randomUUID(),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const evidence=path.join(root,'docs/qa/evidence/document-flow-surgical');
const tmp=path.join(root,'.tmp/synthetic-sql');
const report={startedAt:new Date().toISOString(),status:'RUNNING',scope:'LOCAL_SYNTHETIC_ONLY',checks:[],sources:{},limitations:[
 'Schema-only catalog is historical; this does not attest current production schema.',
 'Synthetic users, sessions, permissions, documents and financial criteria are not real accounts.',
 'The real financial SQL writer and Edge orchestration execute; Storage transport is a loopback synthetic HTTP server.',
 'No financial equivalence, production upload performance, mobile behavior or full UI proof is claimed.'
]};
let cluster,db,server,fixture,principal,loseResponse=false,downloadMode='normal';
const objects=new Map(),rpcTrace=[];
function save(){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'synthetic-sql.json'),JSON.stringify(report,null,2)+'\n');}
function source(file){const text=fs.readFileSync(file,'utf8');report.sources[path.relative(workspace,file).replaceAll('\\','/')]=sha(text);return text;}
async function test(name,fn){const start=performance.now();try{const detail=await fn();report.checks.push({name,status:'PASS',ms:Math.round(performance.now()-start),detail});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'FAIL',code:e.code||null,error:e.message,context:e.where||null});console.log('FAIL '+name+': '+e.message);throw e;}finally{save();}}
async function startCluster(){
 assert(root===path.join(workspace,'.tmp/document-flow-surgical'));
 fs.mkdirSync(tmp,{recursive:true});const dir=fs.mkdtempSync(path.join(tmp,'run-'));
 assert(path.resolve(dir).startsWith(path.resolve(tmp)+path.sep));
 const port=await L.freePort(),data=path.join(dir,'pgdata');
 L.command('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','-E','UTF8','--wal-segsize=1']);
 const log=fs.openSync(path.join(dir,'pg-control.log'),'a');
 try{L.command('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start'],{stdio:['ignore',log,log]});}finally{fs.closeSync(log);}
 const config={host:'127.0.0.1',port,user:'postgres',database:'document_lab_surgical',statement_timeout:60000};
 assert.equal(config.host,'127.0.0.1');assert(config.database.startsWith('document_lab'));
 cluster={dir,config,stop:()=>L.command('pg_ctl',['-D',data,'-m','fast','-w','stop'])};
 L.command('createdb',['-h','127.0.0.1','-p',String(port),'-U','postgres',config.database]);
 report.safety={host:config.host,database:config.database,freshCluster:true,existingDatabaseAccess:false,productionRowsImported:0,syntheticStorage:true,externalFetchBlocked:true,clusterStopped:false};
 const schema=source(path.join(L.base,'catalog/schema.sql'));
 assert(!/^COPY\s|^INSERT\s/m.test(schema),'SCHEMA_ONLY_NO_ROW_IMPORT');
 report.schema=await L.restoreSchema(config,dir);
 db=L.connect(config);await db.connect();
 const endpoint=(await db.query('select host(inet_server_addr()) address, current_database() database')).rows[0];
 assert.equal(endpoint.address,'127.0.0.1');assert.equal(endpoint.database,config.database);
 const rows=(await db.query('select (select count(*) from public.affiliates) affiliates,(select count(*) from public.program_requests) requests,(select count(*) from auth.users) users')).rows[0];
 assert.deepEqual(rows,{affiliates:'0',requests:'0',users:'0'});report.emptyBeforeFixtures=rows;
 await db.query("select set_config('document.release_authorized','DOCUMENT_V1',false)");
 for(const name of ['20261109000100_documentary_version_integrity.sql','20261109000200_documentary_legacy_file_access.sql','20261109000300_loan_document_submission.sql','20261109000400_document_100mb.sql']){
  if(name==='20261109000400_document_100mb.sql'){
   // The schema-only dump predates the exact 100 MiB predecessors. Reuse the
   // captured definitions, without editing/bypassing the migration hash gates.
   const before=JSON.parse(source(path.join(root,'scripts/fixtures/document-100mb-before.json')));
   assert.equal(before.functions.length,5);
   for(const f of before.functions)await db.query(f.definition);
   report.exactPredecessors=before.functions.map(f=>({signature:f.signature,definitionSha256:sha(f.definition)}));
  }
  await db.query(source(path.join(root,'supabase/migrations',name)));console.log('APPLIED LOCAL '+name);
 }
}
async function seed(){
 // Reuse only the SQL fixture section: deliberately stop before Storage/worker IO.
 const seedSource=source(path.join(workspace,'scripts/document-lab/phase2-fixtures.cjs'));
 const begin=seedSource.indexOf('\n const d=s.db'),end=seedSource.indexOf('\n const f=new PNG');
 assert(begin>0&&end>begin);const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 fixture=await new AsyncFunction('s','uuid','createAuthUser',seedSource.slice(begin,end)+'\nreturn {actor,otherActor,affiliate,other,type,item,fund,rule,batch,workflow,stage,publication};')({db},uuid,null);
 const f=fixture;f.session=uuid();f.otherSession=uuid();f.admin=uuid();f.adminSession=uuid();f.adminRole=uuid();
 const email='synthetic-'+f.actor+'@example.invalid';
 await db.query('begin');
 await db.query('update auth.users set email=$2,email_confirmed_at=now() where id=$1',[f.actor,email]);
 const otherEmail='synthetic-other-'+f.otherActor+'@example.invalid';
 await db.query('update auth.users set email=$2,email_confirmed_at=now() where id=$1',[f.otherActor,otherEmail]);
 await db.query("insert into auth.sessions(id,user_id,created_at,not_after) values($1,$2,now(),now()+interval '1 hour')",[f.otherSession,f.otherActor]);
 await db.query("update public.affiliates set historical_email_raw=$2,historical_email_normalized=$2,auth_eligibility='eligible',auth_ineligibility_reason=null where id=$1",[f.other,otherEmail]);
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'synthetic-admin@example.invalid',now())",[f.admin]);
 await db.query("insert into auth.sessions(id,user_id,created_at,not_after) values($1,$2,now(),now()+interval '1 hour'),($3,$4,now(),now()+interval '1 hour')",[f.session,f.actor,f.adminSession,f.admin]);
 await db.query("update public.affiliates set historical_email_raw=$2,historical_email_normalized=$2,auth_eligibility='eligible',auth_ineligibility_reason=null,phone_raw='6620000000' where id=$1",[f.affiliate,email]);
 await db.query("update public.program_catalog_items set request_mode='supabase',legacy_boundary=true where id=$1",[f.item]);
 await db.query("update public.document_types set required_by_default=true where id=$1",[f.type]);
 await db.query("insert into public.segmentation_catalog_entries(catalog_type,code,label) values('union','SYNTHETIC','SYNTHETIC'),('employment_category','BASE','BASE')");
 await db.query("insert into public.loan_term_policy(id,standard_terms,custom_min_term,custom_step,decision_reference) values('primary',array[6,12],1,1,'SYNTHETIC LAB ONLY')");
 const term=(await db.query("insert into public.program_terms_versions(program_id,version,title,body,published,published_at,created_by_auth_user_id) values('prestamo',1,'SYNTHETIC TERMS','SYNTHETIC LAB ONLY',true,clock_timestamp(),$1) returning id",[f.actor])).rows[0];f.term=term.id;
 await db.query("insert into public.program_document_requirements(program_id,document_type_id,sort_order,scope_type,scope_key) values('prestamo',$1,1,'PROGRAM','prestamo')",[f.type]);
 for(const [order,status,outcome] of [[1,'requires_financial_processing','process'],[2,'in_review','process'],[3,'approved','success']])await db.query('insert into public.operational_workflow_stages(workflow_id,name,status_reference,sort_order,outcome) values($1,$2,$3,$4,$5)',[f.workflow,'SYNTHETIC '+status,status,order,outcome]);
 await db.query("insert into public.admin_roles(id,code,name) values($1,'synthetic_document_test','Synthetic document test')",[f.adminRole]);
 const permissions=['documents.read','documents.write','affiliates.read'];
 for(const permission of permissions)await db.query('insert into public.admin_role_permissions(role_id,permission) values($1,$2)',[f.adminRole,permission]);
 await db.query('insert into public.admin_assignments(auth_user_id,permissions,role_id) values($1,$2,$3)',[f.admin,permissions,f.adminRole]);
 await db.query("insert into storage.buckets(id,name,public) values('private-assets','private-assets',false) on conflict(id) do nothing");
 const run=uuid(),history={loans:[],requests:[],issues:[]};
 await db.query("insert into loan_history_private.runs(id,kind,status,requested_at) values($1,'SCHEDULE','SUCCEEDED',clock_timestamp())",[run]);
 await db.query("insert into loan_history_private.state(id,enabled,status,run_id,sync_version,source_updated_at,last_success_at) select true,true,'READY',$1,version,source_updated_at,clock_timestamp() from public.loan_history_publication where id",[run]);
 await db.query("insert into loan_history_private.observations(folio,source,content_hash,changed_at,published_run_id) values($1,$2,encode(extensions.digest(($2::jsonb)::text,'sha256'),'hex'),clock_timestamp(),$3)",['SYNTHETIC-'+f.affiliate,history,run]);
 await db.query('commit');
 principal='self';report.fixture={syntheticOnly:true,affiliateCount:2,authUserCount:3,financialRules:1,documentTypes:1,history:'synthetic empty authoritative publication',accountNumbersFromProduction:[]};
}
function who(){return principal==='admin'?{actor:fixture.admin,session:fixture.adminSession}:principal==='other'?{actor:fixture.otherActor,session:fixture.otherSession}:{actor:fixture.actor,session:fixture.session};}
async function rpc(role,name,args){
 assert(['authenticated','service_role'].includes(role));assert(/^[a-z_]+$/.test(name));
 const {actor,session}=who();await db.query('begin');
 try{
  await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.role',$3,true)",[JSON.stringify({sub:actor,role,session_id:session}),actor,role]);
  await db.query('set local role '+role);
  const entries=Object.entries(args);assert(entries.every(([k])=>/^p_[a-z_]+$/.test(k)));
  const sql='select to_jsonb(public.'+name+'('+entries.map(([k],i)=>k+' => $'+(i+1)).join(',')+')) result';
  const rows=(await db.query(sql,entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows;
  const data=name.startsWith('list_')?rows.map(r=>r.result):rows[0]?.result;
  await db.query('commit');rpcTrace.push({role,name,status:'SUCCEEDED'});
  if(loseResponse&&name==='complete_document_financial_submission'){loseResponse=false;return{data:null,error:Error('SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT')};}
  return{data,error:null};
 }catch(error){await db.query('rollback');rpcTrace.push({role,name,status:'FAILED',code:error.code,message:error.message});return{data:null,error};}
}
async function checkedRpc(role,name,args){const r=await rpc(role,name,args);if(r.error)throw r.error;return r.data;}
async function main(){
 await test('Fresh loopback database, schema only, existing migrations unchanged',startCluster);
 await test('Synthetic authority fixtures with real guards and triggers',seed);
 server=http.createServer((req,res)=>{
  const key=decodeURIComponent(req.url.slice(1)),bytes=objects.get(key);
  if(!bytes||downloadMode==='missing'){res.writeHead(404).end();return;}
  const body=Buffer.from(bytes);if(downloadMode==='altered')body[0]^=1;
  res.writeHead(200,{'content-type':'application/octet-stream'});res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,originalFetch=globalThis.fetch;
 globalThis.fetch=(url,options)=>{const u=new URL(String(url));assert(u.hostname==='127.0.0.1'&&Number(u.port)===port,'EXTERNAL_FETCH_REFUSED');return originalFetch(url,options);};
 const shared=path.join(root,'supabase/functions/_shared');
 for(const name of ['document-integration.mjs','document-stream.mjs','document-crc.mjs'])source(path.join(shared,name));
 const {documentOperation,verifiedFinancialDocumentRpc}=await import(pathToFileURL(path.join(shared,'document-integration.mjs')));
 const user={rpc:(n,a)=>rpc('authenticated',n,a)},service={rpc:(n,a)=>rpc('service_role',n,a),storage:{from:bucket=>({createSignedUrl:async name=>({data:{signedUrl:'http://127.0.0.1:'+port+'/'+encodeURIComponent(bucket+'/'+name)},error:null})})}};
 const {PNG}=require(path.join(L.base,'deps/node_modules/pngjs'));
 function bytes(){const png=new PNG({width:8,height:8});crypto.randomFillSync(png.data);for(let i=3;i<png.data.length;i+=4)png.data[i]=255;return PNG.sync.write(png);}
 async function upload(mode,expected=null){
  principal=mode==='ADMIN'?'admin':'self';const id=uuid(),data=bytes();
  const pre=await documentOperation({action:'PREPARE',operation_id:id,mode,affiliate_id:mode==='ADMIN'?fixture.affiliate:null,document_type_id:fixture.type,mime:'image/png',size:data.length,sha256:sha(data),expected_document_id:expected,source:'FILE',reason:'SYNTHETIC LOCAL TEST'},user,service);
  assert.equal(pre.status,200,JSON.stringify(pre));const d=pre.body;
  assert(d.path&&d.bucket,'PREPARED_STORAGE_DESCRIPTOR');objects.set(d.bucket+'/'+d.path,data);
  await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[d.bucket,d.path,who().actor,{size:data.length,mimetype:'image/png'}]);
  const done=await documentOperation({action:'COMPLETE',operation_id:id},user,service);assert.equal(done.status,200,JSON.stringify(done));
  const doc=(await db.query('select * from public.affiliate_documents where id=(select document_id from document_lab_integrity.operations where id=$1)',[id])).rows[0];assert(doc);assert.equal(done.body.document.id,doc.id);
  return {...doc,operation_id:id,bytes_sha256:sha(data)};
 }
 async function current(){return(await db.query('select document_integration_private.current_document($1,$2) id',[fixture.affiliate,fixture.type])).rows[0].id;}
 async function access(doc,mode){principal=mode==='ADMIN'?'admin':'self';return checkedRpc('authenticated','resolve_document_access',{p_source:'EXPEDIENTE',p_association:doc.id,p_mode:mode});}
 const writerBefore=(await db.query("select md5(pg_get_functiondef(p.oid)) hash,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_validated_financial_program_request'")).rows;
 report.financialWriterBefore=writerBefore;let v1,v2,args,requestId;
 await test('Admin upload is reused by self with the same document, asset and hash',async()=>{
  v1=await upload('ADMIN');assert.equal(await current(),v1.id);const d=await access(v1,'SELF_SERVICE');assert.equal(d.asset,v1.private_asset_id);assert.equal(d.sha256,v1.bytes_sha256);
  const listed=await checkedRpc('authenticated','list_effective_affiliate_documents',{p_purpose:'SELF_SERVICE_EXPEDIENTE'});assert(listed.some(d=>d.document_id===v1.id&&d.private_asset_id===v1.private_asset_id&&d.available));
  return{documentSame:true,assetSame:true,sha256Same:true,selfListAvailable:true};
 });
 await test('Actual financial writer creates one loan, folio and sealed original evidence',async()=>{
  principal='self';const f=fixture;
  const rule=(await db.query('select * from public.financial_rules where id=$1',[f.rule])).rows[0];
  const pub=(await db.query("select *,source_updated_at::text source_updated_at,(clock_timestamp() at time zone 'America/Hermosillo')::date::text business_day from public.loan_history_publication where id")).rows[0];
  const profile=(await db.query('select financial_profile_version from public.affiliates where id=$1',[f.affiliate])).rows[0].financial_profile_version;
  args={p_actor_real_auth_user_id:f.actor,p_affiliate_id:f.affiliate,p_impersonation_session_id:null,p_program_item_id:f.item,p_notes:'SYNTHETIC LOCAL TEST',p_signature_data:'data:image/png;base64,'+bytes().toString('base64'),p_terms_version_id:f.term,p_document_ids:[v1.id],p_idempotency_key:uuid(),p_amount:1000,p_term:6,p_term_semantics:'QUINCENAL',p_expected_profile_version:profile,p_financial_submission_snapshot:{affiliate_id:f.affiliate,actor_real_auth_user_id:f.actor,impersonation_session_id:null,profile_version:profile,profile_fingerprint:'synthetic-local',criteria_source_fingerprint:'synthetic-local',term_policy_fingerprint:'synthetic-local',calculation_contract_version:'LOCAL_TEST',criterion_identity:rule.legacy_criterion_identity||'SUPABASE_RULE:'+rule.id,financialResult:{amount:1000,paymentCount:6},confirmed_at:new Date().toISOString(),deposit_selection:{bank_account_id:null,notification_phone:'6620000000'},loan_capacity:{version:1,affiliate_id:f.affiliate,numero_control:'SYNTHETIC-'+f.affiliate,observed_at:new Date().toISOString(),business_day:pub.business_day,source_version:pub.version,source_updated_at:pub.source_updated_at,funds:[{fund_id:f.fund,pending_amount:0,active_loans:0}],represented_request_ids:[]}}};
  // Drop the response to the FIRST committed creation, not only a later replay.
  loseResponse=true;
  const r=await verifiedFinancialDocumentRpc(user,service,'create_validated_financial_program_request',args);assert.match(r.error?.message||'',/SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT/);
  const request=(await db.query('select id,folio,requested_amount,requested_term from public.program_requests where idempotency_key=$1',[args.p_idempotency_key])).rows[0];assert(request);assert(request.folio);assert.equal(Number(request.requested_amount),1000);assert.equal(Number(request.requested_term),6);requestId=request.id;
  const refs=(await db.query('select affiliate_document_id,private_asset_id,asset_sha256 from public.request_documents where request_id=$1',[requestId])).rows;assert.equal(refs.length,1);assert.equal(refs[0].affiliate_document_id,v1.id);assert.equal(refs[0].private_asset_id,v1.private_asset_id);assert.equal(refs[0].asset_sha256.toLowerCase(),v1.bytes_sha256);
  return{actualSqlWriter:true,firstCreationCommittedBeforeResponseLoss:true,requestCount:1,folioPresent:true,requestedAmount:1000,requestedTerm:6,referenceCount:1,originalHashPreserved:true};
 });
 await test('Lost successful response retries the same financial idempotency key without duplicate loan or evidence',async()=>{
  loseResponse=true;const lost=await verifiedFinancialDocumentRpc(user,service,'create_validated_financial_program_request',args);assert.match(lost.error.message,/SYNTHETIC_RESPONSE_LOST/);
  const retry=await verifiedFinancialDocumentRpc(user,service,'create_validated_financial_program_request',args);assert.equal(retry.error,null,JSON.stringify(retry.error));
  const rows=(await db.query('select id,folio from public.program_requests where idempotency_key=$1',[args.p_idempotency_key])).rows;assert.equal(rows.length,1);assert.equal(rows[0].id,requestId);assert.equal((await db.query('select count(*) n from public.request_documents where request_id=$1',[requestId])).rows[0].n,'1');
  return{sameRequest:true,requestCount:1,evidenceCount:1,responseLostAfterDatabaseCommit:true};
 });
 await test('Self V2 upload is reused by admin and preserves request V1 evidence',async()=>{
  v2=await upload('SELF_SERVICE',v1.id);assert.notEqual(v2.id,v1.id);assert.equal(v2.replaces_document_id,v1.id);assert.equal(await current(),v2.id);
  const d=await access(v2,'ADMIN');assert.equal(d.asset,v2.private_asset_id);assert.equal(d.sha256,v2.bytes_sha256);
  const listed=await checkedRpc('authenticated','list_admin_affiliate_documents',{p_target_affiliate_id:fixture.affiliate,p_purpose:'ADMIN_AFFILIATE_PROFILE'});assert(listed.some(d=>d.document_id===v2.id&&d.private_asset_id===v2.private_asset_id&&d.available));
  const refs=(await db.query('select affiliate_document_id,private_asset_id,asset_sha256 from public.request_documents where request_id=$1',[requestId])).rows;assert.equal(refs.length,1);assert.equal(refs[0].affiliate_document_id,v1.id);assert.equal(refs[0].private_asset_id,v1.private_asset_id);assert.equal(refs[0].asset_sha256.toLowerCase(),v1.bytes_sha256);
  const assets=(await db.query('select count(*) n from public.private_assets where id=any($1::uuid[])',[ [v1.private_asset_id,v2.private_asset_id] ])).rows[0];assert.equal(assets.n,'2');
  const ref=(await db.query('select id from public.request_documents where request_id=$1',[requestId])).rows[0];principal='self';
  const original=await checkedRpc('authenticated','resolve_document_access',{p_source:'REQUEST',p_association:ref.id,p_mode:'SELF_SERVICE'});assert.equal(original.asset,v1.private_asset_id);assert.equal(original.sha256,v1.bytes_sha256);
  return{adminReusesSelfAsset:true,adminListAvailable:true,currentIsV2:true,priorRequestUsesV1:true,priorRequestStillAccessible:true,oldAndNewAssetsRetained:2};
 });
 await test('Real financial writer function remains byte-for-byte unchanged throughout tests',async()=>{
  const after=(await db.query("select md5(pg_get_functiondef(p.oid)) hash,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_validated_financial_program_request'")).rows;assert.deepEqual(after,writerBefore);return after;
 });
 await test('Different valid affiliate cannot read or submit another affiliate document',async()=>{
  principal='other';const actual=(await db.query('select (select count(*) from public.program_requests) requests,(select count(*) from document_integration_private.submissions) submissions')).rows[0];
  assert.equal(await checkedRpc('authenticated','get_effective_affiliate_id',{}),fixture.other);
  const denied=await rpc('authenticated','resolve_document_access',{p_source:'EXPEDIENTE',p_association:v2.id,p_mode:'SELF_SERVICE'});assert(denied.error);assert.equal(denied.error.code,'42501');
  const deniedAdmin=await rpc('authenticated','resolve_document_access',{p_source:'EXPEDIENTE',p_association:v2.id,p_mode:'ADMIN'});assert(deniedAdmin.error);assert.equal(deniedAdmin.error.code,'42501');
  const foreignArgs={...args,p_actor_real_auth_user_id:fixture.otherActor,p_affiliate_id:fixture.other,p_document_ids:[v2.id],p_idempotency_key:uuid()};
  const deniedSubmit=await rpc('authenticated','prepare_document_submission',{p_id:uuid(),p_function:'create_validated_financial_program_request',p_arguments:foreignArgs});assert(deniedSubmit.error);assert.equal(deniedSubmit.error.code,'42501');
  const after=(await db.query('select (select count(*) from public.program_requests) requests,(select count(*) from document_integration_private.submissions) submissions')).rows[0];assert.deepEqual(after,actual);principal='self';
  return{differentConfirmedAuthLink:true,selfAccessDenied:true,adminAccessDenied:true,foreignSubmissionDenied:true,requestsAndSubmissionsUnchanged:true};
 });
 report.rpcTrace=rpcTrace;globalThis.fetch=originalFetch;
}
(async()=>{try{await main();report.status='PASS';}catch(e){report.status='FAIL';report.error={message:e.message,code:e.code||null,context:e.where||null};process.exitCode=1;}finally{
 if(db)await db.end().catch(()=>{});if(server)await new Promise(r=>server.close(r));
 if(cluster){try{cluster.stop();if(report.safety)report.safety.clusterStopped=true;}catch(e){report.stopError=e.message;report.status='FAIL';process.exitCode=1;}}
 report.completedAt=new Date().toISOString();report.scriptSha256=sha(fs.readFileSync(__filename));report.rpcTrace=rpcTrace;save();console.log(JSON.stringify({status:report.status,passed:report.checks.filter(c=>c.status==='PASS').length,total:report.checks.length,evidence:path.relative(root,path.join(evidence,'synthetic-sql.json')),error:report.error||null}));
}})();
