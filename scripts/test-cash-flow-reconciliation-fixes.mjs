import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {deriveCashFlowLoans} from '../supabase/functions/reports-jc/cash-flow-loans.mjs';
import {projectCashFlowSnapshot} from '../supabase/functions/reports-jc/cash-flow.mjs';
const require=createRequire(import.meta.url),exporter=require('../app/cash-flow-export.js'),Zip=require('../app/vendor/jszip-3.10.1/jszip.min.js');
const months=year=>Array.from({length:12},(_,i)=>({key:`${year}-${String(i+1).padStart(2,'0')}`}));
const quota=(id,capital,extra={})=>Object.assign(Array(33).fill(''),{0:'2026-11-15',1:100,2:id,3:'CONTROL',6:'Caja de Ahorro',9:capital,20:'2026-11-01',25:0,27:0,28:100,29:100},extra);
const request=(id,capital,extra={})=>Object.assign(Array(25).fill(''),{0:id,1:'CONTROL',4:'Caja de Ahorro',7:capital,9:'2026-11-01',24:'Iniciado'},extra);
function snapshot(loans,requests=[],year=2026){return {version:'cash-flow-inputs-v1',modelVersion:'20261104-original-components-v1',from:year+'-01',consultedAt:'2026-11-13T17:15:15Z',source:{loans:[[],...loans],requests:[[],...requests]},sourceErrors:{},savings:{events:[],balances:months(year).map(m=>({month:m.key,amount:0,known_amount:0})),source_bases:{accounts:[],account_identities:[],account_balances:[],current_balances:[],balance_entries:[],history:[],transactions:[],historical_withdrawals:[],pending:[],scheduled:[],opening_account_balances:[],history_metadata:[]}},investors:{contracts:[],movements:[],obligations:[],reviews:[],balances:[]}};}
const derive=(loans,requests=[],year=2026)=>deriveCashFlowLoans({loans:[[],...loans],requests:[[],...requests],asOf:'2026-11-13',months:months(year)});
const entries=(r,metric)=>r.entries.filter(e=>e.metric===metric).map(e=>e.record);
const row=(r,id)=>r.rows.find(x=>x.id===id);

test('Fable 3073 / 3078: recover exactly 154675.30 from strict numeric text',()=>{
 const r=derive([quota('3073','36540'),quota('3078','118135.3')],[request('3073','36540'),request('3078','118135.3')]);
 assert.equal(entries(r,'placed').reduce((s,r)=>s+Math.round(r.amount*100),0),15467530);
 assert(r.loanContracts.every(c=>c.issues.includes('IMPORTE_NUMERICO_ORIGINAL_EN_TEXTO')));
 for(const bad of ['REVISAR','',null,'1e3','1,000','12 pesos','1.234',true,Infinity])assert.equal(entries(derive([quota('x',bad)],[request('x',bad)]),'placed')[0].amount,null);
});
test('Fable 289 / 389: original granted capital differs from requested H, without erasure',()=>{
 for(const [id,h,j,date] of [['289',1069.6,6000,'2025-04-01'],['389',6000,10000,'2025-05-01']]){
  const r=derive([quota(id,j,{0:date})],[request(id,h,{9:date})],2025);
  assert.equal(entries(r,'placed')[0].amount,j);assert.equal(entries(r,'placed').length,1);
  assert(r.loanContracts[0].issues.includes('CAPITAL_SOLICITADO_DIFIERE_OTORGADO_PV2'));
 }
});
test('Fable 2696 / 2697: conflicting duplicate remains traceable, no inferred renumbering',()=>{
 const r=derive([quota('2696',6000),quota('2697',10000)],[request('2696',6000,{9:'2026-09-23'}),request('2696',10000,{9:'2026-09-24'})]);
 assert.equal(r.loanContracts.length,2);assert.equal(entries(r,'count').length,1);
 assert(r.unassigned.some(r=>r.loanId==='2697'&&r.metric==='placed'&&r.amount===10000));
 assert.equal(r.loanContracts.find(r=>r.loanId==='2696').principal,null);
});
test('Fable 202 / 2981: missing or future request dates visible, no fictitious placement',()=>{
 const r=derive([quota('202',10000,{0:'2026-10-15'}),quota('2981',100000,{0:'2026-11-01'})],[request('202',10000,{9:''}),request('2981',100000,{9:'2029-10-29'})]);
 assert.equal(entries(r,'placed').length,0);assert.equal(entries(r,'recovered').length,2);
 assert.equal(r.issues.filter(i=>i.code==='LOAN_DATE_UNRESOLVED').length,2);
 assert(entries(r,'pending').some(e=>e.loanId==='2981'&&e.date==='2026-11-13'&&e.amount===null));
});
test('unknown AD cannot turn a total into a shrinking subtotal; original capital retained',()=>{
 const input=snapshot([quota('a',1000,{0:'2026-11-01',29:100}),quota('a',1000,{0:'2026-12-15',29:'REVISAR',28:''})],[request('a',1000)]),before=JSON.stringify(input),r=projectCashFlowSnapshot(input);
 assert.equal(row(r,'loan_pending').cells[10].amount,900);
 assert.equal(row(r,'loan_pending').cells[11].amount,null);assert.equal(row(r,'loan_pending').cells[11].knownAmount,null);
 assert.equal(row(r,'loan_pending_unresolved_original').cells[11].amount,1000);
 assert.equal(row(r,'loan_pending_determined').cells[10].amount,900);
 assert.equal(JSON.stringify(input),before);
});
test('all eight omitted programs included separately, without invented loan components',()=>{
 const programs=['Seguro Colectivo Suti','Vales y membresías','Descuentos SUTISSSTESON','Suti Tours','Suti Auto','Suti Terrenos','Suti Cirugías','Panel Solar'];
 const r=projectCashFlowSnapshot(snapshot(programs.map((p,i)=>quota('other'+i,1000,{6:p,0:'2026-07-15',1:100+i}))));
 for(const p of programs){const rows=r.rows.filter(r=>r.group===p);assert.equal(rows.length,2);assert(!rows.some(r=>r.id.endsWith('_principal')));}
 assert.equal(row(r,'cash_in').cells[6].knownAmount,828);
 assert.equal(r.sourceBases.tables[0].rows.length,8);
});
test('all original B survives every month in 2025–2028, including past loans and cutoff',()=>{
 for(let year=2025;year<=2028;year++){
  const qs=months(year).flatMap((m,i)=>['Caja de Ahorro','Sutiexpress','Caja Chica','Adelantos de Nómina','Seguro Colectivo Suti'].map((f,j)=>quota('id'+j,1000,{0:m.key+'-13',1:(i+1)*100+j/100,6:f})));
  const r=projectCashFlowSnapshot(snapshot(qs,[],year));
  for(let i=0;i<12;i++){
   const key=months(year)[i].key,scheduled=key>'2026-11',records=r.records.filter(x=>/^pv2:\d+$/.test(x.id)&&x.date.startsWith(key));
   assert.equal(records.length,5);assert.equal(records.reduce((s,x)=>s+Math.round(x.amount*100),0),5*(i+1)*10000+10);
   assert(records.every(x=>x.status===(scheduled?'SCHEDULED':'RECORDED')));
  }
 }
});
test('Excel uses exact same monthly cells; source dates typed, IDs preserved as text',async()=>{
 const input=snapshot([quota('0003073','36540')],[request('0003073','36540')]),r=projectCashFlowSnapshot(input),file=await exporter.build(r),zip=await Zip.loadAsync(file.bytes);
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 // Read every row by its unique concept label in the rendered monthly sheet.
 let checked=0;
 for(const group of [...new Set(r.rows.map(x=>x.group))])for(const rr of r.rows.filter(x=>x.group===group)){
  // Sequential report rows occur in export order; financial values remain data, never formulas.
  assert(rr.cells.every(c=>c.amount===null||typeof c.amount==='number'));checked+=rr.cells.length;
 }
 const numericCells=[...xml.matchAll(/<c r="([B-M])(\d+)"[^>]*><v>([^<]+)<\/v><\/c>/g)].map(m=>Number(m[3]));
 const expected=r.rows.flatMap(rr=>rr.cells.flatMap(c=>{const v=c.status==='PARTIAL'?c.knownAmount:c.amount;return !['UNAVAILABLE','NOT_APPLICABLE'].includes(c.status)&&Number.isFinite(v)?[rr.unit==='percent'?v/100:v]:[];}));
 assert.deepEqual(numericCells,expected);assert(!xml.includes('<f>'));assert.equal(checked,r.rows.length*12);
 const base=await zip.file('xl/worksheets/sheet2.xml').async('string');
 assert(base.includes('s="18"><v>'));assert(base.includes('0003073'));
 const calc=await zip.file('xl/worksheets/sheet7.xml').async('string');assert(calc.includes('Caja de Ahorro · Capital colocado'));
});


test('other program detail retains original registered quota amount',()=>{
 const r=projectCashFlowSnapshot(snapshot([quota('OTHER',1000,{6:'Seguro Colectivo Suti',1:'125.50'})]));
 const record=r.records.find(r=>r.id==='pv2:2');assert.equal(record.amount,125.50);assert.equal(record.registeredAmount,125.50);
});
