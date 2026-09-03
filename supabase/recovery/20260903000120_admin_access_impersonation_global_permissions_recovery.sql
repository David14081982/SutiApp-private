begin;

do $$
declare v_applied timestamptz;
begin
  select applied_at into v_applied from public.admin_access_migration_state_20260903000120 where singleton;
  if v_applied is null then raise exception 'RECOVERY_STATE_MISSING'; end if;
  if exists(select 1 from public.admin_audit_log where created_at>v_applied and resource in('admin_assignments','admin_roles','admin_section_responsibilities'))
     or exists(select 1 from public.identity_audit_log where created_at>v_applied and action in('IMPERSONATION_STARTED','IMPERSONATION_STOPPED')) then
    raise exception 'RECOVERY_BLOCKED_POST_MIGRATION_ACTIVITY';
  end if;
end $$;

drop function if exists public.list_admin_assignments();
drop function if exists public.set_total_admin_by_email(text);
drop function if exists public.revoke_admin_assignment(uuid);
drop function if exists public.list_admin_section_definitions();
drop function if exists public.list_section_responsibility_groups(text);
drop function if exists public.search_affiliates_for_impersonation(text);

do $$
declare v_name text;v_definition text;v_defs jsonb;
begin
  select prior_function_definitions into v_defs from public.admin_access_migration_state_20260903000120 where singleton;
  for v_name,v_definition in select key,value from jsonb_each_text(v_defs) loop
    execute v_definition;
  end loop;
end $$;

alter table public.impersonation_sessions drop column actor_auth_session_id;
drop index public.admin_assignments_one_protected_idx;
alter table public.admin_assignments drop constraint admin_assignments_revocation_coherence_check;
alter table public.admin_assignments
  drop column protected_assignment,
  drop column revoked_by_auth_user_id,
  drop column revoked_at,
  drop column assigned_by_auth_user_id,
  drop column assigned_at;

revoke all on function public.get_admin_access_context(),public.get_current_affiliate_access_state(),
  public.get_effective_affiliate_id(),public.get_impersonation_context(),
  public.start_affiliate_impersonation(uuid,text),public.stop_affiliate_impersonation(),
  public.search_affiliates_for_impersonation(text),public.save_admin_role(uuid,text,text,text[]),public.assign_admin_role(uuid,uuid,boolean)
from public,anon;
grant execute on function public.get_admin_access_context(),public.get_current_affiliate_access_state(),
  public.get_effective_affiliate_id(),public.get_impersonation_context(),
  public.start_affiliate_impersonation(uuid,text),public.stop_affiliate_impersonation(),
  public.search_affiliates_for_impersonation(text),public.save_admin_role(uuid,text,text,text[]),public.assign_admin_role(uuid,uuid,boolean)
to authenticated;

drop table public.admin_access_migration_state_20260903000120;
notify pgrst,'reload schema';
commit;
