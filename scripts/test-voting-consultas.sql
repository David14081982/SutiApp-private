-- H-SUTIAPP-VOTACIONES-CONSULTAS-004. Runs after the forward migration inside the transaction that always rolls back
-- (scripts/voting-consultas-backend.js). Fixtures live only inside that transaction.
do $$declare s record; cid uuid; cid2 uuid; copy_id uuid; q1 uuid; q2 uuid; q3 uuid; q4 uuid; p jsonb; r jsonb; it jsonb; v jsonb; v2 jsonb; e text; ver integer; vote_q1 uuid; vote_q4 uuid; vote_q3 uuid; n integer;
 aud constant jsonb:='{"mode":"all","unions":[],"categories":[],"positions":[],"emails":[]}';
 legacy constant jsonb:='[{"id":"si","label":"Sí"},{"id":"no","label":"No"},{"id":"abs","label":"Abstención"}]';
 custom constant jsonb:='[{"id":"si","label":"Asistiré"},{"id":"no","label":"No asistiré"},{"id":"o1","label":"Tal vez"}]';
begin
 select * into s from vc_who;

 -- 1. Schema, defaults and grants. Existing rows keep the original behavior.
 perform pg_temp.vc_check(not exists(select 1 from public.voting_consultations where presentation<>'{}'::jsonb or closes_on is null)
  and not exists(select 1 from public.voting_questions where answer_kind<>'options' or options is not null or not final)
  and not exists(select 1 from public.voting_votes where answer_text is not null or changed_at is not null),'existing_rows_default');
 perform pg_temp.vc_check((select fingerprint from vc_rows_before)=pg_temp.vc_rows(),'existing_rows_untouched_by_migration');
 perform pg_temp.vc_check(has_function_privilege('authenticated','public.cast_voting_answer(uuid,uuid,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.cast_voting_answer(uuid,uuid,text,text)','EXECUTE'),'cast_answer_grants');
 perform pg_temp.vc_check(not has_function_privilege('authenticated','public.voting_clean_options(text,jsonb)','EXECUTE') and not has_function_privilege('anon','public.voting_clean_options(text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.voting_clean_presentation(jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.voting_question_options(text,jsonb)','EXECUTE'),'private_helpers');
 perform pg_temp.vc_check(not has_table_privilege('authenticated','public.voting_votes','SELECT') and not has_table_privilege('authenticated','public.voting_consultations','SELECT')
  and not has_table_privilege('authenticated','public.voting_questions','SELECT') and not has_table_privilege('anon','public.voting_votes','SELECT'),'business_tables_still_private');
 perform pg_temp.vc_check(not exists(select 1 from vc_fn_before b join pg_proc p on p.oid=b.sig::regprocedure where p.proacl::text is distinct from b.acl),'existing_function_acls_kept');
 perform pg_temp.vc_check((select display_name from public.admin_section_definitions where section_key='admin_votaciones')='Votaciones y consultas'
  and (select display_name from public.admin_section_definitions where section_key='admin_votaciones_nominal')='Votaciones · votos identificados','menu_name');
 insert into vc_checks values('schema_grants_defaults');

 -- 2. Existing consultations: Admin list, affiliate list and both exports are identical to the capture.
 perform pg_temp.vc_as(s.actor,'vc-admin');
 r:=public.list_voting_consultations(true);
 perform pg_temp.vc_check(not exists(select 1 from vc_before b where b.admin_item is distinct from (select pg_temp.vc_strip(x) from jsonb_array_elements(r->'consultations') x where x->>'id'=b.id::text)),'admin_list_unchanged');
 perform pg_temp.vc_check(not exists(select 1 from jsonb_array_elements(r->'consultations') x cross join jsonb_array_elements(x->'questions') q where (x->>'id')::uuid in (select id from vc_before)
  and (q->>'answer_kind' is distinct from 'options' or q->'options' is distinct from legacy or q->'final' is distinct from 'true'::jsonb or x->'presentation' is distinct from '{}'::jsonb)),'existing_questions_read_as_si_no_abs');
 perform pg_temp.vc_check(not exists(select 1 from vc_before b where b.results is distinct from public.export_voting_consultation(b.id,false) or b.identified is distinct from public.export_voting_consultation(b.id,true)),'exports_unchanged');
 perform pg_temp.vc_as(s.normal,'vc-normal');
 r:=public.list_voting_consultations(false);
 perform pg_temp.vc_check((select count(*) from jsonb_array_elements(r->'consultations') x where (x->>'id')::uuid in (select id from vc_before_aff))=(select count(*) from vc_before_aff)
  and not exists(select 1 from vc_before_aff b where b.item is distinct from (select pg_temp.vc_strip(x) from jsonb_array_elements(r->'consultations') x where x->>'id'=b.id::text)),'affiliate_list_unchanged');
 insert into vc_checks values('existing_consultations_identical');

 -- 3. Card texts and optional close date.
 perform pg_temp.vc_as(s.actor,'vc-admin');
 p:=jsonb_build_object('title','ISOLATED CONSULTAS TEST','closes_on',null,'published',true,'audience',aud,
  'presentation',jsonb_build_object('kind','consultation','header','  Censo familiar  ','open_label','','closed_label','   '),
  'questions',jsonb_build_array(
   jsonb_build_object('title','¿Asistirás a la asamblea?','detail','','answer_kind','options','options',custom,'final',true),
   jsonb_build_object('title','Pregunta con Sí / No / Abstención','detail','','answer_kind','options','options',legacy,'final',false),
   jsonb_build_object('title','Comentarios','detail','Escribe tu respuesta','answer_kind','text','options',null,'final',true),
   jsonb_build_object('title','¿Tienes hijos menores de edad?','detail','','answer_kind','options','options','[{"id":"si","label":"Sí"},{"id":"no","label":"No"}]'::jsonb,'final',false)));
 foreach e in array array[
  format('select public.save_voting_consultation(null,null,%L)',p||jsonb_build_object('presentation',jsonb_build_object('color','red'))),
  format('select public.save_voting_consultation(null,null,%L)',p||jsonb_build_object('presentation',jsonb_build_object('header',5))),
  format('select public.save_voting_consultation(null,null,%L)',p||jsonb_build_object('presentation',jsonb_build_object('header',repeat('h',81)))),
  format('select public.save_voting_consultation(null,null,%L)',p||jsonb_build_object('presentation',jsonb_build_object('kind','encuesta'))),
  format('select public.save_voting_consultation(null,null,%L)',p||jsonb_build_object('presentation','["x"]'::jsonb))] loop
  perform pg_temp.vc_check(pg_temp.vc_err(e)='P0001:INVALID_PRESENTATION','invalid_presentation_rejected');
 end loop;
 cid:=public.save_voting_consultation(null,null,p);
 select id into q1 from public.voting_questions where consultation_id=cid and sort_order=0;
 select id into q2 from public.voting_questions where consultation_id=cid and sort_order=1;
 select id into q3 from public.voting_questions where consultation_id=cid and sort_order=2;
 select id into q4 from public.voting_questions where consultation_id=cid and sort_order=3;
 perform pg_temp.vc_check((select presentation from public.voting_consultations where id=cid)='{"kind":"consultation","header":"Censo familiar"}'::jsonb,'presentation_trimmed_empty_means_suggested');
 perform pg_temp.vc_check((select closes_on is null from public.voting_consultations where id=cid),'close_date_optional');
 perform pg_temp.vc_check((select pg_temp.vc_err(format('select public.save_voting_consultation(null,null,%L)',p||'{"closes_on":"no-date"}'::jsonb)) like '22007:%'),'invalid_date_rejected');
 insert into vc_checks values('card_texts_and_optional_close_date');

 -- 4. Answer types and options: stored normalized; the original Sí / No / Abstención is stored as NULL.
 perform pg_temp.vc_check((select options from public.voting_questions where id=q1)=custom and (select final from public.voting_questions where id=q1),'custom_options_stored');
 perform pg_temp.vc_check((select options is null and answer_kind='options' and not final from public.voting_questions where id=q2),'original_options_stored_as_null');
 perform pg_temp.vc_check((select options is null and answer_kind='text' and final from public.voting_questions where id=q3),'free_text_question');
 perform pg_temp.vc_check((select jsonb_array_length(options)=2 and not final from public.voting_questions where id=q4),'two_options_non_final');
 foreach it in array array[
  '[{"id":"si","label":"Sí"}]'::jsonb,
  '[{"id":"si","label":"Sí"},{"id":"si","label":"Otro"}]'::jsonb,
  '[{"id":"si","label":"Sí"},{"id":"o1","label":" sí "}]'::jsonb,
  '[{"id":"si","label":"Sí"},{"id":"text","label":"Texto"}]'::jsonb,
  '[{"id":"si","label":"Sí"},{"id":"Bad Id","label":"Malo"}]'::jsonb,
  '[{"id":"si","label":"Sí"},{"id":"o1","label":"   "}]'::jsonb,
  '[{"id":"si","label":"Sí"},{"id":"o1"}]'::jsonb,
  '[{"id":"si","label":"Sí"},"o1"]'::jsonb,
  '{"si":"Sí"}'::jsonb,
  (select jsonb_agg(jsonb_build_object('id','o'||g,'label','Opción '||g)) from generate_series(1,21) g)] loop
  perform pg_temp.vc_check(pg_temp.vc_err(format('select public.save_voting_consultation(null,null,%L)',jsonb_set(p,'{questions,0,options}',it)))='P0001:INVALID_OPTIONS','invalid_options_rejected:'||left(it::text,40));
 end loop;
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.save_voting_consultation(null,null,%L)',jsonb_set(p,'{questions,2,options}',custom)))='P0001:INVALID_OPTIONS','text_question_without_options');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.save_voting_consultation(null,null,%L)',jsonb_set(p,'{questions,0,answer_kind}','"multiple"'::jsonb)))='P0001:INVALID_QUESTION','unknown_answer_kind');
 perform pg_temp.vc_check((select count(*) from public.voting_consultations where title='ISOLATED CONSULTAS TEST')=1,'rejected_saves_write_nothing');
 insert into vc_checks values('answer_types_and_option_rules');

 -- 5. Affiliate: open while published without date; nothing on air → no question text, type or options.
 perform pg_temp.vc_as(s.normal,'vc-normal');
 r:=public.list_voting_consultations(false);
 select y into it from jsonb_array_elements(r->'consultations') y where y->>'id'=cid::text;
 perform pg_temp.vc_check(it is not null and it->'open'='true'::jsonb and it->'closes_on'='null'::jsonb and it->'presentation'->>'header'='Censo familiar','affiliate_open_without_date');
 perform pg_temp.vc_check(not exists(select 1 from jsonb_array_elements(it->'questions') q where q->'title'<>'null'::jsonb or q->'answer_kind'<>'null'::jsonb or q->'options'<>'null'::jsonb or q->'final'<>'null'::jsonb or q->'results' is not null),'affiliate_off_air_hides_text_and_options');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,null)',cid,q1,'o1'))='42501:QUESTION_NOT_ACTIVE','answer_requires_question_on_air');
 insert into vc_checks values('affiliate_off_air');

 -- 6. Custom options on air: only an option of the question is accepted; a final answer cannot be repeated.
 perform pg_temp.vc_as(s.actor,'vc-admin');
 perform public.set_voting_active_question(cid,q1);
 perform pg_temp.vc_as(s.normal,'vc-normal');
 r:=public.list_voting_consultations(false);
 select y into it from jsonb_array_elements(r->'consultations') y where y->>'id'=cid::text;
 perform pg_temp.vc_check((select q->'options'=custom and q->>'answer_kind'='options' and q->'final'='true'::jsonb from jsonb_array_elements(it->'questions') q where q->>'id'=q1::text)
  and (select count(*) from jsonb_array_elements(it->'questions') q where q->'options'<>'null'::jsonb)=1,'affiliate_receives_options_of_question_on_air');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,null)',cid,q1,'abs'))='P0001:INVALID_VOTE','answer_must_be_option_of_question');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,%L)',cid,q1,'o1','texto'))='P0001:INVALID_VOTE','options_question_rejects_text');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,null,null)',cid,q1))='P0001:INVALID_VOTE','answer_required');
 v:=public.cast_voting_answer(cid,q1,'o1',null);
 perform pg_temp.vc_check(v->>'answer'='o1' and v->>'folio' like 'V-%' and v->'answer_text'='null'::jsonb and v->'changed_at'='null'::jsonb and not v ? 'results','custom_answer_receipt');
 select id into vote_q1 from public.voting_votes where question_id=q1 and affiliate_id=s.b;
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,null)',cid,q1,'si')) like '23505:%','final_answer_cannot_repeat');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_vote(%L,%L,%L)',cid,q1,'si')) like '23505:%','legacy_rpc_same_rules');
 perform pg_temp.vc_check((select answer from public.voting_votes where id=vote_q1)='o1' and (select count(*) from public.voting_votes where question_id=q1)=1,'final_answer_kept');
 perform pg_temp.vc_as(s.actor,'vc-admin');
 r:=public.get_voting_live(cid);
 perform pg_temp.vc_check(r#>>'{question,answer_kind}'='options' and r#>'{question,options}'=custom and r#>'{question,results,counts}'='{"o1":1}'::jsonb and (r#>>'{question,results,total}')::integer=1 and r->'presentation'->>'kind'='consultation','live_screen_options_and_counts');
 r:=public.list_voting_consultations(true);
 perform pg_temp.vc_check((select q#>'{results,counts}'='{"o1":1}'::jsonb and q->'locked'='true'::jsonb and q->'options'=custom from jsonb_array_elements(r->'consultations') y cross join jsonb_array_elements(y->'questions') q where q->>'id'=q1::text),'admin_list_counts_per_option');
 insert into vc_checks values('custom_options_on_air');

 -- 7. Non-final answer: changed while on air, same row and folio, audited without its content.
 perform public.set_voting_active_question(cid,q4);
 perform pg_temp.vc_as(s.normal,'vc-normal');
 v:=public.cast_voting_answer(cid,q4,'si',null);
 v2:=public.cast_voting_answer(cid,q4,'no',null);
 select id into vote_q4 from public.voting_votes where question_id=q4 and affiliate_id=s.b;
 perform pg_temp.vc_check(v2->>'answer'='no' and v2->>'folio'=v->>'folio' and v2->>'cast_at'=v->>'cast_at' and v2->'changed_at'<>'null'::jsonb,'non_final_answer_changed');
 perform pg_temp.vc_check((select count(*) from public.voting_votes where question_id=q4)=1 and (select answer from public.voting_votes where id=vote_q4)='no','non_final_single_row');
 perform pg_temp.vc_check((select count(*) from public.admin_audit_log where resource='voting' and action='CHANGE_VOTE' and target_id=vote_q4::text)=1
  and not exists(select 1 from public.admin_audit_log where resource='voting' and target_id=vote_q4::text and (details ? 'answer' or details::text like '%"no"%')),'change_audited_without_content');
 v2:=public.cast_voting_answer(cid,q4,'no',null);
 perform pg_temp.vc_check((select count(*) from public.admin_audit_log where resource='voting' and action='CHANGE_VOTE' and target_id=vote_q4::text)=1,'same_answer_is_not_a_change');
 perform pg_temp.vc_as(s.actor,'vc-admin');
 perform pg_temp.vc_check(public.get_voting_live(cid)#>'{question,results,counts}'='{"no":1}'::jsonb,'live_count_follows_change');
 perform public.set_voting_active_question(cid,null);
 perform pg_temp.vc_as(s.normal,'vc-normal');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,null)',cid,q4,'si'))='42501:QUESTION_NOT_ACTIVE','no_change_after_question_leaves_air');
 -- The original RPC also changes a non-final answer (old cached clients).
 perform pg_temp.vc_as(s.actor,'vc-admin');
 perform public.set_voting_active_question(cid,q2);
 perform pg_temp.vc_as(s.normal,'vc-normal');
 perform public.cast_voting_vote(cid,q2,'abs');
 perform public.cast_voting_vote(cid,q2,'si');
 perform pg_temp.vc_check((select answer from public.voting_votes where question_id=q2 and affiliate_id=s.b)='si' and (select count(*) from public.voting_votes where question_id=q2)=1,'legacy_rpc_non_final_change');
 insert into vc_checks values('non_final_answers');

 -- 8. Free text: trimmed, 1–500 characters; the big screen receives only the count.
 perform pg_temp.vc_as(s.actor,'vc-admin');
 perform public.set_voting_active_question(cid,q3);
 perform pg_temp.vc_as(s.normal,'vc-normal');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,null)',cid,q3,'si'))='P0001:INVALID_VOTE','text_question_rejects_option');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,%L)',cid,q3,'text','    '))='P0001:INVALID_VOTE','blank_text_rejected');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,%L)',cid,q3,'text',repeat('x',501)))='P0001:INVALID_VOTE','text_over_500_rejected');
 v:=public.cast_voting_answer(cid,q3,'text','  Necesito guardería los sábados  ');
 select id into vote_q3 from public.voting_votes where question_id=q3 and affiliate_id=s.b;
 perform pg_temp.vc_check(v->>'answer'='text' and v->>'answer_text'='Necesito guardería los sábados' and (select answer_text from public.voting_votes where id=vote_q3)='Necesito guardería los sábados','free_text_stored_trimmed');
 r:=public.list_voting_consultations(false);
 perform pg_temp.vc_check((select q#>>'{mine,answer_text}' from jsonb_array_elements(r->'consultations') y cross join jsonb_array_elements(y->'questions') q where q->>'id'=q3::text)='Necesito guardería los sábados','affiliate_sees_own_text');
 perform pg_temp.vc_as(s.actor,'vc-admin');
 r:=public.get_voting_live(cid);
 perform pg_temp.vc_check(r#>>'{question,answer_kind}'='text' and r#>'{question,options}'='[]'::jsonb and (r#>>'{question,results,total}')::integer=1 and position('Necesito' in r::text)=0,'live_screen_text_count_only');
 r:=public.list_voting_votes(cid);
 perform pg_temp.vc_check((select x->>'answer_text' from jsonb_array_elements(r->'votes') x where (x->>'id')::uuid=vote_q3)='Necesito guardería los sábados'
  and (select x->>'answer_label' from jsonb_array_elements(r->'votes') x where (x->>'id')::uuid=vote_q1)='Tal vez'
  and (select x->>'answer_label' from jsonb_array_elements(r->'votes') x where (x->>'id')::uuid=vote_q4)='No'
  and (select x->'answer_label' from jsonb_array_elements(r->'votes') x where (x->>'id')::uuid=vote_q3)='null'::jsonb,'ver_shows_labels_and_text');
 insert into vc_checks values('free_text');

 -- 9. Exports: nominal «Respuesta» = option label or text; results one row per option, text only as a count.
 r:=public.export_voting_consultation(cid,true);
 perform pg_temp.vc_check((select jsonb_agg(x->>'Respuesta' order by x->>'Respuesta') from jsonb_array_elements(r) x)='["Necesito guardería los sábados","No","Sí","Tal vez"]'::jsonb
  and (select bool_and((select array_agg(k order by k) from jsonb_object_keys(x) k)=(select array_agg(k order by k) from unnest(array['Folio','Fecha','Hora','Consulta','Pregunta','Respuesta','Número de control','Nombre','Correo','Sindicato','Nivel/tipo de empleado']) k)) from jsonb_array_elements(r) x),'nominal_export');
 r:=public.export_voting_consultation(cid,false);
 perform pg_temp.vc_check(jsonb_array_length(r)=9
  and (select bool_and((select array_agg(k order by k) from jsonb_object_keys(x) k)=(select array_agg(k order by k) from unnest(array['Consulta','Pregunta','Respuesta','Respuestas','% de respuestas','Total','Participación %']) k)) from jsonb_array_elements(r) x)
  and r->0->>'Respuesta'='Asistiré' and r->0->'Respuestas'='0'::jsonb and r->2->>'Respuesta'='Tal vez' and r->2->'Respuestas'='1'::jsonb and r->2->'% de respuestas'='100.0'::jsonb
  and r->5->>'Respuesta'='Abstención' and r->6->>'Respuesta'='Respuesta libre' and r->6->'Respuestas'='1'::jsonb and r->6->'% de respuestas'='null'::jsonb
  and position('Necesito' in r::text)=0,'results_export_per_option');
 insert into vc_checks values('exports');

 -- 10. Vote immutability: only the gated change of a non-final answer passes.
 perform pg_temp.vc_check(pg_temp.vc_err(format('update public.voting_votes set answer=%L where id=%L','si',vote_q1))='42501:VOTE_IS_FINAL','update_without_gate');
 perform set_config('suti.voting_change_answer','on',true);
 perform pg_temp.vc_check(pg_temp.vc_err(format('update public.voting_votes set answer=%L,changed_at=now() where id=%L','si',vote_q1))='42501:VOTE_IS_FINAL','gate_refuses_final_question');
 perform pg_temp.vc_check(pg_temp.vc_err(format('update public.voting_votes set folio=%L,changed_at=now() where id=%L','V-x',vote_q4))='42501:VOTE_IS_FINAL','gate_refuses_identity_columns');
 perform pg_temp.vc_check(pg_temp.vc_err(format('update public.voting_votes set answer=%L where id=%L','si',vote_q4))='42501:VOTE_IS_FINAL','gate_requires_changed_at');
 perform set_config('suti.voting_change_answer','off',true);
 perform pg_temp.vc_check(pg_temp.vc_err(format('delete from public.voting_votes where id=%L',vote_q1))='42501:VOTE_IS_FINAL','delete_without_gate');
 insert into vc_checks values('immutability');

 -- 11. A question with answers keeps text, type and options; «definitiva» stays editable; old clients keep the config.
 ver:=(select version from public.voting_consultations where id=cid);
 p:=jsonb_set(p,'{questions}',(select jsonb_agg(q||jsonb_build_object('id',(select id from public.voting_questions where consultation_id=cid and sort_order=t.n-1)) order by t.n) from jsonb_array_elements(p->'questions') with ordinality t(q,n)));
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.save_voting_consultation(%L,%s,%L)',cid,ver,jsonb_set(p,'{questions,0,options,2,label}','"Quizá"'::jsonb)))='P0001:QUESTION_HAS_VOTES','locked_options');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.save_voting_consultation(%L,%s,%L)',cid,ver,jsonb_set(jsonb_set(p,'{questions,0,answer_kind}','"text"'::jsonb),'{questions,0,options}','null'::jsonb)))='P0001:QUESTION_HAS_VOTES','locked_answer_kind');
 perform public.save_voting_consultation(cid,ver,jsonb_set(p,'{questions,0,final}','false'::jsonb));
 perform pg_temp.vc_check((select not final from public.voting_questions where id=q1),'final_editable_with_answers');
 ver:=(select version from public.voting_consultations where id=cid);
 perform public.save_voting_consultation(cid,ver,(p-'presentation')||jsonb_build_object('questions',(select jsonb_agg(jsonb_build_object('id',q->>'id','title',q->>'title','detail',q->>'detail') order by t.n) from jsonb_array_elements(p->'questions') with ordinality t(q,n))));
 perform pg_temp.vc_check((select presentation from public.voting_consultations where id=cid)='{"kind":"consultation","header":"Censo familiar"}'::jsonb
  and (select options from public.voting_questions where id=q1)=custom and not (select final from public.voting_questions where id=q1)
  and (select answer_kind from public.voting_questions where id=q3)='text' and (select options is null from public.voting_questions where id=q2),'old_client_save_keeps_config');
 insert into vc_checks values('locks_and_old_clients');

 -- 12. Duplicate copies texts, close date and answer types; no votes, hidden.
 copy_id:=public.voting_consultation_action(cid,(select version from public.voting_consultations where id=cid),'duplicate');
 perform pg_temp.vc_check((select presentation='{"kind":"consultation","header":"Censo familiar"}'::jsonb and closes_on is null and not published from public.voting_consultations where id=copy_id)
  and (select jsonb_agg(jsonb_build_array(answer_kind,options,final) order by sort_order) from public.voting_questions where consultation_id=copy_id)=(select jsonb_agg(jsonb_build_array(answer_kind,options,final) order by sort_order) from public.voting_questions where consultation_id=cid)
  and not exists(select 1 from public.voting_votes where consultation_id=copy_id),'duplicate_copies_configuration');
 insert into vc_checks values('duplicate');

 -- 13. A close date still closes the consultation at the end of that day (America/Hermosillo).
 cid2:=public.save_voting_consultation(null,null,(p-'presentation')||jsonb_build_object('title','ISOLATED CONSULTAS CLOSED','closes_on',((clock_timestamp() at time zone 'America/Hermosillo')::date-1)::text,
  'questions',jsonb_build_array(jsonb_build_object('title','Cerrada','detail','','answer_kind','options','options',null,'final',true))));
 perform public.set_voting_active_question(cid2,(select id from public.voting_questions where consultation_id=cid2));
 perform pg_temp.vc_as(s.normal,'vc-normal');
 r:=public.list_voting_consultations(false);
 perform pg_temp.vc_check((select y->'open' from jsonb_array_elements(r->'consultations') y where y->>'id'=cid2::text)='false'::jsonb,'past_date_closed');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,null)',cid2,(select id from public.voting_questions where consultation_id=cid2),'si'))='42501:VOTING_UNAVAILABLE','past_date_refuses_answers');
 insert into vc_checks values('close_date_still_closes');

 -- 14. Permissions unchanged: an affiliate cannot administer; impersonated sessions cannot answer.
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.save_voting_consultation(null,null,%L)',p))='42501:VOTING_DENIED','affiliate_cannot_save');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.list_voting_votes(%L)',cid))='42501:VOTING_DENIED','affiliate_cannot_see_votes');
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.export_voting_consultation(%L,true)',cid))='42501:VOTING_EXPORT_DENIED','affiliate_cannot_export');
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 perform pg_temp.vc_check(pg_temp.vc_err(format('select public.cast_voting_answer(%L,%L,%L,null)',cid,q3,'text')) like '42501:VOTING_IMPERSONATION_DENIED','anonymous_cannot_answer');
 insert into vc_checks values('permissions');

 -- 15. «VER» delete still frees the question for that person.
 perform pg_temp.vc_as(s.actor,'vc-admin');
 perform pg_temp.vc_check(public.delete_voting_votes(cid,vote_q3,null)=1,'ver_delete_vote');
 perform pg_temp.vc_as(s.normal,'vc-normal');
 v:=public.cast_voting_answer(cid,q3,'text','Otra respuesta');
 perform pg_temp.vc_check(v->>'answer_text'='Otra respuesta','answer_again_after_delete');
 insert into vc_checks values('ver_delete');
end $$;
