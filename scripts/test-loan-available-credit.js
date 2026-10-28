'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),{pathToFileURL}=require('url');
const repository=path.resolve(__dirname,'..'),candidate=path.join(repository,'.tmp/loan-available-credit/release');
const root=path.resolve(process.env.SUTI_CAPACITY_ROOT||(fs.existsSync(candidate)?candidate:repository));
async function main(){
 const {projectLoanCapacity,applyLoanCapacity}=await import(pathToFileURL(path.join(root,'supabase/functions/financial-legacy/loan-capacity.mjs')));
 const {projectHistory}=await import(pathToFileURL(path.join(root,'supabase/functions/loan-history/history.mjs')));
 const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'app/history-loans-repository.js'),'utf8'),{window,Intl});
 const checks=[],test=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};
 const identity={affiliate_id:'affiliate',numero_control:'0007'},now='2026-10-27T05:00:00Z';
 const runtime={funds:[{id:'caja',name:'Caja Chica'},{id:'aguinaldo',name:'30/11/2026 — Aguinaldos'}],rules:[{id:'rule',fund_id:'caja',criterion_identity:'criterion'}],requests:[]};
 const row=(id,date,amount,extra={})=>({id,source_row:2,owner:'0007',date,amount,scheduled:amount,number:1,fund:'Caja Chica',principal:5000,total:6260,term:1,status:'AL CORRIENTE',...extra});
 const source=loans=>({folio:'0007',loans,requests:[]});
 const calculate=loans=>projectLoanCapacity(source(loans),runtime,now,identity);
 test('two distinct loans consume aggregate pending contract balance',()=>{
  const result=calculate([row('1','2026-11-01',5000,{total:5000}),row('2','2026-11-01',5000,{total:5000})]);
  assert.equal(result.funds[0].pending_amount,10000);assert.equal(result.funds[0].active_loans,2);assert.equal(result.funds[1].pending_amount,0);
 });
 test('exact agreement with current Amortizacion for charges, past zero and decimal sums',()=>{
  for(const loans of [
   [row('1','2026-11-30',6260)],
   [row('1','2026-10-01',0,{term:2}),row('1','2026-11-01',3130,{number:2,source_row:3,term:2})],
   [row('1','2026-10-01',0.1,{total:0.6,term:3}),row('1','2026-10-15',0.2,{total:0.6,term:3,number:2,source_row:3}),row('1','2026-11-01',0.3,{total:0.6,term:3,number:3,source_row:4})]
  ]){
   const data=source(loans),entry=projectHistory(data,{folio:'0007',requests:[]},now).entries[0];
   const expected=Math.round(window.LoanHistory.metrics(entry).balance*100)/100;
   assert.equal(projectLoanCapacity(data,runtime,now,identity).funds[0].pending_amount,expected);
  }
  assert.equal(calculate([row('1','2026-11-30',6260)]).funds[0].pending_amount,6260);
 });
 test('today follows Hermosillo and releases only the recorded deduction',()=>{
  const loans=[row('1','2026-10-27',6260)];
  assert.equal(projectLoanCapacity(source(loans),runtime,'2026-10-27T06:59:59Z',identity).funds[0].pending_amount,6260);
  assert.equal(projectLoanCapacity(source(loans),runtime,'2026-10-27T07:00:00Z',identity).funds[0].pending_amount,0);
 });
 test('settled label never bypasses the displayed balance; overpayment gives no extra credit',()=>{
  const loans=[row('1','2026-10-01',6260,{status:'LIQUIDADO'}),row('2','2026-10-01',6260,{status:'PAGÓ DE MÁS'}),row('3','2026-10-01',7000),row('4','2026-11-01',100,{total:100,status:'SALDO ATRASADO'})];
  assert.equal(calculate(loans).funds[0].pending_amount,100);
  assert.equal(calculate([row('1','2026-11-01',6260,{status:'LIQUIDADO'})]).funds[0].pending_amount,6260);
 });
 test('distinct source rows with equal dates and quota numbers match Amortizacion',()=>{
  const loans=[row('1','2026-10-01',1000),row('1','2026-10-01',1000,{source_row:3})];
  const entry=projectHistory(source(loans),{folio:'0007',requests:[]},now).entries[0];
  const result=calculate(loans);assert.equal(result.funds[0].pending_amount,4260);
  assert.equal(result.funds[0].pending_amount,window.LoanHistory.metrics(entry).balance);
  assert.equal(calculate([row('1','2026-10-01',6260,{fund:'Retired historical name'})]).funds[0].pending_amount,0);
 });
 test('missing amounts, dates, states, duplicate source rows and ambiguous funds fail visibly',()=>{
  for(const patch of [{amount:null},{date:'2026-99-99'},{total:null},{status:'UNKNOWN'},{fund:'Unknown'}])assert.throws(()=>calculate([row('1','2026-11-01',6260,patch)]));
  assert.throws(()=>calculate([row('1','2026-11-01',6260),row('1','2026-11-01',6260)]),e=>e.message==='HISTORICAL_LOAN_DATA_REVIEW_REQUIRED'&&e.reason==='INSTALLMENT_DUPLICATE');
  assert.throws(()=>projectLoanCapacity(source([row('1','2026-11-01',6260)]),{...runtime,funds:[...runtime.funds,{id:'other',name:'Caja Chica'}]},now,identity),e=>e.message==='HISTORICAL_LOAN_MAPPING_REQUIRED'&&e.reason==='FUND_UNRESOLVED');
  assert.throws(()=>calculate([row('1','2026-11-01',6260,{owner:'7'})]),/IDENTITY/);
 });
 test('immutable transfer identifies represented request and original fund after rename',()=>{
  const request={id:'req',folio:'SR-2026-000001',financial:true,criterion_identity:'criterion',approved_at:'2026-10-01T12:00:00Z'};
  const s=source([row('42','2026-11-01',6260,{fund:'Previous fund name'})]);
  s.requests=[{id:'42',owner:'0007',status:'Iniciado',receipt:{id:42,identity:request.folio,sourceHash:'a'.repeat(64)}}];
  const result=projectLoanCapacity(s,{...runtime,requests:[request]},now,identity);
  assert.deepEqual(result.represented_request_ids,['req']);assert.equal(result.funds[0].pending_amount,6260);
  const bad=structuredClone(s);bad.loans[0].fund='Caja Chica';
  assert.throws(()=>projectLoanCapacity(bad,{...runtime,requests:[{...request,criterion_identity:'missing'}]},now,identity),e=>e.message==='HISTORICAL_LOAN_MAPPING_REQUIRED'&&e.reason==='CANONICAL_CONTRACT_UNRESOLVED');
  s.loans.push({...s.loans[0],id:'43',source_row:3});s.requests.push({...s.requests[0],id:'43',receipt:{...s.requests[0].receipt,id:43}});
  assert.throws(()=>projectLoanCapacity(s,{...runtime,requests:[request]},now,identity),/REQUEST_IDENTITY_AMBIGUOUS/);
 });
 test('visible fund total uses available amounts with zero and exact cents',()=>{
  const programs=[{id:'a',rule_id:'a',max_amount:25000,suggested_amount:5000},{id:'b',rule_id:'b',max_amount:40000,suggested_amount:5000}];
  const funds=[{rule_id:'a',max_amount:25000,available_amount:18740.25,pending_amount:6259.75,reserved_amount:0},{rule_id:'b',max_amount:40000,available_amount:0,pending_amount:40000,reserved_amount:0}];
  const out=applyLoanCapacity({programs},{funds});assert.equal(out.available_credit,18740.25);assert.equal(out.programs[1].available_amount,0);assert.equal(out.programs[0].max_amount,25000);
  assert.throws(()=>applyLoanCapacity({programs},{funds:funds.slice(1)}),/RESPONSE_INVALID/);
 });
 const dir=path.resolve(__dirname,'../docs/qa/evidence/loan-available-credit');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'projection.json'),JSON.stringify({status:'PASS',checks,productionWrites:0},null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
