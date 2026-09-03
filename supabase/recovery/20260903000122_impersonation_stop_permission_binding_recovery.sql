begin;

do $$
declare v_applied timestamptz;
begin
  select applied_at into v_applied from public.impersonation_stop_binding_state_20260903000122 where singleton;
  if v_applied is null then raise exception 'RECOVERY_STATE_MISSING'; end if;
  if exists(
    select 1 from public.identity_audit_log
    where created_at>v_applied and action='IMPERSONATION_STOPPED'
  ) then raise exception 'RECOVERY_BLOCKED_POST_MIGRATION_ACTIVITY'; end if;
end $$;

do $$
declare v_definition text;
begin
  select prior_function_definition into v_definition
  from public.impersonation_stop_binding_state_20260903000122 where singleton;
  if v_definition is null then raise exception 'PRIOR_FUNCTION_DEFINITION_MISSING'; end if;
  execute v_definition;
end $$;

drop table public.impersonation_stop_binding_state_20260903000122;
notify pgrst,'reload schema';
commit;
