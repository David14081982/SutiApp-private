'use strict';
const fs=require('fs'),assert=require('assert/strict'),{query,body}=require('./savings-admin-review-db'),{fingerprint}=require('./test-savings-admin-review-live');
const forward='supabase/migrations/20260906000900_savings_review_withdrawals.sql',recovery='supabase/recovery/20260906000900_savings_review_withdrawals_recovery.sql';
async function main(){
 const before=await fingerprint(),installed=(await query("select to_regprocedure('public.get_admin_savings_review_withdrawals(uuid)') is not null installed"))[0].installed;
 await query(`begin;${installed?'':body(forward)}savepoint fixture;
 do $$ declare a uuid;b uuid;p uuid;r uuid;result jsonb;begin
 select auth_user_id into a from public.admin_assignments where enabled and 'authorization.write'=any(permissions) and 'savings.read'=any(permissions) limit 1;
 if a is null then raise exception 'ADMIN_CONTEXT_REQUIRED';end if;
 insert into public.savings_review_batches(source_sha256,source_name,observed_at,expected_records) values(repeat('c',64),'Isolated withdrawal test',now(),4) returning id into b;
 insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,proposed_data,field_defs,raw_source)
 values(b,'Ahorro',2,'__00123__','{"A":"__00123__","M":"2030-01-01"}','{"A":"__OTHER__"}','[]','{}') returning id into p;
 insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,proposed_data,field_defs,raw_source)
 values(b,'Solicitud de retiro',3,'__00123__','{"A":"__00123__","D":"1/7/2026","G":6768.64,"H":"Completado","J":"do-not-expose"}','{"A":"__OTHER__","G":999}','[]','{}') returning id into r;
 insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,proposed_data,field_defs,raw_source) values
 (b,'Solicitud de retiro',4,'__00123__','{"A":"__00123__","D":"5/8/2026","G":0}','{}','[]','{}'),
 (b,'Solicitud de retiro',5,'__123__','{"A":"__123__","G":800}','{"A":"__00123__"}','[]','{}');
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_review_withdrawals(p);raise exception 'ANON_LEAK';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',extensions.gen_random_uuid(),'role','authenticated')::text,true);
 begin perform public.get_admin_savings_review_withdrawals(p);raise exception 'USER_LEAK';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 result:=public.get_admin_savings_review_withdrawals(p);
 if result->>'source_folio'<>'__00123__' or not (result->>'identity_change_pending')::boolean or jsonb_array_length(result->'records')<>2 then raise exception 'EXACT_SOURCE_FOLIO_REQUIRED';end if;
 if not exists(select 1 from jsonb_array_elements(result->'records') e where e->>'id'=r::text and e->'source_data'->>'D'='1/7/2026' and e->'source_data'->>'G'='6768.64' and e->'source_data'->>'H'='Completado' and (e->>'identity_change_pending')::boolean and not (e->'source_data' ? 'J')) then raise exception 'SOURCE_DATE_AMOUNT_OR_PAYLOAD';end if;
 if has_function_privilege('anon','public.get_admin_savings_review_withdrawals(uuid)','execute') or has_function_privilege('service_role','public.get_admin_savings_review_withdrawals(uuid)','execute') then raise exception 'GRANTS';end if;
 perform set_config('test.withdrawal_parent',p::text,true);
 end $$;
 set local role authenticated;
 select public.get_admin_savings_review_withdrawals(current_setting('test.withdrawal_parent')::uuid)->>'publication' publication;
 reset role;rollback to fixture;${body(recovery)}rollback;`);
 assert.deepEqual(await fingerprint(),before);
 const result={status:'PASS',mode:'ROLLBACK',installed,checks:['original parent Folio despite proposal','all withdrawal rows retained','leading zeros distinct','other proposed Folio never joins','D date and G amount and H source status preserved','restricted payload excludes external PDF','anonymous and ordinary user denied','authenticated admin executes','recovery','financial fingerprint unchanged']};
 fs.mkdirSync('docs/qa/evidence/savings-withdrawals-20260906',{recursive:true});fs.writeFileSync('docs/qa/evidence/savings-withdrawals-20260906/sql-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
module.exports={forward,recovery};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
