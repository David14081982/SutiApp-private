begin;

revoke all on function public.get_self_savings_live_readonly() from public,anon,authenticated;
drop function public.get_self_savings_live_readonly();

commit;
