// In-memory read derivative. The financial engine is shared with the server;
// this module neither authorizes an operation nor writes a financial result.
import {createPreparedCalculator,validateSettings,date,fingerprint} from './engine.mjs';

export const SIMULATION_VERSION='SICOF_SIMULATION_INPUT_V1';
const invalid=()=>Error('SICOF_SIMULATION_INVALID');
const rangeRequired=()=>Error('SICOF_SIMULATION_RANGE_REQUIRED');
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const minDate=(a,b)=>a<b?a:b;
const effectiveFunds=settings=>settings.src==='todos'?null:[...new Set(['Caja de Ahorro',...(settings.src==='sel'?settings.selFunds:[])])].sort();
export function simulationRangeKey(seed,settings) {return JSON.stringify(seed.mode==='FILE'?[settings.periodIni,settings.periodFin,effectiveFunds(settings)]:[settings.periodIni,settings.periodFin]);}
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
  if(seed.mode!==undefined&&seed.mode!=='FILE'||seed.mode!=='FILE'&&seed.file_basis!==undefined)throw invalid();
  if(seed.mode==='FILE'){
    validateFileSeed(seed);
    // A manually imported scenario is an explicitly dated observation. It does
    // not silently become current, authorize a write or renew its source TTL.
    return {now,today:basis.today};
  }
  if(Date.parse(seed.expires_at)<=now||instant(workspace.source.expires_at)&&Date.parse(workspace.source.expires_at)<=now)throw Error('SICOF_SIMULATION_EXPIRED');
  const today=options.today??operationDay(now);
  if(today!==basis.today)throw Error('SICOF_SIMULATION_DAY_CHANGED');
  return {now,today};
}
function validateFileSeed(seed,settings) {
  const value=seed.file_basis,keys=['version','from','to','funds','source_fingerprint','sha256'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(key=>Object.hasOwn(value,key))||
    value.version!=='SICOF_FILE_BASIS_V1'||value.from!==seed.basis.from||value.to!==seed.basis.to||
    !/^[a-f0-9]{64}$/i.test(value.source_fingerprint||'')||!/^[a-f0-9]{64}$/i.test(value.sha256||'')||
    value.funds!==null&&(!Array.isArray(value.funds)||!value.funds.length||value.funds.some(f=>typeof f!=='string'||!f||f!==f.trim())||
      !value.funds.includes('Caja de Ahorro')||JSON.stringify(value.funds)!==JSON.stringify([...new Set(value.funds)].sort())))throw Error('SICOF_FILE_BASIS_INVALID');
  if(settings){
    const selected=effectiveFunds(settings);
    if(settings.periodIni<value.from||settings.periodFin>value.to||value.funds!==null&&(selected===null||selected.some(f=>!value.funds.includes(f))))throw Error('SICOF_FILE_SCOPE_REQUIRED');
  }
  return value;
}
function prepareLoanProjection(workspace) {
  const dates=new Map(),ranges=new Map();
  for(let i=0;i<workspace.loans.length;i++){
    const loan=workspace.loans[i];if(!Array.isArray(loan.schedule))throw invalid();
    for(let j=0;j<loan.schedule.length;j++){
      const payment=loan.schedule[j];let group=dates.get(payment.date);
      if(!group){group={yes:[],no:[],other:[]};dates.set(payment.date,group);}
      group[payment.in_period===true?'yes':payment.in_period===false?'no':'other'].push([i,j]);
    }
  }
  return settings=>{
    const key=JSON.stringify([settings.periodIni,settings.periodFin]);if(ranges.has(key))return ranges.get(key);
    let loans=workspace.loans;const changed=new Set();
    const apply=(entries,included)=>{for(const [i,j] of entries){
      if(loans===workspace.loans)loans=workspace.loans.slice();
      if(!changed.has(i)){loans[i]={...workspace.loans[i],schedule:workspace.loans[i].schedule.slice()};changed.add(i);}
      loans[i].schedule[j]={...workspace.loans[i].schedule[j],in_period:included};
    }};
    for(const [day,group] of dates){const included=!day||day>=settings.periodIni&&day<=settings.periodFin;apply(included?group.no:group.yes,included);apply(group.other,included);}
    if(ranges.size>=16)ranges.delete(ranges.keys().next().value);ranges.set(key,loans);return loans;
  };
}
function projectAnalysis(seed,workspace,settings,loansForRange) {
  const inPeriod=p=>!p.date||p.date>=settings.periodIni&&p.date<=settings.periodFin;
  // Original payments retain source-row order, scalar values and audited
  // allocation states. The supported range is a subset of the loaded range.
  const fundsSelected=seed.mode==='FILE'?effectiveFunds(settings):null;
  const payments=workspace.payments.filter(p=>inPeriod(p)&&(!fundsSelected||fundsSelected.includes(p.fund)));
  const loans=loansForRange(settings);
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
export function createPreparedSimulation(seed,workspace,options={}) {
  // The caller owns this immutable observation and discards this object when
  // replacing its file, context or session. Ranges are bounded in memory.
  let calculator=null,fileProof=null,loansForRange=null;
  const ranges=new Map();
  return Object.freeze({async execute(input,overrides={}){
    const current={...options,...overrides},{today}=requireSeed(seed,workspace,current),settings=validateSettings(input?.settings);
    const basis=validateSimulationBasis(seed.basis,settings,today);
    if(seed.mode==='FILE'){
      const fileBasis=validateFileSeed(seed,settings);
      if(!fileProof)fileProof=fingerprint({version:'SICOF_FILE_BASIS_V1',file_basis:fileBasis});
      if(await fileProof!==seed.analysisMetadata.source_fingerprint)throw Error('SICOF_FILE_BASIS_INVALID');
    }
    const key=simulationRangeKey(seed,settings);
    let projected=ranges.get(key);
    if(!projected){
      if(!loansForRange)loansForRange=prepareLoanProjection(workspace);
      projected=projectAnalysis(seed,workspace,settings,loansForRange);
      if(ranges.size>=16)ranges.delete(ranges.keys().next().value);
      ranges.set(key,projected);
    }
    if(!calculator)calculator=createPreparedCalculator(seed.context,projected.analysis);
    const result=calculator.calculate({settings,costs:input.costs,bank:input.bank},projected.analysis);
    result.fingerprint=await fingerprint({engine:result.engine_version,settings:result.settings,costs:result.costs,bank:result.bank,
      context:seed.context.fingerprint,loans:seed.analysisMetadata.source_fingerprint});
    requireSeed(seed,workspace,current);
    return {workspace:projected.workspace,result,basis};
  }});
}
export async function executeSimulation(seed,workspace,input,options={}) {return createPreparedSimulation(seed,workspace,options).execute(input);}
