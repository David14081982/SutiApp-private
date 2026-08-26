begin;
drop policy company_profiles_read on public.company_benefit_profiles;
create policy company_profiles_read on public.company_benefit_profiles for select to anon,authenticated using(
  (exists(select 1 from public.companies c where c.id=company_id and c.enabled) and public.can_view_company(company_id))
  or public.has_admin_permission('companies.read'));
drop policy company_benefits_read on public.company_benefits;
create policy company_benefits_read on public.company_benefits for select to anon,authenticated using(
  (enabled and exists(select 1 from public.companies c where c.id=company_id and c.enabled) and public.can_view_company(company_id)
    and public.matches_current_affiliate_audience(audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes))
  or public.has_admin_permission('companies.read'));
drop policy union_blocks_public on public.union_content_blocks;
create policy union_blocks_public on public.union_content_blocks for select to anon,authenticated using(
  (published and exists(select 1 from public.union_screen_content s where s.screen_key=union_content_blocks.screen_key and s.published)
    and public.matches_current_affiliate_audience(audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes))
  or public.has_admin_permission('union_content.read'));
commit;
