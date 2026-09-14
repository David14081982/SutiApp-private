begin;
do $$ begin
 if (select count(*) from public.savings_audit_events)<>(select definition::bigint from public.savings_yield_migration_backup where signature='__audit_count__')
   or exists(select 1 from public.savings_yield_periods where productive_enabled)
   or exists(select 1 from public.savings_participants where historical_yield_reconciled_through is not null)
   or exists(select 1 from public.savings_transactions where idempotency_key like 'PERIOD_YIELD:%') then raise exception 'RECOVERY_BLOCKED_SAVINGS_YIELD_HISTORY'; end if;
end $$;
drop trigger savings_yield_allocations_immutable on public.savings_yield_allocations;
drop trigger savings_validate_yield_opening on public.savings_withdrawal_openings;
drop trigger savings_protect_yield_period on public.savings_yield_periods;
drop function public.savings_validate_yield_opening(),public.savings_protect_yield_period(),public.admin_confirm_savings_period_yield(uuid,text,text,uuid),public.preview_savings_period_yield(uuid);
do $$ declare r record; begin for r in select definition from public.savings_yield_migration_backup where signature<>'__audit_count__' loop execute r.definition; end loop; end $$;
alter table public.savings_yield_periods drop constraint savings_yield_productive_rate_check;
alter table public.savings_yield_periods drop constraint savings_yield_period_calendar_check;
alter table public.savings_yield_periods add constraint savings_yield_disabled_check check(productive_enabled=false);
alter table public.savings_participants drop column historical_yield_reconciled_through;
drop table public.savings_yield_migration_backup;
commit;
