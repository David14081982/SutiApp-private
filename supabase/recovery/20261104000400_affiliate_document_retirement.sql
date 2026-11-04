begin;
set local lock_timeout='3s';
do $recover$ declare r record;begin
 if exists(select 1 from document_retirement_private.operations) then raise exception 'DOCUMENT_RETIREMENT_HISTORY_MUST_BE_PRESERVED: disable writer and repair forward; never restore access';end if;
 for r in select * from document_retirement_private.function_backup loop
  if md5(pg_get_functiondef(r.signature::regprocedure))<>r.applied_md5 then raise exception 'DOCUMENT_RETIREMENT_RECOVERY_DRIFT';end if;
  execute r.definition;
 end loop;end $recover$;
drop trigger retirement_reference_guard on public.affiliate_documents;
drop trigger retirement_reference_guard on public.affiliate_files;
drop trigger retirement_reference_guard on public.request_documents;
drop trigger retirement_reference_guard on public.savings_requests;
drop trigger retirement_reference_guard on public.program_terms_versions;
drop trigger retirement_reference_guard on public.program_catalog_item_assets;
drop trigger retirement_reference_guard on public.financial_programs;
drop policy document_retirement_filter on public.affiliate_documents;
drop policy document_retirement_filter on public.affiliate_files;
drop policy document_retirement_filter on public.private_assets;
drop policy document_retirement_filter on storage.objects;
drop function public.preview_admin_affiliate_document_delete(uuid,uuid),public.prepare_admin_affiliate_document_delete(uuid,uuid,text,text,uuid),public.affiliate_document_delete_storage(uuid,uuid,boolean);
alter table public.private_assets drop constraint private_assets_live_sha256_check;
alter table public.private_assets alter column content_sha256 set not null;
drop function public.resume_admin_affiliate_document_delete(uuid,uuid);
drop schema document_retirement_private cascade;
drop function public.affiliate_document_is_active(uuid),public.affiliate_document_asset_is_active(uuid),public.affiliate_document_file_is_active(uuid),public.affiliate_document_storage_is_active(text,text);
notify pgrst,'reload schema';
commit;
