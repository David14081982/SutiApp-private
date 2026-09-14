"""Generate the additive, reviewable module authorization migration. No network."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = '20260914000200_admin_user_modules'
# Module ids are the existing UI ids. Permissions are backend capabilities, not UI state.
MODULES = [
 ('administrators','Administradores',[],[],[],True),
 ('screen_permissions','Permisos por pantalla',[],[],[],True),
 ('impersonation','Tomar control',['affiliates.impersonate'],[],[],False),
 ('affiliates','Afiliados',['affiliates.read','documents.read','assets.read','bank_accounts.read'],['affiliates.write','documents.write'],[],False),
 ('data_exports','Datos y respaldos',['data_exports.read'],[],[],False),
 ('popups','Pop-ups por pantalla',['popups.read'],['popups.write'],['popups'],False),
 ('sindicato','Tu Sindicato',['union_content.read','companies.read','segmentation.read','marketplace.read'],['union_content.write','companies.write'],['documents','minutes','programs','agreements'],False),
 ('requests','Solicitudes',['program_requests.read','documents.read','bank_accounts.read'],['program_requests.write','documents.write'],[],False),
 ('finanzas','Finanzas · Solicitudes',['program_requests.read','documents.read','bank_accounts.read','workflow.read'],['program_requests.write','documents.write'],[],False),
 ('savings','Ahorro',['savings.read'],['savings.write','savings.approve','savings.config','savings.identity_review','savings.reports'],['savings'],False),
 ('fondos','Fondos y reglas',['financial_criteria.visibility.read'],['financial_criteria.visibility.write'],[],False),
 ('fincat','Catálogo de Finanzas',['workflow.read'],['workflow.write'],[],False),
 ('program_products','Programas · Productos',['program_catalog.read'],['program_catalog.write'],[],False),
 ('flujos','Etapas y seguimiento',['workflow.read'],['workflow.write'],[],False),
 ('marketplace','Marketplace',['marketplace.read'],['marketplace.write'],['marketplace'],False),
 ('aprobaciones','Aprobación de Pop-ups',['popups.read'],['popups.write'],[],False),
 ('planes','Planes de empresas',['company_portal.read'],['company_portal.write'],[],False),
 ('membresias','Membresías',['memberships.read'],['memberships.write','assets.write'],[],False),
 ('noticias','Noticias del sindicato',['news.read'],['news.write'],['news'],False),
 ('education','Educación',['content.read'],['content.write'],['education','tutorials'],False),
 ('convenios','Convenios y beneficios',['companies.read','segmentation.read','marketplace.read'],['companies.write'],['agreements'],False),
 ('catalogos','Catálogos de segmentación',['segmentation.read'],['segmentation.write'],[],False),
 ('roles','Roles y permisos',[],[],[],True),
 ('pantallas','Acceso a pantallas',['segmentation.read'],['segmentation.write'],[],False),
 ('secciones','Secciones y componentes',['content.read'],[],[],False),
 ('banners','Banners',['banners.read'],['banners.write'],['banners'],False),
 ('companies_admin','Empresas',['companies.read'],['companies.write'],['companies'],False),
 ('documents_admin','Documentos y PDF',['documents.read','assets.read'],['documents.write'],['documents'],False),
 ('minutes_admin','Minutas',[],[],['minutes'],False),
 ('programs_admin','Programas institucionales',[],[],['programs'],False),
 ('menus','Menús y botones',['content.read'],[],[],False),
 ('formularios','Formularios',['content.read'],[],[],False),
 ('branding','Ícono e instalación',['assets.read'],['assets.write'],[],False),
]

def literal(value):
    return "'" + value.replace("'", "''") + "'"

def array(values):
    return 'array[' + ','.join(map(literal, values)) + ']::text[]'

rows=[]
for i,(key,label,reads,writes,sections,total) in enumerate(MODULES):
    rows.append(f"('admin_{key}',{literal(label)},'Administrative module: {key}',array['read','update'],'ENFORCED',{literal(key)},{array(reads)},{array(writes)},{array(sections)},{str(total).lower()},{i})")

sql = r"""begin;
-- H-ADMIN-USER-MODULES-001. No existing assignment or business row is changed.
create table public.admin_module_access_recovery (
 signature text primary key, definition text not null, applied_hash text
);
alter table public.admin_module_access_recovery enable row level security;
alter table public.admin_module_access_recovery force row level security;
revoke all on public.admin_module_access_recovery from public,anon,authenticated,service_role;

alter table public.admin_section_definitions
 add column module_key text unique,
 add column module_read_permissions text[] not null default '{}',
 add column module_write_permissions text[] not null default '{}',
 add column module_sections text[] not null default '{}',
 add column module_total_only boolean not null default false,
 add column module_order integer;

insert into public.admin_section_definitions(section_key,display_name,data_boundary,allowed_actions,enforcement_status,module_key,module_read_permissions,module_write_permissions,module_sections,module_total_only,module_order) values
""" + ',\n'.join(rows) + r""";

insert into public.admin_roles(code,name,description,system_role,enabled)
 values('module_admin','Acceso por pantallas','Capacidades derivadas de responsabilidades por usuario',true,true);

-- Clone the exact installed definitions (including the existing Savings extension).
do $copy$ declare item text; definition text; begin
 foreach item in array array['has_admin_permission(text)','has_section_action(text,text)','get_admin_access_context()'] loop
  definition:=pg_get_functiondef(('public.'||item)::regprocedure);
  insert into public.admin_module_access_recovery(signature,definition) values(item,definition);
  execute replace(definition,'public.'||split_part(item,'(',1)||'(', 'public.module_prior_'||split_part(item,'(',1)||'(');
  execute 'revoke all on function public.module_prior_'||item||' from public,anon,authenticated,service_role';
 end loop;
end $copy$;

create function public.is_module_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_assignments a join public.admin_roles r on r.id=a.role_id
  where a.auth_user_id=auth.uid() and r.code='module_admin');
$$;

create function public.has_admin_module(p_module text,p_action text default 'read') returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_assignments a join public.admin_roles role on role.id=a.role_id and role.enabled
  join public.admin_section_responsibilities grant_row on grant_row.auth_user_id=a.auth_user_id and grant_row.enabled
  join public.admin_section_definitions d on d.section_key=grant_row.section_key and d.enforcement_status='ENFORCED'
  where a.auth_user_id=auth.uid() and a.enabled and role.code='module_admin'
   and d.module_key=p_module and not d.module_total_only and grant_row.action=p_action);
$$;

-- This is a ceiling for new scoped accounts, never an authorization for legacy accounts.
create function public.admin_module_boundary(p_modules text[],p_action text default 'read') returns boolean
 language sql stable security definer set search_path='' as $$
 select not public.is_module_admin() or exists(select 1 from unnest(p_modules) m where public.has_admin_module(m,p_action));
$$;

create function public.module_effective_permissions() returns text[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(distinct permission order by permission),'{}') from (
  select unnest(case when g.action='update' then d.module_write_permissions else d.module_read_permissions end) permission
  from public.admin_section_responsibilities g join public.admin_section_definitions d on d.section_key=g.section_key
  where g.auth_user_id=auth.uid() and g.enabled and d.module_key is not null
   and public.has_admin_module(d.module_key,g.action)
 ) permissions;
$$;

create function public.admin_request_module_boundary(p_request uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not public.is_module_admin() or public.has_admin_module('finanzas') or
 (public.has_admin_module('requests') and exists(select 1 from public.program_requests where id=p_request and financial_processing_status is null));
$$;

create function public.admin_asset_module_boundary(p_bucket text,p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select not public.is_module_admin() or case
  when p_bucket='private-assets' then (split_part(p_path,'/',1)='affiliate-documents' and split_part(p_path,'/',2)=public.get_effective_affiliate_id()::text)
   or public.admin_module_boundary(array['affiliates','documents_admin','requests','finanzas'],'update')
  when p_bucket='company-assets' and split_part(p_path,'/',1)='marketplace' and split_part(p_path,'/',2)~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   then public.is_marketplace_company_member(split_part(p_path,'/',2)::uuid)
  when p_bucket='app-assets' and split_part(p_path,'/',1)='branding' then public.has_admin_module('branding','update')
  when split_part(p_path,'/',2)<>auth.uid()::text then false
  when p_bucket='company-assets' and split_part(p_path,'/',1)='convenios' and split_part(p_path,'/',3)~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   then public.can_manage_company_ficha(split_part(p_path,'/',3)::uuid,'assets')
  when p_bucket='app-assets' and split_part(p_path,'/',1)='membership' then public.has_admin_module('membresias','update')
  when p_bucket='app-assets' and split_part(p_path,'/',1)='program-products' then public.has_admin_module('program_products','update')
  when p_bucket='app-assets' and split_part(p_path,'/',1)='program-general' then public.admin_module_boundary(array['program_products','fincat'],'update')
  when split_part(p_path,'/',1)='sindicato' then public.has_admin_module('sindicato','update')
  when split_part(p_path,'/',1)='directory' then public.has_admin_module('sindicato','update')
  else public.has_section_action(split_part(p_path,'/',1),'assets') end;
$$;

create or replace function public.has_admin_permission(required_permission text) returns boolean
 language sql stable security definer set search_path='' as $$
 select case when public.is_module_admin() then required_permission=any(public.module_effective_permissions())
 else public.module_prior_has_admin_permission(required_permission) end;
$$;

create or replace function public.has_section_action(p_section_key text,p_action text) returns boolean
 language sql stable security definer set search_path='' as $$
 select case when public.is_module_admin() then exists(
  select 1 from public.admin_section_definitions d
  where p_section_key=any(d.module_sections) and public.has_admin_module(d.module_key,case when p_action='read' then 'read' else 'update' end)
   and exists(select 1 from public.admin_section_definitions original where original.section_key=p_section_key
    and original.enforcement_status='ENFORCED' and p_action=any(original.allowed_actions))
 ) else not exists(select 1 from public.admin_section_definitions where section_key=p_section_key and module_key is not null)
 and public.module_prior_has_section_action(p_section_key,p_action) end;
$$;

create or replace function public.get_admin_access_context() returns jsonb
 language sql stable security definer set search_path='' as $$
 select original || case when public.is_module_admin() then jsonb_build_object(
  'module_access_version',1,
  'module_keys',coalesce((select jsonb_agg(d.module_key order by d.module_order) from public.admin_section_definitions d
    where d.module_key is not null and public.has_admin_module(d.module_key)),'[]'::jsonb),
  'technical_permissions',to_jsonb(public.module_effective_permissions()),
  'section_actions',coalesce((select jsonb_agg(jsonb_build_object('section_key',d.section_key,'action',a))
    from public.admin_section_definitions d cross join lateral unnest(d.allowed_actions) a
    where d.module_key is null and public.has_section_action(d.section_key,a)),'[]'::jsonb)
 ) else jsonb_build_object('module_access_version',1,'module_keys',null,'section_actions',coalesce((
  select jsonb_agg(entry) from jsonb_array_elements(original->'section_actions') entry
  where not exists(select 1 from public.admin_section_definitions d where d.section_key=entry->>'section_key' and d.module_key is not null)
 ),'[]'::jsonb)) end
 from (select public.module_prior_get_admin_access_context() original) context;
$$;

create function public.list_admin_module_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.module_prior_has_admin_permission('authorization.read') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
 return (select jsonb_agg(jsonb_build_object('key',module_key,'label',display_name,'total_only',module_total_only) order by module_order)
 from public.admin_section_definitions where module_key is not null and enforcement_status='ENFORCED');
end $$;

create function public.list_module_general_requests(p_request_id uuid default null) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_admin_module('requests') or not public.has_admin_permission('program_requests.read') then raise exception 'ADMIN_PERMISSION_REQUIRED' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at desc) from (
  select r.id,r.folio,r.affiliate_id,r.numero_control,r.program_id,r.program_item_id,r.product_id,r.company_id,
   r.request_type,r.status,r.quantity,r.notes,r.terms_accepted,r.financial_processing_status,r.quoted_amount,r.quote_note,r.valid_until,r.responded_at,r.created_at,r.updated_at,
   case when p_request_id is not null then r.document_requirements_snapshot else null end document_requirements_snapshot,
   jsonb_build_object('full_name',a.full_name,'display_name',a.display_name,'numero_control',a.numero_control) affiliate,
   jsonb_build_object('name',p.name,'program_key',p.program_key,'price_cash',p.price_cash) program_item,
   jsonb_build_object('name',product.name,'price',product.price) product,
   jsonb_build_object('display_name',company.display_name) company
  from public.program_requests r left join public.affiliates a on a.id=r.affiliate_id
   left join public.program_catalog_items p on p.id=r.program_item_id
   left join public.marketplace_products product on product.id=r.product_id
   left join public.companies company on company.id=r.company_id
  where r.financial_processing_status is null and (p_request_id is null or r.id=p_request_id)
  order by r.created_at desc limit 250
 ) row),'[]'::jsonb);
end $$;

create function public.admin_user_module_version(p_user uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(coalesce((select to_jsonb(a)::text from public.admin_assignments a where auth_user_id=p_user),'')||
  coalesce((select string_agg(to_jsonb(g)::text,',' order by g.section_key,g.action) from public.admin_section_responsibilities g where auth_user_id=p_user),''));
$$;

create function public.get_admin_user_modules(p_email text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ids uuid[]; target uuid; result jsonb; begin
 if not public.module_prior_has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
 select array_agg(id) into ids from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
 if coalesce(cardinality(ids),0)<>1 then raise exception 'CONFIRMED_AUTH_USER_NOT_FOUND_OR_AMBIGUOUS'; end if;
 target:=ids[1];
 select jsonb_build_object('auth_user_id',target,'email',u.email,
  'mode',case when a.enabled and r.code='principal_admin' then 'total' when a.enabled and r.code='module_admin' then 'limited' else 'unassigned' end,
  'existing_role',case when a.enabled then r.name else null end,'protected',coalesce(a.protected_assignment,false),'self',target=auth.uid(),
  'version',public.admin_user_module_version(target),
  'modules',coalesce((select jsonb_agg(d.module_key order by d.module_order) from public.admin_section_responsibilities g
   join public.admin_section_definitions d on d.section_key=g.section_key
   where g.auth_user_id=target and g.enabled and g.action='read' and d.module_key is not null),'[]'::jsonb)) into result
 from auth.users u left join public.admin_assignments a on a.auth_user_id=u.id left join public.admin_roles r on r.id=a.role_id where u.id=target;
 return result;
end $$;

create function public.save_admin_user_modules(p_email text,p_mode text,p_modules text[],p_expected_version text) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare target uuid; before_state jsonb; selected_role uuid; selected_modules text[]; begin
 if not public.module_prior_has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
 before_state:=public.get_admin_user_modules(p_email);target:=(before_state->>'auth_user_id')::uuid;
 if target=auth.uid() then raise exception 'SELF_ASSIGNMENT_DENIED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-user-modules:'||target::text,0));
 perform 1 from public.admin_assignments where auth_user_id=target for update;
 if p_expected_version is null or p_expected_version<>public.admin_user_module_version(target) then raise exception 'ADMIN_ACCESS_CHANGED' using errcode='40001'; end if;
 if p_mode is null or p_mode not in ('limited','total') then raise exception 'INVALID_ACCESS_MODE'; end if;
 select coalesce(array_agg(distinct m order by m),'{}') into selected_modules from unnest(p_modules) m;
 if p_mode='limited' and (cardinality(selected_modules)=0 or exists(select 1 from unnest(selected_modules) m
  where not exists(select 1 from public.admin_section_definitions d where d.module_key=m and not d.module_total_only and d.enforcement_status='ENFORCED'))) then
  raise exception 'INVALID_ADMIN_MODULE'; end if;
 select id into selected_role from public.admin_roles where code=case when p_mode='total' then 'principal_admin' else 'module_admin' end and enabled;
 if selected_role is null then raise exception 'ADMIN_ROLE_UNAVAILABLE'; end if;
 -- Existing writer preserves protected/last-admin guards, actor metadata and session revocation.
 perform public.assign_admin_role(target,selected_role,true);
 update public.admin_section_responsibilities set enabled=false,revoked_at=now(),revoked_by_auth_user_id=auth.uid(),updated_at=now()
 where auth_user_id=target and enabled;
 if p_mode='limited' then
  insert into public.admin_section_responsibilities(auth_user_id,section_key,action,enabled,granted_by_auth_user_id)
  select target,d.section_key,a,true,auth.uid() from public.admin_section_definitions d cross join unnest(array['read','update']) a
  where d.module_key=any(selected_modules)
  on conflict(auth_user_id,section_key,action) do update set enabled=true,granted_by_auth_user_id=excluded.granted_by_auth_user_id,
   assigned_at=now(),updated_at=now(),revoked_at=null,revoked_by_auth_user_id=null;
 end if;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
 values(auth.uid(),'admin_user_modules','SET',target::text,'SUCCESS',jsonb_build_object('before',before_state,'mode',p_mode,'modules',to_jsonb(selected_modules)));
 return public.get_admin_user_modules(p_email);
end $$;

-- New catalog rows are managed by the user editor; preserve the existing section UI.
do $patch$ declare definition text; begin
 definition:=pg_get_functiondef('public.list_admin_section_definitions()'::regprocedure);
 insert into public.admin_module_access_recovery(signature,definition) values('list_admin_section_definitions()',definition);
 if position('where d.enforcement_status=' in definition)=0 then raise exception 'SECTION_CATALOG_CONTRACT_CHANGED'; end if;
 execute replace(definition,'where d.enforcement_status=', 'where d.module_key is null and d.enforcement_status=');
end $patch$;

-- Split dedicated finance RPC entrypoints. Existing roles execute exactly the old logic.
do $patch$ declare name text; definition text; begin
 foreach name in array array['list_admin_financial_requests_mobile()','list_admin_financial_request_queue()',
 'list_admin_finance_request_flow_queue()','get_admin_financial_request_detail(uuid)','get_admin_finance_request_flow_detail(uuid)'] loop
  definition:=pg_get_functiondef(('public.'||name)::regprocedure);
  insert into public.admin_module_access_recovery(signature,definition) values(name,definition);
  if position($q$public.has_admin_permission('program_requests.read'$q$ in definition)=0 then raise exception 'FINANCE_ENTRY_CONTRACT_CHANGED:%',name; end if;
  execute replace(definition,$q$public.has_admin_permission('program_requests.read')$q$,
   $q$(public.has_admin_permission('program_requests.read') and public.admin_module_boundary(array['finanzas']))$q$);
 end loop;
end $patch$;

-- Scope shared SECURITY DEFINER operations by the target row, never by a client route.
do $patch$ declare item record; definition text; marker text; begin
 for item in select p.oid, p.oid::regprocedure signature from pg_proc p
 where p.pronamespace='public'::regnamespace and p.proname in(
  'update_program_request','respond_program_request_quote','record_program_request_admin_action',
  'approve_program_product_payment_request','transition_program_request_workflow',
  'get_program_request_admin_events','get_program_request_google_sync','request_program_request_google_sync','get_admin_request_delete_preview','resolve_program_request_workflow_state') loop
  definition:=pg_get_functiondef(item.oid);
  if position('p_request_id' in definition)=0 then raise exception 'REQUEST_GUARD_SIGNATURE_CHANGED'; end if;
  insert into public.admin_module_access_recovery(signature,definition) values(replace(item.signature::text,'public.',''),definition);
  if position($q$public.has_admin_permission('program_requests.$q$ in definition)=0 then raise exception 'REQUEST_GUARD_CONTRACT_CHANGED:%',item.signature; end if;
  foreach marker in array array['read','write'] loop
   definition:=replace(definition,'public.has_admin_permission(''program_requests.'||marker||''')',
    '(public.has_admin_permission(''program_requests.'||marker||''') and public.admin_request_module_boundary(p_request_id))');
  end loop;
  if item.signature::text like '%resolve_program_request_workflow_state%' then
   definition:=replace(definition,$q$public.has_admin_permission('workflow.read')$q$,
    $q$(public.has_admin_permission('workflow.read') and public.admin_module_boundary(array['flujos','finanzas']))$q$);
  end if;
  execute definition;
 end loop;
end $patch$;

do $patch$ declare item record; definition text; begin
 for item in select * from (values
 ('register_branding_assets(jsonb)','assets.write','branding'),
 ('review_company_popup_proposal(uuid,boolean,text)','popups.write','aprobaciones'),
 ('save_agreement_ficha(jsonb)','companies.write','convenios'),
 ('list_admin_request_workflow_tracking()','workflow.read','flujos'),
 ('reorder_operational_workflow_stages(uuid,uuid[])','workflow.write','flujos'),
 ('save_program_general_info(text,timestamptz,jsonb)','workflow.write','fincat'),
 ('register_program_general_cover(text,text,bigint,text)','workflow.write','fincat')
 ) target(signature,permission,module) loop
  definition:=pg_get_functiondef(('public.'||item.signature)::regprocedure);
  insert into public.admin_module_access_recovery(signature,definition) values(item.signature,definition);
  if position('public.has_admin_permission('''||item.permission||''')' in definition)=0 then raise exception 'DEDICATED_WRITER_CONTRACT_CHANGED:%',item.signature; end if;
  execute replace(definition,'public.has_admin_permission('''||item.permission||''')',
   '(public.has_admin_permission('''||item.permission||''') and public.admin_module_boundary('||
   case when item.module='convenios' then 'array[''convenios'',''sindicato'']' else 'array['''||item.module||''']' end||
   ','''||case when item.permission like '%.read' then 'read' else 'update' end||'''))');
 end loop;
end $patch$;

-- Restrictive policies do not grant access or alter business rules. SELECT on public
-- affiliate catalogs stays public; writes require the selected administrative surface.
"""

TABLE_BOUNDARIES = {
 'finance_catalog_presentation':['fincat'],
 'operational_workflows':['flujos'], 'operational_workflow_stages':['flujos'],
 'operational_request_tracking':['flujos'],
 'screen_access_policies':['pantallas'], 'segmentation_catalog_entries':['catalogos'],
 'company_popup_proposals':['aprobaciones'], 'app_settings':['branding'],
 'educational_resources':['education'], 'institutional_programs':['programs_admin','sindicato'],
 'institutional_documents':['sindicato'], 'directory_members':['sindicato'], 'minutes':['minutes_admin','sindicato'],
 'news_articles':['noticias','sindicato'], 'news_settings':['noticias'],
 'banners':['banners'], 'popups':['popups'],
 'company_benefit_profiles':['convenios','sindicato'], 'company_benefits':['convenios','sindicato'], 'company_audience_rules':['convenios','sindicato'],
}
for table,modules in TABLE_BOUNDARIES.items():
    boundary=f"public.admin_module_boundary({array(modules)},'update')"
    if table=='company_popup_proposals':
        boundary=f'({boundary} or public.is_marketplace_company_member(company_id))'
    for command in ['insert','update','delete']:
        sql+=f"create policy module_scope_{command} on public.{table} as restrictive for {command} to authenticated "
        if command!='insert': sql+=f'using ({boundary}) '
        if command!='delete': sql+=f'with check ({boundary}) '
        sql+=';\n'

sql+=r'''
create policy module_scope_read on public.operational_workflows as restrictive for select to authenticated using(public.admin_module_boundary(array['flujos','finanzas','requests']));
create policy module_scope_read on public.operational_workflow_stages as restrictive for select to authenticated using(public.admin_module_boundary(array['flujos','finanzas','requests']));
create policy module_scope_read on public.operational_request_tracking as restrictive for select to authenticated using(public.admin_module_boundary(array['flujos','finanzas','requests']) or exists(select 1 from public.program_requests r where r.id=request_id and r.affiliate_id=public.get_effective_affiliate_id()));
create policy module_scope_read on public.screen_access_policies as restrictive for select to authenticated using(public.admin_module_boundary(array['pantallas']));
create policy module_scope_read on public.company_popup_proposals as restrictive for select to authenticated using(public.admin_module_boundary(array['aprobaciones']) or public.is_marketplace_company_member(company_id));

-- A logo-upload dependency must not authorize branding or another module's objects.
create policy module_scope_insert on public.app_assets as restrictive for insert to authenticated with check(public.admin_asset_module_boundary(storage_bucket,storage_path));
create policy module_scope_update on public.app_assets as restrictive for update to authenticated using(public.admin_asset_module_boundary(storage_bucket,storage_path)) with check(public.admin_asset_module_boundary(storage_bucket,storage_path));
create policy module_scope_delete on public.app_assets as restrictive for delete to authenticated using(public.admin_asset_module_boundary(storage_bucket,storage_path));
create policy module_scope_sources on public.asset_sources as restrictive for all to authenticated using(not public.is_module_admin() or exists(select 1 from public.app_assets a where a.id=asset_id and public.admin_asset_module_boundary(a.storage_bucket,a.storage_path))) with check(not public.is_module_admin() or exists(select 1 from public.app_assets a where a.id=asset_id and public.admin_asset_module_boundary(a.storage_bucket,a.storage_path)));
create policy module_scope_insert on storage.objects as restrictive for insert to authenticated with check(public.admin_asset_module_boundary(bucket_id,name));
create policy module_scope_update on storage.objects as restrictive for update to authenticated using(public.admin_asset_module_boundary(bucket_id,name)) with check(public.admin_asset_module_boundary(bucket_id,name));
create policy module_scope_delete on storage.objects as restrictive for delete to authenticated using(public.admin_asset_module_boundary(bucket_id,name));

-- General requests must not acquire financial rows through direct table calls.
create policy module_scope_requests on public.program_requests as restrictive for select to authenticated using (
 not public.is_module_admin() or affiliate_id=public.get_effective_affiliate_id()
 or public.is_marketplace_company_member(company_id)
 or public.has_admin_module('finanzas')
 or (financial_processing_status is null and public.has_admin_module('requests'))
);

do $acl$ declare item record; begin
 for item in select p.oid::regprocedure signature from pg_proc p where p.pronamespace='public'::regnamespace
 and p.proname in('is_module_admin','has_admin_module','admin_module_boundary','module_effective_permissions',
 'admin_user_module_version','list_admin_module_catalog','get_admin_user_modules','save_admin_user_modules','admin_request_module_boundary','admin_asset_module_boundary','list_module_general_requests') loop
  execute 'revoke all on function '||item.signature||' from public,anon,authenticated,service_role';
 end loop;
end $acl$;
grant execute on function public.is_module_admin(),public.has_admin_module(text,text),public.admin_module_boundary(text[],text) to authenticated;
grant execute on function public.admin_asset_module_boundary(text,text) to authenticated;
grant execute on function public.list_admin_module_catalog(),public.get_admin_user_modules(text),public.save_admin_user_modules(text,text,text[],text) to authenticated;
grant execute on function public.list_module_general_requests(uuid) to authenticated;

update public.admin_module_access_recovery set applied_hash=md5(pg_get_functiondef(('public.'||signature)::regprocedure));
notify pgrst,'reload schema';
commit;
'''

recovery=r'''begin;
-- No automatic rollback after actual user assignments. Preserve history instead.
do $$ begin
 if exists(select 1 from public.admin_assignments a join public.admin_roles r on r.id=a.role_id where r.code='module_admin')
 or exists(select 1 from public.admin_section_responsibilities g join public.admin_section_definitions d on d.section_key=g.section_key where d.module_key is not null)
 or exists(select 1 from public.admin_audit_log where resource='admin_user_modules') then raise exception 'RECOVERY_BLOCKED_MODULE_ACCESS_HISTORY'; end if;
 if exists(select 1 from public.admin_module_access_recovery where applied_hash<>md5(pg_get_functiondef(('public.'||signature)::regprocedure))) then raise exception 'RECOVERY_BLOCKED_NEWER_FUNCTION'; end if;
end $$;
do $$ declare item record; begin
 for item in select definition from public.admin_module_access_recovery loop execute item.definition; end loop;
end $$;
'''
for table in TABLE_BOUNDARIES:
    for cmd in ['insert','update','delete']:
        recovery+=f'drop policy module_scope_{cmd} on public.{table};\n'
recovery+='drop policy module_scope_requests on public.program_requests;\n'
for table in ['operational_workflows','operational_workflow_stages','operational_request_tracking','screen_access_policies','company_popup_proposals']:
    recovery+=f'drop policy module_scope_read on public.{table};\n'
for table in ['public.app_assets','storage.objects']:
    for cmd in ['insert','update','delete']:
        recovery+=f'drop policy module_scope_{cmd} on {table};\n'
recovery+='drop policy module_scope_sources on public.asset_sources;\n'
for signature in ['save_admin_user_modules(text,text,text[],text)','get_admin_user_modules(text)','admin_user_module_version(uuid)','list_admin_module_catalog()','list_module_general_requests(uuid)',
 'admin_request_module_boundary(uuid)','admin_asset_module_boundary(text,text)','module_effective_permissions()','admin_module_boundary(text[],text)','has_admin_module(text,text)','is_module_admin()',
 'module_prior_get_admin_access_context()','module_prior_has_section_action(text,text)','module_prior_has_admin_permission(text)']:
    recovery+=f'drop function public.{signature};\n'
recovery+="delete from public.admin_roles where code='module_admin';\ndelete from public.admin_section_definitions where module_key is not null;\n"
recovery+='alter table public.admin_section_definitions '+','.join('drop column '+c for c in ['module_key','module_read_permissions','module_write_permissions','module_sections','module_total_only','module_order'])+';\n'
recovery+="drop table public.admin_module_access_recovery;\nnotify pgrst,'reload schema';\ncommit;\n"

if __name__ == '__main__':
    (ROOT/'supabase/migrations'/f'{MIGRATION}.sql').write_text(sql,encoding='utf-8')
    (ROOT/'supabase/recovery'/f'{MIGRATION}.sql').write_text(recovery,encoding='utf-8')
    print(json.dumps({'modules':len(MODULES),'migration':MIGRATION,'network':False}))
