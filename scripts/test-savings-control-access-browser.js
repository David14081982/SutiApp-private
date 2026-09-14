'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..');
const chunks=process.env.SAVINGS_TEST_BUNDLE==='1'?new Map(fs.readFileSync(path.join(root,'app/bundle.js'),'utf8').split(/(?=\/\* @@file )/).filter(Boolean).map(x=>[x.match(/^\/\* @@file (.*?) \*\//)[1],x])):null;
const content=file=>chunks&&chunks.has(path.basename(file))?chunks.get(path.basename(file)):fs.readFileSync(path.join(root,file),'utf8');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:430,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
 await page.setContent('<html><body style="margin:0"><div id="root"></div></body></html>');
 for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/savings-panel-reference.jsx','app/savings-operations-admin.jsx','app/savings-yield-admin.jsx','app/savings-runtime-admin.jsx','app/savings-panel-admin.jsx'])await page.addScriptTag({content:content(file)});
 await page.evaluate(()=>{
 window.writes=0;window.canConfigure=true;
 const noWrite=async()=>{writes++;throw Error('Unexpected mutation');};
 window.SavingsRepository={newIdempotencyKey:()=> 'test-key',getAdminDashboard:async()=>({participants:[{id:'p1',legacy_folio:'00123',display_name:'PERSONA DE PRUEBA'}],yield_periods:[{id:'period1',period_year:2026,semester:2}]}),getOperations:async()=>({entry_mode:'ALL_YEAR',historical_certification_pending:0,effective:{JOIN:true,WITHDRAW:false,CHANGE_AMOUNT:false,TERMINATE:false},openings:[],plans:[]}),configureOperation:noWrite,authorizeDate:noWrite,saveYieldPeriod:noWrite,postPeriodYield:noWrite};
 window.SavingsPanelRepository={list:async()=>({publication_mode:'PRIVATE',collection_status:'ACTUAL_CONFIRMATION_PENDING',rows:[],total:0,saldo_total:0,can_write:false,cutoff:'2026-09-06T20:00:00Z',kpis:{current_summary:true,as_of:'2026-10-05',uncertified:2,projection_pending:2,pending_actual_count:3,total:0,activos:0,padron:0,afiliados:947,prox:null,porRecibir:null,altas:0,bajas:0,pendientes:0,incidencias:0,cobranza:{fecha:'2026-09-05',recibido:0,esperado:null}}}),report:async()=>({rows:[],totals:{capital_delivered:0,yield_delivered:0,actual_received:0,yield_credited:0}})};
 window.ui=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>ui.render(React.createElement(SavingsPanelAdmin,{key:String(canConfigure),app:{admin:{has:()=>canConfigure}}}));render();
 });
 const entry=page.getByRole('button',{name:'Retiros y rendimientos',exact:true});await entry.click();
 await page.getByLabel(/Tasa propuesta/).waitFor();
 if(process.env.SAVINGS_CONTROL_SCREENSHOT){await page.getByLabel(/Tasa propuesta/).scrollIntoViewIfNeeded();await page.screenshot({path:process.env.SAVINGS_CONTROL_SCREENSHOT});}
 await page.getByRole('button',{name:'Abrir retiros',exact:true}).click();
 await page.locator('select[name=scope]').selectOption('PARTICIPANT');
 await page.locator('select[name=participant_id]').selectOption('p1');
 assert.match(await page.locator('select[name=participant_id]').innerText(),/00123/);
 await page.getByLabel('Rendimiento ganado (%)',{exact:true}).fill('12.5');
 await page.locator('select[name=scope]').selectOption('GLOBAL');
 assert.equal(await page.locator('select[name=participant_id]').count(),0);
 for(const width of [320,430,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('select[name=scope]').isVisible());}
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Abrir retiros',exact:true}).click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('dialog[open]').count(),1,'Escape must close only the inner form');
 assert.equal(await page.locator('select[name=scope]').count(),0);
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await entry.click();await page.getByLabel(/Tasa propuesta/).waitFor();
 assert.equal(await page.evaluate(()=>writes),0);assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.evaluate(()=>{canConfigure=false;render();});await entry.click();
 await page.getByText('Control del programa',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Abrir retiros',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Guardar periodo',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>writes),0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',network:'BLOCKED',viewports:[320,430,1440],checks:['visible direct access','real controls expanded','global and exact Folio scopes','rate field','nested dialog Escape','close and reopen','read-only permissions preserved','zero mutations','no overflow/browser errors']}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
