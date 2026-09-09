'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert').strict,{stripTypeScriptTypes}=require('module');
const webpush=require('C:/tmp/sutiapp-request-push-runtime/node_modules/web-push');
const root=path.resolve(__dirname,'..');
async function main(){
 const source=fs.readFileSync(root+'/supabase/functions/request-push/index.ts','utf8');
 const js=stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,''));
 const sandbox={webpush,crypto:crypto.webcrypto,TextEncoder,Uint8Array,URL,Response,AbortSignal,fetch,Deno:{serve:()=>{}},exports:{}};
 vm.runInNewContext(js+'\nexports.payloadFor=payloadFor;exports.dispatch=dispatch;exports.validEndpoint=validEndpoint;',sandbox);
 const {payloadFor,dispatch,validEndpoint}=sandbox.exports;
 const keys=webpush.generateVAPIDKeys(),device=crypto.createECDH('prime256v1');device.generateKeys();
 const base={event_id:'11111111-1111-4111-8111-111111111111',request_id:crypto.randomUUID(),subscription_id:crypto.randomUUID(),folio:'SR-ISOLATED',endpoint:'https://fcm.googleapis.com/test/isolated',keys:{p256dh:device.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')},lease_token:crypto.randomUUID(),id:crypto.randomUUID()};
 const cases=[{authorized:true,status:'approved',title:'✅ Solicitud autorizada'},{status:'rejected',title:'Solicitud rechazada'},{status:'cancelled',title:'Solicitud cancelada'},{status:'in_review',stage:'Autorización',title:'Tu solicitud avanzó'}];
 for(const row of cases){const p=payloadFor({...base,...row});assert.equal(p.title,row.title);assert.equal(p.request_id,base.request_id);assert(!('endpoint' in p));}
 for(const endpoint of ['http://localhost/','https://127.0.0.1/','https://fcm.googleapis.com@evil.test/','https://fcm.googleapis.com.evil.test/','https://fcm.googleapis.com:444/push'])assert.equal(validEndpoint(endpoint),false);
 for(const endpoint of ['https://fcm.googleapis.com/fcm/send/x','https://web.push.apple.com/x','https://updates.push.services.mozilla.com/wpush/v2/x'])assert.equal(validEndpoint(endpoint),true);
 const receipts=[],sends=[];let batch=cases.map((c,i)=>({...base,...c,id:crypto.randomUUID(),event_id:crypto.randomUUID(),lease_token:crypto.randomUUID()}));
 const client={rpc:async(name,args)=>{if(name==='claim_request_push_batch'){const data=batch;batch=[];return{data};}receipts.push(args);return{data:true};}};
 await dispatch(client,{subject:'https://sutiapp.com',...keys},async(url,init)=>{assert.equal(init.redirect,'error');assert(init.headers.Authorization||init.headers.authorization);assert.equal(init.headers['Content-Encoding'],'aes128gcm');assert(Buffer.isBuffer(init.body));assert(!init.body.includes(Buffer.from('SR-ISOLATED')));sends.push(url);return new Response('',{status:201});});
 assert.equal(sends.length,4);assert.equal(receipts.length,4);assert(receipts.every(r=>r.p_http_status===201));
 await dispatch(client,{subject:'https://sutiapp.com',...keys},async()=>{throw Error('DUPLICATE_NETWORK_CALL');});assert.equal(sends.length,4);
 batch=[{...base,id:crypto.randomUUID()}];await dispatch(client,{subject:'https://sutiapp.com',...keys},async()=>{throw Error('NETWORK_TIMEOUT');});assert.equal(receipts.at(-1).p_http_status,0);
 batch=[{...base,id:crypto.randomUUID()}];await dispatch(client,{subject:'https://sutiapp.com',...keys},async()=>new Response('',{status:410}));assert.equal(receipts.at(-1).p_http_status,410);
 const proof={status:'PASS',authorized:'PASS',rejected:'PASS',cancelled:'PASS',stage:'PASS',vapid:'PASS',encryption:'aes128gcm verified on all four payloads',ssrf:'PASS',networkFailure:'PASS',expired:'PASS',duplicates:0,environment:'isolated queue and HTTP transport; actual backend module'};
 fs.writeFileSync(root+'/docs/qa/evidence/request-push-20260908/emitter.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
