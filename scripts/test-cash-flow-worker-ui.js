'use strict';
// Isolated browser regression. Synthetic repository, actual UI and actual worker artifact.
// Network is restricted to this process's loopback HTML/static worker endpoint.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.tmp/cash-flow-source-20261104');
function fixture(){
 const loan=Array(33).fill(null),request=Array(25).fill(null);
 Object.assign(loan,{0:'2026-01-15',1:120,2:'ISOLATED-C1',3:'TEST001',4:'Persona sintética',6:'Caja de Ahorro',9:100,10:120,18:1,20:'2026-01-01',25:10,27:10,28:110,29:100});
 Object.assign(request,{0:'ISOLATED-C1',1:'TEST001',2:'Persona sintética',4:'Caja de Ahorro',7:100,8:120,9:'2026-01-01',24:'Iniciado'});
 return {version:'cash-flow-inputs-v1',modelVersion:'20261104-original-components-v1',from:'2026-01',consultedAt:'2026-11-04T20:00:00Z',source:{loans:[[],loan],requests:[[],request]},sourceErrors:{investors:null},
  savings:{as_of:'2026-11-04',events:[],balances:Array.from({length:12},(_,i)=>({month:'2026-'+String(i+1).padStart(2,'0')+'-01',amount:0,known_amount:0})),issues:[],source_bases:{accounts:[],account_identities:[],account_balances:[],current_balances:[],balance_entries:[],history:[],transactions:[],historical_withdrawals:[],pending:[],scheduled:[],opening_account_balances:[],history_metadata:[]}},
  investors:{as_of:'2026-11-04',contracts:[],movements:[],obligations:[],reviews:[],balances:[]}};
}
async function main(){
 const {projectCashFlowSnapshot}=await import('../supabase/functions/reports-jc/cash-flow.mjs');
 const workerCode=fs.readFileSync(path.join(root,'app/cash-flow-projection-worker.js'),'utf8'),checks=[],requests=[],external=[],errors=[];let variant='actual';
 const html='<!doctype html><html lang="es"><meta charset="utf-8"><link rel="icon" href="data:,"><style>:root{--surface:#fff;--surface-2:#f7f7fa;--ink:#17233b;--ink-2:#526078;--hairline:#dfe3ea;--hairline-strong:#c4cad5;--guinda:#861e45}body{font:14px Arial}#root{padding:16px}</style><div id="root"></div></html>';
 const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://127.0.0.1').pathname;requests.push(p);res.setHeader('Cache-Control','no-store');if(p==='/worker-ui-isolated'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}else if(p==='/app/cash-flow-projection-worker.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(variant==='actual'?workerCode:"throw new Error('ISOLATED_WORKER_FAILURE');");}else{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin&&['/worker-ui-isolated','/app/cash-flow-projection-worker.js'].includes(u.pathname))return route.continue();external.push(u.origin+u.pathname);return route.abort();});
  page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/worker-ui-isolated');
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/cash-flow-report.jsx'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(snapshot=>{
   const NativeWorker=window.Worker;window.__workers=[];window.__pending=[];window.__received=[];window.__calls=[];window.__context='isolated-A';window.__hold=false;window.__mode='normal';window.__exported=null;
   window.Worker=class{
    constructor(url){this.id=window.__workers.length;this.terminated=0;this.url=String(url);this.native=new NativeWorker(url);window.__workers.push(this);
     this.native.onmessage=e=>{window.__received.push({worker:this.id,result:e.data});const deliver=()=>this.onmessage?.(e);if(window.__hold)window.__pending.push({worker:this.id,deliver});else deliver();};
     this.native.onerror=e=>{e.preventDefault();this.onerror?.(e);};this.native.onmessageerror=e=>this.onmessageerror?.(e);
    }
    postMessage(message){this.snapshot=structuredClone(message.snapshot);this.native.postMessage(message);}
    terminate(){this.terminated++;this.native.terminate();}
   };
   window.ReportsJcRepository={contextKey:()=>window.__context,cashFlow:async from=>{window.__calls.push(from);const s=structuredClone(snapshot);s.from=from;if(window.__mode==='invalid-version')s.version='unsupported-version';if(window.__mode==='invalid-model')s.modelVersion='unsupported-model';return s;}};
   window.SutiCashFlowExport={download:async(report,options)=>{if(!options.isCurrent())throw Error('STALE_EXPORT');window.__exported=structuredClone(report);}};
   window.__mount=()=>window.__root.render(React.createElement(CashFlowReportModule,{onBack:()=>{window.__root.unmount();window.__root=null;}}));
   window.__root=ReactDOM.createRoot(document.getElementById('root'));window.__mount();
  },fixture());
  const table=()=>page.getByRole('table',{name:'Flujo de efectivo consolidado'});
  const waitHeld=async()=>{await page.waitForFunction(()=>window.__pending.length>0);return page.evaluate(()=>window.__pending.at(-1).worker);};
  const release=async id=>page.evaluate(id=>{const i=window.__pending.findIndex(x=>x.worker===id);if(i<0)throw Error('HELD_MESSAGE_MISSING');window.__pending.splice(i,1)[0].deliver();},id);
  const terminated=async id=>{await page.waitForFunction(id=>window.__workers[id].terminated===1,id);};
  const matrix=async()=>{
   await table().waitFor();const payload=await page.evaluate(()=>{const r=window.__received.at(-1);return {snapshot:window.__workers[r.worker].snapshot,data:r.result.data,worker:r.worker};});
   const expected=projectCashFlowSnapshot(payload.snapshot);assert.deepEqual(payload.data,expected);await terminated(payload.worker);
   const matches=await table().evaluate((el,report)=>{
    const money=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2});
    const text=(c,r)=>{const n=c.status==='PARTIAL'?c.knownAmount:c.amount;if(['NOT_APPLICABLE','UNAVAILABLE'].includes(c.status)||typeof n!=='number'||!Number.isFinite(n))return '';const x=Math.abs(n),v=r.unit==='count'?new Intl.NumberFormat('es-MX',{maximumFractionDigits:0}).format(x):r.unit==='percent'?new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(x)+'%':money.format(x);return n<0?'('+v+')':v;};
    const rows=[...el.querySelectorAll('[data-cash-flow-row]')];return rows.length===report.rows.length&&report.rows.every(r=>{const row=rows.find(x=>x.dataset.cashFlowRow===r.id);return row&&row.querySelector('th').firstChild.textContent===r.label&&r.cells.every((c,i)=>{const b=row.querySelectorAll('td button')[i];return b.dataset.status===c.status&&b.querySelector('strong').textContent===text(c,r);});});
   },expected);assert(matches);return expected;
  };
  const expected=await matrix();await page.getByRole('button',{name:'Exportar Excel',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.__exported),expected);checks.push('Actual worker equals pure projection; every displayed cell and exported report agree; worker terminates once');
  await page.evaluate(()=>{window.__hold=true;});await page.getByRole('button',{name:'Año actual',exact:true}).click();const oldPeriod=await waitHeld();
  await page.getByRole('button',{name:'Próximos 12 meses',exact:true}).click();await terminated(oldPeriod);await page.waitForFunction(id=>window.__pending.some(p=>p.worker!==id),oldPeriod);const newPeriod=await page.evaluate(id=>window.__pending.find(p=>p.worker!==id).worker,oldPeriod);
  await release(oldPeriod);assert.equal(await table().count(),0);await release(newPeriod);await matrix();checks.push('Period change cancels previous worker and discards its queued result');
  await page.getByRole('button',{name:'Año actual',exact:true}).click();const oldContext=await waitHeld();await page.evaluate(()=>{window.__context='isolated-B';window.__mount();});await terminated(oldContext);await page.waitForFunction(id=>window.__pending.some(p=>p.worker!==id),oldContext);const newContext=await page.evaluate(id=>window.__pending.find(p=>p.worker!==id).worker,oldContext);
  await release(oldContext);assert.equal(await table().count(),0);await release(newContext);await matrix();checks.push('Context change cancels previous worker and discards its queued result');
  await page.getByRole('button',{name:'Año actual',exact:true}).click();const navigation=await waitHeld();await page.getByRole('button',{name:'Volver a Reportes JC',exact:true}).click();await terminated(navigation);await release(navigation);assert.equal(await page.locator('[data-cash-flow-report]').count(),0);checks.push('Navigation unmount terminates worker and late result cannot restore screen');
  for(const mode of ['invalid-version','invalid-model']){
   const before=await page.evaluate(()=>window.__workers.length);await page.evaluate(mode=>{window.__mode=mode;window.__hold=false;if(!window.__root)window.__root=ReactDOM.createRoot(document.getElementById('root'));window.__mount();},mode);
   if(mode==='invalid-model')await page.getByRole('button',{name:'Año actual',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await table().count(),0);assert(await page.getByRole('button',{name:'Exportar Excel',exact:true}).isDisabled());assert.equal(await page.evaluate(()=>window.__workers.length),before);
  }checks.push('Invalid snapshot version/model displays an error without worker, old report or fallback');
  variant='throw';await page.evaluate(()=>{window.__mode='normal';});await page.getByRole('button',{name:'Año actual',exact:true}).click();await page.getByRole('alert').waitFor();const failed=await page.evaluate(()=>window.__workers.length-1);await terminated(failed);assert.equal(await table().count(),0);assert(await page.getByRole('button',{name:'Exportar Excel',exact:true}).isDisabled());checks.push('Actual worker script failure is visible, terminates and never substitutes a cached report');
  const lifecycle=await page.evaluate(()=>window.__workers.map(w=>({id:w.id,terminated:w.terminated})));assert(lifecycle.every(w=>w.terminated===1));assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert(requests.every(p=>['/worker-ui-isolated','/app/cash-flow-projection-worker.js'].includes(p)));
  const evidence={status:'PASS',checks,actualWorkerArtifact:true,syntheticIsolated:true,workers:lifecycle.length,allWorkersTerminatedOnce:true,externalRequests:0,staticWorkerRequests:requests.filter(p=>p.endsWith('worker.js')).length,financialWrites:0,productionCalls:0};fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'worker-ui-verification.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
