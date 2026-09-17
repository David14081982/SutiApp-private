begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- Recovery for 20260916000200_voting_live (H-SUTIAPP-VOTACIONES-LIVE-002).
-- Returns the voting backend to restore point voting_restore_private.*_20260916 without deleting consultations, questions, votes or audit.
-- Run together with a frontend revert of the release commit (baseline tag: restore/pre-votacion-en-vivo-20260916).
do $realtime$ begin
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='voting_live_state') then
  alter publication supabase_realtime drop table public.voting_live_state;
 end if;
end $realtime$;
drop policy if exists voting_live_state_read on public.voting_live_state;
revoke all on public.voting_live_state from public,anon,authenticated;
drop function if exists public.set_voting_active_question(uuid,uuid);
drop function if exists public.get_voting_live(uuid);
drop function if exists public.count_voting_electorate(jsonb);
drop function if exists public.voting_live_visible(uuid);

-- Exact definitions captured in the restore point (pg_get_functiondef); create or replace keeps their ACL.
-- cast_voting_vote(uuid,uuid,text) md5 9ecf47942170e69166c73f6f45e658dc
CREATE OR REPLACE FUNCTION public.cast_voting_vote(p_consultation uuid, p_question uuid, p_answer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.affiliates%rowtype;c public.voting_consultations%rowtype;v public.voting_votes%rowtype;
begin
 if auth.uid() is null or exists(select 1 from public.get_impersonation_context()) then raise exception 'VOTING_IMPERSONATION_DENIED' using errcode='42501'; end if;
 select * into a from public.affiliates where id=public.get_effective_affiliate_id() and auth_user_id=auth.uid();
 if a.id is null then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 if p_answer is null or p_answer not in ('si','no','abs') then raise exception 'INVALID_VOTE'; end if;
 -- Shared consultation locks allow simultaneous voters, but serialize against editing/closing.
 select * into c from public.voting_consultations where id=p_consultation for share;
 if c.id is null or c.archived_at is not null or not c.published or c.closes_on<(clock_timestamp() at time zone 'America/Hermosillo')::date or not public.voting_audience_matches(c.audience) then raise exception 'VOTING_UNAVAILABLE' using errcode='42501'; end if;
 perform 1 from public.voting_questions where id=p_question and consultation_id=c.id and archived_at is null for share;
 if not found then raise exception 'QUESTION_UNAVAILABLE'; end if;
 insert into public.voting_votes(consultation_id,question_id,affiliate_id,actor_auth_user_id,answer,identity_snapshot)
 values(c.id,p_question,a.id,auth.uid(),p_answer,jsonb_build_object('numero_control',a.numero_control,'name',coalesce(a.full_name,a.display_name),'email',a.historical_email_raw,'union',a.financial_union_code,'category',a.financial_employee_category_code)) returning * into v;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting','VOTE',v.id::text,'SUCCESS',jsonb_build_object('consultation_id',c.id,'question_id',p_question));
 return jsonb_build_object('answer',v.answer,'folio',v.folio,'cast_at',v.cast_at,'results',public.voting_question_result(p_question,c.electorate));
end $function$;

-- export_voting_consultation(uuid,boolean) md5 bc0d4b61056dd9c79ff59ec89b764663
CREATE OR REPLACE FUNCTION public.export_voting_consultation(p_id uuid, p_identified boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;c public.voting_consultations%rowtype;
begin
 if not public.voting_can(case when p_identified then 'export_identified_votes' else 'results' end) then raise exception 'VOTING_EXPORT_DENIED' using errcode='42501'; end if;
 select * into c from public.voting_consultations where id=p_id;
 if c.id is null then raise exception 'VOTING_UNAVAILABLE'; end if;
 if p_identified then
 select coalesce(jsonb_agg(jsonb_build_object('Folio',v.folio,'Fecha',to_char(v.cast_at at time zone 'America/Hermosillo','YYYY-MM-DD'),'Hora',to_char(v.cast_at at time zone 'America/Hermosillo','HH24:MI:SS'),'Consulta',c.title,'Pregunta',q.title,'Respuesta',case v.answer when 'si' then 'Sí' when 'no' then 'No' else 'Abstención' end,'Número de control',v.identity_snapshot->>'numero_control','Nombre',v.identity_snapshot->>'name','Correo',v.identity_snapshot->>'email','Sindicato',v.identity_snapshot->>'union','Nivel/tipo de empleado',v.identity_snapshot->>'category') order by v.cast_at,v.id),'[]') into result from public.voting_votes v join public.voting_questions q on q.id=v.question_id where v.consultation_id=c.id;
 else
 select coalesce(jsonb_agg(jsonb_build_object('Consulta',c.title,'Pregunta',q.title,'Sí',r->'si','No',r->'no','Abstención',r->'abs','Total',r->'total','Participación %',r->'participation') order by q.sort_order,q.id),'[]') into result from public.voting_questions q cross join lateral public.voting_question_result(q.id,c.electorate) r where q.consultation_id=c.id;
 end if;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting',case when p_identified then 'EXPORT_IDENTIFIED' else 'EXPORT_RESULTS' end,c.id::text,'SUCCESS',jsonb_build_object('rows',jsonb_array_length(result)));
 return result;
end $function$;

-- list_voting_consultations(boolean) md5 26eab209f9562fb9ff0349e15237be4b
CREATE OR REPLACE FUNCTION public.list_voting_consultations(p_admin boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare aid uuid:=public.get_effective_affiliate_id(); result jsonb;
begin
 if auth.uid() is null or (p_admin and not public.voting_can('read')) or (not p_admin and aid is null) then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 select coalesce(jsonb_agg(item order by created_at desc),'[]') into result from (
 select c.created_at,jsonb_build_object('id',c.id,'title',c.title,'closes_on',c.closes_on,'electorate',c.electorate,'published',c.published,'version',c.version,
 'open',c.published and c.closes_on >= (clock_timestamp() at time zone 'America/Hermosillo')::date,
 'audience',case when p_admin then c.audience else null end,
 'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'detail',q.detail,'sort_order',q.sort_order,
 'mine',case when not p_admin then (select jsonb_build_object('answer',v.answer,'folio',v.folio,'cast_at',v.cast_at) from public.voting_votes v where v.question_id=q.id and v.affiliate_id=aid) else null end,
 'results',case when (p_admin and public.voting_can('results')) or (not p_admin and exists(select 1 from public.voting_votes v where v.question_id=q.id and v.affiliate_id=aid)) then public.voting_question_result(q.id,c.electorate) else null end,
 'locked',case when p_admin then exists(select 1 from public.voting_votes v where v.question_id=q.id) else null end) order by q.sort_order,q.id)
 from public.voting_questions q where q.consultation_id=c.id and q.archived_at is null),'[]')) item
 from public.voting_consultations c where c.archived_at is null and (p_admin or (c.published and public.voting_audience_matches(c.audience)))) items;
 return jsonb_build_object('consultations',result,'can_vote',not exists(select 1 from public.get_impersonation_context()),
 'permissions',case when p_admin then (select jsonb_object_agg(x,public.voting_can(x)) from unnest(array['read','create','update','delete','publish','results','export_identified_votes']) x) else '{}'::jsonb end,
 'catalog',case when p_admin then jsonb_build_object('segments',(select coalesce(jsonb_agg(jsonb_build_object('type',catalog_type,'code',code,'label',label) order by sort_order),'[]') from public.segmentation_catalog_entries where enabled and catalog_type in ('union','employment_category')),
 'positions',(select coalesce(jsonb_agg(p order by p),'[]') from (select distinct btrim(union_position_raw) p from public.affiliates where not is_archived and nullif(btrim(union_position_raw),'') is not null) positions)) else null end);
end $function$;

-- save_voting_consultation(uuid,integer,jsonb) md5 d13f9433be8d89eda247d1663903069d
CREATE OR REPLACE FUNCTION public.save_voting_consultation(p_id uuid, p_version integer, p_value jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.voting_consultations%rowtype;cid uuid:=p_id; q jsonb; qid uuid; kept uuid[]:='{}'; oldq public.voting_questions%rowtype; aud jsonb:=p_value->'audience'; k text;vals jsonb;ord integer:=0; v_published boolean:=coalesce((p_value->>'published')::boolean,false);
begin
 if not public.voting_can(case when p_id is null then 'create' else 'update' end) then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 if p_id is not null then
 select * into c from public.voting_consultations where id=p_id and archived_at is null for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'VOTING_CHANGED' using errcode='40001'; end if;
 end if;
 if v_published is distinct from coalesce(c.published,false) and not public.voting_can('publish') then raise exception 'VOTING_PUBLISH_DENIED' using errcode='42501'; end if;
 if aud is null or coalesce(aud->>'mode','') not in ('all','registered','segment','emails') then raise exception 'INVALID_AUDIENCE'; end if;
 foreach k in array array['unions','categories','positions','emails'] loop
 if jsonb_typeof(aud->k) is distinct from 'array' or jsonb_array_length(aud->k)>5000 then raise exception 'INVALID_AUDIENCE'; end if;
 if exists(select 1 from jsonb_array_elements(aud->k) x where jsonb_typeof(x)<>'string') then raise exception 'INVALID_AUDIENCE'; end if;
 select coalesce(jsonb_agg(x order by x),'[]') into vals from (select distinct case when k='emails' then lower(btrim(x)) else btrim(x) end x from jsonb_array_elements_text(aud->k) x) a;
 aud:=jsonb_set(aud,array[k],vals);
 end loop;
 if exists(select 1 from jsonb_array_elements_text(aud->'emails') x where length(x)>254 or x !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'INVALID_EMAIL'; end if;
 if exists(select 1 from jsonb_array_elements_text(aud->'unions') x where not exists(select 1 from public.segmentation_catalog_entries where catalog_type='union' and code=x and enabled))
 or exists(select 1 from jsonb_array_elements_text(aud->'categories') x where not exists(select 1 from public.segmentation_catalog_entries where catalog_type='employment_category' and code=x and enabled)) then raise exception 'INVALID_SEGMENT'; end if;
 if jsonb_typeof(p_value->'questions') is distinct from 'array' or jsonb_array_length(p_value->'questions')>100 or (v_published and jsonb_array_length(p_value->'questions')=0) then raise exception 'INVALID_QUESTIONS'; end if;
 if p_id is null then
 insert into public.voting_consultations(title,closes_on,electorate,published,audience,created_by) values(btrim(p_value->>'title'),(p_value->>'closes_on')::date,(p_value->>'electorate')::integer,v_published,aud,auth.uid()) returning id into cid;
 else
 update public.voting_consultations set title=btrim(p_value->>'title'),closes_on=(p_value->>'closes_on')::date,electorate=(p_value->>'electorate')::integer,published=v_published,audience=aud,version=version+1,updated_at=clock_timestamp() where id=cid;
 end if;
 for q in select value from jsonb_array_elements(p_value->'questions') loop
 qid:=nullif(q->>'id','')::uuid;
 if qid is null then
 insert into public.voting_questions(consultation_id,title,detail,sort_order) values(cid,btrim(q->>'title'),coalesce(q->>'detail',''),ord) returning id into qid;
 else
 select * into oldq from public.voting_questions where id=qid and consultation_id=cid and archived_at is null for update;
 if oldq.id is null or qid=any(kept) then raise exception 'INVALID_QUESTION'; end if;
 if exists(select 1 from public.voting_votes where question_id=qid) and (oldq.title is distinct from btrim(q->>'title') or oldq.detail is distinct from coalesce(q->>'detail','')) then raise exception 'QUESTION_HAS_VOTES'; end if;
 update public.voting_questions set title=btrim(q->>'title'),detail=coalesce(q->>'detail',''),sort_order=ord where id=qid;
 end if;
 kept:=array_append(kept,qid);ord:=ord+1;
 end loop;
 if exists(select 1 from public.voting_questions where consultation_id=cid and archived_at is null and not(id=any(kept))) and not public.voting_can('delete') then raise exception 'VOTING_DELETE_DENIED' using errcode='42501'; end if;
 update public.voting_questions set archived_at=clock_timestamp() where consultation_id=cid and archived_at is null and not(id=any(kept));
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting',case when p_id is null then 'CREATE' else 'UPDATE' end,cid::text,'SUCCESS',jsonb_build_object('published',v_published));
 if v_published is distinct from coalesce(c.published,false) then insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'voting',case when v_published then 'PUBLISH' else 'HIDE' end,cid::text,'SUCCESS'); end if;
 return cid;
end $function$;

-- voting_consultation_action(uuid,integer,text) md5 cc923ae6438dc23472670d03d37263d2
CREATE OR REPLACE FUNCTION public.voting_consultation_action(p_id uuid, p_version integer, p_action text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.voting_consultations%rowtype; cid uuid;
begin
 if p_action not in ('publish','hide','archive','duplicate') or not public.voting_can(case when p_action='archive' then 'delete' when p_action='duplicate' then 'create' else 'publish' end) or not public.voting_can('read') then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 select * into c from public.voting_consultations where id=p_id and archived_at is null for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'VOTING_CHANGED' using errcode='40001'; end if;
 cid:=c.id;
 if p_action='duplicate' then
 insert into public.voting_consultations(title,closes_on,electorate,audience,created_by) values(left(c.title,232)||' (copia)',c.closes_on,c.electorate,c.audience,auth.uid()) returning id into cid;
 insert into public.voting_questions(consultation_id,title,detail,sort_order) select cid,title,detail,sort_order from public.voting_questions where consultation_id=c.id and archived_at is null;
 elsif p_action='archive' then update public.voting_consultations set archived_at=clock_timestamp(),published=false,version=version+1 where id=c.id;
 else
 if p_action='publish' and not exists(select 1 from public.voting_questions where consultation_id=c.id and archived_at is null) then raise exception 'INVALID_QUESTIONS'; end if;
 update public.voting_consultations set published=p_action='publish',version=version+1,updated_at=clock_timestamp() where id=c.id;
 end if;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'voting',upper(p_action),cid::text,'SUCCESS');
 return cid;
end $function$;

-- voting_question_result(uuid,integer) md5 bcbba2fa57f7c6cc5950c4e58502ac4c
CREATE OR REPLACE FUNCTION public.voting_question_result(p_question uuid, p_electorate integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('si',count(*) filter(where answer='si'),'no',count(*) filter(where answer='no'),'abs',count(*) filter(where answer='abs'),'total',count(*),'participation',round(100.0*count(*)/p_electorate,1)) from public.voting_votes where question_id=p_question;
$function$;

drop function if exists public.voting_live_touch(uuid);
drop function if exists public.voting_electorate(jsonb);

-- The restored contract needs a manual electorate > 0; only zeros are lifted, no other value changes.
update public.voting_consultations set electorate=1 where electorate<1;
alter table public.voting_consultations drop constraint voting_consultations_electorate_check;
alter table public.voting_consultations add constraint voting_consultations_electorate_check check(electorate>0);

-- voting_live_state stays as inert history (no browser grant, not published); activations also remain in admin_audit_log.
do $verify$ declare expected jsonb:='{"cast_voting_vote(uuid,uuid,text)":"9ecf47942170e69166c73f6f45e658dc","export_voting_consultation(uuid,boolean)":"bc0d4b61056dd9c79ff59ec89b764663","list_voting_consultations(boolean)":"26eab209f9562fb9ff0349e15237be4b","save_voting_consultation(uuid,integer,jsonb)":"d13f9433be8d89eda247d1663903069d","voting_consultation_action(uuid,integer,text)":"cc923ae6438dc23472670d03d37263d2","voting_question_result(uuid,integer)":"bcbba2fa57f7c6cc5950c4e58502ac4c"}'; k text; begin
 for k in select jsonb_object_keys(expected) loop
  if md5(pg_get_functiondef(('public.'||k)::regprocedure)) is distinct from expected->>k then raise exception 'VOTING_LIVE_RECOVERY_MISMATCH:%',k; end if;
 end loop;
end $verify$;
notify pgrst,'reload schema';
commit;
