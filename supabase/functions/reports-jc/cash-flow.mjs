import {sourceDate,fundGroup,ReportError} from './report.mjs';
const text=v=>String(v??'').trim();
const key=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const money=v=>typeof v==='number'&&Number.isFinite(v)&&Number.isSafeInteger(Math.round(v*100))&&Math.abs(v*100-Math.round(v*100))<.00001?Math.round(v*100):null;
const inMonth=d=>d?.slice(0,7);
function day(now){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)),v=t=>p.find(x=>x.type===t).value;return `${v('year')}-${v('month')}-${v('day')}`;}
export function validFrom(from){return typeof from==='string'&&/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(from);}
const DEFINITIONS=[
 ['contribution','Aportaciones recibidas','Ahorro Voluntario','recorded'],
 ['contribution_mixed','Importes históricos de aportación y rendimiento sin desglose','Ahorro Voluntario','recorded'],
 ['withdrawal_partial','Retiros parciales pagados','Ahorro Voluntario','recorded'],
 ['withdrawal_total','Retiros totales pagados','Ahorro Voluntario','recorded'],
 ['withdrawal_unspecified','Retiros pagados sin clasificación parcial / total','Ahorro Voluntario','recorded'],
 ['yield_credited','Rendimientos acreditados','Ahorro Voluntario','recorded'],
 ['adjustment','Ajustes registrados (importe neto)','Ahorro Voluntario','recorded'],
 ['savings_balance','Saldo acumulado al cierre / corte','Ahorro Voluntario','balance'],
 ['contribution_scheduled','Aportaciones futuras programadas','Ahorro Voluntario','scheduled'],
 ['withdrawal_pending','Retiros autorizados pendientes','Ahorro Voluntario','obligation'],
 ['loan_placed','Capital colocado según transferencia registrada','Caja de Ahorro','recorded'],
 ['loan_recovered','Recuperación total corroborada','Caja de Ahorro','recorded'],
 ['loan_principal','Capital recuperado','Caja de Ahorro','recorded'],
 ['loan_interest','Intereses recuperados','Caja de Ahorro','recorded'],
 ['loan_admin','Gasto administrativo recuperado','Caja de Ahorro','recorded'],
 ['loan_pending','Capital pendiente de recuperar','Caja de Ahorro','balance'],
 ['loan_scheduled','Recuperación futura programada','Caja de Ahorro','scheduled']
];

export function buildCashFlow({from,loans,savings,consultedAt=new Date().toISOString()}){
 if(!validFrom(from)||!Array.isArray(loans)||!savings||!Array.isArray(savings.events)||!Array.isArray(savings.balances))throw new ReportError('CASH_FLOW_SOURCE_INVALID');
 const asOf=day(consultedAt),current=asOf.slice(0,7),[year,month]=from.split('-').map(Number);
 const months=Array.from({length:12},(_,i)=>{const d=new Date(Date.UTC(year,month-1+i,1));return {key:d.toISOString().slice(0,7),label:new Intl.DateTimeFormat('es-MX',{timeZone:'UTC',month:'short',year:'numeric'}).format(d)};});
 const positions=new Map(months.map((m,i)=>[m.key,i])),records=[],issues=[],unassigned=[];
 const rows=DEFINITIONS.map(([id,label,group,kind])=>({id,label,group,kind,cells:months.map(m=>({amount:0,knownAmount:0,status:kind==='scheduled'?'SCHEDULED':'RECORDED',sourceIds:[],notes:[],cents:0,missing:false,applicable:!(kind==='recorded'&&m.key>current||kind==='scheduled'&&m.key<current)}))}));
 const byId=new Map(rows.map(r=>[r.id,r]));
 function issue(code,message,sourceIds=[],affectedKinds=[],affectedMonths=[]){if(affectedMonths.length&&!affectedMonths.some(m=>positions.has(m)))return;issues.push({code,message,sourceIds,months:affectedMonths,affectedKinds});for(const id of affectedKinds)for(const [i,m]of months.entries())if(!affectedMonths.length||affectedMonths.includes(m.key)){const c=byId.get(id)?.cells[i];if(c){c.missing=true;c.notes.push(message);}}}
 function record(entry,rowId){
  const r={...entry,kind:rowId};const pos=positions.get(inMonth(r.date));
  if(pos===undefined){if(!r.date)unassigned.push(r);return;}
  records.push(r);const c=byId.get(rowId)?.cells[pos];if(!c)return;
  c.sourceIds.push(r.id);const n=money(r.amount);
  if(n===null){c.missing=true;c.notes.push('El registro no tiene un importe determinado.');}else c.cents+=n;
 }
 const seen=new Map(),conflicts=new Set();
 for(const e of savings.events){if(!e?.id||!byId.has(e.kind)||!DEFINITIONS.some(d=>d[0]===e.kind&&d[2]==='Ahorro Voluntario'))throw new ReportError('CASH_FLOW_SOURCE_INVALID');const old=seen.get(e.id);if(old&&JSON.stringify(old)!==JSON.stringify(e))conflicts.add(e.id);else seen.set(e.id,e);}
 for(const e of seen.values()){
  if(conflicts.has(e.id)){issue('SAVINGS_EVENT_CONFLICT','Un registro de Ahorro tiene versiones contradictorias en la consulta.',[e.id],[e.kind],e.date?[inMonth(e.date)]:[]);continue;}
  const date=sourceDate(e.date),future=date&&date>asOf;
  if(e.kind==='contribution_scheduled'&&!future)continue;
  if(!['contribution_scheduled','withdrawal_pending'].includes(e.kind)&&future){issue('SAVINGS_FUTURE_RECORDED','Un movimiento marcado como realizado tiene fecha futura; no se suma como recibido.',[e.id],[e.kind],[inMonth(date)]);continue;}
  if(e.kind==='withdrawal_pending'&&date&&(date<=asOf||!positions.has(inMonth(date)))){unassigned.push({...e,sourceId:e.source_id,date,overdue:date<=asOf,status:'PENDING'});continue;}
  if(e.status==='UNKNOWN'&&e.amount!=null){issue('SAVINGS_EVENT_UNRESOLVED','El importe está registrado, pero su aplicación requiere aclaración.',[e.id],[e.kind],date?[inMonth(date)]:[]);continue;}
  record({...e,sourceId:e.source_id,date,status:e.kind==='contribution_scheduled'?'SCHEDULED':e.kind==='withdrawal_pending'?'PENDING':'RECORDED'},e.kind);
  if(!date&&e.kind!=='withdrawal_pending')issue('SAVINGS_DATE_MISSING','Un importe registrado de Ahorro carece de fecha verificable.',[e.id],[e.kind]);
  if(e.kind==='contribution_mixed'&&date)issue('SAVINGS_MIXED_HISTORY','El histórico conserva aportación y rendimiento juntos; no se inventa su desglose.',[e.id],['contribution','yield_credited'],[inMonth(date)]);
  if(e.kind==='withdrawal_unspecified'&&date)issue('SAVINGS_WITHDRAWAL_KIND_MISSING','El retiro pagado no distingue parcial o total.',[e.id],['withdrawal_partial','withdrawal_total'],[inMonth(date)]);
 }
 for(const i of savings.issues||[])issue(i.code,i.message,i.sourceIds||[],i.affectedKinds||[],i.months||[]);
 for(const m of months){const b=savings.balances.find(b=>inMonth(b.month)===m.key),c=byId.get('savings_balance').cells[positions.get(m.key)];c.cents=money(b?.known_amount??b?.amount)??0;c.missing=money(b?.amount)===null||m.key>current;c.applicable=m.key<=current;c.notes.push(m.key>current?'El saldo futuro no se presenta como dinero ya acumulado.':b?.unknown_count?'No existe un corte histórico completo para todas las cuentas.':'Saldo canónico al cierre; mes vigente al día de consulta.');}

 const headers={0:'Fecha',1:'Cuotas',2:'ID',3:'Folio',6:'Fondo',8:'Plazo',9:'Cantidad Prestamo',10:'Total a pagar',18:'X',30:'Fecha Transferencia'};
 if(!loans[0]||Object.entries(headers).some(([c,v])=>key(loans[0][c])!==key(v)))throw new ReportError('SOURCE_HEADERS_INVALID',{sheet:'HISTORIAL P V2'});
 const groups=new Map();let loanCount=0;
 loans.slice(1).forEach((v,i)=>{if(!v.some(x=>x!==''&&x!==null&&x!==undefined))return;const C=text(v[2]),D=text(v[3]),group=fundGroup(v[6]);if(!C||!D){if(group==='loanSavings')issue('LOAN_IDENTITY_MISSING','Un préstamo de Caja de Ahorro carece de ID o folio.',['pv2:'+(i+2)],['loan_recovered','loan_scheduled','loan_placed']);return;}const id=JSON.stringify([C,D]);if(!groups.has(id))groups.set(id,[]);groups.get(id).push({v,row:i+2,C,D,group});});
 for(const group of groups.values()){
  if(!group.some(r=>r.group==='loanSavings'))continue;loanCount++;const sourceIds=group.map(r=>'pv2:'+r.row),first=group[0];
  const flag=(code,message,ids=['loan_recovered','loan_scheduled','loan_placed'])=>issue(code,message,sourceIds,ids);
  if(group.some(r=>r.group!=='loanSavings')){flag('LOAN_FUND_CONFLICT','Un mismo ID y folio tiene fondos contradictorios.');continue;}
  const installments=new Set();
  if(group.some(r=>!Number.isSafeInteger(r.v[18])||r.v[18]<1||installments.has(r.v[18])||(installments.add(r.v[18]),false))){flag('LOAN_INSTALLMENT_AMBIGUOUS','Hay cuotas repetidas o sin número verificable; el préstamo se excluye de las sumas identificadas.');continue;}
  for(const r of group){const date=sourceDate(r.v[0]),amount=money(r.v[1]),rowId=date&&date>asOf?'loan_scheduled':'loan_recovered';
   if(!date){flag('LOAN_PAYMENT_DATE_MISSING','Una cuota no tiene fecha válida; no se decide si es cobrada o futura.',['loan_recovered','loan_scheduled']);continue;}
   if(amount===null||amount<0){issue('LOAN_PAYMENT_INVALID','Una cuota no contiene un importe monetario válido.',['pv2:'+r.row],[rowId],[inMonth(date)]);continue;}
   record({id:'pv2:'+r.row,source:'HISTORIAL P V2',sourceId:'Fila '+r.row,date,amount:amount/100,status:date<=asOf?'RECORDED':'SCHEDULED',loanId:r.C,folio:r.D},rowId);
   if(date<=asOf&&amount>0)issue('LOAN_BREAKDOWN_NOT_CERTIFIED','La recuperación total está corroborada; su desglose efectivo de capital, intereses y administración no está acreditado en las columnas legacy.',['pv2:'+r.row],['loan_principal','loan_interest','loan_admin'],[inMonth(date)]);
  }
  const principal=money(first.v[9]),total=money(first.v[10]);
  if(principal===null||principal<0||total===null||total<principal||group.some(r=>money(r.v[9])!==principal||money(r.v[10])!==total)){flag('LOAN_TERMS_CONFLICT','El capital o total contractual no es uniforme en las cuotas.',['loan_placed','loan_pending']);continue;}
  const rawDates=group.map(r=>r.v[30]).filter(v=>v!==''&&v!==null&&v!==undefined),dates=[...new Set(rawDates.map(sourceDate))];
  if(dates.length!==1||dates[0]===null){flag('LOAN_TRANSFER_DATE_UNRESOLVED','Capital registrado sin una fecha de transferencia única verificable. No se utiliza la fecha de aprobación.',['loan_placed']);unassigned.push({id:'loan-capital:'+first.C+':'+first.D,kind:'loan_placed',amount:principal/100,loanId:first.C,folio:first.D,source:'HISTORIAL P V2',sourceIds,date:null});}
  else if(dates[0]<=asOf)record({id:'loan-capital:'+first.C+':'+first.D,source:'HISTORIAL P V2',sourceId:'Contrato '+first.C+' / '+first.D,date:dates[0],amount:principal/100,status:'RECORDED',loanId:first.C,folio:first.D},'loan_placed');
  else issue('LOAN_TRANSFER_FUTURE','La fecha de transferencia registrada es futura; el capital no se cuenta como colocado.',sourceIds,['loan_placed'],[inMonth(dates[0])]);
  // With no certified allocation, cash containing yield cannot be subtracted
  // from contractual principal. A zero cash month does not establish a balance.
 }
 if(loanCount)issue('LOAN_PRINCIPAL_PENDING_UNAVAILABLE','No se puede obtener capital pendiente restando cobros brutos: falta el desglose efectivo acreditado.',[],['loan_pending']);
 for(const id of ['loan_recovered','loan_scheduled'])for(const [i,c]of byId.get(id).cells.entries())if(c.missing)for(const component of ['loan_principal','loan_interest','loan_admin']){const target=byId.get(component).cells[i];if(id==='loan_recovered'){target.missing=true;target.notes.push('La recuperación del mes tiene registros sin determinar.');}}
 for(const row of rows)for(const c of row.cells){c.knownAmount=c.applicable?c.cents/100:null;c.amount=c.applicable&&!c.missing?c.cents/100:null;c.status=!c.applicable?'NOT_APPLICABLE':c.missing?(c.sourceIds.length||c.cents?'PARTIAL':'UNAVAILABLE'):row.kind==='scheduled'?'SCHEDULED':row.kind==='obligation'?'PENDING':'RECORDED';c.notes=[...new Set(c.notes)];delete c.cents;delete c.missing;delete c.applicable;}
 // Coalesce repeated limitations while retaining all traceable source rows.
 const grouped=new Map();for(const i of issues){const k=JSON.stringify([i.code,i.message,i.months,i.affectedKinds]);if(!grouped.has(k))grouped.set(k,{...i,sourceIds:[]});grouped.get(k).sourceIds.push(...i.sourceIds);}for(const i of grouped.values())i.sourceIds=[...new Set(i.sourceIds)];
 return {from,asOf,consultedAt,months,rows,records,issues:[...grouped.values()],unassigned,coverage:{loanCount,financialWrites:0,amortizationEngineActive:false,savingsAuthority:'SUPABASE',loanAuthority:'GOOGLE_HISTORIAL_P_V2'}};
}

async function context(client){const auth=await client.auth.getUser();if(auth.error||!auth.data?.user)throw new ReportError('AUTH_REQUIRED');const r=await client.rpc('get_admin_reports_jc_context');if(r.error||!r.data||r.data.actor!==auth.data.user.id||(r.data.session!==null&&typeof r.data.session!=='string'))throw new ReportError('ADMIN_DENIED');return r.data;}
export async function loadCashFlow(body,client,readSource,now=()=>new Date().toISOString()){
 if(!body||body.action!=='CASH_FLOW'||!validFrom(body.from)||Object.keys(body).some(k=>!['action','from'].includes(k)))throw new ReportError('REQUEST_INVALID');
 const before=await context(client),consultedAt=now();
 const [loans,r]=await Promise.all([readSource(),client.rpc('get_admin_reports_jc_cash_flow',{p_from:body.from+'-01'})]);
 if(r.error)throw new ReportError('SAVINGS_SOURCE_UNAVAILABLE');
 const data=buildCashFlow({from:body.from,loans,savings:r.data,consultedAt}),after=await context(client);
 if(JSON.stringify(before)!==JSON.stringify(after))throw new ReportError('CONTEXT_CHANGED');
 return {context:after,data};
}
