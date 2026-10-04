'use strict';
// Synthetic validated source -> actual ExcelJS XLSX round-trip. No network.
const assert=require('assert/strict');
const ExcelJS=require('../.tmp/sicof/deps/node_modules/exceljs');
const JSZip=require('../.tmp/sicof/deps/node_modules/jszip');
(async()=>{
  const {exportSicofReport}=await import('../supabase/functions/sicof/exports.mjs');
  const {SICOF_FIELDS,SICOF_COLUMNS}=await import('../supabase/functions/sicof/loan-source.mjs');
  const headers=['Fecha','Cuotas','ID','Folio','Nombre','Proceso','Fondo','tasa Qnal %','Plazo','Cantidad Prestamo','Total a pagar','Inicio de Descuento Quincenal','Monto Total Interes','Interes x #Plazo','Descuento Quincenal','Fecha final de pago','# de pagos','Finaliza el pago','Ha pagado HOY','Debería tener pagado HOY','Estatus del prestamo','MONTO PAGADO','Gasto Admon','TGA','Total Intereses a Pagar','Monto capital + Interes','Capital','Fecha Transferencia','Fecha descuento','Fecha de solicitud'];
  const row=(source_row,patch={})=>({source_row,...Object.fromEntries(SICOF_FIELDS.map(field=>[field,null])),
    date:'2026-07-15',paid:1234.56789,loan_id:'000'+source_row,folio:'00123',name:'Synthetic '+source_row,process:'1',fund:'Caja de Ahorro',rate:.03456789,term:12,principal:10000,total_due:15123.4567,discount_start:'2026-01-15',loan_charges:5123.4567,scheduled_charges:333.33333333,expected:876.54321,...patch});
  const rows=Array.from({length:605},(_,i)=>row(i+2));
  rows.push(row(607,{fund:'Extra',folio:'123',date:'2026-07-01',loan_charges:765.432109}),
    row(608,{date:'2025-01-15',paid:0,expected:0}),
    row(609,{date:'2027-04-30',paid:0,loan_charges:0,scheduled_charges:0}),
    row(610,{fund:'Extra',date:'2028-01-15',paid:null}),
    row(611,{fund:'Outside',date:'2020-01-15'}),
    row(612,{date:'2026-09-15',paid:'CAPTURA INCORRECTA',name:'=HYPERLINK("synthetic")',process:false,rate:null,term:0,principal:null,total_due:'',loan_charges:'=1+1',scheduled_charges:false,expected:null}),
    row(613,{fund:null,date:'no es una fecha',name:'+SUM(1,1)'}),
    row(614,{fund:'',name:'@synthetic',loan_charges:-.00001}),
    row(615,{date:'2026-07-01'}),row(616,{date:'2026-12-31'}),
    row(617,{date:'2026-06-30'}),row(618,{date:'2027-01-01'}),
    row(619,{date:null}),row(620,{date:''}),row(621,{date:'2026-09-31'}),
    row(622,{date:'2026-11-15'}),row(623,{date:'2026-12-31',fund:'Extra'}),
    row(624,{date:'2026-07-01',fund:'Outside'}));
  const source={source:'synthetic:HISTORIAL P V2',headers,columns:[...SICOF_COLUMNS],rows,source_fingerprint:'a'.repeat(64)};
  // Deliberately different derived values and missing historical rows: the new
  // export must use the source, not rebuild A:O from reconciled projections.
  const loans={source_fingerprint:source.source_fingerprint,payments:[{source_row:2,interest:1,projected_interest:2,fee:3}],loans:[],issues:[{source_row:612,code:'REVIEW_REQUIRED'}]};
  const settings={src:'caja',selFunds:[],pay:98,periodIni:'2026-07-01',periodFin:'2026-12-31'};
  const calculation={settings,rows:[],fingerprint:'b'.repeat(64)};
  const options={kind:'base_calculo',source,loans,calculation,ExcelJS};
  const load=async bytes=>{const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);return book;};
  const scenarios=[];
  for(const src of ['caja','sel','todos']){
    const current={...calculation,settings:{...settings,src,selFunds:src==='sel'?['Extra','Caja de Ahorro','Extra']:[]}};
    const inputs={source,loans,calculation:current},before=JSON.stringify(inputs);
    const file=await exportSicofReport({...options,calculation:current}),book=await load(file.bytes);
    assert.equal(JSON.stringify(inputs),before,'no source/calculation/analysis mutation');
    assert.equal(file.filename,'SICOF_base_calculo.xlsx');assert.equal(book.worksheets.length,1,'exactly one sheet');
    const sheet=book.worksheets[0];assert.equal(sheet.name,'HISTORIAL P V2');assert.equal(sheet.columnCount,15,'exactly A:O');
    const accepted=src==='caja'?['Caja de Ahorro']:src==='sel'?['Caja de Ahorro','Extra']:null;
    // Independently enumerated qualifying IDs; do not repeat the date predicate.
    const includedIds=[...Array.from({length:605},(_,i)=>i+2),612,615,616,622,
      ...(src!=='caja'?[607,623]:[]),...(src==='todos'?[614,624]:[])];
    const selected=rows.filter(r=>includedIds.includes(r.source_row));
    assert(selected.every(r=>!accepted||accepted.includes(r.fund)));
    assert.equal(sheet.rowCount,selected.length+1);assert(selected.length>600);
    assert.deepEqual(sheet.getRow(1).values.slice(1,16),headers.slice(0,15));
    for(let i=0;i<selected.length;i++)for(let c=0;c<15;c++)assert.deepEqual(sheet.getCell(i+2,c+1).value,selected[i][SICOF_FIELDS[c]],'row '+selected[i].source_row+' column '+SICOF_COLUMNS[c]);
    assert.equal(sheet.getCell('D2').value,'00123');assert.equal(sheet.getCell('H2').value,.03456789);assert.equal(sheet.getCell('M2').value,5123.4567);assert.equal(sheet.getCell('N2').value,333.33333333);
    const dates=sheet.getColumn(1).values.slice(2);
    assert(dates.includes('2026-07-01'));assert(dates.includes('2026-12-31'));assert(dates.includes('2026-11-15'),'future inside cutoff remains included');
    for(const date of ['2025-01-15','2027-04-30','2026-06-30','2027-01-01','2026-09-31','no es una fecha'])assert(!dates.includes(date),'excluded '+date);
    const errorRow=selected.findIndex(r=>r.source_row===612)+2;
    assert.equal(sheet.getCell(errorRow,1).value,'2026-09-15');assert.equal(sheet.getCell(errorRow,2).value,'CAPTURA INCORRECTA');assert.equal(sheet.getCell(errorRow,5).value,'=HYPERLINK("synthetic")');assert.equal(sheet.getCell(errorRow,6).value,false);assert.equal(sheet.getCell(errorRow,11).value,'');assert.equal(sheet.getCell(errorRow,13).value,'=1+1');assert.equal(sheet.getCell(errorRow,14).value,false);
    const zip=await JSZip.loadAsync(file.bytes),xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert(!/<f(?:\s|>)/.test(xml),'source strings are not executable formulas');
    assert.equal(Object.keys(zip.files).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name)).length,1);assert(!zip.file('xl/worksheets/sheet2.xml'));
    scenarios.push({source:src,sourceRows:selected.length,sheets:1,columns:15});
  }
  for(const filters of [{fund:'Outside'},{search:'00123'},{from:'2026-09-01'},{to:'2026-12-31'},{year:2026},{folio:'00123'},{format:'csv'},{unknown:'value'}])await assert.rejects(()=>exportSicofReport({...options,filters}),/SICOF_EXPORT_FILTER_INVALID/);
  // No analyzed-data fallback, even when financial analysis is otherwise valid.
  for(const bad of [undefined,{...source,rows:undefined},{...source,headers:undefined},{...source,headers:headers.slice(0,14)},{...source,columns:undefined},{...source,columns:['B',...source.columns.slice(1)]},{...source,source_fingerprint:null},{...source,rows:[{source_row:2,fund:'Caja de Ahorro',date:'2026-07-15'}]},{...source,rows:[row(2,{loan_charges:{formula:'1+1'}})]},{...source,rows:[row(2,{paid:Infinity})]}])await assert.rejects(()=>exportSicofReport({...options,source:bad}),/SICOF_EXPORT_RAW_SOURCE_REQUIRED/);
  await assert.rejects(()=>exportSicofReport({...options,source:{...source,source_fingerprint:'c'.repeat(64)}}),/SICOF_EXPORT_SOURCE_MISMATCH/);
  await assert.rejects(()=>exportSicofReport({...options,loans:{...loans,source_fingerprint:undefined}}),/SICOF_EXPORT_SOURCE_MISMATCH/);
  await assert.rejects(()=>exportSicofReport({...options,calculation:{settings:{src:'other'}}}),/SICOF_EXPORT_CALCULATION_REQUIRED/);
  await assert.rejects(()=>exportSicofReport({...options,calculation:{settings:{src:'sel',selFunds:'Extra'}}}),/SICOF_EXPORT_CALCULATION_REQUIRED/);
  const empty=await load((await exportSicofReport({...options,source:{...source,rows:[]}})).bytes);assert.equal(empty.worksheets.length,1);assert.equal(empty.worksheets[0].rowCount,1);assert.equal(empty.worksheets[0].columnCount,15);
  const noSelected=await load((await exportSicofReport({...options,source:{...source,rows:[row(2,{fund:'Outside'})]}})).bytes);assert.equal(noSelected.worksheets[0].rowCount,1);
  for(const period of [{periodIni:null},{periodFin:undefined},{periodIni:'2026-02-30'},{periodFin:'2026-13-01'},{periodIni:'2027-01-01'},{periodIni:'2026-7-1'}])await assert.rejects(()=>exportSicofReport({...options,calculation:{...calculation,settings:{...settings,...period}}}),/SICOF_EXPORT_PERIOD_INVALID/);
  for(const [start,end,expectedIds] of [
    ['2026-07-01','2026-07-01',[615]],
    ['2026-12-31','2026-12-31',[616]],
    ['2026-12-31','2027-01-01',[616,618]],
    ['2025-01-01','2025-06-30',[608]],
    ['2027-01-01','2027-06-30',[609,618]],
    ['2020-01-01','2020-06-30',[]]
  ]){
    const alternate=await load((await exportSicofReport({...options,calculation:{...calculation,settings:{...settings,pay:1,periodIni:start,periodFin:end}}})).bytes);
    assert.deepEqual(alternate.worksheets[0].getColumn(3).values.slice(2),expectedIds.map(id=>'000'+id),'applied interval '+start+'..'+end);
  }
  // Bounded selected-period stress, not a guarantee about the Edge memory quota.
  const largeRows=Array.from({length:18000},(_,i)=>row(i+2,{folio:String(i).padStart(8,'0'),fund:i%2?'Caja de Ahorro':'Extra',date:i%2?'2026-07-01':'2026-12-31'}));
  largeRows.push(row(18002,{date:'2025-01-15'}),row(18003,{date:'2027-04-30'}));
  const started=performance.now(),large=await exportSicofReport({...options,source:{...source,rows:largeRows},calculation:{...calculation,settings:{...settings,src:'todos'}}});
  const writeMs=performance.now()-started,largeBook=await load(large.bytes),largeSheet=largeBook.worksheets[0];
  assert.equal(largeBook.worksheets.length,1);assert.equal(largeSheet.rowCount,18001);assert.equal(largeSheet.columnCount,15);assert.equal(largeSheet.getCell('D18001').value,'00017999');assert.equal(largeSheet.getCell('N18001').value,333.33333333);
  console.log(JSON.stringify({status:'PASS',scenarios,largeFixture:{sourceRows:18002,exportedRows:18000,xlsxBytes:large.bytes.length,writeMs,nodePeakRssKiB:process.resourceUsage().maxRSS,edgeQuotaVerified:false},checks:['exact one HISTORIAL P V2 sheet A:O','original header order and typed scalar values','inclusive July 1 and December 31 boundaries for all fund modes','2025 and 2027-04-30 excluded from 2026 S2','invalid or missing dates excluded; in-period financial errors preserved','future dates inside cutoff included','applied single-day, prior-year and cross-year intervals','missing invalid and reversed periods rejected','605+ rows without UI limits','Caja plus additional selected funds and all including blank funds','raw M/N and fractional rates unchanged','null zero false empty text leading zeros preserved','formula-looking source strings remain text','no source mutation or analyzed reconstruction','source fingerprint required and mismatch rejected','presentation filters rejected','empty selection retains header only'],externalQueries:0,financialWrites:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
