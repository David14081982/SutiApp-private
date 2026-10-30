import {createReadOnlyAssertion,TOKEN_ENDPOINT} from './google-auth.mjs';
import {WORKBOOK,ReportError} from './report.mjs';

export const CASH_FLOW_RANGES=Object.freeze(["'HISTORIAL P V2'!A:D","'HISTORIAL P V2'!G:K","'HISTORIAL P V2'!S:S","'HISTORIAL P V2'!AE:AE"]);
export const CONSOLIDATED_CASH_FLOW_RANGES=Object.freeze([
 "'HISTORIAL P V2'!A:D","'HISTORIAL P V2'!F:K","'HISTORIAL P V2'!L:P","'HISTORIAL P V2'!S:S","'HISTORIAL P V2'!AE:AE","'HISTORIAL P V2'!AG:AG",
 "'Historial de solicitudes'!A:B","'Historial de solicitudes'!D:J"
]);
// Same service account and read-only scope; no Apps Script or financial writer.
export async function readCashFlowGoogle(env,fetcher=fetch){
 let assertion;try{assertion=await createReadOnlyAssertion(env);}catch(_){throw new ReportError('GOOGLE_NOT_CONFIGURED');}
 try{
  const auth=await fetcher(TOKEN_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({assertion,grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer'}),signal:AbortSignal.timeout(15000)});
  const token=await auth.json();if(!auth.ok||typeof token.access_token!=='string')throw new ReportError('GOOGLE_AUTH_FAILED');
  const query=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});CASH_FLOW_RANGES.forEach(r=>query.append('ranges',r));
  const response=await fetcher('https://sheets.googleapis.com/v4/spreadsheets/'+WORKBOOK+'/values:batchGet?'+query,{method:'GET',headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new ReportError(response.status===403?'GOOGLE_ACCESS_DENIED':'GOOGLE_UNAVAILABLE');
  const data=await response.json();if(data.spreadsheetId!==WORKBOOK||data.valueRanges?.length!==CASH_FLOW_RANGES.length)throw new ReportError('GOOGLE_RESPONSE_INVALID');
  const rows=[],offsets=[0,6,18,30];
  data.valueRanges.forEach((r,k)=>{if(!Array.isArray(r.values))throw new ReportError('GOOGLE_RESPONSE_INVALID');r.values.forEach((v,i)=>{if(!Array.isArray(v))throw new ReportError('GOOGLE_RESPONSE_INVALID');rows[i]??=[];v.forEach((x,j)=>rows[i][offsets[k]+j]=x);});});
  return Array.from(rows,r=>r||[]);
 }catch(error){if(error instanceof ReportError)throw error;throw new ReportError('GOOGLE_UNAVAILABLE');}
}

/** Financial sources stay read-only. Contract evidence is read with the same
 * account/scope and never through Apps Script or a financial write adapter. */
export async function readConsolidatedCashFlowGoogle(env,fetcher=fetch){
 let assertion;try{assertion=await createReadOnlyAssertion(env);}catch(_){throw new ReportError('GOOGLE_NOT_CONFIGURED');}
 try{
  const auth=await fetcher(TOKEN_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({assertion,grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer'}),signal:AbortSignal.timeout(15000)});
  const token=await auth.json();if(!auth.ok||typeof token.access_token!=='string')throw new ReportError('GOOGLE_AUTH_FAILED');
  const query=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});CONSOLIDATED_CASH_FLOW_RANGES.forEach(r=>query.append('ranges',r));
  const headers={Authorization:'Bearer '+token.access_token};
  const notesQuery=new URLSearchParams({ranges:"'Historial de solicitudes'!A:A",fields:'sheets(data(startRow,rowData(values(note))))'});
  const [response,notesResponse]=await Promise.all([
   fetcher('https://sheets.googleapis.com/v4/spreadsheets/'+WORKBOOK+'/values:batchGet?'+query,{method:'GET',headers,signal:AbortSignal.timeout(45000)}),
   fetcher('https://sheets.googleapis.com/v4/spreadsheets/'+WORKBOOK+'?'+notesQuery,{method:'GET',headers,signal:AbortSignal.timeout(45000)})
  ]);
  if(!response.ok)throw new ReportError(response.status===403?'GOOGLE_ACCESS_DENIED':'GOOGLE_UNAVAILABLE');
  const data=await response.json();if(data.spreadsheetId!==WORKBOOK||data.valueRanges?.length!==CONSOLIDATED_CASH_FLOW_RANGES.length)throw new ReportError('GOOGLE_RESPONSE_INVALID');
  const loans=[],requests=[],offsets=[0,5,11,18,30,32,0,3];
  data.valueRanges.forEach((r,k)=>{if(!Array.isArray(r.values))throw new ReportError('GOOGLE_RESPONSE_INVALID');const rows=k<6?loans:requests;r.values.forEach((v,i)=>{if(!Array.isArray(v))throw new ReportError('GOOGLE_RESPONSE_INVALID');rows[i]??=[];v.forEach((x,j)=>rows[i][offsets[k]+j]=x);});});
  const requestNotes={};let notesAvailable=notesResponse.ok;
  if(notesAvailable){const notes=await notesResponse.json();notesAvailable=Array.isArray(notes.sheets);for(const sheet of notes.sheets||[])for(const block of sheet.data||[])for(const [i,row]of (block.rowData||[]).entries()){const note=row.values?.[0]?.note;if(typeof note==='string')requestNotes[(block.startRow||0)+i+1]=note;}}
  return {loans:Array.from(loans,r=>r||[]),requests:Array.from(requests,r=>r||[]),requestNotes,notesAvailable};
 }catch(error){if(error instanceof ReportError)throw error;throw new ReportError('GOOGLE_UNAVAILABLE');}
}
