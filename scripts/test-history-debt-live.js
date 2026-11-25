'use strict';
// Read-only own-account production verification. Never logs credentials or rows.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),target=process.argv[2]||'https://sutiapp.com/';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const expected=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/evidence/history-debt/build.json'),'utf8'));
 const response=await fetch(target,{cache:'no-store'});assert(response.ok);
 const html=await response.text(),src=/src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];assert.equal(src,'app/bundle.js?v=2026112501');
 const bundle=await fetch(new URL(src,target),{cache:'no-store'});assert(bundle.ok);assert.equal(hash(await bundle.text()),expected.bundleSha256);
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{for(const serviceWorkers of ['block','allow']){
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers}),page=await context.newPage(),errors=[];page.on('pageerror',()=>errors.push('PAGE_ERROR'));
  let observed=null;page.on('response',async response=>{if(response.url().includes('/functions/v1/loan-history')&&response.request().method()==='POST'&&response.request().postDataJSON()?.action==='LOAD'&&response.status()===200)observed=await response.json();});
  await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(process.env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(process.env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
  await page.locator('[data-app-tab=historial]').evaluate(e=>e.click());await page.locator('.su-debt-card[data-debt-state=ready],.su-debt-card[data-debt-state=review]').waitFor({timeout:60000});assert(observed,'OWN_READ_MISSING');
  const result=await page.evaluate(async()=>{const own=await LoanHistory.load(),debt=own.debt;return {debt,display:document.querySelector('[data-debt-total]').textContent,formatted:debt.total===null?null:money(debt.total/100,{dec:debt.total%100?2:0}),overflow:(()=>{const card=document.querySelector('.su-debt-card'),r=card.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||[...card.querySelectorAll('[data-debt-total],[data-debt-next],summary')].some(el=>{const box=el.getBoundingClientRect();return box.left<r.left-1||box.right>r.right+1;});})()};});
  if(result.debt.total!==null){
   const loans=observed.entries.filter(e=>e.kind==='loan');assert(loans.every(e=>!e.preparing&&Number.isFinite(e.total)&&Number.isFinite(e.paid_to_date)));
   const expectedCents=Math.round(loans.reduce((n,e)=>n+Math.max(0,e.total-e.paid_to_date),0)*100);assert.equal(result.debt.total,expectedCents);assert.equal(result.display,result.formatted);
  }else assert.equal(result.display,'Saldo por revisar');
  if(result.debt.loans.length){await page.locator('.su-debt-card summary').click();assert.equal(await page.locator('[data-debt-loan]').count(),result.debt.loans.length);}
  assert.equal(result.overflow,false);assert.deepEqual(errors,[]);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});await page.locator('[data-app-tab=historial]').evaluate(e=>e.click());await page.locator('.su-debt-card[data-debt-state=ready],.su-debt-card[data-debt-state=review]').waitFor({timeout:60000});assert.deepEqual(errors,[]);
  checks.push({serviceWorkers,ownRead:true,derivedAmountMatchesBackend:result.debt.total!==null,explicitReview:result.debt.total===null,loansWithBalance:result.debt.loans.length,reload:true,noOverflow:true,pageErrors:0});await context.close();
 }}finally{await browser.close();}
 const proof={status:'PASS',target,bundleSha256:expected.bundleSha256,checks,businessWrites:0,privateContentLogged:false,populatedAccordion:'See isolated responsive fixtures when controlled live account has no debt'};
 fs.writeFileSync(path.join(root,'docs/qa/evidence/history-debt/production.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
