// Read-only monthly projection. No source writes, bank attribution or cash balance inference.
import {fundGroup,ReportError} from './report.mjs';
import {deriveCashFlowLoans,CASH_FLOW_LOAN_FUNDS} from './cash-flow-loans.mjs';
import {INVESTOR_DEFINITIONS,buildInvestorCashFlow} from './cash-flow-investors.mjs';

const cents=v=>typeof v==='number'&&Number.isFinite(v)&&Number.isSafeInteger(Math.round(v*100))&&Math.abs(v*100-Math.round(v*100))<.00001?Math.round(v*100):null;
const percent=(part,total)=>Number.isSafeInteger(part)&&Number.isSafeInteger(total)&&total>0?Math.round(part/total*10000)/100:null;
const COMPONENTS={principal:'AD',interest:'AB',admin:'Z'};
const LABELS=CASH_FLOW_LOAN_FUNDS;
const LOAN_ROWS=[
 ['placed','Capital colocado por fecha de solicitud','recorded'],['count','Número de préstamos otorgados','recorded'],
 ['recovered','Recuperación realizada','recorded'],['principal','Capital recuperado','recorded'],['interest','Intereses recuperados','recorded'],['admin','Gasto administrativo recuperado','recorded'],
 ['unallocated','Recuperación sin desglose','recorded'],['rounding','Diferencia de redondeo del desglose','recorded'],
 ['pending','Capital pendiente de recuperar','balance'],['interest_pending','Intereses pendientes según calendario','balance'],['admin_pending','Administración pendiente según calendario','balance'],
 ['scheduled','Recuperación futura programada','scheduled'],['principal_scheduled','Capital programado','scheduled'],['interest_scheduled','Intereses programados','scheduled'],['admin_scheduled','Administración programada','scheduled'],['unallocated_scheduled','Recuperación programada sin desglose','scheduled'],['rounding_scheduled','Diferencia de redondeo programada','scheduled']
];
export function consolidateCashFlow({base,loans,requests=[],investorsSource=null,sourceErrors={}}){
 if(!base?.months||!Array.isArray(loans))throw new ReportError('CASH_FLOW_SOURCE_INVALID');
 // Records and source payloads are immutable. Clone the mutable containers instead of
 // duplicating every original savings/history value before assembling loan rows.
 const result={...base,rows:base.rows.map(row=>({...row,cells:row.cells.map(cell=>({...cell,sourceIds:[...(cell.sourceIds||[])],notes:[...(cell.notes||[])]}))})),records:[...base.records],issues:[...base.issues],unassigned:[...base.unassigned]}, {months,asOf}=result,current=asOf.slice(0,7),pos=new Map(months.map((m,i)=>[m.key,i]));
 const rows=new Map(result.rows.map(r=>[r.id,r])),working=new Set(),funds=new Map();
 const issues=result.issues,records=result.records,unassigned=result.unassigned;
 const addRow=(id,label,group,kind='recorded',extra={})=>{
  const row={id,label,group,kind,unit:'money',...extra,cells:months.map(m=>({cents:0,knownCount:0,missing:false,sourceIds:[],notes:[],applicable:!(['recorded','net'].includes(kind)&&m.key>current||kind==='scheduled'&&m.key<current)}))};
  rows.set(id,row);working.add(id);return row;
 };
 // Preserve savings definitions/cells; replace loan placeholders with original-source results.
 for(const id of [...rows.keys()].filter(id=>id.startsWith('loan_')))rows.delete(id);
 // Component disclosure only; the gross withdrawals already count these cash exits.
 addRow('savings_yield_paid','Rendimientos de Ahorro pagados (incluidos en retiros)','Ahorro Voluntario');
 const ensureFund=fund=>{
  if(funds.has(fund.id))return funds.get(fund.id);
  const prefix=fund.id==='loanSavings'?'loan':'fund_'+fund.id;
  const f={...fund,prefix,ids:Object.fromEntries(LOAN_ROWS.map(([kind,label,type])=>{const id=prefix+'_'+kind;addRow(id,label,fund.label,type,{unit:kind==='count'?'count':'money',section:fund.id==='loanSavings'?'Caja de Ahorro · Recurso de ahorradores':'Préstamos · bolsa común',emphasis:['recovered','scheduled'].includes(kind)?'subtotal':undefined});return [kind,id];}))};funds.set(fund.id,f);return f;
 };
 ensureFund({id:'loanSavings',label:LABELS.loanSavings});
 const mark=(ids,code,message,sourceIds=[],dates=[])=>{
  const affectedMonths=[...new Set(dates.filter(Boolean).map(d=>d.slice(0,7)))];
  if(affectedMonths.length&&!affectedMonths.some(m=>pos.has(m)))return;
  issues.push({code,message,sourceIds,months:affectedMonths,affectedKinds:ids});
  for(const id of ids)for(const [i,m]of months.entries())if(!affectedMonths.length||affectedMonths.includes(m.key)){const c=rows.get(id)?.cells[i];if(c){c.missing=true;c.notes.push(message);}}
 };
 const add=(id,entry)=>{
  const r={...entry,kind:id},i=pos.get(r.date?.slice(0,7));
  if(i===undefined){if(!r.date)unassigned.push(r);return;}
  const c=rows.get(id)?.cells[i];if(!c)return;
  records.push(r);c.sourceIds.push(r.id);if(r.calculationStatus==='CALCULATED')c.calculationStatus='CALCULATED';const n=cents(r.amount);
  if(n===null){c.missing=true;c.notes.push(r.note||'Importe sin determinar.');}else {c.knownCount++;c.cents+=n;if(!Number.isSafeInteger(c.cents))throw new ReportError('AMOUNT_OVERFLOW');}
 };
 for(const r of [...records].filter(r=>['withdrawal_partial','withdrawal_total','withdrawal_unspecified'].includes(r.kind))){
  const component=r.withdrawal_component;
  add('savings_yield_paid',{...r,id:r.id+':yield-disclosure',amount:component==='YIELD'?r.amount:component==='CAPITAL'?0:null,basis:'REGISTERED_MOVEMENT',note:'El retiro registrado no separa capital y rendimiento.'});
 }
 for(const c of rows.get('savings_yield_paid').cells)c.notes.push('El rendimiento pagado está incluido en los retiros y no se suma nuevamente como salida.');
 const loanDerivation=deriveCashFlowLoans({loans,requests,asOf,months});
 for(const fund of loanDerivation.funds)ensureFund(fund);
 for(const {fund,metric,record}of loanDerivation.entries){const f=ensureFund({id:fund,label:LABELS[fund]});add(f.ids[metric],record);}
 for(const issue of loanDerivation.issues){const f=ensureFund({id:issue.fund,label:LABELS[issue.fund]});mark(issue.metrics.map(k=>f.ids[k]),issue.code,issue.message,issue.sourceIds,issue.dates);}
 for(const item of loanDerivation.unassigned){const group=fundGroup(item.fund),f=funds.get(group);unassigned.push({...item,kind:f?.ids[item.metric]||item.metric});}
 result.loanContracts=loanDerivation.loanContracts;
 // Add investors as a separate authority/domain. Accruals and balances are not cash movements.
 let investor;
 try{investor=buildInvestorCashFlow({from:result.from,source:investorsSource,asOf});}
 catch(error){if(!(error instanceof ReportError))throw error;investor={events:[],balances:[],unassigned:[],coverage:{available:false,financialWrites:0},issues:[{code:'INVESTOR_SOURCE_UNAVAILABLE',message:'No se pudo validar la consulta de Inversores; sus importes permanecen sin determinar.',affectedKinds:INVESTOR_DEFINITIONS.map(d=>d.id)}]};}
 for(const d of INVESTOR_DEFINITIONS)addRow(d.id,d.label,d.group||'Inversores',d.kind,{unit:d.unit==='MXN'?'money':d.unit||'money',section:'Inversores',emphasis:d.kind==='net'?'subtotal':undefined});
 addRow('cash_other_in','Otros ingresos de efectivo registrados','Flujo consolidado');
 addRow('cash_other_out','Otros egresos de efectivo registrados','Flujo consolidado');
 for(const e of investor.events||[]){
  const record={...e,contractId:e.contractId||e.contract_id,period:e.periodStart&&e.periodEnd?e.periodStart+' a '+e.periodEnd:e.date?.slice(0,7),source:e.source||'Supabase · Inversores'};
  if(e.status==='PENDING'&&e.date<=asOf)unassigned.push({...record,overdue:true});else add(e.kind,record);
  if(e.kind==='investor_other'&&typeof e.amount==='number')add(e.amount>=0?'cash_other_in':'cash_other_out',{...record,id:e.id+':direction',amount:Math.abs(e.amount)});
 }
 unassigned.push(...(investor.unassigned||[]));
 records.push(...(investor.records||[]));
 for(const b of investor.balances||[]){const i=pos.get(b.month?.slice(0,7)),r=rows.get(b.kind);if(i===undefined||!r)continue;const c=r.cells[i];c.cents=cents(b.known_amount??b.amount)??0;c.knownMissing=cents(b.known_amount??b.amount)===null;c.missing=cents(b.amount)===null;c.notes.push(...(b.notes||[]));if(b.calculationStatus)c.calculationStatus=b.calculationStatus;if(b.sourceIds)c.sourceIds.push(...b.sourceIds);if(b.status==='NOT_APPLICABLE')c.applicable=false;}
 for(const issue of investor.issues||[])mark([...(issue.affectedKinds||[]),...((issue.affectedKinds||[]).includes('investor_other')?['cash_other_in','cash_other_out']:[])],issue.code,issue.message,issue.sourceIds||[],(issue.months||[]).map(m=>m+'-01'));
 if(sourceErrors.investors)mark(INVESTOR_DEFINITIONS.map(d=>d.id),'INVESTOR_SOURCE_UNAVAILABLE','No se pudo consultar Inversores; sus importes no se sustituyen por cero.');
 for(const id of working){const row=rows.get(id);for(const [i,c]of row.cells.entries()){
  c.knownAmount=c.applicable&&!c.knownMissing&&(!c.missing||c.knownCount||c.cents)?c.cents/100:null;c.amount=c.applicable&&!c.missing?c.cents/100:null;
  c.status=!c.applicable?'NOT_APPLICABLE':c.missing?(c.knownAmount!==null?'PARTIAL':'UNAVAILABLE'):row.kind==='scheduled'?'SCHEDULED':row.kind==='obligation'?'PENDING':row.kind==='balance'&&months[i].key>current?'SCHEDULED':'RECORDED';
  c.notes=[...new Set(c.notes)];delete c.cents;delete c.missing;delete c.applicable;delete c.knownMissing;delete c.knownCount;
 }}
 for(const f of funds.values())for(const phase of ['','_scheduled'])for(const component of Object.keys(COMPONENTS)){
  const row=rows.get(f.ids[component+phase]),denominator=rows.get(f.ids[phase?'scheduled':'recovered']);
  row.cells.forEach((c,i)=>{c.percentage=c.amount!==null&&denominator.cells[i].amount!==null?percent(cents(c.amount),cents(denominator.cells[i].amount)):null;});
 }
 // Totals use mutually exclusive gross cash categories, never both a total and its components.
 function total(id,label,group,kind,terms,extra={}){
  const cells=months.map((m,i)=>{
   const applicable=!(kind==='recorded'&&m.key>current||kind==='scheduled'&&m.key<current),sourceSigns={},notes=[];let known=0,missing=false;
   for(const [key,sign=1]of terms){const c=rows.get(key)?.cells[i];if(!c){missing=true;continue;}if(c.status==='NOT_APPLICABLE')continue;
    if(c.amount===null){missing=true;notes.push('Incluye conceptos sin determinar: '+rows.get(key).label);}known+=(cents(c.knownAmount??c.amount)??0)*sign;
    for(const sourceId of c.sourceIds||[])sourceSigns[sourceId]=(sourceSigns[sourceId]||0)+sign*(c.sourceSigns?.[sourceId]??1);
   }
   const sourceIds=Object.keys(sourceSigns).filter(id=>sourceSigns[id]!==0);
   return {amount:applicable&&!missing?known/100:null,knownAmount:applicable?known/100:null,status:!applicable?'NOT_APPLICABLE':missing?(sourceIds.length?'PARTIAL':'UNAVAILABLE'):kind==='scheduled'||kind==='balance'&&m.key>current?'SCHEDULED':'RECORDED',sourceIds,sourceSigns:Object.fromEntries(sourceIds.filter(id=>sourceSigns[id]!==1).map(id=>[id,sourceSigns[id]])),notes:[...new Set(notes)]};
  });
  const row={id,label,group,kind,unit:'money',emphasis:'subtotal',...extra,cells};rows.set(id,row);return row;
 }
 const allFunds=[...funds.values()],pool=allFunds.filter(f=>f.id!=='loanSavings'),recover=allFunds.map(f=>[f.ids.recovered]),placed=allFunds.map(f=>[f.ids.placed]),forecast=allFunds.map(f=>[f.ids.scheduled]);
 total('union_interest','Intereses recuperados · bolsa común','Sindicato','recorded',pool.map(f=>[f.ids.interest]));
 total('union_admin','Gastos administrativos recuperados · bolsa común','Sindicato','recorded',pool.map(f=>[f.ids.admin]));
 total('union_savings_interest','Intereses recuperados · Caja de Ahorro (separados)','Sindicato','recorded',[[funds.get('loanSavings').ids.interest]]);
 total('union_savings_admin','Gastos administrativos recuperados · Caja de Ahorro','Sindicato','recorded',[[funds.get('loanSavings').ids.admin]]);
 total('union_investor_cost','Costo contractual devengado de inversionistas','Sindicato','recorded',[['investor_yield_generated']]);
 total('union_margin_accrual','Margen: interés recuperado menos costo contractual devengado','Sindicato','recorded',[['union_interest'],['investor_yield_generated',-1]],{emphasis:'total'});
 total('union_margin_cash','Margen de caja: interés recuperado menos rendimientos pagados','Sindicato','recorded',[['union_interest'],['investor_yield_paid',-1]],{emphasis:'total'});
 total('union_interest_scheduled','Intereses programados · bolsa común','Sindicato','scheduled',pool.map(f=>[f.ids.interest_scheduled]));
 total('union_admin_scheduled','Administración programada · bolsa común','Sindicato','scheduled',pool.map(f=>[f.ids.admin_scheduled]));
 total('union_margin_scheduled','Margen financiero programado · bolsa común','Sindicato','scheduled',[['union_interest_scheduled'],['investor_yield_scheduled',-1]],{emphasis:'total'});
 total('loans_recovered_total','Recuperación total · todos los fondos','Distribución consolidada de préstamos','recorded',recover);
 total('loans_scheduled_total','Recuperación futura · todos los fondos','Distribución consolidada de préstamos','scheduled',forecast);
 for(const [component,label]of [['principal','Capital'],['interest','Intereses'],['admin','Gastos administrativos']])for(const phase of ['','_scheduled']){
  const r=total('loans_'+component+phase+'_total',label+(phase?' programados':' recuperados')+' · todos los fondos','Distribución consolidada de préstamos',phase?'scheduled':'recorded',allFunds.map(f=>[f.ids[component+phase]]));
  const denominator=rows.get(phase?'loans_scheduled_total':'loans_recovered_total');r.cells.forEach((c,i)=>{c.percentage=c.amount!==null&&denominator.cells[i].amount!==null?percent(cents(c.amount),cents(denominator.cells[i].amount)):null;});
 }
 for(const [metric,label]of [['unallocated','Recuperaci\u00f3n sin desglose'],['rounding','Diferencia de redondeo del desglose']])for(const phase of ['', '_scheduled'])total('loans_'+metric+phase+'_total',label+(phase?' programada':'')+' \u00b7 todos los fondos','Distribuci\u00f3n consolidada de pr\u00e9stamos',phase?'scheduled':'recorded',allFunds.map(f=>[f.ids[metric+phase]]));
 total('cash_in','Total de entradas registradas','Flujo consolidado','recorded',[...recover,['contribution'],['investor_contribution'],['cash_other_in']],{emphasis:'subtotal'});
 total('cash_out','Total de salidas registradas','Flujo consolidado','recorded',[...placed,['withdrawal_partial'],['withdrawal_total'],['withdrawal_unspecified'],['investor_yield_paid'],['investor_capital_return'],['cash_other_out']],{emphasis:'subtotal'});
 total('cash_other_net','Otros movimientos de efectivo registrados · neto','Flujo consolidado','recorded',[['investor_other']]);
 total('cash_net','Flujo neto registrado','Flujo consolidado','recorded',[['cash_in'],['cash_out',-1]],{emphasis:'total'});
 total('cash_in_scheduled','Entradas futuras programadas','Flujo consolidado','scheduled',[...forecast,['contribution_scheduled']],{emphasis:'subtotal'});
 total('cash_out_scheduled','Salidas futuras programadas','Flujo consolidado','scheduled',[['investor_yield_scheduled'],['investor_capital_scheduled'],['withdrawal_pending']],{emphasis:'subtotal'});
 total('cash_net_scheduled','Flujo neto futuro programado','Flujo consolidado','scheduled',[['cash_in_scheduled'],['cash_out_scheduled',-1]],{emphasis:'total'});
 total('portfolio_pending','Capital pendiente de recuperar · todos los fondos','Flujo consolidado','balance',allFunds.map(f=>[f.ids.pending]));
 const treasury={id:'cash_available',label:'Efectivo disponible (requiere fuente de tesorería)',group:'Flujo consolidado',kind:'balance',unit:'money',cells:months.map(()=>({amount:null,knownAmount:null,status:'UNAVAILABLE',sourceIds:[],notes:['La cartera y las obligaciones no acreditan el saldo de bancos o caja.']}))};rows.set(treasury.id,treasury);
 // Explain stock/accrual/cash separation directly in the corresponding financial cells.
 for(const id of ['union_margin_accrual','union_margin_cash','union_margin_scheduled'])for(const c of rows.get(id).cells)c.notes.push('Excluye capital y gasto administrativo. Los rendimientos corresponden a contratos de la bolsa común, no a un porcentaje por cuota. No es utilidad neta ni saldo disponible.');
 const groupOrder=['Inversores','Caja de Ahorro','Sutiexpress','Caja Chica','Adelantos de Nómina','Ahorro Voluntario'];
 const remaining=[...new Set([...rows.values()].map(r=>r.group))].filter(g=>!groupOrder.includes(g));
 result.rows=[...groupOrder,...remaining].flatMap(group=>[...rows.values()].filter(r=>r.group===group));
 // Components share the immutable source identity with one full parent record.
 // Keep amounts and kinds on each component so totals remain directly verifiable.
 const recordMap=new Map(records.map(r=>[r.id,r]));
 result.records=records.map(r=>{
  const parentId=/^pv2:\d+:(principal|interest|admin|unallocated|rounding)$/.test(r.id)?r.id.replace(/:(principal|interest|admin|unallocated|rounding)$/,''):/^pending:.*:(AB|Z):\d{4}-\d{2}$/.test(r.id)?r.id.replace(/:(AB|Z):(\d{4}-\d{2})$/,':AD:$2'):null;
  return parentId&&recordMap.has(parentId)?{id:r.id,kind:r.kind,amount:r.amount,parentRecordId:parentId}:r;
 });
 const groupedIssues=new Map();for(const issue of issues){const k=JSON.stringify([issue.code,issue.message,issue.months,issue.affectedKinds]);if(!groupedIssues.has(k))groupedIssues.set(k,{...issue,sourceIds:[]});groupedIssues.get(k).sourceIds.push(...(issue.sourceIds||[]));}for(const issue of groupedIssues.values())issue.sourceIds=[...new Set(issue.sourceIds)];result.issues=[...groupedIssues.values()];
 result.coverage={...result.coverage,...loanDerivation.coverage,investors:investor.coverage,financialWrites:0,amortizationEngineActive:false,contractualCalculation:'ORIGINAL_SOURCE_COMPONENTS_READ_ONLY',fundCount:funds.size};
 result.notes=['Registro realizado y programa futuro se presentan por separado; una proyección no es un cobro.','Los porcentajes son participación de cada componente en el total de la misma cuota o fondo, mes y estado.','Totales con información parcial no representan un flujo completo; revisar detalle y pendientes sin fecha.'];
 return result;
}
