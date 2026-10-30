begin;
set local lock_timeout='2s';
-- Removes only the additive reader. Existing financial data and functions stay intact.
drop function public.get_admin_reports_jc_cash_flow(date);
notify pgrst,'reload schema';
commit;
