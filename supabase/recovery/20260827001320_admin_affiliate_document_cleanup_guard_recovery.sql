begin;

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
    or public.can_admin_upload_affiliate_document_path(name)
  )
);

revoke execute on function public.can_delete_unreferenced_affiliate_document_object(text) from authenticated;
drop function public.can_delete_unreferenced_affiliate_document_object(text);

notify pgrst,'reload schema';
commit;
