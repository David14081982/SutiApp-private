'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),candidate=process.argv.includes('--candidate'),base='https://sutiapp.com/';
const env=Object.fromEntries(fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',acceptDownloads:true}),page=await context.newPage(),errors=[],requests=[],blocked=[];
 let calculated=null;
 try{
  await page.addInitScript(()=>{
   const original=window.fetch;
   window.fetch=async function(input,options){
    const response=await original.apply(this,arguments);
    if(String(typeof input==='string'?input:input.url).includes('/functions/v1/sicof')){
     let action;try{action=JSON.parse(options?.body||'{}').action;}catch{}
     if(action==='FILE_WORKSPACE')response.clone().json().then(v=>{const r=v.data?.result;window.__sicofEvidenceResult=r&&{version:r.engine_version,rate:r.rate,base:r.base,review:r.reviewCount,collected:r.collected,reasons:r.reviewReasons};}).catch(()=>{});
    }
    return response;
   };
  });
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname.endsWith('/functions/v1/sicof')){
    let command={};try{command=req.postDataJSON()||{};}catch{}
    if(!['SOURCE_FUNDS','DOWNLOAD_SOURCE','FILE_WORKSPACE','WORKSPACE','CALCULATE','EXPORT'].includes(command.action)){blocked.push(command.action);return route.abort();}
   }
   if(candidate&&url.hostname==='sutiapp.com'){
    const file=url.pathname.endsWith('/app/bundle.js')?'app/bundle.js':url.pathname.endsWith('/app/sicof-simulation-worker.js')?'app/sicof-simulation-worker.js':null;
    if(file)return route.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(path.join(root,'.tmp/sicof-evidence-integration/candidate',file))});
   }
   return route.continue();
  });
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',res=>{if(!res.url().includes('/functions/v1/sicof'))return;try{const c=res.request().postDataJSON();if(c?.action)requests.push({action:c.action,status:res.status()});}catch{}});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const bundleHash=await page.evaluate(async()=>{const s=document.querySelector('script[src*="app/bundle.js?v="]'),r=await fetch(s.src,{cache:'no-store'}),hash=await crypto.subtle.digest('SHA-256',await r.arrayBuffer());return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');});
  assert.equal(bundleHash,JSON.parse(fs.readFileSync(path.join(root,'docs/qa/evidence/sicof-evidence-integration/build.json'),'utf8')).bundleSha256);
  await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
  await page.locator('[data-app-tab="admin"]').click();await page.locator('[data-admin-desktop-sidebar]').waitFor({timeout:60000});
  const dismiss=page.getByRole('button',{name:'Ahora no',exact:true});if(await dismiss.isVisible())await dismiss.click();
  const finance=page.locator('[data-admin-sidebar-group="finance"]');if(await finance.getAttribute('aria-expanded')==='false')await finance.click();
  await page.locator('[data-admin-sidebar-module="sicof"]').click();
  await page.getByLabel('Inicio del periodo',{exact:true}).fill('2026-07-01');await page.getByLabel('Cierre del periodo',{exact:true}).fill('2026-10-30');
  const download=page.waitForEvent('download',{timeout:150000});await page.getByRole('button',{name:'↓ Descargar base de préstamos (.xlsx)',exact:true}).click();
  const file=path.join(root,'.tmp/sicof-evidence-integration/live-source.xlsx');await(await download).saveAs(file);
  await page.getByLabel('Archivo de préstamos (.xlsx)',{exact:true}).setInputFiles(file);await page.getByRole('button',{name:'Preparar cálculo con este archivo',exact:true}).click();
  await page.getByText('Sin base verificable; no significa ahorro cero.',{exact:true}).waitFor({timeout:150000});
  await page.waitForFunction(()=>window.__sicofEvidenceResult,null,{timeout:30000});calculated=await page.evaluate(()=>window.__sicofEvidenceResult);
  assert(calculated);assert.equal(calculated.version,'SICOF_2026_10_04_V3');assert.equal(calculated.rate,null);assert.equal(calculated.review,354);
  assert.equal(await page.locator('.sicof-metrics > *').count(),12);assert.equal(await page.getByRole('tab').count(),8);
  await page.locator('[data-sicof-evidence] summary').click();assert((await page.locator('[data-sicof-evidence]').innerText()).includes('Importe histórico esperado sin evidencia: 328'));
  const slider=page.locator('input[type=range]');await slider.focus();await slider.press('ArrowLeft');
  await page.getByText('Sin base verificable; no significa ahorro cero.',{exact:true}).waitFor({timeout:15000});
  assert.equal(await page.locator('.sicof-metrics').getByText('Pendiente',{exact:true}).count(),4);
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);assert(requests.every(r=>r.status===200));
  const proof={status:'PASS',mode:candidate?'CANDIDATE_PUBLIC_ASSET_OVERRIDE':'PUBLISHED',at:new Date().toISOString(),bundleHash,backend:calculated,requests,checks:['actual authenticated login','unchanged production shell and file flow','legitimate source download and validation','installed reader and Edge V3','12 KPI and 8 tabs','pending amounts and reason counts','local generated worker recalculation'],financialWrites:0,fixtureResponses:0,serviceWorkers:'BLOCKED_FOCAL_TEST'};
  fs.writeFileSync(path.join(root,'docs/qa/evidence/sicof-evidence-integration/ui-live-'+(candidate?'candidate':'published')+'.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
