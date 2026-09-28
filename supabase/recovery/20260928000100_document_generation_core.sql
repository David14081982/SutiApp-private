begin;
-- Safe operational recovery retains documents, snapshots, versions and audit history.
-- Revert the frontend release first. No business authorization is replayed or reverted.
set local lock_timeout='2s';
do $$ declare saved document_private.installation%rowtype;begin
 select * into strict saved from document_private.installation;
 if md5(pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure)) is distinct from saved.applied_visibility_hash then raise exception 'DOCUMENT_RECOVERY_VISIBILITY_DRIFT';end if;
 execute saved.prior_visibility_definition;
end $$;
update document_private.installation set enabled=false;
select cron.unschedule(jobid) from cron.job where jobname='document-generation-core';
drop trigger if exists document_program_approval on public.program_request_admin_events;
drop trigger if exists document_savings_approval on public.savings_audit_events;
revoke execute on function public.document_generation_command(text,jsonb) from authenticated;
revoke execute on function public.document_generation_worker(text,jsonb) from service_role;
-- Keep the private bucket and restrictive policy. Never expose archived signatures.
notify pgrst,'reload schema';
commit;
