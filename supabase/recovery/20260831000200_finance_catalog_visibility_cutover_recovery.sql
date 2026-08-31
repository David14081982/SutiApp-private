begin;

drop policy if exists finance_presentation_authenticated_read
  on public.finance_catalog_presentation;

commit;
