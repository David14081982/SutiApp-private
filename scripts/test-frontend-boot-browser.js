'use strict';
const fs=require('fs'),net=require('net'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const chromePath='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl='http://localhost:8080/SutiApp.html';
const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
function env(){const out={};for(const raw of fs.readFileSync(path.resolve(__dirname,'..','supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
function port(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});});}
async function wait(fn,timeout=30000){const end=Date.now()+timeout;let error;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(e){error=e;}await sleep(200);}throw error||new Error('timeout');}
function cdp(url,onEvent){const ws=new WebSocket(url);let sequence=0,readyResolve,readyReject;const pending=new Map(),ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});const fail=(error)=>{readyReject(error);for(const item of pending.values())item.reject(error);pending.clear();};ws.onopen=readyResolve;ws.onerror=()=>fail(new Error('Chrome DevTools WebSocket error'));ws.onclose=()=>fail(new Error('Chrome DevTools WebSocket closed'));ws.onmessage=(event)=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const item=pending.get(message.id);pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);return;}if(message.method)onEvent(message.method,message.params||{});};return{ready,call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},30000);pending.set(id,{resolve:(value)=>{clearTimeout(timer);resolve(value);},reject:(error)=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params}));});},close(){ws.close();}};}
async function main(){
  const full=process.argv.includes('--full'),values=full?env():{};
  const debugPort=await port(),tempRoot=process.env.SUTIAPP_TEST_TMP||(fs.existsSync('C:\\tmp')?'C:\\tmp':os.tmpdir());fs.mkdirSync(tempRoot,{recursive:true});const profile=fs.mkdtempSync(path.join(tempRoot,'sutiapp-boot-'));
  const events={console:[],exceptions:[],requests:[],responses:[],failed:[],logs:[],serviceWorker:[]},requestUrls=new Map();
  const chrome=spawn(chromePath,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-allow-origins=*',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stderr='';chrome.stderr.on('data',(chunk)=>{stderr+=chunk.toString();});let page,diagnostics={};
  try{
    const target=await wait(async()=>{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);return(await response.json()).find((item)=>item.type==='page');});
    page=cdp(target.webSocketDebuggerUrl,(method,params)=>{
      if(method==='Runtime.consoleAPICalled')events.console.push({type:params.type,args:(params.args||[]).map((arg)=>arg.value??arg.description)});
      else if(method==='Runtime.exceptionThrown')events.exceptions.push(params.exceptionDetails);
      else if(method==='Network.requestWillBeSent'){requestUrls.set(params.requestId,params.request.url);events.requests.push({url:params.request.url,method:params.request.method,type:params.type});}
      else if(method==='Network.responseReceived')events.responses.push({url:params.response.url,status:params.response.status,mimeType:params.response.mimeType,fromServiceWorker:params.response.fromServiceWorker});
      else if(method==='Network.loadingFailed')events.failed.push({url:requestUrls.get(params.requestId)||null,errorText:params.errorText,type:params.type,canceled:Boolean(params.canceled)});
      else if(method==='Log.entryAdded')events.logs.push(params.entry);
      else if(method.startsWith('ServiceWorker.'))events.serviceWorker.push({method,params});
    });
    await page.ready;
    for(const method of ['Page.enable','Runtime.enable','Network.enable','Log.enable','ServiceWorker.enable'])await page.call(method);
    await page.call('Page.navigate',{url:targetUrl});await sleep(7000);
    const evaluate=async(expression)=>{const result=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception&&result.exceptionDetails.exception.description||result.exceptionDetails.text);return result.result&&result.result.value;};
    const initial=await evaluate(`({readyState:document.readyState,title:document.title,rootHtml:document.getElementById('root')&&document.getElementById('root').innerHTML,bodyText:document.body.innerText,loginVisible:Boolean(document.querySelector('input[type=email]')&&document.querySelector('input[type=password]')),globals:{React:Boolean(window.React),ReactDOM:Boolean(window.ReactDOM),supabase:Boolean(window.supabase),client:Boolean(window.SutiSupabase),affiliateRepository:Boolean(window.AffiliateRepository),financialLegacy:Boolean(window.FinancialLegacyRepository),affiliateAuth:Boolean(window.AffiliateAuth),programCatalog:Boolean(window.ProgramCatalogRepository)}})`);
    let flow=null;
    if(full){
      if(!values.H005_TEST_EMAIL||!values.H005_TEST_PASSWORD)throw new Error('H005_TEST credentials are unavailable');
      const status={loginVisible:initial.loginVisible,login:false,home:false,navigation:false,profile:false,credential:false,union:false,loan:false,convenios:false,finanzas:false,admin:false,adminAvailable:false,adminPending:false,adminCopy:false,adminFinance:false,adminApprovals:false,adminFunds:false,refresh:false,logout:false,returnedToLogin:false};
      await wait(()=>evaluate("Boolean(document.querySelector('input[type=email]')&&document.querySelector('input[type=password]'))"),30000);
      await evaluate("document.querySelector('input[type=email]').focus()");await page.call('Input.insertText',{text:values.H005_TEST_EMAIL});
      await evaluate("document.querySelector('input[type=password]').focus()");await page.call('Input.insertText',{text:values.H005_TEST_PASSWORD});
      await evaluate("document.querySelector('button[type=submit]').click()");
      await wait(()=>evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'"),30000);status.login=true;
      status.home=await wait(()=>evaluate("Boolean(document.querySelector('[data-affiliate-field=topbar-name]'))"),30000);
      status.navigation=await evaluate("['Inicio','Finanzas','Convenios','Admin'].every(label=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===label))");
      await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.style.borderRadius==='50%');if(!button)throw new Error('PROFILE_TRIGGER_MISSING');button.click();return true;})()");
      status.profile=await wait(()=>evaluate("document.body.innerText.includes('Mi Perfil')&&document.body.innerText.includes('Cerrar sesión')"));
      await evaluate("document.querySelector('[data-h006=profile-back]').click()");
      await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Credencial').click()");
      status.credential=await wait(()=>evaluate("Boolean(document.querySelector('[data-affiliate-field=credential-name]'))&&document.body.innerText.includes('Identidad cargada desde Supabase')"),30000);
      await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Inicio').click()");
      status.union=await wait(()=>evaluate("document.querySelectorAll('[data-h007-nav]').length===9&&[...document.querySelectorAll('[data-h007-nav]')].every(item=>Boolean(item.dataset.unionAuthority))"),30000);
      await evaluate("document.querySelector('[data-h007-nav=categoria]').click()");
      status.union=await wait(()=>evaluate("Boolean(document.querySelector('[data-h007-module=categoria]'))&&!document.querySelector('[data-h007-module-state=loading]')"),30000);
      await evaluate("document.querySelector('[data-h007-module=categoria] button').click()");
      await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Convenios').click()");
      status.convenios=await wait(()=>evaluate("Boolean(document.querySelector('[data-convenios-state=loaded]'))"),30000);
      await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Finanzas').click()");
      status.finanzas=await wait(()=>evaluate("document.body.innerText.includes('Mi Financiera')&&document.body.innerText.includes('Bienestar y experiencias')"),30000);
      await evaluate("document.querySelector('button[aria-label=\"Solicitar préstamo\"]').click()");
      status.loan=await wait(()=>evaluate("Boolean(document.querySelector('[data-step-simulator-v2]'))&&document.body.innerText.includes('Simula tu préstamo')"),30000);
      await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Admin').click()");
      status.admin=await wait(()=>evaluate("window.AdminRepository&&window.AdminRepository.getState().phase==='authorized'&&document.body.innerText.includes('Panel Administrativo')"),30000);
      const adminState=await evaluate("({supabase:document.querySelectorAll('[data-admin-status=PRODUCTIVE_SUPABASE]').length,hybrid:document.querySelectorAll('[data-admin-status=PRODUCTIVE_HYBRID]').length,google:document.querySelectorAll('[data-admin-status=PRODUCTIVE_GOOGLE_READONLY]').length,controlled:document.querySelectorAll('[data-admin-status=PRODUCTIVE_GOOGLE_CONTROLLED]').length,financial:document.querySelectorAll('[data-admin-status=BLOCKED_FINANCIAL_LEGACY]').length,owner:document.querySelectorAll('[data-admin-status=OWNER_DECISION_REQUIRED]').length,text:document.body.innerText})");
      status.adminAvailable=adminState.supabase>0&&adminState.hybrid>0&&adminState.google===0&&adminState.controlled===1;
      status.adminPending=adminState.financial===0&&adminState.owner===0;
      status.adminCopy=!/EN PREPARACIÓN|DECISIÓN REQUERIDA|PENDING BACKEND|Requires backend|pendiente legacy/i.test(adminState.text);
      await evaluate("document.querySelector('[data-admin-module=finanzas]').click()");status.adminFinance=await wait(()=>evaluate("Boolean(document.querySelector('[data-admin-view=finanzas]'))"));await evaluate("document.querySelector('[data-admin-view=finanzas] button').click()");
      await wait(()=>evaluate("Boolean(document.querySelector('[data-admin-module=aprobaciones]'))"));await evaluate("document.querySelector('[data-admin-module=aprobaciones]').click()");status.adminApprovals=await wait(()=>evaluate("Boolean(document.querySelector('[data-admin-view=aprobaciones]'))"));await evaluate("document.querySelector('[data-admin-view=aprobaciones] button').click()");
      await wait(()=>evaluate("Boolean(document.querySelector('[data-admin-module=fondos]'))"));await evaluate("document.querySelector('[data-admin-module=fondos]').click()");await wait(()=>evaluate("document.querySelector('[data-admin-view=fondos]')&&document.querySelector('[data-admin-view=fondos]').dataset.adminClassification==='PRODUCTIVE_GOOGLE_CONTROLLED'"));await wait(()=>evaluate("window.fundsStore&&['ready','error'].includes(window.fundsStore.status())"),30000);diagnostics.funds=await evaluate("({phase:window.fundsStore.status(),rows:document.querySelectorAll('[data-criterion-row]').length,controls:document.querySelectorAll('[data-visibility-control]').length,canRead:window.AdminRepository.has('financial_criteria.visibility.read'),canWrite:window.AdminRepository.has('financial_criteria.visibility.write'),error:window.fundsStore.error()&&window.fundsStore.error().message})");status.adminFunds=diagnostics.funds.phase==='ready'&&diagnostics.funds.rows>0&&diagnostics.funds.controls>0&&diagnostics.funds.canWrite;await evaluate("document.querySelector('[data-admin-view=fondos] button').click()");
      await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Inicio').click()");
      await page.call('Page.reload',{ignoreCache:false});
      status.refresh=await wait(()=>evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'&&Boolean(document.querySelector('[data-affiliate-field=topbar-name]'))"),30000);
      await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.style.borderRadius==='50%');if(!button)throw new Error('PROFILE_TRIGGER_MISSING_AFTER_REFRESH');button.click();return true;})()");
      await wait(()=>evaluate("document.body.innerText.includes('Mi Perfil')"));
      await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Cerrar sesión').click()");
      status.logout=await wait(()=>evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='unauthenticated'&&Boolean(document.querySelector('input[type=email]'))"),30000);
      await page.call('Page.reload',{ignoreCache:false});
      status.returnedToLogin=await wait(()=>evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='unauthenticated'&&Boolean(document.querySelector('input[type=email]'))"),30000);
      flow=status;
    }
    const important=(url)=>/SutiApp\.html|app\/bundle\.js|supabase-config\.js|supabase-client\.js|affiliate-repository\.js|financial-legacy-repository\.js|supabase\.co|sw\.js/.test(url);
    const flowPass=!flow||Object.values(flow).every(Boolean),fatalFailed=events.failed.filter((item)=>item.url&&item.url.startsWith('http://localhost:8080/')&&!item.canceled),expectedAuthorizationLog=(item)=>/supabase\.co\/rest\/v1\//.test(item.url||'')&&/status of (401|403)/.test(item.text||''),fatalLogs=events.logs.filter((item)=>item.level==='error'&&!/managed_copy_overrides|functions\/v1\/financial-legacy/.test(`${item.url||''} ${item.text||''}`)&&!expectedAuthorizationLog(item));
    const cloud=full?{auth:events.responses.some((item)=>/supabase\.co\/auth\/v1\/(token|user)/.test(item.url)&&item.status<400),db:events.responses.some((item)=>/supabase\.co\/rest\/v1\//.test(item.url)&&item.status<400),storage:events.responses.some((item)=>/supabase\.co\/storage\/v1\//.test(item.url)&&item.status<400),legacyControlled:events.logs.some((item)=>/functions\/v1\/financial-legacy/.test(item.url||item.text||''))}:null;
    const network=full?{coreResponses:events.responses.filter((item)=>item.url.startsWith('http://localhost:8080/')),cloud,failed:events.failed}:{requests:events.requests.filter((item)=>important(item.url)),responses:events.responses.filter((item)=>important(item.url)),failed:events.failed};
    const output={status:initial.loginVisible&&flowPass&&events.exceptions.length===0&&fatalFailed.length===0&&fatalLogs.length===0?'PASS':'FAIL',url:targetUrl,runtime:full?{readyState:initial.readyState,title:initial.title,loginVisible:initial.loginVisible,globals:initial.globals}:initial,flow,diagnostics,console:events.console,exceptions:events.exceptions.map((item)=>({text:item.text,lineNumber:item.lineNumber,columnNumber:item.columnNumber,url:item.url,exception:item.exception&&item.exception.description,stackTrace:item.stackTrace})),network,logs:events.logs,serviceWorker:full?{events:events.serviceWorker.length,activated:events.serviceWorker.some((item)=>JSON.stringify(item).includes('activated'))}:events.serviceWorker,chromeStderr:stderr.slice(-4000)};
    fs.writeSync(1,JSON.stringify(process.argv.includes('--summary')?{status:output.status,flow:output.flow,diagnostics:output.diagnostics,cloud:output.network&&output.network.cloud,exceptions:output.exceptions.length,failedRequests:output.network&&output.network.failed?output.network.failed.map(item=>({url:item.url,errorText:item.errorText,canceled:item.canceled})):[],errorLogs:output.logs.filter(item=>item.level==='error').map(item=>({url:item.url,text:item.text}))}:output,null,2)+'\n');if(output.status!=='PASS')process.exitCode=1;
  }catch(error){error.message+=`\nChrome stderr: ${stderr.slice(-2000)}`;throw error;}finally{
    if(page)page.close();chrome.kill();await Promise.race([new Promise((resolve)=>chrome.once('exit',resolve)),sleep(2000)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch(_){}
  }
}
const keepAlive=setInterval(()=>{},1000);
main().catch((error)=>{fs.writeSync(2,JSON.stringify({status:'FAIL',harnessError:error.stack||error.message})+'\n');process.exitCode=1;}).finally(()=>clearInterval(keepAlive));
