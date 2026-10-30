import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildInvestorCashFlow} from '../supabase/functions/reports-jc/cash-flow-investors.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),checks=[],asOf='2026-10-30';
const contract=(extra={})=>({id:'c',code:'Synthetic',starts_on:'2026-08-01',ends_on:'2027-01-01',principal:1000,monthly_rate:.025,payment_mode:'Mensual',status:'review',history_complete:false,terms:[],...extra});
const movement=(id,extra={})=>({id,contract_id:'c',effective_on:'2026-10-15',concept:'yield',direction:'out',amount:10,period_start:'2026-09-01',period_end:'2026-10-01',...extra});
const obligation=(extra={})=>({id:'o',contract_id:'c',period_start:'2026-09-01',period_end:'2026-10-01',due_on:'2026-10-01',concept:'yield',amount:40,paid:0,principal_basis:1000,rate_snapshot:.04,origin:'manual',...extra});
const source=(extra={})=>({as_of:asOf,contracts:[contract()],movements:[],obligations:[],balances:[],reviews:[],...extra});
const run=(s,from='2026-08')=>buildInvestorCashFlow({from,source:s,asOf}),total=(r,k)=>r.events.filter(e=>e.kind===k).reduce((sum,e)=>sum+e.amount,0),balance=(r,k,m='2026-10')=>r.balances.find(b=>b.kind===k&&b.month===m);
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};
check('Official historical and review contracts calculate without history certification',()=>{
 for(const status of ['review','historical']){const s=source({contracts:[contract({status})],reviews:[{id:'r',kind:'contract_conflict'}]}),before=JSON.stringify(s),r=run(s);assert.equal(JSON.stringify(s),before);assert.equal(total(r,'investor_yield_generated'),50);assert.equal(total(r,'investor_yield_scheduled'),125);assert.equal(balance(r,'investor_capital_balance').amount,1000);assert.equal(balance(r,'investor_yield_pending').amount,50);assert(!r.issues.some(i=>i.affectedKinds.length));assert(r.events.filter(e=>e.kind==='investor_yield_generated').every(e=>e.calculationStatus==='CALCULATED'&&e.basis==='CONTRACT_YIELD_CALCULATION'));assert.equal(total(r,'investor_yield_paid'),0);}
});
check('Explicit original contribution is counted once; observations and renewals never create cash',()=>{
 const c=contract({registered_contribution:1200,registered_current_capital:1000,registered_balance_on:'2026-10-29'}),r=run(source({contracts:[c]}));assert.equal(total(r,'investor_contribution'),1200);assert.equal(total(r,'investor_net'),1200);assert.equal(balance(r,'investor_capital_balance').amount,1000);
 const initial=movement('initial',{effective_on:c.starts_on,concept:'contribution',direction:'in',amount:1200,period_start:null,period_end:null});assert.equal(total(run(source({contracts:[c],movements:[initial,initial]})),'investor_contribution'),1200);
 assert.equal(total(run(source({contracts:[contract({opening_balance:1000,balance_on:'2026-10-29'})]})),'investor_contribution'),0);
 assert.equal(total(run(source({contracts:[contract({parent_id:'old',registered_contribution:1200})]})),'investor_contribution'),0);
});
check('Stored obligations remain frozen and calculated periods use dated contractual rates',()=>{
 const s=source({contracts:[contract({terms:[{effective_on:'2026-09-01',monthly_rate:.03},{effective_on:'2026-11-01',monthly_rate:.04}]})],obligations:[obligation({rate_snapshot:.04})]}),r=run(s);
 assert.equal(total(r,'investor_yield_generated'),65);const generated=r.events.filter(e=>e.kind==='investor_yield_generated');assert.equal(generated.find(e=>e.sourceId==='o').amount,40);assert.equal(generated.filter(e=>e.periodStart==='2026-09-01').length,1);
 assert.deepEqual(r.events.filter(e=>e.kind==='investor_yield_scheduled'&&e.date>asOf).map(e=>[e.date,e.amount]),[['2026-11-01',30],['2026-12-01',40],['2027-01-01',40]]);
});
check('Registered payments reduce pending once; corrections and voids cannot duplicate cash',()=>{
 const actual=movement('paid'),s=source({movements:[actual,actual,movement('old',{superseded:true,amount:99}),movement('void',{voided:true,amount:99})]}),r=run(s);assert.equal(total(r,'investor_yield_paid'),10);assert.equal(balance(r,'investor_yield_pending').amount,40);assert.equal(total(r,'investor_net'),-10);
 const frozen=run(source({obligations:[obligation()],movements:[actual]}));assert.equal(balance(frozen,'investor_yield_pending').amount,55);assert(!frozen.issues.some(i=>i.code==='INVESTOR_OBLIGATION_PAYMENT_CONFLICT'));
 const linked=run(source({obligations:[obligation({paid:10})],movements:[movement('linked',{obligation_id:'o'})]}));assert.equal(balance(linked,'investor_yield_pending').amount,55);
});
check('Observed balance and original contractual capital use their own dates',()=>{
 const r=run(source({contracts:[contract({registered_current_capital:700,registered_balance_on:'2026-10-29'})]}));assert.equal(balance(r,'investor_capital_balance','2026-09').amount,1000);assert.equal(balance(r,'investor_capital_balance').amount,700);assert.equal(r.records.find(e=>e.kind==='investor_capital_balance'&&e.period==='2026-10').basis,'REGISTERED_BALANCE');
 assert.equal(balance(run(source({contracts:[contract({status:'historical'})]})),'investor_capital_balance').amount,1000);
 const closed=run(source({contracts:[contract({closed_on:'2026-10-01'})]}));assert.equal(balance(closed,'investor_capital_balance').amount,0);assert.equal(total(closed,'investor_yield_generated'),50);
});
check('Missing partial-period convention and missing inputs remain explicit',()=>{
 const r=run(source({contracts:[contract({ends_on:'2026-10-15'})]}));assert.equal(total(r,'investor_yield_generated'),50);assert.equal(balance(r,'investor_yield_pending').amount,null);assert(r.issues.some(i=>i.code==='INVESTOR_PARTIAL_PERIOD_UNSPECIFIED'));
 const explicit=run(source({contracts:[contract({ends_on:'2026-10-15'})],obligations:[obligation({period_start:'2026-10-01',period_end:'2026-10-15',due_on:'2026-10-15',amount:12})]}));assert.equal(total(explicit,'investor_yield_generated'),62);assert.equal(balance(explicit,'investor_yield_pending').amount,62);
 const missing=run(source({contracts:[contract({principal:null})]}));assert.equal(balance(missing,'investor_capital_balance').amount,null);assert.equal(balance(missing,'investor_yield_pending').amount,null);
});
check('Manual payment mode calculates accrual without inventing payment dates',()=>{
 const r=run(source({contracts:[contract({payment_mode:'Manual'})]}));assert.equal(total(r,'investor_yield_generated'),50);assert.equal(total(r,'investor_yield_paid'),0);assert.equal(balance(r,'investor_yield_pending').amount,50);assert(r.unassigned.filter(e=>e.kind==='investor_yield_scheduled').every(e=>e.date===null&&e.status==='PENDING'));assert.equal(r.unassigned.filter(e=>e.kind==='investor_yield_scheduled').length,5);
});
check('Balance details reconcile every known cut, future stock stays inapplicable',()=>{
 const r=run(source({movements:[movement('paid')]})),byId=new Map(r.records.map(e=>[e.id,e]));for(const b of r.balances.filter(b=>b.known_amount!==null))assert.equal(b.sourceIds.reduce((sum,id)=>sum+byId.get(id).amount,0),b.known_amount);assert(r.balances.filter(b=>b.month>'2026-10').every(b=>b.amount===null&&b.known_amount===null&&b.status==='NOT_APPLICABLE'));assert(r.records.every(x=>!r.events.some(e=>e.id===x.id)));
});
const out=path.join(root,'docs/qa/evidence/cash-flow-criteria');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'investors-reader.json'),JSON.stringify({status:'PASS',checks,financialWrites:0,sourceMutation:false},null,2)+'\n');
