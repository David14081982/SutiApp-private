'use strict';
// Integration tests: local restored PostgreSQL, real deployed JS verifier and
// financial writer. Storage transport is simulated with synthetic PNG bytes.
const R=require('./loan-document-submit.cjs'),L=require('./document-lab/local.cjs');
const compatibility=require('./loan-document-submit-compatibility.cjs');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const uuid=()=>crypto.randomUUID();
(async()=>{
 const restore=JSON.parse(R.C.fs.readFileSync(R.C.path.join(R.C.area,'restore-check.json')));
 const db=L.connect({host:'127.0.0.1',port:restore.port,user:'postgres',database:restore.database,statement_timeout:60000});
 const source=R.C.path.join(compatibility.candidate,'supabase/functions/_shared');
 const {documentVerifier}=await import(pathToFileURL(R.C.path.join(source,'document-verification.mjs')));
 const {verifiedFinancialDocumentRpc}=await import(pathToFileURL(R.C.path.join(source,'document-integration.mjs')));
 const deps=R.C.path.join(L.base,'deps/node_modules'),{PNG}=require(R.C.path.join(deps,'pngjs'));
 const strictVerifier=documentVerifier({PNG,jpeg:require(R.C.path.join(deps,'jpeg-js')),PDFDocument:require(R.C.path.join(deps,'pdf-lib')).PDFDocument});
 const {loanSubmissionVerifier}=await import(pathToFileURL(R.C.path.join(compatibility.candidate,'supabase/functions/financial-legacy/loan-document-verification.mjs')));
 const verify=loanSubmissionVerifier(strictVerifier,'create_validated_financial_program_request');
 assert.equal(loanSubmissionVerifier(strictVerifier,'confirm_program_product_financing'),strictVerifier);
 const groups=[],timings=[];let account,downloadMode='normal',hook=null;
 const objects=new Map();
 await db.connect();
 const claims=role=>JSON.stringify({sub:account.actor,role,session_id:account.session});
 async function identity(role){await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.role',$3,true)",[claims(role),account.actor,role]);}
 async function rpc(role,name,args){
  assert(['prepare_document_submission','complete_document_financial_submission'].includes(name));
  await db.query('savepoint rpc_call');const start=performance.now();
  try{await identity(role);await db.query('set local role '+role);
   const entries=Object.entries(args),sql='select public.'+name+'('+entries.map(([k],i)=>k+' => $'+(i+1)).join(',')+') result';
   const data=(await db.query(sql,entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].result;
   await db.query('reset role');await db.query('release savepoint rpc_call');timings.push({name,ms:Math.round((performance.now()-start)*100)/100});return{data,error:null};
  }catch(error){await db.query('rollback to savepoint rpc_call');await db.query('release savepoint rpc_call');if(process.env.LOAN_TEST_DEBUG)console.log(JSON.stringify({name,error:error.message,context:error.where}));return{data:null,error};}
 }
 const user={rpc:(n,a)=>rpc('authenticated',n,a)};
 const service={rpc:async(n,a)=>{if(hook){const h=hook;hook=null;await h();}return rpc('service_role',n,a);},storage:{from:bucket=>({download:async path=>{
  if(downloadMode==='missing')return{data:null,error:Error('missing')};
  let bytes=objects.get(bucket+'/'+path);assert(bytes,'SYNTHETIC_STORAGE_ONLY');
  if(downloadMode==='altered'){bytes=Buffer.from(bytes);bytes[0]^=1;}
  return{data:new Blob([bytes]),error:null};
 }})}};
 async function fresh(){
  await db.query('rollback');await db.query('begin');
  // Exact deployed predecessors, not assumptions about the age of the restore.
  for(const x of JSON.parse(R.C.fs.readFileSync(R.fixture)))await db.query(x.definition);
  const actor=uuid(),affiliate=uuid(),session=uuid(),email='loan-test-'+actor+'@example.invalid';
  account={actor,affiliate,session};
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[actor,email]);
  await db.query('insert into auth.sessions(id,user_id,created_at,not_after) values($1,$2,now(),now()+interval \'1 hour\')',[session,actor]);
  await db.query("insert into public.affiliates(id,numero_control,full_name,auth_user_id,historical_email_raw,historical_email_normalized,auth_eligibility,auth_ineligibility_reason,record_origin) values($1,$2,'LOCAL LOAN TEST',$3,$4,$4,'missing_email','missing_email','ADMIN_AFFILIATES')",[affiliate,'DOC-TEST-LOCAL-'+affiliate,actor,email]);
  await identity('authenticated');assert.equal((await db.query('select public.get_effective_affiliate_id() id')).rows[0].id,affiliate);
  const rule=(await db.query("select r.* from public.financial_rules r join public.financial_criteria_authority a on a.id='primary' and a.authority='SUPABASE' and a.active_import_batch_id=r.imported_batch_id join public.financial_funds f on f.id=r.fund_id and f.enabled and f.publication_status='PUBLISHED' join public.financial_programs p on p.id=r.program_id and p.enabled and p.publication_status='PUBLISHED' where r.enabled and r.lifecycle_status in('PUBLISHED','SCHEDULED') and r.max_amount>=1000 limit 1")).rows[0];assert(rule);
  await db.query('update public.affiliates set financial_union_code=$2,financial_employee_category_code=$3 where id=$1',[affiliate,rule.financial_union_code,rule.financial_employee_category_code]);
  const req=(await db.query("select document_type_id from public.resolve_affiliate_document_requirements('PROGRAM','prestamo',$1) where required",[affiliate])).rows;
  assert(req.length>0);account.documents=[];objects.clear();downloadMode='normal';hook=null;
  for(const r of req){
   const id=uuid(),asset=uuid(),png=new PNG({width:2,height:2});crypto.randomFillSync(png.data);
   let bytes=PNG.sync.write(png),mime='image/png';
   if(account.documents.length===0){bytes=Buffer.from('SYNTHETIC REGISTERED HEIC ORIGINAL '+id);mime='image/heic';}
   if(account.documents.length===1){bytes=Buffer.from('SYNTHETIC REGISTERED DOCX ORIGINAL '+id);mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';}
   if(account.documents.length===2){bytes=Buffer.alloc(11*1024*1024,32);bytes.write('%PDF-1.4\nSYNTHETIC REGISTERED ORIGINAL '+id);bytes.write('%%EOF',bytes.length-5);mime='application/pdf';}
   const hash=R.C.sha(bytes),path='affiliate-documents/'+affiliate+'/'+asset;
   const legacy=account.documents.length%2===0;
   await db.query("insert into public.private_assets(id,asset_key,asset_type,storage_bucket,storage_path,mime_type,file_size,content_sha256,owner_affiliate_id) values($1,$2,'DOCUMENT','private-assets',$3,$7,$4,$5,$6)",[asset,'LOCAL-TEST-'+asset,path,bytes.length,hash.toUpperCase(),legacy?null:affiliate,mime]);
   await db.query("insert into storage.objects(bucket_id,name,metadata) values('private-assets',$1,$2)",[path,{size:bytes.length,mimetype:mime}]);
   if(legacy){const file=uuid();
    // Construct the pre-ownership imported fixture. These two guards are restored
    // before every actual test; no production or tested request bypasses a guard.
    await db.query('alter table public.affiliate_files disable trigger document_isolation_reference');
    await db.query('alter table public.affiliate_documents disable trigger document_isolation_reference');
    await db.query("insert into public.affiliate_files(id,affiliate_id,private_asset_id,classification,file_key,file_type,source_column,source_column_letter,storage_bucket,storage_path,mime_type,sha256,file_size,source_url,source_row_ordinal,source_file_hash,expediente_classification) values($1,$2,$3,'PRIVATE',$4,'DOCUMENT','LOCAL_TEST','TEST','private-assets',$5,$9,$6,$7,$8,1,$6,'CURRENT_DOCUMENT')",[file,affiliate,asset,'LOCAL-TEST-'+file,path,hash.toUpperCase(),bytes.length,'local-fixture://'+file,mime]);
    await db.query("insert into public.affiliate_documents(id,affiliate_id,document_type_id,affiliate_file_id,status) values($1,$2,$3,$4,'VERIFIED')",[id,affiliate,r.document_type_id,file]);
    await db.query('alter table public.affiliate_files enable trigger document_isolation_reference');
    await db.query('alter table public.affiliate_documents enable trigger document_isolation_reference');
   }else await db.query("insert into public.affiliate_documents(id,affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id) values($1,$2,$3,$4,'PENDING_REVIEW',$5)",[id,affiliate,r.document_type_id,asset,actor]);
   objects.set('private-assets/'+path,bytes);account.documents.push({id,asset,type:r.document_type_id,path,hash,size:bytes.length,mime});
  }
  const item=(await db.query("select id from public.program_catalog_items where program_key='prestamo' and enabled and request_mode='supabase' and legacy_boundary limit 1")).rows[0];
  const term=(await db.query("select id from public.program_terms_versions where program_id='prestamo' and membership_offering_id is null and published limit 1")).rows[0];assert(item&&term);
  const profile=(await db.query('select financial_profile_version from public.affiliates where id=$1',[affiliate])).rows[0].financial_profile_version;
  account.args={p_actor_real_auth_user_id:actor,p_affiliate_id:affiliate,p_impersonation_session_id:null,p_program_item_id:item.id,p_notes:'LOCAL ISOLATED TEST',p_signature_data:'data:image/png;base64,'+objects.values().next().value.toString('base64'),p_terms_version_id:term.id,p_document_ids:account.documents.map(d=>d.id),p_idempotency_key:uuid(),p_amount:1000,p_term:6,p_term_semantics:'QUINCENAL',p_expected_profile_version:profile,p_financial_submission_snapshot:{affiliate_id:affiliate,actor_real_auth_user_id:actor,impersonation_session_id:null,profile_version:profile,profile_fingerprint:'local-test',criteria_source_fingerprint:'local-test',term_policy_fingerprint:'local-test',calculation_contract_version:'LOCAL_TEST',criterion_identity:{},financialResult:{amount:1000,paymentCount:6},confirmed_at:new Date().toISOString(),deposit_selection:{bank_account_id:null,notification_phone:'6620000000'}}};
  account.args.p_financial_submission_snapshot.criterion_identity=rule.legacy_criterion_identity||'SUPABASE_RULE:'+rule.id;
  account.args.p_financial_submission_snapshot.loan_capacity=(await db.query("select jsonb_build_object('version',1,'affiliate_id',$1::text,'numero_control',$2::text,'observed_at',clock_timestamp(),'business_day',(clock_timestamp() at time zone 'America/Hermosillo')::date,'source_version',version,'source_updated_at',source_updated_at,'funds',jsonb_build_array(jsonb_build_object('fund_id',$3::text,'pending_amount',0,'active_loans',0)),'represented_request_ids','[]'::jsonb) value from public.loan_history_publication where id",[affiliate,'DOC-TEST-LOCAL-'+affiliate,rule.fund_id])).rows[0].value;
 }
 const prepare=()=>user.rpc('prepare_document_submission',{p_id:uuid(),p_function:'create_validated_financial_program_request',p_arguments:account.args});
 const send=()=>verifiedFinancialDocumentRpc(user,service,'create_validated_financial_program_request',account.args,verify);
 const migrate=async()=>{await db.query(R.body(R.migration));await db.query(R.body(compatibility.sizeMigration));};
 async function noWrite(){assert.equal((await db.query('select count(*)::int n from public.program_requests where affiliate_id=$1',[account.affiliate])).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from document_lab_integrity.assets where affiliate_id=$1',[account.affiliate])).rows[0].n,0);}
 try{
  // 1. Exact production regression, followed by an actual complete loan writer.
  await fresh();const before=await prepare();assert.match(before.error?.message||'',/PHYSICAL_ASSET_NOT_VERIFIED/);
  await migrate();const started=performance.now(),first=await send();assert.ifError(first.error);assert(first.data.id);assert.equal(first.data.program_id,'prestamo');assert.equal(Number(first.data.requested_amount),1000);
  assert.equal((await db.query('select count(*)::int n from public.request_documents where request_id=$1',[first.data.id])).rows[0].n,account.documents.length);
  await db.query('savepoint retained_history');await assert.rejects(db.query(R.body(compatibility.sizeRecovery)),/RETAIN_EXISTING_DOCUMENT_HISTORY/);await db.query('rollback to savepoint retained_history');
  assert.equal((await db.query('select count(*)::int n from document_lab_integrity.assets where affiliate_id=$1',[account.affiliate])).rows[0].n,account.documents.length);
  groups.push({test:1,status:'PASS',name:'Historical documents: reproduce failure then complete real loan writer',documents:account.documents.length,elapsedMs:Math.round(performance.now()-started),requestCreatedOnlyInRolledBackLocalTransaction:true});
  console.log('PASS group 1');
  // 2. Existing enrollment, same idempotency key, one request and attachment set.
  const second=await send();assert.ifError(second.error);assert.equal(second.data.id,first.data.id);
  assert.equal((await db.query('select count(*)::int n from public.program_requests where affiliate_id=$1',[account.affiliate])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.request_documents where request_id=$1',[first.data.id])).rows[0].n,account.documents.length);
  groups.push({test:2,status:'PASS',name:'Verified document reuse and retry do not duplicate request or attachments'});console.log('PASS group 2');
  // 3. Security uses real SQL roles and backend context, never a UI assertion.
  await fresh();await migrate();
  const foreign=(await db.query('select id from public.affiliate_documents where affiliate_id<>$1 limit 1',[account.affiliate])).rows[0];const ids=account.args.p_document_ids;account.args.p_document_ids=[foreign.id];
  assert.match((await prepare()).error?.message||'',/DOCUMENT_NOT_CURRENT|PHYSICAL_ASSET_NOT_VERIFIED/);account.args.p_document_ids=ids;
  const denied=await user.rpc('complete_document_financial_submission',{p_id:uuid(),p_receipts:[]});assert.equal(denied.error.code,'42501');
  const originalSession=account.session;account.session=uuid();assert.match((await prepare()).error?.message||'',/AUTH_INVALID/);account.session=originalSession;
  hook=async()=>{await db.query('insert into document_evidence_private.withdrawals(document_id,actor_id,reason) values($1,$2,$3)',[account.documents[0].id,account.actor,'LOCAL TEST WITHDRAWAL']);};
  assert.match((await send()).error?.message||'',/DOCUMENT_NOT_CURRENT/);
  await noWrite();groups.push({test:3,status:'PASS',name:'Cross-user, invalid session and authenticated completion denied'});console.log('PASS group 3');
  // 4. Physical failure and source changes cannot enroll or create requests.
  await fresh();await migrate();
  const prepared=await prepare();assert.ifError(prepared.error);
  const forged=await service.rpc('complete_document_financial_submission',{p_id:prepared.data.id,p_receipts:prepared.data.documents.map(d=>({document_id:d.document_id,verified:true,sha256:'0'.repeat(64),size:d.size,mime:d.mime}))});assert.match(forged.error?.message||'',/VERIFICATION_RECEIPT_INVALID/);await noWrite();
  downloadMode='missing';assert.match((await send()).error?.message||'',/DOCUMENT_BYTES_UNAVAILABLE/);await noWrite();
  downloadMode='altered';assert.match((await send()).error?.message||'',/BYTE_INTEGRITY_MISMATCH/);await noWrite();downloadMode='normal';
  hook=async()=>{await db.query("update public.private_assets set status='DISABLED' where id=$1",[account.documents[0].asset]);};assert.match((await send()).error?.message||'',/DOCUMENT_OPERATION_CHANGED/);await noWrite();
  await db.query("update public.private_assets set status='READY' where id=$1",[account.documents[0].asset]);
  hook=async()=>{await db.query("insert into document_lab_integrity.assets(id,affiliate_id,bucket,path,sha256,size,mime,state) values($1,$2,'private-assets',$3,$4,$5,$6,'QUARANTINED')",[account.documents[0].asset,account.affiliate,account.documents[0].path,account.documents[0].hash,account.documents[0].size,account.documents[0].mime]);};
  assert.match((await send()).error?.message||'',/PHYSICAL_ASSET_NOT_VERIFIED/);assert.equal((await db.query('select state from document_lab_integrity.assets where id=$1',[account.documents[0].asset])).rows[0].state,'QUARANTINED');
  assert.equal((await db.query('select count(*)::int n from public.program_requests where affiliate_id=$1',[account.affiliate])).rows[0].n,0);
  groups.push({test:4,status:'PASS',name:'Missing/altered bytes, disabled source and concurrent quarantine rejected; no partial enrollment'});console.log('PASS group 4');
  // 5. Recovery, repeat installation, permission preservation and scope.
  await fresh();const original=await R.definitions(db);
  const unrelated=async()=>(await db.query("select md5(string_agg(pg_get_functiondef(p.oid),'' order by p.oid)) hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','document_evidence_private','document_integration_private') and p.prokind='f' and p.oid<>all($1::regprocedure[])",[original.map(x=>x.signature)])).rows[0].hash;
  const hash=await unrelated();await migrate();const patched=await R.definitions(db);
  assert.deepEqual(patched.map(({definition,...x})=>x),original.map(({definition,...x})=>x));
  await db.query(R.body(R.migration));assert.deepEqual(await R.definitions(db),patched);
  await db.query(R.body(R.recovery));assert.deepEqual(await R.definitions(db),original);
  await db.query(R.body(R.migration));assert.deepEqual(await R.definitions(db),patched);assert.equal(await unrelated(),hash);await noWrite();
  await db.query(R.body(compatibility.sizeRecovery));await db.query(R.body(compatibility.sizeMigration));
  const doc=account.documents[0],bytes=objects.get('private-assets/'+doc.path);
  await assert.rejects(strictVerifier(bytes,doc.mime,doc.hash,doc.size),/UNSUPPORTED_MIME/);
  await db.query('savepoint new_upload');await identity('authenticated');await db.query('set local role authenticated');
  await assert.rejects(db.query("select public.prepare_document_operation($1,'SELF_SERVICE',null,$2,'application/pdf',11534336,$3,null,'FILE','')",[uuid(),doc.type,doc.hash]),/INVALID|SIZE|CONTRACT|LIMIT/);
  await db.query('rollback to savepoint new_upload');
  groups.push({test:5,status:'PASS',name:'Exact rollback/reapply, idempotent install, unchanged ACL/owners and unrelated functions'});console.log('PASS group 5');
  await db.query('rollback');
  const result={status:'PASS',groups,migrationSha256:R.C.sha(R.C.fs.readFileSync(R.migration)),sizeMigrationSha256:R.C.sha(R.C.fs.readFileSync(compatibility.sizeMigration)),sourceHashes:{integration:R.C.sha(R.C.fs.readFileSync(R.C.path.join(source,'document-integration.mjs'))),verifier:R.C.sha(R.C.fs.readFileSync(R.C.path.join(source,'document-verification.mjs'))),loanAdapter:R.C.sha(R.C.fs.readFileSync(R.C.path.join(compatibility.candidate,'supabase/functions/financial-legacy/loan-document-verification.mjs')))},timings,limitations:['Local timings exclude real network and Storage latency','Transport and historical originals simulated; PostgreSQL functions, roles, financial writer and byte verifier are real','Existing-original contract verifies identity/hash/length, not retroactive codec validity','No production test request or Google call'],productionWrites:0};R.save(R.C.path.join(R.evidence,'tests.json'),result);console.log(JSON.stringify(result));
 }finally{await db.query('rollback');await db.end();}
})().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message,code:e.code,context:e.where,stack:e.stack}));process.exitCode=1;});
