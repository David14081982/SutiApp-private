'use strict';
// One reusable contract suite. In-memory PostgreSQL and synthetic PDF bytes only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),os=require('os');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const PDFLib=require(path.join(process.env.SUTIAPP_DOCUMENT_DEPS||path.join(os.tmpdir(),'sutiapp-document-core-20260928'),'node_modules/pdf-lib'));
const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const checks=[];async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
async function main(){
 const renderer=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/renderer.mjs')));
 const layouts=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/layout.mjs')));
 const {handleLayout}=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/layout-service.mjs')));
 let activeBrowser;const db=new PGlite();const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const scalar=async(sql,args=[])=>(await q(sql,args))[0]?.v;
 const call=(action,data={})=>scalar('select public.document_generation_command($1,$2::jsonb) v',[action,JSON.stringify(data)]);
 const worker=(action,data={})=>scalar('select public.document_generation_worker($1,$2::jsonb) v',[action,JSON.stringify(data)]);
 const layoutCall=(action,data={})=>scalar('select public.document_layout_context($1,$2::jsonb) v',[action,JSON.stringify(data)]);
 const layoutPersist=(action,data={})=>scalar('select public.document_layout_persist($1,$2::jsonb) v',[action,JSON.stringify(data)]);
 const actor=async(id,permissions=[])=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false)",[id,JSON.stringify(permissions)]);await db.exec('set role authenticated');};
 const permissions=['config.read','templates.write','signers.write','signatures.write','signatures.read','config.write','read','retry'].map(p=>'document_generation.'+p).concat('program_requests.read','savings.read');
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema cron;create schema admin_support_private;
 create function admin_support_private.module_visible(uuid,text) returns boolean language sql as $$select exists(select 1 from (values ('requests','program_requests.read',array[]::text[])) modules(key,permission,section_keys) where key=$2)$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.has_admin_permission(p text) returns boolean language sql stable as $$select coalesce(current_setting('test.permissions',true),'[]')::jsonb ? p$$;
 create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select auth.uid()$$;
 create table admin_assignments(permissions text[],constraint admin_assignments_permissions_check check(permissions<@array['authorization.read'::text]));
 create table admin_roles(id uuid primary key,code text);insert into admin_roles values('${uid}','principal_admin');create table admin_role_permissions(role_id uuid,permission text);
 create table admin_section_definitions(section_key text primary key,display_name text,data_boundary text,allowed_actions text[],enforcement_status text,module_key text unique,module_read_permissions text[],module_write_permissions text[],module_sections text[],module_total_only boolean,module_order integer);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);
 create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;create policy broad on storage.objects for all to authenticated using(true) with check(true);
 create table cron.job(jobid bigint,jobname text);create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job values(1,$1) returning jobid$$;create function cron.unschedule(bigint) returns boolean language sql as $$delete from cron.job where jobid=$1 returning true$$;
 create table affiliates(id uuid primary key,numero_control text,full_name text,financial_union_code text,financial_employee_category_code text,unit_raw text);
 insert into affiliates values('${uid}','00001','Persona sintética','TEST','TEST','Unidad de ejemplo'),('${other}','00002','Otra persona','TEST','TEST',null);
 create table program_catalog_items(program_key text);insert into program_catalog_items values('auto');
 create table program_requests(id uuid primary key,affiliate_id uuid,folio text,program_id text,membership_offering_id uuid,financial_approval_snapshot jsonb,financial_submission_snapshot jsonb,financial_profile_snapshot jsonb,terms_version_id uuid,terms_accepted boolean);
 create table program_request_admin_events(id uuid primary key,request_id uuid,actor_auth_user_id uuid,to_status text,from_status text,created_at timestamptz default now());
 create table loan_request_deposit_snapshots(request_id uuid,bank_name text,card_number text,clabe text);
 create table savings_audit_events(id bigint generated always as identity primary key,resource text,action text,after_data jsonb,usuario_contexto_affiliate_id uuid,actor_real_auth_user_id uuid,reason text);
 create table savings_requests(id uuid primary key,participant_id uuid);create table savings_participants(id uuid,affiliate_id uuid);
 create table savings_contribution_plans(enrollment_id uuid,source_request_id uuid,process_snapshot text,amount numeric,effective_from date,effective_to date);
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 `);
 await test('migration compiles in PostgreSQL without live data',()=>db.exec(read('supabase/migrations/20260928000100_document_generation_core.sql')));
 await db.exec(read('supabase/migrations/20260928000200_document_signer_assignment_order.sql'));
 await db.exec(read('supabase/migrations/20260928000300_document_layout_designer.sql'));
 await test('all private tables force RLS; no direct browser grants',async()=>{
  assert.equal(await scalar("select count(*)::integer v from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='document_private' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity"),10);
  await actor(uid,permissions);await assert.rejects(q('select * from document_private.records'),/permission denied/);
  await assert.rejects(worker('CLAIM'),/permission denied/);
  await assert.rejects(q("insert into storage.objects values(gen_random_uuid(),'generated-documents','secret')"),/row-level security/);
 });
 const doc=await PDFLib.PDFDocument.create();doc.addPage([612,792]);const templateBytes=await doc.save();
 const register=async(kind,mime)=>{await db.exec('reset role');return worker('REGISTER_ASSET',{kind,mime,path:'assets/'+crypto.randomUUID()+'.'+(kind==='TEMPLATE'?'pdf':'png'),sha256:'a'.repeat(64),size:200,dimensions:{width:612,height:792},actor:uid});};
 const asset=await register('TEMPLATE','application/pdf'),sig=await register('SIGNATURE','image/png');await actor(uid,permissions);
 const template=await call('SAVE_TEMPLATE',{asset_id:asset.id,name:'Plantilla sintética',margins:{top:34,bottom:28,left:22,right:22},valid_from:'2020-01-01'});
 const signer=await call('SAVE_SIGNER',{asset_id:sig.id,full_name:'Firmante sintético',title:'Cargo de prueba',valid_from:'2020-01-01'});
 const config={program:'auto',document_type:'PROGRAM_FINANCING_APPROVAL',template_id:template.id,signers:[{version_id:signer.id,role:'Autoriza'}],valid_from:'2020-01-01'};
 await call('SAVE_CONFIGURATION',config);
 await db.exec('reset role;begin');await actor(uid,permissions);
 const second=await call('SAVE_SIGNER',{asset_id:sig.id,full_name:'Second synthetic signer',title:'Synthetic role',valid_from:'2020-01-01'});
 await call('SAVE_CONFIGURATION',{...config,signers:[{version_id:signer.id,role:'Autoriza'},{version_id:second.id,role:'Testigo'}]});
 const revised=await call('SAVE_SIGNER',{previous_id:signer.id,asset_id:sig.id,full_name:'Revised synthetic signer',title:'Synthetic role',valid_from:'2020-01-01',role:'Autoriza',assignments:[{program:'auto',document_type:'PROGRAM_FINANCING_APPROVAL',template_id:template.id,selected:true}]});
 const ordered=await call('PREVIEW_CONFIG',{program:'auto',document_type:'PROGRAM_FINANCING_APPROVAL'});assert.deepEqual(ordered.signers.map(x=>x.id),[revised.id,second.id]);await db.exec('rollback');await actor(uid,permissions);
 const renderConfig=await call('PREVIEW_CONFIG',{program:'auto',document_type:'PROGRAM_FINANCING_APPROVAL'});
 const synthetic=renderer.syntheticSnapshot('PROGRAM_FINANCING_APPROVAL','auto',renderConfig);
 const design=layouts.initialLayout(config.document_type,renderConfig.template);
 let layoutV1,layoutV2;
 await test('contract palettes, required fields, geometry and controlled formatters',async()=>{
  for(const type of Object.keys(renderer.TITLES)){
   const fields=layouts.layoutFields(type),draft=layouts.initialLayout(type,renderConfig.template);
   assert.deepEqual(layouts.validateLayout(draft,type,renderConfig.template),[]);
   if(type!=='LOAN_APPROVAL')assert(!fields.some(f=>f.key.startsWith('bank.')));
   assert(!fields.some(f=>f.key==='bank.account_holder'),'unsupported source never invented');
   await renderer.createRenderer(PDFLib)({...renderer.syntheticSnapshot(type,'auto',renderConfig),layout:{definition:draft}},async()=>templateBytes,{preview:true});
  }
  const invalid=structuredClone(design);invalid.elements[0].field='bank.account';assert(layouts.validateLayout(invalid,config.document_type,renderConfig.template).some(e=>e.includes('Campo no disponible')));
  invalid.elements=design.elements.slice(1);assert(layouts.validateLayout(invalid,config.document_type,renderConfig.template).some(e=>e.includes('obligatorio')));
  invalid.elements=structuredClone(design.elements);invalid.elements[0].x=-1;assert(layouts.validateLayout(invalid,config.document_type,renderConfig.template).some(e=>e.includes('fuera')));
  invalid.elements[0]={...invalid.elements[1],id:'duplicate-position'};assert(layouts.validateLayout(invalid,config.document_type,renderConfig.template).some(e=>e.includes('superpuestos')));
  assert.equal(layouts.formatField(25000,'MONEY'),'$25,000.00');assert.match(layouts.formatField('2026-09-28','DATE'),/28.*septiembre.*2026/);assert.equal(layouts.formatField(2,'PERCENT'),'2.00 %');assert.equal(layouts.formatField('12345678','MASKED_BANK_ACCOUNT'),'**** 5678');assert.equal(layouts.formatField(24,'INTEGER'),'24');assert.equal(layouts.formatField(null,'TEXT','na'),'No aplica');assert.equal(layouts.formatField(null,'TEXT','hide'),null);assert.equal(layouts.formatField(null,'TEXT','empty'),'');
 });
 await test('layout versions, permission gates, activation isolation and historical resolution',async()=>{
  await actor(other,[]);await assert.rejects(layoutCall('READ',config),/PERMISSION_DENIED/);await assert.rejects(layoutPersist('SAVE',{}),/permission denied/);
  await actor(uid,permissions);const gate=await layoutCall('WRITE',config);assert.equal(gate.actor,uid);assert(!JSON.stringify(gate.config.signers).includes('assets/'));
  await db.exec('reset role');layoutV1=await layoutPersist('SAVE',{...config,id:crypto.randomUUID(),actor:uid,context_affiliate:other,definition:design});
  assert.equal(layoutV1.version,1);assert.deepEqual((await layoutPersist('SAVE',{...config,id:layoutV1.id,actor:uid,context_affiliate:other,definition:design})).id,layoutV1.id);
  const act=crypto.randomUUID();await layoutPersist('ACTIVATE',{...config,id:act,layout_id:layoutV1.id,actor:uid});await layoutPersist('ACTIVATE',{...config,id:act,layout_id:layoutV1.id,actor:uid});
  const at=await scalar('select clock_timestamp()::text v');const sealed=await scalar('select document_private.resolve_configuration($1,$2,$3::timestamptz) v',[config.program,config.document_type,at]);assert.equal(sealed.layout.id,layoutV1.id);
  const changed=structuredClone(design);changed.elements[0].size=9;layoutV2=await layoutPersist('SAVE',{...config,id:crypto.randomUUID(),actor:uid,definition:changed});assert.equal(layoutV2.version,2);
  await layoutPersist('ACTIVATE',{...config,id:crypto.randomUUID(),layout_id:layoutV2.id,actor:uid});assert.equal((await scalar('select document_private.resolve_configuration($1,$2,clock_timestamp()) v',[config.program,config.document_type])).layout.id,layoutV2.id);
  assert.deepEqual((await scalar('select document_private.resolve_configuration($1,$2,$3::timestamptz) v',[config.program,config.document_type,at])).layout,sealed.layout);
  await assert.rejects(q('update document_private.layouts set definition=$1 where id=$2',[JSON.stringify(design),layoutV1.id]),/IMMUTABLE/);
  await actor(uid,permissions);await call('SAVE_CONFIGURATION',{...config,program:'caja',document_type:'SAVINGS_ENROLLMENT_APPROVAL'});await assert.rejects(layoutCall('VERSION',{program:'caja',document_type:'SAVINGS_ENROLLMENT_APPROVAL',id:layoutV1.id}),/SCOPE_DENIED/);
  await db.exec('reset role');await assert.rejects(layoutPersist('ACTIVATE',{program:'caja',document_type:'SAVINGS_ENROLLMENT_APPROVAL',id:crypto.randomUUID(),layout_id:layoutV1.id,actor:uid}),/SCOPE_DENIED/);
  assert.equal((await scalar("select document_private.resolve_configuration('caja','SAVINGS_ENROLLMENT_APPROVAL',clock_timestamp()) v")).layout.mode,'SYSTEM');
  await layoutPersist('ACTIVATE',{...config,id:crypto.randomUUID(),layout_id:layoutV1.id,actor:uid});await actor(uid,permissions);
 });
 await test('custom positions, signer grid and long frozen schedule paginate deterministically',async()=>{
  const snapshot={...structuredClone(synthetic),layout:{...layoutV1}};snapshot.signers=Array.from({length:12},(_,n)=>({...synthetic.signers[0],full_name:'Firmante sintético '+n}));snapshot.operation.financial.payment_schedule.rows=Array.from({length:120},(_,n)=>({number:n+1,date:'2027-01-15',payment:125,remaining_total:2500}));
  const frozen=JSON.stringify(snapshot),render=renderer.createRenderer(PDFLib),a=await render(snapshot,async()=>templateBytes,{preview:true}),b=await render(snapshot,async()=>templateBytes,{preview:true});assert(a.pages>8);assert.equal(Buffer.compare(a.bytes,b.bytes),0);assert.equal(JSON.stringify(snapshot),frozen);
  const pdf=await PDFLib.PDFDocument.load(a.bytes);assert.equal(pdf.getPageCount(),a.pages);
  const contents=pdf.getPage(0).node.Contents().asArray().map(ref=>Buffer.from(PDFLib.decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');
  const matrices=[...contents.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)].map(m=>[Number(m[1]),Number(m[2])]);
  const first=design.elements[0];assert(matrices.some(([x,y])=>Math.abs(x-first.x*72/25.4)<.001&&Math.abs(y-(792-first.y*72/25.4-first.size))<.001),'physical positions reach PDF operators');
  const signatureBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH9sAAAAASUVORK5CYII=','base64');snapshot.signers=snapshot.signers.map(s=>({...s,asset:{mime:'image/png'}}));const issued=await render(snapshot,async asset=>asset.mime==='image/png'?signatureBytes:templateBytes);assert.equal(issued.pages,a.pages);
 });
 await test('all seven contracts render; no invented optional contract',async()=>{
  for(const type of Object.keys(renderer.TITLES)){const s=renderer.syntheticSnapshot(type,'auto',renderConfig);const out=await renderer.createRenderer(PDFLib)(s,async()=>templateBytes,{preview:true});assert(out.bytes.length>1000);assert(out.pages>=1);}
  const signatureBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH9sAAAAASUVORK5CYII=','base64');
  for(const type of Object.keys(renderer.TITLES)){
   const sealed=renderer.syntheticSnapshot(type,'auto',renderConfig);sealed.signers=Array.from({length:12},(_,n)=>({...renderConfig.signers[0],full_name:'Synthetic institutional signer '+n,title:'Synthetic responsibility',role:'Autoriza'}));
   const loader=async asset=>asset.mime==='image/png'?signatureBytes:templateBytes;
   const a=await renderer.createRenderer(PDFLib)(sealed,loader),b=await renderer.createRenderer(PDFLib)(sealed,loader);
   assert(a.pages>1,'production signature blocks paginate');assert.equal(Buffer.compare(a.bytes,b.bytes),0);
  }
  assert.equal(Object.keys(renderer.TITLES).length,7);assert.throws(()=>renderer.documentContract({...synthetic,document_type:'SAVINGS_WITHDRAWAL_SETTLEMENT'}));
 });
 await test('240 frozen payments, repeat headers, deterministic PDF, real margins',async()=>{
  const s=structuredClone(synthetic);s.operation.financial.payment_schedule.rows=Array.from({length:240},(_,n)=>({number:n+1,date:'2027-01-15',payment:123.45,remaining_total:987.65}));
  const render=renderer.createRenderer(PDFLib),a=await render(s,async()=>templateBytes,{preview:true}),b=await render(s,async()=>templateBytes,{preview:true});
  assert(a.pages>5);assert.equal(Buffer.compare(a.bytes,b.bytes),0);const frozen=JSON.stringify(s.operation.financial);await render(s,async()=>templateBytes,{preview:true});assert.equal(JSON.stringify(s.operation.financial),frozen);
  const before=a.pages;s.template.margins.top=55;s.template.margins.bottom=55;const c=await render(s,async()=>templateBytes,{preview:true});assert(c.pages>before);
 });
 const request=crypto.randomUUID(),event=crypto.randomUUID();
 await db.exec('reset role');await q('insert into program_requests(id,affiliate_id,folio,program_id,financial_approval_snapshot) values($1,$2,$3,$4,$5)',[request,uid,'SYNTHETIC-1','auto',JSON.stringify({...synthetic.operation.financial,approval_contract_version:'PROGRAM_PRODUCT_PAYMENT_APPROVAL_V1'})]);
 await test('final approval event captures immutable identity/configuration',async()=>{
  await q("insert into program_request_admin_events values($1,$2,$3,'in_review','submitted',now())",[crypto.randomUUID(),request,uid]);assert.equal(await scalar('select count(*)::integer v from document_private.records'),0);
  await q("insert into program_request_admin_events values($1,$2,$3,'approved','in_review',now())",[event,request,uid]);assert.equal(await scalar('select count(*)::integer v from document_private.records'),1);
  const snapshot=await scalar('select document_snapshot v from document_private.records');assert.equal(snapshot.identity.numero_control,'00001');assert.equal(snapshot.operation.authorized_by_user,uid);assert.equal(snapshot.signers[0].full_name,'Firmante sintético');
  await q("update affiliates set full_name='Nombre posterior' where id=$1",[uid]);assert.equal((await scalar('select document_snapshot v from document_private.records')).identity.full_name,'Persona sintética');
 });
 const recordId=await scalar('select id v from document_private.records');
 await test('cross-user access and separated capabilities enforced in backend',async()=>{
  await actor(other,[]);assert.deepEqual(await call('LIST'),[]);await assert.rejects(call('ACCESS',{id:recordId}),/ACCESS_DENIED/);await assert.rejects(call('RETRY',{id:recordId,admin:true}),/PERMISSION_DENIED/);
  await actor(uid,[]);assert.equal((await call('LIST')).length,1);await assert.rejects(call('SAVE_CONFIGURATION',config),/PERMISSION_DENIED/);await assert.rejects(call('ASSET_ACCESS',{id:sig.id}),/DENIED/);
 });
 await test('lease fencing, failed generation and retry never replay business',async()=>{
  await db.exec('reset role');const claim=await worker('CLAIM');assert.equal(claim.id,recordId);assert.equal(await worker('CLAIM'),null);
  await assert.rejects(worker('READY',{id:recordId,lease_id:crypto.randomUUID()}),/LEASE_LOST/);
  await worker('FAILED',{id:recordId,lease_id:claim.lease_id,error_code:'DOCUMENT_SYNTHETIC_FAILURE'});
  await actor(uid,permissions);await call('RETRY',{id:recordId,admin:true});await db.exec('reset role');const again=await worker('CLAIM');assert.deepEqual(again.document_snapshot,claim.document_snapshot);
  await worker('READY',{id:recordId,lease_id:again.lease_id,path:'issued/'+recordId+'.pdf',sha256:'b'.repeat(64),snapshot_sha256:'c'.repeat(64)});
  await assert.rejects(q("update document_private.records set sha256=repeat('d',64)"),/IMMUTABLE/);assert.equal(await scalar('select count(*)::integer v from program_request_admin_events'),2);
 });
 await test('all four savings approvals preserve final event identity and specific fields',async()=>{
  await db.exec('reset role');const participant=crypto.randomUUID();await q('insert into savings_participants values($1,$2)',[participant,uid]);
  const expected={JOIN:'SAVINGS_ENROLLMENT_APPROVAL',CHANGE_AMOUNT:'SAVINGS_CONTRIBUTION_CHANGE',TERMINATE:'SAVINGS_CESSATION_APPROVAL',WITHDRAW:'SAVINGS_WITHDRAWAL_APPROVAL'};
  for(const [type,document_type] of Object.entries(expected)){
   await actor(uid,permissions);await call('SAVE_CONFIGURATION',{...config,program:'caja',document_type});await db.exec('reset role');
   const operation=crypto.randomUUID(),enrollment=crypto.randomUUID();await q('insert into savings_requests values($1,$2)',[operation,participant]);
   await q("insert into savings_contribution_plans values($1,null,'1',200,'2020-01-01','2026-10-29'),($1,$2,'1',400,'2026-10-30',null)",[enrollment,operation]);
   const result={id:operation,folio:'SYNTHETIC-'+type,status:'APPROVED',data_classification:'CANONICAL',request_type:type,reviewed_at:new Date().toISOString(),requested_amount:500,new_contribution_amount:400,enrollment_id:enrollment,effective_from:'2026-10-30',withdrawal_kind:'PARTIAL',component:'CAPITAL',continue_saving:true,metadata:{process:'1'}};
   await q("insert into savings_audit_events(resource,action,after_data,usuario_contexto_affiliate_id,actor_real_auth_user_id) values('savings_runtime','APPROVE',$1,$2,$2)",[JSON.stringify({result}),uid]);
   const record=(await q('select * from document_private.records where operation_id=$1',[operation]))[0];assert.equal(record.document_type,document_type);assert.match(record.final_event_id,/^\d+$/);assert.equal(record.document_snapshot.operation.previous_contribution_amount,200);renderer.documentContract(record.document_snapshot);
  }
  const count=await scalar('select count(*)::integer v from document_private.records');await q("insert into savings_audit_events(resource,action,after_data,usuario_contexto_affiliate_id,actor_real_auth_user_id) values('savings_runtime','SETTLE','{}',$1,$1)",[uid]);assert.equal(await scalar('select count(*)::integer v from document_private.records'),count);
 });
 await test('loans and memberships select their own sealed financial source',async()=>{
  for(const type of ['LOAN_APPROVAL','MEMBERSHIP_APPROVAL']){
   const program=type==='LOAN_APPROVAL'?'prestamo':'membership';await actor(uid,permissions);await call('SAVE_CONFIGURATION',{...config,program,document_type:type});await db.exec('reset role');
   const op=crypto.randomUUID();await q('insert into program_requests(id,affiliate_id,folio,program_id,membership_offering_id,financial_approval_snapshot,financial_submission_snapshot) values($1,$2,$3,$4,$5,$6,$7)',[op,uid,'SYNTHETIC-'+type,program,type==='MEMBERSHIP_APPROVAL'?crypto.randomUUID():null,type==='LOAN_APPROVAL'?JSON.stringify(synthetic.operation.financial):null,JSON.stringify(synthetic.operation.financial)]);
   if(type==='LOAN_APPROVAL')await q('insert into loan_request_deposit_snapshots values($1,$2,$3,$4)',[op,'Banco sintético','1234567890123456','123456789012345678']);
   await q("insert into program_request_admin_events values($1,$2,$3,'approved','in_review',now())",[crypto.randomUUID(),op,uid]);
   const snapshot=await scalar('select document_snapshot v from document_private.records where operation_id=$1',[op]);assert.equal(snapshot.document_type,type);renderer.documentContract(snapshot);if(type==='LOAN_APPROVAL'){assert.equal(snapshot.bank.card_last4,'3456');assert(!JSON.stringify(snapshot).includes('1234567890123456'));}
  }
 });
 if(process.argv.includes('--browser'))await test('owner UI: tabs, dialogs, search, margins, assignments, upload and preview',async()=>{
  const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
  const vm=require('vm'),sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
  const browser=activeBrowser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let queue=Promise.resolve();const serial=fn=>{const value=queue.then(fn);queue=value.catch(()=>{});return value;};
  await page.exposeFunction('__command',(action,data)=>serial(async()=>{await actor(uid,permissions);return call(action,data);}));
  await page.exposeFunction('__edge',(body)=>serial(async()=>{
   await actor(uid,permissions);
   if(body.action.startsWith('LAYOUT_')){
    const result=await handleLayout(body,{contextCall:async(a,d)=>{await actor(uid,permissions);return layoutCall(a,d);},command:async(a,d)=>{await actor(uid,permissions);return call(a,d);},persist:async(a,d)=>{await db.exec('reset role');return layoutPersist(a,d);},render:renderer.createRenderer(PDFLib),loadAsset:async()=>templateBytes});
    if(result.status!==200)throw Error(result.data.details?.join(' ')||result.data.error);
    return result.pdf?{base64:Buffer.from(result.pdf).toString('base64')}:result.data;
   }
   if(body.action==='ASSET_ACCESS'||body.action==='ACCESS')return {url:'https://document-test.invalid/template.pdf'};
   if(body.action==='PREVIEW'){const c=await call('PREVIEW_CONFIG',{...body.config,program:body.program,document_type:body.document_type});const output=await renderer.createRenderer(PDFLib)(renderer.syntheticSnapshot(body.document_type,body.program,c),async()=>templateBytes,{preview:true});return {base64:Buffer.from(output.bytes).toString('base64')};}
   if(body.action==='UPLOAD'){await call('UPLOAD_PERMISSION',{kind:body.kind});return register(body.kind,body.kind==='TEMPLATE'?'application/pdf':'image/png');}
   throw Error('UNEXPECTED_EDGE_ACTION');
  }));
  await page.route('https://document-test.invalid/**',route=>{const pathname=new URL(route.request().url()).pathname;if(pathname.startsWith('/app/vendor/pdfjs-5.4.149/'))return route.fulfill({contentType:'text/javascript',body:read(pathname.slice(1))});if(pathname.endsWith('.pdf'))return route.fulfill({contentType:'application/pdf',body:Buffer.from(templateBytes)});return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body style="margin:0"><div id="root"></div></body></html>'});});
  await page.goto('https://document-test.invalid/');
  await page.addScriptTag({content:read('app/vendor/react-18.3.1/react.production.min.js')});await page.addScriptTag({content:read('app/vendor/react-dom-18.3.1/react-dom.production.min.js')});
  await page.evaluate(({uid})=>{
   window.AffiliateAuth={getState:()=>({session:{user:{id:uid}},affiliate:{id:uid}})};window.AdminRepository={getState:()=>({assignment:{}})};
   window.SutiSupabase={getClient:()=>({rpc:async(name,p)=>{try{return {data:await window.__command(p.p_action,p.p_data)}}catch(e){return {error:e}}},functions:{invoke:async(name,{body})=>{try{const value=await window.__edge(body);if(value.base64){const bytes=Uint8Array.from(atob(value.base64),c=>c.charCodeAt(0));return {data:new Blob([bytes],{type:'application/pdf'})};}return {data:value};}catch(e){return {error:e}}}}})};
  },{uid});
  for(const f of ['document-generation-design.js','document-generation-repository.js','document-layout-repository.js','document-layout-designer.jsx','screens-admin-document-generation.jsx'])await page.addScriptTag({content:f.endsWith('.jsx')?sandbox.Babel.transform(read('app/'+f),{presets:['react']}).code:read('app/'+f)});
  await page.evaluate(()=>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.AdminDocumentGeneration,{app:{},onBack:()=>{}})));
  await page.getByRole('button',{name:'Usar como activa',exact:true}).first().click();await page.getByRole('button',{name:'Activar plantilla',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Firmantes\s*\d/}).click();await page.getByLabel('Buscar firmante').fill('no coincide');assert.equal(await page.locator('.df-fi').count(),0);await page.getByLabel('Buscar firmante').fill('');assert.equal(await page.locator('.df-fi').count(),1);
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByLabel('Nombre completo',{exact:true}).fill('Firmante editado sintético');await page.getByRole('dialog').getByRole('button',{name:'Nómina',exact:true}).click();await page.getByRole('dialog').getByLabel('Autorización de préstamo',{exact:true}).last().check();await page.getByRole('button',{name:'Guardar nueva versión'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('select').filter({has:page.locator('option[value="false"]')}).selectOption('false');await page.getByRole('button',{name:'Guardar nueva versi\u00f3n'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.df-fi.is-off').count(),1);await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('select').filter({has:page.locator('option[value="false"]')}).selectOption('true');await page.getByRole('button',{name:'Guardar nueva versi\u00f3n'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Firmas por programa/}).click();await page.getByLabel('Buscar programa').fill('Autos');await page.locator('.df-pr').first().getByRole('button',{name:'Configurar',exact:true}).click();assert.equal(await page.locator('.df-ord__row').count(),1);await page.getByRole('button',{name:'Vista previa',exact:true}).click();await page.getByRole('dialog',{name:'Vista previa del documento'}).waitFor();await page.keyboard.press('Escape');
  await page.locator('.df-pr').first().getByRole('button',{name:'Configurar',exact:true}).click();await page.getByRole('button',{name:'Diseñar documento',exact:true}).click();await page.getByRole('dialog',{name:'Diseñar documento',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.dl-host button.df-btn--pri')?.disabled,{},{timeout:30000});
  assert.equal(await page.locator('.dl-field[data-field^="bank."]').count(),0);assert(await page.locator('canvas[aria-label="Membrete PDF real"]').evaluate(c=>c.width>0));
  await page.getByRole('button',{name:'+ Página',exact:true}).click();const sheet=page.locator('.dl-page');
  await page.locator('.dl-field[data-field="operation.financial.price_source"]').dragTo(sheet,{targetPosition:{x:80,y:100}});
  const dragged=page.locator('.dl-element').last();await dragged.click();assert.equal(await page.getByLabel('X · mm',{exact:true}).inputValue(),'32');assert.equal(await page.getByLabel('Y · mm',{exact:true}).inputValue(),'40');
  const box=await dragged.boundingBox();await page.mouse.move(box.x+15,box.y+8);await page.mouse.down();await page.mouse.move(box.x+40,box.y+33,{steps:5});await page.mouse.up();assert.equal(await page.getByLabel('X · mm',{exact:true}).inputValue(),'42');assert.equal(await page.getByLabel('Y · mm',{exact:true}).inputValue(),'50');
  const handle=await page.getByRole('button',{name:'Redimensionar elemento'}).boundingBox();await page.mouse.move(handle.x+6,handle.y+6);await page.mouse.down();await page.mouse.move(handle.x+31,handle.y+16,{steps:4});await page.mouse.up();assert.equal(await page.getByLabel('Ancho · mm',{exact:true}).inputValue(),'75');
  await page.getByRole('button',{name:'+ Texto',exact:true}).click();await page.getByLabel('Texto',{exact:true}).fill('Información general');await page.getByLabel('Y · mm',{exact:true}).fill('85');
  await page.getByRole('button',{name:'Vista previa PDF',exact:true}).click();await page.locator('iframe[title="Vista previa PDF del diseño"]').waitFor();await page.getByRole('button',{name:'Volver al diseño'}).click();
  await page.waitForFunction(()=>!document.querySelector('.dl-host button.df-btn--pri')?.disabled);await page.getByRole('button',{name:'Activar diseño',exact:true}).click();await page.getByText(/Versión \d+ activa para documentos nuevos/).waitFor();
  await page.getByLabel('Página del diseño').selectOption(String(design.pages+1));await page.locator('.dl-element').filter({hasText:'PRICE_CASH'}).click();assert.equal(await page.getByLabel('X · mm',{exact:true}).inputValue(),'42');assert.equal(await page.getByLabel('Ancho · mm',{exact:true}).inputValue(),'75');
  for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'designer contains its canvas scrolling');assert(await page.getByRole('button',{name:'Activar diseño',exact:true}).isVisible());}
  if(process.env.SUTIAPP_LAYOUT_INSPECT_PNG)await page.screenshot({path:process.env.SUTIAPP_LAYOUT_INSPECT_PNG});
  await page.getByRole('dialog',{name:'Diseñar documento',exact:true}).getByRole('button',{name:'Cerrar',exact:true}).last().click();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/Plantillas\s*\d/}).click();await page.getByRole('button',{name:'Subir nueva plantilla',exact:true}).click();await page.locator('input[type=file]').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from(templateBytes)});await page.getByLabel('Nombre de la plantilla').fill('Segundo membrete sintético');await page.getByRole('button',{name:'Guardar sin activar'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByLabel('Margen superior').fill('45');assert.equal(await page.locator('.df-mrow__v').first().innerText(),'45 mm');await page.getByRole('button',{name:'Guardar como nueva versión'}).click();await page.getByRole('button',{name:'Guardar sin activar'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){await page.setViewportSize(viewport);assert(await page.locator('.df-kpis').isVisible());assert.equal(await page.locator('.df-kpi').count(),3);assert.equal(await page.locator('.df-panel--pl .df-side').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal page overflow');}
  assert.deepEqual(errors,[]);await browser.close();await db.exec('reset role');
 });
 await test('version replacement retains historical identity and template',async()=>{
  await actor(uid,permissions);const next=await call('SAVE_TEMPLATE',{previous_id:template.id,asset_id:asset.id,name:'Nueva versión',margins:{top:40,bottom:28,left:22,right:22},valid_from:'2020-01-01'});assert(next.version>=2);
  await call('SAVE_SIGNER',{previous_id:signer.id,asset_id:sig.id,full_name:'Nombre nuevo',title:'Cargo nuevo',valid_from:'2020-01-01',enabled:false});await db.exec('reset role');
  assert.equal((await scalar('select document_snapshot v from document_private.records where id=$1',[recordId])).template.id,template.id);await assert.rejects(q('delete from document_private.templates'),/IMMUTABLE/);
  await actor(uid,permissions);await assert.rejects(call('PREVIEW_CONFIG',{program:'auto',document_type:'PROGRAM_FINANCING_APPROVAL'}),/SIGNER_NOT_EFFECTIVE/);await db.exec('reset role');
 });
 await test('recovery disables generation without deleting historical documents',async()=>{const count=await scalar('select count(*)::integer v from document_private.records'),layoutCount=await scalar('select count(*)::integer v from document_private.layouts');await db.exec(read('supabase/recovery/20260928000300_document_layout_designer.sql'));assert.equal(await scalar('select count(*)::integer v from document_private.layouts'),layoutCount);await db.exec(read('supabase/recovery/20260928000100_document_generation_core.sql'));assert.equal(await scalar('select count(*)::integer v from document_private.records'),count);assert.equal(await scalar('select enabled v from document_private.installation'),false);});
 console.log(JSON.stringify({status:'PASS',checks:checks.length,permanentQaPdfs:0,residualData:0,productionTouched:false}));
 }finally{if(activeBrowser)await activeBrowser.close();await db.close();}
}
main().catch(e=>{console.error(e.message,e.detail||'',e.position||'',e.query?.slice(0,900)||'');process.exitCode=1;});
