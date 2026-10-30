import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {computeContractCashFlow,resolveCashFlowContracts,payrollAdministrativeDates,CONTRACT_ENGINE_SHA256} from '../supabase/functions/reports-jc/cash-flow-contracts.mjs';

const cases=[];
function test(name,fn){fn();cases.push({name,status:'PASS'});}
const clone=structuredClone;
function fixture({tariff=1500,n=10,amount=185000,interest=150000,C='7',D='0009',advance=false}={}){
 const principal=n*amount-interest-n*tariff,financial={amount:principal/100,interest:interest/100,administrativeFeeTotal:n*tariff/100,administrativeFeePerPayment:tariff/100,total:n*amount/100,paymentPerPeriod:amount/100,paymentCount:n,rate:2.5,fund:'Caja de Ahorro'};
 const snapshot={id:'00000000-0000-0000-0000-000000000001',reference:'SR-2026-000001',numeroControl:D,status:'approved',program:'prestamo',createdOn:'2026-01-01',approvedAt:'2026-01-01T12:00:00Z',category:'BASE',fingerprint:'a'.repeat(32),financial};
 const request=Array(27).fill('');Object.assign(request,{0:C,1:D,3:'1',4:financial.fund,5:.025,6:n,7:financial.amount,8:financial.total,9:'2026-01-01',24:'Iniciado'});
 const loans=[[],[]];
 for(let i=0;i<n;i++){const r=Array(33).fill(''),d=`2026-${String(i+1).padStart(2,'0')}-15`;Object.assign(r,{0:d,1:amount/100,2:C,3:D,5:'1',6:financial.fund,7:.025,8:n,9:financial.amount,10:financial.total,14:amount/100,15:d,18:i+1,30:'2026-01-01'});loans.push(r);}
 const input={loans,requests:[[],request],requestNotes:{2:'SUTI_LOAN_TRANSFER_V1:'+JSON.stringify({id:C,identity:snapshot.reference,sourceHash:'a'.repeat(64)})},snapshots:[snapshot]};
 function resolve(){return resolveCashFlowContracts(input);}
 function rows(){return loans.slice(2).map((r,i)=>({C,D,S:r[18],B:Math.round(r[1]*100),date:r[0],sourceRow:i+3}));}
 return {input,financial,snapshot,request,loans,resolve,rows};
}
function evaluate(f,asOf='2026-01-15'){const c=f.resolve();assert.equal(c.contracts.length,1,JSON.stringify(c));return computeContractCashFlow({contract:c.contracts[0],rows:f.rows(),asOf});}
function conservation(out,contract){
 assert.equal(out.status,'DETERMINED',out.reason);assert.equal(out.writeAllowed,false);
 for(const p of [...out.payments,...out.forecast]){assert.equal(p.B,p.Z+p.AB+p.AD);assert.equal(p.AC,p.AB+p.AD);}
 for(const [column,field] of [['B','total'],['Z','administration'],['AB','interest'],['AD','principal']])assert.equal(out.recovered[column]+out.forecast.reduce((a,p)=>a+p[column],0)+out.unassignedComponents[field],contract[field]);
}

test('deployment engine is byte-identical to certified immutable original',()=>{
 const b=readFileSync(new URL('../supabase/functions/reports-jc/cash-flow-pv2-engine.mjs',import.meta.url));
 assert.equal(CONTRACT_ENGINE_SHA256,'3854f1bc6bc988d979d5dfdd41c385009967cad0f5d3659d70d7e85d41783d33');
 assert.equal(createHash('sha256').update(b).digest('hex'),CONTRACT_ENGINE_SHA256);
});
test('approved snapshot, current receipt and original terms resolve exactly once',()=>{const f=fixture(),r=f.resolve();assert.equal(r.contracts.length,1);assert.equal(r.protectedLoans.length,0);assert.equal(r.contracts[0].D,'0009');});
test('PV2 has one header row: installment in source row two is preserved',()=>{const f=fixture();f.input.loans=[f.loans[0],...f.loans.slice(2)];assert.equal(f.resolve().contracts.length,1);assert.equal(f.resolve().protectedLoans.length,0);});
test('full cuota splits and preserves contractual cents with later projections separate',()=>{const f=fixture(),out=evaluate(f);conservation(out,f.resolve().contracts[0]);assert.equal(out.payments.length,1);assert.equal(out.recovered.B,185000);assert.equal(out.recovered.Z,1500);assert.equal(out.forecast.length,9);assert(out.forecast.every(p=>p.capture==='PROGRAMMED'&&p.basis==='DERIVED_FORECAST'));});
test('950 partial on 1850 cuota charges administration once and carries unpaid amount',()=>{const f=fixture();f.loans[2][1]=950;const out=evaluate(f);conservation(out,f.resolve().contracts[0]);assert.equal(out.payments[0].B,95000);assert.equal(out.payments[0].Z,1500);assert.equal(out.forecast[0].B,275000);assert.equal(out.forecast[0].registeredAmount,185000);});
test('manual B correction replaces value without movements or accumulated prior version',()=>{const f=fixture();f.loans[2][1]=950;const first=evaluate(f);f.loans[2][1]=1850;const second=evaluate(f);assert.equal(first.payments.length,1);assert.equal(second.payments.length,1);assert.equal(second.recovered.B,185000);assert.equal(second.recovered.Z,1500);});
test('second abono on next row completes same original period without charging it twice',()=>{const f=fixture();f.loans[2][1]=950;f.loans[3][1]=900;const out=evaluate(f,'2026-02-15');assert.equal(out.payments[0].Z,1500);assert.equal(out.payments[1].Z,0);assert.equal(out.recovered.B,185000);conservation(out,f.resolve().contracts[0]);});
test('extra payment covers seven and part of eighth, administration applied once each',()=>{const f=fixture();f.loans[2][1]=7*1850+950;const out=evaluate(f);assert.equal(out.recovered.Z,8*1500);assert.equal(out.forecast.slice(0,6).reduce((a,p)=>a+p.B,0),0);assert.equal(out.forecast[6].B,90000);conservation(out,f.resolve().contracts[0]);});
test('early settlement preserves full ten-period capital interest administration',()=>{const f=fixture();f.loans[2][1]=18500;const out=evaluate(f);assert.equal(out.pending.total,0);assert.equal(out.recovered.Z,15000);assert.equal(out.recovered.AB,150000);assert(out.forecast.every(p=>p.B===0));conservation(out,f.resolve().contracts[0]);});
for(const tariff of [0,1000,1500])test(`historical explicit ${tariff/100} tariff preserved without date override`,()=>{const f=fixture({tariff});f.snapshot.createdOn='2025-01-01';const out=evaluate(f);assert.equal(out.recovered.Z,tariff);conservation(out,f.resolve().contracts[0]);});
test('unknown tariff is protected, never blank equals zero',()=>{const f=fixture();delete f.financial.administrativeFeePerPayment;const out=f.resolve();assert.equal(out.contracts.length,0);assert.equal(out.protectedLoans[0].reason,'CONTRACT_FINANCIAL_FIELDS_MISSING');});
test('unsupported tariff cannot become general fifteen',()=>{const f=fixture();f.financial.administrativeFeePerPayment=20;assert.equal(f.resolve().protectedLoans[0].reason,'UNSUPPORTED_TARIFF');});
test('future B is not recovered even when all future values exceed remaining after extra',()=>{const f=fixture();f.loans[2][1]=5000;const out=evaluate(f);assert.equal(out.recovered.B,500000);assert(out.forecast.some(p=>p.adjusted));conservation(out,f.resolve().contracts[0]);});
test('future B zero is never revived: its projected remainder becomes unassigned',()=>{const f=fixture();f.loans[3][1]=0;const out=evaluate(f);assert(!out.forecast.some(p=>p.S===2));assert.equal(out.unassignedPending,185000);assert.equal(out.programmed.find(p=>p.S===2).B,0);conservation(out,f.resolve().contracts[0]);});
test('past B zero is confirmed zero, unpaid total survives in forecast',()=>{const f=fixture();f.loans[2][1]=0;const out=evaluate(f);assert.equal(out.recovered.B,0);assert.equal(out.forecast[0].B,370000);conservation(out,f.resolve().contracts[0]);});
test('no future rows leaves unpaid obligation unassigned, no fabricated due date',()=>{const f=fixture();f.loans[2][1]=0;const out=evaluate(f,'2026-12-31');assert.equal(out.forecast.length,0);assert.equal(out.unassignedPending,185000);conservation(out,f.resolve().contracts[0]);});
test('actual payments beyond contract protected rather than reduced or forgiven',()=>{const f=fixture();f.loans[2][1]=18500.01;const out=evaluate(f);assert.equal(out.status,'PROTECTED');assert.equal(out.reason,'PAYMENTS_EXCEED_CONTRACT');assert.equal(out.recovered,null);});
test('duplicate installment blocks only corresponding loan',()=>{const f=fixture();f.loans[3][18]=1;assert.equal(f.resolve().protectedLoans[0].reason,'DUPLICATE_OR_INVALID_CDS');});
test('identity order and invalid dates cannot imply cash receipt',()=>{const f=fixture(),c=f.resolve().contracts[0],r=f.rows();r[1].date='2025-01-01';assert.equal(computeContractCashFlow({contract:c,rows:r,asOf:'2026-01-15'}).reason,'IDENTITY_OR_DATE_ORDER');r[1].date='2026-02-30';assert.equal(computeContractCashFlow({contract:c,rows:r,asOf:'2026-01-15'}).reason,'IDENTITY_OR_DATE_ORDER');});
test('source terms mutation blocks formerly approved snapshot',()=>{const f=fixture();f.loans[2][9]+=1;assert.equal(f.resolve().protectedLoans[0].reason,'CONTRACT_TERMS_CHANGED');});
test('source rate change does not change historical rate retroactively',()=>{const f=fixture();f.loans[2][7]=.03;assert.equal(f.resolve().protectedLoans[0].reason,'CONTRACT_RATE_CHANGED');});
test('missing original O cannot be reconstructed from mutable B',()=>{const f=fixture();f.loans[2][14]='';assert.equal(f.resolve().protectedLoans[0].reason,'ORIGINAL_INSTALLMENT_MISMATCH');});
test('receipt owner mismatch cannot attach a contract by matching monetary values',()=>{const f=fixture();f.snapshot.numeroControl='9';assert.equal(f.resolve().protectedLoans[0].reason,'CONTRACT_IDENTITY_MISMATCH');});
test('missing or forged receipt protects numeric historical ID',()=>{const f=fixture();f.input.requestNotes={};assert.equal(f.resolve().protectedLoans[0].reason,'ORIGINAL_CONTRACT_NOT_VERIFIED');f.input.requestNotes={2:'SUTI_LOAN_TRANSFER_V1:'+JSON.stringify({id:'99',identity:f.snapshot.reference,sourceHash:'a'.repeat(64)})};assert.equal(f.resolve().protectedLoans[0].reason,'TRANSFER_IDENTITY_INVALID');});
test('snapshot duplication is an ambiguity, not two loans',()=>{const f=fixture();f.input.snapshots.push(clone(f.snapshot));assert.equal(f.resolve().protectedLoans[0].reason,'APPROVAL_IDENTITY_AMBIGUOUS');});
test('other obligations and membership never receive loan allocation',()=>{const f=fixture();for(const r of f.loans.slice(2))r[6]='Membresias';const out=f.resolve();assert.equal(out.contracts.length,0);assert.equal(out.protectedLoans.length,0);});
test('other loan source is neither changed nor included in this contract allocation',()=>{const f=fixture(),c=f.resolve().contracts[0],rows=f.rows();rows.push({C:'other',D:'0009',S:1,date:'2026-01-01',B:99999});const before=JSON.stringify(rows);const out=computeContractCashFlow({contract:c,rows,asOf:'2026-01-15'});assert.equal(out.recovered.B,185000);assert.equal(JSON.stringify(rows),before);});
test('payroll dates exclude request day and include maturity; February always 28',()=>{assert.deepEqual(payrollAdministrativeDates('2028-02-15','2028-03-30','BASE'),['2028-02-28','2028-03-15','2028-03-30']);assert.deepEqual(payrollAdministrativeDates('2026-01-05','2026-04-05','JUB'),['2026-02-05','2026-03-05','2026-04-05']);});
test('single advance payment carries three administrative periods and original interest',()=>{const f=fixture({n:1,amount:110450,interest:6000});Object.assign(f.financial,{amount:1000,interest:60,administrativeFeeTotal:45,total:1105,paymentPerPeriod:1105,fund:'2026-02-15 Adelanto de nomina',administrativeFeePeriodCount:3,administrativeFeeCalendar:{anchorDate:'2026-01-01',dueDate:'2026-02-15',dates:['2026-01-15','2026-01-30','2026-02-15'],periodCount:3}});Object.assign(f.request,{4:f.financial.fund,7:1000,8:1105});Object.assign(f.loans[2],{0:'2026-02-15',1:1105,6:f.financial.fund,9:1000,10:1105,14:1105,15:'2026-02-15'});const out=evaluate(f,'2026-02-15');assert.equal(out.recovered.Z,4500);assert.equal(out.recovered.AB,6000);assert.equal(out.recovered.AD,100000);conservation(out,f.resolve().contracts[0]);});
test('advance without original periods is protected instead of assuming one fee',()=>{const f=fixture({n:1});f.financial.fund='Adelanto de nomina';f.request[4]=f.loans[2][6]=f.financial.fund;assert.equal(f.resolve().protectedLoans[0].reason,'ADVANCE_ADMIN_EVIDENCE_MISSING');});
test('unverified derived classification is never a runtime authority',()=>{const f=fixture(),c=f.resolve().contracts[0];delete c.sourceVerified;assert.equal(computeContractCashFlow({contract:c,rows:f.rows(),asOf:'2026-01-15'}).reason,'ORIGINAL_CONTRACT_NOT_VERIFIED');f.input.snapshots=[];assert.equal(f.resolve().contracts.length,0);});
test('no side effects mutate inputs across repeated queries',()=>{const f=fixture(),before=JSON.stringify(f.input),a=evaluate(f),b=evaluate(f);assert.deepEqual(a,b);assert.equal(JSON.stringify(f.input),before);});
console.log(JSON.stringify({suite:'cash-flow-contracts',status:'PASS',tests:cases.length,cases,productionWrites:false,engineWrites:false},null,2));
