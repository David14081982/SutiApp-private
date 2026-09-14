begin;
-- Restore functions only before first operational history; never discard real requests.
do $$ declare saved record; begin
 if exists(select 1 from public.savings_requests where metadata->>'origin'='SAVINGS_RUNTIME_V1')
  or exists(select 1 from public.savings_audit_events where resource='savings_runtime') then raise exception 'RECOVERY_BLOCKED_SAVINGS_RUNTIME_HISTORY_EXISTS'; end if;
 for saved in select definition from public.savings_requests_runtime_backup loop execute saved.definition; end loop;
end $$;
drop function public.get_admin_savings_runtime_requests(text);
drop function public.admin_save_savings_operation(jsonb,uuid);
drop function public.savings_runtime_submit(uuid,jsonb,uuid,boolean);
drop function public.savings_runtime_assert_payout(uuid);
drop function public.savings_runtime_assert_identity(uuid);
drop table public.savings_requests_runtime_backup;
notify pgrst,'reload schema';
commit;
