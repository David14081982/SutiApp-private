begin;
-- Retain private subscriptions/audit; stop all production transport and browser writes.
select cron.unschedule(jobid) from cron.job where jobname='request-event-web-push';
update public.request_push_config set enabled=false;
drop trigger if exists request_event_push_after_commit on public.program_request_admin_events;
revoke all on function public.register_self_request_push(text,text,text,timestamptz) from authenticated;
revoke all on function public.claim_request_push_batch(),public.finish_request_push(uuid,uuid,integer) from service_role;
-- Own-device revocation remains available during recovery. No financial row is changed.
notify pgrst,'reload schema';
commit;
