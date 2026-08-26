begin;
do $$ begin
  if exists(select 1 from public.affiliate_bank_accounts where source_kind='HISTORICAL_SEED' and user_maintained_at is not null) then
    raise exception 'RECOVERY_BLOCKED_USER_MAINTAINED_HISTORICAL_ROWS';
  end if;
end $$;
delete from public.affiliate_bank_accounts where source_kind='HISTORICAL_SEED' and user_maintained_at is null;
drop policy if exists bank_accounts_owner_or_capability_read on public.affiliate_bank_accounts;
create policy bank_accounts_self_read on public.affiliate_bank_accounts for select to authenticated using(affiliate_id=public.get_effective_affiliate_id());
drop function if exists public.set_primary_affiliate_bank_account(uuid);
-- Schema rollback is intentionally blocked once user-maintained rows exist; restore RPCs from migration 20260825000100 only during a controlled outage.
commit;
