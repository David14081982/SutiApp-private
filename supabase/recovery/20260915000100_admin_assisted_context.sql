begin;
do $guard$ declare r record; begin
 if exists(select 1 from public.admin_audit_log where details ? 'admin_assistance')
 or exists(select 1 from public.identity_audit_log where details ? 'admin_assistance') then
 raise exception 'ASSISTED_HISTORY_EXISTS_FORWARD_RECOVERY_REQUIRED'; end if;
 for r in select * from admin_support_private.recovery loop
  if md5(pg_get_functiondef(('public.'||r.signature)::regprocedure))<>r.applied_hash then raise exception 'ASSISTED_RECOVERY_DEFINITION_DRIFT:%',r.signature; end if;
 end loop;
 for r in select * from admin_support_private.recovery loop execute r.definition; end loop;
end $guard$;
drop trigger admin_assisted_context on public.admin_audit_log;
drop trigger admin_assisted_context on public.identity_audit_log;
drop trigger admin_assisted_context on public.affiliate_admin_events;
drop function public.admin_actor_can_impersonate();
drop schema admin_support_private cascade;
notify pgrst,'reload schema';
commit;
