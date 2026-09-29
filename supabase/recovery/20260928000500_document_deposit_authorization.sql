-- Forward recovery: retain all issued/revised PDFs, snapshots and configuration history.
-- Keep the compatible renderer; stop new work until the incident is resolved.
begin;
set local lock_timeout='2s';
do $$ declare baseline jsonb;begin
 select deposit_recovery into baseline from document_private.installation;
 if baseline is null or baseline->>'command_hash'<>md5(pg_get_functiondef('public.document_generation_command(text,jsonb)'::regprocedure)) or baseline->>'visible_hash'<>md5(pg_get_functiondef('document_private.visible(document_private.records,boolean)'::regprocedure)) or baseline->>'affiliate_hash'<>md5(pg_get_functiondef('document_private.capture_affiliate_fields()'::regprocedure)) then raise exception 'DOCUMENT_DEPOSIT_RECOVERY_DRIFT';end if;
 execute baseline->>'command';execute baseline->>'visible';execute baseline->>'affiliate';
end $$;
drop trigger document_deposit_fields on document_private.records;
update document_private.installation set enabled=false;
revoke execute on function public.document_layout_persist(text,jsonb) from service_role;
notify pgrst,'reload schema';
commit;
