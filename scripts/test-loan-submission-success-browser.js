'use strict';

const assert=require('assert').strict;
const fs=require('fs');
const http=require('http');
const net=require('net');
const os=require('os');
const path=require('path');
const {spawn}=require('child_process');

const root=path.resolve(__dirname,'..');
const chromePath=fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
  ?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  :'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidenceDir=path.join(root,'docs','qa','evidence','loan-submission-success-20260829');
let stage='start';
const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const port=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});});
async function wait(fn,timeout=30000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(error){last=error;}await sleep(120);}throw last||new Error('timeout');}
function cdp(url){const socket=new WebSocket(url);let sequence=0;const pending=new Map();socket.onmessage=(event)=>{const message=JSON.parse(event.data);if(!pending.has(message.id))return;const call=pending.get(message.id);pending.delete(message.id);message.error?call.reject(new Error(message.error.message)):call.resolve(message.result);};return{ready:new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;}),call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});},close(){socket.close();}};}

async function main(){
  const appPort=await port(),debugPort=await port(),tempRoot=os.tmpdir(),profile=fs.mkdtempSync(path.join(tempRoot,'sutiapp-loan-success-'));
  const server=http.createServer((request,response)=>{const pathname=new URL(request.url,`http://127.0.0.1:${appPort}`).pathname,relative=pathname==='/'?'SutiApp.html':decodeURIComponent(pathname.slice(1)),file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':path.extname(file)==='.js'||path.extname(file)==='.jsx'?'text/javascript':path.extname(file)==='.html'?'text/html':'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);});
  await new Promise((resolve)=>server.listen(appPort,'127.0.0.1',resolve));
  const chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});let page;
  try{
    stage='connect';const target=await wait(async()=>{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);return(await response.json()).find((item)=>item.type==='page');});page=cdp(target.webSocketDebuggerUrl);await page.ready;await page.call('Page.enable');await page.call('Runtime.enable');await page.call('Emulation.setDeviceMetricsOverride',{width:430,height:900,deviceScaleFactor:1,mobile:true});
    stage='navigate';await page.call('Page.navigate',{url:`http://127.0.0.1:${appPort}/SutiApp.html`});
    const evaluate=async(expression)=>{const result=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception&&result.exceptionDetails.exception.description||result.exceptionDetails.text||'evaluation');return result.result&&result.result.value;};
    stage='globals';await wait(()=>evaluate('Boolean(window.React&&window.ReactDOM&&window.RequestSubmissionSuccess&&window.MOTION)'),30000);
    stage='render';const mounted=await evaluate(`(async()=>{
      window.MOTION.qa.setReduced('off');
      const host=document.createElement('div');host.id='loan-success-browser-test';host.style.cssText='position:fixed;inset:0;z-index:2147483647;background:var(--bg)';document.body.appendChild(host);
      window.__loanSuccessTabs=[];
      const app={back:()=>window.__loanSuccessTabs.push('back'),setTab:(tab)=>window.__loanSuccessTabs.push(tab)};
      window.__loanSuccessRoot=ReactDOM.createRoot(host);window.__loanSuccessApp=app;
      window.__loanSuccessRoot.render(React.createElement(window.RequestSubmissionSuccess,{app,folio:'SF-2947',amount:20000,kind:'loan',fullScreen:true,onBack:app.back,destination:'Tu solicitud fue enviada al Área de Finanzas del sindicato para su revisión.'}));
      await new Promise((resolve)=>setTimeout(resolve,120));
      return Boolean(host.querySelector('[data-loan-submission-success="SF-2947"]'));
    })()`);
    assert.equal(mounted,true);
    stage='inspect';const contract=await evaluate(`(()=>{const host=document.getElementById('loan-success-browser-test'),text=host.innerText;return{title:text.includes('¡Solicitud enviada!'),amount:text.includes('$20,000'),folio:text.includes('SF-2947'),timeline:['Solicitud enviada','Revisión de documentos','Autorización','Depósito vía nómina'].every((value)=>text.includes(value)),actions:['Seguir mi solicitud','Volver al inicio'].every((value)=>text.includes(value)),confetti:host.querySelectorAll('[data-loan-success-confetti] i').length,overflow:host.scrollWidth<=host.clientWidth};})()`);
    assert.deepStrictEqual(contract,{title:true,amount:true,folio:true,timeline:true,actions:true,confetti:42,overflow:true});
    fs.mkdirSync(evidenceDir,{recursive:true});const screenshot=path.join(evidenceDir,'loan-success-430x900.png');const shot=await page.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(screenshot,Buffer.from(shot.data,'base64'));
    stage='actions';const actions=await evaluate(`(()=>{const host=document.getElementById('loan-success-browser-test'),buttons=[...host.querySelectorAll('button')];buttons.find((button)=>button.textContent.includes('Seguir mi solicitud')).click();buttons.find((button)=>button.textContent.includes('Volver al inicio')).click();return window.__loanSuccessTabs.slice();})()`);assert.deepStrictEqual(actions,['historial','home']);
    stage='variants';const variants=await evaluate(`(async()=>{const expected={benefit:'Revisión del área responsable',quote:'Preparación de cotización',membership:'Revisión de documentos'},result={};for(const kind of Object.keys(expected)){window.__loanSuccessRoot.render(React.createElement(window.RequestSubmissionSuccess,{app:window.__loanSuccessApp,folio:'SR-'+kind,kind,subject:'Programa de prueba',fullScreen:true,onBack:()=>{}}));await new Promise((resolve)=>setTimeout(resolve,40));const host=document.getElementById('loan-success-browser-test');result[kind]=host.querySelector('[data-request-submission-success="'+kind+'"]')!==null&&host.innerText.includes(expected[kind])&&host.querySelectorAll('[data-request-success-confetti] i').length===42;}return result;})()`);assert.deepStrictEqual(variants,{benefit:true,quote:true,membership:true});
    console.log(JSON.stringify({status:'PASS',realBrowser:true,...contract,actions,variants,screenshot:path.relative(root,screenshot).replace(/\\/g,'/')}));
  }finally{
    if(page)page.close();chrome.kill();if(server.closeAllConnections)server.closeAllConnections();await Promise.race([new Promise((resolve)=>chrome.once('exit',resolve)),sleep(2000)]);await Promise.race([new Promise((resolve)=>server.close(resolve)),sleep(2000)]);if(profile.startsWith(tempRoot+path.sep))try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch(_){}
  }
}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',stage,error:error.message}));process.exitCode=1;});
