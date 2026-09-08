'use strict';
// Real authenticated client, repositories, store and TrackingScreen against retained controlled QA requests.
// review/decide use the existing focused backend acceptance; status is read-only for production verification.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,{spawn}=require('child_process');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'status',target=process.argv[3]||'http://localhost:8080',env={};
const folder=path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908');
for(const line of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE||'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)env[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
async function main(){
 assert(['review','decide','status'].includes(mode));const rows=JSON.parse(fs.readFileSync(path.join(folder,'live-requests.json'),'utf8'));assert.equal(rows.length,9);
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),proof={status:'FAIL',mode,target:target.includes('localhost')?'local':'production',dataSource:'live authenticated self RPC and realtime; no intercepted responses',javascriptErrors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(45000);page.on('pageerror',e=>proof.javascriptErrors.push(e.message));
  await page.goto(target+'/SutiApp.html',{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
  await page.evaluate(rows=>{
    window.__qaRows=rows;window.__qaChanges=[];window.__qaEvents=[];window.__qaSubscribed=false;const previous=new Map();
    window.__qaStop=operationsStore.subscribe(()=>{for(const row of operationsStore.all()){if(!rows.some(r=>r.id===row.sourceId))continue;if(previous.get(row.sourceId)!==row.requestStatus){previous.set(row.sourceId,row.requestStatus);__qaChanges.push({id:row.sourceId,status:row.requestStatus,time:Date.now()});}}});
    window.__qaChannel=SutiSupabase.getClient().channel('qa-request-delivery').on('postgres_changes',{event:'UPDATE',schema:'public',table:'program_requests'},event=>{if(rows.some(r=>r.id===event.new.id))__qaEvents.push({id:event.new.id,status:event.new.status,time:Date.now()});}).subscribe(status=>window.__qaSubscribed=status==='SUBSCRIBED');
    const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:999999;background:white;display:flex;gap:12px';document.body.appendChild(host);
    const app={back:()=>{},toast:()=>{}};
    ReactDOM.createRoot(host).render(React.createElement(React.Fragment,null,...rows.filter(r=>r.branch==='approve').map(row=>React.createElement('section',{key:row.id,'data-qa-family':row.family,style:{position:'relative',flex:1,minWidth:0}},React.createElement(TrackingScreen,{app,params:{s:{sourceId:row.id}}})))));
  },rows);
  await page.waitForFunction(()=>__qaSubscribed&&operationsStore.state().phase==='loaded'&&__qaRows.every(r=>operationsStore.all().some(s=>s.sourceId===r.id)));
  proof.before=await page.evaluate(()=>operationsStore.all().filter(s=>__qaRows.some(r=>r.id===s.sourceId)).map(s=>({id:s.sourceId,status:s.requestStatus})));
  if(mode!=='status')await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'test-requests-workflow-google-sync-live.js'),mode],{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));child.on('exit',code=>code===0?resolve():reject(Error('LIVE_ACTION_PHASE_FAILED')));child.on('error',reject);});
  const finalRows=JSON.parse(fs.readFileSync(path.join(folder,'live-requests.json'),'utf8'));
  await page.waitForFunction(rows=>rows.every(r=>operationsStore.all().some(s=>s.sourceId===r.id&&s.requestStatus===r.status)),finalRows);
  for(const family of ['loan','membership','service']){
    const status=finalRows.find(r=>r.family===family&&r.branch==='approve').status;await page.locator('[data-qa-family='+family+']').getByText({in_review:'En revisión',approved:'Aprobada'}[status],{exact:true}).waitFor();
  }
  const observed=await page.evaluate(()=>({changes:__qaChanges,events:__qaEvents}));proof.changes=observed.changes;proof.realtimeEvents=observed.events.length;
  if(mode!=='status'){
    proof.latencies=finalRows.map(row=>{const event=observed.events.find(e=>e.id===row.id&&e.status===row.status),change=observed.changes.find(e=>e.id===row.id&&e.status===row.status);assert(event&&change,'REALTIME_OR_STORE_CHANGE_MISSING');return {id:row.id,status:row.status,milliseconds:Math.max(0,change.time-event.time)};});
    assert(proof.latencies.every(x=>x.milliseconds<5000),'REALTIME_UPDATE_TOO_SLOW');
  }
  assert.equal(proof.javascriptErrors.length,0);proof.status='PASS';
 }catch(error){proof.error=/^[A-Z_]+$/.test(error.message)?error.message:'LIVE_BROWSER_ACCEPTANCE_FAILED';throw error;}
 finally{fs.writeFileSync(path.join(folder,'realtime-'+proof.target+'-'+mode+'.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));await browser.close();}
}
main().catch(()=>{process.exitCode=1;});
