begin;

create table public.program_catalog_items (
  id uuid primary key default extensions.gen_random_uuid(),
  program_key text not null,
  name text not null,
  description text null,
  category_raw text null,
  quantity_raw text null,
  presentation_raw text null,
  contact_url_raw text null,
  price_cash numeric(14,2) null,
  requires_quote boolean not null default true,
  request_mode text not null default 'legacy_pending',
  legacy_boundary boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null,
  record_origin text not null default 'HISTORICAL_IMPORT',
  source_sheet text not null,
  source_row_ordinal integer not null,
  source_snapshot_hash text not null,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_catalog_items_program_check check (program_key in ('auto','renta','casa','terrenos','solar','aires','puertas','computo','farma','tours','donativos')),
  constraint program_catalog_items_request_mode_check check (request_mode in ('supabase','legacy_pending','disabled')),
  constraint program_catalog_items_source_row_check check (source_row_ordinal > 1),
  constraint program_catalog_items_snapshot_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  constraint program_catalog_items_source_unique unique (source_snapshot_hash, source_sheet, source_row_ordinal)
);

create table public.program_catalog_item_assets (
  item_id uuid not null references public.program_catalog_items(id) on delete restrict,
  public_asset_id uuid null references public.app_assets(id) on delete restrict,
  private_asset_id uuid null references public.private_assets(id) on delete restrict,
  role text not null default 'gallery',
  sort_order integer not null default 1,
  source_column text not null,
  source_column_letter text not null,
  created_at timestamptz not null default now(),
  primary key (item_id, source_column_letter, sort_order),
  constraint program_catalog_item_assets_one_asset check ((public_asset_id is null) <> (private_asset_id is null)),
  constraint program_catalog_item_assets_role_check check (role in ('cover','gallery'))
);

create sequence public.program_benefit_folio_seq start 1;
create table public.program_benefit_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  folio text not null unique default ('PB-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.program_benefit_folio_seq')::text,6,'0')),
  actor_real_auth_user_id uuid not null,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  item_id uuid not null references public.program_catalog_items(id) on delete restrict,
  quantity integer not null default 1 check (quantity between 1 and 999),
  message text null,
  signature_data text null,
  terms_accepted boolean not null default false,
  status text not null default 'requested' check (status in ('requested','review','approved','rejected','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index program_catalog_items_program_order_idx on public.program_catalog_items(program_key,enabled,sort_order);
create index program_catalog_item_assets_item_idx on public.program_catalog_item_assets(item_id,sort_order);
create index program_benefit_requests_affiliate_idx on public.program_benefit_requests(affiliate_id,created_at desc);

alter table public.program_catalog_items enable row level security;
alter table public.program_catalog_items force row level security;
alter table public.program_catalog_item_assets enable row level security;
alter table public.program_catalog_item_assets force row level security;
alter table public.program_benefit_requests enable row level security;
alter table public.program_benefit_requests force row level security;

revoke all on public.program_catalog_items, public.program_catalog_item_assets, public.program_benefit_requests from public,anon,authenticated;
revoke all on sequence public.program_benefit_folio_seq from public,anon,authenticated;
grant select (id,program_key,name,description,category_raw,quantity_raw,presentation_raw,contact_url_raw,price_cash,requires_quote,request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,created_at,updated_at) on public.program_catalog_items to authenticated;
grant select on public.program_catalog_item_assets to authenticated;
grant select on public.program_benefit_requests to authenticated;

create policy program_catalog_items_authenticated_read on public.program_catalog_items for select to authenticated using (enabled or public.has_admin_permission('marketplace.read'));
create policy program_catalog_item_assets_authenticated_read on public.program_catalog_item_assets for select to authenticated using (exists(select 1 from public.program_catalog_items i where i.id=item_id and (i.enabled or public.has_admin_permission('marketplace.read'))));
create policy program_benefit_requests_self_read on public.program_benefit_requests for select to authenticated using (affiliate_id=public.get_effective_affiliate_id() or public.has_admin_permission('marketplace.quotes.read'));

create policy program_catalog_linked_private_asset_read on public.private_assets for select to authenticated using (
  exists(select 1 from public.program_catalog_item_assets l join public.program_catalog_items i on i.id=l.item_id where l.private_asset_id=private_assets.id and i.enabled)
);
create policy program_catalog_linked_private_storage_read on storage.objects for select to authenticated using (
  bucket_id='private-assets' and exists(
    select 1 from public.private_assets a join public.program_catalog_item_assets l on l.private_asset_id=a.id join public.program_catalog_items i on i.id=l.item_id
    where a.storage_bucket=storage.objects.bucket_id and a.storage_path=storage.objects.name and i.enabled
  )
);

create function public.create_program_benefit_request(p_item_id uuid,p_quantity integer,p_message text,p_signature_data text,p_terms_accepted boolean)
returns public.program_benefit_requests language plpgsql security definer set search_path=''
as $$
declare v_item public.program_catalog_items%rowtype; v_affiliate uuid; v_row public.program_benefit_requests%rowtype;
begin
  v_affiliate:=public.get_effective_affiliate_id();
  if v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='P0001'; end if;
  select * into v_item from public.program_catalog_items where id=p_item_id and enabled and request_mode='supabase';
  if v_item.id is null then raise exception 'PROGRAM_REQUEST_PENDING_LEGACY' using errcode='P0001'; end if;
  if not coalesce(p_terms_accepted,false) or nullif(btrim(coalesce(p_signature_data,'')),'') is null then raise exception 'SIGNATURE_AND_TERMS_REQUIRED' using errcode='22023'; end if;
  insert into public.program_benefit_requests(actor_real_auth_user_id,affiliate_id,item_id,quantity,message,signature_data,terms_accepted)
  values((select auth.uid()),v_affiliate,v_item.id,greatest(1,least(coalesce(p_quantity,1),999)),left(nullif(btrim(coalesce(p_message,'')),''),2000),p_signature_data,true)
  returning * into v_row;
  return v_row;
end $$;

grant execute on function public.create_program_benefit_request(uuid,integer,text,text,boolean) to authenticated;
revoke execute on function public.create_program_benefit_request(uuid,integer,text,text,boolean) from public,anon;

comment on table public.program_catalog_items is 'Non-financial catalog authority by program. source_payload preserves historical fields but is not granted to browser roles.';
comment on table public.program_benefit_requests is 'Supabase requests only for catalog rows explicitly marked request_mode=supabase; legacy-backed program requests remain blocked.';
comment on column public.program_catalog_items.price_cash is 'Historical cash/list price only; never a financing calculation, quote, payment, rate, or amortization.';
commit;
