begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Exact recovery only before a new interest contract has been submitted.
do $$ declare b record;begin
 if exists(select 1 from public.program_requests
  where financial_submission_snapshot#>>'{financialResult,interestCalculationVersion}'='ADVANCE_PAYROLL_INTEREST_V1')
 then raise exception 'RECOVERY_BLOCKED_ADVANCE_INTEREST_HISTORY';end if;
 for b in select * from loan_advance_private.interest_function_backup loop
  if pg_get_functiondef(b.signature::regprocedure)<>b.installed_definition
  then raise exception 'RECOVERY_BLOCKED_ADVANCE_INTEREST_DRIFT';end if;
  if (select p.proacl::text is distinct from b.original_acl or pg_get_userbyid(p.proowner)<>b.original_owner from pg_proc p where p.oid=b.signature::regprocedure)
  then raise exception 'RECOVERY_BLOCKED_ADVANCE_INTEREST_PRIVILEGES';end if;
  execute b.definition;
 end loop;
end $$;
drop table loan_advance_private.interest_function_backup;
-- Preserve prior fee calendar, trigger and backup; no business rows touched.
notify pgrst,'reload schema';
commit;
