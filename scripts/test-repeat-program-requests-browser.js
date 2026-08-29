'use strict';

const assert=require('assert').strict,fs=require('fs'),http=require('http'),net=require('net'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),chromePath=fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let stage='start';
const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const port=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});});
async function wait(fn,timeout=30000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(error){last=error;}await sleep(150);}throw last||new Error('timeout');}
function cdp(url){const socket=new WebSocket(url);let sequence=0;const pending=new Map();socket.onmessage=(event)=>{const message=JSON.parse(event.data);if(!pending.has(message.id))return;const call=pending.get(message.id);pending.delete(message.id);message.error?call.reject(new Error(message.error.message)):call.resolve(message.result);};return{ready:new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;}),call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});},close(){socket.close();}};}

async function main(){
  const appPort=await port(),debugPort=await port(),tempRoot=fs.existsSync('C:\\tmp')?'C:\\tmp':os.tmpdir(),profile=fs.mkdtempSync(path.join(tempRoot,'sutiapp-repeat-'));
  const server=http.createServer((request,response)=>{const pathname=new URL(request.url,`http://127.0.0.1:${appPort}`).pathname,relative=pathname==='/'?'SutiApp.html':decodeURIComponent(pathname.slice(1)),file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':path.extname(file)==='.js'?'text/javascript':path.extname(file)==='.html'?'text/html':'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);});
  await new Promise((resolve)=>server.listen(appPort,'127.0.0.1',resolve));
  const chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});let page;
  try{
    stage='connect';const target=await wait(async()=>{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);return(await response.json()).find((item)=>item.type==='page');});page=cdp(target.webSocketDebuggerUrl);await page.ready;await page.call('Page.enable');await page.call('Runtime.enable');stage='navigate';await page.call('Page.navigate',{url:`http://127.0.0.1:${appPort}/SutiApp.html`});
    const evaluate=async(expression)=>{const result=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'evaluation');return result.result&&result.result.value;};
    stage='globals';await wait(()=>evaluate('Boolean(window.React&&window.ReactDOM&&window.ProductScreen&&window.CatalogItemScreen)'),60000);
    stage='render';const result=await evaluate(`(()=>{
      const pending={id:'request-pending',folio:'SR-TEST-1',estado:'solicitada',fechaHora:'hoy',empresaNombre:'Proveedor'};
      const ready={id:'request-ready',folio:'SR-TEST-2',estado:'cotizada',fechaHora:'hoy',empresaNombre:'Proveedor',cotizacion:{monto:1500,actor:'Proveedor',vigencia:'15 días'}};
      let current=pending;
      const quotes={requiresQuote:()=>true,latestFor:()=>current,markVisto:()=>Promise.resolve(),providerFor:()=>({name:'Proveedor'}),solicitar:()=>Promise.resolve(pending)};
      const catalog={live:()=>[],state:()=>({phase:'loaded'}),get:()=>null,isFavorite:()=>false,toggleFavorite:()=>Promise.resolve()};
      window.finCatStore={groups:()=>[{tone:'blue',items:[{id:'repeat-test',label:'Programa de prueba',icon:'doc',tagline:'Prueba',meta:'Prueba'}]}]};
      window.quoteStore=quotes;window.useQuoteStore=()=>quotes;window.catalogStore=catalog;window.useCatalogStore=()=>catalog;
      window.useFinancialLegacy=()=>({status:'loaded',overview:{programs:[]},quote:null});window.financialLegacyStore={loadOverview:()=>{},clearQuote:()=>{},requestQuote:()=>{}};
      const host=document.createElement('div');host.id='repeat-request-test';host.style.cssText='position:fixed;inset:0;z-index:99999;background:#fff';document.body.appendChild(host);const root=ReactDOM.createRoot(host);
      const app={back:()=>{},push:()=>{},toast:()=>{}};
      root.render(React.createElement(window.ProductScreen,{app,params:{id:'repeat-test'}}));
      return new Promise((resolve)=>setTimeout(()=>{
        const pendingButton=[...host.querySelectorAll('button')].find((button)=>button.textContent.includes('Solicitar otra cotización'));
        const pendingCopy=host.textContent.includes('no impide enviar otra solicitud');
        current=ready;root.render(React.createElement(window.ProductScreen,{app,params:{id:'repeat-test'}}));
        setTimeout(()=>resolve({pendingButton:Boolean(pendingButton),pendingEnabled:Boolean(pendingButton&&!pendingButton.disabled),pendingCopy,readyNew:[...host.querySelectorAll('button')].some((button)=>button.textContent.includes('Nueva cotización')),readySimulate:[...host.querySelectorAll('button')].some((button)=>button.textContent.includes('Simular monto'))}),100);
      },100));
    })()`);
    stage='assert';assert.deepStrictEqual(result,{pendingButton:true,pendingEnabled:true,pendingCopy:true,readyNew:true,readySimulate:true});
    const shot=await page.call('Page.captureScreenshot',{format:'png'}),screenshot=path.join(tempRoot,'sutiapp-repeat-program-requests.png');fs.writeFileSync(screenshot,Buffer.from(shot.data,'base64'));
    console.log(JSON.stringify({status:'PASS',realBrowser:true,...result,screenshot}));
  }finally{
    if(page)page.close();chrome.kill();await Promise.race([new Promise((resolve)=>chrome.once('exit',resolve)),sleep(2000)]);await new Promise((resolve)=>server.close(resolve));if(profile.startsWith(tempRoot+path.sep))try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch(_){}
  }
}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',stage,error:error.message}));process.exitCode=1;});
