// Read-only contractual projection. The source engine is an exact deployment copy.
// Neither this adapter nor the engine writes Google, Supabase, balances or payments.
import {previewCorrection,validateContract} from './cash-flow-pv2-engine.mjs';
import {sourceDate,fundGroup} from './report.mjs';

export const CONTRACT_ENGINE_SHA256='3854f1bc6bc988d979d5dfdd41c385009967cad0f5d3659d70d7e85d41783d33';
export const CONTRACT_SOURCE='LIVE_OFFICIAL_REGISTERED_TERMS';
const GENERAL_TARIFF_START='2026-03-30';
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

// The original pure engine has a closed evidence enum from its isolated stage.
// Adapt that discriminator only at its boundary; public evidence keeps its true source.
function engineContract(contract){
 return contract?.evidence?.kind==='official_registered_terms'?{...contract,evidence:{...contract.evidence,kind:'explicit_approved_snapshot'}}:contract;
}
function checkedContract(contract){validateContract(engineContract(contract));return contract;}
function receiptIdentity(note,C){
 const identities=[];
 for(const line of text(note).split(/\r?\n/))if(line.startsWith('SUTI_LOAN_TRANSFER_V1:'))try{
  const r=JSON.parse(line.slice('SUTI_LOAN_TRANSFER_V1:'.length));if(text(r.id)===C&&text(r.identity))identities.push(text(r.identity));
 }catch(_){/* A note is an optional identity link, never a documentary gate. */}
 return [...new Set(identities)];
}
function observed(rows,index,convert,code){
 const values=rows.map(r=>r[index]).filter(v=>v!==undefined&&v!==null&&v!=='').map(convert);
 if(values.some(v=>v===null)||new Set(values).size>1)fail(code);
 return values.length?values[0]:null;
}
function amount(rows,index,fallback,code){const v=observed(rows,index,cents,code);return v===null?cents(fallback):v;}
function count(v){return Number.isSafeInteger(v)&&v>0&&v<=600?v:null;}
function rate(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;}
function structure(rows,n){
 if(!count(n))fail('CONTRACT_PAYMENT_COUNT_MISSING');
 if(rows.length!==n)fail('INCOMPLETE_CDS_SCHEDULE');
 const seen=new Set();for(const r of rows){const S=r[18];if(!Number.isInteger(S)||S<1||S>n||seen.has(S))fail('DUPLICATE_OR_INVALID_CDS');seen.add(S);}
}
function makeSchedule(n,total,administrationUnits,originalInstallment){
 const installment=originalInstallment??Math.floor(total/n);
 if(originalInstallment!==null&&Math.abs(originalInstallment*n-total)>Math.ceil(n/2)+1)fail('ORIGINAL_INSTALLMENT_MISMATCH');
 // A rounded original installment can leave a final-cent adjustment, never alter total.
 if(installment<=0||total-installment*(n-1)<=0)fail('ORIGINAL_INSTALLMENT_MISMATCH');
 return Array.from({length:n},(_,i)=>({S:i+1,amount:i===n-1?total-installment*(n-1):installment,adminUnits:administrationUnits}));
}
function calendarFor(rows,request,snapshot=null){
 const anchor=snapshot?.createdOn||observed(rows,32,sourceDate,'REQUEST_DATE_CONFLICT')||sourceDate(request?.[9]);
 const due=observed(rows,15,sourceDate,'CONTRACT_DUE_DATE_CONFLICT');
 const category=snapshot?.category||observed(rows,5,v=>text(v),'CONTRACT_CATEGORY_CONFLICT')||text(request?.[3]);
 if(!anchor||!due)fail('ADVANCE_ADMIN_DATES_MISSING');
 const dates=payrollAdministrativeDates(anchor,due,category);
 if(!dates.length)fail('ADVANCE_ADMIN_PERIODS_MISSING');
 return {anchor,due,category,dates,periods:dates.length};
}
function fromSnapshot(snapshot,request,rows){
 const f=snapshot.financial,C=text(rows[0][2]),D=text(rows[0][3]);
 if(!f||text(snapshot.numeroControl)!==D)fail('CONTRACT_IDENTITY_MISMATCH');
 if(rows.some(r=>!sameFund(r[6],f.fund)))fail('CONTRACT_FUND_MISMATCH');
 const principal=cents(f.amount),interest=cents(f.interest),administration=cents(f.administrativeFeeTotal),total=cents(f.total),tariff=cents(f.administrativeFeePerPayment),n=f.paymentCount;
 if([principal,interest,administration,total,tariff].some(v=>v===null))fail('CONTRACT_FINANCIAL_FIELDS_MISSING');
 if(![0,1000,1500].includes(tariff))fail('UNSUPPORTED_TARIFF');
 structure(rows,n);let adminUnits=1,calendar=null;
 if(fundGroup(f.fund)==='advance'){
  if(n!==1)fail('ADVANCE_PAYMENT_COUNT_INVALID');
  calendar=calendarFor(rows,request,snapshot);adminUnits=calendar.periods;
 }
 const warnings=[];
 if(rows.some(r=>cents(r[9])!==principal||cents(r[10])!==total||typeof f.rate==='number'&&Math.abs((rate(r[7])??NaN)-f.rate/100)>1e-9))warnings.push('REGISTERED_TERMS_DIFFER_FROM_ORIGINAL_APPROVAL');
 return checkedContract({C,D,tariff,principal,interest,administration,total,
  schedule:makeSchedule(n,total,adminUnits,cents(f.paymentPerPeriod)),rate:typeof f.rate==='number'?f.rate:null,fund:f.fund,
  evidence:{kind:'explicit_approved_snapshot',reference:snapshot.reference||snapshot.id,source:'program_requests.financial_approval_snapshot',fingerprint:snapshot.fingerprint||null,requestId:snapshot.id||null,documentRequired:false,warnings,...(calendar?{administrativeCalendar:calendar}: {})},sourceVerified:true});
}
function fromOfficialRows(rows,request,headers,sourceRows,warnings=[]){
 const C=text(rows[0][2]),D=text(rows[0][3]),fund=rows[0][6];
 if(rows.some(r=>!sameFund(r[6],fund)))fail('CONTRACT_FUND_MISMATCH');
 const principal=amount(rows,9,request?.[7],'PRINCIPAL_CONFLICT'),total=amount(rows,10,request?.[8],'CONTRACT_TOTAL_CONFLICT');
 const n=observed(rows,8,count,'CONTRACT_PAYMENT_COUNT_CONFLICT')??count(request?.[6]);structure(rows,n);
 if(principal===null||principal<=0||total===null||total<principal)fail('CONTRACT_FINANCIAL_FIELDS_MISSING');
 const r=observed(rows,7,rate,'CONTRACT_RATE_CONFLICT')??rate(request?.[5]);
 const originalInstallment=observed(rows,14,cents,'ORIGINAL_INSTALLMENT_CONFLICT');
 let calendar=null,calendarError=null,units=n;
 const advance=fundGroup(fund)==='advance';
 if(advance){if(n!==1)fail('ADVANCE_PAYMENT_COUNT_INVALID');try{calendar=calendarFor(rows,request);units=calendar.periods;}catch(e){calendarError=e.message;}}
 const interestCandidates=[];
 // Live M/N include administration (M=K-J, N=M/I); their labels do not
 // make them pure interest. Use the recorded contractual rate, never that residual.
 if(r!==null){
  interestCandidates.push({interest:Math.round(principal*r*n),basis:'REGISTERED_RATE_H_I_J'});
  if(advance&&calendar&&calendar.periods!==n)interestCandidates.push({interest:Math.round(principal*r*calendar.periods),basis:'REGISTERED_RATE_PAYROLL_PERIODS'});
 }
 const candidates=[];
 for(const candidate of interestCandidates){
  for(const tariff of [0,1000,1500]){
   if(calendarError&&tariff!==0)continue;
   const administration=tariff*units,interest=total-principal-administration;
   if(interest>=0&&Math.abs(interest-candidate.interest)<=1)candidates.push({tariff,administration,interest,basis:candidate.basis});
  }
 }
 const unique=[...new Map(candidates.map(c=>[c.tariff,c])).values()];
 let chosen=unique.length===1?unique[0]:null;
 if(unique.length>1)fail('CONTRACT_COMPONENTS_AMBIGUOUS');
 if(!chosen){
  const anchor=calendar?.anchor||observed(rows,32,sourceDate,'REQUEST_DATE_CONFLICT')||sourceDate(request?.[9]);
  if(calendarError)fail(calendarError);
  // The owner-confirmed dated general tariff is usable only without contradictory
  // registered interest. Earlier contracts never inherit the current tariff.
  if(!interestCandidates.length&&anchor&&anchor>=GENERAL_TARIFF_START&&total-principal>=1500*units)
   chosen={tariff:1500,administration:1500*units,interest:total-principal-1500*units,basis:'OWNER_DATED_GENERAL_TARIFF'};
  else fail(interestCandidates.length?'REGISTERED_COMPONENTS_INCONSISTENT':'TARIFF_OR_INTEREST_MISSING');
 }
 if(calendarError&&chosen.tariff===0)warnings.push('ZERO_TARIFF_NO_ADMINISTRATIVE_CALENDAR_REQUIRED');
 const schedule=makeSchedule(n,total,advance?(calendar?.periods||1):1,originalInstallment);
 return checkedContract({C,D,...chosen,total,principal,schedule,rate:r===null?null:r*100,fund,sourceVerified:true,
  evidence:{kind:'official_registered_terms',reference:`HISTORIAL P V2!${sourceRows.map(i=>'C'+i+':S'+i).join(',')}`,source:'Google SutiApp Final / HISTORIAL P V2',documentRequired:false,basis:chosen.basis,columns:['C','D','F','G','H','I','J','K','O','P','S','AG'],warnings,...(calendar?{administrativeCalendar:calendar}: {})}});
}

/** Current official values are valid without a PDF, transfer hash or approval certificate.
 * Optional approval linkage selects original conditions; local research JSON is never read. */
export function resolveCashFlowContracts({loans,requests=[],requestNotes={},snapshots=[]}){
 if(!Array.isArray(loans)||!Array.isArray(requests)||!Array.isArray(snapshots))fail('CONTRACT_SOURCE_INVALID');
 const groups=new Map(),requestMap=new Map(),snapshotMap=new Map(),contracts=[],protectedLoans=[];
 loans.forEach((row,i)=>{if(i<1||!text(row[2])||!text(row[3]))return;const k=key(row[2],row[3]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push({row,sourceRow:i+1});});
 requests.forEach((row,i)=>{if(i<1||!text(row[0])||!text(row[1]))return;const k=key(row[0],row[1]);if(!requestMap.has(k))requestMap.set(k,[]);requestMap.get(k).push({row,sourceRow:i+1});});
 for(const snapshot of snapshots)for(const id of new Set([snapshot.id,snapshot.reference].filter(Boolean))){if(!snapshotMap.has(id))snapshotMap.set(id,[]);snapshotMap.get(id).push(snapshot);}
 for(const [k,group]of groups){
  const rows=group.map(r=>r.row),C=text(rows[0][2]),D=text(rows[0][3]),fund=rows[0][6];
  if(!['loanSavings','pettyCash','sutiexpress','advance'].includes(fundGroup(fund)))continue;
  try{
   const matches=requestMap.get(k)||[],match=matches.length===1?matches[0]:null,request=match?.row,warnings=[];
   if(matches.length>1)warnings.push('REQUEST_LINK_AMBIGUOUS');
   const ids=new Set([C,...(match?receiptIdentity(requestNotes[match.sourceRow],C):[])]);
   const candidates=[...new Set([...ids].flatMap(id=>snapshotMap.get(id)||[]))].filter(s=>text(s.numeroControl)===D);
   if(candidates.length>1)fail('APPROVAL_IDENTITY_AMBIGUOUS');
   if(candidates.length===1){
    try{contracts.push(fromSnapshot(candidates[0],request,rows));continue;}
    catch(e){if(e.message!=='CONTRACT_FINANCIAL_FIELDS_MISSING')throw e;warnings.push('APPROVAL_FIELDS_INCOMPLETE_USING_REGISTERED_TERMS');}
   }
   contracts.push(fromOfficialRows(rows,request,loans[0],group.map(r=>r.sourceRow),warnings));
  }catch(error){protectedLoans.push({C,D,key:k,reason:error.message,scope:'COMPONENTS_ONLY',registeredAmountsPreserved:true});}
 }
 return {contracts,protectedLoans,coverage:{determined:contracts.length,protected:protectedLoans.length,source:CONTRACT_SOURCE}};
}

/** All money inputs/outputs are integer cents. Actual current B never becomes a new movement. */
export function computeContractCashFlow({contract,rows,asOf}){
 const result={status:'PROTECTED',reason:null,writeAllowed:false,payments:[],forecast:[],recovered:null,pending:null,unassignedPending:null,unassignedComponents:null,evidence:contract?.evidence||null};
 try{
  if(!date(asOf)||!Array.isArray(rows))fail('SOURCE_DATES_INVALID');
  if(!contract?.sourceVerified)fail('OFFICIAL_CONTRACT_SOURCE_REQUIRED');
  const computationContract=engineContract(contract);validateContract(computationContract);const selected=rows.filter(r=>r.C===contract.C&&r.D===contract.D).map(r=>({...r})).sort((a,b)=>a.S-b.S);
  let previous=null;
  for(const r of selected){if(!date(r.date)||previous&&r.date<previous)fail('IDENTITY_OR_DATE_ORDER');previous=r.date;}
  const engineRows=selected.map(r=>({...r,capture:r.date<=asOf?'CONFIRMED':'SCHEDULED'}));
  const actual=previewCorrection({contract:computationContract,rows:engineRows}),byS=new Map(selected.map(r=>[r.S,r]));
  const decorate=(p,capture,basis)=>{const r=byS.get(p.S);return {...p,date:r.date,sourceRow:r.sourceRow,capture,basis,registeredAmount:r.B,adjusted:p.B!==r.B};};
  result.payments=actual.payments.map(p=>decorate(p,'CORROBORATED','REGISTERED_B_CONTRACTUAL_ALLOCATION'));
  result.recovered=actual.recovered;result.pending=actual.pending;
  const proposals=new Map(actual.forecast.map(p=>[p.S,p.B]));
  // A second pure pass allocates the engine's forecast; it never enters recovered.
  const projected=previewCorrection({contract:computationContract,rows:engineRows.map(r=>({...r,B:r.capture==='SCHEDULED'?(proposals.get(r.S)||0):r.B,capture:'CONFIRMED'}))});
  result.forecast=projected.payments.filter(p=>byS.get(p.S).date>asOf&&byS.get(p.S).B>0).map(p=>decorate(p,'PROGRAMMED','DERIVED_FORECAST'));
  const future=sum(result.forecast);
  result.unassignedComponents={total:actual.pending.total-future.B,principal:actual.pending.principal-future.AD,interest:actual.pending.interest-future.AB,administration:actual.pending.administration-future.Z};
  result.unassignedPending=result.unassignedComponents.total;
  if(Object.values(result.unassignedComponents).some(x=>x<0)||result.unassignedPending!==result.unassignedComponents.principal+result.unassignedComponents.interest+result.unassignedComponents.administration)fail('FORECAST_CONSERVATION_FAILED');
  result.programmed=selected.filter(r=>r.date>asOf).map(r=>({...r,capture:'PROGRAMMED',basis:'REGISTERED_B',...unknown()}));
  result.status='DETERMINED';return result;
 }catch(error){return {...result,status:'PROTECTED',reason:error.message,recovered:null,pending:null,payments:[],forecast:[],unassignedPending:null,unassignedComponents:null};}
}
