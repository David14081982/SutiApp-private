'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{createRequire}=require('module');
const root=path.resolve(__dirname,'..'),queueOnly=process.argv.includes('--queue-only'),baseline=queueOnly?null:process.argv[2];
async function main(){
 const helper=path.join(root,'scripts/test-loan-historical-resolution-ui.js');
 const source=fs.readFileSync(helper,'utf8');const module={exports:{}};
 vm.runInNewContext(source.slice(0,source.indexOf('async function testBrowser()'))+'\nmodule.exports={boot,ready,structure,html};',
  {module,require:createRequire(helper),__dirname:path.dirname(helper),process:{argv:['node',helper,root]},console});
 const {boot,ready,structure,html}=module.exports;
 const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],external=[],out=process.env.SUTIAPP_EVIDENCE_DIR||path.join(root,'docs/qa/evidence/loan-manual-review');fs.mkdirSync(out,{recursive:true});
 try{
 let page;
 if(!queueOnly){
 page=await browser.newPage({viewport:{width:390,height:844}});
 await boot(page,root,'mapping',errors,external);
 await page.waitForSelector('[data-credit-state="HISTORICAL_LOAN_MAPPING_REQUIRED"]');
 assert.match(await page.locator('body').innerText(),/Tu información está registrada y será revisada por Finanzas/);
 assert(!/HISTORICAL_LOAN|No pudimos calcular|simulación fallida/.test(await page.locator('body').innerText()));
 assert(await page.locator('[data-loan-flow-footer] button').isDisabled());
 await page.screenshot({path:path.join(out,'pending-isolated.png'),fullPage:true});await page.close();
 page=await browser.newPage({viewport:{width:390,height:844}});await boot(page,root,'normal',errors,external);await ready(page);const current=await structure(page);await page.close();
 if(baseline){page=await browser.newPage({viewport:{width:390,height:844}});await boot(page,path.resolve(baseline),'normal',errors,external);await ready(page);assert.deepEqual(await structure(page),current);await page.close();}
 }
 page=await browser.newPage({viewport:{width:1280,height:900}});
 if(queueOnly){
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{external.push(route.request().url());return route.abort();});
  await page.setContent(html);
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{window.__root=ReactDOM.createRoot(document.getElementById('root'));});
 }else await boot(page,root,'mapping',errors,external);
 await page.evaluate(()=>{
  window.__root.unmount();
  const h=React.createElement;
  window.__reviewReads=0;
  window.__adminState={phase:'authorized',subjectKey:'synthetic-admin',assignment:{permissions:['program_requests.read']}};
  window.AdminRepository={getState:()=>window.__adminState,subscribe:fn=>{window.__adminListener=fn;fn(window.__adminState);return()=>{};}};
  window.PrivateResourceDemand={useContext:()=>null}; // No document selected in this focal queue test.
  window.ProgramRequestRepository={listAdminFlowQueue:async()=>[],listFinancialMobile:async()=>[]};
  window.HistorySyncAdmin=()=>h('div',{'data-preserved-admin':'sync'},'Sincronización');
  window.SavingsLoanAccessAdmin=()=>h('div',{'data-preserved-admin':'savings'},'Acceso Ahorro');
  window.LoanAvailabilityAdmin=()=>h('div',{'data-preserved-admin':'capacity'},'Disponibilidad');
  window.SutiSupabase={getClient:()=>({rpc:async(name)=>{
   if(name!=='list_admin_loan_historical_reviews')throw Error('Unexpected admin RPC');
   window.__reviewReads++;
   return {data:Array.from({length:12},(_,i)=>({id:'case-'+i,affiliate_id:'synthetic-uuid-'+i,numero_control:i<5?null:String(90000+i),full_name:'Afiliado de prueba '+i,status:'PENDING',cause_code:i<5?'CONTROL_MISSING':'FUND_UNRESOLVED',cause:'Falta soporte documental de esta obligación histórica.',obligation_key:'loan:historic-'+i,evidence:['Hoja original · fila documentada','Relaciones canónicas revisadas'],previous_value:{fund:'Denominación histórica'},events:[{id:'event-'+i,created_at:'2026-10-28T00:00:00Z',actor_auth_user_id:'synthetic-actor',reason:'Registro autorizado de revisión con evidencia.'}]}))};
  }})};
 });
 await page.addScriptTag({path:path.join(root,'app/admin-finance-queue-repository.js')});await page.addScriptTag({content:fs.readFileSync(path.join(root,'app/screens-admin-finanzas.jsx'),'utf8').replace('  function FinanzasModule(', '  window.__HistoricalReviewQueue=HistoricalReviewQueue;\n  function FinanzasModule(')});
 if(queueOnly){for(const file of ['app/savings-loan-eligibility.js','app/loan-availability-admin.js'])await page.addScriptTag({path:path.join(root,file)});}

 await page.evaluate(queueOnly=>{const h=React.createElement,app={admin:{has:()=>true}};window.__root=ReactDOM.createRoot(document.getElementById('root'));window.__root.render(queueOnly?h('main',{style:{padding:16}},h(window.SavingsLoanAccessAdmin,{app}),h(window.LoanAvailabilityAdmin,{app}),h(window.__HistoricalReviewQueue,{})):h(window.FinanzasModule,{app,onBack:()=>{},header:({title})=>h('h1',null,title)}));},queueOnly);
 await page.waitForSelector('[data-historical-review-queue="ready"]').catch(async e=>{console.error(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,800)}));throw e;});
 assert.equal(await page.locator('[data-historical-review-case]').count(),12);
 assert.equal(await page.evaluate(()=>window.__reviewReads),1,'IMMEDIATE_SUBSCRIPTION_MUST_NOT_LOOP');
 await page.evaluate(()=>window.__adminListener({...window.__adminState}));
 assert.equal(await page.evaluate(()=>window.__reviewReads),1,'UNCHANGED_CONTEXT_MUST_NOT_RELOAD');
 const toggle=page.locator('[data-historical-review-toggle]');
 assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('[data-historical-review-case]').first().isVisible(),false);
 await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
 await page.locator('[data-historical-review-case] summary').first().click();
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});
  await toggle.focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('[data-historical-review-case]').first().isVisible(),false);
  const box=await page.locator('[data-historical-review-queue]').boundingBox();assert(box.height<90&&box.x>=0&&box.x+box.width<=width+1);
  await page.locator('[data-historical-review-queue]').screenshot({path:path.join(out,'accordion-closed-'+width+'.png')});
  await page.keyboard.press('Space');assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('[data-historical-review-case]').first().getAttribute('open'),'');
  assert.equal(await page.evaluate(()=>window.__reviewReads),1,'TOGGLE_MUST_NOT_REFETCH');
  await page.locator('[data-historical-review-queue]').screenshot({path:path.join(out,'accordion-open-'+width+'.png')});
 }

 assert.match(await page.locator('[data-historical-review-queue]').innerText(),/Evidencia disponible/);
 assert.match(await page.locator('[data-historical-review-queue]').innerText(),/Actor:/);
 assert.equal(await page.locator('[data-historical-review-queue] select').count(),0);
 if(!queueOnly){
 assert.equal(await page.locator('[data-preserved-admin]').count(),3);
 assert.equal(await page.getByRole('button',{name:'Solicitudes',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Cotizaciones',exact:true}).count(),1);
 }
 await page.screenshot({path:path.join(out,'admin-isolated.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify({status:'PASS',scope:queueOnly?'Historical review accordion and adjacent cards':'Full historical review suite',pendingHumanMessage:queueOnly?null:true,technicalCodesVisible:queueOnly?null:0,continueDisabled:queueOnly?null:true,normalStructureUnchanged:!!baseline,adminPendingCases:12,accordionDefaultClosed:true,accordionKeyboard:true,nestedExpansionPreserved:true,toggleExtraReads:0,responsiveWidths:[390,1280],adminEvidenceAndActorVisible:true,arbitraryFundSelector:false,originalAdminSectionsPreserved:queueOnly?null:true,browserErrors:0,externalRequests:0},null,2)+'\n');
 console.log(queueOnly?'PASS focal accordion, keyboard, retained cases and responsive widths':'PASS pending loan, unchanged normal UI and Admin review visibility');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
