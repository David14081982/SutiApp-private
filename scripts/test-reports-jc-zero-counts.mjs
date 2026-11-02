// Isolated synthetic cases; never a production data source.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildReport,SHEETS} from '../supabase/functions/reports-jc/report.mjs';
import {TEMPLATE_BASE64} from '../supabase/functions/reports-jc/template.mjs';
const require=createRequire(import.meta.url),exporter=require('../app/reports-jc-export.js'),Zip=require('../app/vendor/jszip-3.10.1/jszip.min.js');
const rh=Array(26).fill('');Object.assign(rh,{0:'ID',1:'Número de control',3:'Proceso',4:'Fondo',9:'Fecha solicitud',24:'Estado',25:'Observaciones'});
const lh=['Fecha','Cuotas','ID','Folio','','Proceso','Fondo'];
// Expected Excel rows are explicit, independent of payrollCode/PAYROLL_ROWS.
const programs=[['Caja Chica',8,14],['Caja de Ahorro',9,13],['Sutiexpress',10,15],['15/01/2027 — Incentivos trimestrales',10,15],['Vales y membresias',11,16],['Descuentos SUTISSSTESON',6,6],['Seguro Colectivo Suti',17,17],['Suti Terrenos',18,18],['Panel Solar',18,18],['Suti Auto',18,18],['Suti Cirugias',18,18],['Suti Tours',19,19],['Suti Compras',20,20]];
const loans=[lh],expected={},savings={year:2026,events:[],issues:[],coverage:{status:'complete',synthetic:true}};
for(let m=1;m<=12;m++){
 const date='2026-'+String(m).padStart(2,'0')+'-15',cells=expected[m]=Object.fromEntries(Array.from({length:15},(_,i)=>['C'+(i+6),0]));
 for(const [fund,active,jub] of programs)for(const [process,row] of [['1',active],['3',active],['CONFIANZA',active],['JUB',jub]])for(const amount of [0,150]){
  loans.push([date,amount,'SYNTHETIC-'+loans.length,'TEST-CONTROL','',process,fund]);cells['C'+row]++;
 }
 for(const code of [573,580]){savings.events.push({id:'test:'+m+':'+code,kind:'payroll_discount',occurred_on:date,source_table:'synthetic',source_id:'test:'+m+':'+code,detail:{amount:25,payroll_code:code}});cells[code===573?'C7':'C12']++;}
}
const originalInput=JSON.stringify({loans,savings});
const report=buildReport({year:2026,requests:[rh],loans,savings,consultedAt:'2026-11-02T12:00:00Z'});
assert.equal(JSON.stringify({loans,savings}),originalInput,'reader must not mutate inputs');
assert.equal(report.issues.length,0);assert.equal(report.coverage.zeroInstallmentsIncluded,12*programs.length*4);assert.equal(report.coverage.zeroInstallmentsExcluded,0);
for(let m=1;m<=12;m++){
 const cells=report.sheets[SHEETS.discountMonth].months[m].cells;
 for(const [address,value] of Object.entries(expected[m])){assert.equal(cells[address].value,value,`${m}:${address}`);assert.equal(cells[address].sourceIds.length,value);}
 assert.equal(report.sheets[SHEETS.discount].cells['B'+(m+5)].value,programs.length*6+1);
 assert.equal(report.sheets[SHEETS.discount].cells['C'+(m+5)].value,programs.length*2+1);
 assert.match(cells.C8.rule,/cero/);assert.match(cells.C7.rule,/positivas.*Supabase/);
}
assert.equal(report.sheets[SHEETS.discount].cells.B18.value,12*(programs.length*6+1));
assert.equal(report.sheets[SHEETS.discount].cells.C18.value,12*(programs.length*2+1));
const specialRows=[['2025-12-30',0,'prior'],['2027-01-15',0,'next'],['2026-01-15',-1,'negative'],['2026-01-15',null,'null'],['2026-01-15','','blank'],['2026-01-15','0','text-zero'],['2026-02-30',0,'bad-date'],['2026-01-15',0,'good-zero']].map(([date,amount,id])=>[date,amount,id,'TEST','','1','Caja Chica']);
const special=buildReport({year:2026,requests:[rh],loans:[lh,...specialRows],savings:{...savings,events:[]}});
assert.equal(special.sheets[SHEETS.discountMonth].months[1].cells.C8.value,1);assert.equal(special.coverage.zeroInstallmentsIncluded,1);
assert.equal(special.issues.filter(i=>i.code==='INSTALLMENT_AMOUNT_INVALID').length,4);assert(special.issues.some(i=>i.code==='INSTALLMENT_DATE_INVALID'));
const savingsZero=buildReport({year:2026,requests:[rh],loans:[lh],savings:{...savings,events:[{...savings.events[0],detail:{amount:0,payroll_code:573}}]}});
assert.equal(savingsZero.sheets[SHEETS.discountMonth].months[1].cells.C7.value,0);assert(savingsZero.issues.some(i=>i.code==='SAVINGS_PAYROLL_UNRESOLVED'));
const original=await Zip.loadAsync(TEMPLATE_BASE64,{base64:true});let compared=0;
for(let m=1;m<=12;m++){
 const bytes=await exporter.buildWorkbook({report,year:2026,month:m,templateBase64:TEMPLATE_BASE64}),book=await Zip.loadAsync(bytes);
 assert.equal(((await book.file('xl/workbook.xml').async('string')).match(/<sheet\s/g)||[]).length,17);
 for(let n=9;n<=17;n++)assert.equal(await book.file('xl/worksheets/sheet'+n+'.xml').async('string'),await original.file('xl/worksheets/sheet'+n+'.xml').async('string'));
 assert.equal(await book.file('xl/styles.xml').async('string'),await original.file('xl/styles.xml').async('string'));
 for(const [sheetIndex,name] of [[3,SHEETS.discount],[4,SHEETS.discountMonth]]){
  const xml=await book.file('xl/worksheets/sheet'+sheetIndex+'.xml').async('string'),cells=sheetIndex===3?report.sheets[name].cells:report.sheets[name].months[m].cells;
  for(const [address,cell] of Object.entries(cells)){const match=xml.match(new RegExp('<c\\b[^>]*\\br="'+address+'"[^>]*>([\\s\\S]*?)</c>'));assert(match);assert.equal(Number(match[1].match(/<v>(.*?)<\/v>/)[1]),cell.value);compared++;}
 }
}
console.log(JSON.stringify({status:'PASS',months:12,programs:programs.length,processes:4,zeroRowsIncluded:report.coverage.zeroInstallmentsIncluded,workbooks:12,excelCellsCompared:compared,excludedSheetsAndStylesPreserved:true,savingsRulesUnchanged:true}));
