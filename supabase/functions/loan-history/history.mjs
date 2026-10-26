export class HistoryError extends Error {}
const fail=code=>{throw new HistoryError('HISTORY_'+code);};
const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const day=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v?v:null;};
const instant=v=>typeof v==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?v:null;
export function businessDay(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
export function category(status,approvedAt,now){
 const s=norm(status);
 if(['LIQUIDADO','PAGO DE MAS'].includes(s))return 'Liquidadas';
 const approved=instant(approvedAt),elapsed=approved?Date.parse(now)-Date.parse(approved):Infinity;
 if(elapsed>=0&&elapsed<86400000)return 'Aprobadas';
 return ['AL CORRIENTE','SALDO ATRASADO'].includes(s)?'En pago':'Estado por revisar';
}
// Confirmed native approval is independent of the published Google schedule.
// Only allowlisted immutable card fields leave this own authenticated context.
export function projectApprovals(context){
 if(!context?.actor||!context.affiliate_id||!context.folio||!instant(context.server_now)||!Array.isArray(context.requests))fail('SOURCE_INVALID');
 const identities=new Set(),ids=new Set(),approvals=[];
 for(const r of context.requests){
  if(identities.has(r.folio)||ids.has(r.id))fail('REQUEST_IDENTITY_AMBIGUOUS');
  identities.add(r.folio);ids.add(r.id);
  const approved=instant(r.approved_at),display=r.approval_display;
  if(r.financial!==true||r.status!=='approved'||!approved||Date.parse(approved)>Date.parse(context.server_now)||!/^SR-/.test(r.folio)||!display||typeof display!=='object'||Array.isArray(display))continue;
  approvals.push({id:r.folio,sourceId:r.id,approved_at:approved,expires_at:new Date(Date.parse(approved)+86400000).toISOString(),
   fund:typeof display.fund==='string'&&display.fund?display.fund:'Solicitud de financiamiento',principal:money(display.principal),
   total:money(display.total),term:money(display.term),date:instant(r.created_at)?businessDay(r.created_at):null});
 }
 return approvals;
}
export function projectHistory(source,context,now){
 if(!instant(now)||!context?.folio||!Array.isArray(context.requests)||!Array.isArray(source?.loans)||!Array.isArray(source?.requests)||source.folio!==context.folio)fail('SOURCE_INVALID');
 const today=businessDay(now),bySr=new Map(),byLoan=new Map(),groups=new Map(),entries=[],covered=new Set();
 for(const r of context.requests){if(bySr.has(r.folio))fail('REQUEST_IDENTITY_AMBIGUOUS');bySr.set(r.folio,r);}
 const sourceRequestCounts=new Map();
 for(const r of source.requests){
  if(r.owner!==context.folio)fail('SOURCE_IDENTITY_MISMATCH');
  if(r.id)sourceRequestCounts.set(r.id,(sourceRequestCounts.get(r.id)||0)+1);
 }
 for(const r of source.requests){
  // Only SR requests or a transfer receipt can contribute a request card or
  // approval link. Keep all other rows in the observation without letting
  // blank/numeric historical request IDs suppress valid PV2 loans.
  if(r.receipt==null&&!/^SR-/.test(r.id))continue;
  // Count every occurrence before filtering: a relevant receipt must still
  // fail closed if an otherwise irrelevant row reuses its current loan ID.
  if(!r.id||sourceRequestCounts.get(r.id)!==1)fail('REQUEST_IDENTITY_AMBIGUOUS');
  let original=/^SR-/.test(r.id)?r.id:null;
  if(r.receipt!=null){
   if(String(r.receipt.id)!==r.id||typeof r.receipt.identity!=='string'||
    !(/^SR-/.test(r.receipt.identity)||/^[0-9]+$/.test(r.receipt.identity))||!/^[a-f0-9]{64}$/i.test(r.receipt.sourceHash||''))fail('TRANSFER_IDENTITY_INVALID');
   // The historical transfer writer also accepts numeric original request IDs.
   // Preserve that receipt, but only an actual SR identity can link the app's
   // approval timestamp. Never coerce a numeric identity into a Folio or SR.
   original=/^SR-/.test(r.receipt.identity)?r.receipt.identity:null;
   if(byLoan.has(r.id))fail('TRANSFER_IDENTITY_INVALID');
   byLoan.set(r.id,original?bySr.get(original)||null:null);
  }
  const request=original?bySr.get(original):null;
  const s=norm(r.status);
  // A pending SR row is visible before Finance marks the native request.
  // Keep nonfinancial approval links disabled and native tracking via sourceId.
  if(request&&request.financial===false){byLoan.delete(r.id);if(!(/^SR-/.test(r.id)&&s==='PENDIENTE'))continue;}
  if(request)covered.add(request.id);
  if(/^SR-/.test(r.id)&&['PENDIENTE','RECHAZADO'].includes(s))entries.push({
   key:'request:'+r.id,id:r.id,sourceId:request?.id||null,kind:'request',category:s==='PENDIENTE'?'En proceso':'No aprobadas',
   fund:r.fund||'Solicitud de financiamiento',principal:money(r.principal),total:money(r.total),term:money(r.term),
   date:day(r.date),approved_at:null,expires_at:null,status:r.status,schedule:[]});
  // Approval survives the brief asynchronous transfer/generation interval.
  if(['APROBADO','INICIADO'].includes(s)&&request?.approved_at)byLoan.set(r.id,request);
 }
 for(const r of source.loans){
  if(r.owner!==context.folio)fail('SOURCE_IDENTITY_MISMATCH');
  if(typeof r.id!=='string'||!r.id)fail('LOAN_IDENTITY_INVALID');
  if(!groups.has(r.id))groups.set(r.id,[]);groups.get(r.id).push(r);
 }
 for(const [id,rows] of groups){
  const first=rows[0],uniform=k=>rows.every(r=>r[k]===first[k])?first[k]:null;
  const status=rows.every(r=>norm(r.status)===norm(first.status))?first.status:null;
  const request=byLoan.get(id),approved=instant(request?.approved_at),bucket=category(status,approved,now);
  const schedule=rows.map(r=>({source_row:r.source_row,number:Number.isInteger(r.number)&&r.number>0?r.number:null,
   date:day(r.date),amount:money(r.amount),scheduled:money(r.scheduled),
   state:day(r.date)?r.date>today?'Pendiente':r.amount===0?'No se descontó':money(r.amount)!==null?'Pagada':'Importe por revisar':'Fecha por revisar'}))
   .sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.number??Infinity)-(b.number??Infinity)||a.source_row-b.source_row);
  entries.push({key:'loan:'+id,id,sourceId:request?.id||null,kind:'loan',fund:uniform('fund')||'Financiamiento',
   principal:money(uniform('principal')),total:money(uniform('total')),term:money(uniform('term')),date:day(uniform('authorized'))||schedule[0]?.date||null,
   status,category:bucket,approved_at:approved,expires_at:approved?new Date(Date.parse(approved)+86400000).toISOString():null,
   paid_to_date:money(uniform('paid_to_date')),expected_to_date:money(uniform('expected_to_date')),schedule});
 }
 for(const r of source.requests){
  const request=byLoan.get(r.id);if(groups.has(r.id)||!request||!['APROBADO','INICIADO'].includes(norm(r.status)))continue;
  const approved=instant(request.approved_at);if(!approved)continue;
  entries.push({key:'request:'+r.id,id:r.id,sourceId:request.id,kind:'loan',fund:r.fund||'Financiamiento',principal:money(r.principal),
   total:money(r.total),term:money(r.term),date:day(r.date),status:null,
   category:Date.parse(now)>=Date.parse(approved)&&Date.parse(now)<Date.parse(approved)+86400000?'Aprobadas':'Estado por revisar',
   approved_at:approved,expires_at:new Date(Date.parse(approved)+86400000).toISOString(),schedule:[],preparing:true});
 }
 return {version:1,server_now:now,business_day:today,entries:entries.sort((a,b)=>(b.approved_at||b.date||'').localeCompare(a.approved_at||a.date||'')||b.id.localeCompare(a.id)),
  covered_request_ids:[...covered],financial_request_ids:context.requests.filter(r=>r.financial).map(r=>r.id)};
}
export async function loadHistory(body,client,readSource){
 if(!body||typeof body!=='object'||Array.isArray(body)||!['LOAD','SUMMARY','DETAIL'].includes(body.action))fail('REQUEST_INVALID');
 const detail=body.action==='DETAIL';
 if(Object.keys(body).some(k=>k!=='action'&&!(detail&&k==='key'))||
   detail&&(typeof body.key!=='string'||!/^(?:loan|request):[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(body.key)))fail('REQUEST_INVALID');
 const auth=await client.auth.getUser();if(auth.error||!auth.data?.user)fail('AUTH_REQUIRED');
 async function context(){const result=await client.rpc('get_self_loan_history_context');if(result.error||!result.data||result.data.actor!==auth.data.user.id)fail('IDENTITY_DENIED');return result.data;}
 const before=await context();
 const source=await readSource(before.folio);
 const after=await context();
 if(before.actor!==after.actor||before.affiliate_id!==after.affiliate_id||before.folio!==after.folio)fail('CONTEXT_CHANGED');
 const history=projectHistory(source,after,after.server_now);
 // LOAD remains compatible with already-open clients. New lists transfer only
 // card data; the existing owned source is revalidated when detail is opened.
 if(body.action==='SUMMARY')return {...history,entries:history.entries.map(entry=>{
  const {key,id,sourceId,kind,category,fund,principal,term,date,status,approved_at,expires_at}=entry;
  return {key,id,sourceId,kind,category,fund,principal,term,date,status,approved_at,expires_at,
   ...(entry.preparing?{preparing:true}:{})};
 })};
 if(detail){
  const entries=history.entries.filter(entry=>entry.key===body.key),ids=new Set(entries.map(entry=>entry.sourceId).filter(Boolean));
  return {...history,entries,covered_request_ids:history.covered_request_ids.filter(id=>ids.has(id)),
   financial_request_ids:history.financial_request_ids.filter(id=>ids.has(id))};
 }
 return history;
}
