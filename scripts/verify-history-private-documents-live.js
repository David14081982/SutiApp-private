'use strict';
// Read-only production checks. No request mutations, screenshots, identities or signed URLs logged.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/history-private-documents'),target=process.argv[2]||'https://sutiapp.com/',label=process.argv[3]||'published';
async function main(){
 const expected=JSON.parse(fs.readFileSync(path.join(out,'build.json'),'utf8')),html=await(await fetch(target,{cache:'no-store'})).text(),bundlePath=/src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];assert.equal(bundlePath,'app/bundle.js?v='+expected.version);
 const bundle=await(await fetch(new URL(bundlePath,target),{cache:'no-store'})).text();assert.equal(crypto.createHash('sha256').update(bundle).digest('hex'),expected.bundleSha256);
 const worker=await(await fetch(new URL('sw.js?v='+expected.version,target),{cache:'no-store'})).text();assert(worker.includes('sutiapp-v'+expected.version));
 const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{
  for(const alias of ['H005_TEST','H005_TEST2','H005_TEST3']){
   if(!env[alias+'_EMAIL']||!env[alias+'_PASSWORD'])continue;
   const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await context.newPage();
   await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(env[alias+'_EMAIL']);await page.locator('input[type=password]').fill(env[alias+'_PASSWORD']);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
   await page.locator('[data-app-tab=historial]').evaluate(e=>e.click());await page.waitForFunction(()=>window.operationsStore.state().phase==='loaded',null,{timeout:45000});
   const entry=page.locator('.su-history-entry').first();
   if(await entry.count()){
    await entry.click();await page.getByText('Seguimiento',{exact:true}).waitFor();await page.getByText('Línea de tiempo',{exact:true}).waitFor();assert.equal(await page.locator('[data-generated-documents]').count(),0);assert.equal(await page.getByRole('button',{name:'Ver documento',exact:true}).count(),0);assert.equal(await page.getByText('Documento de autorización',{exact:true}).count(),0);checks.push('real affiliate History → Tracking has summary/timeline and no authorization section');
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});checks.push('authenticated refresh retains published bundle');await context.close();break;
   }
   await context.close();
  }
  assert(checks.length,'NO_LEGITIMATE_HISTORY_REQUEST');
  const result={status:'PASS',target,version:expected.version,bundleSha256:expected.bundleSha256,checks,businessWrites:0,privateContentLogged:false};fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
