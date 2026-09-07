-- H03: revalidate the existing authority and fingerprint visible content.
-- INVOKER is deliberate: fingerprints must respect the same RLS as list reads.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
create function public.get_admin_refresh_context()
returns jsonb language plpgsql stable security invoker set search_path=''
as $function$
declare
  context jsonb := public.get_admin_access_context();
  versions jsonb := '{}'::jsonb;
begin
  if context->>'role_code' is not null
     or coalesce((context->>'full_access')::boolean,false)
     or jsonb_array_length(coalesce(context->'section_actions','[]'::jsonb))>0 then
    with marks(domain,mark) as (
      select domain,'' from unnest(array['roles','segments','access','companies','profiles','rules','banners']) domain
      union all select 'roles','r:'||r.ctid::text||':'||r.xmin::text from public.admin_roles r
      union all select 'roles','p:'||r.ctid::text||':'||r.xmin::text from public.admin_role_permissions r
      union all select 'segments',r.ctid::text||':'||r.xmin::text from public.segmentation_catalog_entries r
      union all select 'access',r.ctid::text||':'||r.xmin::text from public.screen_access_policies r
      union all select 'companies','c:'||r.ctid::text||':'||r.xmin::text from public.companies r
      union all select 'companies','l:'||r.ctid::text||':'||r.xmin::text from public.company_assets r
        where r.company_id in (select id from public.companies)
      union all select 'companies','a:'||r.ctid::text||':'||r.xmin::text from public.app_assets r
        where r.id in (select logo_asset_id from public.companies
          union select a.asset_id from public.company_assets a where a.company_id in (select id from public.companies))
      union all select 'profiles','p:'||r.ctid::text||':'||r.xmin::text from public.company_benefit_profiles r
      union all select 'profiles','b:'||r.ctid::text||':'||r.xmin::text from public.company_benefits r
      union all select 'rules',r.ctid::text||':'||r.xmin::text from public.company_audience_rules r
      union all select 'banners','b:'||r.ctid::text||':'||r.xmin::text from public.banners r
      union all select 'banners','a:'||r.ctid::text||':'||r.xmin::text from public.app_assets r
        where r.id in (select image_asset_id from public.banners)
    ), fingerprints as (
      select domain,md5(string_agg(mark,',' order by mark)) value from marks group by domain
    ) select jsonb_object_agg(domain,value) into versions from fingerprints;
  end if;
  return context || jsonb_build_object(
    'content_versions',versions,
    'actor_auth_user_id',auth.uid(),
    'actor_session_id',auth.jwt()->>'session_id'
  );
end;
$function$;
revoke all on function public.get_admin_refresh_context() from public,anon;
grant execute on function public.get_admin_refresh_context() to authenticated,service_role;
comment on function public.get_admin_refresh_context() is
  'H03: delegates security to get_admin_access_context; ephemeral RLS-visible MVCC fingerprints, never authorization or persisted business versions.';
commit;
