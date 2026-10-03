import { cents } from './engine.mjs';
const total=values=>values.reduce((n,v)=>n+cents(Number(v)),0)/100;
const label=key=>key==='OPENING'?'Saldo inicial · origen por identificar':String(key).replace('-S',' · semestre ');
export function decorateLoans(analysis) {
  return {...analysis,loans:analysis.loans.map(loan=>{
    let actual=0,expected=0,complete=true;
    const counts={complete:0,partial:0,extra:0,unpaid:0,future:0,review:0};
    const schedule=[...loan.schedule].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||a.source_row-b.source_row).map(p=>{
      const ambiguous=(p.issues||[]).some(code=>['AMBIGUOUS_LOAN_DATE_ROWS','EXACT_IDENTITY_OR_FUND_REQUIRED','INCONSISTENT_LOAN_HEADER','INVALID_AMORTIZATION_DATE','INVALID_RECORDED_PAYMENT','INVALID_EXPECTED_PAYMENT'].includes(code));
      const invalid=ambiguous||typeof p.paid!=='number'||!Number.isFinite(p.paid)||p.paid<0||typeof p.expected!=='number'||!Number.isFinite(p.expected)||p.expected<0||!p.date;
      if(invalid)complete=false;
      let key='review',comparison_label='Por revisar';
      if(!invalid&&p.future){key='future';comparison_label='Cuota futura';}
      else if(!invalid){
        actual+=cents(p.paid);expected+=cents(p.expected);
        key=p.paid===0&&p.expected>0?'unpaid':cents(p.paid)===cents(p.expected)?'complete':p.paid<p.expected?'partial':'extra';
        comparison_label={unpaid:'Sin pago registrado',complete:'Completa',partial:'De menos',extra:'De más'}[key];
      }
      counts[key]++;
      return {...p,difference:invalid||p.future?null:(cents(p.paid)-cents(p.expected))/100,
        cumulative_paid:complete&&!p.future?actual/100:null,cumulative_expected:complete&&!p.future?expected/100:null,
        comparison_label,comparison_state:key};
    });
    const progressKnown=loan.behavior!=='REVIEW_REQUIRED'&&typeof loan.total==='number'&&Number.isFinite(loan.total)&&loan.total>=0&&typeof loan.paid==='number'&&Number.isFinite(loan.paid)&&loan.paid>=0;
    return {...loan,progress_percent:progressKnown&&loan.total>0?loan.paid/loan.total*100:null,
      remaining_contractual:progressKnown?Math.max(0,cents(loan.total)-cents(loan.paid))/100:null,
      severity:loan.arrears==null?null:loan.arrears>=5000?'severe':loan.arrears>=500?'moderate':'mild',schedule,
      comparison_summary:[['complete','Completas'],['partial','De menos'],['extra','De más'],['unpaid','Sin pago'],['future','Futuras'],['review','Por revisar']].map(([key,label])=>({label,value:counts[key]})),
      comparison_complete:complete,evidence_note:'Comparación con los importes actuales de la hoja por cuota. La fecha original de vencimiento y la fecha efectiva de recepción no están demostradas. La severidad conserva los umbrales del SICOF original: $500 y $5,000 de atraso registrado. Las filas duplicadas o inválidas no se suman; un acumulado incompleto queda sin valor.'};
  })};
}
export function behaviorFor(subject, analysis) {
  const exact=value=>typeof value==='string'&&value!==''&&value===value.trim();
  const identityValid=exact(subject?.folio),loans=identityValid?analysis.loans.filter(l=>l.folio===subject.folio):[];
  const unknownOwner=analysis.loans.some(l=>!exact(l.folio));
  const status=!identityValid||unknownOwner||loans.some(l=>l.behavior==='REVIEW_REQUIRED'||!l.status)?'REVIEW':!loans.length?'NO_HISTORY':loans.some(l=>l.status==='SALDO ATRASADO')?'ARREARS':'CURRENT';
  return {status,label:{NO_HISTORY:'Sin historial',REVIEW:'Información por revisar',ARREARS:'Con atraso',CURRENT:'Al corriente'}[status],observed_at:analysis.observed_at,loans,
    summary:[{label:'Préstamos registrados',value:loans.length},{label:'Con saldo atrasado',value:loans.filter(l=>l.status==='SALDO ATRASADO').length}],score:null,
    explanation:'Indicador del historial interno. No es una calificación de buró ni mide puntualidad sin fechas originales comprobadas.'};
}
function classifyReportTransactions(transactions) {
  const indexed=new Map(),duplicates=new Set(),cache=new Map(),overReversed=new Set();
  const number=value=>value!==null&&value!==''&&value!==undefined&&Number.isFinite(Number(value));
  const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  for(const t of transactions){if(indexed.has(t.id))duplicates.add(t.id);else if(t.id)indexed.set(t.id,t);}
  const reversals=new Map();
  for(const t of transactions)if(t.transaction_type==='REVERSAL'&&t.reversal_of_transaction_id&&number(t.amount)){
    const id=t.reversal_of_transaction_id;reversals.set(id,(reversals.get(id)||0)+cents(Number(t.amount)));
  }
  for(const [id,reversed] of reversals){const original=indexed.get(id);if(original&&number(original.amount)&&reversed>cents(Number(original.amount)))overReversed.add(id);}
  function classify(t,visited=new Set()){
    if(cache.has(t.id))return cache.get(t.id);
    const fail=code=>({category:null,error:code});
    if(!t.id||duplicates.has(t.id))return fail('DUPLICATE_OR_MISSING_TRANSACTION_ID');
    if(visited.has(t.id))return fail('REVERSAL_LINK_CYCLE');
    if(!number(t.amount)||Number(t.amount)<0||!validDate(t.effective_date)||!['CAPITAL','YIELD'].includes(t.component)||!['CREDIT','DEBIT'].includes(t.direction))return fail('INVALID_REPORT_TRANSACTION');
    let value;
    if(t.transaction_type==='REVERSAL'){
      const original=indexed.get(t.reversal_of_transaction_id);
      if(!original)value=fail('REVERSAL_ORIGINAL_NOT_AVAILABLE');
      else if(original.component!==t.component||original.direction===t.direction||original.effective_date>t.effective_date||overReversed.has(original.id))value=fail('REVERSAL_LINK_INCONSISTENT');
      else value=classify(original,new Set([...visited,t.id]));
    }else if(t.transaction_type==='WITHDRAWAL')value={category:'withdrawal'};
    else if(t.transaction_type==='YIELD_CREDIT')value=t.component==='YIELD'?{category:'yield'}:fail('YIELD_COMPONENT_MISMATCH');
    else if(t.transaction_type==='CONTRIBUTION')value=t.component==='CAPITAL'&&validDate(t.contribution_date)?{category:'contribution',contribution_date:t.contribution_date}:fail('CONTRIBUTION_ORIGIN_UNPROVEN');
    else if(t.transaction_type==='ADJUSTMENT'&&t.component==='CAPITAL'&&t.contribution_date){
      const original=transactions.find(x=>x.transaction_type==='CONTRIBUTION'&&x.component==='CAPITAL'&&x.contribution_date===t.contribution_date&&x.enrollment_id&&x.enrollment_id===t.enrollment_id&&x.effective_date<=t.effective_date);
      value=original&&validDate(t.contribution_date)?{category:'contribution',contribution_date:t.contribution_date}:fail('CONTRIBUTION_ADJUSTMENT_ORIGIN_UNPROVEN');
    }else if(['REGULARIZATION','ADJUSTMENT','HOLD_SETTLEMENT'].includes(t.transaction_type))value={category:'adjustment'};
    else value=fail('UNKNOWN_REPORT_TRANSACTION_TYPE');
    cache.set(t.id,value);return value;
  }
  return transactions.map(t=>({...t,...classify(t),signed_amount:number(t.amount)?Number(t.amount)*(t.direction==='CREDIT'?1:-1):null}));
}
export function makeReports(context) {
  const periodRows=[],finalRows=[],balances={},origins=new Map(),historical=new Map((context.report?.rows||[]).map(row=>[row.folio,row.cells]));
  for(const p of context.participants){
    const composition=p.composition,tx=p.transactions||[],classified=classifyReportTransactions(tx),classifiedById=new Map(classified.map(t=>[t.id,t]));
    balances[p.id]={capital:composition?.balances?.capital??null,yield_amount:composition?.balances?.yield_amount??null,total:composition?.balances?.total??null,available:composition?.balances?.available??null,held:composition?.balances?.held??null,as_of:context.today};
    const movements=(composition?.movements||[]).map(m=>{const classified=classifiedById.get(m.transaction_id||m.id);return{...m,date:m.effective_date,report_category:classified?.category??null,report_review:classified?.error??null,reversal_of_transaction_id:classified?.reversal_of_transaction_id??null,
      period_label:(m.origins||[]).map(o=>label(o.origin_key)).join(', '),label:m.type==='WITHDRAWAL'?'Retiro':m.type==='REVERSAL'&&classified?.category==='withdrawal'?'Reversión de retiro':m.type==='YIELD_CREDIT'?'Rendimiento acreditado':m.type==='REGULARIZATION'?'Saldo inicial certificado':m.type==='CONTRIBUTION'?'Aportación':m.type,component_label:m.component==='YIELD'?'Rendimiento':'Capital'};});
    for(const entry of composition?.periods||[]){
      const key=entry.origin_key;origins.set(key,{id:key,origin_key:key,year:entry.period_year,period_year:entry.period_year,semester:entry.semester,label:label(key)});
      periodRows.push({...entry,folio:p.folio,name:p.name,participant_id:p.id,year:entry.period_year,period_label:label(key),component_label:entry.component==='YIELD'?'Rendimiento':'Capital',
        available:null,movements,periods:composition.periods,withdrawal_periods:movements.filter(t=>t.type==='WITHDRAWAL').map(t=>({date:t.date,amount:t.amount,origins:t.origins}))});
    }
    if(!composition)periodRows.push({folio:p.folio,name:p.name,participant_id:p.id,period_label:'Saldo pendiente de certificación',recognized:null,withdrawn:null,remaining:null,origin_state:'REVIEW_REQUIRED',movements:[],periods:[]});
    const balance=composition?.as_of_balance,prior=historical.get(p.folio),cutoff=context.as_of||context.to,inPeriod=classified.filter(t=>t.effective_date>=context.from&&t.effective_date<=context.to&&t.effective_date<=cutoff);
    const reportReviews=[...new Set(inPeriod.filter(t=>t.error).map(t=>t.error))],classifiedPeriod=!reportReviews.length;
    const withdrawals=inPeriod.filter(t=>t.category==='withdrawal');
    const paidCapital=classifiedPeriod?total(withdrawals.filter(t=>t.component==='CAPITAL').map(t=>-t.signed_amount)):null;
    const paidYield=classifiedPeriod?total(withdrawals.filter(t=>t.component==='YIELD').map(t=>-t.signed_amount)):null;
    const F=classifiedPeriod?total(inPeriod.filter(t=>t.category==='contribution').map(t=>t.signed_amount)):null;
    const G=classifiedPeriod?total(inPeriod.filter(t=>t.category==='yield').map(t=>t.signed_amount)):null;
    const validAmount=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
    const reliable=!!balance&&validAmount(balance.capital)&&validAmount(balance.yield_amount)&&(!p.certified_as_of||p.certified_as_of<=cutoff),periodReliable=reliable&&classifiedPeriod;
    const I=periodReliable?total([balance.capital,paidCapital]):null,J=periodReliable?total([balance.yield_amount,paidYield]):null,K=periodReliable?total([I,J]):null,L=periodReliable?total([paidCapital,paidYield]):null,M=reliable?total([balance.capital,balance.yield_amount]):null;
    finalRows.push({A:p.folio,B:p.name,C:prior?.C??null,D:prior?.D??null,E:prior?.E??null,F:periodReliable?F:null,G:periodReliable?G:null,H:periodReliable?total([F,G]):null,I,J,K,L,M,
      folio:p.folio,name:p.name,year:Number(context.from.slice(0,4)),semester:Number(context.from.slice(5,7))<=6?1:2,
      available:context.as_of===context.today?composition?.balances?.available??null:null,movements,periods:composition?.periods||[],report_reviews:reportReviews,
      withdrawal_debits:classifiedPeriod?total(withdrawals.filter(t=>t.direction==='DEBIT').map(t=>t.amount)):null,withdrawal_reversals:classifiedPeriod?total(withdrawals.filter(t=>t.direction==='CREDIT').map(t=>t.amount)):null,
      origin_state:composition?.complete&&classifiedPeriod?'CHECKED':'REVIEW_REQUIRED'});
  }
  const commonNotes=['El retiro se registra en la fecha efectiva y conserva los periodos de origen. El saldo restante proviene del mismo registro de Ahorro que consulta el afiliado.',
    'Los rendimientos calculados en una simulación no se suman al saldo hasta su acreditación autorizada. Rendimiento acreditado y rendimiento pagado se muestran por separado.',
    'El Excel histórico se conserva completo. Sus valores de 2025 son evidencia histórica y no crean un segundo abono. Un cero histórico no permite inferir una causa de exclusión.',
    'Las retenciones afectan el disponible global. No se asigna un disponible por periodo cuando no hay desglose demostrado.',
    'Una reversión mantiene la categoría del movimiento original. Las entregas netas pueden ser negativas si se revierte en este periodo un retiro anterior. Un vínculo original no disponible queda por conciliar.'];
  const columns=[{key:'folio',label:'Folio'},{key:'name',label:'Ahorrador'},{key:'period_label',label:'Periodo de origen'},{key:'component_label',label:'Componente'},
    {key:'recognized',label:'Registrado',format:'money'},{key:'withdrawn',label:'Retirado',format:'money'},{key:'adjustments',label:'Ajustes',format:'money'},{key:'remaining',label:'Saldo restante',format:'money'},{key:'origin_state',label:'Conciliación'}];
  const headers=['Folio','Nombre agremiado','AHORRO 2025 · REFERENCIA','RENDIMIENTO 2025 · REFERENCIA','SUBTOTAL 2025 Y ANTERIORES · REFERENCIA',
    'AHORRO NETO REGISTRADO EN EL PERIODO','RENDIMIENTO NETO ACREDITADO DEL PERIODO','SUBTOTAL DEL PERIODO','CAPITAL ANTES DE RETIROS NETOS DEL PERIODO','RENDIMIENTO ANTES DE RETIROS NETOS DEL PERIODO','TOTAL ANTES DE RETIROS NETOS','DEPOSITADO NETO EN EL PERIODO','SALDO AL CORTE'];
  const finalColumns=headers.map((title,index)=>({key:String.fromCharCode(65+index),label:title,format:index>1?'money':undefined}));
  const totals=Object.fromEntries(finalColumns.filter(c=>c.format==='money').map(c=>[c.key,finalRows.some(r=>r[c.key]==null)?null:total(finalRows.map(r=>r[c.key]))]));
  return {report:{columns,rows:periodRows,balances,periods:[...origins.values()],notes:commonNotes,totals:null},finalReport:{columns:finalColumns,rows:finalRows,totals,periods:[...origins.values()],notes:commonNotes.concat([
    'Hoja histórica: valores originales. Informe vigente: C:E son referencia histórica, F:H movimientos del periodo, I:K saldo antes de los retiros del periodo, L entregas efectivas, M saldo canónico al corte. C:E no se vuelven a sumar a I:M.',
    'M = K − L. Las diferencias entre saldo al corte y disponible por retenciones se detallan en Saldos y disponible; no se asignan a un periodo sin evidencia.']),from:context.from,to:context.to}};
}
export function workspaceView(context,analysis) {
  const reports=makeReports(context);
  return {source:analysis?{observed_at:analysis.observed_at,status:'READY',fingerprint:analysis.source_fingerprint}:{observed_at:null,status:'UNAVAILABLE',error:'No fue posible consultar los préstamos. Los cálculos de rendimiento requieren esa fuente.'},
    funds:analysis?analysis.funds.map(f=>({id:f.fund,name:f.fund,collected:f.reconciled_interest,projected:f.projected_interest,unresolved_rows:f.unresolved_rows})):[],loans:analysis?.loans??null,payments:analysis?.payments??null,
    participants:context.participants,periods:[...new Map([...reports.report.periods,...context.periods.map(p=>({...p,origin_key:p.period_year+'-S'+p.semester,label:p.period_year+' · semestre '+p.semester}))].map(p=>[p.origin_key,p])).values()],
    report:reports.report,historical_report:context.report?{id:context.report.id,filename:context.report.filename,sha256:context.report.sha256}:null,
    scenarios:(context.scenarios||[]).map(scene=>({id:scene.id,name:scene.title,settings:scene.parameters.settings,costs:scene.parameters.costs,bank:scene.parameters.bank,rate:scene.result.rate,annualRate:scene.result.annualRate,base:scene.result.base,payTotal:scene.result.distributed,eligible_count:scene.result.nqual,created_at:scene.created_at})),
    preferences:{texts:context.preferences?.labels||{},tabOrder:context.preferences?.tab_order||[]},can_configure:context.can_configure,can_export:context.can_export,
    paymentMetrics:analysis?[{label:'Pagos registrados',value:analysis.totals.rows},{label:'Cuotas registradas',value:analysis.totals.recorded_paid,format:'money'},{label:'Capital conciliado',value:analysis.totals.reconciled_capital,format:'money'},{label:'Interés conciliado',value:analysis.totals.reconciled_interest,format:'money'},{label:'Gasto administrativo',value:analysis.totals.reconciled_admin_fee,format:'money'},{label:'Por revisar',value:analysis.totals.unresolved_rows}]:[],
    arrearsMetrics:analysis?[{label:'Préstamos con atraso',value:analysis.loans.filter(l=>l.status==='SALDO ATRASADO').length},{label:'Atraso registrado',value:total(analysis.loans.filter(l=>l.arrears!=null).map(l=>l.arrears)),format:'money'}]:[]};
}
