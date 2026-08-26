begin;

-- Approved technical permissions. Business segmentation never grants these.
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write',
  'authorization.read','authorization.write','segmentation.read','segmentation.write',
  'workflow.read','workflow.write','union_content.read','union_content.write'
]::text[]);

create table public.admin_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check(code ~ '^[a-z][a-z0-9_]{2,63}$'),
  name text not null check(length(btrim(name)) between 3 and 80),
  description text not null default '',
  system_role boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.admin_role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission text not null,
  primary key(role_id,permission)
);
alter table public.admin_assignments add column role_id uuid null references public.admin_roles(id) on delete restrict;

insert into public.admin_roles(code,name,description,system_role)
values('principal_admin','Administrador principal','Administración técnica principal protegida.',true);
insert into public.admin_role_permissions(role_id,permission)
select r.id,p from public.admin_roles r cross join unnest(array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write',
  'authorization.read','authorization.write','segmentation.read','segmentation.write',
  'workflow.read','workflow.write','union_content.read','union_content.write'
]::text[]) p where r.code='principal_admin';
update public.admin_assignments a set role_id=r.id,permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=r.id)
from public.admin_roles r where r.code='principal_admin' and a.enabled;
alter table public.admin_assignments alter column role_id set not null;

create or replace function public.has_admin_permission(required_permission text)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(
  select 1 from public.admin_assignments a
  join public.admin_roles r on r.id=a.role_id and r.enabled
  join public.admin_role_permissions rp on rp.role_id=r.id
  where a.auth_user_id=(select auth.uid()) and a.enabled and rp.permission=required_permission
) $$;

create function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_allowed text[]:=array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write'];
begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED'; end if;
  if p_permissions is null or exists(select 1 from unnest(p_permissions) p where not(p=any(v_allowed))) then raise exception 'INVALID_PERMISSION'; end if;
  if p_role_id is null then
    insert into public.admin_roles(code,name,description) values('role_'||replace(extensions.gen_random_uuid()::text,'-',''),btrim(p_name),coalesce(p_description,'')) returning id into v_id;
  else
    if exists(select 1 from public.admin_roles where id=p_role_id and system_role) then raise exception 'SYSTEM_ROLE_IMMUTABLE'; end if;
    update public.admin_roles set name=btrim(p_name),description=coalesce(p_description,''),updated_at=now() where id=p_role_id returning id into v_id;
    if v_id is null then raise exception 'ROLE_NOT_FOUND'; end if;
    delete from public.admin_role_permissions where role_id=v_id;
  end if;
  insert into public.admin_role_permissions(role_id,permission) select v_id,p from (select distinct unnest(p_permissions) p) q;
  update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=v_id),updated_at=now() where role_id=v_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'admin_roles',case when p_role_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS');
  return v_id;
end $$;
create function public.delete_admin_role(p_role_id uuid) returns void language plpgsql security definer set search_path=''
as $$ begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED'; end if;
  if exists(select 1 from public.admin_roles where id=p_role_id and system_role) then raise exception 'SYSTEM_ROLE_IMMUTABLE'; end if;
  if exists(select 1 from public.admin_assignments where role_id=p_role_id) then raise exception 'ROLE_IN_USE'; end if;
  delete from public.admin_roles where id=p_role_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'admin_roles','DELETE',p_role_id::text,'SUCCESS');
end $$;
create function public.assign_admin_role(p_auth_user_id uuid,p_role_id uuid,p_enabled boolean default true)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_permissions text[]; begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED'; end if;
  if p_auth_user_id=auth.uid() then raise exception 'SELF_ASSIGNMENT_DENIED'; end if;
  if not exists(select 1 from public.admin_roles where id=p_role_id and enabled) then raise exception 'ROLE_NOT_FOUND'; end if;
  select array_agg(permission order by permission) into v_permissions from public.admin_role_permissions where role_id=p_role_id;
  insert into public.admin_assignments(auth_user_id,role,role_id,permissions,enabled)
  values(p_auth_user_id,'visual_admin',p_role_id,coalesce(v_permissions,'{}'),p_enabled)
  on conflict(auth_user_id) do update set role_id=excluded.role_id,permissions=excluded.permissions,enabled=excluded.enabled,updated_at=now()
  returning id into v_id;
  if not exists(select 1 from public.admin_assignments where enabled and role_id in(select id from public.admin_roles where system_role)) then raise exception 'LAST_PRINCIPAL_ADMIN_REQUIRED'; end if;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'admin_assignments','UPSERT',v_id::text,'SUCCESS',jsonb_build_object('subject',p_auth_user_id));
  return v_id;
end $$;

create table public.segmentation_catalog_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  catalog_type text not null check(catalog_type in('union','employment_category','gender','tag')),
  code text not null,
  label text not null check(length(btrim(label)) between 1 and 120),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  source_sheet text null,
  source_range text null,
  source_snapshot_hash text null check(source_snapshot_hash is null or source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(catalog_type,code)
);
insert into public.segmentation_catalog_entries(catalog_type,code,label,sort_order,source_sheet,source_range,source_snapshot_hash) values
('union','SUTISSSTESON','SUTISSSTESON',1,'Sindicatos','A1:D6','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('union','SUEISSSTESON','SUEISSSTESON',2,'Sindicatos','A1:D6','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('union','SITISSSTESON','SITISSSTESON',3,'Sindicatos','A1:D6','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('union','EMPLEADOS_DE_CONFIANZA','EMPLEADOS DE CONFIANZA',4,'Sindicatos','A1:D6','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('union','EXTERNO','Externo',5,'Sindicatos','A1:D6','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('employment_category','SUPLENTES_VARIABLES','Suplentes Variables',1,'Categoría de empleados','A1:D7','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('employment_category','SUPLENTES_FIJOS','Suplentes Fijos',2,'Categoría de empleados','A1:D7','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('employment_category','EVENTUALES','Eventuales',3,'Categoría de empleados','A1:D7','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('employment_category','BASE','Base',4,'Categoría de empleados','A1:D7','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('employment_category','JUBILADOS_PENSIONADOS','Jubilados y Pens.',5,'Categoría de empleados','A1:D7','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('employment_category','CONFIANZA','Confianza',6,'Categoría de empleados','A1:D7','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('gender','MASCULINO','Masculino',1,'Genero','A1:A3','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('gender','FEMENINO','Femenino',2,'Genero','A1:A3','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('tag','ESTADO_CIVIL','Estado civil',1,'Etiquetas usuarios','A1:B22','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('tag','PROFESION','Profesión',2,'Etiquetas usuarios','A1:B22','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('tag','CATEGORIA_EMPLEADO','Categoría de empleado',3,'Etiquetas usuarios','A1:B22','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('tag','CELEBRACIONES','Celebraciones',4,'Etiquetas usuarios','A1:B22','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('tag','PENDIENTES_ADMINISTRATIVOS','Pendientes administrativos',5,'Etiquetas usuarios','A1:B22','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('tag','CIUDAD','CIUDAD',6,'Etiquetas usuarios','A1:B22','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6'),
('tag','DEPORTE','Deporte',7,'Etiquetas usuarios','A1:B22','9D89B62F37DAF805ACB42D4B03D044669E16B9B3D1CABCE1B3420CE9AB4BECA6');

create table public.screen_access_policies (
  screen_id text primary key,
  access_mode text not null default 'public' check(access_mode in('public','guest','registered','segment')),
  union_codes text[] not null default '{}', employment_category_codes text[] not null default '{}', gender_codes text[] not null default '{}', tag_codes text[] not null default '{}',
  hide_navigation boolean not null default true, message text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.company_audience_rules (
  company_id uuid primary key references public.companies(id) on delete cascade,
  audience_mode text not null default 'all' check(audience_mode in('all','registered','segment')),
  union_codes text[] not null default '{}', employment_category_codes text[] not null default '{}', gender_codes text[] not null default '{}', tag_codes text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.affiliate_segment_tags (
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  catalog_type text not null default 'tag' check(catalog_type='tag'),
  tag_code text not null,
  created_at timestamptz not null default now(),
  primary key(affiliate_id,tag_code),
  foreign key(catalog_type,tag_code) references public.segmentation_catalog_entries(catalog_type,code)
);

create function public.matches_current_affiliate_audience(p_mode text,p_unions text[],p_categories text[],p_genders text[],p_tags text[])
returns boolean language sql stable security definer set search_path=''
as $$ select case
  when p_mode in('all','public') then true when p_mode='guest' then auth.uid() is null
  when auth.uid() is null then false
  when p_mode='registered' then exists(select 1 from public.affiliates where auth_user_id=auth.uid())
  else exists(select 1 from public.affiliates a where a.auth_user_id=auth.uid()
    and (cardinality(p_unions)=0 or exists(select 1 from public.segmentation_catalog_entries c where c.catalog_type='union' and c.code=any(p_unions) and (lower(btrim(c.label))=lower(btrim(coalesce(a.affiliation_raw,''))) or lower(btrim(c.label))=lower(btrim(coalesce(a.union_position_raw,''))))))
    and (cardinality(p_categories)=0 or exists(select 1 from public.segmentation_catalog_entries c where c.catalog_type='employment_category' and c.code=any(p_categories) and lower(btrim(c.label))=lower(btrim(coalesce(a.employment_level_raw,'')))))
    and (cardinality(p_genders)=0 or exists(select 1 from public.segmentation_catalog_entries c where c.catalog_type='gender' and c.code=any(p_genders) and lower(btrim(c.label))=lower(btrim(coalesce(a.gender_raw,'')))))
    and (cardinality(p_tags)=0 or exists(select 1 from public.affiliate_segment_tags t where t.affiliate_id=a.id and t.tag_code=any(p_tags)))) end $$;
create function public.can_access_app_screen(p_screen_id text) returns boolean language sql stable security definer set search_path=''
as $$ select coalesce((select public.matches_current_affiliate_audience(access_mode,union_codes,employment_category_codes,gender_codes,tag_codes) from public.screen_access_policies where screen_id=p_screen_id),true) $$;
create function public.can_view_company(p_company_id uuid) returns boolean language sql stable security definer set search_path=''
as $$ select coalesce((select public.matches_current_affiliate_audience(audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes) from public.company_audience_rules where company_id=p_company_id),true) $$;

drop policy companies_public_read on public.companies;
create policy companies_public_read on public.companies for select to anon,authenticated using(enabled and public.can_view_company(id));

create table public.finance_catalog_presentation (
  item_key text primary key, group_key text not null,
  label_override text null, description_override text null,
  enabled boolean not null default true, sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.operational_workflows (
  id uuid primary key default extensions.gen_random_uuid(), name text not null, description text not null default '',
  workflow_type text not null check(workflow_type in('request','agreement','service','procedure')),
  service_keys text[] not null default '{}', enabled boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.operational_workflow_stages (
  id uuid primary key default extensions.gen_random_uuid(), workflow_id uuid not null references public.operational_workflows(id) on delete cascade,
  name text not null, description text not null default '', responsible text not null default 'Sindicato', outcome text not null default 'process' check(outcome in('process','success','failure')),
  sla_days integer null check(sla_days is null or sla_days>=0), service_keys text[] not null default '{}', status_reference text null,
  captures_date boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.operational_request_tracking (
  request_id uuid primary key references public.program_requests(id) on delete cascade,
  workflow_id uuid not null references public.operational_workflows(id) on delete restrict,
  current_stage_id uuid null references public.operational_workflow_stages(id) on delete restrict,
  stage_dates jsonb not null default '{}' check(jsonb_typeof(stage_dates)='object'),
  updated_at timestamptz not null default now()
);

create table public.union_screen_content (
  screen_key text primary key check(screen_key in('categoria','antiguedad','jubilados','emergencias')),
  title text not null default '', description text not null default '', published boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.union_content_blocks (
  id uuid primary key default extensions.gen_random_uuid(), screen_key text not null check(screen_key in('categoria','antiguedad','jubilados','emergencias')),
  block_type text not null check(block_type in('text','image','document','link')), title text not null default '', body text not null default '', external_url text null,
  asset_id uuid null references public.app_assets(id) on delete restrict, published boolean not null default false, sort_order integer not null default 0,
  audience_mode text not null default 'all' check(audience_mode in('all','registered','segment')),
  union_codes text[] not null default '{}', employment_category_codes text[] not null default '{}', gender_codes text[] not null default '{}', tag_codes text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index segmentation_catalog_type_sort_idx on public.segmentation_catalog_entries(catalog_type,enabled,sort_order);
create index workflows_type_sort_idx on public.operational_workflows(workflow_type,enabled,sort_order);
create index workflow_stages_flow_sort_idx on public.operational_workflow_stages(workflow_id,sort_order);
create index union_blocks_screen_sort_idx on public.union_content_blocks(screen_key,published,sort_order);

do $$ declare t text; begin foreach t in array array['admin_roles','segmentation_catalog_entries','screen_access_policies','company_audience_rules','finance_catalog_presentation','operational_workflows','operational_workflow_stages','operational_request_tracking','union_screen_content','union_content_blocks'] loop execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_h0072_updated_at()',t,t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['admin_roles','admin_role_permissions','segmentation_catalog_entries','affiliate_segment_tags','screen_access_policies','company_audience_rules','finance_catalog_presentation','operational_workflows','operational_workflow_stages','operational_request_tracking','union_screen_content','union_content_blocks'] loop execute format('alter table public.%I enable row level security',t); execute format('alter table public.%I force row level security',t); execute format('revoke all on public.%I from public,anon,authenticated',t); end loop; end $$;

grant select on public.admin_roles,public.admin_role_permissions to authenticated;
create policy admin_roles_read on public.admin_roles for select to authenticated using(public.has_admin_permission('authorization.read'));
create policy admin_role_permissions_read on public.admin_role_permissions for select to authenticated using(public.has_admin_permission('authorization.read'));
drop policy admin_assignments_read_self on public.admin_assignments;
create policy admin_assignments_read on public.admin_assignments for select to authenticated using(auth_user_id=auth.uid() or public.has_admin_permission('authorization.read'));

grant select,insert,update,delete on public.segmentation_catalog_entries,public.affiliate_segment_tags,public.screen_access_policies,public.company_audience_rules,public.finance_catalog_presentation,public.operational_workflows,public.operational_workflow_stages,public.operational_request_tracking,public.union_screen_content,public.union_content_blocks to authenticated;
create policy segmentation_admin_read on public.segmentation_catalog_entries for select to authenticated using(public.has_admin_permission('segmentation.read'));
create policy segmentation_admin_write on public.segmentation_catalog_entries for all to authenticated using(public.has_admin_permission('segmentation.write')) with check(public.has_admin_permission('segmentation.write'));
create policy affiliate_tags_read on public.affiliate_segment_tags for select to authenticated using(public.has_admin_permission('segmentation.read'));
create policy affiliate_tags_write on public.affiliate_segment_tags for all to authenticated using(public.has_admin_permission('segmentation.write')) with check(public.has_admin_permission('segmentation.write'));
create policy screen_access_read on public.screen_access_policies for select to authenticated using(public.has_admin_permission('segmentation.read'));
create policy screen_access_write on public.screen_access_policies for all to authenticated using(public.has_admin_permission('segmentation.write')) with check(public.has_admin_permission('segmentation.write'));
create policy company_audience_read on public.company_audience_rules for select to authenticated using(public.has_admin_permission('segmentation.read'));
create policy company_audience_write on public.company_audience_rules for all to authenticated using(public.has_admin_permission('segmentation.write')) with check(public.has_admin_permission('segmentation.write'));
create policy finance_presentation_read on public.finance_catalog_presentation for select to authenticated using(public.has_admin_permission('workflow.read'));
create policy finance_presentation_write on public.finance_catalog_presentation for all to authenticated using(public.has_admin_permission('workflow.write')) with check(public.has_admin_permission('workflow.write'));
create policy workflows_read on public.operational_workflows for select to authenticated using(public.has_admin_permission('workflow.read'));
create policy workflows_write on public.operational_workflows for all to authenticated using(public.has_admin_permission('workflow.write')) with check(public.has_admin_permission('workflow.write'));
create policy workflow_stages_read on public.operational_workflow_stages for select to authenticated using(public.has_admin_permission('workflow.read'));
create policy workflow_stages_write on public.operational_workflow_stages for all to authenticated using(public.has_admin_permission('workflow.write')) with check(public.has_admin_permission('workflow.write'));
create policy tracking_read on public.operational_request_tracking for select to authenticated using(public.has_admin_permission('workflow.read'));
create policy tracking_write on public.operational_request_tracking for all to authenticated using(public.has_admin_permission('workflow.write')) with check(public.has_admin_permission('workflow.write'));
create policy union_screen_public on public.union_screen_content for select to anon,authenticated using(published or public.has_admin_permission('union_content.read'));
create policy union_screen_admin on public.union_screen_content for all to authenticated using(public.has_admin_permission('union_content.write')) with check(public.has_admin_permission('union_content.write'));
create policy union_blocks_public on public.union_content_blocks for select to anon,authenticated using(published and public.matches_current_affiliate_audience(audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes) or public.has_admin_permission('union_content.read'));
create policy union_blocks_admin on public.union_content_blocks for all to authenticated using(public.has_admin_permission('union_content.write')) with check(public.has_admin_permission('union_content.write'));

grant execute on function public.save_admin_role(uuid,text,text,text[]),public.delete_admin_role(uuid),public.assign_admin_role(uuid,uuid,boolean),public.can_access_app_screen(text),public.can_view_company(uuid) to authenticated;
grant execute on function public.can_access_app_screen(text),public.can_view_company(uuid) to anon;
revoke execute on function public.save_admin_role(uuid,text,text,text[]),public.delete_admin_role(uuid),public.assign_admin_role(uuid,uuid,boolean) from public,anon;

do $$ declare t text; begin foreach t in array array['admin_roles','admin_role_permissions','segmentation_catalog_entries','affiliate_segment_tags','screen_access_policies','company_audience_rules','finance_catalog_presentation','operational_workflows','operational_workflow_stages','operational_request_tracking','union_screen_content','union_content_blocks'] loop execute format('create trigger %I_admin_audit after insert or update or delete on public.%I for each row execute function public.audit_admin_write()',t,t); end loop; end $$;

comment on table public.segmentation_catalog_entries is 'Approved non-financial audience taxonomy; never grants technical permissions.';
comment on table public.finance_catalog_presentation is 'Non-financial presentation metadata only; no rates, balances, deposits, eligibility, amortization, payments, calculations or reconciliation.';
comment on table public.operational_workflows is 'Non-financial administrative workflow definitions only.';
comment on table public.union_screen_content is 'Empty-by-default authority for the four remaining Tu Sindicato screens; screen structure remains Claude code.';
commit;
