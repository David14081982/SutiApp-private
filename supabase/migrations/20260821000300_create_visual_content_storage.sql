begin;

create table public.app_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  asset_key text not null unique,
  asset_type text not null,
  title text null,
  alt_text text null,
  storage_bucket text null,
  storage_path text null,
  mime_type text null,
  file_size bigint null,
  content_sha256 text null,
  status text not null default 'READY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_assets_status_check check (status in ('READY', 'IMPORT_FAILED', 'DISABLED')),
  constraint app_assets_storage_pair_check check ((storage_bucket is null) = (storage_path is null)),
  constraint app_assets_hash_check check (content_sha256 is null or content_sha256 ~ '^[A-F0-9]{64}$'),
  constraint app_assets_file_size_check check (file_size is null or file_size >= 0),
  constraint app_assets_storage_unique unique (storage_bucket, storage_path)
);

create table public.asset_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  asset_id uuid not null references public.app_assets(id) on delete cascade,
  source_url text null,
  source_sheet text null,
  source_row_ordinal integer null,
  source_column text null,
  source_snapshot_hash text not null,
  created_at timestamptz not null default now(),
  constraint asset_sources_row_check check (source_row_ordinal is null or source_row_ordinal > 0),
  constraint asset_sources_hash_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  constraint asset_sources_unique unique nulls not distinct
    (asset_id, source_sheet, source_row_ordinal, source_column, source_url, source_snapshot_hash)
);

create table public.companies (
  id uuid primary key default extensions.gen_random_uuid(),
  legal_name text null,
  display_name text not null,
  description text null,
  category_raw text null,
  contact_name text null,
  phone_raw text null,
  whatsapp_raw text null,
  email_raw text null,
  website_url text null,
  address_raw text null,
  location_raw text null,
  social_links jsonb not null default '{}'::jsonb,
  status_raw text null,
  logo_asset_id uuid null references public.app_assets(id) on delete set null,
  sort_order integer not null,
  source_sheet text not null,
  source_row_ordinal integer not null,
  source_snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_sort_check check (sort_order > 0),
  constraint companies_source_row_check check (source_row_ordinal > 1),
  constraint companies_source_hash_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  constraint companies_source_unique unique (source_snapshot_hash, source_sheet, source_row_ordinal)
);

create table public.company_assets (
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.app_assets(id) on delete restrict,
  role text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (company_id, asset_id, role),
  constraint company_assets_role_check check (role in ('logo', 'cover', 'gallery', 'promotion')),
  constraint company_assets_sort_check check (sort_order > 0)
);

create table public.banners (
  id uuid primary key default extensions.gen_random_uuid(),
  placement text not null,
  title text null,
  description text null,
  action_label text null,
  action_url text null,
  company_raw text null,
  category_raw text null,
  image_asset_id uuid not null references public.app_assets(id) on delete restrict,
  enabled boolean not null default false,
  start_at timestamptz null,
  end_at timestamptz null,
  sort_order integer not null,
  source_sheet text not null,
  source_row_ordinal integer not null,
  source_column text null,
  source_snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banners_placement_check check (placement in ('home', 'marketplace')),
  constraint banners_sort_check check (sort_order > 0),
  constraint banners_source_hash_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  constraint banners_source_unique unique nulls not distinct
    (source_snapshot_hash, source_sheet, source_row_ordinal, source_column)
);

create table public.popups (
  id uuid primary key default extensions.gen_random_uuid(),
  title text null,
  body text null,
  image_asset_id uuid null references public.app_assets(id) on delete set null,
  action_label text null,
  action_url text null,
  audience_raw jsonb null,
  enabled boolean not null default false,
  start_at timestamptz null,
  end_at timestamptz null,
  sort_order integer not null,
  source_sheet text not null,
  source_row_ordinal integer not null,
  source_snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint popups_sort_check check (sort_order > 0),
  constraint popups_source_hash_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  constraint popups_source_unique unique (source_snapshot_hash, source_sheet, source_row_ordinal)
);

alter table public.directory_members add column image_asset_id uuid null references public.app_assets(id) on delete set null;
alter table public.minutes add column image_asset_id uuid null references public.app_assets(id) on delete set null;
alter table public.minutes add column document_asset_id uuid null references public.app_assets(id) on delete set null;
alter table public.institutional_documents add column image_asset_id uuid null references public.app_assets(id) on delete set null;
alter table public.institutional_documents add column document_asset_id uuid null references public.app_assets(id) on delete set null;
alter table public.institutional_programs add column primary_image_asset_id uuid null references public.app_assets(id) on delete set null;

create index app_assets_key_status_idx on public.app_assets (asset_key, status);
create index asset_sources_asset_idx on public.asset_sources (asset_id);
create index companies_sort_idx on public.companies (sort_order);
create index banners_placement_sort_idx on public.banners (placement, enabled, sort_order);
create index popups_enabled_sort_idx on public.popups (enabled, sort_order);

create function public.set_h0072_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_assets_set_updated_at before update on public.app_assets
for each row execute function public.set_h0072_updated_at();
create trigger companies_set_updated_at before update on public.companies
for each row execute function public.set_h0072_updated_at();
create trigger banners_set_updated_at before update on public.banners
for each row execute function public.set_h0072_updated_at();
create trigger popups_set_updated_at before update on public.popups
for each row execute function public.set_h0072_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('app-assets', 'app-assets', true, 10485760, array['image/png','image/jpeg','image/gif','image/webp','image/svg+xml','image/x-icon']),
  ('company-assets', 'company-assets', true, 10485760, array['image/png','image/jpeg','image/gif','image/webp','image/svg+xml']),
  ('documents', 'documents', true, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.app_assets enable row level security;
alter table public.app_assets force row level security;
alter table public.asset_sources enable row level security;
alter table public.asset_sources force row level security;
alter table public.companies enable row level security;
alter table public.companies force row level security;
alter table public.company_assets enable row level security;
alter table public.company_assets force row level security;
alter table public.banners enable row level security;
alter table public.banners force row level security;
alter table public.popups enable row level security;
alter table public.popups force row level security;

revoke all on table public.app_assets, public.asset_sources, public.companies,
  public.company_assets, public.banners, public.popups from public, anon, authenticated;
grant select on table public.app_assets, public.companies, public.company_assets,
  public.banners, public.popups to anon, authenticated;

create policy app_assets_public_read on public.app_assets for select to anon, authenticated using (status = 'READY');
create policy companies_public_read on public.companies for select to anon, authenticated using (true);
create policy company_assets_public_read on public.company_assets for select to anon, authenticated using (true);
create policy banners_public_read on public.banners for select to anon, authenticated using (enabled = true);
create policy popups_public_read on public.popups for select to anon, authenticated using (enabled = true);

create policy h0072_storage_public_read on storage.objects for select to anon, authenticated
using (bucket_id in ('app-assets', 'company-assets', 'documents'));

comment on table public.app_assets is 'Single runtime registry for H-007.2 visual and document assets; historical URLs live only in asset_sources provenance.';
comment on table public.asset_sources is 'Administrative provenance; intentionally not readable by browser roles.';
comment on column public.companies.category_raw is 'Historical category text only; not a catalog authority or foreign key.';
comment on column public.banners.category_raw is 'Historical category text only; H-007.1 catalogs remain blocked.';

commit;
