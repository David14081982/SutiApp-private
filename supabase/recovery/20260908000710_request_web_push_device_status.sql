begin;
revoke all on function public.get_self_request_push_status(uuid) from authenticated;
create or replace function public.wake_request_push() returns bigint
language plpgsql security definer set search_path='' as $$
declare edge_url text; worker_key text; result bigint;
begin
  if not exists(select 1 from public.request_push_config where enabled) or not exists(select 1 from public.request_push_deliveries where status in('pending','sending') and next_attempt_at<=now() and (lease_until is null or lease_until<now())) then return null; end if;
  select decrypted_secret into edge_url from vault.decrypted_secrets where name='request_push_edge_url';
  select decrypted_secret into worker_key from vault.decrypted_secrets where name='request_push_worker_key';
  if edge_url is null or worker_key is null then raise exception 'PUSH_WORKER_NOT_CONFIGURED'; end if;
  select net.http_post(url:=edge_url,headers:=jsonb_build_object('Content-Type','application/json','x-request-push-key',worker_key),body:='{}'::jsonb,timeout_milliseconds:=60000) into result;
  return result;
end $$;
notify pgrst,'reload schema';
commit;
