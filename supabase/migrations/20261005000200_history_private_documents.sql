-- H-HISTORY-PRIVATE-DOCUMENTS-001: only program self-access changes. No row writes.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $history_privacy$
declare source text; patched text;
begin
 select pg_get_functiondef('document_private.visible(document_private.records,boolean)'::regprocedure) into source;
 if md5(replace(source,chr(13),'')) <> '102eb920ddb8c826a6a32a3a5055f3eb' then raise exception 'DOCUMENT_VISIBILITY_BASELINE_DRIFT'; end if;
 patched:=replace(source,$old$else r.affiliate_id=public.get_effective_affiliate_id() end$old$,$new$else r.domain<>'program' and r.affiliate_id=public.get_effective_affiliate_id() end$new$);
 execute patched;
 if md5(replace(pg_get_functiondef('document_private.visible(document_private.records,boolean)'::regprocedure),chr(13),'')) <> '1eaef3e0d05a99b70e3f50da12a8bb66' then raise exception 'DOCUMENT_VISIBILITY_POSTCONDITION'; end if;
end $history_privacy$;
commit;
