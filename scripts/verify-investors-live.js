'use strict';
// Read-only focal UI verification; credentials and screenshots remain private.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto');
const {root,privateDir,environment}=require('./investors-db');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
async function main(){
 const mode=process.argv[2]||'candidate',env=environment(),manifest=JSON.parse(fs.readFileSync(path.join(privateDir,'release-manifest.json'),'utf8'));let server,browser;
 try{
 let url=process.argv[3]||'https://sutiapp.com/';
 if(mode==='candidate'){
  server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(manifest.site,pathname==='/'?'index.html':'.'+pathname);if(!file.startsWith(path.resolve(manifest.site)+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/';
 }
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],blocked=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const req=route.request(),u=req.url();if(/\/rest\/v1\/rpc\/(save_admin_investors|investors_document)/.test(u)||(['PATCH','PUT','DELETE'].includes(req.method())&&u.includes('supabase.co'))){blocked.push(u.replace(/\?.*/,''));return route.abort();}return route.continue();});
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('input[type="email"]').waitFor({timeout:45000});await page.locator('input[type="email"]').fill(env.H005_TEST_EMAIL);await page.locator('input[type="password"]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type="submit"]').click();
 await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
 await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Admin');if(!b)throw Error('ADMIN_ENTRY_MISSING');b.click();});
 await page.waitForFunction(()=>window.AdminRepository?.getState().phase==='authorized',null,{timeout:45000});await page.locator('[data-admin-sidebar-group="inversores"]').waitFor({timeout:30000});
 const groups=await page.locator('[data-admin-sidebar-group]').evaluateAll(n=>n.map(x=>x.dataset.adminSidebarGroup));assert.equal(groups.indexOf('inversores'),groups.indexOf('reportes_jc')+1);
 await page.locator('[data-admin-sidebar-group="inversores"]').click();await page.locator('[data-admin-sidebar-module="inversores"]').click();await page.locator('[data-investors-module]').waitFor();await page.waitForFunction(()=>!document.body.innerText.includes('Consultando Inversores'),null,{timeout:30000});
 assert.equal(await page.locator('.iv [role="alert"]').count(),0,'MODULE_ERROR');assert.equal(await page.locator('.iv [role="tab"]').count(),7);
 const live=await page.evaluate(async()=>{const data=await window.InvestorsRepository.load();return {investors:data.investors.length,contracts:data.contracts.length,active:data.contracts.filter(c=>c.status==='active').length,obligations:data.obligations.length,reviews:data.reviews.length,movements:data.movements.length,canWrite:data.can_write,sourceSha:data.imports[0]?.sha256,sourceKey:window.InvestorsRepository.contextKey().length>0};});
 assert.equal(live.investors,52);assert.equal(live.contracts,88);assert.equal(live.active,35);assert.equal(live.movements,0);assert.equal(live.sourceSha,'28b35c451ec8892c0c3b1b9b5d300f8af457177448daf7dbe6fa3b610d90ef20');assert(live.canWrite&&live.sourceKey);
 await page.screenshot({path:path.join(privateDir,'live-'+mode+'-desktop.png'),fullPage:true});
 await page.getByRole('tab',{name:'Contratos',exact:true}).click();assert.equal(await page.locator('.iv tbody tr').count(),88);await page.getByLabel('Filtrar estado o concepto').selectOption('active');assert.equal(await page.locator('.iv tbody tr').count(),35);
 await page.getByRole('tab',{name:'Calendario',exact:true}).click();assert((await page.locator('.iv tbody tr').count())>214);
 await page.getByRole('tab',{name:'Revisión histórica',exact:true}).click();assert.equal(await page.locator('.iv tbody tr').count(),70);await page.getByRole('button',{name:'Ver evidencia',exact:true}).first().click();await page.getByRole('dialog').waitFor();assert((await page.getByRole('dialog').locator('tbody tr').count())>0);await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Vista general',exact:true}).click();await page.screenshot({path:path.join(privateDir,'live-'+mode+'-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
 const anon=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/get_admin_investors',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:'{}'});assert([401,403].includes(anon.status));
 assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
 const result={status:'PASS',mode,counts:live,sidebarPlacement:'after Reportes JC',views:7,privateSourceRead:true,mobileOverflow:false,refresh:true,anonymousRpcStatus:anon.status,productiveBusinessWrites:0,pageErrors:errors,bundleSha256:manifest.bundleSha256};fs.writeFileSync(path.join(root,'docs/qa/evidence/investors/live-'+mode+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
