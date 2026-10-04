// SICOF simulations are derived reports. This module cannot post transactions,
// authorize a withdrawal, change an eligibility exception or credit yield.
export const ENGINE_VERSION = 'SICOF_2026_10_04_V4';
const DAY = 86400000;
export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('SICOF_DATE_INVALID');
  const d = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== value) throw Error('SICOF_DATE_INVALID');
  return value;
}
export function cents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e10) throw Error('SICOF_AMOUNT_INVALID');
  const n = Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
  if (!Number.isSafeInteger(n)) throw Error('SICOF_AMOUNT_INVALID');
  return n;
}
const money = value => value == null ? null : value / 100;
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
const periodKey = d => d.slice(0, 4) + (Number(d.slice(5, 7)) <= 6 ? '-S1' : '-S2');
const previousKey = d => Number(d.slice(5, 7)) <= 6 ? (Number(d.slice(0, 4)) - 1) + '-S2' : d.slice(0, 4) + '-S1';
const amountOf = t => cents(Number(t.amount)) * (t.direction === 'CREDIT' ? 1 : -1);
const sum = values => values.reduce((a, b) => a + b, 0);
const moneySum = values => money(sum(values.map(v => cents(v))));
const enumValue = (v, allowed) => { if (!allowed.includes(v)) throw Error('SICOF_SETTING_INVALID'); return v; };
function integer(value, min, max) { if (!Number.isInteger(value) || value < min || value > max) throw Error('SICOF_SETTING_INVALID'); return value; }
function bool(value) { if (typeof value !== 'boolean') throw Error('SICOF_SETTING_INVALID'); return value; }
export function validateSettings(input) {
  if (!input || typeof input !== 'object') throw Error('SICOF_SETTINGS_REQUIRED');
  const s = {src:enumValue(input.src, ['caja','sel','todos']), selFunds:input.selFunds || [], pay:Number(input.pay),
    method:enumValue(input.method, ['avg','end']), periodIni:date(input.periodIni), periodFin:date(input.periodFin),
    minm:integer(input.minm, 0, 120), exterm:bool(input.exterm), exmin:bool(input.exmin),
    warn:integer(input.warn, 0, 1000), exConsec:bool(input.exConsec), consecN:integer(input.consecN, 1, 100),
    loanEffect:enumValue(input.loanEffect,['retiro','rendimiento']),retScope:enumValue(input.retScope,['todo','adeudo']),
    anchorOn:bool(input.anchorOn),anchorDate:input.anchorOn ? date(input.anchorDate) : input.anchorDate || null,
    capitalBasis:enumValue(input.capitalBasis || 'all',['all','period']),yieldMode:enumValue(input.yieldMode || 'none',['none','previous','selected']),
    yieldPeriods:input.yieldPeriods || []};
  if (s.periodIni > s.periodFin || days(s.periodIni,s.periodFin) > 3660 || !Number.isFinite(s.pay) || s.pay < 0 || s.pay > 100 ||
      !Array.isArray(s.selFunds) || s.selFunds.some(f=>typeof f!=='string'||!f.trim()) || !Array.isArray(s.yieldPeriods) ||
      s.yieldPeriods.some(f=>typeof f!=='string'||!/^\d{4}(?:-S[12])?$/.test(f))) throw Error('SICOF_SETTING_INVALID');
  if (s.capitalBasis==='period' && !(['01-01','07-01'].includes(s.periodIni.slice(5)) && s.periodFin === s.periodIni.slice(0,4)+(s.periodIni.endsWith('01-01')?'-06-30':'-12-31'))) throw Error('SICOF_FULL_SEMESTER_REQUIRED');
  if (s.yieldMode==='selected' && s.yieldPeriods.some(key=>(key.slice(0,4)+(key.endsWith('-S1')?'-06-30':'-12-31'))>=s.periodIni)) throw Error('SICOF_PRIOR_YIELD_PERIOD_REQUIRED');
  return s;
}
function completedMonths(from, to) {
  if (!from) return null;
  if (from > to) return 0;
  date(from);
  const a = from.split('-').map(Number), b = to.split('-').map(Number);
  return Math.max(0,(b[0]-a[0])*12+b[1]-a[1]-(b[2]<a[2]?1:0));
}
function selectedOrigins(s) { return s.yieldMode === 'previous' ? [previousKey(s.periodIni)] : s.yieldPeriods; }
function originSelected(key, component, s) {
  if (component === 'CAPITAL') return s.capitalBasis === 'all' || key === periodKey(s.periodIni);
  return s.yieldMode !== 'none' && selectedOrigins(s).includes(key);
}
// A single common day denominator; deposits earn from their effective day and
// withdrawals stop earning on their effective day. A certified opening is not
// pretended to be an individual deposit on the date of its later import.
function basisEvents(person, s, prepared) {
  const transactions = prepared ? prepared.transactions : (person.transactions || []).map(t=>{date(t.effective_date);return t;});
  const tx = transactions.filter(t=>t.effective_date<=s.periodFin);
  const byId = prepared ? prepared.byId : new Map((person.composition?.movements || []).map(t=>[t.id || t.transaction_id,t]));
  const events = [], errors = [];
  const openingDate = person.certified_as_of || (person.transactions||[]).filter(t=>t.transaction_type==='REGULARIZATION').map(t=>t.effective_date).sort()[0];
  for (const t of tx) {
    if (!['CAPITAL','YIELD'].includes(t.component) || !['CREDIT','DEBIT'].includes(t.direction)) throw Error('SICOF_LEDGER_INVALID');
    const n = amountOf(t), composed = byId.get(t.id);
    const origins = t.origins || composed?.origins || [];
    const unrestricted = t.component === 'CAPITAL' && s.capitalBasis === 'all';
    if (unrestricted) events.push({date:t.effective_date,cents:n});
    else if (t.component === 'YIELD' && s.yieldMode === 'none') continue;
    else if (origins.length) {
      if (sum(origins.map(o=>cents(Number(o.amount)))) !== Math.abs(n)) { errors.push('ORIGIN_ALLOCATION_INCOMPLETE'); continue; }
      if(origins.some(o=>o.origin_key==='OPENING'||String(o.origin_key).startsWith('UNALLOCATED_')||
        /^\d{4}$/.test(o.origin_key)&&(t.component==='CAPITAL'?o.origin_key===s.periodIni.slice(0,4):selectedOrigins(s).some(k=>k.startsWith(o.origin_key+'-')))))errors.push('PERIOD_ORIGIN_UNRESOLVED');
      for (const o of origins) if (originSelected(o.origin_key,t.component,s)) events.push({date:t.effective_date,cents:cents(Number(o.amount))*(n<0?-1:1)});
    } else {
      const key = t.origin_key || (['CONTRIBUTION','ADJUSTMENT'].includes(t.transaction_type) && t.contribution_date ? periodKey(t.contribution_date) : null);
      if (key && originSelected(key,t.component,s)) events.push({date:t.effective_date,cents:n});
      else if (!key) errors.push('PERIOD_ORIGIN_UNRESOLVED');
    }
  }
  return {events, errors, openingDate, regularization:tx.some(t=>t.transaction_type==='REGULARIZATION'),timelines:new Map()};
}
function basisTimeline(events,from,interval) {
  const end=sum(events.map(e=>e.cents)),totalCents=events.reduce((a,e)=>a+BigInt(e.cents),0n);
  // Exact BigInt identity: shifting the common cutoff by N days adds each
  // event's cents * N. No float approximation or alternative interest rule.
  const initialWeight=events.reduce((a,e)=>a+BigInt(e.cents)*BigInt(interval(e.date<from?from:e.date,from)),0n);
  const dated=new Map();
  for(const e of events){const day=e.date<from?from:e.date;dated.set(day,(dated.get(day)||0)+e.cents);}
  if(!dated.has(from))dated.set(from,0);
  const ordered=[...dated.keys()].sort(),prefix=[];let running=0,last;
  for(let i=0;i<ordered.length;i++){
    const day=ordered[i];running+=dated.get(day);
    const step={date:day,amount:money(dated.get(day)),balance:money(running)};
    if(i+1<ordered.length){const until=new Date(Date.parse(ordered[i+1])-DAY).toISOString().slice(0,10),duration=interval(day,until);prefix.push({...step,days:duration,balance_days:money(running*duration)});}
    else last={step,running};
  }
  return {end,totalCents,initialWeight,prefix,last};
}
function computeBasis(person, s, prepared) {
  // Selection is independent of payout, costs and method. Future cutoffs share
  // the same ledger events once they pass the last authorized movement.
  const cutoff=prepared&&s.periodFin>prepared.lastDate?prepared.lastDate:s.periodFin;
  const eventKey=prepared?JSON.stringify([cutoff,periodKey(s.periodIni),s.capitalBasis,s.yieldMode,selectedOrigins(s)]):null;
  let selected=prepared?.events.get(eventKey);
  if(!selected){selected=basisEvents(person,s,prepared);if(prepared)remember(prepared.events,eventKey,selected);}
  const {events,openingDate}=selected,errors=[];
  if(openingDate && openingDate>s.periodFin)errors.push('HISTORICAL_CUTOFF_UNPROVEN');
  if(s.method==='avg'&&openingDate&&openingDate>s.periodIni&&selected.regularization)errors.push('HISTORICAL_DAILY_BALANCE_UNPROVEN');
  errors.push(...selected.errors);
  const interval=prepared?prepared.days:days;
  const totalDays = interval(s.periodIni,s.periodFin);
  const timeline=prepared?(selected.timelines.get(s.periodIni)||remember(selected.timelines,s.periodIni,basisTimeline(events,s.periodIni,interval))):basisTimeline(events,s.periodIni,interval);
  const {end}=timeline,weighted=timeline.initialWeight+timeline.totalCents*BigInt(totalDays-1);
  if (end<0 || weighted<0n) errors.push('NEGATIVE_BASIS');
  const valid = !errors.length;
  const duration=interval(timeline.last.step.date,s.periodFin),steps=[...timeline.prefix,{...timeline.last.step,days:duration,balance_days:money(timeline.last.running*duration)}];
  return {end:valid?end:null,average:valid?Number(weighted)/totalDays:null,weight:valid?(s.method==='avg'?weighted:BigInt(end)*BigInt(totalDays)):0n,
    errors:[...new Set(errors)],days:totalDays,steps:valid?steps:[]};
}
export function basisFor(person, settings) { return computeBasis(person,settings); }
function remember(cache,key,value) {
  if(cache.size>=32)cache.delete(cache.keys().next().value);
  cache.set(key,value);return value;
}
function allocateCents(total, rows) {
  const weights = rows.map(r=>r.ok?r._weight:0n), denominator = weights.reduce((a,b)=>a+b,0n);
  if (!denominator) return rows.map(()=>0);
  const numerators = weights.map(w=>BigInt(total)*w), amounts = numerators.map(n=>Number(n/denominator));
  const remaining = total-sum(amounts);
  const order = numerators.map((n,i)=>({i,remainder:n%denominator,key:rows[i].participant_id})).sort((a,b)=>a.remainder===b.remainder?String(a.key).localeCompare(String(b.key)):a.remainder>b.remainder?-1:1);
  for (let i=0;i<remaining;i++) amounts[order[i].i]++;
  return amounts;
}
function validateCosts(input) {
  if (!Array.isArray(input) || input.length>200) throw Error('SICOF_COST_INVALID');
  const seen = new Set();
  return input.map(c=>{
    if (!c || typeof c.concept!=='string'||!c.concept.trim()||c.concept.length>500||typeof c.id!=='string'||seen.has(c.id)||cents(c.amount)<0) throw Error('SICOF_COST_INVALID');
    seen.add(c.id);
    return {id:c.id,concept:c.concept.trim(),amount:c.amount,source:enumValue(c.source,['pool','reserve']),status:enumValue(c.status,['estimated','committed','paid']),date:c.date?date(c.date):null};
  });
}
function paymentTotals(loanAnalysis,s) {
  const acceptedFunds=s.src==='caja'?['Caja de Ahorro']:s.src==='sel'?[...new Set(['Caja de Ahorro',...s.selFunds])]:null;
  const payments=loanAnalysis.payments.filter(p=>(!acceptedFunds||acceptedFunds.includes(p.fund))&&(!p.date||(p.date>=s.periodIni&&p.date<=s.periodFin)));
  const collected=sum(payments.filter(p=>p.audit==='RECONCILED_SOURCE_PAYMENT').map(p=>cents(p.interest)));
  const projected=sum(payments.filter(p=>p.audit==='PROJECTED').map(p=>cents(p.projected_interest)));
  const fees=sum(payments.filter(p=>p.audit==='RECONCILED_SOURCE_PAYMENT').map(p=>cents(p.fee)));
  const unresolved=payments.filter(p=>p.audit==='REVIEW_REQUIRED');
  return {collected,projected,fees,unresolved};
}
function analysisFacts(loanAnalysis,today) {
  const dates=[...new Set(loanAnalysis.payments.filter(p=>p.audit==='RECONCILED_SOURCE_PAYMENT').map(p=>p.date))].sort();
  const byDate=new Map();
  for(const payment of loanAnalysis.payments)if(payment.audit==='RECONCILED_SOURCE_PAYMENT'){if(!byDate.has(payment.date))byDate.set(payment.date,[]);byDate.get(payment.date).push(payment);}
  let caja=0,all=0;
  const recovery=dates.map(d=>{for(const p of byDate.get(d)) {all+=cents(p.paid);if(p.fund==='Caja de Ahorro')caja+=cents(p.paid);}return {label:d,caja:money(caja),all:money(all)};});
  // Current contractual receivables are not bank cash or guaranteed recovery.
  // They cannot be reconstructed at an earlier cutoff from a mutable sheet.
  const portfolioLoans=loanAnalysis.loans.filter(l=>l.fund==='Caja de Ahorro');
  const portfolioUncertain=loanAnalysis.loans.some(l=>!l.fund)||portfolioLoans.some(l=>l.behavior==='REVIEW_REQUIRED'||l.total==null||l.paid==null||!Number.isFinite(l.total)||!Number.isFinite(l.paid));
  const portfolio=portfolioUncertain?null:moneySum(portfolioLoans.map(l=>money(Math.max(0,cents(l.total)-cents(l.paid)))));
  const groupedLoans=new Map();
  for(const loan of loanAnalysis.loans){const fund=loan.fund||'Fondo por conciliar';if(!groupedLoans.has(fund))groupedLoans.set(fund,[]);groupedLoans.get(fund).push(loan);}
  const fundRecovery=[...groupedLoans].map(([label,loans])=>{
    const reliable=loans.every(l=>l.fund&&l.behavior!=='REVIEW_REQUIRED'&&typeof l.total==='number'&&typeof l.paid==='number'&&Number.isFinite(l.total)&&Number.isFinite(l.paid)&&l.total>=l.paid&&l.paid>=0);
    return {label,paid:reliable?moneySum(loans.map(l=>l.paid)):null,pending:reliable?moneySum(loans.map(l=>money(cents(l.total)-cents(l.paid)))):null,total:reliable?moneySum(loans.map(l=>l.total)):null,as_of:today};
  });
  return {recovery,portfolio,fundRecovery};
}
function missedContributions(person,s,today) {
  const hist=(person.history||[]).filter(h=>h.date>=s.periodIni&&h.date<=s.periodFin&&h.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
  let run=0,maxMissQ=0;
  for(const h of hist){run=h.amount===0&&h.expected>0?run+(person.enrollment?.frequency==='MONTHLY'?2:1):0;maxMissQ=Math.max(maxMissQ,run);}
  return maxMissQ;
}
function savingsReviewReasons(person) {
  const eligibility=person.eligibility;
  if(eligibility?.complete===true)return [];
  const reasons=eligibility?.reasons?.length?eligibility.reasons:['Políticas y aportaciones pendientes de verificación'];
  if(!person.identity_resolved||!person.certified)return reasons;
  // Permanent owner decision, 2026-10-04: existing Supabase savings values
  // are valid. Only the program manager corrects them. An absent historical
  // target or a pending source observation cannot invalidate accepted money.
  // Do not fill expected, copy pending proposals, or invent a daily timeline.
  const history=(person.history||[]).filter(h=>h.source==='CERTIFIED_HISTORY');
  const recordedHistory=history.length>0&&history.every(h=>h.amount!=null&&Number.isFinite(Number(h.amount)));
  const balance=person.composition?.as_of_balance||person.composition?.balances||person.balance;
  const recordedBalance=balance&&['capital','yield_amount'].every(key=>balance[key]!=null&&Number.isFinite(Number(balance[key])));
  return reasons.filter(reason=>!(reason==='HISTORICAL_EXPECTATION_UNVERIFIED'&&recordedHistory)
    &&!(reason==='SOURCE_REVIEW_REQUIRED'&&recordedBalance));
}
function participantRows(context,loanAnalysis,s,today,prepared) {
  const participantIds=new Set(), folios=new Set();
  return context.participants.map(p=>{
    if (!p.id||participantIds.has(p.id)||typeof p.folio!=='string'||folios.has(p.folio)) throw Error('SICOF_DUPLICATE_IDENTITY');
    participantIds.add(p.id);folios.add(p.folio);
    const b=prepared?prepared.basis(p,s):basisFor(p,s), en=p.enrollment||{}, starts=(en.first_actual_contribution_date||en.enrollment_started_at||'').slice(0,10);
    const tenureFrom=s.anchorOn&&starts&&starts<s.anchorDate?s.anchorDate:starts, months=completedMonths(tenureFrom,s.periodFin);
    const loans=prepared?(prepared.analysis(loanAnalysis).loansByFolio.get(p.folio)||[]):loanAnalysis.loans.filter(l=>l.folio===p.folio), overdue=loans.some(l=>l.status==='SALDO ATRASADO'||l.behavior==='OVERDUE'), debt=sum(loans.map(l=>cents(Math.max(0,l.arrears||0))));
    const reasons=[...b.errors], review=[];
    const policyMessages={SHORT_CONTRIBUTION:'Descuentos no cubiertos dentro del periodo',PERIOD_ALREADY_RECONCILED:'Periodo ya incluido en el rendimiento histórico',EARLY_OR_EXTRAORDINARY_WITHDRAWAL:'Retiro anticipado o extraordinario en el periodo'};
    for(const code of p.eligibility?.policy_reasons||[])if(policyMessages[code])reasons.push(policyMessages[code]);
    if(s.exterm&&(p.eligibility?.policy_reasons||[]).includes('INACTIVE_ENROLLMENT'))reasons.push('Inscripción sin ahorro activo');
    if (!p.identity_resolved||!p.certified) review.push('Identidad o saldo por certificar');
    review.push(...savingsReviewReasons(p));
    const maxMissQ=prepared?prepared.history(p,s,today):missedContributions(p,s,today);
    if (s.exterm&&(en.terminated_at||'').slice(0,10)&&en.terminated_at.slice(0,10)<=s.periodFin) reasons.push('Baja en el periodo');
    if (s.exmin&&months===null) review.push('Fecha de inicio del ahorro pendiente de verificar');
    else if (s.exmin&&months<s.minm) reasons.push('No cumple '+s.minm+' meses');
    if (s.exConsec&&maxMissQ>=s.consecN) reasons.push('Quincenas consecutivas sin descuento');
    if (s.loanEffect==='rendimiento'&&overdue) reasons.push('Préstamo con saldo atrasado');
    const balance=p.composition?.as_of_balance||p.composition?.balances||p.balance||{};
    const capital=balance.capital==null?NaN:Number(balance.capital), oldYield=balance.yield_amount==null?NaN:Number(balance.yield_amount);
    if (!Number.isFinite(capital)||!Number.isFinite(oldYield)) review.push('Saldo canónico no disponible');
    if (loans.some(l=>{
      // Only the source analyzer can supply this additive proof. Old sources
      // retain their strict review path; stale/current-day evidence is explicit.
      const proof=l.savings_evidence;
      if(proof)return proof.version!=='SICOF_CURRENT_LOAN_EVIDENCE_V1'||proof.verified!==true||proof.as_of!==today;
      return l.status===null||l.behavior==='REVIEW_REQUIRED';
    })) review.push('Estado o adeudo de préstamos por verificar');
    const ok=!reasons.length&&!review.length&&b.weight>0n;
    return {participant_id:p.id,f:p.folio,n:p.name||p.nombre,e:en.status,t:en.terminated_at,months,endbal:money(b.end),avgbal:b.average==null?null:money(b.average),
      capital:Number.isFinite(capital)?capital:null,previous_yield:Number.isFinite(oldYield)?oldYield:null,available:s.periodFin>=today?p.composition?.balances?.available??balance.available??null:null,
      ok,motivo:[...reasons,...review].join('; '),review_required:!!review.length||!!b.errors.length,rend:null,total:null,retenido:null,entregable:null,pct:null,
      ov:overdue,debt:money(debt),maxMissQ,_weight:ok?b.weight:0n,movements:p.composition?.movements||p.transactions||[],periods:p.composition?.periods||[],loans,
      calculation_steps:b.steps,calculation_explanation:b.errors.length?'Se requiere conciliar la historia y los orígenes antes de reconstruir este cálculo.':'Suma del saldo de cada intervalo por sus días, dividida entre '+b.days+' días del periodo común. Los retiros dejan de participar desde su fecha efectiva.',existing_policy_reasons:p.eligibility?.policy_reasons||[]};
  });
}
// Shared input validation for simulations and source-only exports. This does
// not derive a balance or allocation; normalized values retain their existing
// representation so both paths produce the same calculation fingerprint.
export function validateCalculationInputs(input) {
  const s=validateSettings(input.settings), costs=validateCosts(input.costs||[]), bank=input.bank||{amount:null};
  const declared=bank.amount==null||bank.amount===''?null:cents(bank.amount);
  if (declared!=null&&(declared<0||!bank.declaredBy?.trim()||!bank.date)) throw Error('SICOF_BANK_DECLARATION_REQUIRED');
  if (bank.date) date(bank.date);
  return {settings:s,costs,bank};
}
export function calculateSicof(context, loanAnalysis, input) {
  return calculateCore(context,loanAnalysis,input);
}
// Disposable preparation for one immutable, authorized observation. It is not
// a data source and never survives a context/file/session replacement. The
// ordinary server calculation and prepared calculation share every formula.
export function createPreparedCalculator(context, loanAnalysis) {
  if(!context||!Array.isArray(context.participants)||!loanAnalysis||!Array.isArray(loanAnalysis.payments)||!Array.isArray(loanAnalysis.loans))throw Error('SICOF_SOURCE_INVALID');
  const analyses=new WeakMap(),people=new WeakMap(),timestamps=new Map();
  const timestamp=value=>{if(!timestamps.has(value))timestamps.set(value,Date.parse(value));return timestamps.get(value);};
  const interval=(from,to)=>Math.round((timestamp(to)-timestamp(from))/DAY)+1;
  const preparation={
    analysis(value){
      let state=analyses.get(value);
      if(!state){
        const loansByFolio=new Map();
        for(const loan of value.loans){if(!loansByFolio.has(loan.folio))loansByFolio.set(loan.folio,[]);loansByFolio.get(loan.folio).push(loan);}
        state={loansByFolio,rows:new Map(),payments:new Map(),facts:null};analyses.set(value,state);
      }
      return state;
    },
    basis(person,s){
      let state=people.get(person);
      if(!state){
        const transactions=(person.transactions||[]).map(t=>{date(t.effective_date);return t;});
        state={transactions,byId:new Map((person.composition?.movements||[]).map(t=>[t.id||t.transaction_id,t])),
          lastDate:transactions.reduce((last,t)=>t.effective_date>last?t.effective_date:last,''),events:new Map(),basis:new Map(),history:new Map(),days:interval};
        people.set(person,state);
      }
      const key=JSON.stringify([s.periodIni,s.periodFin,s.method,s.capitalBasis,s.yieldMode,s.yieldPeriods]);
      return state.basis.get(key)||remember(state.basis,key,computeBasis(person,s,state));
    },
    history(person,s,today){
      const state=people.get(person),key=JSON.stringify([s.periodIni,s.periodFin<today?s.periodFin:today]);
      return state.history.has(key)?state.history.get(key):remember(state.history,key,missedContributions(person,s,today));
    },
    rows(analysis,s,today){
      const state=this.analysis(analysis),key=JSON.stringify([s.periodIni,s.periodFin,s.method,s.capitalBasis,s.yieldMode,s.yieldPeriods,
        s.minm,s.exterm,s.exmin,s.exConsec,s.consecN,s.loanEffect,s.anchorOn,s.anchorDate]);
      return state.rows.get(key)||remember(state.rows,key,participantRows(context,analysis,s,today,this));
    },
    payments(analysis,s){
      const state=this.analysis(analysis),key=JSON.stringify([s.periodIni,s.periodFin,s.src,s.selFunds]);
      return state.payments.get(key)||remember(state.payments,key,paymentTotals(analysis,s));
    },
    facts(analysis,today){
      const state=this.analysis(analysis),facts=state.facts||(state.facts=analysisFacts(analysis,today));
      return {...facts,recovery:facts.recovery.map(row=>({...row})),fundRecovery:facts.fundRecovery.map(row=>({...row}))};
    }
  };
  return Object.freeze({calculate(input,analysis=loanAnalysis){return calculateCore(context,analysis,input,preparation);}});
}
function calculateCore(context, loanAnalysis, input, prepared) {
  const {settings:s,costs,bank}=validateCalculationInputs(input);
  if (!context || !Array.isArray(context.participants) || !loanAnalysis || !Array.isArray(loanAnalysis.payments)) throw Error('SICOF_SOURCE_INVALID');
  const today=date(context.today), alerts=[];
  const addAlert=(code,text,severity='warning')=>alerts.push({code,text,severity});
  const {collected,projected,fees,unresolved}=prepared?prepared.payments(loanAnalysis,s):paymentTotals(loanAnalysis,s);
  addAlert('DATE_SEMANTICS','Los ingresos se agrupan por la fecha de amortización de la hoja. Esa fecha no acredita por sí sola cuándo se recibió el dinero.');
  if (unresolved.length) addAlert('UNALLOCATED_PAYMENTS',unresolved.length+' pagos requieren conciliación de capital, interés y gasto administrativo; no se incluyen en la bolsa.','error');
  if (s.periodFin>today) addAlert('FUTURE_CUTOFF','El corte es futuro: aportaciones e intereses aún no cobrados se muestran como proyección.');
  const policyDeviations=[];
  if (!s.exmin||s.minm!==6||s.anchorOn) policyDeviations.push('permanencia');
  if (!s.exterm) policyDeviations.push('bajas');
  if (s.method!=='end') policyDeviations.push('saldo promedio');
  if (s.yieldMode!=='none') policyDeviations.push('rendimiento sobre rendimiento');
  if (policyDeviations.length) addAlert('POLICY_SCENARIO','El escenario compara opciones de '+policyDeviations.join(', ')+'. Acreditar rendimientos conserva las validaciones y autorizaciones del proceso de Ahorro.');
  const originalPool=Math.round(collected*s.pay/100), originalReserve=collected-originalPool;
  const poolCosts=sum(costs.filter(c=>c.source==='pool').map(c=>cents(c.amount))), reserveCosts=sum(costs.filter(c=>c.source==='reserve').map(c=>cents(c.amount)));
  const spill=Math.max(0,reserveCosts-originalReserve), distributable=Math.max(0,originalPool-poolCosts-spill), reserve=Math.max(0,originalReserve-reserveCosts);
  if (poolCosts+reserveCosts>collected) addAlert('COST_DEFICIT','Los apartados y costos superan el interés conciliado; no queda bolsa para repartir.','error');
  const rows=prepared?prepared.rows(loanAnalysis,s,today).map(r=>({...r,calculation_steps:r.calculation_steps.map(step=>({...step}))})):participantRows(context,loanAnalysis,s,today);
  const allocations=allocateCents(distributable,rows);
  rows.forEach((r,i)=>{
    r.rend=r.review_required?null:money(allocations[i]);
    if (r.capital!=null&&r.previous_yield!=null&&r.rend!=null) {
      const total=cents(r.capital)+cents(r.previous_yield)+allocations[i];
      const hold=r.ov?(s.retScope==='todo'?total:Math.min(cents(r.debt),total)):0;
      r.total=money(total);r.retenido=money(hold);r.entregable=money(total-hold);
    }
    r.pct=r.rend!=null&&(s.method==='avg'?r.avgbal:r.endbal)>0?r.rend/(s.method==='avg'?r.avgbal:r.endbal)*100:null;
  });
  const weight=rows.reduce((a,r)=>a+r._weight,0n), base=Number(weight)/days(s.periodIni,s.periodFin)/100, distributed=moneySum(rows.filter(r=>r.rend!=null).map(r=>r.rend));
  rows.forEach(r=>{r.share=weight>0n?Number(r._weight)*100/Number(weight):null;delete r._weight;});
  const reviewCount=rows.filter(r=>r.review_required).length;
  const basisPending=base===0&&reviewCount>0;
  const reviewReasons=Object.entries(rows.filter(r=>r.review_required).reduce((counts,row)=>{
    for(const reason of new Set(row.motivo.split('; ').filter(Boolean)))counts[reason]=(counts[reason]||0)+1;
    return counts;
  },{})).map(([reason,count])=>({reason,count})).sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason));
  if (reviewCount) addAlert('SAVINGS_REVIEW',reviewCount+' ahorradores tienen datos pendientes de conciliación. La tasa calculada usa únicamente bases verificables y es provisional.','error');
  if (!base) addAlert('NO_VERIFIED_BASIS','No hay base elegible verificable para calcular una tasa.','error');
  const declared=bank.amount==null||bank.amount===''?null:cents(bank.amount);
  // A paid cost on/before the bank declaration is already reflected there.
  // It still affects profit but is not deducted from cash a second time.
  const futureCashCosts=sum(costs.filter(c=>c.status!=='paid'||!c.date||!bank.date||c.date>bank.date).map(c=>cents(c.amount)));
  const payTotal=rows.some(r=>r.entregable==null)?null:moneySum(rows.map(r=>r.entregable));
  const cash=declared==null?null:money(declared-futureCashCosts), coverage=cash==null||payTotal==null||payTotal<=0?null:cash/payTotal*100;
  const rate=base>0?distributed/base*100:null;
  const projectedOriginalPool=Math.round((collected+projected)*s.pay/100),projectedReserve=collected+projected-projectedOriginalPool;
  const projectedNetPool=Math.max(0,projectedOriginalPool-poolCosts-Math.max(0,reserveCosts-projectedReserve));
  if(rate!=null&&rate*365/days(s.periodIni,s.periodFin)>s.warn)addAlert('ANNUAL_RATE_THRESHOLD','La tasa equivalente anual supera el umbral configurado de '+s.warn+'%. No constituye una tasa garantizada.');
  const totals={capital:rows.some(r=>r.capital==null)?null:moneySum(rows.map(r=>r.capital)),yield:rows.some(r=>r.previous_yield==null)?null:moneySum(rows.map(r=>r.previous_yield)),
    withdrawals:money(sum(context.participants.flatMap(p=>p.transactions||[]).filter(t=>t.transaction_type==='WITHDRAWAL'&&t.effective_date>=s.periodIni&&t.effective_date<=s.periodFin&&t.direction==='DEBIT').map(t=>cents(Number(t.amount)))))};
  const {recovery,portfolio,fundRecovery}=prepared?prepared.facts(loanAnalysis,today):analysisFacts(loanAnalysis,today);
  const gross=rows.some(r=>r.total==null)?null:moneySum(rows.map(r=>r.total));
  const retained=rows.some(r=>r.retenido==null)?null:moneySum(rows.map(r=>r.retenido));
  const liquidityScenarios=[10,25,50,100].map(percent=>{
    const obligation=payTotal==null?null:money(Math.round(cents(payTotal)*percent/100));
    const status=obligation==null||cash==null?'REVIEW':cash>=obligation?'CASH_COVERED':portfolio==null?'REVIEW':cents(cash)+cents(portfolio)>=cents(obligation)?'COLLECTION_DEPENDENT':'SHORTFALL';
    const cashPercent=cash==null||!obligation?null:Math.max(0,Math.min(100,cash/obligation*100));
    return {label:'Retiro del '+percent+'%',percent,cash,portfolio,payTotal:obligation,required:obligation,
      coverage:cash==null||!obligation?null:cash/obligation*100,
      coverage_with_portfolio:cash==null||portfolio==null||!obligation?null:(cash+portfolio)/obligation*100,
      surplus:cash==null||obligation==null?null:money(cents(cash)-cents(obligation)),
      shortfall:cash==null||portfolio==null||obligation==null?null:money(Math.max(0,cents(obligation)-cents(cash)-cents(portfolio))),
      cash_percent:cashPercent,portfolio_percent:cashPercent==null||portfolio==null?null:Math.max(0,Math.min(100-cashPercent,portfolio/obligation*100)),
      status,status_label:{REVIEW:'Información por conciliar',CASH_COVERED:'Cubierto con efectivo declarado',COLLECTION_DEPENDENT:'Depende de recuperar la cartera',SHORTFALL:'Respaldo insuficiente'}[status]};
  });
  const backingComplete=cash!=null&&cash>=0&&portfolio!=null;
  if(cash!=null&&cash<0)addAlert('CASH_DEFICIT','Los costos pendientes superan el saldo bancario declarado. El efectivo tiene un déficit de '+money(-cents(cash)).toFixed(2)+'; no se representa como respaldo positivo.','error');
  const backing=[{label:'Efectivo después de costos',value:backingComplete?cash:null},{label:'Cartera por recuperar · Caja de Ahorro',value:backingComplete?portfolio:null}];
  const backingTotal=backing.some(x=>x.value==null)?null:moneySum(backing.map(x=>x.value));
  return {engine_version:ENGINE_VERSION,status:'SIMULATION',settings:s,costs,bank,source:loanAnalysis.source||context.source,
    pool:money(distributable),collected:money(collected),projected:money(projected),administrative_fees:money(fees),reserve:money(reserve),base,rate,
    costsTotal:money(poolCosts+reserveCosts),costsEffectLabel:poolCosts+spill>0?'La bolsa disminuye '+money(poolCosts+spill).toFixed(2):'La bolsa no cambia',
    projectedNetPool:money(projectedNetPool),projectedRateOnConfirmedBase:base>0?money(projectedNetPool)/base*100:null,
    annualRate:rate==null?null:rate*365/days(s.periodIni,s.periodFin),distributed,payTotal,rows,alerts,totals,
    nqual:rows.filter(r=>r.ok).length,nexcl:rows.filter(r=>!r.ok&&!r.review_required).length,reviewCount,basisPending,reviewReasons,
    summary:['Simulación: no acredita ni entrega rendimientos.','El retiro efectivo mantiene su fecha y el origen de cada componente.','Los importes históricos del Excel conservan sus resultados originales.'],
    metrics:[{label:'Interés conciliado en la hoja',value:money(collected),format:'money'},{label:'Interés proyectado pendiente',value:money(projected),format:'money'},{label:'Bolsa después de costos',value:money(distributable),format:'money'},{label:'Tasa del periodo',value:rate,format:'percent'},{label:'Bolsa proyectada después de costos',value:money(projectedNetPool),format:'money'}],
    compliance:[{rule:'Registro en Sutiapp',requirement:'Identidad individual comprobada',application:'Cruce por Folio exacto con la cuenta canónica; el correo no sustituye el Folio',status:rows.some(r=>r.review_required)?'REVIEW':'CHECKED'},
      {rule:'Aportación libre, mínimo $200',requirement:'Monto y periodicidad autorizados',application:'El plan de ahorro y la conciliación de los descuentos se validan en Ahorro; no se corrigen montos reales en el simulador',status:'SOURCE_POLICY'},
      {rule:'Cláusula 3 · Monto y periodicidad',requirement:'Quincenal para activos; mensual para jubilados o pensionados',application:'Se usa la frecuencia del plan canónico. Los descuentos futuros no son faltas',status:'SOURCE_POLICY'},
      {rule:'Cláusula 4 · Origen del rendimiento',requirement:'Plazo del ahorro, préstamos y recuperaciones',application:s.method==='avg'?'Saldo promedio por días del mismo periodo':'Saldo final al corte',status:'SIMULATION'},
      {rule:'Cláusula 5 · Tasa semestral',requirement:'Actualizar la tasa por periodo',application:s.periodIni+' al '+s.periodFin+'; configurar no acredita rendimientos',status:'SIMULATION'},
      {rule:'Cláusula 6 · Permanencia',requirement:'Mínimo de seis meses y excepciones autorizadas',application:s.exmin?'Mínimo configurado: '+s.minm+' meses':'Regla desactivada en este escenario',status:s.exmin&&s.minm===6&&!s.anchorOn?'CHECKED':'POLICY_SCENARIO'},
      {rule:'Cláusula 8 · Omisión o insolvencia',requirement:'Descuentos cubiertos y conciliados',application:reviewCount+' cuentas requieren revisión; no se inventa rendimiento cuando faltan datos',status:reviewCount?'REVIEW':'SOURCE_POLICY'},
      {rule:'Cláusula 9 · Descuentos consecutivos',requirement:'Cuatro quincenas sin descuento',application:(s.exConsec?'Activa':'Desactivada')+' en el escenario; umbral '+s.consecN+'. La baja real usa el proceso autorizado',status:s.exConsec&&s.consecN===4?'CHECKED':'POLICY_SCENARIO'},
      {rule:'Cláusula 10 · Préstamo atrasado',requirement:'Ahorro retenido como garantía según autorización',application:rows.filter(r=>r.ov).length+' cuentas con saldo atrasado; se simula '+(s.retScope==='todo'?'retención total':'retención hasta el adeudo')+'. No crea retenciones efectivas',status:'SIMULATION'},
      {rule:'Cláusula 11 · Fallecimiento',requirement:'Beneficiarios y adeudos comprobados',application:'Los beneficiarios permanecen en su proceso de Ahorro. SICOF no entrega dinero automáticamente',status:'SEPARATE_PROCESS'},
      {rule:'Cláusulas 2 y 7 · Ventanas y reingreso',requirement:'Fechas y altas autorizadas por periodo',application:'Se conservan las aperturas, inscripciones y validaciones de Ahorro',status:'SEPARATE_PROCESS'},
      {rule:'Políticas de ahorro',requirement:'Acreditación mediante el proceso autorizado de Ahorro',application:'Escenario comparativo; no cambia políticas ni excepciones',status:'SIMULATION'},
      {rule:'Capital e interés',requirement:'Conciliación de componentes',application:unresolved.length+' pagos pendientes',status:unresolved.length?'REVIEW':'RECONCILED'},
      {rule:'Fecha del ingreso',requirement:'Fecha efectiva de recepción',application:'La fuente aporta fecha de amortización',status:'REVIEW'}],
    liquidity:{cash,portfolio,portfolio_as_of:today,gross,retained,payTotal,coverage,backing_complete:backingComplete,
      metrics:[{label:'Saldo bancario declarado',value:money(declared),format:'money'},{label:'Efectivo después de costos pendientes',value:cash,format:'money'},{label:'Entrega simulada',value:payTotal,format:'money'},{label:'Cobertura',value:coverage,format:'percent'},
        {label:'Obligación bruta simulada',value:gross,format:'money'},{label:'Retenciones simuladas',value:retained,format:'money'},{label:'Cartera por recuperar · Caja de Ahorro',value:portfolio,format:'money'}],
      scenarios:liquidityScenarios,
      composition:backing.map(item=>({...item,amount:item.value,share:backingTotal>0&&item.value!=null?item.value/backingTotal*100:null})),
      notes:['La declaración bancaria no constituye una conciliación bancaria.','Los costos ya pagados antes del saldo declarado no se restan otra vez al efectivo.','La cartera corresponde a la situación actual de Caja de Ahorro al '+today+'; no es efectivo ni cobranza garantizada. La prueba compara ese respaldo con la obligación simulada del periodo elegido.','Sin declaración bancaria no se estima efectivo ni se certifica cobertura.']},
    charts:{byFund:fundRecovery,byFundNote:'Situación contractual actual por fondo al '+today+'. Las filas con totales inconsistentes quedan por conciliar; la recuperación acumulada usa las cuotas del intervalo seleccionado.',recovery},
    certification:{can_post:false,can_certify_cash_income:false,reasons:['SIMULATION_ONLY',...(reviewCount?['SAVINGS_REVIEW']:[]),...(unresolved.length?['LOAN_REVIEW']:[])]}};
}
export async function fingerprint(value) {
  function stable(v) {return Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;}
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(value)))))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
