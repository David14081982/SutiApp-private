begin;

do $$
begin
  if to_regprocedure('public.save_program_catalog_item(uuid,jsonb,jsonb)') is null
     or to_regprocedure('public.create_first_cirugias_program_catalog_item(jsonb,jsonb)') is null then
    raise exception 'PROGRAM_CATALOG_WRITER_MISSING';
  end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.program_catalog_items'::regclass
      and conname='program_catalog_items_program_check'
      and convalidated
  ) then
    raise exception 'PROGRAM_CATALOG_PROGRAM_CONSTRAINT_MISSING';
  end if;
end $$;

create table public.program_catalog_save_contract_migration_backup(
  singleton boolean primary key default true check(singleton),
  applied_at timestamptz not null default clock_timestamp(),
  general_writer_definition text not null,
  cirugias_writer_definition text not null,
  program_constraint_definition text not null,
  item_count integer not null,
  item_hash text not null,
  asset_count integer not null,
  asset_hash text not null
);

alter table public.program_catalog_save_contract_migration_backup enable row level security;
alter table public.program_catalog_save_contract_migration_backup force row level security;
revoke all on public.program_catalog_save_contract_migration_backup from public,anon,authenticated;

insert into public.program_catalog_save_contract_migration_backup(
  singleton,general_writer_definition,cirugias_writer_definition,program_constraint_definition,
  item_count,item_hash,asset_count,asset_hash
)
select true,
  pg_get_functiondef('public.save_program_catalog_item(uuid,jsonb,jsonb)'::regprocedure),
  pg_get_functiondef('public.create_first_cirugias_program_catalog_item(jsonb,jsonb)'::regprocedure),
  (select pg_get_constraintdef(oid) from pg_constraint
   where conrelid='public.program_catalog_items'::regclass and conname='program_catalog_items_program_check'),
  (select count(*)::integer from public.program_catalog_items),
  (select md5(coalesce(string_agg(to_jsonb(i)::text,';' order by i.id),'')) from public.program_catalog_items i),
  (select count(*)::integer from public.program_catalog_item_assets),
  (select md5(coalesce(string_agg(to_jsonb(a)::text,';' order by a.id),'')) from public.program_catalog_item_assets a);

alter table public.program_catalog_items drop constraint program_catalog_items_program_check;
alter table public.program_catalog_items add constraint program_catalog_items_program_check check(
  program_key in('auto','renta','casa','terrenos','solar','aires','puertas','computo','farma','tours','donativos','prestamo','cirugias')
);

create or replace function public.save_program_catalog_item(p_item_id uuid,p_payload jsonb,p_asset_links jsonb)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_before public.program_catalog_items%rowtype;
  v_after public.program_catalog_items%rowtype;
  v_id uuid;
  v_program text:=btrim(coalesce(p_payload->>'program_key',''));
  v_name text:=btrim(coalesce(p_payload->>'name',''));
  v_description text:=nullif(btrim(coalesce(p_payload->>'description','')),'');
  v_category text:=nullif(btrim(coalesce(p_payload->>'category_raw','')),'');
  v_price numeric;
  v_quote boolean;
  v_mode text;
  v_sold boolean;
  v_enabled boolean;
  v_sort integer;
  v_existing_asset_count integer:=0;
  v_requested_asset_count integer:=0;
  v_allowed_asset_count integer:=8;
  v_link jsonb;
  v_link_id uuid;
  v_public_asset_id uuid;
  v_kept uuid[]:='{}'::uuid[];
  v_position integer:=0;
begin
  if v_actor is null or not public.has_admin_permission('program_catalog.write') then
    raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or p_asset_links is null or jsonb_typeof(p_asset_links)<>'array' then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if exists(
    select 1 from jsonb_object_keys(p_payload) k
    where k not in('program_key','name','description','category_raw','price_cash','requires_quote','commercial_mode','sold','enabled','sort_order')
  ) then
    raise exception 'PROGRAM_CATALOG_FIELD_NOT_EDITABLE' using errcode='22023';
  end if;

  if p_item_id is not null then
    select * into v_before from public.program_catalog_items where id=p_item_id for update;
    if v_before.id is null then raise exception 'PROGRAM_CATALOG_ITEM_NOT_FOUND' using errcode='P0001'; end if;
    select count(*)::integer into v_existing_asset_count
    from public.program_catalog_item_assets where item_id=p_item_id and enabled;
    v_allowed_asset_count:=greatest(8,v_existing_asset_count);
  end if;

  begin
    v_price:=nullif(p_payload->>'price_cash','')::numeric;
    v_quote:=(p_payload->>'requires_quote')::boolean;
    v_enabled:=(p_payload->>'enabled')::boolean;
    v_sort:=(p_payload->>'sort_order')::integer;
    v_mode:=nullif(btrim(coalesce(p_payload->>'commercial_mode','')),'');
    v_sold:=case when p_payload ? 'sold' then (p_payload->>'sold')::boolean
      when v_before.id is not null then v_before.sold else false end;
    v_requested_asset_count:=jsonb_array_length(p_asset_links);
  exception when others then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end;
  if v_quote is null or v_enabled is null or v_sold is null or v_sort is null then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if v_mode is null then
    v_mode:=case when v_before.id is not null then v_before.commercial_mode when v_quote then 'PAYROLL_QUOTE' else 'PAYROLL_FIXED' end;
  end if;

  if length(v_name) not between 2 and 180
     and (v_before.id is null or v_name is distinct from v_before.name) then
    raise exception 'PROGRAM_CATALOG_NAME_INVALID' using errcode='22023';
  end if;
  if length(coalesce(v_description,''))>12000
     and (v_before.id is null or v_description is distinct from v_before.description) then
    raise exception 'PROGRAM_CATALOG_DESCRIPTION_TOO_LONG' using errcode='22023';
  end if;
  if length(coalesce(v_category,''))>240
     and (v_before.id is null or v_category is distinct from v_before.category_raw) then
    raise exception 'PROGRAM_CATALOG_CATEGORY_TOO_LONG' using errcode='22023';
  end if;
  if v_sort not between 1 and 10000
     and (v_before.id is null or v_sort is distinct from v_before.sort_order) then
    raise exception 'PROGRAM_CATALOG_ORDER_INVALID' using errcode='22023';
  end if;
  if v_price<0 and (v_before.id is null or v_price is distinct from v_before.price_cash) then
    raise exception 'PROGRAM_CATALOG_PRICE_INVALID' using errcode='22023';
  end if;
  if v_mode not in('PAYROLL_FIXED','PAYROLL_QUOTE','DIRECT_CONTACT') then
    raise exception 'PROGRAM_CATALOG_MODE_INVALID' using errcode='22023';
  end if;
  if (v_mode='PAYROLL_QUOTE')<>v_quote then
    raise exception 'PROGRAM_CATALOG_MODE_QUOTE_MISMATCH' using errcode='22023';
  end if;
  if v_mode='PAYROLL_FIXED' and (v_price is null or v_price<=0)
     and (
       v_before.id is null
       or v_before.commercial_mode<>'PAYROLL_FIXED'
       or (v_before.price_cash is not null and v_before.price_cash>0)
       or v_price is distinct from v_before.price_cash
     ) then
    raise exception 'PROGRAM_CATALOG_PRICE_REQUIRED' using errcode='22023';
  end if;
  if not exists(select 1 from public.program_catalog_items where program_key=v_program)
     and (v_before.id is null or v_program is distinct from v_before.program_key) then
    raise exception 'PROGRAM_CATALOG_PROGRAM_INVALID' using errcode='22023';
  end if;
  if v_requested_asset_count>v_allowed_asset_count then
    raise exception 'PROGRAM_CATALOG_IMAGE_LIMIT_EXCEEDED' using errcode='22023',
      detail='allowed='||v_allowed_asset_count::text||',requested='||v_requested_asset_count::text;
  end if;

  if p_item_id is null then
    insert into public.program_catalog_items(
      program_key,name,description,category_raw,price_cash,requires_quote,commercial_mode,sold,sold_at,sold_by,
      request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,source_payload
    ) values(
      v_program,v_name,v_description,v_category,v_price,v_quote,v_mode,v_sold,
      case when v_sold then now() else null end,case when v_sold then v_actor else null end,
      'supabase',false,v_enabled,v_sort,'ADMIN_PROGRAM_CATALOG',null,null,null,'{}'::jsonb
    ) returning * into v_after;
    v_id:=v_after.id;
  else
    update public.program_catalog_items set
      program_key=v_program,name=v_name,description=v_description,category_raw=v_category,
      price_cash=v_price,requires_quote=v_quote,commercial_mode=v_mode,sold=v_sold,
      sold_at=case when v_sold then coalesce(v_before.sold_at,now()) else null end,
      sold_by=case when v_sold then coalesce(v_before.sold_by,v_actor) else null end,
      enabled=v_enabled,sort_order=v_sort
    where id=p_item_id returning * into v_after;
    v_id:=v_after.id;
  end if;

  update public.program_catalog_item_assets set sort_order=sort_order+10000 where item_id=v_id and enabled;
  for v_link in select value from jsonb_array_elements(p_asset_links) loop
    v_position:=v_position+1;
    begin
      v_link_id:=nullif(v_link->>'link_id','')::uuid;
      v_public_asset_id:=nullif(v_link->>'public_asset_id','')::uuid;
    exception when others then
      raise exception 'PROGRAM_CATALOG_ASSET_LINK_INVALID' using errcode='22023';
    end;
    if (v_link_id is null)=(v_public_asset_id is null) then
      raise exception 'PROGRAM_CATALOG_ASSET_LINK_INVALID' using errcode='22023';
    end if;
    if v_link_id is not null then
      if not exists(select 1 from public.program_catalog_item_assets where id=v_link_id and item_id=v_id) then
        raise exception 'PROGRAM_CATALOG_ASSET_LINK_NOT_FOUND' using errcode='P0001';
      end if;
      update public.program_catalog_item_assets set
        enabled=true,role=case when v_position=1 then 'cover' else 'gallery' end,sort_order=v_position
      where id=v_link_id;
    else
      if not exists(
        select 1 from public.app_assets
        where id=v_public_asset_id and status='READY' and storage_bucket='app-assets'
          and storage_path like 'program-products/%'
      ) then
        raise exception 'PROGRAM_CATALOG_PUBLIC_ASSET_INVALID' using errcode='22023';
      end if;
      select id into v_link_id from public.program_catalog_item_assets
      where item_id=v_id and public_asset_id=v_public_asset_id order by enabled desc limit 1;
      if v_link_id is null then
        v_link_id:=extensions.gen_random_uuid();
        insert into public.program_catalog_item_assets(
          id,item_id,public_asset_id,private_asset_id,role,sort_order,source_column,source_column_letter,enabled
        ) values(
          v_link_id,v_id,v_public_asset_id,null,case when v_position=1 then 'cover' else 'gallery' end,
          v_position,'ADMIN_UPLOAD','ADMIN_'||replace(v_link_id::text,'-',''),true
        );
      else
        update public.program_catalog_item_assets set
          enabled=true,role=case when v_position=1 then 'cover' else 'gallery' end,sort_order=v_position
        where id=v_link_id;
      end if;
    end if;
    if v_link_id=any(v_kept) then
      raise exception 'PROGRAM_CATALOG_ASSET_DUPLICATE' using errcode='22023';
    end if;
    v_kept:=array_append(v_kept,v_link_id);
  end loop;
  update public.program_catalog_item_assets set enabled=false
  where item_id=v_id and enabled and not(id=any(v_kept));

  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'program_catalog_items',case when p_item_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS',
    jsonb_build_object(
      'program_key',v_after.program_key,
      'before',case when v_before.id is null then null else jsonb_build_object(
        'name',v_before.name,'price_cash',v_before.price_cash,'requires_quote',v_before.requires_quote,
        'commercial_mode',v_before.commercial_mode,'sold',v_before.sold,'sold_at',v_before.sold_at,
        'sold_by',v_before.sold_by,'enabled',v_before.enabled,'sort_order',v_before.sort_order
      ) end,
      'after',jsonb_build_object(
        'name',v_after.name,'price_cash',v_after.price_cash,'requires_quote',v_after.requires_quote,
        'commercial_mode',v_after.commercial_mode,'sold',v_after.sold,'sold_at',v_after.sold_at,
        'sold_by',v_after.sold_by,'enabled',v_after.enabled,'sort_order',v_after.sort_order
      ),
      'asset_count',v_position,'asset_limit',v_allowed_asset_count,'delta_aware',true
    ));
  return (to_jsonb(v_after)-'source_payload'-'sold_by');
end $$;

create or replace function public.create_first_cirugias_program_catalog_item(p_payload jsonb,p_asset_links jsonb)
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
  v_price numeric;v_quote boolean;v_mode text;v_sold boolean;v_enabled boolean;v_sort integer;
  v_link jsonb;v_link_id uuid;v_public_asset_id uuid;v_kept uuid[]:='{}'::uuid[];v_position integer:=0;
begin
  if v_actor is null or not public.has_admin_permission('program_catalog.write') then
    raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or p_asset_links is null or jsonb_typeof(p_asset_links)<>'array' then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if exists(
    select 1 from jsonb_object_keys(p_payload) k
    where k not in('program_key','name','description','category_raw','price_cash','requires_quote','commercial_mode','sold','enabled','sort_order')
  ) then
    raise exception 'PROGRAM_CATALOG_FIELD_NOT_EDITABLE' using errcode='22023';
  end if;
  begin
    v_price:=nullif(p_payload->>'price_cash','')::numeric;
    v_quote:=(p_payload->>'requires_quote')::boolean;
    v_mode:=coalesce(nullif(btrim(coalesce(p_payload->>'commercial_mode','')),''),case when v_quote then 'PAYROLL_QUOTE' else 'PAYROLL_FIXED' end);
    v_sold:=case when p_payload ? 'sold' then (p_payload->>'sold')::boolean else false end;
    v_enabled:=(p_payload->>'enabled')::boolean;
    v_sort:=(p_payload->>'sort_order')::integer;
  exception when others then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end;
  if v_quote is null or v_enabled is null or v_sold is null or v_sort is null then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if v_program<>'cirugias' then raise exception 'PROGRAM_CATALOG_PROGRAM_INVALID' using errcode='22023'; end if;
  if length(v_name) not between 2 and 180 then raise exception 'PROGRAM_CATALOG_NAME_INVALID' using errcode='22023'; end if;
  if length(coalesce(v_description,''))>12000 then raise exception 'PROGRAM_CATALOG_DESCRIPTION_TOO_LONG' using errcode='22023'; end if;
  if length(coalesce(v_category,''))>240 then raise exception 'PROGRAM_CATALOG_CATEGORY_TOO_LONG' using errcode='22023'; end if;
  if v_sort not between 1 and 10000 then raise exception 'PROGRAM_CATALOG_ORDER_INVALID' using errcode='22023'; end if;
  if v_price<0 then raise exception 'PROGRAM_CATALOG_PRICE_INVALID' using errcode='22023'; end if;
  if v_mode not in('PAYROLL_FIXED','PAYROLL_QUOTE','DIRECT_CONTACT') then raise exception 'PROGRAM_CATALOG_MODE_INVALID' using errcode='22023'; end if;
  if (v_mode='PAYROLL_QUOTE')<>v_quote then raise exception 'PROGRAM_CATALOG_MODE_QUOTE_MISMATCH' using errcode='22023'; end if;
  if v_mode='PAYROLL_FIXED' and (v_price is null or v_price<=0) then raise exception 'PROGRAM_CATALOG_PRICE_REQUIRED' using errcode='22023'; end if;
  if jsonb_array_length(p_asset_links)>8 then raise exception 'PROGRAM_CATALOG_IMAGE_LIMIT_EXCEEDED' using errcode='22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('program_catalog_items:cirugias',0));
  if exists(select 1 from public.program_catalog_items where program_key='cirugias') then
    raise exception 'CIRUGIAS_PROGRAM_ALREADY_BOOTSTRAPPED' using errcode='P0001';
  end if;
  insert into public.program_catalog_items(
    program_key,name,description,category_raw,price_cash,requires_quote,commercial_mode,sold,sold_at,sold_by,
    request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,source_payload
  ) values(
    'cirugias',v_name,v_description,v_category,v_price,v_quote,v_mode,v_sold,
    case when v_sold then now() else null end,case when v_sold then v_actor else null end,
    'supabase',false,v_enabled,v_sort,'ADMIN_PROGRAM_CATALOG',null,null,null,'{}'::jsonb
  ) returning * into v_after;
  v_id:=v_after.id;
  for v_link in select value from jsonb_array_elements(p_asset_links) loop
    v_position:=v_position+1;
    begin
      v_link_id:=nullif(v_link->>'link_id','')::uuid;
      v_public_asset_id:=nullif(v_link->>'public_asset_id','')::uuid;
    exception when others then
      raise exception 'PROGRAM_CATALOG_ASSET_LINK_INVALID' using errcode='22023';
    end;
    if v_link_id is not null or v_public_asset_id is null then
      raise exception 'PROGRAM_CATALOG_ASSET_LINK_INVALID' using errcode='22023';
    end if;
    if not exists(
      select 1 from public.app_assets
      where id=v_public_asset_id and status='READY' and storage_bucket='app-assets'
        and storage_path like 'program-products/%'
    ) then
      raise exception 'PROGRAM_CATALOG_PUBLIC_ASSET_INVALID' using errcode='22023';
    end if;
    v_link_id:=extensions.gen_random_uuid();
    insert into public.program_catalog_item_assets(
      id,item_id,public_asset_id,private_asset_id,role,sort_order,source_column,source_column_letter,enabled
    ) values(
      v_link_id,v_id,v_public_asset_id,null,case when v_position=1 then 'cover' else 'gallery' end,
      v_position,'ADMIN_UPLOAD','ADMIN_'||replace(v_link_id::text,'-',''),true
    );
    if v_link_id=any(v_kept) then raise exception 'PROGRAM_CATALOG_ASSET_DUPLICATE' using errcode='22023'; end if;
    v_kept:=array_append(v_kept,v_link_id);
  end loop;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'program_catalog_items','INSERT',v_id::text,'SUCCESS',jsonb_build_object(
    'program_key','cirugias','before',null,
    'after',jsonb_build_object(
      'name',v_after.name,'price_cash',v_after.price_cash,'requires_quote',v_after.requires_quote,
      'commercial_mode',v_after.commercial_mode,'sold',v_after.sold,'sold_at',v_after.sold_at,
      'sold_by',v_after.sold_by,'enabled',v_after.enabled,'sort_order',v_after.sort_order
    ),'asset_count',v_position,'asset_limit',8,'bootstrap',true,'delta_aware',true
  ));
  return (to_jsonb(v_after)-'source_payload'-'sold_by');
end $$;

revoke all on function public.save_program_catalog_item(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_program_catalog_item(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.create_first_cirugias_program_catalog_item(jsonb,jsonb) from public,anon;
grant execute on function public.create_first_cirugias_program_catalog_item(jsonb,jsonb) to authenticated;

comment on function public.save_program_catalog_item(uuid,jsonb,jsonb) is
  'Delta-aware Admin writer: preserves already accepted historical scalar/image state while rejecting new invalid growth; program_catalog.write and audit remain mandatory.';
comment on function public.create_first_cirugias_program_catalog_item(jsonb,jsonb) is
  'Strict one-time Cirugias bootstrap with specific validation errors, maximum eight images, program_catalog.write and audit.';

notify pgrst,'reload schema';
commit;
