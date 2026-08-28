begin;

revoke execute on function public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text) from authenticated;
drop function public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text);

drop policy if exists affiliate_document_storage_insert on storage.objects;
create policy affiliate_document_storage_insert on storage.objects
for insert to authenticated with check(
  bucket_id='private-assets'
  and name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%')
  and owner_id=auth.uid()::text
);

drop policy if exists affiliate_document_storage_cleanup on storage.objects;
create policy affiliate_document_storage_cleanup on storage.objects
for delete to authenticated using(
  bucket_id='private-assets'
  and name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%')
  and owner_id=auth.uid()::text
  and not exists(
    select 1 from public.private_assets pa
    where pa.storage_bucket=bucket_id and pa.storage_path=name
  )
);

-- Documents already registered through the retired RPC remain canonical history.
notify pgrst,'reload schema';
commit;
