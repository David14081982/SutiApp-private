'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.abort());await page.setContent('<html><body><div id="root"></div></body></html>');
  for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/savings-request-form.jsx','app/screens-savings.jsx'])await page.addScriptTag({content:fs.readFileSync(f,'utf8')});
  await page.evaluate(()=>{
   window.calls=[];window.count=0;window.fail=false;window.crypto.randomUUID=()=>`test-${++count}`;
   window.dashboard={participant:{id:'p'},balances:{capital:900,yield_amount:100,total:1000,available:1000},annual:[{year:'2026-S2',label:'2026 - Julio a diciembre',subtotal_label:'Subtotal registrado',capital:900,yield:100,closed:false}],enrollment:{status:'Ahorrando',current_contribution_amount:500,frequency:'TWICE_MONTHLY',enrollment_started_at:'2026-01-15'},actions:{WITHDRAW:true,CHANGE_AMOUNT:true,TERMINATE:true,JOIN:true},write_capabilities:{requests:true,beneficiaries:true},history:[],withdrawals:[],beneficiaries:[],requests:[],upcoming:[]};
   window.SavingsRepository={submitRequest:async v=>{calls.push({kind:'request',...v});if(fail){fail=false;throw Error('NETWORK');}return {folio:'AH-TEST'};},replaceBeneficiaries:async(v,k)=>{calls.push({kind:'beneficiaries',rows:v,key:k});}};
   window.useSavingsStore=()=>({state:()=>({self:dashboard,selfPhase:'ready'}),loadSelf:async()=>{}});
   window.SavingsBalanceReadModel={select:s=>({status:'ready',value:s.self.balances.total,label:'$1,000.00'})};
   window.root=ReactDOM.createRoot(document.getElementById('root'));window.mount=()=>root.render(React.createElement(SavingsScreen,{app:{back:()=>{}}}));mount();
  });
  await page.locator('[data-savings-action="WITHDRAW"]').click();
  await page.getByLabel('Importe a retirar').fill('300');await page.getByRole('button',{name:'Revisar solicitud',exact:true}).click();
  assert.equal(await page.evaluate(()=>calls.length),0);await page.evaluate(()=>fail=true);
  await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).click();await page.getByRole('button',{name:'Entendido'}).waitFor();
  const partial=await page.evaluate(()=>calls);assert.equal(partial.length,2);assert.equal(partial[0].idempotencyKey,partial[1].idempotencyKey);assert.equal(partial[0].continueSaving,true);assert.equal(partial[0].amount,300);assert.equal(partial[0].reason,'');
  await page.getByRole('button',{name:'Entendido'}).click();await page.locator('[data-savings-action="WITHDRAW"]').click();await page.getByLabel('Importe a retirar').fill('1000');
  await page.getByLabel('Después de retirar todo').selectOption('no');await page.getByRole('button',{name:'Revisar solicitud',exact:true}).click();await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).click();await page.getByRole('button',{name:'Entendido'}).waitFor();assert.equal(await page.evaluate(()=>calls.at(-1).continueSaving),false);
  await page.getByRole('button',{name:'Entendido'}).click();await page.getByRole('button',{name:'Información',exact:true}).click();await page.getByRole('button',{name:'Dejar de ahorrar',exact:true}).click();await page.getByRole('button',{name:'Revisar solicitud',exact:true}).click();await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).click();await page.getByRole('button',{name:'Entendido'}).waitFor();assert.equal(await page.evaluate(()=>calls.at(-1).requestType),'TERMINATE');assert.equal(await page.evaluate(()=>calls.at(-1).amount),0);
  await page.getByRole('button',{name:'Entendido'}).click();await page.locator('[data-savings-detail="beneficiaries"]').click();await page.getByRole('button',{name:'Actualizar beneficiarios',exact:true}).click();await page.getByRole('button',{name:'Agregar beneficiario'}).click();await page.getByLabel('Nombre completo').fill('Persona Beneficiaria');await page.getByLabel('Parentesco').fill('Hija');await page.getByLabel('Porcentaje',{exact:true}).fill('99');assert.equal(await page.getByRole('button',{name:'Revisar beneficiarios'}).isDisabled(),true);await page.getByLabel('Porcentaje',{exact:true}).fill('100');await page.getByRole('button',{name:'Revisar beneficiarios'}).click();await page.getByRole('button',{name:'Confirmar beneficiarios'}).click();await page.getByRole('heading',{name:'Beneficiarios',exact:true}).waitFor();assert.equal(await page.evaluate(()=>calls.at(-1).rows[0].percentage),100);
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.evaluate(()=>{dashboard.write_capabilities={requests:false,beneficiaries:false};mount();});
  await page.waitForFunction(()=>document.querySelector('[data-savings-action="WITHDRAW"]').disabled);assert.equal(await page.locator('[data-savings-action="CHANGE_AMOUNT"]').isDisabled(),true);
  for(const width of [320,430,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
  assert.deepEqual(errors,[]);console.log('PASS self actions: partial/full/stop, optional notes, review before submit, same-key retry, beneficiary 100%, private gates, 320/430/1440, no real writes');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
