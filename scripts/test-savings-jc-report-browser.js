'use strict';
// H-SAVINGS-JC-REPORT-001: real Savings panel + Reporte JC repository with an isolated synthetic transport. No network.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const Babel=require(process.env.BABEL_STANDALONE_PATH||'C:/tmp/babel-standalone-7.29.0.min.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/savings-jc-report');
const files=['app/icons.jsx','app/savings-panel-reference.jsx','app/savings-panel-repository.js','app/savings-withdrawal-history-repository.js','app/savings-certification-admin.jsx','app/savings-runtime-admin.jsx','app/savings-bulk-admin.jsx','app/savings-individual-withdrawal-repository.js','app/savings-individual-withdrawal.jsx','app/savings-rh-repository.js','app/savings-rh-report.jsx','app/savings-jc-repository.js','app/document-generation-design.js','app/document-generation-repository.js','app/screens-admin-document-generation.jsx','app/savings-panel-admin.jsx'];
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const report={status:'FAIL',data:'SYNTHETIC_ONLY',network:'BLOCKED',sourceHashes:Object.fromEntries(files.map(f=>[f,sha(read(f))])),checks:[],viewports:{},browserErrors:[],networkAttempts:[],mutationAttempts:[]};
let browser,stage='setup';
async function mount(width){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.browserErrors.push(e.message));
 await context.route('**/*',route=>{if(!/^https?:/.test(route.request().url()))return route.continue();report.networkAttempts.push(route.request().resourceType());return route.abort();});
 await page.setContent('<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}html,body,#root{width:100%;min-height:100%}</style></head><body><div id="root"></div></body></html>');
 for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
 await page.evaluate(()=>{
  window.qaActor='qa-actor';window.qaCalls=[];window.qaMutations=[];window.qaJcMode='ok';window.qaJcDelay=350;
  window.AffiliateAuth={getState:()=>({session:{user:{id:qaActor}},affiliate:{id:'qa-affiliate'}}),subscribe:()=>()=>{}};
  window.AdminRepository={getState:()=>({assignment:'qa-admin'}),subscribe:()=>()=>{}};
  const clone=x=>structuredClone(x);
  function response(name){
   if(name==='get_admin_savings_workspace_summary')return {today:'2026-11-27',publication_mode:'PUBLISHED',kpis:{total:3194889.85,activos:388,padron:1098,afiliados:1098,current_summary:true,as_of:'2026-11-27',prox:'2026-11-30',porRecibir:270891.39,altas:0,bajas:0,cobranza:{fecha:'2026-11-15',esperado:260841.39,recibido:253841.39}}};
   qaMutations.push({name});throw Error('UNEXPECTED_RPC_'+name);
  }
  const edgeError=code=>({error:{message:'Edge Function returned a non-2xx status code',context:new Response(JSON.stringify({error:code}),{status:422,headers:{'Content-Type':'application/json'}})}});
  window.SutiSupabase={getClient:()=>({rpc:(name,args={})=>{let signal;return {abortSignal(value){signal=value;return this;},then(resolve,reject){qaCalls.push({name,args:clone(args),actor:qaActor});let data,error;try{data=response(name,args);}catch(e){error={message:e.message};}return Promise.resolve(error?{error}:{data}).then(resolve,reject);}};},
   functions:{invoke:async(name,{body})=>{qaCalls.push({name:'edge:'+name,args:clone(body)});if(name!=='savings-jc-report'){qaMutations.push({name});return {error:{message:'UNEXPECTED_EDGE'}};}
    await new Promise(r=>setTimeout(r,qaJcDelay));
    if(qaJcMode==='ok')return {data:new Blob([new Uint8Array([80,75,3,4]),'synthetic-xlsx-body'],{type:'application/octet-stream'})};
    if(qaJcMode==='notxlsx')return {data:new Blob(['<html>not excel</html>'])};
    return edgeError(qaJcMode);}}})};
  window.qaRoot=ReactDOM.createRoot(document.getElementById('root'));window.qaMount=()=>qaRoot.render(React.createElement(window.SavingsPanelAdmin,{key:qaActor,app:{admin:{has:()=>false}},onBack:()=>{}}));
 });
 for(const f of files)await page.addScriptTag({content:f==='app/screens-admin-document-generation.jsx'?Babel.transform(read(f),{presets:['react'],sourceType:'script'}).code:read(f)});
 await page.evaluate(()=>qaMount());await page.getByText('Panorama del ahorro',{exact:true}).waitFor();
 return {context,page};
}
const jcButton=page=>page.locator('nav.svp-tabs button[data-savings-jc-report]');
const edgeCalls=page=>page.evaluate(()=>qaCalls.filter(c=>c.name==='edge:savings-jc-report').length);
async function main(){try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const width of [390,1440]){
  stage='mount_'+width;const {context,page}=await mount(width),checks=[];
  try{
   assert.deepEqual(await page.getByRole('tab').allTextContents(),['Resumen','Personas','Atención','Programa','Reporte RH','Historial']);
   assert.deepEqual(await page.locator('nav.svp-tabs > button').allTextContents(),['Resumen','Personas','Atención','Programa','Reporte RH','Historial','Reporte JC']);
   assert.equal(await jcButton(page).getAttribute('role'),null);assert.equal(await edgeCalls(page),0);
   checks.push('Six existing tabs unchanged; «Reporte JC» is a plain button right after Historial; nothing is requested until it is pressed');
   stage='download_'+width;
   await page.evaluate(()=>{qaJcDelay=2500;});const download=page.waitForEvent('download');await jcButton(page).click();
   await page.waitForFunction(()=>document.querySelector('[data-savings-jc-report]').textContent==='Generando…');
   assert.equal(await jcButton(page).isDisabled(),true);await jcButton(page).dispatchEvent('click');
   const file=await download,saved=path.join(out,'.tmp-download-'+width+'.xlsx');fs.mkdirSync(out,{recursive:true});await file.saveAs(saved);
   assert.match(file.suggestedFilename(),/^Reporte_JC_Ahorro_\d{4}-\d{2}-\d{2}\.xlsx$/);assert.deepEqual([...fs.readFileSync(saved).subarray(0,4)],[80,75,3,4]);fs.unlinkSync(saved);
   await page.waitForFunction(()=>document.querySelector('[data-savings-jc-report]').textContent==='Reporte JC');
   assert.equal(await edgeCalls(page),1);assert.deepEqual(await page.evaluate(()=>qaCalls.find(c=>c.name==='edge:savings-jc-report').args),{});
   assert.equal(await page.getByRole('tab',{name:'Resumen',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await page.getByRole('alert').count(),0);
   checks.push('Click downloads Reporte_JC_Ahorro_<fecha>.xlsx; busy label «Generando…» blocks a second request; selected tab does not change');
   stage='errors_'+width;
   for(const [mode,text] of [['SAVINGS_REPORT_DENIED','No tienes permiso para generar reportes de Ahorro.'],['SAVINGS_JC_RECONCILIATION_FAILED','Los saldos no cuadran con los movimientos registrados. No se generó el archivo.'],['SAVINGS_JC_UNSUPPORTED_MOVEMENT','Hay movimientos de Ahorro (por ejemplo, rendimientos) que este reporte todavía no muestra. No se generó el archivo.'],['notxlsx','No se recibió un Excel válido. Intenta nuevamente.'],['SAVINGS_JC_UNAVAILABLE','No se pudo generar el Reporte JC. Intenta nuevamente; si persiste, revisa tus permisos y la conexión.']]){
    await page.evaluate(mode=>{qaJcMode=mode;qaJcDelay=0;},mode);await jcButton(page).click();
    await page.getByRole('alert').filter({hasText:text}).waitFor();assert.equal(await jcButton(page).textContent(),'Reporte JC');
   }
   await page.evaluate(()=>{qaJcMode='ok';});const again=page.waitForEvent('download');await jcButton(page).click();await again;await page.waitForFunction(()=>!document.querySelector('[role=alert]'));
   checks.push('Denied, reconciliation, unsupported movement, invalid file and unavailable errors are explicit; a later success clears the alert');
   stage='tabs_'+width;
   await page.getByRole('tab',{name:'Reporte RH',exact:true}).click();await page.getByRole('form',{name:'Reporte RH'}).waitFor();assert.equal(await page.getByRole('tab',{name:'Reporte RH',exact:true}).getAttribute('aria-selected'),'true');
   await page.getByRole('tab',{name:'Resumen',exact:true}).click();await page.getByText('Panorama del ahorro',{exact:true}).waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const box=await jcButton(page).boundingBox(),hist=await page.getByRole('tab',{name:'Historial',exact:true}).boundingBox();assert(box&&hist&&box.height>=40&&box.width>=60);
   await page.screenshot({path:path.join(out,'synthetic-jc-'+width+'.png'),clip:{x:0,y:0,width,height:Math.min(900,Math.ceil(Math.max(box.y,hist.y)+box.height+220))}});
   checks.push('Tabs still switch; no horizontal overflow; button keeps touch size');
   const mutations=await page.evaluate(()=>qaMutations);report.mutationAttempts.push(...mutations);assert.deepEqual(mutations,[]);
   report.viewports[width]={status:'PASS',checks};
  }finally{await context.close();}
 }
 assert.deepEqual(report.browserErrors,[]);assert.deepEqual(report.networkAttempts,[]);report.status='PASS';
 report.checks=['Real Savings panel and Reporte JC repository with isolated transport','Existing tabs preserved; one additional download button','Explicit errors; no unexpected RPC/Edge calls'];
 }catch(error){report.failure={stage,message:error.message.split('Call log:')[0]};process.exitCode=1;}finally{await browser?.close();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,failure:report.failure,viewports:report.viewports,browserErrors:report.browserErrors,network:report.networkAttempts.length},null,1));}}
main();
