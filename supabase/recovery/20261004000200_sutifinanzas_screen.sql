begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
lock table public.admin_section_definitions,public.admin_section_responsibilities,public.admin_assignments,public.admin_roles,public.admin_role_permissions,public.admin_audit_log in share row exclusive mode;
do $recovery$ declare saved public.admin_screen_registration_recovery_20261004000200%rowtype; begin
 select * into strict saved from public.admin_screen_registration_recovery_20261004000200 where singleton;
 if saved.applied_hash<>md5(pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure)) or saved.section_hash<>md5(coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text from public.admin_section_definitions t),'[]')) then raise exception 'RECOVERY_BLOCKED_DEFINITION_DRIFT'; end if;
 if saved.authorization_hash<>md5(concat_ws('|',md5(coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text from public.admin_assignments t),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text from public.admin_section_responsibilities t),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text from public.admin_roles t),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text from public.admin_role_permissions t),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text from public.admin_audit_log t),'[]')))) then raise exception 'RECOVERY_BLOCKED_AUTHORIZATION_USE'; end if;
 execute saved.previous_definition;
end $recovery$;
delete from public.admin_section_definitions where section_key=any(array['admin_sutifinanzas']::text[]);
drop table public.admin_screen_registration_recovery_20261004000200;
commit;
