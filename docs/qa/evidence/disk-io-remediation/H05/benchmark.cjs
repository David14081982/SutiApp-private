'use strict';
const fs=require('fs'),a=require('./audit.cjs');
const setup=fs.readFileSync(a.dir+'/cases.sql','utf8');
const indexes={A:'participant_id,record_type,observed_on DESC',B:'participant_id,record_type,source_sheet,source_row DESC'};
const claims="select set_config('request.jwt.claims',(select jsonb_build_object('sub',auth_id,'role','authenticated','session_id','h05-benchmark')::text from h05_cases where label='PROCESS_1_1'),true);set local role authenticated;";
const participant="(select participant_id from pg_temp.h05_cases where label='PROCESS_1_1')";
const queries={
 full:'select public.get_self_savings_live_readonly()',
 latest:`select e.* from public.savings_legacy_evidence e where e.participant_id=${participant} and e.source_sheet='Ahorro' and e.record_type='PARTICIPANT' order by e.source_row desc limit 1`,
 history:`select e.* from public.savings_legacy_evidence e where e.participant_id=${participant} and e.record_type='AA_DO_CELL' and e.observed_on<=current_date and e.numeric_value>0 order by e.observed_on desc,e.source_column desc`,
 upcoming:`select e.* from public.savings_legacy_evidence e where e.participant_id=${participant} and e.record_type='AA_DO_CELL' and e.observed_on>current_date and e.numeric_value>0 order by e.observed_on`,
};
async function plan(mode,kind){
 const ddl=mode==='before'?'':`create index h05_candidate_${mode.toLowerCase()} on public.savings_legacy_evidence (${indexes[mode]});`;
 // Direct evidence predicates run as postgres, the same owner used inside the
 // existing SECURITY DEFINER getter. The complete RPC is run as authenticated.
 const q="begin;set local statement_timeout='25s';set local lock_timeout='2s';"+setup+ddl+(kind==='full'?claims:'')+'explain(analyze,buffers,format json) '+queries[kind]+';rollback;';
 const rows=await a.raw(q),p=rows[0]['QUERY PLAN'][0],summary=a.planSummary(p);
 a.save('plan-'+mode+'-'+kind,{at:new Date().toISOString(),role:kind==='full'?'authenticated':'postgres (existing SECURITY DEFINER execution owner)',query:queries[kind],index:mode==='before'?null:indexes[mode],summary,plan:p});
 console.log(JSON.stringify({mode,kind,ms:summary.ms,hits:summary.hits,reads:summary.reads,scans:summary.nodes.filter(n=>n.relation==='savings_legacy_evidence')}));
}
async function equivalence(mode){
 const q="begin;set local statement_timeout='45s';set local lock_timeout='2s';"+setup+
 `select pg_temp.h05_capture('before');create index h05_candidate_${mode.toLowerCase()} on public.savings_legacy_evidence (${indexes[mode]});select pg_temp.h05_capture('after');
 select b.label,b.payload=a.payload financial_equal,md5(b.payload::text) before_hash,md5(a.payload::text) after_hash,octet_length(b.payload::text) before_bytes,
  (select jsonb_agg(key order by key) from jsonb_object_keys(b.payload) key) top_level_fields,
  jsonb_array_length(b.payload->'history') history_rows,jsonb_array_length(b.payload->'upcoming') upcoming_rows,jsonb_array_length(b.payload->'withdrawals') withdrawal_rows,jsonb_array_length(b.payload->'plan_changes') plan_change_rows,
  b.payload#>>'{participant,current_process}' process,(b.payload#>'{balances,total}')='null'::jsonb balance_null
 from h05_results b join h05_results a using(label) where b.stage='before' and a.stage='after' order by label;rollback;`;
 const rows=await a.raw(q),pass=rows.length>=7&&rows.every(r=>r.financial_equal);
 a.save('equivalence-'+mode,{at:new Date().toISOString(),status:pass?'PASS':'FAIL',comparison:'Full JSONB structural equality, including every nested field and array order; full BEFORE/AFTER retained in temporary SQL rows during comparison, then rolled back; no private payload exported',rows});
 console.log(JSON.stringify({mode,status:pass?'PASS':'FAIL',cases:rows.length,differences:rows.filter(r=>!r.financial_equal).map(r=>r.label)}));if(!pass)throw Error('FINANCIAL_EQUIVALENCE_FAILED');
}
if(require.main===module)(async()=>{const [mode,kind]=process.argv.slice(2);if(kind==='equivalence')await equivalence(mode);else await plan(mode,kind||'full');})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={plan,equivalence,setup,claims,queries,indexes};
