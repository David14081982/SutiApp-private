'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict'),{stripTypeScriptTypes}=require('module');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core'),webpush=require('C:/tmp/sutiapp-request-push-runtime/node_modules/web-push');
const root=path.resolve(__dirname,'..');
async function main(){
 const source=fs.readFileSync(path.join(root,'supabase/functions/request-push/index.ts'),'utf8'),box={webpush,crypto:crypto.webcrypto,TextEncoder,Uint8Array,URL,Response,AbortSignal,fetch,Deno:{serve:()=>{}}};
 vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,''))+'\nthis.api={payloadFor,dispatch};',box);
 const device=crypto.createECDH('prime256v1');device.generateKeys();const keys=webpush.generateVAPIDKeys(),job={id:crypto.randomUUID(),event_id:crypto.randomUUID(),request_id:crypto.randomUUID(),subscription_id:crypto.randomUUID(),lease_token:crypto.randomUUID(),kind:'farma',endpoint:'https://fcm.googleapis.com/isolated',keys:{p256dh:device.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}};
 const payload=box.api.payloadFor({...job,product:'PRIVATE MEDICINE',phone:'PRIVATE PHONE'});assert.equal(payload.title,'Nueva solicitud de Suti Farma');assert(!JSON.stringify(payload).includes('PRIVATE'));
 const calls=[];let claimed=false;const client={rpc:async(name,args)=>{calls.push(name);if(name==='claim_farma_push_batch')return{data:claimed?[]:(claimed=true,[job])};assert.equal(name,'finish_farma_push');assert.equal(args.p_http_status,201);return{data:true};}};
 const result=await box.api.dispatch(client,{subject:'https://sutiapp.com',...keys},async(url,init)=>{assert.equal(init.headers['Content-Encoding'],'aes128gcm');assert(!init.body.includes(Buffer.from('Nueva solicitud')));return new Response('',{status:201});},true);assert.equal(result.accepted,1);
 for(const [input,title] of [[{authorized:true},'✅ Solicitud autorizada'],[{status:'rejected'},'Solicitud rechazada'],[{status:'cancelled'},'Solicitud cancelada'],[{status:'in_review'},'Tu solicitud avanzó']])assert.equal(box.api.payloadFor({...job,kind:undefined,...input}).title,title);
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{const page=await browser.newPage();await page.goto('http://127.0.0.1:8769/icon-192.png');const checked=await page.evaluate(async({source,payload})=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('sutiapp-request-push-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('device');r.result.createObjectStore('events');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const bind=id=>new Promise(resolve=>{const tx=db.transaction('device','readwrite');tx.objectStore('device').put({subscription_id:id},'binding');tx.oncomplete=resolve;});await bind(payload.subscription_id);
  const handlers={},shown=[],navigated=[];const fake={registration:{scope:'http://127.0.0.1:8769/',showNotification:async(title,options)=>shown.push({title,...options})},addEventListener:(name,handler)=>handlers[name]=handler,clients:{matchAll:async()=>[{url:'http://127.0.0.1:8769/SutiApp.html',navigate:async url=>navigated.push(url),focus:async()=>{}}]}};
  new Function('self',source)(fake);
  const emit=async(name,event)=>{let wait;handlers[name]({...event,waitUntil:p=>{wait=p;}});await wait;};
  await emit('push',{data:{json:()=>payload}});await emit('push',{data:{json:()=>payload}});
  await emit('notificationclick',{notification:{close(){},data:shown[0].data}});const target=new URL(navigated[0]);
  await bind('different-device');await emit('push',{data:{json:()=>({...payload,event_id:crypto.randomUUID()})}});
  db.close();return {shown:shown.length,route:target.hash,request:target.searchParams.get('farma_request'),privacyGuard:shown.length===1};
 },{source:fs.readFileSync(path.join(root,'sw.js'),'utf8'),payload});assert.equal(checked.shown,1);assert.equal(checked.route,'#/admin/farma');assert.equal(checked.request,job.request_id);assert(checked.privacyGuard);
 const proof={status:'PASS',encryptedFarmaTransport:true,privateContentExcluded:true,existingRequestPayloadsPreserved:true,workerDuplicateSuppression:true,workerIdentityBinding:true,deepLinkToRequest:true,externalNotificationsSent:0};fs.writeFileSync(path.join(root,'docs/qa/evidence/sutifarma-20260928/push-tests.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
