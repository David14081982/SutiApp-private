'use strict';

const fs=require('fs'),http=require('http'),net=require('net'),path=require('path'),{spawn,spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),chromePath='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function port(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});});}
async function wait(fn,timeout=10000){const end=Date.now()+timeout;let failure;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(error){failure=error;}await sleep(50);}throw failure||new Error('timeout');}
function cdp(url){const socket=new WebSocket(url);let id=0;const pending=new Map();socket.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const item=pending.get(message.id);if(!item)return;pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);};return{ready:new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;}),call(method,params={}){return new Promise((resolve,reject)=>{const requestId=++id;pending.set(requestId,{resolve,reject});socket.send(JSON.stringify({id:requestId,method,params}));});},close(){socket.close();}};}

(async()=>{
  const appPort=await port(),debugPort=await port(),tempRoot=require('os').tmpdir(),profile=fs.mkdtempSync(path.join(tempRoot,'sutiapp-loan-stale-'));
  let server,chrome,protocol,stage='start';
  try{
    server=http.createServer((request,response)=>{const pathname=new URL(request.url,`http://127.0.0.1:${appPort}`).pathname,relative=pathname==='/'?'SutiApp.html':decodeURIComponent(pathname.slice(1)),file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':path.extname(file)==='.js'?'text/javascript':path.extname(file)==='.html'?'text/html':'application/octet-stream','Cache-Control':'no-store'});if(path.extname(file)==='.js')response.end(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));else fs.createReadStream(file).pipe(response);});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(appPort,'127.0.0.1',resolve);});
    chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
    const target=await wait(async()=>{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);return(await response.json()).find(item=>item.type==='page');});
    protocol=cdp(target.webSocketDebuggerUrl);await protocol.ready;await protocol.call('Page.enable');await protocol.call('Runtime.enable');await protocol.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2.75,mobile:true,screenWidth:390,screenHeight:844});
    const evaluate=async expression=>{const result=await protocol.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception&&result.exceptionDetails.exception.description||'evaluation failed');return result.result&&result.result.value;};
    await protocol.call('Page.navigate',{url:`http://127.0.0.1:${appPort}/SutiApp.html?stale-quote-test=1`});
    stage='boot';await wait(()=>evaluate('Boolean(window.React&&window.ReactDOM&&window.StepSimulatorV2)'));

    const bundle=fs.readFileSync(path.join(root,'app/bundle.js'),'utf8');
    const start=bundle.indexOf('/* @@file screens-loan.jsx */'),stop=bundle.indexOf('/* @@file ',start+30);
    const moduleSource=bundle.slice(start,stop).replace('window.StepSimulatorV2 = StepSimulatorV2;', 'window.__ResultCard = ResultCard; window.StepSimulatorV2 = StepSimulatorV2;');
    await evaluate(moduleSource);
    await protocol.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate(`(()=>{document.getElementById('suti-startup-status')?.remove();const host=document.createElement('div');host.id='result-test';host.style.cssText='position:fixed;inset:0;z-index:999999;background:var(--bg);padding:24px 20px;overflow:auto';document.body.appendChild(host);window.__resultRoot=ReactDOM.createRoot(host);})()`);
    const fixtures=[
      {amount:5000,interest:450,administrativeFeeTotal:90,total:5540,paymentPerPeriod:923.33,paymentCount:6,rate:1.5,ratePeriod:'quincenal'},
      {amount:5000.01,interest:450.10,administrativeFeeTotal:90.99,total:5541.10,paymentPerPeriod:461.75,paymentCount:12,rate:1.5,ratePeriod:'quincenal'},
      {amount:1234567.89,interest:98765.01,administrativeFeeTotal:9999.99,total:1343332.89,paymentPerPeriod:1343332.89,paymentCount:1,rate:12.75,ratePeriod:'quincenal'}
    ];
    const evidence=path.join(root,'docs/qa/evidence/loan-result-responsive-20260925');fs.mkdirSync(evidence,{recursive:true});
    const proofs=[];
    async function render(result,preference,state='ready'){
      await evaluate(`(()=>{const host=document.getElementById('result-test');host.setAttribute('data-text-size',${JSON.stringify(preference)});window.__resultRoot.render(React.createElement(window.__ResultCard,{result:${JSON.stringify(result)},initialLoading:${state==='loading'},updating:${state==='updating'},failed:${state==='error'},animationCycle:1,loadingCycle:'fixture'}));})()`);
      await sleep(70);
    }
    for(const width of [280,320,360,390,430,768])for(const preference of ['small','normal','large','largest'])for(const fixture of fixtures){
      stage=`matrix ${width}/${preference}/${fixture.paymentCount}`;
      await protocol.call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await render(fixture,preference);
      const proof=await evaluate(`(()=>{const card=document.querySelector('#result-test [data-simulator-result]'),top=card.querySelector('.su-result-top'),meta=card.querySelector('.su-result-meta'),cells=[...card.querySelector('.su-result-cells').children];const bounds=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};return{top:[...top.children].map(bounds),cells:cells.map(bounds),align:getComputedStyle(meta).textAlign,meta:meta.textContent,labels:[...card.querySelectorAll('[role=img]')].map(n=>n.getAttribute('aria-label')),overflows:[...card.querySelectorAll('.su-result-fit')].filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.textContent),height:card.getBoundingClientRect().height,background:getComputedStyle(card).backgroundImage};})()`);
      const money=value=>'$'+value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).replace(/\.00$/,'');
      const expected=[fixture.paymentPerPeriod,fixture.amount,fixture.interest,fixture.administrativeFeeTotal,fixture.total].map(money);
      if(proof.overflows.length||proof.align!=='right'||proof.top[1].x<proof.top[0].right-1||proof.cells.some(c=>Math.abs(c.y-proof.cells[0].y)>1)||JSON.stringify(proof.labels)!==JSON.stringify(expected)||!proof.meta.includes(fixture.paymentCount+(fixture.paymentCount===1?' pago':' pagos'))||!proof.background.includes('gradient'))throw Error(JSON.stringify({proof,expected}));
      proofs.push({width,preference,payments:fixture.paymentCount,height:proof.height,status:'PASS'});
      if(width===390&&preference==='normal'&&fixture.paymentCount===6){const shot=await protocol.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'result-390.png'),Buffer.from(shot.data,'base64'));}
    }
    for(const state of ['loading','updating','error']){await render(null,'largest',state);const overflow=await evaluate(`Array.from(document.querySelectorAll('#result-test .su-result-fit')).some(n=>n.scrollWidth>n.clientWidth+1)`);if(overflow)throw Error('state overflow '+state);}
    fs.writeFileSync(path.join(evidence,'responsive.json'),JSON.stringify({status:'PASS',isolated:true,cases:proofs.length,proofs,states:['loading','updating','error'],zeroCentsHidden:true,nonzeroCentsPreserved:true},null,2)+'\n');
    console.log(JSON.stringify({status:'PASS',cases:proofs.length,states:3,layout:'2 top / 4 bottom',noOverflow:true}));
  }catch(error){throw new Error(stage+': '+error.message);}finally{if(protocol)protocol.close();if(chrome){spawnSync('taskkill.exe',['/PID',String(chrome.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});await sleep(300);}if(server)await new Promise(resolve=>server.close(resolve));if(profile.startsWith(tempRoot+path.sep))try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});}catch(_){}}
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
