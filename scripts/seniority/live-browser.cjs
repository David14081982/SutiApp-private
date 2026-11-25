'use strict';
const C=require('./common.cjs'),assert=require('assert/strict');
const{chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const area=C.path.join(C.root,'.tmp/seniority'),out=C.path.join(C.root,'docs/qa/evidence/seniority');
const candidate=JSON.parse(C.fs.readFileSync(C.path.join(area,'candidate.json'))),mode=process.argv[2]||'local',target='https://sutiapp.com/';
async function main(){
 const env=C.environment(),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let stage='start';
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  context.setDefaultNavigationTimeout(120000);
  if(mode==='local')await context.route(target+'**',route=>{const u=new URL(route.request().url()),file=C.path.resolve(candidate.site,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(candidate.site+C.path.sep)||!C.fs.existsSync(file)||!C.fs.statSync(file).isFile())return route.continue();return route.fulfill({path:file});});
  const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/rpc/get_affiliate_seniority'))requests.push(JSON.parse(r.postData()));});
  stage='navigate';await page.goto(target,{waitUntil:'domcontentloaded'});
  const hash=await page.evaluate(async()=>{const r=await fetch(document.querySelector('script[src*="app/bundle.js?v="]').src,{cache:'no-store'});return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');});assert.equal(hash,candidate.bundleSha256,'BUNDLE_MISMATCH');
  stage='login';await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
  const dismiss=page.getByRole('button',{name:'Ahora no',exact:true});if(await dismiss.isVisible().catch(()=>false))await dismiss.click();
  async function open(){const card=page.locator('[data-h007-nav="antiguedad"]');await card.waitFor({timeout:60000});const close=page.getByRole('button',{name:'Cerrar',exact:true});if(await close.waitFor({state:'visible',timeout:3500}).then(()=>true).catch(()=>false))await close.click();await card.click();await page.locator('[data-seniority="loaded"]').waitFor({timeout:60000});}
  stage='open';await open();const initialRows=await page.locator('[data-seniority-row]').count();assert(initialRows>0&&initialRows<=100);assert.equal(requests[0].p_offset,0);assert.equal(requests[0].p_limit,50);
  const total=Number(await page.locator('[data-seniority-total]').getAttribute('data-seniority-total'));assert.equal(total,JSON.parse(C.fs.readFileSync(C.path.join(out,'backend-live.json'))).total);
  stage='responsive';const viewports=[];for(const[width,height]of[[390,844],[820,1180],[1440,1000]]){await page.setViewportSize({width,height});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.seniority-scroll').scrollWidth>document.querySelector('.seniority-scroll').clientWidth);assert(!overflow,'HORIZONTAL_OVERFLOW');await page.screenshot({path:C.path.join(area,mode+'-real-'+width+'.png')});viewports.push(width);}
  stage='all-pages';for(let attempt=0;attempt<20;attempt++){const count=await page.locator('[data-seniority-row]').count();if(count===total)break;await page.locator('.seniority-scroll').evaluate(e=>e.scrollTo(0,e.scrollHeight));await page.waitForFunction(n=>document.querySelectorAll('[data-seniority-row]').length>n||document.querySelector('[data-seniority="error"]'),count,{timeout:30000});assert.equal(await page.locator('[data-seniority="error"]').count(),0);}
  const ids=await page.locator('[data-seniority-row]').evaluateAll(nodes=>nodes.map(n=>n.dataset.seniorityRow));assert.equal(ids.length,total);assert.equal(new Set(ids).size,total);const groups=await page.locator('[data-seniority-unit]').count();
  stage='back';await page.getByRole('button',{name:'Regresar a Inicio',exact:true}).click();await page.getByText('Agremiados por Antigüedad',{exact:true}).first().waitFor();
  stage='refresh';await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});await open();assert.equal(Number(await page.locator('[data-seniority-total]').getAttribute('data-seniority-total')),total);
  assert.deepEqual(errors,[]);const proof={status:'PASS',mode,bundleSha256:hash,version:candidate.version,total,groups,uniqueIds:ids.length,initialRows,pageLimit:50,viewports,back:true,authenticatedRefresh:true,browserErrors:0,realBackend:true,businessWrites:0,at:new Date().toISOString()};C.fs.writeFileSync(C.path.join(out,'browser-'+mode+'.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }catch(e){C.fs.writeFileSync(C.path.join(area,'browser-'+mode+'-error.json'),JSON.stringify({stage,error:e.message,stack:e.stack},null,2));console.error(JSON.stringify({status:'FAIL',stage,error:e.code||e.name}));process.exitCode=1;}finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
