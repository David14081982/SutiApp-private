// Explicit, authenticated file simulation input. No storage or financial writer.
import {SICOF_FIELDS} from './loan-source.mjs';
import {date,fingerprint,validateSettings} from './engine.mjs';

export const FILE_BASIS_VERSION='SICOF_FILE_BASIS_V1';
export const MAX_FILE_BASE64=8*1024*1024;
const MAX_COMMAND=200000,MAX_EXPANDED=64*1024*1024,MAX_ROWS=50000;
const fields=SICOF_FIELDS.slice(0,15),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const invalid=()=>Error('SICOF_FILE_INVALID');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validDate=value=>{try{date(value);return true;}catch{return false;}};
const scalar=value=>value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value);
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
export const effectiveFileFunds=settings=>settings.src==='todos'?null:[...new Set(['Caja de Ahorro',...(settings.src==='sel'?settings.selFunds:[])])].sort();
export const availableSourceFunds=source=>[...new Set(source.rows.map(row=>row.fund).filter(value=>typeof value==='string'&&value&&value===value.trim()))].sort();

// Stream-bound before JSON parsing; content-length is never trusted as a limit.
export async function readSicofRequestBody(request){
  const limit=MAX_FILE_BASE64+MAX_COMMAND,reader=request.body?.getReader();
  if(!reader)throw Error('SICOF_COMMAND_INVALID');
  const chunks=[];let length=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw Error('SICOF_FILE_TOO_LARGE');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('SICOF_COMMAND_INVALID');}
  if(body?.action!=='FILE_WORKSPACE'&&length>MAX_COMMAND)throw Error('SICOF_COMMAND_INVALID');
  return body;
}
export function validateFileInput(file){
  if(!exactKeys(file,['name','base64'])||typeof file.name!=='string'||!file.name.trim()||file.name.length>180||/[\u0000-\u001f\\/]/.test(file.name)||!file.name.toLowerCase().endsWith('.xlsx')||typeof file.base64!=='string'||!file.base64.length)throw invalid();
  if(file.base64.length>MAX_FILE_BASE64)throw Error('SICOF_FILE_TOO_LARGE');
  const padding=file.base64.indexOf('=');
  if(file.base64.length%4||/[^A-Za-z0-9+/=]/.test(file.base64)||padding>=0&&(padding<file.base64.length-2||!/^={1,2}$/.test(file.base64.slice(padding))))throw invalid();
  return file;
}
export function validateFileBasis(value,settings){
  const keys=['version','from','to','funds','source_fingerprint','sha256'];
  if(!exactKeys(value,keys)||value.version!==FILE_BASIS_VERSION||!validDate(value.from)||!validDate(value.to)||value.from>value.to||!hex(value.source_fingerprint)||!hex(value.sha256)||
    value.funds!==null&&(!Array.isArray(value.funds)||!value.funds.length||value.funds.some(f=>typeof f!=='string'||!f||f!==f.trim())||!value.funds.includes('Caja de Ahorro')||!same(value.funds,[...new Set(value.funds)].sort())))throw Error('SICOF_FILE_BASIS_INVALID');
  const selected=effectiveFileFunds(validateSettings(settings));
  if(settings.periodIni<value.from||settings.periodFin>value.to||value.funds!==null&&(selected===null||selected.some(f=>!value.funds.includes(f))))throw Error('SICOF_FILE_SCOPE_REQUIRED');
  return {...value,funds:value.funds===null?null:[...value.funds]};
}
function sourceSelection(source,scope){
  if(!source||!hex(source.source_fingerprint)||!Array.isArray(source.headers)||source.headers.length<15||source.headers.slice(0,15).some(h=>typeof h!=='string')||
    !Array.isArray(source.columns)||source.columns.slice(0,15).join(',')!=='A,B,C,D,E,F,G,H,I,J,K,L,M,N,O'||!Array.isArray(source.rows))throw Error('SICOF_FILE_SOURCE_INVALID');
  const sourceRows=source.rows.filter(row=>(scope.funds===null||scope.funds.includes(row.fund))&&validDate(row.date)&&row.date>=scope.from&&row.date<=scope.to);
  if(sourceRows.length>MAX_ROWS)throw Error('SICOF_FILE_TOO_LARGE');
  const rows=sourceRows.map(row=>fields.map(key=>{if(!Object.hasOwn(row,key)||!scalar(row[key]))throw Error('SICOF_FILE_SOURCE_INVALID');return row[key];}));
  return {headers:source.headers.slice(0,15),rows,sourceRows};
}
const semanticHash=({headers,rows})=>fingerprint({headers,rows});
export const fileSourceFingerprint=basis=>fingerprint({version:FILE_BASIS_VERSION,file_basis:basis});
export async function revalidateFileBasis(value,source,settings){
  const basis=validateFileBasis(value,settings);
  if(basis.source_fingerprint!==source.source_fingerprint)throw Error('SICOF_FILE_SOURCE_CHANGED');
  const selected=sourceSelection(source,basis);
  if(await semanticHash(selected)!==basis.sha256)throw Error('SICOF_FILE_SOURCE_CHANGED');
  return {...selected,basis,source_fingerprint:await fileSourceFingerprint(basis)};
}

// Validate the ZIP envelope before ExcelJS expands it. Only the simple workbook
// exported by SICOF is accepted; no macros, attachments, external links or
// oversized/overlapping entries. XML inspection is bounded by central sizes.
async function inspectWorkbookZip(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=bytes.length;
  const u16=n=>view.getUint16(n,true),u32=n=>view.getUint32(n,true),decode=new TextDecoder('utf-8',{fatal:true});
  let eocd=-1;for(let i=length-22;i>=Math.max(0,length-65557);i--)if(u32(i)===0x06054b50){eocd=i;break;}
  if(eocd<0||eocd+22+u16(eocd+20)!==length||u16(eocd+4)||u16(eocd+6)||u16(eocd+8)!==u16(eocd+10))throw invalid();
  const count=u16(eocd+10),centralSize=u32(eocd+12),centralOffset=u32(eocd+16);
  if(count<5||count>100||centralOffset+centralSize!==eocd)throw invalid();
  let cursor=centralOffset,total=0,sheets=0;const names=new Set(),ranges=[];
  for(let i=0;i<count;i++){
    if(cursor+46>eocd||u32(cursor)!==0x02014b50)throw invalid();
    const flags=u16(cursor+8),method=u16(cursor+10),compressed=u32(cursor+20),expanded=u32(cursor+24),nameLength=u16(cursor+28),extra=u16(cursor+30),comment=u16(cursor+32),local=u32(cursor+42);
    const name=decode.decode(bytes.subarray(cursor+46,cursor+46+nameLength));cursor+=46+nameLength+extra+comment;
    if(cursor>eocd||names.has(name)||flags&1||![0,8].includes(method)||local+30>centralOffset||u32(local)!==0x04034b50)throw invalid();names.add(name);
    const localNameLength=u16(local+26),localExtra=u16(local+28),start=local+30+localNameLength+localExtra,end=start+compressed;
    if(decode.decode(bytes.subarray(local+30,local+30+localNameLength))!==name||u16(local+8)!==method||u16(local+6)!==flags||end>centralOffset)throw invalid();
    ranges.push([local,end]);total+=expanded;if(total>MAX_EXPANDED||expanded>32*1024*1024)throw Error('SICOF_FILE_TOO_LARGE');
    if(name.endsWith('/')){if(expanded||!['xl/','xl/_rels/','xl/worksheets/','xl/theme/','docProps/','_rels/'].includes(name))throw invalid();continue;}
    if(!/^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(?:app|core)\.xml|xl\/(?:workbook|styles|sharedStrings)\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/theme\/theme1\.xml|xl\/worksheets\/sheet[1-9]\d*\.xml)$/.test(name))throw invalid();
    if(name.startsWith('xl/worksheets/'))sheets++;
    // Every allowed XML part is checked before the library can inflate it;
    // untrusted central-directory sizes alone cannot bound shared strings or styles.
    {
      let content=bytes.subarray(start,end);
      if(method===8){
        const stream=new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw')),reader=stream.getReader(),chunks=[];let actual=0;
        try{for(;;){const {value,done}=await reader.read();if(done)break;actual+=value.length;if(actual>expanded){await reader.cancel();throw invalid();}chunks.push(value);}}finally{reader.releaseLock();}
        if(actual!==expanded)throw invalid();content=new Uint8Array(actual);let offset=0;for(const chunk of chunks){content.set(chunk,offset);offset+=chunk.length;}
      }else if(content.length!==expanded)throw invalid();
      const xml=decode.decode(content);
      if(/<!DOCTYPE|<!ENTITY|<(?:\w+:)?(?:f|formula|formula1|formula2)(?:\s|>)/i.test(xml))throw invalid();
      if(name.endsWith('.rels')){
        if(/\bTargetMode\s*=/i.test(xml))throw invalid();
        for(const match of xml.matchAll(/\bTarget\s*=\s*["']([^"']*)["']/g)){
          const target=match[1].replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,h,d)=>String.fromCodePoint(parseInt(h||d,h?16:10)));
          if(/^[a-z][\w+.-]*:|^\/\/|\\/i.test(target))throw invalid();
        }
      }
      if(name.startsWith('xl/worksheets/')){
        for(const match of xml.matchAll(/<(?:\w+:)?row\b[^>]*\br=["'](\d+)["']/g))if(Number(match[1])>MAX_ROWS+1)throw Error('SICOF_FILE_TOO_LARGE');
        for(const match of xml.matchAll(/<(?:\w+:)?c\b[^>]*\br=["']([^"']+)["']/g))if(!/^[A-O][1-9]\d*$/.test(match[1])||Number(match[1].slice(1))>MAX_ROWS+1)throw invalid();
      }
    }
  }
  ranges.sort((a,b)=>a[0]-b[0]);if(cursor!==eocd||sheets!==1||ranges.some((r,i)=>i&&r[0]<ranges[i-1][1]))throw invalid();
}
export async function importSicofFile(file,source,settings,ExcelJS,{importedAt,savingsObservedAt}={}){
  validateFileInput(file);const s=validateSettings(settings),scope={from:s.periodIni,to:s.periodFin,funds:effectiveFileFunds(s)},selected=sourceSelection(source,scope);
  let bytes,workbook;
  try{
    bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));await inspectWorkbookZip(bytes);
    if(!ExcelJS?.Workbook)throw invalid();workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes);
  }catch(error){if(error.message==='SICOF_FILE_TOO_LARGE')throw error;throw invalid();}
  if(workbook.worksheets.length!==1||workbook.definedNames.model.length)throw invalid();
  const sheet=workbook.worksheets[0];
  if(sheet.name!=='HISTORIAL P V2'||sheet.state!=='visible'||sheet.columnCount!==15||sheet.rowCount!==selected.rows.length+1||Object.keys(sheet.model.merges||{}).length)throw Error('SICOF_FILE_SOURCE_MISMATCH');
  const cellValue=(cell,column)=>{
    const value=cell.value;if(scalar(value))return value;
    if(value instanceof Date&&[0,11].includes(column)&&Number.isFinite(value.getTime())&&value.toISOString().endsWith('T00:00:00.000Z'))return value.toISOString().slice(0,10);
    throw invalid();
  };
  const headers=Array.from({length:15},(_,i)=>cellValue(sheet.getCell(1,i+1),i));if(!same(headers,selected.headers))throw Error('SICOF_FILE_HEADERS_INVALID');
  for(let i=0;i<selected.rows.length;i++)for(let j=0;j<15;j++)if(!Object.is(cellValue(sheet.getCell(i+2,j+1),j),selected.rows[i][j]))throw Error('SICOF_FILE_SOURCE_MISMATCH');
  const sha256=await semanticHash(selected),basis={version:FILE_BASIS_VERSION,...scope,source_fingerprint:source.source_fingerprint,sha256};
  const uploadSha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  return {...selected,basis,source_fingerprint:await fileSourceFingerprint(basis),metadata:{name:file.name,sha256,upload_sha256:uploadSha,...scope,
    imported_at:importedAt,source_observed_at:source.observed_at,savings_observed_at:savingsObservedAt,headers,rows:selected.rows,basis}};
}

// Loan behavior keeps the complete authoritative schedule. Only payments found
// in the validated upload can enter file metrics or the distribution pool.
export function scopeFileAnalysis(analysis,selection,settings){
  const s=validateSettings(settings),funds=effectiveFileFunds(s),allowed=new Set(selection.sourceRows.filter(r=>(funds===null||funds.includes(r.fund))&&r.date>=s.periodIni&&r.date<=s.periodFin).map(r=>r.source_row));
  const payments=analysis.payments.filter(p=>allowed.has(p.source_row));
  const zero=()=>({recorded_paid:0,reconciled_paid:0,unallocated_paid:0,reconciled_capital:0,reconciled_interest:0,reconciled_admin_fee:0,projected_interest:0,projected_admin_fee:0,projected_capital:0,expected:0,rows:0,unresolved_rows:0});
  const totals=zero(),buckets=new Map(),cents=n=>Math.round((n+Number.EPSILON)*100);
  for(const p of payments){
    const fund=typeof p.fund==='string'&&p.fund&&p.fund===p.fund.trim()?p.fund:'(SOURCE_FUND_UNRESOLVED)';if(!buckets.has(fund))buckets.set(fund,zero());
    for(const t of [totals,buckets.get(fund)]){
      t.rows++;if(p.issues.length)t.unresolved_rows++;
      const unique=!p.issues.includes('AMBIGUOUS_LOAN_DATE_ROWS'),valid=typeof p.paid==='number'&&Number.isFinite(p.paid)&&p.paid>=0;
      if(unique&&valid)t.recorded_paid+=cents(p.paid);
      if(unique&&typeof p.expected==='number'&&Number.isFinite(p.expected)&&p.expected>=0)t.expected+=cents(p.expected);
      if(p.audit==='RECONCILED_SOURCE_PAYMENT'){t.reconciled_paid+=cents(p.paid);t.reconciled_capital+=cents(p.capital);t.reconciled_interest+=cents(p.interest);t.reconciled_admin_fee+=cents(p.fee);}
      else if(unique&&valid)t.unallocated_paid+=cents(p.paid);
      if(p.audit==='PROJECTED'){t.projected_interest+=cents(p.projected_interest);t.projected_admin_fee+=cents(p.projected_fee);t.projected_capital+=cents(p.projected_capital);}
    }
  }
  const convert=t=>Object.fromEntries(Object.entries(t).map(([k,v])=>[k,['rows','unresolved_rows'].includes(k)?v:v/100]));
  return {...analysis,source_fingerprint:selection.source_fingerprint,payments,totals:{...convert(totals),complete:totals.unresolved_rows===0},
    funds:[...buckets].map(([fund,t])=>({fund,...convert(t)})),issues:analysis.issues.filter(issue=>allowed.has(issue.source_row)),
    certification:{...analysis.certification,status:totals.unresolved_rows?'REVIEW_REQUIRED':'RECONCILED_SOURCE_AMOUNTS',blocked_reasons:[...new Set(payments.flatMap(p=>p.issues))]},
    payment_scope:'UPLOADED_FILE_BASE',loan_history_scope:'CANONICAL_RETENTION_CONTEXT'};
}
