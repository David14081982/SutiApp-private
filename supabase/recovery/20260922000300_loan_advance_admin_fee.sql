begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Restore functions only, never remove or reinterpret real request history.
do $$ declare b record;begin
 if exists(select 1 from public.program_requests
  where financial_submission_snapshot#>>'{financialResult,administrativeFeeVersion}'='ADVANCE_PAYROLL_PERIODS_V1')
 then raise exception 'RECOVERY_BLOCKED_ADVANCE_FEE_HISTORY';end if;
 for b in select * from loan_advance_private.function_backup loop
  if pg_get_functiondef(b.signature::regprocedure)<>b.installed_definition
  then raise exception 'RECOVERY_BLOCKED_ADVANCE_FEE_DRIFT';end if;
  if (select p.proacl::text is distinct from b.original_acl or pg_get_userbyid(p.proowner)<>b.original_owner from pg_proc p where p.oid=b.signature::regprocedure)
  then raise exception 'RECOVERY_BLOCKED_ADVANCE_FEE_PRIVILEGES';end if;
  execute b.definition;
 end loop;
end $$;
drop trigger program_requests_advance_fee_date on public.program_requests;
drop function loan_advance_private.enforce_request_date();
drop function loan_advance_private.payroll_periods(date,date,text);
drop table loan_advance_private.function_backup;
drop schema loan_advance_private;
notify pgrst,'reload schema';
commit;
