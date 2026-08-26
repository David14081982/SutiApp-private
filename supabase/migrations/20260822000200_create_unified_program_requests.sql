begin;

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write'
]::text[]);

update public.admin_assignments
set permissions = array(select distinct p from unnest(permissions || array['program_requests.read','program_requests.write']) p),
    updated_at = now()
where enabled and 'marketplace.quotes.read'=any(permissions);

create sequence public.program_request_folio_seq start 1;

create table public.program_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  folio text not null unique default ('SR-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.program_request_folio_seq')::text,6,'0')),
  actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  numero_control text not null,
  program_id text not null,
  program_item_id uuid null references public.program_catalog_items(id) on delete restrict,
  product_id uuid null references public.marketplace_products(id) on delete restrict,
  company_id uuid null references public.companies(id) on delete restrict,
  request_type text not null,
  status text not null default 'submitted',
  quantity integer not null default 1,
  notes text null,
  signature_data text null,
  terms_accepted boolean not null default false,
  source_context jsonb not null default '{}'::jsonb,
  financial_processing_status text null,
  legacy_reference text null,
  idempotency_key uuid not null,
  quoted_amount numeric(14,2) null,
  quote_note text null,
  valid_until date null,
  responded_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  responded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_requests_target_check check ((program_item_id is null) <> (product_id is null)),
  constraint program_requests_program_check check (length(btrim(program_id)) between 1 and 80),
  constraint program_requests_type_check check (request_type in ('benefit','quote','interest')),
  constraint program_requests_status_check check (status in ('submitted','in_review','approved','rejected','cancelled','requires_financial_processing')),
  constraint program_requests_quantity_check check (quantity between 1 and 999),
  constraint program_requests_financial_status_check check (financial_processing_status is null or financial_processing_status in ('pending','ready_for_handoff','handed_off','failed')),
  constraint program_requests_legacy_handoff_check check (legacy_reference is null or financial_processing_status='handed_off'),
  constraint program_requests_quote_check check (quoted_amount is null or (request_type='quote' and quoted_amount>0)),
  constraint program_requests_idempotency_unique unique (affiliate_id,idempotency_key)
);

create index program_requests_affiliate_created_idx on public.program_requests(affiliate_id,created_at desc);
create index program_requests_company_created_idx on public.program_requests(company_id,created_at desc) where company_id is not null;
create index program_requests_program_created_idx on public.program_requests(program_id,created_at desc);
create index program_requests_status_created_idx on public.program_requests(status,created_at desc);

create trigger program_requests_updated_at before update on public.program_requests
for each row execute function public.set_h0072_updated_at();
create trigger program_requests_admin_audit after insert or update or delete on public.program_requests
for each row execute function public.audit_admin_write();

alter table public.program_requests enable row level security;
alter table public.program_requests force row level security;
revoke all on public.program_requests from public,anon,authenticated;
revoke all on sequence public.program_request_folio_seq from public,anon,authenticated;
grant select on public.program_requests to authenticated;

create policy program_requests_self_read on public.program_requests for select to authenticated
using (affiliate_id=public.get_effective_affiliate_id());
create policy program_requests_company_read on public.program_requests for select to authenticated
using (company_id is not null and public.is_marketplace_company_member(company_id));
create policy program_requests_admin_read on public.program_requests for select to authenticated
using (public.has_admin_permission('program_requests.read'));

create function public.create_program_request(
  p_program_item_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_notes text,
  p_signature_data text,
  p_terms_accepted boolean,
  p_idempotency_key uuid
)
returns public.program_requests language plpgsql security definer set search_path=''
as $$
declare
  v_affiliate public.affiliates%rowtype;
  v_item public.program_catalog_items%rowtype;
  v_product public.marketplace_products%rowtype;
  v_row public.program_requests%rowtype;
  v_request_type text;
  v_status text;
  v_financial_status text;
begin
  if (p_program_item_id is null) = (p_product_id is null) then
    raise exception 'REQUEST_TARGET_REQUIRED' using errcode='22023';
  end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023'; end if;
  if not coalesce(p_terms_accepted,false) or nullif(btrim(coalesce(p_signature_data,'')),'') is null then
    raise exception 'SIGNATURE_AND_TERMS_REQUIRED' using errcode='22023';
  end if;

  select a.* into v_affiliate from public.affiliates a where a.id=public.get_effective_affiliate_id();
  if v_affiliate.id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='P0001'; end if;
  if nullif(btrim(coalesce(v_affiliate.numero_control,'')),'') is null then raise exception 'AFFILIATE_CONTROL_REQUIRED' using errcode='P0001'; end if;

  select * into v_row from public.program_requests
  where affiliate_id=v_affiliate.id and idempotency_key=p_idempotency_key;
  if v_row.id is not null then return v_row; end if;

  if p_program_item_id is not null then
    select * into v_item from public.program_catalog_items where id=p_program_item_id and enabled and request_mode='supabase';
    if v_item.id is null then raise exception 'PROGRAM_NOT_REQUESTABLE' using errcode='P0001'; end if;
    v_request_type:=case when v_item.requires_quote then 'quote' else 'benefit' end;
    v_status:=case when v_item.legacy_boundary then 'requires_financial_processing' else 'submitted' end;
    v_financial_status:=case when v_item.legacy_boundary then 'pending' else null end;
    insert into public.program_requests(
      actor_real_auth_user_id,affiliate_id,numero_control,program_id,program_item_id,request_type,status,
      quantity,notes,signature_data,terms_accepted,source_context,financial_processing_status,idempotency_key
    ) values (
      (select auth.uid()),v_affiliate.id,v_affiliate.numero_control,v_item.program_key,v_item.id,v_request_type,v_status,
      greatest(1,least(coalesce(p_quantity,1),999)),left(nullif(btrim(coalesce(p_notes,'')),''),2000),p_signature_data,true,
      jsonb_build_object('source','sutiapp','catalog','program_catalog_items','requires_quote',v_item.requires_quote),v_financial_status,p_idempotency_key
    ) returning * into v_row;
  else
    select p.* into v_product from public.marketplace_products p
    where p.id=p_product_id and p.enabled and exists(select 1 from public.companies c where c.id=p.company_id and c.enabled);
    if v_product.id is null then raise exception 'PRODUCT_NOT_REQUESTABLE' using errcode='P0001'; end if;
    v_request_type:=case when v_product.requires_quote then 'quote' else 'benefit' end;
    insert into public.program_requests(
      actor_real_auth_user_id,affiliate_id,numero_control,program_id,product_id,company_id,request_type,status,
      quantity,notes,signature_data,terms_accepted,source_context,idempotency_key
    ) values (
      (select auth.uid()),v_affiliate.id,v_affiliate.numero_control,'marketplace',v_product.id,v_product.company_id,v_request_type,'submitted',
      greatest(1,least(coalesce(p_quantity,1),999)),left(nullif(btrim(coalesce(p_notes,'')),''),2000),p_signature_data,true,
      jsonb_build_object('source','sutiapp','catalog','marketplace_products','requires_quote',v_product.requires_quote),p_idempotency_key
    ) returning * into v_row;
  end if;
  return v_row;
exception when unique_violation then
  select * into v_row from public.program_requests where affiliate_id=v_affiliate.id and idempotency_key=p_idempotency_key;
  if v_row.id is not null then return v_row; end if;
  raise;
end $$;

create function public.update_program_request(p_request_id uuid,p_status text,p_notes text)
returns public.program_requests language plpgsql security definer set search_path=''
as $$
declare v_row public.program_requests%rowtype;
begin
  select * into v_row from public.program_requests where id=p_request_id;
  if v_row.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  if not (public.has_admin_permission('program_requests.write') or (v_row.company_id is not null and public.is_marketplace_company_member(v_row.company_id,'write'))) then
    raise exception 'REQUEST_DENIED' using errcode='42501';
  end if;
  if p_status not in ('submitted','in_review','approved','rejected','cancelled','requires_financial_processing') then
    raise exception 'REQUEST_STATUS_INVALID' using errcode='22023';
  end if;
  update public.program_requests set status=p_status,notes=coalesce(left(nullif(btrim(coalesce(p_notes,'')),''),2000),notes),updated_at=now()
  where id=p_request_id returning * into v_row;
  return v_row;
end $$;

create function public.respond_program_request_quote(p_request_id uuid,p_amount numeric,p_note text,p_valid_until date)
returns public.program_requests language plpgsql security definer set search_path=''
as $$
declare v_row public.program_requests%rowtype;
begin
  select * into v_row from public.program_requests where id=p_request_id;
  if v_row.id is null or v_row.request_type<>'quote' then raise exception 'QUOTE_NOT_FOUND' using errcode='P0001'; end if;
  if not (public.has_admin_permission('program_requests.write') or (v_row.company_id is not null and public.is_marketplace_company_member(v_row.company_id,'quotes'))) then
    raise exception 'QUOTE_DENIED' using errcode='42501';
  end if;
  if p_amount is null or p_amount<=0 then raise exception 'QUOTE_AMOUNT_INVALID' using errcode='22023'; end if;
  update public.program_requests set status='approved',quoted_amount=p_amount,quote_note=left(nullif(btrim(coalesce(p_note,'')),''),2000),
    valid_until=p_valid_until,responded_by_auth_user_id=(select auth.uid()),responded_at=now(),updated_at=now()
  where id=p_request_id returning * into v_row;
  return v_row;
end $$;

grant execute on function public.create_program_request(uuid,uuid,integer,text,text,boolean,uuid) to authenticated;
grant execute on function public.update_program_request(uuid,text,text) to authenticated;
grant execute on function public.respond_program_request_quote(uuid,numeric,text,date) to authenticated;
revoke execute on function public.create_program_request(uuid,uuid,integer,text,text,boolean,uuid) from public,anon;
revoke execute on function public.update_program_request(uuid,text,text) from public,anon;
revoke execute on function public.respond_program_request_quote(uuid,numeric,text,date) from public,anon;

-- All enabled catalog rows only register intent here. No financial calculation or legacy write occurs.
update public.program_catalog_items set request_mode='supabase',updated_at=now()
where enabled and request_mode='legacy_pending';

-- Previous request tables retain pre-cutover workflows; all new requests use program_requests.
revoke execute on function public.create_program_benefit_request(uuid,integer,text,text,boolean) from authenticated;
revoke execute on function public.create_marketplace_quote(uuid,text,text,boolean) from authenticated;
revoke execute on function public.create_marketplace_benefit_request(uuid,integer,text,text,boolean) from authenticated;

comment on table public.program_requests is 'Single authority for initial benefit, quote and interest requests after the 2026-08-22 cutover. Financial processing remains outside this table until explicit handoff.';
comment on column public.program_requests.numero_control is 'Immutable business-identity snapshot derived server-side from affiliates; never accepted from browser input.';
comment on column public.program_requests.legacy_reference is 'Set only by a future explicit audited handoff; initial request creation never writes Google legacy.';

notify pgrst, 'reload schema';

commit;
