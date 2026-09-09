'use strict';
// Read-only local executable bundle against the real backend. No saved profile/file.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.resolve('scripts/test-admin-affiliates-browser.js');
let source=fs.readFileSync(file,'utf8').split('async function main(){')[0];
source+=`
async function main(){
 const values=env();let browser,server;
 try{
 const port=await freePort();server=await serve(port);browser=await loadPlaywright().chromium.launch({headless:true,executablePath:chromePath});
 const page=await browser.newPage({viewport:{width:1100,height:849}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:'+port+'/SutiApp.html',{waitUntil:'domcontentloaded'});
 await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
 await page.waitForFunction(()=>window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated',null,{timeout:45000});
 const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.evaluate(e=>e.click());
 await page.waitForSelector('[data-admin-module="affiliates"]',{timeout:45000});await page.locator('[data-admin-module="affiliates"]').evaluate(e=>e.click());
 await page.waitForSelector('[data-admin-affiliate-detail]',{timeout:45000});
 await page.getByRole('button',{name:/Editar informaci/}).click();const form=page.locator('[data-affiliate-edit-form]');
 const save=form.getByRole('button',{name:'Guardar cambios auditados'});await save.scrollIntoViewIfNeeded();const bounds=await save.boundingBox();assert(bounds.y+bounds.height<=849);assert(await save.isEnabled());
 await form.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('button',{name:'Expediente',exact:true}).click();await page.locator('[data-affiliate-upload-open]').click();await page.waitForSelector('[data-admin-affiliate-upload]');
 const modal=page.getByRole('dialog');await page.waitForFunction(()=>document.querySelector('[data-admin-affiliate-upload] select')?.options.length>0,null,{timeout:30000});
 const count=await modal.locator('select option').count();assert(count>0);await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 const result={status:'PASS',localBundleRealBackend:true,viewport:'1100x849',saveVisibleAndEnabled:true,documentCatalogLoaded:true,documentTypes:count,businessWrites:0,pageErrors:errors};assert.equal(errors.length,0);
 fs.writeFileSync(path.join(root,'docs/qa/evidence/affiliates-edit-documents-20260909/live-ui-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});`;
const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(source,file);
