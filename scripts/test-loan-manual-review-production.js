'use strict';
// Owner-authorized focal verification: normal, 12087, one pending and Admin.
// Never submits/approves a request or alters financial/historical records.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{createRequire}=require('module');
const root=path.resolve(__dirname,'..');
async function main(){
 assert(process.argv.includes('--run'),'EXPLICIT_RUN_REQUIRED');
 const helper=path.join(root,'scripts/verify-loan-historical-resolution-production.js'),module={exports:{}};
 const h=new Function('require','__dirname','module',fs.readFileSync(helper,'utf8').split('async function main()')[0]+'\nreturn {workspaceRoot,loadEnv,expectedAssets,verifyAssets,blockedMutationReason,guardNoActiveAssistance,readProjectionAndQuote};')(createRequire(helper),path.dirname(helper),module);
 const workspace=h.workspaceRoot(),env=h.loadEnv(workspace),expected=h.expectedAssets();
 const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
 const dir=path.join(workspace,'.tmp/loan-manual-review/production');fs.mkdirSync(dir,{recursive:true});
 const report={status:'FAIL',profilesChecked:3,adminPendingCases:0,technicalCrashes:0,requestSubmissions:0,balanceWrites:0,historicalWrites:0,sessionsStarted:0,sessionsEnded:0,checks:[]};
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'allow',reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(45000);
 const errors=[],blocked=[];let actor=null,active=null,stage='start';
 page.on('pageerror',e=>errors.push(e.message));
 await context.exposeBinding('__reviewBlocked',(_,code)=>blocked.push(code));
 await context.addInitScript({content:'('+function(guard){const original=window.fetch.bind(window);window.fetch=async(input,init)=>{const req=new Request(input,init),body=['GET','HEAD'].includes(req.method)?'':await req.clone().text(),code=guard(req.url,req.method,body);if(code){await window.__reviewBlocked(code);throw Error(code);}return original(req);};}.toString()+')('+h.blockedMutationReason.toString()+');'});
 async function stop(){if(!active)return;const expected=active;const result=await page.evaluate(async({actor,target,reason})=>{const c=window.SutiSupabase.getClient(),r=await c.rpc('get_impersonation_context');if(r.error)throw Error('CLEANUP_READ_FAILED');const v=Array.isArray(r.data)?r.data[0]:r.data;if(!v)return 'already-ended';if(v.actor_real_auth_user_id!==actor||v.usuario_contexto_affiliate_id!==target||v.reason!==reason)throw Error('CLEANUP_CONTEXT_MISMATCH');await window.AdminRepository.stopImpersonation();const end=await c.rpc('get_impersonation_context');if(end.error||(Array.isArray(end.data)?end.data.length:!!end.data))throw Error('CLEANUP_FAILED');return 'ended';},expected);assert(['ended','already-ended'].includes(result));report.sessionsEnded++;active=null;}
 async function openLoan(){const close=page.locator('div[style*="z-index: 90"] button[aria-label="Cerrar"]:visible');if(await close.count())await close.first().click();await page.locator('[data-app-tab="financiera"]').click();await page.locator('[data-finance-summary-action="prestamo"]').click();}
 try{
  stage='assets';await page.goto('https://sutiapp.com/',{waitUntil:'domcontentloaded'});assert.equal(new URL(page.url()).hostname,'sutiapp.com');await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:60000});report.assets=await h.verifyAssets(page,expected,'allow');
  stage='login';await page.locator('input[type="email"]').fill(env.H005_TEST_EMAIL);await page.locator('input[type="password"]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>window.AdminRepository?.getState().phase==='authorized',null,{timeout:60000});actor=await page.evaluate(()=>window.AffiliateAuth.getState().session.user.id);await h.guardNoActiveAssistance(env,actor);
  stage='admin';const rows=await page.evaluate(()=>window.AdminFinanceQueueRepository.historicalReviews());assert.equal(rows.length,12);assert.equal(rows.filter(r=>r.numero_control==null).length,5);assert(rows.every(r=>r.status==='PENDING'&&r.evidence.length&&r.events.some(e=>e.action==='REGISTER'&&e.actor_auth_user_id&&e.created_at&&e.reason&&e.before_state&&e.resolution)));
  await page.locator('[data-app-tab="admin"]').click();await page.locator('[data-admin-module="finanzas"]').first().click();await page.locator('[data-historical-review-queue="ready"]').waitFor();assert.equal(await page.locator('[data-historical-review-case]').count(),12);await page.locator('[data-historical-review-case] summary').first().click();assert.match(await page.locator('[data-historical-review-queue]').innerText(),/Evidencia disponible/);report.adminPendingCases=12;report.adminReviewVisible='PASS';await page.screenshot({path:path.join(dir,'admin-private.png'),fullPage:true});
  for(const control of ['12815','12087','8797']){
   stage='profile-'+control;
   const target=await page.evaluate(async control=>{const rows=(await window.AdminRepository.searchAffiliates(control)).filter(r=>String(r.numero_control)===control);if(rows.length!==1)throw Error('EXACT_TARGET_REQUIRED');return rows[0].id||rows[0].affiliate_id;},control);
   const reason='H-LOAN-AMBIGUOUS-MANUAL-REVIEW-GUARD-001: verificación focal autorizada '+control+' '+new Date().toISOString();active={actor,target,reason};await page.evaluate(({target,reason})=>window.AdminRepository.startImpersonation(target,reason),active);report.sessionsStarted++;
   try{
    await page.locator('[data-impersonation-active]').waitFor();const proof=await page.evaluate(async({actor,target})=>{const r=await window.SutiSupabase.getClient().rpc('get_effective_affiliate_id');return {actor:window.AffiliateAuth.getState().session.user.id===actor,target:!r.error&&r.data===target};},active);assert(proof.actor&&proof.target);
    const review=await page.evaluate(async()=>{const r=await window.SutiSupabase.getClient().rpc('get_self_loan_historical_review');if(r.error)throw Error('REVIEW_RPC_FAILED');return r.data;});
    if(control==='8797'){
     assert.equal(review.status,'HISTORICAL_LOAN_MAPPING_REQUIRED');const opened=await page.evaluate(()=>window.financialLegacyStore.openLoanSession());assert.equal(opened.error,'HISTORICAL_LOAN_MAPPING_REQUIRED');assert(!opened.overview&&!opened.quote);await openLoan();await page.locator('[data-credit-state="HISTORICAL_LOAN_MAPPING_REQUIRED"]').first().waitFor();const text=await page.locator('[data-step-simulator-v2]').innerText();assert.match(text,/Tu información está registrada y será revisada por Finanzas/);assert(!/HISTORICAL_LOAN|No pudimos calcular|simulación fallida/.test(text));assert(await page.locator('[data-loan-flow-footer] button').isDisabled());
     await page.screenshot({path:path.join(dir,'pending-private.png'),fullPage:true});report.checks.push({case:'AMBIGUOUS',status:'PASS',state:'HISTORICAL_LOAN_MAPPING_REQUIRED',creditGranted:false});
    }else{
     assert.equal(review.status,'CLEAR');const result=await h.readProjectionAndQuote(page);fs.writeFileSync(path.join(dir,control+'-projection-private.json'),JSON.stringify(result,null,2));await openLoan();await page.waitForFunction(()=>document.querySelector('[data-step-simulator-v2]')?.dataset.state==='READY'&&!document.querySelector('[data-loan-flow-footer] button')?.disabled,null,{timeout:60000});assert(!await page.locator('[data-simulator-state="ERROR"]').count());report.checks.push({case:control==='12087'?'12087':'normal',status:'PASS',visibleFunds:result.projection.length,quotedFunds:result.quotes.length});
    }
   }finally{await stop();}
  }
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);assert.equal(report.sessionsStarted,report.sessionsEnded);report.technicalCrashes=0;report.status='PASS';
 }catch(e){report.failureStage=stage;report.failure=String(e.message).slice(0,250);fs.writeFileSync(path.join(dir,'failure-private.json'),JSON.stringify({stage,error:e.message,browserErrors:errors,blocked},null,2));throw e;}
 finally{try{await stop();}finally{if(actor)await page.evaluate(()=>window.SutiSupabase.getClient().auth.signOut({scope:'local'})).catch(()=>{});await browser.close();fs.writeFileSync(path.join(root,'docs/qa/evidence/loan-manual-review/production.json'),JSON.stringify(report,null,2)+'\n');}}
 console.log(JSON.stringify({status:report.status,profilesChecked:3,adminReviewVisible:report.adminReviewVisible,technicalCrashes:0}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
