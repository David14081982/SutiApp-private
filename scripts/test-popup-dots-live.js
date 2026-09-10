'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const h=require('./test-text-size-helpers');
const out=path.join(h.root,'docs/qa/evidence/popup-dots-single-row-20260909');
const production=process.argv.includes('--production');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
 const site=production?null:await h.serve(),url=production?'https://sutiapp.com/':site.url;
 let browser;
 try{
  const html=await(await fetch(url+'?popup-single-row=242')).text();
  for(const ref of ['text-size.css?v=242','bundle.js?v=241','sw.js?v=189'])assert(html.includes(ref),ref);
  const hashes={};for(const file of ['app/bundle.js','app/text-size.css','sw.js']){
   const r=await fetch(url+file+'?popup-single-row=242');assert(r.ok);
   hashes[file]=hash(Buffer.from(await r.arrayBuffer()));
   assert.equal(hashes[file],hash(fs.readFileSync(path.join(h.root,file),'utf8').replace(/\r\n/g,'\n')),file);
  }
  browser=await h.chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Reject persistent mutations; login and existing read-only RPC/Edge calls remain available.
  await page.route('**/*',route=>{
   const r=route.request(),u=new URL(r.url()),method=r.method();
   const mutation=(u.pathname==='/auth/v1/user'&&method==='PUT')||
    (u.pathname.startsWith('/rest/v1/')&&!u.pathname.startsWith('/rest/v1/rpc/')&&['POST','PATCH','DELETE'].includes(method));
   if(mutation){writes.push({path:u.pathname,method});return route.abort();}return route.continue();
  });
  await h.login(page,url);const slider=page.getByRole('slider',{name:'Elegir imagen del carrusel'});await slider.waitFor({timeout:30000});await slider.focus();
  const count=await page.locator('[data-popup-dot]').count();assert(count>1);
  const results=[];
  for(const width of [320,390,430])for(const size of ['normal','large','largest']){
   await page.setViewportSize({width,height:844});
   // Presentation-only override in this test page; never writes the account preference.
   await page.locator('[data-text-size]').evaluate((e,s)=>e.dataset.textSize=s,size);
   await page.waitForTimeout(350);
   const markers=await page.locator('[data-popup-dot]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e,'::after');return{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,height:parseFloat(s.height),width:parseFloat(s.width)};}));
   assert.equal(new Set(markers.map(m=>Math.round(m.y))).size,1);
   for(const m of markers)assert.equal(m.height,8);
   const target=await slider.boundingBox();assert(target.width>=48&&target.height>=48);
   for(const name of ['Anterior','Siguiente']){const b=await page.getByRole('button',{name,exact:true}).boundingBox();assert(b.width>=48&&b.height>=48);assert(b.x+b.width<=target.x+.5||b.x>=target.x+target.width-.5);}
   for(let i=0;i<count;i++){
    // Real promotional copy can change the modal height between images.
    const m=await page.locator('[data-popup-dot]').nth(i).boundingBox();
    await page.touchscreen.tap(m.x+m.width/2,m.y+m.height/2);
    assert.equal(await slider.inputValue(),String(i+1));assert.equal(await page.locator('[data-active="true"]').getAttribute('data-popup-dot'),String(i+1));
    await page.waitForTimeout(350);
   }
   await page.getByRole('button',{name:'Siguiente',exact:true}).click();assert.equal(await slider.inputValue(),'1');
   await page.getByRole('button',{name:'Anterior',exact:true}).click();assert.equal(await slider.inputValue(),String(count));
   assert((await slider.getAttribute('aria-valuetext')).startsWith(count+' de '+count+':'));
   await slider.press('Home');assert.equal(await slider.inputValue(),'1');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('.su-popup-pagination').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
   const img=page.locator('button[aria-label="Cerrar"]').locator('..').locator('img').first();
   await img.evaluate(e=>e.complete?Promise.resolve():new Promise(r=>{e.addEventListener('load',r,{once:true});e.addEventListener('error',r,{once:true});}));
   assert(await img.evaluate(e=>e.naturalWidth>0));
   if(width===390&&size==='normal')await page.screenshot({path:path.join(h.privateDir,'popup-single-row-'+(production?'production':'local')+'-private.png')});
   results.push({width,size,count,rows:1,status:'PASS'});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await page.getByRole('button',{name:'Ahora no',exact:true}).click();await slider.waitFor({state:'hidden'});
  const result={status:'PASS',url,build:site?.build||'DEPLOYED',bundleVersion:241,cssVersion:242,workerVersion:189,hashes,realPopup:true,scenarios:results,selection:'TOUCH_KEYBOARD_ARROWS_PASS',imageLoaded:true,minimumSelectorAndArrowTarget:48,dismissal:'PASS',attemptedPersistentWrites:writes,errors,physicalDeviceValidation:false};
  fs.writeFileSync(path.join(out,(production?'production':'local')+'.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:'PASS',url,scenarios:results.length,count,hashes}));
 }finally{if(browser)await browser.close();if(site)await new Promise(r=>site.server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
