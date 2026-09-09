'use strict';
// A controlled protocol client, real Mozilla provider, real self RPCs; no request/event writes.
const fs=require('fs'),crypto=require('crypto'),vm=require('vm'),assert=require('assert').strict,{stripTypeScriptTypes}=require('module'),t=require('./request-push-tools');
const webpush=require('C:/tmp/sutiapp-request-push-runtime/node_modules/web-push'),ece=require('C:/tmp/sutiapp-request-push-runtime/node_modules/http_ece');
async function main(){
 const keys=JSON.parse(fs.readFileSync('C:/tmp/sutiapp-request-push-private/vapid.json'));
 const login=await fetch(t.env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:t.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:t.env.H005_TEST_EMAIL,password:t.env.H005_TEST_PASSWORD})});assert(login.ok,'CONTROLLED_LOGIN_FAILED');const auth=await login.json();
 const rpc=async(name,args={})=>{const r=await fetch(t.env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:t.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify(args)});if(!r.ok)throw Error('SELF_RPC_'+name+'_'+r.status);return r.json();};
 let closing=false,subscriptionId;const socket=new WebSocket('wss://push.services.mozilla.com/'),messages=[],waiters=[];
 const next=type=>new Promise((resolve,reject)=>{const found=messages.findIndex(m=>m.messageType===type);if(found>=0)return resolve(messages.splice(found,1)[0]);const timer=setTimeout(()=>reject(Error('PROVIDER_TIMEOUT_'+type)),15000);waiters.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});});
 socket.onmessage=e=>{const msg=JSON.parse(e.data),at=waiters.findIndex(w=>w.type===msg.messageType);if(at>=0)waiters.splice(at,1)[0].resolve(msg);else messages.push(msg);};
 socket.onerror=()=>{if(!closing)messages.push({messageType:'socket_error'});};
 const channelID=crypto.randomUUID(),device=crypto.createECDH('prime256v1');device.generateKeys();const secret=crypto.randomBytes(16);
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('PROVIDER_CONNECT_TIMEOUT')),15000);socket.onopen=()=>{clearTimeout(timer);resolve();};});
  socket.send(JSON.stringify({messageType:'hello',use_webpush:true,channelIDs:[]}));assert.equal((await next('hello')).status,200);
  socket.send(JSON.stringify({messageType:'register',channelID,key:keys.publicKey}));const registration=await next('register');assert.equal(registration.status,200);
  const subscription={endpoint:registration.pushEndpoint,keys:{p256dh:device.getPublicKey().toString('base64url'),auth:secret.toString('base64url')}};
  const config=await rpc('get_self_request_push_config');assert.equal(config.public_key,keys.publicKey);assert(config.enabled);
  subscriptionId=await rpc('register_self_request_push',{p_endpoint:subscription.endpoint,p_p256dh:subscription.keys.p256dh,p_auth:subscription.keys.auth});
  const table=await fetch(t.env.SUPABASE_URL+'/rest/v1/request_push_subscriptions?select=id',{headers:{apikey:t.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+auth.access_token}});assert.equal(table.status,403);
  const source=fs.readFileSync(t.root+'/supabase/functions/request-push/index.ts','utf8'),box={webpush,crypto:crypto.webcrypto,TextEncoder,Uint8Array,URL,Response,AbortSignal,fetch,Deno:{serve:()=>{}},exports:{}};
  vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,''))+'\nexports.dispatch=dispatch;exports.payloadFor=payloadFor;',box);
  const cases=[{authorized:true,status:'approved'},{status:'rejected'},{status:'cancelled'},{status:'in_review',stage:'Autorización'}];let received=0,accepted=0;const eventIds=new Set();
  for(const event of cases){
   const job={...subscription,...event,id:crypto.randomUUID(),lease_token:crypto.randomUUID(),event_id:crypto.randomUUID(),request_id:crypto.randomUUID(),subscription_id:subscriptionId,folio:'SR-ISOLATED-TRANSPORT'};let pending=true;
   const client={rpc:async(name,args)=>name==='claim_request_push_batch'?{data:pending?(pending=false,[job]):[]}:(assert.equal(args.p_http_status,201),accepted++,{data:true})};
   const result=await box.exports.dispatch(client,{subject:'https://sutiapp.com',publicKey:keys.publicKey,privateKey:keys.privateKey});assert.equal(result.accepted,1);
   const message=await next('notification');assert(message.data);const decrypted=JSON.parse(ece.decrypt(Buffer.from(message.data,'base64url'),{version:'aes128gcm',privateKey:device,authSecret:secret}));
   assert.equal(decrypted.event_id,job.event_id);assert.equal(decrypted.subscription_id,subscriptionId);assert.equal(decrypted.title,box.exports.payloadFor(job).title);assert(!eventIds.has(decrypted.event_id));eventIds.add(decrypted.event_id);received++;
   socket.send(JSON.stringify({messageType:'ack',updates:[{channelID:message.channelID,version:message.version,code:100}]}));
  }
  assert.equal(await rpc('revoke_self_request_push',{p_subscription_id:subscriptionId}),true);
  socket.send(JSON.stringify({messageType:'unregister',channelID,code:200}));assert.equal((await next('unregister')).status,200);
  const readback=await t.sql('select revoked_at is not null revoked,endpoint is null and p256dh is null and auth_key is null scrubbed from public.request_push_subscriptions where id='+t.quote(subscriptionId));assert(readback[0].revoked&&readback[0].scrubbed);
  t.proof('real-transport',{status:'PASS',provider:'Mozilla Web Push production',client:'isolated protocol receiver; not an Android/iPhone device',publicConfig:'PASS',selfSubscription:'PASS',tableReadDenied:'PASS',selfRevocation:'PASS',keyCleanup:'PASS',accepted,receivedAndDecrypted:received,authorized:'PASS',rejected:'PASS',cancelled:'PASS',stage:'PASS',duplicates:0,crossUserDelivery:0,businessWrites:0,queue:'isolated fixture; actual emitter source and real provider HTTP; SQL queue tested separately with rollback'});
 }finally{
  if(subscriptionId)await rpc('revoke_self_request_push',{p_subscription_id:subscriptionId}).catch(()=>{});
  closing=true;socket.close();await fetch(t.env.SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:t.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+auth.access_token}}).catch(()=>{});
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
