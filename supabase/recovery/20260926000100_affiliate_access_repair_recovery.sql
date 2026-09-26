begin;

set local lock_timeout='2s';

set local statement_timeout='60s';

-- Schema recovery for H-AFFILIATE-ACCESS-REPAIR-001. The migration only ADDED objects, so this
-- removes them and leaves every pre-existing function, table, grant and policy as it was.
-- Data repairs already performed are NOT undone here: undo each one first with
--   select public.revert_affiliate_access_repair(<id>);   -- as service_role
-- The evidence table is kept when it holds rows (history must not be destroyed).

drop trigger if exists affiliates_release_stale_duplicate_email on public.affiliates;

drop function if exists public.affiliates_release_stale_duplicate_email();
drop function if exists public.get_admin_affiliate_access_diagnosis(uuid);
drop function if exists public.list_admin_affiliate_access_issues();
drop function if exists public.admin_relink_affiliate_account(uuid,timestamptz,text);
drop function if exists public.admin_release_affiliate_account(uuid,timestamptz,text);
drop function if exists public.admin_recalculate_affiliate_access(uuid,timestamptz,text);
drop function if exists public.revert_affiliate_access_repair(bigint);
drop function if exists public.affiliate_access_expected_eligibility(uuid);

do $recover$
begin
  if not exists(select 1 from public.affiliate_access_repairs) then
    execute 'drop table public.affiliate_access_repairs';
  end if;
end
$recover$;

notify pgrst, 'reload schema';
commit;
