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
const checks=[],evidence=path.join(root,'docs/qa/evidence/membership-document-reissue/database.json');
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
async function main(){
 const renderer=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/renderer.mjs')));
 const layouts=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/layout.mjs')));
 const {handleLayout}=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/layout-service.mjs')));
 const db=new PGlite(),q=async(sql,args=[])=>(await db.query(sql,args)).rows,scalar=async(sql,args=[])=>(await q(sql,args))[0]?.v;
 const rpc=(name,action,data={})=>scalar('select public.'+name+'($1,$2::jsonb) v',[action,JSON.stringify(data)]);
 const permissions=['config.read','templates.write','signers.write','signatures.write','signatures.read','config.write','read','retry'].map(p=>'document_generation.'+p).concat(['program_requests.read','savings.read']);
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
 create function public.admin_request_module_boundary(uuid) returns boolean language sql stable as $$select coalesce(current_setting('test.module_denied',true),'false')<>'true'$$;
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

 await db.exec(read('supabase/migrations/20261007000200_document_assignment_consistency.sql'));
 const baseline=JSON.parse(read('scripts/fixtures/membership-document-reissue-schema.json')).function;
 // Install the exact schema-only live definition, including body line endings, to exercise the drift guards.
 await db.exec(baseline.definition);
 const functionState=()=>q("select oid::int,proowner::int,proacl::text,md5(pg_get_functiondef(oid)) md5,pg_get_functiondef(oid) definition from pg_proc where oid='document_private.reissue(jsonb)'::regprocedure");
 const functionBefore=await functionState();assert.equal(functionBefore[0].md5,baseline.md5);
 const migration='20261007000300_membership_document_reissue.sql';
 const assetBytes=new Map(),templatePdf=await PDFLib.PDFDocument.create();templatePdf.addPage([612,792]);
 const templateBytes=await templatePdf.save(),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9p8AAAAASUVORK5CYII=','base64');
 const asset=async kind=>{const bytes=kind==='TEMPLATE'?templateBytes:png,p='assets/'+crypto.randomUUID()+'.'+(kind==='TEMPLATE'?'pdf':'png');assetBytes.set(p,bytes);return worker('REGISTER_ASSET',{kind,mime:kind==='TEMPLATE'?'application/pdf':'image/png',path:p,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size:bytes.length,dimensions:{width:kind==='TEMPLATE'?612:1,height:kind==='TEMPLATE'?792:1},actor:uid});};
 const templateAsset=await asset('TEMPLATE'),template=await call('SAVE_TEMPLATE',{asset_id:templateAsset.id,name:'Synthetic membership letterhead',margins:{top:24,bottom:20,left:20,right:20},valid_from:'2020-01-01'});
 const signer=async(name,title,previous,enabled=true)=>call('SAVE_SIGNER',{previous_id:previous?.id,asset_id:(await asset('SIGNATURE')).id,full_name:name,title,valid_from:'2020-01-01',enabled});
 const a=await signer('Old Alpha','Old title A'),b=await signer('Old Beta','Old title B'),c=await signer('Removed Gamma','Old title C');
 const originalSigners=[{version_id:a.id,role:'Autoriza'},{version_id:b.id,role:'Testigo'},{version_id:c.id,role:'Responsable del programa'}];
 const scopes=[membership,{program:'prestamo',document_type:'LOAN_APPROVAL'},{program:'auto',document_type:'PROGRAM_FINANCING_APPROVAL'},{program:'caja',document_type:'SAVINGS_ENROLLMENT_APPROVAL'},{program:'membership_shared',document_type:'MEMBERSHIP_APPROVAL'},{program:'membership',document_type:'PROGRAM_FINANCING_APPROVAL'}];
 const configure=(scope,signers)=>call('SAVE_CONFIGURATION',{...scope,template_id:template.id,follow_active:false,valid_from:'2020-01-01',signers});
 const originals=[];
 for(const scope of scopes){
  await configure(scope,originalSigners);const current=await call('PREVIEW_CONFIG',{...scope,template_id:template.id,signers:originalSigners});
  const layout=await persist('SAVE',{...scope,id:crypto.randomUUID(),actor:uid,context_affiliate:uid,name:'Synthetic layout',template_id:template.id,definition:layouts.initialLayout(scope.document_type,current.template)});
  await persist('ACTIVATE',{...scope,id:crypto.randomUUID(),actor:uid,context_affiliate:uid,layout_id:layout.id,assignments:[{program:scope.program,fund_key:'',expected_id:null}]});
  const resolved=await resolve(scope),id=crypto.randomUUID(),op=crypto.randomUUID(),snapshot=renderer.syntheticSnapshot(scope.document_type,scope.program,resolved);
  snapshot.event_id=crypto.randomUUID();snapshot.operation.id=op;snapshot.signers=resolved.signers;snapshot.operation.program=scope.program;
  if(scope.program==='prestamo')snapshot.operation.financial.financialResult.fund='Fondo B';
  const domain=scope.program==='caja'?'savings':'program';
  if(domain==='savings'){await q('insert into savings_participants values($1,$2)',[op,uid]);await q('insert into savings_requests values($1,$2)',[op,op]);}
  else await q('insert into program_requests(id,affiliate_id,folio,program_id) values($1,$2,$3,$4)',[op,uid,'SYNTHETIC',scope.program]);
  const source=structuredClone(snapshot);for(const k of ['signers','template','layout','layout_assignment','configuration_id'])delete source[k];
  await q("insert into document_private.records(id,domain,operation_id,final_event_id,document_type,affiliate_id,program,folio,occurred_at,source_snapshot,document_snapshot,status,path,sha256,snapshot_sha256,ready_at) values($1,$2,$3,$4,$5,$6,$7,'SYNTHETIC','2026-09-28T12:00:00Z',$8::jsonb,$9::jsonb,'READY',$10,repeat('a',64),repeat('b',64),now())",[id,domain,op,snapshot.event_id,scope.document_type,uid,scope.program,JSON.stringify(source),JSON.stringify({...source,...resolved}),'issued/'+id+'.pdf']);
  originals.push((await q('select * from document_private.records where id=$1',[id]))[0]);
 }
 const currentB=await signer('Current Beta','Treasurer current',b),currentA=await signer('Current Alpha','President current',a),d=await signer('Added Delta','Secretary current');
 const revisedSigners=[{version_id:currentB.id,role:'Responsable del programa'},{version_id:d.id,role:'Autoriza'},{version_id:currentA.id,role:'Testigo'}];
 for(const scope of scopes)await configure(scope,revisedSigners);
 const old=originals[0],expected=await resolve(membership),pre=await state();
 await test('forward changes only function and preserves OID owner ACL and all rows',async()=>{await db.exec(read('supabase/migrations/'+migration));assert.deepEqual(await state(),pre);const now=(await functionState())[0];assert.equal(now.oid,functionBefore[0].oid);assert.equal(now.proowner,functionBefore[0].proowner);assert.equal(now.proacl,functionBefore[0].proacl);});
 const appliedFunctionMd5=(await functionState())[0].md5;
 await test('anonymous missing-permission and cross-module reissues are denied',async()=>{
  for(const role of ['anon','authenticated','service_role'])assert.equal(await scalar("select has_function_privilege($1,'document_private.reissue(jsonb)','execute') v",[role]),false);
  const before=await state();for(const missing of ['document_generation.retry','document_generation.config.write','program_requests.read']){granted=permissions.filter(p=>p!==missing);await assert.rejects(call('REISSUE',{id:old.id,revision_id:crypto.randomUUID()}),/DENIED/);}granted=permissions;
  principal='';await assert.rejects(call('REISSUE',{id:old.id,revision_id:crypto.randomUUID()}),/AUTH|PERMISSION/);principal=uid;
  await q("select set_config('test.module_denied','true',false)");await assert.rejects(call('REISSUE',{id:old.id,revision_id:crypto.randomUUID()}),/ACCESS_DENIED/);await q("select set_config('test.module_denied','false',false)");assert.deepEqual(await state(),before);
 });
 let correction,corrected;
 const issue=id=>call('REISSUE',{id,revision_id:crypto.randomUUID()});
 await test('Membership revision takes ordered current names titles roles and signature assets',async()=>{
  correction=await issue(old.id);corrected=(await q('select * from document_private.records where id=$1',[correction.id]))[0];assert.equal(correction.business_version,2);assert.deepEqual(corrected.document_snapshot.signers,expected.signers);assert.deepEqual(corrected.document_snapshot.signers.map(s=>s.id),[currentB.id,d.id,currentA.id]);assert.equal(corrected.document_snapshot.configuration_id,expected.configuration_id);assert.notDeepEqual(corrected.document_snapshot.signers,old.document_snapshot.signers);
  const audit=(await q("select * from document_private.audit where action='REISSUE' and resource_id=$1",[correction.id]))[0];assert.equal(audit.actor,uid);assert.equal(audit.details.signer_source,'CURRENT_CONFIGURATION');assert.equal(audit.details.configuration_id,expected.configuration_id);
 });
 await test('revision preserves sealed business values event identity and the original PDF row',async()=>{
  for(const key of ['operation_id','final_event_id','affiliate_id','program','folio','occurred_at','document_type'])assert.deepEqual(corrected[key],old[key]);const source=structuredClone(corrected.source_snapshot);delete source.revision;assert.deepEqual(source,old.source_snapshot);
  for(const key of ['identity','operation','bank','document_type','event_id'])assert.deepEqual(corrected.document_snapshot[key],old.document_snapshot[key]);assert.deepEqual((await q('select * from document_private.records where id=$1',[old.id]))[0],old);
 });
 await test('retry reuses revision and stale parent or conflicting UUID is rejected',async()=>{
  const before=await state();assert.deepEqual(await call('REISSUE',{id:old.id,revision_id:correction.id}),correction);assert.deepEqual(await state(),before);await assert.rejects(issue(old.id),/REVISION_ALREADY_EXISTS/);principal=other;await assert.rejects(call('REISSUE',{id:old.id,revision_id:correction.id}),/REVISION_RETRY_CONFLICT/);principal=uid;await assert.rejects(call('REISSUE',{id:originals[1].id,revision_id:correction.id}),/REVISION_RETRY_CONFLICT/);
 });
 await test('non-Membership program and document-type branches retain original signers',async()=>{
  for(const prior of originals.slice(1)){const result=await issue(prior.id),row=(await q('select * from document_private.records where id=$1',[result.id]))[0];assert.deepEqual(row.document_snapshot.signers,prior.document_snapshot.signers);const audit=(await q("select details from document_private.audit where action='REISSUE' and resource_id=$1",[result.id]))[0];assert.deepEqual(audit.details,{parent_id:prior.id,business_version:2});}
 });
 const render=renderer.createRenderer(PDFLib),usedAssets=[];
 await test('actual resulting PDF renders current signature assets and valid pages',async()=>{
  const output=await render(corrected.document_snapshot,async asset=>{usedAssets.push(asset.id);assert(assetBytes.has(asset.path));return assetBytes.get(asset.path);});assert(output.bytes.length>1000);assert.equal(usedAssets[0],templateAsset.id);for(const s of expected.signers)assert(usedAssets.includes(s.asset_id));for(const s of old.document_snapshot.signers)assert(!usedAssets.includes(s.asset_id));const loaded=await PDFLib.PDFDocument.load(output.bytes);assert(loaded.getPageCount()>=1);
  const pdfPath=path.join(root,'.tmp/membership-document-reissue/synthetic-corrected.pdf');fs.mkdirSync(path.dirname(pdfPath),{recursive:true});fs.writeFileSync(pdfPath,output.bytes);
  await q("update document_private.records set status='READY',path=$2,sha256=repeat('c',64),snapshot_sha256=repeat('d',64),ready_at=now() where id=$1",[correction.id,'issued/'+correction.id+'.pdf']);
 });
 await test('invalid current signer fails closed without historical fallback or new rows',async()=>{
  const inactive=await signer('Current Beta','Treasurer current',currentB,false);const before=await state();await assert.rejects(issue(correction.id),/SIGNER_NOT_EFFECTIVE/);assert.deepEqual(await state(),before);await signer('Current Beta','Treasurer newest',inactive,true);
 });
 await test('a later deliberate revision captures subsequent configuration while v1 and v2 stay sealed',async()=>{
  const before=await q('select * from document_private.records where id in ($1,$2) order by id',[old.id,correction.id]),result=await issue(correction.id),row=(await q('select * from document_private.records where id=$1',[result.id]))[0];assert.equal(row.business_version,3);assert.equal(row.document_snapshot.signers[0].title,'Treasurer newest');assert.deepEqual(await q('select * from document_private.records where id in ($1,$2) order by id',[old.id,correction.id]),before);
 });
 await test('recovery is exact and preserves every newly created revision; reapply passes',async()=>{
  const before=await state();await db.exec(read('supabase/recovery/'+migration));assert.deepEqual(await functionState(),functionBefore);assert.deepEqual(await state(),before);await db.exec(read('supabase/migrations/'+migration));assert.equal((await functionState())[0].md5,appliedFunctionMd5);assert.deepEqual(await state(),before);
 });
 await test('history immutability and original approval-event count remain unchanged',async()=>{
  for(const original of originals)assert.deepEqual((await q('select * from document_private.records where id=$1',[original.id]))[0],original);
  await assert.rejects(q("update document_private.records set document_snapshot='{}'::jsonb where id=$1",[old.id]),/HISTORY_IMMUTABLE/);assert.equal(await scalar('select count(*)::int v from program_request_admin_events'),0);
 });
 const files=['supabase/migrations/'+migration,'supabase/recovery/'+migration,'scripts/fixtures/membership-document-reissue-schema.json','scripts/test-membership-document-reissue.js',...['index.ts','layout-service.mjs','renderer.mjs','layout.mjs','render-layout.mjs'].map(f=>'supabase/functions/document-generation/'+f)];
 const result={status:'PASS',checks,appliedFunctionMd5,sourceHashes:Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])),syntheticOnly:true,productionTouched:false,networkUsed:false,originalRowsPreserved:originals.length,otherProgramBranches:scopes.length-1};fs.mkdirSync(path.dirname(evidence),{recursive:true});fs.writeFileSync(evidence,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length,appliedFunctionMd5}));
 }finally{await db.close();}
}
main().catch(e=>{fs.mkdirSync(path.dirname(evidence),{recursive:true});fs.writeFileSync(evidence,JSON.stringify({status:'FAIL',checks,error:e.message},null,2)+'\n');console.error(e.stack);process.exitCode=1;});
