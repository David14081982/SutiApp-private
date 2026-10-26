import {HistoryError} from './history.mjs';
export const WORKBOOK='1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
export async function readHistorySource(folio,env,fetcher=fetch){
 try{
  const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({client_id:env('GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_ID')||'',client_secret:env('GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_SECRET')||'',
    refresh_token:env('GOOGLE_REQUEST_SYNC_OAUTH_REFRESH_TOKEN')||'',grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy'}),signal:AbortSignal.timeout(15000)});
  const token=await response.json();if(!response.ok||!token.access_token)throw Error();
  const r=await fetcher(env('FINANCIAL_LEGACY_API_URL'),{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},
   body:JSON.stringify({action:'read_self_history',contract_version:'SELF_HISTORY_READ_V1',secret:env('FINANCIAL_LEGACY_API_TOKEN'),folio}),signal:AbortSignal.timeout(45000)});
  const data=await r.json();
  if(!r.ok||!data.ok||data.action!=='read_self_history'||data.contract_version!=='SELF_HISTORY_READ_V1'||data.workbook_id!==WORKBOOK||data.loan_sheet_id!==1245291756||data.request_sheet_id!==10616270||data.folio!==folio||!Array.isArray(data.loans)||!Array.isArray(data.requests))throw Error();
  return data;
 }catch(_){throw new HistoryError('HISTORY_SOURCE_UNAVAILABLE');}
}
