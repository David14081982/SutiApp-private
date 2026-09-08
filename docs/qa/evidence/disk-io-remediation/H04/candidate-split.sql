-- Candidate only. Executed in a bounded transaction followed by ROLLBACK.
alter policy master_private_storage_authorized_read on storage.objects
using (
  bucket_id = 'private-assets' and (
    (select public.has_admin_permission('assets.read'))
    or exists (
      select 1 from public.private_assets pa
      where pa.storage_path = storage.objects.name
        and pa.storage_bucket = storage.objects.bucket_id
        and pa.status = 'READY'
        and (
          exists (
            select 1 from public.affiliate_files af
            where af.private_asset_id = pa.id
              and af.affiliate_id = (select public.get_effective_affiliate_id())
              and af.status = 'READY'
              and af.expediente_classification = 'CURRENT_DOCUMENT'
          )
          or exists (
            select 1 from public.affiliate_documents d
            where d.private_asset_id = pa.id
              and d.affiliate_id = (select public.get_effective_affiliate_id())
              and d.status <> 'REJECTED'
          )
          or exists (
            select 1 from public.affiliate_files af
            join public.affiliate_documents d on d.affiliate_file_id = af.id
            where af.private_asset_id = pa.id
              and d.affiliate_id = (select public.get_effective_affiliate_id())
              and d.status <> 'REJECTED'
          )
        )
    )
  )
);
