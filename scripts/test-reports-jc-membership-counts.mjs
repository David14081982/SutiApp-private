// Synthetic fixtures only: no source reads or financial writes.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {buildReport,SHEETS} from '../supabase/functions/reports-jc/report.mjs';import {TEMPLATE_BASE64} from '../supabase/functions/reports-jc/template.mjs';
const require=createRequire(import.meta.url),exporter=require('../app/reports-jc-export.js'),Zip=require('../app/vendor/jszip-3.10.1/jszip.min.js');
const head=Array(26).fill('');Object.assign(head,{0:'ID',1:'Número de control',3:'Proceso',4:'Fondo',9:'Fecha solicitud',24:'Estado',25:'Observaciones'});
const row=(id,date,state,provider='Costco',amount=0)=>{const r=Array(26).fill('');Object.assign(r,{0:id,1:'SYNTHETIC',3:'1',4:'Vales y membresias',7:amount,9:date,24:state,25:provider});return r;};
const build=rows=>buildReport({year:2026,requests:[head,...rows],loans:[['Fecha','Cuotas','ID','Folio','','Proceso','Fondo']],savings:{year:2026,events:[],issues:[],coverage:{status:'complete',synthetic:true}},consultedAt:'2026-11-02T20:00:00Z'});
const requests=[];for(let m=1;m<=12;m++)for(const [i,status] of ['Aprobado','Iniciado','Liquidado','Rechazado','Cancelado','Pendiente'].entries())requests.push(row(m+'-'+i,'2026-'+String(m).padStart(2,'0')+'-15',status));
const untouched=JSON.stringify(requests),report=build(requests);assert.equal(JSON.stringify(requests),untouched);
for(let m=1;m<=12;m++){for(const name of [SHEETS.membership,SHEETS.financing]){const c=report.sheets[name].cells;for(const [col,value]of [['B',3],['C',2],['D',3],['E',6]])assert.equal(c[col+(m+5)].value,value);assert.equal(c['E'+(m+5)].pendingCount,1);assert.equal(c['E'+(m+5)].sourceIds.length,6);}const c=report.sheets[SHEETS.membershipMonth].months[m].cells;assert.equal(c.E9.value,6);assert.equal(c.E18.value,6);assert.equal(c.E9.pendingCount,1);}
assert.equal(report.sheets[SHEETS.membership].cells.E18.value,72);assert.equal(report.sheets[SHEETS.membership].cells.D18.value,36);
const different=build([row('same','2026-06-15','Liquidado','Vales / Casa Ley'),row('same','2026-06-15','Liquidado','Vale de gasolina / Arco gasolinera')]);assert(!different.issues.some(i=>i.code==='REQUEST_IDENTITY_COLLISION'));assert.equal(different.sheets[SHEETS.membershipMonth].months[6].cells.B8.value,1);assert.equal(different.sheets[SHEETS.membershipMonth].months[6].cells.B7.value,1);
const same=build([row('same','2026-06-15','Liquidado','Costco'),row('same','2026-06-15','Liquidado','Solicitud de membresia / Costco')]);assert(same.issues.some(i=>i.code==='REQUEST_IDENTITY_COLLISION'));assert.equal(same.sheets[SHEETS.membership].cells.E11.value,2);
const unknown=build([row('unknown','2026-10-15','Misterioso')]);assert.equal(unknown.sheets[SHEETS.membership].cells.E15.value,1);assert.equal(unknown.sheets[SHEETS.membership].cells.E15.unknownCount,1);assert.equal(unknown.sheets[SHEETS.membership].cells.B15.value,0);assert(unknown.issues.some(i=>i.code==='REQUEST_STATUS_UNMAPPED'));
const noProvider=build([row('missing','2026-10-15','Pendiente','')]);assert.equal(noProvider.sheets[SHEETS.membership].cells.E15.value,1);assert(noProvider.issues.some(i=>i.code==='MEMBERSHIP_PROVIDER_MISSING'));
const original=await Zip.loadAsync(TEMPLATE_BASE64,{base64:true});let checks=0;
for(let m=1;m<=12;m++){const book=await Zip.loadAsync(await exporter.buildWorkbook({report,year:2026,month:m,templateBase64:TEMPLATE_BASE64}));assert.equal(((await book.file('xl/workbook.xml').async('string')).match(/<sheet\s/g)||[]).length,17);
 for(let i=9;i<=17;i++)assert.equal(await book.file('xl/worksheets/sheet'+i+'.xml').async('string'),await original.file('xl/worksheets/sheet'+i+'.xml').async('string'));
 assert.equal(await book.file('xl/styles.xml').async('string'),await original.file('xl/styles.xml').async('string'));
 for(const [n,name]of [[5,SHEETS.membership],[6,SHEETS.membershipMonth],[7,SHEETS.financing]]){const xml=await book.file('xl/worksheets/sheet'+n+'.xml').async('string'),cells=n===6?report.sheets[name].months[m].cells:report.sheets[name].cells;
  for(const [address,c]of Object.entries(cells)){if(typeof c.value!=='number')continue;const node=xml.match(new RegExp('<c\\b[^>]*\\br="'+address+'"[^>]*>([\\s\\S]*?)</c>'));assert(node);assert.equal(Number(node[1].match(/<v>(.*?)<\/v>/)[1]),c.value);checks++;}
  if(n===6){assert(xml.includes('<f>SUM(B9:C9)+1</f>'));assert(xml.includes('<f>SUM(B18:C18)+1</f>'));}else assert(xml.includes('<f>SUM(B18:C18)+12</f>'));
 }
}
for(const malformed of [-1,0.5,'1',null,undefined]){const bad=structuredClone(report);bad.sheets[SHEETS.membership].cells.E6.pendingCount=malformed;await assert.rejects(()=>exporter.buildWorkbook({report:bad,year:2026,month:1,templateBase64:TEMPLATE_BASE64}));}
const mismatch=structuredClone(report);mismatch.sheets[SHEETS.membership].cells.E6.value=5;await assert.rejects(()=>exporter.buildWorkbook({report:mismatch,year:2026,month:1,templateBase64:TEMPLATE_BASE64}));
console.log(JSON.stringify({status:'PASS',months:12,received:72,pending:12,depositsUnchanged:36,zeroAmountsCounted:true,providerCollisionScoped:true,realCollisionsPreserved:true,unknownNotApproved:true,books:12,excelCells:checks,stylesAndExcludedSheetsPreserved:true}));
