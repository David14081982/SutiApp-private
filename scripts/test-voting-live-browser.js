'use strict';
// Isolated browser fixtures for the live voting flow (affiliate card, Admin controls, big screen). Zero backend writes.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/voting-live-20260916');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const source=sandbox.Babel.transform(fs.readFileSync(path.join(root,'app/screens-voting.jsx'),'utf8'),{presets:['react']}).code;
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=await serve(),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.route('**/voting-live-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/voting-live-fixture');
  await page.setContent('<!doctype html><html lang="es"><head><meta charset="utf-8"><style>body{margin:0;background:#f2f3f5}button{font:inherit}*{box-sizing:border-box}</style></head><body><main id="root"></main></body></html>');
  await page.addStyleTag({path:path.join(root,'app/text-size.css')});
  for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/voting-design.js','app/voting-repository.js'])await page.addScriptTag({path:path.join(root,f)});
  const sealSrc=process.env.VOTING_SEAL_PREVIEW?'data:image/png;base64,'+fs.readFileSync(process.env.VOTING_SEAL_PREVIEW).toString('base64'):'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#111" stroke-width="6"/><rect x="38" y="30" width="24" height="40" rx="6" fill="#910022"/></svg>');
  await page.addScriptTag({content:'window.SutiSeal=function({size=96}){return React.createElement("div",{"data-branding-seal-state":"loaded",style:{width:size,height:size,position:"relative",display:"inline-block",verticalAlign:"top"}},React.createElement("img",{src:'+JSON.stringify(sealSrc)+',alt:"Sello institucional SUTISSSTESON",style:{width:"100%",height:"100%",objectFit:"contain",display:"block",filter:"none"}}));};'});
  await page.addScriptTag({content:source});
  await page.evaluate(()=>{
   const questions=[{id:'q1',title:'¿Aprueba la reforma al artículo 12 del Estatuto General?',detail:'Reforma a los artículos 12, 34 y 51 del Estatuto General.'},{id:'q2',title:'¿Aprueba la reforma al artículo 34?',detail:'Segunda pregunta de verificación.'},{id:'q3',title:'¿Aprueba la reforma al artículo 51?',detail:''}];
   window.db={active:null,last:null,open:true,published:true,canVote:true,votes:{},results:{q1:{si:2,no:0,abs:0},q2:{si:0,no:0,abs:0},q3:{si:0,no:0,abs:0}},audience:{mode:'emails',unions:[],categories:[],positions:[],emails:['delegada.uno@example.invalid','delegado.dos@example.invalid','afiliada.tres@example.invalid']},permissions:{read:true,create:true,update:true,delete:true,publish:true,results:true,export_identified_votes:true},calls:{activate:[],electorate:[],save:null,live:0},voteError:null};
   window.toasts=[];window.liveListeners=new Set();window.emitLive=()=>window.liveListeners.forEach(fn=>fn());
   const res=id=>{const r=db.results[id],total=r.si+r.no+r.abs;return {...r,total,participation:Math.round(1000*total/3)/10};};
   window.realRepository=window.VotingRepository;
   window.VotingRepository={...window.VotingRepository,
    watch:fn=>{liveListeners.add(fn);return {connected:()=>true,stop:()=>liveListeners.delete(fn)};},
    list:async admin=>{const c={id:'c1',title:'Asamblea General de verificación',closes_on:'2099-09-19',electorate:admin?3:3,published:db.published,open:db.open,version:1,active_question_id:db.active};
     if(admin)return {consultations:[{...c,audience:JSON.parse(JSON.stringify(db.audience)),last_question_id:db.last,questions:questions.map((q,i)=>({...q,sort_order:i,active:q.id===db.active,results:res(q.id),locked:res(q.id).total>0}))}],can_vote:true,permissions:{...db.permissions},catalog:{segments:[],positions:['Delegado']}};
     return {consultations:[{...c,questions:questions.map((q,i)=>({id:q.id,sort_order:i,active:q.id===db.active,title:q.id===db.active?q.title:null,detail:q.id===db.active?q.detail:null,mine:db.votes[q.id]||null}))}],can_vote:db.canVote};},
    vote:async(c,q,answer)=>{await new Promise(r=>setTimeout(r,60));if(db.voteError)throw db.voteError;if(q!==db.active)throw {message:'QUESTION_NOT_ACTIVE'};if(db.votes[q])throw {code:'23505'};db.votes[q]={answer,folio:'V-fixture-'+q,cast_at:new Date().toISOString()};db.results[q][answer]++;return db.votes[q];},
    activate:async(c,q)=>{db.calls.activate.push([c,q]);db.active=q;if(q)db.last=q;return {active_question_id:q,last_question_id:db.last};},
    electorate:async audience=>{db.calls.electorate.push(audience.mode);return audience.mode==='all'?946:audience.mode==='registered'?207:12;},
    live:async id=>{db.calls.live++;const shown=db.active||db.last,i=questions.findIndex(q=>q.id===shown);return {id,title:'Asamblea General de verificación',published:db.published,open:db.open,closes_on:'2099-09-19',electorate:3,question_count:3,active:!!db.active,question:i<0?null:{...questions[i],number:i+1,results:res(shown)}};},
    save:async c=>{db.calls.save=JSON.parse(JSON.stringify(c));return 'c1';},
    action:async()=>'c1',download:async()=>{}};
   window.root=ReactDOM.createRoot(document.querySelector('#root'));
   window.renderVoting=admin=>root.render(React.createElement(admin?window.VotingAdmin:window.VotingHome,{app:{toast:m=>toasts.push(m),textPreference:{value:'normal'}},onBack:()=>{}}));
   renderVoting(false);
  });
  const home=page.locator('[data-voting-home]');

  // Affiliate: nothing on air yet. Card open by default, no options, no results anywhere.
  await home.getByText('Espera la siguiente pregunta',{exact:true}).first().waitFor();
  assert.equal(await home.locator('.head').getAttribute('aria-expanded'),'true');
  assert.equal(await home.locator('.opt').count(),0);assert.equal(await home.locator('.acount').textContent(),'0 de 3');
  assert.equal(await page.locator('.bars,.res,.fill,.total,.folio').count(),0);checks.push('affiliate_waiting_open_card_no_results');

  // Admin puts question 1 on air: it appears without reload (live signal) and only its text is present.
  await page.evaluate(()=>{db.active='q1';db.last='q1';emitLive();});
  await home.locator('[data-voting-on-air][data-voting-question=q1]').waitFor({timeout:4000});
  assert.equal(await home.locator('.q').count(),1);assert.equal(await home.locator('.opt').count(),3);
  assert.equal(await home.locator('.qnum').textContent(),'1');checks.push('question_on_air_appears_live');
  for(const [label,size] of [['normal','normal'],['grande','large'],['muy-grande','largest']]){
   await home.evaluate((e,s)=>e.dataset.textSize=s,size);
   assert(await noOverflow(page),'affiliate overflow '+label);
   for(const h of await home.locator('.opt').evaluateAll(n=>n.map(x=>x.getBoundingClientRect().height)))assert(h>=44,'target '+label);
   await page.screenshot({path:path.join(out,'afiliado-en-vivo-'+label+'.png'),fullPage:true});
  }
  await home.evaluate(e=>e.dataset.textSize='normal');checks.push('affiliate_three_text_sizes');

  // Vote and confirm: receipt toast with folio, the question disappears for this affiliate, still no results.
  await home.getByRole('button',{name:'Sí',exact:true}).click();await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'Confirmar voto',exact:true}).dblclick();
  await home.getByText('Espera la siguiente pregunta',{exact:true}).first().waitFor();
  assert.equal(await home.locator('.q').count(),0);assert.equal(await home.locator('.acount').textContent(),'1 de 3');
  assert.deepEqual(await page.evaluate(()=>toasts),['Voto registrado · folio V-fixture-q1']);
  assert.equal(await page.locator('.bars,.res,.fill,.total,.folio').count(),0);assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await home.getByText('Tu voto quedó registrado. La siguiente pregunta aparecerá aquí en cuanto se active.',{exact:true}).count(),1);
  await page.screenshot({path:path.join(out,'afiliado-voto-registrado.png'),fullPage:true});checks.push('vote_hides_question_without_results');

  // A collapsed card reopens when the next question goes on air.
  await home.locator('.head').click();assert.equal(await home.locator('.head').getAttribute('aria-expanded'),'false');
  assert.equal(await home.locator('.hhint').textContent(),'Espera la siguiente pregunta');
  await page.evaluate(()=>{db.active='q2';db.last='q2';emitLive();});
  await home.locator('[data-voting-on-air][data-voting-question=q2]').waitFor({timeout:4000});
  assert.equal(await home.locator('.head').getAttribute('aria-expanded'),'true');assert.equal(await home.locator('.qnum').textContent(),'2');checks.push('card_reopens_on_new_question');

  // The confirmation closes if the question leaves the air while it is open.
  await home.getByRole('button',{name:'No',exact:true}).click();await page.getByRole('dialog').waitFor();
  await page.evaluate(()=>{db.active='q3';db.last='q3';emitLive();});
  await page.getByRole('dialog').waitFor({state:'detached',timeout:4000});
  await home.locator('[data-voting-on-air][data-voting-question=q3]').waitFor({timeout:4000});
  assert(await page.evaluate(()=>toasts.includes('Esa pregunta ya no está activa')));checks.push('sheet_closes_when_question_leaves_air');

  // Backend refusal is explained inside the sheet.
  await page.evaluate(()=>{db.voteError={message:'QUESTION_NOT_ACTIVE'};});
  await home.getByRole('button',{name:'Abstención',exact:true}).click();await page.getByRole('button',{name:'Confirmar voto',exact:true}).click();
  await page.getByRole('dialog').getByText('Esta pregunta ya no está activa. Espera la siguiente.',{exact:true}).waitFor();
  await page.evaluate(()=>{db.voteError=null;});await page.getByRole('button',{name:'Cancelar',exact:true}).click();checks.push('not_active_error_message');

  // Re-activation of question 2 only reaches who has not voted it; finishing shows 3 de 3.
  await home.getByRole('button',{name:'Abstención',exact:true}).click();await page.getByRole('button',{name:'Confirmar voto',exact:true}).click();
  await home.getByText('Espera la siguiente pregunta',{exact:true}).first().waitFor();
  await page.evaluate(()=>{db.active='q1';emitLive();});await page.waitForTimeout(2600);
  assert.equal(await home.locator('.q').count(),0,'voted question must not come back');
  await page.evaluate(()=>{db.active='q2';emitLive();});await home.locator('[data-voting-question=q2]').waitFor({timeout:4000});
  await home.getByRole('button',{name:'No',exact:true}).click();await page.getByRole('button',{name:'Confirmar voto',exact:true}).click();
  await home.getByText('Ya respondiste todas las preguntas',{exact:true}).first().waitFor();
  assert.equal(await home.locator('.acount').textContent(),'3 de 3');assert.equal(await home.locator('.segs i.on').count(),3);
  await page.screenshot({path:path.join(out,'afiliado-3-de-3.png'),fullPage:true});checks.push('reactivation_and_finished_state');

  // Impersonation and closed consultation.
  await page.evaluate(()=>{db.votes={};db.canVote=false;db.active='q1';emitLive();});await home.locator('[data-voting-question=q1]').waitFor({timeout:4000});
  assert.equal(await home.locator('.opt:disabled').count(),3);assert.equal(await home.getByText('Tomar control permite consultar, pero no emitir votos.',{exact:true}).count(),1);
  await page.evaluate(()=>{db.canVote=true;db.open=false;emitLive();});await home.getByText('La votación ya cerró',{exact:true}).waitFor({timeout:4000});
  assert.equal(await home.locator('.opt').count(),0);checks.push('impersonation_and_closed_states');

  // Admin editor: automatic total, one switch per saved question, single question on air.
  await page.evaluate(()=>{db.open=true;db.active=null;db.last=null;renderVoting(true);});
  await page.locator('[data-voting-admin-consultation=c1] button').first().click();
  await page.locator('[data-voting-electorate="3"]').waitFor();assert.equal(await page.getByLabel('PADRÓN CONVOCADO').count(),0);
  assert.equal(await page.getByRole('switch',{name:/^Activar pregunta/}).count(),3);checks.push('admin_total_and_switches');
  await page.getByRole('switch',{name:'Activar pregunta 1',exact:true}).click();
  await page.getByRole('switch',{name:'Desactivar pregunta 1',exact:true}).waitFor();
  assert.equal(await page.locator('.qrow.live').count(),1);assert.equal(await page.getByText('Activa: los afiliados la ven ahora',{exact:true}).count(),1);
  await page.getByRole('switch',{name:'Activar pregunta 2',exact:true}).click();
  await page.getByRole('switch',{name:'Desactivar pregunta 2',exact:true}).waitFor();
  assert.equal(await page.getByRole('switch',{name:'Desactivar pregunta 1',exact:true}).count(),0);assert.equal(await page.locator('.qrow.live').count(),1);
  await page.getByRole('switch',{name:'Desactivar pregunta 2',exact:true}).click();
  await page.getByRole('switch',{name:'Activar pregunta 2',exact:true}).waitFor();assert.equal(await page.locator('.qrow.live').count(),0);
  assert.deepEqual(await page.evaluate(()=>db.calls.activate),[['c1','q1'],['c1','q2'],['c1',null]]);
  assert(await page.evaluate(()=>toasts.includes('Pregunta 2 activa para los afiliados')&&toasts.includes('Pregunta 2 desactivada')));checks.push('admin_single_question_on_air');
  await page.evaluate(()=>{db.active='q3';db.last='q3';emitLive();});
  await page.getByRole('switch',{name:'Desactivar pregunta 3',exact:true}).waitFor({timeout:3000});checks.push('admin_reflects_other_session_live');
  await page.getByRole('button',{name:'Todos',exact:false}).click();await page.locator('[data-voting-electorate="946"]').waitFor();
  await page.getByRole('button',{name:'Solo registrados',exact:false}).click();await page.locator('[data-voting-electorate="207"]').waitFor();
  await page.getByRole('button',{name:'Solo estas personas',exact:false}).click();await page.locator('[data-voting-electorate="3"]').waitFor();checks.push('admin_total_follows_audience');
  await page.getByRole('button',{name:'Agregar pregunta',exact:true}).click();await page.getByRole('textbox',{name:'PREGUNTA',exact:true}).fill('Pregunta nueva sin guardar');await page.getByRole('button',{name:'Guardar pregunta',exact:true}).click();
  assert.equal(await page.getByText('Guarda la consulta para poder activarla',{exact:true}).count(),1);checks.push('unsaved_question_cannot_go_on_air');
  for(const [label,size] of [['normal','normal'],['grande','large'],['muy-grande','largest']]){
   await page.locator('[data-voting-admin]').evaluate((e,s)=>e.dataset.textSize=s,size);assert(await noOverflow(page),'admin overflow '+label);
   await page.screenshot({path:path.join(out,'admin-en-vivo-'+label+'.png'),fullPage:true});
  }
  await page.locator('[data-voting-admin]').evaluate(e=>e.dataset.textSize='normal');checks.push('admin_three_text_sizes');
  await page.getByRole('button',{name:'Guardar consulta',exact:true}).click();await page.waitForFunction(()=>!!db.calls.save);
  const mapped=await page.evaluate(async()=>{const calls=[];window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{calls.push([name,args]);return {data:'c1',error:null};}})};
   await realRepository.save(db.calls.save);await realRepository.activate('c1','q2');await realRepository.activate('c1',null);await realRepository.live('c1');await realRepository.electorate({mode:'all'});
   const w=realRepository.watch(()=>{});const offline=w.connected();w.stop();return {calls,offline};});
  assert.equal(mapped.calls[0][0],'save_voting_consultation');assert.equal('electorate' in mapped.calls[0][1].p_value,false,'manual electorate no longer sent');assert.equal(mapped.calls[0][1].p_value.questions.length,4);
  assert.deepEqual(mapped.calls.slice(1),[['set_voting_active_question',{p_consultation:'c1',p_question:'q2'}],['set_voting_active_question',{p_consultation:'c1',p_question:null}],['get_voting_live',{p_consultation:'c1'}],['count_voting_electorate',{p_audience:{mode:'all'}}]]);
  assert.equal(mapped.offline,false,'watch degrades to polling without Realtime');checks.push('repository_payloads_and_offline_watch');

  // Big screen: follows the question on air, counts live, waits between questions.
  await page.evaluate(()=>{db.permissions.publish=false;db.active=null;db.last=null;db.results.q1={si:1,no:1,abs:0};emitLive();});
  await page.locator('[data-voting-admin-consultation=c1] button').first().click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Activar pregunta 1"]')?.disabled===true,null,{timeout:3000});checks.push('switch_requires_publish_permission');
  await page.setViewportSize({width:1920,height:1080});
  await page.locator('[data-voting-live-open]').click();const live=page.locator('[data-voting-live]');await live.waitFor();
  await live.getByText('Esperando la primera pregunta',{exact:true}).waitFor();assert(await noOverflow(page));
  assert.equal(await live.locator('.lseal [data-branding-seal-state=loaded] img').count(),1,'institutional seal watermark');assert.equal(await live.locator('.lseal svg').count(),0,'old circle decoration removed');
  assert.equal(await live.locator('.lseal').evaluate(e=>getComputedStyle(e).filter),'brightness(0) invert(1)');checks.push('big_screen_institutional_seal');
  await page.evaluate(()=>{window.shellSwap=!window.shellSwap;const app={toast:m=>toasts.push(m),textPreference:{value:'normal'}};root.render(React.createElement(shellSwap?'section':'div',{'data-shell':'swap'},React.createElement(window.VotingAdmin,{app,onBack:()=>{}})));});
  await live.getByText('Esperando la primera pregunta',{exact:true}).waitFor({timeout:3000});assert.equal(await page.locator('[data-voting-live-open]').count(),1,'editor restored behind the big screen');checks.push('big_screen_survives_admin_remount');
  await page.screenshot({path:path.join(out,'pantalla-gigante-espera.png')});
  await page.evaluate(()=>{db.active='q1';db.last='q1';emitLive();});
  await live.locator('[data-voting-live-question=q1]').waitFor({timeout:3000});
  assert.equal(await live.locator('[data-voting-live-state]').textContent(),'EN VIVO');assert.equal(await live.locator('[data-voting-live-voted]').textContent(),'2');
  assert.equal(await live.locator('[data-voting-live-missing]').textContent(),'Faltan 1');
  assert.equal(await live.locator('[data-voting-live-option=si] .lpct').textContent(),'50%');assert.equal(await live.locator('[data-voting-live-option=abs] .lpct').textContent(),'0%');
  await page.screenshot({path:path.join(out,'pantalla-gigante-1920.png')});checks.push('big_screen_on_air');
  await page.evaluate(()=>{db.results.q1.si++;});
  await live.locator('[data-voting-live-voted]').filter({hasText:/^3$/}).waitFor({timeout:4500});
  assert.equal(await live.locator('[data-voting-live-missing]').textContent(),'Faltan 0');assert.equal(await live.locator('[data-voting-live-option=si] .lpct').textContent(),'67%');checks.push('big_screen_counts_by_polling');
  await page.evaluate(()=>{db.active=null;emitLive();});
  await live.getByText('Esperando la siguiente pregunta',{exact:true}).waitFor({timeout:3000});assert.equal(await live.locator('[data-voting-live-state]').textContent(),'RESULTADO FINAL');
  await page.screenshot({path:path.join(out,'pantalla-gigante-resultado-final.png')});
  await page.evaluate(()=>{db.active='q2';db.last='q2';emitLive();});await live.locator('[data-voting-live-question=q2]').waitFor({timeout:3000});
  assert.equal(await live.locator('.lsub').textContent(),'Pregunta 2 de 3');checks.push('big_screen_follows_next_question');
  for(const [w,h] of [[1280,720],[1024,768],[390,844]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(150);assert(await live.evaluate(e=>e.scrollWidth<=e.clientWidth),'big screen overflow '+w);await page.screenshot({path:path.join(out,'pantalla-gigante-'+w+'.png')});}
  checks.push('big_screen_responsive');
  await live.getByRole('button',{name:'Cerrar votación en vivo',exact:true}).click();await live.waitFor({state:'detached'});
  const polls=await page.evaluate(()=>db.calls.live);await page.waitForTimeout(2600);assert.equal(await page.evaluate(()=>db.calls.live),polls,'polling stops after closing');checks.push('big_screen_closes_and_stops');
  await page.evaluate(()=>root.render(null));await page.waitForTimeout(3200);await page.evaluate(()=>renderVoting(true));
  await page.locator('[data-voting-admin-consultation=c1]').waitFor();assert.equal(await page.locator('[data-voting-live-open]').count(),0);assert.equal(await page.locator('[data-voting-live]').count(),0);checks.push('stale_session_not_restored');

  assert.deepEqual(errors,[]);
  const result={status:'PASS',checks,errors,scope:'Isolated browser fixtures only; backend authorization, locks and Realtime policy tested in SQL with ROLLBACK.',productionWrites:0};
  fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(e){await page.screenshot({path:path.join(out,'browser-failure.png'),fullPage:true}).catch(()=>{});console.error(JSON.stringify({checks,errors,error:e.message}));process.exitCode=1;}
 finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})();
