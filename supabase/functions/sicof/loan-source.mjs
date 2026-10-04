// Server-only transport. Authorization belongs to the SICOF Edge before this read.
// No direct Sheets fallback, stored snapshot, or mutation is available here.
export const SICOF_LOAN_CONTRACT = 'SICOF_FINANCIAL_READ_V1';
export const SICOF_WORKBOOK = '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
export const SICOF_SHEET_ID = 1245291756;
export const SICOF_COLUMNS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG'];
export const SICOF_FIELDS = ['date','paid','loan_id','folio','name','process','fund','rate','term','principal','total_due','discount_start','loan_charges','scheduled_charges','expected','discount_end','payment_count','ends_payment','paid_to_date','expected_to_date','status','total_recorded_paid','scheduled_admin_fee','admin_fee_total','interest_total','principal_interest_total','scheduled_capital','transfer_date','discount_date','request_date'];
const HEADERS = ['Fecha','Cuotas','ID','Folio','Nombre','Proceso','Fondo','tasa Qnal %','Plazo','Cantidad Prestamo','Total a pagar','Inicio de Descuento Quincenal','Monto Total Interes','Interes x #Plazo','Descuento Quincenal','Fecha final de pago','# de pagos','Finaliza el pago','Ha pagado HOY','Debería tener pagado HOY','Estatus del prestamo','MONTO PAGADO','Gasto Admon','TGA','Total Intereses a Pagar','Monto capital + Interes','Capital','Fecha Transferencia','Fecha descuento','Fecha de solicitud'];
const normalizeHeader = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
// Fixed, nonpersonal diagnostics only; never attach a response, token or cell.
const sourceError = stage => Error('SICOF_LOAN_SOURCE_UNAVAILABLE'+(stage?'_'+stage:''));

export function decodeSicofLoanSource(data) {
  if (!data?.ok || data.action !== 'read_sicof_financial' || data.contract_version !== SICOF_LOAN_CONTRACT ||
      data.workbook_id !== SICOF_WORKBOOK || data.sheet_id !== SICOF_SHEET_ID || data.sheet_name !== 'HISTORIAL P V2' ||
      JSON.stringify(data.columns) !== JSON.stringify(SICOF_COLUMNS)) throw sourceError('CONTRACT');
  if (!Array.isArray(data.headers)||data.headers.length!==HEADERS.length||data.headers.some((h,i)=>normalizeHeader(h)!==normalizeHeader(HEADERS[i])))throw sourceError('HEADERS');
  if (
      !Array.isArray(data.rows) || !data.rows.length || !/^[A-Fa-f0-9]{64}$/.test(data.source_fingerprint || '') ||
      !/^\d{4}-\d{2}-\d{2}T/.test(data.observed_at || '') || !Number.isFinite(Date.parse(data.observed_at))) throw sourceError('METADATA');
  let previousRow = 1;
  const rows = data.rows.map(row => {
    if (!Number.isInteger(row.source_row) || row.source_row <= previousRow || !Array.isArray(row.values) || row.values.length !== SICOF_FIELDS.length ||
        row.values.some(value => value !== null && !['string','number','boolean'].includes(typeof value))) throw sourceError('ROWS');
    previousRow = row.source_row;
    return Object.fromEntries([['source_row',row.source_row],...SICOF_FIELDS.map((field,i) => [field,row.values[i]])]);
  });
  return { contract_version:SICOF_LOAN_CONTRACT, source:SICOF_WORKBOOK+':'+SICOF_SHEET_ID,
    headers:[...data.headers], columns:[...data.columns],
    observed_at:data.observed_at, source_fingerprint:data.source_fingerprint, scanned_rows:rows.length,
    date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE', rows };
}

export async function readSicofLoanSource(env, fetcher = fetch) {
  const names = ['GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_ID','GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_SECRET','GOOGLE_REQUEST_SYNC_OAUTH_REFRESH_TOKEN','FINANCIAL_LEGACY_API_URL','FINANCIAL_LEGACY_API_TOKEN'];
  const [clientId,clientSecret,refreshToken,url,secret] = names.map(name => env(name));
  if (![clientId,clientSecret,refreshToken,url,secret].every(value => typeof value === 'string' && value.length)) throw sourceError('CONFIGURATION');
  let stage='OAUTH_REQUEST';
  try {
    const response = await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy'}),signal:AbortSignal.timeout(15000)});
    stage='OAUTH_JSON';const token = await response.json();
    if (!response.ok || !token.access_token) throw sourceError('OAUTH_REJECTED');
    stage='RECEIVER_REQUEST';
    const read = await fetcher(url,{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},
      body:JSON.stringify({action:'read_sicof_financial',secret,contract_version:SICOF_LOAN_CONTRACT}),signal:AbortSignal.timeout(45000)});
    if (!read.ok) throw sourceError('RECEIVER_HTTP');
    stage='RECEIVER_JSON';const payload=await read.json();
    if(payload?.ok===false){const known={UNAUTHORIZED:'RECEIVER_UNAUTHORIZED',INVALID_REQUEST:'RECEIVER_INVALID_REQUEST',SICOF_SOURCE_CHANGED_DURING_READ:'SOURCE_CHANGED',LOAN_SOURCE_UNAVAILABLE:'SHEET_UNAVAILABLE'};throw sourceError(known[payload.error]||'RECEIVER_REJECTED');}
    return decodeSicofLoanSource(payload);
  } catch(error) {
    if(error instanceof Error&&/^SICOF_LOAN_SOURCE_UNAVAILABLE(?:_[A-Z_]+)?$/.test(error.message))throw error;
    throw sourceError(stage+(error?.name==='TimeoutError'||error?.name==='AbortError'?'_TIMEOUT':'_FAILED'));
  }
}
