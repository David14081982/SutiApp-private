// Reportes JC is a read-only projection. No source rows, balances or workflows are changed.
import {createReadOnlyAssertion,TOKEN_ENDPOINT} from './google-auth.mjs';
export const WORKBOOK = '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
export const REQUEST_SHEET = 'Historial de solicitudes';
export const LOAN_SHEET = 'HISTORIAL P V2';
export const SHEETS = Object.freeze({loan:'Préstamos Concentrado',loanMonth:'Préstamos Mes',
  discount:'DtosViaNomina Concentrado',discountMonth:'DtosViaNomina Mes',
  membership:'ValesyMembresias Concentrado',membershipMonth:'ValesyMembresias Mes',
  financing:'Financiamientos Concentrado',savings:'Caja de Ahorro Voluntario'});
const REQUEST_REPORTS=[SHEETS.loan,SHEETS.loanMonth,SHEETS.membership,SHEETS.membershipMonth,SHEETS.financing];
const DISCOUNT_REPORTS=[SHEETS.discount,SHEETS.discountMonth];
const MONTHS=Array.from({length:12},(_,i)=>i+1);
const PAYROLL_ROWS={446:6,573:7,574:8,575:9,576:10,577:11,580:12,581:13,609:14,610:15,611:16,644:17,645:18,646:19,647:20};
const SAVINGS_COLUMNS={intake:'B',withdrawal_requested:'C',withdrawal_paid:'D',refund_paid:'E',contribution_changed:'F',cancellation:'G'};
export class ReportError extends Error {constructor(code,details={}){super(code);this.details=details;}}
const has=v=>v!==null&&v!==undefined&&String(v).trim()!=='';
const text=v=>String(v??'').trim();
const key=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const monthOf=date=>Number(date.slice(5,7));
const isYear=(date,year)=>date&&Number(date.slice(0,4))===year;
const localToday=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

export function sourceDate(value){
  if(!has(value))return null;
  if(typeof value==='number'){
    if(!Number.isFinite(value)||value<1||value>2958465)return null;
    return new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000).toISOString().slice(0,10);
  }
  const s=text(value);let parts;
  if(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s))parts=s.slice(0,10).split('-').map(Number);
  else {const match=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);if(!match)return null;parts=[Number(match[3]),Number(match[2]),Number(match[1])];}
  const [y,m,d]=parts;if(y<1900||y>9999||m<1||m>12||d<1||d>31)return null;
  const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.toISOString().slice(0,10):null;
}
export function requestStatus(value){
  const normalized=key(value);
  if(['APROBADO','APROBADA','INICIADO','INICIADA','ACTIVO','ACTIVA','LIQUIDADO','LIQUIDADA'].includes(normalized))return 'approved';
  if(['RECHAZADO','RECHAZADA','CANCELADO','CANCELADA'].includes(normalized))return 'rejected';
  if(['PENDIENTE','ENPROCESO','ENREVISION','SOLICITADO','SOLICITADA','PORAPROBAR'].includes(normalized))return 'pending';
  return 'unknown';
}
export function fundGroup(value){
  const s=text(value),k=key(value);
  if(/^\d{4}-\d{1,2}-\d{1,2}(?=\s|[—–-]|$)/.test(s)||/^\d{1,2}\/\d{1,2}\/\d{4}(?=\s|[—–-]|$)/.test(s)||k.includes('ADELANTODENOMINA'))return 'advance';
  if(['CAJADEAHORRO','CAJAAHORRO','PRESTAMODECAJADEAHORRO'].includes(k))return 'loanSavings';
  if(['CAJACHICA','PRESTAMODECAJACHICA'].includes(k))return 'pettyCash';
  if(k==='SUTIEXPRESS'||k==='SUTIEXPRES'||k==='SUTIEXPRESSEXTERNO')return 'sutiexpress';
  if(['VALESYMEMBRESIAS','VALESYMEMBRESIA','MEMBRESIAS','MEMBRESIA'].includes(k))return 'membership';
  if(['DESCUENTOSUTISSSTESON','DESCUENTOSSUTISSSTESON','SUTISSSTESON'].includes(k))return 'union';
  if(k==='SEGUROCOLECTIVOSUTI'||k==='SEGUROCOLECTIVO')return 'insurance';
  if(['PROYECTOSSUTI','PANELSOLAR','PANELESSOLARES','SUTIAUTO','SUTIAUTOS','SUTICIRUGIAS','SUTITERRENOS'].includes(k))return 'projects';
  if(['SUTITOURS','SUTIVIAJES'].includes(k))return 'travel';
  if(k==='SUTICOMPRAS')return 'purchases';
  return null;
}
function membershipProvider(value){
  const original=text(value),parts=original.split('/');
  return parts.length===2&&has(parts[1])&&['SOLICITUDDEMEMBRESIA','VALES','VALEDEGASOLINA'].includes(key(parts[0]))?text(parts[1]):original;
}
export function membershipRow(value){
  const k=key(membershipProvider(value));
  if(['RIVERAGAS','RIVERAGASVALES'].includes(k))return 6;
  if(['ARCO','ARCOGASOLINERA','ARCOGASOLINA'].includes(k))return 7;
  if(k==='CASALEY')return 8;
  if(k==='COSTCO')return 9;
  if(['SAMS','SAMSCLUB'].includes(k))return 10;
  if(['CINESTAR','CINESTARTV'].includes(k))return 11;
  return null;
}
export function payrollCode(fund,process){
  const p=key(process),jub=['JUB','JUBILADOSYPENSIONADOS','JUBILADOSYPENS','JUBILADO','PENSIONADO'].includes(p);
  if(!jub&&!['1','3','CONFIANZA'].includes(p))return null;
  const group=fundGroup(fund);
  return ({loanSavings:jub?581:575,pettyCash:jub?609:574,sutiexpress:jub?610:576,advance:jub?610:576,
    membership:jub?611:577,union:446,insurance:644,projects:645,travel:646,purchases:647})[group]||null;
}
function assertHeaders(values,sheet,expected){
  if(!Array.isArray(values)||!Array.isArray(values[0]))throw new ReportError('SOURCE_HEADERS_INVALID',{sheet});
  const invalid=Object.entries(expected).filter(([column,names])=>!names.some(n=>key(values[0][Number(column)])===key(n))).map(([column])=>Number(column)+1);
  if(invalid.length)throw new ReportError('SOURCE_HEADERS_INVALID',{sheet,columns:invalid});
}
function buildSheets(){
  const out={};
  for(const name of Object.values(SHEETS))out[name]={cells:{},months:{},issues:[]};
  for(const month of MONTHS){
    for(const name of [SHEETS.loan,SHEETS.discount,SHEETS.membership,SHEETS.financing])for(const col of ['B','C','D'])out[name].cells[col+(month+5)]={value:0,sourceIds:[],rule:'count_source_operations'};
    for(const col of Object.values(SAVINGS_COLUMNS))out[SHEETS.savings].cells[col+(month+3)]={value:0,sourceIds:[],rule:'count_savings_cases_by_event_date'};
    for(const name of [SHEETS.loanMonth,SHEETS.discountMonth,SHEETS.membershipMonth])out[name].months[month]={cells:{},issues:[]};
    for(let row=6;row<=10;row++)for(const col of ['B','C','D'])out[SHEETS.loanMonth].months[month].cells[col+row]={value:0,sourceIds:[],rule:row===10?'sutiexpress_included_once_in_row_9':'count_requests_by_request_date'};
    for(let row=6;row<=17;row++)for(const col of ['B','C','D'])out[SHEETS.membershipMonth].months[month].cells[col+row]={value:0,sourceIds:[],rule:'count_membership_requests_by_provider'};
    for(let row=6;row<=20;row++)for(const col of ['C','D'])out[SHEETS.discountMonth].months[month].cells[col+row]={value:0,sourceIds:[],rule:col==='C'?'count_positive_payroll_operations':'count_completed_refund_cases'};
  }return out;
}
function calculateTotals(sheets){
  function total(cells,address,inputs){
    const complete=inputs.every(input=>typeof cells[input].value==='number');
    cells[address]={value:complete?inputs.reduce((sum,input)=>sum+cells[input].value,0):null,sourceIds:inputs.flatMap(input=>cells[input].sourceIds),rule:'Suma de '+inputs.join(', ')+'. Cada atención conserva la operación que se contó; una solicitud puede aportar aprobación y depósito.'};
    if(!complete)cells[address].observedValue=inputs.reduce((sum,input)=>sum+(cells[input].observedValue??cells[input].value??0),0);
  }
  for(const name of [SHEETS.loan,SHEETS.discount,SHEETS.membership,SHEETS.financing]){
    const cells=sheets[name].cells,attention=[SHEETS.membership,SHEETS.financing].includes(name)?['B','C']:['B','C','D'];
    for(let row=6;row<=17;row++)total(cells,'E'+row,attention.map(col=>col+row));
    for(const col of ['B','C','D'])total(cells,col+'18',MONTHS.map(m=>col+(m+5)));
    total(cells,'E18',attention.map(col=>col+'18'));
  }
  for(const month of MONTHS)for(const [name,lastRow,columns,attention] of [[SHEETS.loanMonth,10,['B','C','D'],['B','C','D']],[SHEETS.membershipMonth,17,['B','C','D'],['B','C']],[SHEETS.discountMonth,20,['C','D'],['C','D']]]){
    const cells=sheets[name].months[month].cells,rows=Array.from({length:lastRow-5},(_,i)=>i+6);
    for(const row of rows)total(cells,'E'+row,attention.map(col=>col+row));
    for(const col of columns)total(cells,col+(lastRow+1),rows.map(row=>col+row));
    total(cells,'E'+(lastRow+1),attention.map(col=>col+(lastRow+1)));
  }
  const cells=sheets[SHEETS.savings].cells,columns=['B','C','D','E','F','G'];
  for(const month of MONTHS)total(cells,'H'+(month+3),columns.map(col=>col+(month+3)));
  for(const col of columns)total(cells,col+'16',MONTHS.map(month=>col+(month+3)));
  total(cells,'H16',columns.map(col=>col+'16'));
}
export function buildReport({year,requests,loans,savings,consultedAt=new Date().toISOString()}){
  if(!Number.isInteger(year)||year<2000||year>2100)throw new ReportError('REQUEST_INVALID');
  assertHeaders(requests,REQUEST_SHEET,{0:['ID'],1:['Número de control'],3:['Proceso'],4:['Fondo'],9:['Fecha solicitud'],24:['Estado'],25:['Observaciones']});
  assertHeaders(loans,LOAN_SHEET,{0:['Fecha'],1:['Cuotas','Cuota'],2:['ID'],5:['Proceso'],6:['Fondo']});
  if(!savings||savings.year!==year||!Array.isArray(savings.events)||!Array.isArray(savings.issues)||!savings.coverage)throw new ReportError('SAVINGS_SOURCE_INVALID');
  const sheets=buildSheets(),records=[],issues=[],today=localToday(consultedAt),requestKeys=new Map(),loanKeys=new Map(),eventIds=new Set();
  // A blank payroll process can be read from its one exact request in this same
  // workbook. Neither request dates nor statuses are inferred from this join.
  const processKey=(id,control,fund)=>has(id)&&has(control)&&has(fund)?JSON.stringify([text(id),text(control),key(fund)]):null;
  const requestProcesses=new Map();
  for(let i=1;i<requests.length;i++){
    const row=requests[i]||[],identity=processKey(row[0],row[1],row[4]);
    if(identity!==null)requestProcesses.set(identity,requestProcesses.has(identity)?null:{value:text(row[3]),row:i+1});
  }
  // Preserve the six named template rows; additional providers use its existing six spare rows.
  const extraProviders=new Map();
  for(const r of requests.slice(1))if(fundGroup(r?.[4])==='membership'&&isYear(sourceDate(r?.[9]),year)&&has(r?.[25])&&!membershipRow(r[25])){
    const label=membershipProvider(r[25]),normalized=key(label);if(!extraProviders.has(normalized)||label<extraProviders.get(normalized))extraProviders.set(normalized,label);
  }
  const extras=[...extraProviders.entries()].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0),extraRows=new Map(extras.slice(0,6).map(([provider],i)=>[provider,12+i]));
  for(const month of MONTHS)extras.slice(0,6).forEach(([,label],i)=>{sheets[SHEETS.membershipMonth].months[month].cells['A'+(12+i)]={value:label,sourceIds:[],rule:'source_provider_in_existing_spare_row'};});
  const summary={received:0,approved:0,rejected:0,pending:0,unknown:0,months:Object.fromEntries(MONTHS.map(m=>[m,{received:0,approved:0,rejected:0,pending:0,unknown:0}]))};
  function issue(code,message,names,months=[],sourceIds=[],severity='error'){
    const item={code,message,severity,sheets:names,months,sourceIds};issues.push(item);
    for(const name of names){sheets[name].issues.push(item);for(const m of months.length?months:MONTHS)if(sheets[name].months[m])sheets[name].months[m].issues.push(item);}
    return item;
  }
  function add(name,cell,id,month=null,rule){const target=month===null?sheets[name].cells:sheets[name].months[month].cells;if(!target[cell])throw new ReportError('REPORT_MAPPING_INVALID');target[cell].value++;target[cell].sourceIds.push(id);if(rule)target[cell].rule=rule;}
  function countRequest(name,row,record,month=null){if(record.status==='approved'){add(name,'B'+row,record.id,month,'approved_initiated_or_settled_by_request_date');add(name,'D'+row,record.id,month,'owner_confirmed_manual_deposit_by_request_date');}else if(record.status==='rejected')add(name,'C'+row,record.id,month,'rejected_and_cancelled_by_request_date');}
  for(let i=1;i<requests.length;i++){
    const r=requests[i]||[];if(![0,1,4,9,24,25].some(c=>has(r[c])))continue;
    const id='requests:'+String(i+1),date=sourceDate(r[9]),fund=text(r[4]),group=fundGroup(fund),status=requestStatus(r[24]);
    const included=group==='membership'||['loanSavings','pettyCash','advance','sutiexpress'].includes(group),names=group==='membership'?[SHEETS.membership,SHEETS.membershipMonth,SHEETS.financing]:['loanSavings','pettyCash','advance','sutiexpress'].includes(group)?[SHEETS.loan,SHEETS.loanMonth]:REQUEST_REPORTS;
    if(!date){issue('REQUEST_DATE_INVALID','La fecha de solicitud no permite ubicar esta fila en un mes.',names,[],[id],included||!fund?'error':'warning');continue;}
    if(!isYear(date,year))continue;
    const month=monthOf(date),record={id,source:'google_requests',sheet:REQUEST_SHEET,row:i+1,requestId:text(r[0]),numero_control:text(r[1]),date,fund,status,sourceStatus:text(r[24]),provider:group==='membership'?text(r[25]):'',group};
    records.push(record);summary.received++;summary[status]++;summary.months[month].received++;summary.months[month][status]++;
    if(!record.requestId)issue('REQUEST_ID_MISSING','La solicitud se identifica por su fila original; falta el ID.',names,[month],[id],'warning');
    if(status==='unknown')issue('REQUEST_STATUS_UNMAPPED','El estado registrado no tiene una clasificación autorizada.',names,[month],[id],included||!fund?'error':'warning');
    if(!fund)issue('REQUEST_FUND_MISSING','La solicitud no tiene fondo registrado.',REQUEST_REPORTS,[month],[id]);
    const identity=record.requestId&&[record.requestId,record.numero_control,date,key(fund)].join('|');
    if(identity){const prior=requestKeys.get(identity);if(prior)issue('REQUEST_IDENTITY_COLLISION','Dos filas comparten identidad, persona, fecha y fondo. Se conservan ambas; revisar antes de exportar.',names,[month],[prior,id],included?'error':'warning');else requestKeys.set(identity,id);}
    if(group==='membership'){
      for(const name of [SHEETS.membership,SHEETS.financing])countRequest(name,month+5,record);
      const providerRow=membershipRow(record.provider)||extraRows.get(key(membershipProvider(record.provider)));
      if(providerRow)countRequest(SHEETS.membershipMonth,providerRow,record,month);
      else issue(record.provider?'MEMBERSHIP_PROVIDER_OVERFLOW':'MEMBERSHIP_PROVIDER_MISSING',record.provider?'Los proveedores adicionales superan las seis filas libres de la plantilla.':'La solicitud no tiene proveedor en Observaciones.',[SHEETS.membershipMonth],[month],[id]);
    }else if(['loanSavings','pettyCash','advance','sutiexpress'].includes(group)){
      countRequest(SHEETS.loan,month+5,record);countRequest(SHEETS.loanMonth,({loanSavings:6,pettyCash:7,advance:8,sutiexpress:9})[group],record,month);
    }
  }
  let zeroInstallments=0,scheduledInstallments=0,paidInstallments=0,resolvedPayrollProcesses=0;
  for(let i=1;i<loans.length;i++){
    const r=loans[i]||[];if(![0,1,2,3,5,6].some(c=>has(r[c])))continue;
    const id='loans:'+String(i+1),date=sourceDate(r[0]);
    if(date&&!isYear(date,year))continue;
    if(typeof r[1]!=='number'||!Number.isFinite(r[1])||r[1]<0){issue('INSTALLMENT_AMOUNT_INVALID','La cuota no es un importe numérico no negativo.',DISCOUNT_REPORTS,date?[monthOf(date)]:[],[id]);continue;}
    if(r[1]===0){zeroInstallments++;continue;}
    if(!date){issue('INSTALLMENT_DATE_INVALID','La cuota positiva no tiene una fecha válida.',DISCOUNT_REPORTS,[],[id]);continue;}
    if(!isYear(date,year))continue;
    const originalProcess=text(r[5]),matchedRequest=!has(r[5])?requestProcesses.get(processKey(r[2],r[3],r[6])):null;
    const resolved=matchedRequest&&has(matchedRequest.value)&&payrollCode(r[6],matchedRequest.value)!==null;
    const process=resolved?matchedRequest.value:originalProcess;
    if(resolved)resolvedPayrollProcesses++;
    const month=monthOf(date),code=payrollCode(r[6],process),phase=date<=today?'paid':'scheduled';
    const record={id,source:'google_loans',sheet:LOAN_SHEET,row:i+1,requestId:text(r[2]),numero_control:text(r[3]),date,fund:text(r[6]),process,amount:r[1],payrollCode:code,phase};
    if(resolved)Object.assign(record,{originalProcess,processSource:{source:'google_requests',sheet:REQUEST_SHEET,row:matchedRequest.row,column:'D'}});
    records.push(record);
    if(phase==='paid')paidInstallments++;else scheduledInstallments++;
    if(!record.requestId)issue('INSTALLMENT_ID_MISSING','La cuota conserva su fila original, pero no tiene identificador de préstamo.',DISCOUNT_REPORTS,[month],[id],'warning');
    if(!code){issue('PAYROLL_CODE_UNMAPPED','El fondo o proceso de la cuota no tiene clave de descuento autorizada.',DISCOUNT_REPORTS,[month],[id]);continue;}
    const isJub=['JUB','JUBILADOSYPENSIONADOS','JUBILADOSYPENS','JUBILADO','PENSIONADO'].includes(key(process));
    add(SHEETS.discount,(isJub?'C':'B')+(month+5),id,null,'count_positive_installments_including_valid_schedule');
    add(SHEETS.discountMonth,'C'+PAYROLL_ROWS[code],id,month);
    const collision=[record.requestId,record.numero_control,date,record.amount,key(record.fund)].join('|');
    const prior=loanKeys.get(collision);if(prior)issue('INSTALLMENT_COLLISION','Hay cuotas coincidentes. Cada operación fuente se conserva; no se deduplicó por fecha/préstamo.',DISCOUNT_REPORTS,[month],[prior,id],'warning');else loanKeys.set(collision,id);
  }
  for(const event of savings.events){
    if(!event||!has(event.id)||!has(event.source_table)||!has(event.source_id))throw new ReportError('SAVINGS_SOURCE_INVALID');
    const date=sourceDate(event.occurred_on);if(!date||!isYear(date,year))throw new ReportError('SAVINGS_SOURCE_INVALID');
    const id='savings:'+text(event.id),month=monthOf(date);
    if(eventIds.has(id))throw new ReportError('SAVINGS_EVENT_DUPLICATE');eventIds.add(id);
    const record={id,source:'supabase_savings',source_table:event.source_table,source_id:String(event.source_id),numero_control:text(event.numero_control),date,kind:event.kind,detail:event.detail||{}};records.push(record);
    const col=SAVINGS_COLUMNS[event.kind];if(col)add(SHEETS.savings,col+(month+3),id);
    else if(event.kind!=='payroll_discount')throw new ReportError('SAVINGS_EVENT_KIND_INVALID');
    if(event.kind==='payroll_discount'){
      const code=Number(event.detail?.payroll_code);
      if(![573,580].includes(code)||typeof event.detail?.amount!=='number'||!Number.isFinite(event.detail.amount)||event.detail.amount<=0){issue('SAVINGS_PAYROLL_UNRESOLVED','La aportación requiere importe positivo y clasificación RH/jubilados.',DISCOUNT_REPORTS,[month],[id]);continue;}
      add(SHEETS.discount,(code===580?'C':'B')+(month+5),id);add(SHEETS.discountMonth,'C'+PAYROLL_ROWS[code],id,month);
    }
    if(event.kind==='refund_paid'){
      add(SHEETS.discount,'D'+(month+5),id,null,'count_refund_cases_once_in_full_payment_month');
      const code=Number(event.detail?.payroll_code);
      if([573,580].includes(code))add(SHEETS.discountMonth,'D'+PAYROLL_ROWS[code],id,month,'count_refund_cases_once_in_full_payment_month');
      else issue('REFUND_PAYROLL_UNRESOLVED','El reembolso completo carece de clasificación RH/jubilados.',[SHEETS.discountMonth],[month],[id]);
    }
  }
  for(const problem of savings.issues){
    const detail=problem.detail&&typeof problem.detail==='object'?problem.detail:{};
    const scope=problem.scope||detail.scope||(detail.metric==='payroll_discount'?'payroll':detail.metric==='refund_paid'||String(problem.code).startsWith('REFUND_')?'refund':'savings');
    const names=scope==='payroll'?DISCOUNT_REPORTS:[SHEETS.savings,...(scope==='refund'?[SHEETS.discount,SHEETS.discountMonth]:[])];
    const problemMonths=Array.isArray(problem.months)?problem.months:Array.isArray(detail.months)?detail.months:[];
    const severity=(problem.severity||detail.severity)==='warning'?'warning':'error';
    const messages={MISSING_EVENT_DATE:'Hay eventos de ahorro sin fecha que permita ubicarlos en el reporte.',HISTORICAL_WITHDRAWAL_NOT_COMPLETED:'Solicitudes históricas de retiro aún no completadas: no se cuentan como depósitos.',HISTORICAL_CHANGE_NOT_MARKED_APPLIED:'Cambios históricos sin aplicación registrada: no se cuentan como cambios realizados.',PAYROLL_AMOUNT_NOT_RECORDED:'Hay descuentos de ahorro sin importe registrado.',PAYROLL_SCHEDULE_UNRESOLVED:'Hay descuentos futuros de ahorro sin importe programado resuelto.',PAYROLL_PROCESS_UNRESOLVED:'Hay descuentos de ahorro sin clasificación RH/jubilados.',HISTORICAL_IDENTITY_MISSING:'Hay registros históricos de ahorro sin número de control.',REFUND_PERIOD_UNCONFIRMED:'Falta confirmar la cobertura de reembolsos del periodo; ausencia de expedientes no equivale a cero devoluciones.',REFUND_PAYROLL_PROCESS_UNRESOLVED:'Hay reembolsos sin clasificación RH/jubilados para la clave de descuento.'};
    const message=problem.message||messages[problem.code]||(problem.code==='HISTORICAL_TERMINATION_UNMAPPED'?'Hay estados históricos Terminado sin una fecha efectiva de baja autorizada; no se puede asignar su mes.':typeof problem.detail==='string'?problem.detail:'La fuente de ahorro requiere revisión para este indicador.');
    const item=issue(String(problem.code||'SAVINGS_COVERAGE_UNRESOLVED'),String(message),names,problemMonths,Array.isArray(problem.sourceIds)?problem.sourceIds:[],severity);
    if(Number.isInteger(problem.count))item.count=problem.count;
    if(problem.code==='REFUND_PERIOD_UNCONFIRMED'&&severity==='error')for(const month of problemMonths.length?problemMonths:MONTHS){
      if(!MONTHS.includes(month))throw new ReportError('SAVINGS_SOURCE_INVALID');
      const affected=[sheets[SHEETS.savings].cells['E'+(month+3)],sheets[SHEETS.discount].cells['D'+(month+5)],sheets[SHEETS.discountMonth].months[month].cells.D7,sheets[SHEETS.discountMonth].months[month].cells.D12];
      for(const cell of affected){cell.observedValue=cell.value;cell.value=null;cell.rule='Cantidad observada incompleta: el periodo de reembolsos aún no está confirmado.';}
    }
    if(problem.code==='HISTORICAL_TERMINATION_UNMAPPED'&&severity==='error')for(const month of problemMonths.length?problemMonths:MONTHS){
      if(!MONTHS.includes(month))throw new ReportError('SAVINGS_SOURCE_INVALID');
      const cell=sheets[SHEETS.savings].cells['G'+(month+3)];cell.observedValue=cell.value;cell.value=null;
      cell.rule='Cantidad de bajas por determinar: existe un estado histórico Terminado sin fecha efectiva de baja autorizada.';
    }
  }
  calculateTotals(sheets);
  const ruleLabels={count_source_operations:'Cantidad de operaciones registradas en la fuente.',count_savings_cases_by_event_date:'Cantidad de casos de Ahorro según la fecha registrada del evento.',sutiexpress_included_once_in_row_9:'Sutiexpress se cuenta una sola vez en la fila principal.',count_requests_by_request_date:'Cantidad de solicitudes según J, Fecha solicitud, de Historial de solicitudes.',count_membership_requests_by_provider:'Cantidad de solicitudes de Vales y Membresías, agrupadas por proveedor de Z, Observaciones.',count_positive_payroll_operations:'Cantidad de cuotas positivas; se cuenta cada operación original y no su importe.',count_completed_refund_cases:'Cantidad de expedientes de reembolso completamente pagados.',approved_initiated_or_settled_by_request_date:'Estados Aprobado, Iniciado, Activo o Liquidado; mes de la fecha de solicitud.',owner_confirmed_manual_deposit_by_request_date:'Depósito manual confirmado por el propietario para Aprobado, Iniciado, Activo o Liquidado; mes de la solicitud.',rejected_and_cancelled_by_request_date:'Solicitudes rechazadas y canceladas; mes de la fecha de solicitud.',count_positive_installments_including_valid_schedule:'Cuotas positivas: hasta hoy pagadas/cotejadas y futuras programadas válidas; cada fila cuenta una operación.',count_refund_cases_once_in_full_payment_month:'Un expediente de reembolso se cuenta una sola vez, en el mes del pago completo.',source_provider_in_existing_spare_row:'Proveedor escrito en Observaciones; utiliza una fila libre ya existente en la plantilla.'};
  for(const sheet of Object.values(sheets))for(const cell of [...Object.values(sheet.cells),...Object.values(sheet.months).flatMap(month=>Object.values(month.cells))])if(ruleLabels[cell.rule]){cell.ruleId=cell.rule;cell.rule=ruleLabels[cell.rule];}
  return {version:1,year,consultedAt,sources:[{id:'google_requests',authority:'Google Sheets',workbook:WORKBOOK,sheet:REQUEST_SHEET,dateColumn:'J',statusColumn:'Y'},
    {id:'google_loans',authority:'Google Sheets',workbook:WORKBOOK,sheet:LOAN_SHEET,dateColumn:'A',amountColumn:'B'},
    {id:'supabase_savings',authority:'Supabase',reader:'get_admin_reports_jc_savings'}],summary,records,issues,sheets,
    coverage:{savings:savings.coverage,zeroInstallmentsExcluded:zeroInstallments,paidInstallments,scheduledInstallments,resolvedPayrollProcesses,sourceRows:{requests:requests.length-1,loans:loans.length-1}}};
}

// Fixed, minimal, unbounded column ranges. Google is never sent a write request.
export const GOOGLE_RANGES=Object.freeze(["'Historial de solicitudes'!A:B","'Historial de solicitudes'!D:E","'Historial de solicitudes'!J:J","'Historial de solicitudes'!Y:Z","'HISTORIAL P V2'!A:D","'HISTORIAL P V2'!F:G"]);
export async function readGoogle(env,fetcher=fetch){
  let assertion;try{assertion=await createReadOnlyAssertion(env);}catch(_){throw new ReportError('GOOGLE_NOT_CONFIGURED');}
  try{
    const auth=await fetcher(TOKEN_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({assertion,grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer'}),signal:AbortSignal.timeout(15000)});
    const token=await auth.json();if(!auth.ok||typeof token.access_token!=='string')throw new ReportError('GOOGLE_AUTH_FAILED');
    const query=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});for(const range of GOOGLE_RANGES)query.append('ranges',range);
    const response=await fetcher('https://sheets.googleapis.com/v4/spreadsheets/'+WORKBOOK+'/values:batchGet?'+query,{method:'GET',headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(45000)});
    if(!response.ok){
      let reason='';try{const error=await response.json();reason=String(error.error?.status||'').replace(/[^A-Z_]/g,'').slice(0,80);}catch(_){}
      throw new ReportError(response.status===403?'GOOGLE_ACCESS_DENIED':'GOOGLE_UNAVAILABLE',{googleStatus:response.status,googleReason:reason});
    }
    const data=await response.json();if(data.spreadsheetId!==WORKBOOK||!Array.isArray(data.valueRanges)||data.valueRanges.length!==GOOGLE_RANGES.length)throw new ReportError('GOOGLE_RESPONSE_INVALID');
    const requests=[],loans=[],targets=[[requests,0],[requests,3],[requests,9],[requests,24],[loans,0],[loans,5]];
    data.valueRanges.forEach((range,index)=>{if(!Array.isArray(range.values))throw new ReportError('GOOGLE_RESPONSE_INVALID');const [target,column]=targets[index];range.values.forEach((row,i)=>{if(!Array.isArray(row))throw new ReportError('GOOGLE_RESPONSE_INVALID');target[i]??=[];row.forEach((value,c)=>target[i][column+c]=value);});});
    return {requests:Array.from(requests,r=>r||[]),loans:Array.from(loans,r=>r||[])};
  }catch(error){if(error instanceof ReportError)throw error;throw new ReportError('GOOGLE_UNAVAILABLE');}
}
async function context(client){
  const auth=await client.auth.getUser();if(auth.error||!auth.data?.user)throw new ReportError('AUTH_REQUIRED');
  const result=await client.rpc('get_admin_reports_jc_context');
  if(result.error||!result.data||typeof result.data.actor!=='string'||result.data.actor!==auth.data.user.id||
    (result.data.session!==null&&typeof result.data.session!=='string'))throw new ReportError('ADMIN_DENIED');
  return result.data;
}
export async function loadReport(body,client,readSource,readTemplate,now=()=>new Date().toISOString()){
  if(!body||!['LOAD','TEMPLATE'].includes(body.action)||Object.keys(body).some(k=>!['action',...(body.action==='LOAD'?['year']:[])].includes(k))||body.action==='LOAD'&&(!Number.isInteger(body.year)||body.year<2000||body.year>2100))throw new ReportError('REQUEST_INVALID');
  const before=await context(client);let data;
  if(body.action==='TEMPLATE')data=await readTemplate();
  else{
    const [google,savingsResult]=await Promise.all([readSource(),client.rpc('get_admin_reports_jc_savings',{p_year:body.year})]);
    if(savingsResult.error)throw new ReportError('SAVINGS_SOURCE_UNAVAILABLE');
    data=buildReport({year:body.year,...google,savings:savingsResult.data,consultedAt:now()});
  }
  const after=await context(client);if(JSON.stringify(before)!==JSON.stringify(after))throw new ReportError('CONTEXT_CHANGED');
  return {context:after,data};
}
