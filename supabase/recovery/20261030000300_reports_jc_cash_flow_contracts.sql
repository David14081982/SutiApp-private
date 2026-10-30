begin;
set local lock_timeout='2s';
-- Remove only the additive report reader; preserve every original contract and reader.
drop function public.get_admin_reports_jc_cash_flow_contracts();
notify pgrst,'reload schema';
commit;
