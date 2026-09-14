begin;
do $$ declare r record; begin
 if exists(select 1 from public.savings_operation_settings)
   or exists(select 1 from public.savings_withdrawal_openings)
   or exists(select 1 from public.savings_date_authorizations)
   or exists(select 1 from public.savings_audit_events where resource='savings_operations')
   or (select count(*) from public.savings_audit_events)<>(select definition::bigint from public.savings_operations_migration_backup where signature='__audit_count__') then
   raise exception 'RECOVERY_BLOCKED_SAVINGS_OPERATIONAL_HISTORY';
 end if;
 for r in select * from public.savings_operations_migration_backup where signature<>'__audit_count__' loop
   execute r.definition;
 end loop;
end $$;
drop function public.savings_submit_before_20260906(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid);
drop function public.savings_review_before_20260906(uuid,text,text,date,date,text);
drop function public.savings_settle_before_20260906(uuid,numeric,numeric,text,uuid);
grant execute on function public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid),public.admin_review_savings_request(uuid,text,text,date,date,text),public.admin_settle_savings_request(uuid,numeric,numeric,text,uuid) to authenticated;
drop function public.admin_configure_savings_operation(jsonb,uuid);
drop function public.admin_authorize_savings_date(uuid,date,text,uuid);
drop function public.get_admin_savings_operations(uuid);
drop function public.savings_next_enrollment_date(uuid,date);
drop function public.savings_next_contribution_date(date,text);
drop function public.savings_operation_today();
drop table public.savings_date_authorizations;
drop table public.savings_withdrawal_openings;
drop table public.savings_operation_settings;
drop table public.savings_operations_migration_backup;
commit;
