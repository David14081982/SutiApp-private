'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/voting-20260915');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const source=sandbox.Babel.transform(fs.readFileSync(path.join(root,'app/screens-voting.jsx'),'utf8'),{presets:['react']}).code;
(async()=>{fs.mkdirSync(out,{recursive:true});const server=await serve(),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/voting-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/voting-fixture');
 await page.setContent('<!doctype html><html lang="es"><head><meta charset="utf-8"><style>body{margin:0;background:#f2f3f5}button{font:inherit}*{box-sizing:border-box}</style></head><body><main id="root"></main></body></html>');
 await page.addStyleTag({path:path.join(root,'tmp/voting-release/app/text-size.css')});
 for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/voting-design.js','app/voting-repository.js'])await page.addScriptTag({path:path.join(root,f)});
 await page.addScriptTag({content:source});
 await page.evaluate(()=>{
  window.testVoteCalls=0;window.saved=null;window.exported=null;
  window.fixture={consultations:[{id:'c1',title:'Consulta de verificación visual',closes_on:'2099-09-30',electorate:100,published:true,open:true,version:1,audience:{mode:'all',unions:[],categories:[],positions:[],emails:[]},questions:[{id:'q1',title:'Primera pregunta de verificación',detail:'Detalle completo de la consulta.'},{id:'q2',title:'Segunda pregunta con explicación',detail:'Otra pregunta para comprobar el progreso.'}]}],can_vote:true,permissions:Object.fromEntries(['read','create','update','delete','publish','results','export_identified_votes'].map(k=>[k,true])),catalog:{segments:[{type:'union',code:'SUTISSSTESON',label:'SUTISSSTESON'},{type:'employment_category',code:'BASE',label:'Base'}],positions:['Afiliado','Delegado']}};
  window.VotingRepository={...window.VotingRepository,list:async()=>JSON.parse(JSON.stringify(window.fixture)),vote:async(c,q,answer)=>{window.testVoteCalls++;await new Promise(r=>setTimeout(r,80));const v={answer,folio:'V-isolated-fixture',cast_at:new Date().toISOString(),results:{si:1,no:0,abs:0,total:1,participation:1}};const item=window.fixture.consultations[0].questions.find(x=>x.id===q);item.mine=v;item.results=v.results;return v;},save:async c=>{window.saved=JSON.parse(JSON.stringify(c));return 'saved';},download:async(id,identified)=>{window.exported={id,identified};},action:async(c,action)=>{window.action=action;}};
  window.root=ReactDOM.createRoot(document.querySelector('#root'));window.renderVoting=admin=>root.render(React.createElement(admin?window.VotingAdmin:window.VotingHome,{app:{toast:()=>{}},onBack:()=>{}}));renderVoting(false);
 });
 await page.locator('.head').click();assert.equal(await page.locator('.bars').count(),0);checks.push('results_hidden');
 await page.locator('[data-voting-question=q1]').getByRole('button',{name:'Sí',exact:true}).click();await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'Confirmar voto',exact:true}).dblclick();await page.getByText('Tu voto: Sí',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>testVoteCalls),1);assert.equal(await page.locator('.bars').count(),1);checks.push('confirmation_once_results_receipt');
 for(const [label,size] of [['normal','normal'],['grande','large'],['muy-grande','largest']]){
  await page.locator('[data-voting-home]').evaluate((e,s)=>e.dataset.textSize=s,size);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home overflow '+label);
  assert(await page.locator('.opt').first().evaluate(e=>e.getBoundingClientRect().height>=44));
  await page.screenshot({path:path.join(out,'afiliado-'+label+'.png'),fullPage:true});
 }
 checks.push('affiliate_three_text_sizes');
 await page.evaluate(()=>renderVoting(true));await page.getByRole('button',{name:'Nueva consulta',exact:true}).click();
 await page.getByRole('textbox',{name:'Título',exact:true}).fill('Consulta nueva');await page.getByLabel('CIERRA EL',{exact:true}).fill('2099-12-31');await page.getByLabel('PADRÓN CONVOCADO',{exact:true}).fill('120');
 await page.getByRole('button',{name:'Agregar pregunta',exact:true}).click();await page.getByRole('textbox',{name:'PREGUNTA',exact:true}).fill('Pregunta creada');await page.getByRole('textbox',{name:'EXPLICACIÓN (OPCIONAL)',exact:true}).fill('Explicación');await page.getByRole('button',{name:'Guardar pregunta',exact:true}).click();
 await page.getByRole('button',{name:'Segmentado',exact:false}).click();await page.getByRole('button',{name:'Base',exact:true}).click();checks.push('editor_question_segment');
 await page.getByRole('button',{name:'Solo estas personas',exact:false}).click();await page.getByRole('textbox',{name:'Correos autorizados'}).fill(' A@Example.Invalid, a@example.invalid; B@example.invalid ');await page.getByRole('button',{name:'Agregar',exact:true}).click();assert.equal(await page.locator('.mail').count(),2);checks.push('normalized_deduplicated_emails');
 for(const [label,size] of [['normal','normal'],['grande','large'],['muy-grande','largest']]){
  await page.locator('[data-voting-admin]').evaluate((e,s)=>e.dataset.textSize=s,size);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'admin overflow '+label);
  await page.screenshot({path:path.join(out,'admin-'+label+'.png'),fullPage:true});
 }
 await page.getByRole('button',{name:'Guardar consulta',exact:true}).click();await page.waitForFunction(()=>!!window.saved);assert.equal(await page.evaluate(()=>saved.questions.length),1);assert.equal(await page.evaluate(()=>saved.audience.emails.length),2);checks.push('save_complete_draft');
 await page.getByRole('button',{name:'Exportar a Excel',exact:true}).click();await page.getByRole('button',{name:'Votos emitidos',exact:true}).click();await page.waitForFunction(()=>exported?.identified===true);checks.push('nominal_export_control');
 const csv=await page.evaluate(()=>window.VotingRepository.csv([{'Consulta':'=HYPERLINK("x")','Pregunta':'Pregunta; "comillas"','Sí':1}],false));assert(csv.startsWith('\uFEFFsep=;\r\n'));assert(csv.includes("'=HYPERLINK"));assert(csv.includes('""comillas""'));checks.push('csv_bom_delimiter_injection_escaping');
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(out,'admin-desktop.png'),fullPage:true});
 assert.deepEqual(errors,[]);const result={status:'PASS',checks,errors,scope:'Isolated browser fixtures only. SQL authorization and persistence tested separately.',productionWrites:0};fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await page.screenshot({path:path.join(out,'browser-failure.png'),fullPage:true});console.error(JSON.stringify({checks,errors,error:e.message}));throw e;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e.message);process.exitCode=1;});
