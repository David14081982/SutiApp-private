// Read-only report derivations. Contract snapshots, rates and movements remain in Inversores.
import {ReportError,sourceDate} from './report.mjs';

export const INVESTOR_DEFINITIONS=Object.freeze([
 ['investor_contribution','Capital recibido de inversionistas','recorded',true],
 ['investor_capital_balance','Capital vigente pendiente de devolver','balance',false],
 ['investor_yield_generated','Rendimientos contractuales generados','recorded',false],
 ['investor_yield_paid','Rendimientos efectivamente pagados','recorded',true],
 ['investor_yield_pending','Rendimientos generados pendientes de pago','balance',false],
 ['investor_capital_return','Devoluciones de capital registradas','recorded',true],
 ['investor_capital_scheduled','Devoluciones de capital programadas / vencimiento','scheduled',false],
 ['investor_yield_scheduled','Rendimientos programados pendientes de pago','scheduled',false],
 ['investor_other','Otros movimientos de efectivo (neto)','recorded',true],
 ['investor_adjustment','Ajustes de capital (no son flujo de efectivo)','recorded',false],
 ['investor_net','Flujo neto de efectivo con inversionistas','net',false]
].map(([id,label,kind,cashFlow])=>Object.freeze({id,label,group:'Inversores',kind,unit:'MXN',cashFlow})));

const CASH=['investor_contribution','investor_yield_paid','investor_capital_return','investor_other','investor_net'];
const amount=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v)*100)<=Number.MAX_SAFE_INTEGER&&Math.abs(Number(v)*100-Math.round(Number(v)*100))<0.00001?Math.round(Number(v)*100):null;
const month=d=>d?.slice(0,7),date=v=>sourceDate(v);
function unique(items){const map=new Map();for(const item of items){if(!item?.id)throw new ReportError('INVESTORS_SOURCE_INVALID');const old=map.get(item.id);if(old&&JSON.stringify(old)!==JSON.stringify(item))throw new ReportError('INVESTORS_SOURCE_CONFLICT');map.set(item.id,item);}return [...map.values()];}
function monthEnd(value){const [y,m]=value.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
function anniversary(start,n){const [y,m,d]=start.split('-').map(Number),last=new Date(Date.UTC(y,m-1+n+1,0));return new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth(),Math.min(d,last.getUTCDate()))).toISOString().slice(0,10);}

export function buildInvestorCashFlow({from,source,asOf=source?.as_of}){
 if(!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(from||'')||!date(asOf)||!source||!['contracts','movements','obligations','balances','reviews'].every(k=>Array.isArray(source[k])))throw new ReportError('INVESTORS_SOURCE_INVALID');
 if(source.as_of!==asOf)throw new ReportError('INVESTORS_CUT_CHANGED');
 const [year,startMonth]=from.split('-').map(Number),months=Array.from({length:12},(_,i)=>new Date(Date.UTC(year,startMonth-1+i,1)).toISOString().slice(0,7));
 const positions=new Set(months),contracts=unique(source.contracts),byContract=new Map(contracts.map(c=>[c.id,c])),movements=unique(source.movements).filter(m=>!m.voided&&!m.superseded),obligations=unique(source.obligations).filter(o=>!o.cancelled);
 const events=[],balances=[],records=[],issues=[],unassigned=[],seenEvents=new Set(),unknownYieldFrom=new Map();
 const unknownPending=(contractId,end)=>{const d=end||'0001-01-01',old=unknownYieldFrom.get(contractId);if(!old||d<old)unknownYieldFrom.set(contractId,d);};
 const issue=(code,message,sourceIds,affectedKinds,affectedMonths=[])=>{
  const selected=affectedMonths.filter(m=>positions.has(m));if(affectedMonths.length&&!selected.length)return;
  issues.push({code,message,sourceIds:[...new Set(sourceIds)],affectedKinds:[...new Set(affectedKinds)],months:[...new Set(selected)]});
 };
 const emit=(entry)=>{if(seenEvents.has(entry.id))return;seenEvents.add(entry.id);const e={source:'Supabase · Inversores',sourceId:entry.sourceId||entry.id,...entry};if(e.date&&positions.has(month(e.date)))events.push(e);else if(!e.date||e.status==='PENDING')unassigned.push(e);};
 const validMovements=[];
 for(const m of movements){
  const c=byContract.get(m.contract_id),d=date(m.effective_on),n=amount(m.amount);
  const kind={contribution:'investor_contribution',withdrawal:'investor_capital_return',yield:'investor_yield_paid',other:'investor_other',adjustment:'investor_adjustment'}[m.concept];
  if(!c||!kind||!d||n===null||n<=0||!['in','out'].includes(m.direction)||(m.concept==='contribution'&&m.direction!=='in')||(['withdrawal','yield'].includes(m.concept)&&m.direction!=='out')){
   issue('INVESTOR_MOVEMENT_UNRESOLVED','Un movimiento carece de identidad, fecha, dirección o importe verificable.',[m.id],kind?[kind,...(kind==='investor_adjustment'?[]:['investor_net'])]:CASH,d?[month(d)]:[]);continue;
  }
  if(d>asOf){issue('INVESTOR_FUTURE_MOVEMENT','Un movimiento con fecha futura no se considera efectivo realizado.',[m.id],[kind,...(kind==='investor_adjustment'?[]:['investor_net'])],[month(d)]);continue;}
  validMovements.push({...m,date:d,cents:n});
  const signed=m.direction==='in'?n:-n;
  emit({id:'investor-movement:'+m.id,sourceId:m.id,kind,date:d,amount:(['investor_other','investor_adjustment'].includes(kind)?signed:n)/100,status:'RECORDED',contractId:c.id,contractCode:c.code,direction:m.direction,obligationId:m.obligation_id||null,periodStart:m.period_start,periodEnd:m.period_end});
  if(kind==='investor_capital_return')issue('INVESTOR_RETURN_TYPE_UNSPECIFIED','La devolución está registrada, pero la fuente no clasifica el movimiento como parcial o total; se presenta el total conjunto.',[m.id],[],[month(d)]);
  if(kind!=='investor_adjustment')emit({id:'investor-net:'+m.id,sourceId:m.id,kind:'investor_net',date:d,amount:signed/100,status:'RECORDED',contractId:c.id,derived:true,basis:'Movimientos de efectivo vigentes; excluye ajustes de capital.'});
 }
 const obligationRecords=[],scheduledPeriods=[];
 for(const o of obligations){
  const c=byContract.get(o.contract_id),start=date(o.period_start),end=date(o.period_end),due=date(o.due_on),n=amount(o.amount),linked=validMovements.filter(m=>m.obligation_id===o.id);
  const kind=o.concept==='yield'?'investor_yield_scheduled':o.concept==='capital'?'investor_capital_scheduled':null;
  if(!c||!start||!end||end<=start||!due||n===null||n<0||!['yield','capital','other'].includes(o.concept)){
   if(c&&o.concept==='yield')unknownPending(c.id,end);
   issue('INVESTOR_OBLIGATION_UNRESOLVED','Una obligación no tiene período, vencimiento o importe verificable.',[o.id],kind?[kind]:['investor_yield_scheduled','investor_capital_scheduled'],due?[month(due)]:[]);
   if(o.concept==='yield')issue('INVESTOR_GENERATED_AMOUNT_UNRESOLVED','La obligación no permite determinar el rendimiento generado al cierre del período.',[o.id],['investor_yield_generated'],end?[month(end)]:[]);
   continue;
  }
  scheduledPeriods.push({contractId:c.id,concept:o.concept,start,end});
  const trace={contractId:c.id,contractCode:c.code,periodStart:start,periodEnd:end,dueOn:due,rateSnapshot:o.rate_snapshot,principalBasis:o.principal_basis,origin:o.origin,historyComplete:c.history_complete};
  if(o.concept==='yield'&&end<=asOf)emit({id:'investor-generated:'+o.id,sourceId:o.id,kind:'investor_yield_generated',date:end,amount:n/100,status:'RECORDED',...trace,basis:'Obligación contractual vigente al cierre de su período; no es un pago.'});
  const paid=linked.reduce((sum,m)=>sum+m.cents,0),expectedConcept={yield:'yield',capital:'withdrawal',other:'other'}[o.concept];
  if(linked.some(m=>m.contract_id!==o.contract_id||m.concept!==expectedConcept||m.direction!=='out')||paid>n||amount(o.paid)!==paid){
   if(o.concept==='yield')unknownPending(c.id,end);
   issue('INVESTOR_OBLIGATION_PAYMENT_CONFLICT','Los pagos vinculados no cuadran con la obligación vigente; el pendiente no se calcula por suposición.',[o.id,...linked.map(m=>m.id)],o.concept==='yield'?['investor_yield_pending','investor_yield_scheduled']:['investor_capital_scheduled'],[month(due)]);continue;
  }
  const item={...o,start,end,due,cents:n,paidCents:paid,linked};obligationRecords.push(item);
  if(kind&&n>paid)emit({id:'investor-obligation:'+o.id,sourceId:o.id,kind,date:due,amount:(n-paid)/100,status:due>asOf?'SCHEDULED':'PENDING',...trace,overdue:due<asOf,basis:'Importe contractual guardado menos pagos vinculados vigentes.'});
  if(o.concept==='other'&&n>paid)issue('INVESTOR_OTHER_OBLIGATION','Existe una obligación de otro concepto; no se reclasifica como rendimiento o devolución.',[o.id],['investor_capital_scheduled','investor_yield_scheduled'],[month(due)]);
 }
 for(const c of contracts){
  const start=date(c.starts_on),end=date(c.ends_on),observed=date(c.balance_on),id='investor-contract:'+c.id;
  const historyMonths=months.filter(m=>m<=month(asOf)&&(!start||monthEnd(m)>=start)&&(!observed||m+'-01'<observed));
  if(!c.history_complete&&historyMonths.length)issue('INVESTOR_HISTORY_NOT_DATED','El histórico contiene saldos o contratos, pero no un libro completo de aportaciones y pagos con fecha; el saldo de apertura no es efectivo recibido.',[id],CASH,historyMonths);
  const generatedMissing=historyMonths;
  if(!c.history_complete&&generatedMissing.length)issue('INVESTOR_GENERATED_HISTORY_INCOMPLETE','No se reconstruyen rendimientos históricos con la tasa actual; faltan obligaciones originales fechadas.',[id],['investor_yield_generated'],generatedMissing);
  if(c.status!=='active'){
   if(c.status==='review'||c.status==='historical'&&c.source_status==='Vigente')issue('INVESTOR_CONTRACT_REVIEW','El contrato conserva datos pendientes de revisión; no se inventan capital o rendimientos futuros.',[id],['investor_capital_scheduled','investor_yield_scheduled'],months.filter(m=>m>=month(asOf)&&(!end||m<=month(end))));
   continue;
  }
  const balance=amount(c.balance),scheduled=obligationRecords.filter(o=>o.contract_id===c.id&&o.concept==='capital').reduce((sum,o)=>sum+o.cents-o.paidCents,0);
  if(balance===null||balance<0||!end)issue('INVESTOR_CAPITAL_MATURITY_UNKNOWN','Falta capital vigente o vencimiento verificable para proyectar su devolución.',[id],['investor_capital_scheduled'],end?[month(end)]:[]);
  else if(scheduled>balance)issue('INVESTOR_CAPITAL_SCHEDULE_CONFLICT','Las obligaciones de capital pendientes superan el saldo vigente; no se agrega una segunda devolución al vencimiento.',[id],['investor_capital_scheduled']);
  else if(balance>scheduled)emit({id:'investor-maturity:'+c.id,sourceId:c.id,kind:'investor_capital_scheduled',date:end,amount:(balance-scheduled)/100,status:end>asOf?'SCHEDULED':'PENDING',contractId:c.id,contractCode:c.code,derived:true,overdue:end<asOf,basis:'Capital vigente menos obligaciones explícitas de capital pendientes; no es un pago realizado.',principalBasis:balance/100,balanceOn:asOf});
  // Existing writer schedules full anniversary periods. Missing/partial periods are not fabricated.
  if(start&&end&&c.payment_mode!=='Manual')for(let n=0;n<600;n++){
   const a=anniversary(start,n),b=anniversary(start,n+1);if(a>=end)break;
   if(observed&&b<observed)continue;
   if(b>end){if(end>asOf&&!obligationRecords.some(o=>o.contract_id===c.id&&o.concept==='yield'&&o.start===a&&o.end===end))issue('INVESTOR_PARTIAL_PERIOD_UNSPECIFIED','El período final incompleto requiere un importe pactado; no existe una convención diaria automática.',[id],['investor_yield_scheduled'],[month(end)]);break;}
   if(!scheduledPeriods.some(o=>o.contractId===c.id&&o.concept==='yield'&&o.start===a&&o.end===b)){
    if(b<=asOf)unknownPending(c.id,b);
    const due=c.payment_mode==='Al vencimiento'?end:b;
    issue('INVESTOR_YIELD_SCHEDULE_GAP','Falta una obligación vigente para un período contractual. Se conserva la tasa individual, sin inventar el importe.',[id],[b<=asOf?'investor_yield_generated':'investor_yield_scheduled'],[month(b<=asOf?b:due)]);
   }
  }
  if(c.payment_mode==='Manual'&&!obligationRecords.some(o=>o.contract_id===c.id&&o.concept==='yield'&&o.end>asOf)&&end>asOf)issue('INVESTOR_MANUAL_SCHEDULE_UNSPECIFIED','El contrato de programación manual no tiene obligaciones futuras de rendimiento registradas.',[id],['investor_yield_scheduled'],months.filter(m=>m>=month(asOf)&&m<=month(end)));
 }
 for(const m of months){
  const b=source.balances.find(b=>month(b.month)===m),future=m>month(asOf),cut=future?null:[monthEnd(m),asOf].sort()[0];
  if(!b||amount(b.known_amount)===null&&!future)throw new ReportError('INVESTORS_BALANCE_SOURCE_INVALID');
  const capitalDetails=[];let detailTotal=0;
  for(const d of b.details||[]){
   const n=amount(d.amount),c=byContract.get(d.contract_id);
   if(future||n===null||!c||date(d.cutoff)!==cut)throw new ReportError('INVESTORS_BALANCE_DETAIL_INVALID');
   const record={id:'investor-capital-balance:'+c.id+':'+m,kind:'investor_capital_balance',source:'Supabase · Inversores',sourceId:c.id,contractId:c.id,contractCode:c.code,date:cut,period:m,amount:n/100,principal:n/100,status:'RECORDED',basis:'Capital contractual al cierre / corte; no representa un movimiento de efectivo.'};
   detailTotal+=n;capitalDetails.push(record.id);records.push(record);
  }
  if(!future&&(!Number.isSafeInteger(detailTotal)||detailTotal!==amount(b.known_amount)))throw new ReportError('INVESTORS_BALANCE_DETAIL_MISMATCH');
  balances.push({...b,kind:'investor_capital_balance',month:m,sourceIds:capitalDetails,...(future?{status:'NOT_APPLICABLE'}:{})});
  if(!future&&amount(b.amount)===null)issue('INVESTOR_CAPITAL_HISTORY_INCOMPLETE','El capital identificado es un subtotal; faltan saldos o fechas de cierre verificables para otros contratos.',(b.unknown_contract_ids||[]).map(id=>'investor-contract:'+id),['investor_capital_balance'],[m]);
  let pending=0;const unknown=[],yieldDetails=[];
  if(cut)for(const c of contracts){
   if(date(c.starts_on)&&c.starts_on>cut)continue;
   if(!c.history_complete||unknownYieldFrom.get(c.id)<=cut)unknown.push(c.id);
   for(const o of obligationRecords.filter(o=>o.contract_id===c.id&&o.concept==='yield'&&o.end<=cut)){
    const outstanding=o.cents-o.linked.filter(x=>x.date<=cut).reduce((sum,x)=>sum+x.cents,0);pending+=outstanding;
    if(outstanding){const record={id:'investor-yield-balance:'+o.id+':'+m,kind:'investor_yield_pending',source:'Supabase · Inversores',sourceId:o.id,contractId:c.id,contractCode:c.code,date:cut,period:m,periodStart:o.start,periodEnd:o.end,amount:outstanding/100,interest:outstanding/100,status:'PENDING',rateSnapshot:o.rate_snapshot,basis:'Rendimiento generado menos pagos vigentes con fecha no posterior al corte.'};yieldDetails.push(record.id);records.push(record);}
   }
  }
  balances.push({kind:'investor_yield_pending',month:m,amount:future||unknown.length?null:pending/100,known_amount:future?null:pending/100,unknown_count:unknown.length,sourceIds:yieldDetails,...(future?{status:'NOT_APPLICABLE'}:{})});
  if(unknown.length)issue('INVESTOR_PENDING_HISTORY_INCOMPLETE','El pendiente identificado no prueba el pendiente histórico total: no se inventan obligaciones o pagos faltantes.',unknown.map(id=>'investor-contract:'+id),['investor_yield_pending'],[m]);
 }
 for(const r of unique(source.reviews))if(!r.contract_id){
  const kinds=r.kind==='non_investment_or_unclassified'?['investor_other','investor_net']:['investor_capital_balance','investor_yield_pending','investor_capital_scheduled','investor_yield_scheduled'];
  issue('INVESTOR_UNLINKED_REVIEW','Existe evidencia histórica pendiente de clasificación o vinculación; no se convierte en un movimiento nuevo.',['investor-review:'+r.id],kinds);
 }
 const grouped=new Map();for(const i of issues){const k=JSON.stringify([i.code,i.message,i.affectedKinds,i.months]);if(!grouped.has(k))grouped.set(k,{...i,sourceIds:[]});grouped.get(k).sourceIds.push(...i.sourceIds);}for(const i of grouped.values())i.sourceIds=[...new Set(i.sourceIds)];
 return {events,balances,records,issues:[...grouped.values()],unassigned,definitions:INVESTOR_DEFINITIONS,coverage:{authority:'SUPABASE_INVESTORS',contractCount:contracts.length,activeContractCount:contracts.filter(c=>c.status==='active').length,historyIncompleteCount:contracts.filter(c=>!c.history_complete).length,recordedMovements:validMovements.length,obligationCount:obligationRecords.length,unresolvedReviews:source.reviews.length,costBasis:'Stored contractual obligations; paid cash uses effective movement dates.',financialWrites:0}};
}
