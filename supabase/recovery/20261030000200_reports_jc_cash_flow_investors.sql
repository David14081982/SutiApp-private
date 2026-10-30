begin;
set local lock_timeout='2s';
-- Disable only this new report reader. Preserve every source, original RPC and financial row.
revoke all on function public.get_admin_reports_jc_cash_flow_investors(date) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
