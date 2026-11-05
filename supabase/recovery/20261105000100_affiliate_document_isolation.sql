begin;
set local lock_timeout='3s';set local statement_timeout='90s';
do $check$ declare r record;begin
 if exists(select 1 from document_isolation_private.items) or exists(select 1 from public.private_assets where owner_affiliate_id is not null) then raise exception 'RECOVERY_BLOCKED_ISOLATED_DOCUMENT_HISTORY';end if;
 for r in select * from document_isolation_private.function_backup loop
  if md5(pg_get_functiondef(r.signature::regprocedure))<>r.applied_md5 then raise exception 'RECOVERY_DEFINITION_DRIFT';end if;
  execute r.definition;
 end loop;
end $check$;
drop trigger document_isolation_reference on public.affiliate_documents;
drop trigger document_isolation_reference on public.affiliate_files;
drop trigger document_isolation_asset_owner on public.private_assets;
drop function document_isolation_private.guard_reference();
drop function document_isolation_private.guard_asset_owner();
drop index public.private_assets_legacy_hash_unique;
drop index public.private_assets_owner_idx;
alter table public.private_assets drop constraint private_assets_owned_path_check;
alter table public.private_assets drop column owner_affiliate_id;
alter table public.private_assets add constraint private_assets_hash_unique unique(content_sha256);
drop table document_isolation_private.items,document_isolation_private.batches,document_isolation_private.function_backup;
drop schema document_isolation_private;
commit;
