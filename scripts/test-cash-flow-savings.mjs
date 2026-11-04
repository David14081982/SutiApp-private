import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileSavingsCashFlow} from '../supabase/functions/reports-jc/cash-flow-savings.mjs';

function fixture({months=['2026-03'],asOf='2026-11-04',accounts=['a'],opening=[100],closing=[100],current=closing,events=[],extras={}}={}){
 const source={accounts:accounts.map(id=>({id})),account_identities:accounts.map(id=>({id,name:'Persona '+id,control:'00'+id,account_label:'Cuenta 00'+id,reference:'Cuenta original '+id})),opening_account_balances:accounts.map((id,i)=>({id,known_amount:opening[i],incomplete:false})),account_balances:months.flatMap(month=>accounts.map((id,i)=>({month:month+'-01',id,known_amount:closing[i],incomplete:false}))),current_balances:accounts.map((id,i)=>({id,amount:current[i]})),balance_entries:[],history:[],history_metadata:[],transactions:[],historical_withdrawals:[],pending:[],scheduled:[],...extras};
 const base={from:months[0],asOf,months:months.map(key=>({key,label:key})),rows:[{id:'savings_balance',label:'Saldo',kind:'balance',cells:months.map(key=>({amount:(key===asOf.slice(0,7)?current:closing).reduce((a,b)=>a+b,0),knownAmount:(key===asOf.slice(0,7)?current:closing).reduce((a,b)=>a+b,0),status:'RECORDED'}))}],records:events.map(e=>({...e})),issues:[],unassigned:[]};
 return {base,savings:{events,balances:[],source_bases:source}};
}
const cell=(r,id,i=0)=>r.rows.find(x=>x.id===id).cells[i];
test('unlinked March withdrawal remains paid but cannot reduce an unrelated account subtotal',()=>{
 const event={id:'historical-withdrawal:w',source_id:'w',kind:'withdrawal_unspecified',date:'2026-03-15',amount:5790,source:'savings_review_records'};
 const f=fixture({events:[event],extras:{historical_withdrawals:[{id:'w',date:event.date,amount:5790,source_folio:'0007',name:'Persona histórica',reference:'Solicitud de retiro!G12',account_id:null}]}}),before=structuredClone(f),r=reconcileSavingsCashFlow(f);
 assert.deepEqual(f,before);assert.equal(cell(r,'savings_basis_adjustment').amount,5790);assert.equal(cell(r,'savings_balance').amount,100);
 assert.equal(r.savingsBridge.months[0].netMovements,-5790);assert(r.savingsBridge.months[0].equationValid);assert.equal(r.records.find(x=>x.id===event.id).control,'0007');
 assert.equal(r.records.filter(x=>x.kind==='withdrawal_unspecified').length,1);assert(r.records.find(x=>x.kind==='savings_basis_adjustment').basis==='NON_CASH_BASIS_CHANGE');
});
test('four September account transitions explain the -1200 basis change without cash',()=>{
 const f=fixture({months:['2026-09'],accounts:['a','b','c','d'],opening:[1000,1000,1000,1000],closing:[800,1500,0,500]});f.savings.source_bases.accounts.forEach(a=>a.opening_on='2026-09-06');
 const r=reconcileSavingsCashFlow(f);assert.equal(cell(r,'savings_basis_adjustment').amount,-1200);assert.equal(r.savingsBridge.months[0].netMovements,0);
 assert.deepEqual(r.savingsBridge.months[0].accounts.map(a=>a.basisAdjustment),[-20000,50000,-100000,-50000]);assert(r.savingsBridge.months[0].accounts.every(a=>a.reason==='HISTORY_TO_LEDGER'));
});
test('current canonical zero replaces a negative historical basis without inventing receipts',()=>{
 const f=fixture({months:['2026-11'],opening:[-40620],closing:[-40620],current:[0]});
 const r=reconcileSavingsCashFlow(f);assert.equal(cell(r,'savings_basis_adjustment').amount,40620);assert.equal(cell(r,'savings_balance').amount,0);assert.equal(r.savingsBridge.months[0].netMovements,0);
 assert.equal(r.records.filter(r=>r.kind==='contribution').length,0);
});
test('January AB remains the labeled recorded contribution, never silently opening capital',()=>{
 const e={id:'history:registered:r:AB',kind:'contribution',date:'2026-01-15',amount:50,source:'savings_review_records'};
 const r=reconcileSavingsCashFlow(fixture({months:['2026-01'],opening:[100],closing:[150],events:[e],extras:{history:[{id:'registered:r:AB',account_id:'a',date:e.date,amount:50}],history_metadata:[{id:'registered:r:AB',source_column:'AB',source_label:'2026-01-15 · Descuento registrado',source_sheet:'Ahorro',reference:'Ahorro!AB2'}]}}));
 assert.equal(cell(r,'savings_basis_adjustment').amount,0);const row=r.savingsSourceTable.rows.find(x=>x[9]==='AB');assert.equal(row[6],50);assert.equal(row[10],'Aportación registrada');assert.equal(row[8],'Ahorro!AB2');
});
test('June DT disclosure does not duplicate the original mixed contribution',()=>{
 const e={id:'history:registered:r:AR',kind:'contribution_mixed',date:'2026-06-30',amount:150,source:'savings_review_records'};
 const r=reconcileSavingsCashFlow(fixture({months:['2026-06'],opening:[100],closing:[250],events:[e],extras:{history:[{id:'registered:r:AR',account_id:'a',date:e.date,amount:150}],history_metadata:[{id:'registered:r:AR',source_column:'AR',yield_column:'DT',yield_amount:30,source_sheet:'Ahorro',reference:'Ahorro!AR2'}]}}));
 assert.equal(r.savingsBridge.months[0].netMovements,150);assert.equal(cell(r,'savings_basis_adjustment').amount,0);assert.equal(r.records.filter(x=>x.kind==='contribution_mixed').length,1);
 const detail=r.savingsSourceTable.rows.filter(x=>x[0].startsWith('Desglose informativo'));assert.deepEqual(detail.map(x=>x[6]),[30,120]);
});
test('missing or incompatible DT does not invent a split',()=>{
 const e={id:'history:registered:r:AR',kind:'contribution_mixed',date:'2026-06-30',amount:10};const f=fixture({months:['2026-06'],opening:[0],closing:[10],events:[e],extras:{history:[{id:'registered:r:AR',account_id:'a',date:e.date,amount:10}],history_metadata:[{id:'registered:r:AR',yield_amount:30}]}});
 assert(!reconcileSavingsCashFlow(f).savingsSourceTable.rows.some(x=>x[0].startsWith('Desglose informativo')));
});
test('future projection consumes existing instructions only, including intervening months',()=>{
 const events=[{id:'s1',kind:'contribution_scheduled',date:'2026-12-15',amount:25},{id:'s2',kind:'contribution_scheduled',date:'2027-01-15',amount:30},{id:'w',kind:'withdrawal_pending',date:'2027-01-30',amount:10},{id:'s3',kind:'contribution_scheduled',date:'2027-02-15',amount:40}];
 const r=reconcileSavingsCashFlow(fixture({months:['2027-01','2027-02'],current:[100],events}));assert.equal(cell(r,'savings_projected_balance',0).amount,145);assert.equal(cell(r,'savings_projected_balance',1).amount,185);assert.equal(cell(r,'savings_basis_adjustment').status,'NOT_APPLICABLE');assert.equal(r.records.length,4);
});
test('missing first-day basis remains visible and does not become zero',()=>{
 const f=fixture();delete f.savings.source_bases.opening_account_balances;const r=reconcileSavingsCashFlow(f);assert.equal(cell(r,'savings_opening_balance').amount,null);assert.equal(r.savingsBridge.months[0].status,'UNAVAILABLE');
});
test('unknown recorded amount preserves known balances with a partial bridge',()=>{
 const e={id:'history:unknown',kind:'contribution',date:'2026-03-15',amount:null};const f=fixture({events:[e],extras:{history:[{id:'unknown',account_id:'a',date:e.date,amount:null}]}});const r=reconcileSavingsCashFlow(f);assert.equal(cell(r,'savings_basis_adjustment').amount,null);assert.equal(cell(r,'savings_balance').amount,100);assert.equal(r.savingsBridge.months[0].status,'PARTIAL');
});
test('conflicting account identity and mismatching aggregate balances fail visibly',()=>{
 const f=fixture();f.savings.source_bases.accounts.push({id:'a',opening_on:'2026-01-01'});assert.throws(()=>reconcileSavingsCashFlow(f),/SAVINGS_SOURCE_ID_CONFLICT/);
 const g=fixture();g.base.rows[0].cells[0].knownAmount=777;assert.throws(()=>reconcileSavingsCashFlow(g),/SAVINGS_BALANCE_BASIS_MISMATCH/);
});
test('source table remains singular and human-readable without unrelated PII',()=>{
 const r=reconcileSavingsCashFlow(fixture());assert.equal(r.savingsSourceTable.name,'Base Ahorro');assert(r.savingsSourceTable.columns.includes('Nombre'));assert(r.savingsSourceTable.columns.includes('Número de control'));assert(r.savingsSourceTable.rows.some(r=>r[1]==='Persona a'&&r[2]==='00a'));assert(!JSON.stringify(r.savingsSourceTable).includes('service_role'));
});
test('opening and noncash cells resolve every source id to a readable record',()=>{
 const r=reconcileSavingsCashFlow(fixture());
 for(const id of ['savings_opening_balance','savings_basis_adjustment']){
  const c=cell(r,id);assert(c.sourceIds.length>0);
  for(const ref of c.sourceIds){const detail=r.records.find(x=>x.id===ref);assert(detail);assert.equal(detail.name,'Persona a');assert.equal(detail.kind,id);assert(detail.sourceId);}
 }
});
test('future dated historical withdrawal reduces projection and remains traceable outside report window',()=>{
 const events=[{id:'historical-withdrawal:w',kind:'withdrawal_total',date:'2026-12-15',amount:25,source_id:'w'}],f=fixture({months:['2028-01'],current:[100],events,extras:{historical_withdrawals:[{id:'w',account_id:'a',amount:25,date:'2026-12-15',reference:'Solicitud de retiro!G3'}]}});f.base.records=[];
 const r=reconcileSavingsCashFlow(f);assert.equal(cell(r,'savings_projected_balance').amount,75);assert.equal(r.records.find(x=>x.id===events[0].id).kind,'withdrawal_pending');assert.equal(r.records.find(x=>x.id===events[0].id).name,'Persona a');
});
