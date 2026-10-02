-- Revert the RH frontend first and remove the savings-rh-report Edge Function.
-- No business data was written by this migration; no historical restore is needed.
begin;
set local lock_timeout='2s';
drop function if exists public.get_admin_savings_rh_report(text,integer,integer,integer);
notify pgrst,'reload schema';
commit;
