begin;

-- Fail closed without deleting rows, assets, relations or the additive columns.
drop trigger if exists directory_members_section_action_guard on public.directory_members;
drop trigger if exists directory_members_section_action_audit on public.directory_members;
drop policy if exists directory_members_section_insert on public.directory_members;
drop policy if exists directory_members_section_update on public.directory_members;
drop policy if exists directory_members_section_delete on public.directory_members;
drop policy if exists directory_members_section_read on public.directory_members;
revoke insert,update,delete on public.directory_members from authenticated;
alter table public.directory_members alter column source_sheet set default 'Directorio';

drop policy if exists union_assets_insert on public.app_assets;
drop policy if exists union_assets_update on public.app_assets;
drop policy if exists union_assets_delete on public.app_assets;
drop policy if exists union_asset_sources_insert on public.asset_sources;
drop policy if exists union_storage_insert on storage.objects;
drop policy if exists union_storage_update on storage.objects;
drop policy if exists union_storage_delete on storage.objects;
drop policy if exists directory_assets_insert on public.app_assets;
drop policy if exists directory_assets_update on public.app_assets;
drop policy if exists directory_assets_delete on public.app_assets;
drop policy if exists directory_asset_sources_insert on public.asset_sources;
drop policy if exists directory_storage_insert on storage.objects;
drop policy if exists directory_storage_update on storage.objects;
drop policy if exists directory_storage_delete on storage.objects;

update public.admin_section_definitions
set data_boundary='institutional_documents',updated_at=now()
where section_key='documents';

comment on column public.union_screen_content.header_asset_id is 'Recovery retained this nullable relation to avoid destructive data loss; all new upload paths are revoked.';

commit;
