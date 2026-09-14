begin;

-- Requires the scoped 20260906000100 operations migration. No legacy backfill.
do $$ begin
 if to_regprocedure('public.savings_next_contribution_date(date,text)') is null then
   raise exception 'SAVINGS_OPERATIONS_MIGRATION_REQUIRED';
 end if;
end $$;

create table public.savings_retirement_migration_backup(signature text primary key,definition text not null);
alter table public.savings_retirement_migration_backup enable row level security;
alter table public.savings_retirement_migration_backup force row level security;
revoke all on public.savings_retirement_migration_backup from public,anon,authenticated,service_role;
grant select on public.savings_retirement_migration_backup to service_role;
insert into public.savings_retirement_migration_backup
select oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc
where pronamespace='public'::regnamespace and proname in ('admin_review_savings_process_change','get_self_savings_live_readonly','admin_authorize_savings_date');
insert into public.savings_retirement_migration_backup select '__audit_count__',count(*)::text from public.savings_audit_events;
alter table public.savings_process_change_events add column conversion_snapshot jsonb null;

create function public.preview_savings_process_transition(p_event_id uuid,p_effective_from date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ev public.savings_process_change_events%rowtype; en public.savings_enrollments%rowtype;
 plan public.savings_contribution_plans%rowtype; next_amount numeric; last_date date;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 select * into ev from public.savings_process_change_events where id=p_event_id;
 if not found or ev.status<>'SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED' then raise exception 'SAVINGS_PROCESS_CHANGE_NOT_PENDING'; end if;
 if p_effective_from is null or p_effective_from<=public.savings_operation_today() then raise exception 'SAVINGS_PROCESS_FUTURE_DATE_REQUIRED'; end if;
 if not exists(select 1 from public.savings_participants where id=ev.participant_id and identity_status='RESOLVED' and certification_status='CERTIFIED' and data_classification='CANONICAL') then raise exception 'SAVINGS_ACCOUNT_CERTIFICATION_REQUIRED'; end if;
 select * into en from public.savings_enrollments where participant_id=ev.participant_id and status='ACTIVE' order by sequence_number desc limit 1;
 if not found or en.data_classification<>'CANONICAL' then raise exception 'SAVINGS_ACTIVE_CERTIFIED_ENROLLMENT_REQUIRED'; end if;
 -- Never silently discard an already accepted future amount/process plan.
 if exists(select 1 from public.savings_contribution_plans where enrollment_id=en.id and effective_from>=p_effective_from) then raise exception 'SAVINGS_FUTURE_PLAN_REVIEW_REQUIRED'; end if;
 select * into plan from public.savings_contribution_plans where enrollment_id=en.id and effective_from<p_effective_from
   and (effective_to is null or effective_to>=p_effective_from) order by effective_from desc limit 1;
 if not found or plan.data_classification<>'CANONICAL' then raise exception 'SAVINGS_ACTIVE_PLAN_REQUIRED'; end if;
 if ev.new_process=plan.process_snapshot then raise exception 'SAVINGS_PROCESS_ALREADY_EFFECTIVE'; end if;
 if plan.process_snapshot='JUB' then raise exception 'SAVINGS_REVERSE_FREQUENCY_RULE_REQUIRED'; end if;
 if ev.new_process not in ('JUB','PROCESS_1','PROCESS_3') or plan.process_snapshot not in ('PROCESS_1','PROCESS_3') then raise exception 'SAVINGS_PROCESS_CONVERSION_UNSUPPORTED'; end if;
 if exists(select 1 from public.savings_transactions where enrollment_id=en.id and coalesce(contribution_date,effective_date)>=p_effective_from)
   or exists(select 1 from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date>=p_effective_from) then raise exception 'SAVINGS_DATE_HAS_RECORDED_MOVEMENTS'; end if;
 next_amount:=case when ev.new_process='JUB' then plan.amount*2 else plan.amount end;
 select max(contribution_date) into last_date from public.generate_savings_schedule(en.id,p_effective_from-45,p_effective_from-1);
 return jsonb_build_object('event_id',ev.id,'participant_id',ev.participant_id,'enrollment_id',en.id,
   'previous_plan_id',plan.id,'previous_amount',plan.amount,'new_amount',next_amount,
   'previous_process',plan.process_snapshot,'new_process',ev.new_process,
   'previous_frequency','TWICE_MONTHLY','new_frequency',case when ev.new_process='JUB' then 'MONTHLY' else 'TWICE_MONTHLY' end,
   'effective_from',p_effective_from,'first_discount_on',public.savings_next_contribution_date(p_effective_from,ev.new_process),
   'last_previous_discount_on',last_date,'conversion_rule',case when ev.new_process='JUB' then 'TWO_FORTNIGHTS_TO_ONE_MONTH' else 'SAME_FREQUENCY' end,
   'plan_fingerprint',md5(to_jsonb(plan)::text||en.id::text||ev.new_process||p_effective_from::text));
end $$;

create or replace function public.admin_review_savings_process_change(p_event_id uuid,p_decision text,p_effective_from date,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.savings_process_change_events%rowtype; participant uuid; enrollment uuid; new_plan uuid; preview jsonb; before_event jsonb;
 decision text:=upper(coalesce(p_decision,'')); review_reason_value text:=btrim(coalesce(p_reason,''));
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 if decision not in ('APPLY','DISMISS') or length(review_reason_value) not between 3 and 1000 then raise exception 'SAVINGS_PROCESS_REVIEW_INVALID'; end if;
 select participant_id into participant from public.savings_process_change_events where id=p_event_id;
 if participant is null then raise exception 'SAVINGS_PROCESS_CHANGE_NOT_PENDING'; end if;
 perform 1 from public.savings_participants where id=participant for update;
 select * into ev from public.savings_process_change_events where id=p_event_id for update;
 if ev.status in ('APPLIED','DISMISSED') then
   if ev.conversion_snapshot->>'review_decision'=decision and ev.conversion_snapshot->>'review_reason'=review_reason_value
     and (decision='DISMISS' or ev.effective_from=p_effective_from) then return to_jsonb(ev); end if;
   raise exception 'SAVINGS_PROCESS_CHANGE_ALREADY_REVIEWED';
 end if;
 if ev.status<>'SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED' then raise exception 'SAVINGS_PROCESS_CHANGE_NOT_PENDING'; end if;
 before_event:=to_jsonb(ev);
 if decision='APPLY' then
   select id into enrollment from public.savings_enrollments where participant_id=participant and status='ACTIVE' order by sequence_number desc limit 1 for update;
   perform 1 from public.savings_contribution_plans where enrollment_id=enrollment for update;
   preview:=public.preview_savings_process_transition(p_event_id,p_effective_from);
   update public.savings_contribution_plans set effective_to=p_effective_from-1 where id=(preview->>'previous_plan_id')::uuid;
   insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,data_classification,created_by_auth_user_id)
   values(enrollment,(preview->>'new_amount')::numeric,ev.new_process,p_effective_from,'CANONICAL',auth.uid()) returning id into new_plan;
   preview:=preview||jsonb_build_object('new_plan_id',new_plan);
 else preview:='{}'::jsonb; end if;
 update public.savings_process_change_events set status=case when decision='APPLY' then 'APPLIED' else 'DISMISSED' end,
   effective_from=case when decision='APPLY' then p_effective_from else null end,
   reviewed_by_auth_user_id=auth.uid(),reviewed_at=clock_timestamp(),
   conversion_snapshot=preview||jsonb_build_object('review_decision',decision,'review_reason',review_reason_value)
 where id=p_event_id returning * into ev;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason)
 values(auth.uid(),public.get_effective_affiliate_id(),participant,'savings_process_change_events',decision,p_event_id::text,before_event,to_jsonb(ev),review_reason_value);
 return to_jsonb(ev);
end $$;

create function public.admin_confirm_savings_process_transition(p_event_id uuid,p_effective_from date,p_reason text,p_plan_fingerprint text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old jsonb; preview jsonb; result jsonb; participant uuid; enrollment uuid;
 command jsonb:=jsonb_build_object('event_id',p_event_id,'effective_from',p_effective_from,'reason',p_reason,'plan_fingerprint',p_plan_fingerprint);
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 if p_client_action_id is null or p_plan_fingerprint is null then raise exception 'SAVINGS_PREVIEW_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-confirm:'||p_client_action_id,0));
 select after_data into old from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
   if old->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
   return old->'result';
 end if;
 select participant_id into participant from public.savings_process_change_events where id=p_event_id;
 perform 1 from public.savings_participants where id=participant for update;
 perform 1 from public.savings_process_change_events where id=p_event_id for update;
 select id into enrollment from public.savings_enrollments where participant_id=participant and status='ACTIVE' order by sequence_number desc limit 1 for update;
 perform 1 from public.savings_contribution_plans where enrollment_id=enrollment for update;
 preview:=public.preview_savings_process_transition(p_event_id,p_effective_from);
 if preview->>'plan_fingerprint' is distinct from p_plan_fingerprint then raise exception 'SAVINGS_PREVIEW_STALE'; end if;
 result:=public.admin_review_savings_process_change(p_event_id,'APPLY',p_effective_from,p_reason);
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),participant,'savings_retirement','CONFIRM',p_event_id::text,jsonb_build_object('command',command,'result',result),btrim(p_reason),p_client_action_id);
 return result;
end $$;

-- Private projection. Identity is derived again rather than trusting a UI target.
-- An amount-request date exception must not silently move an approved category
-- transition and leave its conversion evidence at a different effective date.
alter function public.admin_authorize_savings_date(uuid,date,text,uuid) rename to savings_date_before_retirement;
revoke all on function public.savings_date_before_retirement(uuid,date,text,uuid) from public,anon,authenticated,service_role;
create function public.admin_authorize_savings_date(p_plan_id uuid,p_authorized_date date,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 if exists(select 1 from public.savings_process_change_events where status='APPLIED' and conversion_snapshot->>'new_plan_id'=p_plan_id::text) then
   raise exception 'SAVINGS_APPROVED_CATEGORY_DATE_PROTECTED';
 end if;
 return public.savings_date_before_retirement(p_plan_id,p_authorized_date,p_reason,p_client_action_id);
end $$;
revoke all on function public.admin_authorize_savings_date(uuid,date,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_authorize_savings_date(uuid,date,text,uuid) to authenticated;

create function public.savings_self_process_transition()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare participant uuid; en public.savings_enrollments%rowtype; ev public.savings_process_change_events%rowtype;
 plan public.savings_contribution_plans%rowtype; result jsonb:='{}'::jsonb;
begin
 if auth.uid() is null or public.get_effective_affiliate_id() is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501'; end if;
 select id into participant from public.savings_participants where affiliate_id=public.get_effective_affiliate_id()
   and identity_status='RESOLVED' and certification_status='CERTIFIED' and data_classification='CANONICAL';
 if participant is null then return result; end if;
 select * into en from public.savings_enrollments where participant_id=participant and status='ACTIVE' order by sequence_number desc limit 1;
 if not found or en.data_classification<>'CANONICAL' then return result; end if;
 select * into ev from public.savings_process_change_events where participant_id=participant and status='APPLIED'
   and conversion_snapshot->>'enrollment_id'=en.id::text and conversion_snapshot->>'conversion_rule'='TWO_FORTNIGHTS_TO_ONE_MONTH'
   order by effective_from desc,reviewed_at desc limit 1;
 if not found then return result; end if;
 select * into plan from public.savings_contribution_plans where enrollment_id=en.id and effective_from<=public.savings_operation_today()
   and (effective_to is null or effective_to>=public.savings_operation_today()) order by effective_from desc limit 1;
 if found then result:=jsonb_build_object('current_plan',jsonb_build_object('amount',plan.amount,'frequency',case when plan.process_snapshot='JUB' then 'MONTHLY' else 'TWICE_MONTHLY' end,'effective_from',plan.effective_from,'source','CERTIFIED_SAVINGS_PLAN')); end if;
 if ev.effective_from>public.savings_operation_today() or plan.id=(ev.conversion_snapshot->>'new_plan_id')::uuid then
   result:=result||jsonb_build_object('notice',jsonb_build_object('event_id',ev.id,'previous_amount',ev.conversion_snapshot->'previous_amount','new_amount',ev.conversion_snapshot->'new_amount',
     'effective_from',ev.effective_from,'first_discount_on',ev.conversion_snapshot->'first_discount_on',
     'status',case when ev.effective_from>public.savings_operation_today() then 'SCHEDULED' else 'ACTIVE' end));
 end if;
 return result;
end $$;

alter function public.get_self_savings_live_readonly() rename to savings_self_before_retirement;
revoke all on function public.savings_self_before_retirement() from public,anon,authenticated,service_role;
create function public.get_self_savings_live_readonly()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; transition jsonb;
begin
 result:=public.savings_self_before_retirement();
 if result->'participant' is null or result->'participant'='null'::jsonb then return result; end if;
 transition:=public.savings_self_process_transition();
 if transition='{}'::jsonb then return result; end if;
 if transition->'current_plan' is not null and jsonb_typeof(result->'enrollment')='object' then
   result:=jsonb_set(result,'{enrollment}',(result->'enrollment')||jsonb_build_object('current_contribution_amount',transition#>'{current_plan,amount}',
     'frequency',transition#>'{current_plan,frequency}','plan_effective_from',transition#>'{current_plan,effective_from}','plan_source','CERTIFIED_SAVINGS_PLAN'));
 end if;
 -- Preserve Q, annual, history and write capabilities exactly as the original reader.
 return result||jsonb_build_object('retirement_transition',transition->'notice');
end $$;

revoke all on function public.preview_savings_process_transition(uuid,date),public.admin_confirm_savings_process_transition(uuid,date,text,text,uuid),public.savings_self_process_transition(),public.get_self_savings_live_readonly() from public,anon,authenticated,service_role;
grant execute on function public.preview_savings_process_transition(uuid,date),public.admin_confirm_savings_process_transition(uuid,date,text,text,uuid),public.get_self_savings_live_readonly() to authenticated;
commit;
