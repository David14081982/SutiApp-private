begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Empty-install recovery only. After real use retain all policy/authorization
-- evidence and prepare a forward repair; never erase approvals or used grants.
do $$ declare b record;begin
 if exists(select 1 from public.savings_loan_access_events) or exists(select 1 from public.savings_loan_authorizations)
 then raise exception 'RECOVERY_BLOCKED_SAVINGS_LOAN_HISTORY_EXISTS';end if;
 for b in select * from public.savings_loan_function_backup loop
  if pg_get_functiondef(b.signature::regprocedure)<>b.installed_definition then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT';end if;
  execute b.definition;
 end loop;
end $$;
drop trigger program_requests_savings_loan_access on public.program_requests;
drop function public.enforce_savings_loan_request_access();
drop function public.assert_savings_loan_quote_access(uuid,text,jsonb);
drop function public.set_admin_savings_loan_authorization(uuid,text,uuid,text,uuid);
drop function public.set_admin_savings_loan_policy(integer,text,integer,text,uuid);
drop function public.get_admin_savings_loan_access(text);
drop function public.savings_loan_eligibility(uuid);
drop table public.savings_loan_access_events;
drop function public.savings_loan_access_event_immutable();
drop table public.savings_loan_authorizations;
drop table public.savings_loan_policy;
drop table public.savings_loan_function_backup;
notify pgrst,'reload schema';
commit;
