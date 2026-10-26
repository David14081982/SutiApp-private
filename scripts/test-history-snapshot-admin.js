'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const flush=async page=>{await page.clock.runFor(30);await page.evaluate(()=>Promise.resolve());};
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const checks=[];try{
  for(const width of [320,1280]){
   const page=await browser.newPage({viewport:{width,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort());
   await page.clock.install({time:new Date('2026-10-26T19:00:00Z')});await page.setContent('<div id="root"></div>');
   for(const file of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read('app/vendor/'+file)});
   await page.evaluate(()=>{
    window.context=1;window.calls=[];window.pending=[];window.delay=false;
    window.syncStatus={enabled:true,can_sync:true,source_updated_at:'2026-10-26T18:00:00Z',sync_state:{status:'READY'},source_metadata:{}};
    window.PrivateResourceDemand={context:()=>context,useContext:()=>context};
    window.SutiSupabase={getClient:()=>({rpc:async name=>{
     calls.push(name);if(name==='request_admin_loan_history_sync'){syncStatus.sync_state.status='QUEUED';return {data:{accepted:true,coalesced:false,run_id:'r1',sync_state:{status:'QUEUED'}}};}
     const response={data:JSON.parse(JSON.stringify(syncStatus))};return delay?new Promise(resolve=>pending.push(()=>resolve(response))):response;
    }})};
   });
   await page.addScriptTag({content:read('app/history-sync-admin.js')});
   await page.evaluate(()=>{window.root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(HistorySyncAdmin,{key:context}));render();});await flush(page);
   const control=page.locator('[data-history-sync="admin"]'),button=control.locator('[data-history-sync-action="refresh"]');
   assert.match(await control.innerText(),/3:00 p. m./);assert.equal(await button.isEnabled(),true);
   await page.clock.runFor(1800000);await flush(page);assert.equal(await page.evaluate(()=>calls.length),1,'no idle admin polling');
   await page.evaluate(()=>{const b=document.querySelector('[data-history-sync-action]');b.click();b.click();});await flush(page);
   assert.equal(await page.evaluate(()=>calls.filter(x=>x==='request_admin_loan_history_sync').length),1);assert.equal(await button.isDisabled(),true);
   assert.match(await control.innerText(),/pueden seguir consultando/);
   await page.evaluate(()=>{syncStatus.sync_state.status='READY';syncStatus.source_updated_at='2026-10-26T20:00:00Z';});await page.clock.runFor(5000);await flush(page);assert.equal(await button.isEnabled(),true);
   const count=await page.evaluate(()=>calls.length);await page.clock.runFor(1800000);await flush(page);assert.equal(await page.evaluate(()=>calls.length),count,'completed job stops admin checks');
   await page.evaluate(()=>{delay=true;syncStatus.sync_state.status='RUNNING';document.dispatchEvent(new Event('visibilitychange'));});await flush(page);
   await page.evaluate(()=>{syncStatus.sync_state.status='READY';document.dispatchEvent(new Event('visibilitychange'));});await flush(page);
   await page.evaluate(()=>pending.pop()());await flush(page);await page.evaluate(()=>{delay=false;pending.pop()();});await flush(page);
   const raced=await page.evaluate(()=>calls.length);assert.equal(await button.isEnabled(),true);await page.clock.runFor(1800000);await flush(page);assert.equal(await page.evaluate(()=>calls.length),raced,'out-of-order status does not restore RUNNING or duplicate timers');
   await page.evaluate(()=>{context++;syncStatus.can_sync=false;render();});await flush(page);assert.equal(await button.count(),0,'backend read-only status hides writer');
   await page.evaluate(()=>{context++;syncStatus.can_sync=true;syncStatus.enabled=false;render();});await flush(page);assert.equal(await button.isDisabled(),true);
   await page.evaluate(()=>{context++;syncStatus.enabled=true;syncStatus.sync_state.status='FAILED';render();});await flush(page);assert.match(await control.innerText(),/Se conserva la información/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no mobile overflow');
   await page.evaluate(()=>{context++;delay=true;render();});await flush(page);
   await page.evaluate(()=>{context++;delay=false;syncStatus.can_sync=false;render();});await flush(page);await page.evaluate(()=>pending.splice(0).forEach(fn=>fn()));await flush(page);assert.equal(await button.count(),0,'stale context cannot restore write button');
   assert.deepEqual(errors,[]);checks.push({width,status:'PASS',dailyClock:true,manualSingleFlight:true,boundedActiveChecks:true,noIdlePolling:true,readonly:true,disabled:true,failureVisible:true,staleContextRejected:true});await page.close();
  }
 }finally{await browser.close();}
 const result={status:'PASS',checks},out=path.join(root,'docs/qa/evidence/history-snapshot');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'admin.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
