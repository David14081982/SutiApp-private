'use strict';
const fs=require('fs'),a=require('./audit.cjs'),b=require('./benchmark.cjs');
const ddl=()=>`create index h05_candidate_b on public.savings_legacy_evidence (${b.indexes.B});`+fs.readFileSync(a.dir+'/conditional-reader.sql','utf8');
const helper=`create temporary table h05_checks(label text primary key,pass boolean) on commit drop;
create temporary table h05_versions(label text primary key,value jsonb) on commit drop;
grant select,insert on h05_versions,h05_checks to authenticated;
create function pg_temp.h05_read(known text default null) returns jsonb language plpgsql security invoker as $$
declare v jsonb;begin
 perform set_config('role','authenticated',true);
 v:=public.get_self_savings_if_changed(known);
 perform set_config('role','postgres',true);return v;end;$$;
`;
async function equivalence(live=false){
 const sql="begin;set local statement_timeout='45s';set local lock_timeout='2s';set local track_functions='all';"+b.setup+
 "select pg_temp.h05_capture('before');"+(live?'':ddl())+helper+`
 do $$declare c record;v jsonb;w jsonb;before_value jsonb;begin
 for c in select * from h05_cases order by label loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c.auth_id,'role','authenticated','session_id','h05-equivalence-session')::text,true);
  v:=pg_temp.h05_read(); w:=pg_temp.h05_read(v->>'version');
  select payload into before_value from h05_results where stage='before' and label=c.label;
  insert into h05_checks values(c.label||':full',v->'data'=before_value and (v->>'modified')::boolean and (v->>'cacheable')::boolean);
  insert into h05_checks values(c.label||':warm',w->>'modified'='false' and not(w?'data') and w->>'version'=v->>'version');
  insert into h05_checks values(c.label||':foreign_version',pg_temp.h05_read('not-this-subject-version')->'data'=before_value);
  insert into h05_checks values(c.label||':identity',v#>>'{context,actor_auth_user_id}'=c.auth_id::text and v#>>'{context,effective_affiliate_id}'=c.affiliate_id::text);
 end loop;end;$$;
 select label,pass from h05_checks order by label;rollback;`;
 const rows=await a.raw(sql),pass=rows.length===40&&rows.every(r=>r.pass===true);a.save('conditional-equivalence'+(live?'-live':''),{at:new Date().toISOString(),status:pass?'PASS':'FAIL',comparison:'Complete original JSONB versus conditional data, all fields and array order; private payload stays in temporary SQL rows',rows});
 console.log(JSON.stringify({status:pass?'PASS':'FAIL',checks:rows.length,failed:rows.filter(r=>!r.pass).map(r=>r.label)}));if(!pass)throw Error('CONDITIONAL_EQUIVALENCE_FAILED');
}
async function invalidation(){
 const sql="begin;set local statement_timeout='45s';set local lock_timeout='2s';"+b.setup+ddl()+helper+b.claims+`reset role;
 insert into h05_versions values('original',pg_temp.h05_read());
 savepoint fixture;
 insert into public.savings_action_availability(action_code,scope_type,participant_id,enabled,reason,configured_by_auth_user_id)
 select 'WITHDRAW','PARTICIPANT',participant_id,true,'H05 rollback-only invalidation',auth_id from h05_cases where label='PROCESS_1_1';
 insert into h05_versions values('action',pg_temp.h05_read((select value->>'version' from h05_versions where label='original')));
 insert into h05_checks select 'action_changed',value->>'modified'='true' and value#>>'{data,actions,WITHDRAW}'='true' from h05_versions where label='action';
 insert into public.savings_beneficiary_versions(participant_id,version_number,actor_real_auth_user_id)
 select participant_id,1,auth_id from h05_cases where label='PROCESS_1_1';
 insert into public.savings_beneficiaries(version_id,full_name,relationship,percentage)
 select v.id,'H05 ROLLBACK FIXTURE','TEST',100 from public.savings_beneficiary_versions v join h05_cases c using(participant_id) where c.label='PROCESS_1_1';
 insert into h05_versions values('beneficiary',pg_temp.h05_read((select value->>'version' from h05_versions where label='action')));
 insert into h05_checks select 'beneficiary_changed',value->>'modified'='true' and jsonb_array_length(value#>'{data,beneficiaries}')=1 from h05_versions where label='beneficiary';
 insert into public.savings_legacy_evidence(import_batch_id,participant_id,source_workbook_id,source_sheet,source_column,source_row,record_type,data_classification,source_row_sha256,raw_payload)
 select p.import_batch_id,p.id,'H05_ROLLBACK','H05_ROLLBACK','H05',1,'REPORT','RAW_LEGACY',repeat('A',64),'{}' from public.savings_participants p join h05_cases c on c.participant_id=p.id where c.label='PROCESS_1_1';
 insert into h05_versions values('evidence',pg_temp.h05_read((select value->>'version' from h05_versions where label='beneficiary')));
 insert into h05_checks select 'evidence_changed',e.value->>'modified'='true' and e.value->'data'=b.value->'data' from h05_versions e,h05_versions b where e.label='evidence' and b.label='beneficiary';
 set local timezone='Pacific/Kiritimati';
 insert into h05_versions values('date_zone',pg_temp.h05_read((select value->>'version' from h05_versions where label='evidence')));
 insert into h05_checks select 'date_zone_changed',value->>'modified'='true' from h05_versions where label='date_zone';
 do $$begin if exists(select 1 from h05_checks where pass is distinct from true) then raise exception 'H05_INVALIDATION_FAILED';end if;end;$$;
 select jsonb_agg(jsonb_build_object('label',label,'pass',pass) order by label) checks from h05_checks;
 rollback;`;
 const rows=await a.raw(sql),checks=rows[0].checks;a.save('invalidation-backend',{at:new Date().toISOString(),status:'PASS',checks,fixtures:'New transient rows only, transaction rolled back; original historical rows unchanged'});console.log(JSON.stringify({status:'PASS',checks}));
}
async function warm(live=false){
 const sql="begin;set local statement_timeout='30s';set local lock_timeout='2s';set local track_functions='all';"+b.setup+(live?'':ddl())+helper+b.claims+`reset role;
 insert into h05_versions values('cold',pg_temp.h05_read());
 create temporary table h05_calls as select calls from pg_stat_xact_user_functions where funcid='public.get_self_savings_live_readonly()'::regprocedure;
 set local role authenticated;
 explain(analyze,buffers,format json) select public.get_self_savings_if_changed((select value->>'version' from h05_versions where label='cold'));rollback;`;
 const rows=await a.raw(sql),p=rows[0]['QUERY PLAN'][0],summary=a.planSummary(p);a.save('conditional-warm-plan'+(live?'-live':''),{at:new Date().toISOString(),summary,plan:p});console.log(JSON.stringify({warm:summary}));
 const calls=await a.raw("begin;set local statement_timeout='30s';set local lock_timeout='2s';set local track_functions='all';"+b.setup+(live?'':ddl())+helper+b.claims+`reset role;
 insert into h05_versions values('cold',pg_temp.h05_read());
 create temporary table h05_calls as select calls from pg_stat_xact_user_functions where funcid='public.get_self_savings_live_readonly()'::regprocedure;
 insert into h05_versions values('warm',pg_temp.h05_read((select value->>'version' from h05_versions where label='cold')));
 select f.calls-c.calls warm_full_projection_calls,(select value->>'modified'='false' from h05_versions where label='warm') reused from pg_stat_xact_user_functions f cross join h05_calls c where f.funcid='public.get_self_savings_live_readonly()'::regprocedure;rollback;`);
 a.save('conditional-warm-calls'+(live?'-live':''),calls);if(calls[0]?.warm_full_projection_calls!==0||!calls[0].reused)throw Error('WARM_RECOMPUTED_FULL_PROJECTION');console.log(JSON.stringify(calls));
}
if(require.main===module)(async()=>{const mode=process.argv[2];if(mode==='invalidation')await invalidation();else if(mode==='warm')await warm(process.argv.includes('--live'));else await equivalence(process.argv.includes('--live'));})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={ddl,helper,equivalence,invalidation,warm};
