'use strict';
// One reusable contract suite. In-memory PostgreSQL and synthetic PDF bytes only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),os=require('os');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..');
const PDFLib=require(path.join(process.env.SUTIAPP_DOCUMENT_DEPS||path.join(os.tmpdir(),'sutiapp-document-core-20260928'),'node_modules/pdf-lib'));
const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const checks=[];async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
function historicalLayout(layouts,type,template,version='suti-layout-3'){
 const fields=layouts.layoutFields(type,version).filter(f=>f.required),m=template.margins,W=template.page_size.width*25.4/72,H=template.page_size.height*25.4/72,elements=[];let page=1,y=m.top;
 for(const f of fields){const height=f.kind==='SIGNERS'?45:f.kind==='PAYMENT_SCHEDULE'?65:f.key==='document.note'?23:11;if(y+height>H-m.bottom-7){page++;y=m.top;}elements.push({id:'historic_'+elements.length,kind:f.kind,field:f.key,page,x:m.left,y,width:W-m.left-m.right,height,font:'Helvetica',size:10,weight:'regular',align:'left',...(f.kind==='FIELD'?{format:f.format,missing:'hide'}:{}),...(f.kind==='SIGNERS'?{columns:2,gap:5,orientation:'horizontal'}:{}),...(f.kind==='PAYMENT_SCHEDULE'?{tableColumns:layouts.TABLE_COLUMNS.map(c=>c.key),header:true,rowsPerPage:10}:{})});y+=height+3;}
 return {version,unit:'mm',pages:page,elements};
}
async function rendererRegression(renderer,layouts){
 const {PDFDocument,StandardFonts,decodePDFRawStream,PDFName}=PDFLib,mm=72/25.4;
 const background=await PDFDocument.create(),p=background.addPage([612,792]),font=await background.embedFont(StandardFonts.Helvetica);
 p.drawText('Institutional header',{x:30,y:760,font,size:10});p.drawText('FORM BODY LABEL',{x:30,y:600,font,size:10});p.drawText('Institutional footer',{x:30,y:30,font,size:10});
 const templateBytes=await background.save(),signature=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH9sAAAAASUVORK5CYII=','base64');
 const config={template:{id:'synthetic',page_size:{width:612,height:792},margins:{top:34,bottom:28,left:22,right:22},asset:{mime:'application/pdf'}},signers:[{role:'Autoriza'}]};
 const s=renderer.syntheticSnapshot('LOAN_APPROVAL','prestamo',config),layout=historicalLayout(layouts,'LOAN_APPROVAL',config.template);
 layout.pages=1;layout.elements=layout.elements.filter(e=>e.kind==='FIELD');
 layout.elements.forEach((e,n)=>Object.assign(e,{page:1,x:25.5,y:37+n*17,height:11}));
 const block={id:'signatures',kind:'SIGNERS',field:'signers',page:1,x:23,y:204,width:171.9,height:45,font:'Helvetica',size:10,weight:'regular',align:'left',columns:2,gap:5,orientation:'horizontal'};
 layout.elements.push(block);s.layout={definition:layout};s.operation.financial.payment_schedule=null;
 const setSigners=n=>{s.signers=Array.from({length:n},(_,k)=>({full_name:'Persona Ejemplo '+(k+1),title:'Responsable de la comision institucional',role:'Autoriza',asset:{mime:'image/png'}}));};
 const load=async a=>a.mime==='image/png'?signature:templateBytes,render=renderer.createRenderer(PDFLib);
 const operators=page=>page.node.Contents().asArray().map(ref=>Buffer.from(decodePDFRawStream(page.doc.context.lookup(ref)).decode()).toString()).join('\n');
 const texts=page=>[...operators(page).matchAll(/<([0-9A-F]+)> Tj/g)].map(m=>Buffer.from(m[1],'hex').toString('latin1'));
 const positions=page=>[...operators(page).matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm\n<([0-9A-F]+)> Tj/g)].map(m=>({x:+m[1],y:+m[2],text:Buffer.from(m[3],'hex').toString('latin1')}));
 await test('owner rectangle: three signers fit one page in three columns without moving fields',async()=>{
  setSigners(3);const frozen=JSON.stringify(s),out=await render(s,load),doc=await PDFDocument.load(out.bytes);assert.equal(out.pages,1);assert.equal(JSON.stringify(s),frozen);
  const pos=positions(doc.getPage(0)),names=pos.filter(t=>t.text.startsWith('Persona Ejemplo'));assert.equal(names.length,3);assert.equal(new Set(names.map(t=>t.y)).size,1);
  names.forEach((t,n)=>assert(Math.abs(t.x-(23+n*((171.9-10)/3+5))*mm)<.001));
  const e=layout.elements[0];assert(pos.some(t=>Math.abs(t.x-e.x*mm)<.001&&Math.abs(t.y-(792-e.y*mm-e.size))<.001));
  assert(positions(doc.getPage(0)).filter(t=>t.text==='Autoriza').every(t=>t.y>792-(block.y+block.height)*mm));
  const preview=await render(s,load,{preview:true}),pdoc=await PDFDocument.load(preview.bytes);assert.equal(preview.pages,out.pages);
  assert.deepEqual(positions(pdoc.getPage(0)).filter(t=>!t.text.includes('VISTA PREVIA /')&&t.text!=='Firma de ejemplo'),pos);
  assert.equal(Buffer.compare(out.bytes,(await render(s,load)).bytes),0);
 });
 await test('one/two signers use full available columns; four use a two-by-two group',async()=>{
  for(const n of [1,2,4]){setSigners(n);block.y=n===4?155:204;block.height=n===4?100:45;
   const out=await render(s,load),doc=await PDFDocument.load(out.bytes),names=positions(doc.getPage(0)).filter(t=>t.text.startsWith('Persona Ejemplo'));assert.equal(out.pages,1);assert.equal(names.length,n);assert.equal(new Set(names.map(t=>t.x)).size,n===4?2:n);assert.equal(new Set(names.map(t=>t.y)).size,n===4?2:1);
  }
  setSigners(3);Object.assign(block,{y:155,height:100,columns:2,autoColumns:false});const manual=await PDFDocument.load((await render(s,load)).bytes),manualNames=positions(manual.getPage(0)).filter(t=>t.text.startsWith('Persona Ejemplo'));assert.equal(manual.getPageCount(),1);assert.equal(new Set(manualNames.map(t=>t.y)).size,2,'explicit signer columns are respected');delete block.autoColumns;block.y=204;block.height=45;
 });
 await test('real overflow keeps signer groups intact and clips form body on continuation',async()=>{
  setSigners(4);const out=await render(s,load),doc=await PDFDocument.load(out.bytes);assert.equal(out.pages,2);
  assert(!texts(doc.getPage(0)).some(t=>t.startsWith('Persona Ejemplo')));
  assert.equal(texts(doc.getPage(1)).filter(t=>t.startsWith('Persona Ejemplo')).length,4);
  assert.equal(texts(doc.getPage(1)).filter(t=>t==='Autoriza').length,4);
  const resource=doc.getPage(1).node.Resources().lookup(PDFName.of('XObject'));
  const boxes=resource.entries().map(([,ref])=>doc.context.lookup(ref).dict.lookup(PDFName.of('BBox'))).filter(Boolean).map(box=>box.asArray().map(x=>x.asNumber()));
  assert.equal(boxes.length,2);assert(boxes.every(b=>b[3]<=28*mm+.001||b[1]>=792-34*mm-.001),'no continuation XObject includes the body');
  assert(!texts(doc.getPage(1)).includes('EJEMPLO'),'page-one control must not repeat');
 });
 await test('explicit page numbers stay fixed when a prior signer block overflows',async()=>{
  setSigners(4);layout.pages=2;layout.elements.push({id:'page_two',kind:'TEXT',text:'EXPLICIT PAGE TWO',page:2,x:22,y:70,width:130,height:10,font:'Helvetica',size:10,weight:'regular',align:'left'});
  const out=await render(s,load),doc=await PDFDocument.load(out.bytes);assert.equal(out.pages,3);assert(texts(doc.getPage(1)).includes('EXPLICIT PAGE TWO'));assert(!texts(doc.getPage(2)).includes('EXPLICIT PAGE TWO'));
  assert.equal(texts(doc.getPage(2)).filter(t=>t.startsWith('Persona Ejemplo')).length,4);layout.elements.pop();layout.pages=1;
 });
 await test('long names and many signers continue indivisibly with preview/issued parity',async()=>{
  setSigners(24);s.signers.forEach((v,k)=>{v.full_name='Responsable institucional de ejemplo '+k+' Apellido de prueba';v.title='Cargo institucional con responsabilidad y atribuciones de ejemplo';});
  const issued=await render(s,load),preview=await render(s,load,{preview:true});assert(issued.pages>2);assert.equal(preview.pages,issued.pages);
  const doc=await PDFDocument.load(issued.bytes);let found=0;for(const p of doc.getPages()){const t=texts(p),roles=t.filter(t=>t==='Autoriza').length;found+=roles;assert.equal(t.filter(t=>t.startsWith('Responsable institucional')).length,roles);}
  assert.equal(found,24);
 });
 await test('correct financial bindings read frozen values; absent bank/rate element stays absent',async()=>{
  s.operation.financial.financialResult={amount:5000,paymentCount:1,administrativeFeePerPayment:15,administrativeFeeTotal:30,interest:600,rate:6,paymentPerPeriod:5630,total:5630};s.bank.clabe=null;
  const model=renderer.documentContract(s),before=JSON.stringify(s),prefix='operation.financial.financialResult.';
  for(const [key,value] of [['amount','$5,000.00'],['paymentCount','1'],['paymentPerPeriod','$5,630.00'],['total','$5,630.00'],['interest','$600.00']])assert.equal(layouts.boundField(s,{field:prefix+key,format:key==='paymentCount'?'INTEGER':'MONEY',missing:'hide'},model),value);
  assert.equal(layouts.boundField(s,{field:'bank.clabe_last4',format:'MASKED_BANK_ACCOUNT',missing:'hide'},model),null);assert.equal(layouts.boundField(s,{field:'bank.clabe',format:'TEXT',missing:'empty'},model),'');assert.equal(JSON.stringify(s),before);
 });
 await test('shared seven-contract renderer and long schedule preserve immutable inputs',async()=>{
  for(const type of Object.keys(renderer.TITLES)){
   const current=renderer.syntheticSnapshot(type,'example',config);current.signers=[{full_name:'Responsable Ejemplo',title:'Cargo Ejemplo',role:'Autoriza',asset:{mime:'image/png'}}];
   for(const custom of [false,true]){
    if(custom)current.layout={definition:layouts.initialLayout(type,config.template)};
    const before=JSON.stringify(current),a=await render(current,load,{preview:true}),b=await render(current,load);assert(a.pages>0);assert.equal(a.pages,b.pages);assert.equal(JSON.stringify(current),before);
   }
  }
  const current=renderer.syntheticSnapshot('PROGRAM_FINANCING_APPROVAL','example',config);current.layout={definition:layouts.initialLayout(current.document_type,config.template)};
  current.operation.financial.payment_schedule.rows=Array.from({length:120},(_,n)=>({number:n+1,date:'2026-10-15',payment:123,remaining_total:456}));
  const before=JSON.stringify(current),a=await render(current,load,{preview:true}),b=await render(current,load,{preview:true});assert(a.pages>5);assert.equal(Buffer.compare(a.bytes,b.bytes),0);assert.equal(JSON.stringify(current),before);
 });
 console.log(JSON.stringify({status:'PASS',scope:'document renderer only',checks:checks.length,permanentQaFilesAdded:0,qaResidualData:0,pdfsWritten:0}));
}
async function loanScheduleRegression(renderer,layouts,PGlite){
 const db=new PGlite(),query=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const extract=(file,name)=>{const sql=read(file),start=sql.indexOf('create function public.'+name+'('),end=sql.indexOf('$$;',start);assert(start>=0&&end>start);return sql.slice(start,end+3);};
 const migration='20260929000100_loan_document_schedule.sql';
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema document_private;
  create table program_requests(id uuid primary key,affiliate_id uuid,created_at timestamptz,approved boolean default false);
  create table document_private.records(id uuid primary key,operation_id uuid,affiliate_id uuid,document_type text,source_snapshot jsonb,document_snapshot jsonb);
  grant usage on schema document_private to anon,authenticated,service_role;`);
 await db.exec(extract('supabase/migrations/20260826000100_authenticated_loan_snapshot_quote_rpc.sql','normalize_suti_financial_key'));
 await db.exec(extract('supabase/migrations/20260831000500_universal_program_product_payment_simulator.sql','generate_program_product_payment_schedule'));
 const input=(category='BASE',count=12)=>({document_type:'LOAN_APPROVAL',operation:{profile:{financial_employee_category:category},financial:{financialResult:{amount:900,paymentCount:count,total:1000,paymentPerPeriod:count===1?1000:83.33}}}});
 const generate=async(source,date='2026-09-29')=>(await query('select document_private.loan_payment_schedule($1,$2) as value',[JSON.stringify(source),date]))[0].value;
 const op=crypto.randomUUID();await query('insert into program_requests(id,affiliate_id,created_at) values($1,$2,$3)',[op,uid,'2026-09-30T02:00:00Z']);
 const add=async(source,type='LOAN_APPROVAL',id=crypto.randomUUID())=>{await query('insert into document_private.records values($1,$2,$3,$4,$5,$5)',[id,op,uid,type,JSON.stringify(source)]);return (await query('select * from document_private.records where id=$1',[id]))[0];};
 const historical=await add(input());const before=JSON.stringify(historical);
 await test('additive calendar migration preserves history and denies browser/service execution',async()=>{
  await db.exec(read('supabase/migrations/'+migration));assert.equal(JSON.stringify((await query('select * from document_private.records where id=$1',[historical.id]))[0]),before);
  for(const role of ['anon','authenticated','service_role']){assert.equal((await query("select has_function_privilege($1,'document_private.loan_payment_schedule(jsonb,date)','execute') as allowed",[role]))[0].allowed,false);await db.exec('set role '+role);await assert.rejects(generate(input()),/permission denied/);await db.exec('reset role');}
 });
 await test('same Viajes generator: processes 1/3/JUB, +30 days, February and cent reconciliation',async()=>{
  for(const [category,process] of [['BASE','1'],['SUPLENTES VARIABLES','3'],['JUBILADOS Y PENS.','JUB']]){
   const source=input(category),frozen=JSON.stringify(source),s=await generate(source),expected=(await query('select public.generate_program_product_payment_schedule($1,$2,12,1000,83.33) as value',['2026-09-29',process]))[0].value;
   assert.deepEqual(s.rows,expected.rows);assert.equal(s.rows.length,12);assert.equal(s.first_payment_date,process==='JUB'?'2026-11-05':'2026-10-30');assert.equal(s.rows.at(-1).payment,83.37);assert.equal(s.rows.at(-1).remaining_total,0);assert.equal(JSON.stringify(source),frozen);
  }
  const feb=await generate(input(),'2027-01-29');assert.equal(feb.first_payment_date,'2027-02-28');
 });
 await test('single-payment advances retain their authorized maturity instead of +30 days',async()=>{
  const source=input('BASE',1);source.operation.financial.financialResult.administrativeFeeCalendar={dueDate:'2026-10-15'};
  const s=await generate(source);assert.equal(s.first_payment_date,'2026-10-15');assert.equal(s.rows.length,1);assert.equal(s.rows[0].payment,1000);assert.equal(s.rows[0].remaining_total,0);assert.equal(s.version,'LOAN_DOCUMENT_FIXED_MATURITY_V1');
  const ordinary=await generate(input('BASE',1));assert.equal(ordinary.first_payment_date,'2026-10-30');
 });
 await test('new documents freeze original request date/profile and revisions keep the calendar',async()=>{
  const source=input(),row=await add(source),s=row.source_snapshot.loan_payment_schedule;assert.equal(s.anchor_date,'2026-09-29');assert.equal(s.first_payment_date,'2026-10-30');assert.deepEqual(row.source_snapshot.operation,source.operation);assert.deepEqual(row.document_snapshot,row.source_snapshot);
  await query("update program_requests set created_at='2030-01-01' where id=$1",[op]);const revision=await add(row.source_snapshot);assert.deepEqual(revision.source_snapshot.loan_payment_schedule,s);
  const missingConfigId=crypto.randomUUID();await query('insert into document_private.records values($1,$2,$3,$4,$5,null)',[missingConfigId,op,uid,'LOAN_APPROVAL',JSON.stringify(source)]);const pending=(await query('select * from document_private.records where id=$1',[missingConfigId]))[0];assert(pending.source_snapshot.loan_payment_schedule.rows.length);assert.equal(pending.document_snapshot,null);
  await query("update program_requests set created_at='2026-09-30T02:00:00Z' where id=$1",[op]);
 });
 await test('missing/invalid calendar fails the PDF without rolling back business approval',async()=>{
  const bad=input('UNRESOLVED');await db.exec('begin');await query('update program_requests set approved=true where id=$1',[op]);const row=await add(bad);await db.exec('commit');assert.equal((await query('select approved from program_requests where id=$1',[op]))[0].approved,true);
  assert.equal(row.source_snapshot.loan_payment_schedule.error,'DOCUMENT_SCHEDULE_PROCESS_UNRESOLVED');
  const config={template:{id:'example',asset:{mime:'application/pdf'},page_size:{width:612,height:792},margins:{top:34,bottom:28,left:22,right:22}},signers:[{role:'Autoriza'}]};
  const snapshot=renderer.syntheticSnapshot('LOAN_APPROVAL','prestamo',config);snapshot.loan_payment_schedule=row.source_snapshot.loan_payment_schedule;
  assert.throws(()=>renderer.documentContract(snapshot),/DOCUMENT_SCHEDULE_PROCESS_UNRESOLVED/);
  const other=await add(input(),'MEMBERSHIP_APPROVAL');assert(!other.source_snapshot.loan_payment_schedule);
 });
 await test('loan system/custom PDFs display the same frozen table and keep preview parity',async()=>{
  const config={template:{id:'example',asset:{mime:'application/pdf'},page_size:{width:612,height:792},margins:{top:34,bottom:28,left:22,right:22}},signers:[{role:'Autoriza'}]},snapshot=renderer.syntheticSnapshot('LOAN_APPROVAL','prestamo',config);
  snapshot.loan_payment_schedule=await generate(input());snapshot.operation.financial=input().operation.financial;snapshot.signers[0].asset={mime:'image/png'};
  const template=await PDFLib.PDFDocument.create();template.addPage([612,792]);const bytes=await template.save(),sig=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH9sAAAAASUVORK5CYII=','base64'),load=async a=>a.mime==='image/png'?sig:bytes;
  for(const custom of [false,true]){
   if(custom){snapshot.layout={definition:layouts.initialLayout('LOAN_APPROVAL',config.template)};assert(snapshot.layout.definition.elements.some(e=>e.kind==='PAYMENT_SCHEDULE'));}
   const frozen=JSON.stringify(snapshot),render=renderer.createRenderer(PDFLib),a=await render(snapshot,load),b=await render(snapshot,load,{preview:true});assert.equal(a.pages,b.pages);assert.equal(JSON.stringify(snapshot),frozen);
   const doc=await PDFLib.PDFDocument.load(a.bytes),text=doc.getPages().flatMap(p=>p.node.Contents().asArray().flatMap(ref=>[...Buffer.from(PDFLib.decodePDFRawStream(doc.context.lookup(ref)).decode()).toString().matchAll(/<([0-9A-F]+)> Tj/g)].map(m=>Buffer.from(m[1],'hex').toString('latin1'))));assert(text.includes('$83.37'));assert(text.some(t=>t.includes('30 de octubre de 2026')));
  }
 });
 await test('recovery disables future enrichment while preserving every document row',async()=>{
  const before=await query('select * from document_private.records order by id');await db.exec(read('supabase/recovery/'+migration));assert.deepEqual(await query('select * from document_private.records order by id'),before);assert.equal((await query("select to_regprocedure('document_private.loan_payment_schedule(jsonb,date)') as value"))[0].value,null);
 });
 await db.close();console.log(JSON.stringify({status:'PASS',checks:checks.length,scope:'documentary loan calendar',qaResidualData:0,permanentQaFilesAdded:0,pdfsWritten:0}));
}
async function main(){
 const renderer=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/renderer.mjs')));
 const layouts=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/layout.mjs')));
 if(process.argv.includes('--render-only'))return rendererRegression(renderer,layouts);
 const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
 if(process.argv.includes('--loan-schedule-only'))return loanScheduleRegression(renderer,layouts,PGlite);
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
 create function public.admin_request_module_boundary(uuid) returns boolean language sql stable as $$select current_setting('test.module_denied',true) is distinct from 'true'$$;
 create function public.admin_module_boundary(text[]) returns boolean language sql stable as $$select current_setting('test.module_denied',true) is distinct from 'true'$$;
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
 create table loan_request_deposit_snapshots(request_id uuid,bank_name text,card_number text,clabe text,account_holder text);
 create table savings_audit_events(id bigint generated always as identity primary key,resource text,action text,after_data jsonb,usuario_contexto_affiliate_id uuid,actor_real_auth_user_id uuid,reason text);
 create table savings_requests(id uuid primary key,participant_id uuid);create table savings_participants(id uuid,affiliate_id uuid);
 create table savings_contribution_plans(enrollment_id uuid,source_request_id uuid,process_snapshot text,amount numeric,effective_from date,effective_to date);
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 `);
 await db.exec(`alter table affiliates add column rfc_raw text,add column curp_raw text,add column phone_raw text,add column historical_email_raw text,add column address_raw text,add column city_raw text,add column employment_position_raw text,add column employment_area_raw text,add column employment_level_raw text,add column occupation_raw text,add column subdirectorate_raw text,add column employment_entry_date_raw text,add column institute_entry_date_raw text,add column union_position_raw text,add column union_enrollment_date_raw text;create table segmentation_catalog_entries(catalog_type text,code text,label text,enabled boolean);update affiliates set rfc_raw='RFC-SYNTHETIC',curp_raw='CURP-SYNTHETIC',address_raw='Domicilio sintético';insert into segmentation_catalog_entries values('union','TEST','Sindicato sintético',true);`);
 await test('migration compiles in PostgreSQL without live data',()=>db.exec(read('supabase/migrations/20260928000100_document_generation_core.sql')));
 await db.exec(read('supabase/migrations/20260928000200_document_signer_assignment_order.sql'));
 await db.exec(read('supabase/migrations/20260928000300_document_layout_designer.sql'));
 await db.exec(read('supabase/migrations/20260928000400_document_layout_refinement.sql'));
 await db.exec(read('supabase/migrations/20260928000500_document_deposit_authorization.sql'));
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
   assert.equal(fields.some(f=>f.key==='bank.account_holder'),type==='LOAN_APPROVAL');
   await renderer.createRenderer(PDFLib)({...renderer.syntheticSnapshot(type,'auto',renderConfig),layout:{definition:draft}},async()=>templateBytes,{preview:true});
  }
  const invalid=structuredClone(design);invalid.elements[0].field='bank.account';assert(layouts.validateLayout(invalid,config.document_type,renderConfig.template).some(e=>e.includes('Campo no disponible')));
  invalid.elements=design.elements.filter(e=>e.field!=='identity.full_name');assert(layouts.validateLayout(invalid,config.document_type,renderConfig.template).some(e=>e.includes('obligatorio')));
  invalid.elements=structuredClone(design.elements);invalid.elements[0].x=-1;assert(layouts.validateLayout(invalid,config.document_type,renderConfig.template).some(e=>e.includes('fuera')));
  invalid.elements[0]={...invalid.elements[1],id:'duplicate-position'};assert(layouts.validateLayout(invalid,config.document_type,renderConfig.template).some(e=>e.includes('superpuestos')));
  assert.equal(layouts.formatField(25000,'MONEY'),'$25,000.00');assert.match(layouts.formatField('2026-09-28','DATE'),/28.*septiembre.*2026/);assert.equal(layouts.formatField(2,'PERCENT'),'2.00 %');assert.equal(layouts.formatField('12345678','MASKED_BANK_ACCOUNT'),'**** 5678');assert.equal(layouts.formatField(24,'INTEGER'),'24');assert.equal(layouts.formatField(null,'TEXT','na'),'No aplica');assert.equal(layouts.formatField(null,'TEXT','hide'),null);assert.equal(layouts.formatField(null,'TEXT','empty'),'');
 });
 await test('refinement: physical page freedom, named fit errors, draft preview and exact template margins',async()=>{
  assert(!layouts.layoutFields(config.document_type).some(f=>f.key==='document.note'));
  assert(layouts.layoutFields(config.document_type).some(f=>f.key==='identity.affiliate.rfc'));
  assert(!layouts.layoutFields(config.document_type).some(f=>/auth_user|archive|bank.account/.test(f.key)));
  const outside=structuredClone(design);Object.assign(outside.elements[0],{x:1,y:1});assert.deepEqual(layouts.validateLayout(outside,config.document_type,renderConfig.template),[]);
  const legacy=historicalLayout(layouts,config.document_type,renderConfig.template,'suti-layout-1');assert.deepEqual(layouts.validateLayout(legacy,config.document_type,renderConfig.template),[]);
  await renderer.createRenderer(PDFLib)({...synthetic,layout:{definition:legacy}},async()=>templateBytes,{preview:true});legacy.elements[0].x=1;assert(layouts.validateLayout(legacy,config.document_type,renderConfig.template).some(x=>x.includes('márgenes')));
  const short=structuredClone(design);Object.assign(short.elements[0],{width:8,height:4,size:12});
  const deps={contextCall:async(a,d)=>{await actor(uid,permissions);return layoutCall(a,d);},command:call,persist:layoutPersist,render:renderer.createRenderer(PDFLib),loadAsset:async()=>templateBytes};
  const failed=await handleLayout({action:'LAYOUT_PREVIEW',...config,definition:short},deps);assert.equal(failed.status,409);assert.equal(failed.data.details[0].element_id,short.elements[0].id);assert.equal(failed.data.details[0].element_label,'Título del documento');assert(failed.data.details[0].required_height>4);
  const draft={...outside,elements:outside.elements.slice(0,1)};const preview=await handleLayout({action:'LAYOUT_PREVIEW',...config,definition:draft},deps);assert(preview.pdf.length>1000);assert.equal((await handleLayout({action:'LAYOUT_SAVE',...config,definition:draft},deps)).status,409);
  const small=await call('SAVE_TEMPLATE',{previous_id:template.id,asset_id:asset.id,name:'Márgenes de 10 mm',margins:{top:10,left:10,right:10,bottom:10},valid_from:'2020-01-01'});
  const manifest=await handleLayout({action:'LAYOUT_MANIFEST',...config,template_id:small.id},deps);assert.deepEqual(manifest.data.template.margins,{top:10,left:10,right:10,bottom:10});assert(manifest.data.templates.some(t=>t.id===small.id));
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
 await test('optional affiliate fields are frozen once and never fetched at render time',async()=>{
  await db.exec('reset role');const frozen=await scalar('select source_snapshot v from document_private.records where id=$1',[recordId]);assert.equal(frozen.identity.affiliate.rfc,'RFC-SYNTHETIC');assert.equal(frozen.identity.union_label,'Sindicato sintético');assert.equal(frozen.affiliate_fields_version,'1');assert(!JSON.stringify(frozen.identity).includes('auth_user_id'));await q("update affiliates set rfc_raw='RFC-CHANGED' where id=$1",[uid]);assert.equal((await scalar('select source_snapshot v from document_private.records where id=$1',[recordId])).identity.affiliate.rfc,'RFC-SYNTHETIC');
 });
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
   if(type==='LOAN_APPROVAL')await q('insert into loan_request_deposit_snapshots(request_id,bank_name,card_number,clabe) values($1,$2,$3,$4)',[op,'Banco sintético','1234567890123456','123456789012345678']);
   await q("insert into program_request_admin_events values($1,$2,$3,'approved','in_review',now())",[crypto.randomUUID(),op,uid]);
   const snapshot=await scalar('select document_snapshot v from document_private.records where operation_id=$1',[op]);assert.equal(snapshot.document_type,type);renderer.documentContract(snapshot);if(type==='LOAN_APPROVAL'){assert.equal(snapshot.bank.card_last4,'3456');assert.equal(snapshot.bank.card_number,'1234567890123456');assert.equal(snapshot.bank.clabe,'123456789012345678');assert.equal(snapshot.bank.disclosure,'FULL_DEPOSIT');}
  }
 });
 await test('scoped layout migration preserves records and existing versions with private permissions',async()=>{
  await db.exec('reset role');
  await db.exec("create table financial_funds(program_id text,name text,enabled boolean,publication_status text);insert into financial_funds values('prestamo','Fondo A',true,'PUBLISHED'),('prestamo','Fondo B',true,'PUBLISHED'),('nomina','Fondo A',true,'PUBLISHED'),('caja','Caja Chica',true,'PUBLISHED');");
  const sql=read('supabase/migrations/20260826000100_authenticated_loan_snapshot_quote_rpc.sql'),start=sql.indexOf('create function public.normalize_suti_financial_key(');await db.exec(sql.slice(start,sql.indexOf('$$;',start)+3));
  const records=await q('select * from document_private.records order by id'),versions=await q('select id,definition from document_private.layouts order by id');
  await db.exec(read('supabase/migrations/20260929000200_document_layout_scopes.sql'));
  assert.deepEqual(await q('select * from document_private.records order by id'),records);assert.deepEqual(await q('select id,definition from document_private.layouts order by id'),versions);
  for(const role of ['anon','authenticated'])assert.equal(await scalar("select has_function_privilege($1,'public.document_layout_persist(text,jsonb)','execute') v",[role]),false);
  await actor(other,[]);await assert.rejects(layoutCall('READ',{program:'prestamo',document_type:'LOAN_APPROVAL'}),/PERMISSION_DENIED/);
 });
 const scopeSave=async(program,type,name)=>{await db.exec('reset role');return layoutPersist('SAVE',{id:crypto.randomUUID(),actor:uid,program,document_type:type,name,template_id:template.id,definition:layouts.initialLayout(type,renderConfig.template)});};
 const scopeActivate=async(version,assignments,id=crypto.randomUUID())=>{await db.exec('reset role');return layoutPersist('ACTIVATE',{id,actor:uid,program:version.program,document_type:version.document_type,layout_id:version.id,assignments});};
 const target=async(program,type,fund_key='')=>{await actor(uid,permissions);return (await layoutCall('READ',{program,document_type:type,fund_key})).destinations.filter(d=>d.program===program&&d.fund_key===fund_key).map(({program,fund_key,expected_id})=>({program,fund_key,expected_id}))[0];};
 let scopedLoan;
 await test('program defaults, fund overrides, sharing, stale conflicts and atomic idempotent activation',async()=>{
  await actor(uid,permissions);for(const [program,document_type] of [['nomina','LOAN_APPROVAL'],['tours','PROGRAM_FINANCING_APPROVAL']])await call('SAVE_CONFIGURATION',{...config,program,document_type});
  scopedLoan=await scopeSave('prestamo','LOAN_APPROVAL','Loan general');const mapped=await target('prestamo','LOAN_APPROVAL','CAJA CHICA');assert(mapped,'Caja Chica catalog ownership does not hide the loan request destination');const common=await target('prestamo','LOAN_APPROVAL');await scopeActivate(scopedLoan,[common]);
  const special=await scopeSave('prestamo','LOAN_APPROVAL','Fund A only'),a=await target('prestamo','LOAN_APPROVAL','FONDO A'),n=await target('nomina','LOAN_APPROVAL','FONDO A'),id=crypto.randomUUID();
  await scopeActivate(special,[a,n,mapped],id);assert.deepEqual(await scopeActivate(special,[a,n,mapped],id),{id,layout_id:special.id});
  const source=fund=>JSON.stringify({operation:{financial:{financialResult:{fund}}}}),resolve=async(program,fund)=>{await db.exec('reset role');return scalar('select document_private.resolve_scoped_layout($1,$2,clock_timestamp(),$3) v',[program,'LOAN_APPROVAL',source(fund)]);};
  assert.equal((await resolve('prestamo','Fondo A')).layout.id,special.id);assert.equal((await resolve('prestamo','Fondo B')).layout.id,scopedLoan.id);assert.equal((await resolve('nomina','Fondo A')).layout.id,special.id);assert.equal((await resolve('prestamo','Caja Chica')).layout.id,special.id);
  await assert.rejects(scopeActivate(scopedLoan,[a]),/ASSIGNMENT_CHANGED/);await assert.rejects(scopeActivate(scopedLoan,[await target('prestamo','LOAN_APPROVAL','FONDO B'),{program:'nomina',fund_key:'FONDO B',expected_id:null}]),/FUND_INVALID/);
  assert.equal((await resolve('prestamo','Fondo B')).layout.id,scopedLoan.id);
  const t=await target('prestamo','LOAN_APPROVAL','FONDO A');await db.exec('reset role');await layoutPersist('UNASSIGN',{id:crypto.randomUUID(),actor:uid,program:'prestamo',document_type:'LOAN_APPROVAL',assignments:[t]});await assert.rejects(resolve('prestamo','Fondo A'),/ASSIGNMENT_MISSING/);
  await scopeActivate(special,[await target('prestamo','LOAN_APPROVAL','FONDO A')]);
  const travel=await scopeSave('auto','PROGRAM_FINANCING_APPROVAL','Shared product authorization');await scopeActivate(travel,[await target('auto','PROGRAM_FINANCING_APPROVAL'),await target('tours','PROGRAM_FINANCING_APPROVAL')]);
  await actor(uid,permissions);assert.equal((await layoutCall('READ',{program:'tours',document_type:'PROGRAM_FINANCING_APPROVAL'})).active_id,travel.id);
 });
 await test('final event uses its exact fund layout; missing assignments fail only the document',async()=>{
  await db.exec('reset role');
  const eventsBefore=await scalar('select count(*)::integer v from program_request_admin_events');
  for(const [program,fund,ok] of [['prestamo','Fondo B',true],['nomina','Fondo B',false]]){
   await db.exec('reset role');const op=crypto.randomUUID(),financial=structuredClone(synthetic.operation.financial);financial.financialResult.fund=fund;
   await q('insert into program_requests(id,affiliate_id,folio,program_id,financial_approval_snapshot) values($1,$2,$3,$4,$5)',[op,uid,'SYNTHETIC-SCOPE',program,JSON.stringify(financial)]);
   await q("insert into program_request_admin_events values($1,$2,$3,'approved','in_review',now())",[crypto.randomUUID(),op,uid]);
   const record=(await q('select * from document_private.records where operation_id=$1',[op]))[0];assert.equal(record.source_snapshot.layout_scope_version,'1');
   if(ok){assert.equal(record.document_snapshot.layout.id,scopedLoan.id);assert.equal(record.status,'PENDING');const before=structuredClone(record.document_snapshot);await scopeActivate(await scopeSave('prestamo','LOAN_APPROVAL','Replacement'),[await target('prestamo','LOAN_APPROVAL')]);await db.exec('reset role');assert.deepEqual(await scalar('select document_snapshot v from document_private.records where id=$1',[record.id]),before);}
   else {assert.equal(record.error_code,'DOCUMENT_LAYOUT_ASSIGNMENT_MISSING');assert.equal(record.document_snapshot,null);}
  }
  await db.exec('reset role');assert.equal(await scalar('select count(*)::integer v from program_request_admin_events'),eventsBefore+2);
 });
 await test('default and editable rendering are identical, labels are controlled and disclaimer is absent',async()=>{
  for(const type of Object.keys(renderer.TITLES)){
   const s=renderer.syntheticSnapshot(type,'example',renderConfig),render=renderer.createRenderer(PDFLib),a=await render(s,async()=>templateBytes,{preview:true});s.layout={definition:layouts.initialLayout(type,renderConfig.template)};const b=await render(s,async()=>templateBytes,{preview:true});assert.equal(Buffer.compare(a.bytes,b.bytes),0);
  }
  const s=renderer.syntheticSnapshot('LOAN_APPROVAL','prestamo',renderConfig);assert.equal(renderer.documentContract(s).note,'');s.layout={definition:layouts.initialLayout('LOAN_APPROVAL',renderConfig.template)};s.layout.definition.elements.find(e=>e.field==='identity.full_name').label='Custom beneficiary';const out=await renderer.createRenderer(PDFLib)(s,async()=>templateBytes,{preview:true}),pdf=await PDFLib.PDFDocument.load(out.bytes),text=pdf.getPages().flatMap(p=>p.node.Contents().asArray().flatMap(ref=>[...Buffer.from(PDFLib.decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString().matchAll(/<([0-9A-F]+)> Tj/g)].map(m=>Buffer.from(m[1],'hex').toString('latin1'))));assert(text.includes('Custom beneficiary'));assert(!text.some(t=>t.includes('No acredita')));
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
    if(result.status!==200)return {failure:result.data};
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
   window.SutiSupabase={getClient:()=>({rpc:async(name,p)=>{try{return {data:await window.__command(p.p_action,p.p_data)}}catch(e){return {error:e}}},functions:{invoke:async(name,{body})=>{try{const value=await window.__edge(body);if(value.failure)return {error:{context:{json:async()=>value.failure}}};if(value.base64){const bytes=Uint8Array.from(atob(value.base64),c=>c.charCodeAt(0));return {data:new Blob([bytes],{type:'application/pdf'})};}return {data:value};}catch(e){return {error:e}}}}})};
  },{uid});
  for(const f of ['document-generation-design.js','document-generation-repository.js','document-layout-repository.js','document-layout-designer.jsx','screens-admin-document-generation.jsx'])await page.addScriptTag({content:f.endsWith('.jsx')?sandbox.Babel.transform(read('app/'+f),{presets:['react']}).code:read('app/'+f)});
  await page.evaluate(()=>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.AdminDocumentGeneration,{app:{},onBack:()=>{}})));
  await page.getByRole('button',{name:'Usar como activa',exact:true}).first().click();await page.getByRole('button',{name:'Activar plantilla',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Firmantes\s*\d/}).click();await page.getByLabel('Buscar firmante').fill('no coincide');assert.equal(await page.locator('.df-fi').count(),0);await page.getByLabel('Buscar firmante').fill('');assert.equal(await page.locator('.df-fi').count(),1);
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByLabel('Nombre completo',{exact:true}).fill('Firmante editado sintético');if(await page.getByRole('dialog').getByRole('button',{name:'Nómina',exact:true}).getAttribute('aria-pressed')!=='true')await page.getByRole('dialog').getByRole('button',{name:'Nómina',exact:true}).click();await page.getByRole('dialog').getByLabel('Autorización de préstamo',{exact:true}).last().check();await page.getByRole('button',{name:'Guardar nueva versión'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('select').filter({has:page.locator('option[value="false"]')}).selectOption('false');await page.getByRole('button',{name:'Guardar nueva versi\u00f3n'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.df-fi.is-off').count(),1);await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('select').filter({has:page.locator('option[value="false"]')}).selectOption('true');await page.getByRole('button',{name:'Guardar nueva versi\u00f3n'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Firmas por programa/}).click();await page.getByLabel('Buscar programa').fill('Autos');await page.locator('.df-pr').first().getByRole('button',{name:'Configurar',exact:true}).click();assert.equal(await page.locator('.df-ord__row').count(),1);await page.getByRole('button',{name:'Vista previa',exact:true}).click();await page.getByRole('dialog',{name:'Vista previa del documento'}).waitFor();await page.keyboard.press('Escape');
  await page.locator('.df-pr').first().getByRole('button',{name:'Configurar',exact:true}).click();await page.getByRole('button',{name:'Diseñar documento',exact:true}).click();await page.getByRole('dialog',{name:'Diseñar documento',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.dl-host button.df-btn--pri')?.disabled,{},{timeout:30000});
  await page.getByLabel('Programa del documento').selectOption('tours');await page.waitForFunction(()=>document.querySelector('[aria-label="Programa del documento"]')?.value==='tours'&&!document.querySelector('.dl-host button.df-btn--pri')?.disabled);await page.getByLabel('Programa del documento').selectOption('auto');await page.waitForFunction(()=>document.querySelector('[aria-label="Programa del documento"]')?.value==='auto'&&!document.querySelector('.dl-host button.df-btn--pri')?.disabled);assert.equal(await page.getByRole('button',{name:'Usar diseño del sistema',exact:true}).count(),0);await page.getByLabel('Nombre del diseño').fill('Autorización compartida de prueba');await page.getByLabel(/Viajes · General del programa/).check();assert.equal(await page.locator('.dl-field[data-field^="bank."]').count(),0);assert(await page.locator('canvas[aria-label="Membrete PDF real"]').evaluate(c=>c.width>0));
  assert.equal(await page.locator('.dl-field[data-field="document.note"]').count(),0);assert.equal(await page.locator('.dl-field[data-field="identity.affiliate.rfc"]').count(),1);assert(await page.locator('.dl-element-label').count()>0);
  const first=page.locator('.dl-element').first();await first.click();await page.getByLabel('X · mm',{exact:true}).fill('1');await page.getByLabel('Y · mm',{exact:true}).fill('1');await page.getByLabel('Ancho · mm',{exact:true}).fill('8');await page.getByLabel('Alto · mm',{exact:true}).fill('4');await page.getByRole('button',{name:'Vista previa PDF',exact:true}).click();await page.getByRole('button',{name:/Título del documento.*Seleccionar campo/}).waitFor();assert.equal(await page.locator('.dl-element.is-invalid').count(),1);await page.getByRole('button',{name:'Ajustar alto',exact:true}).click();assert(Number(await page.getByLabel('Alto · mm',{exact:true}).inputValue())>4);await page.getByLabel('Ancho · mm',{exact:true}).fill(String(design.elements[0].width));await page.getByLabel('Alto · mm',{exact:true}).fill('14');
  await page.getByRole('button',{name:'+ Página',exact:true}).click();const sheet=page.locator('.dl-page');
  await page.locator('.dl-field[data-field="operation.financial.price_source"]').dragTo(sheet,{targetPosition:{x:80,y:100}});
  const dragged=page.locator('.dl-element').last();await dragged.click();assert.equal(await page.getByLabel('X · mm',{exact:true}).inputValue(),'32');assert.equal(await page.getByLabel('Y · mm',{exact:true}).inputValue(),'40');
  const box=await dragged.boundingBox();await page.mouse.move(box.x+15,box.y+8);await page.mouse.down();await page.mouse.move(box.x+40,box.y+33,{steps:5});await page.mouse.up();assert.equal(await page.getByLabel('X · mm',{exact:true}).inputValue(),'42');assert.equal(await page.getByLabel('Y · mm',{exact:true}).inputValue(),'50');
  const handle=await page.getByRole('button',{name:'Redimensionar elemento'}).boundingBox();await page.mouse.move(handle.x+6,handle.y+6);await page.mouse.down();await page.mouse.move(handle.x+31,handle.y+16,{steps:4});await page.mouse.up();assert.equal(await page.getByLabel('Ancho · mm',{exact:true}).inputValue(),'75');
  await page.getByRole('button',{name:'+ Texto',exact:true}).click();await page.getByLabel('Texto',{exact:true}).fill('Información general');await page.getByLabel('Y · mm',{exact:true}).fill('85');
  const preserved=await page.locator('.dl-element').last().getAttribute('style');const ten=await page.getByLabel('Membrete del diseño').locator('option').evaluateAll(options=>options.find(o=>o.textContent.includes('Márgenes de 10 mm')).value);await page.getByLabel('Membrete del diseño').selectOption(ten);await page.waitForFunction(()=>document.querySelector('.dl-safe')?.style.top==='25px');assert.equal(await page.locator('.dl-safe').evaluate(e=>e.style.bottom),'25px');assert.equal(await page.locator('.dl-element').last().getAttribute('style'),preserved);
  await page.getByRole('button',{name:'Vista previa PDF',exact:true}).click();await page.locator('canvas[aria-label="Vista previa PDF del diseño"][data-rendered="true"]').waitFor();assert(await page.locator('.dl-pdf-preview canvas').evaluate(c=>c.width>0&&c.height>0));await page.getByRole('button',{name:'Página siguiente',exact:true}).click();await page.locator('.dl-pdf-preview canvas[data-rendered="true"]').waitFor();await page.getByRole('button',{name:'Volver al diseño'}).click();
  await page.waitForFunction(()=>!document.querySelector('.dl-host button.df-btn--pri')?.disabled);await page.getByRole('button',{name:'Activar diseño',exact:true}).click();await page.getByText(/Versión \d+ activa para documentos nuevos/).waitFor();
  await page.getByLabel('Página del diseño').selectOption(String(design.pages+1));await page.locator('.dl-element').filter({hasText:'Origen del precio'}).click();assert.equal(await page.getByLabel('X · mm',{exact:true}).inputValue(),'42');assert.equal(await page.getByLabel('Ancho · mm',{exact:true}).inputValue(),'75');
  for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'designer contains its canvas scrolling');assert(await page.getByRole('button',{name:'Activar diseño',exact:true}).isVisible());}
  if(process.env.SUTIAPP_LAYOUT_INSPECT_PNG)await page.screenshot({path:process.env.SUTIAPP_LAYOUT_INSPECT_PNG});
  await page.getByRole('dialog',{name:'Diseñar documento',exact:true}).getByRole('button',{name:'Cerrar',exact:true}).last().click();await page.keyboard.press('Escape');
  await page.getByLabel('Buscar programa').fill('Préstamos');await page.locator('.df-pr').first().getByRole('button',{name:'Configurar',exact:true}).click();await page.getByRole('button',{name:'Diseñar documento',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.dl-host button.df-btn--pri')?.disabled);await page.getByLabel('Fondo del documento').selectOption('FONDO A');await page.waitForFunction(()=>document.querySelector('[aria-label="Fondo del documento"]')?.value==='FONDO A'&&!document.querySelector('.dl-host button.df-btn--pri')?.disabled);assert.equal(await page.getByLabel('Nombre del diseño').inputValue(),'Fund A only');await page.getByRole('button',{name:'Duplicar diseño',exact:true}).click();await page.getByLabel('Nombre del diseño').fill('Fondo A personalizado');await page.getByRole('button',{name:'Activar diseño',exact:true}).click();await page.getByText(/Versión \d+ activa para documentos nuevos/).waitFor();await page.getByLabel('Fondo del documento').selectOption('FONDO B');await page.waitForFunction(()=>document.querySelector('[aria-label="Fondo del documento"]')?.value==='FONDO B'&&!document.querySelector('.dl-host button.df-btn--pri')?.disabled);assert.equal(await page.getByLabel('Nombre del diseño').inputValue(),'Replacement');await page.getByRole('dialog',{name:'Diseñar documento',exact:true}).getByRole('button',{name:'Cerrar',exact:true}).last().click();await page.keyboard.press('Escape');

  await page.getByRole('button',{name:/Plantillas\s*\d/}).click();await page.getByRole('button',{name:'Subir nueva plantilla',exact:true}).click();await page.locator('input[type=file]').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from(templateBytes)});await page.getByLabel('Nombre de la plantilla').fill('Segundo membrete sintético');await page.getByRole('button',{name:'Guardar sin activar'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByLabel('Margen superior').fill('45');assert.equal(await page.locator('.df-mrow__v').first().innerText(),'45 mm');await page.getByRole('button',{name:'Guardar como nueva versión'}).click();await page.getByRole('button',{name:'Guardar sin activar'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){await page.setViewportSize(viewport);assert(await page.locator('.df-kpis').isVisible());assert.equal(await page.locator('.df-kpi').count(),3);assert.equal(await page.locator('.df-panel--pl .df-side').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal page overflow');}
  await page.evaluate(()=>{window.Icon=()=>null;window.__authListeners=[];window.AffiliateAuth.subscribe=fn=>{__authListeners.push(fn);return()=>{__authListeners=__authListeners.filter(f=>f!==fn);};};window.__docCalls=[];window.__docRows=[];window.__docContext='one';window.DocumentGenerationRepository={context:()=>__docContext,list:async data=>{__docCalls.push(['list',data]);return __docRows;},access:async(id,admin)=>{__docCalls.push(['access',id,admin]);return {url:'https://document-test.invalid/authorization.pdf'};}};});
  await page.addScriptTag({content:read('app/image-viewer.jsx')});
  for(const screen of ['app/screens-admin-finanzas.jsx','app/screens-admin-requests.jsx']){
   const source=read(screen),marker='function RowAuthorizationPdf({row})';assert(source.includes(marker));
   await page.addScriptTag({content:source.replace(marker,'window.__RowAuthorizationPdf=RowAuthorizationPdf; '+marker)});
   await page.evaluate(()=>{window.__pdfRoot=ReactDOM.createRoot(document.body.appendChild(document.createElement('div')));window.__parentClicks=0;window.__showPdfRow=status=>__pdfRoot.render(React.createElement('div',{onClick:()=>__parentClicks++},React.createElement(__RowAuthorizationPdf,{row:{id:'request-pdf',folio:'SYNTHETIC',status}})));__showPdfRow('submitted');});
   assert.equal(await page.locator('[data-authorization-pdf]').count(),0);await page.evaluate(()=>__showPdfRow('approved'));const button=page.getByRole('button',{name:'Ver autorización PDF',exact:true});await button.waitFor();
   assert.equal(await page.evaluate(()=>__docCalls.filter(c=>c[0]==='list').length),0,'demand only');await button.click();await page.getByText('Esta solicitud aún no tiene una autorización PDF emitida.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>__parentClicks),0);
   await page.evaluate(()=>{__docRows=[{id:'old',status:'READY',business_version:1},{id:'new',status:'PENDING',business_version:2}];});await button.click();await page.getByText(/La autorización PDF se está preparando/).waitFor();assert.equal(await page.evaluate(()=>__docCalls.filter(c=>c[0]==='access').length),0,'do not silently open an obsolete revision');
   await page.evaluate(()=>__docRows[1].status='READY');await button.click();await page.locator('[data-document-viewer="pdf"]').waitFor();assert.deepEqual(await page.evaluate(()=>__docCalls.at(-1)),['access','new',true]);assert.deepEqual(await page.evaluate(()=>__docCalls.find(c=>c[0]==='list')[1]),{domain:'program',operation_id:'request-pdf',admin:true});await page.getByRole('button',{name:'Cerrar visor'}).click();
   await button.click();await page.locator('[data-document-viewer="pdf"]').waitFor();await page.evaluate(()=>{__docContext='changed';__authListeners.forEach(f=>f());});await page.locator('[data-document-viewer="pdf"]').waitFor({state:'hidden'});
   await page.evaluate(()=>{__pdfRoot.unmount();__docCalls=[];__docRows=[];__docContext='one';});
  }
  await page.addScriptTag({content:read('app/private-resource-demand.js')});
  await page.addScriptTag({content:read('app/screens-admin-finanzas.jsx').replace('function DesktopFinancialWorkbench(', 'window.__PdfWorkbench=DesktopFinancialWorkbench; function DesktopFinancialWorkbench(')});
  await page.evaluate(()=>{window.AffiliateRepository={getProfilePhoto:async()=>null};window.AdminFinanceQueueRepository={enrich:async rows=>rows};const base={id:'ready-request',affiliate_id:'synthetic-affiliate',nombre:'Persona sintética',folio:'SYNTHETIC-ROW',numero_control:'001',program_id:'prestamo',requested_fund:'Fondo de ejemplo',created_at:new Date().toISOString(),ts:1,status:'approved',workflow_state:{stages:[]}};window.ProgramRequestRepository={listAdminFlowQueue:async()=>[base,{...base,id:'pending-request',status:'submitted'}],adminFlowDetail:async()=>base};window.__workRoot=ReactDOM.createRoot(document.body.appendChild(document.createElement('div')));__workRoot.render(React.createElement(__PdfWorkbench,{app:{admin:{has:()=>false}},onCount:()=>{}}));});
  await page.locator('[data-financial-queue-row="ready-request"]').waitFor();assert.equal(await page.locator('[data-authorization-pdf]').count(),1);assert.equal(await page.locator('button button').count(),0);
  for(const width of [390,1440]){await page.setViewportSize({width,height:1000});const row=page.locator('[data-financial-queue-row="ready-request"]');await row.getByRole('button',{name:'Ver autorización PDF',exact:true}).click();await row.getByText(/aún no tiene una autorización PDF/).waitFor();assert.equal(await page.locator('dialog[open]').count(),0);assert(await row.getByRole('button',{name:'Ver autorización PDF',exact:true}).isVisible());}
  await page.evaluate(()=>__workRoot.unmount());
  assert.deepEqual(errors,[]);await browser.close();await db.exec('reset role');
 });
 await test('full frozen deposit identifiers, legacy masking and one-page three-signer authorization',async()=>{
  const snapshot=renderer.syntheticSnapshot('LOAN_APPROVAL','prestamo',renderConfig),draft=historicalLayout(layouts,'LOAN_APPROVAL',renderConfig.template);
  // Preserve this historical one-page field/signature fixture; schedules have their own pagination checks.
  draft.elements=draft.elements.filter(e=>e.kind==='FIELD');draft.pages=1;
  draft.elements.forEach((e,n)=>Object.assign(e,{page:1,x:22,y:34+n*12,width:160,height:10}));
  for(const [n,key] of ['bank.card_number','bank.clabe'].entries())draft.elements.push({id:'deposit_'+n,kind:'FIELD',field:key,page:1,x:22,y:130+n*12,width:160,height:10,font:'Helvetica',size:10,weight:'regular',align:'left',format:'TEXT',missing:'hide'});
  draft.elements.push({id:'three_signers',kind:'SIGNERS',field:'signers',page:1,x:10,y:202,width:195,height:55,font:'Helvetica',size:10,weight:'regular',align:'center',columns:3,gap:5,orientation:'horizontal'});
  snapshot.layout={definition:draft};snapshot.signers=Array.from({length:3},(_,n)=>({...snapshot.signers[0],full_name:'Responsable de ejemplo '+n,title:'Responsable institucional del programa',role:'Autoriza'}));
  const out=await renderer.createRenderer(PDFLib)(snapshot,async()=>templateBytes,{preview:true});assert.equal(out.pages,1);
  const pdf=await PDFLib.PDFDocument.load(out.bytes),contents=pdf.getPage(0).node.Contents().asArray().map(ref=>Buffer.from(PDFLib.decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');
  for(const value of [snapshot.bank.card_number,snapshot.bank.clabe])assert(contents.toLowerCase().includes(Buffer.from(value).toString('hex')),'complete banking text reaches PDF');
  const binding={field:'bank.clabe_last4',format:'MASKED_BANK_ACCOUNT',missing:'hide'};
  assert.equal(layouts.boundField(snapshot,binding,{}),snapshot.bank.clabe);const old=structuredClone(snapshot);delete old.bank.disclosure;delete old.bank.card_number;delete old.bank.clabe;assert.equal(layouts.boundField(old,binding,{}),'**** 5666');
 });
 await test('program operators inherit source access and module boundaries without configuration grants',async()=>{
  await actor(other,['program_requests.read']);assert((await call('LIST',{admin:true})).some(r=>r.id===recordId));assert.equal((await call('ACCESS',{admin:true,id:recordId})).id,recordId);await assert.rejects(call('DASHBOARD'),/PERMISSION_DENIED/);await assert.rejects(call('REISSUE',{id:recordId,revision_id:crypto.randomUUID()}),/PERMISSION_DENIED/);
  await db.exec('reset role');await q("select set_config('test.module_denied','true',false)");await actor(other,['program_requests.read','document_generation.read']);assert.deepEqual(await call('LIST',{admin:true}),[]);await assert.rejects(call('ACCESS',{admin:true,id:recordId}),/ACCESS_DENIED/);
  await db.exec('reset role');await q("select set_config('test.module_denied','false',false)");await actor(other,['document_generation.read']);assert.deepEqual(await call('LIST',{admin:true}),[]);
 });
 await test('documentary revisions preserve old PDF, identity, money and signers; retries never authorize again',async()=>{
  await db.exec('reset role');const old=(await q('select * from document_private.records where id=$1',[recordId]))[0],events=await scalar('select count(*)::integer v from program_request_admin_events');
  await actor(uid,permissions);const key=crypto.randomUUID(),a=await call('REISSUE',{id:recordId,revision_id:key}),b=await call('REISSUE',{id:recordId,revision_id:key});assert.deepEqual(a,b);assert.equal(a.business_version,2);await assert.rejects(call('REISSUE',{id:recordId,revision_id:crypto.randomUUID()}),/REVISION_ALREADY_EXISTS/);
  const list=await call('LIST',{admin:true,operation_id:request});assert.equal(list.length,2);assert.equal(list.find(r=>r.id===recordId).can_reissue,false);assert.equal(list.find(r=>r.id===key).business_version,2);
  await db.exec('reset role');const fresh=(await q('select * from document_private.records where id=$1',[key]))[0];assert.deepEqual(fresh.document_snapshot.identity,old.document_snapshot.identity);assert.deepEqual(fresh.document_snapshot.operation,old.document_snapshot.operation);assert.deepEqual(fresh.document_snapshot.signers,old.document_snapshot.signers);assert.deepEqual((await q('select * from document_private.records where id=$1',[recordId]))[0],old);assert.equal(await scalar('select count(*)::integer v from program_request_admin_events'),events);
 });
 await test('version replacement retains historical identity and template',async()=>{
  await actor(uid,permissions);const next=await call('SAVE_TEMPLATE',{previous_id:template.id,asset_id:asset.id,name:'Nueva versión',margins:{top:40,bottom:28,left:22,right:22},valid_from:'2020-01-01'});assert(next.version>=2);
  await call('SAVE_SIGNER',{previous_id:signer.id,asset_id:sig.id,full_name:'Nombre nuevo',title:'Cargo nuevo',valid_from:'2020-01-01',enabled:false});await db.exec('reset role');
  assert.equal((await scalar('select document_snapshot v from document_private.records where id=$1',[recordId])).template.id,template.id);await assert.rejects(q('delete from document_private.templates'),/IMMUTABLE/);
  await actor(uid,permissions);await assert.rejects(call('PREVIEW_CONFIG',{program:'auto',document_type:'PROGRAM_FINANCING_APPROVAL'}),/SIGNER_NOT_EFFECTIVE/);await db.exec('reset role');
 });
 await test('recovery disables generation without deleting historical documents',async()=>{const count=await scalar('select count(*)::integer v from document_private.records'),layoutCount=await scalar('select count(*)::integer v from document_private.layouts');const history=await q('select * from document_private.records order by id');await db.exec(read('supabase/recovery/20260929000200_document_layout_scopes.sql'));assert.deepEqual(await q('select * from document_private.records order by id'),history);assert.equal(await scalar('select enabled v from document_private.installation'),false);await db.exec(read('supabase/recovery/20260928000500_document_deposit_authorization.sql'));await db.exec(read('supabase/recovery/20260928000400_document_layout_refinement.sql'));await db.exec(read('supabase/recovery/20260928000300_document_layout_designer.sql'));assert.equal(await scalar('select count(*)::integer v from document_private.layouts'),layoutCount);await db.exec(read('supabase/recovery/20260928000100_document_generation_core.sql'));assert.equal(await scalar('select count(*)::integer v from document_private.records'),count);assert.equal(await scalar('select enabled v from document_private.installation'),false);});
 console.log(JSON.stringify({status:'PASS',checks:checks.length,permanentQaPdfs:0,residualData:0,productionTouched:false}));
 }finally{if(activeBrowser)await activeBrowser.close();await db.close();}
}
main().catch(e=>{console.error(e.message,e.detail||'',e.position||'',e.query?.slice(0,900)||'');process.exitCode=1;});
