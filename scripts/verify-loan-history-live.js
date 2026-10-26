'use strict';
// Read-only real-source checks. Never creates loans, approval events or user data.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {environment}=require('./inspect-loan-history');
const root=path.resolve(__dirname,'..'),env=environment(),out=path.join(root,'docs/qa/evidence/history-loan-payments'),dir=path.join(root,'.tmp/history-loan-payments');
const mode=process.argv[2]||'backend',target=process.argv[3]||'https://sutiapp.com/',sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const api=env.SUPABASE_URL,h={apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
async function response(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(60000)});return {status:r.status,headers:r.headers,body:await r.json().catch(()=>null)};}
function proof(name,data){fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
async function main(){
 if(mode==='backend'){
  const login=await response(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:h,body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});assert.equal(login.status,200,'LOGIN_FAILED');const headers={...h,Authorization:'Bearer '+login.body.access_token};
  const context=await response(api+'/rest/v1/rpc/get_self_loan_history_context',{method:'POST',headers,body:'{}'});assert.equal(context.status,200);assert.equal(context.body.actor,login.body.user.id);assert(context.body.folio);
  const anon=await response(api+'/functions/v1/loan-history',{method:'POST',headers:h,body:JSON.stringify({action:'LOAD'})});assert.equal(anon.status,401);
  const anonRpc=await response(api+'/rest/v1/rpc/get_self_loan_history_context',{method:'POST',headers:h,body:'{}'});assert([401,403].includes(anonRpc.status));
  const forged=await response(api+'/functions/v1/loan-history',{method:'POST',headers,body:JSON.stringify({action:'LOAD',folio:'OTHER_ACCOUNT'})});assert.equal(forged.status,400);assert.equal(forged.body.error,'HISTORY_REQUEST_INVALID');
  const origin=await response(api+'/functions/v1/loan-history',{method:'POST',headers:{...headers,Origin:'https://untrusted.invalid'},body:JSON.stringify({action:'LOAD'})});assert.equal(origin.status,403);
  const start=Date.now(),own=await response(api+'/functions/v1/loan-history',{method:'POST',headers:{...headers,Origin:'https://sutiapp.com'},body:JSON.stringify({action:'LOAD'})});
  if(own.status!==200){fs.writeFileSync(path.join(dir,'live-backend-error.json'),JSON.stringify({status:own.status,body:own.body}));throw Error('SELF_READ_HTTP_'+own.status+'_'+own.body?.error);}
  assert.equal(own.headers.get('cache-control'),'no-store');assert.equal(own.body.version,1);assert.equal(own.headers.get('access-control-allow-origin'),'https://sutiapp.com');
  // Independent verification only, never an application fallback. Read the
  // owner's shared workbook export; do not persist or log its identity rows.
  const sheet=await fetch('https://docs.google.com/spreadsheets/d/1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80/gviz/tq?tqx=out:json&sheet=HISTORIAL%20P%20V2&tq=select%20C%2CD',{signal:AbortSignal.timeout(30000)});assert.equal(sheet.status,200);
  const raw=await sheet.text(),match=raw.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);\s*$/);assert(match,'SOURCE_EXPORT_INVALID');const exported=JSON.parse(match[1]);assert.equal(exported.status,'ok');
  const rows=exported.table.rows.map(r=>r.c.map(c=>c==null?'':String(c.f??c.v??'')));
  const ownRows=rows.filter(r=>r[1]===context.body.folio&&r[0]),ids=[...new Set(ownRows.map(r=>r[0]))].sort(),loans=own.body.entries.filter(r=>r.key.startsWith('loan:'));
  assert.deepEqual(loans.map(r=>r.id).sort(),ids,'OWN_COVERAGE_MISMATCH');assert.equal(loans.reduce((n,r)=>n+r.schedule.length,0),ownRows.length);
  const requestIds=new Set(context.body.requests.map(r=>r.id));for(const r of own.body.entries){if(r.sourceId)assert(requestIds.has(r.sourceId),'FOREIGN_REQUEST');for(const q of r.schedule)assert.equal(q.state,q.date?q.date<=own.body.business_day?'Pagada':'Pendiente':'Fecha por revisar');if(r.category==='Aprobadas')assert(Date.parse(r.expires_at)-Date.parse(r.approved_at)===86400000);}
  const {category}=await import('../supabase/functions/loan-history/history.mjs');for(const r of loans)assert.equal(r.category,category(r.status,r.approved_at,own.body.server_now));
  proof('backend-live',{status:'PASS',authenticatedSelfRead:true,ownLoanCount:loans.length,ownQuotaCount:ownRows.length,sourceCoverageExact:true,ownRequestLinksOnly:true,anonymousStatus:anon.status,anonymousRpcStatus:anonRpc.status,forgedTargetStatus:forged.status,untrustedOriginStatus:origin.status,noStore:true,verificationMs:Date.now()-start,dateRuleVerifiedForReturnedRows:true,classificationVerifiedForReturnedRows:true,businessWrites:0,identitySessionWrites:0,privateContentLogged:false,limitation:'Controlled account has no loans; populated cards and cross-user races verified with isolated fixtures. Assisted real-user probe not executed: automatic approval review rejected scope.'});return;
 }
 if(mode==='browser'){
  const expected=JSON.parse(fs.readFileSync(path.join(out,'release-build.json'),'utf8')),html=await(await fetch(target,{cache:'no-store'})).text(),bundlePath=/src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];assert.equal(bundlePath,'app/bundle.js?v=2026102506');
  const bundle=await(await fetch(new URL(bundlePath,target),{cache:'no-store'})).text();assert.equal(sha(bundle),expected.bundleSha256);
  const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
  try{for(const serviceWorkers of ['block','allow']){
   const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers}),page=await context.newPage(),errors=[];page.on('pageerror',()=>errors.push('PAGE_ERROR'));
   await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
   const loaded=page.waitForResponse(r=>r.url().includes('/functions/v1/loan-history')&&r.request().method()==='POST',{timeout:60000});await page.locator('[data-app-tab=historial]').evaluate(e=>e.click());const r=await loaded;assert.equal(r.status(),200);const data=await r.json();
   await page.waitForFunction(()=>!document.querySelector('[data-history-source]'),null,{timeout:15000});
   for(const name of ['Todas','En proceso','Aprobadas','En pago','Liquidadas','No aprobadas'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),1);
   const entry=data.entries.find(x=>x.key.startsWith('loan:'));if(entry){const card=page.locator('.su-history-entry').filter({has:page.getByText(entry.id,{exact:true})});assert.equal(await card.count(),1);await card.click();await page.locator('[data-loan-history-detail]').waitFor();await page.waitForFunction(()=>document.querySelectorAll('[data-installment]').length>0,null,{timeout:60000});assert.equal(await page.locator('[data-installment]').count(),entry.schedule.length);await page.getByRole('button',{name:'Volver al historial'}).click();checks.push('real own loan amortization opens with exact quota count');}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated'&&typeof window.LoanHistory?.load==='function',null,{timeout:45000});assert.deepEqual(errors,[]);checks.push('six filters, refresh, mobile layout, no page errors; service worker '+serviceWorkers);await context.close();
  }}finally{await browser.close();}
  proof(target.startsWith('http://localhost')?'release-local-browser':'production-live',{status:'PASS',target,bundleSha256:expected.bundleSha256,checks,businessWrites:0,privateContentLogged:false,populatedCards:'isolated browser suite; authorized live account has no loans'});return;
 }
 throw Error('UNKNOWN_MODE');
}
main().catch(e=>{console.error(e.message?.split('\n')[0]||'VERIFY_FAILED');console.error((e.stack||'').split('\n').find(l=>l.includes('at main'))||'');process.exitCode=1;});
