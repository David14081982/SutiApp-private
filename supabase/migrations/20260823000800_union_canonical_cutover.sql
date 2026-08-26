begin;

-- Comité remains institutional content and joins the existing documents section boundary.
update public.admin_section_definitions
set data_boundary='institutional_documents + directory_members',updated_at=now()
where section_key='documents';

alter table public.directory_members add column if not exists enabled boolean not null default true;
alter table public.directory_members add column if not exists record_origin text not null default 'HISTORICAL_IMPORT';
alter table public.directory_members alter column source_sheet drop not null;
alter table public.directory_members alter column source_sheet drop default;
alter table public.directory_members alter column source_row_ordinal drop not null;
alter table public.directory_members alter column source_snapshot_hash drop not null;
alter table public.directory_members drop constraint if exists directory_members_record_origin_check;
alter table public.directory_members add constraint directory_members_record_origin_check check (
  (record_origin='HISTORICAL_IMPORT' and source_sheet is not null and source_row_ordinal is not null and source_snapshot_hash is not null)
  or (record_origin='ADMIN_SECTION_ROLLOUT' and source_sheet is null and source_row_ordinal is null and source_snapshot_hash is null)
);
create index if not exists directory_members_enabled_sort_idx on public.directory_members(enabled,sort_order);

drop policy if exists directory_assets_admin_update on public.directory_members;
drop policy if exists directory_members_public_read on public.directory_members;
create policy directory_members_public_read on public.directory_members for select to anon,authenticated using(enabled);
create policy directory_members_section_read on public.directory_members for select to authenticated
  using(public.has_admin_permission('documents.read') or public.has_section_action('documents','read'));
create policy directory_members_section_insert on public.directory_members for insert to authenticated
  with check(public.has_admin_permission('documents.write') or public.has_section_action('documents','create'));
create policy directory_members_section_update on public.directory_members for update to authenticated
  using(public.has_admin_permission('documents.write') or public.has_section_action('documents','update') or public.has_section_action('documents','publish') or public.has_section_action('documents','order') or public.has_section_action('documents','assets'))
  with check(public.has_admin_permission('documents.write') or public.has_section_action('documents','update') or public.has_section_action('documents','publish') or public.has_section_action('documents','order') or public.has_section_action('documents','assets'));
create policy directory_members_section_delete on public.directory_members for delete to authenticated
  using(record_origin='ADMIN_SECTION_ROLLOUT' and (public.has_admin_permission('documents.write') or public.has_section_action('documents','delete')));

revoke insert,update,delete on public.directory_members from authenticated;
grant insert(name,role,sort_order,image_asset_id,enabled,record_origin),
  update(name,role,sort_order,image_asset_id,enabled),delete on public.directory_members to authenticated;

drop trigger if exists directory_members_section_action_guard on public.directory_members;
create trigger directory_members_section_action_guard before insert or update or delete on public.directory_members
for each row execute function public.enforce_section_row_action('documents','documents.write','enabled','sort_order','image_asset_id','record_origin','ADMIN_SECTION_ROLLOUT');
drop trigger if exists directory_members_section_action_audit on public.directory_members;
create trigger directory_members_section_action_audit after insert or update or delete on public.directory_members
for each row execute function public.audit_section_row_action('documents','enabled','sort_order','image_asset_id');

-- The three union-owned screens persist header and block relations, never browser/local blobs.
alter table public.union_screen_content add column if not exists header_asset_id uuid null;
alter table public.union_screen_content drop constraint if exists union_screen_content_header_asset_id_fkey;
alter table public.union_screen_content add constraint union_screen_content_header_asset_id_fkey
  foreign key(header_asset_id) references public.app_assets(id) on delete restrict;
create index if not exists union_screen_content_header_asset_idx on public.union_screen_content(header_asset_id) where header_asset_id is not null;

-- Dedicated paths let existing union_content ownership write only its own new assets.
create policy union_assets_insert on public.app_assets for insert to authenticated with check(
  public.has_admin_permission('union_content.write') and split_part(storage_path,'/',1)='sindicato'
  and split_part(storage_path,'/',2)=auth.uid()::text and storage_bucket in('app-assets','documents'));
create policy union_assets_update on public.app_assets for update to authenticated using(
  public.has_admin_permission('union_content.write') and split_part(storage_path,'/',1)='sindicato'
  and split_part(storage_path,'/',2)=auth.uid()::text) with check(
  public.has_admin_permission('union_content.write') and split_part(storage_path,'/',1)='sindicato'
  and split_part(storage_path,'/',2)=auth.uid()::text and storage_bucket in('app-assets','documents'));
create policy union_assets_delete on public.app_assets for delete to authenticated using(
  public.has_admin_permission('union_content.write') and split_part(storage_path,'/',1)='sindicato'
  and split_part(storage_path,'/',2)=auth.uid()::text);
create policy union_asset_sources_insert on public.asset_sources for insert to authenticated with check(
  exists(select 1 from public.app_assets a where a.id=asset_id and split_part(a.storage_path,'/',1)='sindicato'
    and split_part(a.storage_path,'/',2)=auth.uid()::text and public.has_admin_permission('union_content.write')));
create policy union_storage_insert on storage.objects for insert to authenticated with check(
  public.has_admin_permission('union_content.write') and (storage.foldername(name))[1]='sindicato'
  and (storage.foldername(name))[2]=auth.uid()::text and bucket_id in('app-assets','documents'));
create policy union_storage_update on storage.objects for update to authenticated using(
  public.has_admin_permission('union_content.write') and (storage.foldername(name))[1]='sindicato'
  and (storage.foldername(name))[2]=auth.uid()::text) with check(
  public.has_admin_permission('union_content.write') and (storage.foldername(name))[1]='sindicato'
  and (storage.foldername(name))[2]=auth.uid()::text and bucket_id in('app-assets','documents'));
create policy union_storage_delete on storage.objects for delete to authenticated using(
  public.has_admin_permission('union_content.write') and (storage.foldername(name))[1]='sindicato'
  and (storage.foldername(name))[2]=auth.uid()::text);

-- Directory photos use the documents ownership boundary but a distinct Storage path.
create policy directory_assets_insert on public.app_assets for insert to authenticated with check(
  (public.has_admin_permission('documents.write') or public.has_section_action('documents','assets'))
  and split_part(storage_path,'/',1)='directory' and split_part(storage_path,'/',2)=auth.uid()::text and storage_bucket='app-assets');
create policy directory_assets_update on public.app_assets for update to authenticated using(
  (public.has_admin_permission('documents.write') or public.has_section_action('documents','assets'))
  and split_part(storage_path,'/',1)='directory' and split_part(storage_path,'/',2)=auth.uid()::text) with check(
  (public.has_admin_permission('documents.write') or public.has_section_action('documents','assets'))
  and split_part(storage_path,'/',1)='directory' and split_part(storage_path,'/',2)=auth.uid()::text and storage_bucket='app-assets');
create policy directory_assets_delete on public.app_assets for delete to authenticated using(
  (public.has_admin_permission('documents.write') or public.has_section_action('documents','assets'))
  and split_part(storage_path,'/',1)='directory' and split_part(storage_path,'/',2)=auth.uid()::text);
create policy directory_asset_sources_insert on public.asset_sources for insert to authenticated with check(
  exists(select 1 from public.app_assets a where a.id=asset_id and split_part(a.storage_path,'/',1)='directory'
    and split_part(a.storage_path,'/',2)=auth.uid()::text
    and (public.has_admin_permission('documents.write') or public.has_section_action('documents','assets'))));
create policy directory_storage_insert on storage.objects for insert to authenticated with check(
  (public.has_admin_permission('documents.write') or public.has_section_action('documents','assets'))
  and (storage.foldername(name))[1]='directory' and (storage.foldername(name))[2]=auth.uid()::text and bucket_id='app-assets');
create policy directory_storage_update on storage.objects for update to authenticated using(
  (public.has_admin_permission('documents.write') or public.has_section_action('documents','assets'))
  and (storage.foldername(name))[1]='directory' and (storage.foldername(name))[2]=auth.uid()::text) with check(
  (public.has_admin_permission('documents.write') or public.has_section_action('documents','assets'))
  and (storage.foldername(name))[1]='directory' and (storage.foldername(name))[2]=auth.uid()::text and bucket_id='app-assets');
create policy directory_storage_delete on storage.objects for delete to authenticated using(
  (public.has_admin_permission('documents.write') or public.has_section_action('documents','assets'))
  and (storage.foldername(name))[1]='directory' and (storage.foldername(name))[2]=auth.uid()::text);

comment on column public.directory_members.record_origin is 'Historical rows preserve source coordinates; new Committee rows use ADMIN_SECTION_ROLLOUT.';
comment on column public.union_screen_content.header_asset_id is 'Authoritative app_assets relation for the union screen header; never a data URL or browser store.';

commit;
