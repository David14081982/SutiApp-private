'use strict';
// Authenticated browser, read-only preview only. Blocks the new mutation endpoint.
// Optional --candidate serves the isolated release but still uses real backend.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),http=require('http');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/qa/evidence/affiliate-control-change');
const expected=JSON.parse(fs.readFileSync(path.join(dir,'release-package.json'),'utf8')),candidate=process.argv.includes('--candidate');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 let server,target='https://sutiapp.com/';
 if(candidate){const base=path.join(root,'.tmp/affiliate-control-change/release/_site');server=http.createServer((req,res)=>{const file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(base+path.sep)&&file!==base){res.writeHead(403);res.end();return;}const actual=fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;try{res.setHeader('Content-Type',actual.endsWith('.js')?'text/javascript':actual.endsWith('.css')?'text/css':actual.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(actual));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));target='http://127.0.0.1:'+server.address().port+'/';}
 const result={status:'FAIL',target:candidate?'LOCAL_CANDIDATE':'https://sutiapp.com/',businessWrites:0,checks:[],realDataScreenshots:false};
 let browser;
 try{
 const html=await(await fetch(target,{cache:'no-store'})).text(),bundlePath=/src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];assert.equal(bundlePath,'app/bundle.js?v='+expected.version);
 const buffer=Buffer.from(await(await fetch(new URL(bundlePath,target),{cache:'no-store'})).arrayBuffer());assert.equal(sha(buffer),expected.bundleSha256);
 result.checks.push('HTML and bundle match exact isolated release');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const worker of ['block','allow']){
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:worker});
 const blocked=[],errors=[];
 await context.route(/\/rest\/v1\/rpc\/(change_admin_affiliate_control|update_admin_affiliate|create_admin_affiliate|archive_admin_affiliate|restore_admin_affiliate)(\?|$)/,async route=>{blocked.push(new URL(route.request().url()).pathname);await route.abort();});
 const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
 await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
 const open=async()=>{const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.evaluate(e=>e.click());await page.waitForFunction(()=>document.querySelector('[data-admin-module="affiliates"],[data-admin-affiliate-detail]'));const entry=page.locator('[data-admin-module="affiliates"]');if(await entry.count())await entry.click();await page.locator('[data-admin-affiliate-detail]').waitFor();await page.getByRole('button',{name:'Cambiar número de control',exact:true}).click();return page.getByRole('dialog');};
 let modal=await open();
 await modal.getByLabel('Nuevo número de control',{exact:true}).fill('READ_ONLY_UI_CHECK_NO_CHANGE');
 const response=page.waitForResponse(r=>r.url().includes('/rpc/preview_admin_affiliate_control'));
 await modal.getByRole('button',{name:'Revisar registros afectados'}).click();const preview=await response;assert(preview.ok(),'PREVIEW_REQUEST_FAILED');await modal.locator('.aff-modal-body > [data-control-impact]').waitFor();assert(await modal.getByRole('button',{name:'Confirmar cambio de número'}).isDisabled());
 const body=await preview.json();assert(body.tables_checked>50);assert.equal(body.excluded.length,4);
 result.previewTables=body.tables_checked;result.previewGroups=body.groups.length;
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Cambiar número de control',exact:true}).click();modal=page.getByRole('dialog');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});modal=await open();await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.deepEqual(blocked,[],'UNEXPECTED_MUTATION');assert.deepEqual(errors,[],'BROWSER_ERRORS');
 result.checks.push('Authenticated preview, confirmation gate, mobile, refresh and zero mutations; service worker '+worker);
 await context.close();
 }
 result.status='PASS';result.bundleSha256=expected.bundleSha256;result.version=expected.version;
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(dir,candidate?'candidate-live.json':'published.json'),JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
