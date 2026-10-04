'use strict';
// Synthetic source only: actual calculator and real ExcelJS serialization.
const assert=require('assert/strict');
const ExcelJS=require('../.tmp/sicof/deps/node_modules/exceljs');
(async()=>{
  const {exportSicofReport}=await import('../supabase/functions/sicof/exports.mjs');
  const {calculateSicof}=await import('../supabase/functions/sicof/engine.mjs');
  const settings={src:'caja',selFunds:[],pay:98,method:'avg',periodIni:'2026-07-01',periodFin:'2026-12-31',minm:6,exterm:true,exmin:true,warn:1000,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'adeudo',anchorOn:false,anchorDate:'2026-07-01',capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
  const tx=(id,amount,effective_date,direction='CREDIT',component='CAPITAL')=>({id,amount,effective_date,contribution_date:effective_date,component,direction,transaction_type:direction==='CREDIT'?'CONTRIBUTION':'WITHDRAWAL',origin_key:'2026-S2'});
  const person=(folio,patch={})=>({id:'person-'+folio,folio,name:'Synthetic '+folio,identity_resolved:true,certified:true,enrollment:{status:'ACTIVE',frequency:'BIWEEKLY',enrollment_started_at:'2025-01-01'},eligibility:{complete:true,policy_reasons:[]},history:[{date:'2026-07-15',amount:100,expected:100},{date:'2027-01-15',amount:100,expected:100}],transactions:[tx('start-'+folio,100,'2026-07-01')],composition:{balances:{capital:100,yield_amount:0,available:100},periods:[{origin_key:'2026-S2',component:'CAPITAL',recognized:100,withdrawn:0,remaining:100,origin_state:'RECONCILED'}]},...patch});
  const context={today:'2026-10-03',participants:[
    person('00123',{name:'=HYPERLINK("synthetic")',transactions:[tx('a',100,'2026-07-01'),tx('b',100,'2026-08-01'),tx('w',50,'2026-09-01','DEBIT')],composition:{balances:{capital:150,yield_amount:20,available:170},periods:[{origin_key:'2026-S2',component:'CAPITAL',recognized:200,withdrawn:50,remaining:150,origin_state:'RECONCILED'},{origin_key:'2025-S2',component:'YIELD',recognized:20,withdrawn:0,remaining:20,origin_state:'RECONCILED'}]}}),
    person('123'),person('unknown',{certified:false,eligibility:{complete:false,reasons:['SYNTHETIC_UNCERTIFIED']}}),
    person('excluded',{eligibility:{complete:true,policy_reasons:['SHORT_CONTRIBUTION']}})
  ]};
  const payment=(source_row,patch={})=>({source_row,date:'2026-07-15',folio:'borrower-'+source_row,loan_id:'loan-'+source_row,name:'Synthetic borrower',fund:'Caja de Ahorro',paid:10,expected:10,capital:8.65,interest:1.25,fee:.10,projected_interest:null,projected_capital:null,projected_fee:null,audit:'RECONCILED_SOURCE_PAYMENT',issues:[],...patch});
  const payments=Array.from({length:605},(_,i)=>payment(i+2));
  payments.push(payment(607,{fund:'Extra',interest:5.25,capital:4.65}),
    payment(608,{date:'2026-11-15',paid:0,capital:null,interest:null,fee:null,projected_interest:8.75,projected_capital:11.2,projected_fee:.05,audit:'PROJECTED'}),
    payment(609,{fund:'Extra',date:'2026-12-15',paid:0,capital:null,interest:null,fee:null,projected_interest:6.5,projected_capital:13.4,projected_fee:.1,audit:'PROJECTED'}),
    payment(610,{fund:'Outside',interest:50,paid:60}),
    payment(611,{date:null,paid:null,capital:null,interest:null,fee:null,audit:'REVIEW_REQUIRED',issues:['INVALID_AMORTIZATION_DATE']}),
    payment(612,{paid:0,capital:0,interest:0,fee:0,audit:'NO_RECORDED_PAYMENT'}),
    payment(613,{date:'2026-06-30',interest:9999}),payment(614,{date:'2027-01-01',interest:9999}));
  const loan=p=>({id:p.loan_id,folio:p.folio,name:p.name,fund:p.fund,capital:100,term:10,rate_percent:1.25,total:110,interest_total:10,admin_fee_total:0,paid:10,expected:10,arrears:0,status:'AL CORRIENTE',behavior:'CURRENT',schedule:[p]});
  const dependency={id:'external-debt',folio:'00123',name:'Borrower name must not match identity',fund:'Outside',capital:100,total:110,paid:10,expected:60,arrears:50,status:'SALDO ATRASADO',behavior:'OVERDUE',schedule:[payment(800,{loan_id:'external-debt',folio:'00123',fund:'Outside',date:'2025-01-15'})]};
  const loanAnalysis={source:'ISOLATED_WORKBOOK:HISTORIAL P V2',observed_at:'2026-10-03T12:00:00Z',source_fingerprint:'a'.repeat(64),certification:{status:'REVIEW_REQUIRED'},payments,loans:[...payments.map(loan),dependency],issues:[{source_row:611,folio:payments.find(p=>p.source_row===611).folio,loan_id:'loan-611',code:'INVALID_AMORTIZATION_DATE'},{source_row:9999,folio:'not-selected',code:'UNRELATED_SOURCE_ISSUE'}]};
  loanAnalysis.loans[0].schedule.push(payment(801,{folio:payments[0].folio,loan_id:payments[0].loan_id,date:'2025-01-15',audit:'REVIEW_REQUIRED'}));
  loanAnalysis.issues.push({source_row:801,folio:payments[0].folio,loan_id:payments[0].loan_id,code:'PRIOR_CONTRACT_INCIDENT'});
  const costs=[{id:'pool',concept:'=SYNTHETIC()',amount:10.111,source:'pool',status:'committed',date:'2026-10-03'},{id:'reserve',concept:'Reserve expense',amount:40.003,source:'reserve',status:'estimated',date:'2026-11-01'}];
  const read=async file=>{const book=new ExcelJS.Workbook();await book.xlsx.load(file.bytes);return book;};
  const value=cell=>cell.value&&typeof cell.value==='object'&&cell.value.formula?cell.value.result??0:cell.value;
  const summary=book=>{const sheet=book.getWorksheet('Resumen'),map=new Map();for(let i=2;i<=sheet.rowCount;i++)map.set(sheet.getCell(i,1).value,{value:value(sheet.getCell(i,2)),cell:sheet.getCell(i,2)});return map;};
  const moneySum=items=>items.reduce((n,v)=>n+Math.round(v*100),0)/100;
  const scenarios=[];
  for(const src of ['caja','sel','todos']){
    const s={...settings,src,selFunds:src==='sel'?['Extra','Caja de Ahorro','Extra']:[]};
    const calculation=calculateSicof(context,loanAnalysis,{settings:s,costs,bank:{amount:null}});calculation.fingerprint='b'.repeat(64);
    const before=JSON.stringify({context,loanAnalysis,calculation}),file=await exportSicofReport({kind:'base_calculo',calculation,context,loans:loanAnalysis,ExcelJS});
    assert.equal(JSON.stringify({context,loanAnalysis,calculation}),before,'export cannot mutate its sources');
    const book=await read(file),metrics=summary(book),sheet=book.getWorksheet('Pagos');
    assert.equal(book.worksheets[0].name,'Resumen');assert.equal(file.filename,'SICOF_base_calculo.xlsx');
    assert.equal(metrics.get('Porcentaje del interés a repartir').value,.98);
    const accepted=src==='caja'?['Caja de Ahorro']:src==='sel'?['Caja de Ahorro','Extra']:null;
    const selected=payments.filter(p=>(!accepted||accepted.includes(p.fund))&&(!p.date||(p.date>=s.periodIni&&p.date<=s.periodFin)));
    assert.equal(sheet.rowCount,selected.length+1);assert(sheet.rowCount>600);
    assert.equal(metrics.get('Filas de pagos en la selección').value,selected.length);
    const sourceRows=[];for(let r=2;r<=sheet.rowCount;r++)sourceRows.push(sheet.getCell(r,14).value);
    assert.deepEqual(sourceRows,selected.map(p=>p.source_row));assert(!sourceRows.includes(613));assert(!sourceRows.includes(614));
    assert.equal(moneySum(selected.map((p,i)=>value(sheet.getCell(i+2,15)))),calculation.collected);
    assert.equal(moneySum(selected.map((p,i)=>value(sheet.getCell(i+2,16)))),calculation.projected);
    const unknownRow=sourceRows.indexOf(611)+2;assert.equal(sheet.getCell(unknownRow,9).value,'POR CONCILIAR');assert.equal(sheet.getCell(unknownRow,12).value,'REVIEW_REQUIRED');
    const projectedRow=sourceRows.indexOf(608)+2;assert.equal(sheet.getCell(projectedRow,17).value,11.2);assert.equal(sheet.getCell(projectedRow,18).value,.05);
    for(const [label,key]of [['Interés registrado conciliado','collected'],['Interés proyectado pendiente','projected'],['Gasto administrativo conciliado','administrative_fees'],['Bolsa a repartir después de costos','pool'],['Reserva restante','reserve'],['Costos y apartados','costsTotal'],['Base elegible que participa','base'],['Bolsa proyectada neta de costos','projectedNetPool'],['Suma de rendimientos simulados','distributed']])assert.equal(metrics.get(label).value,calculation[key],label);
    assert.equal(metrics.get('Tasa proyectada sobre base confirmada').value,calculation.projectedRateOnConfirmedBase/100);
    assert.equal(metrics.get('Tasa del periodo').value,calculation.rate/100);
    assert.equal(metrics.get('Reserva proyectada antes de costos').value,Math.round((Math.round((calculation.collected+calculation.projected)*100)-Math.round(Math.round((calculation.collected+calculation.projected)*100)*.98)))/100);
    assert(metrics.get('Costos de reserva que reducen la bolsa proyectada').value>0,'fixture exercises reserve spill');
    assert.match(metrics.get('Bolsa proyectada neta de costos').cell.value.formula,/'Parámetros'!B7/);
    assert.match(metrics.get('Tasa proyectada sobre base confirmada').cell.value.formula,/B\d+\/B\d+/);
    assert.equal(book.getWorksheet('Costos').getCell('A2').value,'=SYNTHETIC()','formula-looking source remains string');
    assert.equal(book.getWorksheet('Costos').getCell('B2').value,10.11);assert.equal(book.getWorksheet('Costos').getCell('B3').value,40);
    const reparto=book.getWorksheet('Reparto formulado'),deps=book.getWorksheet('Préstamos de ahorradores');
    assert.equal(reparto.getCell('A2').value,'00123');assert.equal(reparto.getCell('A3').value,'123');assert.equal(reparto.getCell('B2').value,'=HYPERLINK("synthetic")');
    assert.equal(reparto.getCell('K2').value,50);assert.equal(reparto.getCell('K3').value,0,'exact folio avoids joining 00123 to 123');
    assert.equal(reparto.getCell('I4').value,'POR CONCILIAR');assert.equal(reparto.getCell('C5').value,'No');
    assert.equal(deps.rowCount,2);assert.equal(deps.getCell('A2').value,'00123');assert.equal(deps.getCell('C2').value,'external-debt');assert.equal(deps.getCell('O2').value,'800');
    assert(deps.getCell('E2').value.includes(src==='todos'?'Fondo incluido':'Fuera de la bolsa'));
    assert.equal(book.getWorksheet('Contratos de la bolsa').rowCount,selected.length+1);
    assert.equal(book.getWorksheet('Aportaciones para reglas').rowCount,5,'future history is not a missed contribution');
    const incidents=book.getWorksheet('Incidencias fuente');assert.equal(incidents.rowCount,3,'retain prior contract evidence, exclude unrelated global incidents');
    assert.deepEqual([incidents.getCell('A2').value,incidents.getCell('A3').value],[611,801]);
    const meta=book.getWorksheet('Fuentes y alcance'),metaMap=new Map();for(let i=2;i<=meta.rowCount;i++)metaMap.set(meta.getCell(i,1).value,meta.getCell(i,2).value);
    assert.equal(metaMap.get('Huella fuente'),loanAnalysis.source_fingerprint);assert.equal(metaMap.get('Huella cálculo'),calculation.fingerprint);assert.equal(metaMap.get('Filtros'),'{}');
    scenarios.push({source:src,rows:selected.length,collected:calculation.collected,projected:calculation.projected,projectedNetPool:calculation.projectedNetPool});
  }
  const calculation=calculateSicof(context,loanAnalysis,{settings,costs,bank:{amount:null}}),options={kind:'base_calculo',calculation,context,loans:loanAnalysis,ExcelJS};
  for(const filters of [{fund:'Outside'},{search:'00123'},{from:'2026-09-01'},{folio:'00123'},{format:'csv'},{unknown:'value'}])await assert.rejects(()=>exportSicofReport({...options,filters}),/SICOF_EXPORT_FILTER_INVALID/);
  for(const key of ['collected','projected'])await assert.rejects(()=>exportSicofReport({...options,calculation:{...calculation,[key]:calculation[key]+1}}),/SICOF_EXPORT_SOURCE_MISMATCH/);
  for(const key of ['pool','reserve','administrative_fees','costsTotal','projectedNetPool','projectedRateOnConfirmedBase'])await assert.rejects(()=>exportSicofReport({...options,calculation:{...calculation,[key]:calculation[key]+1}}),/SICOF_EXPORT_RESULT_MISMATCH/);
  await assert.rejects(()=>exportSicofReport({...options,context:{...context,participants:context.participants.slice(1)}}),/SICOF_EXPORT_SOURCE_MISMATCH/);
  const noBasisContext={...context,participants:context.participants.map(p=>({...p,certified:false}))};
  const noBasis=calculateSicof(noBasisContext,loanAnalysis,{settings,costs,bank:{amount:null}});
  const noBasisBook=await read(await exportSicofReport({...options,calculation:noBasis,context:noBasisContext}));
  assert.equal(summary(noBasisBook).get('Tasa del periodo').value,'POR CONCILIAR');assert.equal(summary(noBasisBook).get('Tasa proyectada sobre base confirmada').value,'POR CONCILIAR');
  const noPayments={...loanAnalysis,payments:[],loans:[],issues:[]};
  const zero=calculateSicof(context,noPayments,{settings,costs:[],bank:{amount:null}});
  const zeroBook=await read(await exportSicofReport({...options,calculation:zero,loans:noPayments}));assert.equal(zeroBook.getWorksheet('Pagos').rowCount,1);assert.equal(summary(zeroBook).get('Bolsa proyectada neta de costos').value,0);
  const excludes=calculateSicof(context,loanAnalysis,{settings:{...settings,loanEffect:'rendimiento'},costs,bank:{amount:null}});
  const excludedBook=await read(await exportSicofReport({...options,calculation:excludes}));assert.equal(excludedBook.getWorksheet('Reparto formulado').getCell('C2').value,'No');assert.equal(excludedBook.getWorksheet('Préstamos de ahorradores').getCell('K2').value,'rendimiento');
  console.log(JSON.stringify({status:'PASS',scenarios,checks:['actual engine and ExcelJS readback','same applied funds and full period','605+ rows without screen limits','98 percent and projected reserve spill formulas','real and projected components separated','unknowns remain explicit','all dependencies separate with exact Folio','costs rounded as engine','unapplied filters rejected','source and result mismatches rejected','source/context immutability','formula injection remains text','no verified basis and empty source','source and calculation fingerprints'],externalQueries:0,financialWrites:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
