begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

-- H-SUTIAPP-CONVENIOS-ANUNCIOS-001. Baseline = restore point ads_restore_private.*_20260917 / tag restore/pre-anuncios-segmentados-20260917.
do $guard$ begin
 if (select pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.banners'::regclass and polname='banners_public_read') is distinct from '(enabled = true)' then
  raise exception 'ADS_BASELINE_CHANGED:banners_public_read';
 end if;
 if md5(pg_get_functiondef('public.matches_current_affiliate_audience(text,text[],text[],text[],text[])'::regprocedure)) is distinct from '2ea77e2fe87d8ebab261ca2dd938bb01' then
  raise exception 'ADS_BASELINE_CHANGED:matches_current_affiliate_audience';
 end if;
 if md5(pg_get_functiondef('public.is_banner_archived(uuid)'::regprocedure)) is distinct from 'f441b934abc50438ff9b16cd3bb957ae' then
  raise exception 'ADS_BASELINE_CHANGED:is_banner_archived';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='banners' and column_name in ('audience_mode','union_codes','employment_category_codes','gender_codes','tag_codes','accent_hue')) then
  raise exception 'ADS_ALREADY_APPLIED';
 end if;
end $guard$;

-- Same audience model as company_benefits, evaluated by the existing engine matches_current_affiliate_audience.
-- Existing rows become audience "all" with no accent: Home and archived banners keep their behavior.
alter table public.banners
 add column audience_mode text not null default 'all',
 add column union_codes text[] not null default '{}',
 add column employment_category_codes text[] not null default '{}',
 add column gender_codes text[] not null default '{}',
 add column tag_codes text[] not null default '{}',
 add column accent_hue integer;
alter table public.banners add constraint banners_audience_mode_check check (audience_mode in ('all','registered','segment'));
alter table public.banners add constraint banners_accent_hue_check check (accent_hue is null or accent_hue between 0 and 360);

-- Admin writers use column-level grants (same pattern as the existing editable banner columns).
grant insert (audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes,accent_hue),
      update (audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes,accent_hue)
 on public.banners to authenticated;

-- Direct reads outside the admin policies only return banners addressed to the current user.
drop policy banners_public_read on public.banners;
create policy banners_public_read on public.banners for select to anon, authenticated
 using (enabled = true and public.matches_current_affiliate_audience(audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes));

-- Public carousels: the audience applies to every viewer, administrators included, so each person sees what their profile allows.
create function public.list_public_banners(p_placement text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_placement is null or p_placement not in ('home','marketplace') then raise exception 'INVALID_BANNER_PLACEMENT' using errcode='22023'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object(
   'id',b.id,'placement',b.placement,'title',b.title,'description',b.description,'action_label',b.action_label,'action_url',b.action_url,
   'company_raw',b.company_raw,'category_raw',b.category_raw,'sort_order',b.sort_order,'accent_hue',b.accent_hue,
   'image_asset',case when a.id is null then null else jsonb_build_object('id',a.id,'asset_key',a.asset_key,'storage_bucket',a.storage_bucket,'storage_path',a.storage_path,'mime_type',a.mime_type,'alt_text',a.alt_text,'status',a.status) end
  ) order by b.sort_order,b.id),'[]'::jsonb)
  from public.banners b left join public.app_assets a on a.id=b.image_asset_id
  where b.placement=p_placement and b.enabled and not public.is_banner_archived(b.id)
   and public.matches_current_affiliate_audience(b.audience_mode,b.union_codes,b.employment_category_codes,b.gender_codes,b.tag_codes));
end $$;
revoke all on function public.list_public_banners(text) from public;
grant execute on function public.list_public_banners(text) to anon, authenticated;

notify pgrst,'reload schema';
commit;
