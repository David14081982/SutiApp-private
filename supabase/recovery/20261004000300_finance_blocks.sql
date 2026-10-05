-- Explicit rollback removes enforcement and API. Preserve all restriction/event history privately.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
drop trigger zz_finance_request_block on public.program_requests;
drop function public.enforce_finance_request_block();
drop function public.get_self_finance_block();
drop function public.list_admin_finance_blocks(uuid);
drop function public.save_admin_finance_block(uuid,uuid,integer,date,date,text);
drop function public.revoke_admin_finance_block(uuid,integer,text);
revoke all on public.finance_blocks,public.finance_block_events from public,anon,authenticated,service_role;
commit;
