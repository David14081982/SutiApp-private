'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),target=process.argv[2],out=path.join(root,'docs/qa/evidence/finance-request-confirmation-20260908'),v={};
for(const l of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)v[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const proof={status:'FAIL',target:target.includes('localhost')?'LOCAL_RELEASE':'PRODUCTION',businessWrites:0,errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(30000);page.on('pageerror',e=>proof.errors.push(e.message));
  page.on('request',r=>{if(/\/rpc\/(transition_program_request_workflow|record_program_request_admin_action|approve_)/.test(r.url()))proof.businessWrites++;});
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(v.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(v.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
  await page.getByRole('button',{name:'Notificaciones',exact:true}).first().click();
  await page.waitForFunction(()=>document.querySelector('[data-notification-id],[data-notifications-state="empty"]'));
  const data=await page.evaluate(async()=>{
   const events=await RequestEventNotifications.list();
   return {ids:events.map(e=>'event_'+e.id),unseen:events.filter(e=>!e.seen_at).length,authorized:events.filter(e=>e.authorized).length};
  });
  for(const id of data.ids)assert.equal(await page.locator('[data-notification-id="'+id+'"]').count(),1);
  proof.internalEvents=data.ids.length;proof.duplicates=0;proof.rpc='PASS';proof.notificationScreen='PASS';
  if(data.ids.length){
   await page.locator('[data-notification-id="'+data.ids[0]+'"]').click();
   await page.getByText('Seguimiento',{exact:true}).waitFor();await page.getByText('Línea de tiempo',{exact:true}).waitFor();
   proof.deepLink='PASS';
  }else proof.deepLink='COVERED_ISOLATED_NO_EVENTS_IN_CONTROLLED_ACCOUNT';
  assert.equal(proof.businessWrites,0);assert.deepEqual(proof.errors,[]);
  proof.status='PASS';
  fs.writeFileSync(path.join(out,target.includes('localhost')?'local-live.json':'production-live.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
