begin;
set local lock_timeout='2s';
do $$ begin
 if exists(select 1 from public.admin_section_responsibilities where section_key='admin_login_history') then
  raise exception 'LOGIN_HISTORY_HAS_RESPONSIBILITIES';
 end if;
end $$;
drop function public.list_admin_login_history(text,text,date,date,integer,integer);
delete from public.admin_section_definitions where section_key='admin_login_history' and module_key='login_history';
-- Never delete Auth logs. Restore audit_log_disable_postgres separately only if required.
commit;
