'use strict';
// Synthetic in-memory XLSX round trips. No Google, Supabase, browser storage or files of report data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const ExcelJS=require('../app/vendor/exceljs-4.4.0/exceljs.min.js');
const sourceCode=fs.readFileSync(path.join(__dirname,'../app/sutifinanzas-repository.js'),'utf8');
const window={};vm.runInNewContext(sourceCode,{window,Intl,Date,URL,setTimeout,clearTimeout});
const Model=window.SutifinanzasModel,Export=window.SutifinanzasExport;
const synthetic=(id,patch={})=>({id,requisitionId:'req-'+id,requisition:'REQ '+id,secretariat:'Secretaría A',expenseType:'Operación',project:'Proyecto X',item:'Partida',concept:'Producto '+id,amount:0,date:'2026-01-20',year:2026,status:'APROBADO',payment:'Transferencia',...patch});
const records=[
  synthetic('1',{amount:100.004,concept:'=HYPERLINK("https://invalid.example","texto")'}),
  synthetic('2',{amount:50.004,date:'2026-02-20',concept:'@SUM(A1:A2)'}),
  synthetic('3',{amount:-2.125,project:'Proyecto Y',concept:'PRODUCTO OCULTO A'}),
  synthetic('4',{amount:30,secretariat:'Secretaría B',project:'PROYECTO OCULTO B',concept:'PRODUCTO OCULTO B',date:'2024-01-01',year:2025}),
  synthetic('5',{amount:1,secretariat:null,expenseType:null,project:null,item:null,requisitionId:null,requisition:null,date:null,year:null,concept:'PRODUCTO OCULTO SIN SECRETARÍA'})
];
const context={ExcelJS,filters:{year:'all',status:'APROBADO',month:'all',search:'=2+2'},sort:'name',columnField:'month',source:{name:'Google Sheets',sheet:'Gasto por secretaría',consultedAt:'2026-10-04T10:00:00Z'},exportedAt:new Date('2026-10-04T11:00:00Z')};
const close=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-10,message||`${actual} != ${expected}`);
const walk=nodes=>nodes.flatMap(node=>[node,...walk(node.children)]);
function values(sheet){const values=[];sheet.eachRow(row=>row.eachCell(cell=>{if(!cell.isMerged||cell.master===cell)values.push(cell.value);}));return values;}
async function roundtrip(overrides={}){
  const settings={...context,...overrides},book=Export.buildWorkbook(settings),bytes=await book.xlsx.writeBuffer(),readback=new ExcelJS.Workbook();
  assert(bytes.byteLength>1000);await readback.xlsx.load(bytes);assert.equal(readback.worksheets.length,1);const sheet=readback.getWorksheet('Gasto por Secretaría');assert(sheet);assert.equal(sheet.state,'visible');
  sheet.eachRow(row=>{assert.equal(row.hidden,false);row.eachCell(cell=>assert.equal(cell.formula,undefined,'source labels never become formulas'));});
  assert.equal(readback.creator,'SutiApp');assert.equal(sheet.getCell('A1').font.name,'Nunito');
  assert.equal(sheet.views[0].state,'frozen');assert.equal(sheet.views[0].xSplit,settings.dimensions.length||1);assert.equal(sheet.views[0].ySplit,11);
  return sheet;
}
async function loaderTests(){
  const state={scripts:[],timers:[]},browser={};
  const document={baseURI:'https://sutiapp.example/subpath/SutiApp.html',createElement:()=>({remove(){this.removed=true;}}),head:{appendChild(script){state.scripts.push(script);}}};
  vm.runInNewContext(sourceCode,{window:browser,document,URL,Intl,Date,setTimeout:callback=>{state.timers.push(callback);return state.timers.length;},clearTimeout:()=>{}});
  const first=browser.SutifinanzasExport.excel(),concurrent=browser.SutifinanzasExport.excel();assert.equal(first,concurrent);assert.equal(state.scripts.length,1);
  const script=state.scripts[0];assert.equal(script.src,'https://sutiapp.example/subpath/app/vendor/exceljs-4.4.0/exceljs.min.js');assert.equal(script.crossOrigin,'anonymous');
  // Windows checkouts may use CRLF; the Pages build publishes normalized LF vendor bytes for SRI.
  const publishedVendor=fs.readFileSync(path.join(__dirname,'../app/vendor/exceljs-4.4.0/exceljs.min.js'),'utf8').replace(/\r\n/g,'\n');
  const hash=crypto.createHash('sha384').update(publishedVendor).digest('base64');assert.equal(script.integrity,'sha384-'+hash);
  script.onerror();await assert.rejects(first,/SUTIFINANZAS_EXCEL_UNAVAILABLE/);assert.equal(script.removed,true);
  const timeout=browser.SutifinanzasExport.excel();state.timers.at(-1)();await assert.rejects(timeout,/SUTIFINANZAS_EXCEL_TIMEOUT/);assert.equal(state.scripts.at(-1).removed,true);
  const absent=browser.SutifinanzasExport.excel();state.scripts.at(-1).onload();await assert.rejects(absent,/SUTIFINANZAS_EXCEL_UNAVAILABLE/);
  const success=browser.SutifinanzasExport.excel();browser.ExcelJS=ExcelJS;state.scripts.at(-1).onload();assert.equal(await success,ExcelJS);
  const scriptsBefore=state.scripts.length;assert.equal(await browser.SutifinanzasExport.excel(),ExcelJS);assert.equal(state.scripts.length,scriptsBefore,'loaded vendor is reused without any network request');
}
async function main(){
  const dimensions=['secretariat','project','product'],pivot=Model.pivot(records,dimensions,{sort:'name',columnField:'month'});
  const a=pivot.roots.find(node=>node.key==='Secretaría A'),b=pivot.roots.find(node=>node.key==='Secretaría B'),x=a.children.find(node=>node.key==='Proyecto X');
  const expanded=new Set([a.id,x.id,b.children[0].id]); // Hidden descendant state must not open its collapsed ancestor.
  const before=JSON.stringify(pivot),visible=Model.visibleRows(pivot,dimensions,expanded);
  assert.deepEqual(Array.from(visible,row=>[row.node.key,row.subtotal]),[['2',false],['1',false],['Proyecto X',true],['Proyecto Y',false],['Secretaría A',true],['Secretaría B',false],[null,false]]);
  assert.equal(visible[0].cells[0].rowSpan,5);assert.equal(visible[0].cells[1].rowSpan,3);assert.equal(visible[3].cells[0].colSpan,2);
  const sheet=await roundtrip({pivot,dimensions,expanded});
  assert.equal(sheet.rowCount,19);assert.equal(sheet.columnCount,8);
  assert.deepEqual(sheet.model.merges.filter(range=>Number(range.match(/\d+/)[0])>=12),['A12:A16','B12:B14','B15:C15','B16:C16','A17:C17','A18:C18','A19:C19']);
  assert.equal(sheet.getCell('A12').value,'Secretaría A');assert.equal(sheet.getCell('B12').value,'Proyecto X');assert.equal(sheet.getCell('C13').value,records[0].concept);
  assert.equal(sheet.getCell('C12').type,ExcelJS.ValueType.String);assert.equal(sheet.getCell('C13').type,ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('A5').type,ExcelJS.ValueType.String);assert.match(sheet.getCell('A5').value,/Buscar: =2\+2/);
  assert.match(sheet.getCell('A3').value,/2026-10-04T10:00:00.000Z/);assert.match(sheet.getCell('A4').value,/2026-10-04T11:00:00.000Z/);
  assert.equal(sheet.getCell('C14').value,'Subtotal · Proyecto X');assert.equal(sheet.getCell('B16').value,'Subtotal · Secretaría A');assert.equal(sheet.getCell('A18').value,'Sin secretaría');
  assert.equal(sheet.getCell('D11').value,'Enero 2024');assert.equal(sheet.getCell('G11').value,'Sin fecha');
  close(sheet.getCell('E13').value,100.004);close(sheet.getCell('F12').value,50.004);close(sheet.getCell('H14').value,150.008);close(sheet.getCell('H16').value,147.883);
  close(sheet.getCell('H19').value,178.883);assert.equal(sheet.getCell('H19').type,ExcelJS.ValueType.Number);assert.equal(sheet.getCell('H19').numFmt,'"$"#,##0.00;[Red]-"$"#,##0.00');
  const written=values(sheet).join('\n');assert(!written.includes('PRODUCTO OCULTO'));assert(!written.includes('PROYECTO OCULTO B'));assert.equal(JSON.stringify(pivot),before,'projection and export do not mutate pivot data');
  const collapsed=await roundtrip({pivot,dimensions,expanded:new Set()});assert.equal(collapsed.rowCount,15);assert.equal(collapsed.getCell('A12').value,'Secretaría A');assert.equal(collapsed.getCell('A13').value,'Secretaría B');assert.equal(collapsed.getCell('A14').value,'Sin secretaría');assert(!values(collapsed).join('\n').includes('Proyecto X'));close(collapsed.getCell('H15').value,178.883);
  for(const columnField of ['month','year','none']){
    const order=['product','expenseType','secretariat'],reordered=Model.pivot(records,order,{sort:'amount-asc',columnField}),all=new Set(walk(reordered.roots).map(node=>node.id));
    const result=await roundtrip({pivot:reordered,dimensions:order,expanded:all,columnField,sort:'amount-asc'});
    assert.equal(result.getCell('A10').value,'Producto');assert.equal(result.getCell('B10').value,'Tipo de gastos');assert.equal(result.getCell('C10').value,'Secretaría');assert.equal(result.getCell('A12').value,'PRODUCTO OCULTO A','sorting is preserved');
    const total=result.getRow(result.rowCount);close(total.getCell(result.columnCount).value,178.883);
    assert.equal(result.rowCount,27,'five visible leaves plus ten ancestor subtotals and grand total');
    if(columnField==='year'){assert.equal(result.getCell('D11').value,'2025');assert.equal(result.getCell('E11').value,'2026');assert.equal(result.getCell('F11').value,'Sin año');close(total.getCell(4).value,30);close(total.getCell(5).value,147.883);close(total.getCell(6).value,1);}
    if(columnField==='none')assert.equal(result.columnCount,4);
  }
  for(const columnField of ['month','year','none']){
    const ungrouped=Model.pivot(records,[],{columnField}),totalOnly=await roundtrip({pivot:ungrouped,dimensions:[],expanded:new Set(),columnField});
    assert.equal(totalOnly.rowCount,12);assert.equal(totalOnly.getCell('A10').value,'Gasto filtrado');assert.equal(totalOnly.getCell('A12').value,'Total general · 5 registros');close(totalOnly.getCell(12,totalOnly.columnCount).value,178.883);assert(!values(totalOnly).join('\n').includes('PRODUCTO OCULTO'));
  }
  const empty=Model.pivot([],dimensions),emptySheet=await roundtrip({pivot:empty,dimensions,expanded:new Set()});assert.equal(emptySheet.rowCount,13);assert.equal(emptySheet.getCell('A12').value,'No hay registros para estos filtros.');assert.equal(emptySheet.getCell('D13').value,0);
  const same=records.slice(0,2).map(record=>({...record,concept:'Mismo producto'})),samePivot=Model.pivot(same,['product']);
  const duplicateLabels=await roundtrip({pivot:samePivot,dimensions:['product'],expanded:new Set()});assert.equal(duplicateLabels.getCell('A12').value,'Mismo producto');assert.equal(duplicateLabels.getCell('A13').value,'Mismo producto');close(duplicateLabels.getCell(14,duplicateLabels.columnCount).value,150.008);
  const allDimensions=Array.from(Model.fields,field=>field.key),deep=Model.pivot([records[0]],allDimensions),deepSheet=await roundtrip({pivot:deep,dimensions:allDimensions,expanded:new Set(walk(deep.roots).map(node=>node.id))});assert.equal(deepSheet.rowCount,21);assert.equal(deepSheet.getCell('A12').master.address,'A12');assert.equal(deepSheet.getCell('A20').master.address,'A12');assert.equal(deepSheet.getCell('I20').master.address,'B20');close(deepSheet.getCell(21,deepSheet.columnCount).value,100.004);
  const longLabel='Descripción extensa del producto y sus características. '.repeat(7),longPivot=Model.pivot([synthetic('long',{concept:longLabel})],['product']);
  const readable=await roundtrip({pivot:longPivot,dimensions:['product'],expanded:new Set()});assert.equal(readable.getCell('A12').value,longLabel);assert(readable.getRow(12).height>100&&readable.getRow(12).height<=409,'long labels get a readable wrapped row height within Excel limits');
  assert.throws(()=>Export.buildWorkbook({...context,ExcelJS:null,pivot,dimensions,expanded}),/SUTIFINANZAS_EXCEL_UNAVAILABLE/);
  await loaderTests();console.log('PASS sutifinanzas export: actual XLSX roundtrip, exact visible branches/merges, all period modes, reorder, zero dimensions/empty, numeric fractional cents, formula-safe text, loader integrity/failure/timeout/retry.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
