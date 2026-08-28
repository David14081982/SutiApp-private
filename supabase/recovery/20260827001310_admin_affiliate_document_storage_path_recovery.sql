begin;

drop policy if exists affiliate_document_storage_insert on storage.objects;
create policy affiliate_document_storage_insert on storage.objects
for insert to authenticated with check(
  bucket_id='private-assets' and owner_id=auth.uid()::text and (
    name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%')
    or (
      public.has_admin_permission('documents.write')
      and name ~ '^affiliate-documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
      and exists(select 1 from public.affiliates where id::text=split_part(name,'/',2))
    )
  )
);

drop policy if exists affiliate_document_storage_cleanup on storage.objects;
create policy affiliate_document_storage_cleanup on storage.objects
for delete to authenticated using(
  bucket_id='private-assets' and owner_id=auth.uid()::text
  and not exists(
    select 1 from public.private_assets pa
    where pa.storage_bucket=bucket_id and pa.storage_path=name
  )
  and (
    name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%')
    or (
      public.has_admin_permission('documents.write')
      and name ~ '^affiliate-documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
      and exists(select 1 from public.affiliates where id::text=split_part(name,'/',2))
    )
  )
);

revoke execute on function public.can_admin_upload_affiliate_document_path(text) from authenticated;
drop function public.can_admin_upload_affiliate_document_path(text);

notify pgrst,'reload schema';
commit;
