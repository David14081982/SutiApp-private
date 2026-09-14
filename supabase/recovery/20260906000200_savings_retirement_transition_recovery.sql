begin;
do $$ declare r record; begin
 if exists(select 1 from public.savings_process_change_events where conversion_snapshot is not null)
   or (select count(*) from public.savings_audit_events)<>(select definition::bigint from public.savings_retirement_migration_backup where signature='__audit_count__') then
   raise exception 'RECOVERY_BLOCKED_SAVINGS_RETIREMENT_HISTORY';
 end if;
 for r in select * from public.savings_retirement_migration_backup where signature<>'__audit_count__' loop execute r.definition; end loop;
end $$;
drop function public.savings_self_before_retirement();
drop function public.savings_date_before_retirement(uuid,date,text,uuid);
drop function public.savings_self_process_transition();
drop function public.admin_confirm_savings_process_transition(uuid,date,text,text,uuid);
drop function public.preview_savings_process_transition(uuid,date);
alter table public.savings_process_change_events drop column conversion_snapshot;
drop table public.savings_retirement_migration_backup;
grant execute on function public.get_self_savings_live_readonly() to authenticated;
commit;
