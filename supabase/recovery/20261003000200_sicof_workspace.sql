begin;
do $$ declare saved sicof_private.visibility_backup%rowtype;begin
 select * into strict saved from sicof_private.visibility_backup where id;
 if pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure) is distinct from saved.installed_definition
  or (select proacl from pg_proc where oid='admin_support_private.module_visible(uuid,text)'::regprocedure) is distinct from saved.original_acl
  or (select pg_get_userbyid(proowner) from pg_proc where oid='admin_support_private.module_visible(uuid,text)'::regprocedure) is distinct from saved.original_owner
 then raise exception 'SICOF_VISIBILITY_RECOVERY_DRIFT';end if;
 execute saved.definition;
end $$;
-- Disable SICOF entry points while retaining all scenarios and original evidence.
revoke all on function public.get_admin_sicof_context(date,date),public.get_admin_sicof_behavior_context(uuid[]),
 public.admin_archive_sicof_scenario(uuid,uuid),public.admin_save_sicof_preferences(jsonb,uuid),public.get_admin_sicof_report_template(uuid),
 public.service_save_sicof_scenario(uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text),public.service_import_sicof_report(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb)
 from public,anon,authenticated,service_role;
revoke all on all functions in schema sicof_private from public,anon,authenticated,service_role;
revoke all on all tables in schema sicof_private from public,anon,authenticated,service_role;
-- Keep catalog membership and assignments as history; permissions cannot execute
-- the now-revoked entry points. No role, user or business row is deleted.
notify pgrst,'reload schema';
commit;
