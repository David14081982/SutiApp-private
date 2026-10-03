'use strict';
// Real authenticated UI reads only. No fixtures, screenshots, financial writes or saved settings.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/sicof-release'),privateDir=path.join(root,'.tmp/sicof/activation');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const target=process.env.SUTIAPP_SICOF_UI_URL||'http://localhost:8080/';
const expected=process.env.SUTIAPP_SICOF_UI_SHA256||JSON.parse(fs.readFileSync(path.join(root,'docs/qa/evidence/sicof/frontend-release-package.json'),'utf8')).bundleSha256;
const selfOnly=process.argv.includes('--self-only'),proofName=selfOnly?'ui-live-self.json':'ui-live.json';
const values={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)values[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const money=value=>value==null?'—':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value);
const checks=[],network=[],browserErrors=[],blocked=[],live={},pending=[];
async function waitValue(read,code,timeout=150000){const end=Date.now()+timeout;while(Date.now()<end){const value=await read();if(value)return value;await new Promise(resolve=>setTimeout(resolve,150));}throw Error(code);}
async function stage(name,run){if(selfOnly&&!['candidate identity and actual login','self Savings period balance matches canonical self reader'].includes(name))return;try{const extra=await run();checks.push({name,status:'PASS',...extra});console.log('PASS '+name);}catch(error){fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(path.join(privateDir,'ui-live-last-error.txt'),String(error.stack||error));throw Error('LIVE_UI_'+name.toUpperCase().replace(/[^A-Z0-9]+/g,'_'));}}
async function main(){
 assert(/^https?:\/\//.test(target),'UI_TARGET_REQUIRED');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow'}),page=await context.newPage();
 const capture=await context.newCDPSession(page);await capture.send('Network.enable',{maxTotalBufferSize:128*1024*1024,maxResourceBufferSize:64*1024*1024});
 // Observe the exact unmodified fetch response in browser memory. CDP evicts this
 // large real LOAD body; transfer only counts and fields needed for DOM assertions.
 await page.addInitScript(()=>{
  const original=window.fetch;window.__sicofLiveCapture={};
  window.fetch=async function(input,options){
   const response=await original.apply(this,arguments),url=typeof input==='string'?input:input.url;
   if(String(url).includes('/functions/v1/sicof')){
    let action;try{action=JSON.parse(options?.body||'{}').action;}catch(_){}
    response.clone().json().then(value=>{const d=value.data;if(value.error){window.__sicofLiveCapture[action]={error:'BACKEND_ERROR'};return;}
     window.__sicofLiveCapture[action]=action==='LOAD'?{source:d.source,loanCount:d.loans?.length,paymentCount:d.payments?.length,participantCount:d.participants?.length,reportCount:d.report?.rows?.length}:
      action==='CALCULATE'?{fingerprint:d.fingerprint,pool:d.pool,rate:d.rate,nqual:d.nqual,nexcl:d.nexcl,reviewRows:(d.rows||[]).filter(row=>row.status==='REVIEW_REQUIRED'||row.review_required).length,reasonCounts:(d.rows||[]).reduce((counts,row)=>{for(const reason of String(row.motivo||'').split('; ').filter(Boolean))counts[reason]=(counts[reason]||0)+1;return counts;},{}),alerts:(d.alerts||[]).map(alert=>({code:alert.code,severity:alert.severity}))}:{received:true};
    }).catch(()=>{window.__sicofLiveCapture[action]={error:'RESPONSE_CAPTURE_FAILED'};});
   }
   return response;
  };
 });
 page.setDefaultTimeout(40000);page.on('pageerror',error=>browserErrors.push(error.message));
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());let body={};try{body=request.postDataJSON()||{};}catch(_){}
  const rpc=url.pathname.split('/').pop(),isSicof=url.pathname.endsWith('/functions/v1/sicof');
  const writer=isSicof&&!['LOAD','CALCULATE','BEHAVIOR','EXPORT'].includes(body.action)||
   url.pathname.includes('/rest/v1/rpc/')&&(/savings/.test(rpc)&&!(/^(get_|list_|read_|can_|is_)/.test(rpc))||/^(create_validated_financial|approve_|delete_|save_)/.test(rpc))||
   /\/rest\/v1\/(?:savings_|sicof_)/.test(url.pathname)&&['POST','PATCH','PUT','DELETE'].includes(request.method());
  if(writer){blocked.push(isSicof?'SICOF_WRITER':'FINANCIAL_RPC_WRITER');return route.abort();}
  return route.continue();
 });
 page.on('response',response=>{
  const request=response.request(),url=new URL(response.url());if(!url.pathname.endsWith('/functions/v1/sicof'))return;
  let body={};try{body=request.postDataJSON()||{};}catch(_){}
  network.push({action:body.action,status:response.status()});console.log('READ '+body.action+' HTTP '+response.status());
 });
 let selfCoverage=null;
 try{
  await stage('candidate identity and actual login',async()=>{
   await page.goto(target,{waitUntil:'domcontentloaded'});
   const actual=await page.evaluate(async()=>{const script=document.querySelector('script[src*="app/bundle.js?v="]'),res=await fetch(script.src,{cache:'no-store'}),digest=await crypto.subtle.digest('SHA-256',await res.arrayBuffer());return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');});
   assert(actual===expected,'CANDIDATE_HASH_MISMATCH');
   await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
   await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
   return {bundleSha256:actual,fixtureResponses:0};
  });
  await stage('real Admin SICOF load and server calculation',async()=>{
   await page.locator('[data-app-tab="admin"]').click();await page.locator('[data-admin-desktop-sidebar]').waitFor({timeout:60000});
   const dismiss=page.getByRole('button',{name:'Ahora no',exact:true});if(await dismiss.isVisible())await dismiss.click();
   const financeGroup=page.locator('[data-admin-sidebar-group="finance"]');if(await financeGroup.getAttribute('aria-expanded')==='false')await financeGroup.click();
   await page.locator('[data-admin-sidebar-module="sicof"]').click();console.log('OPEN real SICOF sidebar');
   await page.locator('[data-admin-view="sicof"][data-sicof-phase="ready"]').waitFor({timeout:150000});
   const loaded=await waitValue(()=>page.evaluate(()=>window.__sicofLiveCapture.LOAD),'LOAD_RESPONSE_TIMEOUT'),calculated=await waitValue(()=>page.evaluate(()=>window.__sicofLiveCapture.CALCULATE),'CALCULATE_RESPONSE_TIMEOUT');
   live.LOAD=loaded;live.CALCULATE=calculated;
   assert(loaded.source?.status==='READY','LOAN_SOURCE_NOT_READY');
   assert(Number.isInteger(loaded.participantCount)&&Number.isInteger(loaded.reportCount),'ACTUAL_SAVINGS_REPORT_MISSING');
   assert(typeof calculated.fingerprint==='string','SERVER_CALCULATION_MISSING');
   assert(await page.locator('[data-admin-view="sicof"] input[type=password]').count()===0,'EXTRA_PASSWORD_GATE');
   const actual=await page.locator('.sicof-metric').filter({has:page.getByText('Bolsa a repartir',{exact:true})}).locator('strong').textContent();
   assert(actual===money(calculated.pool),'SERVER_POOL_DISPLAY_MISMATCH');
   return {sourceReady:true,sourceStatus:loaded.source.status,sourceObservedAt:loaded.source.observed_at,loanCount:loaded.loanCount,paymentCount:loaded.paymentCount,participants:loaded.participantCount,reportRows:loaded.reportCount,sourceTimestampPresent:!!loaded.source.observed_at,rateResolved:calculated.rate!=null,nqual:calculated.nqual,nexcl:calculated.nexcl,reviewRows:calculated.reviewRows,reasonCounts:calculated.reasonCounts,alerts:calculated.alerts};
  });
  await stage('all eight real SICOF panes and original controls',async()=>{
   for(const tab of ['Resumen','Liquidez','Reparto por ahorrador','Préstamos y pagos','Atrasos','Reporte préstamos','Cumplimiento','Informe final de ahorro']){
    await page.getByRole('tab',{name:tab,exact:true}).click();assert(await page.getByRole('tabpanel').isVisible(),'PANE_HIDDEN');
   }
   await page.getByLabel('Año del ahorro',{exact:true}).waitFor();await page.getByLabel('Semestre del ahorro',{exact:true}).waitFor();
   assert(await page.getByRole('button',{name:'↓ Descargar informe final de ahorro',exact:true}).isEnabled(),'CURRENT_REPORT_DISABLED');
   assert(await page.getByRole('button',{name:'↓ Descargar Excel histórico original',exact:true}).isEnabled(),'HISTORICAL_REPORT_DISABLED');
   return {panes:8,reportControlsEnabled:true};
  });
  await stage('real savings origin and global balance detail',async()=>{
   assert(live.LOAD.reportCount>0,'NO_REAL_REPORT_ROWS');await page.locator('.sicof-table tbody tr[data-clickable="true"]').first().click();
   await page.getByRole('dialog').waitFor();await page.getByText('Disponible global actual',{exact:true}).waitFor();await page.keyboard.press('Escape');
   return {realReportDetail:true,noOriginClassificationWritten:true};
  });
  await stage('real loan matrix and expected paid detail',async()=>{
   await page.getByRole('tab',{name:'Reporte préstamos',exact:true}).click();assert(live.LOAD.loanCount>0,'NO_REAL_LOANS');
   await page.locator('.sicof-table tbody tr[data-clickable="true"]').first().click();await page.getByRole('dialog').waitFor();
   await page.getByRole('tab',{name:'B · Comparación esperado vs. pagado',exact:true}).click();
   await page.getByText('Esperado vs. pagado por cuota',{exact:true}).waitFor();await page.keyboard.press('Escape');
   return {realHistory:true,expectedComparison:true};
  });
  await stage('Finance behavior indicator from real applicant requests',async()=>{
   await page.locator('[data-admin-sidebar-module="finanzas"]').click();await page.locator('[data-financial-queue="true"]').waitFor({timeout:60000});
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-sicof-behavior]')].some(node=>['CURRENT','ARREARS','NO_HISTORY','REVIEW'].includes(node.dataset.state)),null,{timeout:150000});
   const chip=page.locator('[data-sicof-behavior]').filter({hasNotText:'Consultando'}).filter({hasNotText:'Reintentar'}).first();await chip.click();
   await page.getByRole('dialog',{name:'Comportamiento de pagos',exact:true}).waitFor();await page.keyboard.press('Escape');
   assert(!await page.getByRole('dialog').count(),'BEHAVIOR_OPENED_REQUEST_MODAL');
   return {indicatorReady:true,opensOwnDetail:true,batches:network.filter(row=>row.action==='BEHAVIOR'&&row.status===200).length};
  });
  await stage('self Savings period balance matches canonical self reader',async()=>{
   const affiliateView=await page.evaluate(()=>!!window.AffiliateAuth?.getState().affiliateView);
   if(!affiliateView)return {status:'NOT APPLICABLE',reason:'Existing authorized test account has administrative access only; no account or impersonation created.'};
   const dismiss=page.getByRole('button',{name:'Ahora no',exact:true});if(await dismiss.isVisible())await dismiss.click();
   await page.locator('[data-app-tab="financiera"]').click();
   await page.locator('[data-finance-summary-action="ahorro"]').click();
   await page.locator('[data-savings-screen]').waitFor({timeout:60000});
   await page.waitForFunction(()=>window.savingsStore?.state().selfPhase==='ready',null,{timeout:90000});
   const state=await page.evaluate(()=>{const d=window.savingsStore.state().self;return {participant:!!d?.participant,composition:d?.period_balances,annualCount:(d?.annual||[]).length};});
   if(!state.participant)return {status:'NOT APPLICABLE',reason:'Existing authenticated account has no savings participant; native non-saver screen loaded from real self reader.',selfReaderReady:true};
   assert(state.composition&&Array.isArray(state.composition.periods),'CANONICAL_SELF_PERIODS_MISSING');
   await page.locator('[data-savings-period-balances]').waitFor();
   const moneySelf=value=>value==null?'Por conciliar':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value);
   for(const row of state.composition.periods){
    const text=await page.locator('[data-savings-period-remaining='+JSON.stringify(row.origin_key+':'+row.component)+']').textContent();assert(text===moneySelf(row.remaining),'CANONICAL_PERIOD_AMOUNT_MISMATCH');
   }
   const available=await page.locator('[data-savings-current-available] b').first().textContent();assert(available===moneySelf(state.composition.balances.available),'CANONICAL_AVAILABLE_MISMATCH');
   assert(await page.locator('[data-savings-year]').count()===state.annualCount,'ANNUAL_REFERENCE_STRUCTURE_CHANGED');
   selfCoverage={periodRows:state.composition.periods.length,annualReferences:state.annualCount,canonicalAvailableMatches:true};return selfCoverage;
  });
  await Promise.allSettled(pending);
  assert(blocked.length===0,'READ_ONLY_GUARD_BLOCKED_A_WRITE_ATTEMPT');assert(browserErrors.length===0,'BROWSER_ERRORS');
  const proof={status:'PASS',checkedAt:new Date().toISOString(),target:new URL(target).origin,bundleSha256:expected,checks,network,blockedFinancialWrites:blocked.length,browserErrors:browserErrors.length,fixtures:0,screenshots:0,productionBusinessWrites:0,limitations:['Authenticating may create the existing nonfinancial access-history event. No savings, loan, scenario or preference writer is invoked.','Data remains in browser/process memory; evidence contains only counts and contract results.']};
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,proofName),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }catch(error){
  await Promise.allSettled(pending);
  const proof={status:'FAIL',checkedAt:new Date().toISOString(),stageCode:/^[A-Z0-9_]+$/.test(error.message)?error.message:'LIVE_UI_CHECK_FAILED',target:new URL(target).origin,bundleSha256:expected,checks,network:network.map(row=>({...row,error:row.error?'BACKEND_ERROR':null})),blockedFinancialWrites:blocked.length,browserErrors:browserErrors.length,productionBusinessWrites:0};
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,proofName),JSON.stringify(proof,null,2)+'\n');console.error(JSON.stringify(proof));process.exitCode=1;
 }finally{await browser.close();}
}
main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:'LIVE_UI_SETUP_FAILED'}));process.exitCode=1;});
