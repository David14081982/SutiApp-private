'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {query,body}=require('./savings-admin-review-db');
const migration='supabase/migrations/20260914000100_savings_self_join.sql';
const checks=`
do $test$ declare actor uuid; af uuid; other_af uuid; ctx jsonb; req jsonb; idem uuid; plan uuid; cat text; proc text;
begin
 select auth_user_id into actor from public.admin_assignments where enabled and ('*'=any(permissions) or 'savings.approve'=any(permissions)) limit 1;
 select id into af from public.affiliates a where not coalesce(a.is_archived,false) and numero_control is not null
 and (select count(*) from public.affiliates b where b.numero_control=a.numero_control)=1
 and not exists(select 1 from public.savings_participants p where p.affiliate_id=a.id or p.legacy_folio=a.numero_control)
 and not exists(select 1 from public.savings_review_records where source_sheet='Ahorro' and source_folio=a.numero_control) order by id limit 1;
 select id into other_af from public.affiliates where id<>af and not coalesce(is_archived,false) order by id limit 1;
 if actor is null or af is null or other_af is null then raise exception 'TEST_FIXTURE_REQUIRED';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform set_config('savings.test_affiliate',af::text,true);
 execute $sql$create or replace function public.get_effective_affiliate_id() returns uuid language sql stable security definer set search_path='' as $fn$select nullif(current_setting('savings.test_affiliate',true),'')::uuid$fn$$sql$;
 if (select mode from public.savings_publication_state where id)<>'PRIVATE' then raise exception 'TEST_EXPECTED_PRIVATE';end if;
 foreach cat in array array['JUBILADOS_PENSIONADOS','SUPLENTES_VARIABLES','SUPLENTES_FIJOS','EVENTUALES','BASE','CONFIANZA'] loop
  update public.affiliates set financial_employee_category_code=cat where id=af;
  proc:=case cat when 'JUBILADOS_PENSIONADOS' then 'JUB' when 'SUPLENTES_VARIABLES' then 'PROCESS_3' else 'PROCESS_1' end;
  ctx:=public.get_self_savings_join_context(500);
  if not (ctx->>'can_join')::boolean or (ctx->>'first_discount_on')::date<>public.savings_next_contribution_date(public.savings_operation_today()+30,proc)
  or jsonb_array_length(ctx->'upcoming')<>(case when proc='JUB' then 12 else 24 end) then raise exception 'CATEGORY_CALENDAR_FAILED %',cat;end if;
  if exists(select 1 from jsonb_array_elements(ctx->'upcoming') x where (x->>'expected_amount')::numeric<>500 or extract(day from (x->>'contribution_date')::date)=10) then raise exception 'AMOUNT_OR_DAY10_FAILED';end if;
 end loop;
 if public.savings_next_contribution_date('2026-09-06'::date+30,'JUB')<>'2026-11-05'::date
 or public.savings_next_contribution_date('2026-09-06'::date+30,'PROCESS_1')<>'2026-10-15'::date
 or public.savings_next_contribution_date('2028-02-16','PROCESS_1')<>'2028-02-28'::date then raise exception 'CALENDAR_BOUNDARY_FAILED';end if;
 begin perform public.get_self_savings_join_context(199);raise exception 'MINIMUM_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_MINIMUM_200' then raise;end if;end;

 begin
  update public.affiliates set financial_employee_category_code=null where id=af;
  ctx:=public.get_self_savings_join_context();if ctx->>'reason'<>'CATEGORY_REQUIRED' then raise exception 'UNKNOWN_CATEGORY_ALLOWED';end if;
  raise exception 'REVERT_UNKNOWN_CATEGORY';
 exception when raise_exception then if sqlerrm<>'REVERT_UNKNOWN_CATEGORY' then raise;end if;end;
 begin
  insert into public.savings_action_availability(action_code,scope_type,enabled,reason,configured_by_auth_user_id,effective_from) values('JOIN','GLOBAL',false,'Rollback intake check',actor,now());
  ctx:=public.get_self_savings_join_context();if ctx->>'reason'<>'INTAKE_CLOSED' then raise exception 'CLOSED_CONTEXT_ALLOWED';end if;
  begin perform public.submit_self_savings_join(500,af,'',extensions.gen_random_uuid());raise exception 'CLOSED_WRITE_ALLOWED';exception when insufficient_privilege then null;end;
  raise exception 'REVERT_CLOSED_INTAKE';
 exception when raise_exception then if sqlerrm<>'REVERT_CLOSED_INTAKE' then raise;end if;end;
 idem:=extensions.gen_random_uuid();
 req:=public.submit_self_savings_join(500,af,'',idem);
 if req->>'status'<>'SUBMITTED' or req->>'actor_real_auth_user_id'<>actor::text or req->>'usuario_contexto_affiliate_id'<>af::text or req->>'submitted_at' is null then raise exception 'REGISTER_IDENTITY_TIME_FAILED';end if;
 if public.submit_self_savings_join(500,af,'',idem)->>'id'<>req->>'id' then raise exception 'RETRY_DUPLICATED';end if;
 begin perform public.submit_self_savings_join(600,af,'',idem);raise exception 'CHANGED_RETRY_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform public.submit_self_savings_join(500,af,'',extensions.gen_random_uuid());raise exception 'DUPLICATE_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_PENDING_REQUEST_EXISTS' then raise;end if;end;
 ctx:=public.get_self_savings_join_context();
 if ctx->>'reason'<>'REQUEST_PENDING' or ctx->'request'->>'id'<>req->>'id' or jsonb_array_length(ctx->'upcoming')<>24 then raise exception 'PENDING_CONTEXT_FAILED';end if;
 -- Public balance reader must remain usable and preserve PRIVATE policy.
 perform public.get_self_savings_live_readonly();
 foreach cat in array array['CHANGE_AMOUNT','WITHDRAW','TERMINATE'] loop
  begin perform public.submit_self_savings_request(cat,100,null,null,500,true,null,'',null,extensions.gen_random_uuid());raise exception 'PRIVATE_ACTION_ALLOWED';exception when sqlstate '55000' then null;end;
 end loop;
 perform set_config('savings.test_affiliate',other_af::text,true);
 ctx:=public.get_self_savings_join_context();if ctx->'request'->>'id'=req->>'id' then raise exception 'CROSS_USER_READ';end if;
 begin perform public.submit_self_savings_join(500,af,'',extensions.gen_random_uuid());raise exception 'CROSS_USER_WRITE';exception when insufficient_privilege then null;end;
 perform set_config('savings.test_affiliate',af::text,true);
 ctx:=public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',req->>'id','decision','APPROVE','observation',''),extensions.gen_random_uuid());
 plan:=(ctx->>'enrollment_id')::uuid;
 if not exists(select 1 from public.savings_contribution_plans where enrollment_id=plan and amount=500) then raise exception 'APPROVAL_PLAN_MISSING';end if;
 ctx:=public.get_self_savings_join_context();if ctx->>'reason'<>'ALREADY_SAVING' or jsonb_array_length(ctx->'upcoming')<>24 then raise exception 'APPROVED_SCHEDULE_MISSING';end if;
 if exists(select 1 from public.savings_transactions where participant_id=(req->>'participant_id')::uuid) then raise exception 'PROJECTED_MONEY_CREATED';end if;
 if (select mode from public.savings_publication_state where id)<>'PRIVATE' then raise exception 'PUBLISHED_ACCIDENTALLY';end if;
 if has_function_privilege('anon','public.get_self_savings_join_context(numeric)','execute') or has_function_privilege('authenticated','public.savings_runtime_submit(uuid,jsonb,uuid,boolean)','execute') then raise exception 'GRANTS_FAILED';end if;
end $test$;
`;
async function main(){
 const before=await query("select (select count(*) from public.savings_requests) requests,(select count(*) from public.savings_transactions) transactions,(select count(*) from public.savings_participants) participants");
 const installed=(await query("select to_regprocedure('public.get_self_savings_join_context(numeric)') is not null installed"))[0].installed;
 await query('begin;'+(installed?'':body(migration))+checks+'rollback;');
 await query('begin;'+(installed?'':body(migration))+body('supabase/recovery/20260914000100_savings_self_join_recovery.sql')+'rollback;');
 assert.deepEqual(await query("select (select count(*) from public.savings_requests) requests,(select count(*) from public.savings_transactions) transactions,(select count(*) from public.savings_participants) participants"),before);
 console.log('PASS private JOIN, six categories, 30-day calendar, dates/amounts, repeat/conflict, pending/approved projections, other actions blocked, exact context isolation, no cash/publication, recovery; all fixtures ROLLBACK');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={checks,main};
