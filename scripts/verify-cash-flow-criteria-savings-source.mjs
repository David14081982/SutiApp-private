// One focused SELECT of the proposed report reader; no DDL or financial writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration='supabase/migrations/20261030000500_reports_jc_cash_flow_criteria_savings.sql';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
export function savingsCriteriaSourceSelect(from='2026-01',sourceMigration=migration){
 assert(/^20\d{2}-(0[1-9]|1[0-2])$/.test(from),'REPORT_RANGE_INVALID');
 assert([migration,'supabase/migrations/20261030000600_reports_jc_cash_flow_savings_query.sql'].includes(sourceMigration),'SOURCE_MIGRATION_INVALID');
 const source=read(sourceMigration),start=source.indexOf(' with persons as materialized ('),end=source.indexOf(' into result;',start);
 assert(start>=0&&end>start,'SOURCE_QUERY_NOT_FOUND');
 const config=`with parameters as materialized (
 select date '${from}-01' first_day,(date '${from}-01'+interval '12 months - 1 day')::date last_day,public.savings_operation_today() present
), live_batch as materialized (
 select * from public.savings_review_batches where source_name='SutiApp Final' order by observed_at desc,created_at desc,id desc limit 1
), live_import as materialized (
 select coalesce((select (select count(*) from public.savings_review_records r where r.batch_id=b.id)
  +(select count(distinct removed->>'id') from public.savings_registration_removal_archive a
    cross join lateral jsonb_array_elements(coalesce(a.snapshots->'savings_review_records','[]'::jsonb)) removed
    where removed->>'batch_id'=b.id::text and nullif(removed->>'id','') is not null
     and not exists(select 1 from public.savings_review_records r where r.id::text=removed->>'id'))=b.expected_records
  from live_batch b),false) complete
), `;
 let body=source.slice(start,end).trim().slice('with '.length)
  .replaceAll('source_batch.id','(select id from live_batch)')
  .replaceAll('source_batch.observed_at','(select observed_at from live_batch)')
  .replace(/\bimport_complete\b/g,'(select complete from live_import)');
 for(const name of ['first_day','last_day','present'])body=body.replace(new RegExp('\\b'+name+'\\b','g'),`(select ${name} from parameters)`);
 const sql=config+body+' as report;';
 assert(!/\b(create|alter|drop|insert|update|delete|truncate|grant|revoke)\b/i.test(sql),'NON_SELECT_QUERY');
 assert(!/\bsource_batch\.|\bimport_complete\b|into result/.test(sql),'UNBOUND_QUERY_VARIABLE');
 return sql;
}

async function main(){
 const from='2026-01',sql=savingsCriteriaSourceSelect(from);
 const evidence={status:'READY',from,migration,sqlSha256:sha(sql),migrationSha256:sha(read(migration)),financialWrites:0,ddl:0,productionCalls:0};
 if(!process.argv.includes('--live')){console.log(JSON.stringify(evidence));return;}
 const require=createRequire(import.meta.url),{query}=require('./release-cash-flow.js'),started=Date.now();
 const records=await query("select set_config('statement_timeout','90000',false);select current_setting('default_transaction_read_only') read_only;"+sql);
 assert(records.some(row=>row.read_only==='on'),'DATABASE_READ_ONLY_REQUIRED');
 const report=records.find(row=>row.report)?.report;
 assert(report&&report.balances?.length===12&&Array.isArray(report.events),'SOURCE_RESPONSE_INVALID');
 const privateDir=path.join(root,'.tmp/cash-flow-criteria');fs.mkdirSync(privateDir,{recursive:true});
 fs.writeFileSync(path.join(privateDir,'savings-source.json'),JSON.stringify(report));
 const countBy=key=>report.events.reduce((a,e)=>{const k=e[key]??'NONE';a[k]=(a[k]||0)+1;return a;},{});
 Object.assign(evidence,{status:'PASS',checkedAt:new Date().toISOString(),durationMs:Date.now()-started,productionCalls:1,databaseReadOnly:true,
  events:report.events.length,byKind:countBy('kind'),byStatus:countBy('status'),byWithdrawalComponent:countBy('withdrawal_component'),
  knownBalanceMonths:report.balances.filter(b=>b.amount!==null).length,partialBalanceMonths:report.balances.filter(b=>b.amount===null&&b.known_amount!==null).length,
  knownAmountEvents:report.events.filter(e=>typeof e.amount==='number').length,undatedKnownAmountEvents:report.events.filter(e=>e.date===null&&typeof e.amount==='number').length,
  issueCodes:report.issues.map(i=>i.code),privateResponsePersisted:true,publicSourceRowsPersisted:0});
 const out=path.join(root,'docs/qa/evidence/cash-flow-criteria');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'savings-source-select.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{
 console.error(JSON.stringify({status:'FAIL',error:/^[A-Z0-9_]+$/.test(error.message)?error.message:'SAVINGS_CRITERIA_SOURCE_FAILED'}));process.exitCode=1;
});
