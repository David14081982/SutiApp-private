begin;
drop function if exists public.create_marketplace_benefit_request(uuid,integer,text,text,boolean);
drop function if exists public.respond_marketplace_quote(uuid,numeric,text,date);
drop function if exists public.create_marketplace_quote(uuid,text,text,boolean);
drop function if exists public.update_marketplace_company_profile(uuid,text,text,text,text,text,text,jsonb);
drop function if exists public.is_marketplace_company_member(uuid,text);
drop table if exists public.marketplace_quote_requests;
drop sequence if exists public.marketplace_quote_folio_seq;
drop table if exists public.marketplace_benefit_requests;
drop sequence if exists public.marketplace_request_folio_seq;
drop table if exists public.marketplace_favorites;
drop table if exists public.marketplace_company_favorites;
drop table if exists public.marketplace_promotions;
drop table if exists public.marketplace_product_assets;
drop table if exists public.marketplace_products;
drop table if exists public.marketplace_categories;
drop table if exists public.marketplace_company_memberships;
alter table public.app_assets drop column if exists owner_company_id;
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
update public.admin_assignments set permissions=array(select p from unnest(permissions) p where p not like 'marketplace.%'),updated_at=now();
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write',
  'affiliates.read','affiliates.impersonate','news.read','news.write','content.read','content.write'
]::text[]);
commit;
