'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/admin-user-modules-20260914');
async function main(){
 const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 const local=process.argv.includes('--local'),server=local?await serve():null,url=local?'http://127.0.0.1:'+server.address().port+'/SutiApp.html':'https://sutiapp.com/';
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url+'#/admin/menu',{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForSelector('[data-admin-view=menu]',{timeout:60000});assert.equal(await page.locator('[data-admin-module]').count(),33);
  await page.locator('[data-admin-module=administrators]').click();await page.waitForSelector('[data-admin-user-modules]');
  await page.getByLabel('Correo para asignar pantallas').fill(env.H005_TEST_EMAIL);await page.getByRole('button',{name:'Buscar cuenta',exact:true}).click();await page.waitForSelector('[data-admin-module-account=resolved]');
  assert.equal(await page.locator('[data-admin-module-choice]').count(),33);assert(await page.getByRole('button',{name:'Guardar pantallas',exact:true}).isDisabled());
  assert.equal(await page.getByLabel('Tipo de acceso administrativo').inputValue(),'total');
  const read=await page.evaluate(async()=>{const c=await window.AdminCutoverRepository.listModuleCatalog();return{catalog:c.length,contextVersion:(await window.SutiSupabase.getClient().rpc('get_admin_access_context')).data.module_access_version};});
  assert.equal(read.catalog,33);assert.equal(read.contextVersion,1);
  await page.getByLabel('Correo para asignar pantallas').fill('module-nonexistent@example.invalid');await page.getByRole('button',{name:'Buscar cuenta',exact:true}).click();
  await page.getByText('No se encontró una cuenta confirmada y única con ese correo.',{exact:true}).waitFor();assert.equal(await page.locator('[data-admin-module-account=resolved]').count(),0);
  assert.deepEqual(errors,[]);
  const result={status:'PASS',url,mode:local?'LOCAL_RELEASE_INSTALLED_BACKEND':'PRODUCTION',realNewRPCs:true,mocks:false,checks:['fullAdmin33','realCatalog33','confirmedSelfLookup','selfChangeDisabled','installedContextVersion1','unknownAccountControlled'],permissionWrites:0,businessWrites:0,errors};
  fs.writeFileSync(path.join(out,local?'local-installed-browser.json':'production-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
