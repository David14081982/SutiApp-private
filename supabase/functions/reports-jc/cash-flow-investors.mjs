// Read-only report derivations. Official registered values are accepted without a second certification.
// Stored obligations retain their original amounts; absent full monthly periods are calculated from dated terms.
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
  affectedMonths=affectedMonths.filter(Boolean);const selected=affectedMonths.filter(m=>positions.has(m));if(affectedMonths.length&&!selected.length)return;
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
  emit({id:'investor-movement:'+m.id,sourceId:m.id,kind,date:d,amount:(['investor_other','investor_adjustment'].includes(kind)?signed:n)/100,status:'RECORDED',calculationStatus:'RECORDED',basis:'REGISTERED_MOVEMENT',contractId:c.id,contractCode:c.code,direction:m.direction,obligationId:m.obligation_id||null,periodStart:m.period_start,periodEnd:m.period_end});
  if(kind==='investor_capital_return')issue('INVESTOR_RETURN_TYPE_UNSPECIFIED','La devolución está registrada, pero la fuente no clasifica el movimiento como parcial o total; se presenta el total conjunto.',[m.id],[],[month(d)]);
  if(kind!=='investor_adjustment')emit({id:'investor-net:'+m.id,sourceId:m.id,kind:'investor_net',date:d,amount:signed/100,status:'RECORDED',calculationStatus:'CALCULATED',contractId:c.id,derived:true,basis:'REGISTERED_MOVEMENT',detail:'Movimiento vigente con su dirección; excluye ajustes de capital.'});
 }
 const capitalMovements=(c,from,to)=>validMovements.filter(m=>m.contract_id===c.id&&['contribution','withdrawal','adjustment'].includes(m.concept)&&m.date>=from&&m.date<=to);
 function capitalAt(c,cut){
  const start=date(c.starts_on),opening=amount(c.opening_balance),anchor=date(c.balance_on),registered=amount(c.registered_current_capital),observed=date(c.registered_balance_on),principal=amount(c.principal);
  if(start&&start>cut||date(c.closed_on)&&c.closed_on<=cut||date(c.renewed_on)&&c.renewed_on<=cut)return {cents:0,basis:'CONTRACT_CAPITAL_CALCULATION',calculationStatus:'CALCULATED'};
  let base,from,basis,calculationStatus;
  if(opening!==null&&anchor&&anchor<=cut){base=opening;from=anchor;basis='REGISTERED_BALANCE';calculationStatus='RECORDED';}
  else if(registered!==null&&observed&&observed<=cut){base=registered;from=observed;basis='REGISTERED_BALANCE';calculationStatus='RECORDED';}
  else if(principal!==null&&start&&start<=cut){base=validMovements.some(m=>m.contract_id===c.id&&m.concept==='contribution'&&m.date===start)?0:principal;from=start;basis='CONTRACT_CAPITAL_CALCULATION';calculationStatus='CALCULATED';}
  else return {cents:null,basis:'CONTRACT_CAPITAL_CALCULATION',calculationStatus:'CALCULATED'};
  const moves=capitalMovements(c,from,cut),value=base+moves.reduce((sum,m)=>sum+(m.direction==='in'?m.cents:-m.cents),0);
  return {cents:Number.isSafeInteger(value)?value:null,basis,calculationStatus:moves.length?'CALCULATED':calculationStatus};
 }
 function rateAt(c,on){
  let rate=c.monthly_rate;
  for(const term of [...(c.terms||[])].sort((a,b)=>String(a.effective_on).localeCompare(String(b.effective_on)))){
   if(!date(term.effective_on))return null;
   if(term.effective_on<=on)rate=term.monthly_rate;
  }
  return rate!==null&&rate!==undefined&&Number.isFinite(Number(rate))&&Number(rate)>=0&&Number(rate)<=1?Number(rate):null;
 }
 function calculatedYield(principal,rate){
  if(principal===null||principal<0||rate===null)return null;
  const scaled=Math.round(rate*1e7),v=(BigInt(principal)*BigInt(scaled)+5000000n)/10000000n;
  return v<=BigInt(Number.MAX_SAFE_INTEGER)?Number(v):null;
 }
 // "Monto ingresado" and "Fecha de ingreso" are an explicit original contribution.
 // A renewal transfers principal; an opening balance only observes a stock.
 for(const c of contracts){
  const start=date(c.starts_on),initial=amount(c.registered_contribution);
  if(initial!==null&&initial>0&&start&&start<=asOf&&!c.parent_id&&!validMovements.some(m=>m.contract_id===c.id&&m.concept==='contribution'&&m.date===start)){
   const entry={sourceId:c.id,contractId:c.id,contractCode:c.code,date:start,amount:initial/100,status:'RECORDED',calculationStatus:'RECORDED',basis:'REGISTERED_CONTRACT',detail:'Monto ingresado con fecha original de ingreso; no es el saldo de apertura observado.'};
   emit({...entry,id:'investor-initial:'+c.id,kind:'investor_contribution'});emit({...entry,id:'investor-initial-net:'+c.id,kind:'investor_net',calculationStatus:'CALCULATED'});
  }
 }
 // Complete monthly anniversary periods use the original amount/rate plus dated changes.
 // Existing obligations always take precedence over calculations for the same covered period.
 const storedObligations=[...obligations];let calculatedPeriods=0;
 for(const c of contracts){
  const start=date(c.starts_on),originalEnd=date(c.ends_on),id='investor-contract:'+c.id;
  const stop=[originalEnd,date(c.closed_on),date(c.renewed_on)].filter(Boolean).sort()[0];
  if(!start||!stop||stop<=start){issue('INVESTOR_CONTRACT_DATES_MISSING','Falta una fecha contractual necesaria para calcular sus períodos.',[id],['investor_yield_generated','investor_yield_pending','investor_yield_scheduled']);unknownPending(c.id,null);continue;}
  for(let n=0;n<600;n++){
   const a=anniversary(start,n),fullEnd=anniversary(start,n+1),b=fullEnd<stop?fullEnd:stop;if(a>=stop)break;
   const overlaps=storedObligations.filter(o=>o.contract_id===c.id&&o.concept==='yield'&&date(o.period_start)&&date(o.period_end)&&o.period_start<b&&o.period_end>a).sort((x,y)=>x.period_start.localeCompare(y.period_start));
   if(overlaps.length){let covered=a;for(const o of overlaps){if(o.period_start>covered)break;if(o.period_end>covered)covered=o.period_end;}
    if(covered<b){issue('INVESTOR_PARTIAL_PERIOD_UNSPECIFIED','Una obligación cubre sólo parte del período; el tramo restante requiere un importe pactado.',[id],[b<=asOf?'investor_yield_generated':'investor_yield_scheduled'],[month(b)]);if(b<=asOf)unknownPending(c.id,b);}continue;}
   if(fullEnd>stop){issue('INVESTOR_PARTIAL_PERIOD_UNSPECIFIED','El período incompleto requiere un importe pactado; no se aplica una convención diaria no registrada.',[id],[b<=asOf?'investor_yield_generated':'investor_yield_scheduled'],[month(b)]);if(b<=asOf)unknownPending(c.id,b);break;}
   const principal=capitalAt(c,a),rate=rateAt(c,a),value=calculatedYield(principal.cents,rate);
   if(value===null){issue('INVESTOR_CONTRACT_INPUT_MISSING','Falta capital, tasa o fecha para calcular un período; no se exige otra certificación de los valores presentes.',[id],[b<=asOf?'investor_yield_generated':'investor_yield_scheduled'],[month(b)]);if(b<=asOf)unknownPending(c.id,b);continue;}
   const linked=validMovements.filter(m=>m.contract_id===c.id&&m.concept==='yield'&&!storedObligations.some(o=>o.id===m.obligation_id)&&m.period_start===a&&m.period_end===b);
   const due=c.payment_mode==='Mensual'?b:c.payment_mode==='Al vencimiento'?stop:null;
   const calculated={id:'calculated:'+c.id+':'+a+':'+b,contract_id:c.id,period_start:a,period_end:b,due_on:due,concept:'yield',amount:value/100,paid:linked.reduce((sum,m)=>sum+m.cents,0)/100,principal_basis:principal.cents/100,rate_snapshot:rate,origin:'contract_calculation',calculated:true,linkedIds:linked.map(m=>m.id)};
   obligations.push(calculated);calculatedPeriods++;
  }
 }
 const obligationRecords=[];
 for(const o of obligations){
  const c=byContract.get(o.contract_id),start=date(o.period_start),end=date(o.period_end),due=date(o.due_on),n=amount(o.amount),linked=validMovements.filter(m=>m.obligation_id===o.id||o.calculated&&o.linkedIds.includes(m.id)||!o.calculated&&!m.obligation_id&&m.contract_id===o.contract_id&&m.concept==='yield'&&o.concept==='yield'&&m.period_start===start&&m.period_end===end);
  const kind=o.concept==='yield'?'investor_yield_scheduled':o.concept==='capital'?'investor_capital_scheduled':null;
  if(!c||!start||!end||end<=start||(!due&&!o.calculated)||n===null||n<0||!['yield','capital','other'].includes(o.concept)){
   if(c&&o.concept==='yield')unknownPending(c.id,end);
   issue('INVESTOR_OBLIGATION_UNRESOLVED','Una obligación no tiene período, vencimiento o importe verificable.',[o.id],kind?[kind]:['investor_yield_scheduled','investor_capital_scheduled'],due?[month(due)]:[]);
   if(o.concept==='yield')issue('INVESTOR_GENERATED_AMOUNT_UNRESOLVED','La obligación no permite determinar el rendimiento generado al cierre del período.',[o.id],['investor_yield_generated'],end?[month(end)]:[]);
   continue;
  }
  const trace={contractId:c.id,contractCode:c.code,periodStart:start,periodEnd:end,dueOn:due,rateSnapshot:o.rate_snapshot,principalBasis:o.principal_basis,origin:o.origin,calculationStatus:o.calculated?'CALCULATED':'RECORDED',basis:o.calculated?'CONTRACT_YIELD_CALCULATION':'CONTRACT_OBLIGATION'};
  if(o.concept==='yield'&&end<=asOf)emit({id:'investor-generated:'+o.id,sourceId:o.calculated?c.id:o.id,kind:'investor_yield_generated',date:end,amount:n/100,status:'RECORDED',...trace,detail:'Rendimiento del período según importes y tasas registrados; no acredita un pago.'});
  const paid=linked.reduce((sum,m)=>sum+m.cents,0),expectedConcept={yield:'yield',capital:'withdrawal',other:'other'}[o.concept];
  const linkedSourcePaid=o.calculated?paid:linked.filter(m=>m.obligation_id===o.id).reduce((sum,m)=>sum+m.cents,0);
  if(linked.some(m=>m.contract_id!==o.contract_id||m.concept!==expectedConcept||m.direction!=='out')||paid>n||amount(o.paid)!==linkedSourcePaid){
   if(o.concept==='yield')unknownPending(c.id,end);
   issue('INVESTOR_OBLIGATION_PAYMENT_CONFLICT','Los pagos vinculados no cuadran con la obligación vigente; el pendiente no se calcula por suposición.',[o.id,...linked.map(m=>m.id)],o.concept==='yield'?['investor_yield_pending','investor_yield_scheduled']:['investor_capital_scheduled'],[month(due)]);continue;
  }
  const item={...o,start,end,due,cents:n,paidCents:paid,linked};obligationRecords.push(item);
  if(kind&&n>paid)emit({id:'investor-obligation:'+o.id,sourceId:o.calculated?c.id:o.id,kind,date:due,amount:(n-paid)/100,status:due&&due>asOf?'SCHEDULED':'PENDING',...trace,calculationStatus:due&&due>asOf?'SCHEDULED':trace.calculationStatus,overdue:!!due&&due<asOf,detail:due?'Obligación registrada o calculada menos pagos vigentes.':'Rendimiento calculable; modalidad manual sin fecha de pago registrada.'});
  if(o.concept==='other'&&n>paid)issue('INVESTOR_OTHER_OBLIGATION','Existe una obligación de otro concepto; no se reclasifica como rendimiento o devolución.',[o.id],['investor_capital_scheduled','investor_yield_scheduled'],[month(due)]);
 }
 for(const c of contracts){
  const start=date(c.starts_on),end=date(c.ends_on),observed=date(c.balance_on),id='investor-contract:'+c.id;
  const historyMonths=months.filter(m=>m<=month(asOf)&&(!start||monthEnd(m)>=start)&&(!observed||m+'-01'<observed));
  if(!c.history_complete&&historyMonths.length)issue('INVESTOR_REGISTERED_HISTORY_NOTE','Los importes oficiales registrados se utilizan sin una segunda certificación. Rendimientos calculados y saldos no se convierten en pagos.',[id],[],historyMonths);
  if(c.status==='review'||c.status==='historical')issue('INVESTOR_REGISTERED_STATUS_NOTE','El estado histórico o de revisión se conserva como referencia; no bloquea importes ni condiciones registrados.',[id],[]);
  const balance=capitalAt(c,asOf).cents,scheduled=obligationRecords.filter(o=>o.contract_id===c.id&&o.concept==='capital').reduce((sum,o)=>sum+o.cents-o.paidCents,0);
  if(balance===null||balance<0||!end)issue('INVESTOR_CAPITAL_MATURITY_UNKNOWN','Falta capital vigente o vencimiento verificable para proyectar su devolución.',[id],['investor_capital_scheduled'],end?[month(end)]:[]);
  else if(scheduled>balance)issue('INVESTOR_CAPITAL_SCHEDULE_CONFLICT','Las obligaciones de capital pendientes superan el saldo vigente; no se agrega una segunda devolución al vencimiento.',[id],['investor_capital_scheduled']);
  else if(balance>scheduled)emit({id:'investor-maturity:'+c.id,sourceId:c.id,kind:'investor_capital_scheduled',date:end,amount:(balance-scheduled)/100,status:end>asOf?'SCHEDULED':'PENDING',calculationStatus:end>asOf?'SCHEDULED':'CALCULATED',contractId:c.id,contractCode:c.code,derived:true,overdue:end<asOf,basis:'CONTRACT_MATURITY_PROJECTION',detail:'Capital vigente calculado menos obligaciones explícitas de capital pendientes; no es un pago realizado.',principalBasis:balance/100,balanceOn:asOf});
 }
 for(const m of months){
  const future=m>month(asOf),cut=future?null:[monthEnd(m),asOf].sort()[0],capitalDetails=[],capitalUnknown=[];let detailTotal=0;
  if(cut)for(const c of contracts){
   const value=capitalAt(c,cut),n=value.cents;
   if(n===null){capitalUnknown.push(c.id);continue;}
   detailTotal+=n;
   if(n){const record={id:'investor-capital-balance:'+c.id+':'+m,kind:'investor_capital_balance',source:'Supabase · Inversores',sourceId:c.id,contractId:c.id,contractCode:c.code,date:cut,period:m,amount:n/100,principal:n/100,status:'RECORDED',calculationStatus:value.calculationStatus,basis:value.basis,detail:'Capital al corte desde saldo registrado o capital contractual y movimientos fechados; no es un movimiento de efectivo.'};capitalDetails.push(record.id);records.push(record);}
  }
  if(!Number.isSafeInteger(detailTotal))throw new ReportError('INVESTORS_BALANCE_AMOUNT_INVALID');
  balances.push({kind:'investor_capital_balance',month:m,amount:future||capitalUnknown.length?null:detailTotal/100,known_amount:future?null:detailTotal/100,unknown_count:capitalUnknown.length,sourceIds:capitalDetails,basis:'CONTRACT_CAPITAL_CALCULATION',calculationStatus:'CALCULATED',...(future?{status:'NOT_APPLICABLE'}:{})});
  if(capitalUnknown.length)issue('INVESTOR_CAPITAL_INPUT_MISSING','Falta capital o fecha necesaria para determinar el saldo de algunos contratos; los importes registrados presentes se conservan.',capitalUnknown.map(id=>'investor-contract:'+id),['investor_capital_balance'],[m]);
  let pending=0;const unknown=[],yieldDetails=[];
  if(cut)for(const c of contracts){
   if(date(c.starts_on)&&c.starts_on>cut)continue;
   if(unknownYieldFrom.get(c.id)<=cut)unknown.push(c.id);
   for(const o of obligationRecords.filter(o=>o.contract_id===c.id&&o.concept==='yield'&&o.end<=cut)){
    const outstanding=o.cents-o.linked.filter(x=>x.date<=cut).reduce((sum,x)=>sum+x.cents,0);pending+=outstanding;
    if(outstanding){const record={id:'investor-yield-balance:'+o.id+':'+m,kind:'investor_yield_pending',source:'Supabase · Inversores',sourceId:o.calculated?c.id:o.id,contractId:c.id,contractCode:c.code,date:cut,period:m,periodStart:o.start,periodEnd:o.end,amount:outstanding/100,interest:outstanding/100,status:'PENDING',calculationStatus:'CALCULATED',rateSnapshot:o.rate_snapshot,basis:'CONTRACT_PENDING_CALCULATION',detail:'Rendimiento contractual generado menos pagos vigentes con fecha no posterior al corte.'};yieldDetails.push(record.id);records.push(record);}
   }
  }
  balances.push({kind:'investor_yield_pending',month:m,amount:future||unknown.length?null:pending/100,known_amount:future?null:pending/100,unknown_count:unknown.length,sourceIds:yieldDetails,basis:'CONTRACT_PENDING_CALCULATION',calculationStatus:'CALCULATED',...(future?{status:'NOT_APPLICABLE'}:{})});
  if(unknown.length)issue('INVESTOR_PENDING_INPUT_MISSING','Faltan datos de cálculo o vinculación para una parte del pendiente; no se inventan importes ni pagos.',unknown.map(id=>'investor-contract:'+id),['investor_yield_pending'],[m]);
 }
 for(const r of unique(source.reviews))if(!r.contract_id){
  issue('INVESTOR_UNLINKED_REVIEW_NOTE','La revisión histórica se conserva como referencia informativa; no bloquea importes oficiales ni crea un movimiento nuevo.',['investor-review:'+r.id],[]);
 }
 const grouped=new Map();for(const i of issues){const k=JSON.stringify([i.code,i.message,i.affectedKinds,i.months]);if(!grouped.has(k))grouped.set(k,{...i,sourceIds:[]});grouped.get(k).sourceIds.push(...i.sourceIds);}for(const i of grouped.values())i.sourceIds=[...new Set(i.sourceIds)];
 return {events,balances,records,issues:[...grouped.values()],unassigned,definitions:INVESTOR_DEFINITIONS,coverage:{authority:'SUPABASE_INVESTORS',contractCount:contracts.length,activeContractCount:contracts.filter(c=>c.status==='active').length,historyIncompleteCount:contracts.filter(c=>!c.history_complete).length,recordedMovements:validMovements.length,obligationCount:obligationRecords.length,calculatedPeriods,unresolvedReviews:source.reviews.length,costBasis:'Registered obligations and full monthly periods calculated from dated contractual capital and rates; paid cash uses only effective registered movements.',financialWrites:0}};
}
