'use strict';
// Every test, including isolated fixtures and the simulated publication, ends in
// ROLLBACK. No real account is certified and no publication persists.
const {query,body}=require('./savings-admin-review-db');
const deps=[
 'supabase/migrations/20260906000100_savings_operations.sql',
 'supabase/migrations/20260906000200_savings_retirement_transition.sql',
 'supabase/migrations/20260913000000_savings_identity_compatibility.sql',
 'supabase/migrations/20260906000400_savings_period_yield.sql',
 'supabase/migrations/20260907000100_savings_balance_certification.sql',
 'supabase/migrations/20260913000100_savings_runtime_completion.sql',
];
const forward='supabase/migrations/20260913000200_savings_publication.sql';
const recovery='supabase/recovery/20260913000200_savings_publication_recovery.sql';
const checks=String.raw`
do $test$
declare actor uuid; other_actor uuid; participant uuid; enrollment uuid; affiliate uuid; batch uuid; record_id uuid;
 source jsonb; cert uuid; context jsonb; result jsonb; readiness jsonb; row_result jsonb; known jsonb; key uuid:=extensions.gen_random_uuid();
 today date:=public.savings_operation_today(); folio text:='QA-PUBLICATION-'||extensions.gen_random_uuid();
 original_status text; original_mode jsonb; old_count bigint; functions_definition text; identity_definition text; t text;
 duplicate_affiliate uuid; empty_affiliate uuid; native_affiliate uuid; native_participant uuid; native_enrollment uuid; second_affiliate uuid; second_participant uuid; native_due date;
 beneficiaries jsonb:='[{"full_name":"Persona beneficiaria","relationship":"Familiar","percentage":100}]'; beneficiary_key uuid:=extensions.gen_random_uuid(); leaked_key uuid:=extensions.gen_random_uuid(); beneficiary_result jsonb;
begin
 select auth_user_id into actor from public.admin_assignments where enabled and ('*'=any(permissions) or 'savings.config'=any(permissions)) limit 1;
 if actor is null then raise exception 'QA_ADMIN_REQUIRED';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 known:=public.savings_self_before_publication();
 if public.get_self_savings_live_readonly() is distinct from known then raise exception 'PRIVATE_READER_CHANGED';end if;
 result:=public.get_self_savings_if_changed('previous-legacy-version');
 if result->>'modified'<>'true' or result->>'cacheable'<>'true' or result->'data' is distinct from known then raise exception 'PRIVATE_CACHE_CONTRACT_CHANGED';end if;
 if public.get_self_savings_if_changed(result->>'version')->>'modified'<>'false' then raise exception 'PRIVATE_REVALIDATION_OPTIMIZATION_LOST';end if;
 readiness:=public.get_admin_savings_publication_status();
 if readiness->>'mode'<>'PRIVATE' or readiness->>'ready'<>'false' or (readiness->>'pending')::int<1 then raise exception 'UNCERTIFIED_ACCOUNTS_READY';end if;
 begin perform public.admin_publish_savings(1,readiness->>'fingerprint',true,key);raise exception 'UNCERTIFIED_PUBLICATION_ALLOWED';
 exception when raise_exception then if sqlerrm<>'SAVINGS_PUBLICATION_REVIEW_REQUIRED' then raise;end if;end;
 if exists(select 1 from public.savings_publication_events) then raise exception 'REJECTED_PUBLICATION_LEFT_EVENT';end if;
 foreach t in array array['savings_publication_state','savings_publication_events','savings_publication_function_backup'] loop
  if not(select relrowsecurity and relforcerowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'PUBLICATION_RLS_MISSING';end if;
  if has_table_privilege('authenticated','public.'||t,'SELECT') or has_table_privilege('authenticated','public.'||t,'UPDATE')
   or has_table_privilege('service_role','public.'||t,'UPDATE') then raise exception 'PUBLICATION_TABLE_EXPOSED';end if;
 end loop;
 if has_function_privilege('authenticated','public.savings_canonical_user_projection(uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.savings_self_before_publication()','EXECUTE')
  or has_function_privilege('anon','public.get_admin_savings_publication_status()','EXECUTE') then raise exception 'PUBLICATION_INTERNAL_EXPOSED';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_publication_status();raise exception 'ANON_ADMIN_ALLOWED';exception when insufficient_privilege then null;end;
 begin perform public.get_self_savings_live_readonly();raise exception 'ANON_SELF_ALLOWED';exception when insufficient_privilege then null;end;
 begin perform public.admin_publish_savings(1,'x',true,key);raise exception 'ANON_PUBLISH_ALLOWED';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);

 -- Isolated, unbound QA identity. Original real participants are never mutated.
 insert into public.affiliates(numero_control,full_name,auth_eligibility,record_origin)
 values(folio,'Isolated Savings publication fixture','missing_email','ADMIN_AFFILIATES') returning id into affiliate;
 insert into public.savings_review_batches(source_sha256,source_name,observed_at,expected_records)
 values(md5(folio)||md5(folio),'ISOLATED_ROLLBACK',(today-2)::timestamp at time zone 'America/Hermosillo',2) returning id into batch;
 source:=jsonb_build_object('A',folio,'D','JUB','F','2026-01-15','X','2026-01-15','W','Ahorrando','R',200,'Q',1100,'G',1100,
  'H',0,'I',0,'J',0,'DP',0,'DQ',0,'DS',1000,'DT',100,'AR',1100,'BA',99999);
 insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,field_defs,raw_source,status)
 values(batch,'Ahorro',2,folio,source,'[{"key":"AR","label":"2026-06-30 · Descuento registrado"},{"key":"BA","label":"2026-07-15 · Proyección futura"}]','{}','RESOLVED') returning id into record_id;
 insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,field_defs,raw_source,status)
 values(batch,'Solicitud de retiro',2,folio,jsonb_build_object('A',folio,'D','1/7/2026','E','Parcial','F','SI','G',500,'H','Completado'),'[]','{}','RESOLVED');
 insert into public.savings_participants(participant_type,affiliate_id,legacy_folio,display_name,identity_status,certification_status,data_classification,current_process,historical_yield_reconciled_through)
 values('AFFILIATE',affiliate,folio,'Isolated Savings publication fixture','RESOLVED','CERTIFIED','CANONICAL','JUB','2026-06-30') returning id into participant;
 insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,approved_at,first_expected_contribution_date,first_actual_contribution_date,process_snapshot,data_classification)
 values(participant,1,'ACTIVE','2026-01-15',now(),public.savings_next_contribution_date(today+1,'JUB'),'2026-01-15','JUB','CANONICAL') returning id into enrollment;
 insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,data_classification)
 values(enrollment,200,'JUB',public.savings_next_contribution_date(today+1,'JUB'),'CANONICAL');
 context:=public.savings_certification_context(record_id);
 insert into public.savings_balance_certifications(record_id,participant_id,enrollment_id,cutoff_on,source_version,source_snapshot,command,capital,yield_amount,actor_real_auth_user_id,client_action_id)
 values(record_id,participant,enrollment,today-2,0,context->'snapshot','{}',1000,100,actor,extensions.gen_random_uuid()) returning id into cert;
 insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification,created_by_auth_user_id)
 values(participant,enrollment,'REGULARIZATION','CAPITAL','CREDIT',1000,today-2,'QA-CAP-'||folio,'CANONICAL',actor),
 (participant,enrollment,'REGULARIZATION','YIELD','CREDIT',100,today-2,'QA-YIELD-'||folio,'CANONICAL',actor);
 insert into public.savings_contribution_overrides(enrollment_id,contribution_date,expected_amount,actual_amount,version_number,reason,editor_auth_user_id,client_action_id)
 values(enrollment,today-1,200,200,1,'Isolated receipt',actor,extensions.gen_random_uuid());
 insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,idempotency_key,data_classification,created_by_auth_user_id)
 values(participant,enrollment,'CONTRIBUTION','CAPITAL','CREDIT',200,today-1,today-1,'QA-RECEIPT-'||folio,'CANONICAL',actor);
 result:=public.get_admin_savings_publication_preview(record_id);
 if (result#>>'{balances,total}')::numeric<>1300 or (result#>>'{balances,yield}')::numeric<>100 then raise exception 'OPENING_OR_YIELD_DOUBLE_COUNTED';end if;
 if jsonb_array_length(result->'history')<>2 or exists(select 1 from jsonb_array_elements(result->'history') h where (h->>'amount')::numeric=99999) then raise exception 'FUTURE_CELL_BECAME_RECEIPT';end if;
 if result#>>'{enrollment,frequency}'<>'MONTHLY' or (result#>>'{enrollment,current_contribution_amount}')::numeric<>200 then raise exception 'PLAN_DTO_WRONG';end if;
 if jsonb_array_length(result->'withdrawals')<>1 or result#>>'{withdrawals,0,effective_date}'<>'2026-07-01' or (result#>>'{withdrawals,0,amount}')::numeric<>500 then raise exception 'HISTORICAL_WITHDRAWAL_MISSING';end if;
 if result#>>'{write_capabilities,requests}'<>'false' then raise exception 'PRIVATE_PREVIEW_WRITES_ENABLED';end if;
 if (result#>>'{annual,0,capital}')::numeric<>200 or result#>>'{annual,0,closed}'<>'false'
  or (result#>>'{annual,1,capital}')::numeric<>1000 or (result#>>'{annual,1,yield}')::numeric<>100 or result#>>'{annual,1,subtotal_label}'<>'Subtotal a junio 2026' then
  raise exception 'CLOSED_PERIOD_OR_CURRENT_RECEIPTS_MIXED';end if;
 if not(result ?& array['participant','enrollment','balances','annual','history','upcoming','withdrawals','plan_changes','beneficiaries','actions','write_capabilities']) then raise exception 'USER_DTO_SECTIONS_LOST';end if;
 readiness:=public.get_admin_savings_publication_status();
 select x into row_result from jsonb_array_elements(readiness->'rows')x where x->>'record_id'=record_id::text;
 if row_result->>'ready'<>'true' then raise exception 'VALID_FIXTURE_NOT_READY: %',row_result;end if;
 update public.savings_review_records set proposed_data='{"R":250}',version=1 where id=record_id;
 readiness:=public.get_admin_savings_publication_status();
 select x into row_result from jsonb_array_elements(readiness->'rows')x where x->>'record_id'=record_id::text;
 if row_result->>'ready'<>'false' then raise exception 'STALE_CERTIFICATION_READY';end if;
 update public.savings_review_records set proposed_data='{"AR":99999,"R":250}',version=2 where id=record_id;
 result:=public.get_admin_savings_publication_preview(record_id);
 if (result#>>'{history,1,amount}')::numeric<>1100 or (result#>>'{annual,1,capital}')::numeric<>1000 then raise exception 'UNACCEPTED_HISTORY_LEAKED';end if;
 -- Preview is target-specific; self still returns only the authenticated affiliate.
 if public.get_self_savings_live_readonly() is distinct from known then raise exception 'ADMIN_PREVIEW_LEAKED_TO_SELF';end if;

 -- Native accounts have no source review rows. Confirming a zero actual receipt
 -- resolves an expected date without manufacturing any contribution transaction.
 insert into public.affiliates(numero_control,full_name,auth_eligibility,record_origin)
 values(folio||'-N','Isolated native Savings account','missing_email','ADMIN_AFFILIATES') returning id into native_affiliate;
 insert into public.savings_participants(participant_type,affiliate_id,legacy_folio,display_name,identity_status,certification_status,data_classification)
 values('AFFILIATE',native_affiliate,folio||'-N','Isolated native Savings account','RESOLVED','CERTIFIED','CANONICAL') returning id into native_participant;
 native_due:=public.savings_next_contribution_date(today-40,'JUB');
 insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,approved_at,first_expected_contribution_date,process_snapshot,data_classification)
 values(native_participant,1,'ACTIVE',native_due,now(),native_due,'JUB','CANONICAL') returning id into native_enrollment;
 insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,data_classification)
 values(native_enrollment,200,'JUB',native_due,'CANONICAL');
 readiness:=public.get_admin_savings_publication_status();
 select x into row_result from jsonb_array_elements(readiness->'rows') x where x->>'participant_id'=native_participant::text;
 if row_result->>'ready'<>'false' or row_result->>'origin'<>'NATIVE' then raise exception 'NATIVE_DUE_RECEIPTS_OMITTED';end if;
 insert into public.savings_contribution_overrides(enrollment_id,contribution_date,expected_amount,actual_amount,version_number,reason,editor_auth_user_id,client_action_id)
 select native_enrollment,x.contribution_date,x.expected_amount,0,1,'Isolated zero confirmed',actor,extensions.gen_random_uuid()
 from public.generate_savings_schedule(native_enrollment,native_due,today)x;
 readiness:=public.get_admin_savings_publication_status();
 select x into row_result from jsonb_array_elements(readiness->'rows') x where x->>'participant_id'=native_participant::text;
 if row_result->>'ready'<>'true' then raise exception 'NATIVE_CONFIRMED_ZERO_STILL_PENDING: %',row_result;end if;
 insert into public.savings_contribution_overrides(enrollment_id,contribution_date,expected_amount,actual_amount,version_number,reason,editor_auth_user_id,client_action_id)
 values(native_enrollment,native_due,200,500,2,'Isolated actual receipt',actor,extensions.gen_random_uuid());
 insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,idempotency_key,data_classification,created_by_auth_user_id)
 values(native_participant,native_enrollment,'CONTRIBUTION','CAPITAL','CREDIT',500,native_due,native_due,'QA-NATIVE-RECEIPT-'||folio,'CANONICAL',actor);
 update public.savings_enrollments set first_actual_contribution_date=native_due where id=native_enrollment;
 result:=public.get_admin_savings_publication_account_preview(native_participant);
 if result->>'admin_preview'<>'true' or (result#>>'{balances,total}')::numeric<>500
  or result#>>'{participant,id}'<>native_participant::text or result#>>'{write_capabilities,requests}'<>'false' then raise exception 'NATIVE_ADMIN_PREVIEW_WRONG';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_publication_account_preview(native_participant);raise exception 'NATIVE_PREVIEW_ANON_ALLOWED';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);

 insert into public.affiliates(numero_control,full_name,auth_eligibility,record_origin)
 values(folio||'-N','Isolated duplicate for readiness','missing_email','ADMIN_AFFILIATES') returning id into duplicate_affiliate;
 readiness:=public.get_admin_savings_publication_status();
 select x into row_result from jsonb_array_elements(readiness->'rows') x where x->>'participant_id'=native_participant::text;
 if row_result->>'ready'<>'false' then raise exception 'INVALID_NATIVE_IDENTITY_NOT_REPORTED';end if;
 update public.affiliates set numero_control=folio||'-ISOLATED-DUPLICATE-RESOLVED' where id=duplicate_affiliate;

 insert into public.affiliates(numero_control,full_name,auth_eligibility,record_origin)
 values(folio||'-N2','Isolated second native Savings account','missing_email','ADMIN_AFFILIATES') returning id into second_affiliate;
 insert into public.savings_participants(participant_type,affiliate_id,legacy_folio,display_name,identity_status,certification_status,data_classification)
 values('AFFILIATE',second_affiliate,folio||'-N2','Isolated second native Savings account','RESOLVED','CERTIFIED','CANONICAL') returning id into second_participant;
 insert into public.savings_action_availability(action_code,scope_type,enabled,reason,effective_from,configured_by_auth_user_id)
 values('CHANGE_AMOUNT','GLOBAL',true,'Isolated action check',now()-interval '1 minute',actor),
 ('TERMINATE','GLOBAL',true,'Isolated action check',now()-interval '1 minute',actor);
 result:=public.savings_canonical_user_projection(second_participant);
 if result#>>'{actions,CHANGE_AMOUNT}'<>'false' or result#>>'{actions,TERMINATE}'<>'false' or result#>>'{actions,WITHDRAW}'<>'false'
  or result#>>'{write_capabilities,beneficiaries}'<>'false' then raise exception 'EMPTY_NATIVE_ACTIONS_ENABLED';end if;
 -- Scoped identity fixture: no real Auth links or impersonation sessions change.
 identity_definition:=pg_get_functiondef('public.get_effective_affiliate_id()'::regprocedure);
 execute $sql$create or replace function public.get_effective_affiliate_id() returns uuid language sql stable security definer set search_path='' as $fn$
  select nullif(current_setting('suti.qa_affiliate',true),'')::uuid $fn$;$sql$;
 perform set_config('suti.qa_affiliate',native_affiliate::text,true);
 begin perform public.get_self_savings_dashboard();raise exception 'PRIVATE_NATIVE_DASHBOARD_LEAKED';
 exception when sqlstate '55000' then if sqlerrm<>'SAVINGS_PRIVATE_REVIEW_NOT_PUBLISHED' then raise;end if;end;
 begin perform public.replace_self_savings_beneficiaries(beneficiaries,beneficiary_key);raise exception 'PRIVATE_BENEFICIARY_WRITE_ALLOWED';
 exception when sqlstate '55000' then if sqlerrm<>'SAVINGS_PRIVATE_REVIEW_NOT_PUBLISHED' then raise;end if;end;
 if has_function_privilege('authenticated','public.savings_dashboard_before_publication()','EXECUTE')
  or has_function_privilege('authenticated','public.savings_beneficiaries_before_publication(jsonb,uuid)','EXECUTE') then raise exception 'PRIVATE_OLD_RPC_EXPOSED';end if;
 -- The gate itself was exercised above on actual records. For state-machine tests
 -- only, use a deterministic isolated gate fixture; never certify real accounts.
 functions_definition:=pg_get_functiondef('public.get_admin_savings_publication_status()'::regprocedure);
 execute $sql$create or replace function public.get_admin_savings_publication_status() returns jsonb language sql stable security definer set search_path='' as $fn$
  select '{"mode":"PRIVATE","version":1,"ready":true,"fingerprint":"isolated-ready","total":1}'::jsonb $fn$;$sql$;
 begin perform public.admin_publish_savings(1,'old-preview',true,key);raise exception 'STALE_PUBLICATION_ALLOWED';
 exception when raise_exception then if sqlerrm<>'SAVINGS_PUBLICATION_PREVIEW_STALE' then raise;end if;end;
 begin perform public.admin_publish_savings(1,'isolated-ready',false,key);raise exception 'UNCONFIRMED_PUBLICATION_ALLOWED';
 exception when raise_exception then if sqlerrm<>'SAVINGS_PUBLICATION_CONFIRMATION_REQUIRED' then raise;end if;end;
 result:=public.admin_publish_savings(1,'isolated-ready',true,key);
 if result->>'mode'<>'PUBLISHED' or public.admin_publish_savings(1,'isolated-ready',true,key) is distinct from result then raise exception 'PUBLICATION_RETRY_FAILED';end if;
 if (select count(*) from public.savings_publication_events)<>1 then raise exception 'PUBLICATION_DUPLICATED';end if;
 begin perform public.admin_publish_savings(1,'changed',true,key);raise exception 'CHANGED_RETRY_ALLOWED';
 exception when raise_exception then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 execute functions_definition;
 result:=public.get_self_savings_dashboard();
 if result->>'authority'<>'SUPABASE' or result#>>'{participant,id}'<>native_participant::text or (result#>>'{balances,total}')::numeric<>500 then raise exception 'NATIVE_PUBLISHED_DASHBOARD_WRONG';end if;
 if result is distinct from public.get_self_savings_live_readonly() then raise exception 'PUBLISHED_SELF_APIS_DIVERGED';end if;
 if public.get_self_savings_if_changed('old-private-version')->>'modified'<>'true' then raise exception 'PUBLISHED_OLD_CACHE_REUSED';end if;
 if result#>>'{actions,TERMINATE}'<>'true' then raise exception 'ACTIVE_TERMINATION_HIDDEN';end if;
 insert into public.affiliates(numero_control,full_name,auth_eligibility,record_origin)
 values(folio||'-EMPTY','Isolated affiliate without Savings participant','missing_email','ADMIN_AFFILIATES') returning id into empty_affiliate;
 perform set_config('suti.qa_affiliate',empty_affiliate::text,true);
 result:=public.get_self_savings_live_readonly();
 if result->'participant' is distinct from 'null'::jsonb or result#>>'{actions,JOIN}'<>'true' or result#>>'{write_capabilities,requests}'<>'true' then
  raise exception 'EMPTY_PUBLISHED_JOIN_UNAVAILABLE';end if;
 perform public.admin_configure_savings_operation('{"kind":"ENTRY_MODE","mode":"WINDOWS","reason":"Isolated enrollment closure"}',extensions.gen_random_uuid());
 if public.get_self_savings_live_readonly()#>>'{actions,JOIN}'<>'false' then raise exception 'EMPTY_CLOSED_JOIN_ENABLED';end if;
 perform public.admin_configure_savings_operation('{"kind":"ENTRY_MODE","mode":"ALL_YEAR","reason":"Isolated enrollment reopening"}',extensions.gen_random_uuid());
 insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,field_defs,raw_source,status)
 values(batch,'Ahorro',3,folio||'-EMPTY',jsonb_build_object('A',folio||'-EMPTY','Q',0),'[]','{}','PENDING');
 begin perform public.get_self_savings_live_readonly();raise exception 'LEGACY_UNCONFIRMED_EMPTY_JOIN_ALLOWED';
 exception when raise_exception then if sqlerrm<>'SAVINGS_EXACT_IDENTITY_REQUIRED' then raise;end if;end;
 perform set_config('suti.qa_affiliate',native_affiliate::text,true);
 -- A scheduled cessation remains active until the authorized calendar date.
 update public.savings_enrollments set status='TERMINATED',terminated_at=(today+40)::timestamp at time zone 'America/Hermosillo' where id=native_enrollment;
 result:=public.get_self_savings_live_readonly();
 if result#>>'{enrollment,status}'<>'Ahorrando' or result#>>'{actions,JOIN}'<>'false' or result#>>'{actions,CHANGE_AMOUNT}'<>'true'
  or result#>>'{actions,TERMINATE}'<>'true' or result#>>'{write_capabilities,beneficiaries}'<>'true' or jsonb_array_length(result->'upcoming')=0 then
  raise exception 'FUTURE_TERMINATION_APPLIED_EARLY';end if;
 beneficiary_result:=public.replace_self_savings_beneficiaries(beneficiaries,beneficiary_key);
 update public.savings_enrollments set terminated_at=today::timestamp at time zone 'America/Hermosillo' where id=native_enrollment;
 result:=public.get_self_savings_live_readonly();
 if result#>>'{enrollment,status}'<>'Dejó de ahorrar' or result#>>'{actions,JOIN}'<>'true' or result#>>'{actions,CHANGE_AMOUNT}'<>'false'
  or result#>>'{actions,TERMINATE}'<>'false' or result#>>'{write_capabilities,beneficiaries}'<>'false' or jsonb_array_length(result->'upcoming')<>0 then
  raise exception 'EFFECTIVE_TERMINATION_IGNORED';end if;
 begin perform public.replace_self_savings_beneficiaries(beneficiaries,extensions.gen_random_uuid());raise exception 'TERMINATED_BENEFICIARIES_ALLOWED';
 exception when raise_exception then if sqlerrm<>'SAVINGS_ACTIVE_ENROLLMENT_REQUIRED' then raise;end if;end;
 update public.savings_enrollments set status='ACTIVE',terminated_at=null where id=native_enrollment;

 if public.replace_self_savings_beneficiaries(beneficiaries,beneficiary_key) is distinct from beneficiary_result then raise exception 'BENEFICIARY_RETRY_SHAPE_CHANGED';end if;
 if (select count(*) from public.savings_beneficiary_versions where participant_id=native_participant)<>1 then raise exception 'BENEFICIARY_RETRY_DUPLICATED';end if;
 begin perform public.replace_self_savings_beneficiaries('[{"full_name":"Otra persona","relationship":"Familiar","percentage":100}]',beneficiary_key);raise exception 'BENEFICIARY_CHANGED_RETRY_ALLOWED';
 exception when sqlstate '22023' then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason,client_action_id)
 values(actor,native_affiliate,native_participant,'savings_runtime','OTHER_COMMAND','isolated','{"secret_test_payload":"must_not_return"}','',leaked_key);
 begin perform public.replace_self_savings_beneficiaries(beneficiaries,leaked_key);raise exception 'OTHER_RESOURCE_RETRY_LEAKED';
 exception when sqlstate '22023' then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 perform set_config('suti.qa_affiliate',second_affiliate::text,true);
 begin perform public.replace_self_savings_beneficiaries(beneficiaries,beneficiary_key);raise exception 'CROSS_PARTICIPANT_RETRY_LEAKED';
 exception when sqlstate '22023' then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 if public.get_self_savings_dashboard()#>>'{participant,id}'<>second_participant::text then raise exception 'CROSS_PARTICIPANT_DASHBOARD_LEAKED';end if;
 perform set_config('suti.qa_affiliate',native_affiliate::text,true);
 select auth_user_id into other_actor from public.affiliates where auth_user_id is not null and auth_user_id<>actor limit 1;
 if other_actor is null then raise exception 'SECOND_EXISTING_AUTH_REQUIRED';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
 begin perform public.replace_self_savings_beneficiaries(beneficiaries,beneficiary_key);raise exception 'CROSS_ACTOR_RETRY_LEAKED';
 exception when sqlstate '22023' then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 execute identity_definition;
end $test$;
`;
async function main(){
 const dependencies=deps.map(body).join('\n');
 const extended=process.argv.includes('--with-runtime') ? ['supabase/migrations/20260913000300_savings_requests_runtime.sql','supabase/migrations/20260913000400_savings_source_refresh.sql','supabase/migrations/20260913000500_savings_account_receipts.sql'].map(body).join('\n') : '';
 const migration=dependencies+'\n'+body(forward)+'\n'+extended;
 const capture=`create temporary table qa_savings_publication_readers as
  select p.proname,md5(pg_get_functiondef(p.oid)) definition,p.proacl::text acl,p.proowner,p.prosecdef,p.provolatile,p.proconfig
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('get_self_savings_live_readonly','get_self_savings_if_changed','get_self_savings_dashboard','replace_self_savings_beneficiaries');`;
 const equality=`do $qa$begin
  if exists(select 1 from qa_savings_publication_readers b full join (
   select p.proname,md5(pg_get_functiondef(p.oid)) definition,p.proacl::text acl,p.proowner,p.prosecdef,p.provolatile,p.proconfig
   from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('get_self_savings_live_readonly','get_self_savings_if_changed','get_self_savings_dashboard','replace_self_savings_beneficiaries')
  )n using(proname) where to_jsonb(b) is distinct from to_jsonb(n)) then raise exception 'PUBLICATION_READER_RECOVERY_NOT_EXACT';end if;
 end $qa$;`;
 await query('begin;\n'+dependencies+'\n'+capture+'\n'+body(forward)+'\n'+body(recovery)+'\n'+equality+'\nrollback;');
 console.log('PASS Savings publication forward + exact reader definition/owner/grants recovery ROLLBACK');
 const recoveryHistoryGuard=`do $test$begin
  begin execute $recovery$${body(recovery)}$recovery$;raise exception 'PUBLICATION_HISTORY_REMOVED';
  exception when raise_exception then if sqlerrm<>'SAVINGS_PUBLICATION_HISTORY_MUST_BE_PRESERVED' then raise;end if;end;
 end $test$;`;
 await query('begin;\n'+migration+'\n'+checks+'\n'+recoveryHistoryGuard+'\nrollback;');
 console.log('PASS private parity + H05 reuse, full readiness gate, accepted-source staleness, actor scope, closed/current periods, no historical double credit, no projected receipts, permissions, explicit switch/idempotency and history-preserving recovery in ROLLBACK');
 console.log('PASS native pending/zero receipts, invalid-identity listing, private/native dashboard guards, beneficiary actor/participant/resource/payload retry isolation'+(extended?' with runtime003/source004/account005':''));
 console.log('LIMIT: successful switch state tested with isolated readiness fixture; no real account certified, no real publication, no frontend acceptance claimed.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={deps,checks,forward,recovery};
