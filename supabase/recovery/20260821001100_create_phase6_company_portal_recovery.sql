begin;
drop policy if exists marketplace_memberships_admin_delete on public.marketplace_company_memberships;
drop policy if exists marketplace_memberships_admin_update on public.marketplace_company_memberships;
drop policy if exists marketplace_memberships_admin_insert on public.marketplace_company_memberships;
revoke insert,update,delete on public.marketplace_company_memberships from authenticated;
drop table if exists public.company_portal_subscriptions;
drop table if exists public.company_portal_plans;
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
update public.admin_assignments set permissions=array_remove(array_remove(permissions,'company_portal.read'),'company_portal.write'),updated_at=now();
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write'
]::text[]);
commit;
