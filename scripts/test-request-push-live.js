'use strict';
const fs=require('fs'),assert=require('assert').strict,t=require('./request-push-tools');
const {chromium,firefox}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const webpush=require('C:/tmp/sutiapp-request-push-runtime/node_modules/web-push');
const target=process.argv[2]||'http://localhost:8083',timeout=(p,ms)=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error('REAL_PUSH_TIMEOUT')),ms))]);
async function main(){
 const engine=process.argv[3]||'chromium';
 // Web Push is unavailable in private browsing; use an isolated normal profile.
 const profile='C:/tmp/sutiapp-request-push-private/browser-'+engine+'-'+Date.now();
 const persistent=engine==='firefox'?await firefox.launchPersistentContext(profile,{headless:true,permissions:['notifications'],firefoxUserPrefs:{'dom.push.enabled':true,'dom.push.connection.enabled':true,'dom.push.serverURL':'wss://push.services.mozilla.com/'}}):await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,permissions:['notifications'],ignoreDefaultArgs:['--disable-background-networking']});
 const browser={newContext:async()=>persistent,close:()=>persistent.close()};
 const proof={status:'FAIL',engine,target:target.includes('localhost')?'LOCAL_RELEASE':'PRODUCTION',businessWrites:0,errors:[]};
 let context,page;
 try{
  context=await browser.newContext({permissions:['notifications']});page=await context.newPage();page.on('pageerror',e=>proof.errors.push(e.message));page.on('request',r=>{if(/\/rpc\/(transition_program_request_workflow|record_program_request_admin_action|approve_)/.test(r.url()))proof.businessWrites++;});
  await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(t.env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(t.env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
  await page.getByRole('button',{name:'Notificaciones',exact:true}).first().click();await page.locator('[data-request-push="ready"]').waitFor({timeout:30000});
  proof.publicConfig='PASS';
  await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();
  await page.locator('[data-request-push="active"]').waitFor({timeout:45000});proof.subscription='PASS';
  const subscription=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return(await r.pushManager.getSubscription()).toJSON();});
  const binding=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('sutiapp-request-push-v1',1);r.onsuccess=()=>{const d=r.result,x=d.transaction('device').objectStore('device').get('binding');x.onsuccess=()=>{d.close();resolve(x.result);};};}));
  const keys=JSON.parse(fs.readFileSync('C:/tmp/sutiapp-request-push-private/vapid.json'));
  // Controlled browser only, isolated transport fixture. No fabricated request/event is persisted.
  const payload={v:1,event_id:require('crypto').randomUUID(),request_id:require('crypto').randomUUID(),subscription_id:binding.subscription_id,title:'SutiApp · prueba de notificaciones',body:'Verificación técnica en un navegador controlado.'};
  const result=await webpush.sendNotification(subscription,JSON.stringify(payload),{vapidDetails:{subject:'https://sutiapp.com',publicKey:keys.publicKey,privateKey:keys.privateKey},TTL:60,topic:payload.event_id.replace(/-/g,''),timeout:15000});assert.equal(result.statusCode,201);proof.providerAccepted='PASS';
  await page.waitForFunction(async id=>(await(await navigator.serviceWorker.ready).getNotifications()).some(n=>n.tag==='request-event-'+id),payload.event_id,{timeout:30000});proof.realEncryptedDelivery='PASS';
  await webpush.sendNotification(subscription,JSON.stringify(payload),{vapidDetails:{subject:'https://sutiapp.com',publicKey:keys.publicKey,privateKey:keys.privateKey},TTL:60,topic:payload.event_id.replace(/-/g,''),timeout:15000});
  await page.waitForTimeout(2000);const visible=await page.evaluate(async id=>(await(await navigator.serviceWorker.ready).getNotifications()).filter(n=>n.tag==='request-event-'+id).length,payload.event_id);assert.equal(visible,1);proof.duplicates=0;
  await page.getByRole('button',{name:'Desactivar en este dispositivo'}).click();await page.locator('[data-request-push="ready"]').waitFor();proof.revocation='PASS';
  const revoked=await t.sql('select revoked_at is not null revoked,endpoint is null and p256dh is null and auth_key is null scrubbed from public.request_push_subscriptions where id='+t.quote(binding.subscription_id));assert(revoked[0].revoked&&revoked[0].scrubbed);
  const link=new URL('SutiApp.html',target.replace(/\/$/,'')+'/');link.hash='/historial?request='+payload.request_id;
  await page.goto(link.href,{waitUntil:'domcontentloaded'});await page.getByText('La solicitud no está disponible en tu historial.',{exact:true}).waitFor({timeout:30000});proof.deepLinkAuthorityGuard='PASS';
  assert.equal(proof.businessWrites,0);assert.deepEqual(proof.errors,[]);proof.status='PASS';
 }catch(e){proof.error=e.message;if(page){proof.deviceUi=await page.locator('[data-request-push]').textContent().catch(()=>null);proof.deviceError=await page.evaluate(()=>RequestPush.state().then(()=>null).catch(e=>e.message)).catch(()=>null);}throw e;}finally{
  if(page)await page.evaluate(async()=>{try{if(window.RequestPush)await RequestPush.clearDevice();}finally{if(window.SutiSupabase)await SutiSupabase.getClient().auth.signOut({scope:'local'});}}).catch(()=>{});
  t.proof((target.includes('localhost')?'live-local-':'live-production-')+engine,proof);await browser.close();
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
