'use strict';
// Read-only verification of the published artifact and authenticated controls.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/affiliates-edit-documents-20260909');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function env(){const values={};for(const line of fs.readFileSync(process.env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)values[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return values;}
async function main(){
 const base=process.argv[2]||'https://sutiapp.com/',values=env(),htmlResponse=await fetch(base,{cache:'no-store'});assert(htmlResponse.ok);
 const html=await htmlResponse.text(),bundlePath=html.match(/src="(app\/bundle\.js\?v=[^"]+)"/);assert(bundlePath);assert.equal(bundlePath[1],'app/bundle.js?v=238');
 const response=await fetch(new URL(bundlePath[1],base),{cache:'no-store'});assert(response.ok);const bytes=Buffer.from(await response.arrayBuffer());
 assert.equal(sha(bytes),sha(fs.readFileSync(path.join(root,'app/bundle.js'))),'Published bundle differs from release');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],writes=[],phases=[];
 try{
  const context=await browser.newContext({viewport:{width:1100,height:849}}),page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/(update_admin_affiliate|register_admin_affiliate_document)(\?|$)/.test(r.url())||r.method()==='POST'&&/\/storage\/v1\/object\/private-assets\//.test(r.url()))writes.push(r.method());});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
  const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.evaluate(e=>e.click());
  await page.locator('[data-admin-module="affiliates"]').click();await page.locator('[data-admin-affiliate-detail]').waitFor();
  await page.getByRole('textbox',{name:'Buscar afiliados'}).fill('3293');
  const target=page.locator('[data-affiliate-row]').filter({has:page.locator('.aff-control',{hasText:'3293'})}).first();await target.waitFor();await target.click();
  await page.waitForFunction(()=>document.querySelector('[data-admin-affiliate-detail] .aff-profile-head p')?.textContent.includes('3293'));
  await page.getByRole('button',{name:/Editar informaci/}).click();const form=page.locator('[data-affiliate-edit-form]');assert.equal(await form.locator('input').count(),25);assert.equal(await form.locator('select').count(),2);
  const save=form.getByRole('button',{name:'Guardar cambios auditados'});await save.scrollIntoViewIfNeeded();assert(await save.isEnabled());const box=await save.boundingBox();assert(box.y+box.height<=849);
  // Missing reason validates client-side and must never send a writer request.
  await save.click();assert((await form.getByRole('alert').textContent()).includes('8 caracteres'));await form.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Expediente',exact:true}).click();assert((await page.locator('.aff-document-actions').boundingBox()).y<(await page.locator('.aff-document-grid').boundingBox()).y);
  const replace=page.locator('[data-affiliate-document-replace]');assert(await replace.count()>0);await replace.first().click();let modal=page.getByRole('dialog');await modal.locator('select option').first().waitFor({state:'attached'});assert(await modal.locator('select').isDisabled());assert(await modal.locator('select').inputValue());await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.locator('[data-affiliate-upload-open]').click();modal=page.getByRole('dialog');await modal.locator('select option').first().waitFor({state:'attached'});const types=await modal.locator('select option').count();assert(types>0);await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  phases.push('Authenticated editor, required reason, document upload catalog and per-document replacement');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
  assert((await page.locator('script[src*="app/bundle.js"]').getAttribute('src')).includes('v=238'));phases.push('Authenticated refresh uses bundle v238');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const result={status:'PASS',url:base,bundleVersion:238,bundleSha256:sha(bytes),checks:phases,documentTypes:types,profileAndDocumentWrites:0,pageErrors:errors};
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'production-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
