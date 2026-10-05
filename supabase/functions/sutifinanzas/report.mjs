// Owner-authorized Google projection. No database, filesystem or persistent cache.
export const WORKBOOK = '1-ijVLS90bCtFN6bFW5gEs1Geo2sKri88ER94dH42n60';
export const SHEET = 'Gasto por secretaría';
export const HEADERS = Object.freeze({
  requisitionId:'🔒 Row ID Requisición', id:'ID Producto', requisition:'REQUISICIÓN',
  secretariat:'Secretaría', expenseType:'TIPO DE GASTOS', concept:'Concepto', amount:'Gran total Comprobado',
  date:'FECHA DEL GASTO', project:'Nombre del proyecto', item:'Partida presupuestal',
  budgetCode:'Clave presupuestal', status:'Estatus', payment:'Forma de pago', year:'AÑO'
});
export class ReportError extends Error {
  constructor(code, details={}) { super(code); this.details=details; }
}
const present=v=>v!==null&&v!==undefined&&v!=='';
const header=v=>String(v??'').normalize('NFC').trim(); // Case matters: two expense-date columns exist.
function dateValue(value,row) {
  if(!present(value))return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<1||value>100000)
    throw new ReportError('INVALID_DATE',{row,header:HEADERS.date});
  return new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000).toISOString().slice(0,10);
}
export function projectSheet(values,consultedAt=new Date().toISOString()) {
  if(!Array.isArray(values))throw new ReportError('SOURCE_INVALID');
  const required=Object.values(HEADERS);
  const candidates=values.slice(0,30).map((r,index)=>({index,cells:r.map(header),score:required.filter(h=>r.map(header).includes(h)).length}));
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0]||{index:0,cells:[],score:0};
  const missing=required.filter(h=>!best.cells.includes(h));
  if(missing.length)throw new ReportError('MISSING_HEADERS',{missing});
  const duplicate=required.filter(h=>best.cells.filter(c=>c===h).length!==1);
  if(duplicate.length)throw new ReportError('AMBIGUOUS_HEADERS',{headers:duplicate});
  const mapping=Object.fromEntries(Object.entries(HEADERS).map(([k,h])=>[k,best.cells.indexOf(h)]));
  const ids=new Set(),records=[],quality={missingSecretariat:0,missingRequisition:0,missingYear:0,missingDate:0,missingStatus:0};
  for(let i=best.index+1;i<values.length;i++) {
    const raw=values[i];if(!raw.some(present))continue;
    if(required.every(h=>header(raw[best.cells.indexOf(h)])===h))continue;
    const r=Object.fromEntries(Object.entries(mapping).map(([k,c])=>[k,raw[c]??null]));
    // Source product identity separates actual line items from summary/header rows.
    if(!present(r.id))throw new ReportError('ROW_WITHOUT_PRODUCT_ID',{row:i+1,header:HEADERS.id});
    if(typeof r.amount!=='number'||!Number.isFinite(r.amount))throw new ReportError('INVALID_AMOUNT',{row:i+1,header:HEADERS.amount});
    if(!Number.isSafeInteger(Math.round(r.amount*100)))throw new ReportError('INVALID_AMOUNT',{row:i+1,header:HEADERS.amount});
    if(present(r.year)&&(!Number.isInteger(r.year)||r.year<1900||r.year>9999))throw new ReportError('INVALID_YEAR',{row:i+1,header:HEADERS.year});
    if(!present(r.year))r.year=null;
    r.date=dateValue(r.date,i+1);r.row=i+1;
    for(const k of ['id','requisitionId','requisition','secretariat','expenseType','concept','project','item','budgetCode','status','payment']) {
      if(present(r[k])&&!['number','string'].includes(typeof r[k]))throw new ReportError('INVALID_CELL',{row:i+1,header:HEADERS[k]});
      r[k]=present(r[k])?String(r[k]):null;
    }
    if(ids.has(r.id))throw new ReportError('DUPLICATE_PRODUCT_ID',{row:i+1,header:HEADERS.id});
    ids.add(r.id);
    for(const [q,k] of [['missingSecretariat','secretariat'],['missingRequisition','requisition'],['missingYear','year'],['missingDate','date'],['missingStatus','status']])if(!present(r[k]))quality[q]++;
    records.push(r);
  }
  return {version:1,source:{name:'Google Sheets',sheet:SHEET,consultedAt,headerRow:best.index+1},records,quality};
}
async function serviceAssertion(env) {
  // Owner-authorized server-to-server authentication. No human OAuth fallback.
  const raw=env('SUTIFINANZAS_GOOGLE_SERVICE_ACCOUNT_JSON');
  if(!raw)throw new ReportError('GOOGLE_NOT_CONFIGURED');
  try {
    const account=JSON.parse(raw);
    if(account.type!=='service_account'||typeof account.client_email!=='string'||
      !/^sutifinanzas-reader@[a-zA-Z0-9-]+\.iam\.gserviceaccount\.com$/.test(account.client_email)||
      typeof account.private_key!=='string'||!account.private_key.startsWith('-----BEGIN PRIVATE KEY-----'))throw Error();
    const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const text=value=>encode(new TextEncoder().encode(JSON.stringify(value)));
    const now=Math.floor(Date.now()/1000);
    const unsigned=text({alg:'RS256',typ:'JWT'})+'.'+text({iss:account.client_email,
      scope:'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+900});
    const der=Uint8Array.from(atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'')),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
    return unsigned+'.'+encode(new Uint8Array(signature));
  }catch(_){throw new ReportError('GOOGLE_NOT_CONFIGURED');}
}
export async function readGoogle(env,fetcher=fetch) {
  const assertion=await serviceAssertion(env);
  const tokenResponse=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({assertion,grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer'}),signal:AbortSignal.timeout(15000)});
  const token=await tokenResponse.json();
  if(!tokenResponse.ok||!token.access_token)throw new ReportError('GOOGLE_AUTH_FAILED');
  // Exact tab, whole used value range: no fixed column boundary or silent row truncation.
  const response=await fetcher('https://sheets.googleapis.com/v4/spreadsheets/'+WORKBOOK+'/values/'+encodeURIComponent("'"+SHEET+"'")+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(45000)});
  if(!response.ok){
    let reason='';try{const error=await response.json();reason=String(error.error?.errors?.[0]?.reason||error.error?.status||'').replace(/[^A-Za-z_]/g,'').slice(0,80);}catch(_){}
    throw new ReportError(response.status===403?'GOOGLE_ACCESS_DENIED':'GOOGLE_UNAVAILABLE',{googleStatus:response.status,googleReason:reason});
  }
  const body=await response.json();
  return projectSheet(body.values||[]);
}
export async function loadReport(body,client,readSource) {
  if(!body||body.action!=='LOAD'||Object.keys(body).some(k=>k!=='action'))throw new ReportError('REQUEST_INVALID');
  const auth=await client.auth.getUser();
  if(auth.error||!auth.data?.user)throw new ReportError('AUTH_REQUIRED');
  const permission=await client.rpc('has_admin_permission',{required_permission:'program_requests.read'});
  const boundary=await client.rpc('admin_module_boundary',{p_modules:['sutifinanzas'],p_action:'read'});
  if(permission.error||permission.data!==true||boundary.error||boundary.data!==true)throw new ReportError('ADMIN_DENIED');
  return readSource();
}
