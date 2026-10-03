-- Phase 1 always stops future executions without removing already credited history.
begin;
set local lock_timeout='30s';
select pg_advisory_xact_lock(hashtextextended('savings-auto-job',0));
select pg_advisory_xact_lock(hashtextextended('savings-config',0));
select cron.unschedule(jobid) from cron.job where jobname='savings-automatic-contributions';
update savings_automatic_private.policy set enabled=false,updated_at=clock_timestamp() where id;
commit;
-- Phase 2 restores structure only if no new receipt/instruction data depends on it.
begin;
set local lock_timeout='30s';
select pg_advisory_xact_lock(hashtextextended('savings-auto-job',0));
select pg_advisory_xact_lock(hashtextextended('savings-config',0));
do $recover$ declare r record;begin
 if exists(select 1 from public.savings_contribution_overrides where entry_source='SYSTEM_SCHEDULE')
  or exists(select 1 from savings_automatic_private.instructions) or exists(select 1 from savings_automatic_private.runs)
  or exists(select 1 from savings_automatic_private.policy where version>0) then
  raise notice 'SAVINGS_AUTO_PAUSED_HISTORY_PRESERVED: new receipts/instructions retained; structural rollback intentionally skipped';return;
 end if;
 for r in select * from savings_automatic_private.function_backup loop
  if md5(pg_get_functiondef(to_regprocedure(r.signature))) is distinct from r.installed_md5
   or (select pg_get_userbyid(proowner) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.original_owner
   or (select proacl::text from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.original_acl then
   raise exception 'SAVINGS_AUTO_RECOVERY_DRIFT' using detail=r.signature;end if;
 end loop;
 for r in select * from savings_automatic_private.function_backup loop execute r.definition;end loop;
 drop function public.admin_configure_savings_automatic_contributions(boolean,date,text,uuid);
 drop function public.admin_set_savings_scheduled_contribution(uuid,uuid,date,numeric,integer,text,uuid);
 alter table public.savings_contribution_overrides drop constraint savings_override_origin_actor_check;
 alter table public.savings_contribution_overrides alter column editor_auth_user_id set not null;
 alter table public.savings_contribution_overrides drop column entry_source;
 drop schema savings_automatic_private cascade;
end $recover$;
commit;
