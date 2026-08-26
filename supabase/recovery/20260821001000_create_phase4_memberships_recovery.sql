begin;
drop table if exists public.membership_offerings;
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
update public.admin_assignments set permissions=array(select p from unnest(permissions) p where p not like 'memberships.%'),updated_at=now();
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write'
]::text[]);
commit;
