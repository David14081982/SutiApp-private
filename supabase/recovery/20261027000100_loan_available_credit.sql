begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
-- Restore the exact previous quote body. Preserve all decisions and requests.
do $$ declare b record;current_definition text;begin
 for b in select * from loan_capacity_private.function_backup loop
  current_definition:=pg_get_functiondef(b.signature::regprocedure);
  if current_definition is distinct from b.installed_definition then raise exception 'LOAN_CAPACITY_RECOVERY_FUNCTION_DRIFT';end if;
  if (select proacl::text is distinct from b.original_acl or proowner<>b.original_owner or oid<>b.original_oid from pg_proc where oid=b.signature::regprocedure)
  then raise exception 'LOAN_CAPACITY_RECOVERY_PRIVILEGE_DRIFT';end if;
  execute b.definition;
 end loop;
end $$;
drop trigger program_requests_loan_available_credit on public.program_requests;
revoke all on function public.get_loan_capacity_runtime(uuid),public.resolve_loan_available_capacity(uuid,jsonb,uuid[]),
 public.enforce_loan_available_credit(),public.get_admin_loan_capacity(text),
 public.set_admin_loan_capacity_policy(boolean,integer,text,uuid),
 public.set_admin_loan_capacity_override(uuid,uuid,boolean,integer,text,uuid) from public,anon,authenticated,service_role;
-- Keep private tables, immutable audit and snapshot evidence; no DELETE or DROP.
update public.financial_session_snapshots set invalidated_at=clock_timestamp(),invalidation_reason='LOAN_CAPACITY_RECOVERY'
 where session_purpose='LOAN' and invalidated_at is null;
notify pgrst,'reload schema';
commit;
