'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const workspace=path.resolve(__dirname,'..'),out=path.join(workspace,'docs/qa/evidence/admin-screen-permissions-20260914');
async function main(){
 const env={};for(const line of fs.readFileSync(path.join(workspace,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 const production=process.argv.includes('--production'),server=production?null:await serve(),url=production?'https://sutiapp.com/':`http://127.0.0.1:${server.address().port}/SutiApp.html`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],checks=[];
 const fixture={email:'screen-permissions-fixture@example.invalid',auth_user_id:'00000000-0000-4000-8000-000000000123',mode:'unassigned',version:'fixture-v1',protected:false,self:false,modules:[]};let payload,scoped=false;
 const limited={role_code:'module_admin',full_access:false,module_access_version:1,module_keys:['affiliates'],technical_permissions:['affiliates.read','affiliates.write','documents.read','documents.write','assets.read','bank_accounts.read'],section_actions:[]};
 page.on('pageerror',e=>errors.push(e.message));
 if(!production){
  await page.route('**/rest/v1/rpc/get_admin_user_modules',r=>r.fulfill({json:fixture}));
  await page.route('**/rest/v1/rpc/save_admin_user_modules',r=>{payload=r.request().postDataJSON();Object.assign(fixture,{mode:payload.p_mode,modules:payload.p_modules,version:'fixture-v2'});return r.fulfill({json:fixture});});
  await page.route('**/rest/v1/rpc/get_admin_refresh_context',r=>scoped?r.fulfill({json:limited}):r.continue());
 }
 try{
  await page.goto(url+'#/admin/screen_permissions',{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForSelector('[data-admin-screen-catalog=sidebar]',{timeout:60000});
  for(const button of await page.locator('[data-admin-sidebar-group]').all())if(await button.getAttribute('aria-expanded')==='false')await button.click();
  const sidebar=await page.locator('[data-admin-sidebar-module]').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.adminSidebarModule,label:n.textContent.trim()})).sort((a,b)=>a.key.localeCompare(b.key)));
  const options=await page.locator('[data-admin-screen-option]').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.adminScreenOption,label:n.childNodes[0].textContent.trim()})).sort((a,b)=>a.key.localeCompare(b.key)));
  assert.equal(options.length,33);assert.deepEqual(options,sidebar);assert(options.some(x=>x.key==='affiliates'&&x.label==='Afiliados'));checks.push('all33SidebarScreensAndLabelsMatch','affiliatesVisibleBeforeLookup');
  const sections=page.locator('[data-admin-screen-permissions=backend-registry]');await sections.locator('option').first().waitFor({state:'attached'});const previous=await sections.locator('select').inputValue();const alternatives=await sections.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));assert(alternatives.length>1);await sections.locator('select').selectOption(alternatives.find(x=>x!==previous));assert.notEqual(await sections.locator('select').inputValue(),previous);checks.push('legacySectionPickerPreserved');
  await page.getByLabel('Correo para asignar pantallas').fill(production?env.H005_TEST_EMAIL:fixture.email);await page.getByRole('button',{name:'Buscar cuenta',exact:true}).click();await page.waitForSelector('[data-admin-module-account=resolved]');
  assert.equal(await page.locator('[data-admin-module-choice]').count(),33);
  if(production){assert(await page.getByRole('button',{name:'Guardar pantallas',exact:true}).isDisabled());assert(await page.locator('[data-admin-module-choice=affiliates]').isChecked());checks.push('realConfirmedAccountLookup','selfProtectionPreserved');}
  else{
   await page.locator('[data-admin-module-choice=affiliates]').check();await page.getByRole('button',{name:'Guardar pantallas',exact:true}).click();await page.getByText('Pantallas guardadas.',{exact:false}).waitFor();
   assert.deepEqual(payload.p_modules,['affiliates']);assert.equal(payload.p_mode,'limited');assert.equal(payload.p_expected_version,'fixture-v1');
   await page.getByRole('button',{name:'Buscar cuenta',exact:true}).click();await page.waitForSelector('[data-admin-module-account=resolved]');assert.deepEqual(await page.locator('[data-admin-module-choice]:checked').evaluateAll(nodes=>nodes.map(n=>n.dataset.adminModuleChoice)),['affiliates']);checks.push('affiliatesOnlyExactSave','persistedReadback');
   await page.locator('[data-admin-user-modules]').screenshot({path:path.join(out,'screen-editor-desktop.png')});
   await page.setViewportSize({width:390,height:844});await page.waitForSelector('[data-admin-screen-catalog=sidebar]');await page.getByLabel('Correo para asignar pantallas').fill(fixture.email);await page.getByRole('button',{name:'Buscar cuenta',exact:true}).click();await page.waitForSelector('[data-admin-module-account=resolved]');assert(await page.locator('[data-admin-module-choice=affiliates]').isChecked());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'screen-editor-mobile.png')});await page.getByRole('button',{name:'Guardar pantallas',exact:true}).click();await page.getByText('Pantallas guardadas.',{exact:false}).waitFor();assert.deepEqual(payload.p_modules,['affiliates']);checks.push('mobileEditorAndSaveReachable');
   await page.setViewportSize({width:1440,height:1000});scoped=true;await page.evaluate(v=>window.AdminRepository.primeAccessContext(v),limited);await page.waitForSelector('[data-admin-view=menu]');
   assert.deepEqual(await page.locator('[data-admin-module]').evaluateAll(nodes=>nodes.map(n=>n.dataset.adminModule)),['affiliates']);for(const button of await page.locator('[data-admin-sidebar-group]').all())if(await button.getAttribute('aria-expanded')==='false')await button.click();assert.deepEqual(await page.locator('[data-admin-sidebar-module]').evaluateAll(nodes=>nodes.map(n=>n.dataset.adminSidebarModule)),['affiliates']);checks.push('affiliatesOnlySidebarAndSummary');
   await page.evaluate(()=>{location.hash='#/admin/finanzas';});await page.waitForFunction(()=>location.hash==='#/admin/menu');checks.push('unselectedRouteDenied');
  }
  assert.deepEqual(errors,[]);const result={status:'PASS',mode:production?'PRODUCTION':'LOCAL_ISOLATED_WRITER_FIXTURES',url,checks,errors,catalog:'real installed RPC',permissionWrites:0,businessWrites:0};fs.writeFileSync(path.join(out,production?'production.json':'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await context.close();await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
