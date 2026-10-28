begin;
set local lock_timeout='2s';
set local statement_timeout='90s';
-- Withdraw dependent UI first. Retain every version and audit/payment record.
-- Disable entry points rather than discard attested facts or silently re-enable
-- incomplete exports through the older reader. The original reader remains
-- private as reports_base, with its original definition/OID intact.
revoke all on function public.save_admin_savings_termination(jsonb,uuid),public.get_admin_savings_regularization(integer,text),public.get_admin_reports_jc_savings(integer) from public,anon,authenticated,service_role;
revoke all on savings_refunds_private.termination_versions from public,anon,authenticated,service_role;
revoke all on all functions in schema savings_refunds_private from public,anon,authenticated,service_role;
commit;
