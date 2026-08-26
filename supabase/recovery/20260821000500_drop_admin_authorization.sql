begin;
do $$ declare table_name text;
begin
  foreach table_name in array array['app_assets','asset_sources','app_settings','companies','company_assets','banners','popups','directory_members','minutes','institutional_documents','institutional_programs']
  loop execute format('drop trigger if exists %I_admin_audit on public.%I', table_name, table_name); end loop;
end $$;
drop policy if exists h008_storage_admin_insert on storage.objects;
drop policy if exists h008_storage_admin_update on storage.objects;
drop policy if exists h008_storage_admin_delete on storage.objects;
drop policy if exists app_assets_admin_insert on public.app_assets;
drop policy if exists app_assets_admin_update on public.app_assets;
drop policy if exists app_assets_admin_delete on public.app_assets;
drop policy if exists asset_sources_admin_all on public.asset_sources;
drop policy if exists app_settings_admin_update on public.app_settings;
drop policy if exists companies_admin_all on public.companies;
drop policy if exists company_assets_admin_all on public.company_assets;
drop policy if exists banners_admin_all on public.banners;
drop policy if exists popups_admin_all on public.popups;
drop policy if exists directory_assets_admin_update on public.directory_members;
drop policy if exists minutes_assets_admin_update on public.minutes;
drop policy if exists documents_assets_admin_update on public.institutional_documents;
drop policy if exists programs_assets_admin_update on public.institutional_programs;
revoke insert, update, delete on public.app_assets, public.asset_sources, public.companies, public.company_assets, public.banners, public.popups from authenticated;
revoke update on public.app_settings, public.directory_members, public.minutes, public.institutional_documents, public.institutional_programs from authenticated;
drop function if exists public.audit_admin_write();
drop function if exists public.has_admin_permission(text);
drop table if exists public.admin_audit_log;
drop table if exists public.admin_assignments;
commit;
