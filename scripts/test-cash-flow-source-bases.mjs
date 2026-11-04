import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCashFlowSourceBases,investorSourceTable} from '../supabase/functions/reports-jc/cash-flow-source-bases.mjs';
test('readable Google evidence preserves original values and excludes forbidden column',()=>{
 const row=[];Object.assign(row,{0:'2026-11-15',1:211.67,2:'001',3:'0007',4:'Persona de prueba',6:'Sutiexpress',9:1000,10:1270,12:180,25:15,26:90,27:30,28:196.67,29:166.67,30:'FORBIDDEN_AE'});
 const tables=buildCashFlowSourceBases({source:{loans:[[],row],requests:[[]]},savings:{events:[],balances:[],source_bases:{}},investors:{},consultedAt:'2026-11-04',report:{loanContracts:[{loanId:'001',principal:1000,total:1270,pv2Rows:[2]}]}}).tables;
 const pv2=tables[0];assert(!JSON.stringify(tables).includes('FORBIDDEN_AE'));assert.equal(pv2.rows[0][pv2.columns.findIndex(c=>c.startsWith('C '))],'001');
 for(const [col,value]of [['B',211.67],['Z',15],['AA',90],['AB',30],['AC',196.67],['AD',166.67]])assert.equal(pv2.rows[0][pv2.columns.findIndex(c=>c.startsWith(col+' '))],value);
 assert.deepEqual(tables[4].rows[0].slice(6,10),[1000,1270,180,90]);
});
test('investor evidence distinguishes original contribution and noncash balance bridge',()=>{
 const source={contracts:[{id:'c',code:'Contrato 2',investor_name:'Inversionista de prueba',principal:391000,registered_contribution:121000,source_sheet:'Contratos',source_row:88,source_status:'Activo'}]};
 const report={records:[{id:'bridge',contractId:'c',source:'Supabase · Inversores',kind:'investor_capital_bridge',date:'2026-08-31',openingPrincipal:270000,closingPrincipal:391000,registeredContribution:121000,registeredCapitalReturn:0,registeredCapitalAdjustment:0,projectedCapitalReturn:0,contractualBalanceChange:0}]};
 const table=investorSourceTable(source,report),index=s=>table.columns.indexOf(s),original=table.rows[0],bridge=table.rows[1];
 assert.equal(original[index('Aportación nueva registrada')],121000);assert.equal(original[index('Inversionista')],'Inversionista de prueba');
 assert.equal(bridge[index('Saldo anterior de capital')]+bridge[index('Aportación registrada del período')]-bridge[index('Devolución registrada del período')]+bridge[index('Ajuste registrado de capital')]-bridge[index('Devolución programada aplicada')]+bridge[index('Cambio contractual sin efectivo')],bridge[index('Saldo final de capital')]);
 assert(table.rows.every(r=>r.length===table.columns.length));
});
test('multiple original predecessor contracts remain individually traceable',()=>{
 const contracts=[{id:'a',code:'Contrato 1',principal:500,source_sheet:'Cartera',source_row:3},{id:'b',code:'Contrato 2',principal:1000,source_sheet:'Cartera',source_row:4},{id:'c',code:'Contrato 4 RC1,2',principal:1500,source_sheet:'Cartera',source_row:9}];
 const record={id:'continuity',contractId:'c',contractCode:'Contrato 4 RC1,2',source:'Supabase · Inversores',kind:'investor_contract_continuity',parentIds:['a','b'],parentCode:'Contrato 1 + Contrato 2',date:'2026-06-01',parentSources:contracts.slice(0,2).map(c=>({contractId:c.id,contractCode:c.code,principal:c.principal,sourceSheet:c.source_sheet,sourceRow:c.source_row}))};
 const table=investorSourceTable({contracts},{records:[record]}),parents=table.rows.filter(r=>r[0]==='Contrato previo de la continuidad');assert.equal(parents.length,2);assert.equal(parents.reduce((n,r)=>n+r[15],0),1500);assert.deepEqual(parents.map(r=>r[22]),[3,4]);assert(parents.every(r=>r[26].includes('c')));
});
