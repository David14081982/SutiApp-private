-- Restore point before H-SUTIAPP-CONVENIOS-ANUNCIOS-001 (banners audience + accent hue + public reader RPC).
-- Private, browser-inaccessible copy of every banner row, its policies and column grants. Touches no business table.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create schema ads_restore_private;
revoke all on schema ads_restore_private from public,anon,authenticated,service_role;
create table ads_restore_private.banners_20260917 as table public.banners;
create table ads_restore_private.banner_deletions_20260917 as table public.banner_deletions;
create table ads_restore_private.manifest_20260917 as
select clock_timestamp() created_at,'restore/pre-anuncios-segmentados-20260917'::text git_tag,
 (select count(*) from public.banners) banners,(select count(*) from public.banner_deletions) deletions,
 (select md5(string_agg(t::text,'|' order by t.id)) from public.banners t) banners_hash,
 (select jsonb_object_agg(polname,jsonb_build_object('cmd',polcmd,'permissive',polpermissive,'roles',polroles::regrole[]::text,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid))) from pg_policy where polrelid='public.banners'::regclass) policies,
 (select jsonb_agg(column_name||':'||privilege_type order by column_name,privilege_type) from information_schema.column_privileges where table_schema='public' and table_name='banners' and grantee='authenticated') column_grants,
 (select jsonb_object_agg(conname,pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.banners'::regclass) constraints,
 md5(pg_get_functiondef('public.matches_current_affiliate_audience(text,text[],text[],text[],text[])'::regprocedure)) audience_md5;
do $harden$ declare t text; begin
 foreach t in array array['banners_20260917','banner_deletions_20260917','manifest_20260917'] loop
  execute format('alter table ads_restore_private.%I enable row level security',t);
  execute format('alter table ads_restore_private.%I force row level security',t);
  execute format('revoke all on ads_restore_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $harden$;
select 'PASS' status,m.banners,m.deletions,m.banners_hash,m.policies,m.column_grants,m.constraints,m.audience_md5 from ads_restore_private.manifest_20260917 m;
commit;
