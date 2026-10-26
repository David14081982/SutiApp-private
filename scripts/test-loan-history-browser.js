'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/history-loan-payments'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('SutiApp.html'),css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
async function main(){const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{for(const width of [390,320,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
  await page.setContent('<style>'+css+' body{margin:0;display:block} #root{position:relative;height:900px;max-width:480px;margin:auto;overflow:auto;background:var(--bg)}</style><div id="root"></div>');
  for(const name of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read('app/vendor/'+name)});
  for(const name of ['icons.jsx','ui.jsx'])await page.addScriptTag({content:read('app/'+name)});
  await page.evaluate(()=>{
   const h=React.createElement;window.money=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(v);
   window.TopBar=()=>h('header',{style:{background:'#A50032',color:'#fff',padding:20,borderRadius:'0 0 22px 22px'}},h('h1',null,'Mi Historial'),h('p',null,'Seguimiento de solicitudes'));
   window.RequestAuthorizationNotice=({requests})=>{window.noticeRequests=requests;return null;};window.FarmaHistory=()=>null;window.failSource=false;window.deferred=[];window.delaySource=false;
   window.identity='user-a';window.authListeners=[];window.calls=0;
   window.AffiliateAuth={getState:()=>identity?{phase:'authenticated',session:{user:{id:identity},access_token:'synthetic-'+identity},affiliate:{id:identity}}:{phase:'anonymous'},subscribe:fn=>{authListeners.push(fn);return()=>{};}};
   window.AdminRepository={getState:()=>({phase:'ready'}),subscribe:()=>()=>{}};
   const now=new Date().toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const loan=(id,category,status)=>({key:'loan:'+id,id,sourceId:'request-'+id,kind:'loan',fund:'Caja de Ahorro '+id,principal:5000,total:6000,term:12,date,
    category,status,approved_at:category==='Aprobadas'?now:null,expires_at:category==='Aprobadas'?new Date(Date.parse(now)+86400000).toISOString():null,paid_to_date:500,
    schedule:[{source_row:2,number:1,date,amount:500,state:'Pagada'},{source_row:3,number:2,date:'2099-11-15',amount:500,state:'Pendiente'}]});
   window.payload={version:1,server_now:now,covered_request_ids:['request-1'],financial_request_ids:['request-1'],entries:[loan('1','Aprobadas','AL CORRIENTE'),loan('2','En pago','SALDO ATRASADO'),loan('3','Liquidadas','PAGÓ DE MÁS'),
    {key:'request:SR-2026-000004',id:'SR-2026-000004',sourceId:'pending',kind:'request',fund:'Caja Chica',principal:3000,total:3600,term:6,date,category:'En proceso',status:'Pendiente',schedule:[]},
    {key:'request:SR-2026-000005',id:'SR-2026-000005',sourceId:null,kind:'request',fund:'Vales',principal:500,total:500,term:2,date,category:'No aprobadas',status:'Rechazado',schedule:[]}]};
   window.SutiSupabase={getClient:()=>({functions:{invoke:async(name,args)=>{calls++;if(name!=='loan-history'||JSON.stringify(args.body)!=='{"action":"LOAD"}')throw Error('FORGED_TARGET');
    if(delaySource)return new Promise(resolve=>deferred.push(resolve));return failSource?{error:true}:{data:identity==='user-a'?JSON.parse(JSON.stringify(payload)):{...payload,entries:[],financial_request_ids:[],covered_request_ids:[]}};}}})};
   window.native={sourceId:'pending',id:'SR-2026-000004',kind:'loan',tipo:'Caja Chica',estado:'revision',monto:3000,fecha:date,plazo:'6 pagos',steps:[{label:'Solicitud enviada',done:true},{label:'Revisión',active:true}],workflowAvailable:true,ts:1};
   window.useOperationsStore=()=>({all:()=>[native],state:()=>({phase:'loaded'}),retry:()=>{}});
   window.ui=ReactDOM.createRoot(document.getElementById('root'));window.app={back:()=>draw(),push:(route,params)=>ui.render(h(TrackingScreen,{app,params})),setTab:()=>{}};window.draw=()=>ui.render(h(HistorialScreen,{app}));
  });
  for(const name of ['private-resource-demand.js','history-loans-repository.js','history-loans.jsx','screens-historial.jsx'])await page.addScriptTag({content:read('app/'+name)});
  await page.evaluate(()=>draw());await page.locator('.su-history-entry').nth(4).waitFor();assert.equal(await page.locator('.su-history-entry').count(),5);
  assert.deepEqual(await page.evaluate(()=>noticeRequests.map(r=>r.sourceId)),['pending'],'existing approval notification receives original native request projection');
  for(const label of ['Todas','En proceso','Aprobadas','En pago','Liquidadas','No aprobadas'])assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),1);
  await page.getByRole('button',{name:'Aprobadas',exact:true}).click();assert.equal(await page.locator('.su-history-entry').count(),1);await page.locator('[data-approval-countdown]').waitFor();
  await page.locator('.su-history-entry').click();await page.locator('[data-loan-history-detail]').waitFor();await page.locator('[data-installment="Pagada"]').waitFor();assert.equal(await page.locator('[data-installment="Pendiente"]').count(),1);
  await page.screenshot({path:path.join(out,'amortization-'+width+'.png')});
  assert(await page.evaluate(()=>document.querySelector('#root').scrollWidth<=document.querySelector('#root').clientWidth+1),'horizontal overflow');
  await page.getByRole('button',{name:'Volver al historial'}).click();await page.locator('.su-history-entry').nth(4).waitFor();
  await page.getByRole('button',{name:'Liquidadas',exact:true}).click();assert.equal(await page.locator('.su-history-entry').count(),1);assert.equal(await page.locator('.su-history-entry').getByText('Liquidada',{exact:true}).count(),1);assert.equal(await page.getByText('Pago de más',{exact:false}).count(),0);
  await page.getByRole('button',{name:'En pago',exact:true}).click();assert.equal(await page.locator('.su-history-entry').count(),1);
  await page.getByRole('button',{name:'Todas',exact:true}).click();await page.screenshot({path:path.join(out,'history-'+width+'.png')});
  await page.getByRole('button',{name:'En proceso',exact:true}).click();await page.locator('.su-history-entry').click();await page.getByText('Línea de tiempo',{exact:true}).waitFor();await page.getByText('Revisión',{exact:true}).waitFor();
  await page.evaluate(()=>app.back());await page.locator('.su-history-entry').nth(4).waitFor();
  // Expiry changes the filter without changing client Date or writing any source.
  await page.evaluate(()=>{payload.server_now=new Date(Date.now()).toISOString();payload.entries[0].approved_at=new Date(Date.parse(payload.server_now)-86400000+1300).toISOString();payload.entries[0].expires_at=new Date(Date.parse(payload.server_now)+1300).toISOString();window.dispatchEvent(new Event('suti:request-changed'));});
  await page.getByRole('button',{name:'Aprobadas',exact:true}).click();await page.waitForTimeout(2300);assert.equal(await page.locator('.su-history-entry').count(),0);await page.getByRole('button',{name:'En pago',exact:true}).click();assert.equal(await page.locator('.su-history-entry').count(),2);
  await page.evaluate(()=>{failSource=true;window.dispatchEvent(new Event('suti:request-changed'));});await page.locator('[data-history-source="error"]').waitFor();assert.equal(await page.locator('.su-history-entry').count(),0);
  await page.evaluate(()=>{failSource=false;});await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.locator('.su-history-entry').first().waitFor();
  // A slow response started for user A must not appear after switching to B.
  await page.evaluate(()=>{delaySource=true;window.dispatchEvent(new Event('suti:request-changed'));});await page.waitForTimeout(50);
  await page.evaluate(()=>{identity='user-b';delaySource=false;authListeners.forEach(fn=>fn());});await page.waitForTimeout(80);
  await page.evaluate(()=>{deferred.splice(0).forEach(resolve=>resolve({data:payload}));});await page.waitForTimeout(80);assert.equal(await page.locator('.su-history-entry').count(),0);
  await page.evaluate(()=>{identity='';authListeners.forEach(fn=>fn());});assert.equal(await page.locator('.su-history-entry').count(),0);
  assert.deepEqual(errors,[]);checks.push({width,filters:true,approvedAmortization:true,liquidatedLabel:true,timelinePreserved:true,expiry:true,sourceFailure:true,identityRace:true,noHorizontalOverflow:true});await page.close();
 }
 const proof={status:'PASS',checks,productionWrites:0,network:'BLOCKED',header:'isolated harness; focal cards, filters, detail and real UI primitives'};fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
