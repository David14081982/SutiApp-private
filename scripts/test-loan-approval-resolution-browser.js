'use strict';
// Isolated fixtures and real UI/React; no production connections or financial writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const out=path.join(root,'docs/qa/evidence/loan-approval-resolution-20260928');
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const checks=[],errors=[];
 try{
  async function fixture(mode='changed',width=1440){
   const page=await browser.newPage({viewport:{width,height:900}});
   page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.error('UI:',e.message);});
   await page.route('http**/*',route=>route.abort());
   await page.setContent('<style>:root{--surface:#fff;--surface-2:#edf0f5;--hairline:#ddd;--ink:#172033;--ink-3:#657086;--guinda:#901040}*{box-sizing:border-box}body{font-family:Arial}button{cursor:pointer}</style><div id="root"></div>');
   for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(file)});
   await page.evaluate(({mode})=>{
    window.Icon=()=>null;window.GeneratedDocuments=()=>null;window.money=n=>'$'+n;
    window.AffiliateAuth={getState:()=>({phase:'authenticated',session:{user:{id:'actor'},access_token:'isolated'},affiliate:{id:'affiliate'}}),subscribe:()=>()=>{}};
    window.__calls=[];window.__mode=mode;
    window.AdminRepository={getState:()=>({phase:'authorized',assignment:{role:'admin'}}),subscribe:()=>()=>{},startImpersonation:async(...args)=>{__calls.push({action:'assist',args});}};
    window.AdminFinanceQueueRepository={enrich:async rows=>rows,photo:async()=>null};
    window.AffiliateRepository={getProfilePhoto:async()=>null};
    const stages=[{id:'review',label:'Revisión de documentos',state:'current'},{id:'approved',label:'Autorización',state:'upcoming',status_references:['approved']}];
    window.__row={id:'r1',affiliate_id:'affiliate',folio:'SR-TEST-001',nombre:'Afiliado de prueba',numero_control:'TEST',program_id:'prestamo',request_type:'benefit',status:'in_review',financial_processing_status:'pending',created_at:'2026-09-28',ts:1,requested_amount:50000,requested_term:12,requested_term_semantics:'quincenal',financial_submission_snapshot:{financialResult:{amount:50000,paymentCount:12,paymentPeriod:'quincenal',total:59180,rate:1.5,fund:'Caja de Ahorro'}},documents_available:true,request_documents:[],current_affiliate_documents:[],admin_events_available:true,admin_events:[],workflow_state:{available:true,current_stage:stages[0],stages}};
    window.ProgramRequestRepository={listAdminFlowQueue:async()=>[structuredClone(__row)],adminFlowDetail:async()=>{if(__mode==='readback-fail'&&__calls.some(x=>x.action==='CANCEL'))throw Error('NETWORK');return structuredClone(__row);},newIdempotencyKey:()=> '10000000-0000-4000-8000-000000000001',recordAdminAction:async(id,action,comment,key)=>{__calls.push({action,comment,key});await new Promise(r=>setTimeout(r,100));if(__mode==='race')throw Error('APPROVED_FINANCIAL_REQUEST_STATUS_IMMUTABLE');__row.status='cancelled';const event={id:'cancel-event',action,comment};__row.admin_events.push(event);return event;}};
    window.FinancialLegacyRepository={reviewApproval:async id=>{__calls.push({action:'review'});if(__mode==='permission')throw Error('ADMIN_APPROVAL_REQUIRED');if(__mode==='network')throw Error('NETWORK');if(__mode==='documents')throw Error('REQUIRED_PRIVATE_DOCUMENT_MISSING');if(__mode==='ready')return{request_id:id,phase:'READY'};if(__mode==='approved')return{request_id:id,idempotent:true};return{request_id:id,phase:'NEW_REQUEST_REQUIRED',code:'CONDITIONS_CHANGED',submitted:{amount:50000},current:{maxAmount:30000,rate:1.5,maxTerm:24}};},approveRequest:async()=>{__calls.push({action:'approve'});throw Error('CONDITIONS_CHANGED');}};
    window.__app={admin:{has:permission=>mode!=='no-assist'||permission!=='affiliates.impersonate'}};
   },{mode});
   await page.addScriptTag({content:read('app/private-resource-demand.js')});
   const screen=process.argv.includes('--bundle')?read('app/bundle.js').match(/\/\* @@file screens-admin-finanzas\.jsx \*\/[\s\S]*?(?=\/\* @@file |$)/)[0]:read('app/screens-admin-finanzas.jsx');
   await page.addScriptTag({content:screen.replace('  function FinanzasModule(','  window.__Workbench=DesktopFinancialWorkbench;\n  function FinanzasModule(')});
   await page.evaluate(()=>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(__Workbench,{app:__app,onCount:()=>{}})));
   await page.locator('[data-financial-queue-row]').click();
   await page.locator('.finwb-action-select').first().selectOption('approveLoan');
   await page.locator('.finwb-actionbar .finwb-primary').click();
   return page;
  }
  for(const width of [1440,390,320]){
   const page=await fixture('changed',width),dialog=page.locator('[data-financial-confirmation]');
   await dialog.getByRole('button',{name:'Autorizar solicitud',exact:true}).click();
   await page.locator('[data-approval-resolution="NEW_REQUEST_REQUIRED"]').waitFor();
   assert.equal(await page.locator('[data-financial-inline-feedback="saving"]').count(),0,'preflight must leave the row out of saving state');
   assert.equal(await page.evaluate(()=>__calls.filter(x=>x.action==='approve').length),0);
   assert.match(await dialog.innerText(),/30,000|30000/);
   assert.equal(await dialog.getByRole('button',{name:'Autorizar solicitud',exact:true}).count(),0);
   for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('[data-financial-confirmation]')));}
   const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width);
   await dialog.screenshot({path:path.join(out,'resolution-'+width+'.png')});
   await dialog.getByRole('button',{name:'Confirmar cancelación para nueva solicitud'}).evaluate(button=>{button.click();button.click();});
   await page.locator('[data-approval-resolution="CANCELLED"]').waitFor();
   assert.equal(await page.evaluate(()=>__calls.filter(x=>x.action==='CANCEL').length),1);
   assert.equal(await page.evaluate(()=>__row.financial_submission_snapshot.financialResult.amount),50000);
   if(width===1440){await dialog.getByRole('button',{name:'Volver',exact:true}).click();await page.getByRole('button',{name:'Continuar con nueva solicitud',exact:true}).click();await page.locator('[data-approval-resolution="CANCELLED"]').waitFor();}
   await dialog.getByRole('button',{name:'Abrir atención asistida'}).click();
   await page.waitForFunction(()=>__calls.some(x=>x.action==='assist'));
   assert.equal(await page.evaluate(()=>__calls.find(x=>x.action==='assist').args[0]),'affiliate');
   checks.push('changed criteria, no approval, double-click, preserved history, assistance '+width);await page.close();
  }
  for(const [mode,phase] of [['permission','BLOCKED'],['network','RETRY'],['documents','NEW_REQUEST_REQUIRED'],['approved','REFRESH']]){
   const page=await fixture(mode);await page.getByRole('button',{name:'Revisar solicitud',exact:true}).click();await page.locator('[data-approval-resolution="'+phase+'"]').waitFor();
   assert.equal(await page.evaluate(()=>__calls.filter(x=>['approve','CANCEL'].includes(x.action)).length),0);
   checks.push(mode+' has actionable state without writes');await page.close();
  }
  for(const mode of ['race','readback-fail']){
   const page=await fixture(mode);await page.getByRole('button',{name:'Revisar solicitud',exact:true}).click();await page.getByRole('button',{name:'Confirmar cancelación para nueva solicitud'}).click();await page.locator('[data-approval-resolution="REFRESH"]').waitFor();
   assert.equal(await page.getByRole('button',{name:'Abrir atención asistida'}).count(),0);checks.push(mode+' never claims completion');await page.close();
  }
  const page=await fixture('no-assist');await page.getByRole('button',{name:'Revisar solicitud',exact:true}).click();await page.getByRole('button',{name:'Confirmar cancelación para nueva solicitud'}).click();await page.locator('[data-approval-resolution="CANCELLED"]').waitFor();assert.equal(await page.getByRole('button',{name:'Abrir atención asistida'}).count(),0);checks.push('no new impersonation capability granted');await page.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,process.argv.includes('--bundle')?'browser-bundle-tests.json':'browser-tests.json'),JSON.stringify({status:'PASS',checks,errors,productionWrites:0},null,2));console.log(JSON.stringify({status:'PASS',checks}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
