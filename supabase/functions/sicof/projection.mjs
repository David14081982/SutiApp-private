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
// Gross, recorded contributions and credited yield by origin semester. This is
// an export projection: opening balances and withdrawals are never contributions.
export function buildContinuousSavingsReport(context) {
  const first='2026-07-01',validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  const exact=v=>typeof v==='string'&&v!==''&&v===v.trim(),keyFor=d=>d.slice(0,4)+'-S'+(Number(d.slice(5,7))<=6?'1':'2');
  const cutoff=context?.today;
  if(!validDate(cutoff)||!Array.isArray(context?.participants)||!Array.isArray(context?.report?.rows))throw Error('SICOF_CONTINUOUS_CONTEXT_REQUIRED');
  if(!validDate(context.from)||context.from>first||!validDate(context.to)||context.to<cutoff||context.as_of!==cutoff)throw Error('SICOF_CONTINUOUS_FULL_CONTEXT_REQUIRED');
  const amount=v=>{if(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))return null;try{const n=Number(v),c=cents(n);return Math.abs(c/100-n)<1e-7?c:null;}catch{return null;}};
  const periods=[];
  for(let year=2026;year<=Number(cutoff.slice(0,4));year++)for(let semester=1;semester<=2;semester++){
    const starts_on=year+(semester===1?'-01-01':'-07-01'),ends_on=year+(semester===1?'-06-30':'-12-31');
    if(starts_on<first||starts_on>cutoff)continue;
    const word=semester===1?'1ER':'2DO';
    periods.push({key:year+'-S'+semester,year,semester,starts_on,ends_on,through:ends_on<cutoff?ends_on:cutoff,
      capital_header:year+' '+word+' SEMESTRE AHORRO',yield_header:year+' REND. '+word+' SEMESTRE'});
  }
  const historical=new Map(),people=new Map(),rows=[],originErrors=[];
  for(const h of context.report.rows){
    if(!exact(h.folio)||historical.has(h.folio)||!h.cells||String(h.cells.A)!==h.folio)throw Error('SICOF_CONTINUOUS_HISTORICAL_IDENTITY_INVALID');
    historical.set(h.folio,h);
  }
  const ids=new Set();
  for(const p of context.participants){
    if(!exact(p.folio)||!p.id||ids.has(p.id)||people.has(p.folio))throw Error('SICOF_CONTINUOUS_IDENTITY_INVALID');
    ids.add(p.id);people.set(p.folio,p);
  }
  const balanceKeys=['capital','yield_amount','total','held_capital','held_yield','held','available'];
  for(const folio of [...historical.keys(),...[...people.keys()].filter(f=>!historical.has(f))]){
    const h=historical.get(folio),p=people.get(folio),issues=new Map(periods.map(s=>[s.key,{CAPITAL:new Set(),YIELD:new Set()}]));
    const known=new Map(periods.map(s=>[s.key,{CAPITAL:0,YIELD:0}])),evidence=new Map(periods.map(s=>[s.key,{CAPITAL:[],YIELD:[]}]));
    const row={folio,name:p?.name??h?.cells?.B??'',participant_id:p?.id??null,source_row:h?.source_row??null,
      historical_cells:h?Object.fromEntries(Array.from({length:13},(_,i)=>{const k=String.fromCharCode(65+i);return[k,h.cells[k]??null];})):null,
      period_values:{},withdrawals:{from:first,through:cutoff,capital:null,yield_amount:null,total:null,state:p?'REVIEW_REQUIRED':'NO_ACCOUNT',
        confirmed_capital:null,confirmed_yield_amount:null,confirmed_total:null,reasons:[]},
      balances:Object.fromEntries(balanceKeys.map(k=>[k,null])),reasons:[]};
    const addIssue=(component,code,key=null)=>{
      for(const s of periods.filter(s=>!key||s.key===key)){
        const bucket=issues.get(s.key)[component];if(bucket.has(code))continue;bucket.add(code);
        originErrors.push({folio,period_key:s.key,component,code});
      }
      if(!row.reasons.includes(code))row.reasons.push(code);
    };
    const add=(component,key,value,source,id,date)=>{
      if(!known.has(key))return;
      const sum=known.get(key)[component]+value;
      if(!Number.isSafeInteger(sum))throw Error('SICOF_CONTINUOUS_AMOUNT_OVERFLOW');
      known.get(key)[component]=sum;evidence.get(key)[component].push({source,id,date,amount:value/100});
    };
    const ready=!!p&&p.identity_resolved===true&&p.certified===true&&Array.isArray(p.transactions)&&!!p.composition&&p.composition.as_of===cutoff&&p.composition.as_of_complete===true;
    if(!ready){for(const c of ['CAPITAL','YIELD'])addIssue(c,p?'ACCOUNT_REVIEW_REQUIRED':'HISTORICAL_ONLY_NO_ACCOUNT');}
    else {
      for(const k of balanceKeys){const v=amount(p.composition.balances?.[k]);row.balances[k]=v===null?null:v/100;}
      const invalidDates=p.transactions.filter(t=>!validDate(t.effective_date));
      for(const t of invalidDates)for(const c of ['CAPITAL','YIELD'].includes(t.component)?[t.component]:['CAPITAL','YIELD'])addIssue(c,'TRANSACTION_DATE_UNVERIFIED');
      const tx=p.transactions.filter(t=>validDate(t.effective_date)&&t.effective_date<=cutoff),classified=classifyReportTransactions(tx),indexed=new Map(tx.map(t=>[t.id,t]));
      const movements=new Map((p.composition.movements||[]).map(t=>[t.transaction_id||t.id,t]));
      const opening=validDate(p.certified_as_of)?p.certified_as_of:tx.filter(t=>t.transaction_type==='REGULARIZATION').map(t=>t.effective_date).sort()[0];
      if(p.certified_as_of!=null&&!validDate(p.certified_as_of))for(const c of ['CAPITAL','YIELD'])addIssue(c,'CERTIFICATION_CUTOFF_UNVERIFIED');
      for(const s of periods)if(opening&&opening>=s.starts_on)for(const c of ['CAPITAL','YIELD'])addIssue(c,'PRE_LEDGER_HISTORY_INCOMPLETE',s.key);
      for(const reason of p.eligibility?.reasons||[])if(['NONCANONICAL_MOVEMENTS','SOURCE_REVIEW_REQUIRED','CERTIFICATION_REQUIRED','IDENTITY_REVIEW_REQUIRED'].includes(reason))
        for(const c of ['CAPITAL','YIELD'])addIssue(c,reason);
      const historicalByDate=new Map();
      for(const item of p.history||[]){
        if(!validDate(item.date)||item.date<first||item.date>cutoff)continue;
        const key=keyFor(item.date),v=amount(item.amount);
        if(item.data_conflict){addIssue('CAPITAL','CONTRIBUTION_CONFLICT',key);continue;}
        if(item.includes_yield){addIssue('CAPITAL','MIXED_CAPITAL_YIELD_HISTORY',key);addIssue('YIELD','MIXED_CAPITAL_YIELD_HISTORY',key);continue;}
        if(item.source==='CERTIFIED_HISTORY'){
          if(!opening||item.date>opening){addIssue('CAPITAL','CERTIFIED_HISTORY_CUTOFF_INVALID',key);continue;}
          if(v===null||v<0){addIssue('CAPITAL','CERTIFIED_HISTORY_AMOUNT_INVALID',key);continue;}
          if(historicalByDate.has(item.date)){addIssue('CAPITAL','DUPLICATE_CERTIFIED_HISTORY_DATE',key);continue;}
          historicalByDate.set(item.date,item);
          add('CAPITAL',key,v,'CERTIFIED_HISTORY',item.id,item.date);
        }else if(item.status==='PENDING'||v===null)addIssue('CAPITAL','CONTRIBUTION_RECEIPT_PENDING',key);
        else if(item.source==='CANONICAL_RECEIPT'&&item.status==='NO_DEDUCTION'&&v===0&&item.data_conflict===false&&(!opening||item.date>opening))
          // A confirmed zero receipt is evidence even though it creates no money.
          add('CAPITAL',key,0,'CANONICAL_RECEIPT',item.id,item.date);
      }
      function originalOf(t,path=new Set()){
        if(!t||path.has(t.id))return null;
        return t.transaction_type==='REVERSAL'?originalOf(indexed.get(t.reversal_of_transaction_id),new Set([...path,t.id])):t;
      }
      function yieldOrigins(t,path=new Set()){
        if(!t||path.has(t.id))return null;
        const raw=t.origins??movements.get(t.id)?.origins;
        if(Array.isArray(raw)&&raw.length){
          const parsed=raw.map(o=>({key:o.origin_key,cents:amount(o.amount)}));
          if(parsed.some(o=>!/^\d{4}-S[12]$/.test(o.key)||o.cents===null||o.cents<0)||parsed.reduce((n,o)=>n+o.cents,0)!==amount(t.amount))return null;
          return parsed;
        }
        if(t.transaction_type!=='REVERSAL')return null;
        const original=indexed.get(t.reversal_of_transaction_id),origins=yieldOrigins(original,new Set([...path,t.id]));
        if(!origins)return null;
        if(amount(t.amount)===amount(original.amount))return origins;
        return origins.length===1?[{key:origins[0].key,cents:amount(t.amount)}]:null;
      }
      let capitalWithdrawals=0,yieldWithdrawals=0,withdrawalsKnown=invalidDates.length===0;
      for(const t of classified){
        const original=originalOf(t),v=amount(t.amount),key=validDate(t.contribution_date)?keyFor(t.contribution_date):null;
        if(t.error||v===null||v<0){
          if(t.effective_date>=first&&t.transaction_type==='REVERSAL'&&!original)withdrawalsKnown=false;
          if(t.transaction_type==='WITHDRAWAL'||original?.transaction_type==='WITHDRAWAL'){if(t.effective_date>=first)withdrawalsKnown=false;continue;}
          const component=['CAPITAL','YIELD'].includes(t.component)?t.component:null;
          for(const c of component?[component]:['CAPITAL','YIELD'])addIssue(c,t.error||'TRANSACTION_AMOUNT_INVALID',key);
          continue;
        }
        const signed=t.direction==='CREDIT'?v:-v;
        if(t.category==='withdrawal'){
          if(t.effective_date>=first){if(t.component==='CAPITAL')capitalWithdrawals-=signed;else yieldWithdrawals-=signed;}
          continue;
        }
        if(t.category==='contribution'){
          const contributionDate=t.contribution_date||original?.contribution_date;
          if(!validDate(contributionDate)||contributionDate>cutoff){addIssue('CAPITAL','CONTRIBUTION_ORIGIN_UNVERIFIED');continue;}
          const originKey=keyFor(contributionDate),historic=historicalByDate.get(contributionDate);
          if(opening&&t.effective_date<=opening)continue;
          if(historic){
            // The certified cell owns the pre-cutoff receipt. A later linked
            // correction is a delta; a second original receipt is ambiguous.
            const before=original?.transaction_type==='ADJUSTMENT'?tx.find(candidate=>candidate.transaction_type==='CONTRIBUTION'&&candidate.component==='CAPITAL'&&candidate.enrollment_id===original.enrollment_id&&candidate.contribution_date===contributionDate&&candidate.effective_date<=opening):original;
            if(t.transaction_type==='CONTRIBUTION'||!before||before.effective_date>opening){addIssue('CAPITAL','HISTORICAL_RECEIPT_OVERLAP',originKey);continue;}
          }
          add('CAPITAL',originKey,signed,'CANONICAL_LEDGER',t.id,contributionDate);
        }else if(t.category==='yield'){
          const origins=yieldOrigins(t);
          if(!origins){if(t.effective_date>=first)addIssue('YIELD','YIELD_ORIGIN_UNVERIFIED');continue;}
          for(const o of origins){
            const start=o.key.slice(0,4)+(o.key.endsWith('S1')?'-01-01':'-07-01');
            if(start>t.effective_date){addIssue('YIELD','YIELD_FUTURE_ORIGIN');continue;}
            add('YIELD',o.key,o.cents*(signed<0?-1:1),'CANONICAL_YIELD_CREDIT',t.id,t.effective_date);
          }
        }
      }
      const withdrawalsCovered=(!opening||opening<first)&&(p.certified_as_of==null||validDate(p.certified_as_of));
      if(withdrawalsKnown){
        const recorded={capital:capitalWithdrawals/100,yield_amount:yieldWithdrawals/100,total:(capitalWithdrawals+yieldWithdrawals)/100};
        Object.assign(row.withdrawals,{confirmed_capital:recorded.capital,confirmed_yield_amount:recorded.yield_amount,confirmed_total:recorded.total});
        if(withdrawalsCovered)Object.assign(row.withdrawals,recorded,{state:'VERIFIED'});
        else {row.withdrawals.state='PARTIAL';row.withdrawals.reasons.push('PRE_LEDGER_WITHDRAWALS_UNVERIFIED');row.reasons.push('PRE_LEDGER_WITHDRAWALS_UNVERIFIED');}
      }else {row.withdrawals.reasons.push('WITHDRAWAL_HISTORY_UNVERIFIED');row.reasons.push('WITHDRAWAL_HISTORY_UNVERIFIED');}
    }
    for(const s of periods){
      const values={reasons:[...new Set([...issues.get(s.key).CAPITAL,...issues.get(s.key).YIELD])]};
      for(const [component,field] of [['CAPITAL','capital'],['YIELD','yield_amount']]){
        const codes=[...issues.get(s.key)[component]],sum=known.get(s.key)[component],proved=evidence.get(s.key)[component];
        if(sum<0){addIssue(component,'NEGATIVE_RECORDED_TOTAL',s.key);codes.push('NEGATIVE_RECORDED_TOTAL');values.reasons.push('NEGATIVE_RECORDED_TOTAL');}
        const partial=codes.length>0&&codes.every(code=>['PRE_LEDGER_HISTORY_INCOMPLETE','CONTRIBUTION_RECEIPT_PENDING'].includes(code))&&proved.length>0;
        const state=!p?'NO_ACCOUNT':!codes.length?'VERIFIED':partial?'PARTIAL':'REVIEW_REQUIRED';
        values[field]=state==='VERIFIED'||state==='PARTIAL'?sum/100:null;
        values[component==='CAPITAL'?'capital_state':'yield_state']=state;
        values[component==='CAPITAL'?'capital_reasons':'yield_reasons']=codes;
        values['confirmed_'+field]=proved.length?sum/100:ready&&!codes.length?0:null;
        values[component==='CAPITAL'?'capital_evidence':'yield_evidence']=proved;
      }
      row.period_values[s.key]=values;
    }
    rows.push(row);
  }
  const sumKnown=values=>values.some(v=>v==null)?null:total(values);
  const totals={period_values:Object.fromEntries(periods.map(s=>[s.key,{
    capital:sumKnown(rows.map(r=>r.period_values[s.key].capital)),yield_amount:sumKnown(rows.map(r=>r.period_values[s.key].yield_amount)),
    capital_state:rows.some(r=>r.period_values[s.key].capital===null)?'REVIEW_REQUIRED':rows.some(r=>r.period_values[s.key].capital_state==='PARTIAL')?'PARTIAL':'VERIFIED',
    yield_state:rows.some(r=>r.period_values[s.key].yield_amount===null)?'REVIEW_REQUIRED':rows.some(r=>r.period_values[s.key].yield_state==='PARTIAL')?'PARTIAL':'VERIFIED'}])),
    withdrawals:Object.fromEntries(['capital','yield_amount','total'].map(k=>[k,sumKnown(rows.map(r=>r.withdrawals[k]))])),
    balances:Object.fromEntries(balanceKeys.map(k=>[k,sumKnown(rows.map(r=>r.balances[k]))]))};
  return {schema_version:'SICOF_CONTINUOUS_SAVINGS_V1',cutoff,from:first,periods,rows,totals,origin_error_semesters:originErrors,notes:[
    'A:M conserva los valores históricos originales. Las nuevas parejas comienzan en julio de 2026 y sólo aparecen cuando inicia cada semestre según la fecha del servidor.',
    'Ahorro acumula aportaciones comprobadas por fecha de contribución, netas de sus correcciones y reversiones. Rendimiento acumula sólo abonos realmente acreditados por periodo de origen, netos de sus reversiones.',
    'Los retiros no reducen estas aportaciones ni rendimientos acumulados. Se muestran por fecha efectiva, por separado del saldo canónico actual. No sumar las columnas históricas al saldo actual.',
    'PARTIAL identifica un subtotal de registros comprobados cuando falta historia anterior o existen recibos pendientes de confirmar; no es el total completo del semestre. Los importes pendientes no se incluyen en la suma. Sin registros comprobados, o si hay un conflicto, permanece POR CONCILIAR; nunca se inventa cero. Los retiros del intervalo también quedan por conciliar si la apertura no demuestra su historia anterior.',
    'Un saldo inicial certificado no demuestra las aportaciones brutas ni los rendimientos acreditados antes de los retiros. Identificar su origen no lo convierte en un nuevo ingreso.'
  ]};
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
