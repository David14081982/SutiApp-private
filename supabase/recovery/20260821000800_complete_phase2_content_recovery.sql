begin;

drop table if exists public.managed_copy_overrides;
drop table if exists public.educational_resources;
drop table if exists public.news_settings;
drop table if exists public.news_articles;

update public.admin_assignments
set permissions = array_remove(array_remove(array_remove(array_remove(permissions,
  'news.read'),'news.write'),'content.read'),'content.write'), updated_at = now();

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write',
  'affiliates.read','affiliates.impersonate'
]::text[]);

commit;
