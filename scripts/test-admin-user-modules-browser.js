'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),vm=require('vm'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const workspace=path.resolve(__dirname,'..'),root=path.resolve(process.env.SUTIAPP_MODULE_RELEASE_ROOT||workspace),out=path.join(workspace,'docs/qa/evidence/admin-user-modules-20260914');
function env(){const e={};for(const line of fs.readFileSync(path.join(workspace,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)e[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return e;}
function serve(){const siteRoot=path.resolve(process.env.SUTIAPP_MODULE_SITE_ROOT||root);const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const relative=pathname==='/'?'SutiApp.html':decodeURIComponent(pathname.slice(1));const file=path.resolve(siteRoot,relative),ext=path.extname(file);if(!file.startsWith(siteRoot+path.sep)||!['.html','.js','.css','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.webmanifest','.woff2'].includes(ext)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':ext==='.html'?'text/html; charset=utf-8':ext==='.js'?'text/javascript; charset=utf-8':ext==='.css'?'text/css':'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);});return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));}
function catalog(){const source=fs.readFileSync(path.join(root,'app/screens-admin.jsx'),'utf8'),c={};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  const MODULES ='),source.indexOf('  const ADMIN_DESKTOP_BREAKPOINT'))+'this.modules=MODULES;',c);return Array.from(c.modules,m=>({key:m.id,label:m.label,total_only:['administrators','screen_permissions','roles'].includes(m.id)}));}
async function main(){
 const server=await serve(),values=env(),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
 const errors=[],tests=[];let savedPayload=null,conflict=false,scoped=false;
 const fixture={email:'module-ui-fixture@example.invalid',auth_user_id:'00000000-0000-4000-8000-000000000123',mode:'unassigned',version:'fixture-v1',protected:false,self:false,modules:[]};
 page.on('pageerror',e=>errors.push(e.message));
 // Only these three new endpoints are simulated in this isolated browser.
 // Backend writers/RLS are independently exercised against Supabase in ROLLBACK.
 await page.route('**/rest/v1/rpc/list_admin_module_catalog',r=>r.fulfill({json:catalog()}));
 await page.route('**/rest/v1/rpc/get_admin_user_modules',r=>r.fulfill({json:fixture}));
 await page.route('**/rest/v1/rpc/save_admin_user_modules',r=>{savedPayload=r.request().postDataJSON();if(conflict)return r.fulfill({status:400,json:{code:'40001',message:'ADMIN_ACCESS_CHANGED'}});fixture.mode=savedPayload.p_mode;fixture.modules=savedPayload.p_modules;fixture.version='fixture-v2';return r.fulfill({json:fixture});});
 const selected=['affiliates','requests','program_products','membresias'];
 const scopedContext={role_code:'module_admin',full_access:false,module_access_version:1,module_keys:selected,technical_permissions:['affiliates.read','program_requests.read','program_catalog.read','memberships.read'],section_actions:[]};
 await page.route('**/rest/v1/rpc/get_admin_refresh_context',async r=>{if(scoped)return r.fulfill({json:scopedContext});return r.continue();});
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}/SutiApp.html#/admin/menu`,{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForSelector('[data-admin-view=menu]',{timeout:60000});assert.equal(await page.locator('[data-admin-module]').count(),33);tests.push('total33');
  await page.locator('[data-admin-module=administrators]').click();await page.waitForSelector('[data-admin-user-modules]');
  assert.equal(await page.locator('[data-admin-assignment-form=total]').count(),1);
  await page.getByLabel('Correo para asignar pantallas').fill(fixture.email);await page.getByRole('button',{name:'Buscar cuenta',exact:true}).click();await page.waitForSelector('[data-admin-module-account=resolved]');
  for(const id of selected)await page.locator(`[data-admin-module-choice=${id}]`).check();
  assert(await page.locator('[data-admin-module-choice=roles]').isDisabled());
  await page.getByRole('button',{name:'Guardar pantallas',exact:true}).click();await page.getByText('Pantallas guardadas.',{exact:false}).waitFor();
  assert.deepEqual(savedPayload.p_modules,selected);assert.equal(savedPayload.p_expected_version,'fixture-v1');tests.push('editorExactSaveAndReadback');
  await page.waitForFunction(()=>!document.querySelector('[data-admin-module-choice=affiliates]').disabled);
  await page.locator('[data-admin-user-modules]').screenshot({path:path.join(out,'editor-desktop.png')});
  conflict=true;await page.locator('[data-admin-module-choice=banners]').check();await page.getByRole('button',{name:'Guardar pantallas',exact:true}).click();await page.getByText('Los permisos cambiaron en otra sesión.',{exact:false}).waitFor();assert.equal(await page.locator('[data-admin-module-account=resolved]').count(),0);tests.push('staleSaveDenied');
  scoped=true;await page.evaluate(value=>window.AdminRepository.primeAccessContext(value),scopedContext);await page.waitForSelector('[data-admin-view=menu]');
  assert.deepEqual(await page.locator('[data-admin-module]').evaluateAll(nodes=>nodes.map(n=>n.dataset.adminModule)),selected);tests.push('scopedDesktopCards');
  for(const button of await page.locator('[data-admin-sidebar-group]').all())if(await button.getAttribute('aria-expanded')==='false')await button.click();
  assert.deepEqual((await page.locator('[data-admin-sidebar-module]').evaluateAll(nodes=>nodes.map(n=>n.dataset.adminSidebarModule))).sort(),selected.slice().sort());tests.push('sidebarMatches');
  await page.evaluate(()=>{window.location.hash='#/admin/finanzas';});await page.waitForFunction(()=>window.location.hash==='#/admin/menu');assert.equal(await page.locator('[data-admin-module=finanzas]').count(),0);tests.push('directDenied');
  await page.setViewportSize({width:390,height:844});assert.deepEqual(await page.locator('[data-admin-module]').evaluateAll(nodes=>nodes.map(n=>n.dataset.adminModule)),selected);await page.locator('[data-admin-view=menu]').screenshot({path:path.join(out,'limited-mobile.png')});tests.push('mobileMatches');
  Object.assign(scopedContext,{module_keys:['sindicato'],technical_permissions:['union_content.read','companies.read','segmentation.read','marketplace.read'],section_actions:['documents','minutes','programs','agreements'].map(section_key=>({section_key,action:'read'}))});
  await page.evaluate(value=>window.AdminRepository.primeAccessContext(value),scopedContext);
  await page.locator('[data-admin-module=sindicato]').click();await page.locator('[data-union-admin-card=normas]').click();
  await page.waitForFunction(()=>location.hash==='#/admin/documents_admin');await page.getByText('Normas y Reglamentos',{exact:true}).first().waitFor();
  assert.equal(await page.locator('[data-admin-module=documents_admin]').count(),0);tests.push('unionChildEditorPreserved');
  assert.deepEqual(errors,[]);const result={status:'PASS',tests,errors,scope:'real browser; isolated new editor API fixtures; real login and legacy reads; backend verified separately',businessWrites:0,permissionWrites:0};fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(error){fs.writeFileSync(path.join(out,'browser-progress.json'),JSON.stringify({tests,errors,hash:await page.evaluate(()=>location.hash).catch(()=>null),admin:await page.evaluate(()=>window.AdminRepository?.getState()).catch(()=>null),error:error.message},null,2));throw error;
 }finally{await context.close();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={serve};
