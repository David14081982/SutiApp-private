begin;

-- H-SUTIAPP-PROGRAM-PRODUCTS-ADMIN-CUTOVER-001
-- program_catalog_items remains the single product authority for SutiApp programs.

create table public.program_catalog_price_mode_reconciliation (
  item_id uuid primary key references public.program_catalog_items(id) on delete restrict,
  program_key text not null,
  item_name text not null,
  price_cash numeric(14,2) not null,
  previous_requires_quote boolean not null,
  previous_updated_at timestamptz not null,
  reconciled_at timestamptz not null,
  decision_key text not null default 'OWNER_DECISION_PROGRAM_PRICE_2026_08_31'
);

alter table public.program_catalog_price_mode_reconciliation enable row level security;
alter table public.program_catalog_price_mode_reconciliation force row level security;
revoke all on public.program_catalog_price_mode_reconciliation from public,anon,authenticated;

do $$
declare
  v_reconciled_at timestamptz:=clock_timestamp();
  v_before integer;
  v_saved integer;
  v_updated integer;
begin
  select count(*) into v_before
  from public.program_catalog_items
  where price_cash is not null and requires_quote;
  if v_before<>65 then
    raise exception 'PROGRAM_PRICE_CONFLICT_COUNT_MISMATCH:%',v_before using errcode='P0001';
  end if;

  insert into public.program_catalog_price_mode_reconciliation(
    item_id,program_key,item_name,price_cash,previous_requires_quote,previous_updated_at,reconciled_at
  )
  select id,program_key,name,price_cash,requires_quote,updated_at,v_reconciled_at
  from public.program_catalog_items
  where price_cash is not null and requires_quote;
  get diagnostics v_saved=row_count;
  if v_saved<>65 then raise exception 'PROGRAM_PRICE_RECONCILIATION_BACKUP_MISMATCH:%',v_saved using errcode='P0001'; end if;

  update public.program_catalog_items i
  set requires_quote=false,updated_at=v_reconciled_at
  from public.program_catalog_price_mode_reconciliation r
  where r.item_id=i.id;
  get diagnostics v_updated=row_count;
  if v_updated<>65 then raise exception 'PROGRAM_PRICE_RECONCILIATION_UPDATE_MISMATCH:%',v_updated using errcode='P0001'; end if;
end $$;

-- Historical provenance stays intact. New Admin rows have explicit ADMIN origin and
-- null historical coordinates instead of invented sheet/hash values.
alter table public.program_catalog_items alter column source_sheet drop not null;
alter table public.program_catalog_items alter column source_row_ordinal drop not null;
alter table public.program_catalog_items alter column source_snapshot_hash drop not null;

alter table public.program_catalog_item_assets add column id uuid not null default extensions.gen_random_uuid();
alter table public.program_catalog_item_assets add column enabled boolean not null default true;
alter table public.program_catalog_item_assets add constraint program_catalog_item_assets_id_unique unique(id);

drop trigger if exists program_catalog_items_set_updated_at on public.program_catalog_items;
create trigger program_catalog_items_set_updated_at before update on public.program_catalog_items
for each row execute function public.set_h0072_updated_at();

-- Dedicated least-privilege capabilities. Marketplace permissions do not authorize
-- this writer and program-catalog permissions do not authorize Marketplace.
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check(permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read',
  'program_catalog.read','program_catalog.write'
]::text[]);

insert into public.admin_role_permissions(role_id,permission)
select id,permission from public.admin_roles
cross join unnest(array['program_catalog.read','program_catalog.write']::text[]) permission
where code='principal_admin' on conflict do nothing;

update public.admin_assignments a
set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=a.role_id),updated_at=now()
where a.enabled;

create or replace function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_allowed text[]:=array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read',
  'program_catalog.read','program_catalog.write'];
begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  if p_permissions is null or exists(select 1 from unnest(p_permissions) p where not(p=any(v_allowed))) then raise exception 'INVALID_PERMISSION' using errcode='22023'; end if;
  if p_role_id is null then
    insert into public.admin_roles(code,name,description) values('role_'||replace(extensions.gen_random_uuid()::text,'-',''),btrim(p_name),coalesce(p_description,'')) returning id into v_id;
  else
    if exists(select 1 from public.admin_roles where id=p_role_id and system_role) then raise exception 'SYSTEM_ROLE_IMMUTABLE' using errcode='P0001'; end if;
    update public.admin_roles set name=btrim(p_name),description=coalesce(p_description,''),updated_at=now() where id=p_role_id returning id into v_id;
    if v_id is null then raise exception 'ROLE_NOT_FOUND' using errcode='P0001'; end if;
    delete from public.admin_role_permissions where role_id=v_id;
  end if;
  insert into public.admin_role_permissions(role_id,permission) select v_id,p from(select distinct unnest(p_permissions) p) q;
  update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=v_id),updated_at=now() where role_id=v_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'admin_roles',case when p_role_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS');
  return v_id;
end $$;

drop policy if exists program_catalog_items_authenticated_read on public.program_catalog_items;
create policy program_catalog_items_authenticated_read on public.program_catalog_items for select to authenticated
using(enabled or public.has_admin_permission('program_catalog.read'));

drop policy if exists program_catalog_item_assets_authenticated_read on public.program_catalog_item_assets;
create policy program_catalog_item_assets_authenticated_read on public.program_catalog_item_assets for select to authenticated
using(enabled and exists(
  select 1 from public.program_catalog_items i
  where i.id=item_id and (i.enabled or public.has_admin_permission('program_catalog.read'))
));

drop policy if exists program_catalog_linked_private_asset_read on public.private_assets;
create policy program_catalog_linked_private_asset_read on public.private_assets for select to authenticated using (
  exists(
    select 1 from public.program_catalog_item_assets l
    join public.program_catalog_items i on i.id=l.item_id
    where l.private_asset_id=private_assets.id and l.enabled and (i.enabled or public.has_admin_permission('program_catalog.read'))
  )
);

drop policy if exists program_catalog_linked_private_storage_read on storage.objects;
create policy program_catalog_linked_private_storage_read on storage.objects for select to authenticated using (
  bucket_id='private-assets' and exists(
    select 1 from public.private_assets a
    join public.program_catalog_item_assets l on l.private_asset_id=a.id
    join public.program_catalog_items i on i.id=l.item_id
    where a.storage_bucket=storage.objects.bucket_id and a.storage_path=storage.objects.name
      and l.enabled and (i.enabled or public.has_admin_permission('program_catalog.read'))
  )
);

create policy program_catalog_storage_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id='app-assets' and public.has_admin_permission('program_catalog.write')
  and (storage.foldername(name))[1]='program-products'
  and (storage.foldername(name))[2]=(select auth.uid())::text
);
create policy program_catalog_storage_admin_update on storage.objects for update to authenticated using (
  bucket_id='app-assets' and public.has_admin_permission('program_catalog.write')
  and (storage.foldername(name))[1]='program-products'
  and (storage.foldername(name))[2]=(select auth.uid())::text
) with check (
  bucket_id='app-assets' and public.has_admin_permission('program_catalog.write')
  and (storage.foldername(name))[1]='program-products'
  and (storage.foldername(name))[2]=(select auth.uid())::text
);
create policy program_catalog_storage_admin_delete on storage.objects for delete to authenticated using (
  bucket_id='app-assets' and public.has_admin_permission('program_catalog.write')
  and (storage.foldername(name))[1]='program-products'
  and (storage.foldername(name))[2]=(select auth.uid())::text
);

create function public.register_program_catalog_asset(
  p_storage_path text,p_mime_type text,p_file_size bigint,p_content_sha256 text,p_alt_text text
) returns uuid language plpgsql volatile security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_id uuid;
begin
  if v_actor is null or not public.has_admin_permission('program_catalog.write') then raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_storage_path is null or p_storage_path not like 'program-products/'||v_actor::text||'/%'
    or p_mime_type not in('image/png','image/jpeg','image/gif','image/webp')
    or p_file_size not between 1 and 10485760
    or upper(coalesce(p_content_sha256,''))!~'^[A-F0-9]{64}$'
    or not exists(select 1 from storage.objects where bucket_id='app-assets' and name=p_storage_path)
  then raise exception 'PROGRAM_CATALOG_ASSET_INVALID' using errcode='22023'; end if;

  insert into public.app_assets(asset_key,asset_type,title,alt_text,storage_bucket,storage_path,mime_type,file_size,content_sha256,status)
  values('program.catalog.admin.'||replace(extensions.gen_random_uuid()::text,'-',''),'image','Producto de programa',left(nullif(btrim(coalesce(p_alt_text,'')),''),240),'app-assets',p_storage_path,p_mime_type,p_file_size,upper(p_content_sha256),'READY')
  on conflict(storage_bucket,storage_path) do update set status='READY',alt_text=coalesce(excluded.alt_text,public.app_assets.alt_text),updated_at=now()
  returning id into v_id;

  insert into public.asset_sources(asset_id,source_sheet,source_column,source_snapshot_hash)
  values(v_id,'ADMIN_PROGRAM_CATALOG','image',upper(p_content_sha256)) on conflict do nothing;
  return v_id;
end $$;

create function public.discard_unlinked_program_catalog_asset(p_asset_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_asset public.app_assets%rowtype;
begin
  if v_actor is null or not public.has_admin_permission('program_catalog.write') then raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501'; end if;
  select * into v_asset from public.app_assets where id=p_asset_id for update;
  if v_asset.id is null or v_asset.storage_bucket<>'app-assets' or v_asset.storage_path not like 'program-products/'||v_actor::text||'/%' then
    raise exception 'PROGRAM_CATALOG_ASSET_NOT_OWNED' using errcode='42501';
  end if;
  if exists(select 1 from public.program_catalog_item_assets where public_asset_id=p_asset_id and enabled) then
    raise exception 'PROGRAM_CATALOG_ASSET_IN_USE' using errcode='P0001';
  end if;
  delete from public.program_catalog_item_assets
  where public_asset_id=p_asset_id and not enabled and source_column='ADMIN_UPLOAD';
  delete from public.app_assets where id=p_asset_id;
  return jsonb_build_object('bucket',v_asset.storage_bucket,'path',v_asset.storage_path);
end $$;

create function public.save_program_catalog_item(p_item_id uuid,p_payload jsonb,p_asset_links jsonb)
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
  if length(v_name) not between 2 and 180 or length(coalesce(v_description,''))>12000 or length(coalesce(v_category,''))>240
    or v_sort not between 1 and 10000 or v_price<0 or (not v_quote and (v_price is null or v_price<=0))
    or not exists(select 1 from public.program_catalog_items where program_key=v_program)
    or jsonb_array_length(p_asset_links)>8
  then raise exception 'PROGRAM_CATALOG_CONTRACT_INVALID' using errcode='22023'; end if;

  if p_item_id is null then
    insert into public.program_catalog_items(program_key,name,description,category_raw,price_cash,requires_quote,request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,source_payload)
    values(v_program,v_name,v_description,v_category,v_price,v_quote,'supabase',false,v_enabled,v_sort,'ADMIN_PROGRAM_CATALOG',null,null,null,'{}'::jsonb)
    returning * into v_after;
    v_id:=v_after.id;
  else
    select * into v_before from public.program_catalog_items where id=p_item_id for update;
    if v_before.id is null then raise exception 'PROGRAM_CATALOG_ITEM_NOT_FOUND' using errcode='P0001'; end if;
    update public.program_catalog_items set program_key=v_program,name=v_name,description=v_description,category_raw=v_category,
      price_cash=v_price,requires_quote=v_quote,enabled=v_enabled,sort_order=v_sort
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
  update public.program_catalog_item_assets set enabled=false
  where item_id=v_id and enabled and not(id=any(v_kept));

  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'program_catalog_items',case when p_item_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS',
    jsonb_build_object('program_key',v_after.program_key,'before',case when v_before.id is null then null else jsonb_build_object('name',v_before.name,'price_cash',v_before.price_cash,'requires_quote',v_before.requires_quote,'enabled',v_before.enabled,'sort_order',v_before.sort_order) end,
      'after',jsonb_build_object('name',v_after.name,'price_cash',v_after.price_cash,'requires_quote',v_after.requires_quote,'enabled',v_after.enabled,'sort_order',v_after.sort_order),'asset_count',v_position));
  return (to_jsonb(v_after)-'source_payload');
end $$;

create function public.reorder_program_catalog_items(p_program_key text,p_item_ids uuid[])
returns boolean language plpgsql volatile security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_count integer; v_id uuid; v_position integer:=0;
begin
  if v_actor is null or not public.has_admin_permission('program_catalog.write') then raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_item_ids is null or cardinality(p_item_ids)=0 or cardinality(p_item_ids)>500 or cardinality(p_item_ids)<>(select count(distinct x) from unnest(p_item_ids) x) then
    raise exception 'PROGRAM_CATALOG_ORDER_INVALID' using errcode='22023';
  end if;
  select count(*) into v_count from public.program_catalog_items where program_key=p_program_key;
  if v_count<>cardinality(p_item_ids) or exists(select 1 from unnest(p_item_ids) x where not exists(select 1 from public.program_catalog_items i where i.id=x and i.program_key=p_program_key)) then
    raise exception 'PROGRAM_CATALOG_ORDER_SCOPE_MISMATCH' using errcode='22023';
  end if;
  update public.program_catalog_items set sort_order=sort_order+10000 where program_key=p_program_key;
  foreach v_id in array p_item_ids loop v_position:=v_position+1; update public.program_catalog_items set sort_order=v_position where id=v_id; end loop;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'program_catalog_items','REORDER',p_program_key,'SUCCESS',jsonb_build_object('item_count',v_count));
  return true;
end $$;

revoke all on function public.register_program_catalog_asset(text,text,bigint,text,text) from public,anon;
revoke all on function public.discard_unlinked_program_catalog_asset(uuid) from public,anon;
revoke all on function public.save_program_catalog_item(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.reorder_program_catalog_items(text,uuid[]) from public,anon;
grant execute on function public.register_program_catalog_asset(text,text,bigint,text,text) to authenticated;
grant execute on function public.discard_unlinked_program_catalog_asset(uuid) to authenticated;
grant execute on function public.save_program_catalog_item(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.reorder_program_catalog_items(text,uuid[]) to authenticated;

comment on table public.program_catalog_price_mode_reconciliation is 'Recovery/evidence snapshot for the owner-approved fixed-price reconciliation; never a product authority.';
comment on function public.save_program_catalog_item(uuid,jsonb,jsonb) is 'Only browser Admin writer for SutiApp-owned program products; provenance fields are never accepted from the client.';
comment on column public.program_catalog_item_assets.enabled is 'Logical removal preserves the historical asset relation and provenance.';

notify pgrst,'reload schema';
commit;
