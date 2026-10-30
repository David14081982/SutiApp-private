// Read-only monthly projection. No source writes, bank attribution or cash balance inference.
import {sourceDate,fundGroup,ReportError} from './report.mjs';
import {computeContractCashFlow} from './cash-flow-contracts.mjs';
import {INVESTOR_DEFINITIONS,buildInvestorCashFlow} from './cash-flow-investors.mjs';

const text=v=>String(v??'').trim();
const normalized=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const cents=v=>typeof v==='number'&&Number.isFinite(v)&&Number.isSafeInteger(Math.round(v*100))&&Math.abs(v*100-Math.round(v*100))<.00001?Math.round(v*100):null;
const loanKey=(C,D)=>JSON.stringify([text(C),text(D)]);
const percent=(part,total)=>Number.isSafeInteger(part)&&Number.isSafeInteger(total)&&total>0?Math.round(part/total*10000)/100:null;
const COMPONENTS={principal:'AD',interest:'AB',admin:'Z'};
const LABELS={loanSavings:'Caja de Ahorro',pettyCash:'Caja Chica',sutiexpress:'SutiExpress',advance:'Adelantos de Nómina',sutiLoan:'Suti Préstamo'};
const LOAN_ROWS=[
 ['placed','Capital colocado según transferencia registrada','recorded'],['count','Número de préstamos otorgados','recorded'],
 ['recovered','Recuperación total corroborada','recorded'],['principal','Capital recuperado','recorded'],['interest','Intereses recuperados','recorded'],['admin','Gasto administrativo recuperado','recorded'],
 ['pending','Capital pendiente de recuperar','balance'],['interest_pending','Intereses contractuales pendientes','balance'],['admin_pending','Administración contractual pendiente','balance'],
 ['scheduled','Recuperación futura programada','scheduled'],['principal_scheduled','Capital programado','scheduled'],['interest_scheduled','Intereses programados','scheduled'],['admin_scheduled','Administración programada','scheduled']
];
function identifyFund(value,contract){
 const group=fundGroup(value);
 if(Object.hasOwn(LABELS,group))return {id:group,label:LABELS[group]};
 if(['SUTIPRESTAMO','SUTIPRESTAMOS','PRESTAMOSUTI'].includes(normalized(value)))return {id:'sutiLoan',label:LABELS.sutiLoan};
 if(contract&&!group&&text(value))return {id:'contract:'+normalized(value),label:text(value)};
 return null;
}
function endOfMonth(key){const [y,m]=key.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}

export function consolidateCashFlow({base,loans,contracts=[],protectedLoans=[],contractCoverage={},investorsSource=null,sourceErrors={}}){
 if(!base?.months||!Array.isArray(loans))throw new ReportError('CASH_FLOW_SOURCE_INVALID');
 const result=structuredClone(base),{months,asOf}=result,current=asOf.slice(0,7),pos=new Map(months.map((m,i)=>[m.key,i]));
 const rows=new Map(result.rows.map(r=>[r.id,r])),working=new Set(),funds=new Map(),contractMap=new Map(),protectedMap=new Map();
 for(const c of contracts){const k=loanKey(c.C,c.D);if(contractMap.has(k))throw new ReportError('CONTRACT_IDENTITY_CONFLICT');contractMap.set(k,c);}
 for(const p of protectedLoans)protectedMap.set(p.key||loanKey(p.C,p.D),p.reason);
 const issues=result.issues,records=result.records,unassigned=result.unassigned;
 const addRow=(id,label,group,kind='recorded',extra={})=>{
  const row={id,label,group,kind,unit:'money',...extra,cells:months.map(m=>({cents:0,missing:false,sourceIds:[],notes:[],applicable:!(['recorded','net'].includes(kind)&&m.key>current||kind==='scheduled'&&m.key<current)}))};
  rows.set(id,row);working.add(id);return row;
 };
 // Preserve all ten savings definitions/cells; replace only loan placeholders with contractual read-only results.
 for(const id of [...rows.keys()].filter(id=>id.startsWith('loan_')))rows.delete(id);
 // Withdrawals already contain any yield paid; the existing source response does
 // not expose the capital/yield component. This disclosure is never added to cash exits.
 rows.set('savings_yield_paid',{id:'savings_yield_paid',label:'Rendimientos de Ahorro pagados (incluidos en retiros)',group:'Ahorro Voluntario',kind:'recorded',unit:'money',cells:months.map(m=>({amount:null,knownAmount:null,status:m.key>current?'NOT_APPLICABLE':'UNAVAILABLE',sourceIds:[],notes:['La consulta actual conserva los retiros pagados sin separar capital y rendimiento. El rendimiento pagado está incluido en los retiros y no se suma nuevamente como salida.']}))});
 const ensureFund=fund=>{
  if(funds.has(fund.id))return funds.get(fund.id);
  const prefix=fund.id==='loanSavings'?'loan':'fund_'+fund.id;
  const f={...fund,prefix,ids:Object.fromEntries(LOAN_ROWS.map(([kind,label,type])=>{const id=prefix+'_'+kind;addRow(id,label,fund.label,type,{unit:kind==='count'?'count':'money',section:fund.id==='loanSavings'?'Ahorro Voluntario y Caja de Ahorro':'Préstamos · bolsa común',emphasis:['recovered','scheduled'].includes(kind)?'subtotal':undefined});return [kind,id];}))};funds.set(fund.id,f);return f;
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
  records.push(r);c.sourceIds.push(r.id);const n=cents(r.amount);
  if(n===null){c.missing=true;c.notes.push(r.note||'Importe sin determinar.');}else {c.cents+=n;if(!Number.isSafeInteger(c.cents))throw new ReportError('AMOUNT_OVERFLOW');}
 };
 const groups=new Map();
 loans.slice(1).forEach((v,i)=>{
  if(!v.some(x=>x!==''&&x!=null))return;
  const C=text(v[2]),D=text(v[3]),k=loanKey(C,D),fund=identifyFund(v[6],contractMap.get(k));
  if(!C||!D){if(fund){const f=ensureFund(fund);mark(Object.values(f.ids),'LOAN_IDENTITY_MISSING','Préstamo sin ID o folio; no se atribuyen importes.',['pv2:'+(i+2)]);}return;}
  if(!groups.has(k))groups.set(k,[]);groups.get(k).push({v,C,D,fund,row:i+2});
 });
 let loanCount=0,determined=0,protectedCount=0,derivedForecastCount=0;
 for(const [key,g]of groups){
  const fund=g.find(r=>r.fund)?.fund;if(!fund)continue;
  loanCount++;const f=ensureFund(fund),allIds=Object.values(f.ids),sourceIds=g.map(r=>'pv2:'+r.row),first=g[0],contract=contractMap.get(key);
  if(g.some(r=>!r.fund||r.fund.id!==fund.id)){mark(allIds,'LOAN_FUND_CONFLICT','Un ID y folio tiene fondos contradictorios; no se suman sus cuotas.',sourceIds);protectedCount++;continue;}
  const seen=new Set();if(g.some(r=>!Number.isSafeInteger(r.v[18])||r.v[18]<1||seen.has(r.v[18])||(seen.add(r.v[18]),false))){mark(allIds,'LOAN_INSTALLMENT_AMBIGUOUS','Hay cuotas repetidas o sin número verificable.',sourceIds);protectedCount++;continue;}
  g.sort((a,b)=>a.v[18]-b.v[18]);
  const terms={principal:cents(first.v[9]),total:cents(first.v[10])},uniform=terms.principal!==null&&terms.total!==null&&terms.total>=terms.principal&&g.every(r=>cents(r.v[9])===terms.principal&&cents(r.v[10])===terms.total);
  const dates=[...new Set(g.map(r=>r.v[30]).filter(v=>v!==''&&v!=null).map(sourceDate))],transfer=dates.length===1&&dates[0]?dates[0]:null;
  if(uniform&&transfer&&transfer<=asOf){
   const origin={source:'HISTORIAL P V2',sourceId:'Contrato '+first.C+' / '+first.D,loanId:first.C,folio:first.D,fund:fund.label,date:transfer,status:'RECORDED',basis:'RECORDED_TRANSFER'};
   add(f.ids.placed,{...origin,id:'capital:'+key,amount:terms.principal/100});add(f.ids.count,{...origin,id:'count:'+key,amount:1});
  }else if(!uniform){mark([f.ids.placed,f.ids.count,f.ids.pending],'LOAN_TERMS_CONFLICT','Capital o total contractual contradictorio.',sourceIds);}
  else if(!transfer){mark([f.ids.placed,f.ids.count],'LOAN_TRANSFER_DATE_UNRESOLVED','No existe una fecha única de transferencia; no se inventa el mes de colocación.',sourceIds);unassigned.push({id:'capital:'+key,kind:f.ids.placed,amount:terms.principal/100,loanId:first.C,folio:first.D,source:'HISTORIAL P V2',sourceIds,date:null});}
  else {mark([f.ids.placed,f.ids.count],'LOAN_TRANSFER_FUTURE','La transferencia tiene fecha futura y no acredita una colocación realizada.',sourceIds,[transfer]);}
  const engineRows=g.map(r=>({C:r.C,D:r.D,S:r.v[18],date:sourceDate(r.v[0]),B:cents(r.v[1]),J:cents(r.v[9]),K:cents(r.v[10]),O:cents(r.v[14]),I:r.v[8],fund:r.v[6],sourceRow:r.row}));
  const allocation=contract?computeContractCashFlow({contract,rows:engineRows,asOf}):{status:'PROTECTED',reason:protectedMap.get(key)||sourceErrors.contracts||'CONTRACT_EVIDENCE_INSUFFICIENT'};
  const ok=allocation.status==='DETERMINED';if(ok)determined++;else protectedCount++;
  const payments=new Map((ok?allocation.payments:[]).map(p=>[p.S,p])),forecast=new Map((ok?allocation.forecast:[]).map(p=>[p.S,p]));
  for(const r of engineRows){
   const scheduled=r.date&&r.date>asOf,kind=scheduled?'scheduled':'recovered',breakdown=scheduled?forecast.get(r.S):payments.get(r.S),positiveIds=[f.ids[kind],...Object.keys(COMPONENTS).map(c=>f.ids[c+(scheduled?'_scheduled':'')])];
   if(!r.date){mark([f.ids.recovered,f.ids.scheduled,...Object.keys(COMPONENTS).flatMap(c=>[f.ids[c],f.ids[c+'_scheduled']])],'LOAN_PAYMENT_DATE_MISSING','Fecha de cuota sin determinar.', ['pv2:'+r.sourceRow]);continue;}
   if(r.B===null||r.B<0){mark(positiveIds,'LOAN_PAYMENT_INVALID','El importe B no es monetario válido.',['pv2:'+r.sourceRow],[r.date]);continue;}
   const projected=scheduled&&breakdown?breakdown.B:r.B,basis=scheduled&&breakdown?.adjusted?'DERIVED_FORECAST':ok?'CONTRACTUAL_ALLOCATION':'RECORDED_UNALLOCATED';
   if(basis==='DERIVED_FORECAST')derivedForecastCount++;
   const fields={id:'pv2:'+r.sourceRow,source:'HISTORIAL P V2 + condiciones originales',sourceId:'Fila '+r.sourceRow,loanId:r.C,folio:r.D,installment:r.S,period:r.date.slice(0,7),date:r.date,fund:fund.label,status:scheduled?'SCHEDULED':'RECORDED',basis,registeredAmount:r.B/100,
    principal:breakdown?breakdown.AD/100:projected===0?0:null,interest:breakdown?breakdown.AB/100:projected===0?0:null,administration:breakdown?breakdown.Z/100:projected===0?0:null,
    percentages:{principal:breakdown?percent(breakdown.AD,projected):null,interest:breakdown?percent(breakdown.AB,projected):null,administration:breakdown?percent(breakdown.Z,projected):null},contractEvidence:ok?allocation.evidence:undefined};
   add(f.ids[kind],{...fields,amount:projected/100});
   for(const [component,column]of Object.entries(COMPONENTS))add(f.ids[component+(scheduled?'_scheduled':'')],{...fields,id:fields.id+':'+component,amount:breakdown?breakdown[column]/100:projected===0?0:null});
   if(!ok&&projected>0)mark(Object.keys(COMPONENTS).map(c=>f.ids[c+(scheduled?'_scheduled':'')]),'LOAN_BREAKDOWN_UNDETERMINED','Sin determinar: condiciones contractuales no verificables ('+allocation.reason+').',[fields.id],[r.date]);
  }
  for(const [i,m]of months.entries()){
   const cut=m.key===current?asOf:endOfMonth(m.key),future=m.key>current;
   if(transfer&&transfer>cut)continue;
   const ids=[f.ids.pending,f.ids.interest_pending,f.ids.admin_pending];
   if(!ok||(!transfer&&m.key<current)){mark(ids,'LOAN_PENDING_UNDETERMINED','Saldo contractual sin desglose o corte original verificable.',sourceIds,[m.key+'-01']);continue;}
   const selected=[...allocation.payments,...(future?allocation.forecast:[])].filter(p=>p.date<=cut);
   for(const [id,column,original]of [[f.ids.pending,'AD',contract.principal],[f.ids.interest_pending,'AB',contract.interest],[f.ids.admin_pending,'Z',contract.administration]]){
    const pending=original-selected.reduce((s,p)=>s+p[column],0),row=rows.get(id);if(pending<0)throw new ReportError('CONTRACT_TOTAL_MISMATCH');
    add(id,{id:'pending:'+key+':'+column+':'+m.key,source:'Condiciones originales y cuotas',sourceId:allocation.evidence?.reference||'Contrato '+first.C,loanId:first.C,folio:first.D,fund:fund.label,date:cut,amount:pending/100,status:future?'SCHEDULED':'RECORDED',basis:future?'DERIVED_FORECAST':'CONTRACTUAL_ALLOCATION'});
    row.cells[i].notes.push(future?'Saldo proyectado después de las cuotas programadas; no efectivo disponible.':'Saldo contractual; no representa dinero disponible.');
   }
  }
  if(ok&&allocation.unassignedPending>0)unassigned.push({id:'unassigned:'+key,kind:f.ids.scheduled,amount:allocation.unassignedPending/100,date:null,loanId:first.C,folio:first.D,source:'Motor contractual de consulta',status:'PENDING',basis:'CONTRACTUAL_ALLOCATION',note:'Saldo contractual pendiente sin fecha de cobro programada.'});
 }
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
 for(const b of investor.balances||[]){const i=pos.get(b.month?.slice(0,7)),r=rows.get(b.kind);if(i===undefined||!r)continue;const c=r.cells[i];c.cents=cents(b.known_amount??b.amount)??0;c.knownMissing=cents(b.known_amount??b.amount)===null;c.missing=cents(b.amount)===null;c.notes.push(...(b.notes||[]));if(b.sourceIds)c.sourceIds.push(...b.sourceIds);if(b.status==='NOT_APPLICABLE')c.applicable=false;}
 for(const issue of investor.issues||[])mark([...(issue.affectedKinds||[]),...((issue.affectedKinds||[]).includes('investor_other')?['cash_other_in','cash_other_out']:[])],issue.code,issue.message,issue.sourceIds||[],(issue.months||[]).map(m=>m+'-01'));
 if(sourceErrors.investors)mark(INVESTOR_DEFINITIONS.map(d=>d.id),'INVESTOR_SOURCE_UNAVAILABLE','No se pudo consultar Inversores; sus importes no se sustituyen por cero.');
 for(const id of working){const row=rows.get(id);for(const [i,c]of row.cells.entries()){
  c.knownAmount=c.applicable&&!c.knownMissing?c.cents/100:null;c.amount=c.applicable&&!c.missing?c.cents/100:null;
  c.status=!c.applicable?'NOT_APPLICABLE':c.missing?(c.sourceIds.length||c.cents?'PARTIAL':'UNAVAILABLE'):row.kind==='scheduled'?'SCHEDULED':row.kind==='obligation'?'PENDING':row.kind==='balance'&&months[i].key>current?'SCHEDULED':'RECORDED';
  c.notes=[...new Set(c.notes)];delete c.cents;delete c.missing;delete c.applicable;delete c.knownMissing;
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
 result.rows=[...rows.values()];
 // Components share the immutable source identity with one full parent record.
 // Keep amounts and kinds on each component so totals remain directly verifiable.
 const recordMap=new Map(records.map(r=>[r.id,r]));
 result.records=records.map(r=>{
  const parentId=/^pv2:\d+:(principal|interest|admin)$/.test(r.id)?r.id.replace(/:(principal|interest|admin)$/,''):/^pending:.*:(AB|Z):\d{4}-\d{2}$/.test(r.id)?r.id.replace(/:(AB|Z):(\d{4}-\d{2})$/,':AD:$2'):null;
  return parentId&&recordMap.has(parentId)?{id:r.id,kind:r.kind,amount:r.amount,parentRecordId:parentId}:r;
 });
 const groupedIssues=new Map();for(const issue of issues){const k=JSON.stringify([issue.code,issue.message,issue.months,issue.affectedKinds]);if(!groupedIssues.has(k))groupedIssues.set(k,{...issue,sourceIds:[]});groupedIssues.get(k).sourceIds.push(...(issue.sourceIds||[]));}for(const issue of groupedIssues.values())issue.sourceIds=[...new Set(issue.sourceIds)];result.issues=[...groupedIssues.values()];
 result.coverage={...result.coverage,loanCount,determinedLoans:determined,protectedLoans:protectedCount,derivedForecastRows:derivedForecastCount,contractCoverage,investors:investor.coverage,financialWrites:0,amortizationEngineActive:false,contractualCalculation:'READ_ONLY',fundCount:funds.size};
 result.notes=['Registro realizado y programa futuro se presentan por separado; una proyección no es un cobro.','Los porcentajes son participación de cada componente en el total de la misma cuota o fondo, mes y estado.','Totales con información parcial no representan un flujo completo; revisar detalle y pendientes sin fecha.'];
 return result;
}
