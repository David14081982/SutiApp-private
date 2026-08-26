begin;

do $$
begin
  if exists (select 1 from public.companies where record_origin = 'ADMIN_H009')
    or exists (select 1 from public.banners where record_origin = 'ADMIN_H009')
    or exists (select 1 from public.popups where record_origin = 'ADMIN_H009')
    or exists (select 1 from public.institutional_documents where record_origin = 'ADMIN_H009') then
    raise exception 'Recovery blocked: preserve ADMIN_H009 records before reverting nullable provenance columns';
  end if;
end;
$$;

drop function if exists public.replace_company_asset(uuid,uuid,text);
drop index if exists public.companies_enabled_sort_idx;
drop index if exists public.institutional_documents_enabled_kind_sort_idx;
drop index if exists public.banners_historical_source_unique;

drop policy if exists companies_public_read on public.companies;
drop policy if exists companies_admin_read on public.companies;
create policy companies_public_read on public.companies for select to anon, authenticated using (true);
drop policy if exists banners_admin_read on public.banners;
drop policy if exists popups_admin_read on public.popups;
drop policy if exists app_assets_admin_read on public.app_assets;
drop policy if exists institutional_documents_public_read on public.institutional_documents;
drop policy if exists institutional_documents_admin_read on public.institutional_documents;
drop policy if exists institutional_documents_admin_insert on public.institutional_documents;
drop policy if exists institutional_documents_admin_update on public.institutional_documents;
drop policy if exists institutional_documents_admin_delete on public.institutional_documents;
create policy institutional_documents_public_read on public.institutional_documents for select to anon, authenticated using (true);
create policy documents_assets_admin_update on public.institutional_documents for update to authenticated
  using (public.has_admin_permission('documents.write')) with check (public.has_admin_permission('documents.write'));
revoke insert, delete on public.institutional_documents from authenticated;

revoke update(app_name, short_name, description, app_icon_asset_id, institutional_seal_asset_id,
  favicon_asset_id, apple_touch_asset_id, pwa_icon_192_asset_id, pwa_icon_512_asset_id,
  pwa_maskable_512_asset_id, install_screen_1_asset_id, install_screen_2_asset_id,
  install_screen_3_asset_id) on public.app_settings from authenticated;
grant update on public.app_settings to authenticated;
revoke insert(display_name, description, logo_asset_id, sort_order, enabled, record_origin) on public.companies from authenticated;
revoke update(display_name, description, logo_asset_id, sort_order, enabled) on public.companies from authenticated;
revoke insert(placement, title, description, action_label, action_url, company_raw, category_raw,
  image_asset_id, enabled, start_at, end_at, sort_order, record_origin) on public.banners from authenticated;
revoke update(placement, title, description, action_label, action_url, company_raw, category_raw,
  image_asset_id, enabled, start_at, end_at, sort_order) on public.banners from authenticated;
revoke insert(title, body, image_asset_id, action_label, action_url, audience_raw, enabled,
  start_at, end_at, sort_order, record_origin) on public.popups from authenticated;
revoke update(title, body, image_asset_id, action_label, action_url, audience_raw, enabled,
  start_at, end_at, sort_order) on public.popups from authenticated;
grant insert, update, delete on public.companies, public.banners, public.popups to authenticated;
grant update, delete on public.asset_sources to authenticated;
revoke insert(kind, title, description, image_asset_id, document_asset_id, sort_order, enabled, record_origin)
  on public.institutional_documents from authenticated;
revoke update(kind, title, description, image_asset_id, document_asset_id, sort_order, enabled)
  on public.institutional_documents from authenticated;
grant update on public.institutional_documents to authenticated;

alter table public.banners add constraint banners_source_unique unique nulls not distinct
  (source_snapshot_hash, source_sheet, source_row_ordinal, source_column);

alter table public.companies drop constraint companies_record_origin_check;
alter table public.banners drop constraint banners_record_origin_check;
alter table public.popups drop constraint popups_record_origin_check;
alter table public.institutional_documents drop constraint institutional_documents_record_origin_check;
alter table public.companies alter column source_sheet set not null;
alter table public.companies alter column source_row_ordinal set not null;
alter table public.companies alter column source_snapshot_hash set not null;
alter table public.banners alter column source_sheet set not null;
alter table public.banners alter column source_row_ordinal set not null;
alter table public.banners alter column source_snapshot_hash set not null;
alter table public.popups alter column source_sheet set not null;
alter table public.popups alter column source_row_ordinal set not null;
alter table public.popups alter column source_snapshot_hash set not null;
alter table public.institutional_documents alter column source_sheet set not null;
alter table public.institutional_documents alter column source_row_ordinal set not null;
alter table public.institutional_documents alter column source_snapshot_hash set not null;
alter table public.companies drop column record_origin;
alter table public.banners drop column record_origin;
alter table public.popups drop column record_origin;
alter table public.institutional_documents drop column record_origin;
alter table public.companies drop column enabled;
alter table public.institutional_documents drop column enabled;

commit;
