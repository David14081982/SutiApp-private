'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert').strict,{chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core'),a=require('./audit.cjs');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const target=process.env.H06_TARGET||'http://localhost:8080/',label=process.env.H06_LABEL||'local';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),metrics=[],errors=[],pending=[];let stage='login';
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),e=a.env();
  page.on('pageerror',e=>errors.push(e.message));const stages=new WeakMap();page.on('request',r=>stages.set(r,stage));
  page.on('response',response=>{const req=response.request(),url=req.url();let kind='',count=0;
   if(url.includes('/rest/v1/')){const path=new URL(url).pathname;kind=(path.includes('/rpc/')?'rpc:':'')+path.split('/').at(-1);}
   if(url.includes('/storage/v1/object/sign/')){try{const body=req.postDataJSON();if(Array.isArray(body.paths)){kind='sign';count=body.paths.length;}}catch(_){}}
   if(req.resourceType()==='image')kind='image';
   if(!kind)return;const at=stages.get(req)||stage;pending.push((async()=>{const body=await response.body();let rows=0;try{const v=JSON.parse(body);rows=Array.isArray(v)?v.length:0;}catch(_){}metrics.push({stage:at,kind,requestedObjects:count,http:response.status(),bytes:body.length,rows,ms:Math.max(0,req.timing().responseEnd)});})().catch(()=>{}));
  });
  await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(e.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(e.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});await page.waitForLoadState('networkidle');
  let summaries=[],adminSummary;
  if(!process.env.H06_NAV_ONLY){
  for(const admin of [false,true]){
   stage=admin?'admin-full-compatibility':'affiliate-full-compatibility';
   const data=await page.evaluate(async admin=>{const start=performance.now(),items=await ProgramCatalogRepository.listItems({admin});return{ms:performance.now()-start,payload:items.map(({imagenes,imagenAssets,...item})=>({...item,imageCount:imagenes.length,imagenAssets:imagenAssets.map(({url,...asset})=>asset)}))};},admin);
   const before=JSON.parse(fs.readFileSync(a.dir+'/browser-before.json')).summaries.find(x=>x.label===(admin?'admin':'affiliate'));
   assert.equal(hash(data.payload),before.payload_sha256,'complete product/link/value/order compatibility');
   summaries.push({stage,items:data.payload.length,ms:data.ms,sha256:hash(data.payload),equivalent:true});
  }
  stage='all-programs-scoped';
  const scoped=await page.evaluate(async()=>{
   const out=[];for(const key of ['aires','auto','casa','cirugias','computo','donativos','farma','prestamo','puertas','renta','solar','terrenos','tours']){const start=performance.now(),items=await ProgramCatalogRepository.listItems({programKey:key,deferImages:true});out.push({key,ms:performance.now()-start,payload:items.map(({imagenes,imagenAssets,...item})=>({...item,imageCount:ProgramCatalogRepository.imageAssets({imagenAssets}).length,imagenAssets:imagenAssets.map(({url,...asset})=>asset)}))});}return out;
  });
  const before=JSON.parse(fs.readFileSync(a.dir+'/browser-before.json')).summaries[0];
  for(const p of scoped){const expected=before.programs.find(x=>x.key===p.key);if(expected)assert.equal(hash(p.payload),expected.sha256,'scoped '+p.key);else assert.equal(p.payload.length,0);summaries.push({stage,key:p.key,items:p.payload.length,ms:p.ms,sha256:hash(p.payload),equivalent:true});}
  stage='admin-summary';adminSummary=await page.evaluate(async()=>{const t=performance.now(),items=await ProgramCatalogRepository.listItems({admin:true,includeAssets:false});return{items:items.length,links:items.reduce((n,i)=>n+i.imagenAssets.length,0),ms:performance.now()-t};});assert.equal(adminSummary.items,135);assert.equal(adminSummary.links,0);
  a.save('catalog-equivalence-'+label,{status:'PASS',summaries,adminSummary});
  }else{({summaries,adminSummary}=JSON.parse(fs.readFileSync(a.dir+'/catalog-equivalence-local.json')));}
  if(await page.getByRole('button',{name:'Ahora no',exact:true}).isVisible())await page.getByRole('button',{name:'Ahora no',exact:true}).click();
  const optimized=await page.evaluate(()=>!!window.PrivateResourceDemand);
  stage='navigation-auto';await page.getByRole('button',{name:'Finanzas',exact:true}).click();await page.getByRole('button',{name:/Suti Auto/}).click();
  await page.waitForFunction(()=>catalogStore.count('fin','auto')===3);await page.waitForLoadState('networkidle');
  const top=await page.evaluate(()=>({products:catalogStore.count('fin','auto'),loadedImages:[...document.querySelectorAll('.su-press img')].filter(i=>i.naturalWidth>0).length,text:document.body.innerText.includes('Disponibles ahora')}));assert(top.text);assert.equal(top.products,3);
  stage='scroll-auto';const name=await page.evaluate(()=>catalogStore.live('fin','auto')[0].nombre);await page.locator('.su-press').filter({hasText:name}).last().evaluate(n=>n.scrollIntoView({block:'center'}));await page.waitForFunction(()=>[...document.querySelectorAll('.su-press img')].some(x=>x.naturalWidth>0));await page.waitForLoadState('networkidle');
  stage='detail-auto';await page.locator('.su-press').filter({hasText:name}).last().click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-press="subtle"] img')].some(i=>i.naturalWidth>0&&i.closest('[data-press="subtle"]')));await page.waitForLoadState('networkidle');
  const gallery=await page.evaluate(()=>({slides:document.querySelectorAll('[data-press="subtle"]').length,loaded:[...document.querySelectorAll('[data-press="subtle"] img')].filter(i=>i.naturalWidth>0).length,sources:document.querySelectorAll('[data-press="subtle"] img[src]').length}));assert(gallery.slides>1);assert(gallery.loaded>=1);assert.equal(gallery.sources,optimized?1:gallery.slides);
  stage='lightbox-auto';await page.locator('[data-press="subtle"]').first().click();await page.waitForSelector('[data-image-viewer="open"]');await page.waitForFunction(()=>document.querySelector('[data-image-viewer="open"] img')?.naturalWidth>0);
  await page.getByRole('button',{name:'Imagen siguiente',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-image-viewer="open"] img')?.naturalWidth>0);await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.waitForLoadState('networkidle');
  await Promise.all(pending);assert.equal(errors.length,0,errors.join(';'));
  a.save('browser-'+label,{at:new Date().toISOString(),target,status:'PASS',summaries,adminSummary,top,gallery,metrics,errors});console.log(JSON.stringify({status:'PASS',comparisons:summaries.length,adminSummary,top,gallery,totals:metrics.filter(m=>m.stage!=='login').reduce((v,m)=>({http:v.http+1,bytes:v.bytes+m.bytes,signedObjects:v.signedObjects+m.requestedObjects}),{http:0,bytes:0,signedObjects:0})}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message.replace(/https?:\/\/\S+/g,'[url]'));process.exitCode=1;});
