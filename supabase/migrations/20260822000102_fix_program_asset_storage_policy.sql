begin;
drop policy if exists program_catalog_linked_private_storage_read on storage.objects;
create policy program_catalog_linked_private_storage_read on storage.objects for select to authenticated using (
  bucket_id='private-assets' and exists(
    select 1 from public.private_assets a join public.program_catalog_item_assets l on l.private_asset_id=a.id join public.program_catalog_items i on i.id=l.item_id
    where a.storage_bucket=storage.objects.bucket_id and a.storage_path=storage.objects.name and i.enabled
  )
);
commit;
