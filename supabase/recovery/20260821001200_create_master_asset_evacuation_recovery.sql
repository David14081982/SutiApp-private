begin;

drop policy if exists master_private_storage_authorized_read on storage.objects;
drop policy if exists master_public_storage_read on storage.objects;

do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'private-assets') then
    raise exception 'PRIVATE_ASSET_OBJECTS_MUST_BE_REMOVED_BY_VERIFIED_MANIFEST_BEFORE_SCHEMA_RECOVERY';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'public-assets') then
    raise exception 'PUBLIC_ASSET_OBJECTS_MUST_BE_REMOVED_BY_VERIFIED_MANIFEST_BEFORE_SCHEMA_RECOVERY';
  end if;
end $$;

delete from storage.buckets where id = 'private-assets';
delete from storage.buckets where id = 'public-assets';

drop table if exists public.affiliate_files;
drop table if exists public.historical_asset_sources;
drop table if exists public.private_assets;
drop table if exists public.historical_file_columns;
drop function if exists public.set_master_asset_updated_at();

commit;
