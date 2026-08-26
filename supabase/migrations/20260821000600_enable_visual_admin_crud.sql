begin;

alter table public.companies add column enabled boolean not null default true;
alter table public.institutional_documents add column enabled boolean not null default true;

alter table public.companies add column record_origin text not null default 'HISTORICAL_IMPORT';
alter table public.banners add column record_origin text not null default 'HISTORICAL_IMPORT';
alter table public.popups add column record_origin text not null default 'HISTORICAL_IMPORT';
alter table public.institutional_documents add column record_origin text not null default 'HISTORICAL_IMPORT';

alter table public.companies alter column source_sheet drop not null;
alter table public.companies alter column source_row_ordinal drop not null;
alter table public.companies alter column source_snapshot_hash drop not null;
alter table public.banners alter column source_sheet drop not null;
alter table public.banners alter column source_row_ordinal drop not null;
alter table public.banners alter column source_snapshot_hash drop not null;
alter table public.popups alter column source_sheet drop not null;
alter table public.popups alter column source_row_ordinal drop not null;
alter table public.popups alter column source_snapshot_hash drop not null;
alter table public.institutional_documents alter column source_sheet drop not null;
alter table public.institutional_documents alter column source_row_ordinal drop not null;
alter table public.institutional_documents alter column source_snapshot_hash drop not null;

alter table public.companies add constraint companies_record_origin_check check (
  (record_origin = 'HISTORICAL_IMPORT' and source_sheet is not null and source_row_ordinal is not null and source_snapshot_hash is not null)
  or (record_origin = 'ADMIN_H009' and source_sheet is null and source_row_ordinal is null and source_snapshot_hash is null)
);
alter table public.banners add constraint banners_record_origin_check check (
  (record_origin = 'HISTORICAL_IMPORT' and source_sheet is not null and source_row_ordinal is not null and source_snapshot_hash is not null)
  or (record_origin = 'ADMIN_H009' and source_sheet is null and source_row_ordinal is null and source_snapshot_hash is null)
);
alter table public.popups add constraint popups_record_origin_check check (
  (record_origin = 'HISTORICAL_IMPORT' and source_sheet is not null and source_row_ordinal is not null and source_snapshot_hash is not null)
  or (record_origin = 'ADMIN_H009' and source_sheet is null and source_row_ordinal is null and source_snapshot_hash is null)
);
alter table public.institutional_documents add constraint institutional_documents_record_origin_check check (
  (record_origin = 'HISTORICAL_IMPORT' and source_sheet is not null and source_row_ordinal is not null and source_snapshot_hash is not null)
  or (record_origin = 'ADMIN_H009' and source_sheet is null and source_row_ordinal is null and source_snapshot_hash is null)
);

alter table public.banners drop constraint banners_source_unique;
create unique index banners_historical_source_unique on public.banners
  (source_snapshot_hash, source_sheet, source_row_ordinal, source_column)
  nulls not distinct where record_origin = 'HISTORICAL_IMPORT';

drop policy companies_public_read on public.companies;
create policy companies_public_read on public.companies for select to anon, authenticated using (enabled);
create policy companies_admin_read on public.companies for select to authenticated
  using (public.has_admin_permission('companies.read'));
create policy banners_admin_read on public.banners for select to authenticated
  using (public.has_admin_permission('banners.read'));
create policy popups_admin_read on public.popups for select to authenticated
  using (public.has_admin_permission('popups.read'));
create policy app_assets_admin_read on public.app_assets for select to authenticated
  using (public.has_admin_permission('assets.read'));

drop policy institutional_documents_public_read on public.institutional_documents;
create policy institutional_documents_public_read on public.institutional_documents
  for select to anon, authenticated using (enabled);
create policy institutional_documents_admin_read on public.institutional_documents
  for select to authenticated using (public.has_admin_permission('documents.read'));
drop policy documents_assets_admin_update on public.institutional_documents;
create policy institutional_documents_admin_insert on public.institutional_documents
  for insert to authenticated with check (public.has_admin_permission('documents.write'));
create policy institutional_documents_admin_update on public.institutional_documents
  for update to authenticated using (public.has_admin_permission('documents.write'))
  with check (public.has_admin_permission('documents.write'));
create policy institutional_documents_admin_delete on public.institutional_documents
  for delete to authenticated using (public.has_admin_permission('documents.write'));
revoke update on public.app_settings from authenticated;
grant update(app_name, short_name, description, app_icon_asset_id, institutional_seal_asset_id,
  favicon_asset_id, apple_touch_asset_id, pwa_icon_192_asset_id, pwa_icon_512_asset_id,
  pwa_maskable_512_asset_id, install_screen_1_asset_id, install_screen_2_asset_id,
  install_screen_3_asset_id) on public.app_settings to authenticated;

revoke insert, update, delete on public.companies, public.banners, public.popups from authenticated;
grant insert(display_name, description, logo_asset_id, sort_order, enabled, record_origin)
  on public.companies to authenticated;
grant update(display_name, description, logo_asset_id, sort_order, enabled)
  on public.companies to authenticated;
grant insert(placement, title, description, action_label, action_url, company_raw, category_raw,
  image_asset_id, enabled, start_at, end_at, sort_order, record_origin) on public.banners to authenticated;
grant update(placement, title, description, action_label, action_url, company_raw, category_raw,
  image_asset_id, enabled, start_at, end_at, sort_order) on public.banners to authenticated;
grant insert(title, body, image_asset_id, action_label, action_url, audience_raw, enabled,
  start_at, end_at, sort_order, record_origin) on public.popups to authenticated;
grant update(title, body, image_asset_id, action_label, action_url, audience_raw, enabled,
  start_at, end_at, sort_order) on public.popups to authenticated;

revoke update, delete on public.asset_sources from authenticated;
revoke insert, update, delete on public.institutional_documents from authenticated;
grant insert(kind, title, description, image_asset_id, document_asset_id, sort_order, enabled, record_origin)
  on public.institutional_documents to authenticated;
grant update(kind, title, description, image_asset_id, document_asset_id, sort_order, enabled)
  on public.institutional_documents to authenticated;

create function public.replace_company_asset(p_company_id uuid, p_asset_id uuid, p_role text)
returns void language plpgsql set search_path = ''
as $$
begin
  if p_role not in ('logo','cover') then raise exception 'unsupported company asset role'; end if;
  if not public.has_admin_permission('companies.write') then raise exception 'admin permission denied'; end if;
  delete from public.company_assets where company_id = p_company_id and role = p_role;
  insert into public.company_assets(company_id, asset_id, role, sort_order)
  values (p_company_id, p_asset_id, p_role, 1);
  if p_role = 'logo' then
    update public.companies set logo_asset_id = p_asset_id where id = p_company_id;
  end if;
end;
$$;
revoke all on function public.replace_company_asset(uuid,uuid,text) from public, anon;
grant execute on function public.replace_company_asset(uuid,uuid,text) to authenticated;

create index companies_enabled_sort_idx on public.companies(enabled, sort_order);
create index institutional_documents_enabled_kind_sort_idx on public.institutional_documents(enabled, kind, sort_order);

comment on column public.companies.record_origin is 'HISTORICAL_IMPORT preserves source coordinates; ADMIN_H009 is direct authoritative admin content without invented historical provenance.';
comment on column public.institutional_documents.enabled is 'Administrative publication state; disabled rows remain authoritative but are hidden from public readers.';

commit;
