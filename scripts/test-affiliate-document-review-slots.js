'use strict';
// Synthetic identities/objects exclusively in in-memory PostgreSQL. Never live DML.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),{PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const cat=JSON.parse(fs.readFileSync(path.join(root,'scripts/fixtures/affiliate-document-retirement-schema.json'),'utf8'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const checks=[];
async function main(){
 const db=new PGlite(),q=async(s,p=[])=>(await db.query(s,p)).rows,scalar=async(s,p=[])=>(await q(s,p))[0]?.v;
 const test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const owner=()=>db.exec('reset role');
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



 await db.exec(migration);
 const live=JSON.parse(read('scripts/fixtures/affiliate-document-review-slots-schema.json'));
 for(const f of live.functions)await db.exec(f.definition);
 for(const f of live.capturedFunctions)await db.exec(f.definition);
 for(const t of live.triggers){await db.exec(t.function);if(!await scalar('select count(*)::int v from pg_trigger where tgrelid=$1::regclass and tgname=$2',['public.'+t.table,t.name]))await db.exec(t.definition);}
 for(const i of live.indexes)if(!await scalar('select count(*)::int v from pg_indexes where schemaname=$1 and indexname=$2',['public',i.indexname]))await db.exec(i.indexdef);
 const fixMigration=read('supabase/migrations/20261105000200_affiliate_document_review_slots.sql'),fixRecovery=read('supabase/recovery/20261105000200_affiliate_document_review_slots.sql');
 const indexDef=live.indexes.find(i=>i.indexname==='affiliate_documents_current_review_idx').indexdef;
 const snapshot=async()=>{const result={};for(const t of ['public.affiliate_documents','public.affiliate_files','public.private_assets','public.sensitive_change_audit','document_retirement_private.documents','document_retirement_private.operations','document_retirement_private.assets'])result[t]=await scalar('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),\'[]\'::jsonb) v from '+t+' t');return result;};
 const fnSnapshot=async()=>q("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl,p.proowner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','document_retirement_private','document_isolation_private') and p.prokind='f' and p.proname<>'sync_review_slots' order by 1");
 const login=async(aff=1,write=true)=>{await owner();await q("select set_config('test.uid',$1,false),set_config('test.affiliate',$2,false),set_config('test.visible','true',false),set_config('test.permissions',$3,false),set_config('test.role','authenticated',false)",[id(aff===1?90:91),id(aff),JSON.stringify(write?['affiliates.read','documents.write','documents.read']:['affiliates.read'])]);await db.exec('set role authenticated');};
 let seq=400,op=2000,typeSeq=100;const hash='A'.repeat(64),reproduced=[],matrix=[];
 const addType=async()=>{await owner();const n=++typeSeq;await q("insert into document_types(id,code,label,accepted_mime_types,required_by_default,sort_order) values($1,$2,$3,array['image/png','image/jpeg','application/pdf'],false,$4)",[id(n),'case_'+n,'Synthetic '+n,n]);return n;};
 const putObject=async(mime,aff=1)=>{const file='affiliate-documents/'+id(aff)+'/'+id(++seq)+(mime==='application/pdf'?'.pdf':mime==='image/jpeg'?'.jpg':'.png');await owner();await q("insert into storage.objects(id,bucket_id,name,owner_id,metadata) values($1,'private-assets',$2,$3,$4)",[id(seq),file,id(aff===1?90:91),{size:100,mimetype:mime}]);return file;};
 const upload=async(type,mime='image/png',mode='admin',aff=1)=>{const file=await putObject(mime,aff);await login(aff);const doc=mode==='self'?await scalar('select to_jsonb(register_affiliate_document($1,$2,$3,100,$4,$5)) v',[id(type),file,mime,hash,'FILE']):(await scalar('select register_admin_affiliate_document($1,$2,$3,$4,100,$5,$6) v',[id(aff),id(type),file,mime,hash,'Synthetic upload'])).document;return {...doc,test_storage_path:file};};
 const status=async(doc,value)=>{await owner();await q("update affiliate_documents set status=$1,reviewed_by_auth_user_id=case when $1 in('PENDING_REVIEW','UNDER_REVIEW') then null else $2::uuid end,reviewed_at=case when $1 in('PENDING_REVIEW','UNDER_REVIEW') then null else now() end where id=$3",[value,id(90),doc.id]);};
 const retire=async(doc)=>{await login();const report=await scalar('select preview_admin_affiliate_document_delete($1,$2) v',[id(1),doc.id]);assert.equal(report.blocked,false);return scalar('select prepare_admin_affiliate_document_delete($1,$2,$3,$4,$5) v',[id(1),doc.id,report.fingerprint,'Synthetic metadata only',id(++op)]);};
 const row=async doc=>{await owner();return scalar('select to_jsonb(d) v from affiliate_documents d where id=$1',[doc.id]);};
 const parity=async()=>{await owner();assert.equal(await scalar("select count(*)::int v from ((select id,affiliate_id,document_type_id from affiliate_documents d where status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id) except select document_id,affiliate_id,document_type_id from document_retirement_private.review_slots) union all (select document_id,affiliate_id,document_type_id from document_retirement_private.review_slots except select id,affiliate_id,document_type_id from affiliate_documents d where status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id))) mismatch"),0);};
 await test('all17 live indexes,9 live triggers and captured writer definitions match before reproduction',async()=>{
  assert.equal(await scalar("select count(*)::int v from pg_indexes where schemaname='public' and tablename in('private_assets','affiliate_documents','affiliate_files')"),live.indexes.length);
  assert.equal(await scalar("select count(*)::int v from pg_trigger where not tgisinternal and tgrelid in('public.private_assets'::regclass,'public.affiliate_documents'::regclass,'public.affiliate_files'::regclass)"),live.triggers.length);

  for(const i of live.indexes)assert.equal(await scalar('select pg_get_indexdef($1::regclass) v',['public.'+i.indexname]),i.indexdef,i.indexname+' exact definition');
  for(const t of live.triggers){const actual=(await q('select pg_get_triggerdef(oid) definition,pg_get_functiondef(tgfoid) function from pg_trigger where tgrelid=$1::regclass and tgname=$2',['public.'+t.table,t.name]))[0];assert.equal(actual.definition,t.definition,t.name+' exact definition');assert.equal(actual.function,t.function,t.name+' exact function');}
  for(const f of live.capturedFunctions)assert.equal(await scalar('select md5(pg_get_functiondef($1::regprocedure)) v',[f.signature]),f.md5,f.proname);
 });
 await test('original failure reproduced for admin/self image/PDF after retired pending',async()=>{
  for(const mode of ['admin','self'])for(const mime of ['image/png','application/pdf']){
   const type=await addType(),a=await upload(type,mime,mode),b=await upload(type,mime,mode);assert.equal(b.replaces_document_id,a.id);await retire(b);const before=await row(b);let failure;
   await assert.rejects(upload(type,mime,mode),e=>{failure={code:e.code,constraint:e.constraint};return e.code==='23505'&&e.constraint==='affiliate_documents_current_review_idx';});assert.deepEqual(await row(b),before);reproduced.push({mode,mime,type,document:b.id,newUpload:'PASS',normalReplacement:'PASS',afterRetiredPending:failure});
  }
 });
 const seed=[];for(const state of ['PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED','VERIFIED']){const type=await addType(),doc=await upload(type);await status(doc,state);seed.push({type,doc,state});}
 await test('migration fails closed when exact old index is absent',async()=>{
  await owner();await db.exec('alter index affiliate_documents_current_review_idx rename to fixture_old_index');await assert.rejects(db.exec(fixMigration),/INDEX_BASE_DRIFT/);await db.exec('rollback');assert.equal(await scalar("select to_regclass('document_retirement_private.review_slots')::text v"),null);await db.exec('alter index fixture_old_index rename to affiliate_documents_current_review_idx');
 });
 const beforeInstall=await snapshot(),functionsBefore=await fnSnapshot();
 await test('atomic install backfills only active review states and preserves all history and original functions',async()=>{
  await db.exec(fixMigration);assert.deepEqual(await snapshot(),beforeInstall);assert.deepEqual(await fnSnapshot(),functionsBefore);await parity();assert.equal(await scalar('select count(*)::int v from document_retirement_private.review_slots'),3);assert.equal(await scalar("select to_regclass('public.affiliate_documents_current_review_idx')::text v"),null);
 });

 await test('recovery refuses a later function or trigger revision',async()=>{
  const definition=await scalar("select pg_get_functiondef('document_retirement_private.sync_review_slots()'::regprocedure) v");await db.exec(definition.replace('Serialize retirement changes','Changed retirement comment'));await assert.rejects(db.exec(fixRecovery),/RECOVERY_FUNCTION_DRIFT/);await db.exec('rollback');await db.exec(definition);
  await db.exec('alter trigger affiliate_documents_sync_review_slots on public.affiliate_documents rename to fixture_changed_trigger');await assert.rejects(db.exec(fixRecovery),/RECOVERY_TRIGGER_DRIFT/);await db.exec('rollback');await db.exec('alter trigger fixture_changed_trigger on public.affiliate_documents rename to affiliate_documents_sync_review_slots');await parity();
 });
 await test('recovery exactly restores old index before overlapping historical slots exist',async()=>{
  await db.exec(fixRecovery);assert.equal(await scalar("select pg_get_indexdef('public.affiliate_documents_current_review_idx'::regclass) v"),indexDef);assert.deepEqual(await snapshot(),beforeInstall);assert.deepEqual(await fnSnapshot(),functionsBefore);await db.exec(fixMigration);await parity();
 });
 await test('forcedRLS and no API grants protect the derived index and trigger function',async()=>{
  assert.deepEqual(await q("select relrowsecurity,relforcerowsecurity from pg_class where oid='document_retirement_private.review_slots'::regclass"),[{relrowsecurity:true,relforcerowsecurity:true}]);
  for(const role of ['anon','authenticated','service_role']){for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(await scalar('select has_table_privilege($1,$2,$3) v',[role,'document_retirement_private.review_slots',privilege]),false);assert.equal(await scalar('select has_function_privilege($1,$2,$3) v',[role,'document_retirement_private.sync_review_slots()','EXECUTE']),false);await db.exec('set role '+role);await assert.rejects(q('select * from document_retirement_private.review_slots'),/permission denied/);await owner();}
 });
 await test('the four exact reproduced failures now save independent documents with retired rows unchanged',async()=>{
  for(const c of reproduced){const before=await row({id:c.document}),next=await upload(c.type,c.mime,c.mode);assert.equal(next.replaces_document_id,null);assert.deepEqual(await row({id:c.document}),before);assert.notEqual(next.private_asset_id,before.private_asset_id);}await parity();
 });
 await test('complete upload/replacement matrix: admin/self xPNG/JPEG/PDF x4 retired statuses',async()=>{
  for(const mode of ['admin','self'])for(const mime of ['image/png','image/jpeg','application/pdf'])for(const state of ['PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED','VERIFIED']){
   const type=await addType(),a=await upload(type,mime,mode);await status(a,state);const initial=await row(a),b=await upload(type,mime,mode);assert.equal(b.replaces_document_id,a.id);if(state==='VERIFIED')assert.deepEqual(await row(a),initial);await status(b,state);const preRetirement=await row(b);await retire(b);assert.deepEqual(await row(b),preRetirement);await owner();assert.equal(await scalar('select count(*)::int v from document_retirement_private.review_slots where document_id=$1',[b.id]),0);const after=await upload(type,mime,mode);assert.equal(after.replaces_document_id,null);assert.deepEqual(await row(b),preRetirement);assert.equal(new Set([a.private_asset_id,b.private_asset_id,after.private_asset_id]).size,3);matrix.push({mode,mime,retiredStatus:state,result:'PASS'});
  }await parity();
 });
 await test('same bytes remain isolated across affiliates, document types and profile photo histories',async()=>{
  const type=await addType(),a=await upload(type,'image/png','admin',1),b=await upload(type,'image/png','admin',2);assert.notEqual(a.private_asset_id,b.private_asset_id);
  let previous;for(const aff of [1,2,1]){const file=await putObject('image/jpeg',aff);await login(aff);const result=await scalar('select set_self_profile_photo($1,$2,100,$3) v',[file,'image/jpeg',hash]);if(aff===1&&previous){await owner();assert.equal(await scalar('select is_current_profile_photo v from affiliate_files where id=$1',[previous]),false);}if(aff===1)previous=result;}await parity();
 });
 await test('status transitions release/reacquire slots; reviewer-only edits do not rewrite derived rows',async()=>{
  const type=await addType(),d=await upload(type);await status(d,'REUPLOAD_REQUIRED');await owner();const xmin=await scalar('select xmin::text v from document_retirement_private.review_slots where document_id=$1',[d.id]);await q('update affiliate_documents set reviewed_by_auth_user_id=$1,reviewed_at=now(),review_observation=$2 where id=$3',[id(91),'Synthetic reviewer change',d.id]);assert.equal(await scalar('select xmin::text v from document_retirement_private.review_slots where document_id=$1',[d.id]),xmin);
  for(const state of ['UNDER_REVIEW','REUPLOAD_REQUIRED','VERIFIED','PENDING_REVIEW','REJECTED','UNDER_REVIEW']){await status(d,state);assert.equal(await scalar('select count(*)::int v from document_retirement_private.review_slots where document_id=$1',[d.id]),['VERIFIED','REJECTED'].includes(state)?0:1);}await parity();
 });
 await test('document type edits move reservation atomically and conflicting edits preserve both documents',async()=>{
  const first=await addType(),second=await addType(),a=await upload(first);await owner();await q('update affiliate_documents set document_type_id=$1 where id=$2',[id(second),a.id]);assert.equal(await scalar('select document_type_id v from document_retirement_private.review_slots where document_id=$1',[a.id]),id(second));const b=await upload(first);const prior=await row(a);await assert.rejects(q('update affiliate_documents set document_type_id=$1 where id=$2',[id(first),a.id]),e=>e.code==='23505'&&e.constraint==='affiliate_document_active_review_slot_unique');assert.deepEqual(await row(a),prior);await parity();
 });
 await test('direct duplicate pending insertion fails via real UNIQUE and preserves source document',async()=>{
  const type=await addType(),a=await upload(type),file=await putObject('image/png');await owner();const asset=await scalar("insert into private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256,owner_affiliate_id) values($1,'AFFILIATE_DOCUMENT','Synthetic','private-assets',$2,'image/png',100,$3,$4) returning id v",['duplicate_'+seq,file,hash,id(1)]);const before=await row(a);await assert.rejects(q("insert into affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id) values($1,$2,$3,'PENDING_REVIEW',$4)",[id(1),id(type),asset,id(90)]),e=>e.code==='23505'&&e.constraint==='affiliate_document_active_review_slot_unique');assert.deepEqual(await row(a),before);await parity();
 });
 await test('existing authorization and cross-owner asset denials remain unchanged',async()=>{
  const type=await addType(),file=await putObject('image/png');await login(1,false);await assert.rejects(scalar('select register_admin_affiliate_document($1,$2,$3,$4,100,$5,$6) v',[id(1),id(type),file,'image/png',hash,'Denied']),/WRITE_DENIED/);await owner();await q("select set_config('test.uid','',false),set_config('test.affiliate','',false)");await db.exec('set role anon');await assert.rejects(scalar('select to_jsonb(register_affiliate_document($1,$2,$3,100,$4,$5)) v',[id(type),file,'image/png',hash,'FILE']),/AFFILIATE_REQUIRED|permission denied/);await login(1);await assert.rejects(scalar('select to_jsonb(register_affiliate_document($1,$2,$3,100,$4,$5)) v',[id(type),'affiliate-documents/'+id(2)+'/other.png','image/png',hash,'FILE']),/INVALID_STORAGE_PATH/);await owner();const d=await upload(type);const other=await upload(type,'image/png','admin',2);await owner();await assert.rejects(q('update affiliate_documents set private_asset_id=$1 where id=$2',[other.private_asset_id,d.id]),/OWNER_MISMATCH/);await parity();
 });

 await test('retirement rollback restores the same reservation and every historical row',async()=>{
  const type=await addType(),d=await upload(type);await owner();const before=await snapshot(),slots=await q('select * from document_retirement_private.review_slots order by document_id');await db.exec('begin');await retire(d);await owner();assert.equal(await scalar('select count(*)::int v from document_retirement_private.review_slots where document_id=$1',[d.id]),0);await db.exec('rollback');assert.deepEqual(await snapshot(),before);assert.deepEqual(await q('select * from document_retirement_private.review_slots order by document_id'),slots);await parity();
 });
 await test('ordinary affiliate without documents.write may upload its own image and PDF',async()=>{
  for(const mime of ['image/png','application/pdf']){const type=await addType(),file=await putObject(mime);await login(1,false);await q("select set_config('test.permissions','[]',false),set_config('test.visible','false',false)");const d=await scalar('select to_jsonb(register_affiliate_document($1,$2,$3,100,$4,$5)) v',[id(type),file,mime,hash,'FILE']);assert.equal(d.affiliate_id,id(1));}await parity();
 });
 await test('verified-to-review conflict is atomic; existing active candidate remains reserved',async()=>{
  const type=await addType(),a=await upload(type);await status(a,'VERIFIED');const b=await upload(type),before=await row(a);await assert.rejects(status(a,'UNDER_REVIEW'),e=>e.code==='23505'&&e.constraint==='affiliate_document_active_review_slot_unique');assert.deepEqual(await row(a),before);assert.equal(await scalar('select document_id v from document_retirement_private.review_slots where affiliate_id=$1 and document_type_id=$2',[id(1),id(type)]),b.id);await parity();
 });
 await test('restoring retired metadata with a conflicting active slot fails without deleting history',async()=>{
  await owner();const c=reproduced[0],before=await snapshot(),slots=await q('select * from document_retirement_private.review_slots order by document_id');await assert.rejects(q('delete from document_retirement_private.documents where document_id=$1',[c.document]),e=>e.code==='23505'&&e.constraint==='affiliate_document_active_review_slot_unique');assert.deepEqual(await snapshot(),before);assert.deepEqual(await q('select * from document_retirement_private.review_slots order by document_id'),slots);await parity();
 });
 await test('exact-path upload retries keep one document and one reservation',async()=>{
  for(const mode of ['admin','self']){const type=await addType(),d=await upload(type,'image/png',mode);await login();const next=mode==='self'?await scalar('select to_jsonb(register_affiliate_document($1,$2,$3,100,$4,$5)) v',[id(type),d.test_storage_path,'image/png',hash,'FILE']):(await scalar('select register_admin_affiliate_document($1,$2,$3,$4,100,$5,$6) v',[id(1),id(type),d.test_storage_path,'image/png',hash,'Synthetic retry'])).document;assert.equal(next.id,d.id);}await parity();
 });
 await test('recovery refuses historical overlap without removing slots or altering documents',async()=>{
  await owner();const before=await snapshot(),slots=await q('select * from document_retirement_private.review_slots order by document_id');await assert.rejects(db.exec(fixRecovery),/RECOVERY_BLOCKED_BY_HISTORY/);await db.exec('rollback');assert.deepEqual(await snapshot(),before);assert.deepEqual(await q('select * from document_retirement_private.review_slots order by document_id'),slots);assert.deepEqual(await fnSnapshot(),functionsBefore);await parity();
 });
 await test('no stored object was deleted during any synthetic scenario',async()=>{await owner();assert.equal(await scalar('select count(*)::int v from storage.objects'),seq-400);});
 const crypto=require('crypto'),result={status:'PASS',engine:await scalar('select version() v'),checks,matrix,reproducedCases:reproduced.length,productionWrites:0,productionDeletions:0,storageObjectDeletions:0,syntheticInMemoryOnly:true,concurrency:'Single connection; real UNIQUE constraint verified, no multisession claim',baselineIndexes:live.indexes.length,baselineTriggers:live.triggers.length,existingFunctionsUnchanged:true,historicalDocumentsPreserved:true,migrationSha256:crypto.createHash('sha256').update(fixMigration).digest('hex'),recoverySha256:crypto.createHash('sha256').update(fixRecovery).digest('hex'),testSha256:crypto.createHash('sha256').update(read('scripts/test-affiliate-document-review-slots.js')).digest('hex')};
 const dest=path.join(root,'docs/qa/evidence/document-upload-regression');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'database.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(dest,'reproduction.json'),JSON.stringify({status:'REPRODUCED_BEFORE_FIX',productionWrites:0,productionDeletions:0,syntheticInMemoryOnly:true,indexes:live.indexes.length,triggers:live.triggers.length,cases:reproduced.map(({type,document,...c})=>c)},null,2)+'\n');console.log(JSON.stringify({status:result.status,checks:checks.length,matrix:matrix.length,migrationSha256:result.migrationSha256}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message,e.detail||'',e.where||'');process.exitCode=1;});
