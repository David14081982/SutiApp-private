import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveCashFlowLoans} from '../supabase/functions/reports-jc/cash-flow-loans.mjs';
import {consolidateCashFlow} from '../supabase/functions/reports-jc/cash-flow-consolidated.mjs';
import {CASH_FLOW_RANGES,CONSOLIDATED_CASH_FLOW_RANGES} from '../supabase/functions/reports-jc/cash-flow-google.mjs';
const months=year=>Array.from({length:12},(_,i)=>({key:year+'-'+String(i+1).padStart(2,'0')}));
function quota({C='L1',D='001',date='2026-10-15',B=120,J=100,K=120,AD=100,AB=10,Z=10,AC=110,U='2026-09-01',AG='',fund='Caja Chica',S=1}={}){
 const v=Array(33).fill('');Object.assign(v,{0:date,1:B,2:C,3:D,4:'Persona prueba',6:fund,8:1,9:J,10:K,18:S,20:U,25:Z,27:AB,28:AC,29:AD,32:AG});return v;
}
function request({C='L1',D='001',date='2026-09-01',principal=100,total=120,status='Iniciado',fund='Caja Chica'}={}){
 const v=Array(25).fill('');Object.assign(v,{0:C,1:D,2:'Persona prueba',4:fund,7:principal,8:total,9:date,24:status});return v;
}
const run=(qs,rs=[request()],extra={})=>deriveCashFlowLoans({loans:[[],...qs],requests:[[],...rs],asOf:'2026-11-04',months:months(2026),...extra});
const entries=(r,metric,month)=>r.entries.filter(e=>e.metric===metric&&(!month||e.record.date?.startsWith(month))).map(e=>e.record);
test('source Z AB AD are used without rate, original schedule or numbering',()=>{
 const r=run([quota({AD:80,AB:25,Z:15,AC:105,S:''})]);
 assert.equal(entries(r,'principal')[0].amount,80);assert.equal(entries(r,'interest')[0].amount,25);assert.equal(entries(r,'admin')[0].amount,15);assert.equal(entries(r,'recovered')[0].amount,120);
});
test('today is paid and tomorrow scheduled in the same month',()=>{
 const r=run([quota({date:'2026-11-04',AD:50,B:60,AB:5,Z:5,AC:55}),quota({date:'2026-11-05',AD:50,B:60,AB:5,Z:5,AC:55})]);
 assert.equal(entries(r,'recovered')[0].amount,60);assert.equal(entries(r,'scheduled')[0].amount,60);
});
test('capital counted once for repeated quotas and request date wins over U',()=>{
 const r=run([quota({date:'2026-10-15',U:'2026-10-01'}),quota({date:'2027-01-15',U:'2026-10-01',AD:0,AB:0,Z:0,AC:0,B:0})]);
 assert.equal(entries(r,'placed').length,1);assert.equal(entries(r,'placed')[0].date,'2026-09-01');assert.equal(entries(r,'count')[0].amount,1);
});
test('same C with two folios cannot duplicate capital or count',()=>{
 const r=run([quota(),quota({D:'002'})]);assert.equal(entries(r,'count').length,1);assert.equal(entries(r,'placed').length,1);assert(r.loanContracts[0].issues.includes('FOLIO_AMBIGUO'));
});
test('approved loan without calendar still places original principal and counts once',()=>{
 const r=run([]);assert.equal(entries(r,'placed')[0].amount,100);assert.equal(entries(r,'count')[0].amount,1);assert.equal(entries(r,'pending','2026-10')[0].amount,null);assert(r.loanContracts[0].issues.includes('CALENDARIO_AUN_NO_REGISTRADO'));
});
test('cancelled or rejected request does not place capital, B remains operational',()=>{
 for(const status of ['Cancelado','Rechazado']){const r=run([quota()],[request({status})]);assert.equal(entries(r,'placed').length,0);assert.equal(entries(r,'count').length,0);assert.equal(entries(r,'recovered')[0].amount,120);}
});
test('duplicate authorized C with conflicting amounts counts once and never chooses amount',()=>{
 const r=run([quota({J:6000,K:7000})],[request({C:'L1',principal:6000}),request({C:'L1',principal:10000})]);
 assert.equal(entries(r,'count').length,1);assert.equal(entries(r,'placed')[0].amount,null);assert.equal(r.loanContracts[0].principal,null);assert.deepEqual(r.loanContracts[0].requestRows,[2,3]);
});
test('ambiguous request dates in same month keep count but not exact placement',()=>{
 const r=run([quota()],[request({date:'2026-09-01'}),request({date:'2026-09-02'})]);
 assert.equal(entries(r,'count').length,1);assert.equal(entries(r,'placed').length,0);assert(r.unassigned.some(r=>r.metric==='placed'));
});
test('no transfer column is requested or used',()=>{
 assert(CASH_FLOW_RANGES.every(r=>!r.includes('AE')));assert(CONSOLIDATED_CASH_FLOW_RANGES.every(r=>!r.includes('AE')));
 const a=quota(),b=quota();a[30]='2020-01-01';b[30]='2099-12-31';assert.deepEqual(run([a]),run([b]));
 assert(CONSOLIDATED_CASH_FLOW_RANGES.includes("'Historial de solicitudes'!Y:Y"));
});
test('future projections survive placement year and span 2027 and 2028',()=>{
 const qs=[quota({date:'2027-12-30',B:60,AD:50,AB:5,Z:5,AC:55}),quota({date:'2028-01-15',B:60,AD:50,AB:5,Z:5,AC:55})];
 const a=run(qs,undefined,{months:months(2027)}),b=run(qs,undefined,{months:months(2028)});
 assert.equal(entries(a,'scheduled','2027-12')[0].amount,60);assert.equal(entries(b,'scheduled','2028-01')[0].amount,60);assert.equal(entries(a,'pending','2027-12')[0].amount,50);assert.equal(entries(b,'pending','2028-01')[0].amount,0);
});
test('unknown components preserve B and disclose residual without inventing zeros',()=>{
 const r=run([quota({AD:'REVISAR',AB:10,Z:5,AC:'REVISAR'})]);
 assert.equal(entries(r,'recovered')[0].amount,120);assert.equal(entries(r,'principal')[0].amount,null);assert.equal(entries(r,'unallocated')[0].amount,105);assert.equal(entries(r,'interest')[0].amount,10);
 assert.equal(entries(r,'pending','2026-10')[0].amount,null);
});
test('positive and negative rounding differences remain explicit and signed',()=>{
 for(const delta of [.04,-.04]){const r=run([quota({B:120+delta})]);assert.equal(entries(r,'rounding')[0].amount,delta);assert.equal(entries(r,'unallocated')[0].amount,0);assert.equal(entries(r,'principal')[0].amount,100);}
});
test('material over-allocation protects breakdown but not gross B',()=>{
 const r=run([quota({B:100})]);assert.equal(entries(r,'recovered')[0].amount,100);assert.equal(entries(r,'unallocated')[0].amount,100);assert.equal(entries(r,'principal')[0].amount,null);
});
test('AC must reconcile AB plus AD; administration stays independently identified',()=>{
 const r=run([quota({AC:90})]);assert.equal(entries(r,'principal')[0].amount,null);assert.equal(entries(r,'interest')[0].amount,null);assert.equal(entries(r,'admin')[0].amount,10);assert.equal(entries(r,'unallocated')[0].amount,110);
});
test('cash equals identified components plus residual and rounding for every quota',()=>{
 const r=run([quota(),quota({C:'L2',AD:'REVISAR',Z:10,AB:5,AC:''}),quota({C:'L3',B:120.08})]);
 for(const p of r.entries.filter(e=>['recovered','scheduled'].includes(e.metric))){const id=p.record.id,children=r.entries.filter(e=>e.record.parentRecordId===id);const sum=children.reduce((s,e)=>s+Math.round((e.record.amount??0)*100),0);assert.equal(sum,Math.round(p.record.amount*100));}
});
test('original principal minus actual AD never subtracts gross B',()=>{
 const r=run([quota({B:60,AD:50,AB:5,Z:5,AC:55}),quota({date:'2027-01-15',B:60,AD:50,AB:5,Z:5,AC:55})]);assert.equal(entries(r,'pending','2026-10')[0].amount,50);
 assert.equal(entries(r,'interest_pending','2026-10')[0].amount,5);
});
test('negative principal balance is unavailable, never a negative credit',()=>{
 const r=run([quota({B:130,J:100,K:130,AD:110,AB:10,Z:10,AC:120})],[request({principal:100,total:130})]);
 assert.equal(entries(r,'pending','2026-10')[0].amount,null);
 assert.equal(entries(r,'principal')[0].amount,null);assert.equal(entries(r,'unallocated')[0].amount,110);assert.equal(entries(r,'interest')[0].amount,10);assert.equal(entries(r,'admin')[0].amount,10);assert.equal(entries(r,'recovered')[0].amount,130);
});
test('source inputs are immutable and authorization does not invent request date',()=>{
 const qs=[quota({U:'2026-09-03'})],before=JSON.stringify(qs),r=run(qs,[]);assert.equal(JSON.stringify(qs),before);assert.equal(entries(r,'placed').length,0);assert(r.unassigned.some(r=>r.metric==='placed'&&r.amount===100));assert.equal(r.loanContracts[0].placementDate,null);
});
test('empty original U is not a date and does not invent placement',()=>{
 const r=run([quota({U:0})],[]);assert.equal(entries(r,'placed').length,0);assert.equal(entries(r,'recovered')[0].amount,120);
});
test('consolidated result exposes original source, residuals and one contract per C',()=>{
 const qs=[quota({AD:'REVISAR',AB:10,Z:5,AC:''})],ms=months(2026),base={from:'2026-01',asOf:'2026-11-04',consultedAt:'2026-11-04T15:00:00Z',months:ms,rows:[],records:[],issues:[],unassigned:[],coverage:{}};
 const r=consolidateCashFlow({base,loans:[[],...qs],requests:[[],request()],investorsSource:null});
 const c=id=>r.rows.find(r=>r.id===id).cells[9];
 assert.equal(c('fund_pettyCash_recovered').amount,120);assert.equal(c('fund_pettyCash_unallocated').amount,105);assert.equal(c('fund_pettyCash_principal').knownAmount,null);assert.equal(r.loanContracts.length,1);
 assert.equal(c('loans_unallocated_total').amount,105);assert.equal(r.coverage.financialWrites,0);
});

test('unknown balance from one loan cannot erase or inflate another determined balance',()=>{
 const ms=months(2026),base={from:'2026-01',asOf:'2026-11-04',months:ms,rows:[],records:[],issues:[],unassigned:[],coverage:{}};
 const qs=[quota({C:'L1',AD:'REVISAR',AC:''}),quota({C:'L2',AD:40,AB:10,Z:10,AC:50,B:60})];
 const r=consolidateCashFlow({base,loans:[[],...qs],requests:[[],request(),request({C:'L2'})]});
 const c=r.rows.find(r=>r.id==='fund_pettyCash_pending').cells[9];
 assert.equal(c.amount,null);assert.equal(c.knownAmount,null);assert.equal(c.status,'UNAVAILABLE');assert.equal(r.rows.find(r=>r.id==='fund_pettyCash_pending_determined').cells[9].amount,60);assert.equal(r.rows.find(r=>r.id==='fund_pettyCash_pending_unresolved_original').cells[9].amount,100);
});

test('principal-cap conflict protects only that loan and never caps B',()=>{
 const r=run([quota({AD:110,AC:120,B:130}),quota({C:'L2',AD:50,AC:60,B:70})],[request(),request({C:'L2'})]);
 const p=entries(r,'recovered');assert.equal(p[0].amount,130);assert.equal(p[1].amount,70);
 assert.equal(entries(r,'principal')[0].amount,null);assert.equal(entries(r,'principal')[1].amount,50);
 assert.equal(entries(r,'unallocated')[0].amount,110);assert.equal(entries(r,'unallocated')[1].amount,0);
});

test('approved request without calendar cannot invent pending interest or administration',()=>{
 const r=run([]);assert.equal(entries(r,'interest_pending','2026-10')[0].amount,null);assert.equal(entries(r,'admin_pending','2026-10')[0].amount,null);
});

test('invalid source quota prevents a falsely complete balance',()=>{
 const r=run([quota({date:'invalid'}),quota({date:'2026-10-30',AD:0,AB:0,Z:0,AC:0,B:0})]);
 assert.equal(entries(r,'pending','2026-10')[0].amount,null);assert(r.issues.some(i=>i.code==='LOAN_QUOTA_INVALID'));
});

test('malformed row shapes and month grids fail with a controlled source error',()=>{
 for(const override of [{loans:[[],null]},{requests:[[],null]},{months:[{key:'2026-99'}]}])
  assert.throws(()=>deriveCashFlowLoans({loans:[[],quota()],requests:[[],request()],asOf:'2026-11-04',months:months(2026),...override}),/CASH_FLOW_SOURCE_INVALID/);
});

test('capital cap protection validates AC first and retains only independent valid components',()=>{
 const r=run([quota({B:130,AD:110,AB:10,Z:10,AC:99})],[request({principal:100,total:130})]);
 assert.equal(entries(r,'principal')[0].amount,null);assert.equal(entries(r,'interest')[0].amount,null);assert.equal(entries(r,'admin')[0].amount,10);
 assert.equal(entries(r,'unallocated')[0].amount,120);assert.equal(entries(r,'pending','2026-09')[0].amount,null);
});
test('only fully resolved zero balances group; each original loan remains traceable',()=>{
 const r=run([quota(),quota({C:'L2'})],[request(),request({C:'L2'})]);
 const pending=entries(r,'pending','2026-10');assert.equal(pending.length,1);assert.equal(pending[0].amount,0);assert.deepEqual(pending[0].loanIds,['L1','L2']);assert.equal(pending[0].countLoans,2);assert.equal(pending[0].loanId,undefined);
 assert.equal(r.loanContracts.length,2);assert(r.loanContracts.every(c=>c.pv2Rows.length===1));assert.equal(entries(r,'recovered').length,2);
});

test('zero interest groups independently without hiding nonzero or unknown principal',()=>{
 const r=run([quota({AD:40,AB:10,Z:10,AC:50,B:60}),quota({C:'L2',AD:'REVISAR',AB:10,Z:10,AC:''})],[request(),request({C:'L2'})]);
 const p=entries(r,'pending','2026-10');assert.equal(p.length,2);assert.equal(p[0].amount,60);assert.equal(p[1].amount,null);
 const interest=entries(r,'interest_pending','2026-10');assert.equal(interest.length,1);assert.equal(interest[0].amount,0);assert.deepEqual(interest[0].loanIds,['L1','L2']);
});
