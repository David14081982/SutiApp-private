'use strict';
const { query, body } = require('./savings-admin-review-db');
const { dependencies } = require('./test-savings-requests-runtime-live');
const forward = 'supabase/migrations/20260913000500_savings_account_receipts.sql';
const recovery = 'supabase/recovery/20260913000500_savings_account_receipts_recovery.sql';
const checks = `
do $test$ declare actor uuid; af uuid; fol text; p uuid; en uuid; second_en uuid; request jsonb; result jsonb; view_data jsonb;
 first_date date; second_date date; key uuid; period_id uuid; avail uuid; txcount int; plan_count int; cutoff date;
begin
 select auth_user_id into actor from public.admin_assignments where enabled and ('*'=any(permissions) or ('savings.write'=any(permissions) and 'savings.approve'=any(permissions) and 'savings.read'=any(permissions))) limit 1;
 if actor is null then raise exception 'TEST_ADMIN_REQUIRED';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 select a.id,a.numero_control into af,fol from public.affiliates a where not coalesce(a.is_archived,false) and a.numero_control is not null
  and (select count(*) from public.affiliates b where b.numero_control=a.numero_control)=1
  and not exists(select 1 from public.savings_participants where affiliate_id=a.id or legacy_folio=a.numero_control)
  and not exists(select 1 from public.savings_review_records where source_sheet='Ahorro' and source_folio=a.numero_control) order by a.id limit 1;
 if af is null then raise exception 'TEST_NATIVE_SAVER_REQUIRED';end if;
 request:=public.admin_save_savings_operation(jsonb_build_object('kind','SUBMIT','type','JOIN','folio',fol,'new_amount',500,'process','PROCESS_1','observation',''),extensions.gen_random_uuid());
 result:=public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',request->>'id','decision','APPROVE','observation',''),extensions.gen_random_uuid());
 p:=(result->>'participant_id')::uuid;en:=(result->>'enrollment_id')::uuid;first_date:=(result->>'effective_from')::date;
 view_data:=public.get_admin_savings_account(p,public.savings_operation_today());
 if (public.get_admin_savings_native_accounts(fol,20,0,'ahorrando')->>'total')::int<>1
  or (public.get_admin_savings_native_accounts(fol,20,0,'baja')->>'total')::int<>0 then raise exception 'NATIVE_ACTIVE_FILTER_WRONG';end if;
 if not exists(select 1 from jsonb_array_elements(public.get_admin_savings_native_accounts(fol,20,0)->'items')x
  where x->>'proceso'='1' and (x->>'aporte')::numeric=500 and x->>'ultimo' is null and (x->>'prox')::date=first_date) then raise exception 'NATIVE_REAL_PLAN_FIELDS_MISSING';end if;
 if (view_data->>'unconfirmed_dates')::int<>0 then raise exception 'FUTURE_BECAME_RECEIVED';end if;
 if not exists(select 1 from jsonb_array_elements(public.get_admin_savings_native_accounts(fol,20,0)->'items')x where x->>'participant_id'=p::text) then raise exception 'NATIVE_NOT_LISTED';end if;
 begin perform public.admin_confirm_savings_account_receipt(p,en,first_date,500,0,'',extensions.gen_random_uuid());raise exception 'FUTURE_RECEIPT_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_RECEIPT_INVALID' then raise;end if;end;
 -- Confirm one day after the economic date: audit time must not move the money into the following period.
 execute format('create or replace function public.savings_operation_today() returns date language sql stable set search_path='''' as %L','select '||quote_literal(first_date+1)||'::date');
 key:=extensions.gen_random_uuid();
 result:=public.admin_confirm_savings_account_receipt(p,en,first_date,500,0,'',key);
 if (select total from public.savings_participant_balance(p))<>500 or (select first_actual_contribution_date from public.savings_enrollments where id=en)<>first_date then raise exception 'NATIVE_RECEIPT_NOT_CREDITED';end if;
 select count(*) into txcount from public.savings_transactions where participant_id=p;
 perform public.admin_confirm_savings_account_receipt(p,en,first_date,500,0,'',key);
 if (select count(*) from public.savings_transactions where participant_id=p)<>txcount then raise exception 'RETRY_DUPLICATED_RECEIPT';end if;
 begin perform public.admin_confirm_savings_account_receipt(p,en,first_date,600,0,'',key);raise exception 'ALTERED_RETRY_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform public.admin_confirm_savings_account_receipt(p,en,first_date,600,0,'',extensions.gen_random_uuid());raise exception 'STALE_VERSION_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_PREVIEW_STALE' then raise;end if;end;
 begin perform public.admin_override_savings_contribution(en,first_date,600,'Legacy shortcut',extensions.gen_random_uuid());raise exception 'OLD_CANONICAL_WRITER_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_USE_CONFIRMED_RECEIPT' then raise;end if;end;
 view_data:=public.get_admin_savings_account(p,first_date);
 if (view_data->>'unconfirmed_dates')::int<>0 or (view_data#>>'{balance,total}')::numeric<>500
  or not exists(select 1 from jsonb_array_elements(view_data->'schedule')s where s->>'enrollment_id'=en::text and s->>'confirmed'='true' and (s->>'actual')::numeric=500) then raise exception 'NATIVE_READER_MISSING_RECEIPT';end if;
 if not exists(select 1 from public.savings_transactions where participant_id=p and contribution_date=first_date and effective_date=first_date) then raise exception 'LATE_RECEIPT_WRONG_ECONOMIC_DATE';end if;
 if not exists(select 1 from jsonb_array_elements(public.get_admin_savings_native_accounts(fol,20,0)->'items')x where (x->>'ultimo')::date=first_date and x->>'proceso'='1') then raise exception 'NATIVE_LAST_ACTUAL_MISSING';end if;
 -- A future cessation remains active until its local effective day, without rewriting history.
 begin
  update public.savings_enrollments set status='TERMINATED',terminated_at=(first_date+3)::timestamp at time zone 'America/Hermosillo',continue_saving=false where id=en;
  view_data:=public.get_admin_savings_account(p,first_date+3);
  if view_data#>>'{context,person,estado}'<>'Ahorrando' or view_data#>>'{latest_enrollment,status}'<>'ACTIVE'
   or view_data#>>'{latest_enrollment,recorded_status}'<>'TERMINATED'
   or (public.get_admin_savings_native_accounts(fol,20,0,'ahorrando')->>'total')::int<>1
   or (public.get_admin_savings_native_accounts(fol,20,0,'baja')->>'total')::int<>0 then raise exception 'FUTURE_CESSATION_SHOWN_TOO_EARLY';end if;
  execute format('create or replace function public.savings_operation_today() returns date language sql stable set search_path='''' as %L','select '||quote_literal(first_date+3)||'::date');
  view_data:=public.get_admin_savings_account(p,first_date+3);
  if view_data#>>'{context,person,estado}'<>'Dejo de ahorrar' or view_data#>>'{latest_enrollment,status}'<>'TERMINATED'
   or (public.get_admin_savings_native_accounts(fol,20,0,'ahorrando')->>'total')::int<>0
   or (public.get_admin_savings_native_accounts(fol,20,0,'baja')->>'total')::int<>1 then raise exception 'DUE_CESSATION_NOT_SHOWN';end if;
  if (select total from public.savings_participant_balance(p))<>500 then raise exception 'CESSATION_READER_CHANGED_MONEY';end if;
  raise exception 'RESET_FUTURE_CESSATION_TEST';
 exception when raise_exception then if sqlerrm<>'RESET_FUTURE_CESSATION_TEST' then raise;end if;end;
 -- Isolated mature membership proves late reconciliation participates in cutoff yield;
 -- the subtransaction rolls back both the fixture and the posted period decision.
 begin
  update public.savings_enrollments set enrollment_started_at=(first_date-interval '6 months')::timestamp at time zone 'America/Hermosillo' where id=en;
  insert into public.savings_yield_periods(period_year,semester,starts_on,ends_on)
   values(extract(year from first_date)::int,case when extract(month from first_date)<=6 then 1 else 2 end,first_date,first_date) returning id into period_id;
  insert into public.savings_action_availability(action_code,scope_type,enabled,reason,effective_from,effective_to,configured_by_auth_user_id)
   values('WITHDRAW','GLOBAL',true,'Rollback late receipt audit',first_date::timestamp at time zone 'America/Hermosillo',(first_date+2)::timestamp at time zone 'America/Hermosillo',actor) returning id into avail;
  insert into public.savings_withdrawal_openings(availability_id,yield_period_id,cutoff_on,percentage,opening_kind,reason,actor_real_auth_user_id,client_action_id)
   values(avail,period_id,first_date,12.5,'EARLY','Rollback late receipt audit',actor,extensions.gen_random_uuid());
  view_data:=public.preview_savings_period_yield(period_id);
  if not exists(select 1 from jsonb_array_elements(view_data->'rows')x where x->>'participant_id'=p::text and x->>'status'='ELIGIBLE' and (x->>'capital_basis')::numeric=500 and (x->>'yield_amount')::numeric=62.5) then raise exception 'LATE_RECEIPT_YIELD_DISCREPANCY %',view_data;end if;
  perform public.admin_confirm_savings_period_yield(period_id,view_data->>'fingerprint','Rollback late receipt audit',extensions.gen_random_uuid());
  begin perform public.admin_confirm_savings_account_receipt(p,en,first_date,600,1,null,extensions.gen_random_uuid());raise exception 'CREDITED_YIELD_RECEIPT_CHANGED';exception when raise_exception then if sqlerrm<>'SAVINGS_YIELD_PERIOD_PROTECTED' then raise;end if;end;
  if (select total from public.savings_participant_balance(p))<>562.5 or (select max(version_number) from public.savings_contribution_overrides where enrollment_id=en)<>1 then raise exception 'REJECTED_YIELD_RECEIPT_CHANGED_MONEY';end if;
  raise exception 'RESET_YIELD_RECEIPT_FIXTURE';
 exception when raise_exception then if sqlerrm<>'RESET_YIELD_RECEIPT_FIXTURE' then raise;end if;end;
 -- Simulated existing delivered capital: not loan clearance and never persisted.
 insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification)
 values(p,en,'WITHDRAWAL','CAPITAL','DEBIT',500,first_date,'native-receipt-rollback-paid:'||p,'CANONICAL');
 begin perform public.admin_confirm_savings_account_receipt(p,en,first_date,0,1,'',extensions.gen_random_uuid());raise exception 'NEGATIVE_RECEIPT_CORRECTION_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_RECEIPT_EXCEEDS_AVAILABLE_CAPITAL' then raise;end if;end;
 if (select total from public.savings_participant_balance(p))<>0 or (select max(version_number) from public.savings_contribution_overrides where enrollment_id=en)<>1 then raise exception 'REJECTED_CORRECTION_CHANGED_MONEY';end if;
 -- Close the synthetic first enrollment as an already elapsed lifecycle; preserve
 -- its original contribution and request rows to test sequence-two enrollment.
 update public.savings_enrollments set status='TERMINATED',terminated_at=clock_timestamp()-interval '1 day',continue_saving=false where id=en;
 if (public.get_admin_savings_native_accounts(fol,20,0,'baja')->>'total')::int<>1
  or (public.get_admin_savings_native_accounts(fol,20,0,'ahorrando')->>'total')::int<>0 then raise exception 'NATIVE_TERMINATED_FILTER_WRONG';end if;
 request:=public.admin_save_savings_operation(jsonb_build_object('kind','SUBMIT','type','JOIN','folio',fol,'new_amount',800,'process','JUB','observation',''),extensions.gen_random_uuid());
 result:=public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',request->>'id','decision','APPROVE','observation',''),extensions.gen_random_uuid());
 second_en:=(result->>'enrollment_id')::uuid;second_date:=(result->>'effective_from')::date;
 if second_en=en or (select sequence_number from public.savings_enrollments where id=second_en)<>2 then raise exception 'RENEWAL_OVERWROTE_ENROLLMENT';end if;
 execute format('create or replace function public.savings_operation_today() returns date language sql stable set search_path='''' as %L','select '||quote_literal(second_date)||'::date');
 perform public.admin_confirm_savings_account_receipt(p,second_en,second_date,800,0,null,extensions.gen_random_uuid());
 if (select total from public.savings_participant_balance(p))<>800 or not exists(select 1 from public.savings_contribution_overrides where enrollment_id=en and actual_amount=500) then raise exception 'RENEWAL_MIXED_HISTORY';end if;
 view_data:=public.get_admin_savings_account(p,second_date);
 if (view_data#>>'{context,person,inicio}')::date<>first_date
  or (view_data#>>'{latest_enrollment,first_actual_contribution_date}')::date<>second_date
  or not exists(select 1 from jsonb_array_elements(public.get_admin_savings_native_accounts(fol,20,0)->'items')x where (x->>'inicio')::date=first_date) then raise exception 'RENEWAL_LOST_ORIGINAL_FIRST_ACTUAL';end if;
 if view_data#>>'{latest_enrollment,id}'<>second_en::text or (view_data#>>'{balance,total}')::numeric<>800 or (view_data->>'unconfirmed_dates')::int<>0 then raise exception 'RENEWAL_READER_WRONG_ENROLLMENT';end if;
 begin perform public.admin_override_savings_contribution(second_en,second_date,900,'Legacy shortcut',extensions.gen_random_uuid());raise exception 'RENEWAL_OLD_WRITER_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_USE_CONFIRMED_RECEIPT' then raise;end if;end;

 perform public.admin_confirm_savings_account_receipt(p,second_en,second_date,0,1,null,extensions.gen_random_uuid());
 if (public.get_admin_savings_native_accounts(fol,20,0,'pausado')->>'total')::int<>1 then raise exception 'NATIVE_ZERO_FILTER_WRONG';end if;
 if (select first_actual_contribution_date from public.savings_enrollments where id=second_en) is not null or (select total from public.savings_participant_balance(p))<>0 then raise exception 'ZERO_FIRST_RECEIPT_LEFT_FALSE_START';end if;
 perform public.admin_confirm_savings_account_receipt(p,second_en,second_date,800,2,null,extensions.gen_random_uuid());
 if (select first_actual_contribution_date from public.savings_enrollments where id=second_en)<>second_date then raise exception 'RESTORED_FIRST_RECEIPT_DATE_WRONG';end if;
 insert into public.savings_holds(participant_id,enrollment_id,component,amount,reason,created_by_auth_user_id) values(p,second_en,'CAPITAL',700,'Rollback retention fixture',actor);
 begin perform public.admin_confirm_savings_account_receipt(p,second_en,second_date,100,3,'',extensions.gen_random_uuid());raise exception 'HELD_CAPITAL_REDUCTION_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_RECEIPT_EXCEEDS_AVAILABLE_CAPITAL' then raise;end if;end;
 if (public.get_admin_savings_native_accounts(fol,20,0,'pausado')->>'total')::int<>0
  or not exists(select 1 from jsonb_array_elements(public.get_admin_savings_native_accounts(fol,20,0)->'items')x where x->>'proceso'='JUB' and (x->>'aporte')::numeric=800 and (x->>'ultimo')::date=second_date) then raise exception 'NATIVE_RENEWAL_FIELDS_WRONG';end if;
 if has_function_privilege('anon','public.admin_confirm_savings_account_receipt(uuid,uuid,date,numeric,integer,text,uuid)','execute') then raise exception 'ANON_RECEIPT_GRANT';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_native_accounts('',20,0);raise exception 'ANON_NATIVE_LIST_ALLOWED';exception when insufficient_privilege then null;end;
end $test$;
`;
async function main() {
 const chain = dependencies.concat(['20260913000300_savings_requests_runtime','20260913000400_savings_source_refresh']).map(name=>body('supabase/migrations/'+name+'.sql')).join('\n');
 await query('begin;\n'+chain+'\n'+body(forward)+'\n'+body(recovery)+'\nrollback;');
 console.log('PASS accounts forward + recovery ROLLBACK');
 await query('begin;\n'+chain+'\n'+body(forward)+'\n'+checks+'\nrollback;');
 console.log('PASS native JOIN, canonical actual 500, retries/version guards, no negative post-payment correction, renewal sequence-two receipt, actual history, native list/detail, old writer denied, anonymous denied; ROLLBACK');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={checks,forward,recovery};
