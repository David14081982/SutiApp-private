begin;

-- Controlled expansion of the approved Noticias UUID + section + exact-action pattern.
insert into public.admin_section_definitions(section_key,display_name,data_boundary,allowed_actions,enforcement_status)
values('minutes','Minutas','minutes; distinct from institutional_documents',array['read','create','update','delete','publish','order','assets'],'DESIGN_ONLY')
on conflict(section_key) do nothing;

update public.admin_section_definitions set allowed_actions=case section_key
  when 'agreements' then array['read','create','update','delete','publish','order']::text[]
  else array['read','create','update','delete','publish','order','assets']::text[] end,
  updated_at=now()
where section_key in('education','tutorials','companies','agreements','banners','popups','documents','minutes','programs','marketplace');

-- Add only the administrative state missing from the original read-only institutional tables.
alter table public.minutes add column if not exists enabled boolean not null default true;
alter table public.minutes add column if not exists record_origin text not null default 'HISTORICAL_IMPORT'
  check(record_origin in('HISTORICAL_IMPORT','ADMIN_SECTION_ROLLOUT'));
alter table public.minutes alter column source_sheet drop not null;
alter table public.minutes alter column source_row_ordinal drop not null;
alter table public.minutes alter column source_snapshot_hash drop not null;
alter table public.institutional_programs add column if not exists enabled boolean not null default true;
alter table public.institutional_programs add column if not exists record_origin text not null default 'HISTORICAL_IMPORT'
  check(record_origin in('HISTORICAL_IMPORT','ADMIN_SECTION_ROLLOUT'));
alter table public.institutional_programs alter column source_sheet drop not null;
alter table public.institutional_programs alter column source_row_ordinal drop not null;
alter table public.institutional_programs alter column source_snapshot_hash drop not null;

create or replace function public.section_row_required_actions(
  p_old jsonb,p_new jsonb,p_op text,p_publish_col text,p_order_col text,p_asset_cols text[])
returns text[] language plpgsql immutable set search_path=''
as $$
declare v_actions text[]:='{}';v_ignored text[]:=array['id','created_at','updated_at'];v_col text;v_value text;
begin
  if p_op='INSERT' then v_actions:=array_append(v_actions,'create');
  elsif p_op='DELETE' then return array['delete'];
  end if;
  if p_publish_col<>'' then
    v_ignored:=array_append(v_ignored,p_publish_col);
    if p_op='INSERT' then
      v_value:=coalesce(p_new->>p_publish_col,'false');
      if v_value in('true','approved') then v_actions:=array_append(v_actions,'publish');end if;
    elsif (p_old->p_publish_col) is distinct from (p_new->p_publish_col) then v_actions:=array_append(v_actions,'publish');end if;
  end if;
  if p_order_col<>'' then
    v_ignored:=array_append(v_ignored,p_order_col);
    if p_op='UPDATE' and (p_old->p_order_col) is distinct from (p_new->p_order_col) then v_actions:=array_append(v_actions,'order');end if;
  end if;
  foreach v_col in array coalesce(p_asset_cols,'{}') loop
    if v_col<>'' then
      v_ignored:=array_append(v_ignored,v_col);
      if (p_op='INSERT' and p_new->v_col is not null and p_new->>v_col<>'')
         or (p_op='UPDATE' and (p_old->v_col) is distinct from (p_new->v_col)) then
        if not 'assets'=any(v_actions) then v_actions:=array_append(v_actions,'assets');end if;
      end if;
    end if;
  end loop;
  v_ignored:=v_ignored||array['record_origin','provenance'];
  if p_op='UPDATE' and (p_old-v_ignored) is distinct from (p_new-v_ignored) then v_actions:=array_append(v_actions,'update');end if;
  return array(select distinct x from unnest(v_actions) x);
end $$;

create or replace function public.enforce_section_row_action()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_old jsonb:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_section text:=tg_argv[0];v_technical text:=tg_argv[1];v_actions text[];v_action text;
  v_origin_col text:=tg_argv[5];v_admin_origin text:=tg_argv[6];v_company uuid;
begin
  if tg_table_name='educational_resources' then
    v_section:=case when coalesce(v_new->>'resource_kind',v_old->>'resource_kind')='tutorial' then 'tutorials' else 'education' end;
    if tg_op='UPDATE' and v_old->>'resource_kind' is distinct from v_new->>'resource_kind' then
      if not public.has_section_action(case when v_old->>'resource_kind'='tutorial' then 'tutorials' else 'education' end,'update')
         or not public.has_section_action(case when v_new->>'resource_kind'='tutorial' then 'tutorials' else 'education' end,'create') then
        raise exception 'SECTION_BOUNDARY_CHANGE_DENIED';
      end if;
    end if;
  end if;
  if auth.role()='service_role' or public.has_admin_permission(v_technical) then return coalesce(new,old);end if;
  -- Preserve the existing company-tenant Marketplace writer without granting it section ownership.
  if tg_table_name in('marketplace_products','marketplace_promotions') then
    v_company:=coalesce((v_new->>'company_id')::uuid,(v_old->>'company_id')::uuid);
    if public.is_marketplace_company_member(v_company,'write') then return coalesce(new,old);end if;
  elsif tg_table_name='marketplace_product_assets' then
    select p.company_id into v_company from public.marketplace_products p where p.id=coalesce((v_new->>'product_id')::uuid,(v_old->>'product_id')::uuid);
    if public.is_marketplace_company_member(v_company,'write') then return coalesce(new,old);end if;
  end if;
  v_actions:=public.section_row_required_actions(v_old,v_new,tg_op,tg_argv[2],tg_argv[3],string_to_array(tg_argv[4],','));
  foreach v_action in array v_actions loop
    if not public.has_section_action(v_section,v_action) then raise exception 'SECTION_ACTION_DENIED:%:%',v_section,v_action;end if;
  end loop;
  if tg_op='INSERT' and v_origin_col<>'' and coalesce(v_new->>v_origin_col,'')<>v_admin_origin then
    raise exception 'ADMIN_ORIGIN_REQUIRED';
  end if;
  if tg_op='DELETE' and v_origin_col<>'' and coalesce(v_old->>v_origin_col,'')<>v_admin_origin then
    raise exception 'HISTORICAL_DELETE_DENIED';
  end if;
  if tg_op='UPDATE' and v_origin_col<>'' and (v_old->v_origin_col) is distinct from (v_new->v_origin_col) then
    raise exception 'RECORD_ORIGIN_IMMUTABLE';
  end if;
  return coalesce(new,old);
end $$;

create or replace function public.audit_section_row_action()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_old jsonb:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_section text:=tg_argv[0];v_actions text[];v_action text;v_target text;
begin
  if auth.uid() is null then return coalesce(new,old);end if;
  if tg_table_name='educational_resources' then v_section:=case when coalesce(v_new->>'resource_kind',v_old->>'resource_kind')='tutorial' then 'tutorials' else 'education' end;end if;
  v_actions:=public.section_row_required_actions(v_old,v_new,tg_op,tg_argv[1],tg_argv[2],string_to_array(tg_argv[3],','));
  v_target:=coalesce(v_new->>'id',v_old->>'id',v_new->>'company_id',v_old->>'company_id',v_new->>'product_id',v_old->>'product_id');
  foreach v_action in array v_actions loop
    insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
    values(auth.uid(),tg_table_name,upper(v_section)||'_'||upper(v_action),v_target,'SUCCESS',jsonb_build_object('section_key',v_section,'section_action',v_action));
  end loop;
  return coalesce(new,old);
end $$;

-- Replace broad technical writers with technical-or-section policies. Exact action remains enforced by trigger OLD/NEW.
drop policy if exists education_admin_write on public.educational_resources;
create policy education_section_write on public.educational_resources for all to authenticated
using(public.has_admin_permission('content.write') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'update') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'delete') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'publish') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'order') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'assets'))
with check(public.has_admin_permission('content.write') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'create') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'update') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'publish') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'order') or public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'assets'));
create policy education_section_read on public.educational_resources for select to authenticated using(public.has_section_action(case when resource_kind='tutorial' then 'tutorials' else 'education' end,'read'));

-- Existing visual tables retain their public readers; only administrative policies are replaced.
drop policy if exists companies_admin_insert on public.companies;drop policy if exists companies_admin_update on public.companies;drop policy if exists companies_admin_delete on public.companies;
create policy companies_section_insert on public.companies for insert to authenticated with check((public.has_admin_permission('companies.write') or public.has_section_action('companies','create')) and record_origin='ADMIN_H009');
create policy companies_section_update on public.companies for update to authenticated using(public.has_admin_permission('companies.write') or public.has_section_action('companies','update') or public.has_section_action('companies','publish') or public.has_section_action('companies','order') or public.has_section_action('companies','assets')) with check(public.has_admin_permission('companies.write') or public.has_section_action('companies','update') or public.has_section_action('companies','publish') or public.has_section_action('companies','order') or public.has_section_action('companies','assets'));
create policy companies_section_delete on public.companies for delete to authenticated using((public.has_admin_permission('companies.write') or public.has_section_action('companies','delete')) and record_origin='ADMIN_H009');
create policy companies_section_read on public.companies for select to authenticated using(public.has_section_action('companies','read') or public.has_section_action('agreements','read'));
drop policy if exists company_assets_admin_all on public.company_assets;
create policy company_assets_section_write on public.company_assets for all to authenticated using(public.has_admin_permission('companies.write') or public.has_section_action('companies','assets')) with check(public.has_admin_permission('companies.write') or public.has_section_action('companies','assets'));

drop policy if exists banners_admin_insert on public.banners;drop policy if exists banners_admin_update on public.banners;drop policy if exists banners_admin_delete on public.banners;
create policy banners_section_write on public.banners for all to authenticated using(public.has_admin_permission('banners.write') or public.has_section_action('banners','update') or public.has_section_action('banners','delete') or public.has_section_action('banners','publish') or public.has_section_action('banners','order') or public.has_section_action('banners','assets')) with check(public.has_admin_permission('banners.write') or public.has_section_action('banners','create') or public.has_section_action('banners','update') or public.has_section_action('banners','publish') or public.has_section_action('banners','order') or public.has_section_action('banners','assets'));
create policy banners_section_read on public.banners for select to authenticated using(public.has_section_action('banners','read'));
drop policy if exists popups_admin_insert on public.popups;drop policy if exists popups_admin_update on public.popups;drop policy if exists popups_admin_delete on public.popups;
create policy popups_section_write on public.popups for all to authenticated using(public.has_admin_permission('popups.write') or public.has_section_action('popups','update') or public.has_section_action('popups','delete') or public.has_section_action('popups','publish') or public.has_section_action('popups','order') or public.has_section_action('popups','assets')) with check(public.has_admin_permission('popups.write') or public.has_section_action('popups','create') or public.has_section_action('popups','update') or public.has_section_action('popups','publish') or public.has_section_action('popups','order') or public.has_section_action('popups','assets'));
create policy popups_section_read on public.popups for select to authenticated using(public.has_section_action('popups','read'));

drop policy if exists institutional_documents_admin_insert on public.institutional_documents;drop policy if exists institutional_documents_admin_update on public.institutional_documents;drop policy if exists institutional_documents_admin_delete on public.institutional_documents;
create policy documents_section_write on public.institutional_documents for all to authenticated using(public.has_admin_permission('documents.write') or public.has_section_action('documents','update') or public.has_section_action('documents','delete') or public.has_section_action('documents','publish') or public.has_section_action('documents','order') or public.has_section_action('documents','assets')) with check(public.has_admin_permission('documents.write') or public.has_section_action('documents','create') or public.has_section_action('documents','update') or public.has_section_action('documents','publish') or public.has_section_action('documents','order') or public.has_section_action('documents','assets'));
create policy documents_section_read on public.institutional_documents for select to authenticated using(public.has_section_action('documents','read'));

drop policy if exists minutes_assets_admin_update on public.minutes;
drop policy if exists minutes_public_read on public.minutes;
create policy minutes_public_read on public.minutes for select to anon,authenticated using(enabled);
create policy minutes_section_write on public.minutes for all to authenticated using(public.has_admin_permission('documents.write') or public.has_section_action('minutes','update') or public.has_section_action('minutes','delete') or public.has_section_action('minutes','publish') or public.has_section_action('minutes','order') or public.has_section_action('minutes','assets')) with check(public.has_admin_permission('documents.write') or public.has_section_action('minutes','create') or public.has_section_action('minutes','update') or public.has_section_action('minutes','publish') or public.has_section_action('minutes','order') or public.has_section_action('minutes','assets'));
create policy minutes_section_read on public.minutes for select to authenticated using(public.has_section_action('minutes','read'));
drop policy if exists programs_assets_admin_update on public.institutional_programs;
drop policy if exists institutional_programs_public_read on public.institutional_programs;
create policy institutional_programs_public_read on public.institutional_programs for select to anon,authenticated using(enabled);
create policy programs_section_write on public.institutional_programs for all to authenticated using(public.has_admin_permission('documents.write') or public.has_section_action('programs','update') or public.has_section_action('programs','delete') or public.has_section_action('programs','publish') or public.has_section_action('programs','order') or public.has_section_action('programs','assets')) with check(public.has_admin_permission('documents.write') or public.has_section_action('programs','create') or public.has_section_action('programs','update') or public.has_section_action('programs','publish') or public.has_section_action('programs','order') or public.has_section_action('programs','assets'));
create policy programs_section_read on public.institutional_programs for select to authenticated using(public.has_section_action('programs','read'));

drop policy if exists company_profiles_write on public.company_benefit_profiles;drop policy if exists company_benefits_write on public.company_benefits;drop policy if exists company_audience_write on public.company_audience_rules;
create policy company_profiles_section_write on public.company_benefit_profiles for all to authenticated using(public.has_admin_permission('companies.write') or public.has_section_action('agreements','update') or public.has_section_action('agreements','delete') or public.has_section_action('agreements','order')) with check(public.has_admin_permission('companies.write') or public.has_section_action('agreements','create') or public.has_section_action('agreements','update') or public.has_section_action('agreements','order'));
create policy company_benefits_section_write on public.company_benefits for all to authenticated using(public.has_admin_permission('companies.write') or public.has_section_action('agreements','update') or public.has_section_action('agreements','delete') or public.has_section_action('agreements','publish') or public.has_section_action('agreements','order')) with check(public.has_admin_permission('companies.write') or public.has_section_action('agreements','create') or public.has_section_action('agreements','update') or public.has_section_action('agreements','publish') or public.has_section_action('agreements','order'));
create policy company_audience_section_write on public.company_audience_rules for all to authenticated using(public.has_admin_permission('companies.write') or public.has_section_action('agreements','update') or public.has_section_action('agreements','delete')) with check(public.has_admin_permission('companies.write') or public.has_section_action('agreements','create') or public.has_section_action('agreements','update'));
create policy company_profiles_section_read on public.company_benefit_profiles for select to authenticated using(public.has_section_action('agreements','read'));
create policy company_benefits_section_read on public.company_benefits for select to authenticated using(public.has_section_action('agreements','read'));
create policy company_audience_section_read on public.company_audience_rules for select to authenticated using(public.has_section_action('agreements','read'));

-- Marketplace catalog only. Request/quote policies and company tenant policies are untouched.
drop policy if exists marketplace_categories_admin_write on public.marketplace_categories;drop policy if exists marketplace_products_admin_write on public.marketplace_products;drop policy if exists marketplace_product_assets_admin_write on public.marketplace_product_assets;drop policy if exists marketplace_promotions_admin_write on public.marketplace_promotions;
create policy marketplace_categories_section_write on public.marketplace_categories for all to authenticated using(public.has_admin_permission('marketplace.write') or public.has_section_action('marketplace','update') or public.has_section_action('marketplace','delete') or public.has_section_action('marketplace','publish') or public.has_section_action('marketplace','order') or public.has_section_action('marketplace','assets')) with check(public.has_admin_permission('marketplace.write') or public.has_section_action('marketplace','create') or public.has_section_action('marketplace','update') or public.has_section_action('marketplace','publish') or public.has_section_action('marketplace','order') or public.has_section_action('marketplace','assets'));
create policy marketplace_products_section_write on public.marketplace_products for all to authenticated using(public.has_admin_permission('marketplace.write') or public.has_section_action('marketplace','update') or public.has_section_action('marketplace','delete') or public.has_section_action('marketplace','publish') or public.has_section_action('marketplace','order') or public.has_section_action('marketplace','assets')) with check(public.has_admin_permission('marketplace.write') or public.has_section_action('marketplace','create') or public.has_section_action('marketplace','update') or public.has_section_action('marketplace','publish') or public.has_section_action('marketplace','order') or public.has_section_action('marketplace','assets'));
create policy marketplace_product_assets_section_write on public.marketplace_product_assets for all to authenticated using(public.has_admin_permission('marketplace.write') or public.has_section_action('marketplace','assets')) with check(public.has_admin_permission('marketplace.write') or public.has_section_action('marketplace','assets'));
create policy marketplace_promotions_section_write on public.marketplace_promotions for all to authenticated using(public.has_admin_permission('marketplace.write') or public.has_section_action('marketplace','update') or public.has_section_action('marketplace','delete') or public.has_section_action('marketplace','publish') or public.has_section_action('marketplace','order') or public.has_section_action('marketplace','assets')) with check(public.has_admin_permission('marketplace.write') or public.has_section_action('marketplace','create') or public.has_section_action('marketplace','update') or public.has_section_action('marketplace','publish') or public.has_section_action('marketplace','order') or public.has_section_action('marketplace','assets'));

-- Section-owned assets are isolated by section and auth UUID.
create policy app_assets_section_owner_insert on public.app_assets for insert to authenticated with check(
  public.has_section_action(split_part(storage_path,'/',1),'assets') and split_part(storage_path,'/',2)=auth.uid()::text
  and ((split_part(storage_path,'/',1)='companies' and storage_bucket='company-assets') or (split_part(storage_path,'/',1) in('documents','minutes') and storage_bucket='documents') or (split_part(storage_path,'/',1) not in('companies','documents','minutes') and storage_bucket='app-assets')));
create policy app_assets_section_owner_update on public.app_assets for update to authenticated using(public.has_section_action(split_part(storage_path,'/',1),'assets') and split_part(storage_path,'/',2)=auth.uid()::text) with check(public.has_section_action(split_part(storage_path,'/',1),'assets') and split_part(storage_path,'/',2)=auth.uid()::text);
create policy app_assets_section_owner_delete on public.app_assets for delete to authenticated using(public.has_section_action(split_part(storage_path,'/',1),'assets') and split_part(storage_path,'/',2)=auth.uid()::text);
create policy asset_sources_section_owner_insert on public.asset_sources for insert to authenticated with check(exists(select 1 from public.app_assets a where a.id=asset_id and public.has_section_action(split_part(a.storage_path,'/',1),'assets') and split_part(a.storage_path,'/',2)=auth.uid()::text));
create policy section_owner_storage_insert on storage.objects for insert to authenticated with check(public.has_section_action((storage.foldername(name))[1],'assets') and (storage.foldername(name))[2]=auth.uid()::text);
create policy section_owner_storage_update on storage.objects for update to authenticated using(public.has_section_action((storage.foldername(name))[1],'assets') and (storage.foldername(name))[2]=auth.uid()::text) with check(public.has_section_action((storage.foldername(name))[1],'assets') and (storage.foldername(name))[2]=auth.uid()::text);
create policy section_owner_storage_delete on storage.objects for delete to authenticated using(public.has_section_action((storage.foldername(name))[1],'assets') and (storage.foldername(name))[2]=auth.uid()::text);

-- Grants remain column-scoped for existing tables; only the two formerly read-only tables gain explicit admin columns.
grant insert(title,description,source_date_raw,published_on,sort_order,image_asset_id,document_asset_id,enabled,record_origin),update(title,description,source_date_raw,published_on,sort_order,image_asset_id,document_asset_id,enabled),delete on public.minutes to authenticated;
grant insert(category,description,phone_raw,whatsapp_raw,facebook_url,instagram_url,share_url,location_raw,whatsapp_url,tiktok_url,sort_order,primary_image_asset_id,enabled,record_origin),update(category,description,phone_raw,whatsapp_raw,facebook_url,instagram_url,share_url,location_raw,whatsapp_url,tiktok_url,sort_order,primary_image_asset_id,enabled),delete on public.institutional_programs to authenticated;

-- Guards and action audit. Arguments: section, technical permission, publish, order, asset cols, origin col, admin origin.
do $$ declare r record;begin
  for r in select * from (values
   ('educational_resources','education','content.write','published','sort_order','image_asset_id,document_asset_id','provenance','ADMIN_PHASE2'),
   ('companies','companies','companies.write','enabled','sort_order','logo_asset_id','record_origin','ADMIN_H009'),
   ('company_assets','companies','companies.write','','sort_order','asset_id','',''),
   ('banners','banners','banners.write','enabled','sort_order','image_asset_id','record_origin','ADMIN_H009'),
   ('popups','popups','popups.write','enabled','sort_order','image_asset_id','record_origin','ADMIN_H009'),
   ('institutional_documents','documents','documents.write','enabled','sort_order','image_asset_id,document_asset_id','record_origin','ADMIN_H009'),
   ('minutes','minutes','documents.write','enabled','sort_order','image_asset_id,document_asset_id','record_origin','ADMIN_SECTION_ROLLOUT'),
   ('institutional_programs','programs','documents.write','enabled','sort_order','primary_image_asset_id','record_origin','ADMIN_SECTION_ROLLOUT'),
   ('company_benefit_profiles','agreements','companies.write','','sort_order','','',''),
   ('company_benefits','agreements','companies.write','enabled','sort_order','','',''),
   ('company_audience_rules','agreements','companies.write','','','','',''),
   ('marketplace_categories','marketplace','marketplace.write','enabled','sort_order','image_asset_id','record_origin','ADMIN_PHASE3'),
   ('marketplace_products','marketplace','marketplace.write','enabled','sort_order','','record_origin','ADMIN_PHASE3'),
   ('marketplace_product_assets','marketplace','marketplace.write','','sort_order','asset_id','',''),
   ('marketplace_promotions','marketplace','marketplace.write','enabled','sort_order','image_asset_id','','')
  )v(tbl,section_key,technical,publish_col,order_col,asset_cols,origin_col,admin_origin)
  loop
    execute format('drop trigger if exists %I_section_action_guard on public.%I',r.tbl,r.tbl);
    execute format('create trigger %I_section_action_guard before insert or update or delete on public.%I for each row execute function public.enforce_section_row_action(%L,%L,%L,%L,%L,%L,%L)',r.tbl,r.tbl,r.section_key,r.technical,r.publish_col,r.order_col,r.asset_cols,r.origin_col,r.admin_origin);
    execute format('drop trigger if exists %I_section_action_audit on public.%I',r.tbl,r.tbl);
    execute format('create trigger %I_section_action_audit after insert or update or delete on public.%I for each row execute function public.audit_section_row_action(%L,%L,%L,%L)',r.tbl,r.tbl,r.section_key,r.publish_col,r.order_col,r.asset_cols);
  end loop;
end $$;

update public.admin_section_definitions set enforcement_status='ENFORCED',updated_at=now()
where section_key in('education','tutorials','companies','agreements','banners','popups','documents','minutes','programs','marketplace');

do $$ begin
  if (select count(*) from public.admin_section_definitions where enforcement_status='DESIGN_ONLY')<>0 then raise exception 'DESIGN_ONLY_SECTION_REMAINS';end if;
  if (select count(*) from public.admin_section_definitions where enforcement_status='ENFORCED')<>11 then raise exception 'ENFORCED_SECTION_COUNT_MISMATCH';end if;
end $$;

commit;
