'use strict';
// Real login + real Supabase against the local build (default) or GitHub Pages (--production).
// Read-only for business data. The only write is a technical changed_at touch on voting_live_state to prove Realtime delivery.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const {query,env}=require('./voting-live-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/voting-live-20260916');
const production=process.argv.includes('--production');
const PAGES='https://david14081982.github.io/SutiApp-private/';
const arg=(name,fallback)=>(process.argv.find(x=>x.startsWith('--'+name+'='))||'').split('=')[1]||fallback;
const VERSION=arg('version','voting-live-20260916-001'),TAG=arg('tag','');

async function waitFor(fn,ms,label){const end=Date.now()+ms;for(;;){if(await fn())return;if(Date.now()>end)throw Error('TIMEOUT '+label);await new Promise(r=>setTimeout(r,200));}}

(async()=>{
 fs.mkdirSync(out,{recursive:true});const values=env(),tag=(production?'production':'integrated-local')+(TAG?'-'+TAG:'');
 const server=production?null:await serve(),target=production?PAGES+'SutiApp.html':`http://127.0.0.1:${server.address().port}/SutiApp.html`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();
 const errors=[],checks=[],rpc={};let realtimeTouch=null;
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{const m=r.url().match(/\/rest\/v1\/rpc\/([a-z_]+)/);if(m)rpc[m[1]]=(rpc[m[1]]||0)+1;});
 await page.addLocatorHandler(page.getByRole('button',{name:'Cerrar',exact:true}),async l=>l.click());
 try{
  const db=(await query(`select c.id,c.title,public.voting_electorate(c.audience) electorate,(select count(*) from public.voting_questions q where q.consultation_id=c.id and q.archived_at is null) questions,
   (select active_question_id from public.voting_live_state s where s.consultation_id=c.id) active
   from public.voting_consultations c where c.archived_at is null order by c.created_at desc limit 1`))[0];
  assert(db&&db.id,'expected the existing production consultation');
  await page.goto(target+'#/admin/votaciones',{waitUntil:'domcontentloaded'});
  if(production){const html=await (await fetch(PAGES+'SutiApp.html?verify='+Date.now(),{cache:'no-store'})).text();assert(html.includes('app/bundle.js?v='+VERSION),'published HTML cachebuster');}
  await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.locator('[data-voting-admin]').waitFor({timeout:60000});await page.getByRole('button',{name:'Nueva consulta',exact:true}).waitFor({timeout:30000});
  assert.equal(await page.locator('[data-voting-admin] [role=alert]').count(),0);
  assert.equal(await page.evaluate(()=>typeof window.VotingRepository.activate==='function'&&typeof window.VotingRepository.live==='function'),true,'new bundle running');checks.push('real_login_new_bundle');

  // Editor of the real consultation: automatic total from the backend, one switch per question, nothing clicked.
  await page.locator(`[data-voting-admin-consultation="${db.id}"] button`).first().click();
  await page.locator(`[data-voting-electorate="${db.electorate}"]`).waitFor({timeout:15000});
  assert.equal(await page.getByLabel('PADRÓN CONVOCADO').count(),0);
  assert.equal(await page.getByRole('switch',{name:/^(Activar|Desactivar) pregunta \d+$/}).count(),Number(db.questions));
  assert.equal(await page.locator('.qrow.live').count(),db.active?1:0);checks.push('editor_real_total_and_switches');
  // No editor screenshot: the real audience list contains personal emails.

  // Realtime: the channel joins and a technical touch of the signal row triggers a reload without polling.
  await waitFor(()=>page.evaluate(()=>window.SutiSupabase.getClient().getChannels().some(c=>/voting-live-/.test(c.topic)&&c.state==='joined')),20000,'realtime channel joined');
  const before=rpc.list_voting_consultations||0;
  realtimeTouch=(await query(`update public.voting_live_state set changed_at=clock_timestamp() where consultation_id='${db.id}' returning consultation_id,active_question_id,changed_at`))[0];
  await waitFor(async()=>(rpc.list_voting_consultations||0)>before,10000,'realtime reload');
  checks.push('realtime_event_reaches_browser');

  // Big screen opens, polls get_voting_live and stops when closed.
  await page.locator('[data-voting-live-open]').click();const live=page.locator('[data-voting-live]');await live.waitFor();
  await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(1200);await live.waitFor({timeout:5000});checks.push('big_screen_survives_desktop_breakpoint');
  await live.locator('.lseal img[data-voting-live-seal]').waitFor({state:'attached',timeout:20000});
  await waitFor(()=>live.locator('.lseal img[data-voting-live-seal]').evaluate(i=>i.complete&&i.naturalWidth>0),20000,'seal image loaded');checks.push('big_screen_institutional_seal');
  await waitFor(async()=>(rpc.get_voting_live||0)>=3,12000,'live polling');
  if(!db.active)await live.getByText(/Esperando la primera pregunta|Esperando la siguiente pregunta/).first().waitFor({timeout:10000});
  assert.equal(await live.locator('[role=alert]').count(),0);
  await page.screenshot({path:path.join(out,tag+'-pantalla-gigante.png')});checks.push('big_screen_real_backend');
  await live.getByRole('button',{name:'Cerrar votación en vivo',exact:true}).click();await live.waitFor({state:'detached'});
  const polls=rpc.get_voting_live;await page.waitForTimeout(4500);assert.equal(rpc.get_voting_live,polls,'big screen polling stops');checks.push('big_screen_stops');
  await page.setViewportSize({width:390,height:844});

  // Home as the same account: section above "Tu sindicato" only when authorized; never results.
  await page.evaluate(()=>{location.hash='#/home';});await page.locator('[data-reveal-key=ecosistema]').waitFor({timeout:30000});
  const mine=await page.evaluate(async()=>{const r=await window.VotingRepository.list(false);return {count:r.consultations.length,results:r.consultations.some(c=>c.questions.some(q=>'results' in q)),offAirText:r.consultations.some(c=>c.questions.some(q=>q.id!==c.active_question_id&&q.title!=null))};});
  assert.equal(mine.results,false,'affiliates never receive results');assert.equal(mine.offAirText,false,'only the question on air carries text');
  await page.waitForTimeout(1500);
  if(mine.count){
   await page.locator('[data-voting-home]').waitFor({timeout:15000});
   const ordering=await page.evaluate(()=>{const v=document.querySelector('[data-voting-home]'),u=[...document.querySelectorAll('h2,h3')].find(e=>e.textContent==='Tu sindicato');return !!(v&&u&&(v.compareDocumentPosition(u)&Node.DOCUMENT_POSITION_FOLLOWING));});
   assert(ordering,'above Tu sindicato');assert.equal(await page.locator('[data-voting-home] .bars,[data-voting-home] .res').count(),0);
   await page.locator('[data-voting-home]').screenshot({path:path.join(out,tag+'-inicio.png')});
  }else assert.equal(await page.locator('[data-voting-home]').count(),0);
  checks.push(mine.count?'home_card_authorized_without_results':'home_hidden_without_authorization');

  assert.deepEqual(errors,[]);
  const result={status:'PASS',target:production?PAGES:'local build + production Supabase',checks,rpcCalls:rpc,consultation:{id:db.id,electorate:Number(db.electorate),questions:Number(db.questions),onAir:db.active},homeConsultations:mine.count,
   businessWrites:0,technicalWrites:[{table:'voting_live_state',column:'changed_at',consultation_id:realtimeTouch&&realtimeTouch.consultation_id,purpose:'prove Realtime delivery; state unchanged'}]};
  fs.writeFileSync(path.join(out,tag+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(e){await page.screenshot({path:path.join(out,tag+'-failure.png')}).catch(()=>{});console.error(JSON.stringify({checks,errors,rpc,error:e.message}));process.exitCode=1;}
 finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
})();
