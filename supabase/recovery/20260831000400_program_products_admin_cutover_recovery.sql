begin;

drop trigger if exists program_catalog_asset_owner_guard on public.program_catalog_item_assets;
drop function if exists public.enforce_program_catalog_asset_owner();

do $$
declare v_cutover timestamptz;
begin
  select min(reconciled_at) into v_cutover from public.program_catalog_price_mode_reconciliation;
  if exists(select 1 from public.program_catalog_items where record_origin='ADMIN_PROGRAM_CATALOG')
     or exists(select 1 from public.admin_audit_log where resource='program_catalog_items' and created_at>=v_cutover)
     or exists(select 1 from public.program_catalog_items i join public.program_catalog_price_mode_reconciliation r on r.item_id=i.id where i.updated_at>r.reconciled_at)
  then raise exception 'RECOVERY_BLOCKED_PROGRAM_CATALOG_ADMIN_HISTORY_EXISTS' using errcode='P0001'; end if;
end $$;

drop trigger if exists program_catalog_items_set_updated_at on public.program_catalog_items;
update public.program_catalog_items i
set requires_quote=r.previous_requires_quote,updated_at=r.previous_updated_at
from public.program_catalog_price_mode_reconciliation r where r.item_id=i.id;

drop policy if exists program_catalog_storage_admin_insert on storage.objects;
drop policy if exists program_catalog_storage_admin_update on storage.objects;
drop policy if exists program_catalog_storage_admin_delete on storage.objects;
drop function if exists public.register_program_catalog_asset(text,text,bigint,text,text);
drop function if exists public.discard_unlinked_program_catalog_asset(uuid);
drop function if exists public.save_program_catalog_item(uuid,jsonb,jsonb);
drop function if exists public.reorder_program_catalog_items(text,uuid[]);

drop policy if exists program_catalog_items_authenticated_read on public.program_catalog_items;
create policy program_catalog_items_authenticated_read on public.program_catalog_items for select to authenticated using (enabled or public.has_admin_permission('marketplace.read'));
drop policy if exists program_catalog_item_assets_authenticated_read on public.program_catalog_item_assets;
create policy program_catalog_item_assets_authenticated_read on public.program_catalog_item_assets for select to authenticated using (exists(select 1 from public.program_catalog_items i where i.id=item_id and (i.enabled or public.has_admin_permission('marketplace.read'))));
drop policy if exists program_catalog_linked_private_asset_read on public.private_assets;
create policy program_catalog_linked_private_asset_read on public.private_assets for select to authenticated using (
  exists(select 1 from public.program_catalog_item_assets l join public.program_catalog_items i on i.id=l.item_id where l.private_asset_id=private_assets.id and i.enabled)
);
drop policy if exists program_catalog_linked_private_storage_read on storage.objects;
create policy program_catalog_linked_private_storage_read on storage.objects for select to authenticated using (
  bucket_id='private-assets' and exists(
    select 1 from public.private_assets a join public.program_catalog_item_assets l on l.private_asset_id=a.id join public.program_catalog_items i on i.id=l.item_id
    where a.storage_bucket=storage.objects.bucket_id and a.storage_path=storage.objects.name and i.enabled
  )
);

delete from public.admin_role_permissions where permission in('program_catalog.read','program_catalog.write');
update public.admin_assignments a set permissions=coalesce((select array_agg(permission order by permission) from public.admin_role_permissions where role_id=a.role_id),'{}'::text[]),updated_at=now() where a.enabled;
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check(permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read'
]::text[]);

create or replace function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_allowed text[]:=array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read'];
begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  if p_permissions is null or exists(select 1 from unnest(p_permissions) p where not(p=any(v_allowed))) then raise exception 'INVALID_PERMISSION' using errcode='22023'; end if;
  if p_role_id is null then insert into public.admin_roles(code,name,description) values('role_'||replace(extensions.gen_random_uuid()::text,'-',''),btrim(p_name),coalesce(p_description,'')) returning id into v_id;
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

alter table public.program_catalog_item_assets drop constraint program_catalog_item_assets_id_unique;
alter table public.program_catalog_item_assets drop column enabled;
alter table public.program_catalog_item_assets drop column id;
alter table public.program_catalog_items alter column source_sheet set not null;
alter table public.program_catalog_items alter column source_row_ordinal set not null;
alter table public.program_catalog_items alter column source_snapshot_hash set not null;
drop table public.program_catalog_price_mode_reconciliation;

notify pgrst,'reload schema';
commit;
