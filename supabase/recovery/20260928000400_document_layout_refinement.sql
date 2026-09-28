-- Forward recovery: keep every layout/version/snapshot, stop new enrichment and layout writes.
-- Keep the v2-compatible renderer deployed for already sealed documents.
begin;
set local lock_timeout='2s';
do $$ begin
 if md5(replace((select prosrc from pg_proc where oid='document_private.capture_affiliate_fields()'::regprocedure),chr(13),'')) <> '547d92742a82b659e196912baccb3435' then raise exception 'DOCUMENT_LAYOUT_REFINEMENT_RECOVERY_DRIFT';end if;
end $$;
drop trigger if exists document_affiliate_fields on document_private.records;
revoke execute on function public.document_layout_persist(text,jsonb) from service_role;
notify pgrst,'reload schema';
commit;
