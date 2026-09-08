begin;
-- Redeploy the verified H07 baseline data-exports Edge before removing this RPC.
-- No audit rows, Auth records, affiliates, promotions or history are removed.
drop function if exists public.get_data_export_auth_emails(uuid[]);
notify pgrst, 'reload schema';
commit;
