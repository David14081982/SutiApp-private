'use strict';
// Isolated synthetic fixtures. Production sources execute with all network blocked.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/history-read-efficiency'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const css=[...read('SutiApp.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
async function flush(page,ms=30){await page.clock.runFor(ms);await page.evaluate(()=>Promise.resolve());}
async function counts(page){return page.evaluate(()=>({summary:edgeCalls.filter(c=>c.body.action==='SUMMARY').length,detail:edgeCalls.filter(c=>c.body.action==='DETAIL').length,native:nativeCalls.length,realtime:realtimeCalls}));}
async function overlayRegression(page){
 // Match app.jsx: the tab remains mounted underneath pushed route layers.
 await page.evaluate(()=>{
  ui.unmount();identity='user-a';delaySummary=false;delayNative=false;delayDetail=false;failSource=false;failNative=false;resolvePending();authListeners.forEach(fn=>fn());
  const h=React.createElement;window.ui=ReactDOM.createRoot(document.getElementById('root'));
  window.app={back:()=>overlaySet(null),push:(route,params)=>overlaySet(params),setTab:()=>{}};
  function OverlayHarness(){const[params,setParams]=React.useState(null);window.overlaySet=setParams;return h(React.Fragment,null,
   h('div',{'data-overlay-history':''},h(HistorialScreen,{app})),params&&h('div',{'data-overlay-route':'',style:{position:'absolute',inset:0,zIndex:40}},h(TrackingScreen,{app,params})));}
  ui.render(h(OverlayHarness));
 });
 await flush(page);const base=page.locator('[data-overlay-history]');await base.locator('.su-history-entry').nth(5).waitFor();
 const entered=await counts(page);
 await base.locator('.su-history-entry').filter({hasText:'Actualizado tras operación'}).click();await flush(page);await page.locator('[data-overlay-route] [data-installment]').first().waitFor();
 assert.deepEqual(await counts(page),{...entered,detail:entered.detail+1},'pushed loan detail only requests DETAIL; base stays mounted');
 assert.equal(await base.locator('.su-history-entry').count(),6,'history remains mounted behind detail');
 await page.getByRole('button',{name:'Volver al historial',exact:true}).click();await flush(page);
 const afterDetail=await counts(page);assert.deepEqual(afterDetail,{...entered,detail:entered.detail+1},'return from detail makes no source calls');
 await base.locator('.su-history-entry').filter({hasText:'Caja Chica'}).click();await flush(page);await page.locator('[data-overlay-route]').getByText('Línea de tiempo',{exact:true}).waitFor();
 assert.deepEqual(await counts(page),afterDetail,'tracking shares already mounted native subscription');
 // Two native consumers still share one request and one queued follow-up per mutation burst.
 await page.evaluate(()=>{delaySummary=true;delayNative=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
 await page.evaluate(()=>{nativeRows[0].workflow_state.stages[1].label='Revisión actualizada';for(let i=0;i<3;i++)window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
 assert.deepEqual(await counts(page),{...afterDetail,summary:afterDetail.summary+1,native:afterDetail.native+1},'two subscribers do not double pending requests');
 await page.evaluate(()=>{delaySummary=false;delayNative=false;resolvePending();});await flush(page);
 await page.locator('[data-overlay-route]').getByText('Revisión actualizada',{exact:true}).waitFor();
 const afterMutation=await counts(page);assert.deepEqual(afterMutation,{...afterDetail,summary:afterDetail.summary+2,native:afterDetail.native+2},'mutations coalesce across base and pushed request tracking');
 await page.evaluate(()=>app.back());await flush(page);assert.deepEqual(await counts(page),afterMutation,'return from tracking makes no source calls');
 await base.locator('.su-history-entry').filter({hasText:'Actualizado tras operación'}).click();await flush(page);await page.locator('[data-overlay-route] [data-installment]').first().waitFor();
 // Concurrent base + detail responses from A cannot populate either layer after switching to B.
 await page.evaluate(()=>{delaySummary=true;delayNative=true;delayDetail=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
 assert.equal(await page.evaluate(()=>deferred.filter(row=>row.kind==='detail').length),1);
 await page.evaluate(()=>{identity='user-b';delaySummary=false;delayNative=false;delayDetail=false;authListeners.forEach(fn=>fn());});await flush(page);
 await page.evaluate(()=>resolvePending());await flush(page);
 assert.equal(await base.locator('.su-history-entry').count(),0);assert.equal(await page.locator('[data-overlay-route] [data-installment]').count(),0);
 assert.equal(await page.locator('[data-overlay-route]').getByText('El registro no está disponible en tu historial.',{exact:true}).count(),1);
 const switched=await counts(page);await page.evaluate(()=>app.back());await flush(page);assert.deepEqual(await counts(page),switched,'context-safe return makes no source calls');
 return {width:390,historyRetainedUnderRoute:true,detailAddsOnlyOneDetailCall:true,backAddsNoCalls:true,trackingSharesNativeSubscription:true,mutationBurstCoalescedAcrossLayers:true,pendingBaseAndDetailDiscardedOnContextChange:true};
}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[],overlayChecks=[];
 try{for(const width of [390,320,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{external.push(r.request().url());return r.abort();});
  await page.clock.install({time:new Date('2026-10-25T20:00:00.000Z')});
  await page.setContent('<style>'+css+' body{margin:0;display:block} #root{position:relative;height:900px;max-width:480px;margin:auto;overflow:auto;background:var(--bg)}</style><div id="root"></div>');
  for(const name of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read('app/vendor/'+name)});
  for(const name of ['icons.jsx','ui.jsx'])await page.addScriptTag({content:read('app/'+name)});
  await page.evaluate(()=>{
   const h=React.createElement,clone=v=>JSON.parse(JSON.stringify(v));
   window.money=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(v);
   window.TopBar=()=>h('header',{'data-harness-header':'',style:{background:'#A50032',color:'#fff',padding:20,borderRadius:'0 0 22px 22px'}},h('h1',null,'Mi Historial'),h('p',null,'Seguimiento de solicitudes'));
   window.RequestAuthorizationNotice=({requests})=>{window.noticeRequests=requests;return null;};window.FarmaHistory=()=>h('div',{'data-harness-farma':''});
   window.identity='user-a';window.authListeners=[];window.edgeCalls=[];window.nativeCalls=[];window.realtimeCalls=0;
   window.delaySummary=true;window.delayNative=false;window.delayDetail=false;window.failSource=false;window.failNative=false;window.deferred=[];
   window.AffiliateAuth={getState:()=>identity?{phase:'authenticated',session:{user:{id:identity},access_token:'synthetic-'+identity},affiliate:{id:identity}}:{phase:'anonymous'},subscribe:fn=>{authListeners.push(fn);return()=>{};}};
   window.AdminRepository={getState:()=>({phase:'ready'}),subscribe:()=>()=>{}};
   const now=new Date().toISOString(),date='2026-10-25';
   const loan=(id,category,status)=>({key:'loan:'+id,id,sourceId:'request-'+id,kind:'loan',fund:'Caja de Ahorro '+id,principal:5000,total:6000,term:24,date,
    category,status,approved_at:category==='Aprobadas'?now:null,expires_at:category==='Aprobadas'?new Date(Date.parse(now)+86400000).toISOString():null,paid_to_date:3000,
    schedule:Array.from({length:24},(_,i)=>({source_row:100*Number(id)+i,number:i+1,date:i<12?date:'2099-11-15',amount:250,state:i<12?'Pagada':'Pendiente'}))});
   window.payload={version:1,server_now:now,covered_request_ids:['pending','request-1','rejected'],financial_request_ids:['pending','request-1','rejected','finance-product'],entries:[
    loan('1','Aprobadas','AL CORRIENTE'),loan('2','En pago','SALDO ATRASADO'),loan('3','Liquidadas','PAGÓ DE MÁS'),
    {key:'request:SR-2026-000004',id:'SR-2026-000004',sourceId:'pending',kind:'request',fund:'Caja Chica',principal:3000,total:3600,term:6,date,category:'En proceso',status:'Pendiente',schedule:[]},
    {key:'request:SR-2026-000005',id:'SR-2026-000005',sourceId:'rejected',kind:'request',fund:'Vales',principal:500,total:500,term:2,date,category:'No aprobadas',status:'Rechazado',schedule:[]}]};
   window.nativeRows=[
    {id:'pending',folio:'SR-2026-000004',program_id:'prestamo',created_at:now,status:'submitted',requested_amount:3000,requested_term:6,requested_term_semantics:'pagos',financial_processing_status:'pending',workflow_state:{available:true,stages:[{id:'one',label:'Solicitud enviada',state:'done'},{id:'two',label:'Revisión',state:'current'}]}},
    {id:'native-quote',folio:'COT-001',program_id:'convenio',request_type:'quote',productoNombre:'Cotización nativa',created_at:now,status:'submitted',workflow_state:{available:true,stages:[{id:'one',label:'Cotización recibida',state:'current'}]}},
    {id:'finance-product',folio:'PRODUCT-001',program_id:'beneficio',productoNombre:'Producto financiero',created_at:now,status:'approved',financial_processing_status:'approved',requested_amount:1200}];
   const summary=full=>({...full,entries:full.entries.map(({schedule,total,paid_to_date,...entry})=>entry)});
   window.makeResponse=(body,subject=identity)=>{
    const full=subject==='user-a'?clone(payload):{...clone(payload),entries:[],financial_request_ids:[],covered_request_ids:[]};
    if(body.action==='SUMMARY')return summary(full);
    if(body.action==='DETAIL')return {...full,entries:full.entries.filter(row=>row.key===body.key)};
    throw Error('UNEXPECTED_HISTORY_ACTION');
   };
   window.SutiSupabase={getClient:()=>({channel:()=>{realtimeCalls++;throw Error('UNEXPECTED_REALTIME');},functions:{invoke:async(name,args)=>{
    if(name!=='loan-history')throw Error('FORGED_TARGET');
    const body=clone(args.body);if(JSON.stringify(Object.keys(body).sort())!==JSON.stringify((body.action==='DETAIL'?['action','key']:['action']).sort()))throw Error('UNEXPECTED_TARGET_FIELD');
    const response=failSource?{error:true}:{data:makeResponse(body)};edgeCalls.push({body,subject:identity,response:clone(response)});
    if((delaySummary&&body.action==='SUMMARY')||(delayDetail&&body.action==='DETAIL'))return new Promise(resolve=>deferred.push({kind:body.action.toLowerCase(),resolve,response}));return response;
   }}})};
   window.ProgramRequestRepository={listHistory:async()=>{
    const response=clone(identity==='user-a'?nativeRows:[]);nativeCalls.push({subject:identity});
    if(failNative)throw Error('SYNTHETIC_NATIVE_FAILURE');
    if(delayNative)return new Promise(resolve=>deferred.push({kind:'native',resolve,response}));return response;
   }};
   window.resolvePending=()=>{deferred.splice(0).forEach(({resolve,response})=>resolve(response));};
   window.ui=ReactDOM.createRoot(document.getElementById('root'));window.app={back:()=>draw(),push:(route,params)=>ui.render(h(TrackingScreen,{app,params})),setTab:()=>{}};window.draw=()=>ui.render(h(HistorialScreen,{app}));
  });
  for(const name of ['private-resource-demand.js','operations-store.jsx','history-loans-repository.js','history-loans.jsx','screens-historial.jsx'])await page.addScriptTag({content:read('app/'+name)});
  await page.evaluate(()=>draw());await flush(page);await page.locator('.su-history-entry').waitFor();
  assert.equal(await page.locator('.su-history-entry').count(),1,'native quote remains visible while Google is pending');
  assert.match(await page.locator('.su-history-entry').innerText(),/Cotización nativa/);
  assert.equal(await page.locator('[data-history-source="loading"]').count(),1);
  assert.deepEqual(await counts(page),{summary:1,detail:0,native:1,realtime:0},'one request per source on initial entry');
  await page.evaluate(()=>{delaySummary=false;resolvePending();});await flush(page);await page.locator('.su-history-entry').nth(5).waitFor();
  assert.equal(await page.locator('.su-history-entry').count(),6);
  assert.deepEqual(await page.evaluate(()=>noticeRequests.map(r=>r.sourceId).sort()),['finance-product','native-quote','pending'],'original native requests still feed authorization notices');
  assert.equal(await page.locator('[data-harness-farma]').count(),1);assert.equal(await page.locator('.su-history-hero').count(),1);
  const expected={'Todas':6,'En proceso':2,'Aprobadas':1,'En pago':1,'Liquidadas':1,'No aprobadas':1},initial=await counts(page);
  for(const [label,count] of Object.entries(expected)){
   await page.getByRole('button',{name:label,exact:true}).click();await flush(page);assert.equal(await page.locator('.su-history-entry').count(),count,label);
  }
  assert.deepEqual(await counts(page),initial,'filter changes make zero source calls');
  await page.getByRole('button',{name:'Aprobadas',exact:true}).click();await flush(page);
  const beforeCountdown=await page.locator('[data-approval-countdown]').innerText();
  await page.clock.runFor(60000);await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});await flush(page);
  assert.notEqual(await page.locator('[data-approval-countdown]').innerText(),beforeCountdown,'clock continues locally');
  assert.deepEqual(await counts(page),initial,'60 seconds idle, clock, focus and visibility make zero calls');
  const sizes=await page.evaluate(()=>({full:new TextEncoder().encode(JSON.stringify(payload)).length,summary:new TextEncoder().encode(JSON.stringify(makeResponse({action:'SUMMARY'}))).length,
   noAmortization:edgeCalls.filter(c=>c.body.action==='SUMMARY').every(c=>c.response.data.entries.every(row=>!('schedule'in row)&&!('total'in row)&&!('paid_to_date'in row)))}));
  assert(sizes.noAmortization);assert(sizes.summary<sizes.full,'summary excludes installment transfer');
  await page.locator('.su-history-entry').click();await flush(page);await page.locator('[data-installment="Pagada"]').first().waitFor();
  assert.equal(await page.locator('[data-installment="Pagada"]').count(),12);assert.equal(await page.locator('[data-installment="Pendiente"]').count(),12);
  const detail=await page.evaluate(()=>edgeCalls.filter(c=>c.body.action==='DETAIL'));
  assert.equal(detail.length,1);assert.deepEqual(detail[0].body,{action:'DETAIL',key:'loan:1'});assert.deepEqual(detail[0].response.data.entries.map(r=>r.key),['loan:1']);
  assert.equal(await page.getByRole('button',{name:'Contactar a un asesor',exact:true}).count(),1);
  assert(await page.evaluate(()=>document.querySelector('#root').scrollWidth<=document.querySelector('#root').clientWidth+1),'detail horizontal overflow');
  await page.screenshot({path:path.join(out,'amortization-'+width+'.png')});
  await page.getByRole('button',{name:'Volver al historial',exact:true}).click();await flush(page);await page.locator('.su-history-entry').nth(5).waitFor();
  await page.getByRole('button',{name:'Liquidadas',exact:true}).click();await flush(page);
  assert.equal(await page.locator('.su-history-entry').getByText('Liquidada',{exact:true}).count(),1);assert.equal(await page.getByText('Pago de más',{exact:false}).count(),0);
  const green=await page.locator('.su-history-entry').getByText('Liquidada',{exact:true}).evaluate(e=>getComputedStyle(e).color);assert.equal(green,'rgb(19, 121, 74)','Liquidada retains existing #13794A green badge');
  await page.getByRole('button',{name:'Todas',exact:true}).click();await flush(page);await page.screenshot({path:path.join(out,'history-'+width+'.png')});
  assert(await page.evaluate(()=>document.querySelector('#root').scrollWidth<=document.querySelector('#root').clientWidth+1),'history horizontal overflow');
  await page.getByRole('button',{name:'En proceso',exact:true}).click();await flush(page);await page.locator('.su-history-entry').filter({hasText:'Caja Chica'}).click();await flush(page);
  await page.getByText('Línea de tiempo',{exact:true}).waitFor();assert.equal(await page.getByText('Revisión',{exact:true}).count(),1);
  await page.evaluate(()=>app.back());await flush(page);await page.locator('.su-history-entry').nth(5).waitFor();
  await page.evaluate(()=>{payload.server_now=new Date().toISOString();payload.entries[0].approved_at=new Date(Date.now()-86400000+1500).toISOString();payload.entries[0].expires_at=new Date(Date.now()+1500).toISOString();window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  const beforeExpiry=await counts(page);await page.getByRole('button',{name:'Aprobadas',exact:true}).click();await flush(page);assert.equal(await page.locator('.su-history-entry').count(),1);
  await page.clock.runFor(2500);await flush(page);assert.equal(await page.locator('.su-history-entry').count(),0);
  await page.getByRole('button',{name:'En pago',exact:true}).click();await flush(page);assert.equal(await page.locator('.su-history-entry').count(),2);assert.deepEqual(await counts(page),beforeExpiry,'24-hour expiry is local');
  await page.getByRole('button',{name:'Todas',exact:true}).click();await page.evaluate(()=>{failSource=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);await page.locator('[data-history-source="error"]').waitFor();
  assert.equal(await page.locator('.su-history-entry').count(),1);assert.match(await page.locator('.su-history-entry').innerText(),/Cotización nativa/,'failure preserves only native nonfinancial rows');
  const failed=await counts(page);await page.evaluate(()=>{failSource=false;});await page.getByRole('button',{name:'Reintentar',exact:true}).click();await flush(page);await page.locator('.su-history-entry').nth(5).waitFor();
  const retried=await counts(page);assert.equal(retried.summary,failed.summary+1);assert.equal(retried.native,failed.native,'financial retry does not reload native source');
  // Three mutations during a pending read yield one final refresh, never three concurrent reads.
  const beforeBurst=await counts(page);await page.evaluate(()=>{delaySummary=true;delayNative=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  await page.evaluate(()=>{payload.entries[1].fund='Actualizado tras operación';nativeRows[1]={...nativeRows[1],id:'native-quote-after',folio:'COT-002',productoNombre:'Cotización actualizada'};for(let i=0;i<3;i++)window.dispatchEvent(new Event('suti:request-changed'));window.mutationSnapshots=[];window.stopMutationWatch=operationsStore.subscribe(()=>mutationSnapshots.push(operationsStore.all().map(row=>row.sourceId)));});await flush(page);
  assert.equal((await counts(page)).summary,beforeBurst.summary+1);assert.equal((await counts(page)).native,beforeBurst.native+1);
  // Return the obsolete snapshot while the follow-up native response stays unresolved.
  await page.evaluate(()=>{delaySummary=false;resolvePending();});await flush(page);await page.locator('.su-history-entry').filter({hasText:'Actualizado tras operación'}).waitFor();
  assert.equal((await counts(page)).native,beforeBurst.native+2,'one follow-up native read begins');
  assert.deepEqual(await page.evaluate(()=>({phase:operationsStore.state().phase,rows:operationsStore.all().map(row=>row.sourceId),pending:deferred.filter(row=>row.kind==='native').length,obsoleteEmitted:mutationSnapshots.some(ids=>ids.includes('native-quote'))})),{phase:'loading',rows:[],pending:1,obsoleteEmitted:false},'obsolete native response is never emitted while replacement remains pending');
  assert.equal(await page.locator('.su-history-entry').filter({hasText:'Cotización nativa'}).count(),0,'deleted native card does not reappear');
  await page.evaluate(()=>{delayNative=false;resolvePending();});await flush(page);await page.locator('.su-history-entry').filter({hasText:'Cotización actualizada'}).waitFor();
  assert.equal(await page.evaluate(()=>mutationSnapshots.some(ids=>ids.includes('native-quote'))),false,'no transient obsolete store emissions');
  await page.evaluate(()=>stopMutationWatch());
  const afterBurst=await counts(page);assert.equal(afterBurst.summary,beforeBurst.summary+2);assert.equal(afterBurst.native,beforeBurst.native+2);assert.equal(await page.locator('.su-history-entry').filter({hasText:'Cotización actualizada'}).count(),1);
  // In-flight responses for A are discarded after changing context to B and after logout.
  await page.evaluate(()=>{delaySummary=true;delayNative=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  await page.evaluate(()=>{identity='user-b';delaySummary=false;delayNative=false;authListeners.forEach(fn=>fn());});await flush(page);
  await page.evaluate(()=>resolvePending());await flush(page);assert.equal(await page.locator('.su-history-entry').count(),0);
  await page.evaluate(()=>{identity='user-a';authListeners.forEach(fn=>fn());});await flush(page);await page.locator('.su-history-entry').nth(5).waitFor();
  await page.evaluate(()=>{delaySummary=true;delayNative=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  await page.evaluate(()=>{identity='';authListeners.forEach(fn=>fn());resolvePending();});await flush(page);assert.equal(await page.locator('.su-history-entry').count(),0);
  if(width===390)overlayChecks.push(await overlayRegression(page));
  assert.deepEqual(errors,[]);assert.equal(external.length,0,'no external requests attempted');
  checks.push({width,actualOperationsStore:true,initialCalls:initial,filterCalls:0,idle60SecondsCalls:0,realtimeCalls:0,localApprovalExpiry:true,summaryBytes:sizes.summary,fullFixtureBytes:sizes.full,bytesAre:'uncompressed synthetic JSON, not billed egress',detailOwnKeyOnly:true,nativeVisibleWhilePending:true,nativeVisibleOnSourceError:true,retryScoped:true,mutationBurstCoalesced:true,obsoleteNativeResponseDiscardedWhileFollowupPending:true,contextRace:true,logoutRace:true,timelinePreserved:true,liquidatedGreen:true,noHorizontalOverflow:true});
  await page.close();
 }
 const proof={status:'PASS',scope:'synthetic isolated browser; real history, UI and operations source modules; header/notice/Farma harness stand-ins',checks,overlayChecks,productionWrites:0,network:'BLOCKED',timing:'Playwright clock advanced 60 seconds without a wall-clock sleep'};
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
