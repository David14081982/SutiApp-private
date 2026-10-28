begin;
set local lock_timeout='2s';
-- Safe operational shutdown. Historical cases/payments/audit and all existing
-- savings data survive recovery. No DROP/CASCADE or financial restoration.
revoke all on function public.save_admin_savings_refund(jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_admin_savings_refunds(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.get_admin_savings_refund_people(text) from public,anon,authenticated,service_role;
revoke all on function public.get_admin_reports_jc_savings(integer) from public,anon,authenticated,service_role;
revoke all on all tables in schema savings_refunds_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema savings_refunds_private from public,anon,authenticated,service_role;
revoke all on all functions in schema savings_refunds_private from public,anon,authenticated,service_role;
revoke all on schema savings_refunds_private from public,anon,authenticated,service_role;
commit;
