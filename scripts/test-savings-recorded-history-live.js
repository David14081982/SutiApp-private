'use strict';
const fs=require('fs'),assert=require('assert/strict'),{query,body}=require('./savings-admin-review-db'),{fingerprint}=require('./test-savings-admin-review-live');
const forward='supabase/migrations/20260906000800_savings_recorded_history.sql',recovery='supabase/recovery/20260906000800_savings_recorded_history_recovery.sql';
async function main(){
 const before=await fingerprint(),installed=(await query("select to_regprocedure('public.get_admin_savings_recorded_history(uuid)') is not null installed"))[0].installed;
 await query(`begin;${installed?'':body(forward)}savepoint fixture;
 do $$ declare admin_id uuid; pid uuid; f text; bid uuid; result jsonb; rid uuid; begin
 select auth_user_id into admin_id from public.admin_assignments where enabled and 'authorization.write'=any(permissions) and 'savings.read'=any(permissions) limit 1;
 select id,legacy_folio into pid,f from public.savings_participants where legacy_folio is not null and legacy_folio<>'' limit 1;
 if admin_id is null or pid is null then raise exception 'EXISTING_CONTEXT_REQUIRED';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_recorded_history(pid);raise exception 'ANON_LEAK';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',extensions.gen_random_uuid(),'role','authenticated')::text,true);
 begin perform public.get_admin_savings_recorded_history(pid);raise exception 'USER_LEAK';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 insert into public.savings_review_batches(source_sha256,source_name,observed_at,expected_records) values(repeat('b',64),'Isolated rollback history',now(),3) returning id into bid;
 insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,proposed_data,field_defs,raw_source)
 values(bid,'Ahorro',2,f,jsonb_build_object('A',f,'F','2025-02-15','AR',1125,'DT',125),'{}','[]','{}') returning id into rid;
 update public.savings_review_records set proposed_data='{"A":"__PROPOSED_OTHER__","AR":9999}' where id=rid;
 insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,field_defs,raw_source)
 values(bid,'Ahorro',3,f,jsonb_build_object('A',f),'[]','{}'),(bid,'Ahorro',4,'0'||f,jsonb_build_object('A','0'||f),'[]','{}');
 result:=public.get_admin_savings_recorded_history(pid);
 if result->>'publication'<>'PRIVATE_REVIEW_ONLY' or result->>'folio'<>f then raise exception 'CONTEXT_CHANGED';end if;
 if (select count(*) from jsonb_array_elements(result->'records') r where r->'batch'->>'source_name'='Isolated rollback history')<>2 then raise exception 'EXACT_FOLIO_OR_DUPLICATES';end if;
 if not exists(select 1 from jsonb_array_elements(result->'records') r where r->>'id'=rid::text and (r->>'identity_change_pending')::boolean and r->'source_data'->>'AR'='1125' and r->'source_data'->>'F'='2025-02-15' and r->'proposed_data'->>'AR'='9999') then raise exception 'SOURCE_PROPOSAL_CHANGED';end if;
 if has_function_privilege('anon','public.get_admin_savings_recorded_history(uuid)','execute') or has_function_privilege('service_role','public.get_admin_savings_recorded_history(uuid)','execute') then raise exception 'GRANT_LEAK';end if;
 end $$;
 rollback to fixture;
 do $$ declare a uuid; p uuid; begin
 select auth_user_id into a from public.admin_assignments where enabled and 'authorization.write'=any(permissions) and 'savings.read'=any(permissions) limit 1;
 select id into p from public.savings_participants limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform set_config('test.history_pid',p::text,true);
 end $$;
 set local role authenticated;
 select public.get_admin_savings_recorded_history(current_setting('test.history_pid')::uuid)->>'publication' publication;
 reset role;${body(recovery)}rollback;`);
 assert.deepEqual(await fingerprint(),before);
 const result={status:'PASS',mode:'ROLLBACK',installed,checks:['original Folio exact text','leading zero remains distinct','duplicate rows retained','proposed identity never relinks','original F and combined AR preserved','admin authenticated execution','ordinary and anonymous denial','recovery','financial fingerprint unchanged']};
 fs.mkdirSync('docs/qa/evidence/savings-history-20260906',{recursive:true});fs.writeFileSync('docs/qa/evidence/savings-history-20260906/sql-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
module.exports={forward,recovery};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
