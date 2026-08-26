begin;

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write',
  'affiliates.read','affiliates.impersonate',
  'news.read','news.write','content.read','content.write'
]::text[]);

do $$
declare admin_count integer;
begin
  select count(*) into admin_count from public.admin_assignments where enabled;
  if admin_count <> 1 then
    raise exception 'PHASE2_ADMIN_PRECONDITION_FAILED: expected exactly one enabled assignment, found %', admin_count;
  end if;
  update public.admin_assignments
  set permissions = array(select distinct p from unnest(permissions || array[
    'news.read','news.write','content.read','content.write'
  ]) p), updated_at = now()
  where enabled;
end $$;

create table public.news_articles (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 180),
  tag text null check (tag is null or length(tag) <= 60),
  body text not null default '',
  image_asset_id uuid null references public.app_assets(id) on delete restrict,
  accent_hue smallint not null default 345 check (accent_hue between 0 and 360),
  display_date date null,
  reading_minutes smallint null check (reading_minutes between 1 and 240),
  published boolean not null default false,
  publish_from timestamptz null,
  publish_until timestamptz null,
  sort_order integer not null check (sort_order > 0),
  record_origin text not null default 'ADMIN_PHASE2' check (record_origin in ('ADMIN_PHASE2','HISTORICAL_IMPORT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_publish_window_check check (publish_until is null or publish_from is null or publish_until > publish_from)
);

create table public.news_settings (
  id text primary key check (id = 'primary'),
  responsible_name text null check (responsible_name is null or length(responsible_name) <= 140),
  responsible_title text null check (responsible_title is null or length(responsible_title) <= 140),
  updated_at timestamptz not null default now()
);
insert into public.news_settings(id) values ('primary');

create table public.educational_resources (
  id uuid primary key default extensions.gen_random_uuid(),
  resource_kind text not null check (resource_kind in ('education','tutorial')),
  title text not null check (length(btrim(title)) between 1 and 180),
  description text null,
  image_asset_id uuid null references public.app_assets(id) on delete restrict,
  document_asset_id uuid null references public.app_assets(id) on delete restrict,
  external_url text null check (external_url is null or external_url ~ '^https://'),
  published boolean not null default false,
  sort_order integer not null check (sort_order > 0),
  provenance text not null default 'ADMIN_PHASE2' check (provenance in ('ADMIN_PHASE2','HISTORICAL_IMPORT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.managed_copy_overrides (
  scope text not null check (length(btrim(scope)) between 1 and 80),
  source_text text not null check (length(source_text) between 1 and 400),
  replacement_text text not null check (length(btrim(replacement_text)) between 1 and 400),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(scope, source_text)
);

create index news_articles_public_order_idx on public.news_articles(published, sort_order);
create index educational_resources_public_order_idx on public.educational_resources(resource_kind, published, sort_order);

create trigger news_articles_updated_at before update on public.news_articles
for each row execute function public.set_h0072_updated_at();
create trigger news_settings_updated_at before update on public.news_settings
for each row execute function public.set_h0072_updated_at();
create trigger educational_resources_updated_at before update on public.educational_resources
for each row execute function public.set_h0072_updated_at();
create trigger managed_copy_overrides_updated_at before update on public.managed_copy_overrides
for each row execute function public.set_h0072_updated_at();

alter table public.news_articles enable row level security;
alter table public.news_articles force row level security;
alter table public.news_settings enable row level security;
alter table public.news_settings force row level security;
alter table public.educational_resources enable row level security;
alter table public.educational_resources force row level security;
alter table public.managed_copy_overrides enable row level security;
alter table public.managed_copy_overrides force row level security;

revoke all on public.news_articles, public.news_settings, public.educational_resources, public.managed_copy_overrides from public, anon, authenticated;
grant select on public.news_articles, public.news_settings, public.educational_resources, public.managed_copy_overrides to authenticated;
grant insert, update, delete on public.news_articles, public.educational_resources, public.managed_copy_overrides to authenticated;
grant update on public.news_settings to authenticated;

create policy news_public_read on public.news_articles for select to authenticated using (
  published and (publish_from is null or publish_from <= now()) and (publish_until is null or publish_until > now())
);
create policy news_admin_read on public.news_articles for select to authenticated using (public.has_admin_permission('news.read'));
create policy news_admin_write on public.news_articles for all to authenticated
using (public.has_admin_permission('news.write')) with check (public.has_admin_permission('news.write'));

create policy news_settings_read on public.news_settings for select to authenticated using (true);
create policy news_settings_admin_update on public.news_settings for update to authenticated
using (public.has_admin_permission('news.write')) with check (public.has_admin_permission('news.write'));

create policy education_public_read on public.educational_resources for select to authenticated using (published);
create policy education_admin_read on public.educational_resources for select to authenticated using (public.has_admin_permission('content.read'));
create policy education_admin_write on public.educational_resources for all to authenticated
using (public.has_admin_permission('content.write')) with check (public.has_admin_permission('content.write'));

create policy copy_public_read on public.managed_copy_overrides for select to authenticated using (enabled);
create policy copy_admin_read on public.managed_copy_overrides for select to authenticated using (public.has_admin_permission('content.read'));
create policy copy_admin_write on public.managed_copy_overrides for all to authenticated
using (public.has_admin_permission('content.write')) with check (public.has_admin_permission('content.write'));

create trigger news_articles_admin_audit after insert or update or delete on public.news_articles
for each row execute function public.audit_admin_write();
create trigger news_settings_admin_audit after update on public.news_settings
for each row execute function public.audit_admin_write();
create trigger educational_resources_admin_audit after insert or update or delete on public.educational_resources
for each row execute function public.audit_admin_write();
create trigger managed_copy_overrides_admin_audit after insert or update or delete on public.managed_copy_overrides
for each row execute function public.audit_admin_write();

comment on table public.news_articles is 'Phase 2 editorial authority. Starts empty; DATA/adminStore seeds are never imported.';
comment on table public.educational_resources is 'Phase 2 education/tutorial authority; approved historical rows are imported unpublished by migration follow-up 00801.';
comment on table public.managed_copy_overrides is 'Only explicit runtime copy overrides. Structural navigation and form labels remain code-owned.';

commit;
