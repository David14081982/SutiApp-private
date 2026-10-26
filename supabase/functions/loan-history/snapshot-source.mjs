import {HistoryError} from './history.mjs';

export const SNAPSHOT_WORKBOOK='1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
const CONTRACT='HISTORY_SNAPSHOT_READ_V1';
const loanKeys=['source_row','id','owner','date','amount','fund','term','principal','total','scheduled','number','paid_to_date','expected_to_date','status','authorized'];
const requestKeys=['id','owner','fund','term','principal','total','date','status','receipt'];
const countKeys=['loan_rows','request_rows','folios','issues','loan_source_rows','request_source_rows','ignored_blank_loan_rows','ignored_blank_request_rows','unaddressable_owner_rows','unaddressable_owner_groups'];
const fail=(code='HISTORY_SNAPSHOT_SOURCE_INVALID')=>{throw new HistoryError(code);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const scalar=value=>value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value);
const day=value=>value===null||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const unaddressable=owner=>!owner||owner==='0'||owner!==owner.trim()||owner.length>100;
const validReceipt=(receipt,id)=>receipt===null||exact(receipt,['id','identity','sourceHash'])&&
 ['string','number'].includes(typeof receipt.id)&&(typeof receipt.id!=='number'||Number.isFinite(receipt.id))&&String(receipt.id)===id&&
 typeof receipt.identity==='string'&&(/^SR-/.test(receipt.identity)||/^[0-9]+$/.test(receipt.identity))&&typeof receipt.sourceHash==='string'&&/^[a-f0-9]{64}$/i.test(receipt.sourceHash);

async function digest(value){
 const result=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function validateHistorySnapshot(data){
 if(!exact(data,['ok','action','contract_version','workbook_id','loan_sheet_id','request_sheet_id','observed_at','loans','requests','issues','counts','fingerprints'])||
  data.ok!==true||data.action!=='read_history_snapshot'||data.contract_version!==CONTRACT||data.workbook_id!==SNAPSHOT_WORKBOOK||
  data.loan_sheet_id!==1245291756||data.request_sheet_id!==10616270||typeof data.observed_at!=='string'||
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.observed_at)||!Number.isFinite(Date.parse(data.observed_at))||
  !Array.isArray(data.loans)||!Array.isArray(data.requests)||!Array.isArray(data.issues)||!exact(data.counts,countKeys)||
  !exact(data.fingerprints,['loans','requests','issues','content']))fail();
 const counts=data.counts;
 if(Object.values(counts).some(v=>!Number.isSafeInteger(v)||v<0)||counts.loan_rows!==data.loans.length||counts.request_rows!==data.requests.length||
  counts.issues!==data.issues.length||counts.loan_source_rows!==counts.loan_rows+counts.ignored_blank_loan_rows||
  counts.request_source_rows!==counts.request_rows+counts.ignored_blank_request_rows)fail();
 const owners=new Set(),unaddressableOwners=new Set(),requestOwners=new Set(),loanRows=new Set();let unaddressableRows=0;
 function owner(row){
  if(['id','owner','fund','status'].some(k=>typeof row[k]!=='string'))fail();
  owners.add(row.owner);if(unaddressable(row.owner)){unaddressableRows++;unaddressableOwners.add(row.owner);}
 }
 for(const row of data.loans){
  if(!exact(row,loanKeys)||!Number.isSafeInteger(row.source_row)||row.source_row<2||row.source_row>counts.loan_source_rows+1||loanRows.has(row.source_row)||
   !day(row.date)||!day(row.authorized)||['amount','term','principal','total','scheduled','number','paid_to_date','expected_to_date'].some(k=>!scalar(row[k])))fail();
  loanRows.add(row.source_row);owner(row);
 }
 for(const row of data.requests){
  if(!exact(row,requestKeys)||!day(row.date)||['term','principal','total'].some(k=>!scalar(row[k]))||!validReceipt(row.receipt,row.id))fail();
  owner(row);requestOwners.add(row.owner);
 }
 const issueRows=new Set();
 for(const issue of data.issues){
  if(!exact(issue,['owner','source_row','code'])||typeof issue.owner!=='string'||!requestOwners.has(issue.owner)||
   !Number.isSafeInteger(issue.source_row)||issue.source_row<2||issue.source_row>counts.request_source_rows+1||
   issue.code!=='HISTORY_TRANSFER_IDENTITY_INVALID'||issueRows.has(issue.source_row))fail();
  issueRows.add(issue.source_row);
 }
 if(counts.folios!==owners.size||counts.unaddressable_owner_rows!==unaddressableRows||counts.unaddressable_owner_groups!==unaddressableOwners.size)fail();
 const contents={loans:JSON.stringify(data.loans),requests:JSON.stringify(data.requests),issues:JSON.stringify(data.issues),content:JSON.stringify({loans:data.loans,requests:data.requests,issues:data.issues})};
 for(const name of Object.keys(contents))if(typeof data.fingerprints[name]!=='string'||!/^[a-f0-9]{64}$/i.test(data.fingerprints[name])||
  (await digest(contents[name]))!==data.fingerprints[name].toLowerCase())fail('HISTORY_SNAPSHOT_FINGERPRINT_MISMATCH');
 return data;
}

// Preserve exact historical owners, including unreachable blank/zero owners.
// No Auth or name/email lookup occurs in a complete background observation.
export async function groupHistorySnapshot(data){
 await validateHistorySnapshot(data);
 const grouped=new Map();
 function group(owner){if(!grouped.has(owner))grouped.set(owner,{folio:owner,loans:[],requests:[],issues:[]});return grouped.get(owner);}
 for(const row of data.loans)group(row.owner).loans.push(row);
 for(const row of data.requests)group(row.owner).requests.push(row);
 for(const issue of data.issues)group(issue.owner).issues.push(issue);
 const output=[];
 for(const entry of grouped.values()){
  const source_text=JSON.stringify({loans:entry.loans,requests:entry.requests,issues:entry.issues});
  output.push({folio:entry.folio,source_text,content_hash:await digest(source_text)});
 }
 return output.sort((a,b)=>a.folio<b.folio?-1:a.folio>b.folio?1:0);
}

// Worker-only transport; no browser request may choose a Folio/range or call
// this complete-source action. Existing OAuth and shared GAS secret stay private.
export async function readHistorySnapshotSource(env,fetcher=fetch){
 try{
  const client=env('GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_ID'),clientSecret=env('GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_SECRET'),refresh=env('GOOGLE_REQUEST_SYNC_OAUTH_REFRESH_TOKEN');
  const endpoint=env('FINANCIAL_LEGACY_API_URL'),secret=env('FINANCIAL_LEGACY_API_TOKEN');
  if([client,clientSecret,refresh,endpoint,secret].some(v=>typeof v!=='string'||!v))fail('HISTORY_SNAPSHOT_SOURCE_UNAVAILABLE');
  const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({client_id:client,client_secret:clientSecret,refresh_token:refresh,grant_type:'refresh_token',
    scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy'}),signal:AbortSignal.timeout(15000)});
  const token=await response.json();if(!response.ok||typeof token.access_token!=='string'||!token.access_token)fail('HISTORY_SNAPSHOT_SOURCE_UNAVAILABLE');
  const result=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},
   body:JSON.stringify({action:'read_history_snapshot',contract_version:CONTRACT,secret}),signal:AbortSignal.timeout(180000)});
  const data=await result.json();if(!result.ok)fail('HISTORY_SNAPSHOT_SOURCE_UNAVAILABLE');
  if(data?.ok===false&&['HISTORY_SNAPSHOT_SOURCE_CHANGED','HISTORY_SNAPSHOT_SOURCE_INVALID'].includes(data.error))fail(data.error);
  return await validateHistorySnapshot(data);
 }catch(error){if(error instanceof HistoryError)throw error;fail('HISTORY_SNAPSHOT_SOURCE_UNAVAILABLE');}
}
