'use strict';
// Synthetic inputs only; no production requests or external assets.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),http=require('http');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/renta-car');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
async function main(){
 fs.mkdirSync(out,{recursive:true});const checks=[];
 const projection=await import(pathToFileURL(path.join(root,'supabase/functions/financial-legacy/request-google-sync.js')));
 const rental={start_date:'2026-10-22',end_date:'2026-10-23',days:2,daily_rate:2500,total:5000,payment_due_date:'2026-10-22',payment_count:1};
 const request={id:'synthetic',numero_control:'00001',program_id:'renta',created_at:'2026-10-21T23:30:00Z',requested_amount:5000,requested_term:1,financial_submission_snapshot:{contract_version:'RENTA_CAR_CASH_V1',rental,product:{name:'Unidad de prueba'},financialResult:{fund:'Renta Car',amount:0,rate:0,paymentCount:1,total:5000}}};
 const row=projection.buildRequestRegisterRow(request,[],null);
 assert.equal(row.length,33);assert.deepEqual(row.slice(4,10),['Renta Car',0,1,0,5000,request.created_at]);assert(row[25].includes('Fecha final de pago: 2026-10-22'));checks.push('Sheets E:J exact mapping; G only payment count; A:AG boundary');
 assert.throws(()=>projection.buildRequestRegisterRow({...request,financial_submission_snapshot:{...request.financial_submission_snapshot,rental:{...rental,days:3}}},[],null),/RENTA_REGISTER_SNAPSHOT_INVALID/);
 const ordinary={...request,program_id:'auto',financial_submission_snapshot:{contract_version:'PROGRAM_PRODUCT_PAYMENT_V1',financialResult:{fund:'Caja Chica',rate:3,paymentCount:8,amount:20000,total:24800}}};
 assert.deepEqual(projection.buildRequestRegisterRow(ordinary,[],null).slice(4,10),['Caja Chica',.03,8,20000,24800,request.created_at]);checks.push('non-rental financing projection retained');
 const PDFLib=require(path.join(root,'.tmp/renta-car/deps/node_modules/pdf-lib'));
 const renderer=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/renderer.mjs'))),layouts=await import(pathToFileURL(path.join(root,'supabase/functions/document-generation/layout.mjs')));
 const template=await PDFLib.PDFDocument.create();template.addPage([612,792]);const bytes=await template.save();
 const config={template:{asset:{id:'template'},margins:{top:20,right:20,bottom:20,left:20}},signers:[{full_name:'Personal de prueba',title:'Autoriza',role:'Autoriza'}]};
 const snapshot=renderer.syntheticSnapshot('RENTA_CAR_APPROVAL','renta',config);
 assert(layouts.layoutFields('RENTA_CAR_APPROVAL').some(f=>f.key==='operation.financial.rental.total'));
 const render=renderer.createRenderer(PDFLib),one=await render(snapshot,async a=>{assert.equal(a.id,'template');return bytes;},{preview:true});
 snapshot.signature_data='data:image/png;base64,NOT_AN_IMAGE';snapshot.identity.signature_data=snapshot.signature_data;snapshot.operation.financial.applicant={signature_data:snapshot.signature_data};
 const two=await render(snapshot,async a=>{assert.equal(a.id,'template');return bytes;},{preview:true});assert.equal(Buffer.compare(one.bytes,two.bytes),0);assert.equal(renderer.documentContract(snapshot).schedule,null);assert(renderer.documentContract(snapshot).note.includes('Firma original'));
 fs.writeFileSync(path.join(out,'rental-synthetic-preview.pdf'),one.bytes);checks.push('rental PDF renders; applicant digital signature has no effect on bytes; original signature space');
 const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="es"><meta charset="utf-8"><body><div id="root"></div></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width:430,height:920}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.addStyleTag({content:':root{--bg:#f1f2f5;--surface:#fff;--surface-2:#f3f4f7;--ink:#17213e;--ink-2:#56617c;--ink-3:#8792ab;--hairline:#e4e7ed;--hairline-strong:#cdd3df;--guinda:#a90032}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Arial}#root{padding:16px;position:relative;height:920px}button{cursor:pointer}button:disabled{cursor:default} .test-btn{width:100%;background:var(--guinda);color:white;border:0;padding:16px;border-radius:14px;font-weight:bold}.test-btn:disabled{opacity:.45}'});
 for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
 await page.evaluate(({rental})=>{
  const h=React.createElement;window.Icon=()=>h('span',{'aria-hidden':true},'›');window.Btn=({children,onClick,disabled})=>h('button',{className:'test-btn',onClick,disabled},children);
  window.PrivateResourceDemand={context:()=> 'synthetic-session'};window.FinanceBlocksRepository={assertAllowed:async()=>{}};window.__calls=[];
  window.DocumentWorkflowRepository={resolveRequirements:async()=>[],listSelfDocuments:async()=>[]};window.RequestSubmissionSuccess=()=>h('div',{'data-success':true},'Solicitud enviada');
  window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{__calls.push({name,args});if(name==='renta_car_context')return {data:{today:'2026-10-22',daily_rate:2500,booked:[{start:'2026-10-25',end:'2026-10-26'}]}};if(name==='renta_car_quote')return {data:{product:{name:'Nissan Urvan 2023'},rental:{...rental,start_date:args.p_start,end_date:args.p_end},applicant:{full_name:'Persona de ejemplo',numero_control:'00001'}}};if(name==='renta_car_submit')return {data:{id:'test',folio:'TEST',status:'requires_financial_processing'}};throw Error('Unexpected RPC');}})};
 },{rental});
 for(const f of ['app/signature.jsx','app/screens-documentos.jsx','app/renta-car.jsx'])await page.addScriptTag({content:read(f)});
 await page.evaluate(()=>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(RentaCarFlow,{item:{id:'synthetic-vehicle',nombre:'Nissan Urvan 2023'},app:{}})));
 await page.locator('[data-renta-calendar]').waitFor();assert(await page.locator('[data-renta-day="2026-10-21"]').isDisabled());assert(await page.locator('[data-renta-day="2026-10-25"]').isDisabled());
 await page.locator('[data-renta-day="2026-10-24"]').click();await page.locator('[data-renta-day="2026-10-27"]').click();assert((await page.getByRole('alert').innerText()).includes('reservados'));
 await page.locator('[data-renta-day="2026-10-22"]').click();await page.locator('[data-renta-day="2026-10-23"]').click();assert.equal(await page.locator('[data-renta-total]').innerText(),'$5,000.00');assert.equal(await page.locator('[aria-pressed="true"]').count(),2);
 await page.screenshot({path:path.join(out,'calendar.png')});
 await page.getByRole('button',{name:'Continuar con esta simulación'}).click();await page.locator('[data-unified-document-phase]').waitFor();await page.getByRole('button',{name:'Continuar al resumen'}).click();await page.locator('[data-renta-summary]').waitFor();assert((await page.locator('[data-renta-summary]').innerText()).includes('$5,000.00'));assert(await page.getByRole('button',{name:'Enviar solicitud'}).isDisabled());
 await page.locator('canvas').scrollIntoViewIfNeeded();const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+30,box.y+40);await page.mouse.down();await page.mouse.move(box.x+100,box.y+70,{steps:10});await page.mouse.up();await page.getByRole('checkbox').check();await page.screenshot({path:path.join(out,'summary.png')});await page.getByRole('button',{name:'Enviar solicitud'}).click();await page.locator('[data-success]').waitFor();
 const sent=await page.evaluate(()=>__calls.filter(c=>c.name==='renta_car_submit'));assert.equal(sent.length,1);assert.equal(sent[0].args.p_start,'2026-10-22');assert.equal(sent[0].args.p_end,'2026-10-23');assert(sent[0].args.p_signature.startsWith('data:image/png;base64,'));assert.deepEqual(errors,[]);checks.push('browser: past/booked/crossed range blocked; two days = 5000; existing documents and real signature pad; one submission');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
 fs.writeFileSync(path.join(out,'surfaces.json'),JSON.stringify({status:'PASS',checks,productionWrites:0},null,2));checks.forEach(c=>console.log('PASS '+c));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
