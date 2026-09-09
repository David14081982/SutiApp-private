begin;

-- Extend the existing masters; educational institutions never become duplicate companies.
alter table public.companies add column public_details jsonb not null default '{}' check(jsonb_typeof(public_details)='object');
alter table public.educational_resources add column public_details jsonb not null default '{}' check(jsonb_typeof(public_details)='object');
alter table public.educational_resources add column cover_asset_id uuid references public.app_assets(id) on delete restrict;
alter table public.company_benefit_profiles add column description text not null default '';
alter table public.company_benefit_profiles add column conditions text not null default '';
grant update(public_details) on public.companies to authenticated;
grant update(public_details,cover_asset_id) on public.educational_resources to authenticated;

-- Owner-authorized commercial configuration. No subscriptions or payments are invented.
insert into public.company_portal_plans(id,name,description,monthly_price,annual_price,max_products,allows_popups,allows_stats_history,benefits,sort_order)
values
 ('cc000000-0000-4000-8000-000000000001','Esencial','Presencia comercial y catálogo',299,3588,5,false,false,'["Perfil público","Hasta 5 productos o servicios","Promociones sujetas a aprobación","Solicitudes y cotizaciones","Indicadores de actividad"]',1),
 ('cc000000-0000-4000-8000-000000000002','Impulso','Catálogo ampliado y propuestas publicitarias',599,7188,15,true,false,'["Perfil público","Hasta 15 productos o servicios","Promociones sujetas a aprobación","Solicitudes y cotizaciones","Indicadores de actividad","Propuestas de pop-up para Inicio sujetas a aprobación"]',2),
 ('cc000000-0000-4000-8000-000000000003','Destacado','Catálogo completo e historial de actividad',999,11988,50,true,true,'["Perfil público","Hasta 50 productos o servicios","Promociones sujetas a aprobación","Solicitudes y cotizaciones","Indicadores e historial mensual de actividad","Propuestas de pop-up para Inicio sujetas a aprobación"]',3);

create function public.company_has_active_plan(p_company_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_portal_subscriptions s join public.company_portal_plans p on p.id=s.plan_id
 join public.companies c on c.id=s.company_id where s.company_id=p_company_id and c.enabled and s.status='active'
 and p.enabled and current_date between s.starts_on and s.ends_on)
$$;
create function public.company_is_paid(p_company_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_portal_subscriptions where company_id=p_company_id and plan_id is not null)
$$;
create function public.can_manage_company_ficha(p_company_id uuid,p_action text default 'update') returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
 public.has_admin_permission('companies.write') or public.has_section_action('companies',p_action)
 or (not public.company_is_paid(p_company_id) and public.has_section_action('agreements',case when p_action='assets' then 'update' else p_action end))
 or (p_action in ('update','assets') and public.is_marketplace_company_member(p_company_id,'write') and public.company_has_active_plan(p_company_id)))
$$;

-- Replace only the companies trigger, preserving granular checks on every other domain.
create function public.enforce_company_ficha_action() returns trigger
language plpgsql security definer set search_path='' as $$
declare o jsonb:=case when tg_op='INSERT' then '{}' else to_jsonb(old) end;
 n jsonb:=case when tg_op='DELETE' then '{}' else to_jsonb(new) end; a text; v_id uuid:=coalesce(new.id,old.id);
begin
 if auth.role()='service_role' or public.has_admin_permission('companies.write') then return coalesce(new,old);end if;
 if tg_op='UPDATE' and (o-array['display_name','legal_name','description','category_raw','phone_raw','whatsapp_raw','email_raw','website_url','address_raw','location_raw','social_links','public_details','logo_asset_id','updated_at'])
   = (n-array['display_name','legal_name','description','category_raw','phone_raw','whatsapp_raw','email_raw','website_url','address_raw','location_raw','social_links','public_details','logo_asset_id','updated_at'])
   and public.is_marketplace_company_member(v_id,'write') and public.company_has_active_plan(v_id) then return new;end if;
 foreach a in array public.section_row_required_actions(o,n,tg_op,'enabled','sort_order',array['logo_asset_id']) loop
  if not public.can_manage_company_ficha(v_id,a) then raise exception 'COMPANY_ACTION_DENIED:%',a;end if;
 end loop;
 if tg_op='INSERT' and new.record_origin<>'ADMIN_H009' then raise exception 'ADMIN_ORIGIN_REQUIRED';end if;
 if tg_op='DELETE' and old.record_origin<>'ADMIN_H009' then raise exception 'HISTORICAL_DELETE_DENIED';end if;
 if tg_op='UPDATE' and (o->'record_origin' is distinct from n->'record_origin' or (o-array['display_name','legal_name','description','category_raw','contact_name','phone_raw','whatsapp_raw','email_raw','website_url','address_raw','location_raw','social_links','status_raw','logo_asset_id','sort_order','enabled','public_details','updated_at']) is distinct from (n-array['display_name','legal_name','description','category_raw','contact_name','phone_raw','whatsapp_raw','email_raw','website_url','address_raw','location_raw','social_links','status_raw','logo_asset_id','sort_order','enabled','public_details','updated_at'])) then raise exception 'COMPANY_PROVENANCE_IMMUTABLE';end if;
 return coalesce(new,old);
end $$;
drop trigger companies_section_action_guard on public.companies;
create trigger companies_section_action_guard before insert or update or delete on public.companies for each row execute function public.enforce_company_ficha_action();

create function public.save_company_ficha(p_company_id uuid,p_fields jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.companies; k text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if jsonb_typeof(p_fields)<>'object' then raise exception 'INVALID_PROFILE';end if;
 for k in select jsonb_object_keys(p_fields) loop
  if not k=any(array['display_name','legal_name','description','category_raw','phone_raw','whatsapp_raw','email_raw','website_url','address_raw','location_raw','social_links','public_details','logo_asset_id','enabled','sort_order']) then raise exception 'INVALID_PROFILE_FIELD:%',k;end if;
 end loop;
 if p_company_id is null then
  if not public.can_manage_company_ficha(null,'create') then raise exception 'COMPANY_CREATE_DENIED';end if;
  insert into public.companies(display_name,description,enabled,sort_order,record_origin) values(p_fields->>'display_name',coalesce(p_fields->>'description',''),false,coalesce((p_fields->>'sort_order')::integer,1),'ADMIN_H009') returning * into c;
 else
  select * into c from public.companies where id=p_company_id for update;
  if not found or not (public.can_manage_company_ficha(c.id,'update') or public.can_manage_company_ficha(c.id,'publish') or public.can_manage_company_ficha(c.id,'order') or public.can_manage_company_ficha(c.id,'assets')) then raise exception 'COMPANY_DENIED';end if;
 end if;
 c:=jsonb_populate_record(c,p_fields);
 if c.logo_asset_id is not null and not exists(select 1 from public.app_assets a where a.id=c.logo_asset_id and a.status='READY' and a.mime_type like 'image/%' and (public.has_admin_permission('companies.write') or public.has_section_action('companies','assets') or (not public.company_is_paid(c.id) and public.has_section_action('agreements','update')) or a.owner_company_id=c.id)) then raise exception 'COMPANY_ASSET_DENIED';end if;
 update public.companies set display_name=c.display_name,legal_name=c.legal_name,description=c.description,category_raw=c.category_raw,phone_raw=c.phone_raw,whatsapp_raw=c.whatsapp_raw,email_raw=c.email_raw,website_url=c.website_url,address_raw=c.address_raw,location_raw=c.location_raw,social_links=c.social_links,public_details=c.public_details,logo_asset_id=c.logo_asset_id,enabled=c.enabled,sort_order=c.sort_order where id=c.id;
 return c.id;
end $$;

-- Tenant writes must honor real, current subscriptions and serialize product quotas.
create function public.enforce_company_plan_limits() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(new.company_id,old.company_id);v_max integer;v_n integer;
begin
 if auth.role()='service_role' or public.has_admin_permission('marketplace.write') or public.has_admin_permission('companies.write') or public.has_section_action('marketplace',case when tg_op='INSERT' then 'create' when tg_op='DELETE' then 'delete' else 'update' end) then return coalesce(new,old);end if;
 if tg_table_name='marketplace_products' and public.can_manage_agreement_product(v_id,case when tg_op='INSERT' then 'create' when tg_op='DELETE' then 'delete' else 'update' end) then return coalesce(new,old);end if;
 if not public.is_marketplace_company_member(v_id,'write') or not public.company_has_active_plan(v_id) then raise exception 'ACTIVE_COMPANY_PLAN_REQUIRED';end if;
 if tg_op='UPDATE' and new.company_id is distinct from old.company_id then raise exception 'COMPANY_IMMUTABLE';end if;
 if tg_table_name='marketplace_products' and tg_op<>'DELETE' then
  perform 1 from public.company_portal_subscriptions where company_id=v_id for update;
  select p.max_products into v_max from public.company_portal_subscriptions s join public.company_portal_plans p on p.id=s.plan_id where s.company_id=v_id;
  select count(*) into v_n from public.marketplace_products where company_id=v_id and id<>new.id;
  if v_n>=v_max then raise exception 'COMPANY_PRODUCT_LIMIT:%',v_max;end if;
 end if;
 return coalesce(new,old);
end $$;
create trigger company_product_plan_guard before insert or update or delete on public.marketplace_products for each row execute function public.enforce_company_plan_limits();
create trigger company_promotion_plan_guard before insert or update or delete on public.marketplace_promotions for each row execute function public.enforce_company_plan_limits();

-- Public projection enforces publication/audience even for an administrator browsing the app.
create function public.list_public_convenios() returns jsonb
language sql stable security definer set search_path='' as $$
 with company_rows as (
 select c.sort_order, jsonb_build_object('id',c.id,'source_kind',case when public.company_is_paid(c.id) then 'paid_company' else 'agreement' end,
 'display_name',c.display_name,'description',c.description,'category_raw',coalesce(nullif(p.category_label,''),c.category_raw),
 'address_raw',coalesce(nullif(p.address,''),c.address_raw),'location_raw',c.location_raw,'phone_raw',c.phone_raw,'whatsapp_raw',c.whatsapp_raw,'email_raw',c.email_raw,'website_url',c.website_url,
 'public_details',c.public_details,'agreement_description',coalesce(p.description,''),'conditions',coalesce(p.conditions,''),'discount_percent',p.discount_percent,'featured',coalesce(p.featured,false),
 'logo_asset_id',c.logo_asset_id,'cover_asset_id',(select asset_id from public.company_assets where company_id=c.id and role='cover' order by sort_order limit 1),
 'gallery_asset_ids',coalesce((select jsonb_agg(asset_id order by sort_order) from public.company_assets where company_id=c.id and role='gallery'),'[]'),
 'benefits',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'label',b.label,'description',b.description) order by b.sort_order) from public.company_benefits b where b.company_id=c.id and b.enabled and public.matches_current_affiliate_audience(b.audience_mode,b.union_codes,b.employment_category_codes,b.gender_codes,b.tag_codes)),'[]'),
 'promotions',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'image_asset_id',m.image_asset_id,'label',m.title,'description',m.description,'discount_percent',m.discount_percent)) from public.marketplace_promotions m where m.company_id=c.id and m.enabled and m.approval_status='approved' and (m.start_date is null or m.start_date<=current_date) and (m.end_date is null or m.end_date>=current_date)),'[]')) as row
 from public.companies c left join public.company_benefit_profiles p on p.company_id=c.id
 where c.enabled and public.can_view_company(c.id) and (not public.company_is_paid(c.id) or public.company_has_active_plan(c.id))
 ), education_rows as (
 select e.sort_order,jsonb_build_object('id',e.id,'source_kind','education','display_name',e.title,'description',e.description,'category_raw','Educación',
 'logo_asset_id',e.image_asset_id,'cover_asset_id',e.cover_asset_id,'gallery_asset_ids','[]'::jsonb,'document_asset_id',e.document_asset_id,'website_url',e.external_url,
 'address_raw',e.public_details->>'address','phone_raw',e.public_details->>'phone','whatsapp_raw',e.public_details->>'whatsapp',
 'agreement_description',e.public_details->>'offer','conditions',e.public_details->>'conditions','discount_percent',e.public_details->'discount_percent',
 'benefits',coalesce(e.public_details->'benefits','[]'),'services',coalesce(e.public_details->'services','[]'),'public_details',e.public_details,'featured',false,'promotions','[]'::jsonb) as row
 from public.educational_resources e where e.published and e.resource_kind='education'
 ) select coalesce(jsonb_agg(row order by sort_order,row->>'display_name'),'[]') from (select * from company_rows union all select * from education_rows) x
$$;

create table public.educational_resource_favorites(
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 resource_id uuid not null references public.educational_resources(id) on delete cascade,
 primary key(auth_user_id,resource_id)
);
alter table public.educational_resource_favorites enable row level security;
alter table public.educational_resource_favorites force row level security;
revoke all on public.educational_resource_favorites from public,anon,authenticated;
grant select,insert,delete on public.educational_resource_favorites to authenticated;
create policy education_favorite_self on public.educational_resource_favorites for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.educational_resources e where e.id=resource_id and e.published and e.resource_kind='education'));

-- History is projected from existing operational records, never synthetic visits/clicks.
create function public.get_company_activity(p_company_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_history boolean;v_result jsonb;
begin
 if not public.is_marketplace_company_member(p_company_id) and not public.has_admin_permission('company_portal.read') then raise exception 'COMPANY_DENIED';end if;
 select coalesce(p.allows_stats_history,false) and public.company_has_active_plan(p_company_id) into v_history from public.company_portal_subscriptions s join public.company_portal_plans p on p.id=s.plan_id where s.company_id=p_company_id;
 select jsonb_build_object('history_allowed',coalesce(v_history,false),'logs',coalesce(jsonb_agg(jsonb_build_object('action',action,'ts',created_at,'detail',resource) order by created_at desc),'[]')) into v_result
 from (select action,created_at,resource from public.admin_audit_log where target_id=p_company_id::text or (resource='marketplace_products' and target_id in(select id::text from public.marketplace_products where company_id=p_company_id)) or (resource='marketplace_promotions' and target_id in(select id::text from public.marketplace_promotions where company_id=p_company_id)) order by created_at desc limit 60) a;
 if v_history then v_result:=v_result||jsonb_build_object('monthly',coalesce((select jsonb_agg(to_jsonb(m) order by month desc) from (select to_char(created_at,'YYYY-MM') as month,count(*) as requests from public.program_requests where company_id=p_company_id group by to_char(created_at,'YYYY-MM')) m),'[]'));end if;
 return v_result;
end $$;

revoke all on function public.company_has_active_plan(uuid),public.company_is_paid(uuid),public.can_manage_company_ficha(uuid,text),public.save_company_ficha(uuid,jsonb),public.list_public_convenios(),public.get_company_activity(uuid) from public,anon,authenticated;
grant execute on function public.company_has_active_plan(uuid),public.company_is_paid(uuid) to anon,authenticated,service_role;
grant execute on function public.list_public_convenios() to anon,authenticated,service_role;
grant execute on function public.can_manage_company_ficha(uuid,text),public.save_company_ficha(uuid,jsonb),public.get_company_activity(uuid) to authenticated,service_role;
revoke all on function public.enforce_company_ficha_action(),public.enforce_company_plan_limits() from public,anon,authenticated;

-- One atomic Admin save; agreements personnel can maintain only free agreements.
create function public.save_agreement_ficha(p_fields jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=(p_fields->>'id')::uuid;v_a jsonb;v_b jsonb;v_kept uuid[]:='{}';v_bid uuid;
begin
 if auth.uid() is null or not(public.has_admin_permission('companies.write') or public.has_section_action('agreements',case when v_id is null then 'create' else 'update' end)) then raise exception 'AGREEMENT_DENIED';end if;
 if v_id is not null and public.company_is_paid(v_id) and not public.has_admin_permission('companies.write') then raise exception 'PAID_COMPANY_ADMIN_REQUIRED';end if;
 v_id:=public.save_company_ficha(v_id,p_fields->'company');
 v_a:=coalesce(p_fields->'profile','{}');
 insert into public.company_benefit_profiles(record_origin,company_id,category_label,discount_percent,accent_hue,tags,address,favorite,featured,sort_order,description,conditions)
 values('ADMIN_SECTION_ROLLOUT',v_id,coalesce(v_a->>'category_label',''),coalesce((v_a->>'discount_percent')::integer,0),coalesce((v_a->>'accent_hue')::integer,210),array(select jsonb_array_elements_text(coalesce(v_a->'tags','[]'))),coalesce(v_a->>'address',''),false,coalesce((v_a->>'featured')::boolean,false),coalesce((v_a->>'sort_order')::integer,1),coalesce(v_a->>'description',''),coalesce(v_a->>'conditions',''))
 on conflict(company_id) do update set category_label=excluded.category_label,discount_percent=excluded.discount_percent,accent_hue=excluded.accent_hue,tags=excluded.tags,address=excluded.address,featured=excluded.featured,sort_order=excluded.sort_order,description=excluded.description,conditions=excluded.conditions;
 v_a:=coalesce(p_fields->'audience','{}');
 insert into public.company_audience_rules(record_origin,company_id,audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes)
 values('ADMIN_SECTION_ROLLOUT',v_id,coalesce(v_a->>'audience_mode','all'),array(select jsonb_array_elements_text(coalesce(v_a->'union_codes','[]'))),array(select jsonb_array_elements_text(coalesce(v_a->'employment_category_codes','[]'))),array(select jsonb_array_elements_text(coalesce(v_a->'gender_codes','[]'))),array(select jsonb_array_elements_text(coalesce(v_a->'tag_codes','[]'))))
 on conflict(company_id) do update set audience_mode=excluded.audience_mode,union_codes=excluded.union_codes,employment_category_codes=excluded.employment_category_codes,gender_codes=excluded.gender_codes,tag_codes=excluded.tag_codes;
 for v_b in select value from jsonb_array_elements(coalesce(p_fields->'benefits','[]')) loop
  v_bid:=coalesce((v_b->>'id')::uuid,extensions.gen_random_uuid());
  if exists(select 1 from public.company_benefits where id=v_bid and company_id<>v_id) then raise exception 'CROSS_COMPANY_BENEFIT_DENIED';end if;
  v_kept:=array_append(v_kept,v_bid);
  insert into public.company_benefits(record_origin,id,company_id,label,description,enabled,sort_order,audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes)
  values('ADMIN_SECTION_ROLLOUT',v_bid,v_id,v_b->>'label',coalesce(v_b->>'description',''),coalesce((v_b->>'enabled')::boolean,true),coalesce((v_b->>'sort_order')::integer,1),coalesce(v_b->>'audience_mode','all'),array(select jsonb_array_elements_text(coalesce(v_b->'union_codes','[]'))),array(select jsonb_array_elements_text(coalesce(v_b->'employment_category_codes','[]'))),array(select jsonb_array_elements_text(coalesce(v_b->'gender_codes','[]'))),array(select jsonb_array_elements_text(coalesce(v_b->'tag_codes','[]'))))
  on conflict(id) do update set label=excluded.label,description=excluded.description,enabled=excluded.enabled,sort_order=excluded.sort_order,audience_mode=excluded.audience_mode,union_codes=excluded.union_codes,employment_category_codes=excluded.employment_category_codes,gender_codes=excluded.gender_codes,tag_codes=excluded.tag_codes;
 end loop;
 update public.company_benefits set enabled=false where company_id=v_id and not(id=any(v_kept)) and enabled;
 return v_id;
end $$;

create function public.can_upload_company_ficha(p_path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_parts text[]:=string_to_array(p_path,'/');v_company uuid;
begin
 if array_length(v_parts,1)<>4 or v_parts[1]<>'convenios' or v_parts[2]<>auth.uid()::text then return false;end if;
 begin v_company:=v_parts[3]::uuid;exception when invalid_text_representation then return false;end;
 return exists(select 1 from public.companies where id=v_company) and (public.can_manage_company_ficha(v_company,'assets') or (not public.company_is_paid(v_company) and public.has_section_action('agreements','update')));
end $$;
create policy company_ficha_image_upload on storage.objects for insert to authenticated with check(bucket_id='company-assets' and public.can_upload_company_ficha(name));

create function public.register_company_ficha_image(p_company_id uuid,p_path text,p_sha256 text,p_mime text,p_size bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.can_upload_company_ficha(p_path) or split_part(p_path,'/',3)<>p_company_id::text then raise exception 'COMPANY_ASSET_DENIED';end if;
 if p_mime not in('image/jpeg','image/png','image/webp','image/gif') or p_size not between 1 and 10485760 or p_sha256!~'^[a-fA-F0-9]{64}$' then raise exception 'INVALID_IMAGE';end if;
 if not exists(select 1 from storage.objects where bucket_id='company-assets' and name=p_path and (metadata->>'size')::bigint=p_size and metadata->>'mimetype'=p_mime) then raise exception 'UPLOADED_IMAGE_REQUIRED';end if;
 insert into public.app_assets(asset_key,asset_type,title,alt_text,storage_bucket,storage_path,mime_type,file_size,content_sha256,status,owner_company_id)
 values('company.ficha.'||extensions.gen_random_uuid(),'COMPANY','Imagen empresarial','Imagen empresarial','company-assets',p_path,p_mime,p_size,upper(p_sha256),'READY',p_company_id) returning id into v_id;
 return v_id;
end $$;
create function public.attach_company_ficha_image(p_company_id uuid,p_asset_id uuid,p_role text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not(public.can_manage_company_ficha(p_company_id,'assets') or (not public.company_is_paid(p_company_id) and public.has_section_action('agreements','update'))) then raise exception 'COMPANY_ASSET_DENIED';end if;
 if p_role not in('logo','cover','gallery') then raise exception 'INVALID_IMAGE_ROLE';end if;
 if not exists(select 1 from public.app_assets where id=p_asset_id and status='READY' and mime_type like 'image/%' and (owner_company_id=p_company_id or public.has_admin_permission('companies.write') or public.has_section_action('companies','assets'))) then raise exception 'COMPANY_ASSET_OWNERSHIP_REQUIRED';end if;
 perform 1 from public.companies where id=p_company_id for update;
 if p_role='logo' then perform public.save_company_ficha(p_company_id,jsonb_build_object('logo_asset_id',p_asset_id));return;end if;
 if p_role='cover' then delete from public.company_assets where company_id=p_company_id and role='cover';end if;
 insert into public.company_assets(company_id,asset_id,role,sort_order,record_origin) values(p_company_id,p_asset_id,p_role,coalesce((select max(sort_order)+1 from public.company_assets where company_id=p_company_id),1),'ADMIN_SECTION_ROLLOUT');
end $$;
revoke all on function public.save_agreement_ficha(jsonb),public.can_upload_company_ficha(text),public.register_company_ficha_image(uuid,text,text,text,bigint),public.attach_company_ficha_image(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.save_agreement_ficha(jsonb),public.can_upload_company_ficha(text),public.register_company_ficha_image(uuid,text,text,text,bigint),public.attach_company_ficha_image(uuid,uuid,text) to authenticated,service_role;

create function public.enforce_company_ficha_asset_action() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(new.company_id,old.company_id);
begin
 if auth.role()='service_role' or public.has_admin_permission('companies.write') then return coalesce(new,old);end if;
 if not(public.can_manage_company_ficha(v_id,'assets') or (not public.company_is_paid(v_id) and public.has_section_action('agreements','update'))) then raise exception 'COMPANY_ASSET_DENIED';end if;
 if tg_op='UPDATE' and new.company_id<>old.company_id then raise exception 'COMPANY_IMMUTABLE';end if;
 return coalesce(new,old);
end $$;
drop trigger company_assets_section_action_guard on public.company_assets;
create trigger company_assets_section_action_guard before insert or update or delete on public.company_assets for each row execute function public.enforce_company_ficha_asset_action();

alter table public.company_portal_subscriptions add column payment_reference text;
alter table public.company_portal_subscriptions add column payment_amount numeric(14,2);
alter table public.company_portal_subscriptions add column accredited_by uuid references auth.users(id) on delete restrict;
alter table public.company_portal_subscriptions add column accredited_at timestamptz;
create function public.accredit_company_plan(p_company_id uuid,p_plan_id uuid,p_cycle text,p_payment_reference text,p_received boolean,p_member_email text default null) returns void
language plpgsql security definer set search_path='' as $$
declare p public.company_portal_plans;v_user uuid;v_end date;
begin
 if auth.uid() is null or not public.has_admin_permission('company_portal.write') then raise exception 'PLAN_ADMIN_REQUIRED';end if;
 if p_received is distinct from true or length(btrim(coalesce(p_payment_reference,''))) not between 3 and 200 then raise exception 'PRESENTIAL_PAYMENT_CONFIRMATION_REQUIRED';end if;
 if p_cycle not in('monthly','annual') then raise exception 'INVALID_BILLING_CYCLE';end if;
 select * into p from public.company_portal_plans where id=p_plan_id and enabled for share;
 if not found then raise exception 'ACTIVE_PLAN_REQUIRED';end if;
 perform 1 from public.companies where id=p_company_id and enabled for update;
 if not found then raise exception 'ACTIVE_COMPANY_REQUIRED';end if;
 if nullif(btrim(p_member_email),'') is not null then
  select id into v_user from auth.users where lower(email)=lower(btrim(p_member_email)) and email_confirmed_at is not null;
  if v_user is null then raise exception 'CONFIRMED_COMPANY_ACCOUNT_REQUIRED';end if;
 end if;
 v_end:=(current_date+case when p_cycle='monthly' then interval '1 month' else interval '1 year' end)::date-1;
 insert into public.company_portal_subscriptions(company_id,plan_id,billing_cycle,status,starts_on,ends_on,payment_reference,payment_amount,accredited_by,accredited_at)
 values(p_company_id,p.id,p_cycle,'active',current_date,v_end,btrim(p_payment_reference),case when p_cycle='monthly' then p.monthly_price else p.annual_price end,auth.uid(),now())
 on conflict(company_id) do update set plan_id=excluded.plan_id,billing_cycle=excluded.billing_cycle,status=excluded.status,starts_on=excluded.starts_on,ends_on=excluded.ends_on,payment_reference=excluded.payment_reference,payment_amount=excluded.payment_amount,accredited_by=excluded.accredited_by,accredited_at=excluded.accredited_at;
 if v_user is not null then
  insert into public.marketplace_company_memberships(company_id,auth_user_id,role,enabled) values(p_company_id,v_user,'owner',true)
  on conflict(company_id,auth_user_id) do update set role='owner',enabled=true;
 end if;
end $$;
drop policy company_portal_plans_read on public.company_portal_plans;
create policy company_portal_plans_read on public.company_portal_plans for select to authenticated using(public.has_admin_permission('company_portal.read') or exists(select 1 from public.company_portal_subscriptions s where s.plan_id=company_portal_plans.id and public.is_marketplace_company_member(s.company_id)));
revoke all on function public.enforce_company_ficha_asset_action(),public.accredit_company_plan(uuid,uuid,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.accredit_company_plan(uuid,uuid,text,text,boolean,text) to authenticated,service_role;

create function public.can_manage_agreement_product(p_company_id uuid,p_action text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not public.company_is_paid(p_company_id)
 and public.has_section_action('agreements',case when p_action='assets' then 'update' else p_action end)
$$;
create function public.enforce_agreement_product_action() returns trigger
language plpgsql security definer set search_path='' as $$
declare o jsonb:=case when tg_op='INSERT' then '{}' else to_jsonb(old) end;n jsonb:=case when tg_op='DELETE' then '{}' else to_jsonb(new) end;v_company uuid;a text;v_id uuid;
begin
 if tg_table_name='marketplace_product_assets' then
  v_id:=coalesce((n->>'product_id')::uuid,(o->>'product_id')::uuid);
  select company_id into v_company from public.marketplace_products where id=v_id;
  if tg_op='UPDATE' and n->>'product_id' is distinct from o->>'product_id' then raise exception 'PRODUCT_ASSET_PARENT_IMMUTABLE';end if;
 else
  v_company:=coalesce((n->>'company_id')::uuid,(o->>'company_id')::uuid);
  if tg_op='UPDATE' and n->>'company_id' is distinct from o->>'company_id' then raise exception 'COMPANY_IMMUTABLE';end if;
 end if;
 if auth.role()='service_role' or public.has_admin_permission('marketplace.write') then return coalesce(new,old);end if;
 if public.is_marketplace_company_member(v_company,'write') and public.company_has_active_plan(v_company) then return coalesce(new,old);end if;
 foreach a in array public.section_row_required_actions(o,n,tg_op,case when tg_table_name='marketplace_products' then 'enabled' else '' end,'sort_order',case when tg_table_name='marketplace_product_assets' then array['asset_id'] else '{}'::text[] end) loop
  if not public.has_section_action('marketplace',a) and not public.can_manage_agreement_product(v_company,a) then raise exception 'PRODUCT_ACTION_DENIED:%',a;end if;
 end loop;
 if tg_op='UPDATE' and o->'record_origin' is distinct from n->'record_origin' then raise exception 'ORIGIN_IMMUTABLE';end if;
 return coalesce(new,old);
end $$;
drop trigger marketplace_products_section_action_guard on public.marketplace_products;
create trigger marketplace_products_section_action_guard before insert or update or delete on public.marketplace_products for each row execute function public.enforce_agreement_product_action();
drop trigger marketplace_product_assets_section_action_guard on public.marketplace_product_assets;
create trigger marketplace_product_assets_section_action_guard before insert or update or delete on public.marketplace_product_assets for each row execute function public.enforce_agreement_product_action();
create policy agreement_product_insert on public.marketplace_products for insert to authenticated with check(public.can_manage_agreement_product(company_id,'create'));
create policy agreement_product_update on public.marketplace_products for update to authenticated using(public.can_manage_agreement_product(company_id,'update') or public.can_manage_agreement_product(company_id,'publish') or public.can_manage_agreement_product(company_id,'order')) with check(public.can_manage_agreement_product(company_id,'update') or public.can_manage_agreement_product(company_id,'publish') or public.can_manage_agreement_product(company_id,'order'));
create policy agreement_product_delete on public.marketplace_products for delete to authenticated using(public.can_manage_agreement_product(company_id,'delete') and record_origin='ADMIN_PHASE3');
create policy agreement_product_read on public.marketplace_products for select to authenticated using(public.can_manage_agreement_product(company_id,'read'));
create policy agreement_product_asset_write on public.marketplace_product_assets for all to authenticated using(exists(select 1 from public.marketplace_products p where p.id=product_id and public.can_manage_agreement_product(p.company_id,'assets'))) with check(exists(select 1 from public.marketplace_products p where p.id=product_id and public.can_manage_agreement_product(p.company_id,'assets')));
revoke all on function public.can_manage_agreement_product(uuid,text),public.enforce_agreement_product_action() from public,anon,authenticated;
grant execute on function public.can_manage_agreement_product(uuid,text) to authenticated,service_role;

drop trigger educational_resources_section_action_guard on public.educational_resources;
create trigger educational_resources_section_action_guard before insert or update or delete on public.educational_resources for each row execute function public.enforce_section_row_action('education','content.write','published','sort_order','image_asset_id,document_asset_id,cover_asset_id','provenance','ADMIN_PHASE2');
alter table public.educational_resources add constraint education_public_details_lists check((not public_details?'benefits' or jsonb_typeof(public_details->'benefits')='array') and (not public_details?'services' or jsonb_typeof(public_details->'services')='array') and (not public_details?'discount_percent' or (public_details->>'discount_percent')::numeric between 0 and 100));
create function public.get_current_company_access() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('company_id',m.company_id,'role',m.role)) from public.marketplace_company_memberships m where m.auth_user_id=auth.uid() and m.enabled and public.company_has_active_plan(m.company_id)),'[]');
end $$;
create function public.list_paid_company_ids() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.has_admin_permission('companies.read') or public.has_section_action('companies','read') or public.has_section_action('agreements','read')) then raise exception 'COMPANY_ADMIN_READ_REQUIRED';end if;
 return coalesce((select jsonb_agg(company_id) from public.company_portal_subscriptions where plan_id is not null),'[]');
end $$;
revoke all on function public.get_current_company_access(),public.list_paid_company_ids() from public,anon,authenticated;
grant execute on function public.get_current_company_access(),public.list_paid_company_ids() to authenticated,service_role;
commit;
