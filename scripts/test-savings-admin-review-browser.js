'use strict';
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.abort());await page.setContent('<html lang="es"><body><div id="root"></div></body></html>');
  await page.addStyleTag({content:[...fs.readFileSync('SutiApp.html','utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n')});
  for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/savings-review-admin.jsx'])await page.addScriptTag({content:fs.readFileSync(f,'utf8')});
  await page.evaluate(()=>{
   window.calls=[];window.fail=false;window.allow=true;let sequence=0;window.crypto.randomUUID=()=> 'isolated-command-'+(++sequence);
   const records=[{id:'one',batch_id:'batch',folio:'00123',sheet:'Ahorro',row:2,status:'PENDING',identity:{name:'Cuenta aislada',match_count:1},issues:[],proposed_balance:1000},{id:'two',batch_id:'batch',folio:'00234',sheet:'Ahorro',row:3,status:'PENDING',identity:{name:'Primero DUPLICADO',match_count:2},issues:['IDENTITY_DUPLICADO'],proposed_balance:null}];
   const details={};records.forEach(r=>details[r.id]={id:r.id,source_sheet:r.sheet,source_row:r.row,version:0,status:'PENDING',identity:r.identity,source_data:{A:r.folio,Q:r.proposed_balance,AA:null},proposed_data:{},raw_source:{},field_defs:[{key:'A',label:'Folio',kind:'text',editable:true},{key:'Q',label:'Saldo (HOY)',kind:'money',editable:true},{key:'AA',label:'2026-01-15 · Descuento registrado',kind:'money',editable:true}],batch:{observed_at:'2026-09-06T21:00:00Z'},history:[]});
   window.SavingsReviewRepository={list:async()=>({can_write:window.allow,can_review_identity:window.allow,batches:[{id:'batch',source_name:'Fixture aislado',observed_at:'2026-09-06T21:00:00Z',expected_records:2}],records}),detail:async id=>JSON.parse(JSON.stringify(details[id])),save:async c=>{window.calls.push(c);if(window.fail){window.fail=false;throw Error('NETWORK');}const d=details[c.id];d.history.push({id:1,actor:'isolated-actor',actor_name:'Encargado de prueba',at:new Date().toISOString(),observation:c.observation,before:{proposed_data:d.proposed_data,status:d.status},after:{proposed_data:{...d.proposed_data,...c.changes},status:c.status}});d.proposed_data={...d.proposed_data,...c.changes};d.status=c.status;d.version++;}};
   window.mount=()=>{if(window.uiRoot)window.uiRoot.unmount();window.uiRoot=ReactDOM.createRoot(document.getElementById('root'));window.uiRoot.render(React.createElement(window.SavingsReviewAdmin));};window.mount();
  });
  await page.getByRole('button',{name:'Revisar 00123 fila 2',exact:true}).click();
  await page.getByLabel('Q · Saldo (HOY)',{exact:true}).fill('600');
  await page.getByLabel('Estado al guardar').selectOption('IN_REVIEW');
  await page.getByRole('button',{name:'Revisar antes de guardar',exact:true}).click();assert.equal((await page.evaluate(()=>window.calls)).length,0);
  assert.match(await page.getByRole('region',{name:'Confirmar revisión'}).innerText(),/1,000.*600/);
  await page.evaluate(()=>window.fail=true);await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await page.getByRole('status').waitFor();
  const calls=await page.evaluate(()=>window.calls);assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].observation,'');assert.equal(calls[0].changes.Q,600);
  await page.getByLabel('Grupo de campos').selectOption('dates');await page.getByLabel('AA · 2026-01-15 · Descuento registrado',{exact:true}).fill('0');
  await page.getByRole('button',{name:'Revisar antes de guardar',exact:true}).click();assert.match(await page.getByRole('region',{name:'Confirmar revisión'}).innerText(),/Sin dato.*0\.00/);
  await page.getByRole('button',{name:'Volver a editar',exact:true}).click();await page.getByLabel('AA · 2026-01-15 · Descuento registrado',{exact:true}).fill('');
  await page.getByLabel('Buscar Folio o nombre').fill('DUPLICADO');assert.equal(await page.getByRole('button',{name:'Revisar 00234 fila 3',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Revisar 00123 fila 2',exact:true}).count(),0);
  await page.getByLabel('Buscar Folio o nombre').fill('');await page.setViewportSize({width:390,height:844});
  fs.mkdirSync('docs/qa/evidence/savings-admin-review-20260906',{recursive:true});await page.screenshot({path:'docs/qa/evidence/savings-admin-review-20260906/review-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),true,'No whole-page horizontal overflow');
  await page.evaluate(()=>{window.allow=false;window.mount();});await page.getByRole('button',{name:'Revisar 00123 fila 2',exact:true}).click();await page.getByRole('article',{name:'Detalle de revisión'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Revisar antes de guardar',exact:true}).count(),0);assert.equal(await page.getByLabel('Q · Saldo (HOY)',{exact:true}).count(),0);assert.deepEqual(errors,[]);
  const result={status:'PASS',fixture_network:'BLOCKED',checks:['leading zero Folio','duplicate visible','original versus proposal','optional notes','preview before save','retry same command','null versus zero','filters','history','read-only','mobile overflow']};
  fs.writeFileSync('docs/qa/evidence/savings-admin-review-20260906/browser-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
