-- Focused remaining checks; prior successful CRUD matrix is not repeated.
create function pg_temp.assert_vote(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'CHECK_FAILED:%',label;end if;end $$;
do $$declare actor uuid;target uuid;denied boolean;sid uuid;begin
 select a.auth_user_id into actor from public.admin_assignments a join public.admin_roles r on r.id=a.role_id where a.enabled and r.code='principal_admin' limit 1;
 select id into target from public.affiliates where auth_user_id is distinct from actor and not is_archived limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id','b8774513-8085-48cf-95fb-145a181bb323')::text,true);
 perform public.start_affiliate_impersonation(target,'Verificación transaccional de bloqueo de voto');
 perform pg_temp.assert_vote(exists(select 1 from public.get_impersonation_context()),'impersonation_is_real');
 denied:=false;begin perform public.cast_voting_vote(extensions.gen_random_uuid(),extensions.gen_random_uuid(),'si');exception when insufficient_privilege then denied:=sqlerrm='VOTING_IMPERSONATION_DENIED';end;
 perform pg_temp.assert_vote(denied,'impersonation_vote_denied');
 perform public.stop_affiliate_impersonation();
 perform pg_temp.assert_vote((select count(*)=3 from pg_class where oid in ('public.voting_votes'::regclass,'public.voting_questions'::regclass,'public.voting_consultations'::regclass) and relrowsecurity and relforcerowsecurity),'forced_rls');
 perform pg_temp.assert_vote(exists(select 1 from pg_constraint where conrelid='public.voting_votes'::regclass and contype='u' and pg_get_constraintdef(oid)='UNIQUE (affiliate_id, consultation_id, question_id)' and not condeferrable),'immediate_unique_race_invariant');
 perform pg_temp.assert_vote(position('for share' in pg_get_functiondef('public.cast_voting_vote(uuid,uuid,text)'::regprocedure))>0,'concurrent_voters_shared_lock');
end $$;
select 'PASS' status,'real impersonation denied; forced RLS; immediate unique index and shared lock enforce concurrent voting invariant' checks;
