/* Real own-history UI/PDF with isolated A/B fixtures; no live services. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {setup,flush,count}=require('./test-history-snapshot-browser');
const root=path.resolve(__dirname,'..');
async function main(){
 const evidence=process.env.SUTI_HISTORY_EVIDENCE_DIR||path.join(root,'.tmp/history-total-paid-browser');fs.mkdirSync(evidence,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{for(const width of [320,390,1440]){
  const {page,errors,external}=await setup(browser,width),detail=page.locator('[data-detail]');
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);
  // Keep animation frames available to the real PDF renderer. Start an hour
  // before midnight so assertions cannot cross the boundary accidentally.
  await page.clock.setSystemTime(new Date('2026-10-27T06:00:00.000Z'));
  await page.evaluate(()=>{
   const future=loan('FUTURE','Aprobadas','AL CORRIENTE');future.total=1200;future.principal=1000;future.paid_to_date=999;
   future.schedule=Array.from({length:12},(_,i)=>({source_row:200+i,number:i+1,date:i?'2026-11-'+String(i).padStart(2,'0'):'2026-10-27',amount:100,scheduled:100,state:'Pendiente'}));
   const mixed=loan('MIXED','En pago','AL CORRIENTE');mixed.total=1000;mixed.paid_to_date=777;
   mixed.schedule=[{source_row:301,number:1,date:'2026-10-25',amount:100.25},{source_row:302,number:2,date:'2026-10-26',amount:50.5},{source_row:303,number:3,date:'2026-10-26',amount:0},{source_row:304,number:4,date:'2026-10-27',amount:250.125},{source_row:305,number:5,date:'2026-10-28',amount:500}];
   const missing=loan('MISSING','En pago','AL CORRIENTE');missing.paid_to_date=0;missing.schedule=[{source_row:401,number:1,date:null,amount:100}];
   const preparing={...loan('PREPARING','Aprobadas',null),preparing:true,schedule:[],paid_to_date:999};
   const exact=loan('EXACT','Liquidadas','LIQUIDADO');exact.principal=0.3;exact.total=0.3;exact.paid_to_date=999;exact.schedule=[{source_row:501,number:1,date:'2026-10-26',amount:0.1},{source_row:502,number:2,date:'2026-10-26',amount:0.2}];
   payload.entries=[future,mixed,missing,preparing,exact];payload.covered_request_ids=[];payload.financial_request_ids=[];payload.source_updated_at=new Date().toISOString();publishVersion('total-paid-fixture');
   setRoute({loanKey:'loan:FUTURE'});
  });await flush(page);
  const initial=await count(page),scroll=detail.locator('[data-amortization-scroll]'),raw=await page.evaluate(async()=>JSON.stringify(await LoanHistory.load('loan:FUTURE')));
  assert.equal(await detail.getByText('Total pagado',{exact:true}).count(),1);assert.equal(await detail.getByText('Monto amortizado',{exact:true}).count(),0);
  assert.equal(await detail.locator('[data-loan-paid]').innerText(),await page.evaluate(()=>money(0)));assert.equal(await detail.locator('[data-monetary-progress]').innerText(),'0%');assert.equal(await detail.locator('[data-loan-balance]').innerText(),await page.evaluate(()=>money(1200)));
  assert.equal(await detail.locator('[data-installment=Pendiente]').count(),12);assert.equal(await detail.locator('[data-approval-countdown]').count(),1);
  assert(await scroll.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:path.join(evidence,'total-paid-future-'+width+'.png')});
  const mixed=await page.evaluate(async()=>{const observation=await LoanHistory.load('loan:MIXED'),before=JSON.stringify(observation),entry=LoanHistory.project(observation,0)[0];return {paid:entry.paid_to_date,metrics:LoanHistory.metrics(entry),states:entry.schedule.map(row=>row.state),unchanged:before===JSON.stringify(observation)};});
  assert.equal(mixed.paid,150.75);assert.equal(mixed.metrics.balance,849.25);assert.equal(mixed.metrics.progress,15.075);assert.deepEqual(mixed.states,['Pagada','Pagada','No se descontó','Pendiente','Pendiente']);assert(mixed.unchanged);
  const validation=await page.evaluate(()=>{
   const now='2026-10-27T06:59:58.000Z',row=(date='2026-10-26',amount=1)=>({date,amount}),entry=(schedule,extra={})=>({kind:'loan',category:'En pago',status:'AL CORRIENTE',total:100,paid_to_date:999,schedule,...extra});
   const calculate=(rows,extra)=>LoanHistory.project({server_now:now,entries:[entry(rows,extra)]},0)[0].paid_to_date;
   const invalid=[null,'','2026-02-30','2026-13-01','26/10/2026','2026-10-26T00:00:00Z'].map(date=>calculate([row(date)]));
   const amounts=[null,undefined,'1',-1,NaN,Infinity,-Infinity].map(amount=>calculate([{date:'2026-10-27',amount}]));
   const decimalRows=[row('2026-10-25',0.1),row('2026-10-26',0.2),row('2026-10-27',2.34567)],before=JSON.stringify(decimalRows),decimals=calculate(decimalRows);
   const sums=[[0.105,0.205],[0.1234567890123456,0.0000000000000001],[10.005,0.00001],[1e-7,2e-7],[1e21,2e21],[5e-324,5e-324]].map(amounts=>calculate(amounts.map(amount=>row('2026-10-26',amount))));
   return {invalid,amounts,empty:calculate([]),missingSchedule:calculate(undefined),preparing:calculate([row()],{preparing:true}),overflow:calculate([row('2026-10-26',Number.MAX_VALUE),row('2026-10-26',Number.MAX_VALUE)]),futureOverflowDoesNotSum:calculate([row('2026-10-27',Number.MAX_VALUE),row('2026-10-27',Number.MAX_VALUE)]),decimals,sums,decimalUnchanged:before===JSON.stringify(decimalRows),sameDateRows:calculate([row('2026-10-26',7),row('2026-10-26',7)]),allZero:calculate([row('2026-10-25',0),row('2026-10-26',0)]),futureInvalid:calculate([row('2026-10-25',1),row('2026-10-27',-1)]),futureCalendarInvalid:calculate([row('2026-10-25',1),row('2099-02-30',1)])};
  });
  assert(validation.invalid.every(value=>value===null));assert(validation.amounts.every(value=>value===null));for(const key of ['empty','missingSchedule','preparing','overflow','futureInvalid','futureCalendarInvalid'])assert.equal(validation[key],null,key);
  assert.equal(validation.futureOverflowDoesNotSum,0);assert.equal(validation.decimals,0.3);assert.deepEqual(validation.sums,[0.31,0.1234567890123457,10.00501,3e-7,3e21,1e-323]);assert(validation.decimalUnchanged);assert.equal(validation.sameDateRows,14);assert.equal(validation.allZero,0);
  const summary=await page.evaluate(async()=>LoanHistory.project(await LoanHistory.load(),0));assert(summary.every(entry=>entry.paid_to_date===null),'summary cannot infer zero without its complete schedule');
  await scroll.evaluate(el=>{el.scrollTop=350;window.paidScroll=el;window.paidScrollTop=el.scrollTop;});const beforeClock=await detail.locator('[data-approval-countdown]').innerText();
  await page.clock.fastForward(3600001);await flush(page);
  assert.equal(await detail.locator('[data-loan-paid]').innerText(),await page.evaluate(()=>money(100)));assert.equal(await detail.locator('[data-loan-balance]').innerText(),await page.evaluate(()=>money(1100)));assert.equal(await detail.locator('[data-monetary-progress]').innerText(),'8.33%');
  assert.equal(await detail.locator('[data-installment=Pagada]').count(),1);assert.equal(await detail.locator('[data-installment=Pendiente]').count(),11);assert.notEqual(await detail.locator('[data-approval-countdown]').innerText(),beforeClock);
  assert(await scroll.evaluate(el=>el===paidScroll&&el.scrollTop===paidScrollTop),'midnight preserves open detail and scroll');assert.deepEqual(await count(page),initial,'Hermosillo midnight needs no network request');
  assert.equal(await page.evaluate(async()=>JSON.stringify(await LoanHistory.load('loan:FUTURE'))),raw,'date-driven presentation never rewrites source entries');
  const downloadPromise=page.waitForEvent('download');await detail.getByRole('button',{name:'Descargar estado de cuenta',exact:true}).click();const download=await downloadPromise,pdfPath=path.join(evidence,'total-paid-'+width+'.pdf');await download.saveAs(pdfPath);
  const parsed=await page.evaluate(bytes=>readStatementPdf(bytes,true),Array.from(fs.readFileSync(pdfPath)));
  assert(parsed.text.includes('Total pagado'));assert(!parsed.text.includes('Monto amortizado'));assert(parsed.text.includes('8.33%'));assert(parsed.text.includes('1,100.00'));assert(parsed.text.includes('100.00'));assert(parsed.rendered>1000);assert.equal(parsed.rows.length,12);
  assert.deepEqual(parsed.rows.map(row=>row.state),['Pagada',...Array(11).fill('Pendiente')]);
  await page.evaluate(()=>setRoute({loanKey:'loan:MIXED'}));await flush(page);
  const postMidnight=await page.evaluate(async()=>{const observation=await LoanHistory.load('loan:MIXED'),entry=LoanHistory.project(observation,3600001)[0];return {paid:entry.paid_to_date,balance:LoanHistory.metrics(entry).balance,amounts:entry.schedule.map(row=>row.amount)};});
  assert.equal(postMidnight.paid,400.875);assert.equal(postMidnight.balance,599.125);assert.deepEqual(postMidnight.amounts,[100.25,50.5,0,250.125,500]);
  assert.equal(await detail.locator('[data-loan-paid]').innerText(),await page.evaluate(()=>money(400.875)));assert.equal(await detail.locator('[data-loan-balance]').innerText(),await page.evaluate(()=>money(599.125)));
  await page.evaluate(()=>setRoute({loanKey:'loan:MISSING'}));await flush(page);assert.equal(await detail.locator('[data-loan-paid]').innerText(),'No registrado');assert.equal(await detail.locator('[data-monetary-progress]').innerText(),'Por revisar');assert.equal(await detail.locator('[data-loan-balance]').innerText(),'No registrado');
  await page.evaluate(()=>setRoute({loanKey:'loan:PREPARING'}));await flush(page);assert.equal(await detail.locator('[data-loan-paid]').innerText(),'No registrado');assert.equal(await detail.locator('[data-monetary-progress]').innerText(),'Por revisar');
  await page.evaluate(()=>setRoute({loanKey:'loan:EXACT'}));await flush(page);assert.equal(await detail.locator('[data-loan-paid]').innerText(),await page.evaluate(()=>money(0.3)));assert.equal(await detail.locator('[data-loan-balance]').innerText(),await page.evaluate(()=>money(0)));assert.equal(await detail.locator('[data-monetary-progress]').innerText(),'100%');assert.equal(await detail.getByText(/Pago excedente registrado/).count(),0);
  const exact=await page.evaluate(async()=>{const observation=await LoanHistory.load('loan:EXACT'),entry=LoanHistory.project(observation,3600001)[0];return {paid:entry.paid_to_date,metrics:LoanHistory.metrics(entry),pdf:await readStatementPdf(await LoanHistoryStatement.create(entry,observation).arrayBuffer())};});
  assert.equal(exact.paid,0.3);assert.deepEqual(exact.metrics,{progress:100,balance:0,overpaid:0});assert(!exact.pdf.text.includes('Pago excedente'));assert(exact.pdf.text.includes('100%'));assert(exact.pdf.text.includes('Total pagado'));
  assert.deepEqual(await count(page),initial,'detail changes and PDF do not fetch');
  await page.evaluate(()=>setRoute({loanKey:'loan:FUTURE'}));await flush(page);const beforeApproval=await count(page),approvalRaw=await page.evaluate(async()=>{const value=await LoanHistory.load('loan:FUTURE');return {entries:value.entries,updated:value.source_updated_at};});
  await page.evaluate(()=>window.dispatchEvent(new Event('suti:request-changed')));await flush(page);
  assert.equal((await count(page)).history,beforeApproval.history,'approval update does not fetch schedules');assert.equal(await detail.locator('[data-loan-paid]').innerText(),await page.evaluate(()=>money(100)),'approval clock reanchor cannot count a row twice');
  assert.deepEqual(await page.evaluate(async()=>{const value=await LoanHistory.load('loan:FUTURE');return {entries:value.entries,updated:value.source_updated_at};}),approvalRaw);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  checks.push({width,status:'PASS',futureZero:true,usesABNotV:true,pastTodayFuture:true,invalidRowsExplicit:true,overflow:true,decimalsUnchanged:true,decimalExactWithoutRounding:true,noFalseExcessUIOrPDF:true,exponents:true,summaryAndPreparingUnavailable:true,hermosilloMidnight:true,noNewRequests:true,scrollPreserved:true,approvalClockPreserved:true,approvalReanchor:true,pdfValuesAndLabel:true,sourceImmutable:true});await page.close();
 }}finally{await browser.close();}
 const result={status:'PASS',checks,sourceHashes:Object.fromEntries(['app/history-loans-repository.js','app/history-loans.jsx','app/history-statement.js','scripts/test-history-total-paid-browser.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))};fs.writeFileSync(path.join(evidence,'total-paid-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
