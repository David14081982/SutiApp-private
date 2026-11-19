-- Restore point before H-SUTIAPP-VOTACIONES-CONSULTAS-004 («Votaciones y consultas»).
-- Private, browser-inaccessible copy of every voting row, the live state, the menu name and the exact voting functions.
-- Pairs with git tag restore/pre-votaciones-consultas-20261119 (commit eefd9e2). Additive: only creates tables inside the
-- existing private schema voting_restore_private; touches no business table.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $guard$ begin
 if to_regnamespace('voting_restore_private') is null then raise exception 'RESTORE_SCHEMA_MISSING'; end if;
 if to_regclass('voting_restore_private.manifest_20261119') is not null then raise exception 'RESTORE_POINT_ALREADY_EXISTS'; end if;
end $guard$;

create table voting_restore_private.consultations_20261119 as table public.voting_consultations;
create table voting_restore_private.questions_20261119 as table public.voting_questions;
create table voting_restore_private.votes_20261119 as table public.voting_votes;
create table voting_restore_private.live_state_20261119 as table public.voting_live_state;
create table voting_restore_private.section_definitions_20261119 as select * from public.admin_section_definitions where section_key like '%votacion%';
create table voting_restore_private.functions_20261119(signature text primary key,definition text not null,acl text,md5 text not null);
insert into voting_restore_private.functions_20261119(signature,definition,acl,md5)
 select p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proacl::text,md5(pg_get_functiondef(p.oid))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%voting%';
create table voting_restore_private.manifest_20261119(
 created_at timestamptz not null default clock_timestamp(),
 git_tag text not null,base_commit text not null,
 counts jsonb not null,row_hashes jsonb not null,constraints jsonb not null,columns jsonb not null,functions jsonb not null
);
insert into voting_restore_private.manifest_20261119(git_tag,base_commit,counts,row_hashes,constraints,columns,functions)
select 'restore/pre-votaciones-consultas-20261119','eefd9e267dc72d8bbc5b84f18d726a7d0c39f2c7',
 jsonb_build_object('consultations',(select count(*) from public.voting_consultations),'questions',(select count(*) from public.voting_questions),'votes',(select count(*) from public.voting_votes),'live_state',(select count(*) from public.voting_live_state)),
 jsonb_build_object(
  'consultations',(select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_consultations t),
  'questions',(select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_questions t),
  'votes',(select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_votes t),
  'live_state',(select md5(coalesce(string_agg(t::text,'|' order by t.consultation_id),'')) from public.voting_live_state t)),
 (select jsonb_object_agg(conrelid::regclass::text||'.'||conname,pg_get_constraintdef(oid)) from pg_constraint where conrelid in ('public.voting_consultations'::regclass,'public.voting_questions'::regclass,'public.voting_votes'::regclass,'public.voting_live_state'::regclass)),
 (select jsonb_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable order by table_name,ordinal_position) from information_schema.columns where table_schema='public' and table_name like 'voting\_%'),
 (select jsonb_object_agg(signature,md5) from voting_restore_private.functions_20261119);

do $harden$ declare t text; begin
 foreach t in array array['consultations_20261119','questions_20261119','votes_20261119','live_state_20261119','section_definitions_20261119','functions_20261119','manifest_20261119'] loop
  execute format('alter table voting_restore_private.%I enable row level security',t);
  execute format('alter table voting_restore_private.%I force row level security',t);
  execute format('revoke all on voting_restore_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $harden$;

do $check$ begin
 if (select count(*) from voting_restore_private.functions_20261119)<>17 then raise exception 'RESTORE_POINT_FUNCTIONS_INCOMPLETE'; end if;
 if (select count(*) from voting_restore_private.votes_20261119)<>(select count(*) from public.voting_votes) then raise exception 'RESTORE_POINT_VOTES_MISMATCH'; end if;
 if (select count(*) from voting_restore_private.questions_20261119)<>(select count(*) from public.voting_questions) then raise exception 'RESTORE_POINT_QUESTIONS_MISMATCH'; end if;
 if (select count(*) from voting_restore_private.consultations_20261119)<>(select count(*) from public.voting_consultations) then raise exception 'RESTORE_POINT_CONSULTATIONS_MISMATCH'; end if;
end $check$;
select 'PASS' status,(select counts from voting_restore_private.manifest_20261119) counts,(select row_hashes from voting_restore_private.manifest_20261119) row_hashes,(select functions from voting_restore_private.manifest_20261119) functions;
commit;
