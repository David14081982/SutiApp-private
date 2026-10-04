'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const {analyzeSicofLoans}=await import('../supabase/functions/sicof/loan-calculation.mjs');
 const {calculateSicof,createPreparedCalculator}=await import('../supabase/functions/sicof/engine.mjs');
 const before=await import('./fixtures/sicof-loan-calculation-before-evidence.mjs');
 const row=(patch={})=>({source_row:2,date:'2026-01-15',paid:697.5,loan_id:'008',folio:'00123',name:'Synthetic',process:1,fund:'Caja de Ahorro',rate:.05,term:12,principal:5000,total_due:8370,loan_charges:3370,scheduled_charges:280.83,expected:697.5,status:'AL CORRIENTE',paid_to_date:697.5,expected_to_date:697.5,scheduled_admin_fee:370/12,admin_fee_total:370,interest_total:3000,principal_interest_total:8000,scheduled_capital:416.67,...patch});
 const source=rows=>({rows,date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE'});
 const options={from:'2026-01-01',to:'2026-06-30',as_of:'2026-06-30'};
 const settings={src:'caja',selFunds:[],pay:81,method:'avg',periodIni:options.from,periodFin:options.to,minm:6,exterm:true,exmin:true,warn:20,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const person={id:'person',folio:'00123',name:'Synthetic',certified:true,identity_resolved:true,enrollment:{enrollment_started_at:'2025-01-01'},eligibility:{complete:true},transactions:[{id:'t',component:'CAPITAL',direction:'CREDIT',amount:1000,effective_date:'2025-01-01',transaction_type:'CONTRIBUTION'}],composition:{balances:{capital:1000,yield_amount:0}},history:[]};
 const context={today:options.as_of,participants:[person]};
 const check=(rows,verified)=>{
  const a=analyzeSicofLoans(source(rows),options),old=before.analyzeSicofLoans(source(rows),options);
  assert.equal(a.loans[0].savings_evidence.verified,verified);
  const stripped={...a,loans:a.loans.map(({savings_evidence,...loan})=>loan)};
  assert.deepEqual(stripped,old,'all payment/portfolio/behavior fields remain identical');
  return a;
 };
 let a=check([row({scheduled_capital:null})],true);
 assert.equal(a.loans[0].behavior,'REVIEW_REQUIRED');assert.equal(a.payments[0].interest,null);
 let r=calculateSicof(context,a,{settings});assert.equal(r.nqual,1);assert.equal(r.reviewCount,0);assert.equal(r.collected,0);
 assert.deepEqual(createPreparedCalculator(context,a).calculate({settings}),r);
 for(const patch of [{status:null},{paid_to_date:null},{expected_to_date:-1},{fund:' Caja de Ahorro'},{status:'AL CORRIENTE',expected_to_date:800},{status:'SALDO ATRASADO'}]){
  a=check([row(patch)],false);r=calculateSicof(context,a,{settings});assert.equal(r.nqual,0);assert.equal(r.reviewCount,1);
 }
 check([row(),row({source_row:3})],false);
 check([row(),row({source_row:3,date:'2026-01-30',expected_to_date:800})],false);
 a=check([row({scheduled_capital:null,status:'SALDO ATRASADO',paid_to_date:300,expected_to_date:697.5})],true);
 r=calculateSicof(context,a,{settings:{...settings,retScope:'adeudo'}});assert.equal(r.nqual,1);assert.equal(r.rows[0].retenido,397.5);
 r=calculateSicof(context,a,{settings:{...settings,loanEffect:'rendimiento'}});assert.equal(r.nqual,0);assert.equal(r.nexcl,1);
 const stale=structuredClone(a);stale.loans[0].savings_evidence.as_of='2026-06-29';assert.equal(calculateSicof(context,stale,{settings}).reviewCount,1);
 const missing=structuredClone(a);delete missing.loans[0].savings_evidence;assert.equal(calculateSicof(context,missing,{settings}).reviewCount,1);
 const unknown={...context,participants:[{...person,eligibility:{complete:false,reasons:['HISTORICAL_EXPECTATION_UNVERIFIED']}}]};
 r=calculateSicof(unknown,a,{settings});assert.equal(r.rate,null);assert.equal(r.basisPending,true);assert.equal(r.rows[0].rend,null);assert.equal(r.reviewReasons[0].count,1);
 const empty=calculateSicof({...context,participants:[]},a,{settings});assert.equal(empty.basisPending,false);
 const proof={status:'PASS',checks:['payment and portfolio results unchanged','component-only review does not invalidate proven current status','unknown identity/status/aggregates and duplicate evidence remain pending','status must agree with current aggregate arrears','known arrears retain hold and exclusion rules','stale/missing proof stays strict','history is not inferred','prepared/normal results identical','empty versus pending basis distinguished'],financialWrites:0};
 const out=path.resolve(__dirname,'../docs/qa/evidence/sicof-evidence-integration');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'engine.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
})().catch(e=>{console.error(e);process.exitCode=1;});
