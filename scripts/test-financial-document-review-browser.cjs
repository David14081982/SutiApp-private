// Synthetic isolated UI verification. All network requests are blocked.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const out=path.join(root,'docs/qa/evidence/financial-document-review');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
 try{
 await page.setContent('<style>:root{--surface:#fff;--surface-2:#edf0f5;--hairline:#e1e5ed;--ink:#172033;--ink-2:#364154;--ink-3:#657086;--guinda:#910022;--mono:monospace}*{box-sizing:border-box}body{font-family:Arial;background:#f3f5f9;margin:12px}</style><p>VISTA LOCAL · DATOS FICTICIOS · SIN OPENAI</p><div id="fixture"></div>');
 for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
 await page.evaluate(()=>{
  window.Icon=()=>null;window.money=n=>n.toLocaleString('es-MX',{style:'currency',currency:'MXN'});
  window.AffiliateAuth={getState:()=>({phase:'authenticated',session:{user:{id:'fixture'},access_token:'fixture'},affiliate:{id:'fixture'}}),subscribe:()=>()=>{}};
  window.AdminRepository={getState:()=>({phase:'authorized'}),subscribe:()=>()=>{}};
  window.AffiliateRepository={getProfilePhoto:async()=>null};
  for(const k of ['GeneratedDocuments','FinanceBlockRequestControl','SicofBehaviorCard'])window[k]=()=>null;
  const stage={id:'review',label:'Revisión de documentos',state:'current'},next={id:'approval',label:'Autorización',state:'upcoming',status_references:['approved']};
  const observation={key:'name',status:'MANUAL',message:'El nombre de la INE requiere revisión manual.',document_id:'ine',correctable:true};
  const payroll={latest:{document_id:'latest',net:9840,period_start:'2026-10-16',period_end:'2026-10-31'},average:9730,receipts:[{document_id:'latest',period_end:'2026-10-31',extras:[{kind:'BONUS',label:'Bono',amount:1500}]},{document_id:'previous',period_end:'2026-10-15',extras:[{kind:'OVERTIME',label:'Horas extras',amount:500}]}]};
  window.__reviews=[{request_id:'r0',source_hash:'v1',phase:'COMPLETE',result:{status:'MANUAL',payroll,observations:[observation],passed_count:8,check_count:9,rejection_draft:observation.message}},{request_id:'r1',source_hash:'v2',phase:'COMPLETE',result:{status:'FAIL',payroll,observations:[{...observation,message:'Los dos talones repiten el mismo periodo.'}],passed_count:7,check_count:9,rejection_draft:'Los dos talones repiten el mismo periodo.'}},{request_id:'r2',phase:'PROCESSING',result:null}];
  window.FinancialDocumentReviewRepository={list:async()=>__reviews};
  window.__rows=Array.from({length:3},(_,i)=>({id:'r'+i,folio:'DEMO-00'+i,affiliate_id:'a'+i,affiliate:{full_name:['María Elena López Soto','Carlos Alberto Pérez Díaz','Ana Lucía Hernández Ruiz'][i]},numero_control:'DEMO'+i,program_id:'prestamo',status:'requires_financial_processing',requested_amount:12000,requested_term:12,requested_term_semantics:'quincenal',financial_processing_status:'pending',created_at:'2026-11-12T18:00:00Z',ts:3-i,request_type:'benefit',workflow_state:{available:true,current_stage:stage,stages:[stage,next],can_reject:true},documents_available:true,request_documents:[],current_documents_available:true,current_affiliate_documents:[],admin_events_available:true,admin_events:[],terms_available:true,terms_accepted:true,financial_submission_snapshot:{financialResult:{fund:'Caja Chica',amount:12000,paymentCount:12,paymentPeriod:'quincenal',paymentPerPeriod:1180,total:14160}}}));
  window.__writes=0;window.ProgramRequestRepository={listAdminFlowQueue:async()=>__rows,listFinancialMobile:async()=>__rows,adminFlowDetail:async id=>({...__rows.find(r=>r.id===id),nombre:__rows.find(r=>r.id===id).affiliate.full_name}),newIdempotencyKey:()=>crypto.randomUUID(),transitionWorkflow:async()=>{__writes++;throw Error('NO_REAL_WRITES');}};
  window.DocumentWorkflowRepository={};window.__app={admin:{has:()=>true}};window.__count=()=>{};
 });
 for(const f of ['app/private-resource-demand.js','app/financial-document-review.jsx','app/admin-finance-queue-repository.js','app/screens-admin-finanzas.jsx'])await page.addScriptTag({content:read(f).replace('  function FinanzasModule(','  window.__Workbench=DesktopFinancialWorkbench;\n  function FinanzasModule(')});
 await page.evaluate(()=>{window.__root=ReactDOM.createRoot(document.getElementById('fixture'));__root.render(React.createElement(__Workbench,{app:__app,onCount:__count}));});
 const rows=page.locator('[data-financial-queue-row]');await rows.first().waitFor();
 assert.equal(await rows.count(),3);assert((await rows.first().innerText()).includes('9,840'));assert((await rows.first().innerText()).includes('1,180'));assert((await rows.first().innerText()).includes('9,730'));assert((await rows.first().innerText()).includes('Horas extras'));
 for(let i=0;i<3;i++)assert.equal(await rows.nth(i).getByRole('button',{name:'Aprobar',exact:true}).isEnabled(),true);
 checks.push('latest net, contractual installment, average, extras in both receipts; approval enabled for FAIL/MANUAL/PROCESSING');
 await rows.first().getByRole('button',{name:'Rechazar',exact:true}).click();await page.locator('dialog[open]').waitFor();
 await page.waitForFunction(()=>document.querySelector('.finwb-action-select')?.value==='reject');
 await page.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(x=>x.value.includes('nombre de la INE')));
 assert.equal(await page.evaluate(()=>__writes),0);checks.push('queue rejection opens existing detail, prefills existing field, never writes automatically');
 await page.locator('textarea[aria-label="Observación de la acción"]').fill('Motivo revisado por Finanzas');
 await page.evaluate(()=>window.dispatchEvent(new Event('suti:request-changed')));
 await page.waitForTimeout(150);
 assert.equal(await page.locator('textarea[aria-label="Observación de la acción"]').inputValue(),'Motivo revisado por Finanzas');
 await page.evaluate(()=>{__reviews[0]={...__reviews[0],source_hash:'v3',phase:'QUEUED',result:null};window.dispatchEvent(new Event('suti:request-changed'));});
 await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Observación de la acción"]')?.value==='');
 assert.equal(await page.evaluate(()=>__writes),0);checks.push('same-source refresh preserves edits; document change clears obsolete rejection before saving');
 await page.evaluate(()=>{__reviews[0]={...__reviews[1],request_id:'r0',source_hash:'v4',result:{...__reviews[1].result,status:'MANUAL'}};window.dispatchEvent(new Event('suti:request-changed'));});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 await rows.first().locator('[data-financial-queue-person]').click();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');checks.push('original row/detail navigation preserved');
 for(const width of [1440,1024,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:path.join(out,'queue-'+width+'.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);}
 assert.deepEqual(errors,[]);checks.push('desktop/tablet/mobile local screenshots, no page overflow');
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({status:'PASS',checks,errors,networkCalls:0,syntheticOnly:true},null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
