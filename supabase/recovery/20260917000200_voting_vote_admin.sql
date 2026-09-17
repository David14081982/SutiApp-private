begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- Recovery for 20260917000200_voting_vote_admin (H-SUTIAPP-VOTACIONES-VER-003).
-- Removes the «VER» RPCs and closes the delete gate again. Votes already deleted are not restored.
-- Run together with a frontend revert of the release commit.
drop function if exists public.delete_voting_votes(uuid,uuid,uuid);
drop function if exists public.list_voting_votes(uuid);
create or replace function public.voting_immutable_vote() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'VOTE_IS_FINAL' using errcode='42501'; end $$;
notify pgrst,'reload schema';
commit;
