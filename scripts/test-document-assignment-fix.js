'use strict';
// Isolated PostgreSQL and PDF contract tests. No network, live identities or production writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
// SQL dollar-quoted baseline fragments must use PostgreSQL's normalized LF source.
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
function dependency(variable,relative){
 if(process.env[variable])return require(path.join(process.env[variable],relative));
 for(let folder=root;;folder=path.dirname(folder)){
  const candidate=path.join(folder,relative);if(fs.existsSync(candidate))return require(candidate);
  if(path.dirname(folder)===folder)throw Error('Set '+variable+' to the dependency root. Missing '+relative);
 }
}
const {PGlite}=dependency('SUTIAPP_TEST_ROOT','.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite');
const PDFLib=process.env.SUTIAPP_DOCUMENT_DEPS?require(path.join(process.env.SUTIAPP_DOCUMENT_DEPS,'node_modules/pdf-lib')):dependency('SUTIAPP_TEST_ROOT','.tmp/document-employee-category/node_modules/pdf-lib');
const checks=[],evidence=path.join(root,'docs/qa/evidence/document-assignment-fix/database-tests.json');
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
async function main(){
 const renderer=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/renderer.mjs')));
 const layouts=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/layout.mjs')));
 const {handleLayout}=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/layout-service.mjs')));
 const db=new PGlite(),q=async(sql,args=[])=>(await db.query(sql,args)).rows,scalar=async(sql,args=[])=>(await q(sql,args))[0]?.v;
 const rpc=(name,action,data={})=>scalar('select public.'+name+'($1,$2::jsonb) v',[action,JSON.stringify(data)]);
 const permissions=['config.read','templates.write','signers.write','signatures.write','signatures.read','config.write','read','retry'].map(p=>'document_generation.'+p);
 let principal=uid,granted=permissions;
 const asUser=async(fn)=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false)",[principal,JSON.stringify(granted)]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}};
 const call=(a,d)=>asUser(()=>rpc('document_generation_command',a,d));
 const contextCall=(a,d)=>asUser(()=>rpc('document_layout_context',a,d));
 const persist=async(a,d)=>{await db.exec('set role service_role');try{return await rpc('document_layout_persist',a,d);}finally{await db.exec('reset role');}};
 const worker=(a,d)=>rpc('document_generation_worker',a,d);
 const membership={program:'membership',document_type:'MEMBERSHIP_APPROVAL',fund_key:''};
 const exact=async(scope)=>(await q('select * from document_private.layout_activations where program=$1 and document_type=$2 and fund_key=$3 order by created_at desc,id desc limit 1',[scope.program,scope.document_type,scope.fund_key||'']))[0];
 const latestConfig=async(scope)=>(await q('select * from document_private.configurations where program=$1 and document_type=$2 order by created_at desc,id desc limit 1',[scope.program,scope.document_type]))[0];
 const resolve=scope=>scalar('select document_private.resolve_scoped_layout($1,$2,clock_timestamp(),$3::jsonb) v',[scope.program,scope.document_type,JSON.stringify(scope.document_type==='LOAN_APPROVAL'?{operation:{financial:{financialResult:{fund:scope.fund_key||'Fondo B'}}}}:{})]);
 const state=()=>q("select 'configurations' domain,to_jsonb(c) value from document_private.configurations c union all select 'layouts',to_jsonb(l) from document_private.layouts l union all select 'activations',to_jsonb(a) from document_private.layout_activations a union all select 'records',to_jsonb(r) from document_private.records r union all select 'audit',to_jsonb(a) from document_private.audit a order by domain,value");
 const outside=()=>q("select 'configurations' domain,to_jsonb(c) value from document_private.configurations c where program<>'membership' union all select 'layouts',to_jsonb(l) from document_private.layouts l where program<>'membership' union all select 'activations',to_jsonb(a) from document_private.layout_activations a where program<>'membership' union all select 'default',to_jsonb(d) from document_private.template_default d order by domain,value");
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema cron;create schema admin_support_private;
 create function admin_support_private.module_visible(uuid,text) returns boolean language sql as $$select exists(select 1 from (values ('requests','program_requests.read',array[]::text[])) modules(key,permission,section_keys) where key=$2)$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.has_admin_permission(p text) returns boolean language sql stable as $$select coalesce(current_setting('test.permissions',true),'[]')::jsonb ? p$$;
 create function public.admin_request_module_boundary(uuid) returns boolean language sql stable as $$select true$$;
 create function public.admin_module_boundary(text[]) returns boolean language sql stable as $$select true$$;
 create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select auth.uid()$$;
 create table admin_assignments(permissions text[],constraint admin_assignments_permissions_check check(permissions<@array['authorization.read'::text]));
 create table admin_roles(id uuid primary key,code text);insert into admin_roles values('${uid}','principal_admin');create table admin_role_permissions(role_id uuid,permission text);
 create table admin_section_definitions(section_key text primary key,display_name text,data_boundary text,allowed_actions text[],enforcement_status text,module_key text unique,module_read_permissions text[],module_write_permissions text[],module_sections text[],module_total_only boolean,module_order integer);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);
 create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;
 create table cron.job(jobid bigint,jobname text);create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job values(1,$1) returning jobid$$;create function cron.unschedule(bigint) returns boolean language sql as $$delete from cron.job where jobid=$1 returning true$$;
 create table affiliates(id uuid primary key,numero_control text,full_name text,financial_union_code text,financial_employee_category_code text,unit_raw text);
 insert into affiliates values('${uid}','00001','Persona sintética','TEST','TEST','Unidad de ejemplo'),('${other}','00002','Otra persona','TEST','TEST',null);
 create table program_catalog_items(program_key text);insert into program_catalog_items values('auto');
 create table program_requests(id uuid primary key,affiliate_id uuid,folio text,program_id text,membership_offering_id uuid,financial_approval_snapshot jsonb,financial_submission_snapshot jsonb,financial_profile_snapshot jsonb,terms_version_id uuid,terms_accepted boolean);
 create table program_request_admin_events(id uuid primary key,request_id uuid,actor_auth_user_id uuid,to_status text,from_status text,created_at timestamptz default now());
 create table loan_request_deposit_snapshots(request_id uuid,bank_name text,card_number text,clabe text,account_holder text);
 create table savings_audit_events(id bigint generated always as identity primary key,resource text,action text,after_data jsonb,usuario_contexto_affiliate_id uuid,actor_real_auth_user_id uuid,reason text);
 create table savings_requests(id uuid primary key,participant_id uuid);create table savings_participants(id uuid,affiliate_id uuid);
 create table savings_contribution_plans(enrollment_id uuid,source_request_id uuid,process_snapshot text,amount numeric,effective_from date,effective_to date);
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 alter table affiliates add column rfc_raw text,add column curp_raw text,add column phone_raw text,add column historical_email_raw text,add column address_raw text,add column city_raw text,add column employment_position_raw text,add column employment_area_raw text,add column employment_level_raw text,add column occupation_raw text,add column subdirectorate_raw text,add column employment_entry_date_raw text,add column institute_entry_date_raw text,add column union_position_raw text,add column union_enrollment_date_raw text;
 create table segmentation_catalog_entries(catalog_type text,code text,label text,enabled boolean);
 create table financial_funds(program_id text,name text,enabled boolean,publication_status text);
 insert into financial_funds values('prestamo','Fondo A',true,'PUBLISHED'),('prestamo','Fondo B',true,'PUBLISHED');`);
 for(const file of ['20260928000100_document_generation_core.sql','20260928000200_document_signer_assignment_order.sql','20260928000300_document_layout_designer.sql','20260928000400_document_layout_refinement.sql','20260928000500_document_deposit_authorization.sql'])await db.exec(read('supabase/migrations/'+file));
 const normalize=read('supabase/migrations/20260826000100_authenticated_loan_snapshot_quote_rpc.sql'),begin=normalize.indexOf('create function public.normalize_suti_financial_key(');assert(begin>=0);await db.exec(normalize.slice(begin,normalize.indexOf('$$;',begin)+3));
 await db.exec(read('supabase/migrations/20260929000200_document_layout_scopes.sql'));
 const pdf=await PDFLib.PDFDocument.create();pdf.addPage([612,792]);const templateBytes=await pdf.save(),assetBytes=new Map();
 const assets=[];for(const kind of ['TEMPLATE','TEMPLATE','TEMPLATE','SIGNATURE']){
  const assetPath='assets/'+crypto.randomUUID()+'.'+(kind==='TEMPLATE'?'pdf':'png');let bytes=templateBytes;
  if(kind==='TEMPLATE'){const background=await PDFLib.PDFDocument.create();background.addPage([612,792]).drawText(['OLD LETTERHEAD','SELECTED LETTERHEAD','THIRD LETTERHEAD'][assets.length],{x:40,y:760,size:14});bytes=await background.save();}
  assetBytes.set(assetPath,bytes);assets.push({...await worker('REGISTER_ASSET',{kind,mime:kind==='TEMPLATE'?'application/pdf':'image/png',path:assetPath,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size:bytes.length,dimensions:{width:612,height:792},actor:uid}),path:assetPath});
 }
 const makeTemplate=(asset,name)=>call('SAVE_TEMPLATE',{asset_id:asset.id,name,margins:{top:34,bottom:28,left:22,right:22},valid_from:'2020-01-01'});
 const oldTemplate=await makeTemplate(assets[0],'Formato anterior sintético'),newTemplate=await makeTemplate(assets[1],'Membrete seleccionado sintético'),thirdTemplate=await makeTemplate(assets[2],'Otro membrete sintético');
 const signer=await call('SAVE_SIGNER',{asset_id:assets[3].id,full_name:'Firmante sintético',title:'Cargo de prueba',valid_from:'2020-01-01'});
 const config={...membership,template_id:oldTemplate.id,follow_active:false,signers:[{version_id:signer.id,role:'Autoriza'}],valid_from:'2020-01-01',valid_until:null};
 const siblings=[{program:'membership_shared',document_type:'MEMBERSHIP_APPROVAL',fund_key:''},{program:'auto',document_type:'PROGRAM_FINANCING_APPROVAL',fund_key:''},{program:'prestamo',document_type:'LOAN_APPROVAL',fund_key:''}];
 for(const scope of [membership,...siblings])await call('SAVE_CONFIGURATION',{...config,...scope});
 const template=(await call('PREVIEW_CONFIG',config)).template;
 const createLayout=(scope,name)=>persist('SAVE',{...scope,id:crypto.randomUUID(),actor:uid,context_affiliate:uid,name,template_id:oldTemplate.id,definition:layouts.initialLayout(scope.document_type,template)});
 const activate=async(scope,version)=>persist('ACTIVATE',{...scope,id:crypto.randomUUID(),actor:uid,context_affiliate:uid,layout_id:version.id,assignments:[{program:scope.program,fund_key:scope.fund_key||'',expected_id:(await exact(scope))?.id||null}]});
 const oldLayout=await createLayout(membership,'Diseño Membresías sintético');await activate(membership,oldLayout);await activate(siblings[0],oldLayout);
 for(const scope of siblings.slice(1))await activate(scope,await createLayout(scope,'Diseño ajeno sintético'));
 const override={...siblings[2],fund_key:'FONDO A'};await activate(override,await createLayout(siblings[2],'Diseño fondo A sintético'));
 await call('ACTIVATE_TEMPLATE',{id:newTemplate.id});await call('SAVE_CONFIGURATION',{...config,template_id:newTemplate.id,follow_active:true});
 const historical=await resolve(membership),request=crypto.randomUUID();
 await q('insert into program_requests(id,affiliate_id,folio,program_id,membership_offering_id,financial_submission_snapshot) values($1,$2,$3,$4,$5,$6)',[request,uid,'SYNTHETIC-HISTORICAL',membership.program,crypto.randomUUID(),JSON.stringify(renderer.syntheticSnapshot(membership.document_type,membership.program,historical).operation.financial)]);
 await q("insert into program_request_admin_events values($1,$2,$3,'approved','in_review',now())",[crypto.randomUUID(),request,uid]);
 const recordsBefore=await q('select * from document_private.records order by id'),outsideBefore=await outside();assert.equal(recordsBefore.length,1);assert.equal(recordsBefore[0].document_snapshot.template.id,oldTemplate.id);
 const migration=process.env.SUTIAPP_ASSIGNMENT_MIGRATION||fs.readdirSync(path.join(root,'supabase/migrations')).find(f=>/^20261007.*document_assignment.*\.sql$/.test(f));assert(migration,'Document assignment migration must exist before these tests run.');
 const functionQuery="select p.oid::int,proowner::int,proacl::text,pg_get_functiondef(p.oid) definition from pg_proc p where p.oid in ('public.document_generation_command(text,jsonb)'::regprocedure,'public.document_layout_context(text,jsonb)'::regprocedure,'public.document_layout_persist(text,jsonb)'::regprocedure) order by oid";
 const functionsBefore=await q(functionQuery);
 await test('migration preserves histories, assignments and existing function identities/ACL',async()=>{
  await db.exec(read('supabase/migrations/'+migration));assert.deepEqual(await q('select * from document_private.records order by id'),recordsBefore);assert.deepEqual(await outside(),outsideBefore);
  const after=(await q(functionQuery)).map(({definition,...row})=>row);assert.deepEqual(after,functionsBefore.map(({definition,...row})=>row));
 });
 let previewSnapshot,rendered=0,persisted=0;const actualRender=renderer.createRenderer(PDFLib);
 let loadedAsset;const loadAsset=async asset=>{loadedAsset=asset.path;assert(assetBytes.has(asset.path),'Renderer requested an unknown synthetic asset');return assetBytes.get(asset.path);};
 const deps={contextCall,command:call,persist:async(a,d)=>{persisted++;return persist(a,d);},loadAsset,render:async(snapshot,...args)=>{rendered++;previewSnapshot=structuredClone(snapshot);return actualRender(snapshot,...args);}};
 const draft=async(templateId=newTemplate.id,scope=membership)=>({...scope,id:crypto.randomUUID(),expected_configuration_id:(await latestConfig(scope)).id,expected_assignment_id:(await exact(scope))?.id||null,template_id:templateId,signers:config.signers,valid_from:'2020-01-01',valid_until:null});
 const edge=async(action,body)=>{const response=await handleLayout({action,...body},deps);if(response.status!==200)throw Error(response.data?.error||'HTTP_'+response.status);return response;};
 await test('unauthorized configuration and preview denied; private writer remains service-only',async()=>{
  for(const role of ['anon','authenticated'])assert.equal(await scalar("select has_function_privilege($1,'public.document_layout_persist(text,jsonb)','execute') v",[role]),false);
  assert.equal(await scalar("select has_function_privilege('service_role','public.document_layout_persist(text,jsonb)','execute') v"),true);
  const input=await draft(),before=await state();principal=other;granted=[];await assert.rejects(edge('LAYOUT_CONFIGURE',input),/PERMISSION_DENIED/);await assert.rejects(edge('LAYOUT_CONFIGURE_PREVIEW',input),/PERMISSION_DENIED/);
  principal=uid;granted=['document_generation.config.read'];await assert.rejects(edge('LAYOUT_CONFIGURE',input),/PERMISSION_DENIED/);granted=permissions;assert.deepEqual(await state(),before);
 });
 await test('dashboard exposes effective layout template despite conflicting base configuration',async()=>{
  const dashboard=await call('DASHBOARD',{}),assignment=dashboard.layout_assignments.find(a=>a.program===membership.program&&a.document_type===membership.document_type&&a.fund_key==='');
  assert(assignment);assert.equal(assignment.layout_id,oldLayout.id);assert.equal(assignment.template_id,oldTemplate.id);assert.equal(dashboard.configurations.find(c=>c.program===membership.program).template_id,newTemplate.id);
 });
 const change=await draft();let saved;
 await test('preview renders selected template with original custom elements without writes',async()=>{
  const before=await state(),count=persisted,output=await edge('LAYOUT_CONFIGURE_PREVIEW',change);assert(output.pdf.length>1000);assert.equal(loadedAsset,assets[1].path);assert.equal(previewSnapshot.template.id,newTemplate.id);assert.deepEqual(previewSnapshot.layout.definition,oldLayout.definition);assert.equal(previewSnapshot.signers.length,config.signers.length);assert.equal(persisted,count);assert.deepEqual(await state(),before);assert((await PDFLib.PDFDocument.load(output.pdf)).getPageCount()>0);
 });
 await test('configure atomically clones only membership and snapshot matches preview',async()=>{
  saved=(await edge('LAYOUT_CONFIGURE',change)).data;const effective=await resolve(membership),stored=await latestConfig(membership);assert.equal(effective.template.id,newTemplate.id);assert.notEqual(effective.layout.id,oldLayout.id);assert.deepEqual(effective.layout.definition,oldLayout.definition);assert.equal(stored.follow_active,false);assert.deepEqual(stored.signers,config.signers);assert.equal(stored.template_id,newTemplate.id);
  assert.equal(previewSnapshot.template.id,effective.template.id);assert.deepEqual(previewSnapshot.layout.definition,effective.layout.definition);assert.deepEqual(await outside(),outsideBefore);assert.deepEqual(await q('select * from document_private.records order by id'),recordsBefore);assert.equal((await resolve(siblings[0])).layout.id,oldLayout.id);
 });
 await test('identical retry is idempotent and same id with changed intent fails',async()=>{
  const before=await state();assert.deepEqual((await edge('LAYOUT_CONFIGURE',change)).data,saved);assert.deepEqual(await state(),before);await assert.rejects(edge('LAYOUT_CONFIGURE',{...change,template_id:thirdTemplate.id}),/RETRY_CONFLICT/);assert.deepEqual(await state(),before);
 });
 await test('signer-only edit keeps layout version and uses draft signers for preview',async()=>{
  const before=await exact(membership),count=await scalar('select count(*)::int v from document_private.layouts'),input={...await draft(),signers:[{version_id:signer.id,role:'Visto bueno'}]};
  await edge('LAYOUT_CONFIGURE_PREVIEW',input);assert.equal(previewSnapshot.signers[0].role,'Visto bueno');await edge('LAYOUT_CONFIGURE',input);assert.equal((await latestConfig(membership)).signers[0].role,'Visto bueno');assert.equal((await exact(membership)).layout_id,before.layout_id);assert.equal(await scalar('select count(*)::int v from document_private.layouts'),count);
 });
 await test('stale configuration and stale assignment reject without partial writes',async()=>{
  const a=await draft(thirdTemplate.id);await call('SAVE_CONFIGURATION',{...config,template_id:newTemplate.id});const before=await state();await assert.rejects(edge('LAYOUT_CONFIGURE',a),/CONFIGURATION_CHANGED/);assert.deepEqual(await state(),before);
  const b=await draft(thirdTemplate.id),current=await resolve(membership);await activate(membership,current.layout);const baseline=await state();await assert.rejects(edge('LAYOUT_CONFIGURE',b),/ASSIGNMENT_CHANGED/);assert.deepEqual(await state(),baseline);
 });
 await test('failure at activation rolls back configuration, clone and audit; retry can succeed',async()=>{
  await db.exec("create function document_private.test_activation_failure() returns trigger language plpgsql as $$begin if current_setting('test.activation_failure',true)='true' then raise exception 'DOCUMENT_SYNTHETIC_ACTIVATION_FAILURE';end if;return new;end$$;create trigger test_activation_failure before insert on document_private.layout_activations for each row execute function document_private.test_activation_failure();");
  const input=await draft(thirdTemplate.id),before=await state();await q("select set_config('test.activation_failure','true',false)");await assert.rejects(edge('LAYOUT_CONFIGURE',input),/SYNTHETIC_ACTIVATION_FAILURE/);assert.deepEqual(await state(),before);await q("select set_config('test.activation_failure','false',false)");await edge('LAYOUT_CONFIGURE',input);assert.equal((await resolve(membership)).template.id,thirdTemplate.id);
 });
 await test('invalid geometry and duplicate signer reject before publishing a candidate',async()=>{
  const tinyAsset=await worker('REGISTER_ASSET',{kind:'TEMPLATE',mime:'application/pdf',path:'assets/'+crypto.randomUUID()+'.pdf',sha256:'a'.repeat(64),size:200,dimensions:{width:450,height:600},actor:uid});const tiny=await makeTemplate(tinyAsset,'Membrete pequeño sintético');const before=await state();await assert.rejects(edge('LAYOUT_CONFIGURE',await draft(tiny.id)),/LAYOUT_INVALID/);assert.deepEqual(await state(),before);
  await assert.rejects(edge('LAYOUT_CONFIGURE',{...await draft(newTemplate.id),signers:[...config.signers,...config.signers]}),/SIGNER_ASSIGNMENT_INVALID/);assert.deepEqual(await state(),before);
 });
 await test('future-dated candidate and assignment from another scope fail closed without writes',async()=>{
  const input=await draft(),before=await state();await assert.rejects(edge('LAYOUT_CONFIGURE_PREVIEW',{...input,valid_from:'2099-01-01'}),/CONFIGURATION_NOT_EFFECTIVE/);await assert.rejects(edge('LAYOUT_CONFIGURE',{...input,expected_assignment_id:(await exact(siblings[0])).id}),/ASSIGNMENT_MISSING/);assert.deepEqual(await state(),before);
 });
 await test('an older transaction start cannot hide a successful new assignment',async()=>{
  await db.exec('begin');
  try{
   const current=await resolve(membership);
   await q('insert into document_private.layout_activations(id,program,document_type,fund_key,layout_id,created_by,context_affiliate,created_at) values(gen_random_uuid(),$1,$2,$3,$4,$5,$5,clock_timestamp())',[membership.program,membership.document_type,'',current.layout.id,uid]);
   const input=await draft(newTemplate.id);await edge('LAYOUT_CONFIGURE',input);
   assert.equal((await resolve(membership)).template.id,newTemplate.id,'successful configure must be the latest effective assignment');
  }finally{await db.exec('rollback');}
 });
 await test('general changes preserve loan fund overrides and explicit unassignment semantics',async()=>{
  const loan=siblings[2],prior=await resolve(override),input=await draft(newTemplate.id,loan);await edge('LAYOUT_CONFIGURE',input);assert.equal((await resolve(loan)).template.id,newTemplate.id);const after=await resolve(override);assert.deepEqual(after.layout,prior.layout);assert.deepEqual(after.layout_assignment,prior.layout_assignment);assert.deepEqual(after.template,prior.template);assert.deepEqual(after.signers,prior.signers);
  await persist('UNASSIGN',{...override,id:crypto.randomUUID(),actor:uid,context_affiliate:uid,assignments:[{program:override.program,fund_key:override.fund_key,expected_id:(await exact(override)).id}]});await assert.rejects(resolve(override),/ASSIGNMENT_MISSING/);assert.equal((await resolve(loan)).template.id,newTemplate.id);
  const dashboard=await call('DASHBOARD',{}),latest=dashboard.layout_assignments.filter(a=>a.program===override.program&&a.document_type===override.document_type&&a.fund_key===override.fund_key);assert.equal(latest.length,1);assert.equal(latest[0].layout_id,null);
 });
 await test('history stays immutable and no new operation or emitted PDF is created by configuration',async()=>{
  assert.deepEqual(await q('select * from document_private.records order by id'),recordsBefore);assert.equal(await scalar('select count(*)::int v from program_request_admin_events'),1);await assert.rejects(q("update document_private.records set document_snapshot='{}'"),/HISTORY_IMMUTABLE/);await assert.rejects(q("update document_private.layouts set template_id=$1 where id=$2",[newTemplate.id,oldLayout.id]),/IMMUTABLE/);
 });
 await test('recovery restores exact function definitions/OID/ACL without deleting new versions or history',async()=>{
  const before=await state();await db.exec(read('supabase/recovery/'+migration));assert.deepEqual(await q(functionQuery),functionsBefore);assert.deepEqual(await state(),before);
 });
 const result={status:'PASS',captured_at:new Date().toISOString(),checks,productionTouched:false,networkUsed:false,syntheticDataOnly:true,renderedCandidates:rendered,historicalRowsPreserved:recordsBefore.length,historicalHash:hash(recordsBefore),migration,sourceHashes:Object.fromEntries(['supabase/migrations/'+migration,'supabase/recovery/'+migration,...['index.ts','layout-service.mjs','renderer.mjs','layout.mjs','render-layout.mjs'].map(f=>'supabase/functions/document-generation/'+f),'scripts/test-document-assignment-fix.js'].map(f=>[f,hash(fs.readFileSync(path.join(root,f),'utf8'))]))};
 fs.mkdirSync(path.dirname(evidence),{recursive:true});fs.writeFileSync(evidence,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,checks:checks.length,evidence:path.relative(root,evidence)}));
 }finally{await db.close();}
}
main().catch(error=>{const result={status:'FAIL',captured_at:new Date().toISOString(),checks,error:String(error.message),productionTouched:false,networkUsed:false};fs.mkdirSync(path.dirname(evidence),{recursive:true});fs.writeFileSync(evidence,JSON.stringify(result,null,2)+'\n');console.error(error.stack);process.exitCode=1;});
