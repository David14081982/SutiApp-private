begin;

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write',
  'affiliates.read','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write'
]::text[]);

do $$
declare admin_count integer;
begin
  select count(*) into admin_count from public.admin_assignments where enabled;
  if admin_count <> 1 then
    raise exception 'PHASE3_ADMIN_PRECONDITION_FAILED: expected exactly one enabled assignment, found %', admin_count;
  end if;
  update public.admin_assignments
  set permissions = array(select distinct p from unnest(permissions || array[
    'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write'
  ]) p), updated_at=now()
  where enabled;
end $$;

alter table public.app_assets add column owner_company_id uuid null references public.companies(id) on delete restrict;

create table public.marketplace_company_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','quotes')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id, company_id)
);

create function public.is_marketplace_company_member(p_company_id uuid, p_capability text default 'read')
returns boolean language sql stable security definer set search_path=''
as $$
  select exists (
    select 1 from public.marketplace_company_memberships m
    where m.auth_user_id=(select auth.uid()) and m.company_id=p_company_id and m.enabled
      and (p_capability='read' or m.role in ('owner','editor') or (p_capability='quotes' and m.role='quotes'))
  );
$$;

create table public.marketplace_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_id uuid null references public.marketplace_categories(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text null,
  category_raw text null,
  subcategory_raw text null,
  image_asset_id uuid null references public.app_assets(id) on delete restrict,
  enabled boolean not null default true,
  sort_order integer not null check (sort_order > 0),
  record_origin text not null default 'ADMIN_PHASE3' check (record_origin in ('HISTORICAL_IMPORT','ADMIN_PHASE3')),
  source_sheet text null,
  source_row_ordinal integer null,
  source_snapshot_hash text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_categories_not_self check (parent_id is null or parent_id <> id),
  constraint marketplace_categories_history check (
    (record_origin='HISTORICAL_IMPORT' and source_sheet is not null and source_row_ordinal > 1 and source_snapshot_hash ~ '^[A-F0-9]{64}$')
    or (record_origin='ADMIN_PHASE3' and source_sheet is null and source_row_ordinal is null and source_snapshot_hash is null)
  )
);

create table public.marketplace_products (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  category_id uuid null references public.marketplace_categories(id) on delete restrict,
  subcategory_id uuid null references public.marketplace_categories(id) on delete restrict,
  category_raw text null,
  subcategory_raw text null,
  name text not null check (length(btrim(name)) between 1 and 180),
  short_description text null check (short_description is null or length(short_description) <= 180),
  description text not null default '',
  price numeric(14,2) null check (price is null or price >= 0),
  discount_percent numeric(5,2) null check (discount_percent is null or discount_percent between 0 and 100),
  stock integer null check (stock is null or stock >= 0),
  rating numeric(2,1) null check (rating is null or rating between 0 and 5),
  condition_raw text null,
  free_shipping boolean null,
  sizes jsonb not null default '[]'::jsonb check (jsonb_typeof(sizes)='array'),
  colors jsonb not null default '[]'::jsonb check (jsonb_typeof(colors)='array'),
  requires_quote boolean not null default false,
  badge text null check (badge is null or length(badge) <= 30),
  enabled boolean not null default true,
  sort_order integer not null check (sort_order > 0),
  record_origin text not null default 'ADMIN_PHASE3' check (record_origin in ('HISTORICAL_IMPORT','ADMIN_PHASE3')),
  source_sheet text null,
  source_row_ordinal integer null,
  source_snapshot_hash text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_products_price_quote check (requires_quote or price is not null),
  constraint marketplace_products_history check (
    (record_origin='HISTORICAL_IMPORT' and source_sheet is not null and source_row_ordinal > 1 and source_snapshot_hash ~ '^[A-F0-9]{64}$')
    or (record_origin='ADMIN_PHASE3' and source_sheet is null and source_row_ordinal is null and source_snapshot_hash is null)
  )
);

create table public.marketplace_product_assets (
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  asset_id uuid not null references public.app_assets(id) on delete restrict,
  role text not null default 'gallery' check (role in ('cover','gallery')),
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  primary key (product_id, asset_id),
  unique (product_id, role, sort_order)
);

create table public.marketplace_promotions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  product_id uuid null references public.marketplace_products(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 180),
  description text not null default '',
  benefit_text text null,
  restrictions text null,
  discount_percent numeric(5,2) null check (discount_percent is null or discount_percent between 0 and 100),
  image_asset_id uuid null references public.app_assets(id) on delete restrict,
  start_date date null,
  end_date date null,
  enabled boolean not null default true,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.marketplace_favorites (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (auth_user_id, product_id)
);

create table public.marketplace_company_favorites (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (auth_user_id, company_id)
);

create sequence public.marketplace_quote_folio_seq start 1;
create sequence public.marketplace_request_folio_seq start 1;
create table public.marketplace_benefit_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  folio text not null unique default ('SC-' || lpad(nextval('public.marketplace_request_folio_seq')::text,6,'0')),
  actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  quantity integer not null default 1 check (quantity between 1 and 999),
  message text not null default '',
  signature_data text null,
  terms_accepted boolean not null default false,
  status text not null default 'requested' check (status in ('requested','review','approved','rejected','completed','cancelled')),
  company_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.marketplace_quote_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  folio text not null unique default ('CT-' || lpad(nextval('public.marketplace_quote_folio_seq')::text, 6, '0')),
  actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  product_id uuid not null references public.marketplace_products(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  message text not null default '',
  signature_data text null,
  terms_accepted boolean not null default false,
  status text not null default 'requested' check (status in ('requested','quoted','expired','cancelled')),
  quoted_amount numeric(14,2) null check (quoted_amount is null or quoted_amount > 0),
  quote_note text null,
  valid_until date null,
  quoted_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  quoted_at timestamptz null,
  seen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_quote_state check (
    (status='quoted' and quoted_amount is not null and quoted_by_auth_user_id is not null and quoted_at is not null)
    or (status<>'quoted')
  )
);

create index marketplace_categories_parent_sort_idx on public.marketplace_categories(parent_id,enabled,sort_order);
create unique index marketplace_categories_historical_source_idx on public.marketplace_categories(source_snapshot_hash,source_sheet,source_row_ordinal) where record_origin='HISTORICAL_IMPORT';
create index marketplace_products_category_sort_idx on public.marketplace_products(category_id,enabled,sort_order);
create unique index marketplace_products_historical_source_idx on public.marketplace_products(source_snapshot_hash,source_sheet,source_row_ordinal) where record_origin='HISTORICAL_IMPORT';
create index marketplace_products_company_sort_idx on public.marketplace_products(company_id,enabled,sort_order);
create index marketplace_quote_affiliate_created_idx on public.marketplace_quote_requests(affiliate_id,created_at desc);
create index marketplace_request_affiliate_created_idx on public.marketplace_benefit_requests(affiliate_id,created_at desc);
create index marketplace_request_company_created_idx on public.marketplace_benefit_requests(company_id,created_at desc);
create index marketplace_promotions_company_sort_idx on public.marketplace_promotions(company_id,approval_status,enabled,sort_order);
create index marketplace_quote_company_created_idx on public.marketplace_quote_requests(company_id,created_at desc);
create index marketplace_membership_auth_idx on public.marketplace_company_memberships(auth_user_id) where enabled;

create trigger marketplace_memberships_updated_at before update on public.marketplace_company_memberships for each row execute function public.set_h0072_updated_at();
create trigger marketplace_categories_updated_at before update on public.marketplace_categories for each row execute function public.set_h0072_updated_at();
create trigger marketplace_products_updated_at before update on public.marketplace_products for each row execute function public.set_h0072_updated_at();
create trigger marketplace_promotions_updated_at before update on public.marketplace_promotions for each row execute function public.set_h0072_updated_at();
create trigger marketplace_quotes_updated_at before update on public.marketplace_quote_requests for each row execute function public.set_h0072_updated_at();
create trigger marketplace_requests_updated_at before update on public.marketplace_benefit_requests for each row execute function public.set_h0072_updated_at();

alter table public.marketplace_company_memberships enable row level security;
alter table public.marketplace_company_memberships force row level security;
alter table public.marketplace_categories enable row level security;
alter table public.marketplace_categories force row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_products force row level security;
alter table public.marketplace_product_assets enable row level security;
alter table public.marketplace_product_assets force row level security;
alter table public.marketplace_promotions enable row level security;
alter table public.marketplace_promotions force row level security;
alter table public.marketplace_favorites enable row level security;
alter table public.marketplace_favorites force row level security;
alter table public.marketplace_company_favorites enable row level security;
alter table public.marketplace_company_favorites force row level security;
alter table public.marketplace_quote_requests enable row level security;
alter table public.marketplace_quote_requests force row level security;
alter table public.marketplace_benefit_requests enable row level security;
alter table public.marketplace_benefit_requests force row level security;

revoke all on public.marketplace_company_memberships, public.marketplace_categories, public.marketplace_products,
  public.marketplace_product_assets, public.marketplace_promotions, public.marketplace_favorites, public.marketplace_company_favorites, public.marketplace_quote_requests, public.marketplace_benefit_requests from public, anon, authenticated;
grant select on public.marketplace_categories, public.marketplace_products, public.marketplace_product_assets to anon, authenticated;
grant select on public.marketplace_promotions to anon,authenticated;
grant select on public.marketplace_company_memberships to authenticated;
grant select, insert, delete on public.marketplace_favorites to authenticated;
grant select, insert, delete on public.marketplace_company_favorites to authenticated;
grant select, insert on public.marketplace_quote_requests to authenticated;
grant select, insert on public.marketplace_benefit_requests to authenticated;
grant update (status,company_notes,updated_at) on public.marketplace_benefit_requests to authenticated;
grant update (status,quoted_amount,quote_note,valid_until,quoted_by_auth_user_id,quoted_at,seen_at,updated_at) on public.marketplace_quote_requests to authenticated;
grant insert, update, delete on public.marketplace_categories, public.marketplace_products, public.marketplace_product_assets to authenticated;
grant insert, update, delete on public.marketplace_promotions to authenticated;
grant usage, select on sequence public.marketplace_quote_folio_seq to authenticated;
grant usage, select on sequence public.marketplace_request_folio_seq to authenticated;

create policy marketplace_categories_public_read on public.marketplace_categories for select to anon,authenticated using (enabled or public.has_admin_permission('marketplace.read'));
create policy marketplace_categories_admin_write on public.marketplace_categories for all to authenticated using (public.has_admin_permission('marketplace.write')) with check (public.has_admin_permission('marketplace.write'));
create policy marketplace_products_public_read on public.marketplace_products for select to anon,authenticated using (enabled or public.has_admin_permission('marketplace.read') or public.is_marketplace_company_member(company_id));
create policy marketplace_products_admin_write on public.marketplace_products for all to authenticated using (public.has_admin_permission('marketplace.write')) with check (public.has_admin_permission('marketplace.write'));
create policy marketplace_products_company_write on public.marketplace_products for all to authenticated using (public.is_marketplace_company_member(company_id,'write')) with check (public.is_marketplace_company_member(company_id,'write'));
create policy marketplace_product_assets_public_read on public.marketplace_product_assets for select to anon,authenticated using (exists(select 1 from public.marketplace_products p where p.id=product_id and (p.enabled or public.has_admin_permission('marketplace.read') or public.is_marketplace_company_member(p.company_id))));
create policy marketplace_product_assets_admin_write on public.marketplace_product_assets for all to authenticated using (public.has_admin_permission('marketplace.write')) with check (public.has_admin_permission('marketplace.write'));
create policy marketplace_product_assets_company_write on public.marketplace_product_assets for all to authenticated using (exists(select 1 from public.marketplace_products p where p.id=product_id and public.is_marketplace_company_member(p.company_id,'write'))) with check (exists(select 1 from public.marketplace_products p join public.app_assets a on a.id=asset_id where p.id=product_id and public.is_marketplace_company_member(p.company_id,'write') and a.owner_company_id=p.company_id));
create policy marketplace_promotions_public_read on public.marketplace_promotions for select to anon,authenticated using (enabled and approval_status='approved' and (start_date is null or start_date<=current_date) and (end_date is null or end_date>=current_date) or public.has_admin_permission('marketplace.read') or public.is_marketplace_company_member(company_id));
create policy marketplace_promotions_admin_write on public.marketplace_promotions for all to authenticated using (public.has_admin_permission('marketplace.write')) with check (public.has_admin_permission('marketplace.write'));
create policy marketplace_promotions_company_write on public.marketplace_promotions for all to authenticated using (public.is_marketplace_company_member(company_id,'write')) with check (public.is_marketplace_company_member(company_id,'write') and approval_status='pending');
create policy marketplace_memberships_self_read on public.marketplace_company_memberships for select to authenticated using (auth_user_id=(select auth.uid()) or public.has_admin_permission('companies.read'));
create policy marketplace_company_member_read on public.companies for select to authenticated using (public.is_marketplace_company_member(id));
create policy marketplace_favorites_self on public.marketplace_favorites for all to authenticated using (auth_user_id=(select auth.uid())) with check (auth_user_id=(select auth.uid()));
create policy marketplace_company_favorites_self on public.marketplace_company_favorites for all to authenticated using (auth_user_id=(select auth.uid())) with check (auth_user_id=(select auth.uid()));
create policy marketplace_quotes_affiliate_read on public.marketplace_quote_requests for select to authenticated using (affiliate_id=public.get_effective_affiliate_id());
create policy marketplace_quotes_company_read on public.marketplace_quote_requests for select to authenticated using (public.is_marketplace_company_member(company_id,'quotes'));
create policy marketplace_quotes_admin_read on public.marketplace_quote_requests for select to authenticated using (public.has_admin_permission('marketplace.quotes.read'));
create policy marketplace_quotes_affiliate_insert on public.marketplace_quote_requests for insert to authenticated with check (actor_real_auth_user_id=(select auth.uid()) and affiliate_id=public.get_effective_affiliate_id() and exists(select 1 from public.marketplace_products p where p.id=product_id and p.company_id=company_id and p.enabled and p.requires_quote));
create policy marketplace_quotes_company_update on public.marketplace_quote_requests for update to authenticated using (public.is_marketplace_company_member(company_id,'quotes')) with check (public.is_marketplace_company_member(company_id,'quotes') and quoted_by_auth_user_id=(select auth.uid()));
create policy marketplace_quotes_admin_update on public.marketplace_quote_requests for update to authenticated using (public.has_admin_permission('marketplace.quotes.write')) with check (public.has_admin_permission('marketplace.quotes.write'));
create policy marketplace_requests_affiliate_read on public.marketplace_benefit_requests for select to authenticated using (affiliate_id=public.get_effective_affiliate_id());
create policy marketplace_requests_company_read on public.marketplace_benefit_requests for select to authenticated using (public.is_marketplace_company_member(company_id));
create policy marketplace_requests_admin_read on public.marketplace_benefit_requests for select to authenticated using (public.has_admin_permission('marketplace.quotes.read'));
create policy marketplace_requests_affiliate_insert on public.marketplace_benefit_requests for insert to authenticated with check (actor_real_auth_user_id=(select auth.uid()) and affiliate_id=public.get_effective_affiliate_id() and exists(select 1 from public.marketplace_products p where p.id=product_id and p.company_id=company_id and p.enabled and not p.requires_quote));
create policy marketplace_requests_company_update on public.marketplace_benefit_requests for update to authenticated using (public.is_marketplace_company_member(company_id,'write')) with check (public.is_marketplace_company_member(company_id,'write'));
create policy marketplace_requests_admin_update on public.marketplace_benefit_requests for update to authenticated using (public.has_admin_permission('marketplace.quotes.write')) with check (public.has_admin_permission('marketplace.quotes.write'));

create policy marketplace_company_asset_insert on public.app_assets for insert to authenticated with check (owner_company_id is not null and public.is_marketplace_company_member(owner_company_id,'write') and storage_bucket='company-assets' and storage_path like 'marketplace/'||owner_company_id::text||'/%');
create policy marketplace_company_asset_update on public.app_assets for update to authenticated using (owner_company_id is not null and public.is_marketplace_company_member(owner_company_id,'write')) with check (owner_company_id is not null and public.is_marketplace_company_member(owner_company_id,'write') and storage_bucket='company-assets' and storage_path like 'marketplace/'||owner_company_id::text||'/%');
create policy marketplace_company_asset_delete on public.app_assets for delete to authenticated using (owner_company_id is not null and public.is_marketplace_company_member(owner_company_id,'write'));
create policy marketplace_company_asset_source_insert on public.asset_sources for insert to authenticated with check (exists(select 1 from public.app_assets a where a.id=asset_id and a.owner_company_id is not null and public.is_marketplace_company_member(a.owner_company_id,'write')));
create policy marketplace_company_storage_insert on storage.objects for insert to authenticated with check (bucket_id='company-assets' and (storage.foldername(name))[1]='marketplace' and public.is_marketplace_company_member(((storage.foldername(name))[2])::uuid,'write'));
create policy marketplace_company_storage_update on storage.objects for update to authenticated using (bucket_id='company-assets' and (storage.foldername(name))[1]='marketplace' and public.is_marketplace_company_member(((storage.foldername(name))[2])::uuid,'write')) with check (bucket_id='company-assets' and (storage.foldername(name))[1]='marketplace' and public.is_marketplace_company_member(((storage.foldername(name))[2])::uuid,'write'));
create policy marketplace_company_storage_delete on storage.objects for delete to authenticated using (bucket_id='company-assets' and (storage.foldername(name))[1]='marketplace' and public.is_marketplace_company_member(((storage.foldername(name))[2])::uuid,'write'));

create function public.update_marketplace_company_profile(p_company_id uuid,p_description text,p_phone_raw text,p_whatsapp_raw text,p_email_raw text,p_website_url text,p_address_raw text,p_social_links jsonb)
returns void language plpgsql security definer set search_path=''
as $$ begin
  if not public.is_marketplace_company_member(p_company_id,'write') then raise exception 'COMPANY_DENIED' using errcode='P0001'; end if;
  update public.companies set description=p_description,phone_raw=p_phone_raw,whatsapp_raw=p_whatsapp_raw,email_raw=p_email_raw,website_url=p_website_url,address_raw=p_address_raw,social_links=coalesce(p_social_links,'{}'::jsonb),updated_at=now() where id=p_company_id;
end $$;

create function public.create_marketplace_quote(p_product_id uuid,p_message text,p_signature_data text,p_terms_accepted boolean)
returns public.marketplace_quote_requests language plpgsql security definer set search_path=''
as $$
declare v_product public.marketplace_products%rowtype; v_affiliate uuid; v_row public.marketplace_quote_requests%rowtype;
begin
  v_affiliate:=public.get_effective_affiliate_id();
  if v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='P0001'; end if;
  select * into v_product from public.marketplace_products where id=p_product_id and enabled and requires_quote;
  if v_product.id is null then raise exception 'PRODUCT_NOT_QUOTABLE' using errcode='P0001'; end if;
  insert into public.marketplace_quote_requests(actor_real_auth_user_id,affiliate_id,product_id,company_id,message,signature_data,terms_accepted)
  values ((select auth.uid()),v_affiliate,v_product.id,v_product.company_id,left(coalesce(p_message,''),2000),p_signature_data,coalesce(p_terms_accepted,false)) returning * into v_row;
  return v_row;
end $$;

create function public.create_marketplace_benefit_request(p_product_id uuid,p_quantity integer,p_message text,p_signature_data text,p_terms_accepted boolean)
returns public.marketplace_benefit_requests language plpgsql security definer set search_path=''
as $$
declare v_product public.marketplace_products%rowtype;v_affiliate uuid;v_row public.marketplace_benefit_requests%rowtype;
begin
  v_affiliate:=public.get_effective_affiliate_id();if v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='P0001';end if;
  select * into v_product from public.marketplace_products where id=p_product_id and enabled and not requires_quote;if v_product.id is null then raise exception 'PRODUCT_NOT_REQUESTABLE' using errcode='P0001';end if;
  insert into public.marketplace_benefit_requests(actor_real_auth_user_id,affiliate_id,product_id,company_id,quantity,message,signature_data,terms_accepted)
  values((select auth.uid()),v_affiliate,v_product.id,v_product.company_id,greatest(1,least(coalesce(p_quantity,1),999)),left(coalesce(p_message,''),2000),p_signature_data,coalesce(p_terms_accepted,false)) returning * into v_row;return v_row;
end $$;

create function public.respond_marketplace_quote(p_quote_id uuid,p_amount numeric,p_note text,p_valid_until date)
returns public.marketplace_quote_requests language plpgsql security definer set search_path=''
as $$
declare v_row public.marketplace_quote_requests%rowtype;
begin
  select * into v_row from public.marketplace_quote_requests where id=p_quote_id;
  if v_row.id is null or not (public.is_marketplace_company_member(v_row.company_id,'quotes') or public.has_admin_permission('marketplace.quotes.write')) then raise exception 'QUOTE_DENIED' using errcode='P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'QUOTE_AMOUNT_INVALID' using errcode='22023'; end if;
  update public.marketplace_quote_requests set status='quoted',quoted_amount=p_amount,quote_note=nullif(btrim(coalesce(p_note,'')),''),valid_until=p_valid_until,quoted_by_auth_user_id=(select auth.uid()),quoted_at=now(),updated_at=now() where id=p_quote_id returning * into v_row;
  return v_row;
end $$;

grant execute on function public.is_marketplace_company_member(uuid,text), public.update_marketplace_company_profile(uuid,text,text,text,text,text,text,jsonb), public.create_marketplace_quote(uuid,text,text,boolean), public.create_marketplace_benefit_request(uuid,integer,text,text,boolean), public.respond_marketplace_quote(uuid,numeric,text,date) to authenticated;
revoke execute on function public.is_marketplace_company_member(uuid,text), public.update_marketplace_company_profile(uuid,text,text,text,text,text,text,jsonb), public.create_marketplace_quote(uuid,text,text,boolean), public.create_marketplace_benefit_request(uuid,integer,text,text,boolean), public.respond_marketplace_quote(uuid,numeric,text,date) from public,anon;

insert into public.marketplace_categories(name,slug,category_raw,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash)
values
('Electrónica','electronica','Electrónica',true,1,'HISTORICAL_IMPORT','Categorías SutiCompras',2,'ADF179D4A28F28798187AFF4D0E046E84AD798739FCE896C71AD248E3CAB6FF7'),
('Moda','moda','Moda',true,2,'HISTORICAL_IMPORT','Categorías SutiCompras',3,'ADF179D4A28F28798187AFF4D0E046E84AD798739FCE896C71AD248E3CAB6FF7'),
('Salud y belleza','salud-y-belleza','Salud y belleza',true,3,'HISTORICAL_IMPORT','Categorías SutiCompras',4,'ADF179D4A28F28798187AFF4D0E046E84AD798739FCE896C71AD248E3CAB6FF7');

do $$ declare table_name text;
begin
  foreach table_name in array array['marketplace_company_memberships','marketplace_categories','marketplace_products','marketplace_product_assets','marketplace_promotions','marketplace_quote_requests','marketplace_benefit_requests'] loop
    execute format('create trigger %I_admin_audit after insert or update or delete on public.%I for each row execute function public.audit_admin_write()',table_name,table_name);
  end loop;
end $$;

comment on table public.marketplace_products is 'Phase 3 commercial Marketplace authority. Financial/program catalogs are explicitly excluded.';
comment on column public.marketplace_products.category_raw is 'Preserves unreconciled historical commercial text without creating a false catalog authority.';
comment on table public.marketplace_quote_requests is 'Commercial quote requests only; no loan, amortization, savings or financial approval semantics.';
commit;
