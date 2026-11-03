import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildCashFlow,cashFlowSourceBases} from '../supabase/functions/reports-jc/cash-flow.mjs';
import {consolidateCashFlow} from '../supabase/functions/reports-jc/cash-flow-consolidated.mjs';
const require=createRequire(import.meta.url),exporter=require('../app/cash-flow-export.js'),Zip=require('../app/vendor/jszip-3.10.1/jszip.min.js');
const header=Array(33).fill('');Object.assign(header,{0:'Fecha',1:'Cuotas',2:'ID',3:'Folio',6:'Fondo',8:'Plazo',9:'Cantidad Prestamo',10:'Total a pagar',18:'X',30:'Fecha Transferencia'});
const months=Array.from({length:12},(_,i)=>'2026-'+String(i+1).padStart(2,'0'));
const funds=['Caja de Ahorro','Caja Chica','Sutiexpress','30/11/2026 — Aguinaldos'];
function fixture(cutoff='2026-11-02T12:00:00Z'){
 const contracts=[],loans=[header];
 funds.forEach((fund,f)=>{const C='000'+f,D='001'+f;contracts.push({C,D,principal:1200000,interest:240000,administration:18000,total:1458000,tariff:1500,schedule:months.map((m,i)=>({S:i+1,amount:121500,adminUnits:1})),sourceVerified:true,evidence:{kind:'explicit_approved_snapshot'}});
 months.forEach((m,i)=>{const r=Array(33).fill('');Object.assign(r,{0:m+'-15',1:i===4?0:i===6?950:1215,2:C,3:D,4:'EXCLUDED PRIVATE NAME',6:fund,8:12,9:12000,10:14580,14:1215,18:i+1,30:'2025-12-01'});loans.push(r);});});
 const savings={source_bases:{history:[{id:'saving:1',date:'2026-10-15',amount:100}]},events:[],balances:months.map(month=>({month,amount:0,known_amount:0}))};
 const investors={contracts:[],movements:[],obligations:[],reviews:[],balances:months.map(month=>({month,amount:0,known_amount:0,unknown_count:0}))};
 const source={loans,requests:[['ID','Folio','Nombre'],['0000','0010','EXCLUDED PRIVATE NAME']]};
 const base=buildCashFlow({from:'2026-01',loans:[header],savings,consultedAt:cutoff});
 const report=consolidateCashFlow({base,loans,contracts,investorsSource:investors});
 report.sourceBases=cashFlowSourceBases(source,savings,investors,{snapshots:[]},{contracts,protectedLoans:[]},cutoff);
 return {report,source,savings,contracts};
}
test('every program and month preserves original B, including zeros, with all cutoffs',()=>{
 for(const cutoff of ['2025-12-31T12:00:00Z','2026-06-01T12:00:00Z','2026-11-02T12:00:00Z']){
 const {report,source}=fixture(cutoff);
 for(const [i,row]of source.loans.slice(1).entries()){
 const record=report.records.find(r=>r.id==='pv2:'+(i+2));assert(record,'Source row missing');
 assert.equal(record.amount,row[1]);assert.equal(record.registeredAmount,row[1]);assert.equal(record.date,row[0]);
 assert.equal(record.status,row[0]>report.asOf?'SCHEDULED':'RECORDED');
 }
 assert.equal(report.coverage.derivedForecastRows,0);
 }
});
test('requested group order and Caja resource name are shared by UI payload and export',async()=>{
 const {report}=fixture();assert.deepEqual([...new Set(report.rows.map(r=>r.group))].slice(0,6),['Inversores','Caja de Ahorro','Sutiexpress','Caja Chica','Adelantos de Nómina','Ahorro Voluntario']);
 assert(report.rows.some(r=>r.section==='Caja de Ahorro · Recurso de ahorradores'));
 const zip=await Zip.loadAsync((await exporter.build(report)).bytes),book=await zip.file('xl/workbook.xml').async('string'),main=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.equal((book.match(/<sheet /g)||[]).length,7);assert.doesNotMatch(book,/name="(?:Detalle|Notas)"/);assert.doesNotMatch(main,/Bolsas separadas/);assert.match(main,/ySplit="4"/);
 assert(main.indexOf('>Inversores<')<main.indexOf('>Ahorro Voluntario<'));assert.doesNotMatch(main,/No aplica|Sin determinar/);
 assert(!Object.keys(zip.files).some(n=>/comments|\.vml$/.test(n)));assert.doesNotMatch(main,/legacyDrawing/);
 for(let i=1;i<=7;i++)assert.doesNotMatch(await zip.file('xl/worksheets/sheet'+i+'.xml').async('string'),/<f[\s>]/);
});
test('bases preserve original source references and identifiers without unrelated private fields',async()=>{
 const {report,source,savings,contracts}=fixture(),before=JSON.stringify({source,savings,contracts});
 const pv2=report.sourceBases.tables[0];assert.equal(pv2.rows.length,48);assert.equal(pv2.rows[0][0],'pv2:2');assert.equal(pv2.rows[0][4],'0000');assert.equal(pv2.rows[0][5],'0010');assert.equal(report.sourceBases.tables[1].rows.length,1);assert(!JSON.stringify(report.sourceBases).includes('EXCLUDED PRIVATE NAME'));
 const contractBase=report.sourceBases.tables[4],type=contractBase.columns.indexOf('tipo'),c=contractBase.columns.indexOf('C'),d=contractBase.columns.indexOf('D'),keys=new Set(contractBase.rows.filter(r=>r[type]==='contrato_calculado').map(r=>JSON.stringify([r[c],r[d]])));
 for(const r of report.records.filter(r=>r.contractSourceKey))assert(keys.has(r.contractSourceKey),'Every compact link resolves to original contract evidence');
 const zip=await Zip.loadAsync((await exporter.build(report)).bytes);assert.match(await zip.file('xl/worksheets/sheet2.xml').async('string'),/>0000</);assert.match(await zip.file('xl/worksheets/sheet4.xml').async('string'),/saving:1/);
 assert.equal(JSON.stringify({source,savings,contracts}),before);
 await assert.rejects(exporter.build({...report,sourceBases:undefined}),/bases de origen completas/);
 await assert.rejects(exporter.build({...report,consultedAt:'2026-11-03T12:00:00Z'}),/bases de origen completas/);
});
