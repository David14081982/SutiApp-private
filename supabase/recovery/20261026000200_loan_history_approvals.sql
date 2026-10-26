begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
-- Roll frontend/Edge back first. Recovery removes only approval metadata tooling.
-- It never undoes a Finance decision or changes Google observations/daily/manual sync.
do $restore$
declare b loan_history_private.approval_context_backup; p pg_proc;
begin
 if current_user<>'postgres' then raise exception 'HISTORY_APPROVAL_OWNER_REQUIRED'; end if;
 select * into strict b from loan_history_private.approval_context_backup where id;
 select * into strict p from pg_proc where oid='public.get_self_loan_history_context()'::regprocedure;
 if p.oid<>b.function_oid or md5(p.prosrc)<>b.installed_source_hash
  or p.proowner is distinct from b.owner_oid or p.proacl is distinct from b.acl
  or p.proconfig is distinct from b.config or p.prosecdef is distinct from b.security_definer
  or p.provolatile is distinct from b.volatility then
  raise exception 'HISTORY_APPROVAL_RECOVERY_DRIFT'; end if;
 execute b.definition;
 if (select md5(prosrc) from pg_proc where oid=b.function_oid)<>b.original_source_hash then
  raise exception 'HISTORY_APPROVAL_RECOVERY_MISMATCH'; end if;
end $restore$;
drop trigger loan_history_approval_revision on public.program_requests;
drop function loan_history_private.publish_approval_revision();
drop function public.get_self_loan_history_approvals();
alter publication supabase_realtime drop table public.loan_history_approval_publication;
drop table public.loan_history_approval_publication;
drop table loan_history_private.approval_context_backup;
notify pgrst,'reload schema';
commit;
