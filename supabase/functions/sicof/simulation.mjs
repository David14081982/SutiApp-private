// In-memory read derivative. The financial engine is shared with the server;
// this module neither authorizes an operation nor writes a financial result.
import {calculateSicof,validateSettings,date,fingerprint} from './engine.mjs';

export const SIMULATION_VERSION='SICOF_SIMULATION_INPUT_V1';
const invalid=()=>Error('SICOF_SIMULATION_INVALID');
const rangeRequired=()=>Error('SICOF_SIMULATION_RANGE_REQUIRED');
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const minDate=(a,b)=>a<b?a:b;
const clock=options=>typeof options.now==='function'?options.now():options.now??Date.now();
const operationDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
// Match the existing loan-source display aggregation, including unresolved raw
// amounts. The engine's stricter cents validator still governs the distribution.
const sourceCents=value=>Math.round((value+Number.EPSILON)*100);
function checkedBasis(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==4||
    !['from','to','as_of','today'].every(key=>Object.hasOwn(value,key)))throw rangeRequired();
  try {for(const key of ['from','to','as_of','today'])date(value[key]);}catch{throw rangeRequired();}
  if(value.from>value.to||value.as_of!==minDate(value.to,value.today))throw rangeRequired();
  return {from:value.from,to:value.to,as_of:value.as_of,today:value.today};
}
export function validateSimulationBasis(basis,settings,today) {
  const s=validateSettings(settings),b=checkedBasis(basis);
  if(b.today!==today||b.from!==s.periodIni||s.periodFin>b.to)throw rangeRequired();
  // A historical context can be reused for settings, never for another cutoff.
  // Future cutoffs share exactly the same selected enrollment, policy evidence,
  // ledger origins and balances because their as_of remains the observed day.
  if(s.periodFin!==b.to&&(b.as_of!==today||minDate(s.periodFin,today)!==today))throw rangeRequired();
  return b;
}
export function createSimulationSeed(ctx,analysis,source,nowMs=Date.now()) {
  if(!Number.isFinite(nowMs)||!ctx||!Array.isArray(ctx.participants)||!/^[a-f0-9]{32}$/i.test(ctx.fingerprint||'')||
    !analysis||!Array.isArray(analysis.loans)||!Array.isArray(analysis.payments)||!source||
    typeof analysis.source!=='string'||!analysis.source||!/^[a-f0-9]{64}$/i.test(analysis.source_fingerprint||'')||
    analysis.source_fingerprint!==source.source_fingerprint||!instant(analysis.observed_at)||
    Date.parse(analysis.observed_at)!==Date.parse(source.observed_at)||analysis.date_semantics!=='AMORTIZATION_DATE_NOT_RECEIPT_DATE')throw invalid();
  const basis=checkedBasis({from:ctx.from,to:ctx.to,as_of:ctx.as_of,today:ctx.today});
  if(analysis.period?.from!==basis.from||analysis.period?.to!==basis.to||analysis.period?.as_of!==basis.today)throw invalid();
  let expires=nowMs+300000;
  if(source.cache_meta){
    if(source.cache_meta.state!=='READY'||!instant(source.cache_meta.expires_at))throw invalid();
    expires=Math.min(expires,Date.parse(source.cache_meta.expires_at));
  }
  if(expires<=nowMs)throw Error('SICOF_SIMULATION_EXPIRED');
  return {version:SIMULATION_VERSION,
    context:{participants:ctx.participants,today:basis.today,as_of:basis.as_of,from:basis.from,to:basis.to,fingerprint:ctx.fingerprint},basis,
    analysisMetadata:{source:analysis.source,source_fingerprint:analysis.source_fingerprint,observed_at:analysis.observed_at,date_semantics:analysis.date_semantics},
    expires_at:new Date(expires).toISOString()};
}
function requireSeed(seed,workspace,options) {
  const now=clock(options);
  if(!Number.isFinite(now)||!seed||seed.version!==SIMULATION_VERSION||!instant(seed.expires_at)||
    !seed.context||!Array.isArray(seed.context.participants)||!/^[a-f0-9]{32}$/i.test(seed.context.fingerprint||'')||
    !seed.analysisMetadata||typeof seed.analysisMetadata.source!=='string'||!seed.analysisMetadata.source||
    !/^[a-f0-9]{64}$/i.test(seed.analysisMetadata.source_fingerprint||'')||!instant(seed.analysisMetadata.observed_at)||
    seed.analysisMetadata.date_semantics!=='AMORTIZATION_DATE_NOT_RECEIPT_DATE'||
    !workspace||!Array.isArray(workspace.loans)||!Array.isArray(workspace.payments)||!Array.isArray(workspace.paymentMetrics)||workspace.paymentMetrics.length!==6||
    workspace.source?.status!=='READY'||workspace.source.fingerprint!==seed.analysisMetadata.source_fingerprint||
    Date.parse(workspace.source.observed_at)!==Date.parse(seed.analysisMetadata.observed_at))throw invalid();
  const basis=checkedBasis(seed.basis);
  if(['from','to','as_of','today'].some(key=>seed.context[key]!==basis[key]))throw invalid();
  if(Date.parse(seed.expires_at)<=now||instant(workspace.source.expires_at)&&Date.parse(workspace.source.expires_at)<=now)throw Error('SICOF_SIMULATION_EXPIRED');
  const today=options.today??operationDay(now);
  if(today!==basis.today)throw Error('SICOF_SIMULATION_DAY_CHANGED');
  return {now,today};
}
function projectAnalysis(seed,workspace,settings) {
  const inPeriod=p=>!p.date||p.date>=settings.periodIni&&p.date<=settings.periodFin;
  // Original payments retain source-row order, scalar values and audited
  // allocation states. The supported range is a subset of the loaded range.
  const payments=workspace.payments.filter(inPeriod);
  const loans=workspace.loans.map(loan=>{
    if(!Array.isArray(loan.schedule))throw invalid();
    return {...loan,schedule:loan.schedule.map(p=>({...p,in_period:inPeriod(p)}))};
  });
  const funds=new Map(),totals={rows:0,paid:0,capital:0,interest:0,fee:0,unresolved:0};
  for(const payment of payments){
    if(!Array.isArray(payment.issues)||!['RECONCILED_SOURCE_PAYMENT','PROJECTED','NO_RECORDED_PAYMENT','REVIEW_REQUIRED'].includes(payment.audit))throw invalid();
    const fund=typeof payment.fund==='string'&&payment.fund&&payment.fund===payment.fund.trim()?payment.fund:'(SOURCE_FUND_UNRESOLVED)';
    if(!funds.has(fund))funds.set(fund,{id:fund,name:fund,collected:0,projected:0,unresolved_rows:0});
    const bucket=funds.get(fund);totals.rows++;
    if(payment.issues.length){totals.unresolved++;bucket.unresolved_rows++;}
    // The source analyzer excludes every ambiguous duplicate from paid totals.
    if(typeof payment.paid==='number'&&Number.isFinite(payment.paid)&&payment.paid>=0&&!payment.issues.includes('AMBIGUOUS_LOAN_DATE_ROWS'))totals.paid+=sourceCents(payment.paid);
    if(payment.audit==='RECONCILED_SOURCE_PAYMENT'){
      totals.capital+=sourceCents(payment.capital);totals.interest+=sourceCents(payment.interest);totals.fee+=sourceCents(payment.fee);bucket.collected+=sourceCents(payment.interest);
    }
    if(payment.audit==='PROJECTED')bucket.projected+=sourceCents(payment.projected_interest);
  }
  const values=[totals.rows,totals.paid/100,totals.capital/100,totals.interest/100,totals.fee/100,totals.unresolved];
  return {analysis:{...seed.analysisMetadata,loans,payments},
    workspace:{...workspace,loans,payments,funds:[...funds.values()].map(f=>({...f,collected:f.collected/100,projected:f.projected/100})),
      paymentMetrics:workspace.paymentMetrics.map((metric,index)=>({...metric,value:values[index]}))}};
}
export async function executeSimulation(seed,workspace,input,options={}) {
  const {today}=requireSeed(seed,workspace,options),settings=validateSettings(input?.settings);
  const basis=validateSimulationBasis(seed.basis,settings,today),projected=projectAnalysis(seed,workspace,settings);
  const result=calculateSicof(seed.context,projected.analysis,{settings,costs:input.costs,bank:input.bank});
  result.fingerprint=await fingerprint({engine:result.engine_version,settings:result.settings,costs:result.costs,bank:result.bank,
    context:seed.context.fingerprint,loans:seed.analysisMetadata.source_fingerprint});
  requireSeed(seed,workspace,options);
  return {workspace:projected.workspace,result,basis};
}
