'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),a=require(path.join(root,'docs/qa/evidence/disk-io-remediation/H05/audit.cjs'));
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const mode=process.argv[2]||'local',target=mode==='local'?'http://localhost:8080/':'https://david14081982.github.io/SutiApp-private/';
const participantCase=process.argv.includes('--participant');
let stage='initial';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 const e=a.env(),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 let page,impersonating=false;
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});page=await context.newPage();let calls=[],tasks=[];const errors=[];
 page.on('pageerror',error=>errors.push(error.message.slice(0,160)));
 page.on('response',r=>{if(/\/rpc\/get_self_savings_(live_readonly|if_changed)$/.test(new URL(r.url()).pathname)){const task=(async()=>{const body=await r.body();let data;try{data=JSON.parse(body);}catch{}calls.push({rpc:new URL(r.url()).pathname.split('/').at(-1),status:r.status(),bytes:body.length,modified:data?.modified??true,has_financial_payload:!!(data?.data||data?.schema_version)});})();tasks.push(task.catch(()=>{}));}});
 stage='login';await page.goto(target);await page.locator('input[type=email]').fill(e.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(e.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
 await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
 await page.waitForFunction(()=>window.savingsStore?.state().selfPhase==='ready',null,{timeout:45000});
 if(participantCase){
  const actor=await page.evaluate(()=>window.AffiliateAuth.getState().session.user.id);assert(/^[0-9a-f-]{36}$/.test(actor));
  assert.equal((await a.query("select count(*)::int n from public.impersonation_sessions where actor_real_auth_user_id='"+actor+"' and ended_at is null and expires_at>now()"))[0].n,0,'No active impersonation may be replaced');
  const rows=await a.raw('begin;'+fs.readFileSync(path.join(a.dir,'cases.sql'),'utf8')+"select affiliate_id from h05_cases where label='PROCESS_1_1';rollback;");
  const code=await page.evaluate(async id=>{const r=await window.SutiSupabase.getClient().rpc('start_affiliate_impersonation',{p_affiliate_id:id,p_reason:'H05 financial read-only browser verification'});return r.error?.code||null;},rows[0].affiliate_id);assert.equal(code,null);impersonating=true;
  await page.evaluate(()=>window.AffiliateAuth.refreshContext());await page.waitForFunction(()=>window.AffiliateAuth.getState().impersonation&&window.savingsStore.state().selfPhase==='ready',null,{timeout:45000});
 }
 await page.evaluate(()=>window.AdminRepository.refreshAccessContext());await page.waitForTimeout(1200);
 if(await page.getByRole('button',{name:'Ahora no',exact:true}).isVisible()) await page.getByRole('button',{name:'Ahora no',exact:true}).click();
 await Promise.all(tasks);calls=[];tasks=[];
 await page.evaluate(()=>window.savingsStore.clearSelf());
 const steps=[];
 const snap=async(label)=>{await page.waitForFunction(()=>window.savingsStore.state().selfPhase==='ready',null,{timeout:45000});await Promise.all(tasks);const value=await page.evaluate(()=>JSON.stringify(window.savingsStore.state().self));steps.push({label,projection_sha256:hash(value),calls:calls.splice(0)});};
 stage='finance_navigation';await page.locator('[data-app-tab="financiera"]').click();await snap('Finance');
 stage='savings_navigation';await page.locator('[data-finance-summary-action="ahorro"]').click();await page.locator('[data-savings-total], [data-savings-empty]').waitFor({timeout:45000});await snap('Savings');
 const ui=await page.locator('[data-savings-screen]').evaluate(el=>({html:el.innerHTML,sections:[...el.querySelectorAll('h2,h3,.sav-section-title')].map(x=>x.textContent),controls:[...el.querySelectorAll('button')].map(x=>({text:x.textContent,label:x.getAttribute('aria-label'),disabled:x.disabled}))}));
 const details=[];
 for(const code of ['history','withdrawals','beneficiaries']){if(!await page.locator('[data-savings-detail="'+code+'"]').count())continue;stage='detail_'+code;await page.locator('[data-savings-detail="'+code+'"]').click();const el=page.locator('[data-savings-sheet="'+code+'"]');await el.waitFor();details.push({code,html_sha256:hash(await el.innerHTML())});await el.getByRole('button',{name:'Cerrar',exact:true}).click();}
 stage='back_navigation';await page.locator('.sav-back').click();await page.locator('[data-finance-savings-balance]').waitFor();await snap('Finance_return');
 const navigation=steps.flatMap(s=>s.calls);assert(steps.every(s=>s.projection_sha256===steps[0].projection_sha256));assert(navigation.every(c=>c.status===200));
 const checks=[];
 if(mode!=='before'){
  assert.equal(navigation.filter(c=>c.has_financial_payload).length,1,'one complete projection per unchanged navigation');
  assert(navigation.some(c=>!c.modified&&!c.has_financial_payload),'validated reuse');
  calls=[];await page.evaluate(()=>window.savingsStore.loadSelf(true));await Promise.all(tasks);assert(calls.some(c=>c.modified&&c.has_financial_payload));checks.push('force refresh fetches full current projection');
  await page.route('**/rest/v1/rpc/get_self_savings_if_changed',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'H05 isolated browser denial'})}));
  await page.evaluate(()=>window.savingsStore.loadSelf().catch(()=>{}));assert(await page.evaluate(()=>window.savingsStore.state().self===null&&window.savingsStore.state().selfPhase==='error'));checks.push('controlled backend error removes prior projection');
  await page.unroute('**/rest/v1/rpc/get_self_savings_if_changed');await page.evaluate(()=>window.savingsStore.loadSelf());checks.push('manual retry restores authoritative projection');
 }
 a.save('browser-'+mode+(participantCase?'-participant':''),{at:new Date().toISOString(),status:'PASS',target,case:participantCase?'certified participant via authorized impersonation':'real account without participant',viewport:{width:390,height:844},steps,navigation:{rpc_count:navigation.length,full_projections:navigation.filter(c=>c.has_financial_payload).length,bytes:navigation.reduce((n,c)=>n+c.bytes,0)},ui:{html_sha256:hash(ui.html),sections:ui.sections,controls:ui.controls,details},checks,page_errors:errors,privacy:'No private payload or displayed amounts retained; complete in-memory JSON compared using SHA256'});
 assert.equal(errors.length,0);console.log(JSON.stringify({mode,participantCase,status:'PASS',navigation:navigation.map(c=>({rpc:c.rpc,bytes:c.bytes,modified:c.modified})),checks}));
 }finally{if(impersonating&&page){const code=await page.evaluate(async()=>{const r=await window.SutiSupabase.getClient().rpc('stop_affiliate_impersonation');await window.AffiliateAuth.refreshContext();return r.error?.code||null;});assert.equal(code,null,'Impersonation cleanup');a.save('browser-'+mode+'-impersonation-cleanup',{status:'PASS',stopped:true});}await browser.close();}
})().catch(e=>{console.error(JSON.stringify({status:'FAIL',mode,stage,error:e.message.split('Call log:')[0].slice(0,500),diagnostic:e.message.split('\n').filter(x=>/intercepts|not visible|not stable|waiting for locator|resolved to/.test(x)).slice(0,5)}));process.exitCode=1;});
