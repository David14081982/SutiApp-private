begin;
set local lock_timeout='2s';
-- Operational rollback: preserve every request, event, stock movement and consent.
-- Hide Farma until corrected code is deployed; historical rows are never removed.
update public.program_catalog_items set enabled=false where program_key='farma';
revoke execute on function public.farma_command(text,jsonb) from authenticated;
revoke execute on function public.claim_farma_push_batch(),public.finish_farma_push(uuid,uuid,integer) from service_role;
select cron.unschedule(jobid) from cron.job where jobname='farma-web-push';
update public.admin_section_responsibilities set enabled=false,revoked_at=now(),updated_at=now() where section_key='farma' and enabled;
do $$declare r record;begin for r in select * from farma_private.definition_backup loop execute r.definition;end loop;end $$;
-- Keep DONATION constraint and request boundary so old finance code fails closed.
notify pgrst,'reload schema';
commit;
