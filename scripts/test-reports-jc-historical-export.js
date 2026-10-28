'use strict';
// Full report/export contract for historical completion; synthetic events only.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url'),JSZip=require('../app/vendor/jszip-3.10.1/jszip.min.js'),exporter=require('../app/reports-jc-export.js');
async function main(){
 const root=path.resolve(__dirname,'..'),{buildReport}=await import(pathToFileURL(path.join(root,'supabase/functions/reports-jc/report.mjs')).href),{TEMPLATE_BASE64}=await import(pathToFileURL(path.join(root,'supabase/functions/reports-jc/template.mjs')).href);
 const headers=Array(26).fill('');Object.assign(headers,{0:'ID',1:'Número de control',3:'Proceso',4:'Fondo',9:'Fecha solicitud',24:'Estado',25:'Observaciones'});
 const refund={id:'refund:test-case',kind:'refund_paid',occurred_on:'2025-03-20',source_table:'savings_refunds_private.cases',source_id:'test-case',numero_control:'TEST-001',detail:{amount:800,payroll_code:580,origin:'HISTORICAL'}};
 const termination={id:'termination-attested:test-source',kind:'cancellation',occurred_on:'2025-02-28',source_table:'savings_refunds_private.termination_versions',source_id:'test-source',numero_control:'TEST-001',detail:{version:1,historical:true,evidence_reference:'SYNTHETIC'}};
 const build=(events,issues=[])=>buildReport({year:2025,requests:[headers],loans:[['Fecha','Cuotas','ID','Folio','','Proceso','Fondo']],savings:{year:2025,events,issues,coverage:{synthetic:true}},consultedAt:'2026-10-27T20:00:00Z'});
 const options=report=>({report,year:2025,month:10,templateBase64:TEMPLATE_BASE64});
 const pending=build([refund],[{code:'HISTORICAL_TERMINATION_UNMAPPED',severity:'blocking',months:[2],sourceIds:['test-source'],count:1},{code:'REFUND_PERIOD_UNCONFIRMED',severity:'blocking',scope:'refund',months:[3]}]);
 assert.equal(pending.sheets['Caja de Ahorro Voluntario'].cells.G5.value,null);assert.equal(pending.sheets['Caja de Ahorro Voluntario'].cells.E6.value,null);
 await assert.rejects(exporter.buildWorkbook(options(pending)),/incidencias pendientes/);await assert.rejects(exporter.buildYearZip(options(pending)),/incidencias pendientes/);
 const complete=build([refund,termination]);
 assert.equal(complete.sheets['Caja de Ahorro Voluntario'].cells.E6.value,1);assert.equal(complete.sheets['Caja de Ahorro Voluntario'].cells.G5.value,1);assert.equal(complete.sheets['DtosViaNomina Concentrado'].cells.D8.value,1);assert.equal(complete.sheets['DtosViaNomina Mes'].months[3].cells.D12.value,1);assert.equal(complete.sheets['DtosViaNomina Mes'].months[3].cells.D7.value,0);
 const monthly=await exporter.buildWorkbook(options(complete)),year=await exporter.buildYearZip(options(complete)),original=await JSZip.loadAsync(TEMPLATE_BASE64,{base64:true}),output=await JSZip.loadAsync(monthly),annual=await JSZip.loadAsync(year);
 assert.equal(Object.keys(annual.files).filter(p=>p.endsWith('.xlsx')).length,12);
 for(const name of Object.keys(original.files))if(!/^xl\/worksheets\/sheet[1-8]\.xml$/.test(name))assert.deepEqual(Buffer.from(await output.file(name).async('uint8array')),Buffer.from(await original.file(name).async('uint8array')),name);
 const moved=build([{...refund,occurred_on:'2025-04-02'},termination]);assert.equal(moved.sheets['Caja de Ahorro Voluntario'].cells.E6.value,0);assert.equal(moved.sheets['Caja de Ahorro Voluntario'].cells.E7.value,1);assert.equal(moved.sheets['Caja de Ahorro Voluntario'].cells.E16.value,1);
 const partial=build([termination]);assert.equal(partial.sheets['Caja de Ahorro Voluntario'].cells.E16.value,0);
 const result={status:'PASS',unknownRemainsNull:true,annualBlockerBlocksOtherMonth:true,resolvedExportCountNotAmount:true,retiredPayroll580:true,correctionMovesOneCase:true,partialCaseNotCountedAsCompleted:true,originalPackageAndExcludedSheetsPreserved:true,annualBooks:12,workbooksPersisted:false,syntheticOnly:true};
 fs.mkdirSync(path.join(root,'.tmp/reports-jc/historical'),{recursive:true});fs.writeFileSync(path.join(root,'.tmp/reports-jc/historical/export.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
