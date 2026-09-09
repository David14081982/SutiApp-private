'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const base=new URL(process.argv[2]||'http://localhost:8080/'),root=path.resolve(__dirname,'..');
async function main(){
 const workerResponse=await fetch(new URL('sw.js?badge=181',base));assert.equal(workerResponse.status,200);
 const source=await workerResponse.text();assert(source.includes("sutiapp-v181"));
 const badgeResponse=await fetch(new URL('icon-notification-badge.png',base));assert.equal(badgeResponse.status,200);
 assert.match(badgeResponse.headers.get('content-type'),/image\/png/);
 const badgeBytes=Buffer.from(await badgeResponse.arrayBuffer());
 assert(badgeBytes.equals(fs.readFileSync(root+'/icon-notification-badge.png')),'Published badge differs from approved asset');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage();await page.goto(new URL('icon-notification-badge.png',base).href);
  const result=await page.evaluate(async({source,scope})=>{
   const img=document.images[0];await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
   const context=canvas.getContext('2d');context.drawImage(img,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
   let transparent=0,visible=0;const corners=[0,canvas.width-1,(canvas.height-1)*canvas.width,canvas.width*canvas.height-1].map(i=>pixels[i*4+3]);
   for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;else visible++;}
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('sutiapp-request-push-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('device');r.result.createObjectStore('events');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const subscription='22222222-2222-4222-8222-222222222222';
   await new Promise((resolve,reject)=>{const tx=db.transaction('device','readwrite');tx.objectStore('device').put({subscription_id:subscription},'binding');tx.oncomplete=resolve;tx.onerror=reject;});db.close();
   const handlers={},shown=[],opened=[];
   new Function('self',source)({addEventListener:(n,f)=>handlers[n]=f,registration:{scope,showNotification:async(title,options)=>shown.push({title,...options})},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}});
   const emit=async(name,data)=>{let task;handlers[name]({...data,waitUntil:p=>task=p});await task;};
   const payload={v:1,event_id:'33333333-3333-4333-8333-333333333333',request_id:'44444444-4444-4444-8444-444444444444',subscription_id:subscription,title:'Prueba aislada',body:'Sin envio a dispositivos'};
   await Promise.all([emit('push',{data:{json:()=>payload}}),emit('push',{data:{json:()=>payload}})]);
   await emit('notificationclick',{notification:{...shown[0],close:()=>{}}});
   return{width:canvas.width,height:canvas.height,transparent,visible,corners,shown,opened};
  },{source,scope:base.href});
  assert(result.width>=72&&result.height>=72);assert(result.transparent>result.width*result.height*.5);assert(result.visible>result.width*result.height*.2);assert.deepEqual(result.corners,[0,0,0,0]);
  assert.equal(result.shown.length,1);assert.equal(result.shown[0].badge,new URL('icon-notification-badge.png',base).href);assert.equal(result.shown[0].icon,new URL('icon-192.png',base).href);assert.match(result.opened[0],/#\/historial\?request=44444444/);
  const proof={status:'PASS',target:base.href,serviceWorker:181,assetSha256:crypto.createHash('sha256').update(badgeBytes).digest('hex'),image:{width:result.width,height:result.height,transparentPixels:result.transparent,visiblePixels:result.visible,cornerAlpha:result.corners},badge:'dedicated transparent owner-supplied fist',colorIcon:'unchanged icon-192.png',duplicateNotifications:0,notificationclick:'PASS',method:'actual SW handler in isolated browser contract; real fetched asset decoded in canvas; no production business writes or device messages',physicalAndroidAppearance:'NOT EXECUTED by this automated test'};
  const out=path.join(root,'docs/qa/evidence/request-push-badge-20260908');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,base.hostname==='localhost'?'badge-local.json':'badge-production.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
