'use strict';
// Owner-assisted real Android PWA verification. Private context is never committed.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert').strict,t=require('./request-push-tools');
const webpush=require('C:/tmp/sutiapp-request-push-runtime/node_modules/web-push');
const contextFile='C:/tmp/sutiapp-request-push-private/android-manual-context.json';
async function main(){
 const context=JSON.parse(fs.readFileSync(contextFile)),mode=process.argv[2]||'inspect';
 if(mode==='inspect'){
  const rows=await t.sql("select s.id,s.endpoint,s.p256dh,s.auth_key,s.auth_user_id,s.affiliate_id,(select r.id from public.program_requests r where r.affiliate_id=s.affiliate_id order by r.created_at desc limit 1) request_id from public.request_push_subscriptions s join public.affiliates a on a.id=s.affiliate_id where a.numero_control="+t.quote(context.numero_control)+" and s.revoked_at is null and s.created_at>="+t.quote(context.since)+"::timestamptz and public.request_push_affiliate(s.auth_user_id)=s.affiliate_id");
  assert.equal(rows.length,1,'Expected exactly one newly opted-in device for the owner-provided control');
  context.subscription=rows[0];context.requestId=rows[0].request_id||crypto.randomUUID();context.events=Array.from({length:4},()=>crypto.randomUUID());fs.writeFileSync(contextFile,JSON.stringify(context));
  t.proof('android-subscription',{status:'PASS',platform:'Moto g82 5G Android PWA, owner assisted',targetDevices:1,authority:'owner-provided numero_control + existing affiliate resolver + own opt-in subscription',crossUserTargets:0,frontEndSecrets:0});return;
 }
 if(mode==='send'){
  assert(context.subscription&&context.events);const sub=context.subscription;
  const current=await t.sql('select revoked_at is null and (expiration_at is null or expiration_at>now()) and auth_user_id='+t.quote(sub.auth_user_id)+'::uuid and affiliate_id='+t.quote(sub.affiliate_id)+'::uuid and public.request_push_affiliate(auth_user_id)=affiliate_id and endpoint='+t.quote(sub.endpoint)+' active from public.request_push_subscriptions where id='+t.quote(sub.id));assert.equal(current.length,1);assert(current[0].active,'The selected device must still belong to the confirmed account and remain active');
  const keys=JSON.parse(fs.readFileSync('C:/tmp/sutiapp-request-push-private/vapid.json'));
  const cases=[['✅ Prueba: solicitud autorizada','Aviso técnico de autorización. Tu solicitud no cambia.'],['Prueba: solicitud rechazada','Aviso técnico de rechazo. Tu solicitud no cambia.'],['Prueba: solicitud cancelada','Aviso técnico de cancelación. Tu solicitud no cambia.'],['Prueba: tu solicitud avanzó','Aviso técnico de cambio de etapa. Tu solicitud no cambia.']];
  const results=[];
  // Repeat one event_id deliberately; the device must show four distinct notices, not five.
  for(const i of [0,1,2,3,0]){
   const payload={v:1,event_id:context.events[i],request_id:context.requestId,subscription_id:sub.id,title:cases[i][0],body:cases[i][1]};
   const result=await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},JSON.stringify(payload),{vapidDetails:{subject:'https://sutiapp.com',publicKey:keys.publicKey,privateKey:keys.privateKey},TTL:300,topic:context.events[i].replace(/-/g,''),timeout:15000});
   assert.equal(result.statusCode,201);results.push(result.statusCode);
  }
  t.proof('android-send',{status:'PASS',provider:'real Web Push',acceptedAttempts:results.length,uniqueEvents:4,duplicateAttempt:1,expectedDistinctNotifications:4,targetDevices:1,crossUserTargets:0,financialMutations:0,scope:'explicit technical fixtures to owner-confirmed device; no request/event persisted',deliveryConfirmation:'PENDING OWNER DEVICE OBSERVATION'});return;
 }
 if(mode==='verify-revoked'){
  const rows=await t.sql('select revoked_at is not null revoked,endpoint is null and p256dh is null and auth_key is null scrubbed from public.request_push_subscriptions where id='+t.quote(context.subscription.id));assert(rows[0].revoked&&rows[0].scrubbed);
  t.proof('android-revocation',{status:'PASS',revoked:true,keysScrubbed:true,financialMutations:0});return;
 }
 throw Error('Unknown mode');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
