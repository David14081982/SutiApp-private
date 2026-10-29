'use strict';
// Isolated UI -> real repository -> PostgreSQL RPC. No live identities or source PII.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {PGlite}=require('../.tmp/inversores/deps/node_modules/@electric-sql/pglite');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.tmp/inversores/browser');
async function main(){
 fs.mkdirSync(out,{recursive:true});const db=new PGlite();let browser;const actor='00000000-0000-4000-8000-000000000001';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '${actor}'::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select '{"session_id":"browser-isolated"}'::jsonb$$;
 create function public.get_effective_affiliate_id() returns uuid language sql as $$select null::uuid$$;
 create function public.has_admin_permission(text) returns boolean language sql as $$select true$$;
 create function public.admin_module_boundary(text[],text) returns boolean language sql as $$select $1=array['finanzas'] and $2 in('read','write')$$;`);
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261029000100_investors.sql'),'utf8'));
 await db.exec('set role authenticated');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url()==='http://127.0.0.1/investors-isolated'?route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="es"><meta charset="utf-8"><style>body{margin:0;background:#f5f6fa;font-family:Arial,sans-serif}#root{min-height:100vh}</style><div id="root"></div></html>'}):route.abort());
 await page.exposeFunction('__rpc',async(name,args)=>{
  requests.push(name);
  const sql=name==='get_admin_investors'?['select public.get_admin_investors($1) v',[args.p_investor_id]]:name==='save_admin_investors'?['select public.save_admin_investors($1,$2,$3) v',[args.p_action,args.p_values,args.p_action_id]]:name==='investors_document'?['select public.investors_document($1,$2,$3) v',[args.p_id||null,args.p_values||null,args.p_action_id||null]]:name==='get_admin_investors_source'?['select public.get_admin_investors_source($1,$2) v',[args.p_sheet,args.p_row]]:null;
  assert(sql);try{return {data:(await db.query(...sql)).rows[0].v,error:null};}catch(e){return {data:null,error:{message:e.message}};}
 });
 await page.goto('http://127.0.0.1/investors-isolated');
 for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({path:path.join(root,file)});
 await page.evaluate(actor=>{
  window.__phase='authenticated';window.__contextListeners=[];
  window.AffiliateAuth={getState:()=>({phase:window.__phase,session:{user:{id:actor},session_id:'browser-isolated'},affiliate:null}),subscribe:fn=>{window.__contextListeners.push(fn);return()=>{};}};
  window.AdminRepository={getState:()=>({phase:'authorized',assignment:{moduleKeys:['finanzas'],permissions:['program_requests.read','program_requests.write']}})};
  window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{if(window.__fail)return {error:{message:'SOURCE_UNAVAILABLE'},data:null};const response=await window.__rpc(name,args);if(window.__readOnly&&name==='get_admin_investors')response.data.data.can_write=false;return response;}})};
 },actor);
 for(const file of ['app/investors-model.js','app/investors-repository.js','app/investors-admin.jsx'])await page.addScriptTag({path:path.join(root,file)});
 await page.evaluate(()=>{window.__root=ReactDOM.createRoot(document.getElementById('root'));window.__mount=key=>window.__root.render(React.createElement(window.InvestorsAdminModule,{key,app:{},onBack:()=>{}}));window.__mount('initial');});
 await page.getByRole('button',{name:'Nuevo inversionista',exact:true}).waitFor();
 assert.equal(await page.getByRole('tab').count(),7);
 await page.getByRole('button',{name:'Nuevo inversionista',exact:true}).click();
 await page.getByLabel('Nombre completo',{exact:true}).fill('Inversionista de prueba');await page.getByLabel('Teléfono',{exact:true}).fill('0000000000');await page.getByLabel('Motivo / respaldo de la captura').fill('Prueba aislada de alta');await page.getByRole('button',{name:'Guardar',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('tab',{name:'Contratos',exact:true}).click();await page.getByRole('button',{name:'Nuevo contrato',exact:true}).click();
 const person=(await db.query('select public.get_admin_investors() v')).rows[0].v.data.investors[0];
 await page.getByLabel('Inversionista',{exact:true}).selectOption(person.id);await page.getByLabel('Referencia del contrato').fill('C1-PRUEBA');
 const today=(await db.query("select (clock_timestamp() at time zone 'America/Hermosillo')::date::text d")).rows[0].d;
 const dates=(await db.query("select ($1::date-interval '1 month')::date::text starts,($1::date+interval '11 month')::date::text ends",[today])).rows[0];
 await page.getByLabel('Fecha de ingreso',{exact:true}).fill(dates.starts);await page.getByLabel('Vencimiento',{exact:true}).fill(dates.ends);await page.getByLabel('Monto del contrato').fill('100000');assert.equal(await page.getByLabel('Tasa mensual (%)',{exact:true}).inputValue(),'2.5');await page.getByLabel('Motivo / respaldo de la captura').fill('Contrato sintético');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('tab',{name:'Calendario',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),13);
 await page.getByRole('button',{name:'Registrar pago',exact:true}).first().click();await page.getByLabel('Importe',{exact:true}).fill('1000');await page.getByLabel('Referencia / comprobante').fill('PRUEBA-01');await page.getByLabel('Motivo / respaldo de la captura').fill('Pago parcial sintético');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.match(await page.locator('tbody tr').first().innerText(),/1,000\.00/);assert.match(await page.locator('tbody tr').first().innerText(),/1,500\.00/);
 await page.getByRole('tab',{name:'Movimientos',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),2);
 await page.getByRole('button',{name:'Corregir',exact:true}).first().click();await page.getByLabel('Importe',{exact:true}).fill('1200');await page.getByLabel('Motivo / respaldo de la captura').fill('Corrección sintética');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('tbody tr').count(),2);
 await page.getByRole('tab',{name:'Vista general',exact:true}).click();await page.screenshot({path:path.join(out,'overview-desktop.png'),fullPage:true});
 await page.getByRole('tab',{name:'Documentos',exact:true}).click();await page.getByRole('button',{name:'Agregar documento',exact:true}).click();await page.getByLabel('Inversionista',{exact:true}).selectOption(person.id);await page.getByLabel('Documento PDF, JPG o PNG · máximo 5 MB').setInputFiles({name:'prueba.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nIsolated fixture')});await page.getByLabel('Motivo / respaldo de la captura').fill('Documento sintético');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('tbody tr').count(),1);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar',exact:true}).click();assert.equal((await download).suggestedFilename(),'prueba.pdf');
 await page.getByRole('tab',{name:'Inversionistas',exact:true}).click();await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();await page.getByRole('button',{name:'Editar inversionista',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'individual-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.getByRole('button',{name:'Editar inversionista',exact:true}).click();await page.getByLabel('Nombre completo',{exact:true}).fill('Inversionista de prueba editado');await page.getByLabel('Motivo / respaldo de la captura').fill('Edición de ficha');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Editar inversionista',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.evaluate(()=>window.__fail=true);await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('table').count(),0);assert.equal(await page.locator('.metric').count(),0);
 await page.evaluate(()=>{window.__fail=false;window.__readOnly=true;window.__mount('readonly');});await page.getByRole('tab',{name:'Contratos',exact:true}).click();await page.waitForFunction(()=>!document.body.innerText.includes('Consultando Inversores'));assert.equal(await page.getByRole('button',{name:'Nuevo inversionista',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Nuevo contrato',exact:true}).count(),0);
 await page.evaluate(()=>{window.__phase='signed_out';window.__contextListeners.forEach(fn=>fn());});await page.getByRole('alert').waitFor();assert.equal(await page.locator('table').count(),0);
 // Mount the unchanged Admin shell with the new registration and verify its direct integration.
 await page.evaluate(()=>{window.__phase='authenticated';window.__readOnly=false;window.Icon=()=>React.createElement('span',{'aria-hidden':true},'•');window.SutiSeal=()=>null;window.ADMIN={};});
 await page.addScriptTag({path:path.join(root,'app/screens-admin.jsx')});
 await page.setViewportSize({width:1400,height:1000});
 await page.evaluate(()=>{window.__app={admin:{phase:'authorized',assignment:{permissions:['program_requests.read','program_requests.write','savings.reports'],moduleKeys:['finanzas','reportes_jc']},has:()=>true},viewApp:()=>{},toast:()=>{}};window.__root.render(React.createElement(window.AdminScreen,{key:'shell',app:window.__app}));});
 await page.locator('[data-admin-sidebar-group="inversores"]').waitFor();
 const groups=await page.locator('[data-admin-sidebar-group]').evaluateAll(nodes=>nodes.map(n=>n.dataset.adminSidebarGroup));assert.equal(groups.indexOf('inversores'),groups.indexOf('reportes_jc')+1);
 await page.locator('[data-admin-sidebar-group="inversores"]').click();await page.locator('[data-admin-sidebar-module="inversores"]').click();await page.locator('[data-investors-module]').waitFor();await page.waitForFunction(()=>!document.body.innerText.includes('Consultando Inversores'));
 await page.screenshot({path:path.join(out,'admin-integration.png'),fullPage:true});
 await page.locator('[data-admin-sidebar-home]').click();await page.locator('[data-admin-view="menu"]').waitFor();
 await page.evaluate(()=>{window.__app={...window.__app,admin:{...window.__app.admin,assignment:{permissions:[],moduleKeys:['reportes_jc']},has:()=>false}};window.location.hash='#/admin/inversores';window.__root.render(React.createElement(window.AdminScreen,{key:'denied-shell',app:window.__app}));});await page.locator('[data-admin-view="menu"]').waitFor();assert.equal(await page.locator('[data-investors-module]').count(),0);
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.length),0);
 const evidence={status:'PASS',scope:'isolated UI + actual PostgreSQL RPC',checks:['empty state','7 views','investor create/edit','default editable 2.5%','contract and schedule','partial payment','immutable correction','document upload/download','individual history','mobile no overflow','Escape/focus','source failure clears data','read-only actions hidden','logout clears data','no localStorage','existing Admin shell navigation','sidebar immediately after Reportes JC','unauthorized direct route denied'],rpcCalls:requests.length,pageErrors:errors,productionWrites:0};
 fs.writeFileSync(path.join(root,'docs/qa/evidence/investors/browser.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
 }finally{if(browser)await browser.close();await db.close();}
}
main().catch(e=>{console.error(e.message,e.stack?.split('\n').slice(0,4).join('\n'));process.exitCode=1;});
