'use strict';
// Synthetic identities/objects exclusively in in-memory PostgreSQL. Never live DML.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),{PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const cat=JSON.parse(fs.readFileSync(path.join(root,'scripts/fixtures/affiliate-document-retirement-schema.json'),'utf8'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const out=path.join(root,'docs/qa/evidence/affiliate-document-retirement');
const checks=[];
async function main(){
 const db=new PGlite(),q=async(s,p=[])=>(await db.query(s,p)).rows,scalar=async(s,p=[])=>(await q(s,p))[0]?.v;
 const test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const actor=async(visible=true,permissions=['affiliates.read'])=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.visible',$2,false),set_config('test.permissions',$3,false),set_config('test.role','authenticated',false)",[id(90),String(visible),JSON.stringify(permissions)]);await db.exec('set role authenticated');};
 const owner=()=>db.exec('reset role');
 const preview=(aff,doc)=>scalar('select preview_admin_affiliate_document_delete($1,$2) v',[id(aff),id(doc)]);
 const prepare=(doc,report,op=100,aff=1,reason='Archivo de otro afiliado')=>scalar('select prepare_admin_affiliate_document_delete($1,$2,$3,$4,$5) v',[id(aff),id(doc),report.fingerprint,reason,id(op)]);
 const tables=new Map();for(const c of cat.columns){const key=c.schema+'.'+c.table;if(!tables.has(key))tables.set(key,[]);tables.get(key).push(c);}
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;create schema extensions;create schema admin_support_private;
 create type storage.buckettype as enum ('STANDARD','ANALYTICS','VECTOR');
 create table auth.users(id uuid primary key);insert into auth.users values('${id(90)}');
 create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
 create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select '${id(1)}'::uuid$$;
 create function public.has_admin_permission(text) returns boolean language sql stable as $$select coalesce(current_setting('test.permissions',true),'[]')::jsonb ? $1$$;
 create function admin_support_private.module_visible(uuid,text) returns boolean language sql stable as $$select $1=auth.uid() and $2='affiliates' and current_setting('test.visible',true)='true'$$;
 grant usage on schema auth,storage to authenticated,anon,service_role;`);
 const critical=new Set(['affiliate_documents','private_assets','affiliate_files','document_types','sensitive_change_audit']);
 for(const [key,cols]of tables){const defs=cols.map(c=>'"'+c.name+'" '+c.type+(critical.has(c.table)&&c.default?' default '+c.default:'')+(critical.has(c.table)&&c.not_null?' not null':''));await db.exec('create table '+key+'('+defs.join(',')+');');}
 for(const c of cat.constraints.filter(c=>['p','u'].includes(c.type)||(c.type==='c'&&critical.has(c.table))))await db.exec('alter table '+c.schema+'.'+c.table+' add constraint "'+c.name+'" '+c.definition+';');
 for(const c of cat.constraints.filter(c=>c.type==='f'&&['affiliate_documents','private_assets','affiliate_files'].includes(c.table))){if(/REFERENCES (?:public\.)?(affiliates|private_assets|affiliate_files|affiliate_documents|document_types)\(/.test(c.definition)||/REFERENCES auth.users/.test(c.definition))await db.exec('alter table public.'+c.table+' add constraint "'+c.name+'" '+c.definition+';');}
 await db.exec(`create table document_access_audit_log(access_id uuid default gen_random_uuid(),actor_auth_user_id uuid,effective_affiliate_id uuid,target_affiliate_id uuid,document_id uuid references affiliate_documents(id),action text,purpose text,context_mode text,impersonation_session_id uuid,access_context jsonb,created_at timestamptz default now());
 create table segmentation_catalog_entries(catalog_type text,code text,label text,enabled boolean,sort_order int);
 create table affiliate_profile_audit_log(id uuid,affiliate_id uuid,changed_at timestamptz,reason text,changed_by uuid,field_name text,old_value text,new_value text);
 create table program_requests(id uuid,affiliate_id uuid,folio text,program_id text,request_type text,status text,financial_processing_status text,created_at timestamptz,updated_at timestamptz);
 grant select on public.affiliate_documents,public.affiliate_files,public.private_assets,storage.objects to authenticated;
 alter table affiliate_documents enable row level security;alter table affiliate_files enable row level security;alter table private_assets enable row level security;alter table storage.objects enable row level security;
 create policy fixture_read on affiliate_documents for select to authenticated using(true);create policy fixture_read on affiliate_files for select to authenticated using(true);create policy fixture_read on private_assets for select to authenticated using(true);create policy fixture_read on storage.objects for select to authenticated using(true);`);
 const protectedFns=cat.functions.filter(f=>f.schema==='public'&&!['has_admin_permission','admin_module_boundary','has_admin_module'].includes(f.name));
 for(const f of protectedFns)await db.exec(f.definition);
 // Check the same captured function definitions before exercising migration gates.
 for(const f of protectedFns)assert.equal(await scalar('select md5(pg_get_functiondef($1::regprocedure)) v',[f.signature]),f.md5,f.name+' catalog parity');
 const migration=read('supabase/migrations/20261104000400_affiliate_document_retirement.sql'),recovery=read('supabase/recovery/20261104000400_affiliate_document_retirement.sql');
 await test('migration and empty recovery preserve original definitions',async()=>{
  await db.exec(migration);await db.exec(recovery);for(const f of protectedFns)assert.equal(await scalar('select md5(pg_get_functiondef($1::regprocedure)) v',[f.signature]),f.md5);await db.exec(migration);
 });
 await q('insert into affiliates(id,numero_control,full_name) values($1,$2,$3),($4,$5,$6)',[id(1),'001','Synthetic A',id(2),'002','Synthetic B']);
 await q("insert into document_types(id,code,label,accepted_mime_types,required_by_default,sort_order) values($1,'ine_front','Synthetic identity',array['image/png'],true,1),($2,'other','Other document',array['image/png'],false,2)",[id(10),id(11)]);
 const seed=async(doc,asset,type=10,aff=1,prior=null)=>{
  await owner();if(!await scalar('select exists(select 1 from private_assets where id=$1) v',[id(asset)])){
   await q("insert into private_assets(id,asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256) values($1,$2,'AFFILIATE_DOCUMENT','Synthetic','private-assets',$3,'image/png',100,$4)",[id(asset),'fixture-'+asset,'affiliate-documents/'+id(aff)+'/'+asset+'.png',String(asset).padStart(64,'A')]);
   await q("insert into storage.objects(id,bucket_id,name,owner_id) values($1,'private-assets',$2,$3)",[id(asset),'affiliate-documents/'+id(aff)+'/'+asset+'.png',id(90)]);
  }
  await q("insert into affiliate_documents(id,affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id,created_at) values($1,$2,$3,$4,'PENDING_REVIEW',$5,$6,$7)",[id(doc),id(aff),id(type),id(asset),id(90),prior?id(prior):null,new Date(Date.UTC(2026,0,1,0,0,doc)).toISOString()]);
 };
 await seed(21,31);await seed(22,32,10,1,21);await seed(23,33,11);await seed(24,34,10,2);
 const originalOther=await q('select * from affiliate_documents where id in ($1,$2) order by id',[id(23),id(24)]);
 let report;
 await test('screen access alone permits action; role/write/document capabilities unnecessary',async()=>{await actor();report=await preview(1,22);assert.equal(report.blocked,false);assert.deepEqual(report.documents.map(d=>d.id),[id(22),id(21)]);assert(!JSON.stringify(report).includes('storage_path'));});
 await test('no screen access, forged affiliate, missing reason and stale preview denied',async()=>{
  await actor(false,['affiliates.read','documents.write']);await assert.rejects(preview(1,22),/DENIED/);await assert.rejects(prepare(22,report),/DENIED/);
  await actor();await assert.rejects(preview(2,22),/MISMATCH/);await assert.rejects(prepare(22,report,100,2),/MISMATCH/);await assert.rejects(prepare(22,report,100,1,''),/REASON/);await assert.rejects(prepare(22,{fingerprint:'bad'}),/STALE/);
  await owner();await db.exec('set role anon');await assert.rejects(preview(1,22),/permission denied/);
 });
 await test('other document, affiliate, request and catalog references block without mutation',async()=>{
  await seed(25,32,11,2);await actor();assert.equal((await preview(1,22)).blocked,true);await assert.rejects(prepare(22,report),/SHARED_REFERENCE/);await owner();await q('delete from affiliate_documents where id=$1',[id(25)]);
  await q('insert into request_documents(id,affiliate_document_id) values($1,$2)',[id(201),id(21)]);await actor();assert.equal((await preview(1,22)).blocked,true);await owner();await q('delete from request_documents where id=$1',[id(201)]);
  await q("insert into program_catalog_item_assets(id,private_asset_id,item_id,source_column_letter,sort_order) values($1,$2,$1,'A',1)",[id(202),id(32)]);await actor();assert.equal((await preview(1,22)).blocked,true);await owner();await q('delete from program_catalog_item_assets where id=$1',[id(202)]);
 });
 await test('audit failure rolls back retirement atomically',async()=>{
  await owner();await db.exec("alter table sensitive_change_audit add constraint fixture_audit_failure check(action<>'ADMIN_DOCUMENT_DELETE');");await actor();await assert.rejects(prepare(22,report),/fixture_audit_failure/);await owner();assert.equal(await scalar('select count(*)::int v from document_retirement_private.operations'),0);await db.exec('alter table sensitive_change_audit drop constraint fixture_audit_failure');
 });
 await test('withdrawal covers exact ancestry, hides all readers, preserves neighbors and audit',async()=>{
  await actor();assert.equal((await prepare(22,report)).status,'PENDING_STORAGE');assert.equal((await prepare(22,report)).operation_id,id(100));await assert.rejects(prepare(22,report,100,1,'different valid reason'),/RETRY_MISMATCH/);
  assert.equal(await scalar('select count(*)::int v from affiliate_documents where id=any($1)',[[id(21),id(22)]]),0);
  assert.equal(await scalar('select count(*)::int v from private_assets where id=any($1)',[[id(31),id(32)]]),0);
  assert.equal(await scalar("select count(*)::int v from storage.objects where name like 'affiliate-documents/%' and id=any($1)",[[id(31),id(32)]]),0);
  const self=await q("select * from list_effective_affiliate_documents('SELF_SERVICE_EXPEDIENTE')");assert.deepEqual(self.map(d=>d.document_id),[id(23)]);
  await actor(true,['affiliates.read','documents.read','assets.read']);const admin=await q("select * from list_admin_affiliate_documents($1,'ADMIN_AFFILIATE_PROFILE')",[id(1)]);assert.deepEqual(admin.map(d=>d.document_id),[id(23)]);
  await assert.rejects(q("select * from authorize_admin_document_preview($1,$2,'ADMIN_AFFILIATE_PROFILE')",[id(22),id(1)]),/DENIED|MISSING/);
  await assert.rejects(q("select * from authorize_self_document_preview($1,'SELF_SERVICE_EXPEDIENTE')",[id(21)]),/DENIED|MISSING/);
  assert.deepEqual(await q('select * from get_affiliate_document_availability($1)',[[id(21),id(22)]]),[]);
  const detail=await scalar('select get_admin_affiliate_workbench($1) v',[id(1)]);assert.equal(detail.documents.length,1);assert.equal(detail.pending_document_deletions.length,1);assert(detail.audit.some(a=>a.action==='ADMIN_DOCUMENT_DELETE'&&a.reason==='Archivo de otro afiliado'));
  await owner();assert.deepEqual(await q('select * from affiliate_documents where id in ($1,$2) order by id',[id(23),id(24)]),originalOther);assert.equal(await scalar("select count(*)::int v from sensitive_change_audit where action='ADMIN_DOCUMENT_DELETE'"),1);assert.equal(await scalar('select count(*)::int v from document_retirement_private.documents'),2);
 });
 await test('review, direct links and new URLs cannot revive withdrawn objects',async()=>{
  await actor(true,['affiliates.read','documents.write']);await assert.rejects(q("select review_affiliate_document($1,'VERIFIED')",[id(22)]),/NOT_REVIEWABLE/);
  await owner();await assert.rejects(q('insert into request_documents(id,private_asset_id) values($1,$2)',[id(203),id(32)]),/RETIRED/);
  await assert.rejects(q('insert into savings_requests(id,supporting_document_id) values($1,$2)',[id(204),id(22)]),/RETIRED/);
  await assert.rejects(q("update affiliate_documents set review_observation='invalid' where id=$1",[id(22)]),/RETIRED/);
  await actor();await assert.rejects(q('select affiliate_document_delete_storage($1,$2,false)',[id(100),id(90)]),/permission denied/);
 });
 await test('new upload starts fresh; same bytes can be correctly associated without reviving old asset',async()=>{
  await owner();const hash=String(32).padStart(64,'A');await q("insert into storage.objects(id,bucket_id,name,owner_id) values($1,'private-assets',$2,$3)",[id(500),'affiliate-documents/'+id(1)+'/new.png',id(90)]);
  await actor(true,['affiliates.read','documents.write']);const fresh=await scalar('select register_admin_affiliate_document($1,$2,$3,$4,$5,$6,$7) v',[id(1),id(10),'affiliate-documents/'+id(1)+'/new.png','image/png',100,hash,'Correct owner']);assert.equal(fresh.document.replaces_document_id,null);assert.notEqual(fresh.document.private_asset_id,id(32));
 });
 await test('quarantine is retryable, old path disappears and recovery cannot restore retired history',async()=>{
  await actor();assert.equal((await scalar('select resume_admin_affiliate_document_delete($1,$2) v',[id(1),id(100)])).status,'PENDING_STORAGE');await assert.rejects(scalar('select resume_admin_affiliate_document_delete($1,$2) v',[id(2),id(100)]),/DENIED/);
  await owner();await q("select set_config('test.role','service_role',false)");await assert.rejects(scalar('select affiliate_document_delete_storage($1,$2,true) v',[id(100),id(90)]),/PENDING/);
  const plan=await scalar('select affiliate_document_delete_storage($1,$2,false) v',[id(100),id(90)]);for(const a of plan.assets)await q('update storage.objects set name=$1 where bucket_id=$2 and name=$3',[a.destination,a.bucket,a.source]);
  assert.equal((await scalar('select affiliate_document_delete_storage($1,$2,true) v',[id(100),id(90)])).status,'COMPLETE');await scalar('select affiliate_document_delete_storage($1,$2,true) v',[id(100),id(90)]);assert.equal(await scalar("select count(*)::int v from sensitive_change_audit where action='ADMIN_DOCUMENT_DELETE_COMPLETE'"),1);
  await actor(true,['assets.read','documents.read']);assert.equal(await scalar("select count(*)::int v from storage.objects where name like 'retired-documents/%'"),0);
  await owner();await assert.rejects(db.exec(recovery),/HISTORY_MUST_BE_PRESERVED/);await db.exec('rollback');
 });
 const {deleteDocument,validRequest}=await import(pathToFileURL(path.join(root,'supabase/functions/affiliate-document-delete/handler.mjs')));
 await test('Edge rejects forged payload and retries interrupted Storage without falsely completing',async()=>{
  const body={action:'DELETE',affiliate_id:id(1),document_id:id(22),operation_id:id(100),fingerprint:'a'.repeat(32),reason:'Synthetic deletion'};assert(validRequest(body));assert(!validRequest({...body,bucket:'other'}));
  const user={rpc:async()=>({data:{operation_id:id(100),status:'PENDING_STORAGE'}})};let fail=true,moved=false,finishes=0;
  const service={rpc:async(name,args)=>args.p_finish?(finishes++,{data:{operation_id:id(100),status:'COMPLETE'}}):{data:{assets:[{bucket:'private-assets',source:'old',destination:'retired',source_exists:!moved,destination_exists:moved}]}},storage:{from:()=>({move:async()=>{if(fail)return {error:{message:'interrupt'}};moved=true;return {};}})}};
  assert.equal((await deleteDocument(user,service,id(90),body)).status,202);assert.equal(finishes,0);fail=false;assert.equal((await deleteDocument(user,service,id(90),body)).status,200);assert(moved);assert.equal((await deleteDocument(user,service,id(90),{action:'RESUME',affiliate_id:id(1),operation_id:id(100)})).status,200);
  assert.equal((await deleteDocument({rpc:async()=>({error:{code:'42501',message:'denied'}})},service,id(90),body)).status,403);
 });
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'database-edge.json'),JSON.stringify({status:'PASS',checks,liveCatalogDefinitions:true,productionBusinessWrites:0},null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
