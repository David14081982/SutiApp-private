begin;

create function public.can_admin_upload_affiliate_document_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null
    and public.has_admin_permission('documents.write')
    and p_name ~ '^affiliate-documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
    and exists(
      select 1 from public.affiliates
      where id::text=split_part(p_name,'/',2)
    );
$$;

revoke all on function public.can_admin_upload_affiliate_document_path(text) from public,anon;
grant execute on function public.can_admin_upload_affiliate_document_path(text) to authenticated;

drop policy if exists affiliate_document_storage_insert on storage.objects;
create policy affiliate_document_storage_insert on storage.objects
for insert to authenticated with check(
  bucket_id='private-assets' and owner_id=auth.uid()::text and (
    name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%')
    or public.can_admin_upload_affiliate_document_path(name)
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
    or public.can_admin_upload_affiliate_document_path(name)
  )
);

comment on function public.can_admin_upload_affiliate_document_path(text)
is 'Boolean-only Storage guard: documents.write plus an existing target affiliate; reveals no affiliate fields.';

notify pgrst,'reload schema';
commit;
