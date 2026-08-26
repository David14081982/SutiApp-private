begin;

create table public.historical_file_columns (
  id uuid primary key default extensions.gen_random_uuid(),
  source_system text not null,
  source_file text not null,
  source_file_hash text not null,
  source_sheet text not null,
  source_column text not null,
  source_column_letter text not null,
  semantic_name text not null,
  classification text not null,
  target_domain text not null,
  target_relation text not null,
  ownership_status text not null,
  rows_with_files integer not null,
  urls_parsed integer not null,
  status text not null default 'DISCOVERED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint historical_file_columns_hash_check check (source_file_hash ~ '^[A-F0-9]{64}$'),
  constraint historical_file_columns_classification_check check (classification in ('PUBLIC','PRIVATE')),
  constraint historical_file_columns_counts_check check (rows_with_files >= 0 and urls_parsed >= rows_with_files),
  constraint historical_file_columns_status_check check (status in ('DISCOVERED','IN_PROGRESS','RECONCILED','PARTIAL','FAILED')),
  constraint historical_file_columns_source_unique unique
    (source_system, source_file_hash, source_sheet, source_column_letter)
);

create table public.private_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  asset_key text not null unique,
  asset_type text not null,
  title text null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null,
  content_sha256 text not null,
  status text not null default 'READY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_assets_bucket_check check (storage_bucket = 'private-assets'),
  constraint private_assets_path_check check (storage_path <> '' and storage_path !~ '(^|/)\.\.(/|$)'),
  constraint private_assets_hash_check check (content_sha256 ~ '^[A-F0-9]{64}$'),
  constraint private_assets_size_check check (file_size > 0 and file_size <= 104857600),
  constraint private_assets_status_check check (status in ('READY','DISABLED')),
  constraint private_assets_hash_unique unique (content_sha256),
  constraint private_assets_storage_unique unique (storage_bucket, storage_path)
);

create table public.historical_asset_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  public_asset_id uuid null references public.app_assets(id) on delete restrict,
  private_asset_id uuid null references public.private_assets(id) on delete restrict,
  source_system text not null,
  source_file text not null,
  source_file_hash text not null,
  source_sheet text not null,
  source_row_ordinal integer not null,
  source_column text not null,
  source_column_letter text not null,
  semantic_name text not null,
  file_key text not null,
  title text null,
  source_url text not null,
  source_url_sha256 text not null,
  url_order integer not null default 1,
  classification text not null,
  domain_raw text not null,
  target_domain text not null,
  target_relation text not null,
  expected_owner text not null,
  ownership_status text not null,
  linked_entity_table text null,
  linked_entity_id uuid null,
  migration_status text not null,
  failure_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint historical_asset_sources_hash_check check (source_file_hash ~ '^[A-F0-9]{64}$'),
  constraint historical_asset_sources_url_hash_check check (source_url_sha256 ~ '^[A-F0-9]{64}$'),
  constraint historical_asset_sources_row_check check (source_row_ordinal > 0 and url_order > 0),
  constraint historical_asset_sources_classification_check check (classification in ('PUBLIC','PRIVATE')),
  constraint historical_asset_sources_status_check check (migration_status in (
    'DISCOVERED','UPLOADED','LINKED','PENDING_DOMAIN_LINK','PENDING_AFFILIATE_LINK','FAILED'
  )),
  constraint historical_asset_sources_asset_check check (
    (migration_status = 'FAILED' and public_asset_id is null and private_asset_id is null)
    or
    (migration_status <> 'FAILED' and ((public_asset_id is null) <> (private_asset_id is null)))
  ),
  constraint historical_asset_sources_visibility_check check (
    (classification = 'PUBLIC' and private_asset_id is null)
    or (classification = 'PRIVATE' and public_asset_id is null)
  ),
  constraint historical_asset_sources_failure_check check (
    (migration_status = 'FAILED') = (failure_code is not null)
  ),
  constraint historical_asset_sources_source_unique unique
    (source_system, source_file_hash, source_sheet, source_row_ordinal, source_column_letter, url_order, source_url_sha256)
);

create table public.affiliate_files (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  numero_control text null,
  public_asset_id uuid null references public.app_assets(id) on delete restrict,
  private_asset_id uuid null references public.private_assets(id) on delete restrict,
  classification text not null,
  file_key text not null,
  file_type text not null,
  source_column text not null,
  source_column_letter text not null,
  title text null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  sha256 text not null,
  file_size bigint not null,
  source_url text not null,
  source_row_ordinal integer not null,
  source_file_hash text not null,
  url_order integer not null default 1,
  status text not null default 'READY',
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_files_control_check check (numero_control is null or numero_control <> ''),
  constraint affiliate_files_asset_check check ((public_asset_id is null) <> (private_asset_id is null)),
  constraint affiliate_files_classification_check check (
    (classification = 'PUBLIC' and public_asset_id is not null and private_asset_id is null)
    or (classification = 'PRIVATE' and public_asset_id is null and private_asset_id is not null)
  ),
  constraint affiliate_files_bucket_check check (
    (classification = 'PRIVATE' and storage_bucket = 'private-assets') or classification = 'PUBLIC'
  ),
  constraint affiliate_files_hash_check check (sha256 ~ '^[A-F0-9]{64}$' and source_file_hash ~ '^[A-F0-9]{64}$'),
  constraint affiliate_files_size_check check (file_size > 0 and file_size <= 104857600),
  constraint affiliate_files_order_check check (source_row_ordinal > 0 and url_order > 0 and sort_order > 0),
  constraint affiliate_files_status_check check (status in ('READY','DISABLED')),
  constraint affiliate_files_source_unique unique
    (source_file_hash, source_row_ordinal, source_column_letter, url_order)
);

create index historical_file_columns_status_idx on public.historical_file_columns(status, classification);
create index private_assets_status_hash_idx on public.private_assets(status, content_sha256);
create index historical_asset_sources_status_idx on public.historical_asset_sources(migration_status, classification);
create index historical_asset_sources_public_asset_idx on public.historical_asset_sources(public_asset_id) where public_asset_id is not null;
create index historical_asset_sources_private_asset_idx on public.historical_asset_sources(private_asset_id) where private_asset_id is not null;
create index affiliate_files_affiliate_key_idx on public.affiliate_files(affiliate_id, file_key, sort_order);
create index affiliate_files_private_asset_idx on public.affiliate_files(private_asset_id);
create index affiliate_files_public_asset_idx on public.affiliate_files(public_asset_id);

create function public.set_master_asset_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

create trigger historical_file_columns_updated_at before update on public.historical_file_columns
for each row execute function public.set_master_asset_updated_at();
create trigger private_assets_updated_at before update on public.private_assets
for each row execute function public.set_master_asset_updated_at();
create trigger historical_asset_sources_updated_at before update on public.historical_asset_sources
for each row execute function public.set_master_asset_updated_at();
create trigger affiliate_files_updated_at before update on public.affiliate_files
for each row execute function public.set_master_asset_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-assets', 'private-assets', false, 104857600, array[
  'image/png','image/jpeg','image/gif','image/webp','image/svg+xml','image/heic','image/heif',
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv','application/zip','application/x-rar-compressed'
]) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-assets', 'public-assets', true, 104857600, array[
  'image/png','image/jpeg','image/gif','image/webp','image/svg+xml','image/heic','image/heif',
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv','application/zip','application/x-rar-compressed'
]) on conflict (id) do nothing;

alter table public.historical_file_columns enable row level security;
alter table public.historical_file_columns force row level security;
alter table public.private_assets enable row level security;
alter table public.private_assets force row level security;
alter table public.historical_asset_sources enable row level security;
alter table public.historical_asset_sources force row level security;
alter table public.affiliate_files enable row level security;
alter table public.affiliate_files force row level security;

revoke all on public.historical_file_columns, public.private_assets,
  public.historical_asset_sources, public.affiliate_files from public, anon, authenticated;

grant select on public.historical_file_columns, public.historical_asset_sources to authenticated;
grant select on public.private_assets to authenticated;
grant select (id, affiliate_id, numero_control, public_asset_id, private_asset_id, classification, file_key, file_type,
  source_column, source_column_letter, title, storage_bucket, storage_path, mime_type, sha256, file_size,
  source_row_ordinal, url_order, status, sort_order, created_at, updated_at)
  on public.affiliate_files to authenticated;

create policy historical_file_columns_admin_read on public.historical_file_columns
for select to authenticated using (public.has_admin_permission('assets.read'));
create policy historical_asset_sources_admin_read on public.historical_asset_sources
for select to authenticated using (public.has_admin_permission('assets.read'));
create policy private_assets_authorized_read on public.private_assets
for select to authenticated using (
  public.has_admin_permission('assets.read')
  or exists (
    select 1 from public.affiliate_files af
    where af.private_asset_id = private_assets.id
      and af.affiliate_id = public.get_effective_affiliate_id()
      and af.status = 'READY'
  )
);
create policy affiliate_files_authorized_read on public.affiliate_files
for select to authenticated using (
  public.has_admin_permission('assets.read')
  or affiliate_id = public.get_effective_affiliate_id()
);

create policy master_private_storage_authorized_read on storage.objects
for select to authenticated using (
  bucket_id = 'private-assets' and (
    public.has_admin_permission('assets.read')
    or exists (
      select 1
      from public.private_assets pa
      join public.affiliate_files af on af.private_asset_id = pa.id
      where pa.storage_bucket = bucket_id
        and pa.storage_path = name
        and pa.status = 'READY'
        and af.status = 'READY'
        and af.affiliate_id = public.get_effective_affiliate_id()
    )
  )
);

create policy master_public_storage_read on storage.objects
for select to anon, authenticated using (bucket_id = 'public-assets');

comment on table public.historical_file_columns is 'Complete semantic catalog of historical columns containing physical file references; no raw PII values.';
comment on table public.historical_asset_sources is 'Administrative-only provenance and migration status. source_url is never runtime or fallback.';
comment on table public.private_assets is 'Physical registry for PII/private objects in non-public Supabase Storage.';
comment on table public.affiliate_files is 'Semantic affiliate-to-file relation keyed by affiliate UUID; numero_control remains exact historical TEXT provenance.';

commit;
