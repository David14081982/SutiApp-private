begin;
do $$ begin
  if exists(select 1 from public.admin_roles where code<>'principal_admin')
    or exists(select 1 from public.screen_access_policies)
    or exists(select 1 from public.company_audience_rules)
    or exists(select 1 from public.finance_catalog_presentation)
    or exists(select 1 from public.operational_workflows)
    or exists(select 1 from public.operational_request_tracking)
    or exists(select 1 from public.union_screen_content)
    or exists(select 1 from public.union_content_blocks)
  then raise exception 'RECOVERY_REFUSED: productive Admin cutover data exists'; end if;
end $$;
drop policy if exists companies_public_read on public.companies;
create policy companies_public_read on public.companies for select to anon,authenticated using(enabled);
drop function if exists public.assign_admin_role(uuid,uuid,boolean);
drop function if exists public.delete_admin_role(uuid);
drop function if exists public.save_admin_role(uuid,text,text,text[]);
drop function if exists public.can_access_app_screen(text);
drop function if exists public.can_view_company(uuid);
drop function if exists public.matches_current_affiliate_audience(text,text[],text[],text[],text[]);
drop table public.union_content_blocks,public.union_screen_content,public.operational_request_tracking,public.operational_workflow_stages,public.operational_workflows,public.finance_catalog_presentation,public.company_audience_rules,public.screen_access_policies,public.affiliate_segment_tags,public.segmentation_catalog_entries,public.admin_role_permissions cascade;
alter table public.admin_assignments drop column role_id;
drop table public.admin_roles cascade;
drop policy if exists admin_assignments_read on public.admin_assignments;
create policy admin_assignments_read_self on public.admin_assignments for select to authenticated using(auth_user_id=auth.uid());
update public.admin_assignments set permissions=array(select p from unnest(permissions) p where p not in(
  'authorization.read','authorization.write','segmentation.read','segmentation.write',
  'workflow.read','workflow.write','union_content.read','union_content.write'));
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write'
]::text[]);
-- Restore prior permission function and exact legacy permission projection.
create or replace function public.has_admin_permission(required_permission text)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.admin_assignments a where a.auth_user_id=auth.uid() and a.enabled and required_permission=any(a.permissions)) $$;
commit;
