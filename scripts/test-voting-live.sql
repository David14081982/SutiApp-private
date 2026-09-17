-- Runs after the forward migration inside a transaction that always rolls back (scripts/voting-live-backend.js).
create function pg_temp.check_live(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'CHECK_FAILED:%',label; end if; end $$;
create function pg_temp.as_user(uid uuid,session text) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','session_id',session)::text,true);
end $$;
create temporary table voting_live_test(actor uuid,a uuid,normal uuid,b uuid,actor_email text);
insert into voting_live_test(actor,a,normal,b,actor_email)
 select aa.auth_user_id,a.id,b.auth_user_id,b.id,lower(btrim(a.historical_email_raw)) from public.admin_assignments aa join public.admin_roles r on r.id=aa.role_id and r.code='principal_admin' join public.affiliates a on a.auth_user_id=aa.auth_user_id
 cross join lateral(select f.id,f.auth_user_id from public.affiliates f join auth.users u on u.id=f.auth_user_id where f.auth_user_id<>aa.auth_user_id and not f.is_archived and u.email_confirmed_at is not null and not exists(select 1 from public.admin_assignments x where x.auth_user_id=f.auth_user_id and x.enabled) limit 1) b
 where aa.enabled limit 1;
create temporary table voting_live_checks(label text primary key);

do $$declare s record; all_n integer; reg_n integer; cid uuid; q1 uuid; q2 uuid; q3 uuid; payload jsonb; r jsonb; v jsonb; live jsonb; denied boolean; n integer; ver integer; copy_id uuid; empty_id uuid; empty_q uuid;
begin
 select * into s from voting_live_test;
 perform pg_temp.check_live(s.actor is not null and s.normal is not null and s.actor_email is not null,'test_principals');

 -- Schema, grants and backfill.
 perform pg_temp.check_live((select count(*) from public.voting_live_state)=(select count(*) from public.voting_consultations),'live_state_backfill');
 perform pg_temp.check_live(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='voting_live_state'),'realtime_publication');
 perform pg_temp.check_live((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.voting_live_state'::regclass),'live_state_forced_rls');
 perform pg_temp.check_live(has_table_privilege('authenticated','public.voting_live_state','SELECT') and not has_table_privilege('authenticated','public.voting_live_state','INSERT') and not has_table_privilege('authenticated','public.voting_live_state','UPDATE') and not has_table_privilege('authenticated','public.voting_live_state','DELETE') and not has_table_privilege('anon','public.voting_live_state','SELECT'),'live_state_browser_read_only');
 perform pg_temp.check_live(not has_function_privilege('authenticated','public.voting_electorate(jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.voting_live_touch(uuid)','EXECUTE') and not has_function_privilege('anon','public.voting_electorate(jsonb)','EXECUTE'),'private_helpers');
 perform pg_temp.check_live(has_function_privilege('authenticated','public.set_voting_active_question(uuid,uuid)','EXECUTE') and has_function_privilege('authenticated','public.get_voting_live(uuid)','EXECUTE') and has_function_privilege('authenticated','public.count_voting_electorate(jsonb)','EXECUTE')
  and not has_function_privilege('anon','public.set_voting_active_question(uuid,uuid)','EXECUTE') and not has_function_privilege('anon','public.get_voting_live(uuid)','EXECUTE') and not has_function_privilege('anon','public.count_voting_electorate(jsonb)','EXECUTE'),'rpc_grants');
 perform pg_temp.check_live(not has_table_privilege('authenticated','public.voting_votes','SELECT') and not has_table_privilege('authenticated','public.voting_consultations','SELECT'),'business_tables_still_private');
 insert into voting_live_checks values('schema_grants_backfill');

 -- Automatic total of voters in every mode.
 all_n:=(select count(*) from public.affiliates where not is_archived);
 reg_n:=(select count(*) from public.affiliates where not is_archived and auth_user_id is not null);
 perform pg_temp.check_live(public.voting_electorate('{"mode":"all","unions":[],"categories":[],"positions":[],"emails":[]}')=all_n,'electorate_all_roster');
 perform pg_temp.check_live(public.voting_electorate('{"mode":"registered","unions":[],"categories":[],"positions":[],"emails":[]}')=reg_n,'electorate_registered_accounts');
 perform pg_temp.check_live(public.voting_electorate('{"mode":"emails","unions":[],"categories":[],"positions":[],"emails":["uno@example.invalid"," UNO@example.invalid","dos@example.invalid"]}')=2,'electorate_email_list');
 perform pg_temp.check_live(public.voting_electorate('{"mode":"emails","unions":[],"categories":[],"positions":[],"emails":[]}')=0,'electorate_empty_list');
 perform pg_temp.check_live(public.voting_electorate('{"mode":"segment","unions":[],"categories":[],"positions":[],"emails":[]}')=all_n,'electorate_segment_without_filters');
 perform pg_temp.check_live(public.voting_electorate('{"mode":"segment","unions":["NONEXISTENT"],"categories":[],"positions":[],"emails":[]}')=0,'electorate_segment_filtered');
 perform pg_temp.check_live(public.voting_electorate(jsonb_build_object('mode','segment','unions','[]'::jsonb,'categories','[]'::jsonb,'positions',jsonb_build_array(p.pos),'emails','[]'::jsonb))=p.cnt,'electorate_segment_position_whole_roster')
  from (select btrim(union_position_raw) pos,count(*)::integer cnt from public.affiliates where not is_archived and nullif(btrim(union_position_raw),'') is not null group by 1 order by 2 desc limit 1) p;
 perform pg_temp.check_live(public.voting_electorate(jsonb_build_object('mode','segment','unions',jsonb_build_array(u.code),'categories','[]'::jsonb,'positions','[]'::jsonb,'emails','[]'::jsonb))=u.cnt,'electorate_segment_union_whole_roster')
  from (select financial_union_code code,count(*)::integer cnt from public.affiliates where not is_archived and financial_union_code is not null group by 1 order by 2 desc limit 1) u;
 insert into voting_live_checks values('electorate_modes');

 -- Admin creates a published consultation; nothing is on air yet.
 perform pg_temp.as_user(s.actor,'voting-live-admin');
 perform pg_temp.check_live(public.get_effective_affiliate_id()=s.a,'admin_affiliate_identity');
 payload:=jsonb_build_object('title','ISOLATED LIVE VOTING TEST','closes_on','2099-12-31','electorate',99999,'published',true,
  'audience','{"mode":"all","unions":[],"categories":[],"positions":[],"emails":[]}'::jsonb,
  'questions',jsonb_build_array(jsonb_build_object('title','Pregunta uno','detail','Detalle uno'),jsonb_build_object('title','Pregunta dos','detail',''),jsonb_build_object('title','Pregunta tres','detail','')));
 cid:=public.save_voting_consultation(null,null,payload);
 select id into q1 from public.voting_questions where consultation_id=cid and sort_order=0;
 select id into q2 from public.voting_questions where consultation_id=cid and sort_order=1;
 select id into q3 from public.voting_questions where consultation_id=cid and sort_order=2;
 perform pg_temp.check_live((select electorate from public.voting_consultations where id=cid)=all_n,'save_ignores_manual_electorate');
 perform pg_temp.check_live(exists(select 1 from public.voting_live_state where consultation_id=cid and active_question_id is null and last_question_id is null),'new_consultation_off_air');
 r:=public.list_voting_consultations(true);
 select x into live from jsonb_array_elements(r->'consultations') x where x->>'id'=cid::text;
 perform pg_temp.check_live((live->>'electorate')::integer=all_n and live->'active_question_id'='null'::jsonb and jsonb_array_length(live->'questions')=3
  and not exists(select 1 from jsonb_array_elements(live->'questions') q where (q->>'active')::boolean) and (live#>'{questions,0,results}') is not null,'admin_list_live_fields');
 r:=public.list_voting_consultations(false);
 select x into live from jsonb_array_elements(r->'consultations') x where x->>'id'=cid::text;
 perform pg_temp.check_live(live is not null and (live->>'electorate')::integer=all_n and jsonb_array_length(live->'questions')=3
  and not exists(select 1 from jsonb_array_elements(live->'questions') q where (q->'results') is not null or q->'title'<>'null'::jsonb or q->'detail'<>'null'::jsonb),'affiliate_no_results_no_off_air_text');
 denied:=false; begin perform public.cast_voting_vote(cid,q1,'si'); exception when insufficient_privilege then denied:=sqlerrm='QUESTION_NOT_ACTIVE'; end;
 perform pg_temp.check_live(denied,'vote_requires_question_on_air');
 insert into voting_live_checks values('off_air_contract');

 -- A plain affiliate cannot control or watch the live screen.
 perform pg_temp.as_user(s.normal,'voting-live-normal');
 perform pg_temp.check_live(public.get_effective_affiliate_id()=s.b,'normal_affiliate_identity');
 denied:=false; begin perform public.set_voting_active_question(cid,q1); exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.check_live(denied,'affiliate_cannot_activate');
 denied:=false; begin perform public.get_voting_live(cid); exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.check_live(denied,'affiliate_cannot_open_live_screen');
 denied:=false; begin perform public.count_voting_electorate('{"mode":"all"}'); exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.check_live(denied,'affiliate_cannot_preview_electorate');
 insert into voting_live_checks values('control_permissions');

 -- Question 1 on air.
 perform pg_temp.as_user(s.actor,'voting-live-admin');
 v:=public.set_voting_active_question(cid,q1);
 perform pg_temp.check_live(v->>'active_question_id'=q1::text and v->>'last_question_id'=q1::text,'activate_first_question');
 r:=public.list_voting_consultations(false);
 select x into live from jsonb_array_elements(r->'consultations') x where x->>'id'=cid::text;
 perform pg_temp.check_live(live->>'active_question_id'=q1::text
  and exists(select 1 from jsonb_array_elements(live->'questions') q where q->>'id'=q1::text and q->>'title'='Pregunta uno' and q->>'detail'='Detalle uno' and (q->>'active')::boolean)
  and exists(select 1 from jsonb_array_elements(live->'questions') q where q->>'id'=q2::text and q->'title'='null'::jsonb and not (q->>'active')::boolean),'affiliate_receives_only_on_air_text');
 live:=public.get_voting_live(cid);
 perform pg_temp.check_live((live->>'active')::boolean and live#>>'{question,id}'=q1::text and (live#>>'{question,number}')::integer=1 and (live#>>'{question,results,total}')::integer=0
  and (live->>'electorate')::integer=all_n and (live->>'question_count')::integer=3 and live#>>'{question,title}'='Pregunta uno','live_screen_on_air');
 v:=public.cast_voting_vote(cid,q1,'si');
 perform pg_temp.check_live(v->>'answer'='si' and length(v->>'folio')>30 and (v->'results') is null,'vote_receipt_without_results');
 denied:=false; begin perform public.cast_voting_vote(cid,q1,'no'); exception when unique_violation then denied:=true; end;
 perform pg_temp.check_live(denied,'duplicate_vote_denied');
 denied:=false; begin update public.voting_votes set answer='no' where question_id=q1; exception when insufficient_privilege then denied:=true; end;
 perform pg_temp.check_live(denied,'vote_immutable');
 r:=public.list_voting_consultations(false);
 select x into live from jsonb_array_elements(r->'consultations') x where x->>'id'=cid::text;
 perform pg_temp.check_live(exists(select 1 from jsonb_array_elements(live->'questions') q where q->>'id'=q1::text and q->'mine'<>'null'::jsonb and (q->'results') is null),'voted_question_marked_without_results');
 insert into voting_live_checks values('first_question_on_air');

 -- Only one question on air; switching closes the previous one; re-activation reopens it for pending voters.
 v:=public.set_voting_active_question(cid,q2);
 perform pg_temp.check_live((select active_question_id from public.voting_live_state where consultation_id=cid)=q2 and (select last_question_id from public.voting_live_state where consultation_id=cid)=q2,'single_question_on_air');
 perform pg_temp.as_user(s.normal,'voting-live-normal');
 denied:=false; begin perform public.cast_voting_vote(cid,q1,'no'); exception when insufficient_privilege then denied:=sqlerrm='QUESTION_NOT_ACTIVE'; end;
 perform pg_temp.check_live(denied,'switched_question_closed');
 v:=public.cast_voting_vote(cid,q2,'no');
 perform pg_temp.check_live(v->>'answer'='no','affiliate_votes_question_on_air');
 r:=public.list_voting_consultations(false);
 select x into live from jsonb_array_elements(r->'consultations') x where x->>'id'=cid::text;
 perform pg_temp.check_live(exists(select 1 from jsonb_array_elements(live->'questions') q where q->>'id'=q1::text and q->'mine'='null'::jsonb)
  and exists(select 1 from jsonb_array_elements(live->'questions') q where q->>'id'=q2::text and q->'mine'<>'null'::jsonb)
  and not exists(select 1 from jsonb_array_elements(live->'questions') q where (q->'results') is not null),'cross_affiliate_privacy');
 perform pg_temp.as_user(s.actor,'voting-live-admin');
 v:=public.set_voting_active_question(cid,q1);
 perform pg_temp.as_user(s.normal,'voting-live-normal');
 v:=public.cast_voting_vote(cid,q1,'abs');
 perform pg_temp.check_live(v->>'answer'='abs','reactivated_question_accepts_pending_voter');
 perform pg_temp.as_user(s.normal,'voting-live-second-device');
 denied:=false; begin perform public.cast_voting_vote(cid,q1,'si'); exception when unique_violation then denied:=true; end;
 perform pg_temp.check_live(denied,'second_device_denied');
 insert into voting_live_checks values('switch_and_reactivate');

 -- Off air between questions: big screen keeps the last question with its final count.
 perform pg_temp.as_user(s.actor,'voting-live-admin');
 v:=public.set_voting_active_question(cid,null);
 perform pg_temp.check_live(v->'active_question_id'='null'::jsonb and v->>'last_question_id'=q1::text,'deactivate_keeps_last_question');
 live:=public.get_voting_live(cid);
 perform pg_temp.check_live(not (live->>'active')::boolean and live#>>'{question,id}'=q1::text and (live#>>'{question,results,total}')::integer=2
  and (live#>>'{question,results,si}')::integer=1 and (live#>>'{question,results,abs}')::integer=1
  and (live#>>'{question,results,participation}')::numeric=round(200.0/all_n,1),'live_screen_between_questions');
 denied:=false; begin perform public.cast_voting_vote(cid,q3,'si'); exception when insufficient_privilege then denied:=sqlerrm='QUESTION_NOT_ACTIVE'; end;
 perform pg_temp.check_live(denied,'nothing_on_air_vote_denied');
 perform pg_temp.check_live(exists(select 1 from public.admin_audit_log where resource='voting' and action='ACTIVATE_QUESTION' and target_id=cid::text and details->>'question_id'=q2::text)
  and exists(select 1 from public.admin_audit_log where resource='voting' and action='DEACTIVATE_QUESTION' and target_id=cid::text and details->>'previous_question_id'=q1::text),'audit_on_air_changes');
 insert into voting_live_checks values('between_questions');

 -- Read-only module admin: may watch the live screen, may not put questions on air.
 begin
  update public.admin_assignments set role_id=(select id from public.admin_roles where code='module_admin') where auth_user_id=s.normal;
  if not found then insert into public.admin_assignments(auth_user_id,role,permissions,role_id,enabled) values(s.normal,'visual_admin','{}',(select id from public.admin_roles where code='module_admin'),true); end if;
  insert into public.admin_section_responsibilities(auth_user_id,section_key,action,granted_by_auth_user_id) values(s.normal,'admin_votaciones','read',s.actor);
  perform pg_temp.as_user(s.normal,'voting-live-module');
  perform pg_temp.check_live((public.get_voting_live(cid)#>>'{question,id}')=q1::text,'module_reader_watches_live_screen');
  denied:=false; begin perform public.set_voting_active_question(cid,q2); exception when insufficient_privilege then denied:=true; end;
  perform pg_temp.check_live(denied,'module_reader_cannot_put_on_air');
  raise exception 'REVERT_SCOPED_FIXTURE';
 exception when others then if sqlerrm<>'REVERT_SCOPED_FIXTURE' then raise; end if;
 end;
 insert into voting_live_checks values('module_admin_scope');

 -- Realtime authorization: the browser role reads the signal row only inside the audience (or as voting admin).
 perform pg_temp.as_user(s.normal,'voting-live-normal');
 execute 'set local role authenticated';
 n:=(select count(*) from public.voting_live_state where consultation_id=cid);
 execute 'reset role';
 perform pg_temp.check_live(n=1,'rls_audience_member_reads_signal');
 perform pg_temp.as_user(s.actor,'voting-live-admin');
 ver:=(select version from public.voting_consultations where id=cid);
 payload:=jsonb_build_object('title','ISOLATED LIVE VOTING TEST','closes_on','2099-12-31','published',true,
  'audience',jsonb_build_object('mode','emails','unions','[]'::jsonb,'categories','[]'::jsonb,'positions','[]'::jsonb,'emails',jsonb_build_array(upper(s.actor_email))),
  'questions',jsonb_build_array(jsonb_build_object('id',q1,'title','Pregunta uno','detail','Detalle uno'),jsonb_build_object('id',q2,'title','Pregunta dos','detail',''),jsonb_build_object('id',q3,'title','Pregunta tres','detail','')));
 perform public.save_voting_consultation(cid,ver,payload);
 perform pg_temp.check_live((select electorate from public.voting_consultations where id=cid)=1 and (public.list_voting_consultations(true)->'consultations') @> jsonb_build_array(jsonb_build_object('id',cid,'electorate',1)),'email_list_total_is_list_length');
 perform pg_temp.as_user(s.normal,'voting-live-normal');
 execute 'set local role authenticated';
 n:=(select count(*) from public.voting_live_state where consultation_id=cid);
 execute 'reset role';
 perform pg_temp.check_live(n=0,'rls_outsider_cannot_read_signal');
 perform pg_temp.check_live(not ((public.list_voting_consultations(false)->'consultations') @> jsonb_build_array(jsonb_build_object('id',cid))),'outsider_does_not_list_consultation');
 perform pg_temp.as_user(s.actor,'voting-live-admin');
 execute 'set local role authenticated';
 n:=(select count(*) from public.voting_live_state where consultation_id=cid);
 execute 'reset role';
 perform pg_temp.check_live(n=1,'rls_voting_admin_reads_signal');
 r:=public.export_voting_consultation(cid,false);
 perform pg_temp.check_live((r#>>'{0,Participación %}')::numeric=200.0 and (r#>>'{0,Total}')::integer=2,'export_uses_derived_total');
 perform pg_temp.check_live(public.count_voting_electorate('{"mode":"emails","unions":[],"categories":[],"positions":[],"emails":["a@example.invalid","b@example.invalid"]}')=2,'preview_counts_draft_audience');
 denied:=false; begin perform public.count_voting_electorate('{"mode":"otro"}'); exception when others then denied:=sqlerrm='INVALID_AUDIENCE'; end;
 perform pg_temp.check_live(denied,'preview_validates_audience');
 insert into voting_live_checks values('realtime_rls_and_totals');

 -- Hidden, archived and removed questions leave the air; history survives.
 v:=public.set_voting_active_question(cid,q2);
 ver:=(select version from public.voting_consultations where id=cid);
 perform public.voting_consultation_action(cid,ver,'hide');
 denied:=false; begin perform public.cast_voting_vote(cid,q2,'si'); exception when insufficient_privilege then denied:=sqlerrm='VOTING_UNAVAILABLE'; end;
 perform pg_temp.check_live(denied,'hidden_consultation_vote_denied');
 v:=public.set_voting_active_question(cid,q3);
 ver:=(select version from public.voting_consultations where id=cid);
 payload:=jsonb_set(jsonb_set(payload,'{published}','false'::jsonb),'{questions}',jsonb_build_array(jsonb_build_object('id',q1,'title','Pregunta uno','detail','Detalle uno'),jsonb_build_object('id',q2,'title','Pregunta dos','detail','')));
 perform public.save_voting_consultation(cid,ver,payload);
 perform pg_temp.check_live((select active_question_id is null and last_question_id is null from public.voting_live_state where consultation_id=cid),'removed_question_leaves_air');
 perform pg_temp.check_live(public.get_voting_live(cid)->'question'='null'::jsonb,'live_screen_waits_after_removal');
 ver:=(select version from public.voting_consultations where id=cid);
 copy_id:=public.voting_consultation_action(cid,ver,'duplicate');
 perform pg_temp.check_live(exists(select 1 from public.voting_live_state where consultation_id=copy_id and active_question_id is null) and (select electorate from public.voting_consultations where id=copy_id)=1 and not (select published from public.voting_consultations where id=copy_id),'duplicate_starts_off_air');
 v:=public.set_voting_active_question(cid,q1);
 ver:=(select version from public.voting_consultations where id=cid);
 perform public.voting_consultation_action(cid,ver,'archive');
 perform pg_temp.check_live((select active_question_id is null from public.voting_live_state where consultation_id=cid),'archive_takes_off_air');
 perform pg_temp.check_live((select count(*) from public.voting_votes where consultation_id=cid)=3,'votes_history_preserved');
 insert into voting_live_checks values('hide_remove_duplicate_archive');

 -- An empty audience has a total of 0 and never divides by zero.
 empty_id:=public.save_voting_consultation(null,null,jsonb_build_object('title','ISOLATED EMPTY AUDIENCE','closes_on','2099-12-31','published',false,
  'audience','{"mode":"emails","unions":[],"categories":[],"positions":[],"emails":[]}'::jsonb,'questions',jsonb_build_array(jsonb_build_object('title','Sin audiencia','detail',''))));
 select id into empty_q from public.voting_questions where consultation_id=empty_id;
 perform public.set_voting_active_question(empty_id,empty_q);
 live:=public.get_voting_live(empty_id);
 perform pg_temp.check_live((select electorate from public.voting_consultations where id=empty_id)=0 and (live->>'electorate')::integer=0 and (live#>>'{question,results,participation}')::numeric=0,'zero_total_safe');
 perform pg_temp.check_live(jsonb_array_length(public.list_voting_consultations(true)->'consultations')>=1,'admin_list_with_zero_total');
 insert into voting_live_checks values('zero_total');
end $$;
select 'PASS' status,(select array_agg(label order by label) from voting_live_checks) groups;
