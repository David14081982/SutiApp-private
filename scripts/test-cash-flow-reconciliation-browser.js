'use strict';
// Isolated synthetic data; compiled focal modules from the actual local bundle.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.tmp/cash-flow-fixes-20261113/browser');
const Zip=require('../app/vendor/jszip-3.10.1/jszip.min.js');
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const bundle=fs.readFileSync(path.join(root,'app/bundle.js'),'utf8'),sections=new Map([...bundle.matchAll(/^\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=^\/\* @@file |$(?![\s\S]))/gm)].map(m=>[m[1],m[0]]));
 const html='<!doctype html><html lang="es"><meta charset="utf-8"><link rel="icon" href="data:,"><style>:root{--surface:#fff;--surface-2:#f7f7fa;--ink:#17233b;--ink-2:#526078;--hairline:#dfe3ea;--guinda:#861e45}body{font:14px Arial}#root{padding:16px}</style><div id="root"></div></html>';
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end(html);}else if(url.pathname==='/app/cash-flow-projection-worker.js'){res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(path.join(root,'app/cash-flow-projection-worker.js')));}else{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),external=[],errors=[];
  await page.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();external.push(r.request().url());return r.abort();});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  for(const f of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js','jszip-3.10.1/jszip.min.js'])await page.addScriptTag({path:path.join(root,'app/vendor',f)});
  for(const f of ['cash-flow-export.js','cash-flow-report.jsx']){assert(sections.has(f));await page.addScriptTag({content:sections.get(f)});}
  await page.evaluate(()=>{
   const quota=(id,fund,extra={})=>Object.assign(Array(33).fill(''),{0:'2026-07-15',1:100,2:id,3:'TEST',4:'Persona sintética',6:fund,9:1000,20:'2026-07-01',25:0,27:0,28:100,29:100},extra);
   const request=Object.assign(Array(25).fill(''),{0:'TEST1',1:'TEST',4:'Caja de Ahorro',7:1000,9:'2026-07-01',24:'Iniciado'});
   window.ReportsJcRepository={contextKey:()=> 'isolated',cashFlow:async from=>({version:'cash-flow-inputs-v1',modelVersion:'20261104-original-components-v1',from,consultedAt:'2026-11-13T17:15:15Z',source:{loans:[[],quota('TEST1','Caja de Ahorro'),quota('TEST1','Caja de Ahorro',{0:'2026-12-15',29:'REVISAR',28:''}),quota('OTHER','Seguro Colectivo Suti')],requests:[[],request]},sourceErrors:{},savings:{events:[],balances:Array.from({length:12},(_,i)=>({month:'2026-'+String(i+1).padStart(2,'0'),amount:0,known_amount:0})),source_bases:{accounts:[],account_identities:[],account_balances:[],current_balances:[],balance_entries:[],history:[],transactions:[],historical_withdrawals:[],pending:[],scheduled:[],opening_account_balances:[],history_metadata:[]}},investors:{contracts:[],movements:[],obligations:[],reviews:[],balances:[]}})};
   ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(CashFlowReportModule,{onBack:()=>{}}));
  });
  await page.getByRole('table',{name:'Flujo de efectivo consolidado'}).waitFor();
  await page.getByRole('button',{name:'Año actual',exact:true}).click();await page.getByRole('table',{name:'Flujo de efectivo consolidado'}).waitFor();
  assert.equal(await page.locator('[data-cash-flow-row="collection_segurocolectivosuti_recovered"]').count(),1);
  await page.screenshot({path:path.join(out,'report.png'),fullPage:false});
  await page.locator('[data-cash-flow-row="loan_pending"] td button').nth(11).click();
  await page.getByRole('dialog').waitFor();assert((await page.getByRole('dialog').innerText()).includes('conciliación'));
  await page.screenshot({path:path.join(out,'detail.png')});await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar Excel',exact:true}).click();const download=await waiting;
  await download.saveAs(path.join(out,download.suggestedFilename()));const zip=await Zip.loadAsync(fs.readFileSync(await download.path()));
  const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert(xml.includes('Seguro Colectivo Suti'));assert(xml.includes('Capital original de préstamos con saldo por conciliar'));
  assert.equal(external.length,0);assert.equal(errors.length,0);
  const result={status:'PASS',compiledLocalBundle:true,realWorker:true,realExcelButtonDownload:true,programIncluded:true,unresolvedDetail:true,financialWrites:0,productionCalls:0,externalRequests:0};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
