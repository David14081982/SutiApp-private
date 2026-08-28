begin;

create function public.can_delete_unreferenced_affiliate_document_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null
    and p_name ~ '^affiliate-documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
    and (
      p_name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%')
      or public.can_admin_upload_affiliate_document_path(p_name)
    )
    and not exists(
      select 1 from public.private_assets pa
      where pa.storage_bucket='private-assets' and pa.storage_path=p_name
    );
$$;

revoke all on function public.can_delete_unreferenced_affiliate_document_object(text) from public,anon;
grant execute on function public.can_delete_unreferenced_affiliate_document_object(text) to authenticated;

drop policy if exists affiliate_document_storage_cleanup on storage.objects;
create policy affiliate_document_storage_cleanup on storage.objects
for delete to authenticated using(
  bucket_id='private-assets'
  and owner_id=auth.uid()::text
  and public.can_delete_unreferenced_affiliate_document_object(name)
);

comment on function public.can_delete_unreferenced_affiliate_document_object(text)
is 'RLS-independent boolean guard: only owner policy may delete an unreferenced affiliate-document object.';

notify pgrst,'reload schema';
commit;
