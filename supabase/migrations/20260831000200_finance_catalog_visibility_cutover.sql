begin;

-- The finance catalog presentation is global configuration for signed-in users.
-- Writers remain protected by the existing workflow.write policy.
drop policy if exists finance_presentation_authenticated_read
  on public.finance_catalog_presentation;

create policy finance_presentation_authenticated_read
  on public.finance_catalog_presentation
  for select
  to authenticated
  using (true);

commit;
