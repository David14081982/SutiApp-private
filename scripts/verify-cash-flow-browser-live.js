'use strict';
// Real authenticated focal reads. No financial edits, fixtures, tokens, amounts or personal records in evidence.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {environment}=require('./investors-db');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/cash-flow'),out=path.join(root,'docs/qa/evidence/cash-flow');
const requireCheck=(value,code)=>{if(!value)throw Error(code);};
function isFinancialWriter(request){
 const u=new URL(request.url());if(!u.hostname.endsWith('.supabase.co'))return false;
 const method=request.method(),rpc=u.pathname.split('/').pop();let body={};try{body=request.postDataJSON()||{};}catch(_){}
 if(u.pathname.endsWith('/functions/v1/reports-jc'))return method==='POST'&&!['LOAD','CASH_FLOW','TEMPLATE'].includes(body.action);
 if(/\/rest\/v1\//.test(u.pathname)&&['PATCH','PUT','DELETE'].includes(method))return true;
 if(/\/rest\/v1\//.test(u.pathname)&&!u.pathname.includes('/rpc/')&&method==='POST')return true;
 if(u.pathname.includes('/rest/v1/rpc/')&&method==='POST')return /^(save_|create_|approve_|reject_|delete_|remove_|apply_|update_|post_|insert_|record_.*(?:payment|withdrawal|contribution))/.test(rpc)||(/(?:savings|loan|investor|financial|program_request)/.test(rpc)&&!/^(get_|list_|read_|can_|is_|has_|resolve_)/.test(rpc));
 if(method==='POST'&&u.pathname.includes('/functions/v1/')&&/(?:savings|loan|investor|financial)/.test(rpc))return !!body.action&&!/^(LOAD|READ|GET|LIST|SUMMARY|DETAIL|QUERY|CALCULATE|BEHAVIOR|load|read|get|list|summary|detail|query|calculate|behavior)$/.test(body.action);
 return false;
}
async function main(){
 const mode=process.argv[2]||'candidate';requireCheck(['candidate','production'].includes(mode),'INVALID_MODE');
 const values=environment();requireCheck(values.H005_TEST_EMAIL&&values.H005_TEST_PASSWORD,'CONTROLLED_LOGIN_REQUIRED');
 const manifest=JSON.parse(fs.readFileSync(path.join(privateDir,'release-manifest.json'),'utf8'));requireCheck(manifest.status==='PASS'&&manifest.buildPages==='PASS','CANDIDATE_NOT_READY');const expectedHash=process.env.SUTIAPP_CASH_FLOW_EXPECTED_BUNDLE_SHA256||manifest.bundleSha256;requireCheck(/^[a-f0-9]{64}$/.test(expectedHash),'EXPECTED_HASH_INVALID');
 let browser,page,stage='PREPARE';const calls=[],pageErrors=[],blocked=[];let url=process.argv[3]||'https://sutiapp.com/';const staticOverlay=new Map();
 try{
  if(mode==='candidate'){
   // The app's already-authorized origin serves only this generated static candidate.
   // Every Supabase response remains real; no CORS settings, remote files or business data change.
   url='https://sutiapp.com/';const siteRoot=path.resolve(manifest.site);
   const collect=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);requireCheck(!entry.isSymbolicLink(),'CANDIDATE_SYMLINK');if(entry.isDirectory())collect(file);else staticOverlay.set('/'+path.relative(siteRoot,file).replace(/\\/g,'/'),file);}};collect(siteRoot);staticOverlay.set('/',staticOverlay.get('/index.html'));
  }
  requireCheck(/^https?:\/\//.test(url),'INVALID_TARGET');
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:mode==='candidate'?'block':'allow'});page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',()=>pageErrors.push('PAGE_ERROR'));
  await page.route('**/*',route=>{const request=route.request(),requestUrl=new URL(request.url());if(isFinancialWriter(request)){const endpoint=requestUrl.pathname.split('/').pop();let action;try{const value=request.postDataJSON()?.action;if(typeof value==='string'&&/^[A-Za-z_]+$/.test(value))action=value;}catch(_){}blocked.push({endpoint:/^[a-z_-]+$/i.test(endpoint)?endpoint:'RESOURCE_WRITE',action});return route.abort();}const file=requestUrl.origin==='https://sutiapp.com'&&staticOverlay.get(requestUrl.pathname);if(file&&request.method()==='GET'){const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};return route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}return route.continue();});
  page.on('response',response=>{const request=response.request();if(!new URL(response.url()).pathname.endsWith('/functions/v1/reports-jc')||request.method()!=='POST')return;let body={};try{body=request.postDataJSON()||{};}catch(_){}calls.push({action:['LOAD','CASH_FLOW','TEMPLATE'].includes(body.action)?body.action:'OTHER',status:response.status()});});
  stage='CANDIDATE_IDENTITY';await page.goto(url.split('#')[0]+'#/admin/menu',{waitUntil:'domcontentloaded'});
  const loadedHash=await page.evaluate(async()=>{const script=document.querySelector('script[src*="app/bundle.js?v="]');if(!script)return null;const response=await fetch(script.src,{cache:'no-store'});if(!response.ok)return null;const hash=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');});
  requireCheck(loadedHash===expectedHash,'BUNDLE_HASH_MISMATCH');
  stage='AUTHENTICATION';await page.locator('input[type=email]').waitFor();await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
  const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.isVisible().catch(()=>false))await later.click();
  stage='ADMIN_AUTHORITY';console.log('CHECK ADMIN_AUTHORITY');
  await page.waitForFunction(()=>window.AdminRepository?.getState().phase==='authorized',null,{timeout:60000});
  stage='ADMIN_REPORTS_NAVIGATION';console.log('CHECK ADMIN_REPORTS_NAVIGATION');const reportsGroup=page.locator('[data-admin-sidebar-group="reportes_jc"]');await reportsGroup.waitFor();if(await reportsGroup.getAttribute('aria-expanded')==='false')await reportsGroup.click();await page.locator('[data-admin-sidebar-module="reportes_jc"]').click();
  stage='ORIGINAL_REPORTS_LOAD';console.log('CHECK ORIGINAL_REPORTS_LOAD');
  await page.waitForFunction(()=>document.querySelector('[data-reports-jc] [role=tab]')||document.querySelector('[data-reports-jc] [role=alert]'),null,{timeout:150000});requireCheck(await page.locator('[data-reports-jc] [role=tab]').count()===8,'ORIGINAL_REPORTS_MISSING');
  stage='CASH_FLOW_QUERY';const responsePromise=page.waitForResponse(response=>{if(!new URL(response.url()).pathname.endsWith('/functions/v1/reports-jc')||response.request().method()!=='POST')return false;try{return response.request().postDataJSON()?.action==='CASH_FLOW';}catch(_){return false;}},{timeout:150000});
  await page.getByRole('button',{name:'Reporte Flujo de efectivo',exact:true}).click();const response=await responsePromise;requireCheck(response.status()===200,'CASH_FLOW_HTTP_FAILED');
  const envelope=await response.json(),report=envelope?.data;requireCheck(report&&!envelope.error,'CASH_FLOW_BACKEND_FAILED');requireCheck(report.months?.length===12&&report.rows?.length===17,'LIVE_REPORT_SHAPE_MISMATCH');
  stage='LIVE_MATRIX';const table=page.getByRole('table',{name:'Flujo de efectivo de Ahorro y Caja de Ahorro'});await table.waitFor({timeout:150000});
  requireCheck(await table.locator('thead th').count()===13,'MONTH_HEADERS_MISSING');requireCheck(await table.locator('[data-cash-flow-row]').count()===17,'FINANCIAL_CONCEPTS_MISSING');requireCheck(await page.locator('.cfr [role=alert]').count()===0,'MODULE_ERROR_VISIBLE');
  const expected=report.rows.map(row=>({id:row.id,label:row.label,cells:row.cells.map(cell=>({status:cell.status,text:cell.status==='NOT_APPLICABLE'?'No aplica':cell.status==='PARTIAL'?(typeof cell.knownAmount==='number'?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(cell.knownAmount):'Por determinar'):(typeof cell.amount==='number'?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(cell.amount):'Por determinar')}))}));
  const matrixMatches=await table.evaluate((table,rows)=>rows.every(row=>{const tr=[...table.querySelectorAll('[data-cash-flow-row]')].find(tr=>tr.dataset.cashFlowRow===row.id);return tr&&tr.querySelector('th')?.textContent===row.label&&row.cells.every((cell,index)=>{const button=tr.querySelectorAll('td button')[index];return button?.dataset.status===cell.status&&button.querySelector('strong')?.textContent===cell.text;});}),expected);requireCheck(matrixMatches,'LIVE_MATRIX_SOURCE_MISMATCH');
  const states={};for(const row of report.rows)for(const cell of row.cells)states[cell.status]=(states[cell.status]||0)+1;
  const originRow=report.rows.find(row=>row.cells.some(cell=>cell.sourceIds?.length));let originRead=false;
  if(originRow){stage='SOURCE_DETAIL';const index=originRow.cells.findIndex(cell=>cell.sourceIds?.length);await table.locator('[data-cash-flow-row]').filter({has:page.getByRole('rowheader',{name:originRow.label,exact:true})}).locator('td button').nth(index).click();await page.getByRole('dialog').waitFor();requireCheck(await page.getByRole('dialog').getByRole('table',{name:'Registros de origen'}).count()===1,'SOURCE_DETAIL_MISSING');await page.keyboard.press('Escape');originRead=true;}
  stage='RESPONSIVE';await page.setViewportSize({width:390,height:844});
  // The existing Admin shell remounts a module when switching desktop/mobile.
  // Re-enter its own report from the preserved Reports JC screen if that occurs.
  await page.waitForFunction(()=>document.querySelector('[data-cash-flow-report]')||document.querySelector('[data-reports-jc]'),null,{timeout:45000});
  if(await page.locator('[data-cash-flow-report]').count()===0){await page.getByRole('button',{name:'Reporte Flujo de efectivo',exact:true}).click();await table.waitFor({timeout:150000});}
  requireCheck(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'MOBILE_OVERFLOW');requireCheck(await table.locator('thead th').count()===13,'MOBILE_MONTH_HEADERS_MISSING');
  requireCheck(blocked.length===0,'UNEXPECTED_BUSINESS_WRITE_ATTEMPT');requireCheck(pageErrors.length===0,'BROWSER_SCRIPT_ERROR');
  const result={status:'PASS',mode,checkedAt:new Date().toISOString(),bundleSha256:loadedHash,candidateStaticOverlay:mode==='candidate',financialApiMocks:0,originalReports:8,months:12,concepts:17,realAuthenticatedQuery:true,uiMatchesActualSource:true,sourceDetail:originRead,stateCounts:states,issueCount:(report.issues||[]).length,unassignedCount:(report.unassigned||[]).length,reportRequests:calls,mobileNoPageOverflow:true,financialWrites:0,blockedWriteAttempts:0,pageErrors:0,persistedTokens:0,persistedPersonalRecords:0,screenshots:0};
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-live-'+mode+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }catch(error){let ui;try{ui=await page?.evaluate(()=>({authPhase:window.AffiliateAuth?.getState().phase,adminPhase:window.AdminRepository?.getState().phase,sidebarGroups:[...document.querySelectorAll('[data-admin-sidebar-group]')].map(e=>e.dataset.adminSidebarGroup),reportsVisible:!!document.querySelector('[data-reports-jc]'),cashFlowVisible:!!document.querySelector('[data-cash-flow-report]')}));}catch(_){}const result={status:'FAIL',mode,stage,errorCode:/^[A-Z0-9_]+$/.test(error.message||'')?error.message:'STAGE_FAILED',ui,reportRequests:calls,blockedWriteAttempts:blocked.length,blockedEndpoints:blocked,pageErrors:pageErrors.length,financialWrites:0,persistedTokens:0,persistedPersonalRecords:0};fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-live-'+mode+'.json'),JSON.stringify(result,null,2)+'\n');console.error(JSON.stringify(result));process.exitCode=1;
 }finally{if(browser)await browser.close();}
}
if(require.main===module)main().catch(()=>{console.error('CASH_FLOW_LIVE_PREPARATION_FAILED');process.exitCode=1;});
module.exports={isFinancialWriter};
