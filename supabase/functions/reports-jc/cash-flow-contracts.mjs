// Read-only contractual projection. The source engine is an exact deployment copy.
// Neither this adapter nor the engine writes Google, Supabase, balances or payments.
import {previewCorrection,validateContract} from './cash-flow-pv2-engine.mjs';
import {sourceDate,fundGroup,requestStatus} from './report.mjs';

export const CONTRACT_ENGINE_SHA256='3854f1bc6bc988d979d5dfdd41c385009967cad0f5d3659d70d7e85d41783d33';
export const CONTRACT_SOURCE='LIVE_APPROVED_CONTRACT';
const text=v=>String(v??'').trim();
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');
const fail=c=>{throw new Error(c);};
const cents=v=>typeof v==='number'&&v>=0&&Number.isSafeInteger(Math.round(v*100))&&Math.abs(v*100-Math.round(v*100))<.00001?Math.round(v*100):null;
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&sourceDate(v)===v?v:null;
const key=(C,D)=>JSON.stringify([text(C),text(D)]);
const unknown=()=>({Z:null,AB:null,AC:null,AD:null});
const sum=rows=>Object.fromEntries(['B','Z','AB','AC','AD'].map(k=>[k,rows.reduce((a,r)=>a+r[k],0)]));
function sameFund(a,b){return norm(a)!==''&&norm(a)===norm(b);}

/** Existing advance contract calendar: (request, maturity], 15/30 (Feb 28), JUB 5. */
export function payrollAdministrativeDates(anchor,due,category){
 if(!date(anchor)||!date(due)||due<anchor)fail('ADMIN_CALENDAR_INVALID');
 const c=norm(category),monthly=['JUB','JUBILADOS Y PENS.','JUBILADOS Y PENS'].includes(c);
 if(!monthly&&!['1','3','BASE','EVENTUALES','SUPLENTES FIJOS','SUPLENTES VARIABLES','CONFIANZA'].includes(c))fail('ADMIN_CATEGORY_UNKNOWN');
 const start=new Date(anchor+'T12:00:00Z'),end=new Date(due+'T12:00:00Z'),result=[];
 let y=start.getUTCFullYear(),m=start.getUTCMonth();
 if(end.getUTCFullYear()-y>30)fail('ADMIN_CALENDAR_INVALID');
 for(;y<end.getUTCFullYear()||y===end.getUTCFullYear()&&m<=end.getUTCMonth();m++,y+=Math.floor(m/12),m%=12){
  for(const d of monthly?[5]:[15,m===1?28:30]){const s=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;if(s>anchor&&s<=due)result.push(s);}
 }
 return result;
}

function receiptFromNote(note,C){
 const lines=text(note).split(/\r?\n/).filter(x=>x.startsWith('SUTI_LOAN_TRANSFER_V1:'));
 if(!lines.length)return null;
 if(lines.length!==1)fail('TRANSFER_IDENTITY_INVALID');
 let r;try{r=JSON.parse(lines[0].slice('SUTI_LOAN_TRANSFER_V1:'.length));}catch(_){fail('TRANSFER_IDENTITY_INVALID');}
 if(text(r.id)!==C||!/^SR-/.test(r.identity||'')||!/^[a-f\d]{64}$/i.test(r.sourceHash||''))fail('TRANSFER_IDENTITY_INVALID');
 return r;
}

/** Match the current approval snapshot to the current request, never by amount or name. */
function fromSnapshot(snapshot,request,rows){
 if(snapshot.status!=='approved'||snapshot.program!=='prestamo'||!snapshot.reference||!snapshot.id||!snapshot.approvedAt||!snapshot.fingerprint)fail('APPROVAL_EVIDENCE_INCOMPLETE');
 const f=snapshot.financial,C=text(rows[0][2]),D=text(rows[0][3]);
 if(!f||text(snapshot.numeroControl)!==D||text(request[1])!==D)fail('CONTRACT_IDENTITY_MISMATCH');
 if(!sameFund(f.fund,request[4])||rows.some(r=>!sameFund(r[6],f.fund)))fail('CONTRACT_FUND_MISMATCH');
 const principal=cents(f.amount),interest=cents(f.interest),administration=cents(f.administrativeFeeTotal),total=cents(f.total),tariff=cents(f.administrativeFeePerPayment),installment=cents(f.paymentPerPeriod),n=f.paymentCount;
 if([principal,interest,administration,total,tariff,installment].some(x=>x===null)||!integer(n)||n<1)fail('CONTRACT_FINANCIAL_FIELDS_MISSING');
 if(![0,1000,1500].includes(tariff))fail('UNSUPPORTED_TARIFF');
 if(!Number.isFinite(f.rate)||f.rate<0)fail('CONTRACT_RATE_MISSING');
 if(request[6]!==n||cents(request[7])!==principal||cents(request[8])!==total||typeof request[5]!=='number'||Math.abs(request[5]-f.rate/100)>1e-9)fail('REQUEST_TERMS_CHANGED');
 let adminUnits=1;
 if(fundGroup(f.fund)==='advance'){
  if(n!==1)fail('ADVANCE_PAYMENT_COUNT_INVALID');
  const calendar=f.administrativeFeeCalendar;
  if(!calendar||!integer(f.administrativeFeePeriodCount)||!date(snapshot.createdOn))fail('ADVANCE_ADMIN_EVIDENCE_MISSING');
  const due=sourceDate(rows[0][15]);
  if(calendar.anchorDate!==snapshot.createdOn||!due||calendar.dueDate!==due)fail('ADVANCE_CALENDAR_MISMATCH');
  const dates=payrollAdministrativeDates(snapshot.createdOn,due,snapshot.category||request[3]);
  if(JSON.stringify(dates)!==JSON.stringify(calendar.dates)||calendar.periodCount!==dates.length||f.administrativeFeePeriodCount!==dates.length)fail('ADVANCE_CALENDAR_MISMATCH');
  adminUnits=dates.length;
 }
 const schedule=Array.from({length:n},(_,i)=>({S:i+1,amount:i===n-1?total-installment*(n-1):installment,adminUnits}));
 const contract={C,D,tariff,principal,interest,administration,total,schedule,rate:f.rate,fund:f.fund,
  evidence:{kind:'explicit_approved_snapshot',reference:snapshot.reference,source:'program_requests.financial_approval_snapshot',fingerprint:snapshot.fingerprint,requestId:snapshot.id},
  sourceVerified:true};
 validateContract(contract);
 validateLiveTerms(contract,rows,installment);
 return contract;
}

function validateLiveTerms(contract,rows,originalInstallment){
 if(rows.length!==contract.schedule.length)fail('INCOMPLETE_CDS_SCHEDULE');
 const seen=new Set();
 for(const r of rows){
  const s=r[18];
  if(!Number.isInteger(s)||s<1||s>contract.schedule.length||seen.has(s))fail('DUPLICATE_OR_INVALID_CDS');seen.add(s);
  if(r[8]!==contract.schedule.length||cents(r[9])!==contract.principal||cents(r[10])!==contract.total)fail('CONTRACT_TERMS_CHANGED');
  if(typeof contract.rate==='number'&&(typeof r[7]!=='number'||Math.abs(r[7]-contract.rate/100)>1e-9))fail('CONTRACT_RATE_CHANGED');
  const o=cents(r[14]);
  // O is the original rounded instalment. A tail adjustment closes the original total in memory.
  if(o===null||o!==originalInstallment)fail('ORIGINAL_INSTALLMENT_MISMATCH');
 }
}

/**
 * Current sources only. requests/loans are the existing raw Sheets arrays including headers.
 * Snapshots are read by the Admin-only RPC. No historical JSON or current tariff is a fallback.
 * documentEvidence is optional independently verified original content, never merely a URL.
 */
export function resolveCashFlowContracts({loans,requests,requestNotes={},snapshots,documentEvidence=[]}){
 if(!Array.isArray(loans)||!Array.isArray(requests)||!Array.isArray(snapshots))fail('CONTRACT_SOURCE_INVALID');
 const groups=new Map(),requestMap=new Map(),snapshotMap=new Map(),contracts=[],protectedLoans=[];
 loans.forEach((r,i)=>{if(i<1||!text(r[2])||!text(r[3]))return;const k=key(r[2],r[3]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
 requests.forEach((r,i)=>{if(i<1||!text(r[0])||!text(r[1]))return;const k=key(r[0],r[1]);if(!requestMap.has(k))requestMap.set(k,[]);requestMap.get(k).push({row:r,sourceRow:i+1});});
 for(const s of snapshots)for(const id of [s.id,s.reference].filter(Boolean)){if(!snapshotMap.has(id))snapshotMap.set(id,[]);snapshotMap.get(id).push(s);}
 for(const [k,rows] of groups){
  const C=text(rows[0][2]),D=text(rows[0][3]),fund=rows[0][6];
  if(!['loanSavings','pettyCash','sutiexpress','advance'].includes(fundGroup(fund)))continue;
  try{
   const matches=requestMap.get(k)||[];if(matches.length!==1)fail('REQUEST_IDENTITY_UNRESOLVED');
   const {row:request,sourceRow}=matches[0];if(requestStatus(request[24])!=='approved')fail('REQUEST_NOT_APPROVED');
   const receipt=receiptFromNote(requestNotes[sourceRow],C),original=receipt?.identity||C;
   const candidates=snapshotMap.get(original)||[];
   if(candidates.length===1){contracts.push(fromSnapshot(candidates[0],request,rows));continue;}
   if(candidates.length>1)fail('APPROVAL_IDENTITY_AMBIGUOUS');
   // A derived classification is usable only when original document bytes were independently
   // checked at consultation and its reference, identity and live terms still match.
   const docs=documentEvidence.filter(d=>d.contract?.C===C&&d.contract?.D===D);
   if(docs.length===1){
    const d=docs[0],c=d.contract;
    if(!/^[a-f\d]{64}$/i.test(d.observedSha256||'')||d.observedSha256.toLowerCase()!==c.evidence?.sha256?.toLowerCase()||
      c.evidence?.kind!=='original_document_reconstruction'||c.evidence.reference!==`Historial de solicitudes!AA${sourceRow}`||d.sourceUrl!==request[26])fail('DOCUMENT_EVIDENCE_NOT_VERIFIED');
    const originalInstallment=cents(rows[0][14]);
    if(originalInstallment===null||Math.abs(originalInstallment*c.schedule.length-c.total)>Math.ceil(c.schedule.length/2))fail('ORIGINAL_INSTALLMENT_MISMATCH');
    validateContract(c);validateLiveTerms(c,rows,originalInstallment);
    if(cents(request[7])!==c.principal||cents(request[8])!==c.total||request[6]!==c.schedule.length||
     typeof request[5]!=='number'||rows.some(r=>typeof r[7]!=='number'||Math.abs(r[7]-request[5])>1e-9||!sameFund(request[4],r[6])))fail('REQUEST_TERMS_CHANGED');
    contracts.push({...structuredClone(c),fund,sourceVerified:true});continue;
   }
   fail('ORIGINAL_CONTRACT_NOT_VERIFIED');
  }catch(error){protectedLoans.push({C,D,key:k,reason:error.message});}
 }
 return {contracts,protectedLoans,coverage:{determined:contracts.length,protected:protectedLoans.length,source:CONTRACT_SOURCE}};
}

/** All money inputs/outputs are integer cents. Actual current B never becomes a new movement. */
export function computeContractCashFlow({contract,rows,asOf}){
 const result={status:'PROTECTED',reason:null,writeAllowed:false,payments:[],forecast:[],recovered:null,pending:null,unassignedPending:null,unassignedComponents:null,evidence:contract?.evidence||null};
 try{
  if(!date(asOf)||!Array.isArray(rows))fail('SOURCE_DATES_INVALID');
  if(!contract?.sourceVerified)fail('ORIGINAL_CONTRACT_NOT_VERIFIED');
  validateContract(contract);const selected=rows.filter(r=>r.C===contract.C&&r.D===contract.D).map(r=>({...r})).sort((a,b)=>a.S-b.S);
  let previous=null;
  for(const r of selected){if(!date(r.date)||previous&&r.date<previous)fail('IDENTITY_OR_DATE_ORDER');previous=r.date;}
  const engineRows=selected.map(r=>({...r,capture:r.date<=asOf?'CONFIRMED':'SCHEDULED'}));
  const actual=previewCorrection({contract,rows:engineRows}),byS=new Map(selected.map(r=>[r.S,r]));
  const decorate=(p,capture,basis)=>{const r=byS.get(p.S);return {...p,date:r.date,sourceRow:r.sourceRow,capture,basis,registeredAmount:r.B,adjusted:p.B!==r.B};};
  result.payments=actual.payments.map(p=>decorate(p,'CORROBORATED','REGISTERED_B_CONTRACTUAL_ALLOCATION'));
  result.recovered=actual.recovered;result.pending=actual.pending;
  const proposals=new Map(actual.forecast.map(p=>[p.S,p.B]));
  // A second pure pass allocates the engine's forecast; it never enters recovered.
  const projected=previewCorrection({contract,rows:engineRows.map(r=>({...r,B:r.capture==='SCHEDULED'?(proposals.get(r.S)||0):r.B,capture:'CONFIRMED'}))});
  result.forecast=projected.payments.filter(p=>byS.get(p.S).date>asOf&&byS.get(p.S).B>0).map(p=>decorate(p,'PROGRAMMED','DERIVED_FORECAST'));
  const future=sum(result.forecast);
  result.unassignedComponents={total:actual.pending.total-future.B,principal:actual.pending.principal-future.AD,interest:actual.pending.interest-future.AB,administration:actual.pending.administration-future.Z};
  result.unassignedPending=result.unassignedComponents.total;
  if(Object.values(result.unassignedComponents).some(x=>x<0)||result.unassignedPending!==result.unassignedComponents.principal+result.unassignedComponents.interest+result.unassignedComponents.administration)fail('FORECAST_CONSERVATION_FAILED');
  result.programmed=selected.filter(r=>r.date>asOf).map(r=>({...r,capture:'PROGRAMMED',basis:'REGISTERED_B',...unknown()}));
  result.status='DETERMINED';return result;
 }catch(error){return {...result,status:'PROTECTED',reason:error.message,recovered:null,pending:null,payments:[],forecast:[],unassignedPending:null,unassignedComponents:null};}
}
