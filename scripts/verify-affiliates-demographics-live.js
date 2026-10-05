'use strict';
// Published artifact + authenticated read-only UI. Never submits affiliate mutations.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/qa/evidence/affiliates-demographics');
const expected=JSON.parse(fs.readFileSync(path.join(dir,'release-package.json'),'utf8'));
const target=process.argv[2]||'https://sutiapp.com/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const env={};for(const line of fs.readFileSync(process.env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 const result={status:'FAIL',target,checkedAt:new Date().toISOString(),checks:[],businessWrites:0,realDataScreenshots:false};
 const htmlResponse=await fetch(target,{cache:'no-store'});assert(htmlResponse.ok,'HTML_UNAVAILABLE');const html=await htmlResponse.text();
 const bundlePath=/src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];assert.equal(bundlePath,'app/bundle.js?v='+expected.version);
 const response=await fetch(new URL(bundlePath,target),{cache:'no-store'});assert(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),expected.bundleSha256,'PUBLISHED_BUNDLE_MISMATCH');
 const download=path.join(root,'.tmp/affiliates-demographics/published-bundle.js');fs.mkdirSync(path.dirname(download),{recursive:true});fs.writeFileSync(download,bytes);
 const sw=await fetch(new URL('sw.js?v='+expected.version,target),{cache:'no-store'});assert(sw.ok);assert((await sw.text()).includes('sutiapp-v'+expected.version));
 result.bundleSha256=sha(bytes);result.version=expected.version;result.checks.push('Published HTML, bundle hash and service worker version match release');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],blockedWriters=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route(/\/rest\/v1\/rpc\/(create_admin_affiliate|update_admin_affiliate|change_admin_affiliate_status|archive_admin_affiliate|restore_admin_affiliate|register_admin_affiliate_document)(\?|$)/,async route=>{blockedWriters.push(new URL(route.request().url()).pathname);await route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
  const open=async()=>{const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.evaluate(e=>e.click());await page.waitForFunction(()=>document.querySelector('[data-admin-module="affiliates"], [data-admin-affiliate-detail]'));const entry=page.locator('[data-admin-module="affiliates"]');if(await entry.count())await entry.click();await page.locator('[data-admin-affiliate-detail]').waitFor();};
  await open();
  const controls=async container=>{
   for(const [label,values] of [['Género',['','Masculino','Femenino']],['Estado civil',['','Soltero(a)','Casado(a)','Unión Libre','Viudo(a)']]]){
    const select=container.getByLabel(label,{exact:true});assert.equal(await select.evaluate(e=>e.tagName),'SELECT');assert.deepEqual(await select.locator('option:not([disabled])').evaluateAll(nodes=>nodes.map(n=>n.value)),values);
   }
   assert.equal(await container.getByLabel('Número de hijos',{exact:true}).getAttribute('inputmode'),'numeric');
   for(const label of ['Tipo de empleado','Estatus de afiliación','Estatus laboral'])assert.equal(await container.getByLabel(label,{exact:true}).count(),0);
  };
  await page.getByRole('button',{name:'Editar información',exact:true}).click();let form=page.locator('[data-affiliate-edit-form]');await controls(form);await form.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(await page.locator('.aff-fact').filter({has:page.locator('span',{hasText:'Número de hijos'})}).count(),1);
  await page.getByRole('button',{name:'Afiliación',exact:true}).click();assert(!/Tipo de empleado|Estatus laboral/.test(await page.locator('.aff-facts').textContent()));
  await page.getByRole('button',{name:'Nuevo afiliado',exact:true}).click();let dialog=page.getByRole('dialog');await controls(dialog);await dialog.getByLabel('Número de hijos',{exact:true}).fill('0');assert.equal(await dialog.getByLabel('Número de hijos',{exact:true}).inputValue(),'0');await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  result.checks.push('Authenticated edit/create show exact choices and children count; retired controls absent; cancel without writes');
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Editar información',exact:true}).click();form=page.locator('[data-affiliate-edit-form]');await controls(form);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await form.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
  assert.equal(await page.locator('script[src*="app/bundle.js?v="]').getAttribute('src'),'app/bundle.js?v='+expected.version);
  await open();await page.getByRole('button',{name:'Editar información',exact:true}).click();await controls(page.locator('[data-affiliate-edit-form]'));
  result.checks.push('Mobile layout and authenticated refresh retain published fields and version');
  assert.deepEqual(errors,[],'BROWSER_ERRORS');assert.deepEqual(blockedWriters,[],'UNEXPECTED_WRITER');result.status='PASS';result.pageErrors=errors;result.affiliateMutationRequests=0;
 }finally{await browser.close();fs.writeFileSync(path.join(dir,'published.json'),JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
