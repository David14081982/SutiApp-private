/* Inversores: display-only derivations from the authenticated Supabase response. */
(function(root){
 'use strict';
 const number=v=>Number(v||0),round=v=>Math.round((v+Number.EPSILON)*100)/100;
 const money=v=>v==null?'Por conciliar':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(number(v));
 const labels={historical:'Histórico',review:'Por revisar',active:'Activo',closed:'Terminado',renewed:'Renovado',contribution:'Aportación',withdrawal:'Devolución de capital',yield:'Rendimiento',adjustment:'Ajuste de capital',other:'Otro concepto',capital:'Capital',investor:'Inversionista',contract:'Contrato',movement:'Movimiento',rate:'Cambio de tasa',activate:'Conciliación',renew:'Renovación',close:'Terminación',obligation:'Obligación',UPLOAD:'Documento agregado',READ:'Consulta documental',RESCHEDULE:'Reprogramación',CANCEL_FUTURE:'Cancelación futura',contract_conflict:'Contrato con discrepancias',amendment_relationship:'Adenda por vincular',conflicting_status:'Estado distinto',conflicting_start:'Ingreso distinto',conflicting_end:'Vencimiento distinto',conflicting_principal:'Capital distinto',conflicting_monthly:'Rendimiento distinto',non_investment_or_unclassified:'Concepto por clasificar'};
 function status(o,today){const pending=round(Math.max(0,number(o.amount)-number(o.paid)));return !pending?'Realizado':o.due_on<today?'Vencido':o.due_on===today?'Pendiente':'Programado';}
 function summarize(data,investorId){
  const contracts=(data.contracts||[]).filter(c=>!investorId||c.investor_id===investorId),ids=new Set(contracts.map(c=>c.id));
  const movements=(data.movements||[]).filter(m=>ids.has(m.contract_id)&&!m.superseded&&!m.voided),obligations=(data.obligations||[]).filter(o=>ids.has(o.contract_id)&&!o.cancelled);
  // Maturity is a projection of remaining principal, never a fabricated payment or ledger row.
  for(const c of contracts.filter(c=>c.status==='active'&&c.balance!=null&&number(c.balance)>0)){
   const scheduled=obligations.filter(o=>o.contract_id===c.id&&o.concept==='capital').reduce((n,o)=>n+Math.max(0,number(o.amount)-number(o.paid)),0),remaining=Math.max(0,number(c.balance)-scheduled);
   if(remaining)obligations.push({id:'maturity:'+c.id,contract_id:c.id,period_start:c.starts_on,period_end:c.ends_on,due_on:c.ends_on,concept:'capital',amount:remaining,paid:0,derived:true});
  }
  const active=contracts.filter(c=>c.status==='active'),pending=obligations.filter(o=>number(o.paid)<number(o.amount));
  const generated=obligations.filter(o=>o.concept==='yield'&&o.period_end<=data.today).reduce((n,o)=>n+number(o.amount),0);
  const earnedPending=obligations.filter(o=>o.concept==='yield'&&o.period_end<=data.today).reduce((n,o)=>n+Math.max(0,number(o.amount)-number(o.paid)),0);
  const months={};for(const o of pending){const key=o.due_on.slice(0,7);months[key]??={month:key,yield:0,capital:0,other:0};months[key][o.concept]+=Math.max(0,number(o.amount)-number(o.paid));}
  for(const c of active){if(c.balance==null||number(c.balance)<=0||!c.ends_on)continue;const key=c.ends_on.slice(0,7);months[key]??={month:key,yield:0,capital:0,other:0};const scheduled=obligations.filter(o=>o.contract_id===c.id&&o.concept==='capital').reduce((n,o)=>n+Math.max(0,number(o.amount)-number(o.paid)),0);months[key].capital+=Math.max(0,number(c.balance)-scheduled);}
  const historicalContributed=(data.investors||[]).filter(i=>!investorId||i.id===investorId).reduce((n,i)=>n+number(i.source?.historical_contributed),0);
  return {contracts,movements,obligations,active,pending,capital:round(active.reduce((n,c)=>n+number(c.balance),0)),historicalContributed,contributed:round(historicalContributed+movements.filter(m=>m.concept==='contribution').reduce((n,m)=>n+number(m.amount),0)),generated:round(generated),paid:round(movements.filter(m=>m.concept==='yield').reduce((n,m)=>n+number(m.amount),0)),yieldPending:round(earnedPending),nextPayment:pending.slice().sort((a,b)=>a.due_on.localeCompare(b.due_on))[0]?.due_on||null,nextMaturity:active.filter(c=>c.ends_on).map(c=>c.ends_on).sort()[0]||null,incomplete:contracts.some(c=>!c.history_complete),unreconciled:contracts.filter(c=>c.status==='review'||(c.status==='historical'&&c.source?.status==='Vigente')).length,projection:Object.values(months).sort((a,b)=>a.month.localeCompare(b.month))};
 }
 const api=Object.freeze({money,labels,status,summarize,round});root.InvestorsModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
