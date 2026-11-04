import {sourceDate,fundGroup,ReportError} from './report.mjs';
import {buildCashFlowSourceBases} from './cash-flow-source-bases.mjs';
import {reconcileSavingsCashFlow} from './cash-flow-savings.mjs';
import {consolidateCashFlow} from './cash-flow-consolidated.mjs';
import {cashFlowInputSnapshot} from './cash-flow-inputs.mjs';
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
 ['loan_placed','Capital colocado por fecha de solicitud','Caja de Ahorro','recorded'],
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
  if(!['contribution_scheduled','withdrawal_pending'].includes(e.kind)&&future){
   if(['withdrawal_partial','withdrawal_total','withdrawal_unspecified'].includes(e.kind)){record({...e,sourceId:e.source_id,date,status:'SCHEDULED'},'withdrawal_pending');issue('SAVINGS_FUTURE_RECORDED','Retiro registrado con fecha futura: se muestra como obligación programada, sin sumarlo como pagado.',[e.id],[],[inMonth(date)]);}
   else issue('SAVINGS_FUTURE_RECORDED','Un movimiento marcado como realizado tiene fecha futura; no se suma como recibido.',[e.id],[e.kind],[inMonth(date)]);
   continue;
  }
  if(e.kind==='withdrawal_pending'&&date&&(date<=asOf||!positions.has(inMonth(date)))){unassigned.push({...e,sourceId:e.source_id,date,overdue:date<=asOf,status:'PENDING'});continue;}
  if(e.status==='UNKNOWN'&&e.amount!=null)issue('SAVINGS_EVENT_REVIEW_NOTE','Importe registrado incluido; la revisión posterior no impide su consulta.',[e.id],[],date?[inMonth(date)]:[]);
  record({...e,sourceId:e.source_id,date,status:e.kind==='contribution_scheduled'?'SCHEDULED':e.kind==='withdrawal_pending'?'PENDING':'RECORDED'},e.kind);
  if(!date&&e.kind!=='withdrawal_pending')issue('SAVINGS_DATE_MISSING','Un importe registrado de Ahorro carece de fecha verificable.',[e.id],[e.kind]);
  if(e.kind==='contribution_mixed'&&date)issue('SAVINGS_MIXED_HISTORY','El histórico conserva aportación y rendimiento juntos; no se inventa su desglose.',[e.id],['contribution','yield_credited'],[inMonth(date)]);
  if(e.kind==='withdrawal_unspecified'&&date)issue('SAVINGS_WITHDRAWAL_KIND_MISSING','El retiro pagado se incluye sin clasificación parcial o total.',[e.id],[],[inMonth(date)]);
 }
 for(const i of savings.issues||[])issue(i.code,i.message,i.sourceIds||[],i.affectedKinds||[],i.months||[]);
 for(const m of months){const b=savings.balances.find(b=>inMonth(b.month)===m.key),c=byId.get('savings_balance').cells[positions.get(m.key)];c.cents=money(b?.known_amount??b?.amount)??0;c.missing=money(b?.amount)===null||m.key>current;c.applicable=m.key<=current;c.notes.push(m.key>current?'El saldo futuro no se presenta como dinero ya acumulado.':b?.unknown_count?'No existe un corte histórico completo para todas las cuentas.':'Saldo canónico al cierre; mes vigente al día de consulta.');}

 // Loan calculations are exclusively assembled by consolidateCashFlow.
 // This builder owns the savings inputs and monthly grid only.
 const loanCount=0;
 for(const row of rows)for(const c of row.cells){c.knownAmount=c.applicable?c.cents/100:null;c.amount=c.applicable&&!c.missing?c.cents/100:null;c.status=!c.applicable?'NOT_APPLICABLE':c.missing?(c.sourceIds.length||c.cents?'PARTIAL':'UNAVAILABLE'):row.kind==='scheduled'?'SCHEDULED':row.kind==='obligation'?'PENDING':'RECORDED';c.notes=[...new Set(c.notes)];delete c.cents;delete c.missing;delete c.applicable;}
 // Coalesce repeated limitations while retaining all traceable source rows.
 const grouped=new Map();for(const i of issues){const k=JSON.stringify([i.code,i.message,i.months,i.affectedKinds]);if(!grouped.has(k))grouped.set(k,{...i,sourceIds:[]});grouped.get(k).sourceIds.push(...i.sourceIds);}for(const i of grouped.values())i.sourceIds=[...new Set(i.sourceIds)];
 return {from,asOf,consultedAt,months,rows,records,issues:[...grouped.values()],unassigned,coverage:{loanCount,financialWrites:0,amortizationEngineActive:false,savingsAuthority:'SUPABASE',loanAuthority:'GOOGLE_HISTORIAL_P_V2'}};
}

async function context(client){const auth=await client.auth.getUser();if(auth.error||!auth.data?.user)throw new ReportError('AUTH_REQUIRED');const r=await client.rpc('get_admin_reports_jc_context');if(r.error||!r.data||r.data.actor!==auth.data.user.id||(r.data.session!==null&&typeof r.data.session!=='string'))throw new ReportError('ADMIN_DENIED');return r.data;}

// Export the same inputs that produced this response, never a later source query.
export function cashFlowSourceBases(source,savings,investors,approvals,resolved,consultedAt,report={}){
 return buildCashFlowSourceBases({source,savings,investors,approvals,resolved,consultedAt,report});
}
export function projectCashFlowSnapshot(snapshot){
 if(snapshot?.version!=='cash-flow-inputs-v1'||snapshot?.modelVersion!=='20261104-original-components-v1'||!validFrom(snapshot.from)||!Number.isFinite(Date.parse(snapshot.consultedAt)))throw new ReportError('CASH_FLOW_SOURCE_INVALID');
 const {source,savings,investors,from,consultedAt,sourceErrors}=snapshot;
 if(!source||!Array.isArray(source.loans)||!Array.isArray(source.requests))throw new ReportError('CASH_FLOW_SOURCE_INVALID');
 const base=reconcileSavingsCashFlow({base:buildCashFlow({from,loans:[source.loans[0]],savings,consultedAt}),savings});
 const data=consolidateCashFlow({base,loans:source.loans,requests:source.requests,investorsSource:investors,sourceErrors});
 data.sourceBases=cashFlowSourceBases(source,savings,investors,null,null,consultedAt,data);
 delete data.savingsSourceTable;delete data.savingsBridge;delete data.loanContracts;
 return data;
}
export async function loadCashFlow(body,client,readSource,now=()=>new Date().toISOString(),options={}){
 if(!body||body.action!=='CASH_FLOW'||!validFrom(body.from)||Object.keys(body).some(k=>!['action','from'].includes(k)))throw new ReportError('REQUEST_INVALID');
 const before=await context(client),consultedAt=now();
 const [source,r,investors]=await Promise.all([
  readSource(),client.rpc('get_admin_reports_jc_cash_flow',{p_from:body.from+'-01'}),
  client.rpc('get_admin_reports_jc_cash_flow_investors',{p_from:body.from+'-01'})
 ]);
 if(r.error)throw new ReportError('SAVINGS_SOURCE_UNAVAILABLE');
 if(!source||!Array.isArray(source.loans)||!Array.isArray(source.requests))throw new ReportError('CASH_FLOW_SOURCE_INVALID');
 const snapshot=cashFlowInputSnapshot({from:body.from,source,savings:r.data,investors:investors.error?null:investors.data,consultedAt,sourceErrors:{investors:investors.error?'INVESTOR_SOURCE_UNAVAILABLE':null}});
 const after=await context(client);
 if(JSON.stringify(before)!==JSON.stringify(after))throw new ReportError('CONTEXT_CHANGED');
 return {context:after,data:options.sourceSnapshot===true?snapshot:projectCashFlowSnapshot(snapshot)};
}
