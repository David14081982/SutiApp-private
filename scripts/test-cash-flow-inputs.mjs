import test from 'node:test';
import assert from 'node:assert/strict';
import {cashFlowInputSnapshot,projectionInputs} from '../supabase/functions/reports-jc/cash-flow-inputs.mjs';
function fixture(){return {from:'2026-01',consultedAt:'2026-11-04T20:00:00Z',source:{loans:[Array.from({length:36},(_,i)=>i)],requests:[Array.from({length:30},(_,i)=>i)]},savings:{as_of:'2026-11-04',events:[{id:'h',amount:125,date:'2026-01-15',kind:'contribution'}],balances:[],issues:[],source_bases:{accounts:[],history:[],pending:[],scheduled:[],transactions:[],balance_entries:[],account_balances:[],current_balances:[],history_metadata:[],account_identities:[{id:'a',name:'Nombre autorizado',control:'0001',account_label:'Cuenta 0001',reference:'Ahorro!A2'}],historical_withdrawals:[],opening_account_balances:[]}},investors:{as_of:'2026-11-04',authority:'SUPABASE_INVESTORS',financial_writes:0,contracts:[{id:'c',principal:2500,investor_name:'Nombre autorizado',source_sheet:'Origen',source_row:2,original_document:'Contrato 1',terms:[{id:'t',effective_on:'2026-01-01',monthly_rate:0.025}]}],movements:[],obligations:[],reviews:[],balances:[]},sourceErrors:{investors:null}};}
test('loan AE and every non-allowlisted Google column are removed without shifting original positions',()=>{
 const r=cashFlowInputSnapshot(fixture());assert.equal(r.source.loans[0].length,33);for(const i of [17,19,21,22,23,24,30,31])assert.equal(r.source.loans[0][i],null);for(const i of [0,1,2,18,20,25,26,27,28,29,32])assert.equal(r.source.loans[0][i],i);
 assert.equal(r.source.requests[0].length,25);for(let i=11;i<24;i++)assert.equal(r.source.requests[0][i],null);assert.equal(r.source.requests[0][24],24);
});
test('opaque sources and contact bank credentials never escape at any object depth',()=>{
 const f=fixture(),secret={source_payload:{service_role:'PRIVATE_SECRET'},source_data:{bank:'PRIVATE_SECRET'},source:{email:'PRIVATE_SECRET'},email:'PRIVATE_SECRET',phone:'PRIVATE_SECRET',bank_account:'PRIVATE_SECRET',password:'PRIVATE_SECRET'};
 Object.assign(f,secret);Object.assign(f.source,{source_payload:secret});Object.assign(f.savings,secret);Object.assign(f.savings.events[0],secret);Object.assign(f.savings.source_bases,secret);Object.assign(f.savings.source_bases.account_identities[0],secret);Object.assign(f.investors,secret);Object.assign(f.investors.contracts[0],secret);Object.assign(f.investors.contracts[0].terms[0],secret);
 // Restore the authorized source root overwritten deliberately above.
 f.source={...fixture().source,source_payload:secret};f.savings.events[0].source='savings_review_records';const r=cashFlowInputSnapshot(f);assert(!JSON.stringify(r).includes('PRIVATE_SECRET'));assert.equal(r.savings.source_bases.account_identities[0].control,'0001');assert.equal(r.investors.contracts[0].principal,2500);assert.equal(r.investors.contracts[0].terms[0].monthly_rate,0.025);
});
test('all output arrays and objects are rebuilt and original financial inputs remain unchanged',()=>{
 const f=fixture(),before=structuredClone(f),r=cashFlowInputSnapshot(f);assert.deepEqual(f,before);r.source.loans[0][1]=999;r.savings.events[0].amount=999;r.investors.contracts[0].terms[0].monthly_rate=999;assert.deepEqual(f,before);assert.equal(projectionInputs,cashFlowInputSnapshot);
});
test('unavailable investors preserve an explicit source failure, never an empty valid authority',()=>{
 const f=fixture();f.investors=null;f.sourceErrors.investors='INVESTOR_SOURCE_UNAVAILABLE';const r=cashFlowInputSnapshot(f);assert.equal(r.investors,null);assert.equal(r.sourceErrors.investors,'INVESTOR_SOURCE_UNAVAILABLE');assert.equal(r.version,'cash-flow-inputs-v1');assert.equal(r.modelVersion,'20261104-original-components-v1');
});
test('objects hidden inside permitted scalar fields fail rather than leak opaque payloads or invent values',()=>{
 const f=fixture();f.savings.events[0].amount={source_payload:'secret'};assert.throws(()=>cashFlowInputSnapshot(f),/CASH_FLOW_SOURCE_INVALID/);const g=fixture();g.source.loans[0][1]=Infinity;assert.throws(()=>cashFlowInputSnapshot(g),/CASH_FLOW_SOURCE_INVALID/);
});
test('source issue arrays and contractual obligation originals retain exact authorized fields',()=>{
 const f=fixture();f.savings.issues=[{code:'X',message:'Pendiente',affectedKinds:['contribution'],months:['2026-01'],sourceIds:['h'],payload:{private:'secret'}}];f.investors.obligations=[{id:'o',contract_id:'c',amount:125,principal_basis:2500,rate_snapshot:0.025,origin:'calculated',paid:0,source_payload:'secret'}];const r=cashFlowInputSnapshot(f);assert.deepEqual(r.savings.issues[0],{code:'X',message:'Pendiente',affectedKinds:['contribution'],months:['2026-01'],sourceIds:['h']});assert.equal(r.investors.obligations[0].amount,125);assert.equal(r.investors.obligations[0].paid,0);assert(!JSON.stringify(r).includes('secret'));
});
