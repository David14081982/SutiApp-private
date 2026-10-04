begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- First restore the previous Edge reader explicitly. This recovery removes only
-- the authorized disposable observation; no financial or historical row changes.
do $unschedule$ declare item record;begin
 if to_regclass('cron.job') is not null then
  for item in select jobid from cron.job where jobname='sicof-source-refresh' loop
   perform cron.unschedule(item.jobid);
  end loop;
 end if;
end $unschedule$;
drop function public.service_sicof_source_read();
drop function public.service_sicof_source_claim(boolean);
drop function public.service_sicof_source_finish(uuid,jsonb,text);
drop function sicof_source_private.run_refresh();
drop function sicof_source_private.metadata(sicof_source_private.observation,timestamptz);
drop table sicof_source_private.observation;
drop schema sicof_source_private;
commit;
