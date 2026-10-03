'use strict';
// Authenticated, unmodified UI reads. No fixtures, screenshots, money writes or saved edits.
// Run only after the authorized backend activation. --self-test never logs in or uses the network.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const legacyActions=new Set(['overview','resolveEligibility','resolveAvailableFunds','catalog','quote','resolveSimulation','loanSessionOpen','loanSessionValidate','loanSessionQuote','loanSessionConfirm','programPaymentSessionOpen','programPaymentSessionQuote','programPaymentSessionConfirm','approve','approvalReview','handoff','syncRequest','syncRequestQueue']);
// Published financial-legacy/index.ts:493-497 persists/replaces loan snapshots.
// The app starts this unrelated request in the background; it must remain aborted.
const blockedLoanBootstrap=row=>row.reason==='EDGE_WRITER_OR_UNAUDITED_ACTION'&&row.method==='POST'&&row.endpoint==='financial-legacy'&&row.action==='loanSessionOpen';
function arg(name,fallback){const index=process.argv.indexOf('--'+name);return index<0?fallback:process.argv[index+1];}
function writeReason(method,pathname,body={}){
 if(['GET','HEAD','OPTIONS'].includes(method))return null;
 if(pathname.startsWith('/auth/v1/'))return null; // Existing login/session lifecycle, not a business writer.
 if(pathname.includes('/rest/v1/rpc/'))return /^(get_|list_|read_|can_|is_|has_|search_|preview_)/.test(pathname.split('/').pop())?null:'RPC_WRITER';
 if(pathname.includes('/rest/v1/'))return 'TABLE_WRITER';
 if(pathname.includes('/storage/v1/'))return /\/object\/sign\//.test(pathname)?null:'STORAGE_WRITER';
 if(pathname.includes('/functions/v1/')){
  const name=pathname.split('/').pop();
  if(name==='document-access'||name==='savings-rh-report')return null;
  if(name==='sicof'&&['LOAD','CALCULATE','BEHAVIOR','EXPORT'].includes(body.action))return null;
  return 'EDGE_WRITER_OR_UNAUDITED_ACTION';
 }
 return null;
}
function guardSelfTest(){
 for(const [method,pathname,body,blocked] of [
  ['POST','/rest/v1/rpc/get_admin_savings_workspace_person',{},false],['POST','/rest/v1/rpc/get_admin_savings_account',{},false],
  ['POST','/rest/v1/rpc/admin_set_savings_scheduled_contribution',{},true],['POST','/rest/v1/rpc/admin_confirm_savings_account_receipt',{},true],
  ['POST','/rest/v1/rpc/admin_confirm_savings_receipt',{},true],['POST','/rest/v1/rpc/admin_save_savings_panel',{},true],
  ['PATCH','/rest/v1/savings_transactions',{},true],['POST','/functions/v1/savings-settlement',{action:'SETTLE'},true],
  ['POST','/functions/v1/sicof',{action:'SAVE_SCENARIO'},true],['POST','/functions/v1/sicof',{action:'LOAD'},false],
  ['POST','/auth/v1/token',{},false],['POST','/storage/v1/object/sign/private_assets/test',{},false],['POST','/storage/v1/object/private_assets/test',{},true]
 ])assert.equal(Boolean(writeReason(method,pathname,body)),blocked,'READ_ONLY_GUARD_CONTRACT');
 assert(writeReason('POST','/functions/v1/financial-legacy',{action:'loanSessionOpen'}),'LOAN_BOOTSTRAP_WRITER_MUST_STAY_BLOCKED');
 assert(blockedLoanBootstrap({reason:'EDGE_WRITER_OR_UNAUDITED_ACTION',method:'POST',endpoint:'financial-legacy',action:'loanSessionOpen'}));
 assert(!blockedLoanBootstrap({reason:'EDGE_WRITER_OR_UNAUDITED_ACTION',method:'POST',endpoint:'financial-legacy',action:'loanSessionConfirm'}));
 assert(!blockedLoanBootstrap({reason:'RPC_WRITER',method:'POST',endpoint:'admin_set_savings_scheduled_contribution'}));
 console.log(JSON.stringify({status:'PASS',mode:'STATIC_GUARD_SELF_TEST',cases:17,login:false,network:false}));
}
async function main(){
 const mode=arg('mode',process.env.SAVINGS_AUTO_UI_MODE||'local');assert(['local','production'].includes(mode),'MODE_REQUIRED');
 const target=arg('url',process.env.SAVINGS_AUTO_UI_URL||(mode==='local'?'http://localhost:8080/':'https://david14081982.github.io/SutiApp-private/'));
 const expected=arg('sha',process.env.SAVINGS_AUTO_UI_SHA256);assert(/^[a-f0-9]{64}$/i.test(expected||''),'EXPECTED_BUNDLE_SHA256_REQUIRED');assert(/^https?:\/\//.test(target),'HTTP_TARGET_REQUIRED');
 const output=path.resolve(arg('output',process.env.SAVINGS_AUTO_UI_OUTPUT||path.join(root,'docs/qa/evidence/savings-automatic-contributions','ui-live-'+mode+'.json')));
 const baseline=JSON.parse(fs.readFileSync(path.resolve(arg('baseline',process.env.SAVINGS_AUTO_UI_BASELINE||path.join(root,'.tmp/savings-auto-contributions/preflight-private.json'))),'utf8'));
 const selected=baseline.target?.filter(row=>row.person?.folio==='4944');assert.equal(selected?.length,1,'EXACT_BASELINE_PERSON_REQUIRED');const before=selected[0].person;
 assert(Number.isFinite(before.balance?.total)&&Number.isFinite(before.balance?.capital)&&Number.isFinite(before.balance?.yield_amount),'BASELINE_BALANCE_REQUIRED');
 const personId=before.participant_id||before.id,delta=300;assert(personId,'BASELINE_PARTICIPANT_REQUIRED');
 const {env}=require('./release-sicof-backend.js');assert(env.H005_TEST_EMAIL&&env.H005_TEST_PASSWORD,'AUTHORIZED_LOGIN_CONFIGURATION_REQUIRED');
 const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 // Blocking service workers makes the route guard authoritative for every request.
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();
 const checks=[],network=[],blocked=[],errors=[];let stage='SETUP';
 page.setDefaultTimeout(45000);page.on('pageerror',()=>errors.push('BROWSER_RUNTIME_ERROR'));
 await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());let body={};try{body=request.postDataJSON()||{};}catch(_){}const reason=writeReason(request.method(),url.pathname,body);if(reason){const candidate=url.pathname.split('/').pop(),endpoint=/\/(?:rpc|functions\/v1)\//.test(url.pathname)&&/^[a-z][a-z0-9_-]{0,79}$/.test(candidate)?candidate:reason,action=legacyActions.has(body.action)||typeof body.action==='string'&&/^[A-Z][A-Z0-9_]{0,49}$/.test(body.action)?body.action:undefined;blocked.push({reason,method:request.method(),endpoint,...(action?{action}:{})});return route.abort();}return route.continue();});
 const observed=new Set(['get_admin_savings_workspace_people','get_admin_savings_workspace_person','get_admin_savings_account','get_admin_savings_financial_account','get_self_savings_if_changed','get_self_savings_live_readonly']);
 page.on('response',response=>{const endpoint=new URL(response.url()).pathname.split('/').pop();if(observed.has(endpoint))network.push({endpoint,status:response.status()});});
 await page.addInitScript(()=>{
  const original=window.fetch;window.__savingsAutoRead={};
  window.fetch=async function(input,options){const response=await original.apply(this,arguments);let url;try{url=new URL(typeof input==='string'?input:input.url,location.href);}catch(_){return response;}
   const endpoint=url.pathname.split('/').pop();
   if(['get_admin_savings_workspace_people','get_admin_savings_workspace_person','get_admin_savings_account','get_admin_savings_financial_account'].includes(endpoint)){
    response.clone().json().then(data=>{window.__savingsAutoRead[endpoint]={ok:response.ok,data};}).catch(()=>{window.__savingsAutoRead[endpoint]={ok:false};});
   }
   return response;
  };
 });
 async function step(name,run){stage=name;const proof=await run();checks.push({name,status:'PASS',...proof});console.log('PASS '+name);}
 const writeProof=(status,extra={})=>{const expectedBlocked=blocked.filter(blockedLoanBootstrap),proof={status,scope:'SAVINGS_AUTOMATIC_CONTRIBUTIONS_READ_ONLY_UI',checkedAt:new Date().toISOString(),mode,target:new URL(target).origin,bundleSha256:expected.toLowerCase(),checks,network,blockedBusinessWrites:blocked.length,blockedRequests:blocked,unexpectedBlockedWrites:blocked.length-expectedBlocked.length,backgroundLoanBootstrap:{status:expectedBlocked.length?'BLOCKED':'NOT APPLICABLE',attempts:expectedBlocked.length,reason:'Unrelated loanSessionOpen persists/replaces loan snapshots and is intentionally aborted. No writer exemption was granted.'},browserErrors:errors.length,fixtureResponses:0,screenshots:0,productionBusinessWrites:0,serviceWorker:'BLOCKED_FOR_WRITE_GUARD',limitations:['Authentication may create the existing nonfinancial access-history event.','No amounts, folios, names, IDs, request bodies or response payloads are saved in this evidence.','Blocked diagnostics include technical endpoint/action names only, never URLs or payloads.','The background loan-session workflow is not certified by this focal Savings test; its snapshot writer stays blocked.','This verifies the web surface; the backend ledger and cron are verified separately.'],...extra};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));};
 try{
  await step('BUNDLE_AND_LOGIN',async()=>{
   stage='BUNDLE_NAVIGATION';
   await page.goto(target,{waitUntil:'domcontentloaded'});
   stage='BUNDLE_IDENTITY';const actual=await page.evaluate(async()=>{const script=document.querySelector('script[src*="app/bundle.js?v="]');if(!script)return null;const res=await fetch(script.src,{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!res.ok)return null;const hash=await crypto.subtle.digest('SHA-256',await res.arrayBuffer());return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');});
   assert.equal(actual,expected.toLowerCase(),'BUNDLE_HASH_MISMATCH');stage='LOGIN_FORM';await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();stage='LOGIN_AUTH_CONTEXT';
   await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:90000});return {bundleMatches:true,realAuthenticatedSession:true};
  });
  await step('ADMIN_SAVINGS_PERSON_AND_LEDGER_BALANCE',async()=>{
   await page.locator('[data-app-tab="admin"]').click();await page.locator('[data-admin-desktop-sidebar]').waitFor();const dismiss=page.getByRole('button',{name:'Ahora no',exact:true});if(await dismiss.isVisible())await dismiss.click();
   const group=page.locator('[data-admin-sidebar-group="savings"]');if(await group.getAttribute('aria-expanded')==='false')await group.click();await page.locator('[data-admin-sidebar-module="savings"]').click();
   await page.getByRole('tab',{name:'Personas',exact:true}).click();await page.getByRole('textbox',{name:'Buscar por nombre o folio',exact:true}).fill('4944');
   await page.waitForFunction(id=>{const r=window.__savingsAutoRead.get_admin_savings_workspace_people;return r?.ok&&r.data.rows?.some(row=>(row.participant_id||row.id)===id);},personId);
   await page.locator('[data-savings-person-id='+JSON.stringify(personId)+']').click();await page.locator('.svp-inline-detail .svp-hero').waitFor();
   await page.waitForFunction(id=>{const r=window.__savingsAutoRead.get_admin_savings_workspace_person;return r?.ok&&(r.data.person?.participant_id||r.data.person?.id)===id;},personId);
   const match=await page.evaluate(({id,old,delta})=>{
    const d=window.__savingsAutoRead.get_admin_savings_workspace_person.data,c=n=>Math.round(Number(n)*100),money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n),detail=document.querySelector('.svp-inline-detail'),lastLabel=[...detail.querySelectorAll('span')].find(el=>el.textContent==='Última aportación aplicada');
    const auto=d.history?.filter(row=>row.date==='2026-09-30'&&row.entry_source==='SYSTEM_SCHEDULE'&&row.status==='RECEIVED');
    return {identity:(d.person.participant_id||d.person.id)===id,lastReceived:d.last_received==='2026-09-30',capital:c(d.balance.capital)===c(old.capital)+c(delta),yieldUnchanged:c(d.balance.yield_amount)===c(old.yield_amount),total:c(d.balance.total)===c(old.total)+c(delta),balanceDom:detail?.querySelector('.svp-hero>strong')?.textContent===money(d.balance.total),lastDom:lastLabel?.parentElement.lastElementChild.textContent===window.SavingsPanelVisual.fmt('2026-09-30'),automaticReceipt:auto?.length===1&&c(auto[0].amount)===c(delta),noPending:d.pending?.count===0,automaticLabel:detail?.textContent.includes('Aplicación automática')};
   },{id:personId,old:before.balance,delta});
   assert(Object.values(match).every(Boolean),'PERSON_AUTOMATIC_CONTRIBUTION_OR_BALANCE_MISMATCH');return {exactIdentityMatched:true,lastContributionMatchesAuthorizedDueDate:true,capitalAndTotalIncreaseMatchPreflight:true,yieldUnchanged:true,domMatchesCanonicalReader:true,automaticReceiptVisible:true,noPendingDates:true};
  });
  await step('FUTURE_EDITOR_READ_ONLY',async()=>{
   await page.locator('.svp-inline-detail').getByText('Aportaciones, correcciones y proyección',{exact:true}).click();await page.locator('[data-savings-certification]').waitFor();
   await page.waitForFunction(()=>{const r=window.__savingsAutoRead.get_admin_savings_financial_account||window.__savingsAutoRead.get_admin_savings_account;return r?.ok&&Array.isArray(r.data.schedule);});
   const selected=await page.evaluate(()=>{const d=(window.__savingsAutoRead.get_admin_savings_financial_account||window.__savingsAutoRead.get_admin_savings_account).data;const row=d.schedule.find(r=>r.future===true&&r.can_edit_scheduled===true);return row?{date:row.date,amount:row.scheduled_amount,version:row.scheduled_version}:null;});assert(selected,'EDITABLE_FUTURE_DATE_REQUIRED');
   // The requested date may be beyond the initial six visible calendar rows.
   for(let n=0;n<100&&await page.locator('[data-contribution-date='+JSON.stringify(selected.date)+']').count()===0;n++){const more=page.getByRole('button',{name:'Ver más fechas',exact:true});assert(await more.isVisible(),'FUTURE_DATE_NOT_DISPLAYED');await more.click();}
   const row=page.locator('[data-contribution-date='+JSON.stringify(selected.date)+']');assert(await row.getByText('Aún no vence',{exact:true}).isVisible(),'FUTURE_ALREADY_APPLIED');await row.getByRole('button',{name:'Modificar importe programado',exact:true}).click();
   const input=page.getByLabel('Importe programado para esta fecha',{exact:true});assert.equal(await input.inputValue(),selected.amount==null?'':String(selected.amount),'FUTURE_EDITOR_AMOUNT_MISMATCH');assert(Number.isInteger(selected.version),'FUTURE_VERSION_MISSING');
   assert(await page.getByRole('button',{name:'Guardar importe programado',exact:true}).isVisible(),'FUTURE_SAVE_SURFACE_MISSING');await page.getByRole('button',{name:'Cancelar captura',exact:true}).click();assert.equal(await input.count(),0,'FUTURE_EDITOR_NOT_CLOSED');return {editorOpenedAndCanceled:true,amountMatchesReader:true,versionPresent:true,saved:false};
  });
  await step('PRESERVED_RH_AND_RESPONSIVE_LAYOUT',async()=>{
   for(const width of [430,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'PAGE_HORIZONTAL_OVERFLOW');assert(await page.locator('.svp').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'SAVINGS_HORIZONTAL_OVERFLOW');}
   await page.getByRole('tab',{name:'Reporte RH',exact:true}).click();await page.getByRole('form',{name:'Reporte RH',exact:true}).waitFor();assert(await page.getByRole('button',{name:'Generar reporte',exact:true}).isEnabled(),'RH_EXPORT_SURFACE_MISSING');return {rhTabAndControlsPreserved:true,viewports:[430,1440],horizontalOverflow:false,noExportInvoked:true};
  });
  if(process.argv.includes('--self'))await step('CURRENT_USERS_SELF_READER',async()=>{
   const access=await page.evaluate(()=>!!window.AffiliateAuth?.getState().affiliateView);if(!access)return {status:'NOT APPLICABLE',reason:'Authenticated account has no affiliate surface; no impersonation or new account.'};
   const appView=page.locator('[data-admin-view-app]').first();if(await appView.isVisible())await appView.click();await page.locator('[data-app-tab="financiera"]').click();await page.locator('[data-finance-summary-action="ahorro"]').click();await page.waitForFunction(()=>window.savingsStore?.state().selfPhase==='ready',null,{timeout:90000});
   const own=await page.evaluate(()=>{const state=window.savingsStore.state(),d=state.self;if(!d.participant)return {hasParticipant:false,emptyVisible:!!document.querySelector('[data-savings-empty]')};const el=document.querySelector('[data-savings-total]');return {hasParticipant:true,balanceMatches:el?.dataset.savingsTotal===String(d.balances.total),periodRows:d.period_balances?.periods?.length||0};});
   if(!own.hasParticipant){assert(own.emptyVisible,'SELF_EMPTY_SURFACE_MISMATCH');return {status:'NOT APPLICABLE',reason:'Real authenticated account has no Savings account; native empty state verified.',selfReaderReady:true};}
   assert(own.balanceMatches,'SELF_BALANCE_MISMATCH');return {ownAccountOnly:true,balanceMatchesReader:true,periodRows:own.periodRows,nonemptyPeriodsVerified:false};
  });
  assert.equal(blocked.filter(row=>!blockedLoanBootstrap(row)).length,0,'UNEXPECTED_BUSINESS_WRITE_ATTEMPT_BLOCKED');assert.equal(errors.length,0,'BROWSER_RUNTIME_ERROR');assert(network.every(row=>row.status===200),'SAVINGS_READ_HTTP_ERROR');writeProof('PASS');
 }catch(error){const diagnostics=await page.evaluate(()=>({authPhase:window.AffiliateAuth?.getState().phase||null,emailInputs:document.querySelectorAll('input[type=email]').length,passwordInputs:document.querySelectorAll('input[type=password]').length,submitButtons:document.querySelectorAll('button[type=submit]').length,adminShell:!!document.querySelector('[data-admin-desktop-sidebar]'),documentReady:document.readyState})).catch(()=>({pageUnavailable:true}));writeProof('FAIL',{stageCode:stage,errorCode:/^[A-Z0-9_]+$/.test(error.message)?error.message:error.name==='TimeoutError'?'UI_TIMEOUT':'UI_ASSERTION_OR_NAVIGATION_FAILED',diagnostics});process.exitCode=1;}finally{await browser.close();}
}
if(require.main===module){if(process.argv.includes('--self-test'))guardSelfTest();else main().catch(()=>{console.error(JSON.stringify({status:'FAIL',errorCode:'LIVE_UI_SETUP_FAILED'}));process.exitCode=1;});}
module.exports={writeReason};
