'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),assert=require('assert').strict;
const {root,chromium}=require('./test-text-size-helpers');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const old=f=>cp.execFileSync('git',['show',(process.env.SUTIAPP_TEXT_SIZE_BASE||'2aa05b9')+':'+f],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
const prior={html:old('SutiApp.html'),sw:old('sw.js'),prefs:old('app/text-size-preferences.js'),css:old('app/text-size.css'),bundle:old('app/bundle.js')};
const current={html:read('SutiApp.html'),sw:read('sw.js'),prefs:read('app/text-size-preferences.js'),css:read('app/text-size.css'),bundle:read('app/bundle.js')};
const oldCache=prior.sw.match(/sutiapp-v\d+/)[0],newCache=current.sw.match(/sutiapp-v\d+/)[0];
const newCssQuery='?v='+current.html.match(/text-size\.css\?v=(\d+)/)[1];
function shell(source,version){
 // Checkouts may retain CRLF; normalize before extracting the exact existing bootstrap.
 const html=source.html.replace(/\r\n/g,'\n'),at=html.indexOf('      (function () {\n        if (!("serviceWorker"');assert(at>=0);
 const bootstrap=html.slice(at,html.indexOf('      })();',at)+11);
 return '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app/text-size.css?v='+ source.html.match(/text-size\.css\?v=(\d+)/)[1]+'"><main data-version="'+version+'" data-text-size="normal"><span id="result"></span></main><script src="app/text-size-preferences.js?v='+version+'"></script><script>'+bootstrap+'\ntry { const size=TextSizePreferences.fromUser({user_metadata:{sutiapp_text_size:"small"}});document.querySelector("main").dataset.textSize=size;document.getElementById("result").textContent=size;} catch(e){document.getElementById("result").textContent=e.message;}</script>';
}
(async()=>{
 let mode='old';const requests=[];
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),source=mode==='old'?prior:current;
  requests.push(u.pathname+u.search);res.setHeader('Cache-Control','no-store');
  if(mode==='failed-install'&&u.pathname==='/app/text-size.css'&&u.search===newCssQuery){res.writeHead(503);return res.end('isolated precache failure');}
  if(u.pathname==='/'||u.pathname==='/SutiApp.html'){res.setHeader('Content-Type','text/html');return res.end(shell(source,mode==='old'?'old':'new'));}
  const known={'/sw.js':['sw','application/javascript'],'/app/bundle.js':['bundle','application/javascript'],'/app/text-size-preferences.js':['prefs','application/javascript'],'/app/text-size.css':['css','text/css']};
  if(known[u.pathname]){const [key,type]=known[u.pathname];res.setHeader('Content-Type',type);return res.end(source[key]);}
  const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.png')?'image/png':f.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({executablePath:process.env.SUTIAPP_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage();let loads=0;page.on('load',()=>loads++);
  await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.reload();assert.equal(await page.locator('#result').textContent(),'INVALID_TEXT_SIZE');
  assert((await page.evaluate(()=>caches.keys())).includes(oldCache));
  mode='failed-install';
  const failed=await page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.getRegistration();
   const completion=new Promise(resolve=>registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state==='redundant')resolve('redundant');});
   },{once:true}));await registration.update();return completion;
  });
  assert.equal(failed,'redundant');assert.equal(await page.locator('main').getAttribute('data-version'),'old');
  assert((await page.evaluate(()=>caches.keys())).includes(oldCache),'failed install keeps previous cache');
  const beforeLoads=loads;mode='new';await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.version==='new'&&document.querySelector('#result')?.textContent==='small',null,{timeout:30000});
  await page.waitForFunction(async({oldCache,newCache})=>{const keys=await caches.keys();return keys.includes(newCache)&&!keys.includes(oldCache);},{oldCache,newCache});
  await page.waitForTimeout(1000);assert(loads>beforeLoads,'existing bootstrap automatically reloads controlled page');
  await context.setOffline(true);await page.reload();assert.equal(await page.locator('#result').textContent(),'small');
  const font=await page.locator('main').evaluate(e=>getComputedStyle(e).fontSize);assert.equal(font,'14px');
  const result={status:'PASS',isolation:'Production SW and bootstrap; isolated shell/readers; no Auth/backend',oldSmallRead:'INVALID_TEXT_SIZE',failedPrecachePreservesOldWorker:true,automaticReload:true,newSmallRead:'small',offlineReopen:'small',oldCacheRemoved:true,formOfRecovery:'Forward-compatible reader, no preference rewrite',backendRequests:0,businessWrites:0};
  const out=path.join(root,'docs/qa/evidence/text-size-small-20260911');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'cache-upgrade.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
