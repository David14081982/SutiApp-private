'use strict';
// Isolated transport/Auth only. Real focal modules and UI, all network blocked.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const read=f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8'),out=path.resolve(__dirname,'../docs/qa/evidence/history-debt');
const css=[...read('SutiApp.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{for(const width of [390,320,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
  await page.setContent('<style>'+css+'body{margin:0;display:block}#root{position:relative;height:1000px;max-width:480px;margin:auto;overflow:auto;background:var(--bg)}</style><div id="root"></div>');
  for(const name of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read('app/vendor/'+name)});
  for(const name of ['icons.jsx','ui.jsx'])await page.addScriptTag({content:read('app/'+name)});
  await page.evaluate(()=>{
   const h=React.createElement;
   window.TopBar=()=>h('header',{style:{background:'#910022',color:'white',padding:20}},h('h1',{style:{margin:0,fontSize:24}},'Mi Historial'),h('p',null,'Seguimiento de solicitudes'));
   window.RequestAuthorizationNotice=()=>null;window.FarmaHistory=()=>null;window.identity='A';window.authListeners=[];window.calls=0;window.publicationVersion=0;window.failSource=false;window.delayed=[];window.delaySource=true;
   window.AffiliateAuth={getState:()=>identity?{phase:'authenticated',session:{user:{id:identity},access_token:'h.'+btoa(JSON.stringify({sub:identity,session_id:'session-'+identity,role:'authenticated',aal:'aal1'}))+'.s'},affiliate:{id:identity,numero_control:identity==='A'?'0007':'0008'}}:{phase:'anonymous'},subscribe:fn=>{authListeners.push(fn);return()=>{};}};
   window.AdminRepository={getState:()=>({phase:'ready'}),subscribe:()=>()=>{}};
   let sourceRow=2;
   function date(offset){const base=2026*12+10,m=base+Math.floor((offset+1)/2),year=Math.floor(m/12),month=m%12;
    const day=offset%2===0?new Date(Date.UTC(year,month+1,0)).getUTCDate():15;return year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
   function loan(id,fund,quota,count,remaining){
    const schedule=Array.from({length:count},(_,i)=>({source_row:sourceRow++,number:i+1,date:date(i-(count-remaining)),amount:quota,scheduled:quota}));
    return {kind:'loan',key:'loan:'+id,id,fund,principal:quota*count,total:quota*count,term:count,category:'En pago',status:'AL CORRIENTE',date:schedule[0].date,schedule};
   }
   window.payload={version:1,server_now:'2026-11-25T19:00:00Z',business_day:'2026-11-25',sync_state:{status:'READY'},source_updated_at:'2026-11-25T19:00:00Z',sync_version:'test',covered_request_ids:[],financial_request_ids:[],entries:[
    loan('2941','Suti Préstamo',1230,36,15),loan('2942','Préstamo de emergencia',800,12,6),loan('2943','Crédito Marketplace',450,12,7)]};
   window.original=JSON.parse(JSON.stringify(payload));
   window.SutiSupabase={getClient:()=>({channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;},removeChannel:async()=>{},from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==='loan_history_publication'?{version:String(publicationVersion)}:null})})})}),functions:{invoke:async(name,args)=>{calls++;if(name!=='loan-history'||JSON.stringify(args.body)!=='{"action":"LOAD"}')throw Error('FORGED_TARGET');
    const value={...(identity==='A'?JSON.parse(JSON.stringify(payload)):{...payload,entries:[]}),sync_version:String(publicationVersion)};
    if(delaySource)return new Promise(resolve=>delayed.push(()=>resolve({data:value})));
    return failSource?{error:true}:{data:value};}}})};
   window.useOperationsStore=()=>({all:()=>[],state:()=>({phase:'loaded'}),retry:()=>{}});
   window.ui=ReactDOM.createRoot(document.getElementById('root'));window.app={back:()=>draw(),push:(route,params)=>ui.render(h(TrackingScreen,{app,params})),setTab:()=>{}};window.draw=()=>ui.render(h(HistorialScreen,{app}));
  });
  for(const name of ['private-resource-demand.js','history-loans-repository.js','history-loans.jsx','screens-historial.jsx'])await page.addScriptTag({content:read('app/'+name)});
  await page.evaluate(()=>draw());await page.locator('[data-debt-state=loading]').waitFor();assert.equal(await page.locator('[data-debt-total]').innerText(),'Consultando…');
  await page.evaluate(()=>{delaySource=false;delayed.splice(0).forEach(f=>f());});await page.locator('[data-debt-state=ready]').waitFor();
  const card=page.locator('.su-debt-card');assert.equal(await card.locator('[data-debt-total]').innerText(),'$26,400');assert.equal(await card.locator('[data-debt-count]').innerText(),'3 préstamos');
  assert.match(await card.locator('[data-debt-next]').innerText(),/\$2,480.*30 nov/);assert.equal(await card.locator('details[open]').count(),0);
  assert.equal(await page.locator('.su-history-entry').count(),3);assert.equal(await page.evaluate(()=>calls),1);
  await card.screenshot({path:path.join(out,'card-closed-'+width+'.png')});
  await card.locator('summary').click();await card.locator('[data-debt-loan]').nth(2).waitFor();
  assert.deepEqual(await card.locator('[data-debt-balance]').allTextContents(),['$18,450','$4,800','$3,150']);
  assert.match(await card.locator('[data-debt-loan="2941"]').innerText(),/15 de 36 pagos restantes · \$1,230\/qna/);
  assert.match(await card.locator('summary').innerText(),/Ocultar desglose/);
  const segments=await card.locator('[data-debt-bar] > div').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().width));assert(Math.abs(segments[0]/segments[1]-18450/4800)<.02);
  await card.screenshot({path:path.join(out,'card-open-'+width+'.png')});
  assert(await page.evaluate(()=>document.querySelector('#root').scrollWidth<=document.querySelector('#root').clientWidth+1));
  await card.locator('summary').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('.su-debt-card details').open);
  await page.keyboard.press('Space');await card.locator('[data-debt-loan]').nth(2).waitFor();
  for(const label of ['En proceso','Aprobadas','En pago','Liquidadas','No aprobadas','Todas']){
   await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await card.locator('[data-debt-total]').innerText(),'$26,400');
  }
  assert.equal(await page.evaluate(()=>calls),1,'accordion and filters add no reads');
  await page.locator('.su-history-entry').first().click();await page.locator('[data-loan-history-detail]').waitFor();assert.equal(await page.evaluate(()=>calls),1);
  await page.getByRole('button',{name:'Volver al historial'}).click();await card.waitFor();assert.equal(await card.locator('details[open]').count(),0);
  await page.evaluate(()=>{payload.entries[0].total+=.37;publicationVersion++;window.dispatchEvent(new Event('suti:history-snapshot-changed'));});await page.waitForFunction(()=>document.querySelector('[data-debt-total]').textContent==='$26,400.37');
  await page.evaluate(()=>{payload.entries[1].total=null;publicationVersion++;window.dispatchEvent(new Event('suti:history-snapshot-changed'));});await page.locator('[data-debt-state=review]').waitFor();assert.equal(await card.locator('[data-debt-total]').innerText(),'Saldo por revisar');assert.equal(await card.locator('[data-debt-bar]').count(),0);
  await card.locator('summary').click();await card.getByText('Por revisar',{exact:true}).waitFor();
  await page.evaluate(()=>{failSource=true;publicationVersion++;window.dispatchEvent(new Event('suti:history-snapshot-changed'));});await page.locator('[data-debt-state=error]').waitFor();assert.equal(await card.locator('[data-debt-total]').innerText(),'No disponible');assert.equal(await card.locator('[data-debt-loan]').count(),0);
  await page.evaluate(()=>{failSource=false;payload=JSON.parse(JSON.stringify(original));});await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.locator('[data-debt-state=ready]').waitFor();
  // A delayed observation must never populate B's card.
  await page.evaluate(()=>{delaySource=true;publicationVersion++;window.dispatchEvent(new Event('suti:history-snapshot-changed'));});await page.locator('[data-debt-state=refreshing]').waitFor();
  await page.evaluate(()=>{identity='B';delaySource=false;authListeners.forEach(f=>f());});await page.waitForFunction(()=>document.querySelector('[data-debt-total]').textContent==='$0');
  await page.evaluate(()=>delayed.splice(0).forEach(f=>f()));assert.equal(await card.locator('[data-debt-total]').innerText(),'$0');assert.equal(await card.locator('details').count(),0);
  assert.equal(await card.locator('[data-debt-next]').innerText(),'Sin pagos pendientes');
  await page.evaluate(()=>{identity='';authListeners.forEach(f=>f());});await page.waitForFunction(()=>document.querySelector('[data-debt-total]').textContent==='Consultando…');
  await page.emulateMedia({reducedMotion:'reduce'});assert.deepEqual(errors,[]);
  checks.push({width,total:26400,nextPayment:2480,threeDistinctIds:true,proportionalBar:true,accordionPointerAndKeyboard:true,filtersIndependent:true,noAdditionalReads:true,detailPreserved:true,loadingErrorEmptyUnknown:true,identityRace:true,logoutClears:true,noOverflow:true});await page.close();
 }}finally{await browser.close();}
 const proof={status:'PASS',checks,network:'BLOCKED',productionWrites:0,scope:'Real focal modules, isolated source/Auth/header harness'};fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
