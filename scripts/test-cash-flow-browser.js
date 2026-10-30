'use strict';
// Focal, isolated UI/repository test. Synthetic service only; no productive writes or credentials.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.tmp/cash-flow/browser');
const html='<!doctype html><html lang="es"><meta charset="utf-8"><style>:root{--surface:#fff;--surface-2:#f7f7fa;--ink:#17233b;--ink-2:#526078;--hairline:#dfe3ea;--hairline-strong:#c4cad5;--guinda:#861e45}*{box-sizing:border-box}body{margin:0;font:14px Arial;background:#f7f7fa}button,input,select{font:inherit}#root{padding:16px}</style><body><div id="root"></div></body></html>';
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1050}});
 const errors=[],external=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{if(route.request().url()==='http://127.0.0.1/cash-flow-isolated')return route.fulfill({status:200,contentType:'text/html',body:html});external.push(route.request().url());return route.abort();});
 try{
  await page.goto('http://127.0.0.1/cash-flow-isolated');
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{
   window.__phase='authenticated';window.__session='isolated-session';window.__error=null;window.__wrongContext=false;window.__calls=[];window.__hold=false;window.__waiting=[];
   window.AffiliateAuth={getState:()=>({phase:window.__phase,session:{user:{id:'isolated-actor'},session_id:window.__session},affiliate:{id:'isolated-affiliate'}})};
   window.AdminRepository={getState:()=>({phase:'ready',subjectKey:'isolated-admin',assignment:{role:'fixture-only'}})};
   window.SutiReportsJcExport={exportStatus:()=>({provisionalNeeded:false})};
   const fixture=from=>{
    const [year,month]=from.split('-').map(Number),months=Array.from({length:12},(_,i)=>{const d=new Date(Date.UTC(year,month-1+i,1)),key=d.toISOString().slice(0,7);return {key,label:d.toLocaleDateString('es-MX',{month:'short',year:'numeric',timeZone:'UTC'})};});
    const concepts=[['contributions','Aportaciones realizadas','savings'],['withdrawals','Retiros pagados','savings'],['credited','Rendimientos acreditados','savings'],['balance','Saldo acumulado','savings'],['scheduled','Aportaciones programadas','savings'],['pending','Retiros autorizados pendientes','savings'],['placed','Capital colocado','loans'],['recovered','Capital recuperado','loans'],['interest','Intereses recuperados','loans'],['administration','Gastos administrativos','loans'],['outstanding','Capital pendiente','loans'],['forecast','Recuperaciones proyectadas','loans']];
    return {from,asOf:'2026-10-30',consultedAt:'2026-10-30T19:00:00Z',months,rows:concepts.map(([id,label,group],row)=>({id,label,group,kind:id,cells:months.map((m,i)=>({amount:row===1||row===2?null:row===4||row===11?800:row===0?1250:0,knownAmount:row===1?220:0,status:row===1?'PARTIAL':row===2?'UNAVAILABLE':row===5?'PENDING':row===4||row===11?'SCHEDULED':'RECORDED',sourceIds:row===0&&i===0?['fixture:1']:[],notes:row===1?['Falta la fecha de un retiro histórico.']:[]}))})),issues:[{code:'FIXTURE_PARTIAL',message:'Fecha histórica insuficiente; importe no asignado al mes.',sourceIds:['fixture:undated']}],records:[{id:'fixture:1',source:'Supabase · savings_movements',sourceId:'fixture-source-1',date:months[0].key+'-15',amount:1250,kind:'contributions',status:'RECORDED'}],unassigned:[{id:'fixture:undated',source:'Supabase',sourceId:'fixture-undated',kind:'withdrawals',amount:85},{id:'fixture:overdue',source:'Supabase',sourceId:'fixture-overdue',kind:'pending',amount:100,date:'2026-10-15',overdue:true}]};
   };
   window.SutiSupabase={getClient:()=>({functions:{invoke:async(name,options)=>{
    const body=options.body,session=window.__session;window.__calls.push({name,...body});
    if(window.__hold&&body.action==='CASH_FLOW')await new Promise(resolve=>window.__waiting.push({from:body.from,resolve}));
    return {error:null,data:{context:{actor:window.__wrongContext?'different-actor':'isolated-actor',effective_affiliate:'isolated-affiliate',session},...(window.__error?{error:window.__error}:{data:body.action==='CASH_FLOW'?fixture(body.from):{year:body.year,consultedAt:'2026-10-30T19:00:00Z',sheets:{},issues:[],records:[]}})}};
   }}})};
  });
  for(const file of ['app/reports-jc-repository.js','app/cash-flow-report.jsx','app/reports-jc-admin.jsx'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{window.__root=ReactDOM.createRoot(document.getElementById('root'));window.__mount=key=>window.__root.render(React.createElement(ReportsJcAdminModule,{key,app:{},onBack:()=>{}}));window.__mount('first');});
  await page.getByRole('tab',{name:'Préstamos Concentrado',exact:true}).waitFor();assert.equal(await page.getByRole('tab').count(),8);
  await page.getByRole('button',{name:'Reporte Flujo de efectivo',exact:true}).click();
  const table=page.getByRole('table',{name:'Flujo de efectivo de Ahorro y Caja de Ahorro'});await table.waitFor();
  if(process.argv.includes('--labels-only')){
   assert.match(await table.locator('[data-status=PENDING]').first().innerText(),/Pendiente autorizado/);
   await table.locator('[data-cash-flow-row=contributions] button').first().click();
   assert.match(await page.getByRole('table',{name:'Registros de origen'}).innerText(),/Aportaciones realizadas/);
   assert.doesNotMatch(await page.getByRole('table',{name:'Registros de origen'}).innerText(),/contributions/);
   await page.keyboard.press('Escape');
   await page.locator('[data-cash-flow-unassigned]>summary').click();
   const text=await page.locator('[data-cash-flow-unassigned]').innerText();
   assert.match(text,/fuera de la distribución mensual/);assert.match(text,/Retiros pagados/);assert.match(text,/Sin fecha suficiente/);assert.match(text,/Pendiente vencido · 2026-10-15/);assert.match(text,/Retiros autorizados pendientes/);assert.doesNotMatch(text,/withdrawals|\bpending\b/);
   assert.match(await page.locator('.cfr').innerText(),/Los ajustes son correcciones contables, no entradas ni salidas de efectivo/);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   const result={status:'PASS',pendingLabel:true,recordKindsTranslated:true,unassignedKindsTranslated:true,overdueDateDistinguished:true,adjustmentNotCashNote:true,externalRequests:0};fs.writeFileSync(path.join(output,'labels-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));return;
  }
  assert.equal(await table.locator('thead th').count(),13);assert.equal(await table.locator('[data-cash-flow-row]').count(),12);
  assert.match(await table.innerText(),/Ahorro Voluntario/);assert.match(await table.innerText(),/Préstamos de Caja de Ahorro/);
  assert.equal(await table.locator('[data-status=PARTIAL]').first().innerText(),'$220.00\nSubtotal identificado');
  assert.match(await table.locator('[data-status=UNAVAILABLE]').first().innerText(),/^Por determinar/);
  assert.match(await table.locator('[data-status=SCHEDULED]').first().innerText(),/Programado/);
  const firstCell=table.locator('[data-cash-flow-row=contributions] button').first();await firstCell.click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();assert.match(await dialog.innerText(),/fixture-source-1/);assert.match(await dialog.innerText(),/savings_movements/);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.getByRole('button',{name:'Cerrar detalle',exact:true}).evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await firstCell.evaluate(e=>e===document.activeElement),true);
  await table.locator('[data-status=PARTIAL]').first().click();assert.match(await dialog.innerText(),/no representa el total del mes/);assert.match(await dialog.innerText(),/Falta la fecha/);await page.keyboard.press('Escape');
  await page.locator('[data-cash-flow-issues]>summary').click();assert.match(await page.locator('[data-cash-flow-issues]').innerText(),/Fecha histórica insuficiente/);
  await page.locator('[data-cash-flow-unassigned]>summary').click();assert.match(await page.locator('[data-cash-flow-unassigned]').innerText(),/fuera de los totales mensuales/);
  await page.screenshot({path:path.join(output,'cash-flow-desktop.png'),fullPage:true});
  await page.getByLabel('Mes inicial del flujo').fill('2028-03');await page.getByRole('button',{name:'Consultar',exact:true}).click();await page.waitForFunction(()=>window.__calls.at(-1).from==='2028-03'&&document.querySelector('.cfr-table'));
  assert.match(await table.locator('thead').innerText(),/2028/);assert.match(await table.locator('thead').innerText(),/2029/);
  await page.getByRole('button',{name:'Próximos 12 meses',exact:true}).click();await table.waitFor();
  assert.equal(await page.evaluate(()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const m=Number(p.month),expected=Number(p.year)+(m===12?1:0)+'-'+String(m===12?1:m+1).padStart(2,'0');return window.__calls.at(-1).from===expected;}),true);
  // Race: a slower older response must never replace the newer selected period.
  await page.evaluate(()=>{window.__hold=true;});await page.getByRole('button',{name:'Año actual',exact:true}).click();await page.waitForFunction(()=>window.__waiting.length===1);
  await page.getByRole('button',{name:'Próximos 12 meses',exact:true}).click();await page.waitForFunction(()=>window.__waiting.length===2);
  const selected=await page.getByLabel('Mes inicial del flujo').inputValue();await page.evaluate(()=>{window.__waiting[1].resolve();});await table.waitFor();
  await page.evaluate(()=>{window.__waiting[0].resolve();window.__hold=false;});await page.waitForTimeout(100);assert.equal(await page.getByLabel('Mes inicial del flujo').inputValue(),selected);
  assert.equal(await table.locator('thead th').nth(1).innerText(),await page.evaluate(from=>{const [y,m]=from.split('-').map(Number);return new Date(Date.UTC(y,m-1,1)).toLocaleDateString('es-MX',{month:'short',year:'numeric',timeZone:'UTC'});},selected));
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const sticky=table.locator('[data-cash-flow-row=contributions] th');const before=(await sticky.boundingBox()).x;await page.locator('.cfr-scroll').evaluate(e=>{e.scrollLeft=650;});const after=(await sticky.boundingBox()).x;assert(Math.abs(before-after)<2,'Concept labels must remain visible while months scroll');
  await page.screenshot({path:path.join(output,'cash-flow-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Volver a Reportes JC',exact:true}).click();await page.getByRole('tab',{name:'Préstamos Concentrado',exact:true}).waitFor();assert.equal(await page.getByRole('tab').count(),8);assert.equal(await page.getByLabel('Exportación').count(),1);assert.equal(await page.getByLabel('Mes de consulta').count(),1);
  await page.getByRole('button',{name:'Reporte Flujo de efectivo',exact:true}).click();await table.waitFor();
  await page.evaluate(()=>{window.__error='SOURCE_UNAVAILABLE';});await page.getByRole('button',{name:'Consultar',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await table.count(),0,'Source failure must clear prior amounts');
  await page.evaluate(()=>{window.__error=null;window.__wrongContext=true;});const rejected=await page.evaluate(async()=>{try{await ReportsJcRepository.cashFlow('2028-01');return false;}catch(e){return e.message;}});assert.equal(rejected,'CONTEXT_CHANGED');
  await page.evaluate(()=>{window.__wrongContext=false;window.__phase='unauthenticated';});const denied=await page.evaluate(async()=>{try{await ReportsJcRepository.cashFlow('2028-01');return false;}catch(e){return e.message;}});assert.equal(denied,'AUTH_REQUIRED');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(await page.evaluate(()=>window.__calls.every(c=>c.action==='LOAD'||c.action==='CASH_FLOW')),true);
  const result={status:'PASS',syntheticServiceOnly:true,externalRequests:0,readOnlyCalls:true,months:12,originalReportTabs:8,originalControlsPreserved:true,partialAndUnknownDistinguished:true,sourceDetail:true,dialogKeyboardAndFocus:true,currentYearAndNext12Months:true,staleResponseDiscarded:true,contextMismatchRejected:true,sourceFailureClearsAmounts:true,mobileNoPageOverflow:true,stickyConceptColumn:true};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
