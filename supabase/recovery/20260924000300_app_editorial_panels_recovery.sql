-- BEFORE USE ONLY. After an edit/submission, preserve versions and responses;
-- repair forward. This is not a general-purpose rollback after publication.
begin;
set local lock_timeout='2s';set local statement_timeout='60s';
lock table public.app_editorial_screens,public.app_editorial_revisions,public.app_editorial_submissions in access exclusive mode;
do $recover$ declare r record;begin
 if exists(select 1 from public.app_editorial_submissions) or exists(select 1 from public.app_editorial_revisions where version<>1 or actor_auth_user_id is not null)
 or (select count(*) from public.app_editorial_revisions)<>(select count(*) from public.app_editorial_screens)
 or exists(select 1 from public.app_editorial_revisions rev join public.app_editorial_screens s using(screen_id) where rev.nodes<>s.nodes)
 or (select md5(jsonb_agg(to_jsonb(s) order by screen_id)::text) from public.app_editorial_screens s) is distinct from (select value from public.app_editorial_installation_20260924000300 where key='screens')
 or (select md5(jsonb_agg(to_jsonb(rev) order by screen_id,version)::text) from public.app_editorial_revisions rev) is distinct from (select value from public.app_editorial_installation_20260924000300 where key='revisions')
 then raise exception 'RECOVERY_BLOCKED_EDITORIAL_USE';end if;
 for r in select * from public.app_editorial_installation_20260924000300 where key not in('screens','revisions','schema') loop
  if md5(pg_get_functiondef(r.key::regprocedure)||coalesce((select proacl::text from pg_proc where oid=r.key::regprocedure),'')) is distinct from r.value then raise exception 'RECOVERY_BLOCKED_EDITORIAL_FUNCTION_DRIFT';end if;
 end loop;
 if public.app_editorial_schema_fingerprint() is distinct from (select value from public.app_editorial_installation_20260924000300 where key='schema') then raise exception 'RECOVERY_BLOCKED_EDITORIAL_SCHEMA_DRIFT';end if;
end $recover$;
drop function public.submit_app_editorial_form(uuid,text,bigint,text,jsonb);
drop function public.save_app_editorial(text,bigint,jsonb);
drop function public.get_app_editorial(text,boolean);
drop function public.list_app_editorial_screens();
drop function public.list_app_editorial_segments();
drop function public.validate_editorial_nodes(text,jsonb);
drop function public.editorial_audience_matches(jsonb);
drop table public.app_editorial_submissions;
drop table public.app_editorial_revisions;
drop table public.app_editorial_screens;
drop function public.can_read_editorial_admin();
drop function public.can_edit_editorial(text);
drop function public.editorial_module(text);
drop function public.app_editorial_schema_fingerprint();
drop table public.app_editorial_installation_20260924000300;
commit;
