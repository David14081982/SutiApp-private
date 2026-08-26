begin;

create table public.directory_members (
  id uuid primary key default extensions.gen_random_uuid(),
  name text null,
  role text not null,
  image_url text null,
  legacy_row_id text null,
  sort_order integer not null,
  source_sheet text not null default 'Directorio',
  source_row_ordinal integer not null,
  source_snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint directory_members_sort_order_check check (sort_order > 0),
  constraint directory_members_source_row_check check (source_row_ordinal > 1),
  constraint directory_members_source_hash_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  constraint directory_members_source_unique unique (source_snapshot_hash, source_sheet, source_row_ordinal)
);

create table public.minutes (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null,
  description text null,
  document_url text null,
  image_url text null,
  source_date_raw text null,
  published_on date null,
  sort_order integer not null,
  source_sheet text not null default 'Minutas de acuerdos',
  source_row_ordinal integer not null,
  source_snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint minutes_sort_order_check check (sort_order > 0),
  constraint minutes_source_row_check check (source_row_ordinal > 1),
  constraint minutes_source_hash_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  constraint minutes_source_unique unique (source_snapshot_hash, source_sheet, source_row_ordinal)
);

create table public.institutional_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  kind text not null,
  title text not null,
  description text null,
  document_url text null,
  image_url text null,
  sort_order integer not null,
  source_sheet text not null,
  source_row_ordinal integer not null,
  source_snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institutional_documents_kind_check check (kind in ('download', 'form', 'regulation')),
  constraint institutional_documents_sort_order_check check (sort_order > 0),
  constraint institutional_documents_source_row_check check (source_row_ordinal > 1),
  constraint institutional_documents_source_hash_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  constraint institutional_documents_source_unique unique (source_snapshot_hash, source_sheet, source_row_ordinal)
);

create table public.institutional_programs (
  id uuid primary key default extensions.gen_random_uuid(),
  category text not null,
  description text null,
  primary_image_url text null,
  gallery_image_urls text[] not null default '{}',
  phone_raw text null,
  whatsapp_raw text null,
  facebook_url text null,
  instagram_url text null,
  share_url text null,
  location_raw text null,
  whatsapp_url text null,
  tiktok_url text null,
  sort_order integer not null,
  source_sheet text not null default 'Secretaría de finanzas',
  source_row_ordinal integer not null,
  source_snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institutional_programs_sort_order_check check (sort_order > 0),
  constraint institutional_programs_source_row_check check (source_row_ordinal > 1),
  constraint institutional_programs_source_hash_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  constraint institutional_programs_source_unique unique (source_snapshot_hash, source_sheet, source_row_ordinal)
);

create index directory_members_sort_idx on public.directory_members (sort_order);
create index minutes_published_sort_idx on public.minutes (published_on desc nulls last, sort_order);
create index institutional_documents_kind_sort_idx on public.institutional_documents (kind, sort_order);
create index institutional_programs_sort_idx on public.institutional_programs (sort_order);

create function public.set_h007_content_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger directory_members_set_updated_at before update on public.directory_members
for each row execute function public.set_h007_content_updated_at();
create trigger minutes_set_updated_at before update on public.minutes
for each row execute function public.set_h007_content_updated_at();
create trigger institutional_documents_set_updated_at before update on public.institutional_documents
for each row execute function public.set_h007_content_updated_at();
create trigger institutional_programs_set_updated_at before update on public.institutional_programs
for each row execute function public.set_h007_content_updated_at();

alter table public.directory_members enable row level security;
alter table public.directory_members force row level security;
alter table public.minutes enable row level security;
alter table public.minutes force row level security;
alter table public.institutional_documents enable row level security;
alter table public.institutional_documents force row level security;
alter table public.institutional_programs enable row level security;
alter table public.institutional_programs force row level security;

revoke all on table public.directory_members, public.minutes, public.institutional_documents, public.institutional_programs from public, anon, authenticated;
grant select on table public.directory_members, public.minutes, public.institutional_documents, public.institutional_programs to anon, authenticated;

create policy directory_members_public_read on public.directory_members for select to anon, authenticated using (true);
create policy minutes_public_read on public.minutes for select to anon, authenticated using (true);
create policy institutional_documents_public_read on public.institutional_documents for select to anon, authenticated using (true);
create policy institutional_programs_public_read on public.institutional_programs for select to anon, authenticated using (true);

comment on table public.directory_members is 'Authoritative public directory imported from the bounded Directorio range.';
comment on table public.minutes is 'Authoritative public minutes metadata; historical document URLs are retained, files are not copied.';
comment on table public.institutional_documents is 'Authoritative public institutional document metadata; client writes are intentionally absent.';
comment on table public.institutional_programs is 'Informational program content only; financial investment/yield columns are intentionally excluded.';

commit;
