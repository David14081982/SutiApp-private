begin;

-- Restore the exact effective authorization boundary that preceded
-- 20260823000300: broad H-008 RLS policies, but no table-level DELETE grant
-- after H-009 for these resources.

revoke delete on public.companies, public.banners, public.popups, public.institutional_documents from authenticated;

drop policy if exists companies_admin_insert on public.companies;
drop policy if exists companies_admin_update on public.companies;
drop policy if exists companies_admin_delete on public.companies;
create policy companies_admin_all on public.companies
  for all to authenticated
  using (public.has_admin_permission('companies.write'))
  with check (public.has_admin_permission('companies.write'));

drop policy if exists banners_admin_insert on public.banners;
drop policy if exists banners_admin_update on public.banners;
drop policy if exists banners_admin_delete on public.banners;
create policy banners_admin_all on public.banners
  for all to authenticated
  using (public.has_admin_permission('banners.write'))
  with check (public.has_admin_permission('banners.write'));

drop policy if exists popups_admin_insert on public.popups;
drop policy if exists popups_admin_update on public.popups;
drop policy if exists popups_admin_delete on public.popups;
create policy popups_admin_all on public.popups
  for all to authenticated
  using (public.has_admin_permission('popups.write'))
  with check (public.has_admin_permission('popups.write'));

drop policy if exists institutional_documents_admin_delete on public.institutional_documents;
create policy institutional_documents_admin_delete on public.institutional_documents
  for delete to authenticated
  using (public.has_admin_permission('documents.write'));

commit;
