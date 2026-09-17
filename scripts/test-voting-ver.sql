-- Runs after the forward migration inside a transaction that always rolls back (scripts/voting-ver-backend.js).
create function pg_temp.check_ver(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'CHECK_FAILED:%',label; end if; end $$;
create function pg_temp.as_user(uid uuid,session text) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','session_id',session)::text,true);
end $$;
create temporary table voting_ver_test(actor uuid,a uuid,normal uuid,b uuid);
insert into voting_ver_test(actor,a,normal,b)
 select aa.auth_user_id,a.id,b.auth_user_id,b.id from public.admin_assignments aa join public.admin_roles r on r.id=aa.role_id and r.code='principal_admin' join public.affiliates a on a.auth_user_id=aa.auth_user_id
 cross join lateral(select f.id,f.auth_user_id from public.affiliates f join auth.users u on u.id=f.auth_user_id where f.auth_user_id<>aa.auth_user_id and not f.is_archived and u.email_confirmed_at is not null and not exists(select 1 from public.admin_assignments x where x.auth_user_id=f.auth_user_id and x.enabled) limit 1) b
 where aa.enabled limit 1;
create temporary table voting_ver_checks(label text primary key);

do $$declare s record; cid uuid; other uuid; q1 uuid; q2 uuid; r jsonb; v jsonb; n integer; denied boolean; audit_before integer; touched timestamptz; normal_q1 uuid;
begin
 select * into s from voting_ver_test;
 perform pg_temp.check_ver(s.actor is not null and s.normal is not null,'test_principals');

 -- Grants: browsers reach the votes only through the RPCs.
 perform pg_temp.check_ver(has_function_privilege('authenticated','public.list_voting_votes(uuid)','EXECUTE') and has_function_privilege('authenticated','public.delete_voting_votes(uuid,uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.list_voting_votes(uuid)','EXECUTE') and not has_function_privilege('anon','public.delete_voting_votes(uuid,uuid,uuid)','EXECUTE'),'rpc_grants');
 perform pg_temp.check_ver(not has_table_privilege('authenticated','public.voting_votes','SELECT') and not has_table_privilege('authenticated','public.voting_votes','DELETE') and not has_table_privilege('anon','public.voting_votes','DELETE'),'votes_table_still_private');
 perform pg_temp.check_ver(not has_function_privilege('authenticated','public.voting_immutable_vote()','EXECUTE'),'trigger_function_private');
 insert into voting_ver_checks values('grants');

 -- Fixture: published consultation, two questions, admin and affiliate vote both.
 perform pg_temp.as_user(s.actor,'voting-ver-admin');
 cid:=public.save_voting_consultation(null,null,jsonb_build_object('title','ISOLATED VOTING VER TEST','closes_on','2099-12-31','published',true,
  'audience','{"mode":"all","unions":[],"categories":[],"positions":[],"emails":[]}'::jsonb,
  'questions',jsonb_build_array(jsonb_build_object('title','Pregunta uno','detail',''),jsonb_build_object('title','Pregunta dos','detail',''))));
 other:=public.save_voting_consultation(null,null,jsonb_build_object('title','ISOLATED VOTING VER OTHER','closes_on','2099-12-31','published',false,
  'audience','{"mode":"all","unions":[],"categories":[],"positions":[],"emails":[]}'::jsonb,'questions','[]'::jsonb));
 select id into q1 from public.voting_questions where consultation_id=cid and sort_order=0;
 select id into q2 from public.voting_questions where consultation_id=cid and sort_order=1;
 perform public.set_voting_active_question(cid,q1);
 perform public.cast_voting_vote(cid,q1,'si');
 perform pg_temp.as_user(s.normal,'voting-ver-normal');
 perform public.cast_voting_vote(cid,q1,'no');
 perform pg_temp.as_user(s.actor,'voting-ver-admin');
 perform public.set_voting_active_question(cid,q2);
 perform public.cast_voting_vote(cid,q2,'abs');
 perform pg_temp.as_user(s.normal,'voting-ver-normal');
 perform public.cast_voting_vote(cid,q2,'si');
 perform pg_temp.check_ver((select count(*) from public.voting_votes where consultation_id=cid)=4,'fixture_votes');

 -- Immutability outside the RPC is unchanged.
 denied:=false; begin update public.voting_votes set answer='abs' where consultation_id=cid; exception when insufficient_privilege then denied:=sqlerrm='VOTE_IS_FINAL'; end;
 perform pg_temp.check_ver(denied,'update_still_final');
 denied:=false; begin delete from public.voting_votes where consultation_id=cid; exception when insufficient_privilege then denied:=sqlerrm='VOTE_IS_FINAL'; end;
 perform pg_temp.check_ver(denied,'direct_delete_still_final');
 insert into voting_ver_checks values('immutability_outside_rpc');

 -- A plain affiliate cannot see or delete votes.
 denied:=false; begin perform public.list_voting_votes(cid); exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.check_ver(denied,'affiliate_cannot_list');
 denied:=false; begin perform public.delete_voting_votes(cid,null,s.b); exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.check_ver(denied,'affiliate_cannot_delete');
 perform pg_temp.check_ver((select count(*) from public.voting_votes where consultation_id=cid)=4,'affiliate_attempt_no_effect');
 insert into voting_ver_checks values('permissions');

 -- Admin sees every vote with identity and question number.
 perform pg_temp.as_user(s.actor,'voting-ver-admin');
 r:=public.list_voting_votes(cid);
 perform pg_temp.check_ver(jsonb_array_length(r->'votes')=4 and (r->>'can_delete')::boolean and r->>'consultation_id'=cid::text,'list_shape');
 perform pg_temp.check_ver(exists(select 1 from jsonb_array_elements(r->'votes') x where x->>'affiliate_id'=s.b::text and x->>'question_id'=q1::text and x->>'answer'='no'
  and (x->>'question_number')::integer=1 and x->>'question_title'='Pregunta uno' and x->>'folio' like 'V-%' and x ? 'name' and x ? 'numero_control' and x ? 'email' and not (x->>'question_archived')::boolean),'list_identity_and_number');
 perform pg_temp.check_ver(exists(select 1 from jsonb_array_elements(r->'votes') x where x->>'question_id'=q2::text and (x->>'question_number')::integer=2),'list_second_number');
 perform pg_temp.check_ver(jsonb_array_length(public.list_voting_votes(other)->'votes')=0,'list_scoped_to_consultation');
 denied:=false; begin perform public.list_voting_votes(extensions.gen_random_uuid()); exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.check_ver(denied,'list_unknown_consultation');
 insert into voting_ver_checks values('list');

 -- Invalid targets.
 denied:=false; begin perform public.delete_voting_votes(cid,null,null); exception when others then denied:=sqlerrm='INVALID_VOTE_TARGET'; end;
 perform pg_temp.check_ver(denied,'target_required');
 select id into normal_q1 from public.voting_votes where consultation_id=cid and question_id=q1 and affiliate_id=s.b;
 denied:=false; begin perform public.delete_voting_votes(cid,normal_q1,s.b); exception when others then denied:=sqlerrm='INVALID_VOTE_TARGET'; end;
 perform pg_temp.check_ver(denied,'single_target_only');
 -- A vote id from this consultation does nothing when sent with another consultation.
 perform pg_temp.check_ver(public.delete_voting_votes(other,normal_q1,null)=0 and exists(select 1 from public.voting_votes where id=normal_q1),'delete_scoped_to_consultation');
 insert into voting_ver_checks values('targets');

 -- Delete one vote: no audit row, live signal, gate closed afterwards.
 audit_before:=(select count(*) from public.admin_audit_log);
 touched:=(select changed_at from public.voting_live_state where consultation_id=cid);
 n:=public.delete_voting_votes(cid,normal_q1,null);
 perform pg_temp.check_ver(n=1 and not exists(select 1 from public.voting_votes where id=normal_q1) and (select count(*) from public.voting_votes where consultation_id=cid)=3,'delete_one_vote');
 perform pg_temp.check_ver((select count(*) from public.admin_audit_log)=audit_before,'delete_not_audited');
 perform pg_temp.check_ver((select changed_at from public.voting_live_state where consultation_id=cid)>touched and (select active_question_id from public.voting_live_state where consultation_id=cid)=q2,'delete_signals_live_keeps_on_air');
 perform pg_temp.check_ver(coalesce(current_setting('suti.voting_delete_votes',true),'')<>'on','gate_closed_after_rpc');
 denied:=false; begin delete from public.voting_votes where consultation_id=cid; exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.check_ver(denied,'direct_delete_final_after_rpc');
 perform pg_temp.check_ver(public.delete_voting_votes(cid,normal_q1,null)=0,'delete_again_is_noop');
 insert into voting_ver_checks values('delete_one');

 -- The affiliate sees the question pending again and can vote it once more.
 perform public.set_voting_active_question(cid,q1);
 perform pg_temp.as_user(s.normal,'voting-ver-normal');
 r:=public.list_voting_consultations(false);
 perform pg_temp.check_ver(exists(select 1 from jsonb_array_elements(r->'consultations') c,jsonb_array_elements(c->'questions') q where c->>'id'=cid::text and q->>'id'=q1::text and q->'mine'='null'::jsonb),'question_pending_again');
 v:=public.cast_voting_vote(cid,q1,'si');
 perform pg_temp.check_ver(v->>'answer'='si','revote_after_delete');
 denied:=false; begin perform public.cast_voting_vote(cid,q1,'no'); exception when unique_violation then denied:=true; end;
 perform pg_temp.check_ver(denied,'revote_still_single');
 insert into voting_ver_checks values('revote');

 -- Delete every vote of one person: the other person's votes stay.
 perform pg_temp.as_user(s.actor,'voting-ver-admin');
 n:=public.delete_voting_votes(cid,null,s.a);
 perform pg_temp.check_ver(n=2 and not exists(select 1 from public.voting_votes where consultation_id=cid and affiliate_id=s.a),'delete_person_votes');
 perform pg_temp.check_ver((select count(*) from public.voting_votes where consultation_id=cid and affiliate_id=s.b)=2,'other_person_untouched');
 r:=public.list_voting_votes(cid);
 perform pg_temp.check_ver(jsonb_array_length(r->'votes')=2 and not exists(select 1 from jsonb_array_elements(r->'votes') x where x->>'affiliate_id'=s.a::text),'list_after_person_delete');
 perform pg_temp.check_ver(public.delete_voting_votes(cid,null,s.a)=0,'delete_person_again_is_noop');
 insert into voting_ver_checks values('delete_person');

 -- A question that still has votes keeps its text locked.
 perform pg_temp.check_ver(exists(select 1 from jsonb_array_elements(public.list_voting_consultations(true)->'consultations') c,jsonb_array_elements(c->'questions') q where c->>'id'=cid::text and q->>'id'=q1::text and (q->>'locked')::boolean),'question_with_votes_locked');
 insert into voting_ver_checks values('consistency');
end $$;
