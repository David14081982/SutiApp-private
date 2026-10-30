'use strict';
// Real authenticated focal reads. No financial edits, fixtures, tokens, amounts or personal records in evidence.
const fs=require('fs'),path=require('path');
const Zip=require('../app/vendor/jszip-3.10.1/jszip.min.js');
const {environment}=require('./investors-db');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/cash-flow-consolidated'),out=path.join(root,'docs/qa/evidence/cash-flow-consolidated');
const requireCheck=(value,code)=>{if(!value)throw Error(code);};
const originalIds=['contribution','contribution_mixed','withdrawal_partial','withdrawal_total','withdrawal_unspecified','yield_credited','adjustment','savings_balance','contribution_scheduled','withdrawal_pending','loan_placed','loan_recovered','loan_principal','loan_interest','loan_admin','loan_pending','loan_scheduled'];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
function format(value,unit){if(!finite(value))return 'Sin determinar';const abs=Math.abs(value),text=unit==='count'?new Intl.NumberFormat('es-MX',{maximumFractionDigits:0}).format(abs):unit==='percent'?new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(abs)+'%':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(abs);return value<0?'('+text+')':text;}
function cellText(cell,row){if(cell.status==='NOT_APPLICABLE')return 'No aplica';if(cell.status==='UNAVAILABLE')return 'Sin determinar';return format(cell.status==='PARTIAL'?cell.knownAmount:cell.amount,row.unit);}
function resolveRecord(record,byId){return record.parentRecordId?{...byId.get(record.parentRecordId),...record}:record;}
function parseCells(xml){const cells=new Map();for(const m of xml.matchAll(/<c\b([^>]*?\br="([A-Z]+\d+)"[^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const value=/<v>([^<]+)<\/v>/.exec(m[3]||'');cells.set(m[2],value?Number(value[1]):null);}return cells;}
const col=index=>{let result='';for(let n=index+1;n;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;};
async function checkExport(bytes,report){
 const zip=await Zip.loadAsync(bytes),book=await zip.file('xl/workbook.xml').async('string'),main=await zip.file('xl/worksheets/sheet1.xml').async('string'),detail=await zip.file('xl/worksheets/sheet2.xml').async('string'),notes=await zip.file('xl/worksheets/sheet3.xml').async('string');
 requireCheck(['Flujo mensual','Detalle','Notas'].every(label=>book.includes(label)),'XLSX_SHEETS_MISSING');requireCheck(main.includes('xSplit="1" ySplit="5"'),'XLSX_FREEZE_MISSING');requireCheck(![main,detail,notes].some(xml=>/<f[\s>]/.test(xml)),'XLSX_UNEXPECTED_FORMULA');
 const cells=parseCells(main),components=parseCells(detail);let r=5,checked=0,unknown=0,negative=0;
 for(const group of [...new Set(report.rows.map(row=>row.group))]){r++;let section=null;for(const row of report.rows.filter(item=>item.group===group)){if(row.section&&row.section!==section){r++;section=row.section;}r++;for(const [i,c]of row.cells.entries()){const known=!['PARTIAL','UNAVAILABLE','NOT_APPLICABLE'].includes(c.status)&&finite(c.amount),expected=known?(row.unit==='percent'?c.amount/100:c.amount):null,key=col(i+1)+r;requireCheck(cells.has(key)&&cells.get(key)===expected,'XLSX_SOURCE_AMOUNT_MISMATCH');checked++;if(!known)unknown++;if(expected<0)negative++;}}}
 const byId=new Map((report.records||[]).map(r=>[r.id,r]));
 for(const [i,raw]of (report.records||[]).entries()){const record=resolveRecord(raw,byId);for(const [column,key]of [['J','amount'],['K','registeredAmount'],['L','principal'],['M','interest'],['N','administration']])requireCheck(components.get(column+(i+2))===(finite(record[key])?record[key]:null),'XLSX_DETAIL_COMPONENT_MISMATCH');for(const [column,key]of [['O','principal'],['P','interest'],['Q','administration']])requireCheck(components.get(column+(i+2))===(finite(record.percentages?.[key])?record.percentages[key]/100:null),'XLSX_DETAIL_PERCENTAGE_MISMATCH');}
 return {download:true,sourceAmountsMatched:checked,unknownBlankCells:unknown,negativeNumericCells:negative,detailRows:(report.records||[]).length,componentsMatch:true,percentagesMatch:true,notesRetained:true};
}
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
 let browser,page,privateExport,stage='PREPARE';const calls=[],pageErrors=[],blocked=[],authenticationRequests=[];let url=process.argv[3]||'https://sutiapp.com/';const staticOverlay=new Map();
 try{
  if(mode==='candidate'){
   // The app's already-authorized origin serves only this generated static candidate.
   // Every Supabase response remains real; no CORS settings, remote files or business data change.
   url='https://sutiapp.com/';const siteRoot=path.resolve(manifest.site);
   const collect=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);requireCheck(!entry.isSymbolicLink(),'CANDIDATE_SYMLINK');if(entry.isDirectory())collect(file);else staticOverlay.set('/'+path.relative(siteRoot,file).replace(/\\/g,'/'),file);}};collect(siteRoot);staticOverlay.set('/',staticOverlay.get('/index.html'));
  }
  requireCheck(/^https?:\/\//.test(url),'INVALID_TARGET');
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:mode==='candidate'?'block':'allow',acceptDownloads:true});page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',()=>pageErrors.push('PAGE_ERROR'));
  page.on('response',response=>{if(new URL(response.url()).pathname.endsWith('/auth/v1/token'))authenticationRequests.push({status:response.status()});});
  await page.route('**/*',route=>{const request=route.request(),requestUrl=new URL(request.url());if(isFinancialWriter(request)){const endpoint=requestUrl.pathname.split('/').pop();let action;try{const value=request.postDataJSON()?.action;if(typeof value==='string'&&/^[A-Za-z_]+$/.test(value))action=value;}catch(_){}blocked.push({endpoint:/^[a-z_-]+$/i.test(endpoint)?endpoint:'RESOURCE_WRITE',action});return route.abort();}const file=requestUrl.origin==='https://sutiapp.com'&&staticOverlay.get(requestUrl.pathname);if(file&&request.method()==='GET'){const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};return route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}return route.continue();});
  page.on('response',response=>{const request=response.request();if(!new URL(response.url()).pathname.endsWith('/functions/v1/reports-jc')||request.method()!=='POST')return;let body={};try{body=request.postDataJSON()||{};}catch(_){}calls.push({action:['LOAD','CASH_FLOW','TEMPLATE'].includes(body.action)?body.action:'OTHER',status:response.status()});});
  stage='CANDIDATE_IDENTITY';await page.goto(url.split('#')[0]+'#/admin/menu',{waitUntil:'domcontentloaded'});
  const loadedHash=await page.evaluate(async()=>{const script=document.querySelector('script[src*="app/bundle.js?v="]');if(!script)return null;const response=await fetch(script.src,{cache:'no-store'});if(!response.ok)return null;const hash=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');});
  requireCheck(loadedHash===expectedHash,'BUNDLE_HASH_MISMATCH');
  stage='LOGIN_EMAIL';await page.locator('input[type=email]').waitFor();await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);stage='LOGIN_SUBMIT';await page.locator('button[type=submit]').click();
  stage='LOGIN_SESSION';
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated'||window.AffiliateAuth?.getState().errorCode,null,{timeout:60000});
  const authCode=await page.evaluate(()=>window.AffiliateAuth?.getState().errorCode);requireCheck(!authCode,'LOGIN_'+String(authCode||'FAILED').replace(/[^A-Z0-9_]/g,''));
  const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.isVisible().catch(()=>false))await later.click();
  stage='ADMIN_AUTHORITY';console.log('CHECK ADMIN_AUTHORITY');
  await page.waitForFunction(()=>window.AdminRepository?.getState().phase==='authorized',null,{timeout:60000});
  stage='ADMIN_REPORTS_NAVIGATION';console.log('CHECK ADMIN_REPORTS_NAVIGATION');const reportsGroup=page.locator('[data-admin-sidebar-group="reportes_jc"]');await reportsGroup.waitFor();if(await reportsGroup.getAttribute('aria-expanded')==='false')await reportsGroup.click();await page.locator('[data-admin-sidebar-module="reportes_jc"]').click();
  stage='ORIGINAL_REPORTS_LOAD';console.log('CHECK ORIGINAL_REPORTS_LOAD');
  await page.waitForFunction(()=>document.querySelector('[data-reports-jc] [role=tab]')||document.querySelector('[data-reports-jc] [role=alert]'),null,{timeout:150000});requireCheck(await page.locator('[data-reports-jc] [role=tab]').count()===8,'ORIGINAL_REPORTS_MISSING');
  stage='CASH_FLOW_QUERY';const responsePromise=page.waitForResponse(response=>{if(!new URL(response.url()).pathname.endsWith('/functions/v1/reports-jc')||response.request().method()!=='POST')return false;try{return response.request().postDataJSON()?.action==='CASH_FLOW';}catch(_){return false;}},{timeout:150000});
  await page.getByRole('button',{name:'Reporte Flujo de efectivo',exact:true}).click();const response=await responsePromise;requireCheck(response.status()===200,'CASH_FLOW_HTTP_FAILED');
  const envelope=await response.json(),report=envelope?.data;requireCheck(report&&!envelope.error,'CASH_FLOW_BACKEND_FAILED');requireCheck(report.months?.length===12&&report.rows?.length>17,'LIVE_REPORT_SHAPE_MISMATCH');
  requireCheck(originalIds.every(id=>report.rows.some(row=>row.id===id)),'ORIGINAL_17_CONCEPTS_MISSING');
  const paidSavingsYield=report.rows.find(row=>row.id==='savings_yield_paid');let informativeSavingsYield=false;
  if(mode==='production'){
   requireCheck(paidSavingsYield?.label==='Rendimientos de Ahorro pagados (incluidos en retiros)','SAVINGS_PAID_YIELD_ROW_MISSING');
   requireCheck(paidSavingsYield.cells.every((cell,index)=>cell.amount===null&&cell.knownAmount===null&&cell.status===(report.months[index].key>report.asOf.slice(0,7)?'NOT_APPLICABLE':'UNAVAILABLE')&&(cell.notes||[]).some(note=>typeof note==='string'&&note.includes('incluido en los retiros')&&note.includes('no se suma nuevamente'))),'SAVINGS_PAID_YIELD_NOT_INFORMATIONAL');
   informativeSavingsYield=true;
  }
  const groupLabels=[...new Set(report.rows.map(row=>row.group))];requireCheck(groupLabels.some(g=>/invers/i.test(g))&&groupLabels.some(g=>/sindicato/i.test(g))&&groupLabels.some(g=>/ahorro/i.test(g))&&groupLabels.some(g=>/préstamo|prestamo|express|chica|nómina|nomina/i.test(g)),'CONSOLIDATED_GROUPS_MISSING');
  stage='LIVE_MATRIX';const table=page.getByRole('table',{name:'Flujo de efectivo consolidado'});await table.waitFor({timeout:150000});
  requireCheck(await table.locator('thead th').count()===13,'MONTH_HEADERS_MISSING');requireCheck(await table.locator('[data-cash-flow-row]').count()===report.rows.length,'FINANCIAL_CONCEPTS_MISSING');requireCheck(await page.locator('.cfr [role=alert]').count()===0,'MODULE_ERROR_VISIBLE');
  const expected=report.rows.map(row=>({id:row.id,label:row.label,cells:row.cells.map(cell=>({status:cell.status,text:cellText(cell,row)}))}));
  const matrixMatches=await table.evaluate((table,rows)=>rows.every(row=>{const tr=[...table.querySelectorAll('[data-cash-flow-row]')].find(tr=>tr.dataset.cashFlowRow===row.id);return tr&&tr.querySelector('th')?.firstChild?.textContent===row.label&&row.cells.every((cell,index)=>{const button=tr.querySelectorAll('td button')[index];return button?.dataset.status===cell.status&&button.querySelector('strong')?.textContent===cell.text;});}),expected);requireCheck(matrixMatches,'LIVE_MATRIX_SOURCE_MISMATCH');
  const states={};for(const row of report.rows)for(const cell of row.cells)states[cell.status]=(states[cell.status]||0)+1;
  const componentRecord=(report.records||[]).find(r=>finite(r.principal)&&finite(r.interest)&&finite(r.administration)),originRow=report.rows.find(row=>row.cells.some(cell=>componentRecord&&cell.sourceIds?.includes(componentRecord.id)))||report.rows.find(row=>row.cells.some(cell=>cell.sourceIds?.length));let originRead=false,detailComponents=false,detailPercentages=false;
  if(originRow){stage='SOURCE_DETAIL';const preferred=originRow.cells.findIndex(cell=>componentRecord&&cell.sourceIds?.includes(componentRecord.id)),index=preferred>=0?preferred:originRow.cells.findIndex(cell=>cell.sourceIds?.length);const rowIndex=await table.locator('[data-cash-flow-row]').evaluateAll((nodes,id)=>nodes.findIndex(n=>n.dataset.cashFlowRow===id),originRow.id);requireCheck(rowIndex>=0,'SOURCE_ROW_MISSING');await table.locator('[data-cash-flow-row]').nth(rowIndex).locator('td button').nth(index).click();await page.getByRole('dialog').waitFor();const detailTable=page.getByRole('dialog').getByRole('table',{name:'Registros de origen'});requireCheck(await detailTable.count()===1,'SOURCE_DETAIL_MISSING');requireCheck(await detailTable.locator('thead th').count()===11,'DETAIL_FIELDS_MISSING');
   const byId=new Map((report.records||[]).map(r=>[r.id,r])),detailRows=(originRow.cells[index].sourceIds||[]).map(id=>byId.get(id)).filter(Boolean).slice(0,50).map(r=>resolveRecord(r,byId)),signs=originRow.cells[index].sourceSigns||{};
   const detailExpected=detailRows.map(r=>({components:[finite(r.amount)?r.amount*(finite(signs[r.id])?signs[r.id]:1):r.amount,r.registeredAmount,r.principal,r.interest,r.administration].map(v=>format(v)),percentages:['principal','interest','administration'].map(k=>finite(r.percentages?.[k])?new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(r.percentages[k])+'%':'Sin determinar')}));
   const matched=await detailTable.evaluate((table,expected)=>{const rows=[...table.querySelectorAll('tbody tr')];return rows.length===expected.length&&expected.every((r,i)=>{const cells=rows[i].querySelectorAll('td');return r.components.every((text,j)=>(j===0?cells[j+4]?.querySelector('strong')?.textContent:cells[j+4]?.textContent)===text)&&r.percentages.every(text=>cells[9]?.textContent.includes(text));});},detailExpected);requireCheck(matched,'LIVE_DETAIL_COMPONENT_MISMATCH');detailComponents=true;detailPercentages=true;await page.keyboard.press('Escape');originRead=true;}
  stage='EXCEL_DOWNLOAD';const downloadPromise=page.waitForEvent('download',{timeout:150000});await page.getByRole('button',{name:'Exportar Excel',exact:true}).click();const download=await downloadPromise;requireCheck(download.suggestedFilename()==='SutiApp_Flujo_Efectivo_'+report.from+'_12_meses.xlsx','XLSX_FILENAME_MISMATCH');privateExport=path.resolve(privateDir,'live-private-export-'+mode+'.xlsx');requireCheck(privateExport.startsWith(path.resolve(privateDir)+path.sep),'EXPORT_PATH_OUTSIDE_TASK');await download.saveAs(privateExport);const excel=await checkExport(fs.readFileSync(privateExport),report);fs.unlinkSync(privateExport);privateExport=null;
  stage='RESPONSIVE';await page.setViewportSize({width:390,height:844});
  // The existing Admin shell remounts a module when switching desktop/mobile.
  // Re-enter its own report from the preserved Reports JC screen if that occurs.
  await page.waitForFunction(()=>document.querySelector('[data-cash-flow-report]')||document.querySelector('[data-reports-jc]'),null,{timeout:45000});
  if(await page.locator('[data-cash-flow-report]').count()===0){await page.getByRole('button',{name:'Reporte Flujo de efectivo',exact:true}).click();await table.waitFor({timeout:150000});}
  requireCheck(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'MOBILE_OVERFLOW');requireCheck(await table.locator('thead th').count()===13,'MOBILE_MONTH_HEADERS_MISSING');
  requireCheck(blocked.length===0,'UNEXPECTED_BUSINESS_WRITE_ATTEMPT');requireCheck(pageErrors.length===0,'BROWSER_SCRIPT_ERROR');
  const result={status:'PASS',mode,checkedAt:new Date().toISOString(),bundleSha256:loadedHash,candidateStaticOverlay:mode==='candidate',financialApiMocks:0,originalReports:8,originalConceptsPreserved:17,months:12,concepts:report.rows.length,groups:groupLabels.length,informativeSavingsYield,realAuthenticatedQuery:true,uiMatchesActualSource:true,sourceDetail:originRead,detailComponents,detailPercentages,excel,privateExportDeleted:true,stateCounts:states,issueCount:(report.issues||[]).length,unassignedCount:(report.unassigned||[]).length,reportRequests:calls,mobileNoPageOverflow:true,financialWrites:0,blockedWriteAttempts:0,pageErrors:0,persistedTokens:0,persistedPersonalRecords:0,screenshots:0};
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-live-'+mode+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }catch(error){let ui;try{ui=await page?.evaluate(()=>({authPhase:window.AffiliateAuth?.getState().phase,adminPhase:window.AdminRepository?.getState().phase,emailInputs:document.querySelectorAll('input[type=email]').length,passwordInputs:document.querySelectorAll('input[type=password]').length,sidebarGroups:[...document.querySelectorAll('[data-admin-sidebar-group]')].map(e=>e.dataset.adminSidebarGroup),reportsVisible:!!document.querySelector('[data-reports-jc]'),cashFlowVisible:!!document.querySelector('[data-cash-flow-report]')}));}catch(_){}const result={status:'FAIL',mode,stage,errorCode:/^[A-Z0-9_]+$/.test(error.message||'')?error.message:'STAGE_FAILED',errorType:error.name,ui,authenticationRequests,reportRequests:calls,blockedWriteAttempts:blocked.length,blockedEndpoints:blocked,pageErrors:pageErrors.length,financialWrites:0,persistedTokens:0,persistedPersonalRecords:0};fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-live-'+mode+'.json'),JSON.stringify(result,null,2)+'\n');console.error(JSON.stringify(result));process.exitCode=1;
 }finally{if(privateExport&&fs.existsSync(privateExport))fs.unlinkSync(privateExport);if(browser)await browser.close();}
}
if(require.main===module)main().catch(()=>{console.error('CASH_FLOW_LIVE_PREPARATION_FAILED');process.exitCode=1;});
module.exports={isFinancialWriter};
