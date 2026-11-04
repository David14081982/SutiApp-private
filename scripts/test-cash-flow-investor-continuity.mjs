import assert from 'node:assert/strict';
import {buildInvestorCashFlow} from '../supabase/functions/reports-jc/cash-flow-investors.mjs';
import {resolveInvestorContinuity} from '../supabase/functions/reports-jc/cash-flow-investor-continuity.mjs';

const asOf='2026-11-04',checks=[];
const c=(id,number,start,end,principal,extra={})=>({id,investor_id:'one',code:'Contrato '+number+' C'+number,starts_on:start,ends_on:end,principal,
 monthly_rate:.025,payment_mode:'Mensual',status:'historical',source_status:'Renovado',source_sheet:'Cartera Inicial',source_row:number+2,
 source_observed_on:'2026-10-29',registered_current_capital:null,registered_contribution:0,registered_withdrawal:null,terms:[],...extra});
const s=contracts=>({as_of:asOf,contracts,movements:[],obligations:[],balances:[],reviews:[]});
const run=(source,from='2026-01')=>buildInvestorCashFlow({from,source,asOf:source.as_of});
const balance=(r,month,kind='investor_capital_balance')=>r.balances.find(b=>b.month===month&&b.kind===kind);
const sum=(r,kind)=>r.events.filter(e=>e.kind===kind).reduce((n,e)=>n+e.amount,0);
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};

check('305 to 270 to 391 preserves one principal and only 121 of new cash',()=>{
 const source=s([c('a',1,'2025-08-05','2026-02-05',305000,{registered_contribution:305000}),
  c('b',2,'2026-02-05','2026-08-05',270000,{registered_withdrawal:35000}),
  c('c',3,'2026-08-05','2027-02-05',391000,{source_status:'Vigente',registered_contribution:121000,registered_current_capital:391000,registered_balance_on:'2026-10-29'})]);
 const before=JSON.stringify(source),r=run(source);assert.equal(JSON.stringify(source),before);
 assert.equal(balance(r,'2026-01').amount,305000);assert.equal(balance(r,'2026-02').amount,270000);assert.equal(balance(r,'2026-08').amount,391000);
 assert.equal(sum(r,'investor_contribution'),121000);assert.equal(sum(r,'investor_capital_return'),0);
 assert.equal(r.continuity.length,2);assert(r.continuity.every(x=>x.unattributedCapitalChange===0));
 assert.equal(r.unassigned.find(x=>x.basis==='ORIGINAL_WITHDRAWAL_UNDATED').amount,35000);
 assert(!r.events.some(e=>e.kind==='investor_capital_scheduled'&&['a','b'].includes(e.contractId)));
 assert.equal(r.records.find(x=>x.kind==='investor_capital_bridge'&&x.contractId==='b'&&x.period==='2026-02').contractualBalanceChange,270000);
});

check('500 to 650 expansion does not invent a 150 cash receipt',()=>{
 const r=run(s([c('a',1,'2025-02-07','2026-02-07',500000,{source_status:'Ampliado'}),c('b',2,'2026-02-07','2027-02-07',650000,{source_status:'Ampliado'})]));
 assert.equal(balance(r,'2026-01').amount,500000);assert.equal(balance(r,'2026-02').amount,650000);assert.equal(sum(r,'investor_contribution'),0);
 assert.equal(r.continuity[0].unattributedCapitalChange,150000);assert(r.issues.some(i=>i.code==='INVESTOR_CONTINUITY_CHANGE_UNATTRIBUTED'));
});

check('Identity, chronology and unique original sequence prevent speculative links',()=>{
 const source=[c('a',1,'2025-01-01','2026-01-01',1000),c('b',2,'2026-01-01','2027-01-01',1000,{investor_id:'other'}),
  c('c',2,'2024-01-02','2025-01-02',1000),c('d',7,'2026-01-01','2027-01-01',1000)];
 assert.equal(resolveInvestorContinuity(source).links.length,0);
 const ambiguous=resolveInvestorContinuity([source[0],c('x',1,'2025-02-01','2026-01-01',1000),c('y',2,'2026-01-01','2027-01-01',1000)]);
 assert.equal(ambiguous.links.length,0);assert(ambiguous.issues.some(i=>i.code==='INVESTOR_CONTINUITY_AMBIGUOUS'));
});

check('Original renewal references preserve early and later renewal dates without requiring exact maturity',()=>{
 const source=s([c('a',1,'2024-04-18','2024-10-18',300000),c('b',2,'2024-10-22','2025-10-22',370000,{code:'Contrato 2 RC 1'}),
  c('c',3,'2025-10-27','2026-10-27',450000,{code:'Contrato 3 RC 1,2'}),c('d',4,'2026-10-27','2027-10-27',450000,{source_status:'Vigente'})]);
 const r=run(source);assert.equal(r.continuity.length,3);assert.equal(balance(r,'2026-01').amount,450000);assert.equal(balance(r,'2026-11').amount,450000);
 const early=run(s([c('a',1,'2026-02-18','2026-08-18',150000),c('b',2,'2026-08-05','2027-02-05',200000,{code:'Contrato 2 R C1',source_status:'Vigente'})]));
 assert.equal(balance(early,'2026-07').amount,150000);assert.equal(balance(early,'2026-08').amount,200000);assert.equal(early.continuity[0].date,'2026-08-05');
 assert(early.issues.some(i=>i.code==='INVESTOR_PARTIAL_PERIOD_UNSPECIFIED'));
});

check('Explicit original references can merge concurrent principals once and exclude already transferred ancestors',()=>{
 const r=run(s([c('a',1,'2023-10-30','2024-10-30',500000),c('b',2,'2023-10-30','2024-10-30',400000),
  c('d',4,'2024-10-22','2025-10-22',1500000,{code:'Contrato 4 RC1,2'}),c('e',5,'2025-10-22','2026-10-22',2000000,{code:'Contrato 5 RC1,2,4',source_status:'Vigente'})]));
 assert.equal(r.continuity.length,2);assert.deepEqual(r.continuity[0].parentIds,['a','b']);assert.equal(r.continuity[0].previousPrincipal,900000);
 assert.deepEqual(r.continuity[1].parentIds,['d']);assert.equal(balance(r,'2026-01').amount,2000000);assert.equal(sum(r,'investor_contribution'),0);
});

check('Explicit parent accepts independently recorded new contribution without duplicating transferred capital',()=>{
 const source=s([c('a',1,'2025-01-01','2026-07-01',1000),c('b',2,'2026-07-01','2027-07-01',1300,{parent_id:'a',registered_contribution:300,source_status:'Vigente'})]);
 const r=run(source);assert.equal(sum(r,'investor_contribution'),300);assert.equal(balance(r,'2026-08').amount,1300);
 assert.equal(r.continuity[0].basis,'REGISTERED_PARENT');assert.equal(r.continuity[0].unattributedCapitalChange,0);
});

check('Future balances apply scheduled returns and remain labelled projections',()=>{
 const source=s([c('a',1,'2026-10-01','2027-01-01',1000,{source_status:'Vigente',registered_contribution:1000})]);source.as_of='2026-10-15';
 const r=run(source,'2026-10');assert.equal(balance(r,'2026-11').amount,1000);assert.equal(balance(r,'2027-01').amount,0);
 assert.equal(balance(r,'2026-11').status,'SCHEDULED');assert.equal(balance(r,'2026-11','investor_yield_pending').amount,0);
 assert.equal(sum(r,'investor_yield_paid'),0);assert.equal(sum(r,'investor_capital_return'),0);assert.equal(sum(r,'investor_yield_generated'),0);
 assert.equal(run(source,'2028-01').balances.find(x=>x.kind==='investor_capital_balance').amount,0);
});

check('Projection includes future obligations before the selected reporting year',()=>{
 const source=s([c('a',1,'2026-10-01','2027-01-01',1000,{source_status:'Vigente'})]);source.as_of='2026-10-15';
 source.obligations=[{id:'partial',contract_id:'a',period_start:'2026-10-01',period_end:'2026-11-01',due_on:'2026-11-01',concept:'capital',amount:400,paid:0}];
 const r=run(source,'2027-01');assert.equal(balance(r,'2027-01').amount,0);assert.equal(sum(r,'investor_capital_scheduled'),600);
});

check('An imported expansion with known current capital remains projectable through its future maturity',()=>{
 const source=s([c('a',1,'2025-02-07','2026-02-07',500000,{source_status:'Ampliado'}),c('b',2,'2026-02-07','2027-02-07',650000,{source_status:'Ampliado'})]);
 const r=run(source,'2027-01');assert.equal(balance(r,'2027-01').amount,650000);assert.equal(balance(r,'2027-02').amount,0);
 assert.equal(balance(r,'2027-02').status,'SCHEDULED');assert.equal(sum(r,'investor_capital_return'),0);
 assert.equal(run(source,'2028-01').balances.find(x=>x.kind==='investor_capital_balance').amount,0);
});

check('Past due unpaid principal is not silently settled in a future year',()=>{
 const source=s([c('a',1,'2026-01-01','2026-09-01',1000,{source_status:'Vigente'})]);
 const r=run(source,'2027-01');assert.equal(balance(r,'2027-01').amount,1000);assert.equal(sum(r,'investor_capital_return'),0);
 assert(r.unassigned.some(e=>e.kind==='investor_capital_scheduled'&&e.amount===1000));
});

check('Completed original withdrawal affects observed stock without inventing a payment date',()=>{
 const r=run(s([c('a',1,'2025-01-01','2026-01-01',1000,{source_status:'Terminado',registered_withdrawal:1000})]));
 assert.equal(balance(r,'2026-11').amount,0);assert.equal(balance(r,'2026-02').amount,null);
 assert.equal(sum(r,'investor_capital_return'),0);assert.equal(r.unassigned.find(e=>e.kind==='investor_capital_return').amount,1000);
});

check('Unknown historical continuity remains partial rather than a second certain balance',()=>{
 const r=run(s([c('a',1,'2025-01-01','2026-01-01',1000)]));assert.equal(balance(r,'2026-11').amount,null);assert.equal(balance(r,'2026-11').known_amount,0);
 assert(r.issues.some(i=>i.code==='INVESTOR_CAPITAL_INPUT_MISSING'));
});

check('Every complete balance and contractual bridge reconciles in cents',()=>{
 const source=s([c('a',1,'2025-08-05','2026-02-05',305000),c('b',2,'2026-02-05','2026-08-05',270000,{registered_withdrawal:35000}),c('c',3,'2026-08-05','2027-02-05',391000,{registered_contribution:121000,source_status:'Vigente'})]);
 const r=run(source),byId=new Map(r.records.map(x=>[x.id,x]));
 for(const b of r.balances)assert.equal(Math.round(b.known_amount*100),b.sourceIds.reduce((n,id)=>n+Math.round(byId.get(id).amount*100),0));
 for(const b of r.records.filter(x=>x.kind==='investor_capital_bridge'&&x.openingPrincipal!==null))assert.equal(Math.round(b.closingPrincipal*100),Math.round((b.openingPrincipal+b.registeredContribution-b.registeredCapitalReturn+b.registeredCapitalAdjustment+b.contractualBalanceChange-b.projectedCapitalReturn)*100));
});

console.log(JSON.stringify({status:'PASS',checks:checks.length,financialWrites:0,sourceMutation:false}));
