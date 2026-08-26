begin;

do $$ begin
  if exists(select 1 from public.program_requests where financial_submission_snapshot is not null) then
    raise exception 'RECOVERY_BLOCKED_FINANCIAL_SUBMISSION_HISTORY_EXISTS';
  end if;
end $$;

drop trigger if exists program_requests_02_personalized_financial_submission on public.program_requests;
drop function if exists public.enforce_personalized_financial_submission();
drop function if exists public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb);
alter table public.program_requests drop column if exists financial_submission_snapshot;
grant execute on function public.set_financial_program_request_terms(uuid,numeric,numeric,text) to authenticated;
drop table if exists public.financial_session_snapshots;

notify pgrst, 'reload schema';
commit;
