import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCashFlow,loadCashFlow} from '../supabase/functions/reports-jc/cash-flow.mjs';
import {consolidateCashFlow} from '../supabase/functions/reports-jc/cash-flow-consolidated.mjs';
const NOW='2026-10-30T15:00:00.000Z',FROM='2026-10';
const headers=Array(33).fill('');Object.assign(headers,{0:'Fecha',1:'Cuotas',2:'ID',3:'Folio',6:'Fondo',8:'Plazo',9:'Cantidad Prestamo',10:'Total a pagar',18:'X',30:'Fecha Transferencia'});
const months=Array.from({length:12},(_,i)=>new Date(Date.UTC(2026,9+i,1)).toISOString().slice(0,7));
const savings=(events=[])=>({events,balances:months.map(month=>({month,amount:0,known_amount:0}))});
function investors(extra={}){return {as_of:'2026-10-30',contracts:[],movements:[],obligations:[],reviews:[],balances:months.map(month=>({month,amount:month==='2026-10'?0:null,known_amount:month==='2026-10'?0:null,unknown_count:0})),...extra};}
function fixture({C='1',D='100',fund='Caja de Ahorro',n=2,tariff=1500,adminUnits=1,principal=200000,interest=40000,dates=['2026-10-15','2026-11-15'],B=null}={}){
 const administration=n*tariff*adminUnits,total=principal+interest+administration,amount=total/n;
 const contract={C,D,principal,interest,administration,total,tariff,schedule:Array.from({length:n},(_,i)=>({S:i+1,amount,adminUnits})),sourceVerified:true,evidence:{kind:'explicit_approved_snapshot',reference:'TEST:'+C}};
 const rows=dates.slice(0,n).map((date,i)=>{const r=Array(33).fill('');Object.assign(r,{0:date,1:B?.[i]??amount/100,2:C,3:D,6:fund,8:n,9:principal/100,10:total/100,14:amount/100,18:i+1,30:'2026-10-01'});return r;});return {contract,rows};
}
function report(fixtures=[],options={}){const base=buildCashFlow({from:FROM,loans:[headers],savings:options.savings||savings(),consultedAt:NOW});return consolidateCashFlow({base,loans:[headers,...fixtures.flatMap(f=>f.rows)],contracts:fixtures.filter(f=>f.contract).map(f=>f.contract),investorsSource:options.investors||investors(),...options});}
const cell=(r,id,m=0)=>r.rows.find(row=>row.id===id)?.cells[m];
const originals=['contribution','contribution_mixed','withdrawal_partial','withdrawal_total','withdrawal_unspecified','yield_credited','adjustment','savings_balance','contribution_scheduled','withdrawal_pending','loan_placed','loan_recovered','loan_principal','loan_interest','loan_admin','loan_pending','loan_scheduled'];
test('17 existing concepts and savings authority are preserved; capital counted once per C/D',()=>{
 const f=fixture(),s=savings([{id:'a','kind':'contribution',date:'2026-10-15',amount:100,status:'RECORDED'}]),base=buildCashFlow({from:FROM,loans:[headers],savings:s,consultedAt:NOW}),r=report([f],{savings:s});
 for(const id of originals)assert(r.rows.some(row=>row.id===id),id);for(const row of base.rows.filter(row=>!row.id.startsWith('loan_')))assert.deepEqual(r.rows.find(x=>x.id===row.id).cells,row.cells);
 assert.equal(cell(r,'loan_placed').amount,2000);assert.equal(cell(r,'loan_count').amount,1);assert.equal(cell(r,'loan_recovered').amount,1215);
});

test('savings yield paid stays explicit and unknown without duplicating withdrawals',()=>{
 const r=report([fixture()],{savings:savings([{id:'w','kind':'withdrawal_partial',date:'2026-10-15',amount:100,status:'RECORDED'}])});
 assert.equal(cell(r,'savings_yield_paid').amount,null);assert.equal(cell(r,'savings_yield_paid').knownAmount,null);assert.equal(cell(r,'savings_yield_paid').status,'UNAVAILABLE');
 assert.equal(cell(r,'savings_yield_paid',1).status,'NOT_APPLICABLE');assert.equal(cell(r,'withdrawal_partial').amount,100);assert.equal(cell(r,'cash_out').amount,2100);
 assert.match(cell(r,'savings_yield_paid').notes[0],/no se suma nuevamente/);
});
test('loan components, percentages and pending conserve original totals without double counting',()=>{
 const r=report([fixture()]);assert.equal(cell(r,'loan_principal').amount,1000);assert.equal(cell(r,'loan_interest').amount,200);assert.equal(cell(r,'loan_admin').amount,15);assert.equal(cell(r,'loan_pending').amount,1000);
 assert.equal(cell(r,'loan_principal_scheduled',1).amount,1000);assert.equal(cell(r,'loan_pending',1).amount,0);assert.equal(cell(r,'loan_pending',1).status,'SCHEDULED');
 assert.equal(cell(r,'cash_in').amount,1215);assert.equal(cell(r,'cash_in_scheduled',1).amount,1215);assert.equal(cell(r,'loan_principal').percentage,82.3);
 assert.equal(r.coverage.financialWrites,0);assert.equal(r.coverage.amortizationEngineActive,false);
});
test('cash recovered and syndicate margins keep savings fund separate from investor pool',()=>{
 const r=report([fixture(),fixture({C:'2',fund:'Caja Chica',principal:100000,interest:20000})]);
 assert.equal(cell(r,'union_interest').amount,100);assert.equal(cell(r,'union_savings_interest').amount,200);assert.equal(cell(r,'union_admin').amount,15);assert.equal(cell(r,'union_savings_admin').amount,15);
 assert.equal(cell(r,'cash_in').amount,1830);assert.equal(cell(r,'loans_interest_total').amount,300);assert.equal(cell(r,'cash_out').amount,3000);
});
test('950 partial and correction use same source once, forecasts are derived and not cash',()=>{
 const f=fixture({B:[950,1215]}),before=JSON.stringify(f),r=report([f]);assert.equal(JSON.stringify(f),before);assert.equal(cell(r,'loan_recovered').amount,950);assert.equal(cell(r,'loan_scheduled',1).amount,1480);
 const future=r.records.find(x=>x.kind==='loan_scheduled');assert.equal(future.registeredAmount,1215);assert.equal(future.basis,'DERIVED_FORECAST');assert.equal(future.status,'SCHEDULED');
 f.rows[0][1]=1215;const corrected=report([f]);assert.equal(cell(corrected,'loan_recovered').amount,1215);assert.equal(corrected.records.filter(x=>x.kind==='loan_recovered').length,1);
});
test('full prepayment leaves future zero without reducing contractual fees or interest',()=>{
 const r=report([fixture({B:[2430,1215]})]);assert.equal(cell(r,'loan_recovered').amount,2430);assert.equal(cell(r,'loan_scheduled',1).amount,0);assert.equal(cell(r,'loan_admin').amount,30);assert.equal(cell(r,'loan_interest').amount,400);
});
test('future recorded zero stays zero and pending without date is preserved',()=>{
 const r=report([fixture({B:[1215,0]})]);assert.equal(cell(r,'loan_scheduled',1).amount,0);assert.equal(r.unassigned.find(x=>x.id.startsWith('unassigned:')).amount,1215);assert.equal(cell(r,'loan_pending',1).amount,1000);
});
test('single advance administrative periods are collected at final date, not artificial earlier income',()=>{
 const f=fixture({fund:'Adelanto de Nómina',n:1,principal:600000,interest:30000,adminUnits:3,dates:['2026-11-30']}),r=report([f]);
 assert.equal(cell(r,'fund_advance_admin').amount,0);assert.equal(cell(r,'fund_advance_admin_scheduled',1).amount,45);assert.equal(cell(r,'fund_advance_interest_scheduled',1).amount,300);assert.equal(cell(r,'fund_advance_principal_scheduled',1).amount,6000);
});
test('unknown contract keeps gross cash but never invents composition or percentages',()=>{
 const f=fixture();delete f.contract;const r=report([f]);assert.equal(cell(r,'loan_recovered').amount,1215);assert.equal(cell(r,'loan_principal').amount,null);assert.equal(cell(r,'loan_principal').percentage,null);assert.equal(cell(r,'loan_principal_scheduled',1).amount,null);assert.equal(cell(r,'loan_pending').amount,null);
});

test('undated installments protect recorded and scheduled components; compact parents remain complete',()=>{
 const f=fixture();f.rows[0][0]='';const r=report([f]);
 for(const suffix of ['recovered','scheduled','principal','interest','admin','principal_scheduled','interest_scheduled','admin_scheduled'])assert.equal(cell(r,'loan_'+suffix).amount,null,suffix);
 const full=report([fixture()]),map=new Map(full.records.map(r=>[r.id,r]));let compact=0;
 for(const record of full.records)if(record.parentRecordId){compact++;const parent=map.get(record.parentRecordId);assert(parent&&!parent.parentRecordId);assert(parent.loanId&&parent.folio&&parent.date);}
 assert(compact>0);
});
test('duplicate installments protect only their loan and membership is excluded',()=>{
 const f=fixture();f.rows[1][18]=1;const other=fixture({C:'2',fund:'Caja Chica'}),member=fixture({C:'3',fund:'Membresías'});delete member.contract;
 const r=report([f,other,member]);assert.equal(cell(r,'loan_recovered').amount,null);assert.equal(cell(r,'fund_pettyCash_recovered').amount,1215);assert.equal(r.coverage.loanCount,2);
});
test('investor yields use contractual snapshots, never 2.5% of recovered cuotas; signed details reconcile',()=>{
 const source=investors({contracts:[{id:'i',code:'INV-1',starts_on:'2026-10-01',ends_on:'2026-12-01',history_complete:true,status:'active',balance_on:'2026-10-01',balance:1000,payment_mode:'Manual'}],movements:[{id:'p',contract_id:'i',concept:'yield',direction:'out',effective_on:'2026-10-20',amount:20,obligation_id:'o'}],obligations:[{id:'o',contract_id:'i',concept:'yield',period_start:'2026-09-19',period_end:'2026-10-19',due_on:'2026-10-20',amount:50,paid:20,rate_snapshot:5,principal_basis:1000}]}),r=report([fixture({fund:'Caja Chica',principal:100000,interest:20000})],{investors:source});
 assert.equal(cell(r,'investor_yield_paid').amount,20);assert.equal(cell(r,'investor_yield_generated').amount,50);assert.equal(cell(r,'union_margin_cash').amount,80);assert.equal(cell(r,'union_margin_accrual').amount,50);
 const c=cell(r,'union_margin_cash'),map=new Map(r.records.map(x=>[x.id,x]));assert.equal(c.sourceIds.reduce((s,id)=>s+map.get(id).amount*(c.sourceSigns?.[id]??1),0),c.amount);
 assert(r.unassigned.some(x=>x.status==='PENDING'&&x.amount===30));
});
test('unknown investor source does not block savings or loans and never becomes zero',()=>{
 const r=report([fixture()],{investorsSource:null});assert.equal(cell(r,'loan_recovered').amount,1215);assert.equal(cell(r,'investor_contribution').amount,null);assert.equal(cell(r,'cash_in').amount,null);
});
test('net cash is not recorded in future months and unavailable stock has no invented known zero',()=>{
 const r=report([fixture()]);assert.equal(cell(r,'investor_net',1).status,'NOT_APPLICABLE');assert.equal(cell(r,'investor_net',1).amount,null);assert.equal(cell(r,'investor_capital_balance',1).knownAmount,null);assert.equal(cell(r,'portfolio_pending',1).status,'SCHEDULED');assert.equal(cell(r,'cash_available').amount,null);
});
test('summary signed details match known sums instead of adding positive exits to net flow',()=>{
 const r=report([fixture()]),map=new Map(r.records.map(x=>[x.id,x]));for(const id of ['cash_in','cash_out','cash_net','portfolio_pending'])for(const c of r.rows.find(x=>x.id===id).cells){if(c.status==='NOT_APPLICABLE')continue;const sum=c.sourceIds.reduce((s,id)=>s+(map.get(id)?.amount||0)*(c.sourceSigns?.[id]??1),0);assert(Math.abs(sum-(c.knownAmount||0))<.00001,id);}
});
test('new endpoint retains authorization and context checks around all source reads',async()=>{
 let contextCalls=0,reads=0;const source={loans:[headers],requests:[[]],requestNotes:{}};
 const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async(name)=>{if(name==='get_admin_reports_jc_context'){contextCalls++;return {data:{actor:'admin',session:null}};}return {data:name.endsWith('_investors')?investors():name.endsWith('_contracts')?{snapshots:[]}:savings()};}};
 const r=await loadCashFlow({action:'CASH_FLOW',from:FROM},client,async()=>{reads++;return source;},()=>NOW);assert.equal(r.data.months.length,12);assert.equal(contextCalls,2);assert.equal(reads,1);
 client.auth.getUser=async()=>({error:true});await assert.rejects(()=>loadCashFlow({action:'CASH_FLOW',from:FROM},client,async()=>{reads++;return source;}),/AUTH_REQUIRED/);assert.equal(reads,1);
});
