begin;

-- Recovery is intentionally unavailable after any legitimate administrative or
-- self-service activity. Archive/restore history and document versions are never
-- erased to make a rollback appear clean.
do $$
declare
  v_state public.admin_affiliate_archive_migration_state_20260901000200%rowtype;
  v_counts jsonb;
begin
  select * into v_state
  from public.admin_affiliate_archive_migration_state_20260901000200
  where migration_key='20260901000200' for update;
  if v_state.migration_key is null then
    raise exception 'ARCHIVE_RECOVERY_STATE_MISSING' using errcode='P0001';
  end if;
  if exists(select 1 from public.affiliates where is_archived)
     or exists(select 1 from public.affiliate_admin_events where action in('ARCHIVE','RESTORE')) then
    raise exception 'ARCHIVE_RECOVERY_BLOCKED_BY_LIFECYCLE_ACTIVITY' using errcode='P0001';
  end if;
  select jsonb_build_object(
    'affiliates',(select count(*) from public.affiliates),
    'affiliate_admin_events',(select count(*) from public.affiliate_admin_events),
    'affiliate_documents',(select count(*) from public.affiliate_documents),
    'program_requests',(select count(*) from public.program_requests),
    'impersonation_sessions',(select count(*) from public.impersonation_sessions)
  ) into v_counts;
  if v_counts is distinct from v_state.baseline_counts then
    raise exception 'ARCHIVE_RECOVERY_BLOCKED_BY_POST_MIGRATION_ACTIVITY' using errcode='P0001';
  end if;
end $$;

drop trigger program_requests_guard_archived_affiliate on public.program_requests;
drop function public.guard_archived_affiliate_new_operation();
drop function public.archive_admin_affiliate(uuid,timestamptz,text);
drop function public.restore_admin_affiliate(uuid,timestamptz,text);
drop function public.list_admin_archived_affiliates(text,integer,integer,text);
drop function public.get_current_affiliate_access_state();

do $$
declare v_definition text;
begin
  for v_definition in
    select value from public.admin_affiliate_archive_migration_state_20260901000200 s,
      jsonb_each_text(s.prior_function_definitions)
    where s.migration_key='20260901000200'
  loop
    execute v_definition;
  end loop;
end $$;

do $$
declare v_name text;v_definition text;
begin
  select prior_event_constraint_name,prior_event_constraint_definition
    into v_name,v_definition
  from public.admin_affiliate_archive_migration_state_20260901000200
  where migration_key='20260901000200';
  alter table public.affiliate_admin_events
    drop constraint affiliate_admin_events_action_check;
  execute format('alter table public.affiliate_admin_events add constraint %I %s',v_name,v_definition);
end $$;

drop index public.affiliates_archive_roster_idx;
alter table public.affiliates
  drop constraint affiliates_archive_state_check,
  drop constraint affiliates_restore_state_check,
  drop column is_archived,
  drop column archived_at,
  drop column archived_by_auth_user_id,
  drop column archive_reason,
  drop column archive_previous_status_raw,
  drop column restored_at,
  drop column restored_by_auth_user_id,
  drop column restore_reason;

drop table public.admin_affiliate_archive_migration_state_20260901000200;

notify pgrst,'reload schema';
commit;
