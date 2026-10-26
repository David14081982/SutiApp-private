'use strict';
// Real focal modules, synthetic identities/source transport, all network blocked.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),zlib=require('zlib');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const css=[...read('SutiApp.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const flush=async page=>{await page.clock.runFor(40);await page.evaluate(()=>Promise.resolve());};
const count=page=>page.evaluate(()=>({history:historyCalls.length,native:nativeCalls.length}));
async function setup(browser,width){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>{external.push(route.request().url());return route.abort();});
 await page.clock.install({time:new Date('2026-10-26T19:00:00.000Z')});
 await page.setContent('<style>'+css+'body{margin:0;display:block}#root{position:relative;height:900px;max-width:480px;margin:auto;overflow:auto;background:var(--bg)}</style><div id="root"></div>');
 for(const name of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read('app/vendor/'+name)});
 for(const name of ['icons.jsx','ui.jsx'])await page.addScriptTag({content:read('app/'+name)});
 await page.evaluate(()=>{
  const h=React.createElement,clone=value=>JSON.parse(JSON.stringify(value));
  window.money=value=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value);
  window.TopBar=()=>h('header',null,h('h1',null,'Mi Historial'));window.RequestAuthorizationNotice=()=>null;window.FarmaHistory=()=>null;
  window.identity='A';window.control='0007';window.token=1;window.authListeners=[];window.historyCalls=[];window.nativeCalls=[];window.delayed=[];window.delayHistory=true;window.failHistory=false;
  window.AffiliateAuth={getState:()=>identity?{phase:'authenticated',session:{user:{id:identity},access_token:'synthetic-'+identity+'-'+token},affiliate:{id:identity,numero_control:control}}:{phase:'unauthenticated'},subscribe:fn=>{authListeners.push(fn);fn();return()=>{authListeners=authListeners.filter(item=>item!==fn);};}};
  const now=new Date().toISOString(),date=now.slice(0,10);
  const loan=(id,category,status)=>({key:'loan:'+id,id,sourceId:null,kind:'loan',category,status,fund:'Préstamo '+id,principal:5000,total:6000,term:12,date,
   approved_at:category==='Aprobadas'?now:null,expires_at:category==='Aprobadas'?new Date(Date.parse(now)+86400000).toISOString():null,paid_to_date:500,expected_to_date:500,
   schedule:Array.from({length:12},(_,i)=>({source_row:100+i,number:i+1,date:i===0?date:'2099-11-15',amount:500,scheduled:500,state:i===0?'Pagada':'Pendiente'}))});
  window.payload={version:1,server_now:now,business_day:date,covered_request_ids:['pending'],financial_request_ids:['pending'],entries:[loan('1','Aprobadas','AL CORRIENTE'),loan('2','En pago','SALDO ATRASADO'),loan('3','Liquidadas','PAGÓ DE MÁS'),
   {key:'request:SR-PENDING',id:'SR-PENDING',sourceId:'pending',kind:'request',category:'En proceso',status:'Pendiente',fund:'Solicitud pendiente',principal:3000,total:3600,term:6,date,approved_at:null,expires_at:null,schedule:[]},
   {key:'request:SR-REJECTED',id:'SR-REJECTED',sourceId:null,kind:'request',category:'No aprobadas',status:'Rechazado',fund:'Solicitud rechazada',principal:3000,total:3600,term:6,date,approved_at:null,expires_at:null,schedule:[]}]};
  window.nativeRows=[{id:'pending',folio:'SR-PENDING',program_id:'prestamo',status:'submitted',financial_processing_status:'pending',created_at:now,requested_amount:3000,requested_term:6,workflow_state:{available:true,stages:[{id:'one',label:'Solicitud enviada',state:'done'},{id:'two',label:'Revisión',state:'current'}]}},
   {id:'quote',folio:'COT-TEST',program_id:'convenio',request_type:'quote',status:'submitted',productoNombre:'Cotización nativa',created_at:now,workflow_state:{available:true,stages:[]}}];
  window.makePayload=()=>({...clone(payload),server_now:new Date().toISOString(),...(identity==='A'&&control==='0007'?{}:{entries:[loan(identity==='B'?'B':'CONTROL','En pago','AL CORRIENTE')],covered_request_ids:[],financial_request_ids:[]})});
  window.SutiSupabase={getClient:()=>({functions:{invoke:async(name,args)=>{
   if(name!=='loan-history'||JSON.stringify(args.body)!==JSON.stringify({action:'LOAD'}))throw Error('UNEXPECTED_HISTORY_REQUEST');
   const response=failHistory?{error:Error('SYNTHETIC_SOURCE_FAILURE')}:{data:makePayload()};historyCalls.push({action:args.body.action,identity,control});
   if(delayHistory)return new Promise(resolve=>delayed.push({resolve,response}));return response;
  }},channel:()=>{throw Error('UNEXPECTED_REALTIME');}})};
  window.ProgramRequestRepository={listHistory:async()=>{nativeCalls.push({identity,control});return clone(identity==='A'&&control==='0007'?nativeRows:[]);}};
  window.resolveHistory=()=>delayed.splice(0).forEach(item=>item.resolve(item.response));
  window.authChanged=()=>authListeners.slice().forEach(fn=>fn());
 });
 for(const name of ['admin-repository.js','private-resource-demand.js','operations-store.jsx','history-loans-repository.js','history-loans.jsx','screens-historial.jsx'])await page.addScriptTag({content:read('app/'+name)});
 await page.evaluate(()=>{
  AdminRepository.primeAccessContext({full_access:true,role_code:'admin',technical_permissions:[],section_actions:[]});
  const h=React.createElement;
  window.app={back:()=>setRoute(null),push:(name,params)=>setRoute(params),setTab:()=>setTab('other')};
  function Harness(){const[tab,tabSetter]=React.useState('history'),[route,routeSetter]=React.useState(null);window.setTab=tabSetter;window.setRoute=routeSetter;
   return h(React.Fragment,null,tab==='history'&&h('div',{'data-base':''},h(HistorialScreen,{app})),route&&h('div',{'data-detail':'',style:{position:'absolute',inset:0,zIndex:40}},h(TrackingScreen,{app,params:route})));}
  window.root=ReactDOM.createRoot(document.getElementById('root'));root.render(h(Harness));
 });
 await flush(page);return {page,errors,external};
}
async function main(){
 assert(!/localStorage|sessionStorage|indexedDB|caches\./.test(read('app/history-loans-repository.js')),'no persistent storage API');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];let payloadBytes;
 try{for(const width of [390,320,1440]){
  const {page,errors,external}=await setup(browser,width),base=page.locator('[data-base]');
  assert.deepEqual(await count(page),{history:1,native:1});assert.equal(await base.locator('.su-history-entry').count(),1,'native nonfinancial card remains while Google is pending');
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);assert.equal(await base.locator('.su-history-entry').count(),6);
  const first=await count(page),expected={'Todas':6,'En proceso':2,'Aprobadas':1,'En pago':1,'Liquidadas':1,'No aprobadas':1};
  for(const [label,size]of Object.entries(expected)){await base.getByRole('button',{name:label,exact:true}).click();await flush(page);assert.equal(await base.locator('.su-history-entry').count(),size,label);}
  assert.deepEqual(await count(page),first,'filters do not query');
  await base.getByRole('button',{name:'Liquidadas',exact:true}).click();await flush(page);assert.equal(await base.getByText('Liquidada',{exact:true}).evaluate(el=>getComputedStyle(el).color),'rgb(19, 121, 74)');
  await base.getByRole('button',{name:'Aprobadas',exact:true}).click();await flush(page);const clock=await base.locator('[data-approval-countdown]').innerText();
  await page.clock.fastForward(60000);await flush(page);assert.notEqual(await base.locator('[data-approval-countdown]').innerText(),clock);assert.deepEqual(await count(page),first);
  await base.locator('.su-history-entry').click();await flush(page);assert.equal(await page.locator('[data-detail] [data-installment]').count(),12);assert.deepEqual(await count(page),first,'own amortization adds no API/native call');
  assert.equal(await page.locator('[data-detail] [data-installment=Pagada]').count(),1);assert.equal(await page.locator('[data-detail] [data-installment=Pendiente]').count(),11);
  assert.equal(await page.locator('[data-detail]').getByRole('button',{name:'Contactar a un asesor',exact:true}).count(),1);
  assert(await page.evaluate(()=>document.querySelector('#root').scrollWidth<=document.querySelector('#root').clientWidth+1));
  await page.evaluate(()=>window.dispatchEvent(new Event('suti:request-changed')));await flush(page);const layered=await count(page);assert.equal(layered.history,first.history+1,'mounted history and detail share a single refresh');assert.equal(await page.locator('[data-detail] [data-installment]').count(),12);
  await page.getByRole('button',{name:'Volver al historial',exact:true}).click();await flush(page);assert.deepEqual(await count(page),layered,'back adds no calls');
  const foreign=await page.evaluate(async()=>{const value=await LoanHistory.load('loan:FOREIGN');return {entries:value.entries.length,covered:value.covered_request_ids.length,financial:value.financial_request_ids.length};});assert.deepEqual(foreign,{entries:0,covered:0,financial:0});assert.deepEqual(await count(page),layered);
  const selected=await page.evaluate(async()=>{const value=await LoanHistory.load('loan:1');return {keys:value.entries.map(entry=>entry.key),schedule:value.entries[0].schedule.length,amount:value.entries[0].total};});assert.deepEqual(selected,{keys:['loan:1'],schedule:12,amount:6000});
  await page.evaluate(()=>setTab('other'));await flush(page);await page.evaluate(()=>setTab('history'));await flush(page);assert.equal((await count(page)).history,layered.history,'tab remount reuses authorized memory');
  assert.equal(await base.locator('.su-history-entry').count(),6);
  // TTL never polls. The next detail intention renews the whole owned snapshot once.
  const beforeExpiry=await count(page);await page.clock.fastForward(300001);await flush(page);assert.deepEqual(await count(page),beforeExpiry,'five-minute passage itself performs zero reads');
  await page.evaluate(()=>{delayHistory=true;setRoute({loanKey:'loan:2'});});await flush(page);assert.equal((await count(page)).history,beforeExpiry.history+1);assert.equal(await page.locator('[data-detail] [data-installment]').count(),0,'expired memory is not painted into a new detail');
  assert.equal(await base.locator('.su-history-entry').count(),1,'expired financial rows are cleared across mounted consumers');
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);assert.equal(await page.locator('[data-detail] [data-installment]').count(),12);await page.evaluate(()=>app.back());await flush(page);
  // A mutation burst discards its first response and starts exactly one follow-up.
  const beforeBurst=await count(page);await page.evaluate(()=>{delayHistory=true;payload.entries[1].fund='Dato obsoleto';window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  await page.evaluate(()=>{payload.entries[1].fund='Dato actualizado';for(let i=0;i<3;i++)window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  assert.equal((await count(page)).history,beforeBurst.history+1);await page.evaluate(()=>resolveHistory());await flush(page);
  assert.equal((await count(page)).history,beforeBurst.history+2);assert.equal(await base.getByText('Dato obsoleto',{exact:true}).count(),0);assert.equal(await base.locator('.su-history-entry').count(),1,'stale success cannot repopulate pending replacement');
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);assert.equal(await base.getByText('Dato actualizado',{exact:true}).count(),1);
  // Source failure removes loaded financial data; retry renews only this source.
  await page.evaluate(()=>{failHistory=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);assert.equal(await base.locator('[data-history-source=error]').count(),1);assert.equal(await base.locator('.su-history-entry').count(),1);
  const failed=await count(page);await page.evaluate(()=>setTab('other'));await flush(page);await page.evaluate(()=>setTab('history'));await flush(page);assert.equal((await count(page)).history,failed.history,'remount cannot resurrect a failed snapshot');
  const beforeRetry=await count(page);await page.evaluate(()=>{failHistory=false;});await base.getByRole('button',{name:'Reintentar',exact:true}).click();await flush(page);assert.equal((await count(page)).history,beforeRetry.history+1);assert.equal((await count(page)).native,beforeRetry.native);assert.equal(await base.locator('.su-history-entry').count(),6);
  // Invalidators remain active while the tab is absent, but they perform no read.
  await page.evaluate(()=>setTab('other'));await flush(page);const absent=await count(page);await page.evaluate(()=>{payload.entries[1].fund='Cambio fuera de Historial';window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);assert.deepEqual(await count(page),absent);
  await page.evaluate(()=>setTab('history'));await flush(page);assert.equal((await count(page)).history,absent.history+1);assert.equal(await base.getByText('Cambio fuera de Historial',{exact:true}).count(),1);
  await page.evaluate(()=>setTab('other'));await flush(page);const beforeAbsentIdentity=await count(page);await page.evaluate(()=>{identity='B';control='0009';authChanged();});await flush(page);await page.evaluate(()=>{identity='A';control='0007';authChanged();});await flush(page);assert.deepEqual(await count(page),beforeAbsentIdentity,'unmounted context changes only invalidate');
  await page.evaluate(()=>setTab('history'));await flush(page);assert.equal((await count(page)).history,beforeAbsentIdentity.history+1,'returning to A cannot revive its pre-switch memory');
  // A's delayed payload must not leak into B, even if the prior tab was unmounted.
  await page.evaluate(()=>{delayHistory=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  await page.evaluate(()=>{identity='B';control='0009';delayHistory=false;authChanged();});await flush(page);await page.evaluate(()=>resolveHistory());await flush(page);
  assert.equal(await base.locator('.su-history-entry').count(),1);assert.equal(await base.getByText('Préstamo B',{exact:true}).count(),1);assert.equal(await base.getByText('Cambio fuera de Historial',{exact:true}).count(),0);
  await page.evaluate(()=>{delayHistory=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);await page.evaluate(()=>{identity='';authChanged();resolveHistory();});await flush(page);assert.equal(await base.locator('.su-history-entry').count(),0);
  await page.evaluate(()=>{identity='A';control='0007';delayHistory=false;authChanged();});await flush(page);assert.equal(await base.locator('.su-history-entry').count(),6);
  // Exact control changes invalidate even though the shared epoch is unchanged.
  const beforeControl=await count(page),epoch=await page.evaluate(()=>PrivateResourceDemand.context());
  await page.evaluate(()=>{delayHistory=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  await page.evaluate(()=>{control='0008';delayHistory=false;authChanged();});await flush(page);await page.evaluate(()=>resolveHistory());await flush(page);
  assert.equal(await page.evaluate(()=>PrivateResourceDemand.context()),epoch);assert.equal((await count(page)).history,beforeControl.history+2);assert.equal(await base.getByText('Préstamo CONTROL',{exact:true}).count(),1);assert.equal(await base.getByText('Cambio fuera de Historial',{exact:true}).count(),0,'old control response cannot be shared or restored under corrected control');
  // A -> B -> A under the same shared epoch must start a NEW A transport,
  // even while the first A promise is still retained by the shared coordinator.
  await page.evaluate(()=>{control='0007';authChanged();});await flush(page);
  const beforeCycle=await count(page),cycleEpoch=await page.evaluate(()=>PrivateResourceDemand.context());
  await page.evaluate(()=>{
   window.obsoleteCyclePaint=false;window.cycleObserver=new MutationObserver(()=>{if([...document.querySelectorAll('.su-history-entry')].some(el=>el.textContent.includes('Anterior ABA')))obsoleteCyclePaint=true;});
   cycleObserver.observe(document.querySelector('[data-base]'),{childList:true,subtree:true,characterData:true});
   delayHistory=true;payload.entries[1].fund='Anterior ABA';window.dispatchEvent(new Event('suti:request-changed'));
  });await flush(page);
  await page.evaluate(()=>{control='0008';authChanged();});await flush(page);
  await page.evaluate(()=>{payload.entries[1].fund='Actual ABA';control='0007';authChanged();});await flush(page);
  assert.equal(await page.evaluate(()=>PrivateResourceDemand.context()),cycleEpoch);assert.equal((await count(page)).history,beforeCycle.history+3,'new A intention cannot deduplicate against invalidated A');
  assert.deepEqual(await page.evaluate(()=>historyCalls.slice(-3).map(call=>call.control)),['0007','0008','0007']);
  await page.evaluate(()=>{const oldA=delayed.shift();oldA.resolve(oldA.response);});await flush(page);
  assert.equal(await base.getByText('Anterior ABA',{exact:true}).count(),0);assert.equal(await base.locator('[data-history-source=loading]').count(),1,'obsolete A leaves current A pending');
  await page.evaluate(()=>{const oldB=delayed.shift();oldB.resolve(oldB.response);});await flush(page);
  assert.equal(await base.getByText('Préstamo CONTROL',{exact:true}).count(),0);assert.equal(await base.locator('[data-history-source=loading]').count(),1);
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);
  assert.equal(await base.getByText('Actual ABA',{exact:true}).count(),1);assert.equal(await page.evaluate(()=>obsoleteCyclePaint),false,'invalidated A payload never paints, even transiently');await page.evaluate(()=>cycleObserver.disconnect());
  const beforeToken=await count(page);await page.evaluate(()=>{token++;authChanged();});await flush(page);assert.equal((await count(page)).history,beforeToken.history+1);
  // A visibility intention only renews when expired; neither focus nor time polls.
  const beforeVisibility=await count(page);await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});await flush(page);assert.deepEqual(await count(page),beforeVisibility);
  await page.clock.fastForward(300001);await flush(page);assert.deepEqual(await count(page),beforeVisibility);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await flush(page);assert.equal((await count(page)).history,beforeVisibility.history+1);
  // Approval clock retains backend origin across navigation and expires locally.
  await page.evaluate(()=>{identity='A';control='0007';token++;payload.entries[0].approved_at=new Date(Date.now()-86400000+1500).toISOString();payload.entries[0].expires_at=new Date(Date.now()+1500).toISOString();authChanged();});await flush(page);
  await base.getByRole('button',{name:'Aprobadas',exact:true}).click();await flush(page);assert.equal(await base.locator('.su-history-entry').count(),1);const beforeClock=await count(page);await page.clock.fastForward(2500);await flush(page);assert.equal(await base.locator('.su-history-entry').count(),0);assert.deepEqual(await count(page),beforeClock);
  await base.getByRole('button',{name:'En pago',exact:true}).click();await flush(page);assert.equal(await base.locator('.su-history-entry').count(),2);
  await base.getByRole('button',{name:'En proceso',exact:true}).click();await flush(page);await base.locator('.su-history-entry').filter({hasText:'Solicitud pendiente'}).click();await flush(page);assert.equal(await page.locator('[data-detail]').getByText('Línea de tiempo',{exact:true}).count(),1);assert.equal(await page.locator('[data-detail]').getByText('Revisión',{exact:true}).count(),1);
  assert.deepEqual(errors,[]);assert.equal(external.length,0);
  if(!payloadBytes){const sample=await page.evaluate(()=>{const full=JSON.stringify(payload),summary=JSON.stringify({...payload,entries:payload.entries.map(({schedule,total,paid_to_date,expected_to_date,...entry})=>entry)});return {full,summary};});payloadBytes={fullRaw:Buffer.byteLength(sample.full),summaryRaw:Buffer.byteLength(sample.summary),fullGzip:zlib.gzipSync(sample.full).length,summaryGzip:zlib.gzipSync(sample.summary).length,quotaRows:36,note:'Synthetic JSON/gzip only; LOAD intentionally transfers more on first visit, billing not measured.'};}
  checks.push({width,initialSingleLoad:true,detailAdditionalCalls:0,tabMemoryReuse:true,ttlMs:300000,ttlNoPolling:true,ttlCheckedOnDetailAndVisibility:true,filterCalls:0,mutationCoalescing:true,obsoleteResponseDiscarded:true,errorClearsMemory:true,retryScoped:true,offscreenInvalidation:true,crossContextRace:true,logoutRace:true,controlChangeWithoutSharedEpoch:true,pendingControlCycleABA:true,tokenInvalidation:true,clockOriginPreserved:true,liquidatedGreen:true,nativeTimelinePreserved:true});await page.close();
 }}finally{await browser.close();}
 console.log(JSON.stringify({status:'PASS',checks,payloadBytes,network:'BLOCKED',productionReads:0,productionWrites:0,scope:'actual focal source modules and AdminRepository; synthetic transport/Auth; unchanged header/notice/Farma harness stand-ins'},null,2));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
