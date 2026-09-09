'use strict';
// Real authenticated UI and HTTP contracts; deliberately never confirms a real banner deletion.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {env,proof}=require('./release-admin-banners-delete');
const target=process.argv[2]||'https://sutiapp.com/',label=process.argv[3]||'production',out=path.resolve(__dirname,'../docs/qa/evidence/admin-banners-delete-20260908');
async function main(){let browser;const report={status:'FAIL',target,checks:{},deleteRequests:0,pageErrors:[],viewports:[]};
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1440,height:950},reducedMotion:'reduce'});page.setDefaultTimeout(30000);
  page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(r.url().includes('/rpc/archive_admin_banner')||r.method()==='DELETE'&&r.url().includes('/banners'))report.deleteRequests++;});
  await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
  await page.locator('[data-app-tab=admin]').click();await page.locator('[data-admin-module=banners]').click();await page.locator('[data-h009-module=banners][data-h009-state=loaded]').waitFor();
  const rows=page.locator('[data-h009-item=banners]');const count=await rows.count();assert(count>0);assert.equal(await rows.getByRole('button',{name:'Eliminar banner',exact:true}).count(),count);
  const before=await rows.evaluateAll(rs=>rs.map(r=>({id:r.dataset.h009Id,text:r.innerText,buttons:[...r.querySelectorAll('button')].map(b=>b.getAttribute('aria-label'))})));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:950});await rows.first().getByRole('button',{name:'Eliminar banner',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.getByRole('heading').innerText(),'¿Eliminar banner?');assert(await dialog.getByRole('button',{name:'Cancelar',exact:true}).isVisible());assert(await dialog.getByRole('button',{name:'Eliminar banner',exact:true}).isVisible());
   const image=dialog.getByAltText('Miniatura del banner');assert(await image.isVisible());await page.waitForFunction(()=>{const i=document.querySelector('dialog img');return i&&i.complete&&i.naturalWidth>0;});const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width);fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,label+'-'+width+'.png')});await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await rows.count(),count);report.viewports.push({width,thumbnail:'PASS',dialog:'PASS',cancel:'PASS'});
  }
  const after=await rows.evaluateAll(rs=>rs.map(r=>({id:r.dataset.h009Id,text:r.innerText,buttons:[...r.querySelectorAll('button')].map(b=>b.getAttribute('aria-label'))})));assert.deepEqual(after,before);
  report.checks.existingControlsAndOrder='PASS';report.checks.allBannersHaveDelete='PASS';
  const http=await page.evaluate(async()=>{const c=SutiSupabase.getClient(),r=await c.rpc('archive_admin_banner',{p_banner_id:'00000000-0000-0000-0000-000000000000'});return {code:r.error?.code,message:r.error?.message};});assert.equal(http.code,'P0002');assert.equal(http.message,'BANNER_NOT_FOUND');report.checks.rpcDeployedAuthenticated='PASS';assert.equal(report.deleteRequests,1); // Invalid UUID probe only.
  const denied=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/archive_admin_banner',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_banner_id:'00000000-0000-0000-0000-000000000000'})});assert([401,403].includes(denied.status));report.checks.anonHttp='DENIED';
  assert.deepEqual(report.pageErrors,[]);report.businessWrites=0;report.status='PASS';
 }finally{if(browser)await browser.close();proof(label,report);}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
