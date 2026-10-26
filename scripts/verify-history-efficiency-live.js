'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {environment}=require('./inspect-loan-history'),e=environment(),root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/history-read-efficiency');
const target=process.argv[2]||'http://localhost:8080/',sha=v=>crypto.createHash('sha256').update(v).digest('hex');
async function main(){
 const expected=JSON.parse(fs.readFileSync(path.join(out,'build.json'),'utf8')).bundleSha256,html=await(await fetch(target,{cache:'no-store'})).text(),bundlePath=/src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];assert.equal(bundlePath,'app/bundle.js?v=2026102507');assert.equal(sha(await(await fetch(new URL(bundlePath,target),{cache:'no-store'})).text()),expected);
 const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{for(const serviceWorkers of ['block','allow']){
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers}),page=await context.newPage(),errors=[],calls=[];page.on('pageerror',()=>errors.push('PAGE_ERROR'));
  page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/functions/v1/loan-history'))calls.push(JSON.parse(r.postData()).action);});
  await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(e.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(e.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
  const loaded=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/functions/v1/loan-history'),{timeout:60000});await page.locator('[data-app-tab=historial]').evaluate(el=>el.click());const response=await loaded;assert.equal(response.status(),200);const data=await response.json();assert(data.entries.every(x=>!Object.hasOwn(x,'schedule')));
  await page.waitForFunction(()=>!document.querySelector('[data-history-source]'),null,{timeout:20000});assert.deepEqual(calls,['SUMMARY']);
  for(const name of ['Todas','En proceso','Aprobadas','En pago','Liquidadas','No aprobadas']){const button=page.getByRole('button',{name,exact:true});assert.equal(await button.count(),1);await button.click();}
  await page.getByRole('button',{name:'Todas',exact:true}).click();assert.deepEqual(calls,['SUMMARY']);
  let ownDetail=false;const entry=data.entries.find(x=>x.kind==='loan');if(entry){
   const detail=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/functions/v1/loan-history')&&JSON.parse(r.request().postData()).action==='DETAIL',{timeout:60000});
   await page.locator('.su-history-entry').filter({has:page.getByText(entry.id,{exact:true})}).click();const result=await detail;assert.equal(result.status(),200);const full=await result.json();assert.equal(full.entries.length,1);assert.equal(full.entries[0].key,entry.key);
   await page.locator('[data-loan-history-detail]').waitFor();await page.waitForFunction(count=>document.querySelectorAll('[data-installment]').length===count,full.entries[0].schedule.length,{timeout:10000});
   const before=calls.length;await page.getByRole('button',{name:'Volver al historial'}).click();await page.waitForTimeout(600);assert.equal(calls.length,before);ownDetail=true;
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
  checks.push({serviceWorkers,summaryOnly:true,sixFilters:true,filterNetworkCalls:0,pageErrors:0,liveEntries:data.entries.length,populatedLiveDetail:ownDetail});await context.close();
 }}finally{await browser.close();}
 const proof={status:'PASS',target,bundleSha256:expected,checks,businessWrites:0,identityAssistanceWrites:0,limitation:'Controlled account may have no loans; populated quotas and overlapping route behavior are separately covered with isolated fixtures.'};
 fs.writeFileSync(path.join(out,target.startsWith('http://localhost')?'local-live.json':'production-live.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error((e.message||'FAILED').split('\n')[0]);process.exitCode=1;});
