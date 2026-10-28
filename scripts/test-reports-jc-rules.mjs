// Synthetic fixtures only. No Google or Supabase access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateKeyPairSync} from 'node:crypto';
import {READER_EMAIL,READER_PROJECT,READER_SECRET} from '../supabase/functions/reports-jc/google-auth.mjs';
import {buildReport,loadReport,readGoogle,sourceDate,fundGroup,payrollCode,membershipRow,WORKBOOK,GOOGLE_RANGES,SHEETS} from '../supabase/functions/reports-jc/report.mjs';
const requestHeader=Array(26).fill('');Object.assign(requestHeader,{0:'ID',1:'Número de control',3:'Proceso',4:'Fondo',9:'Fecha solicitud',24:'Estado',25:'Observaciones'});
const loanHeader=['Fecha','Cuotas','ID','Folio','','Proceso','Fondo'];
const request=(id,fund,date,status,provider='',control='TEST-001',process='1')=>{const row=Array(26).fill('');Object.assign(row,{0:id,1:control,3:process,4:fund,9:date,24:status,25:provider});return row;};
const installment=(id,fund,date,amount=100,process='1')=>[date,amount,id,'TEST-001','',process,fund];
const emptySavings=()=>({year:2026,events:[],issues:[],coverage:{status:'complete',synthetic:true}});
const build=(requestRows=[],loanRows=[],savings=emptySavings())=>buildReport({year:2026,requests:[requestHeader,...requestRows],loans:[loanHeader,...loanRows],savings,consultedAt:'2026-10-27T20:00:00Z'});
const cell=(report,sheet,coordinate,month)=>month?report.sheets[sheet].months[month].cells[coordinate]:report.sheets[sheet].cells[coordinate];
assert.equal(sourceDate('31/02/2026'),null);assert.equal(sourceDate('01/02/2026'),'2026-02-01');assert.equal(sourceDate(46113),'2026-04-01');assert.equal(sourceDate('2026-02-30'),null);
assert.equal(fundGroup('2026-12-15 Adelanto'),'advance');assert.equal(fundGroup('Sutiexpress externo'),'sutiexpress');
for(const fund of ['15/01/2027—Incentivos trimestrales','30/11/2026–Aguinaldos','2026-12-15-Adelanto'])assert.equal(fundGroup(fund),'advance');
assert.equal(fundGroup('15/01/2027abc'),null,'a date-like prefix without a delimiter is not a dated fund');
assert.equal(fundGroup('Descuentos SUTISSSTESON'),'union');assert.equal(payrollCode('Descuentos SUTISSSTESON','3'),446);
assert.equal(payrollCode('Caja de Ahorro','JUB'),581);assert.equal(payrollCode('Caja de Ahorro','1'),575);assert.equal(payrollCode('Caja Chica','desconocido'),null);
const prefixedProviders=[['Solicitud de membresia / Costco',9],['Solicitud de membresia / Sams Club',10],['Vales / Casa Ley',8],['Vale de gasolina / Arco gasolinera',7],['Vales / RiveraGas',6]];
for(const [provider,row] of prefixedProviders)assert.equal(membershipRow(provider),row);
assert.equal(membershipRow('Solicitud de membresía / Costco'),9);
for(const provider of ['Reembolso / Costco','Solicitud de membresia / Costco / Otro','Vales / Casa Ley Especial','Compra en Costco','Vales /','Bud Tv Ultra'])assert.equal(membershipRow(provider),null,'unknown description must not become a known provider: '+provider);
const providerReport=build([
 ...prefixedProviders.map(([provider],i)=>request('prefixed-'+i,'Vales y membresias','2026-01-01','Aprobado',provider)),
 request('direct-costco','Vales y membresias','2026-01-01','Iniciado','Costco'),
 request('prefixed-extra','Vales y membresias','2026-01-01','Aprobado','Vales / Diesgas'),
 request('direct-extra','Vales y membresias','2026-01-01','Rechazado','Diesgas')
]);
assert.equal(cell(providerReport,SHEETS.membershipMonth,'B9',1).value,2,'prefixed and direct Costco share its original row');
assert.equal(cell(providerReport,SHEETS.membershipMonth,'A12',1).value,'Diesgas');assert.equal(cell(providerReport,SHEETS.membershipMonth,'B12',1).value,1);assert.equal(cell(providerReport,SHEETS.membershipMonth,'C12',1).value,1);assert.equal(cell(providerReport,SHEETS.membershipMonth,'A13',1),undefined,'prefixed providers do not consume duplicate spare rows');
assert.equal(cell(providerReport,SHEETS.membershipMonth,'B18',1).value,7);assert.equal(cell(providerReport,SHEETS.membershipMonth,'C18',1).value,1);assert(providerReport.records.some(r=>r.provider==='Vales / Diesgas'),'original Z is retained for source inspection');
assert(!providerReport.issues.some(i=>i.code==='MEMBERSHIP_PROVIDER_OVERFLOW'));

const report=build([
  request('A','Caja Chica','2026-01-01','Aprobado'),request('B','Caja Chica','2026-01-02','Iniciado'),
  request('C','Caja Chica','2026-01-03','Liquidado'),request('D','Caja Chica','2026-01-04','Cancelado'),
  request('E','Caja Chica','2026-01-05','Rechazado'),request('F','Caja Chica','2026-01-06','Pendiente'),
  request('G','Sutiexpress externo','2026-01-07','Activo'),request('H','2026-12-15 Adelanto','2026-01-08','Aprobado'),
  request('I','Vales y membresias','2026-02-01','Iniciado','Costco'),
  request('J','Vales y membresias','2026-02-02','Cancelado','Diesgas'),
  request('K','Vales y membresias','2026-02-03','Liquidado','Bud Tv Ultra')
],[installment('A','Caja Chica','2026-01-15',120),installment('A','Caja Chica','2026-01-15',120),
  installment('B','Caja de Ahorro','2026-01-15',75,'JUB'),installment('C','Sutiexpress','2026-12-15',50),
  installment('D','Caja Chica','2026-01-15',0),installment('OLD','Caja Chica','2025-01-01','malformed')]);
assert.deepEqual([report.summary.received,report.summary.approved,report.summary.rejected,report.summary.pending],[11,7,3,1]);
assert.equal(cell(report,SHEETS.loan,'B6').value,5);assert.equal(cell(report,SHEETS.loan,'C6').value,2);assert.equal(cell(report,SHEETS.loan,'D6').value,5);
assert.equal(cell(report,SHEETS.loan,'E6').value,12);assert.equal(cell(report,SHEETS.loan,'E18').value,12);assert.equal(cell(report,SHEETS.loan,'E18').sourceIds.length,12,'attention totals preserve each counted action');
assert.equal(cell(report,SHEETS.loanMonth,'B9',1).value,1);assert.equal(cell(report,SHEETS.loanMonth,'B10',1).value,0);assert.equal(cell(report,SHEETS.loanMonth,'B8',1).value,1);
assert.equal(cell(report,SHEETS.discount,'B6').value,2);assert.equal(cell(report,SHEETS.discount,'C6').value,1);assert.equal(cell(report,SHEETS.discount,'B17').value,1);
assert.equal(cell(report,SHEETS.discountMonth,'C13',1).value,1);assert.equal(cell(report,SHEETS.discountMonth,'C9',1).value,0,'retiree loan belongs to 581, never voluntary savings');
assert.equal(report.coverage.zeroInstallmentsExcluded,1);assert.equal(report.coverage.scheduledInstallments,1);assert.equal(report.coverage.paidInstallments,3);
assert.equal(report.issues.filter(x=>x.code==='INSTALLMENT_COLLISION').length,1);assert(!report.issues.some(x=>x.severity==='error'));
assert.deepEqual(cell(report,SHEETS.membership,'B7'),cell(report,SHEETS.financing,'B7'));
assert.equal(cell(report,SHEETS.membership,'E7').value,3);assert.equal(cell(report,SHEETS.membership,'D18').value,2);assert.equal(cell(report,SHEETS.membershipMonth,'E18',2).value,3,'membership attention follows B+C, excluding deposits');
assert.equal(cell(report,SHEETS.membershipMonth,'A12',2).value,'Bud Tv Ultra');assert.equal(cell(report,SHEETS.membershipMonth,'A13',2).value,'Diesgas');
assert.equal(cell(report,SHEETS.membershipMonth,'B12',2).value,1);assert.equal(cell(report,SHEETS.membershipMonth,'C13',2).value,1);assert.equal(cell(report,SHEETS.membershipMonth,'B11',2).value,0,'Bud TV never becomes CineStar');
assert.equal(cell(report,SHEETS.discount,'B6').sourceIds.length,2,'coincident original operations remain separately traceable');
for(const sheet of Object.values(report.sheets))for(const c of [...Object.values(sheet.cells),...Object.values(sheet.months).flatMap(m=>Object.values(m.cells))])for(const id of c.sourceIds)assert(report.records.some(r=>r.id===id));

const collision=build([request('same','Caja Chica','2026-01-01','Aprobado'),request('same','Caja Chica','2026-01-01','Aprobado')]);
assert.equal(cell(collision,SHEETS.loan,'B6').value,2);assert(collision.issues.some(i=>i.code==='REQUEST_IDENTITY_COLLISION'&&i.severity==='error'));
assert(!build([request('same','Caja Chica','2026-01-01','Aprobado','', 'TEST-001'),request('same','Caja Chica','2026-01-01','Aprobado','', 'TEST-002')]).issues.some(i=>i.code==='REQUEST_IDENTITY_COLLISION'));
const unresolved=build([request('x','Vales y membresias','2026-03-01','Aprobado'),request('y','Caja Chica','2026-04-01','misterioso')]);
assert(unresolved.issues.some(i=>i.code==='MEMBERSHIP_PROVIDER_MISSING'&&i.sheets.length===1&&i.months[0]===3));
assert(unresolved.issues.some(i=>i.code==='REQUEST_STATUS_UNMAPPED'&&i.months[0]===4));assert.equal(unresolved.summary.unknown,1);
const overflow=build(Array.from({length:7},(_,i)=>request('extra'+i,'Vales y membresias','2026-01-01','Aprobado','Proveedor '+i)));
assert.equal(cell(overflow,SHEETS.membership,'B6').value,7);assert(overflow.issues.some(i=>i.code==='MEMBERSHIP_PROVIDER_OVERFLOW'&&i.sheets[0]===SHEETS.membershipMonth));
assert.throws(()=>buildReport({year:2026,requests:[['wrong']],loans:[loanHeader],savings:emptySavings()}),/SOURCE_HEADERS_INVALID/);
const missingProcessHeader=[...requestHeader];missingProcessHeader[3]='';assert.throws(()=>buildReport({year:2026,requests:[missingProcessHeader],loans:[loanHeader],savings:emptySavings()}),/SOURCE_HEADERS_INVALID/);

// The only permitted completion is a blank F joined to one matching A/B/E
// request, including prior-year requests. Recorded F always wins.
const processRequest=request('join','Sutiexpress','2025-12-01','Aprobado','','TEST-001','3');
const missingProcess=installment('join','Sutiexpress','2026-01-15',10,'');
const linked=build([processRequest],[missingProcess]);
assert.equal(cell(linked,SHEETS.discountMonth,'C10',1).value,1);assert.equal(cell(linked,SHEETS.discount,'B6').value,1);
assert.equal(linked.coverage.resolvedPayrollProcesses,1);assert(!linked.issues.some(i=>i.code==='PAYROLL_CODE_UNMAPPED'));
const linkedRecord=linked.records.find(r=>r.source==='google_loans');assert.equal(linkedRecord.originalProcess,'');assert.equal(linkedRecord.process,'3');
assert.deepEqual(linkedRecord.processSource,{source:'google_requests',sheet:'Historial de solicitudes',row:2,column:'D'});
assert.equal(missingProcess[5],'','a report projection never changes source rows');
const priorYearRetiree=[...processRequest];priorYearRetiree[3]='JUB';
const linkedRetiree=build([priorYearRetiree],[missingProcess]);assert.equal(cell(linkedRetiree,SHEETS.discount,'C6').value,1);assert.equal(cell(linkedRetiree,SHEETS.discountMonth,'C15',1).value,1);
for(const candidates of [
 [processRequest,processRequest],
 [processRequest,request('join','Sutiexpress','2025-12-02','Aprobado','','TEST-001','')],
 [request('join','Sutiexpress','2025-12-01','Aprobado','','OTHER','3')],
 [request('join','Caja Chica','2025-12-01','Aprobado','','TEST-001','3')],
 [request('different','Sutiexpress','2025-12-01','Aprobado','','TEST-001','3')],
 [request('join','Sutiexpress','2025-12-01','Aprobado','','TEST-001','unknown')]
]){
 const unlinked=build(candidates,[missingProcess]);assert.equal(unlinked.coverage.resolvedPayrollProcesses,0);assert(unlinked.issues.some(i=>i.code==='PAYROLL_CODE_UNMAPPED'));assert.equal(cell(unlinked,SHEETS.discountMonth,'C10',1).value,0);
}
const nonblank=build([processRequest],[installment('join','Sutiexpress','2026-01-15',10,'JUB')]);assert.equal(cell(nonblank,SHEETS.discount,'C6').value,1);assert.equal(nonblank.coverage.resolvedPayrollProcesses,0);assert.equal(nonblank.records.find(r=>r.source==='google_loans').processSource,undefined);
const unknownNonblank=build([processRequest],[installment('join','Sutiexpress','2026-01-15',10,'unknown')]);assert(unknownNonblank.issues.some(i=>i.code==='PAYROLL_CODE_UNMAPPED'));assert.equal(unknownNonblank.coverage.resolvedPayrollProcesses,0);
const normalizedFund=build([request('join','SUTÍEXPRESS','2025-12-01','Aprobado','','TEST-001','3')],[missingProcess]);assert.equal(normalizedFund.coverage.resolvedPayrollProcesses,1,'same normalized fund is accepted');
const exactControl=build([request('join','Sutiexpress','2025-12-01','Aprobado','','001','3')],[[...missingProcess.slice(0,3),'1',...missingProcess.slice(4)]]);assert(exactControl.issues.some(i=>i.code==='PAYROLL_CODE_UNMAPPED'),'control leading zeroes are significant');
const absentRequestDate=build([request('join','Sutiexpress','','','','TEST-001','3')],[missingProcess]);assert(absentRequestDate.issues.some(i=>i.code==='REQUEST_DATE_INVALID'));assert.equal(cell(absentRequestDate,SHEETS.discountMonth,'C10',1).value,1,'process resolution does not invent a request date');

const savings=emptySavings();savings.events=[
  {id:'intake:1',kind:'intake',occurred_on:'2026-03-01',source_table:'savings_registrations',source_id:'1',numero_control:'TEST-001'},
  {id:'payroll:1',kind:'payroll_discount',occurred_on:'2026-03-15',source_table:'savings_transactions',source_id:'2',detail:{amount:100,payroll_code:573}},
  {id:'payroll:2',kind:'payroll_discount',occurred_on:'2026-03-31',source_table:'savings_transactions',source_id:'3',detail:{amount:100,payroll_code:580}},
  {id:'refund:1',kind:'refund_paid',occurred_on:'2026-04-01',source_table:'savings_refund_cases',source_id:'4',detail:{amount:200,payroll_code:580}}
];
const savingsReport=build([],[],savings);assert.equal(cell(savingsReport,SHEETS.savings,'B6').value,1);assert.equal(cell(savingsReport,SHEETS.savings,'E7').value,1);
assert.equal(cell(savingsReport,SHEETS.savings,'H16').value,2);assert.equal(cell(savingsReport,SHEETS.discountMonth,'E21',3).value,2);
assert.equal(cell(savingsReport,SHEETS.discount,'B8').value,1);assert.equal(cell(savingsReport,SHEETS.discount,'C8').value,1);assert.equal(cell(savingsReport,SHEETS.discount,'D9').value,1);assert.equal(cell(savingsReport,SHEETS.discountMonth,'D12',4).value,1);
savings.events.push(savings.events[0]);assert.throws(()=>build([],[],savings),/SAVINGS_EVENT_DUPLICATE/);
// Exact RPC issue shape: historical warnings remain nonblocking; only unresolved
// refund months lose certainty, without invalidating loans or membership counts.
for(const topLevel of [true,false]){
 const source=emptySavings();const detail={metric:'refund_paid',severity:'blocking',months:[1,2],note:'synthetic unconfirmed coverage'};
 source.issues=[{code:'REFUND_PERIOD_UNCONFIRMED',count:2,detail,...(topLevel?{scope:'refund',severity:'blocking',months:[1,2],sourceIds:[]}: {})},{code:'HISTORICAL_WITHDRAWAL_NOT_COMPLETED',count:1,detail:{metric:'withdrawal_paid',severity:'warning',months:[3]}}];
 const projected=build([],[],source),problem=projected.issues.find(i=>i.code==='REFUND_PERIOD_UNCONFIRMED');
 assert.deepEqual(problem.sheets,[SHEETS.savings,SHEETS.discount,SHEETS.discountMonth]);assert.deepEqual(problem.months,[1,2]);assert.equal(problem.severity,'error');
 assert.equal(cell(projected,SHEETS.savings,'E4').value,null);assert.equal(cell(projected,SHEETS.discount,'D6').value,null);assert.equal(cell(projected,SHEETS.discountMonth,'D7',1).value,null);
 assert.equal(cell(projected,SHEETS.savings,'E6').value,0);assert.equal(cell(projected,SHEETS.discountMonth,'D7',3).value,0);assert.equal(cell(projected,SHEETS.loan,'E18').value,0);
 assert.equal(projected.issues.find(i=>i.code==='HISTORICAL_WITHDRAWAL_NOT_COMPLETED').severity,'warning');assert.equal(cell(projected,SHEETS.savings,'H16').value,null);
}
const terminationSource=emptySavings();terminationSource.issues=[{code:'HISTORICAL_TERMINATION_UNMAPPED',scope:'savings',severity:'blocking',months:[],sourceIds:['synthetic-history'],detail:{metric:'cancellation',columns:['G','H']}}];
const terminationReport=build([],[],terminationSource);assert.equal(cell(terminationReport,SHEETS.savings,'G4').value,null);assert.equal(cell(terminationReport,SHEETS.savings,'H16').value,null);assert.equal(cell(terminationReport,SHEETS.savings,'B4').value,0);assert.equal(cell(terminationReport,SHEETS.savings,'F4').value,0);assert.equal(cell(terminationReport,SHEETS.discount,'E18').value,0);assert.deepEqual(terminationReport.issues[0].sheets,[SHEETS.savings]);

const actor='00000000-0000-4000-8000-000000000001',ctx={actor,effective_affiliate:null,session:null};
function client({authenticated=true,allowed=true,changing=false}={}){let contexts=0;return {auth:{getUser:async()=>({data:{user:authenticated?{id:actor}:null},error:null})},rpc:async(name)=>name==='get_admin_reports_jc_context'?{data:allowed?{...ctx,effective_affiliate:changing&&++contexts>1?'changed':null}:null,error:allowed?null:{message:'denied'}}:{data:emptySavings(),error:null}};}
let sourceReads=0,templateReads=0;const source=async()=>{sourceReads++;return {requests:[requestHeader],loans:[loanHeader]};},template=async()=>{templateReads++;return {base64:'synthetic',sha256:'synthetic',filename:'synthetic.xlsx'};};
await assert.rejects(loadReport({action:'LOAD',year:2026},client({authenticated:false}),source,template),/AUTH_REQUIRED/);
await assert.rejects(loadReport({action:'TEMPLATE'},client({allowed:false}),source,template),/ADMIN_DENIED/);assert.equal(sourceReads+templateReads,0);
await assert.rejects(loadReport({action:'LOAD',year:2026,affiliate_id:'other'},client(),source,template),/REQUEST_INVALID/);
await assert.rejects(loadReport({action:'LOAD',year:2026},client({changing:true}),source,template),/CONTEXT_CHANGED/);
const loaded=await loadReport({action:'LOAD',year:2026},client(),source,template);assert.equal(loaded.context.actor,actor);assert.equal(loaded.data.year,2026);
const sessionClient=client(),sessionRpc=sessionClient.rpc;sessionClient.rpc=async(...args)=>{const response=await sessionRpc(...args);if(args[0]==='get_admin_reports_jc_context')response.data.session='synthetic-auth-session';return response;};assert.equal((await loadReport({action:'TEMPLATE'},sessionClient,source,template)).context.session,'synthetic-auth-session');
assert.equal((await loadReport({action:'TEMPLATE'},client(),source,template)).data.filename,'synthetic.xlsx');
await assert.rejects(loadReport({action:'LOAD',year:2026},client(),async()=>{throw Error('SOURCE_FAILED');},template),/SOURCE_FAILED/);

const calls=[];const rangeValues=[[["ID","Número de control"],...Array.from({length:20005},(_,i)=>['synthetic-'+i,'TEST'])],[['Proceso','Fondo'],['3','Sutiexpress']],[['Fecha solicitud']],[['Estado','Observaciones']],[['Fecha','Cuotas','ID','Folio']],[['Proceso','Fondo']]];
const syntheticKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
const syntheticAccount=JSON.stringify({type:'service_account',client_email:READER_EMAIL,project_id:READER_PROJECT,private_key:syntheticKey});
const google=await readGoogle(name=>name===READER_SECRET?syntheticAccount:null,async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>calls.length===1?{access_token:'synthetic-token'}:{spreadsheetId:WORKBOOK,valueRanges:rangeValues.map(values=>({values}))}};});
assert.equal(google.requests.length,20006,'reader must not silently cap source rows');assert.equal(calls[1].options.method,'GET');
assert.equal(google.requests[0][3],'Proceso');assert.equal(google.requests[0][4],'Fondo');assert.equal(google.requests[1][3],'3');assert.equal(google.requests[1][4],'Sutiexpress');assert.equal(google.requests[1][2],undefined,'D:E merge preserves unused C');
assert(calls[1].url.includes('/values:batchGet?'));for(const range of GOOGLE_RANGES)assert(new URL(calls[1].url).searchParams.getAll('ranges').includes(range));
assert(!calls[1].url.includes(':batchUpdate'));assert(!calls[1].url.includes('20000'));
await assert.rejects(readGoogle(()=>null,async()=>{throw Error('must not fetch');}),/GOOGLE_NOT_CONFIGURED/);
const edge=fs.readFileSync(new URL('../supabase/functions/reports-jc/index.ts',import.meta.url),'utf8');assert(edge.includes("'Cache-Control':'no-store'"));assert(edge.includes("request.method!=='POST'"));assert(edge.includes('ORIGIN_DENIED'));assert(!edge.includes('SERVICE_ROLE'));
console.log(JSON.stringify({status:'PASS',checks:'rules, dates, states, manual deposits, distinct operations, collisions, provider slots, savings counts, evidence, authentication, revocation, source failure, unbounded read-only Google',externalReads:0,externalWrites:0,fixtures:'synthetic only'}));
