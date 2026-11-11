'use strict';
// Synthetic helper for the already-running loopback lab. It never starts a stack.
// Storage uses real locally signed authenticated JWTs and the restored RLS.
// RPCs execute real restored functions under SET ROLE authenticated, without GoTrue
// or a PostgREST HTTP gateway. This does not certify browser upload or live Auth.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');

module.exports=async function employeeNumberDocumentChecks({s,db,actor,ownerAuth,newAuth,old,newPerson,fixture,as,admin,q,value,check,hash}){
 const root=path.resolve(__dirname,'..'),workspace=process.env.SUTI_TEST_WORKSPACE||path.resolve(root,'../..');
 assert.equal(s.config.host,'127.0.0.1');
 assert.equal(s.config.database,'document_lab');
 assert.equal(new URL(s.url).hostname,'127.0.0.1');
 assert.equal(db.connectionParameters.host,'127.0.0.1');
 const fresh=newPerson.profile?.id;
 assert.match(fresh||'',/^[0-9a-f-]{36}$/i);
 assert.notEqual(fresh,old);assert.notEqual(ownerAuth,newAuth);
 assert(fixture.type&&s.secret&&typeof s.store.request==='function');
 const {jwt}=require(path.join(workspace,'scripts/document-lab/setup.cjs'));
 const {PDFDocument}=require(path.join(workspace,'.tmp/document-architecture-lab/deps/node_modules/pdf-lib'));
 const headersFor=id=>({Authorization:'Bearer '+jwt(s.secret,'authenticated',id)});
 const get=async(id,objectPath)=>{
  assert.match(objectPath,/^affiliate-documents\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i);
  return (await s.store.request('GET','/object/authenticated/private-assets/'+objectPath,undefined,headersFor(id))).bytes;
 };
 const denyGet=async(id,objectPath)=>{
  let status;
  await assert.rejects(()=>get(id,objectPath),error=>{
   status=error.status;
   return [400,401,403,404].includes(status);
  });
  return status;
 };
 const oldAssets=()=>q('select id,storage_bucket,storage_path,content_sha256,file_size,status,owner_affiliate_id from public.private_assets where owner_affiliate_id=$1 order by id',[old]);
 const register=args=>value('select public.register_admin_affiliate_document($1,$2,$3,$4,$5,$6,$7) v',args);
 let priorObjects,receipt,args,bytes,objectPath;
 try{
  await check('after','Five original local objects are readable by their owner and match stored hashes',async()=>{
   await admin();priorObjects=await oldAssets();assert.equal(priorObjects.length,5);
   await as(ownerAuth);
   assert.equal(await value('select public.get_effective_affiliate_id() v'),old);
   assert.equal(await value("select public.has_admin_permission('assets.read') v"),false);
   for(const item of priorObjects){
    assert.equal(item.storage_bucket,'private-assets');assert.equal(item.owner_affiliate_id,old);
    const fetched=await get(ownerAuth,item.storage_path);
    assert.equal(fetched.length,Number(item.file_size));
    assert.equal(hash(fetched),item.content_sha256.toLowerCase());
   }
   return {objectsVerified:5,authenticatedStorageJWT:true};
  });
  // Fixture-only Auth linkage: preserve the previous person's UUID and all data.
  await as(actor);await admin();
  const users=await q('select id,email,email_confirmed_at from auth.users where id=$1',[newAuth]);
  assert.equal(users.length,1);assert(users[0].email_confirmed_at);
  assert.match(users[0].email,/@example\.invalid$/);
  const linked=await q(`update public.affiliates set auth_user_id=$2,
   historical_email_raw=$3,historical_email_normalized=lower(btrim($3)),
   auth_eligibility='eligible',auth_ineligibility_reason=null
   where id=$1 and auth_user_id is null and not is_archived returning id`,[fresh,newAuth,users[0].email]);
  assert.equal(linked.length,1);
  await check('after','New identity uploads with admin JWT and registers through the real document RPC',async()=>{
   const pdf=await PDFDocument.create();pdf.addPage([120,160]);
   bytes=Buffer.from(await pdf.save({useObjectStreams:false}));
   objectPath='affiliate-documents/'+fresh+'/'+crypto.randomUUID()+'.pdf';
   await s.store.request('POST','/object/private-assets/'+objectPath,bytes,
    {...headersFor(actor),'Content-Type':'application/pdf','x-upsert':'false'});
   await admin();
   const objects=await q("select owner_id from storage.objects where bucket_id='private-assets' and name=$1",[objectPath]);
   assert.equal(objects.length,1);assert.equal(objects[0].owner_id,actor);
   await as(actor);
   args=[fresh,fixture.type,objectPath,'application/pdf',bytes.length,hash(bytes),''];
   receipt=await register(args);
   assert(receipt.document?.id);assert(receipt.document.private_asset_id);
   assert.equal(receipt.document.affiliate_id,fresh);
   assert.equal(receipt.document.document_type_id,fixture.type);
   assert.equal(receipt.document.replaces_document_id,null);
   assert.equal(receipt.cleanup_storage_path,null);
   assert.equal(hash(await get(actor,objectPath)),hash(bytes));
   return {storageOwnerIsActor:true,documentOwnerIsNewUUID:true,bytesVerified:true};
  });
  await check('after','Retry of confirmed registration preserves the document and creates no duplicate object or audit event',async()=>{
   await as(actor);
   const repeated=await register(args);
   assert.deepEqual(repeated.document,receipt.document);
   assert.equal(repeated.cleanup_storage_path,null);
   await admin();
   assert.equal(await value('select count(*)::int v from public.affiliate_documents where affiliate_id=$1',[fresh]),1);
   assert.equal(await value('select count(*)::int v from public.private_assets where owner_affiliate_id=$1',[fresh]),1);
   assert.equal(await value("select count(*)::int v from storage.objects where bucket_id='private-assets' and name=$1",[objectPath]),1);
   assert.equal(await value("select count(*)::int v from public.sensitive_change_audit where affiliate_id=$1 and resource='affiliate_documents' and target_id=$2 and action='ADMIN_UPLOAD'",[fresh,receipt.document.id]),1);
   return {documents:1,assets:1,objects:1,registrationAuditEvents:1,additionalUploadRequests:0};
  });
  await check('after','Both ordinary users read only their own documents through RLS, self RPC and authenticated Storage',async()=>{
   const deniedStatuses=[];
   for(const subject of [{auth:ownerAuth,id:old,other:fresh,count:5},{auth:newAuth,id:fresh,other:old,count:1}]){
    await as(subject.auth);
    assert.equal(await value('select public.get_effective_affiliate_id() v'),subject.id);
    assert.equal(await value("select public.has_admin_permission('documents.read') v"),false);
    const rows=await q('select id,affiliate_id from public.affiliate_documents order by id');
    assert.equal(rows.length,subject.count);assert(rows.every(row=>row.affiliate_id===subject.id));
    assert.equal((await q('select id from public.affiliate_documents where affiliate_id=$1',[subject.other])).length,0);
    assert.equal((await q('select id from public.private_assets where owner_affiliate_id=$1',[subject.other])).length,0);
    const listed=await q("select * from public.list_effective_affiliate_documents('SELF_SERVICE_EXPEDIENTE')");
    assert.equal(listed.length,subject.count);
    assert(listed.every(row=>row.affiliate_id===subject.id&&row.available===true));
    if(subject.id===fresh){
     assert.equal(listed[0].document_id,receipt.document.id);
     assert.equal(hash(await get(newAuth,objectPath)),hash(bytes));
     for(const item of priorObjects)deniedStatuses.push(await denyGet(newAuth,item.storage_path));
    }else{
     assert(listed.every(row=>row.document_id!==receipt.document.id));
     for(const item of priorObjects)assert.equal(hash(await get(ownerAuth,item.storage_path)),item.content_sha256.toLowerCase());
     deniedStatuses.push(await denyGet(ownerAuth,objectPath));
    }
    await assert.rejects(()=>value('select public.get_admin_affiliate_workbench($1) v',[subject.other]),error=>error.code==='42501');
   }
   return {subjects:2,foreignObjectReadsDenied:deniedStatuses.length,deniedHTTPStatuses:[...new Set(deniedStatuses)].sort(),selfRPC:true,rls:true};
  });
  await check('after','Original five object bytes and asset metadata remain unchanged after registration and retry',async()=>{
   await admin();assert.deepEqual(await oldAssets(),priorObjects);
   for(const item of priorObjects){
    const fetched=await get(ownerAuth,item.storage_path);
    assert.equal(fetched.length,Number(item.file_size));
    assert.equal(hash(fetched),item.content_sha256.toLowerCase());
   }
   return {originalObjectsVerified:5,originalMetadataUnchanged:true};
  });
  return {status:'PASS',originalObjectsVerified:5,newObjects:1,registrationRetries:1,
   isolationSubjects:2,goTrue:false,postgrestHTTP:false,
   limitations:['Synthetic Auth principals and JWTs; no GoTrue login or token refresh.','RPC transport is PostgreSQL SET ROLE with claims; no PostgREST HTTP or browser flow.','Uses register_admin_affiliate_document directly; does not certify the Edge/TUS upload pipeline.']};
 }finally{await as(actor);}
};
