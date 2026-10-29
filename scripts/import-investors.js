'use strict';
// One-off immutable source import. No inferred cash movements or historical corrections.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,root,privateDir}=require('./investors-db');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const lit=x=>x==null?'null':"'"+String(x).replace(/'/g,"''")+"'";
const json=x=>lit(JSON.stringify(x))+'::jsonb';
const num=x=>typeof x==='number'&&Number.isFinite(x)?String(x):'null';
function build(payload,bytes){
 assert.equal(sha(bytes),payload.sha256,'SOURCE_HASH_CHANGED');
 const batch=lit(payload.sha256),statements=[];
 // An existing import must match the immutable original bytes, not just its filename.
 statements.push(`do $g$ begin if exists(select 1 from investors_private.imports where sha256=${batch} and workbook<>decode(${lit(bytes.toString('base64'))},'base64')) then raise exception 'INVESTORS_IMPORT_CONFLICT';end if;end $g$;`);
 statements.push(`insert into investors_private.imports(sha256,filename,workbook,manifest) values(${batch},${lit(payload.filename)},decode(${lit(bytes.toString('base64'))},'base64'),${json(payload.summary)}) on conflict(sha256) do nothing;`);
 for(const i of payload.investors)statements.push(`insert into investors_private.investors(source_key,name,reference,notes,source) values(${lit(i.source_key)},${lit(i.name)},'JC histórico','',${json({historical_contributed:i.historical_contributed,aliases:i.aliases,rows:i.rows,sha256:payload.sha256})}) on conflict(source_key) do nothing;`);
 for(const c of payload.contracts){
  const person=`(select id from investors_private.investors where source_key=${lit(c.investor_key)})`;
  const status=c.activate_snapshot?'active':c.review.length?'review':'historical';
  statements.push(`insert into investors_private.contracts(investor_id,source_key,code,starts_on,ends_on,months,principal,monthly_rate,payment_mode,payment_method,status,opening_balance,balance_on,source,notes) values(${person},${lit(c.source_key)},${lit(c.document)},${lit(c.start)},${lit(c.end)},${num(c.months)},${num(c.principal)},${num(c.rate)},'Mensual',${lit(c.method||'')},${lit(status)},${c.activate_snapshot?num(c.current_capital):'null'},${c.activate_snapshot?lit(payload.summary.snapshot_observed_on):'null'},${json(c)},'Saldo histórico observado al importar, sin inferir movimientos ni pagos. Historia previa incompleta.') on conflict(source_key) do nothing;`);
  if(c.activate_snapshot)statements.push(`do $schedule$ declare cid uuid;begin select id into cid from investors_private.contracts where source_key=${lit(c.source_key)};if not exists(select 1 from investors_private.obligations where contract_id=cid) then perform investors_private.schedule(cid,${lit(c.future_schedule_from)}::date,'Obligaciones futuras según tasa y mensualidad coincidentes; no acredita pagos anteriores');end if;end $schedule$;`);
  if(c.review.length)statements.push(`insert into investors_private.reviews(batch,source_key,investor_id,contract_id,kind,detail) values(${batch},${lit(sha(c.source_key+':contract-review'))},${person},(select id from investors_private.contracts where source_key=${lit(c.source_key)}),'contract_conflict',${json({reasons:c.review,sheet:'Cartera Inicial',row:c.row})}) on conflict(source_key) do nothing;`);
 }
 for(const r of payload.evidence)statements.push(`insert into investors_private.source_rows(batch,sheet,row_number,cells) values(${batch},${lit(r.sheet)},${r.row},${json(r.cells)}) on conflict(batch,sheet,row_number) do nothing;`);
 for(const [index,i] of payload.issues.entries()){
  const row=payload.rows.find(r=>r.source_key===i.source_key),cid=i.contract_key?`(select id from investors_private.contracts where source_key=${lit(i.contract_key)})`:'null',iid=`(select id from investors_private.investors where source_key=${lit(i.investor_key||row?.investor_key)})`;
  statements.push(`insert into investors_private.reviews(batch,source_key,investor_id,contract_id,kind,detail) values(${batch},${lit(sha(payload.sha256+':issue:'+index))},${iid},${cid},${lit(i.kind)},${json({detail:i.detail,sheet:row?.sheet,row:row?.row,document:row?.document,name:row?.name})}) on conflict(source_key) do nothing;`);
 }
 return statements.join('\n');
}
async function main(){
 const mode=process.argv[2]||'prepare',source=process.argv[3]||'C:/Users/david/Downloads/JC Inversiones.xlsx';
 const payload=JSON.parse(fs.readFileSync(path.join(privateDir,'import.json'),'utf8')),body=build(payload,fs.readFileSync(source));
 if(mode==='prepare'){fs.writeFileSync(path.join(privateDir,'import.sql'),body);console.log(JSON.stringify({status:'PREPARED',investors:payload.investors.length,contracts:payload.contracts.length,sourceRows:payload.evidence.length,realizedPayments:0,sha256:payload.sha256}));return;}
 if(mode!=='apply')throw Error('MODE prepare|apply');
 for(const file of ['sql.json','import.json','browser.json','scope.json'])assert.equal(JSON.parse(fs.readFileSync(path.join(root,'docs/qa/evidence/investors',file),'utf8')).status,'PASS','FOCAL_TESTS_REQUIRED:'+file);
 const result=await query(`begin;set local statement_timeout='60s';select pg_advisory_xact_lock(hashtextextended('H-ADMIN-INVERSIONISTAS-001-import',0));${body}
 select jsonb_build_object('investors',(select count(*) from investors_private.investors where source_key is not null),'contracts',(select count(*) from investors_private.contracts where source_key is not null),'sourceRows',(select count(*) from investors_private.source_rows where batch=${lit(payload.sha256)}),'batch',${lit(payload.sha256)},'paymentsInferred',0) receipt;commit;`,true);
 fs.writeFileSync(path.join(root,'docs/qa/evidence/investors/import-live.json'),JSON.stringify({status:'PASS',result},null,2)+'\n');console.log(JSON.stringify({status:'PASS',result}));
}
module.exports={build};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
