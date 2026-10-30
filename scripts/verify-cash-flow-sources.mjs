// Live source verification only. No deployment, DDL, financial writes or source-row persistence.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readCashFlowGoogle} from '../supabase/functions/reports-jc/cash-flow-google.mjs';
import {buildCashFlow,validFrom} from '../supabase/functions/reports-jc/cash-flow.mjs';
import {READER_SECRET} from '../supabase/functions/reports-jc/google-auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration='supabase/migrations/20261030000100_reports_jc_cash_flow.sql';
const sha=value=>createHash('sha256').update(value).digest('hex');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const countBy=(rows,key)=>rows.reduce((counts,row)=>{const value=String(row[key]??'UNKNOWN');counts[value]=(counts[value]||0)+1;return counts;},{});

export function savingsSourceSelect(from){
 assert(validFrom(from),'REPORT_RANGE_INVALID');
 const source=read(migration),start=source.indexOf(' with persons as materialized ('),end=source.indexOf(' into result;',start);
 assert(start>=0&&end>start,'SOURCE_QUERY_NOT_FOUND');
 const original=source.slice(start,end).trim();
 assert(original.startsWith('with persons as materialized ('),'SOURCE_QUERY_CHANGED');
 const config=`with parameters as materialized (
 select date '${from}-01' first_day,(date '${from}-01'+interval '12 months - 1 day')::date last_day,public.savings_operation_today() present
), live_batch as materialized (
 select * from public.savings_review_batches where source_name='SutiApp Final' order by observed_at desc,created_at desc,id desc limit 1
), live_import as materialized (
 select coalesce((select
  (select count(*) from public.savings_review_records r where r.batch_id=b.id)
  +(select count(distinct removed->>'id') from public.savings_registration_removal_archive a
    cross join lateral jsonb_array_elements(coalesce(a.snapshots->'savings_review_records','[]'::jsonb)) removed
    where removed->>'batch_id'=b.id::text and nullif(removed->>'id','') is not null
     and not exists(select 1 from public.savings_review_records r where r.id::text=removed->>'id'))=b.expected_records
  from live_batch b),false) complete
), `;
 let body=original.slice('with '.length).replaceAll('source_batch.id','(select id from live_batch)')
  .replace(/\bimport_complete\b/g,'(select complete from live_import)');
 for(const name of ['first_day','last_day','present'])body=body.replace(new RegExp('\\b'+name+'\\b','g'),`(select ${name} from parameters)`);
 const sql=config+body+' as report;';
 assert(!/\b(create|alter|drop|insert|update|delete|truncate|grant|revoke)\b/i.test(sql),'NON_SELECT_QUERY');
 assert(!/\bsource_batch\.|\bimport_complete\b|into result/.test(sql),'UNBOUND_QUERY_VARIABLE');
 return sql;
}

function hermosilloToday(now){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)),v=t=>parts.find(x=>x.type===t).value;return `${v('year')}-${v('month')}-${v('day')}`;}

export async function verifySources({currentOnly=false}={}){
 const consultedAt=new Date().toISOString(),today=hermosilloToday(consultedAt),froms=currentOnly?[today.slice(0,7)]:[...new Set([today.slice(0,4)+'-01',today.slice(0,7)])];
 const evidence={status:'RUNNING',checkedAt:consultedAt,scope:'READ_ONLY_SOURCE_QUERY_AND_REPORT_ASSEMBLY',deployed:false,financialWrites:0,googleWrites:0,triggerChanges:0,persistedSourceRows:0,productionAuthorizationTested:false,froms,queries:[],reports:[]};
 try{
  const require=createRequire(import.meta.url),{query}=require('./release-cash-flow.js');
  // Same existing reader identity and exact read-only OAuth scope. Never expose its material.
  const raw=fs.readFileSync('C:/Users/david/Downloads/sutifinanzas-reportes-17cdac4aaba7.json','utf8');
  const googleStarted=Date.now(),loans=await readCashFlowGoogle(name=>name===READER_SECRET?raw:null);
  evidence.google={status:'PASS',durationMs:Date.now()-googleStarted,rows:Math.max(0,loans.length-1),persistedRows:0};
  for(const from of froms){
   const sql=savingsSourceSelect(from),started=Date.now();
   // SET_CONFIG changes a connection-local timeout only. The transport also sets
   // default_transaction_read_only=on and a 90-second client query timeout.
   const authority=currentOnly?"select sum(b.total) authority_current_balance from public.savings_participants p cross join lateral public.savings_participant_balance(p.id)b where p.data_classification='CANONICAL';":'';
   const records=await query("select set_config('statement_timeout','90000',false);select current_setting('default_transaction_read_only') read_only;"+authority+sql);
   const elapsed=Date.now()-started;
   assert(records.some(row=>row.read_only==='on'),'DATABASE_READ_ONLY_REQUIRED');
   if(elapsed>90000)throw Error('SOURCE_QUERY_TIMEOUT');
   const savings=records.find(row=>row.report)?.report;
   assert(savings&&savings.as_of===today,'SOURCE_AS_OF_CHANGED');
   assert(Array.isArray(savings.events)&&savings.balances?.length===12,'SOURCE_RESPONSE_INVALID');
   const currentBalance=savings.balances.find(row=>row.month.slice(0,7)===today.slice(0,7));
   if(currentOnly){const authorityAmount=records.find(row=>Object.hasOwn(row,'authority_current_balance'))?.authority_current_balance;assert(authorityAmount!==null&&authorityAmount!==undefined,'CURRENT_AUTHORITY_UNAVAILABLE');assert.equal(currentBalance?.amount,Number(authorityAmount),'CURRENT_BALANCE_AUTHORITY_MISMATCH');}
   const report=buildCashFlow({from,loans,savings,consultedAt});
   evidence.queries.push({from,status:'PASS',durationMs:elapsed,sqlSha256:sha(sql),databaseReadOnly:true,
    events:savings.events.length,byKind:countBy(savings.events,'kind'),byStatus:countBy(savings.events,'status'),
    balanceMonths:savings.balances.length,monthsWithUnknownBalance:savings.balances.filter(row=>row.amount===null).length,
    currentBalanceKnown:currentBalance?.amount!==null&&currentBalance?.amount!==undefined,currentBalanceUnknownAccounts:currentBalance?.unknown_count,
    ...(currentOnly?{matchesCurrentCanonicalAuthority:true}:{}),
    issueCodes:[...new Set((savings.issues||[]).map(row=>row.code))]});
   evidence.reports.push({from,status:'PASS',months:report.months.map(row=>row.key),rows:report.rows.length,
    sourceRecords:report.records.length,unassigned:report.unassigned.length,loanCount:report.coverage.loanCount,
    cellsByStatus:countBy(report.rows.flatMap(row=>row.cells),'status'),issueCodes:[...new Set(report.issues.map(row=>row.code))],
    financialWrites:report.coverage.financialWrites,amortizationEngineActive:report.coverage.amortizationEngineActive});
  }
  evidence.status='PASS';
 }catch(error){
  evidence.status='FAIL';evidence.error=/^[A-Z0-9_]+$/.test(error.message)?error.message:'SOURCE_VERIFICATION_FAILED';
 }
 const out=path.join(root,'docs/qa/evidence/cash-flow');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,currentOnly?'live-current-balance-readonly.json':'live-sources-readonly.json'),JSON.stringify(evidence,null,2)+'\n');
 return evidence;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(!process.argv.includes('--live')){
  const now=new Date().toISOString(),today=hermosilloToday(now);
  console.log(JSON.stringify({mode:'READ_ONLY_PLAN',froms:[today.slice(0,4)+'-01',today.slice(0,7)],sqlSha256:sha(savingsSourceSelect(today.slice(0,7))),productionCalls:0}));
 }else{
  const evidence=await verifySources({currentOnly:process.argv.includes('--current')});console.log(JSON.stringify(evidence));if(evidence.status!=='PASS')process.exitCode=1;
 }
}
