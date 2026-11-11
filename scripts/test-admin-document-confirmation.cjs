'use strict';
// Actual React, Admin screen/repository and document workflow; isolated adapters only.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const index=process.argv.indexOf('--out'),output=path.resolve(root,index<0?'docs/qa/evidence/document-flow-surgical-20261110/admin-after.json':process.argv[index+1]);
const cases=[],pageErrors=[];
const file={name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nsynthetic adapter bytes\n%%EOF')};
async function check(name,test){try{await test();cases.push({name,status:'PASS'});}catch(error){cases.push({name,status:'FAIL',error:error.message});}}
async function main(){
 const server=http.createServer((req,res)=>res.end('<!doctype html><html><body><main id="root"></main></body></html>'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 async function fixture(options={}){
  const page=await browser.newPage({viewport:{width:1100,height:900}});page.setDefaultTimeout(3000);
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port);
  for(const source of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(source)});
  await page.evaluate(options=>{
   window.Icon=()=>null;window.epoch=1;window.calls=[];window.toasts=[];window.pending=!!options.pending;window.failDetail=false;window.failOrdinal=false;window.failUpload=false;window.noReplace=!!options.noReplace;
   window.profiles=[{id:'00000000-0000-4000-8000-000000000001',display_name:'Synthetic One',numero_control:'SYNTH-1',affiliate_status_raw:'Activo'},{id:'00000000-0000-4000-8000-000000000002',display_name:'Synthetic Two',numero_control:'SYNTH-2',affiliate_status_raw:'Activo'}];
   window.types=[{id:'10000000-0000-4000-8000-000000000001',code:'test_document',label:'Documento sintético',accepted_mime_types:['application/pdf'],file_upload_allowed:true,max_file_size_bytes:104857600}];
   window.rows=[{id:'20000000-0000-4000-8000-000000000001',affiliate_id:profiles[0].id,document_type_id:types[0].id,document_type:types[0],status:'VERIFIED',mimeType:'application/pdf',available:true,version:4,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'}];
   window.original=JSON.stringify(rows[0]);window.registered=null;
   window.PrivateResourceDemand={context:()=>epoch,useContext:()=>epoch,useVisible:()=>false,useSource:()=>({url:'',error:false,onError(){}})};
   window.AdminRepository={has:permission=>['affiliates.read','documents.read','documents.write'].includes(permission)};
   window.AffiliateAuth={getState:()=>({affiliate:profiles[0]})};
   window.DocumentIntegration={enabled:()=>true,normalizeFile:source=>source,upload:async(type,source,settings)=>{
    calls.push({name:'upload',affiliateId:settings.affiliateId,typeId:type.id,size:source.size,mode:settings.mode,reason:settings.reason});
    if(pending)await new Promise(resolve=>window.release=resolve);
    if(failUpload)throw Error('synthetic upload failure');
    const prior=rows.find(row=>row.affiliate_id===settings.affiliateId&&row.document_type_id===type.id);
    registered={id:'20000000-0000-4000-8000-000000000002',affiliate_id:settings.affiliateId,document_type_id:type.id,status:'PENDING_REVIEW',replaces_document_id:noReplace?null:prior&&prior.id,created_at:'2026-11-10T00:00:00Z',updated_at:'2026-11-10T00:00:00Z'};
    return registered;
   }};
   window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='list_admin_affiliates')return{data:{items:profiles,total:2,page:1,page_size:25,filter_options:{statuses:[],unions:[],categories:[]}}};
    if(name==='get_admin_affiliate_workbench'){if(failDetail)return{error:Error('synthetic read failure after confirmation')};return{data:{profile:profiles.find(row=>row.id===args.p_affiliate_id),capabilities:{documents:true},documents:rows.filter(row=>row.affiliate_id===args.p_affiliate_id),requests:[],audit:[],empty_document_slots:[]}};}
    if(name==='list_admin_affiliate_documents')return{data:rows.filter(row=>row.affiliate_id===args.p_target_affiliate_id).map(row=>({...row,document_id:row.id,document_status:row.status,document_type_code:types[0].code,document_type_label:types[0].label,mime_type:'application/pdf',availability:'AVAILABLE'}))};
    if(name==='list_document_version_ordinals'){if(failOrdinal)return{error:Error('synthetic ordinal read failure')};return{data:[...rows.map(row=>({document_id:row.id,version:row.version})),...(registered?[{document_id:registered.id,version:7}]:[])]};}
    throw Error('UNEXPECTED_RPC '+name);
   },from:table=>{if(table!=='document_types')throw Error('UNEXPECTED_TABLE');const q={select:()=>q,eq:()=>q,order:async()=>({data:types})};return q;},storage:{from(){throw Error('Unexpected direct Storage access');}}})};
   window.DocumentViewer=()=>null;
  },options);
  for(const source of ['app/document-workflow-repository.js','app/admin-affiliates-repository.js'])await page.addScriptTag({content:read(source)});
  await page.addScriptTag({content:read('app/screens-admin-affiliates.jsx').replace('window.AffiliatesAdminModule=AffiliatesModule;','window.TestDocumentUploadModal=DocumentUploadModal;window.AffiliatesAdminModule=AffiliatesModule;')});
  await page.evaluate(()=>{
   window.testRoot=ReactDOM.createRoot(document.getElementById('root'));
   window.render=()=>testRoot.render(React.createElement(AffiliatesAdminModule,{app:{admin:AdminRepository,toast:message=>toasts.push(message)},header:()=>null,onOpenModule(){}}));render();
  });
  await page.locator('[data-admin-affiliate-detail]').waitFor();
  await page.getByRole('button',{name:'Expediente',exact:true}).click();
  return page;
 }
 async function withPage(options,test){const page=await fixture(options);try{await test(page);}finally{await page.close();}}
 async function selectFile(page){await page.locator('[data-affiliate-upload-open]').click();const modal=page.getByRole('dialog');await modal.locator('input[type=file]').waitFor();await page.waitForFunction(()=>!document.querySelector('input[type=file]').disabled);await modal.locator('input[type=file]').setInputFiles(file);return modal;}
 async function startCompatible(page){const modal=await selectFile(page);await page.evaluate(()=>Promise.resolve());if(!await page.evaluate(()=>calls.some(call=>call.name==='upload')))await modal.locator('.aff-primary').click();await page.waitForFunction(()=>calls.some(call=>call.name==='upload'));return modal;}
 try{
  await check('repository returns workflow-confirmed original object without a post-write query',()=>withPage({},async page=>{
   const result=await page.evaluate(async()=>{calls=[];const receipt=await AdminAffiliatesRepository.uploadDocument(profiles[0].id,types[0],new File(['synthetic'],'a.pdf',{type:'application/pdf'}),'synthetic reason');return{confirmed:DocumentWorkflowRepository.isConfirmedDocument(receipt),calls,status:receipt.status};});
   assert.equal(result.confirmed,true);assert.equal(result.status,'PENDING_REVIEW');assert.deepEqual(result.calls.map(call=>call.name),['upload']);assert.equal(result.calls[0].mode,'ADMIN');assert.equal(result.calls[0].reason,'synthetic reason');
  }));
  await check('invalid MIME remains rejected before any upload',()=>withPage({},async page=>{
   const result=await page.evaluate(async()=>{calls=[];try{await AdminAffiliatesRepository.uploadDocument(profiles[0].id,types[0],new File(['bad'],'bad.txt',{type:'text/plain'}));return false;}catch(error){return error.message==='INVALID_DOCUMENT_FILE'&&!calls.length;}});assert.equal(result,true);
  }));
  await check('file selection starts upload automatically and busy prevents a second submit',()=>withPage({pending:true},async page=>{
   await selectFile(page);await page.waitForFunction(()=>calls.some(call=>call.name==='upload'));
   assert.equal(await page.getByRole('dialog').locator('.aff-primary').isDisabled(),true);
   await page.getByRole('dialog').locator('.aff-primary').evaluate(button=>{button.click();button.click();});
   assert.equal(await page.evaluate(()=>calls.filter(call=>call.name==='upload').length),1);
   await page.evaluate(()=>release());await page.getByRole('dialog').waitFor({state:'detached'});
  }));
  await check('confirmed replacement stays visible when further workbench reads fail; exact predecessor yields next ordinal',()=>withPage({pending:true},async page=>{
   await startCompatible(page);const prior=await page.evaluate(()=>calls.filter(call=>call.name==='get_admin_affiliate_workbench').length);
   await page.evaluate(()=>{failDetail=true;release();});await page.getByRole('dialog').waitFor({state:'detached'});
   await page.locator('[data-affiliate-document-replace="20000000-0000-4000-8000-000000000002"]').waitFor();
   assert.match(await page.locator('.aff-document-grid').innerText(),/Versión 5 · PENDING_REVIEW/);
   assert.equal(await page.evaluate(()=>calls.filter(call=>call.name==='get_admin_affiliate_workbench').length),prior);
   assert.equal(await page.evaluate(()=>JSON.stringify(rows[0])===original),true);assert.equal(await page.evaluate(()=>toasts.length),1);
  }));
  await check('unknown ordinal read failure does not hide confirmed document or fabricate version one',()=>withPage({pending:true,noReplace:true},async page=>{
   await startCompatible(page);await page.evaluate(()=>{failOrdinal=true;release();});await page.getByRole('dialog').waitFor({state:'detached'});
   await page.locator('[data-affiliate-document-replace="20000000-0000-4000-8000-000000000002"]').waitFor();
   assert.match(await page.locator('.aff-document-grid').innerText(),/Versión — · PENDING_REVIEW/);
   assert.equal(await page.evaluate(()=>calls.filter(call=>call.name==='upload').length),1);
  }));
  await check('unknown ordinal is filled by separate authorized read without replacing the confirmed row',()=>withPage({pending:true,noReplace:true},async page=>{
   await startCompatible(page);await page.evaluate(()=>release());await page.getByRole('dialog').waitFor({state:'detached'});
   await page.waitForFunction(()=>document.querySelector('.aff-document-grid')?.textContent.includes('Versión 7 · PENDING_REVIEW'));
   assert.equal(await page.evaluate(()=>calls.filter(call=>call.name==='get_admin_affiliate_workbench').length),1);
  }));
  await check('late completion after selecting another affiliate never refreshes or toasts that profile',()=>withPage({pending:true},async page=>{
   await startCompatible(page);await page.locator('[data-affiliate-row="00000000-0000-4000-8000-000000000002"]').evaluate(button=>button.click());
   await page.locator('[data-admin-affiliate-detail="00000000-0000-4000-8000-000000000002"]').waitFor();
   const count=await page.evaluate(()=>calls.filter(call=>call.name==='get_admin_affiliate_workbench').length);
   await page.evaluate(async()=>{release();await new Promise(resolve=>setTimeout(resolve,30));});
   assert.equal(await page.evaluate(()=>toasts.length),0);assert.equal(await page.evaluate(()=>calls.filter(call=>call.name==='get_admin_affiliate_workbench').length),count);
   assert.equal(await page.locator('[data-affiliate-document-replace="20000000-0000-4000-8000-000000000002"]').count(),0);
  }));
  await check('saved callback failure is labelled confirmed and cannot immediately submit the same file again',()=>withPage({},async page=>{
   await page.evaluate(()=>testRoot.render(React.createElement(TestDocumentUploadModal,{profile:profiles[0],documents:rows,onClose(){},onUploaded(){throw Error('synthetic projection failure');}})));
   const modal=page.getByRole('dialog');await page.waitForFunction(()=>document.querySelector('input[type=file]')&&!document.querySelector('input[type=file]').disabled);
   await modal.locator('input[type=file]').setInputFiles(file);await page.evaluate(()=>Promise.resolve());if(!await page.evaluate(()=>calls.some(call=>call.name==='upload')))await modal.locator('.aff-primary').click();
   await modal.getByRole('alert').waitFor();assert.match(await modal.getByRole('alert').innerText(),/Documento guardado/);assert.equal(await modal.locator('.aff-primary').isDisabled(),true);
   assert.equal(await page.evaluate(()=>calls.filter(call=>call.name==='upload').length),1);
  }));
  await check('genuine upload failure retains file and existing retry button',()=>withPage({},async page=>{
   await page.evaluate(()=>{failUpload=true;});const modal=await startCompatible(page);await modal.getByRole('alert').waitFor();
   assert.match(await modal.getByRole('alert').innerText(),/No fue posible guardar/);assert.equal(await modal.locator('input[type=file]').evaluate(input=>input.files.length),1);assert.equal(await modal.locator('.aff-primary').isDisabled(),false);
   await page.evaluate(()=>{failUpload=false;});await modal.locator('.aff-primary').click();await modal.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>calls.filter(call=>call.name==='upload').length),2);
  }));
  assert.deepEqual(pageErrors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 const report={status:cases.every(item=>item.status==='PASS')?'PASS':'FAIL',isolation:'Local Chromium; actual React/Admin/Workflow sources; synthetic adapters only; no production traffic or PII',sourceSha256:Object.fromEntries(['app/admin-affiliates-repository.js','app/screens-admin-affiliates.jsx','app/document-workflow-repository.js'].map(file=>[file,crypto.createHash('sha256').update(read(file)).digest('hex')])),cases,pageErrors};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('ADMIN DOCUMENT CONFIRMATION '+report.status+' ('+cases.filter(item=>item.status==='PASS').length+'/'+cases.length+')');
 for(const item of cases.filter(item=>item.status==='FAIL'))console.error(item.name+': '+item.error);
 if(report.status!=='PASS')process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
