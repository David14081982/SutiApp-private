'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<div style="transform:translateZ(0);overflow:hidden;height:10px"><div id="one"></div><div id="two"></div></div><div id="screen"></div>');
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(file)});
  await page.addStyleTag({content:read('app/text-size.css')});
  await page.evaluate(()=>{
   window.__seen=new Set();window.__calls=[];window.__context='a';window.__listeners=new Set();window.__push=[];window.__fail=false;
   window.PrivateResourceDemand={context:()=>__context,subscribe:fn=>{__listeners.add(fn);return()=>__listeners.delete(fn);}};
   window.__events=[{id:'approved',request_id:'r1',folio:'SR-QA-1',status:'approved',authorized:true,stage:'Autorización',created_at:'2026-09-08T10:00:00Z'}, {id:'reject',request_id:'r2',folio:'SR-QA-2',status:'rejected',authorized:false,created_at:'2026-09-08T10:00:00Z'}, {id:'cancel',request_id:'r3',folio:'SR-QA-3',status:'cancelled',authorized:false,created_at:'2026-09-08T10:00:00Z'}, {id:'advance',request_id:'r4',folio:'SR-QA-4',status:'in_review',stage:'Documentos',created_at:'2026-09-08T10:00:00Z'}];
   window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{
    __calls.push({name,args});await new Promise(resolve=>setTimeout(resolve,30));
    if(__fail)return{error:Error('OFFLINE')};
    if(name==='list_self_request_event_notifications')return{data:__events.map(row=>({...row,seen_at:__seen.has(row.id)?'2026-09-08':null}))};
    const claimed=!__seen.has(args.p_event_id);__seen.add(args.p_event_id);return{data:claimed};
   }})};
   window.__app={push:(...args)=>__push.push(args),toast:()=>{}};window.__requests=[{sourceId:'r1',requestStatus:'approved',tipo:'Programa de prueba',steps:[{active:true,label:'Autorización'}]}];
   window.Icon=()=>null;window.RequestPushInvitation=()=>null;window.useQuoteStore=()=>({state:()=>({phase:'loaded'}),mine:()=>[],retry:()=>{}});
  });
  const notificationSource=process.env.SUTIAPP_TEST_BUNDLE
   ? fs.readFileSync(process.env.SUTIAPP_TEST_BUNDLE,'utf8').split('/* @@file request-notifications.js */')[1].split('/* @@file ')[0]
   : read('app/request-notifications.js');
  await page.addScriptTag({content:notificationSource});
  await page.evaluate(()=>{
   window.__roots=['one','two'].map(id=>ReactDOM.createRoot(document.getElementById(id)));
   __roots.forEach(root=>root.render(React.createElement(RequestAuthorizationNotice,{app:__app,requests:__requests})));
  });
  await page.locator('[data-user-authorization]').waitFor();await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-user-authorization]').count(),1,'atomic claim across concurrent consumers');
  assert.equal(await page.evaluate(()=>__seen.size),1);
  await page.getByRole('button',{name:'Entendido'}).click();
  await page.evaluate(()=>{__roots.forEach(root=>root.unmount());__roots=['one','two'].map(id=>ReactDOM.createRoot(document.getElementById(id)));__roots.forEach(root=>root.render(React.createElement(RequestAuthorizationNotice,{app:__app,requests:__requests})));});
  await page.waitForTimeout(250);assert.equal(await page.locator('[data-user-authorization]').count(),0,'no repeated celebration on reopening');
  // Reuse isolated events; never create or authorize a production request.
  await page.evaluate(()=>{
   __roots.forEach(root=>root.unmount());__roots=[ReactDOM.createRoot(document.getElementById('one'))];
   __events.push({id:'approved-2',request_id:'r5',folio:'SR-QA-5',status:'approved',authorized:true},
    {id:'approved-3',request_id:'r6',folio:'SR-QA-6',status:'approved',authorized:true});
   __requests.push({sourceId:'r5',requestStatus:'approved',tipo:'Membresía de prueba',steps:[]},
    {sourceId:'r6',requestStatus:'approved',tipo:'Producto de prueba',steps:[{active:true,label:'Entrega'}]});
   __roots[0].render(React.createElement(RequestAuthorizationNotice,{app:__app,requests:__requests}));
  });
  await page.locator('[data-user-authorization="approved-2"]').waitFor();
  await page.waitForTimeout(800);
  assert.equal(await page.getByRole('dialog').count(),1);
  assert.equal(await page.getByRole('heading',{name:'¡Tu solicitud fue autorizada!',exact:true}).count(),1);
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Ver seguimiento');
  assert.equal(await page.evaluate(()=>__seen.has('approved-3')),false,'do not consume queued events');
  assert((await page.getByRole('dialog').textContent()).includes('Membresía de prueba'));
  assert((await page.getByRole('dialog').textContent()).includes('SR-QA-5'));
  assert.equal(await page.locator('[data-approved-confetti="two-jets"]').count(),1);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Entendido');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Ver seguimiento');
  for(const width of [320,360,375,390,412,430,1280])for(const size of ['normal','large','largest']){
   await page.setViewportSize({width,height:width===1280?800:640});
   await page.locator('[data-user-authorization]').evaluate((el,size)=>el.setAttribute('data-text-size',size),size);
   const geometry=await page.getByRole('dialog').evaluate(el=>{
    const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth>el.clientWidth+1};
   });
   assert(geometry.left>=0&&geometry.right<=width&&geometry.top>=0&&geometry.bottom<=640+(width===1280?160:0),JSON.stringify({width,size,geometry}));
   assert.equal(geometry.overflow,false,`horizontal overflow ${width}/${size}`);
   for(const button of await page.getByRole('dialog').getByRole('button').all()){
    await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert(box.height>=44&&box.x>=0&&box.x+box.width<=width);
   }
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-user-authorization]').evaluate(el=>el.setAttribute('data-text-size','normal'));
  await page.getByRole('dialog').evaluate(el=>el.scrollTop=0);
  if(process.env.SUTIAPP_TEST_EVIDENCE_DIR){fs.mkdirSync(process.env.SUTIAPP_TEST_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SUTIAPP_TEST_EVIDENCE_DIR,'celebration-mobile.png')});}
  await page.waitForTimeout(4700);
  assert.equal(await page.locator('canvas').count(),0,'canvas removed after finite celebration');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'Entendido'}).click();
  await page.locator('[data-user-authorization="approved-3"]').waitFor();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('canvas').count(),0,'reduced motion: no confetti');
  assert((await page.getByRole('dialog').textContent()).includes('Etapa actual: Entrega'));
  assert.equal(await page.locator('.suti-au-badge path').evaluate(el=>getComputedStyle(el).strokeDashoffset),'0px');
  await page.getByRole('button',{name:'Ver seguimiento'}).click();
  assert.deepEqual(await page.evaluate(()=>__push.pop()),['tracking',{s:{sourceId:'r6'}}]);
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-user-authorization]').count(),0,'rejection/cancellation/intermediate stage never celebrate');
  await page.evaluate(()=>{
   const route=document.createElement('div');route.dataset.appRoute='tracking';document.body.appendChild(route);
   __events.push({id:'approved-4',request_id:'r7',folio:'SR-QA-7',status:'approved',authorized:true});
   __requests.push({sourceId:'r7',requestStatus:'approved',tipo:'Viaje de prueba',steps:[]});
   __app={...__app};__roots[0].render(React.createElement(RequestAuthorizationNotice,{app:__app,requests:__requests}));
   window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>__seen.has('approved-4')),false,'tracking must not consume the next event');
  await page.evaluate(()=>{document.querySelector('[data-app-route]').remove();__app={...__app};__roots[0].render(React.createElement(RequestAuthorizationNotice,{app:__app,requests:__requests}));});
  await page.locator('[data-user-authorization="approved-4"]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-user-authorization]').count(),0,'Escape closes the claimed event');
  const app=read('app/app.jsx'),start=app.indexOf('  function NotifsScreen('),end=app.indexOf('  // ---------- PERFIL',start);
  await page.addScriptTag({content:'const I=window.Icon;'+app.slice(start,end)+'window.__Notifs=NotifsScreen;'});
  await page.evaluate(()=>{window.__screen=ReactDOM.createRoot(document.getElementById('screen'));__screen.render(React.createElement(__Notifs,{app:__app}));});
  await page.locator('[data-notification-id="event_cancel"]').waitFor();
  assert.equal(await page.locator('[data-notification-id]').count(),7);
  await page.locator('[data-notification-id="event_reject"]').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>__push.length===1);
  assert.deepEqual(await page.evaluate(()=>__push[0]),['tracking',{s:{sourceId:'r2'}}]);
  await page.evaluate(()=>{__fail=true;window.dispatchEvent(new Event('focus'));});
  await page.locator('[data-notifications-state="error"]').waitFor();
  assert.equal(await page.locator('[data-notification-id]').count(),0,'visible backend failure, no fallback');
  await page.evaluate(()=>{__context='b';__events=[];__fail=false;__listeners.forEach(fn=>fn());});
  await page.locator('[data-notifications-state="empty"]').waitFor();
  assert.equal(await page.locator('[data-user-authorization]').count(),0,'no notice across identity changes');
  await page.evaluate(()=>{
   __roots.forEach(root=>root.unmount());
   window.__historyRows=[{id:'history-1',folio:'SR-HISTORY-1',program_id:'prestamo',status:'in_review',created_at:'2026-09-01T12:00:00Z',requested_amount:1000,requested_term:2,requested_term_semantics:'quincenas',workflow_state:{available:true,stages:[{id:'received',label:'Recibida',state:'done',date:'2026-09-01T12:00:00Z'},{id:'review',label:'Revisión de documentos',state:'current',date:'2026-09-02T15:30:00Z'},{id:'authorized',label:'Autorización',state:'upcoming'}]}}];
   window.ProgramRequestRepository={listHistory:async()=>structuredClone(__historyRows)};
   const client=SutiSupabase.getClient();client.channel=()=>{const channel={on:()=>channel,subscribe:fn=>{fn('SUBSCRIBED');return channel;}};return channel;};client.removeChannel=()=>{};SutiSupabase.getClient=()=>client;
   window.TopBar=()=>React.createElement('header',null,'Mi Historial');__app.back=()=>{};
  });
  for(const file of ['app/ui.jsx','app/operations-store.jsx','app/screens-historial.jsx'])await page.addScriptTag({content:read(file)});
  await page.evaluate(()=>__screen.render(React.createElement(HistorialScreen,{app:__app})));
  await page.getByText('Etapa: Revisión de documentos',{exact:false}).waitFor();
  await page.evaluate(()=>{
   const row=__historyRows[0];row.status='approved';row.workflow_state.stages[1].state='done';row.workflow_state.stages[2].state='current';row.workflow_state.stages[2].date='2026-09-08T16:45:00Z';window.dispatchEvent(new Event('suti:request-changed'));
  });
  await page.getByText('Etapa: Autorización',{exact:false}).waitFor();
  await page.getByText('Aprobada',{exact:true}).waitFor();
  await page.evaluate(()=>__screen.render(React.createElement(TrackingScreen,{app:__app,params:{s:{sourceId:'history-1'}}})));
  await page.getByText('EN CURSO',{exact:true}).waitFor();
  for(const date of ['2026-09-01T12:00:00Z','2026-09-02T15:30:00Z','2026-09-08T16:45:00Z']){
   const rendered=await page.evaluate(date=>new Date(date).toLocaleString('es-MX'),date);
   assert((await page.locator('#screen').textContent()).includes(rendered),'authoritative transition timestamp missing');
  }
  assert.deepEqual(errors,[]);
  const proof={status:'PASS',concurrentClaim:'PASS',reopenOnce:'PASS',queue:'PASS',trackingReturn:'PASS',escape:'PASS',responsive:'21 combinations PASS',reducedMotion:'PASS',canvasCleanup:'PASS',focusTrap:'PASS',requestDeepLink:'PASS',notificationTypes:7,keyboardDeepLink:'PASS',error:'PASS',contextIsolation:'PASS',historyRefresh:'PASS',timelineDates:'PASS',backend:'ISOLATED_FIXTURE',errors};
  const evidence=process.env.SUTIAPP_TEST_EVIDENCE_DIR||require('os').tmpdir();fs.mkdirSync(evidence,{recursive:true});
  fs.writeFileSync(path.join(evidence,'notifications-browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
