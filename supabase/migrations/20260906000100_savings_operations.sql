begin;

-- Owner-authorized operational controls. No legacy backfill or authority cutover.
create table public.savings_operation_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_mode text not null check (entry_mode in ('ALL_YEAR','WINDOWS')),
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  actor_real_auth_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  client_action_id uuid not null unique
);
create table public.savings_withdrawal_openings (
  id uuid primary key default extensions.gen_random_uuid(),
  availability_id uuid not null unique references public.savings_action_availability(id),
  yield_period_id uuid not null references public.savings_yield_periods(id),
  cutoff_on date not null,
  percentage numeric(9,6) not null check (percentage>=0 and percentage<=100),
  opening_kind text not null check (opening_kind in ('ORDINARY','EARLY','EXCEPTION')),
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  actor_real_auth_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  client_action_id uuid not null unique
);
create table public.savings_date_authorizations (
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.savings_participants(id),
  enrollment_id uuid not null references public.savings_enrollments(id),
  plan_id uuid not null references public.savings_contribution_plans(id),
  calculated_date date not null,
  previous_date date not null,
  authorized_date date not null,
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  actor_real_auth_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  client_action_id uuid not null unique
);
create table public.savings_operations_migration_backup (
  signature text primary key, definition text not null
);
insert into public.savings_operations_migration_backup
select p.oid::regprocedure::text,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('savings_effective_action','generate_savings_schedule','materialize_savings_contributions','admin_set_savings_action',
  'submit_self_savings_request','admin_review_savings_request','admin_settle_savings_request');
insert into public.savings_operations_migration_backup(signature,definition)
select '__audit_count__',count(*)::text from public.savings_audit_events;

do $$ declare t text; begin
  foreach t in array array['savings_operation_settings','savings_withdrawal_openings','savings_date_authorizations','savings_operations_migration_backup'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to service_role',t);
  end loop;
end $$;

create function public.savings_operation_today()
returns date language sql stable set search_path='' as $$ select (now() at time zone 'America/Hermosillo')::date $$;

create function public.savings_next_contribution_date(p_from date,p_process text)
returns date language plpgsql immutable set search_path='' as $$
declare d date;
begin
 if p_from is null or p_process is null or p_process not in ('JUB','PROCESS_1','PROCESS_3') then
   raise exception 'SAVINGS_CALENDAR_INPUT_INVALID' using errcode='22023';
 end if;
 for i in 0..35 loop
   d:=p_from+i;
   if (p_process='JUB' and extract(day from d)=5)
     or (p_process<>'JUB' and (extract(day from d)=15 or
       (extract(month from d)=2 and extract(day from d)=28) or
       (extract(month from d)<>2 and extract(day from d)=30))) then return d; end if;
 end loop;
 raise exception 'SAVINGS_CALENDAR_DATE_NOT_FOUND';
end $$;

create or replace function public.generate_savings_schedule(p_enrollment_id uuid,p_from date,p_to date)
returns table(contribution_date date,expected_amount numeric,process_snapshot text,plan_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_from is null or p_to is null or p_to<p_from or p_to>p_from+3660 then
   raise exception 'SAVINGS_PROJECTION_RANGE_INVALID' using errcode='22023';
 end if;
 return query
 select d.day::date,p.amount,p.process_snapshot,p.id
 from public.savings_enrollments e
 cross join lateral generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)
 join lateral (
   select cp.* from public.savings_contribution_plans cp
   where cp.enrollment_id=e.id and cp.effective_from<=d.day::date
     and (cp.effective_to is null or cp.effective_to>=d.day::date)
   order by cp.effective_from desc limit 1
 ) p on true
 where e.id=p_enrollment_id and d.day::date>=e.first_expected_contribution_date
   and (e.terminated_at is null or d.day::date<(e.terminated_at at time zone 'America/Hermosillo')::date)
   and public.savings_next_contribution_date(d.day::date,p.process_snapshot)=d.day::date
 order by d.day;
end $$;

-- Latest instruction wins, even after expiry: an old enable must never revive.
create function public.savings_next_enrollment_date(p_enrollment_id uuid,p_from date)
returns date language plpgsql stable security definer set search_path='' as $$
declare result date;
begin
 select min(contribution_date) into result from public.generate_savings_schedule(p_enrollment_id,p_from,p_from+70);
 if result is null then raise exception 'SAVINGS_FUTURE_SCHEDULE_REQUIRED'; end if;
 return result;
end $$;
revoke all on function public.savings_next_enrollment_date(uuid,date) from public,anon,authenticated,service_role;

create or replace function public.savings_effective_action(p_action_code text,p_participant_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare a public.savings_action_availability%rowtype; mode text;
begin
 select * into a from public.savings_action_availability
 where action_code=p_action_code and scope_type='PARTICIPANT' and participant_id=p_participant_id
   and effective_from<=now() order by effective_from desc,created_at desc,id desc limit 1;
 if found and (a.effective_to is null or now()<a.effective_to) then return a.enabled; end if;
 select * into a from public.savings_action_availability
 where action_code=p_action_code and scope_type='GLOBAL' and effective_from<=now()
 order by effective_from desc,created_at desc,id desc limit 1;
 if found then return a.enabled and (a.effective_to is null or now()<a.effective_to); end if;
 if p_action_code='JOIN' then
   select entry_mode into mode from public.savings_operation_settings order by created_at desc,id desc limit 1;
   return coalesce(mode,'ALL_YEAR')='ALL_YEAR';
 end if;
 return false;
end $$;

create function public.admin_configure_savings_operation(p_command jsonb,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare kind text:=p_command->>'kind'; result jsonb; previous jsonb; a uuid; y uuid;
  starts timestamptz; ends timestamptz; scope text; participant uuid; reason text;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.config') then raise exception 'SAVINGS_CONFIG_DENIED' using errcode='42501'; end if;
 if p_client_action_id is null or jsonb_typeof(p_command) is distinct from 'object' then raise exception 'SAVINGS_COMMAND_INVALID' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 select after_data into previous from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
   if previous->'command' is distinct from p_command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
   return previous;
 end if;
 reason:=btrim(coalesce(p_command->>'reason',''));
 if length(reason) not between 3 and 1000 then raise exception 'SAVINGS_REASON_REQUIRED' using errcode='22023'; end if;
 if kind='ENTRY_MODE' then
   insert into public.savings_operation_settings(entry_mode,reason,actor_real_auth_user_id,client_action_id)
   values(p_command->>'mode',reason,auth.uid(),p_client_action_id);
   -- Explicit mode switch closes the previous global window without cancelling requests.
   insert into public.savings_action_availability(action_code,scope_type,enabled,reason,configured_by_auth_user_id,created_at)
   values('JOIN','GLOBAL',(p_command->>'mode')='ALL_YEAR',reason,auth.uid(),clock_timestamp());
 elsif kind in ('AVAILABILITY','OPEN_WITHDRAWALS') then
   starts:=coalesce(nullif(p_command->>'starts_at','')::timestamptz,now());
   ends:=nullif(p_command->>'ends_at','')::timestamptz;
   scope:=coalesce(p_command->>'scope','GLOBAL');
   participant:=nullif(p_command->>'participant_id','')::uuid;
   if (ends is not null and (ends<=starts or ends<=now())) or starts<now()-interval '5 minutes' then raise exception 'SAVINGS_WINDOW_INVALID' using errcode='22023'; end if;
   if kind='OPEN_WITHDRAWALS' and (ends is null or nullif(p_command->>'cutoff_on','') is null) then raise exception 'SAVINGS_OPENING_DATES_REQUIRED'; end if;
   if kind='OPEN_WITHDRAWALS' and p_command->>'opening_kind'='ORDINARY' and extract(month from starts at time zone 'America/Hermosillo') not in (1,7) then raise exception 'SAVINGS_EARLY_OPENING_REASON_REQUIRED'; end if;
   if kind='OPEN_WITHDRAWALS' and p_command->>'opening_kind'='EXCEPTION' and scope<>'PARTICIPANT' then raise exception 'SAVINGS_EXCEPTION_PARTICIPANT_REQUIRED'; end if;
   if kind='AVAILABILITY' and (p_command->>'action' not in ('JOIN','CHANGE_AMOUNT','WITHDRAW','TERMINATE') or (p_command->>'action'='WITHDRAW' and (p_command->>'enabled')::boolean)) then raise exception 'SAVINGS_USE_OPENING_WITH_RATE'; end if;
   insert into public.savings_action_availability(action_code,scope_type,participant_id,enabled,reason,effective_from,effective_to,configured_by_auth_user_id,created_at)
   values(case when kind='OPEN_WITHDRAWALS' then 'WITHDRAW' else p_command->>'action' end,scope,participant,
     case when kind='OPEN_WITHDRAWALS' then true else (p_command->>'enabled')::boolean end,reason,starts,ends,auth.uid(),clock_timestamp()) returning id into a;
   if kind='OPEN_WITHDRAWALS' then
     select id into y from public.savings_yield_periods where id=(p_command->>'yield_period_id')::uuid for update;
     if y is null then raise exception 'SAVINGS_PERIOD_REQUIRED'; end if;
     if (p_command->>'cutoff_on')::date>(starts at time zone 'America/Hermosillo')::date then raise exception 'SAVINGS_CUTOFF_AFTER_OPENING'; end if;
     if exists(select 1 from public.savings_withdrawal_openings o where o.yield_period_id=y and o.percentage<>(p_command->>'percentage')::numeric) then raise exception 'SAVINGS_PERIOD_RATE_FROZEN'; end if;
     insert into public.savings_withdrawal_openings(availability_id,yield_period_id,cutoff_on,percentage,opening_kind,reason,actor_real_auth_user_id,client_action_id)
     values(a,y,(p_command->>'cutoff_on')::date,(p_command->>'percentage')::numeric,p_command->>'opening_kind',reason,auth.uid(),p_client_action_id);
   end if;
 else raise exception 'SAVINGS_COMMAND_UNKNOWN' using errcode='22023'; end if;
 result:=jsonb_build_object('command',p_command,'availability_id',a,'recorded_at',clock_timestamp());
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,resource,action,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),'savings_operations',kind,result,reason,p_client_action_id);
 return result;
end $$;

create or replace function public.admin_set_savings_action(p_action_code text,p_enabled boolean,p_scope_type text,p_participant_id uuid,p_reason text,p_effective_from timestamptz,p_effective_to timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.admin_configure_savings_operation(jsonb_build_object('kind','AVAILABILITY','action',upper(p_action_code),'enabled',p_enabled,'scope',upper(p_scope_type),'participant_id',p_participant_id,'reason',p_reason,'starts_at',p_effective_from,'ends_at',p_effective_to),extensions.gen_random_uuid());
 return (result->>'availability_id')::uuid;
end $$;

create function public.admin_authorize_savings_date(p_plan_id uuid,p_authorized_date date,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plan public.savings_contribution_plans%rowtype; enrollment public.savings_enrollments%rowtype;
 old jsonb; calculated date; requested date; result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 if p_client_action_id is null or length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'SAVINGS_REASON_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-date:'||p_client_action_id,0));
 select to_jsonb(d) into old from public.savings_date_authorizations d where client_action_id=p_client_action_id;
 if found then
   if old->>'plan_id' is distinct from p_plan_id::text or old->>'authorized_date' is distinct from p_authorized_date::text or old->>'reason' is distinct from btrim(p_reason) then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
   return old;
 end if;
 select e.* into enrollment from public.savings_enrollments e join public.savings_contribution_plans p on p.enrollment_id=e.id where p.id=p_plan_id for update of e;
 if not found then raise exception 'SAVINGS_PLAN_REQUIRED'; end if;
 select * into plan from public.savings_contribution_plans where id=p_plan_id for update;
 if p_authorized_date is null or p_authorized_date<=public.savings_operation_today() or
    public.savings_next_contribution_date(p_authorized_date,plan.process_snapshot)<>p_authorized_date then raise exception 'SAVINGS_AUTHORIZED_DATE_INVALID'; end if;
 if exists(select 1 from public.savings_transactions where enrollment_id=enrollment.id and
    coalesce(contribution_date,effective_date)>=least(plan.effective_from,p_authorized_date)) then raise exception 'SAVINGS_DATE_HAS_RECORDED_MOVEMENTS'; end if;
 if exists(select 1 from public.savings_contribution_plans where enrollment_id=enrollment.id and id<>plan.id and effective_from>=least(plan.effective_from,p_authorized_date)) then raise exception 'SAVINGS_DATE_CONFLICTS_WITH_PLAN'; end if;
 select (submitted_at at time zone 'America/Hermosillo')::date into requested from public.savings_requests where id=plan.source_request_id;
 requested:=coalesce(requested,(coalesce(enrollment.requested_at,enrollment.enrollment_started_at) at time zone 'America/Hermosillo')::date);
 calculated:=public.savings_next_contribution_date(requested+30,plan.process_snapshot);
 insert into public.savings_date_authorizations(participant_id,enrollment_id,plan_id,calculated_date,previous_date,authorized_date,reason,actor_real_auth_user_id,client_action_id)
 values(enrollment.participant_id,enrollment.id,plan.id,calculated,plan.effective_from,p_authorized_date,btrim(p_reason),auth.uid(),p_client_action_id) returning to_jsonb(savings_date_authorizations.*) into result;
 update public.savings_contribution_plans set effective_to=p_authorized_date-1 where enrollment_id=enrollment.id and effective_to=plan.effective_from-1 and id<>plan.id;
 update public.savings_contribution_plans set effective_from=p_authorized_date where id=plan.id;
 if enrollment.first_expected_contribution_date=plan.effective_from then update public.savings_enrollments set first_expected_contribution_date=p_authorized_date where id=enrollment.id; end if;
 if plan.source_request_id is not null then update public.savings_requests set effective_from=p_authorized_date where id=plan.source_request_id; end if;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,before_data,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),enrollment.participant_id,'savings_operations','AUTHORIZE_DATE',to_jsonb(plan),result,btrim(p_reason),p_client_action_id);
 return result;
end $$;

create function public.get_admin_savings_operations(p_participant_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
 return jsonb_build_object(
   'entry_mode',coalesce((select entry_mode from public.savings_operation_settings order by created_at desc,id desc limit 1),'ALL_YEAR'),
   'effective',jsonb_build_object('JOIN',public.savings_effective_action('JOIN',p_participant_id),'WITHDRAW',public.savings_effective_action('WITHDRAW',p_participant_id),'CHANGE_AMOUNT',public.savings_effective_action('CHANGE_AMOUNT',p_participant_id),'TERMINATE',public.savings_effective_action('TERMINATE',p_participant_id)),
   'availability',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.savings_action_availability a where a.scope_type='GLOBAL' or a.participant_id=p_participant_id),'[]'::jsonb),
   'openings',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('starts_at',a.effective_from,'ends_at',a.effective_to,'scope',a.scope_type) order by o.created_at desc) from public.savings_withdrawal_openings o join public.savings_action_availability a on a.id=o.availability_id where a.scope_type='GLOBAL' or a.participant_id=p_participant_id),'[]'::jsonb),
   'plans',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('legacy_folio',s.legacy_folio) order by p.effective_from desc) from public.savings_contribution_plans p join public.savings_enrollments e on e.id=p.enrollment_id join public.savings_participants s on s.id=e.participant_id where e.participant_id=p_participant_id),'[]'::jsonb),
   'date_authorizations',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.savings_date_authorizations d where p_participant_id is null or d.participant_id=p_participant_id),'[]'::jsonb),
   'payments',coalesce((select jsonb_agg(jsonb_build_object('request_id',r.id,'folio',r.folio,'legacy_folio',p.legacy_folio,'paid_at',r.settled_at,'capital_paid',r.requested_capital_amount,'yield_paid',r.requested_yield_amount,'total_paid',coalesce(r.requested_capital_amount,0)+coalesce(r.requested_yield_amount,0)) order by r.settled_at desc) from public.savings_requests r join public.savings_participants p on p.id=r.participant_id where r.status='SETTLED' and (p_participant_id is null or r.participant_id=p_participant_id)),'[]'::jsonb),
   'debt_verification','AUTHORITATIVE_READER_REQUIRED',
   'historical_certification_pending',(select count(*) from public.savings_participants where certification_status<>'CERTIFIED'),
   'server_time',clock_timestamp());
end $$;

-- Financial guards: projections never become receipts. Historic accounts are not
-- certified by configuration or by merely reading the mirror.
create or replace function public.materialize_savings_contributions(p_as_of date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'SAVINGS_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 raise exception 'SAVINGS_ACTUAL_RECEIPT_REQUIRED' using errcode='55000',hint='Expected schedule is not evidence of a received deduction. Use audited confirmed receipts.';
end $$;

alter function public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid) rename to savings_submit_before_20260906;
alter function public.admin_review_savings_request(uuid,text,text,date,date,text) rename to savings_review_before_20260906;
alter function public.admin_settle_savings_request(uuid,numeric,numeric,text,uuid) rename to savings_settle_before_20260906;
revoke all on function public.savings_submit_before_20260906(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid),public.savings_review_before_20260906(uuid,text,text,date,date,text),public.savings_settle_before_20260906(uuid,numeric,numeric,text,uuid) from public,anon,authenticated,service_role;

create function public.submit_self_savings_request(p_request_type text,p_amount numeric,p_component text,p_withdrawal_kind text,p_new_contribution_amount numeric,p_continue_saving boolean,p_effective_from date,p_reason text,p_supporting_document_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare participant public.savings_participants%rowtype; process text; effective date; enrollment uuid; result jsonb;
begin
 if auth.uid() is null or public.get_effective_affiliate_id() is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501'; end if;
 select * into participant from public.savings_participants where affiliate_id=public.get_effective_affiliate_id() for update;
 if not found or participant.certification_status<>'CERTIFIED' or participant.data_classification<>'CANONICAL' then raise exception 'SAVINGS_ACCOUNT_CERTIFICATION_REQUIRED' using errcode='55000'; end if;
 if upper(p_request_type) in ('JOIN','CHANGE_AMOUNT') and (p_new_contribution_amount is null or p_new_contribution_amount<200) then raise exception 'SAVINGS_MINIMUM_200' using errcode='22023'; end if;
 if upper(p_request_type) in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL','TERMINATE') then
   -- No loan balance authority is deployed: never assume a missing balance is zero.
   raise exception 'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE' using errcode='55000';
 end if;
 select id,process_snapshot into enrollment,process from public.savings_enrollments where participant_id=participant.id order by sequence_number desc limit 1;
 process:=coalesce(process,participant.current_process);
 effective:=case when upper(p_request_type)='CHANGE_AMOUNT' then public.savings_next_enrollment_date(enrollment,public.savings_operation_today()+30)
   when upper(p_request_type)='JOIN' then public.savings_next_contribution_date(public.savings_operation_today()+30,process) else p_effective_from end;
 result:=public.savings_submit_before_20260906(p_request_type,p_amount,p_component,p_withdrawal_kind,p_new_contribution_amount,p_continue_saving,effective,p_reason,p_supporting_document_id,p_idempotency_key);
 return result;
end $$;

create function public.admin_review_savings_request(p_request_id uuid,p_decision text,p_reason text,p_effective_from date,p_first_expected_contribution_date date,p_process text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.savings_requests%rowtype; calculated date; effective date; process text;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 select * into r from public.savings_requests where id=p_request_id for update;
 if not found then raise exception 'SAVINGS_REQUEST_REQUIRED'; end if;
 if upper(p_decision)='APPROVE' then
   if not exists(select 1 from public.savings_participants where id=r.participant_id and certification_status='CERTIFIED' and data_classification='CANONICAL') then raise exception 'SAVINGS_ACCOUNT_CERTIFICATION_REQUIRED'; end if;
   if r.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL','TERMINATE') then raise exception 'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE'; end if;
   if r.request_type in ('JOIN','CHANGE_AMOUNT') then
     select process_snapshot into process from public.savings_enrollments where id=r.enrollment_id;
     process:=coalesce(process,p_process);
     calculated:=case when r.request_type='CHANGE_AMOUNT' then public.savings_next_enrollment_date(r.enrollment_id,(r.submitted_at at time zone 'America/Hermosillo')::date+30)
       else public.savings_next_contribution_date((r.submitted_at at time zone 'America/Hermosillo')::date+30,process) end;
     effective:=case when r.request_type='JOIN' then coalesce(p_first_expected_contribution_date,calculated) else coalesce(p_effective_from,calculated) end;
     if effective<=public.savings_operation_today() or
       (case when r.request_type='CHANGE_AMOUNT' then public.savings_next_enrollment_date(r.enrollment_id,effective) else public.savings_next_contribution_date(effective,process) end)<>effective then raise exception 'SAVINGS_AUTHORIZED_DATE_INVALID'; end if;
     if effective<>calculated and length(btrim(coalesce(p_reason,'')))<10 then raise exception 'SAVINGS_DATE_EXCEPTION_JUSTIFICATION_REQUIRED'; end if;
     update public.savings_requests set metadata=metadata||jsonb_build_object('calculated_date',calculated,'authorized_date',effective,'date_exception',effective<>calculated,'date_authorized_at',clock_timestamp(),'date_authorized_by',auth.uid(),'date_reason',p_reason) where id=r.id;
   end if;
 end if;
 return public.savings_review_before_20260906(p_request_id,p_decision,p_reason,coalesce(effective,p_effective_from),coalesce(effective,p_first_expected_contribution_date),p_process);
end $$;

create function public.admin_settle_savings_request(p_request_id uuid,p_capital_amount numeric,p_yield_amount numeric,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 raise exception 'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE' using errcode='55000';
end $$;

do $$ declare p record; begin
 for p in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in
 ('savings_operation_today','savings_next_contribution_date','admin_configure_savings_operation','admin_authorize_savings_date','get_admin_savings_operations','submit_self_savings_request','admin_review_savings_request','admin_settle_savings_request') loop
   execute format('revoke all on function %s from public,anon,authenticated',p.signature);
 end loop;
end $$;
grant execute on function public.admin_configure_savings_operation(jsonb,uuid),public.admin_authorize_savings_date(uuid,date,text,uuid),public.get_admin_savings_operations(uuid),public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid),public.admin_review_savings_request(uuid,text,text,date,date,text),public.admin_settle_savings_request(uuid,numeric,numeric,text,uuid) to authenticated;
commit;
