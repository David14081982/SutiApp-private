begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
do $recover$
declare prior public.savings_loan_function_backup%rowtype;
begin
 select * into strict prior from public.savings_loan_function_backup
 where signature='public.savings_loan_eligibility(uuid):20260923000300';
 if pg_get_functiondef('public.savings_loan_eligibility(uuid)'::regprocedure)<>prior.installed_definition then
  raise exception 'SAVINGS_ZERO_MONTH_RECOVERY_DRIFT';
 end if;
 execute prior.definition;
end $recover$;
update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='SAVINGS_ZERO_MONTH_ACCESS_RECOVERY'
where invalidated_at is null and session_purpose='LOAN';
-- Keep backup, audit history, enrollments and submitted loans intact.
commit;
