begin;

-- H-REQUEST-SUBMISSION-E2E-REMEDIATION-001
-- The financial writer is intentionally service-role only. Document scope
-- validation must accept that trusted transaction boundary while continuing to
-- reject anonymous callers. No document, request or financial data is changed.
create or replace function public.assert_document_requirement_scope(p_scope_type text,p_scope_key text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_type text:=upper(btrim(coalesce(p_scope_type,'')));v_key text:=btrim(coalesce(p_scope_key,''));v_row jsonb;
begin
  if auth.uid() is null and coalesce(auth.role(),'')<>'service_role' then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if v_type='PROGRAM' and v_key='prestamo' then
    return jsonb_build_object('scope_type',v_type,'scope_key',v_key,'label','Suti Prestamo','parent_scope_type',null,'parent_scope_key',null);
  elsif v_type='PROGRAM' then
    select jsonb_build_object('scope_type',v_type,'scope_key',i.id::text,'label',i.name,'parent_scope_type',null,'parent_scope_key',null)
      into v_row from public.program_catalog_items i where i.id::text=v_key and i.enabled;
  elsif v_type='MEMBERSHIP' then
    select jsonb_build_object('scope_type',v_type,'scope_key',m.id::text,'label',m.company_raw||' - '||m.concept,'parent_scope_type',null,'parent_scope_key',null)
      into v_row from public.membership_offerings m where m.id::text=v_key and m.enabled;
  elsif v_type='COMPANY' then
    select jsonb_build_object('scope_type',v_type,'scope_key',c.id::text,'label',c.display_name,'parent_scope_type',null,'parent_scope_key',null)
      into v_row from public.companies c where c.id::text=v_key and c.enabled;
  elsif v_type='PRODUCT' then
    select jsonb_build_object('scope_type',v_type,'scope_key',p.id::text,'label',p.name,'parent_scope_type','COMPANY','parent_scope_key',p.company_id::text)
      into v_row from public.marketplace_products p join public.companies c on c.id=p.company_id and c.enabled
      where p.id::text=v_key and p.enabled;
  elsif v_type='SERVICE' then
    raise exception 'DOCUMENT_SCOPE_NOT_AVAILABLE' using errcode='22023';
  else
    raise exception 'INVALID_DOCUMENT_SCOPE' using errcode='22023';
  end if;
  if v_row is null then raise exception 'DOCUMENT_SCOPE_NOT_AVAILABLE' using errcode='22023'; end if;
  return v_row;
end $$;

-- Narrow self-service projection. The effective affiliate is always resolved
-- server-side, including an active audited impersonation session. The browser
-- receives only fields required by Historial and no broad table SELECT grant.
create or replace function public.list_self_program_request_history()
returns setof jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_affiliate_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  v_affiliate_id:=public.get_effective_affiliate_id();
  if v_affiliate_id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;

  return query
  select jsonb_strip_nulls(jsonb_build_object(
    'id',r.id,
    'folio',r.folio,
    'program_id',r.program_id,
    'program_item_id',r.program_item_id,
    'product_id',r.product_id,
    'membership_offering_id',r.membership_offering_id,
    'company_id',r.company_id,
    'request_type',r.request_type,
    'status',r.status,
    'quantity',r.quantity,
    'notes',r.notes,
    'financial_processing_status',r.financial_processing_status,
    'requested_amount',r.requested_amount,
    'requested_term',r.requested_term,
    'requested_term_semantics',r.requested_term_semantics,
    'quoted_amount',r.quoted_amount,
    'quote_note',r.quote_note,
    'valid_until',r.valid_until,
    'responded_at',r.responded_at,
    'created_at',r.created_at,
    'updated_at',r.updated_at,
    'program_item',case when pi.id is null then null else jsonb_build_object(
      'name',pi.name,'program_key',pi.program_key,'price_cash',pi.price_cash) end,
    'product',case when p.id is null then null else jsonb_build_object(
      'name',p.name,'price',p.price) end,
    'membership',case when m.id is null then null else jsonb_build_object(
      'company_raw',m.company_raw,'concept',m.concept,'amount',m.amount) end,
    'company',case when c.id is null then null else jsonb_build_object(
      'display_name',c.display_name) end
  ))
  from public.program_requests r
  left join public.program_catalog_items pi on pi.id=r.program_item_id
  left join public.marketplace_products p on p.id=r.product_id
  left join public.membership_offerings m on m.id=r.membership_offering_id
  left join public.companies c on c.id=r.company_id
  where r.affiliate_id=v_affiliate_id
  order by r.created_at desc,r.id desc;
end $$;

revoke all on function public.list_self_program_request_history() from public,anon,authenticated,service_role;
grant execute on function public.list_self_program_request_history() to authenticated;

comment on function public.list_self_program_request_history() is
  'Minimal self-service Historial projection bound server-side to get_effective_affiliate_id(); excludes signatures, terms acceptance, snapshots, identity and internal processing metadata.';

notify pgrst,'reload schema';
commit;
