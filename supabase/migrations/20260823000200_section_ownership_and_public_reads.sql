-- Master remediation wave 1.
-- 1) Section ownership as a reusable, backend-enforced capability (never global admin).
-- 2) Administrable ordering strategy per content section.
-- 3) Public read for non-financial presentation/workflow metadata already consumed
--    by user screens (previously admin-only, so the frontend never reflected Admin).
-- Reversible: supabase/recovery/20260823000200_section_ownership_and_public_reads.sql

begin;

-- Technical-admin probe without section ownership (breaks policy recursion).
create or replace function public.is_technical_admin(required_permission text)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select exists(
    select 1 from public.admin_assignments a
    join public.admin_roles r on r.id=a.role_id and r.enabled
    join public.admin_role_permissions rp on rp.role_id=r.id
    where a.auth_user_id=(select auth.uid()) and a.enabled and rp.permission=required_permission)
$fn$;

-- Catalogo de secciones administrables.
create table if not exists public.section_definitions (
  section_key text primary key,
  label text not null,
  domain text not null,
  read_permission text not null,
  write_permission text not null,
  sort_strategy text not null default 'manual'
    check (sort_strategy in ('manual','date_desc','date_asc','alpha_asc','alpha_desc')),
  supports_ownership boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.section_definitions (section_key,label,domain,read_permission,write_permission,sort_order) values
  ('noticias','Noticias del sindicato','news','news.read','news.write',1),
  ('educacion','Educacion','content','content.read','content.write',2),
  ('tutoriales','Tutoriales de la app','content','content.read','content.write',3),
  ('banners','Banners','banners','banners.read','banners.write',4),
  ('popups','Pop-ups','popups','popups.read','popups.write',5),
  ('convenios','Convenios y beneficios','companies','companies.read','companies.write',6),
  ('empresas','Empresas','companies','companies.read','companies.write',7),
  ('documentos','Documentos y PDF','documents','documents.read','documents.write',8),
  ('sindicato','Tu Sindicato','union_content','union_content.read','union_content.write',9),
  ('marketplace','Marketplace','marketplace','marketplace.read','marketplace.write',10),
  ('membresias','Membresias','memberships','memberships.read','memberships.write',11),
  ('planes','Planes de empresas','company_portal','company_portal.read','company_portal.write',12),
  ('fincat','Catalogo de Finanzas','workflow','workflow.read','workflow.write',13),
  ('flujos','Etapas y seguimiento','workflow','workflow.read','workflow.write',14),
  ('catalogos','Catalogos de segmentacion','segmentation','segmentation.read','segmentation.write',15)
on conflict (section_key) do nothing;

-- Responsables de seccion.
create table if not exists public.section_owners (
  id uuid primary key default gen_random_uuid(),
  section_key text not null references public.section_definitions(section_key) on delete cascade,
  email text not null,
  display_name text,
  auth_user_id uuid,
  can_create boolean not null default true,
  can_edit boolean not null default true,
  can_delete boolean not null default false,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists section_owners_unique
  on public.section_owners (section_key, lower(btrim(email)));
create index if not exists section_owners_auth_idx on public.section_owners (auth_user_id);

-- La identidad efectiva de un responsable es su cuenta Auth: el correo por si solo
-- nunca autoriza. Se resuelve contra el email verificado de la sesion.
create or replace function public.current_section_permissions()
returns table(permission text) language sql stable security definer set search_path to '' as $fn$
  select d.read_permission from public.section_owners o
    join public.section_definitions d on d.section_key=o.section_key
   where o.enabled
     and (o.auth_user_id=(select auth.uid())
          or lower(btrim(o.email))=lower(btrim(coalesce((select u.email from auth.users u where u.id=(select auth.uid()) and u.email_confirmed_at is not null),''))))
  union
  select d.write_permission from public.section_owners o
    join public.section_definitions d on d.section_key=o.section_key
   where o.enabled and (o.can_create or o.can_edit or o.can_delete)
     and (o.auth_user_id=(select auth.uid())
          or lower(btrim(o.email))=lower(btrim(coalesce((select u.email from auth.users u where u.id=(select auth.uid()) and u.email_confirmed_at is not null),''))))
$fn$;

create or replace function public.has_admin_permission(required_permission text)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select public.is_technical_admin(required_permission)
      or exists(select 1 from public.current_section_permissions() p where p.permission=required_permission)
$fn$;

alter table public.section_definitions enable row level security;
alter table public.section_definitions force row level security;
alter table public.section_owners enable row level security;
alter table public.section_owners force row level security;

drop policy if exists section_definitions_read on public.section_definitions;
create policy section_definitions_read on public.section_definitions for select using (true);
drop policy if exists section_definitions_write on public.section_definitions;
create policy section_definitions_write on public.section_definitions for all
  using (public.is_technical_admin('content.write')) with check (public.is_technical_admin('content.write'));

drop policy if exists section_owners_admin_read on public.section_owners;
create policy section_owners_admin_read on public.section_owners for select
  using (public.is_technical_admin('authorization.read') or auth_user_id=(select auth.uid()));
drop policy if exists section_owners_admin_write on public.section_owners;
create policy section_owners_admin_write on public.section_owners for all
  using (public.is_technical_admin('authorization.write')) with check (public.is_technical_admin('authorization.write'));

-- Lecturas publicas que el frontend ya necesitaba para reflejar al Admin.
drop policy if exists finance_presentation_public_read on public.finance_catalog_presentation;
create policy finance_presentation_public_read on public.finance_catalog_presentation for select using (true);

drop policy if exists workflows_public_read on public.operational_workflows;
create policy workflows_public_read on public.operational_workflows for select using (enabled);

drop policy if exists workflow_stages_public_read on public.operational_workflow_stages;
create policy workflow_stages_public_read on public.operational_workflow_stages for select
  using (exists(select 1 from public.operational_workflows w where w.id=workflow_id and w.enabled));

drop policy if exists tracking_owner_read on public.operational_request_tracking;
create policy tracking_owner_read on public.operational_request_tracking for select
  using (exists(select 1 from public.program_requests r
                 where r.id=operational_request_tracking.request_id
                   and r.affiliate_id=public.get_effective_affiliate_id()));

grant execute on function public.is_technical_admin(text) to anon, authenticated;
grant execute on function public.current_section_permissions() to anon, authenticated;

commit;
