'use strict';
const fs=require('fs');
const net=require('net');
const os=require('os');
const path=require('path');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});});}
async function wait(fn,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(_){}await sleep(200);}throw new Error('timeout');}
function cdp(url){const socket=new WebSocket(url);let sequence=0;const pending=new Map();socket.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id||!pending.has(message.id))return;const item=pending.get(message.id);pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);};return{ready:new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;}),call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});},close(){socket.close();}};}

(async()=>{
  const values=env(),port=await freePort(),tempRoot=process.env.SUTIAPP_TEST_TMP||(fs.existsSync('C:\\tmp')?'C:\\tmp':os.tmpdir()),profile=fs.mkdtempSync(path.join(tempRoot,'sutiapp-financial-visibility-'));
  const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
  let page;
  try{
    const target=await wait(async()=>{const response=await fetch(`http://127.0.0.1:${port}/json/list`);return(await response.json()).find(item=>item.type==='page');});
    page=cdp(target.webSocketDebuggerUrl);await page.ready;await page.call('Page.enable');await page.call('Runtime.enable');
    const evaluate=async expression=>{const result=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'evaluation');return result.result&&result.result.value;};
    await page.call('Page.navigate',{url:'http://localhost:8080/SutiApp.html'});await wait(()=>evaluate("Boolean(document.querySelector('input[type=email]'))"));
    await evaluate("document.querySelector('input[type=email]').focus()");await page.call('Input.insertText',{text:values.H005_TEST_EMAIL});
    await evaluate("document.querySelector('input[type=password]').focus()");await page.call('Input.insertText',{text:values.H005_TEST_PASSWORD});
    await evaluate("document.querySelector('button[type=submit]').click()");await wait(()=>evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'"));
    await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()==='Ahora no');if(button)button.click();return true;})()");
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Admin').click()");await wait(()=>evaluate("window.AdminRepository&&window.AdminRepository.getState().phase==='authorized'&&Boolean(document.querySelector('[data-admin-module=fondos]'))"));
    await evaluate("document.querySelector('[data-admin-module=fondos]').click()");await wait(()=>evaluate("window.fundsStore&&window.fundsStore.status()==='ready'&&document.querySelectorAll('[data-criterion-row]').length>0"));
    const catalog=await evaluate("({classification:document.querySelector('[data-admin-view=fondos]').dataset.adminClassification,rows:document.querySelectorAll('[data-criterion-row]').length,controls:document.querySelectorAll('[data-visibility-control]').length,canRead:window.AdminRepository.has('financial_criteria.visibility.read'),canWrite:window.AdminRepository.has('financial_criteria.visibility.write'),copy:document.body.innerText.includes('Política automática')&&document.body.innerText.includes('Configuración')&&document.body.innerText.includes('Estado efectivo')})");
    await evaluate("document.querySelector('[data-visibility-control]').click()");await wait(()=>evaluate("Boolean(document.querySelector('[data-visibility-editor]'))"));
    const editor=await evaluate("(()=>{const text=document.querySelector('[data-visibility-editor]').innerText;return{auto:text.includes('Automático'),show:text.includes('Mostrar excepcionalmente'),hide:text.includes('Ocultar'),confirm:text.includes('Confirmar cambio')};})()");
    await evaluate("[...document.querySelectorAll('[data-visibility-editor] button')].find(button=>button.textContent.includes('Mostrar excepcionalmente')).click()");
    const reason=await evaluate("Boolean(document.querySelector('[data-visibility-editor] textarea'))");
    if(catalog.classification!=='PRODUCTIVE_GOOGLE_CONTROLLED'||catalog.rows!==146||catalog.controls!==catalog.rows||!catalog.canRead||!catalog.canWrite||!catalog.copy||!editor.auto||!editor.show||!editor.hide||!editor.confirm||!reason)throw new Error('VISIBILITY_BROWSER_CONTRACT_'+JSON.stringify({catalog,editor,reason}));
    await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()==='Ahora no'&&item.offsetParent!==null);if(button)button.click();return true;})()");await sleep(600);
    const shot=await page.call('Page.captureScreenshot',{format:'png'}),screenshot=path.join(root,'screenshots','sutiapp-admin-funds-visibility.png');fs.writeFileSync(screenshot,Buffer.from(shot.data,'base64'));
    console.log(JSON.stringify({status:'PASS',real_browser:true,catalogRows:catalog.rows,adminControls:catalog.controls,permissions:{read:catalog.canRead,write:catalog.canWrite},editorModes:3,reasonRequired:true,googleWrites:0,screenshot}));
  }finally{if(page)page.close();chrome.kill();await sleep(600);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch(_){}}
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exit(1);});
