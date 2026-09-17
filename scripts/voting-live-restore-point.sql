-- Restore point before H-SUTIAPP-VOTACIONES-LIVE-002 (Votación en vivo).
-- Private, browser-inaccessible copy of every voting row and the exact voting functions in production.
-- Pairs with git tag restore/pre-votacion-en-vivo-20260916 (commit b74ddbb). Additive; touches no business table.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create schema voting_restore_private;
revoke all on schema voting_restore_private from public,anon,authenticated,service_role;

create table voting_restore_private.consultations_20260916 as table public.voting_consultations;
create table voting_restore_private.questions_20260916 as table public.voting_questions;
create table voting_restore_private.votes_20260916 as table public.voting_votes;
create table voting_restore_private.functions_20260916(signature text primary key,definition text not null,acl text,md5 text not null);
insert into voting_restore_private.functions_20260916(signature,definition,acl,md5)
 select p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proacl::text,md5(pg_get_functiondef(p.oid))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('voting_can','voting_audience_matches','voting_question_result','list_voting_consultations','voting_immutable_vote','cast_voting_vote','save_voting_consultation','voting_consultation_action','export_voting_consultation');
create table voting_restore_private.manifest_20260916(
 created_at timestamptz not null default clock_timestamp(),
 git_tag text not null,base_commit text not null,
 counts jsonb not null,row_hashes jsonb not null,constraints jsonb not null,functions jsonb not null
);
insert into voting_restore_private.manifest_20260916(git_tag,base_commit,counts,row_hashes,constraints,functions)
select 'restore/pre-votacion-en-vivo-20260916','b74ddbb0412823efd44c1e1f7fca2d349e2fb526',
 jsonb_build_object('consultations',(select count(*) from public.voting_consultations),'questions',(select count(*) from public.voting_questions),'votes',(select count(*) from public.voting_votes)),
 jsonb_build_object(
  'consultations',(select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_consultations t),
  'questions',(select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_questions t),
  'votes',(select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_votes t)),
 (select jsonb_object_agg(conname,pg_get_constraintdef(oid)) from pg_constraint where conrelid in ('public.voting_consultations'::regclass,'public.voting_questions'::regclass,'public.voting_votes'::regclass)),
 (select jsonb_object_agg(signature,md5) from voting_restore_private.functions_20260916);

do $harden$ declare t text; begin
 foreach t in array array['consultations_20260916','questions_20260916','votes_20260916','functions_20260916','manifest_20260916'] loop
  execute format('alter table voting_restore_private.%I enable row level security',t);
  execute format('alter table voting_restore_private.%I force row level security',t);
  execute format('revoke all on voting_restore_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $harden$;

do $check$ begin
 if (select count(*) from voting_restore_private.functions_20260916)<>9 then raise exception 'RESTORE_POINT_FUNCTIONS_INCOMPLETE'; end if;
 if (select count(*) from voting_restore_private.votes_20260916)<>(select count(*) from public.voting_votes) then raise exception 'RESTORE_POINT_VOTES_MISMATCH'; end if;
end $check$;
select 'PASS' status,(select counts from voting_restore_private.manifest_20260916) counts,(select row_hashes from voting_restore_private.manifest_20260916) row_hashes,(select functions from voting_restore_private.manifest_20260916) functions,(select constraints from voting_restore_private.manifest_20260916) constraints;
commit;
