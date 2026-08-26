begin;

-- No physical objects or historical relations were deleted by the migration.
drop trigger if exists affiliate_documents_sync_expediente_classification on public.affiliate_documents;
drop function if exists public.sync_affiliate_expediente_classification();
drop function if exists public.refresh_affiliate_expediente_classification(uuid);

drop policy if exists master_private_storage_authorized_read on storage.objects;
create policy master_private_storage_authorized_read on storage.objects for select to authenticated using(
  bucket_id='private-assets' and (public.has_admin_permission('assets.read') or exists(
    select 1 from public.private_assets pa left join public.affiliate_files af on af.private_asset_id=pa.id left join public.affiliate_documents d on d.private_asset_id=pa.id or d.affiliate_file_id=af.id
    where pa.storage_path=name and pa.storage_bucket=bucket_id and pa.status='READY' and (af.affiliate_id=public.get_effective_affiliate_id() or d.affiliate_id=public.get_effective_affiliate_id())
  ))
);

drop policy if exists private_assets_authorized_read on public.private_assets;
create policy private_assets_authorized_read on public.private_assets for select to authenticated using(
  public.has_admin_permission('assets.read')
  or exists(select 1 from public.affiliate_files af where af.private_asset_id=private_assets.id and af.affiliate_id=public.get_effective_affiliate_id() and af.status='READY')
  or exists(select 1 from public.affiliate_documents d left join public.affiliate_files af on af.id=d.affiliate_file_id where coalesce(d.private_asset_id,af.private_asset_id)=private_assets.id and d.affiliate_id=public.get_effective_affiliate_id() and d.status<>'REJECTED')
);

drop policy if exists affiliate_files_authorized_read on public.affiliate_files;
create policy affiliate_files_authorized_read on public.affiliate_files for select to authenticated using(
  public.has_admin_permission('assets.read') or affiliate_id=public.get_effective_affiliate_id()
);

revoke select (expediente_classification) on public.affiliate_files from authenticated;
drop index if exists public.affiliate_files_expediente_classification_idx;
alter table public.affiliate_files drop constraint if exists affiliate_files_expediente_classification_check;
alter table public.affiliate_files drop column if exists expediente_classification;

commit;
