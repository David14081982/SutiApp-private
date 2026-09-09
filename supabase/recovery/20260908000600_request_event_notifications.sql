begin;
-- Deploy the previous frontend first. Preserve every durable receipt and historical event.
drop function public.mark_self_request_event_seen(uuid);
drop function public.list_self_request_event_notifications();
revoke all on public.program_request_event_receipts from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
