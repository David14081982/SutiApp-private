'use strict';
// Real editor, adapter, repository and PostgreSQL RPCs. Every network request blocked.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {createDb}=require('./admin-permission-test-db');
async function main(){
 const x=await createDb(),{db,scalar,auth,owner,read}=x,errors=[],checks=[];
 let browser,queue=Promise.resolve();const dir=path.resolve(__dirname,'../docs/qa/evidence/screen-permission-fix-20260924');
 try{
  await db.exec(read('supabase/migrations/20260924000300_app_editorial_panels.sql'));
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1100,height:950},serviceWorkers:'block'});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='http://localhost:19443/'?r.fulfill({contentType:'text/html',body:'<html><body><main id="root"></main></body></html>'}):r.abort());
  await page.goto('http://localhost:19443/');
  await page.exposeFunction('__rpc',(name,p={})=>{
   const task=queue.then(async()=>{await auth(owner);try{
    const map={list_app_editorial_segments:['select list_app_editorial_segments() value',[]],list_app_editorial_screens:['select list_app_editorial_screens() value',[]],get_app_editorial:['select get_app_editorial($1,$2) value',[p.p_screen,p.p_admin]],save_app_editorial:['select save_app_editorial($1,$2,$3) value',[p.p_screen,p.p_expected_version,JSON.stringify(p.p_nodes)]],submit_app_editorial_form:['select submit_app_editorial_form($1,$2,$3,$4,$5) value',[p.p_id,p.p_screen,p.p_version,p.p_node_id,JSON.stringify(p.p_answers)]]};
    if(!map[name])throw Error('UNEXPECTED_RPC');return {data:await scalar(...map[name]),error:null};
   }catch(e){return {data:null,error:{message:e.message}};}});queue=task.catch(()=>{});return task;
  });
  const css=[...read('SutiApp.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');await page.addStyleTag({content:css});
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/ui.jsx','app/admin-store.jsx'])await page.addScriptTag({content:read(file)});
  await page.addScriptTag({content:`window.SutiSupabase={getClient:()=>({rpc:(n,p)=>window.__rpc(n,p)})};window.AdminCutoverStore={toCodes:(_,a)=>a||[],toLabels:(_,a)=>a||[]};window.ActingBanner=()=>null;window.useFlipRows=()=>{};`});
  await page.addScriptTag({content:read('app/content-state.js')});await page.evaluate(()=>{window.originalNewsProjection=window.EditorialContent;});
  for(const file of ['app/editorial-repository.js','app/editorial-content.jsx','app/screens-admin-content.jsx'])await page.addScriptTag({content:read(file)});
  assert.equal(await page.evaluate(()=>window.EditorialContent===window.originalNewsProjection&&typeof window.EditorialContent.bootstrap==='function'),true);
  checks.push('existing News projection global remains intact');
  await page.evaluate(()=>{window.testRoot=ReactDOM.createRoot(document.getElementById('root'));window.mountEditor=resource=>{window.EditorialRepository.clear();testRoot.render(React.createElement(window.ContentModule,{key:resource,resourceId:resource,typeFilter:resource==='menus'?'menu':resource==='formularios'?'form':undefined,app:{},onBack:()=>{},header:({title})=>React.createElement('h1',null,title)}));};});
  for(const [resource,label] of [['secciones','Sección verificada'],['menus','Menú verificado'],['formularios','Formulario verificado']]){
   await page.evaluate(r=>mountEditor(r),resource);await page.locator('[data-editorial-panel="'+resource+'"]').waitFor();await page.getByRole('button',{name:'Nuevo',exact:true}).click();
   await page.getByPlaceholder('Ej. Botón Préstamo').fill(label);
   if(resource==='secciones')await page.getByLabel('Contenido',{exact:true}).fill('Contenido persistido desde el panel');
   if(resource==='menus')await page.getByLabel('Abrir pantalla',{exact:true}).selectOption('documentos');
   if(resource==='formularios')await page.getByLabel('Etiqueta',{exact:true}).fill('Tu respuesta');
   await page.getByRole('button',{name:'Guardar',exact:true}).click();
   await page.getByRole('button',{name:'Nuevo',exact:true}).waitFor();
   assert.equal(await page.getByText(label,{exact:true}).count(),1);
   checks.push(resource+': actual New/Save controls persist and close only after success');
  }
  await page.evaluate(()=>{window.EditorialRepository.clear();window.navigation=[];testRoot.render(React.createElement(window.AppScreenLayout.Region,{screen:'home',app:{setTab:t=>navigation.push(t),push:t=>navigation.push(t)},builtins:{banner_convenio:()=>React.createElement('span',null,'Banner'),ecosistema:()=>React.createElement('span',null,'Ecosistema'),comite:()=>React.createElement('span',null,'Comité'),noticias:()=>React.createElement('span',null,'Noticias')},wrap:(id,n)=>React.createElement('div',{key:id,'data-reveal-key':id},n)}));});
  await page.getByText('Contenido persistido desde el panel',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Menú verificado',exact:true}).click();assert.deepEqual(await page.evaluate(()=>navigation),['documentos']);
  await page.getByLabel('Tu respuesta *',{exact:true}).fill('Respuesta real aislada');await page.getByRole('button',{name:'Enviar',exact:true}).click();await page.getByText('Respuesta enviada. Gracias.',{exact:true}).waitFor();
  checks.push('published renderer reloads actual saved section, menu navigation and form submission');
  assert.deepEqual(await page.locator('[data-reveal-key]').evaluateAll(a=>a.map(e=>e.dataset.revealKey)),['banner_convenio','ecosistema','comite','noticias']);
  checks.push('original four Home blocks and order retained');
  await page.screenshot({path:path.join(dir,'editorial-render-desktop.png'),fullPage:true});await page.setViewportSize({width:430,height:932});await page.screenshot({path:path.join(dir,'editorial-render-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'editorial-browser.json'),JSON.stringify({status:'PASS',productionWrites:0,network:'blocked',checks,pageErrors:errors},null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks}));
 }catch(e){console.error('Browser errors: '+JSON.stringify(errors));throw e;}finally{if(browser)await browser.close();await db.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
