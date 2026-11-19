'use strict';
// H-SUTIAPP-VOTACIONES-CONSULTAS-004 isolated browser fixtures: card texts and headers, optional close date, custom options,
// free text, changeable answers, Admin editors, big screen, «VER» and CSV. Zero backend writes (repository is mocked).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/voting-consultas-20261119');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const source=sandbox.Babel.transform(fs.readFileSync(path.join(root,'app/screens-voting.jsx'),'utf8'),{presets:['react']}).code;
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const LONG='Tal vez, llegaré después de las 10 de la mañana';

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=await serve(),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',acceptDownloads:true});
 const page=await context.newPage(),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const shot=name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
 try{
  await page.route('**/voting-consultas-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/voting-consultas-fixture');
  await page.setContent('<!doctype html><html lang="es"><head><meta charset="utf-8"><style>body{margin:0;background:#f2f3f5;font-family:system-ui}button{font:inherit}*{box-sizing:border-box}</style></head><body><main id="root"></main></body></html>');
  await page.addStyleTag({path:path.join(root,'app/text-size.css')});
  for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/voting-design.js','app/voting-repository.js'])await page.addScriptTag({path:path.join(root,f)});
  await page.addScriptTag({content:'window.useVisualBranding=function(){return {phase:"loaded",branding:{institutional_seal_url:null}};};'});
  await page.addScriptTag({content:source});
  await page.evaluate(LONG=>{
   const clone=x=>JSON.parse(JSON.stringify(x));
   window.toasts=[];window.liveListeners=new Set();window.emitLive=()=>window.liveListeners.forEach(fn=>fn());
   window.db={canVote:true,delay:0,voteError:null,calls:{vote:[],save:null,live:0,activate:[]},
    permissions:{read:true,create:true,update:true,delete:true,publish:true,results:true,export_identified_votes:true},
    consultations:[
     {id:'c1',title:'Asamblea General de verificación',closes_on:'2099-09-19',electorate:3,published:true,open:true,version:1,active:null,
      questions:[{id:'v1',title:'¿Aprueba la reforma al artículo 12?',detail:'Detalle de la reforma.'}]},
     {id:'c2',title:'Confirma tu asistencia a la asamblea anual',closes_on:null,electorate:12,published:true,open:true,version:3,active:null,
      presentation:{kind:'consultation',header:'Censo familiar',open_label:'ENCUESTA ABIERTA',closed_label:'ENCUESTA CERRADA',closed_title:'La encuesta terminó',closed_text:'Gracias, ya no se reciben respuestas.',footer:'Tus datos son confidenciales y solo los consulta el comité.'},
      questions:[
       {id:'q1',title:'¿Asistirás a la asamblea?',detail:'',answer_kind:'options',options:[{id:'si',label:'Asistiré'},{id:'no',label:'No asistiré'},{id:'o1',label:LONG}],final:true},
       {id:'q2',title:'¿Qué necesitas para poder asistir?',detail:'Escribe tu respuesta.',answer_kind:'text',options:[],final:true},
       {id:'q3',title:'¿Tienes hijos menores de edad?',detail:'',answer_kind:'options',options:[{id:'si',label:'Sí'},{id:'no',label:'No'}],final:false}]}],
    mine:{},counts:{q1:{si:4,o1:1},q2:{text:2},q3:{si:1}},last:{}};
   const counts=qid=>db.counts[qid]||(db.counts[qid]={});
   const result=(qid,electorate)=>{const k=counts(qid),total=Object.values(k).reduce((a,b)=>a+b,0);return {si:k.si||0,no:k.no||0,abs:k.abs||0,total,participation:electorate?Math.round(1000*total/electorate)/10:0,counts:{...k}};};
   window.realRepository=window.VotingRepository;
   window.VotingRepository={...window.VotingRepository,
    watch:fn=>{liveListeners.add(fn);return {connected:()=>true,stop:()=>liveListeners.delete(fn)};},
    list:async admin=>{if(db.delay)await new Promise(r=>setTimeout(r,db.delay));
     const consultations=db.consultations.filter(c=>admin||c.published).map(c=>{const base={id:c.id,title:c.title,closes_on:c.closes_on,electorate:c.electorate,published:c.published,open:c.open,version:c.version,active_question_id:c.active,presentation:clone(c.presentation||{})};
      if(admin)return {...base,audience:{mode:'all',unions:[],categories:[],positions:[],emails:[]},last_question_id:db.last[c.id]||null,questions:c.questions.map((q,i)=>({...clone(q),sort_order:i,active:q.id===c.active,results:result(q.id,c.electorate),locked:result(q.id,c.electorate).total>0}))};
      return {...base,questions:c.questions.map((q,i)=>{const on=q.id===c.active;return {id:q.id,sort_order:i,active:on,title:on?q.title:null,detail:on?q.detail:null,answer_kind:on?(q.answer_kind||'options'):null,options:on?clone(q.options||null):null,final:on?q.final!==false:null,mine:db.mine[q.id]||null};})};});
     return admin?{consultations,can_vote:true,permissions:{...db.permissions},catalog:{segments:[],positions:[]}}:{consultations,can_vote:db.canVote};},
    vote:async(cid,qid,answer,text)=>{db.calls.vote.push([cid,qid,answer,text]);await new Promise(r=>setTimeout(r,40));if(db.voteError)throw db.voteError;
     const c=db.consultations.find(x=>x.id===cid),q=c.questions.find(x=>x.id===qid);if(c.active!==qid)throw {message:'QUESTION_NOT_ACTIVE'};
     const prev=db.mine[qid];if(prev&&q.final!==false)throw {code:'23505'};if(prev)counts(qid)[prev.answer]--;counts(qid)[answer]=(counts(qid)[answer]||0)+1;
     db.mine[qid]={answer,answer_text:text||null,folio:prev?prev.folio:'V-fixture-'+qid,cast_at:new Date().toISOString()};return clone(db.mine[qid]);},
    activate:async(cid,qid)=>{db.calls.activate.push([cid,qid]);const c=db.consultations.find(x=>x.id===cid);c.active=qid;if(qid)db.last[cid]=qid;emitLive();return {};},
    electorate:async()=>12,
    live:async id=>{db.calls.live++;const c=db.consultations.find(x=>x.id===id),shown=c.active||db.last[id],i=c.questions.findIndex(q=>q.id===shown);
     return {id,title:c.title,published:c.published,open:c.open,closes_on:c.closes_on,presentation:clone(c.presentation||{}),electorate:c.electorate,question_count:c.questions.length,active:!!c.active,
      question:i<0?null:{id:shown,number:i+1,title:c.questions[i].title,detail:c.questions[i].detail,answer_kind:c.questions[i].answer_kind||'options',options:c.questions[i].answer_kind==='text'?[]:clone(c.questions[i].options||[{id:'si',label:'Sí'},{id:'no',label:'No'},{id:'abs',label:'Abstención'}]),results:result(shown,c.electorate)}};},
    votes:async id=>({consultation_id:id,can_delete:true,votes:[
     {id:'x1',folio:'V-1',cast_at:'2026-11-19T15:00:00Z',answer:'o1',answer_label:LONG,answer_text:null,answer_kind:'options',affiliate_id:'a1',question_id:'q1',question_title:'¿Asistirás a la asamblea?',question_number:1,name:'Persona de prueba',numero_control:'000',email:'persona@example.invalid'},
     {id:'x2',folio:'V-2',cast_at:'2026-11-19T15:01:00Z',answer:'text',answer_label:null,answer_text:'Necesito guardería los sábados',answer_kind:'text',affiliate_id:'a1',question_id:'q2',question_title:'¿Qué necesitas para poder asistir?',question_number:2,name:'Persona de prueba',numero_control:'000',email:'persona@example.invalid'}]}),
    save:async c=>{db.calls.save=clone(c);return 'c9';},action:async()=>'c1',download:async(...a)=>{db.calls.download=a;}};
   window.root=ReactDOM.createRoot(document.querySelector('#root'));
   window.renderVoting=admin=>root.render(React.createElement(admin?window.VotingAdmin:window.VotingHome,{app:{toast:m=>toasts.push(m),textPreference:{value:'normal'}},onBack:()=>{}}));
  },LONG);
  const home=page.locator('[data-voting-home]'),c2=home.locator('[data-voting-consultation=c2]');

  // 1. While loading nothing is shown (no fixed «Votaciones» header); then one header per card.
  await page.evaluate(()=>{db.delay=600;renderVoting(false);});
  await page.waitForTimeout(250);assert.equal(await page.locator('[data-voting-home]').count(),0,'nothing while loading');
  await home.locator('[data-voting-consultation=c2]').waitFor();await page.evaluate(()=>{db.delay=0;});
  assert.deepEqual(await home.locator('.shead h2').allTextContents(),['Votaciones','Censo familiar']);checks.push('header_per_card_nothing_while_loading');
  assert.equal(await c2.locator('.state').textContent(),'ENCUESTA ABIERTA');
  assert.equal(await c2.locator('.hsub').textContent(),'12 afiliados convocados','no date line without close date');
  assert.match(await home.locator('[data-voting-consultation=c1] .hsub').textContent(),/^Fecha el .* · 3 afiliados convocados$/);
  assert.equal(await home.locator('[data-voting-consultation=c1] .state').textContent(),'VOTACIÓN ABIERTA');
  assert.equal(await c2.locator('.foot').textContent(),'Tus datos son confidenciales y solo los consulta el comité.');
  assert.equal(await home.locator('[data-voting-consultation=c1] .foot').textContent(),'Tu voto es secreto frente a otros afiliados y definitivo. Administradores con permiso específico pueden consultarlo.');
  checks.push('card_texts_and_optional_date');
  await shot('afiliado-dos-tarjetas');

  // 2. Consecutive cards with the same header share it.
  await page.evaluate(()=>{db.consultations[1].presentation.header='Votaciones';emitLive();});
  await home.locator('.shead').first().waitFor();await page.waitForFunction(()=>document.querySelectorAll('[data-voting-home] .shead').length===1,null,{timeout:4000});
  await page.evaluate(()=>{db.consultations[1].presentation.header='Censo familiar';emitLive();});
  await page.waitForFunction(()=>document.querySelectorAll('[data-voting-home] .shead').length===2,null,{timeout:4000});checks.push('same_header_grouped');

  // 3. Custom options on air: long labels wrap without horizontal scroll at every text size.
  await page.evaluate(()=>{db.consultations[1].active='q1';emitLive();});
  await c2.locator('[data-voting-on-air][data-voting-question=q1]').waitFor({timeout:4000});
  assert.equal(await c2.locator('.opt.custom').count(),3);assert.equal(await c2.locator('.opt.si,.opt.no,.opt.abs').count(),0);
  assert.equal(await c2.locator('.hhint').count(),1);
  for(const [label,size] of [['normal','normal'],['grande','large'],['muy-grande','largest']]){
   await home.evaluate((e,s)=>e.dataset.textSize=s,size);assert(await noOverflow(page),'overflow '+label);
   for(const box of await c2.locator('.opt').evaluateAll(n=>n.map(x=>{const r=x.getBoundingClientRect(),p=x.closest('.card').getBoundingClientRect();return {h:r.height,in:r.left>=p.left-0.5&&r.right<=p.right+0.5};})))assert(box.h>=44&&box.in,'option target '+label);
   await shot('afiliado-opciones-'+label);
  }
  await home.evaluate(e=>e.dataset.textSize='normal');checks.push('custom_options_layout_three_sizes');
  await c2.getByRole('button',{name:LONG,exact:true}).click();const sheet=page.getByRole('dialog');await sheet.waitFor();
  assert.equal(await sheet.locator('h3').textContent(),'Confirma tu respuesta');assert.equal(await sheet.locator('.lil').textContent(),'Vas a responder');
  assert.equal(await sheet.locator('.big').textContent(),LONG);assert.equal(await sheet.locator('.warn').textContent(),'Tu respuesta es definitiva: una vez enviada no podrás cambiarla. Otros afiliados no la conocerán.');
  await shot('afiliado-confirmar-opcion');
  await sheet.getByRole('button',{name:'Enviar respuesta',exact:true}).click();await sheet.waitFor({state:'detached'});
  assert.deepEqual(await page.evaluate(()=>db.calls.vote.at(-1)),['c2','q1','o1',null]);
  assert(await page.evaluate(()=>toasts.includes('Respuesta registrada · folio V-fixture-q1')));
  await c2.getByText('Tu respuesta quedó registrada. La siguiente pregunta aparecerá aquí en cuanto se active.',{exact:true}).waitFor();checks.push('custom_option_answer');

  // 4. A duplicate answer is explained in the consultation's wording.
  await page.evaluate(()=>{db.mine={};db.voteError={code:'23505'};emitLive();});
  await c2.getByRole('button',{name:'Asistiré',exact:true}).waitFor({timeout:4000});await c2.getByRole('button',{name:'Asistiré',exact:true}).click();
  await sheet.getByRole('button',{name:'Enviar respuesta',exact:true}).click();
  await sheet.getByText('Ya respondiste esta pregunta. Tu respuesta es definitiva.',{exact:true}).waitFor();
  await page.evaluate(()=>{db.voteError=null;db.mine={q1:{answer:'o1',answer_text:null,folio:'V-fixture-q1',cast_at:''}};});await sheet.getByRole('button',{name:'Cancelar',exact:true}).click();checks.push('duplicate_message_follows_type');

  // 5. Free text: empty cannot be sent; the text is confirmed and sent as answer 'text'.
  await page.evaluate(()=>{db.consultations[1].active='q2';emitLive();});
  const box=c2.getByRole('textbox',{name:'Tu respuesta a la pregunta 2'});await box.waitFor({timeout:4000});
  const send=c2.getByRole('button',{name:'Enviar respuesta',exact:true});assert.equal(await send.isDisabled(),true);
  await box.fill('   ');assert.equal(await send.isDisabled(),true);
  assert.equal(await box.getAttribute('maxlength'),'500');
  await box.fill('Necesito guardería los sábados');assert.equal(await c2.locator('.tcount').textContent(),'30/500');await shot('afiliado-respuesta-libre');
  await send.click();await sheet.waitFor();assert.equal(await sheet.locator('.big.long').textContent(),'Necesito guardería los sábados');
  await sheet.getByRole('button',{name:'Enviar respuesta',exact:true}).click();await sheet.waitFor({state:'detached'});
  assert.deepEqual(await page.evaluate(()=>db.calls.vote.at(-1)),['c2','q2','text','Necesito guardería los sábados']);checks.push('free_text_answer');

  // 6. Non-final answer: shown with «Cambiar respuesta», changed in place, can be cancelled.
  await page.evaluate(()=>{db.consultations[1].active='q3';emitLive();});
  await c2.locator('[data-voting-question=q3][data-voting-on-air]').waitFor({timeout:4000});
  await c2.getByRole('button',{name:'Sí',exact:true}).click();await sheet.waitFor();
  assert.equal(await sheet.locator('.warn').textContent(),'Podrás cambiar tu respuesta mientras la pregunta siga activa. Otros afiliados no la conocerán.');
  await sheet.getByRole('button',{name:'Enviar respuesta',exact:true}).click();await sheet.waitFor({state:'detached'});
  await c2.locator('[data-voting-answered]').waitFor();assert.equal(await c2.locator('.answered .answer').textContent(),'Sí');await shot('afiliado-respuesta-modificable');
  await c2.getByRole('button',{name:'Cambiar respuesta',exact:true}).click();
  assert.equal(await c2.getByRole('button',{name:'Sí',exact:true}).getAttribute('aria-pressed'),'true');
  await c2.getByRole('button',{name:'Cancelar cambio',exact:true}).click();await c2.locator('[data-voting-answered]').waitFor();
  await c2.getByRole('button',{name:'Cambiar respuesta',exact:true}).click();await c2.getByRole('button',{name:'No',exact:true}).click();
  await sheet.getByRole('button',{name:'Enviar respuesta',exact:true}).click();await sheet.waitFor({state:'detached'});
  await c2.locator('.answered .answer').filter({hasText:/^No$/}).waitFor();
  assert.deepEqual(await page.evaluate(()=>db.calls.vote.slice(-2).map(v=>v[2])),['si','no']);assert.equal(await page.evaluate(()=>db.mine.q3.folio),'V-fixture-q3');
  checks.push('non_final_change');

  // 7. Closed consultation with its own texts.
  await page.evaluate(()=>{db.consultations[1].open=false;emitLive();});
  await c2.getByText('La encuesta terminó',{exact:true}).waitFor({timeout:4000});
  assert.equal(await c2.locator('.state').textContent(),'ENCUESTA CERRADA');assert.equal(await c2.locator('.opt').count(),0);
  assert.equal(await home.getByText('Votación cerrada',{exact:false}).count(),0);await shot('afiliado-consulta-cerrada');checks.push('closed_custom_texts');
  await page.evaluate(()=>{db.consultations[1].open=true;db.canVote=false;emitLive();});
  await c2.getByText('Tomar control permite consultar, pero no enviar respuestas.',{exact:true}).waitFor({timeout:4000});
  await page.evaluate(()=>{db.canVote=true;});checks.push('impersonation_wording');

  // 8. Admin list: module name and consultation without close date.
  await page.evaluate(()=>{db.consultations[1].active=null;db.counts={q1:{si:4,o1:1},q2:{text:2},q3:{si:1}};renderVoting(true);});
  await page.locator('[data-voting-admin-consultation=c2]').waitFor();
  assert.equal(await page.locator('.top h1').textContent(),'Votaciones y consultas');
  assert.match(await page.locator('[data-voting-admin-consultation=c2] .meta').textContent(),/sin fecha de cierre$/);checks.push('admin_list');

  // 9. Existing consultation: question summaries, locked question keeps «definitiva» editable.
  await page.locator('[data-voting-admin-consultation=c2] button').first().click();
  await page.locator('[data-voting-admin-question=q1]').waitFor();
  assert.equal(await page.locator('[data-voting-kind=consultation]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByRole('switch',{name:'Tiene fecha de cierre'}).getAttribute('aria-checked'),'false');
  assert.equal(await page.locator('[data-voting-text=header]').inputValue(),'Censo familiar');
  const rows=await page.locator('[data-voting-admin-question] > button:first-of-type').allTextContents();
  assert(rows[0].includes('Opciones: Asistiré · No asistiré · '+LONG)&&rows[0].includes('Asistiré 80%'),rows[0]);assert(rows[1].includes('2 respuestas')&&rows[1].includes('Respuesta libre'),rows[1]);
  assert(rows[2].includes('Respuesta modificable'),rows[2]);checks.push('admin_question_summaries');
  for(const [label,size] of [['normal','normal'],['grande','large'],['muy-grande','largest']]){await page.locator('[data-voting-admin]').evaluate((e,s)=>e.dataset.textSize=s,size);assert(await noOverflow(page),'admin overflow '+label);await shot('admin-editar-consulta-'+label);}
  await page.locator('[data-voting-admin]').evaluate(e=>e.dataset.textSize='normal');
  await page.locator('[data-voting-admin-question=q1] > button').first().click();
  const qs=page.getByRole('dialog');await qs.waitFor();
  assert.equal(await qs.getByRole('textbox',{name:'Opción 1'}).isDisabled(),true);assert.equal(await qs.getByRole('button',{name:'Agregar opción'}).isDisabled(),true);
  await qs.getByRole('switch',{name:'Respuesta definitiva'}).click();assert.equal(await qs.getByRole('button',{name:'Guardar pregunta'}).isDisabled(),false);
  await qs.getByRole('button',{name:'Guardar pregunta'}).click();await qs.waitFor({state:'detached'});
  assert((await page.locator('[data-voting-admin-question=q1] > button').first().textContent()).includes('Respuesta modificable'));checks.push('locked_question_final_editable');

  // 10. New consultation of type «Consulta»: suggested texts, no close date, options and free text.
  await page.locator('.top .back').click();await page.getByRole('button',{name:'Nueva consulta'}).click();
  assert.equal(await page.locator('[data-voting-kind=voting]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-voting-text=header]').getAttribute('placeholder'),'Votaciones');
  await page.locator('[data-voting-kind=consultation]').click();
  assert.equal(await page.locator('[data-voting-text=header]').getAttribute('placeholder'),'Consultas');
  assert.equal(await page.locator('[data-voting-text=closed_title]').getAttribute('placeholder'),'La consulta ya cerró');
  await page.getByRole('textbox',{name:'Título',exact:true}).fill('Asistencia a la asamblea anual');
  await page.locator('[data-voting-text=header]').fill('Asamblea anual');
  await page.locator('[data-voting-text=closed_title]').fill('Registro cerrado');
  const save=page.getByRole('button',{name:/^(Guardar consulta|Falta)/});
  assert.equal(await save.textContent(),'Falta la fecha de cierre');
  await page.getByRole('switch',{name:'Tiene fecha de cierre'}).click();assert.equal(await save.textContent(),'Guardar consulta');
  await page.getByRole('button',{name:'Agregar pregunta',exact:true}).click();await qs.waitFor();
  assert.deepEqual(await qs.locator('.opedit input').evaluateAll(n=>n.map(x=>x.value)),['Sí','No'],'consultation suggests Sí / No');
  await qs.getByRole('textbox',{name:'PREGUNTA',exact:true}).fill('¿Asistirás?');
  await qs.getByRole('textbox',{name:'Opción 1'}).fill('Asistiré');await qs.getByRole('textbox',{name:'Opción 2'}).fill('No asistiré');
  await qs.getByRole('button',{name:'Agregar opción'}).click();await qs.getByRole('textbox',{name:'Opción 3'}).waitFor();
  assert.equal(await qs.getByRole('button',{name:/^Falta el nombre/}).isDisabled(),true);
  await qs.getByRole('textbox',{name:'Opción 3'}).fill('asistiré ');assert.equal(await qs.getByRole('button',{name:'Hay opciones repetidas'}).isDisabled(),true);
  await qs.getByRole('textbox',{name:'Opción 3'}).fill('Tal vez');
  assert.equal(await qs.getByRole('button',{name:'Quitar opción 1'}).isDisabled(),false);
  await shot('admin-pregunta-opciones');
  await qs.getByRole('button',{name:'Guardar pregunta'}).click();await qs.waitFor({state:'detached'});
  await page.getByRole('button',{name:'Agregar pregunta',exact:true}).click();await qs.waitFor();
  await qs.getByRole('textbox',{name:'PREGUNTA',exact:true}).fill('¿Qué necesitas para asistir?');
  await qs.locator('[data-voting-answer-kind=text]').click();assert.equal(await qs.locator('.opedit').count(),0);
  await qs.getByRole('switch',{name:'Respuesta definitiva'}).click();await shot('admin-pregunta-respuesta-libre');
  await qs.getByRole('button',{name:'Guardar pregunta'}).click();await qs.waitFor({state:'detached'});
  for(const [label,size] of [['normal','normal'],['muy-grande','largest']]){await page.locator('[data-voting-admin]').evaluate((e,s)=>e.dataset.textSize=s,size);assert(await noOverflow(page),'new overflow '+label);await shot('admin-nueva-consulta-'+label);}
  await page.locator('[data-voting-admin]').evaluate(e=>e.dataset.textSize='normal');
  await save.click();await page.waitForFunction(()=>!!db.calls.save);
  const saved=await page.evaluate(()=>db.calls.save);
  assert.equal(saved.has_close,false);assert.equal(saved.closes_on,null);assert.equal(saved.presentation.kind,'consultation');assert.equal(saved.presentation.header,'Asamblea anual');
  assert.deepEqual(saved.questions.map(q=>[q.answer_kind,q.final,(q.options||[]).map(o=>o.label)]),[['options',true,['Asistiré','No asistiré','Tal vez']],['text',false,[]]]);
  const mapped=await page.evaluate(async saved=>{const calls=[];window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{calls.push([name,args]);return {data:{answer:'text',folio:'V'},error:null};}})};
   await realRepository.save(saved);await realRepository.vote('c2','q2','text','Hola');await realRepository.vote('c1','v1','si');return calls;},saved);
  assert.equal(mapped[0][0],'save_voting_consultation');const value=mapped[0][1].p_value;
  assert.equal(value.closes_on,null);assert.deepEqual(Object.keys(value.presentation).sort(),['closed_title','header','kind']);
  assert.deepEqual(value.questions.map(q=>[q.answer_kind,q.final,q.options&&q.options.map(o=>o.id.length>0)]),[['options',true,[true,true,true]],['text',false,null]]);
  assert(value.questions[0].options.every(o=>/^[a-z0-9_-]{1,40}$/.test(o.id)&&o.id!=='text'));
  assert.deepEqual(mapped[1],['cast_voting_answer',{p_consultation:'c2',p_question:'q2',p_answer:'text',p_text:'Hola'}]);
  assert.deepEqual(mapped[2],['cast_voting_answer',{p_consultation:'c1',p_question:'v1',p_answer:'si',p_text:null}]);checks.push('new_consultation_payload');

  // 11. A new «Votación» keeps the original suggestions and Sí / No / Abstención.
  await page.evaluate(()=>{db.calls.save=null;renderVoting(true);});await page.getByRole('button',{name:'Nueva consulta'}).click();
  await page.getByRole('button',{name:'Agregar pregunta',exact:true}).click();await qs.waitFor();
  assert.deepEqual(await qs.locator('.opedit input').evaluateAll(n=>n.map(x=>x.value)),['Sí','No','Abstención']);await qs.getByRole('button',{name:'Cancelar'}).click();
  assert.equal(await page.getByRole('button',{name:/^(Guardar consulta|Falta)/}).textContent(),'Falta el título');checks.push('voting_defaults');

  // 12. Big screen: custom options as bars; free text only as a count; closed label of the consultation.
  await page.locator('.top .back').click();await page.locator('[data-voting-admin-consultation=c2] button').first().click();
  await page.setViewportSize({width:1920,height:1080});
  await page.evaluate(()=>{db.consultations[1].active='q1';db.last.c2='q1';});
  await page.locator('[data-voting-live-open]').click();const live=page.locator('[data-voting-live]');await live.locator('[data-voting-live-question=q1]').waitFor({timeout:4000});
  assert.equal(await live.locator('[data-voting-live-option]').count(),3);assert.equal(await live.locator('[data-voting-live-option=o1] .llabel').textContent(),LONG);
  assert.equal(await live.locator('[data-voting-live-option=si] .lpct').textContent(),'80%');assert.equal(await live.locator('[data-voting-live-option=o1] .lcount').textContent(),'1 respuesta');
  assert.match(await live.locator('.lbig span').textContent(),/ya respondieron$/);await page.screenshot({path:path.join(out,'pantalla-en-vivo-opciones.png')});
  await page.evaluate(()=>{db.consultations[1].active='q2';db.last.c2='q2';emitLive();});await live.locator('[data-voting-live-question=q2]').waitFor({timeout:4000});
  assert.equal(await live.locator('[data-voting-live-option]').count(),1);assert.equal(await live.locator('[data-voting-live-option=text] .lpct').textContent(),'2');
  assert.equal(await live.getByText('Necesito',{exact:false}).count(),0);await page.screenshot({path:path.join(out,'pantalla-en-vivo-respuesta-libre.png')});
  await page.evaluate(()=>{db.consultations[1].open=false;emitLive();});await live.locator('[data-voting-live-state=closed]').filter({hasText:'ENCUESTA CERRADA'}).waitFor({timeout:4000});
  for(const [w,h] of [[1280,720],[390,844]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(150);assert(await live.evaluate(e=>e.scrollWidth<=e.clientWidth),'big screen overflow '+w);}
  await live.getByRole('button',{name:'Cerrar votación en vivo'}).click();await live.waitFor({state:'detached'});checks.push('big_screen');
  await page.evaluate(()=>{db.consultations[1].open=true;});

  // 13. «VER»: option label and free text.
  await page.locator('[data-voting-votes-open=c2]').first().click();const ver=page.getByRole('dialog');await ver.locator('[data-voting-votes-vote=x2]').waitFor();
  assert.equal(await ver.locator('[data-voting-votes-vote=x1] .chip').textContent(),LONG);
  assert.equal(await ver.locator('[data-voting-votes-vote=x2] .chip').textContent(),'Respuesta libre');
  assert.equal(await ver.locator('[data-voting-votes-vote=x2] .vtext').textContent(),'“Necesito guardería los sábados”');
  assert(await noOverflow(page));await shot('admin-ver-respuestas');await ver.getByRole('button',{name:/^Borrar voto de .* pregunta 2$/}).click();
  assert((await ver.locator('[data-voting-votes-confirm]').textContent()).includes('Respuesta libre'));checks.push('ver_labels_and_text');
  await page.keyboard.press('Escape');

  // 14. CSV: per-option results get their own headers; original results keep theirs; file names follow the type.
  const csv=await page.evaluate(()=>[realRepository.csv([{'Consulta':'C','Pregunta':'P','Respuesta':'Tal vez','Respuestas':1,'% de respuestas':100,'Total':1,'Participación %':8.3}],false).split('\r\n')[1],
   realRepository.csv([{'Consulta':'C','Pregunta':'P','Sí':1,'No':0,'Abstención':0,'Total':1,'Participación %':1}],false).split('\r\n')[1],
   realRepository.csv([{'Folio':'V','Respuesta':'=1+1'}],true).split('\r\n')[2]]);
  assert.equal(csv[0],'"Consulta";"Pregunta";"Respuesta";"Respuestas";"% de respuestas";"Total";"Participación %"');
  assert.equal(csv[1],'"Consulta";"Pregunta";"Sí";"No";"Abstención";"Total";"Participación %"');assert(csv[2].includes('"\'=1+1"'),'formula neutralized');
  const names=[];for(const [identified,kind] of [[false,'consultation'],[true,'consultation'],[false,'voting'],[true,undefined]]){
   const [download]=await Promise.all([page.waitForEvent('download'),page.evaluate(([identified,kind])=>{window.SutiSupabase={getClient:()=>({rpc:async()=>({data:[],error:null})})};return realRepository.download('c2',identified,kind);},[identified,kind])]);names.push(download.suggestedFilename());}
  assert.deepEqual(names,['consultas-resultados.csv','consultas-respuestas.csv','votaciones-resultados.csv','votaciones-votos.csv']);checks.push('csv_headers_and_names');

  assert.deepEqual(errors,[]);
  const result={status:'PASS',checks,errors,scope:'Isolated browser fixtures only; backend rules tested in SQL with ROLLBACK (backend.json).',productionWrites:0};
  fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }catch(e){await page.screenshot({path:path.join(out,'browser-failure.png'),fullPage:true}).catch(()=>{});console.error(JSON.stringify({checks,errors,error:e.message}));process.exitCode=1;}
 finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})();
