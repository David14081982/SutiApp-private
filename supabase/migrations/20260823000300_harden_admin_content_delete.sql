begin;

-- H-MASTER-REM-001 / DELETE_STANDARD
-- Preserve imported history while enabling the Admin CRUD to remove only rows
-- whose authoritative origin is the Admin console.

drop policy if exists companies_admin_all on public.companies;
create policy companies_admin_insert on public.companies
  for insert to authenticated
  with check (public.has_admin_permission('companies.write') and record_origin = 'ADMIN_H009');
create policy companies_admin_update on public.companies
  for update to authenticated
  using (public.has_admin_permission('companies.write'))
  with check (public.has_admin_permission('companies.write'));
create policy companies_admin_delete on public.companies
  for delete to authenticated
  using (public.has_admin_permission('companies.write') and record_origin = 'ADMIN_H009');

drop policy if exists banners_admin_all on public.banners;
create policy banners_admin_insert on public.banners
  for insert to authenticated
  with check (public.has_admin_permission('banners.write') and record_origin = 'ADMIN_H009');
create policy banners_admin_update on public.banners
  for update to authenticated
  using (public.has_admin_permission('banners.write'))
  with check (public.has_admin_permission('banners.write'));
create policy banners_admin_delete on public.banners
  for delete to authenticated
  using (public.has_admin_permission('banners.write') and record_origin = 'ADMIN_H009');

drop policy if exists popups_admin_all on public.popups;
create policy popups_admin_insert on public.popups
  for insert to authenticated
  with check (public.has_admin_permission('popups.write') and record_origin = 'ADMIN_H009');
create policy popups_admin_update on public.popups
  for update to authenticated
  using (public.has_admin_permission('popups.write'))
  with check (public.has_admin_permission('popups.write'));
create policy popups_admin_delete on public.popups
  for delete to authenticated
  using (public.has_admin_permission('popups.write') and record_origin = 'ADMIN_H009');

drop policy if exists institutional_documents_admin_delete on public.institutional_documents;
create policy institutional_documents_admin_delete on public.institutional_documents
  for delete to authenticated
  using (public.has_admin_permission('documents.write') and record_origin = 'ADMIN_H009');

grant delete on public.companies, public.banners, public.popups, public.institutional_documents to authenticated;

commit;
