'use strict';
// H-SAVINGS-JC-REPORT-001 real browser check: login as the authorized admin test account, Admin > Ahorro > Reporte JC.
// Usage: node scripts/test-savings-jc-report-live.js <local|published> <base-url> <private-output.xlsx>
// Writers stay blocked (financial-legacy, table writes); only reads, Auth and savings-jc-report are allowed.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {env}=require('./voting-consultas-db.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/savings-jc-report');
const [mode,base,target]=process.argv.slice(2);
const report={status:'FAIL',mode,base,checks:[],blockedWrites:[],edgeCalls:[],browserErrors:[]};
let browser,stage='setup';
async function main(){try{
 assert(['local','published'].includes(mode)&&/^https?:\/\//.test(base||''),'USAGE');assert(target&&!path.resolve(target).startsWith(root),'PRIVATE_OUTPUT_OUTSIDE_REPO_REQUIRED');
 const e=env();browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(45000);
 page.on('pageerror',x=>report.browserErrors.push(x.message.slice(0,200)));
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url()),m=r.method();
  if(/\/functions\/v1\//.test(u.pathname)){const fn=u.pathname.split('/').pop();report.edgeCalls.push(fn);if(fn==='financial-legacy'&&m!=='OPTIONS'){report.blockedWrites.push({endpoint:fn});return route.abort();}}
  if(/\/rest\/v1\//.test(u.pathname)&&!/\/rpc\//.test(u.pathname)&&!['GET','HEAD','OPTIONS'].includes(m)){report.blockedWrites.push({endpoint:u.pathname.split('/').pop(),method:m});return route.abort();}
  return route.continue();});
 stage='open';await page.goto(base,{waitUntil:'domcontentloaded'});
 stage='login';await page.locator('input[type=email]').fill(e.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(e.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
 await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:90000});
 stage='admin_savings';await page.locator('[data-app-tab="admin"]').click();await page.locator('[data-admin-desktop-sidebar]').waitFor();
 const dismiss=page.getByRole('button',{name:'Ahora no',exact:true});if(await dismiss.isVisible())await dismiss.click();
 const group=page.locator('[data-admin-sidebar-group="savings"]');if(await group.getAttribute('aria-expanded')==='false')await group.click();
 await page.locator('[data-admin-sidebar-module="savings"]').click();await page.getByText('Panorama del ahorro',{exact:true}).waitFor();
 assert.deepEqual(await page.getByRole('tab').allTextContents(),['Resumen','Personas','Atención','Programa','Reporte RH','Historial']);
 assert.deepEqual(await page.locator('nav.svp-tabs > button').allTextContents(),['Resumen','Personas','Atención','Programa','Reporte RH','Historial','Reporte JC']);
 report.checks.push('Admin > Ahorro shows the six existing tabs and «Reporte JC» right after Historial');
 stage='download';const download=page.waitForEvent('download',{timeout:90000});const t0=Date.now();await page.locator('[data-savings-jc-report]').click();
 const file=await download;await file.saveAs(target);const bytes=fs.readFileSync(target);
 assert.match(file.suggestedFilename(),/^Reporte_JC_Ahorro_\d{4}-\d{2}-\d{2}\.xlsx$/);assert.deepEqual([...bytes.subarray(0,4)],[80,75,3,4]);
 await page.waitForFunction(()=>document.querySelector('[data-savings-jc-report]')?.textContent==='Reporte JC');assert.equal(await page.getByRole('alert').count(),0);
 report.download={filename:file.suggestedFilename().replace(/\d{4}-\d{2}-\d{2}/,'<fecha>'),bytes:bytes.length,ms:Date.now()-t0};
 report.checks.push('Click downloads a valid .xlsx from the deployed savings-jc-report Edge; no error shown');
 assert.equal(report.edgeCalls.filter(x=>x==='savings-jc-report').length>=1,true);assert.deepEqual(report.browserErrors,[]);
 const ownWrites=report.blockedWrites.filter(w=>w.endpoint!=='financial-legacy');assert.deepEqual(ownWrites,[],'UNEXPECTED_TABLE_WRITE');
 report.status='PASS';await context.close();
 }catch(error){report.failure={stage,message:String(error.message).split('Call log:')[0].slice(0,400)};process.exitCode=1;}finally{await browser?.close();report.edgeCalls=[...new Set(report.edgeCalls)];fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,1));}}
main();
