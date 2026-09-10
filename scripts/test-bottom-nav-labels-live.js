'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const h=require('./test-text-size-helpers'),{metrics,validate,settled}=require('./test-bottom-nav-labels');
const out=path.join(h.root,'docs/qa/evidence/bottom-nav-labels-20260909'),production=process.argv.includes('--production');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
 const site=production?null:await h.serve(),url=production?'https://sutiapp.com/':site.url;let browser;
 try{
  const html=await(await fetch(url+'?nav-labels=243')).text();for(const ref of ['bundle.js?v=242','text-size.css?v=243','sw.js?v=190'])assert(html.includes(ref));
  const hashes={};for(const f of ['app/bundle.js','app/text-size.css','sw.js']){const r=await fetch(url+f+'?nav-labels=243');assert(r.ok);hashes[f]=hash(Buffer.from(await r.arrayBuffer()));assert.equal(hashes[f],hash(fs.readFileSync(path.join(h.root,f),'utf8').replace(/\r\n/g,'\n')));}
  browser=await h.chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),errors=[],mutations=[];let fixtureSize=null;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url()),method=r.method();
   if((u.pathname==='/auth/v1/user'&&method==='PUT')||(u.pathname.startsWith('/rest/v1/')&&!u.pathname.startsWith('/rest/v1/rpc/')&&['POST','PATCH','DELETE'].includes(method))){mutations.push({path:u.pathname,method});return route.abort();}
   if(fixtureSize&&u.pathname==='/auth/v1/user'&&method==='GET'){
    const response=await route.fetch(),body=await response.json();assert(response.ok());body.user_metadata={...body.user_metadata,sutiapp_text_size:fixtureSize};return route.fulfill({response,json:body});
   }
   return route.continue();
  });
  await h.login(page,url);await page.locator('[data-app-bottom-nav]').waitFor();
  const originalSize=await page.locator('[data-app-bottom-nav]').getAttribute('data-nav-text-size');await settled(page,originalSize);validate(await metrics(page),originalSize);
  const dismiss=page.getByRole('button',{name:'Ahora no',exact:true});try{await dismiss.waitFor({timeout:10000});await dismiss.click();}catch(e){if(await page.getByRole('slider',{name:'Elegir imagen del carrusel'}).count())throw e;}
  const results=[];
  for(const width of [320,360,375,390,430])for(const size of ['normal','large','largest']){
   fixtureSize=size;await page.setViewportSize({width,height:844});await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await settled(page,size);
   const m=await metrics(page);validate(m,size);results.push({width,size,tabs:m.buttons.length,labels:m.buttons.map(b=>b.label),status:'PASS'});
   if(width===320&&size==='largest')await page.screenshot({path:path.join(h.privateDir,'nav-labels-'+(production?'production':'local')+'-private.png')});
  }
  const navigation=[];await page.setViewportSize({width:390,height:844});await settled(page,'largest');
  for(const b of (await metrics(page)).buttons){
   await page.locator('[data-app-tab="'+b.id+'"]').click();await page.locator('[data-app-tab-scroll="'+b.id+'"]').waitFor();await settled(page,'largest');validate(await metrics(page),'largest');
   assert.equal(await page.locator('[data-app-tab="'+b.id+'"]').getAttribute('aria-current'),'page');
   if(b.id==='admin')assert.equal(await page.locator('[data-text-size]').count(),0,'Admin content typography must remain unchanged');
   navigation.push({id:b.id,status:'PASS'});
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');await settled(page,'largest');validate(await metrics(page),'largest');
  assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);
  const result={status:'PASS',url,build:site?.build||'DEPLOYED',versions:{bundle:242,css:243,worker:190},hashes,originalAuthoritativeSizeVerified:originalSize,matrixPreferenceMode:'ISOLATED_BROWSER_RESPONSE_OVERRIDE_ONLY',identityAndPermissions:'UNCHANGED',persistentPreferenceWrites:0,attemptedPersistentMutations:mutations,results,navigation,refresh:'PASS',errors,physicalDevices:false};
  fs.writeFileSync(path.join(out,(production?'production':'local')+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',url,scenarios:results.length,navigation:navigation.length,hashes}));
 }finally{if(browser)await browser.close();if(site)await new Promise(r=>site.server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
