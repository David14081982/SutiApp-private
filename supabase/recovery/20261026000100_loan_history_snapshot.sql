begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
-- Disable entrypoints and daily dispatch. Preserve observations, staging and run audit.
select public.configure_loan_history_sync(false);
do $jobs$ declare j record; begin
 for j in select jobid from cron.job where jobname='loan-history-snapshot-daily' loop
  perform cron.unschedule(j.jobid);
 end loop;
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
   and schemaname='public' and tablename='loan_history_publication') then
  alter publication supabase_realtime drop table public.loan_history_publication;
 end if;
end $jobs$;
revoke select on public.loan_history_publication from authenticated;
revoke execute on function public.can_read_loan_history_publication(),public.get_self_loan_history_snapshot(),
 public.get_admin_loan_history_sync_status(),public.request_admin_loan_history_sync(),
 public.configure_loan_history_sync(boolean),public.claim_loan_history_sync(uuid),
 public.stage_loan_history_sync(uuid,uuid,jsonb),public.publish_loan_history_sync(uuid,uuid,jsonb,timestamptz,jsonb),
 public.fail_loan_history_sync(uuid,uuid,text) from public,anon,authenticated,service_role;
commit;
