'use strict';
// Reads existing authorized requests/documents. Never submits, approves, uploads or edits records.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),target=process.argv[2]||'http://localhost:8080';
const envFile=process.env.SUTIAPP_TEST_ENV_FILE||path.join(root,'supabase.env'),values={};
for(const line of fs.readFileSync(envFile,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0)values[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const evidence=path.join(root,'docs/qa/evidence/admin-request-images-20260908');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const result={status:'FAIL',target:target.includes('localhost')?'LOCAL_CANDIDATE':'PRODUCTION',started:new Date().toISOString(),types:{},signedRequests:0,storageFailures:[],businessWrites:0};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(30000);
  page.on('request',req=>{const url=req.url();if(url.includes('/functions/v1/document-access'))result.signedRequests++;if(/\/rpc\/(?:transition_program_request_workflow|record_program_request_admin_action|register_.*document|approve_)/.test(url))result.businessWrites++;});
  page.on('response',res=>{if(res.url().includes('/storage/v1/object/sign/')&&res.status()>=400)result.storageFailures.push(res.status());});
  await page.goto(target.replace(/\/$/,'')+'/SutiApp.html',{waitUntil:'domcontentloaded'});
  assert(await page.locator('script[src*="bundle.js?v=227"]').count(),'candidate version missing');
  await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
  const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.click();
  await page.waitForFunction(()=>window.AdminRepository?.getState().phase==='authorized');await page.locator('[data-admin-module=finanzas]').click();
  await page.waitForSelector('[data-financial-queue-row]');
  const targets=await page.evaluate(async()=>{const rows=await ProgramRequestRepository.listAdminFlowQueue();return Object.fromEntries([['loan',r=>r.program_id==='prestamo'],['membership',r=>!!r.membership_offering_id],['quote',r=>r.request_type==='quote'&&r.program_id!=='prestamo'],['benefit',r=>r.request_type==='benefit'&&!r.membership_offering_id&&r.program_id!=='prestamo']].map(([kind,pick])=>[kind,rows.find(pick)?.id||null]));});
  for(const [kind,id] of Object.entries(targets)){
   assert(id,kind+' legitimate request unavailable');await page.locator('[data-financial-queue-row="'+id+'"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-financial-documents]'));
   await page.waitForFunction(()=>document.querySelectorAll('.finwb-doc').length>0&&![...document.querySelectorAll('.finwb-doc-main')].some(n=>/Preparando vista segura/.test(n.innerText)),null,{timeout:60000});
   const proof=await page.evaluate(()=>{const rows=[...document.querySelectorAll('.finwb-doc')],images=[...document.querySelectorAll('.finwb-doc img')];return {rows:rows.length,images:images.length,decoded:images.filter(i=>i.complete&&i.naturalWidth>0).length,errors:rows.filter(n=>n.innerText.includes('Vista no disponible')).length,pdfs:document.querySelectorAll('.finwb-doc iframe').length,sections:!!document.querySelector('[data-financial-documents]')&&!!document.querySelector('[data-financial-current-documents]'),history:!!document.querySelector('[data-financial-timeline]'),workflow:!!document.querySelector('[data-financial-workflow]')};});
   result.types[kind]=proof;assert.equal(proof.decoded,proof.images,kind+' image decode');assert.equal(proof.errors,0,kind+' preview errors');assert(proof.sections&&proof.history&&proof.workflow,kind+' structure');
   if(kind==='loan'){
    const calls=result.signedRequests;await page.waitForTimeout(2500);assert.equal(result.signedRequests,calls,'idle refetch');
    await page.getByRole('button',{name:'Ampliar',exact:true}).first().click();await page.waitForSelector('[data-image-viewer]');
    await page.waitForFunction(()=>{const i=document.querySelector('[data-image-viewer] img');return i?.complete&&i.naturalWidth>0;});
    await page.getByRole('button',{name:'Cerrar',exact:true}).click();result.fullscreen='PASS';
   }
  }
  await page.setViewportSize({width:430,height:932});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);result.mobile='PASS';
  assert.equal(result.businessWrites,0);result.status='PASS';
 }catch(error){result.error=String(error.message).replace(/https?:\/\/\S+/g,'[URL]').slice(0,1200);throw error;}
 finally{result.ended=new Date().toISOString();fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,result.target.toLowerCase()+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await browser.close();}
}
main().catch(()=>{process.exitCode=1;});
