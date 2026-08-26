-- Recovery for 20260823000200. Restores the previous authorization surface.
begin;
drop policy if exists tracking_owner_read on public.operational_request_tracking;
drop policy if exists workflow_stages_public_read on public.operational_workflow_stages;
drop policy if exists workflows_public_read on public.operational_workflows;
drop policy if exists finance_presentation_public_read on public.finance_catalog_presentation;

create or replace function public.has_admin_permission(required_permission text)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select exists(
    select 1 from public.admin_assignments a
    join public.admin_roles r on r.id=a.role_id and r.enabled
    join public.admin_role_permissions rp on rp.role_id=r.id
    where a.auth_user_id=(select auth.uid()) and a.enabled and rp.permission=required_permission)
$fn$;

drop policy if exists section_owners_admin_write on public.section_owners;
drop policy if exists section_owners_admin_read on public.section_owners;
drop policy if exists section_definitions_write on public.section_definitions;
drop policy if exists section_definitions_read on public.section_definitions;
drop function if exists public.current_section_permissions();
drop table if exists public.section_owners;
drop table if exists public.section_definitions;
drop function if exists public.is_technical_admin(text);
commit;
