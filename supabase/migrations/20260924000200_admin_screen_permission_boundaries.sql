begin;
set local lock_timeout='2s';set local statement_timeout='60s';
lock table public.admin_assignments,public.admin_section_responsibilities,public.admin_roles,public.admin_role_permissions,public.admin_audit_log,public.companies,public.company_assets,public.company_benefit_profiles,public.company_benefits,public.company_audience_rules,public.marketplace_company_memberships,public.company_portal_subscriptions,public.company_portal_plans in share row exclusive mode;
do $checks$ begin
if md5(pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure))<>'5386a38facd028135d1211ccbfe9670f' then raise exception 'FUNCTION_DRIFT:module_visible';end if;
if md5(pg_get_functiondef('can_manage_company_ficha(uuid,text)'::regprocedure))<>'c1e8ff67356f9186057afd9ec1cb363e' then raise exception 'FUNCTION_DRIFT:can_manage_company_ficha';end if;
if md5(pg_get_functiondef('enforce_company_ficha_action()'::regprocedure))<>'4b587df7f29296066c754d9061d9d6b2' then raise exception 'FUNCTION_DRIFT:enforce_company_ficha_action';end if;
if md5(pg_get_functiondef('enforce_company_ficha_asset_action()'::regprocedure))<>'592c4931ffc8ebbe38d70c427aa91bba' then raise exception 'FUNCTION_DRIFT:enforce_company_ficha_asset_action';end if;
if (select md5(pg_get_expr(polqual,polrelid)) from pg_policy where polrelid='public.marketplace_company_memberships'::regclass and polname='marketplace_memberships_self_read') is distinct from 'a4ca607c9ebffc76352b1e9e9a96a944' then raise exception 'MEMBERSHIP_POLICY_DRIFT';end if;
end $checks$;
create table public.admin_permission_fix_recovery_20260924000200(key text primary key,definition text not null,applied_hash text,security jsonb);
alter table public.admin_permission_fix_recovery_20260924000200 enable row level security;alter table public.admin_permission_fix_recovery_20260924000200 force row level security;
revoke all on public.admin_permission_fix_recovery_20260924000200 from public,anon,authenticated,service_role;
insert into public.admin_permission_fix_recovery_20260924000200(key,definition)
select 'admin_support_private.module_visible(uuid,text)',pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure)
union all
select 'can_manage_company_ficha(uuid,text)',pg_get_functiondef('can_manage_company_ficha(uuid,text)'::regprocedure)
union all
select 'enforce_company_ficha_action()',pg_get_functiondef('enforce_company_ficha_action()'::regprocedure)
union all
select 'enforce_company_ficha_asset_action()',pg_get_functiondef('enforce_company_ficha_asset_action()'::regprocedure)
union all
select 'membership_policy',pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.marketplace_company_memberships'::regclass and polname='marketplace_memberships_self_read';
insert into public.admin_permission_fix_recovery_20260924000200(key,definition) select 'state',md5(concat_ws('|',md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_assignments x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_section_responsibilities x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_roles x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_role_permissions x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_audit_log x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.companies x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_assets x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_benefit_profiles x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_benefits x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_audience_rules x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.marketplace_company_memberships x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_portal_subscriptions x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_portal_plans x),'[]'))));
CREATE OR REPLACE FUNCTION admin_support_private.module_visible(p_subject uuid, p_module text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c jsonb:=admin_support_private.get_admin_access_context(p_subject); required text; sections text[]; begin
 if admin_support_private.is_module_admin(p_subject) then return admin_support_private.has_admin_module(p_subject,p_module); end if;
 select permission,section_keys into required,sections from (values ('login_history','authorization.read',array[]::text[]),('votaciones','votaciones.read',array['votaciones','votaciones_results']::text[]),('votaciones_nominal','votaciones.export_identified_votes',array['votaciones_identified']::text[]),('administrators','authorization.read',array[]::text[]),('screen_permissions','authorization.read',array[]::text[]),('impersonation','affiliates.impersonate',array[]::text[]),('affiliates','affiliates.read',array[]::text[]),('data_exports','data_exports.read',array[]::text[]),('popups','popups.read',array['popups']::text[]),('sindicato','union_content.read',array[]::text[]),('requests','program_requests.read',array[]::text[]),('finanzas','program_requests.read',array[]::text[]),('savings','savings.read',array[]::text[]),('fondos','financial_criteria.visibility.read',array[]::text[]),('fincat','workflow.read',array[]::text[]),('program_products','program_catalog.read',array[]::text[]),('flujos','workflow.read',array[]::text[]),('inversion','workflow.read',array[]::text[]),('marketplace','marketplace.read',array['marketplace']::text[]),('aprobaciones','popups.read',array[]::text[]),('planes','company_portal.read',array[]::text[]),('membresias','memberships.read',array[]::text[]),('noticias','news.read',array['news']::text[]),('education','content.read',array['education','tutorials']::text[]),('convenios','companies.read',array['agreements']::text[]),('catalogos','segmentation.read',array[]::text[]),('roles','authorization.read',array[]::text[]),('pantallas','segmentation.read',array[]::text[]),('secciones','content.read',array[]::text[]),('banners','banners.read',array['banners']::text[]),('companies_admin','companies.read',array['companies']::text[]),('documents_admin','documents.read',array['documents']::text[]),('minutes_admin','minutes.read',array['minutes']::text[]),('programs_admin','programs.read',array['programs']::text[]),('menus','content.read',array[]::text[]),('formularios','content.read',array[]::text[]),('branding','assets.read',array[]::text[])) modules(key,permission,section_keys) where key=p_module;
 if required is null then return false; end if;
 return coalesce((c->>'full_access')::boolean,false)
  or exists(select 1 from jsonb_array_elements(c->'section_actions') entry where entry->>'section_key'=any(sections))
  or (p_module='data_exports' and exists(select 1 from jsonb_array_elements(c->'section_actions') entry where entry->>'action'='export'))
  or admin_support_private.has_admin_permission(p_subject,required)
  or (p_module='education' and exists(select 1 from jsonb_array_elements(c->'section_actions') entry where entry->>'section_key' in ('education','tutorials')));
end $function$
;
CREATE OR REPLACE FUNCTION public.can_manage_company_ficha(p_company_id uuid, p_action text DEFAULT 'update'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (
 (public.has_admin_permission('companies.write') and public.admin_module_boundary(array['companies_admin'],'update')) or public.has_section_action('companies',p_action)
 or (not public.company_is_paid(p_company_id) and public.has_section_action('agreements',case when p_action='assets' then 'update' else p_action end))
 or (p_action in ('update','assets') and public.is_marketplace_company_member(p_company_id,'write') and public.company_has_active_plan(p_company_id)))
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_company_ficha_action()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o jsonb:=case when tg_op='INSERT' then '{}' else to_jsonb(old) end;
 n jsonb:=case when tg_op='DELETE' then '{}' else to_jsonb(new) end; a text; v_id uuid:=coalesce(new.id,old.id);
begin
 if auth.role()='service_role' or (public.has_admin_permission('companies.write') and public.admin_module_boundary(array['companies_admin'],'update')) then return coalesce(new,old);end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.enforce_company_ficha_asset_action()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid:=coalesce(new.company_id,old.company_id);
begin
 if auth.role()='service_role' or (public.has_admin_permission('companies.write') and public.admin_module_boundary(array['companies_admin'],'update')) then return coalesce(new,old);end if;
 if not(public.can_manage_company_ficha(v_id,'assets') or (not public.company_is_paid(v_id) and public.has_section_action('agreements','update'))) then raise exception 'COMPANY_ASSET_DENIED';end if;
 if tg_op='UPDATE' and new.company_id<>old.company_id then raise exception 'COMPANY_IMMUTABLE';end if;
 return coalesce(new,old);
end $function$
;
create function public.enforce_admin_company_module_scope() returns trigger language plpgsql security definer set search_path='' as $$
declare company_id uuid:=coalesce(new.company_id,old.company_id); action_name text:=case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end;
begin
 if auth.role()='service_role' then return coalesce(new,old);end if;
 if tg_op='UPDATE' and new.company_id is distinct from old.company_id then raise exception 'COMPANY_BOUNDARY_IMMUTABLE';end if;
 if not (
  (public.has_admin_permission('companies.write') and public.admin_module_boundary(array['companies_admin'],'update'))
  or public.has_section_action('companies',action_name)
  or not public.company_is_paid(company_id)
 ) then raise exception 'COMPANY_MODULE_BOUNDARY_DENIED';end if;
 return coalesce(new,old);
end $$;
revoke all on function public.enforce_admin_company_module_scope() from public,anon,authenticated,service_role;
create trigger admin_company_module_scope before insert or update or delete on public.company_benefit_profiles for each row execute function public.enforce_admin_company_module_scope();
create trigger admin_company_module_scope before insert or update or delete on public.company_benefits for each row execute function public.enforce_admin_company_module_scope();
create trigger admin_company_module_scope before insert or update or delete on public.company_audience_rules for each row execute function public.enforce_admin_company_module_scope();
alter policy marketplace_memberships_self_read on public.marketplace_company_memberships using((auth_user_id=(select auth.uid())) or (public.has_admin_permission('companies.read') and public.admin_module_boundary(array['companies_admin','planes'])));
update public.admin_permission_fix_recovery_20260924000200 set applied_hash=md5(pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure)) where key='admin_support_private.module_visible(uuid,text)';
update public.admin_permission_fix_recovery_20260924000200 set applied_hash=md5(pg_get_functiondef('can_manage_company_ficha(uuid,text)'::regprocedure)) where key='can_manage_company_ficha(uuid,text)';
update public.admin_permission_fix_recovery_20260924000200 set applied_hash=md5(pg_get_functiondef('enforce_company_ficha_action()'::regprocedure)) where key='enforce_company_ficha_action()';
update public.admin_permission_fix_recovery_20260924000200 set applied_hash=md5(pg_get_functiondef('enforce_company_ficha_asset_action()'::regprocedure)) where key='enforce_company_ficha_asset_action()';
update public.admin_permission_fix_recovery_20260924000200 set security=(select jsonb_build_array(oid,proowner,proacl::text) from pg_proc where oid='admin_support_private.module_visible(uuid,text)'::regprocedure) where key='admin_support_private.module_visible(uuid,text)';
update public.admin_permission_fix_recovery_20260924000200 set security=(select jsonb_build_array(oid,proowner,proacl::text) from pg_proc where oid='can_manage_company_ficha(uuid,text)'::regprocedure) where key='can_manage_company_ficha(uuid,text)';
update public.admin_permission_fix_recovery_20260924000200 set security=(select jsonb_build_array(oid,proowner,proacl::text) from pg_proc where oid='enforce_company_ficha_action()'::regprocedure) where key='enforce_company_ficha_action()';
update public.admin_permission_fix_recovery_20260924000200 set security=(select jsonb_build_array(oid,proowner,proacl::text) from pg_proc where oid='enforce_company_ficha_asset_action()'::regprocedure) where key='enforce_company_ficha_asset_action()';
update public.admin_permission_fix_recovery_20260924000200 set applied_hash=(select md5(pg_get_expr(polqual,polrelid)) from pg_policy where polrelid='public.marketplace_company_memberships'::regclass and polname='marketplace_memberships_self_read') where key='membership_policy';
update public.admin_permission_fix_recovery_20260924000200 set security=(select jsonb_build_array(polpermissive,polroles::text,polcmd,pg_get_expr(polwithcheck,polrelid)) from pg_policy where polrelid='public.marketplace_company_memberships'::regclass and polname='marketplace_memberships_self_read') where key='membership_policy';
insert into public.admin_permission_fix_recovery_20260924000200(key,definition,applied_hash) select 'new_guard','',md5(pg_get_functiondef('public.enforce_admin_company_module_scope()'::regprocedure));
update public.admin_permission_fix_recovery_20260924000200 set security=(select jsonb_build_array(oid,proowner,proacl::text) from pg_proc where oid='public.enforce_admin_company_module_scope()'::regprocedure) where key='new_guard';
do $unchanged$ begin if (select definition from public.admin_permission_fix_recovery_20260924000200 where key='state')<>md5(concat_ws('|',md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_assignments x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_section_responsibilities x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_roles x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_role_permissions x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.admin_audit_log x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.companies x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_assets x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_benefit_profiles x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_benefits x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_audience_rules x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.marketplace_company_memberships x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_portal_subscriptions x),'[]')),md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.company_portal_plans x),'[]')))) then raise exception 'UNEXPECTED_DATA_CHANGE';end if;end $unchanged$;
commit;
