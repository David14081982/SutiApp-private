begin;

do $$
begin
  if exists(select 1 from public.program_request_admin_events) then
    raise exception 'RECOVERY_BLOCKED_PROGRAM_REQUEST_ADMIN_HISTORY_EXISTS';
  end if;
end $$;

revoke execute on function public.get_program_request_admin_events(uuid) from authenticated;
revoke execute on function public.record_program_request_admin_action(uuid,text,text,uuid) from authenticated;
revoke execute on function public.approve_financial_program_request(uuid,jsonb,uuid,text) from service_role;
drop function public.get_program_request_admin_events(uuid);
drop function public.record_program_request_admin_action(uuid,text,text,uuid);
drop function public.approve_financial_program_request(uuid,jsonb,uuid,text);
drop table public.program_request_admin_events;

notify pgrst,'reload schema';
commit;
