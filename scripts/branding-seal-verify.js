'use strict';
// H-SUTIAPP-BRANDING-SEAL-PHASE-001 browser verification (read-only).
//   node scripts/branding-seal-verify.js home [--production]   → Home seals render after the full visual bootstrap
//   node scripts/branding-seal-verify.js global [--production] → mandatory global image regression (local build on :8080 or Pages)
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const {env}=require('./voting-live-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/branding-seal-20260917');
const mode=process.argv[2],production=process.argv.includes('--production'),PAGES='https://david14081982.github.io/SutiApp-private/';
const write=(name,data)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2));};

async function home(){
 const values=env(),server=production?null:await serve(),target=production?PAGES+'SutiApp.html':`http://127.0.0.1:${server.address().port}/SutiApp.html`,tag=production?'production':'local';
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await (await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'})).newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addLocatorHandler(page.getByRole('button',{name:'Cerrar',exact:true}),async l=>l.click());
 try{
  await page.goto(target+'#/admin/votaciones',{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.locator('[data-voting-admin]').waitFor({timeout:60000});
  await page.evaluate(()=>{location.hash='#/home';});await page.locator('[data-reveal-key=ecosistema]').waitFor({timeout:60000});
  await page.waitForFunction(()=>window.VisualContent.getState().phase!=='loading',null,{timeout:60000});
  const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.count())await later.first().click().catch(()=>{});
  for(let i=0;i<10;i++){await page.evaluate(()=>{document.querySelectorAll('*').forEach(e=>{if(e.scrollHeight>e.clientHeight+50&&getComputedStyle(e).overflowY!=='visible')e.scrollTop=e.scrollHeight;});});await page.waitForTimeout(300);}
  await page.waitForFunction(()=>{const seals=[...document.querySelectorAll('[data-branding-seal-state]')];return seals.length>0&&seals.every(s=>s.dataset.brandingSealState==='loaded'&&s.querySelector('img')&&s.querySelector('img').complete&&s.querySelector('img').naturalWidth>0);},null,{timeout:30000});
  const result=await page.evaluate(()=>{const s=window.VisualContent.getState();return {phase:s.phase,brandingPhase:s.brandingPhase,seals:[...document.querySelectorAll('[data-branding-seal-state]')].map(e=>({state:e.dataset.brandingSealState,naturalWidth:e.querySelector('img')?.naturalWidth||0}))};});
  assert.equal(result.brandingPhase,'loaded');assert.deepEqual(errors,[]);
  await page.locator('[data-reveal-key=footer]').screenshot({path:path.join(out,tag+'-inicio-pie.png')});
  const data={status:'PASS',target:production?'https://sutiapp.com':'local build + production Supabase',...result,businessWrites:0};write(tag+'-home.json',data);console.log(JSON.stringify(data));
 }catch(e){await page.screenshot({path:path.join(out,tag+'-home-failure.png')}).catch(()=>{});console.error(JSON.stringify({errors,error:e.message}));process.exitCode=1;}
 finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
}

async function global(){
 let server=null;
 if(!production){server=await serve();await new Promise(r=>server.close(r));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8080,'127.0.0.1',resolve);});}
 const target=production?PAGES:'http://localhost:8080/SutiApp.html';
 try{
  const run=await new Promise((resolve,reject)=>{const child=cp.spawn(process.execPath,[path.join(root,'scripts/test-global-image-regression-production-live.js')],{cwd:root,env:{...process.env,SUTIAPP_IMAGE_E2E_URL:target},windowsHide:true});let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));});
  const tag=production?'global-production.json':'global-local.json';
  write(tag,{code:run.code,target,result:run.stdout.trim().split(/\r?\n/).pop(),stderr:run.stderr.slice(-2500)});
  assert.equal(run.code,0,run.stderr.slice(-2500));console.log(JSON.stringify({status:'PASS',global:true,production,summary:JSON.parse(run.stdout.trim().split(/\r?\n/).pop()).status}));
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
}

(mode==='home'?home():mode==='global'?global():Promise.reject(Error('mode: home|global'))).catch(e=>{console.error(e.message);process.exitCode=1;});
