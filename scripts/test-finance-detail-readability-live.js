'use strict';
// Read-only real-record verification against the local build or the matching published bundle.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),http=require('http'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/finance-detail-readability-20260922');fs.mkdirSync(out,{recursive:true});
const env={};for(const line of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE || path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
async function main(){
 assert(/^sb_publishable_/.test(env.SUPABASE_PUBLISHABLE_KEY),'Public browser configuration required');
 const server=http.createServer((req,res)=>{
  const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'SutiApp.html';
  if(rel==='app/supabase-config.js'){res.setHeader('Content-Type','application/javascript');res.end('window.__SUTIAPP_CONFIG__ = '+JSON.stringify({supabase:{url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY}})+';');return;}
  if(rel.includes('..')||!/^(?:SutiApp\.html|sw\.js|manifest\.webmanifest|icon[\w-]*\.png|app\/[\w./-]+\.(?:js|css|png|webp)|assets\/[\w./-]+\.(?:png|webp))$/.test(rel)){res.writeHead(404).end();return;}
  const file=path.join(root,rel);if(!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',rel.endsWith('.js')?'application/javascript':rel.endsWith('.css')?'text/css':rel.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');if(/\.(?:js|css|html)$/.test(rel))res.end(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));else fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const targetUrl=process.argv[2]||'http://127.0.0.1:'+server.address().port+'/SutiApp.html';
 if(process.argv[2]){const html=await(await fetch(targetUrl,{cache:'no-store'})).text(),bundlePath=html.match(/src="(app\/bundle\.js\?v=[^"]+)"/)?.[1];assert(bundlePath);const bytes=Buffer.from(await(await fetch(new URL(bundlePath,targetUrl),{cache:'no-store'})).arrayBuffer()),sha=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(sha(bytes),sha(fs.readFileSync(path.join(root,'app/bundle.js'))),'Published bundle mismatch');}

 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const tablet=process.env.AUDIT_MODE==='tablet',initialViewport=tablet?{width:768,height:1024}:{width:1395,height:777};
 const results={status:'IN_PROGRESS',businessWrites:0,errors:[],measurements:[],documents:[]};
 try{
  const page=await browser.newPage({viewport:initialViewport,serviceWorkers:process.env.AUDIT_SW==='allow'?'allow':'block'});page.setDefaultTimeout(30000);
  // Preview the local artifacts at the application's allowed origin in this isolated browser.
  // document-access rejects localhost; backend CORS, tokens and authorization stay unchanged.
  if(!process.argv[2])await page.context().route('https://sutiapp.com/**',async route=>{const url=new URL(route.request().url());const response=await page.request.get('http://127.0.0.1:'+server.address().port+url.pathname+url.search);await route.fulfill({response});});
  page.on('pageerror',e=>results.errors.push(e.message.split('\n')[0].replace(/https?:\/\/\S+/g,'[URL]')));
  results.documentAccessResponses=[];page.on('response',response=>{if(response.url().includes('/functions/v1/document-access'))results.documentAccessResponses.push(response.status());});
  await page.route('**/rest/v1/rpc/**',route=>{if(/\/rpc\/(?:create_|update_|approve_|transition_|register_|record_program_request_admin_action)/.test(route.request().url())){results.businessWrites++;return route.abort();}return route.continue();});
  await page.goto(process.argv[2]?targetUrl:'https://sutiapp.com/',{waitUntil:'domcontentloaded'});
  results.bundle=await page.locator('script[src*="bundle.js?v="]').getAttribute('src');
  await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
  const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.evaluate(b=>b.click());
  await page.locator('[data-admin-module=finanzas]').evaluate(b=>b.click());await page.locator('[data-financial-queue-row]').first().waitFor();

  await page.locator('[data-financial-queue-row]').first().click();
  await page.locator('dialog.finwb-modal[open] [data-financial-detail-person]').waitFor();
  const dossier=page.locator('[data-financial-current-documents]');
  assert.equal(await dossier.evaluate(e=>e.open),false,'Dossier must start collapsed');
  await dossier.locator('summary').click();assert(await dossier.evaluate(e=>e.open));
  await dossier.locator('summary').press('Enter');assert.equal(await dossier.evaluate(e=>e.open),false);
  await page.waitForFunction(()=>{const images=[...document.querySelectorAll('[data-financial-documents] img')];return images.length>0&&images.every(i=>i.complete&&i.naturalWidth>0);},null,{timeout:45000});
  for(const viewport of [{width:1395,height:777},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await page.locator('[data-financial-queue-row]').first().waitFor();
    if(!await page.locator('dialog.finwb-modal[open]').count())await page.locator('[data-financial-queue-row]').first().click();
    await page.locator('dialog.finwb-modal[open] [data-financial-detail-person]').waitFor();
    await page.waitForFunction(()=>{const imgs=[...document.querySelectorAll('[data-financial-documents] img')];return imgs.length&&imgs.every(i=>i.complete&&i.naturalWidth>0);});
    const metrics=await page.evaluate(()=>{const scroll=document.querySelector('.finwb-detail-scroll'),doc=scroll.querySelector('[data-financial-documents]');return {width:innerWidth,value:getComputedStyle(scroll.querySelector('.finwb-kv strong')).fontSize,label:getComputedStyle(scroll.querySelector('.finwb-kv span')).fontSize,title:getComputedStyle(scroll.querySelector('h3')).fontSize,overflow:scroll.scrollWidth>scroll.clientWidth,wide:doc.clientWidth>scroll.clientWidth*.85,images:[...doc.querySelectorAll('img')].map(i=>({loaded:i.complete&&i.naturalWidth>0,proportional:Math.abs(i.clientWidth/i.clientHeight-i.naturalWidth/i.naturalHeight)<.03}))};});
    assert.equal(metrics.value,'18px');assert.equal(metrics.label,'16px');assert.equal(metrics.title,'21px');assert(!metrics.overflow&&metrics.wide);assert(metrics.images.length&&metrics.images.every(i=>i.loaded&&i.proportional));results.measurements.push(metrics);
  }
  await page.getByRole('button',{name:'Ampliar',exact:true}).first().click();await page.locator('[data-image-viewer]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog.finwb-modal[open]').count(),1);
  results.accordion='PASS';results.viewer='PASS';results.target=process.argv[2]?'PRODUCTION':'LOCAL_BUILD_LIVE_BACKEND';assert.equal(results.businessWrites,0);assert.deepEqual(results.errors,[]);results.status='PASS';
 }catch(e){results.status='FAIL';results.error=e.message.split('\n')[0];throw e;}
 finally{fs.writeFileSync(path.join(out,(process.argv[2]?'production':'local')+'-live.json'),JSON.stringify(results,null,2)+'\n');await browser.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify({status:results.status,measurements:results.measurements.length,businessWrites:results.businessWrites,errors:results.errors,error:results.error}));}
}
main().catch(()=>process.exitCode=1);
