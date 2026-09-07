'use strict';
// Private timestamped review evidence. No canonical/legacy financial writer.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {query}=require('./savings-admin-review-db');
const {audit,cents,col,excelDate}=require('./audit-savings-cutover-readiness');
const quote=v=>"'"+String(v).replace(/'/g,"''")+"'";
const json=v=>quote(JSON.stringify(v))+'::jsonb';
const column=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function prepare(dir){
 const sourceBytes=fs.readFileSync(path.join(dir,'source-snapshot.json')),source=JSON.parse(sourceBytes);
 const db=JSON.parse(fs.readFileSync(path.join(dir,'supabase-readonly-v2.json'))),report=audit(source,db);
 const id=source.savings.find(x=>x.sheet==='Ahorro'&&x.range.includes('A1:A'));
 const finances=source.savings.find(x=>x.sheet==='Ahorro'&&x!==id),known=new Set(report.rows.map(x=>x.folio).filter(Boolean));
 const records=[];
 function make(sheet,row,entries,issues,raw){
  const source_data={},field_defs=[];
  for(const f of entries){source_data[f.key]=f.value;field_defs.push({key:f.key,label:f.label,kind:f.kind||'text',editable:f.editable!==false});}
  records.push({source_sheet:sheet,source_row:row,source_folio:typeof source_data.A==='string'?source_data.A:null,source_data,field_defs,issues,raw_source:raw});
 }
 for(let i=1;i<id.values.length;i++){
  const row=finances.values[i]||[],meta=report.rows[i-1],entries=[{key:'A',label:'Folio',value:typeof id.values[i][0]==='string'?id.values[i][0]:null}];
  for(let j=0;j<finances.values[0].length;j++){
   const key=column(j+4),header=finances.values[0][j],raw=row[j]??null;
   const matrix=j+3>=col('AA')&&j+3<=col('DO');
   const kind=matrix||['G','H','I','J','O','P','Q','R','S','DP','DQ','DR','DS','DT','DU','DV','DW'].includes(key)?'money':['F','M','T','X','Y','Z'].includes(key)?'date':'text';
   const day=matrix?excelDate(header):null;
   let value=raw;
   if(kind==='money'){const c=cents(raw);value=raw==null||raw===''?null:c===null?raw:c/100;}
   else if(kind==='date')value=excelDate(raw)||((raw==null||raw==='')?null:String(raw));
   else value=raw==null?null:String(raw);
   entries.push({key,label:matrix?`${day||header} · ${day>source.as_of?'Proyección futura':'Descuento registrado'}${key==='AR'?' (incluye rendimiento DT)':''}`:String(header||key),kind,value,editable:key!=='O'});
  }
  const issues=[...meta.issues];if(meta.import_status==='NOT_IMPORTED')issues.push(meta.import_status);
  if(meta.difference_cents!==0&&meta.difference_cents!=null)issues.push('BALANCE_SNAPSHOT_CHANGED');
  make('Ahorro',i+1,entries,[...new Set(issues)],{folio:id.values[i],finances:row,readiness:meta});
 }
 for(const capture of source.savings.filter(x=>x.sheet!=='Ahorro')){
  for(let i=1;i<capture.values.length;i++){
   const row=capture.values[i];if(!row.some(v=>v!=null&&v!==''))continue;
   const issues=[];if(typeof row[0]!=='string'||!row[0])issues.push('FOLIO_MISSING_OR_NOT_TEXT');else if(!known.has(row[0]))issues.push('NO_SAVINGS_ACCOUNT');
   const moneyFields=capture.sheet==='Solicitud de Ahorro'?['E','H','I','J']:capture.sheet==='Solicitud Cambio ahorro'?['C','D']:capture.sheet==='Solicitud de retiro'?['G']:[];
   make(capture.sheet,i+1,Array.from({length:Math.max(capture.values[0].length,row.length)},(_,j)=>{
    const key=column(j+1),raw=row[j]??null,kind=moneyFields.includes(key)?'money':'text';
    const c=kind==='money'?cents(typeof raw==='string'?raw.replace(/[$,\s]/g,''):raw):null;
    return {key,label:String(capture.values[0][j]||key),kind,value:raw==null||raw===''?null:kind==='money'&&c!==null?c/100:String(raw)};
   }),issues,row);
  }
 }
 for(const incident of report.loan_incidents){
  make('HISTORIAL P V2',Math.min(...incident.source_rows),[
   {key:'A',label:'Folio propuesto después de revisar el conflicto',value:incident.folios.length===1?incident.folios[0]:null},
   {key:'loan_id',label:'ID del préstamo (columna C)',value:incident.id,editable:false},
   {key:'folios',label:'Folios originales (columna D)',value:incident.folios.join(' / '),editable:false},
   {key:'statuses',label:'Estatus originales (columna X)',value:incident.statuses.join(' / '),editable:false},
   {key:'resolution',label:'Resultado de la revisión',value:null}
  ],incident.issues,incident);
 }
 return {hash:crypto.createHash('sha256').update(sourceBytes).digest('hex'),source,records};
}
async function main(){
 const dir=path.resolve(process.argv[2]||''),apply=process.argv.includes('--apply');
 if(!process.argv[2]||!path.relative(path.resolve(__dirname,'..'),dir).startsWith('..'))throw Error('Private snapshot directory required outside repository');
 const prepared=prepare(dir),counts={};for(const r of prepared.records)counts[r.source_sheet]=(counts[r.source_sheet]||0)+1;
 console.log(JSON.stringify({mode:apply?'IMPORT_PRIVATE_REVIEW':'PREVIEW',records:prepared.records.length,counts,hash:prepared.hash,observed_at:prepared.source.observed_at}));
 if(!apply)return;
 const b=await query(`insert into public.savings_review_batches(source_sha256,source_name,observed_at,expected_records) values(${quote(prepared.hash)},'SutiApp Final',${quote(prepared.source.observed_at)},${prepared.records.length}) on conflict(source_sha256) do nothing; select id,expected_records from public.savings_review_batches where source_sha256=${quote(prepared.hash)}`);
 const batch=b[0];if(batch.expected_records!==prepared.records.length)throw Error('BATCH_COUNT_CONFLICT');
 for(let i=0;i<prepared.records.length;i+=40){
  const values=prepared.records.slice(i,i+40).map(r=>`(${quote(batch.id)},${quote(r.source_sheet)},${r.source_row},${r.source_folio==null?'null':quote(r.source_folio)},${json(r.source_data)},${json(r.field_defs)},${json(r.raw_source)},${json(r.issues)})`).join(',');
  await query(`insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,field_defs,raw_source,issues) values ${values} on conflict(batch_id,source_sheet,source_row) do nothing`);
 }
 const result=await query(`select count(*)::integer records,count(*) filter(where version<>0)::integer previously_reviewed from public.savings_review_records where batch_id=${quote(batch.id)}`);
 if(result[0].records!==prepared.records.length)throw Error('IMPORT_INCOMPLETE');
 console.log(JSON.stringify({status:'PASS',...result[0],financial_writes:0}));
}
module.exports={prepare,quote,json};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
