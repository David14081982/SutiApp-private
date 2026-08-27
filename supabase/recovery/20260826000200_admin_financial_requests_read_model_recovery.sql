begin;

revoke all on function public.list_admin_financial_requests_mobile() from public,anon,authenticated;
revoke all on function public.get_admin_financial_request_detail(uuid) from public,anon,authenticated;
revoke all on function public.list_admin_financial_request_queue() from public,anon,authenticated;
drop function if exists public.list_admin_financial_requests_mobile();
drop function if exists public.get_admin_financial_request_detail(uuid);
drop function if exists public.list_admin_financial_request_queue();

notify pgrst, 'reload schema';
commit;
