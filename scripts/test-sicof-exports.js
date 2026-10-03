'use strict';
const assert=require('assert/strict'),fs=require('fs'),crypto=require('crypto');
const ExcelJS=require('../.tmp/sicof/deps/node_modules/exceljs');
const JSZip=require('../.tmp/sicof/deps/node_modules/jszip');
(async()=>{
  const {exportSicofReport,buildSicofExportTable}=await import('../supabase/functions/sicof/exports.mjs');
  const load=async bytes=>{const b=new ExcelJS.Workbook();await b.xlsx.load(bytes);return b;};
  const payment=(patch={})=>({date:'2026-01-15',folio:'00123',name:'=HYPERLINK("invalid")',loan_id:'008',fund:'Caja de Ahorro',paid:10,expected:10,capital:8,interest:1.5,fee:.5,audit:'RECONCILED_SOURCE_PAYMENT',issues:[],source_row:2,...patch});
  const loan={folio:'00123',name:'<script>alert(1)</script>',id:'008',fund:'Caja de Ahorro',status:'SALDO ATRASADO',capital:100,total:110,paid:10,expected:30,arrears:20,behavior:'OVERDUE',schedule:[payment()]};
  const loans={source:'fixed-source',observed_at:'2026-06-30T12:00:00Z',source_fingerprint:'a'.repeat(64),payments:[payment(),payment({date:'2026-01-30',paid:null,capital:null,interest:null,fee:null,audit:'REVIEW_REQUIRED',issues:['INVALID_RECORDED_PAYMENT'],source_row:3}),payment({folio:'99999',fund:'Other',loan_id:'009'})],loans:[loan,{...loan,id:'009',folio:'99999',fund:'Other',status:'AL CORRIENTE'}],issues:[{source_row:3,folio:'00123',loan_id:'008',code:'INVALID_RECORDED_PAYMENT'}],certification:{status:'REVIEW_REQUIRED'}};
  const calculation={engine_version:'ISOLATED',status:'SIMULATION',settings:{src:'caja',pay:90,method:'end',periodIni:'2026-01-01',periodFin:'2026-06-30',capitalBasis:'all',yieldMode:'none'},
    collected:1.23,projected:0,pool:.01,reserve:.12,base:3,distributed:.01,rate:.01/3*100,bank:{amount:3,declaredBy:'<Admin>',date:'2026-06-30'},
    costs:[{id:'c1',concept:'<script>bad</script>',amount:1.1,source:'pool',status:'committed',date:'2026-06-30'}],alerts:[{text:'<img src=x onerror=alert(1)>'}],
    rows:Array.from({length:3},(_,i)=>({f:'00'+(i+1),n:'Person '+i,ok:true,endbal:1,avgbal:1,capital:1,previous_yield:0,rend:i?0:.01,total:i?1:1.01,retenido:i?0:.01,entregable:1,available:1,motivo:'',calculation_steps:[{date:'2026-01-01',amount:1,balance:1,days:181,balance_days:181}]}))};
  const formulaLoans={...loans,payments:[payment({interest:1.23}),loans.payments[1],payment({fund:'Other',interest:90}),payment({date:'2027-01-01',interest:80})]};
  const csv=await exportSicofReport({kind:'pagos',loans,filters:{format:'csv',fund:'Caja de Ahorro'}}),csvText=new TextDecoder().decode(csv.bytes);
  assert(csvText.includes("'=HYPERLINK"));assert(csvText.includes('POR CONCILIAR'));assert(!csvText.includes('99999'));assert(csvText.includes('Fecha de amortización'));
  let file=await exportSicofReport({kind:'pagos',loans,filters:{fund:'Caja de Ahorro'},ExcelJS});
  let book=await load(file.bytes);assert.equal(book.getWorksheet('Pagos').rowCount,3);assert.equal(book.getWorksheet('Pagos').getCell('B2').value,'00123');assert.equal(book.getWorksheet('Pagos').getCell('F3').value,'POR CONCILIAR');
  file=await exportSicofReport({kind:'atrasos',loans,filters:{fund:'Caja de Ahorro'},ExcelJS});book=await load(file.bytes);assert.equal(book.getWorksheet('Atrasos').rowCount,2);
  assert.equal(buildSicofExportTable('pagos',{loans,filters:{q:'00123',from:'',to:'',year:''}}).rows.length,2);
  assert.equal(buildSicofExportTable('atrasos',{loans,filters:{q:'00123',severity:'mild',from:'',to:'',year:''}}).rows.length,1);
  assert.equal(buildSicofExportTable('atrasos',{loans,filters:{severity:'severe'}}).rows.length,0);
  const duplicates={...loans,loans:[{...loan,schedule:[payment(),payment({source_row:5})]}]};
  assert.equal(buildSicofExportTable('matriz',{loans:duplicates}).rows[0]['2026-01-15_paid'],'POR CONCILIAR');
  assert.equal(buildSicofExportTable('matriz',{loans,filters:{year:2025}}).rows.length,0);
  assert.equal(buildSicofExportTable('matriz',{loans:{...loans,loans:[{...loan,schedule:[payment({date:null})]}]},filters:{year:2025}}).rows.length,1);
  file=await exportSicofReport({kind:'matriz',loans,filters:{year:2026,fund:'Caja de Ahorro'},ExcelJS});book=await load(file.bytes);assert(book.getWorksheet('Matriz de préstamos').getCell('R1').value.includes('2026-01-15'));assert.equal(book.getWorksheet('Matriz de préstamos').getCell('H1').value,'Tasa quincenal (%)');
  file=await exportSicofReport({kind:'matriz_fondos',loans,filters:{funds:['Caja de Ahorro'],year:''},ExcelJS});book=await load(file.bytes);assert(book.getWorksheet('Caja de Ahorro'));assert(!book.getWorksheet('Other'));
  assert.equal((await exportSicofReport({kind:'csv',calculation,filters:{q:'001'}})).contentType,'text/csv; charset=utf-8');
  file=await exportSicofReport({kind:'reparto_formulado',calculation,loans:formulaLoans,ExcelJS});book=await load(file.bytes);
  const reparto=book.getWorksheet('Reparto formulado');assert.equal(reparto.getCell('H2').value,.01);assert.equal(reparto.getCell('I2').value.result,.01);assert.equal(reparto.getCell('J2').value.result,1.01);assert.equal(reparto.getCell('L2').value.result,1);
  const formulaXml=await(await JSZip.loadAsync(file.bytes)).file('xl/worksheets/sheet1.xml').async('string');
  assert.match(formulaXml,/<c r="I3"[^>]*>[\s\S]*?<v>0<\/v><\/c>/);assert.equal(reparto.getCell('I5').value.result,.01);
  const params=book.getWorksheet('Parámetros');assert.equal(params.getCell('B10').value.result,.01);assert.equal(params.getCell('B11').value.result,.12);assert.equal(params.getCell('B7').value.result,1.1);
  assert.equal(book.getWorksheet('Pagos').rowCount,3);assert.equal(book.getWorksheet('Pagos').getCell('O2').value.result,1.23);
  assert.equal(params.getCell('B2').value.formula,'SUM(Pagos!O2:O3)');assert.equal(params.getCell('B12').value.result,3);
  assert.equal(book.getWorksheet('Desglose').getCell('G2').value.formula,'E2*F2');assert.equal(reparto.getCell('D2').value.formula,'SUM(Desglose!I2:I2)');
  assert(params.getCell('B7').value.formula.includes('SUMIF'));assert.equal(book.getWorksheet('Costos').getCell('A2').value,'<script>bad</script>');
  await assert.rejects(()=>exportSicofReport({kind:'reparto_formulado',calculation:{...calculation,pool:10},loans:formulaLoans,ExcelJS}),/SICOF_EXPORT_RESULT_MISMATCH/);
  await assert.rejects(()=>exportSicofReport({kind:'reparto_formulado',calculation,loans,ExcelJS}),/SICOF_EXPORT_SOURCE_MISMATCH/);
  const fractional={...calculation,costs:[...calculation.costs,{id:'subcent1',concept:'A',amount:.004,source:'pool',status:'estimated'},{id:'subcent2',concept:'B',amount:.004,source:'pool',status:'estimated'}]};
  const fractionalBook=await load((await exportSicofReport({kind:'reparto_formulado',calculation:fractional,loans:formulaLoans,ExcelJS})).bytes);assert.equal(fractionalBook.getWorksheet('Costos').getCell('B3').value,0);assert.equal(fractionalBook.getWorksheet('Parámetros').getCell('B7').value.result,1.1);
  const html=new TextDecoder().decode((await exportSicofReport({kind:'acta',calculation,loans})).bytes);
  assert(html.includes('SIMULACIÓN'));assert(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(html.includes('capitalBasis'));
  assert(html.includes('Prueba de liquidez'));assert(html.includes('Retiro del 10%'));assert(html.includes('Retiro del 100%'));assert(html.includes('onclick="window.print()"'));assert(html.includes('Secretaría de Finanzas'));
  assert(html.includes('<td>Efectivo declarado después de costos pendientes</td><td>POR CONCILIAR</td>'));assert(!html.includes('garantizada'));
  // Exercise the actual motor -> XLSX/HTML contract, including an effective
  // withdrawal, a fractional daily average and all liquidity outcomes.
  const {calculateSicof}=await import('../supabase/functions/sicof/engine.mjs');
  const settings={src:'caja',selFunds:[],pay:90,method:'avg',periodIni:'2026-01-01',periodFin:'2026-06-30',minm:6,exterm:true,exmin:true,warn:20,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,anchorDate:'2026-01-01',capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
  const movement=(id,amount,effective_date,direction='CREDIT')=>({id,amount,effective_date,contribution_date:direction==='CREDIT'?effective_date:null,component:'CAPITAL',direction,transaction_type:direction==='CREDIT'?'CONTRIBUTION':'WITHDRAWAL'});
  const person=(id,transactions,capital)=>({id,folio:id,name:'Synthetic '+id,identity_resolved:true,certified:true,enrollment:{enrollment_started_at:'2025-01-01',status:'ACTIVE'},transactions,history:[],eligibility:{complete:true},composition:{balances:{capital,yield_amount:0,available:capital},movements:[],periods:[]}});
  const engineContext={today:'2026-07-01',participants:[person('0001',[movement('a',100,'2026-01-01'),movement('b',100,'2026-04-01'),movement('c',50,'2026-05-01','DEBIT')],150),person('0002',[movement('d',100,'2026-01-01')],100)]};
  const engineLoans={...loans,loans:[{folio:'0009',fund:'Caja de Ahorro',total:200,paid:0,behavior:'CURRENT',status:'AL CORRIENTE'}],funds:[],payments:[payment({interest:10}),payment({date:'2026-06-30',paid:0,capital:null,interest:null,audit:'PROJECTED',projected_interest:4}),loans.payments[1],payment({fund:'Other',interest:50})]};
  const options={settings,costs:[{id:'banked',concept:'Already banked',amount:1,source:'pool',status:'paid',date:'2026-06-01'},{id:'future',concept:'Committed',amount:.5,source:'reserve',status:'committed',date:'2026-07-01'}],bank:{amount:100,declaredBy:'Synthetic administrator',date:'2026-06-30'}};
  const actual=calculateSicof(engineContext,engineLoans,options);
  const eligibilityContext={...engineContext,participants:[
    {...person('unknown',[movement('e1',100,'2026-01-01')],100),enrollment:{status:'ACTIVE'}},
    {...person('short',[movement('e2',100,'2026-01-01')],100),enrollment:{status:'ACTIVE',enrollment_started_at:'2026-05-01'}},
    person('known',[movement('e3',100,'2026-01-01')],100)
  ]};
  const eligibilityCalculation=calculateSicof(eligibilityContext,engineLoans,{settings});
  assert.deepEqual(eligibilityCalculation.rows.map(r=>r.rend),[null,0,9]);
  assert.deepEqual(buildSicofExportTable('reparto',{calculation:eligibilityCalculation}).rows.map(r=>r.eligibility),['Por verificar','No','Sí']);
  const eligibilityCsv=new TextDecoder().decode((await exportSicofReport({kind:'csv',calculation:eligibilityCalculation})).bytes);
  const eligibilityCsvRows=eligibilityCsv.split('\r\n').slice(1);['Por verificar','No','Sí'].forEach((label,i)=>assert(eligibilityCsvRows[i].includes('"'+label+'"')));
  const eligibilityBook=await load((await exportSicofReport({kind:'reparto',calculation:eligibilityCalculation,ExcelJS})).bytes);
  assert.deepEqual([2,3,4].map(n=>eligibilityBook.getWorksheet('Reparto').getCell(n,7).value),['Por verificar','No','Sí']);
  assert.equal(eligibilityBook.getWorksheet('Reparto').getCell('H2').value,'POR CONCILIAR');assert.equal(eligibilityBook.getWorksheet('Reparto').getCell('H3').value,0);
  const eligibilityFormulaFile=await exportSicofReport({kind:'reparto_formulado',calculation:eligibilityCalculation,loans:engineLoans,ExcelJS});
  const eligibilityFormulas=await load(eligibilityFormulaFile.bytes);
  const eligibilityReparto=eligibilityFormulas.getWorksheet('Reparto formulado'),eligibilityDetail=eligibilityFormulas.getWorksheet('Desglose'),eligibilityParams=eligibilityFormulas.getWorksheet('Parámetros');
  assert.deepEqual([2,3,4].map(n=>eligibilityReparto.getCell(n,3).value),['Por verificar','No','Sí']);
  assert.deepEqual([2,3,4].map(n=>eligibilityDetail.getCell(n,8).value),['Por verificar','No','Sí']);
  assert.equal(eligibilityReparto.getCell('I2').value,'POR CONCILIAR');assert.equal(eligibilityReparto.getCell('I4').value.result,9);
  // ExcelJS omits a cached numeric zero when reading its object model; inspect
  // the actual workbook cell to prove that a known rejection still exports 0.
  const eligibilityXml=await(await JSZip.loadAsync(eligibilityFormulaFile.bytes)).file('xl/worksheets/sheet1.xml').async('string');
  assert.match(eligibilityXml,/<c r="I3"[^>]*>[\s\S]*?<v>0<\/v><\/c>/);
  assert(eligibilityReparto.getCell('I4').value.formula.includes('="Sí"'));assert(eligibilityParams.getCell('B12').value.formula.includes('"Sí"'));
  const includedBasis=[2,3,4].reduce((sum,n)=>sum+(eligibilityDetail.getCell(n,8).value==='Sí'?eligibilityDetail.getCell(n,9).value.result:0),0);
  assert.equal(includedBasis,eligibilityCalculation.base);assert.equal(eligibilityParams.getCell('B12').value.result,includedBasis);
  const actualExport=await exportSicofReport({kind:'reparto_formulado',calculation:actual,loans:engineLoans,ExcelJS}),actualBook=await load(actualExport.bytes);
  const detail=actualBook.getWorksheet('Desglose'),actualParams=actualBook.getWorksheet('Parámetros'),actualReparto=actualBook.getWorksheet('Reparto formulado');
  assert.equal(detail.rowCount,5);assert.equal(detail.getCell('F2').value,90);assert.equal(detail.getCell('F3').value,30);assert.equal(detail.getCell('F4').value,61);
  assert.equal(detail.getCell('D4').value,-50);assert.equal(detail.getCell('E4').value.result,150);assert.equal(detail.getCell('E4').value.formula,'ROUND(E3+D4,2)');
  assert.equal(detail.getCell('G4').value.result,9150);assert.equal(detail.getCell('I4').value.formula,'G4/181');
  assert.equal(actualReparto.getCell('D2').value.formula,'SUM(Desglose!I2:I4)');assert.equal(actualReparto.getCell('D2').value.result,24150/181);
  assert.equal(actualParams.getCell('B12').value.result,24150/181+100);assert.equal(actualParams.getCell('B2').value.result,10);assert.equal(actualParams.getCell('B4').value.result,4);
  assert.equal(actualParams.getCell('B13').value.formula,'IF(B12>0,B10,0)');assert.equal(actualParams.getCell('B13').value.result,actual.distributed);
  actual.rows.forEach((row,i)=>{assert.equal(actualReparto.getCell(i+2,9).value.result,row.rend);assert.equal(actualReparto.getCell(i+2,10).value.result,row.total);assert.equal(actualReparto.getCell(i+2,12).value.result,row.entregable);});
  const filteredBook=await load((await exportSicofReport({kind:'reparto_formulado',calculation:actual,loans:engineLoans,filters:{q:'0001'},ExcelJS})).bytes);
  assert.equal(filteredBook.getWorksheet('Reparto formulado').rowCount,3);assert.equal(filteredBook.getWorksheet('Desglose').rowCount,5);assert.equal(filteredBook.getWorksheet('Parámetros').getCell('B12').value.result,actual.base);
  const unknownSteps={...actual,rows:actual.rows.map((row,i)=>i?row:{...row,calculation_steps:[]})};
  const unknownBook=await load((await exportSicofReport({kind:'reparto_formulado',calculation:unknownSteps,loans:engineLoans,ExcelJS})).bytes);
  assert.equal(unknownBook.getWorksheet('Parámetros').getCell('B12').value,'POR CONCILIAR');assert.equal(unknownBook.getWorksheet('Reparto formulado').getCell('D2').value,'POR CONCILIAR');assert.equal(unknownBook.getWorksheet('Reparto formulado').getCell('I2').value,'POR CONCILIAR');
  const invalidSteps={...actual,rows:actual.rows.map((row,i)=>i?row:{...row,calculation_steps:row.calculation_steps.map((step,j)=>j?step:{...step,balance_days:999})})};
  await assert.rejects(()=>exportSicofReport({kind:'reparto_formulado',calculation:invalidSteps,loans:engineLoans,ExcelJS}),/SICOF_EXPORT_INTERVAL_MISMATCH/);
  const documentOf=async calc=>new TextDecoder().decode((await exportSicofReport({kind:'acta',calculation:calc,loans:engineLoans})).bytes);
  const actualHtml=await documentOf(actual);
  assert.equal(actual.liquidity.cash,99.5);assert.equal(actual.liquidity.portfolio,200);
  assert(actualHtml.includes('<td>Efectivo declarado después de costos pendientes</td><td>$99.50</td>'));assert(actualHtml.includes('<td>Fecha de situación de la cartera</td><td>2026-07-01</td>'));
  assert(actualHtml.includes('Depende de recuperar la cartera'));assert(actualHtml.includes('Cubierto con efectivo declarado'));assert(!actualHtml.includes('Cubierto con efectivo + cobranza garantizada'));
  for(const p of [10,25,50,100])assert(actualHtml.includes('Retiro del '+p+'%'));
  const noBank=calculateSicof(engineContext,engineLoans,{...options,bank:{amount:null}}),unknownHtml=await documentOf(noBank);
  assert(noBank.liquidity.scenarios.every(row=>row.status==='REVIEW'));assert(unknownHtml.includes('Información por conciliar'));assert(unknownHtml.includes('<td>Saldo bancario declarado</td><td>POR CONCILIAR</td>'));
  const short=calculateSicof(engineContext,{...engineLoans,loans:[]},{...options,bank:{amount:0,declaredBy:'Synthetic',date:'2026-06-30'}});
  assert(short.liquidity.scenarios.every(row=>row.status==='SHORTFALL'));assert((await documentOf(short)).includes('Respaldo insuficiente'));
  const allCash=calculateSicof(engineContext,engineLoans,{...options,bank:{amount:400,declaredBy:'Synthetic',date:'2026-06-30'}});
  assert(allCash.liquidity.scenarios.every(row=>row.status==='CASH_COVERED'));assert((await documentOf(allCash)).includes('<td>Efectivo declarado después de costos pendientes</td><td>$399.50</td>'));
  const noPortfolio=calculateSicof(engineContext,{...engineLoans,loans:[{...engineLoans.loans[0],paid:null,behavior:'REVIEW_REQUIRED'}]},options);
  assert.equal(noPortfolio.liquidity.portfolio,null);assert((await documentOf(noPortfolio)).includes('<td>Cartera actual por recuperar · Caja de Ahorro</td><td>POR CONCILIAR</td>'));
  await assert.rejects(()=>exportSicofReport({kind:'pagos',loans,filters:{from:'2026-02-30'},ExcelJS}),/SICOF_EXPORT_FILTER_INVALID/);
  const template=fs.readFileSync('C:/Users/david/Downloads/Reporte Final Ahorro JC (3 reglas) .xlsx'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  // Original download works without calculator, source availability or ExcelJS.
  file=await exportSicofReport({kind:'final_ahorro',filters:{historical:true},templateBytes:template});assert.equal(sha(file.bytes),sha(template));
  const original=await load(template),hist=original.worksheets[0],originalXml=await(await JSZip.loadAsync(template)).file('xl/worksheets/sheet1.xml').async('string');
  const v=(r,c)=>{const cell=hist.getCell(r,c),value=cell.value;if(value&&typeof value==='object'&&(value.formula||value.sharedFormula)){
    const match=originalXml.match(new RegExp('<c r="'+cell.address+'"[^>]*>([\\s\\S]*?)</c>'));return Number(match[1].match(/<v>([^<]*)<\/v>/)[1]);}return value;};
  const columns=Array.from({length:13},(_,i)=>({key:String.fromCharCode(65+i),label:v(2,i+1)}));
  const values=Object.fromEntries(Array.from({length:13},(_,i)=>[String.fromCharCode(65+i),v(3,i+1)]));values.A=String(values.A);
  const context={report:{columns,rows:[values],totals:{I:values.I,J:values.J,K:values.K,L:values.L,M:values.M}},participants:[{folio:values.A,name:'Isolated',composition:{periods:[{origin_key:'2026-S2',component:'CAPITAL',recognized:100,withdrawn:40,remaining:60,origin_state:'RECONCILED'}],movements:[{effective_date:'2026-10-03',type:'WITHDRAWAL',component:'CAPITAL',direction:'DEBIT',amount:40,origins:[{origin_key:'2026-S2',amount:40}]}]}}]};
  context.continuous_report={schema_version:'SICOF_CONTINUOUS_SAVINGS_V1',cutoff:'2026-10-03',periods:[{key:'2026-S2',year:2026,semester:2,capital_header:'2026 2DO SEMESTRE AHORRO',yield_header:'2026 REND. 2DO SEMESTRE'}],rows:[]};
  for(let r=3;r<=hist.rowCount;r++){if(v(r,1)==null||String(v(r,1))==='')continue;context.continuous_report.rows.push({folio:String(v(r,1)),name:v(r,2),source_row:r,historical_cells:Object.fromEntries(Array.from({length:13},(_,i)=>[String.fromCharCode(65+i),v(r,i+1)??null])),period_values:{'2026-S2':{capital:null,yield_amount:null,capital_state:'REVIEW_REQUIRED',yield_state:'REVIEW_REQUIRED'}},withdrawals:{},balances:{}});}
  file=await exportSicofReport({kind:'final_ahorro',context,templateBytes:template,ExcelJS});book=await load(file.bytes);
  const preserved=book.getWorksheet(hist.name);assert.equal(book.worksheets[0].name,'Informe acumulado');assert.equal(book.views[0].activeTab,0);
  for(let r=1;r<=hist.rowCount;r++)for(let c=1;c<=13;c++)assert.deepEqual(preserved.getCell(r,c).value,hist.getCell(r,c).value,'HISTORICAL_CELL_CHANGED');
  for(const row of context.continuous_report.rows)for(let c=1;c<=13;c++){assert.deepEqual(book.getWorksheet('Informe acumulado').getCell(row.source_row,c).value,row.historical_cells[String.fromCharCode(64+c)],'ACCUMULATED_HISTORY_CHANGED');assert.deepEqual(book.getWorksheet('Informe acumulado').getCell(row.source_row,c).style,hist.getCell(row.source_row,c).style,'ACCUMULATED_HISTORY_STYLE_CHANGED');}
  assert.deepEqual(book.getWorksheet('Informe vigente').getCell('D3').style,hist.getCell('D3').style);
  assert.equal(book.getWorksheet('Periodos').getCell('G2').value,60);assert.equal(book.getWorksheet('Movimientos').getCell('G2').value,40);assert(book.getWorksheet('Movimientos').getCell('I2').value.includes('2026-S2'));
  const changed={...context,report:{...context.report,rows:[{...values,D:999999}]}};
  await assert.rejects(()=>exportSicofReport({kind:'final_ahorro',context:changed,templateBytes:template,ExcelJS}),/SICOF_EXPORT_HISTORICAL_VALUES_CHANGED/);
  assert.equal(sha(fs.readFileSync('C:/Users/david/Downloads/Reporte Final Ahorro JC (3 reglas) .xlsx')),sha(template));
  console.log(JSON.stringify({status:'PASS',checks:['real ExcelJS XLSX read/write','CSV formula injection','HTML escaping','all filtered rows','unknown is not zero','eligibility Por verificar No Sí in CSV XLSX and formula detail','formula criteria match Sí and preserve known zero plus cent allocations','matrix duplicate ambiguity','formula costs/reserve/retention/cent conservation','Pagos source formulas and income reconciliation','Desglose interval formulas and actual engine weighted withdrawals','unknown or inconsistent basis is never inferred','global formula basis preserved with filtered participants','acta actual engine liquidity scenarios 10/25/50/100','cash-covered collection-dependent shortfall and unknown liquidity','acta bank declaration signature spaces and print','historical exact bytes offline','all original cells preserved','new report styles and separate period withdrawals','historical outcome mutation rejected'],historicalRows:hist.rowCount-3,externalWrites:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
