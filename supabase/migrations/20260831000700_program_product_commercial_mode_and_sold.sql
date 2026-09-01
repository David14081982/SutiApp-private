begin;

create table public.program_catalog_commercial_mode_migration_backup (
  singleton boolean primary key default true check(singleton),
  applied_at timestamptz not null default now(),
  item_count integer not null,
  item_ids uuid[] not null,
  item_hash text not null,
  general_writer_definition text not null,
  cirugias_writer_definition text not null
);
alter table public.program_catalog_commercial_mode_migration_backup enable row level security;
alter table public.program_catalog_commercial_mode_migration_backup force row level security;
revoke all on public.program_catalog_commercial_mode_migration_backup from public,anon,authenticated;

insert into public.program_catalog_commercial_mode_migration_backup(
  singleton,item_count,item_ids,item_hash,general_writer_definition,cirugias_writer_definition
)
select true,count(*)::integer,array_agg(id order by id),
  md5(string_agg(id::text||'|'||program_key||'|'||name||'|'||coalesce(price_cash::text,'')||'|'||requires_quote::text||'|'||enabled::text||'|'||sort_order::text||'|'||updated_at::text,';' order by id)),
  pg_get_functiondef('public.save_program_catalog_item(uuid,jsonb,jsonb)'::regprocedure),
  pg_get_functiondef('public.create_first_cirugias_program_catalog_item(jsonb,jsonb)'::regprocedure)
from public.program_catalog_items;

alter table public.program_catalog_items
  add column commercial_mode text null,
  add column sold boolean not null default false,
  add column sold_at timestamptz null,
  add column sold_by uuid null references auth.users(id) on delete restrict;

alter table public.program_catalog_items disable trigger program_catalog_items_set_updated_at;
update public.program_catalog_items
set commercial_mode=case
  when program_key='casa' then 'DIRECT_CONTACT'
  when requires_quote then 'PAYROLL_QUOTE'
  else 'PAYROLL_FIXED'
end;
alter table public.program_catalog_items enable trigger program_catalog_items_set_updated_at;

alter table public.program_catalog_items
  alter column commercial_mode set default 'PAYROLL_QUOTE',
  alter column commercial_mode set not null,
  add constraint program_catalog_items_commercial_mode_check check(
    commercial_mode in('PAYROLL_FIXED','PAYROLL_QUOTE','DIRECT_CONTACT')
    and (commercial_mode='PAYROLL_QUOTE')=requires_quote
  ),
  add constraint program_catalog_items_sold_audit_check check(
    (not sold and sold_at is null and sold_by is null)
    or (sold and sold_at is not null and sold_by is not null)
  );

grant select(commercial_mode,sold,sold_at) on public.program_catalog_items to authenticated;

create function public.enforce_program_catalog_requestability()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_item public.program_catalog_items%rowtype;
begin
  if new.program_item_id is null then return new; end if;
  select * into v_item from public.program_catalog_items where id=new.program_item_id;
  if v_item.id is null then raise exception 'PROGRAM_PRODUCT_NOT_FOUND' using errcode='P0001'; end if;
  if v_item.sold then raise exception 'PROGRAM_PRODUCT_SOLD' using errcode='P0001'; end if;
  if v_item.commercial_mode='DIRECT_CONTACT' then
    raise exception 'PROGRAM_PRODUCT_DIRECT_CONTACT_ONLY' using errcode='P0001';
  end if;
  if v_item.program_key='prestamo' then return new; end if;
  if v_item.commercial_mode='PAYROLL_QUOTE' and new.request_type='quote'
     and new.financial_submission_snapshot is null then return new; end if;
  if new.request_type='benefit'
     and new.financial_submission_snapshot->>'contract_version'='PROGRAM_PRODUCT_PAYMENT_V1' then return new; end if;
  raise exception 'PROGRAM_PRODUCT_PAYMENT_FLOW_REQUIRED' using errcode='P0001';
end $$;

create trigger program_requests_catalog_requestability
before insert on public.program_requests
for each row execute function public.enforce_program_catalog_requestability();

revoke all on function public.enforce_program_catalog_requestability() from public,anon,authenticated;

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
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('program_key','name','description','category_raw','price_cash','requires_quote','commercial_mode','sold','enabled','sort_order')) then
    raise exception 'PROGRAM_CATALOG_FIELD_NOT_EDITABLE' using errcode='22023';
  end if;
  if p_item_id is not null then
    select * into v_before from public.program_catalog_items where id=p_item_id for update;
    if v_before.id is null then raise exception 'PROGRAM_CATALOG_ITEM_NOT_FOUND' using errcode='P0001'; end if;
  end if;
  begin
    v_price:=nullif(p_payload->>'price_cash','')::numeric;
    v_quote:=(p_payload->>'requires_quote')::boolean;
    v_enabled:=(p_payload->>'enabled')::boolean;
    v_sort:=(p_payload->>'sort_order')::integer;
    v_mode:=nullif(btrim(coalesce(p_payload->>'commercial_mode','')),'');
    v_sold:=case when p_payload ? 'sold' then (p_payload->>'sold')::boolean
      when v_before.id is not null then v_before.sold else false end;
  exception when others then raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023'; end;
  if v_mode is null then v_mode:=case when v_before.id is not null then v_before.commercial_mode when v_quote then 'PAYROLL_QUOTE' else 'PAYROLL_FIXED' end; end if;
  if length(v_name) not between 2 and 180 or length(coalesce(v_description,''))>12000 or length(coalesce(v_category,''))>240
    or v_sort not between 1 and 10000 or v_price<0 or v_mode not in('PAYROLL_FIXED','PAYROLL_QUOTE','DIRECT_CONTACT')
    or (v_mode='PAYROLL_QUOTE')<>v_quote or (v_mode='PAYROLL_FIXED' and (v_price is null or v_price<=0))
    or not exists(select 1 from public.program_catalog_items where program_key=v_program)
    or jsonb_array_length(p_asset_links)>8
  then raise exception 'PROGRAM_CATALOG_CONTRACT_INVALID' using errcode='22023'; end if;

  if p_item_id is null then
    insert into public.program_catalog_items(program_key,name,description,category_raw,price_cash,requires_quote,commercial_mode,sold,sold_at,sold_by,request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,source_payload)
    values(v_program,v_name,v_description,v_category,v_price,v_quote,v_mode,v_sold,case when v_sold then now() else null end,case when v_sold then v_actor else null end,'supabase',false,v_enabled,v_sort,'ADMIN_PROGRAM_CATALOG',null,null,null,'{}'::jsonb)
    returning * into v_after;
    v_id:=v_after.id;
  else
    update public.program_catalog_items set program_key=v_program,name=v_name,description=v_description,category_raw=v_category,
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
    v_link_id:=nullif(v_link->>'link_id','')::uuid;
    v_public_asset_id:=nullif(v_link->>'public_asset_id','')::uuid;
    if (v_link_id is null)=(v_public_asset_id is null) then raise exception 'PROGRAM_CATALOG_ASSET_LINK_INVALID' using errcode='22023'; end if;
    if v_link_id is not null then
      if not exists(select 1 from public.program_catalog_item_assets where id=v_link_id and item_id=v_id) then raise exception 'PROGRAM_CATALOG_ASSET_LINK_NOT_FOUND' using errcode='P0001'; end if;
      update public.program_catalog_item_assets set enabled=true,role=case when v_position=1 then 'cover' else 'gallery' end,sort_order=v_position where id=v_link_id;
    else
      if not exists(select 1 from public.app_assets where id=v_public_asset_id and status='READY' and storage_bucket='app-assets' and storage_path like 'program-products/%') then raise exception 'PROGRAM_CATALOG_PUBLIC_ASSET_INVALID' using errcode='22023'; end if;
      select id into v_link_id from public.program_catalog_item_assets where item_id=v_id and public_asset_id=v_public_asset_id order by enabled desc limit 1;
      if v_link_id is null then
        v_link_id:=extensions.gen_random_uuid();
        insert into public.program_catalog_item_assets(id,item_id,public_asset_id,private_asset_id,role,sort_order,source_column,source_column_letter,enabled)
        values(v_link_id,v_id,v_public_asset_id,null,case when v_position=1 then 'cover' else 'gallery' end,v_position,'ADMIN_UPLOAD','ADMIN_'||replace(v_link_id::text,'-',''),true);
      else
        update public.program_catalog_item_assets set enabled=true,role=case when v_position=1 then 'cover' else 'gallery' end,sort_order=v_position where id=v_link_id;
      end if;
    end if;
    if v_link_id=any(v_kept) then raise exception 'PROGRAM_CATALOG_ASSET_DUPLICATE' using errcode='22023'; end if;
    v_kept:=array_append(v_kept,v_link_id);
  end loop;
  update public.program_catalog_item_assets set enabled=false where item_id=v_id and enabled and not(id=any(v_kept));

  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'program_catalog_items',case when p_item_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS',
    jsonb_build_object('program_key',v_after.program_key,'before',case when v_before.id is null then null else jsonb_build_object('name',v_before.name,'price_cash',v_before.price_cash,'requires_quote',v_before.requires_quote,'commercial_mode',v_before.commercial_mode,'sold',v_before.sold,'sold_at',v_before.sold_at,'sold_by',v_before.sold_by,'enabled',v_before.enabled,'sort_order',v_before.sort_order) end,
      'after',jsonb_build_object('name',v_after.name,'price_cash',v_after.price_cash,'requires_quote',v_after.requires_quote,'commercial_mode',v_after.commercial_mode,'sold',v_after.sold,'sold_at',v_after.sold_at,'sold_by',v_after.sold_by,'enabled',v_after.enabled,'sort_order',v_after.sort_order),'asset_count',v_position));
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
  if v_actor is null or not public.has_admin_permission('program_catalog.write') then raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_asset_links is null or jsonb_typeof(p_asset_links)<>'array' then raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('program_key','name','description','category_raw','price_cash','requires_quote','commercial_mode','sold','enabled','sort_order')) then raise exception 'PROGRAM_CATALOG_FIELD_NOT_EDITABLE' using errcode='22023'; end if;
  begin
    v_price:=nullif(p_payload->>'price_cash','')::numeric;v_quote:=(p_payload->>'requires_quote')::boolean;
    v_mode:=coalesce(nullif(btrim(coalesce(p_payload->>'commercial_mode','')),''),case when v_quote then 'PAYROLL_QUOTE' else 'PAYROLL_FIXED' end);
    v_sold:=case when p_payload ? 'sold' then (p_payload->>'sold')::boolean else false end;
    v_enabled:=(p_payload->>'enabled')::boolean;v_sort:=(p_payload->>'sort_order')::integer;
  exception when others then raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023'; end;
  if v_program<>'cirugias' or length(v_name) not between 2 and 180 or length(coalesce(v_description,''))>12000 or length(coalesce(v_category,''))>240
    or v_sort not between 1 and 10000 or v_price<0 or v_mode not in('PAYROLL_FIXED','PAYROLL_QUOTE','DIRECT_CONTACT')
    or (v_mode='PAYROLL_QUOTE')<>v_quote or (v_mode='PAYROLL_FIXED' and (v_price is null or v_price<=0)) or jsonb_array_length(p_asset_links)>8
  then raise exception 'PROGRAM_CATALOG_CONTRACT_INVALID' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('program_catalog_items:cirugias',0));
  if exists(select 1 from public.program_catalog_items where program_key='cirugias') then raise exception 'CIRUGIAS_PROGRAM_ALREADY_BOOTSTRAPPED' using errcode='P0001'; end if;
  insert into public.program_catalog_items(program_key,name,description,category_raw,price_cash,requires_quote,commercial_mode,sold,sold_at,sold_by,request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,source_payload)
  values('cirugias',v_name,v_description,v_category,v_price,v_quote,v_mode,v_sold,case when v_sold then now() else null end,case when v_sold then v_actor else null end,'supabase',false,v_enabled,v_sort,'ADMIN_PROGRAM_CATALOG',null,null,null,'{}'::jsonb)
  returning * into v_after;v_id:=v_after.id;
  for v_link in select value from jsonb_array_elements(p_asset_links) loop
    v_position:=v_position+1;v_link_id:=nullif(v_link->>'link_id','')::uuid;v_public_asset_id:=nullif(v_link->>'public_asset_id','')::uuid;
    if v_link_id is not null or v_public_asset_id is null then raise exception 'CIRUGIAS_BOOTSTRAP_ASSET_LINK_INVALID' using errcode='22023'; end if;
    if not exists(select 1 from public.app_assets where id=v_public_asset_id and status='READY' and storage_bucket='app-assets' and storage_path like 'program-products/%') then raise exception 'PROGRAM_CATALOG_PUBLIC_ASSET_INVALID' using errcode='22023'; end if;
    v_link_id:=extensions.gen_random_uuid();
    insert into public.program_catalog_item_assets(id,item_id,public_asset_id,private_asset_id,role,sort_order,source_column,source_column_letter,enabled)
    values(v_link_id,v_id,v_public_asset_id,null,case when v_position=1 then 'cover' else 'gallery' end,v_position,'ADMIN_UPLOAD','ADMIN_'||replace(v_link_id::text,'-',''),true);
    if v_link_id=any(v_kept) then raise exception 'PROGRAM_CATALOG_ASSET_DUPLICATE' using errcode='22023'; end if;v_kept:=array_append(v_kept,v_link_id);
  end loop;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'program_catalog_items','INSERT',v_id::text,'SUCCESS',jsonb_build_object('program_key','cirugias','before',null,'after',jsonb_build_object('name',v_after.name,'price_cash',v_after.price_cash,'requires_quote',v_after.requires_quote,'commercial_mode',v_after.commercial_mode,'sold',v_after.sold,'sold_at',v_after.sold_at,'sold_by',v_after.sold_by,'enabled',v_after.enabled,'sort_order',v_after.sort_order),'asset_count',v_position,'bootstrap',true));
  return (to_jsonb(v_after)-'source_payload'-'sold_by');
end $$;

comment on column public.program_catalog_items.commercial_mode is 'Independent acquisition contract: payroll fixed, payroll after approved quote, or direct contact without SutiApp financing.';
comment on column public.program_catalog_items.sold is 'Independent availability state. Enabled sold items remain visible but reject every new acquisition request.';
comment on function public.enforce_program_catalog_requestability() is 'Central insert guard: sold and direct-contact program items cannot create program_requests; payroll modes must use their authorized flow.';
comment on function public.save_program_catalog_item(uuid,jsonb,jsonb) is 'Only browser Admin writer for SutiApp-owned program products, including independent commercial_mode and sold state with audit.';
comment on function public.create_first_cirugias_program_catalog_item(jsonb,jsonb) is 'One-time browser Admin bootstrap for the first real Cirugias product with commercial mode and sold audit support.';

notify pgrst,'reload schema';
commit;
