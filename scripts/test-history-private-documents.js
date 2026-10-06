'use strict';
// Execute existing document integration suite, then the new permission/recovery matrix.
// All identities, records and operations exist exclusively in in-memory PostgreSQL.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict');
const filename=path.join(__dirname,'test-document-generation-core.js');
let source=fs.readFileSync(filename,'utf8');
const marker=" await test('recovery disables generation without deleting historical documents'";
assert.equal(source.split(marker).length,2);
source=source.replace(marker,`
 await test('history privacy denies affiliate LIST/ACCESS and forged admin while preserving savings/admin',async()=>{
  await db.exec('reset role');
  const metadata=()=>q("select oid,proowner,proacl,prosecdef,proconfig from pg_proc where oid='document_private.visible(document_private.records,boolean)'::regprocedure");
  const definition=()=>scalar("select replace(pg_get_functiondef('document_private.visible(document_private.records,boolean)'::regprocedure),chr(13),'') v");
  const original=await definition(),acl=await metadata(),rows=await q('select * from document_private.records order by id');
  await actor(uid);const savingsBefore=await call('LIST',{domain:'savings'});assert(savingsBefore.length>0);
  await db.exec('reset role');await db.exec(read('supabase/migrations/20261005000200_history_private_documents.sql'));
  const changed=await definition();assert.notEqual(changed,original);assert.deepEqual(await metadata(),acl);
  for(const id of [uid,other])for(const admin of [false,true]){
   await actor(id);assert.deepEqual(await call('LIST',{domain:'program',admin}),[]);
   await assert.rejects(call('ACCESS',{id:recordId,admin}),/ACCESS_DENIED/);
  }
  await actor(uid);assert.deepEqual(await call('LIST',{domain:'savings'}),savingsBefore);
  await actor(other,['program_requests.read']);assert((await call('LIST',{domain:'program',admin:true})).some(r=>r.id===recordId));
  assert.equal((await call('ACCESS',{id:recordId,admin:true})).id,recordId);
  assert.deepEqual(await call('LIST',{domain:'program',admin:false}),[]);
  await db.exec('reset role');await q("select set_config('test.module_denied','true',false)");await actor(other,['program_requests.read']);
  assert.deepEqual(await call('LIST',{domain:'program',admin:true}),[]);await assert.rejects(call('ACCESS',{id:recordId,admin:true}),/ACCESS_DENIED/);
  await db.exec('reset role');await q("select set_config('test.module_denied','false',false)");
  assert.deepEqual(await q('select * from document_private.records order by id'),rows);
  await db.exec(read('supabase/recovery/20261005000200_history_private_documents.sql'));assert.equal(await definition(),original);assert.deepEqual(await metadata(),acl);
  await db.exec(read('supabase/migrations/20261005000200_history_private_documents.sql'));assert.equal(await definition(),changed);
  await db.exec(read('supabase/recovery/20261005000200_history_private_documents.sql'));
 });
`+marker);
const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(__dirname);mod._compile(source,filename);
