'use strict';
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..');
async function main(){
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html');r.end('<div id="root"></div>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  for(const file of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:fs.readFileSync(root+'/app/vendor/'+file,'utf8')});
  await page.evaluate(()=>{
   window.__id='11111111-1111-4111-8111-111111111111';window.__subid='22222222-2222-4222-8222-222222222222';window.__phase='authenticated';window.__listeners=new Set();window.__permission='default';window.__asked=0;window.__subscribed=0;window.__revoked=0;window.__fail=false;window.__sub=null;
   window.AffiliateAuth={getState:()=>({phase:__phase,session:{user:{id:__id}},affiliate:{id:'affiliate',auth_user_id:__id}}),subscribe:f=>{__listeners.add(f);return()=>__listeners.delete(f);}};
   Object.defineProperty(Notification,'permission',{get:()=>__permission,configurable:true});Notification.requestPermission=async()=>{__asked++;__permission=window.__answer||'granted';return __permission;};
   window.__reg={pushManager:{getSubscription:async()=>__sub,subscribe:async()=>{__subscribed++;__sub={toJSON:()=>({endpoint:'https://fcm.googleapis.com/test/isolated',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}}),unsubscribe:async()=>{__sub=null;return true;}};return __sub;}},getNotifications:async()=>[]};
   Object.defineProperty(navigator.serviceWorker,'getRegistration',{value:async()=>__reg,configurable:true});Object.defineProperty(navigator.serviceWorker,'ready',{value:Promise.resolve(__reg),configurable:true});
   window.__backendActive=true;window.SutiSupabase={getClient:()=>({rpc:async(name)=>{if(__fail)return{error:Error('OFFLINE')};if(name==='get_self_request_push_config')return{data:{enabled:true,public_key:'B'.repeat(87)}};if(name==='get_self_request_push_status')return{data:__backendActive};if(name==='revoke_self_request_push'){__revoked++;return{data:true};}return{data:__subid};}})};
  });
  await page.addScriptTag({content:fs.readFileSync(root+'/app/request-push.js','utf8')});await page.evaluate(()=>{window.__root=ReactDOM.createRoot(document.getElementById('root'));__root.render(React.createElement(RequestPushInvitation));});
  await page.locator('[data-request-push="ready"]').waitFor();assert.equal(await page.evaluate(()=>__asked),0,'no permission on app load');
  await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();await page.locator('[data-request-push="active"]').waitFor();assert.equal(await page.evaluate(()=>__asked),1);assert.equal(await page.evaluate(()=>__subscribed),1);
  await page.evaluate(()=>{__backendActive=false;window.dispatchEvent(new Event('focus'));});await page.locator('[data-request-push="ready"]').waitFor();
  await page.evaluate(()=>{__backendActive=true;window.dispatchEvent(new Event('focus'));});await page.locator('[data-request-push="active"]').waitFor();
  await page.getByRole('button',{name:'Desactivar en este dispositivo'}).click();await page.locator('[data-request-push="ready"]').waitFor();assert.equal(await page.evaluate(()=>__revoked),1);
  await page.evaluate(()=>{__permission='default';__answer='denied';});await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();await page.locator('[data-request-push="denied"]').waitFor();assert.equal(await page.evaluate(()=>__subscribed),1,'denied must not subscribe');
  await page.evaluate(()=>{__permission='default';__answer='granted';window.dispatchEvent(new Event('focus'));});await page.locator('[data-request-push="ready"]').waitFor();await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();await page.locator('[data-request-push="active"]').waitFor();
  // Execute the actual SW source against a worker contract; real IndexedDB transactions arbitrate concurrency.
  await page.evaluate(source=>{
   window.__handlers={};window.__shown=[];window.__opened=[];
   const worker={addEventListener:(name,fn)=>{__handlers[name]=fn;},location:{origin:location.origin},registration:{scope:location.origin+'/',showNotification:async(title,options)=>__shown.push({title,...options})},clients:{matchAll:async()=>[],openWindow:async url=>__opened.push(url)}};
   new Function('self',source)(worker);
   window.__emit=async(name,data)=>{let work;__handlers[name]({...data,waitUntil:p=>{work=p;}});await work;};
   window.__payload={v:1,event_id:'33333333-3333-4333-8333-333333333333',request_id:'44444444-4444-4444-8444-444444444444',subscription_id:__subid,title:'Solicitud autorizada',body:'Aviso de prueba aislada'};
  },fs.readFileSync(root+'/sw.js','utf8'));
  await page.evaluate(async()=>{await Promise.all(Array.from({length:8},()=>__emit('push',{data:{json:()=>__payload}})));});assert.equal(await page.evaluate(()=>__shown.length),1,'concurrent duplicate visible notifications');
  await page.evaluate(async()=>{await __emit('notificationclick',{notification:{...__shown[0],close:()=>{}}});});assert.match(await page.evaluate(()=>__opened[0]),/#\/historial\?request=44444444/);
  await page.reload();
  // A fresh document and identical DB retain the seen ID, as a refreshed/restarted worker does.
  await page.evaluate(source=>{window.__handlers={};window.__shown=[];new Function('self',source)({addEventListener:(n,f)=>__handlers[n]=f,registration:{scope:location.origin+'/',showNotification:async()=>__shown.push(1)}});},fs.readFileSync(root+'/sw.js','utf8'));
  await page.evaluate(async()=>{let work;__handlers.push({data:{json:()=>({v:1,event_id:'33333333-3333-4333-8333-333333333333',request_id:'44444444-4444-4444-8444-444444444444',subscription_id:'22222222-2222-4222-8222-222222222222',title:'duplicate',body:'duplicate'})},waitUntil:p=>work=p});await work;});assert.equal(await page.evaluate(()=>__shown.length),0);
  // A different device binding cannot receive this encrypted payload, even after account switching.
  await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('sutiapp-request-push-v1',1);r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('device','readwrite');tx.objectStore('device').delete('binding');tx.oncomplete=resolve;});db.close();let work;__handlers.push({data:{json:()=>({v:1,event_id:'55555555-5555-4555-8555-555555555555',request_id:'44444444-4444-4444-8444-444444444444',subscription_id:'22222222-2222-4222-8222-222222222222',title:'private',body:'private'})},waitUntil:p=>work=p});await work;});assert.equal(await page.evaluate(()=>__shown.length),0);
  assert.deepEqual(errors,[]);
  const proof={status:'PASS',environment:'Chrome desktop, mobile viewport; isolated browser/RPC/worker contract, actual production JS and IndexedDB',optIn:'PASS',noAutomaticPermission:true,denial:'PASS',subscription:'PASS',revocation:'PASS',notificationclick:'PASS',restartDedup:'PASS',duplicates:0,crossUserDelivery:0,errors};
  const out=root+'/docs/qa/evidence/request-push-20260908';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/browser.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
