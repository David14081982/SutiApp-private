begin;
do $$ begin
  if exists(select 1 from public.program_requests where financial_submission_snapshot->>'contract_version'='MEMBERSHIP_PAYMENT_V1') then
    raise exception 'MEMBERSHIP_RECOVERY_BLOCKED_HISTORY_EXISTS';end if;
end $$;
drop trigger program_requests_03_membership_payment_contract on public.program_requests;
drop function public.create_membership_request(uuid,uuid[],text,text,text,uuid,uuid,text);
drop function public.capture_membership_payment_contract();
drop function public.get_current_membership_payment_quote(uuid);
drop function public.membership_payment_contract(uuid,uuid);
notify pgrst,'reload schema';
commit;
