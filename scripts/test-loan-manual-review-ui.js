'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{createRequire}=require('module');
const root=path.resolve(__dirname,'..'),baseline=process.argv[2];
async function main(){
 const helper=path.join(root,'scripts/test-loan-historical-resolution-ui.js');
 const source=fs.readFileSync(helper,'utf8');const module={exports:{}};
 vm.runInNewContext(source.slice(0,source.indexOf('async function testBrowser()'))+'\nmodule.exports={boot,ready,structure};',
  {module,require:createRequire(helper),__dirname:path.dirname(helper),process:{argv:['node',helper,root]},console});
 const {boot,ready,structure}=module.exports;
 const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],external=[],out=path.join(root,'docs/qa/evidence/loan-manual-review');fs.mkdirSync(out,{recursive:true});
 try{
 let page=await browser.newPage({viewport:{width:390,height:844}});
 await boot(page,root,'mapping',errors,external);
 await page.waitForSelector('[data-credit-state="HISTORICAL_LOAN_MAPPING_REQUIRED"]');
 assert.match(await page.locator('body').innerText(),/Tu información está registrada y será revisada por Finanzas/);
 assert(!/HISTORICAL_LOAN|No pudimos calcular|simulación fallida/.test(await page.locator('body').innerText()));
 assert(await page.locator('[data-loan-flow-footer] button').isDisabled());
 await page.screenshot({path:path.join(out,'pending-isolated.png'),fullPage:true});await page.close();
 page=await browser.newPage({viewport:{width:390,height:844}});await boot(page,root,'normal',errors,external);await ready(page);const current=await structure(page);await page.close();
 if(baseline){page=await browser.newPage({viewport:{width:390,height:844}});await boot(page,path.resolve(baseline),'normal',errors,external);await ready(page);assert.deepEqual(await structure(page),current);await page.close();}
 page=await browser.newPage({viewport:{width:1280,height:900}});await boot(page,root,'mapping',errors,external);
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
 await page.addScriptTag({path:path.join(root,'app/admin-finance-queue-repository.js')});await page.addScriptTag({path:path.join(root,'app/screens-admin-finanzas.jsx')});
 await page.evaluate(()=>{window.__root=ReactDOM.createRoot(document.getElementById('root'));window.__root.render(React.createElement(window.FinanzasModule,{app:{admin:{has:()=>true}},onBack:()=>{},header:({title})=>React.createElement('h1',null,title)}));});
 await page.waitForSelector('[data-historical-review-queue="ready"]').catch(async e=>{console.error(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,800)}));throw e;});
 assert.equal(await page.locator('[data-historical-review-case]').count(),12);
 assert.equal(await page.evaluate(()=>window.__reviewReads),1,'IMMEDIATE_SUBSCRIPTION_MUST_NOT_LOOP');
 await page.evaluate(()=>window.__adminListener({...window.__adminState}));
 assert.equal(await page.evaluate(()=>window.__reviewReads),1,'UNCHANGED_CONTEXT_MUST_NOT_RELOAD');
 await page.locator('[data-historical-review-case] summary').first().click();
 assert.match(await page.locator('[data-historical-review-queue]').innerText(),/Evidencia disponible/);
 assert.match(await page.locator('[data-historical-review-queue]').innerText(),/Actor:/);
 assert.equal(await page.locator('[data-historical-review-queue] select').count(),0);
 assert.equal(await page.locator('[data-preserved-admin]').count(),3);
 assert.equal(await page.getByRole('button',{name:'Solicitudes',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Cotizaciones',exact:true}).count(),1);
 await page.screenshot({path:path.join(out,'admin-isolated.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify({status:'PASS',pendingHumanMessage:true,technicalCodesVisible:0,continueDisabled:true,normalStructureUnchanged:!!baseline,adminPendingCases:12,adminEvidenceAndActorVisible:true,arbitraryFundSelector:false,originalAdminSectionsPreserved:true,browserErrors:0,externalRequests:0},null,2)+'\n');
 console.log('PASS pending loan, unchanged normal UI and Admin review visibility');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
