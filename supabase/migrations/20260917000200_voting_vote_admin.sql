begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

-- H-SUTIAPP-VOTACIONES-VER-003. Admin «VER»: list the votes of a consultation and delete one vote or every vote of a person.
-- Additive: two new RPCs and a narrow gate in the immutability trigger. Updates to a vote stay forbidden, and a delete
-- only passes inside delete_voting_votes. By product decision these deletions are not written to admin_audit_log.
do $guard$ begin
 if to_regprocedure('public.list_voting_votes(uuid)') is not null or to_regprocedure('public.delete_voting_votes(uuid,uuid,uuid)') is not null then raise exception 'VOTING_VER_ALREADY_APPLIED'; end if;
 if to_regclass('public.voting_live_state') is null or to_regprocedure('public.voting_live_touch(uuid)') is null then raise exception 'VOTING_VER_REQUIRES_LIVE'; end if;
 if pg_get_functiondef('public.voting_immutable_vote()'::regprocedure) not like '%VOTE_IS_FINAL%' then raise exception 'VOTING_VER_BASELINE_CHANGED'; end if;
end $guard$;

-- create or replace keeps the trigger binding and the function ACL.
create or replace function public.voting_immutable_vote() returns trigger language plpgsql set search_path='' as $$
begin
 -- The transaction-local gate is opened only by delete_voting_votes (browsers have no table privileges on voting_votes).
 if tg_op='DELETE' and current_setting('suti.voting_delete_votes',true)='on' then return old; end if;
 raise exception 'VOTE_IS_FINAL' using errcode='42501';
end $$;

create function public.list_voting_votes(p_consultation uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.voting_consultations%rowtype; result jsonb;
begin
 -- Seeing who voted what is the same grant as the nominal export.
 if not public.voting_can('read') or not public.voting_can('export_identified_votes') then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 select * into c from public.voting_consultations where id=p_consultation and archived_at is null;
 if c.id is null then raise exception 'VOTING_UNAVAILABLE' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'folio',v.folio,'cast_at',v.cast_at,'answer',v.answer,'affiliate_id',v.affiliate_id,
   'question_id',q.id,'question_title',q.title,'question_number',n.qnum,'question_archived',q.archived_at is not null,
   'name',v.identity_snapshot->>'name','numero_control',v.identity_snapshot->>'numero_control','email',v.identity_snapshot->>'email')
   order by v.cast_at desc,v.id),'[]') into result
 from public.voting_votes v
 join public.voting_questions q on q.id=v.question_id
 left join lateral (select count(*)+1 qnum from public.voting_questions x where x.consultation_id=c.id and x.archived_at is null
  and (x.sort_order<q.sort_order or (x.sort_order=q.sort_order and x.id<q.id))) n on q.archived_at is null
 where v.consultation_id=c.id;
 return jsonb_build_object('consultation_id',c.id,'votes',result,'can_delete',public.voting_can('delete'));
end $$;

create function public.delete_voting_votes(p_consultation uuid,p_vote uuid default null,p_affiliate uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare c public.voting_consultations%rowtype; n integer;
begin
 if not public.voting_can('read') or not public.voting_can('export_identified_votes') or not public.voting_can('delete') then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 -- Exactly one target: a single vote, or every vote of one person in this consultation.
 if (p_vote is null)=(p_affiliate is null) then raise exception 'INVALID_VOTE_TARGET'; end if;
 -- Exclusive lock waits for votes in flight on this consultation.
 select * into c from public.voting_consultations where id=p_consultation and archived_at is null for update;
 if c.id is null then raise exception 'VOTING_UNAVAILABLE' using errcode='42501'; end if;
 perform set_config('suti.voting_delete_votes','on',true);
 delete from public.voting_votes v where v.consultation_id=c.id and (v.id=p_vote or v.affiliate_id=p_affiliate);
 get diagnostics n=row_count;
 perform set_config('suti.voting_delete_votes','off',true);
 -- Signals Admin, the big screen and affiliates: the deleted questions show as pending again.
 if n>0 then perform public.voting_live_touch(c.id); end if;
 return n;
end $$;

revoke all on function public.list_voting_votes(uuid),public.delete_voting_votes(uuid,uuid,uuid) from public,anon;
grant execute on function public.list_voting_votes(uuid),public.delete_voting_votes(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
