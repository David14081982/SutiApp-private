begin;

create function public.create_first_cirugias_program_catalog_item(p_payload jsonb,p_asset_links jsonb)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_after public.program_catalog_items%rowtype;
  v_id uuid;
  v_program text:=btrim(coalesce(p_payload->>'program_key',''));
  v_name text:=btrim(coalesce(p_payload->>'name',''));
  v_description text:=nullif(btrim(coalesce(p_payload->>'description','')),'');
  v_category text:=nullif(btrim(coalesce(p_payload->>'category_raw','')),'');
  v_price numeric;
  v_quote boolean;
  v_enabled boolean;
  v_sort integer;
  v_link jsonb;
  v_link_id uuid;
  v_public_asset_id uuid;
  v_kept uuid[]:='{}'::uuid[];
  v_position integer:=0;
begin
  if v_actor is null or not public.has_admin_permission('program_catalog.write') then raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_asset_links is null or jsonb_typeof(p_asset_links)<>'array' then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('program_key','name','description','category_raw','price_cash','requires_quote','enabled','sort_order')) then
    raise exception 'PROGRAM_CATALOG_FIELD_NOT_EDITABLE' using errcode='22023';
  end if;
  begin
    v_price:=nullif(p_payload->>'price_cash','')::numeric;
    v_quote:=(p_payload->>'requires_quote')::boolean;
    v_enabled:=(p_payload->>'enabled')::boolean;
    v_sort:=(p_payload->>'sort_order')::integer;
  exception when others then raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023'; end;
  if v_program<>'cirugias' or length(v_name) not between 2 and 180 or length(coalesce(v_description,''))>12000 or length(coalesce(v_category,''))>240
    or v_sort not between 1 and 10000 or v_price<0 or (not v_quote and (v_price is null or v_price<=0))
    or jsonb_array_length(p_asset_links)>8
  then raise exception 'PROGRAM_CATALOG_CONTRACT_INVALID' using errcode='22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('program_catalog_items:cirugias',0));
  if exists(select 1 from public.program_catalog_items where program_key='cirugias') then
    raise exception 'CIRUGIAS_PROGRAM_ALREADY_BOOTSTRAPPED' using errcode='P0001';
  end if;

  insert into public.program_catalog_items(program_key,name,description,category_raw,price_cash,requires_quote,request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,source_payload)
  values('cirugias',v_name,v_description,v_category,v_price,v_quote,'supabase',false,v_enabled,v_sort,'ADMIN_PROGRAM_CATALOG',null,null,null,'{}'::jsonb)
  returning * into v_after;
  v_id:=v_after.id;

  for v_link in select value from jsonb_array_elements(p_asset_links) loop
    v_position:=v_position+1;
    v_link_id:=nullif(v_link->>'link_id','')::uuid;
    v_public_asset_id:=nullif(v_link->>'public_asset_id','')::uuid;
    if v_link_id is not null or v_public_asset_id is null then raise exception 'CIRUGIAS_BOOTSTRAP_ASSET_LINK_INVALID' using errcode='22023'; end if;
    if not exists(select 1 from public.app_assets where id=v_public_asset_id and status='READY' and storage_bucket='app-assets' and storage_path like 'program-products/%') then raise exception 'PROGRAM_CATALOG_PUBLIC_ASSET_INVALID' using errcode='22023'; end if;
    v_link_id:=extensions.gen_random_uuid();
    insert into public.program_catalog_item_assets(id,item_id,public_asset_id,private_asset_id,role,sort_order,source_column,source_column_letter,enabled)
    values(v_link_id,v_id,v_public_asset_id,null,case when v_position=1 then 'cover' else 'gallery' end,v_position,'ADMIN_UPLOAD','ADMIN_'||replace(v_link_id::text,'-',''),true);
    if v_link_id=any(v_kept) then raise exception 'PROGRAM_CATALOG_ASSET_DUPLICATE' using errcode='22023'; end if;
    v_kept:=array_append(v_kept,v_link_id);
  end loop;

  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'program_catalog_items','INSERT',v_id::text,'SUCCESS',
    jsonb_build_object('program_key','cirugias','before',null,'after',jsonb_build_object('name',v_after.name,'price_cash',v_after.price_cash,'requires_quote',v_after.requires_quote,'enabled',v_after.enabled,'sort_order',v_after.sort_order),'asset_count',v_position,'bootstrap',true));
  return (to_jsonb(v_after)-'source_payload');
end $$;

revoke all on function public.create_first_cirugias_program_catalog_item(jsonb,jsonb) from public,anon;
grant execute on function public.create_first_cirugias_program_catalog_item(jsonb,jsonb) to authenticated;

comment on function public.create_first_cirugias_program_catalog_item(jsonb,jsonb) is
  'One-time browser Admin bootstrap for the first real Cirugias product. Requires program_catalog.write, creates ADMIN_PROGRAM_CATALOG provenance, audits the insert, and refuses every other program key.';

notify pgrst,'reload schema';
commit;
