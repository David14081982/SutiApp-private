'use strict';
// All schema and financial fixtures are confined to explicit ROLLBACK transactions.
const { query, body } = require('./savings-admin-review-db');
const migration = 'supabase/migrations/20260913000300_savings_requests_runtime.sql';
const recovery = 'supabase/recovery/20260913000300_savings_requests_runtime_recovery.sql';
const dependencies = [
 '20260906000100_savings_operations', '20260906000200_savings_retirement_transition',
 '20260913000000_savings_identity_compatibility', '20260906000400_savings_period_yield',
 '20260907000100_savings_balance_certification', '20260913000100_savings_runtime_completion',
 '20260913000200_savings_publication'
];
const checks = `
do $test$ declare actor uuid; af uuid; fol text; p uuid; en uuid; request jsonb; result jsonb; cmd jsonb; key uuid;
 change_date date; original_total numeric; before_count int; first_date date; n int;
begin
 select auth_user_id into actor from public.admin_assignments where enabled and ('*'=any(permissions) or ('savings.write'=any(permissions) and 'savings.approve'=any(permissions) and 'savings.read'=any(permissions))) limit 1;
 if actor is null then raise exception 'TEST_ADMIN_REQUIRED'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 select a.id,a.numero_control into af,fol from public.affiliates a where not coalesce(a.is_archived,false) and a.numero_control is not null
  and (select count(*) from public.affiliates b where b.numero_control=a.numero_control)=1
  and not exists(select 1 from public.savings_participants where affiliate_id=a.id or legacy_folio=a.numero_control)
  and not exists(select 1 from public.savings_review_records where source_sheet='Ahorro' and source_folio=a.numero_control)
  order by a.id limit 1;
 if af is null then raise exception 'TEST_NEW_SAVER_REQUIRED'; end if;
 cmd:=jsonb_build_object('kind','SUBMIT','type','JOIN','folio',fol,'new_amount',500,'process','JUB','observation','');key:=extensions.gen_random_uuid();
 request:=public.admin_save_savings_operation(cmd,key);p:=(request->>'participant_id')::uuid;
 if request->>'status'<>'SUBMITTED' or request->>'data_classification'<>'CANONICAL' then raise exception 'JOIN_REQUEST_FAILED'; end if;
 result:=public.admin_save_savings_operation(cmd,key);
 if result->>'id'<>request->>'id' then raise exception 'RETRY_DUPLICATED'; end if;
 begin perform public.admin_save_savings_operation(cmd||'{"new_amount":600}'::jsonb,key);raise exception 'ALTERED_RETRY_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform public.admin_save_savings_operation(cmd,extensions.gen_random_uuid());raise exception 'DUPLICATE_JOIN_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_PENDING_REQUEST_EXISTS' then raise;end if;end;
 cmd:=jsonb_build_object('kind','REVIEW','request_id',request->>'id','decision','APPROVE','observation','');key:=extensions.gen_random_uuid();
 result:=public.admin_save_savings_operation(cmd,key);en:=(result->>'enrollment_id')::uuid;first_date:=(result->>'effective_from')::date;
 if first_date<>public.savings_next_contribution_date(public.savings_operation_today()+30,'JUB') then raise exception 'JOIN_30_DAY_CALENDAR'; end if;
 if exists(select 1 from public.savings_transactions where participant_id=p) then raise exception 'JOIN_CREATED_MONEY'; end if;
 if (select amount from public.savings_contribution_plans where enrollment_id=en)<>500 then raise exception 'MONTHLY_ALREADY_MONTHLY_DOUBLED'; end if;
 perform public.admin_save_savings_operation(cmd,key);
 if (select count(*) from public.savings_enrollments where participant_id=p)<>1 then raise exception 'JOIN_APPROVAL_DUPLICATED'; end if;
 -- Existing accepted changes remain actionable after intake has been hidden.
 insert into public.savings_action_availability(action_code,scope_type,participant_id,enabled,reason,configured_by_auth_user_id)
 values('CHANGE_AMOUNT','PARTICIPANT',p,true,'Rollback request test',actor);
 request:=public.admin_save_savings_operation(jsonb_build_object('kind','SUBMIT','folio',fol,'type','CHANGE_AMOUNT','new_amount',800,'observation',''),extensions.gen_random_uuid());
 insert into public.savings_action_availability(action_code,scope_type,participant_id,enabled,reason,configured_by_auth_user_id,created_at)
 values('CHANGE_AMOUNT','PARTICIPANT',p,false,'Rollback closes new requests',actor,clock_timestamp()+interval '1 second');
 change_date:=public.savings_next_enrollment_date(en,first_date+1);
 begin perform public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',request->>'id','decision','APPROVE','effective_date',change_date,'observation',''),extensions.gen_random_uuid());raise exception 'UNJUSTIFIED_DATE_EXCEPTION_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_DATE_EXCEPTION_REASON_REQUIRED' then raise;end if;end;
 result:=public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',request->>'id','decision','APPROVE','effective_date',change_date,'observation','Authorized later deduction'),extensions.gen_random_uuid());
 if (select expected_amount from public.generate_savings_schedule(en,first_date,first_date))<>500
  or (select expected_amount from public.generate_savings_schedule(en,change_date,change_date))<>800 then raise exception 'CHANGE_REWROTE_PRIOR_PLAN'; end if;
 if exists(select 1 from public.savings_transactions where participant_id=p) then raise exception 'PROJECTION_CREATED_MONEY'; end if;
 -- Fixture opening is synthetic and rolls back; no production account is credited.
 insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification)
 values(p,en,'REGULARIZATION','CAPITAL','CREDIT',1000,public.savings_operation_today(),'runtime-rollback-opening:'||p,'CANONICAL');
 insert into public.savings_action_availability(action_code,scope_type,participant_id,enabled,reason,configured_by_auth_user_id)
 values('WITHDRAW','PARTICIPANT',p,true,'Rollback request test',actor);
 original_total:=(select total from public.savings_participant_balance(p));
 request:=public.admin_save_savings_operation(jsonb_build_object('kind','SUBMIT','folio',fol,'type','WITHDRAW','amount',300,'continue_saving',false,'observation',''),extensions.gen_random_uuid());
 if request->>'withdrawal_kind'<>'PARTIAL' or request->>'continue_saving'<>'true' then raise exception 'PARTIAL_CONTINUITY_FAILED'; end if;
 if (select total from public.savings_participant_balance(p))<>original_total or exists(select 1 from public.savings_holds where participant_id=p) then raise exception 'REQUEST_RESERVED_MONEY'; end if;
 result:=public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',request->>'id','decision','APPROVE','observation',''),extensions.gen_random_uuid());
 if result->>'status'<>'APPROVED' then raise exception 'WITHDRAW_REVIEW_FAILED'; end if;
 begin perform public.admin_settle_savings_request((request->>'id')::uuid,300,0,'',extensions.gen_random_uuid());raise exception 'UNVERIFIED_PAYOUT_ALLOWED';exception when sqlstate '55000' then if sqlerrm<>'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE' then raise;end if;end;
 if (select total from public.savings_participant_balance(p))<>original_total then raise exception 'BLOCKED_PAYOUT_CHANGED_MONEY'; end if;
 -- Cessation affects the future calendar, and never pays or deletes existing money.
 request:=public.admin_save_savings_operation(jsonb_build_object('kind','SUBMIT','folio',fol,'type','TERMINATE','observation',''),extensions.gen_random_uuid());
 result:=public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',request->>'id','decision','APPROVE','effective_date',change_date+1,'observation','Authorized cessation after accepted change'),extensions.gen_random_uuid());
 if exists(select 1 from public.generate_savings_schedule(en,change_date+1,change_date+90)) then raise exception 'CESSATION_DID_NOT_STOP_FUTURE'; end if;
 if (select total from public.savings_participant_balance(p))<>original_total then raise exception 'CESSATION_PAID_WITHOUT_REQUEST'; end if;
 -- Private self submission is closed even for an authenticated owner.
 begin perform public.submit_self_savings_request('JOIN',null,null,null,200,true,null,'',null,extensions.gen_random_uuid());raise exception 'PRIVATE_SELF_REQUEST_ALLOWED';exception when sqlstate '55000' then null;when insufficient_privilege then null;end;
 if has_function_privilege('authenticated','public.savings_runtime_submit(uuid,jsonb,uuid,boolean)','execute') or has_function_privilege('anon','public.admin_save_savings_operation(jsonb,uuid)','execute') then raise exception 'INTERNAL_OR_ANON_GRANT'; end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_runtime_requests(null);raise exception 'ANON_READ_ALLOWED';exception when insufficient_privilege then null;end;
end $test$;
`;

const settlementChecks = `
-- Test-only stand-in for the separately owned loan guard, scoped to this ROLLBACK.
-- This verifies Savings money rules; it does not prove or install loan clearance.
create or replace function public.savings_runtime_assert_payout(p_participant_id uuid) returns void
language plpgsql security definer set search_path='' as $$ begin return; end $$;
do $cash$ declare actor uuid; p uuid; en uuid; fol text; r jsonb; result jsonb; key uuid; count_before int; cmd jsonb;
begin
 select auth_user_id into actor from public.admin_assignments where enabled and ('*'=any(permissions) or ('savings.write'=any(permissions) and 'savings.approve'=any(permissions) and 'savings.read'=any(permissions))) limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 select to_jsonb(q),q.participant_id,q.enrollment_id,s.legacy_folio into r,p,en,fol from public.savings_requests q join public.savings_participants s on s.id=q.participant_id
  where q.metadata->>'origin'='SAVINGS_RUNTIME_V1' and q.request_type='WITHDRAW' and q.status='APPROVED' order by q.id limit 1;
 if p is null then raise exception 'CASH_FIXTURE_REQUIRED'; end if;
 -- Restore this synthetic fixture's active state for independent continuation cases.
 update public.savings_enrollments set status='ACTIVE',terminated_at=null,continue_saving=true where id=en;
 key:=extensions.gen_random_uuid();
 result:=public.admin_settle_savings_request((r->>'id')::uuid,300,0,'',key);
 if result->>'status'<>'SETTLED' or (select total from public.savings_participant_balance(p))<>700 then raise exception 'PARTIAL_SETTLEMENT_FAILED'; end if;
 if (select status from public.savings_enrollments where id=en)<>'ACTIVE' then raise exception 'PARTIAL_STOPPED_SAVING'; end if;
 select count(*) into count_before from public.savings_transactions where participant_id=p;
 perform public.admin_settle_savings_request((r->>'id')::uuid,300,0,'',key);
 if (select count(*) from public.savings_transactions where participant_id=p)<>count_before then raise exception 'PAYMENT_RETRY_DUPLICATED'; end if;
 begin perform public.admin_settle_savings_request((r->>'id')::uuid,200,100,'',key);raise exception 'ALTERED_PAYMENT_RETRY_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform public.admin_settle_savings_request((r->>'id')::uuid,300,0,'',extensions.gen_random_uuid());raise exception 'SECOND_PAYMENT_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_REQUEST_NOT_SETTLEABLE' then raise;end if;end;
 r:=public.admin_save_savings_operation(jsonb_build_object('kind','SUBMIT','type','WITHDRAW','folio',fol,'amount',700,'continue_saving',true,'observation',''),extensions.gen_random_uuid());
 if r->>'withdrawal_kind'<>'TOTAL' then raise exception 'TOTAL_KIND_NOT_INFERRED'; end if;
 perform public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',r->>'id','decision','APPROVE','observation',''),extensions.gen_random_uuid());
 perform public.admin_settle_savings_request((r->>'id')::uuid,700,0,'',extensions.gen_random_uuid());
 if (select total from public.savings_participant_balance(p))<>0 or (select status from public.savings_enrollments where id=en)<>'ACTIVE' then raise exception 'TOTAL_CONTINUE_FAILED'; end if;
 insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification)
 values(p,en,'REGULARIZATION','CAPITAL','CREDIT',1000,public.savings_operation_today(),'runtime-cash-fixture-capital:'||p,'CANONICAL'),
 (p,en,'REGULARIZATION','YIELD','CREDIT',100,public.savings_operation_today(),'runtime-cash-fixture-yield:'||p,'CANONICAL');
 r:=public.admin_save_savings_operation(jsonb_build_object('kind','SUBMIT','type','WITHDRAW','folio',fol,'amount',1100,'continue_saving',false,'observation',''),extensions.gen_random_uuid());
 perform public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',r->>'id','decision','APPROVE','observation',''),extensions.gen_random_uuid());
 insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification)
 values(p,en,'REGULARIZATION','CAPITAL','CREDIT',50,public.savings_operation_today(),'runtime-cash-fixture-late:'||p,'CANONICAL');
 begin perform public.admin_settle_savings_request((r->>'id')::uuid,1000,100,'',extensions.gen_random_uuid());raise exception 'STALE_FULL_AMOUNT_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_TOTAL_WITHDRAWAL_AMOUNT_MISMATCH' then raise;end if;end;
 result:=public.admin_save_savings_operation(jsonb_build_object('kind','CANCEL','request_id',r->>'id','observation',''),extensions.gen_random_uuid());
 if result->>'status'<>'CANCELLED' or (select total from public.savings_participant_balance(p))<>1150 then raise exception 'CANCEL_CHANGED_MONEY'; end if;
 r:=public.admin_save_savings_operation(jsonb_build_object('kind','SUBMIT','type','WITHDRAW','folio',fol,'amount',1150,'continue_saving',false,'observation',''),extensions.gen_random_uuid());
 perform public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',r->>'id','decision','APPROVE','observation',''),extensions.gen_random_uuid());
 result:=public.admin_settle_savings_request((r->>'id')::uuid,1050,100,'',extensions.gen_random_uuid());
 if (select total from public.savings_participant_balance(p))<>0 or (select status from public.savings_enrollments where id=en)<>'TERMINATED' then raise exception 'TOTAL_STOP_FAILED'; end if;
 if exists(select 1 from public.generate_savings_schedule(en,public.savings_operation_today()+1,public.savings_operation_today()+180)) then raise exception 'TOTAL_STOP_LEFT_FUTURE_PLAN'; end if;
 if result->>'requested_capital_amount'<>'1050.00' or result->>'requested_yield_amount'<>'100.00' then raise exception 'PAYMENT_COMPONENT_REPORT_FAILED'; end if;
 if exists(select 1 from public.savings_holds where participant_id=p) then raise exception 'RESERVATION_CREATED'; end if;
 select to_jsonb(q) into r from public.savings_requests q where q.participant_id=p and q.request_type='CHANGE_AMOUNT' and q.status='APPROVED' limit 1;
 begin perform public.admin_save_savings_operation(jsonb_build_object('kind','CANCEL','request_id',r->>'id'),extensions.gen_random_uuid());raise exception 'ACCEPTED_PLAN_CANCELLED_SILENTLY';exception when raise_exception then if sqlerrm<>'SAVINGS_REQUEST_NOT_CANCELABLE' then raise;end if;end;
end $cash$;
`;

async function main() {
 const chain = dependencies.map(name => body('supabase/migrations/' + name + '.sql')).join('\n');
 await query('begin;\n' + chain + '\n' + body(migration) + '\n' + body(recovery) + '\nrollback;');
 console.log('PASS requests forward + recovery, no persisted data');
 await query('begin;\n' + chain + '\n' + body(migration) + '\n' + checks + '\n' + settlementChecks + '\nrollback;');
 console.log('PASS requests: exact identity, canonical join, 30-day calendar, approved changes, optional ordinary notes, exception notes, no reservation, partial continuity, cessation, permissions, idempotency, unknown-debt payout denial, isolated partial/full payments, continuation/cessation, stale balance cancellation, component reporting; ROLLBACK');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { checks, settlementChecks, dependencies, migration, recovery };
