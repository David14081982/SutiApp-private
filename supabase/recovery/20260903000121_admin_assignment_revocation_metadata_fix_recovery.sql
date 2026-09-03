begin;

do $$
declare v_applied timestamptz;
begin
  select applied_at into v_applied
  from public.admin_assignment_metadata_fix_state_20260903000121 where singleton;
  if v_applied is null then raise exception 'RECOVERY_STATE_MISSING'; end if;
  if exists(
    select 1 from public.admin_audit_log
    where created_at>v_applied and resource='admin_assignments'
  ) then raise exception 'RECOVERY_BLOCKED_POST_MIGRATION_ACTIVITY'; end if;
end $$;

do $$
declare v_definition text;
begin
  select prior_function_definition into v_definition
  from public.admin_assignment_metadata_fix_state_20260903000121 where singleton;
  if v_definition is null then raise exception 'PRIOR_FUNCTION_DEFINITION_MISSING'; end if;
  execute v_definition;
end $$;

drop table public.admin_assignment_metadata_fix_state_20260903000121;
notify pgrst,'reload schema';
commit;
