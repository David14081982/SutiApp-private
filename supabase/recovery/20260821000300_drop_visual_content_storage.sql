begin;

drop policy if exists h0072_storage_public_read on storage.objects;
delete from storage.objects where bucket_id in ('app-assets', 'company-assets', 'documents');
delete from storage.buckets where id in ('app-assets', 'company-assets', 'documents');

alter table public.institutional_programs drop column if exists primary_image_asset_id;
alter table public.institutional_documents drop column if exists document_asset_id;
alter table public.institutional_documents drop column if exists image_asset_id;
alter table public.minutes drop column if exists document_asset_id;
alter table public.minutes drop column if exists image_asset_id;
alter table public.directory_members drop column if exists image_asset_id;

drop table if exists public.popups;
drop table if exists public.banners;
drop table if exists public.company_assets;
drop table if exists public.companies;
drop table if exists public.asset_sources;
drop table if exists public.app_assets;
drop function if exists public.set_h0072_updated_at();

commit;
