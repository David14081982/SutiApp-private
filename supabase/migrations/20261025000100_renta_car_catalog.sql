-- H-RENTACAR-CATALOG-UI-ADMIN-001: additive vehicle metadata in the existing catalog.
-- Run transactionally. Existing writers, RLS, requests and financial rules are unchanged.
alter table public.program_catalog_items add column rental_specs jsonb;
alter table public.program_catalog_items add constraint rental_specs_scope check (
 rental_specs is null or (program_key='renta' and jsonb_typeof(rental_specs)='object')
);
grant select(rental_specs) on public.program_catalog_items to authenticated;
comment on column public.program_catalog_items.rental_specs is 'Renta Car technical display fields: year, engine, vehicle_type, seats, tank. Same catalog authority; absent values remain unknown. No price, booking or financial fields.';

-- Promote only explicitly recorded descriptive facts; preserve the original source payload.
-- Historical booking dates/payment labels never become catalog availability or rental rules.
update public.program_catalog_items i set rental_specs=jsonb_strip_nulls(jsonb_build_object(
 'year',(select case when v.value#>>'{}' ~ '^[12][0-9]{3}(\.0+)?$' then trunc((v.value#>>'{}')::numeric)::integer end
         from jsonb_each(i.source_payload) v where v.key in ('Año','A�o') limit 1),
 'seats',nullif(btrim(i.source_payload->>'Asientos'),'')
)) where i.program_key='renta';

create function public.save_renta_car_catalog_item(p_item_id uuid,p_payload jsonb,p_asset_links jsonb,p_specs jsonb,p_expected_updated_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_before public.program_catalog_items%rowtype; v_after public.program_catalog_items%rowtype; v_saved jsonb; v_specs jsonb; v_key text; v_value jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('program_catalog.write') then
  raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501';
 end if;
 if p_payload is null or p_payload->>'program_key' is distinct from 'renta' then
  raise exception 'RENTA_CATALOG_SCOPE_INVALID' using errcode='22023';
 end if;
 if p_item_id is not null then
  select * into v_before from public.program_catalog_items where id=p_item_id for update;
  if not found or v_before.program_key<>'renta' then raise exception 'RENTA_CATALOG_SCOPE_INVALID' using errcode='22023'; end if;
  if p_expected_updated_at is null or v_before.updated_at is distinct from p_expected_updated_at then
   raise exception 'RENTA_CATALOG_CHANGED' using errcode='40001';
  end if;
 end if;
 if p_specs is null or jsonb_typeof(p_specs)<>'object' then raise exception 'RENTA_SPECS_INVALID' using errcode='22023'; end if;
 v_specs:='{}'::jsonb;
 for v_key,v_value in select key,value from jsonb_each(p_specs) loop
  if v_key not in ('year','engine','vehicle_type','seats','tank') then raise exception 'RENTA_SPECS_INVALID' using errcode='22023'; end if;
  if v_value='null'::jsonb then continue; end if;
  if v_key='year' then
   if jsonb_typeof(v_value)<>'number' or v_value::text !~ '^[0-9]{4}$' or (v_value::text)::integer not between 1900 and 2100 then
    raise exception 'RENTA_SPECS_INVALID' using errcode='22023';
   end if;
  else
   if jsonb_typeof(v_value)<>'string' or length(v_value#>>'{}')>(case v_key when 'engine' then 120 when 'vehicle_type' then 80 else 40 end) then
    raise exception 'RENTA_SPECS_INVALID' using errcode='22023';
   end if;
   v_value:=to_jsonb(btrim(v_value#>>'{}')); if v_value='""'::jsonb then continue; end if;
  end if;
  v_specs:=v_specs||jsonb_build_object(v_key,v_value);
 end loop;
 -- Reuse canonical validation, provenance, media ownership/order and audit atomically.
 v_saved:=public.save_program_catalog_item(p_item_id,p_payload,p_asset_links);
 update public.program_catalog_items set rental_specs=v_specs where id=(v_saved->>'id')::uuid returning * into v_after;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
 values(auth.uid(),'program_catalog_items','UPDATE',v_after.id::text,'SUCCESS',jsonb_build_object(
  'operation','RENTA_CATALOG_SPECS','program_key','renta','before',v_before.rental_specs,'after',v_after.rental_specs));
 return to_jsonb(v_after)-'source_payload'-'sold_by';
end $$;
revoke all on function public.save_renta_car_catalog_item(uuid,jsonb,jsonb,jsonb,timestamptz) from public,anon;
grant execute on function public.save_renta_car_catalog_item(uuid,jsonb,jsonb,jsonb,timestamptz) to authenticated;
comment on function public.save_renta_car_catalog_item(uuid,jsonb,jsonb,jsonb,timestamptz) is 'Renta-only adapter to canonical catalog writer. Backend permission, immutable program identity, optimistic version, validated metadata and actor audit. Does not write financing_config or requests.';
notify pgrst,'reload schema';
