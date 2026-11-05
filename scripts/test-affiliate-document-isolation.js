'use strict';
// Synthetic identities/objects exclusively in in-memory PostgreSQL. Never live DML.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),{PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const cat=JSON.parse(fs.readFileSync(path.join(root,'scripts/fixtures/affiliate-document-retirement-schema.json'),'utf8'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const out=path.join(root,'docs/qa/evidence/document-isolation');
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

 await db.exec(read('supabase/migrations/20261104000400_affiliate_document_retirement.sql'));
 const current=JSON.parse(read('scripts/fixtures/affiliate-document-isolation-schema.json').replace(/^\uFEFF/,''));
 await db.exec("create function public.get_impersonation_context() returns setof jsonb language sql as $$select null::jsonb where false$$;create function extensions.digest(text,text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;");
 await db.exec("create or replace function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;");
 for(const f of current.functions.filter(f=>['register_admin_affiliate_document','register_affiliate_document','set_self_profile_photo'].includes(f.name)))await db.exec(f.definition);
 const migration=read('supabase/migrations/20261105000100_affiliate_document_isolation.sql').replace(/^\uFEFF/,''),recovery=read('supabase/recovery/20261105000100_affiliate_document_isolation.sql').replace(/^\uFEFF/,'');
 await q('insert into auth.users values($1)',[id(91)]);
 await q('insert into affiliates(id,numero_control,full_name,auth_user_id) values($1,$2,$3,$4),($5,$6,$7,$8)',[id(1),'001','Synthetic A',id(90),id(2),'002','Synthetic B',id(91)]);
 await q("insert into document_types(id,code,label,accepted_mime_types,required_by_default,sort_order) values($1,'photo','Synthetic photo',array['image/png','image/jpeg','application/pdf'],true,1),($2,'other','Other document',array['image/png','image/jpeg','application/pdf'],false,2)",[id(10),id(11)]);

 await q("insert into document_types(id,code,label,accepted_mime_types,required_by_default,sort_order) values($1,'legacy','Historical fixture',array['image/png'],false,3)",[id(12)]);
 await q("insert into private_assets(id,asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256) values($1,'shared-historical','HISTORICAL_FILE','Historical fixture','private-assets','historical/shared.png','image/png',100,$2)",[id(950),'B'.repeat(64)]);
 await q("insert into affiliate_files(id,affiliate_id,numero_control,private_asset_id,classification,file_key,file_type,source_column,source_column_letter,title,storage_bucket,storage_path,mime_type,sha256,file_size,source_url,source_row_ordinal,source_file_hash,expediente_classification) values($1,$2,'001',$3,'PRIVATE','legacy','image','Photo','DK','Historical fixture','private-assets','historical/shared.png','image/png',$4,100,'historical-source',1,$4,'CURRENT_DOCUMENT')",[id(953),id(1),id(950),'B'.repeat(64)]);
 await q("insert into affiliate_documents(id,affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id) values($1,$2,$3,$4,'PENDING_REVIEW',$5),($6,$7,$3,$4,'PENDING_REVIEW',$5)",[id(951),id(1),id(12),id(950),id(90),id(952),id(2)]);
 await q("insert into affiliate_documents(id,affiliate_id,document_type_id,affiliate_file_id,status,created_by_auth_user_id) values($1,$2,$3,$4,'PENDING_REVIEW',$5)",[id(954),id(1),id(12),id(953),id(90)]);

 await test('empty migration recovery preserves exact three upload definitions',async()=>{
  await db.exec(migration);await db.exec(recovery);
  for(const f of current.functions.filter(f=>['register_admin_affiliate_document','register_affiliate_document','set_self_profile_photo'].includes(f.name)))assert.equal(await scalar('select md5(pg_get_functiondef($1::regprocedure)) v',[f.signature]),f.md5);
  await db.exec(migration);
 });
 const login=async(aff=1,write=true)=>{await owner();await q("select set_config('test.uid',$1,false),set_config('test.affiliate',$2,false),set_config('test.visible','true',false),set_config('test.permissions',$3,false),set_config('test.role','authenticated',false)",[id(aff===1?90:91),id(aff),JSON.stringify(write?['affiliates.read','documents.write','documents.read']:['affiliates.read'])]);await db.exec('set role authenticated');};
 let seq=400;const hash='A'.repeat(64);
 const upload=async(aff=1,type=10,mime='image/png',mode='admin')=>{
  const file='affiliate-documents/'+id(aff)+'/'+id(++seq)+(mime==='application/pdf'?'.pdf':mime==='image/jpeg'?'.jpg':'.png');
  await owner();await q("insert into storage.objects(id,bucket_id,name,owner_id,metadata) values($1,'private-assets',$2,$3,$4)",[id(seq),file,id(aff===1?90:91),{size:100,mimetype:mime}]);await login(aff);
  const result=mode==='profile'?await scalar('select set_self_profile_photo($1,$2,100,$3) v',[file,mime,hash])
   :mode==='self'?await scalar('select to_jsonb(register_affiliate_document($1,$2,$3,100,$4,$5)) v',[id(type),file,mime,hash,'FILE'])
   :(await scalar('select register_admin_affiliate_document($1,$2,$3,$4,100,$5,$6) v',[id(aff),id(type),file,mime,hash,'Synthetic upload'])).document;
  return {file,result};
 };
 let a,b,a2,c,pdfA,pdfB,photoA,photoB;
 await test('identical image uploads in two affiliates use distinct assets and paths',async()=>{
  a=await upload(1);b=await upload(2);assert.notEqual(a.result.private_asset_id,b.result.private_asset_id);await owner();
  const rows=await q('select owner_affiliate_id,storage_path,content_sha256 from private_assets where owner_affiliate_id is not null order by owner_affiliate_id');assert.equal(rows.length,2);assert.equal(rows[0].content_sha256,rows[1].content_sha256);assert.notEqual(rows[0].storage_path,rows[1].storage_path);
 });
 await test('same affiliate different document and replacement also get independent files',async()=>{
  c=await upload(1,11);a2=await upload(1);assert.equal(a2.result.replaces_document_id,a.result.id);assert.equal(new Set([a.result.private_asset_id,a2.result.private_asset_id,c.result.private_asset_id]).size,3);
 });
 await test('admin retry of the same stored upload is idempotent',async()=>{
  const r=await scalar('select register_admin_affiliate_document($1,$2,$3,$4,100,$5,$6) v',[id(1),id(10),a2.file,'image/png',hash,'Synthetic retry']);
  assert.equal(r.document.id,a2.result.id);assert.equal(r.cleanup_storage_path,null);
 });
 await test('PDF self uploads and exact-path retries retain separate ownership',async()=>{
  pdfA=await upload(1,11,'application/pdf','self');pdfB=await upload(2,11,'application/pdf','self');assert.notEqual(pdfA.result.private_asset_id,pdfB.result.private_asset_id);
  const r=await scalar('select to_jsonb(register_affiliate_document($1,$2,$3,100,$4,$5)) v',[id(11),pdfB.file,'application/pdf',hash,'FILE']);assert.equal(r.id,pdfB.result.id);
 });
 await test('profile photo edits accept identical bytes across affiliates without sharing',async()=>{
  photoA=await upload(1,10,'image/jpeg','profile');photoB=await upload(2,10,'image/jpeg','profile');await owner();
  const rows=await q('select private_asset_id,affiliate_id,is_current_profile_photo from affiliate_files where id=any($1)',[[photoA.result,photoB.result]]);assert.equal(rows.length,2);assert.notEqual(rows[0].private_asset_id,rows[1].private_asset_id);assert(rows.every(r=>r.is_current_profile_photo));
 });
 await test('profile replacement preserves previous file and retry returns current one',async()=>{
  const next=await upload(1,10,'image/jpeg','profile');assert.notEqual(next.result,photoA.result);
  assert.equal(await scalar('select set_self_profile_photo($1,$2,100,$3) v',[next.file,'image/jpeg',hash]),next.result);
  await owner();assert.equal(await scalar('select is_current_profile_photo v from affiliate_files where id=$1',[photoA.result]),false);
 });
 await test('backend blocks forged cross-owner and reused same-owner asset references',async()=>{
  await owner();await assert.rejects(q('update affiliate_documents set private_asset_id=$1 where id=$2',[b.result.private_asset_id,a2.result.id]),/OWNER_MISMATCH/);
  await assert.rejects(q('update affiliate_documents set private_asset_id=$1 where id=$2',[c.result.private_asset_id,a2.result.id]),/ALREADY_LINKED/);
  await assert.rejects(q('update private_assets set owner_affiliate_id=$1 where id=$2',[id(2),a2.result.private_asset_id]),/OWNER_IMMUTABLE|owned_path/);
 });
 await test('existing upload permissions and path authorization remain enforced',async()=>{
  await login(1,false);await assert.rejects(scalar('select register_admin_affiliate_document($1,$2,$3,$4,100,$5,$6) v',[id(1),id(10),a2.file,'image/png',hash,'Denied']),/WRITE_DENIED/);
  await login(1);await assert.rejects(scalar('select to_jsonb(register_affiliate_document($1,$2,$3,100,$4,$5)) v',[id(10),b.file,'image/png',hash,'FILE']),/INVALID_STORAGE_PATH/);
  await db.exec('reset role');await q("select set_config('test.uid','',false),set_config('test.permissions','[]',false)");await db.exec('set role anon');
  await assert.rejects(scalar('select set_self_profile_photo($1,$2,100,$3) v',[photoA.file,'image/jpeg',hash]),/SELF_ONLY|permission denied/);
 });
 await test('deleting one image and its predecessors leaves identical image of another affiliate intact',async()=>{
  await login(1);const preview=await scalar('select preview_admin_affiliate_document_delete($1,$2) v',[id(1),a2.result.id]);assert.equal(preview.blocked,false);assert.equal(preview.documents.length,2);
  const r=await scalar('select prepare_admin_affiliate_document_delete($1,$2,$3,$4,$5) v',[id(1),a2.result.id,preview.fingerprint,'Remove wrong photo',id(800)]);assert.equal(r.status,'PENDING_STORAGE');
  await owner();assert.equal(await scalar('select status v from private_assets where id=$1',[b.result.private_asset_id]),'READY');assert.equal(await scalar('select content_sha256 v from private_assets where id=$1',[b.result.private_asset_id]),hash);
  assert.equal(await scalar('select count(*)::int v from document_retirement_private.documents where document_id=$1',[b.result.id]),0);
 });

 await test('historical separation checks snapshots, copies, hashes and audit atomically; retry is idempotent',async()=>{
  await owner();const {switchSQL}=require('./affiliate-document-isolation-core');
  const source=await scalar('select to_jsonb(p) v from private_assets p where id=$1',[id(950)]);
  const items=[];
  for(const [kind,unit,aff,newId]of [['document',951,1,961],['document',952,2,962],['file',953,1,963]]){
   const docs=await scalar("select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) v from affiliate_documents d where "+(kind==='file'?'affiliate_file_id':'id')+'=$1',[id(unit)]);
   const file=kind==='file'?await scalar('select to_jsonb(f) v from affiliate_files f where id=$1',[id(unit)]):null;
   const newPath='affiliate-documents/'+id(aff)+'/'+id(newId)+'.png';
   await q("insert into storage.objects(id,bucket_id,name,metadata) values($1,'private-assets',$2,$3)",[id(newId),newPath,{size:100,mimetype:'image/png'}]);
   items.push({unit_kind:kind,unit_id:id(unit),affiliate_id:id(aff),source_asset:source,before_file:file,before_documents:docs,new_asset_id:id(newId),new_path:newPath,verified_sha256:source.content_sha256});
  }
  const plan={id:id(970),actorAuthUserId:id(90)};
  const wrong=JSON.parse(JSON.stringify(items));wrong[0].verified_sha256='C'.repeat(64);
  await assert.rejects(db.exec(switchSQL(plan,wrong)),/CONTENT_NOT_VERIFIED/);await db.exec('rollback');
  assert.equal(await scalar('select count(*)::int v from document_isolation_private.items'),0);
  const stale=JSON.parse(JSON.stringify(items));stale[0].before_documents[0].status='VERIFIED';
  await assert.rejects(db.exec(switchSQL(plan,stale)),/DOCUMENT_CHANGED/);await db.exec('rollback');
  await db.exec(switchSQL(plan,items));await db.exec(switchSQL(plan,items));
  assert.equal(await scalar('select count(*)::int v from document_isolation_private.items'),3);
  assert.equal(await scalar("select count(*)::int v from sensitive_change_audit where action='DOCUMENT_ASSET_ISOLATED'"),3);
  assert.deepEqual(await scalar('select to_jsonb(p) v from private_assets p where id=$1',[id(950)]),source);
  assert.equal(await scalar('select private_asset_id v from affiliate_files where id=$1',[id(953)]),id(963));
  assert.equal(await scalar('select private_asset_id v from affiliate_documents where id=$1',[id(954)]),null);
  await login(2);const preview=await scalar('select preview_admin_affiliate_document_delete($1,$2) v',[id(2),id(952)]);assert.equal(preview.blocked,false);
  await scalar('select prepare_admin_affiliate_document_delete($1,$2,$3,$4,$5) v',[id(2),id(952),preview.fingerprint,'Synthetic isolated removal',id(980)]);
  await owner();assert.equal(await scalar('select status v from private_assets where id=$1',[id(961)]),'READY');assert.equal(await scalar('select status v from private_assets where id=$1',[id(963)]),'READY');
 });

 await test('recovery refuses to re-share files after isolated history exists',async()=>{
  await owner();await assert.rejects(db.exec(recovery),/RECOVERY_BLOCKED/);await db.exec('rollback');
 });
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'database.json'),JSON.stringify({status:'PASS',checks,productionWrites:0,capturedLiveDefinitions:true,migrationSha256:require('crypto').createHash('sha256').update(migration).digest('hex'),coreSha256:require('crypto').createHash('sha256').update(read('scripts/affiliate-document-isolation-core.js')).digest('hex')},null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message,e.detail||'',e.where||'');process.exitCode=1;});
