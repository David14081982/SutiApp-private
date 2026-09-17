begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

-- H-SUTIAPP-VOTACIONES-LIVE-002. Baseline = restore point voting_restore_private.*_20260916 / tag restore/pre-votacion-en-vivo-20260916.
do $guard$ declare expected jsonb:='{
 "voting_question_result(uuid,integer)":"bcbba2fa57f7c6cc5950c4e58502ac4c",
 "list_voting_consultations(boolean)":"26eab209f9562fb9ff0349e15237be4b",
 "cast_voting_vote(uuid,uuid,text)":"9ecf47942170e69166c73f6f45e658dc",
 "save_voting_consultation(uuid,integer,jsonb)":"d13f9433be8d89eda247d1663903069d",
 "voting_consultation_action(uuid,integer,text)":"cc923ae6438dc23472670d03d37263d2",
 "export_voting_consultation(uuid,boolean)":"bc0d4b61056dd9c79ff59ec89b764663",
 "voting_audience_matches(jsonb)":"a46ad282e6d2ef0f7f3a10f51a490dc4",
 "voting_can(text)":"8b2ea47edf9c7552cffc137a7a6ed028"
}'; k text;
begin
 for k in select jsonb_object_keys(expected) loop
  if md5(pg_get_functiondef(('public.'||k)::regprocedure)) is distinct from expected->>k then raise exception 'VOTING_LIVE_BASELINE_CHANGED:%',k; end if;
 end loop;
end $guard$;

-- The total of voters is derived from the audience on every read (voting_electorate).
-- The legacy column keeps the value computed at the last save, and may now be 0 (e.g. an empty email list).
alter table public.voting_consultations drop constraint voting_consultations_electorate_check;
alter table public.voting_consultations add constraint voting_consultations_electorate_check check(electorate>=0);

-- Live state: the question on air. One row per consultation, so at most one active question by construction.
-- last_question_id keeps the most recently activated question for the big screen between questions.
create table public.voting_live_state (
 consultation_id uuid primary key references public.voting_consultations(id) on delete restrict,
 active_question_id uuid,
 last_question_id uuid,
 changed_at timestamptz not null default clock_timestamp(),
 constraint voting_live_state_active_fkey foreign key(consultation_id,active_question_id) references public.voting_questions(consultation_id,id) on delete restrict,
 constraint voting_live_state_last_fkey foreign key(consultation_id,last_question_id) references public.voting_questions(consultation_id,id) on delete restrict
);
alter table public.voting_live_state enable row level security;
alter table public.voting_live_state force row level security;
revoke all on public.voting_live_state from public,anon,authenticated;
insert into public.voting_live_state(consultation_id) select id from public.voting_consultations;

create function public.voting_electorate(p_audience jsonb) returns integer language plpgsql stable security definer set search_path='' as $$
declare mode text:=coalesce(p_audience->>'mode',''); unions text[]; categories text[]; positions text[];
begin
 if mode='emails' then
  return (select count(distinct lower(btrim(x))) from jsonb_array_elements_text(case when jsonb_typeof(p_audience->'emails')='array' then p_audience->'emails' else '[]'::jsonb end) x where btrim(x)<>'');
 elsif mode='all' then
  return (select count(*) from public.affiliates a where not a.is_archived);
 elsif mode='registered' then
  return (select count(*) from public.affiliates a where not a.is_archived and a.auth_user_id is not null);
 elsif mode='segment' then
  select coalesce(array_agg(x),'{}') into unions from jsonb_array_elements_text(case when jsonb_typeof(p_audience->'unions')='array' then p_audience->'unions' else '[]'::jsonb end) x;
  select coalesce(array_agg(x),'{}') into categories from jsonb_array_elements_text(case when jsonb_typeof(p_audience->'categories')='array' then p_audience->'categories' else '[]'::jsonb end) x;
  select coalesce(array_agg(x),'{}') into positions from jsonb_array_elements_text(case when jsonb_typeof(p_audience->'positions')='array' then p_audience->'positions' else '[]'::jsonb end) x;
  -- Same authoritative attributes as voting_audience_matches, counted over the whole roster (account or not).
  return (select count(*) from public.affiliates a where not a.is_archived
   and (cardinality(unions)=0 or a.financial_union_code=any(unions))
   and (cardinality(categories)=0 or a.financial_employee_category_code=any(categories))
   and (cardinality(positions)=0 or btrim(a.union_position_raw)=any(positions)));
 end if;
 return 0;
end $$;

create function public.voting_live_touch(p_consultation uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Signals every live listener and drops pointers to archived questions or consultations.
 insert into public.voting_live_state as s(consultation_id) values(p_consultation)
 on conflict(consultation_id) do update set
  active_question_id=case when exists(select 1 from public.voting_consultations c where c.id=s.consultation_id and c.archived_at is null)
   and exists(select 1 from public.voting_questions q where q.consultation_id=s.consultation_id and q.id=s.active_question_id and q.archived_at is null) then s.active_question_id else null end,
  last_question_id=case when exists(select 1 from public.voting_questions q where q.consultation_id=s.consultation_id and q.id=s.last_question_id and q.archived_at is null) then s.last_question_id else null end,
  changed_at=clock_timestamp();
end $$;

create function public.voting_live_visible(p_consultation uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.voting_consultations c where c.id=p_consultation and c.archived_at is null
  and (public.voting_can('read') or public.voting_audience_matches(c.audience)));
$$;
-- Browser clients only read ids and a timestamp; Realtime applies this policy per subscriber.
create policy voting_live_state_read on public.voting_live_state for select to authenticated using (public.voting_live_visible(consultation_id));
grant select on public.voting_live_state to authenticated;
do $realtime$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='voting_live_state') then
  alter publication supabase_realtime add table public.voting_live_state;
 end if;
end $realtime$;

create or replace function public.voting_question_result(p_question uuid,p_electorate integer) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('si',count(*) filter(where answer='si'),'no',count(*) filter(where answer='no'),'abs',count(*) filter(where answer='abs'),'total',count(*),
  'participation',case when coalesce(p_electorate,0)>0 then round(100.0*count(*)/p_electorate,1) else 0 end) from public.voting_votes where question_id=p_question;
$$;

create or replace function public.list_voting_consultations(p_admin boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare aid uuid:=public.get_effective_affiliate_id(); result jsonb; can_results boolean;
begin
 if auth.uid() is null or (p_admin and not public.voting_can('read')) or (not p_admin and aid is null) then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 can_results:=p_admin and public.voting_can('results');
 select coalesce(jsonb_agg(item order by created_at desc),'[]') into result from (
 select c.created_at,jsonb_build_object('id',c.id,'title',c.title,'closes_on',c.closes_on,'electorate',e.electorate,'published',c.published,'version',c.version,
 'open',c.published and c.closes_on >= (clock_timestamp() at time zone 'America/Hermosillo')::date,
 'audience',case when p_admin then c.audience else null end,
 'active_question_id',live.active_id,
 'last_question_id',case when p_admin then live.last_id else null end,
 'live_changed_at',live.changed_at,
 'questions',coalesce((select jsonb_agg(case when p_admin then
   jsonb_build_object('id',q.id,'title',q.title,'detail',q.detail,'sort_order',q.sort_order,'active',q.id is not distinct from live.active_id,
    'results',case when can_results then public.voting_question_result(q.id,e.electorate) else null end,
    'locked',exists(select 1 from public.voting_votes v where v.question_id=q.id))
  else
   -- Affiliates never receive results, and only the question on air carries its text.
   jsonb_build_object('id',q.id,'sort_order',q.sort_order,'active',q.id is not distinct from live.active_id,
    'title',case when q.id is not distinct from live.active_id then q.title else null end,
    'detail',case when q.id is not distinct from live.active_id then q.detail else null end,
    'mine',(select jsonb_build_object('answer',v.answer,'folio',v.folio,'cast_at',v.cast_at) from public.voting_votes v where v.question_id=q.id and v.affiliate_id=aid))
  end order by q.sort_order,q.id)
 from public.voting_questions q where q.consultation_id=c.id and q.archived_at is null),'[]')) item
 from public.voting_consultations c
 cross join lateral (select public.voting_electorate(c.audience) electorate) e
 left join lateral (select (select q.id from public.voting_questions q where q.consultation_id=s.consultation_id and q.id=s.active_question_id and q.archived_at is null) active_id,s.last_question_id last_id,s.changed_at
  from public.voting_live_state s where s.consultation_id=c.id) live on true
 where c.archived_at is null and (p_admin or (c.published and public.voting_audience_matches(c.audience)))) items;
 return jsonb_build_object('consultations',result,'can_vote',not exists(select 1 from public.get_impersonation_context()),
 'permissions',case when p_admin then (select jsonb_object_agg(x,public.voting_can(x)) from unnest(array['read','create','update','delete','publish','results','export_identified_votes']) x) else '{}'::jsonb end,
 'catalog',case when p_admin then jsonb_build_object('segments',(select coalesce(jsonb_agg(jsonb_build_object('type',catalog_type,'code',code,'label',label) order by sort_order),'[]') from public.segmentation_catalog_entries where enabled and catalog_type in ('union','employment_category')),
 'positions',(select coalesce(jsonb_agg(p order by p),'[]') from (select distinct btrim(union_position_raw) p from public.affiliates where not is_archived and nullif(btrim(union_position_raw),'') is not null) positions)) else null end);
end $$;

create or replace function public.cast_voting_vote(p_consultation uuid,p_question uuid,p_answer text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.affiliates%rowtype;c public.voting_consultations%rowtype;v public.voting_votes%rowtype;
begin
 if auth.uid() is null or exists(select 1 from public.get_impersonation_context()) then raise exception 'VOTING_IMPERSONATION_DENIED' using errcode='42501'; end if;
 select * into a from public.affiliates where id=public.get_effective_affiliate_id() and auth_user_id=auth.uid();
 if a.id is null then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 if p_answer is null or p_answer not in ('si','no','abs') then raise exception 'INVALID_VOTE'; end if;
 -- Shared consultation locks allow simultaneous voters, but serialize against editing, closing and switching the question on air.
 select * into c from public.voting_consultations where id=p_consultation for share;
 if c.id is null or c.archived_at is not null or not c.published or c.closes_on<(clock_timestamp() at time zone 'America/Hermosillo')::date or not public.voting_audience_matches(c.audience) then raise exception 'VOTING_UNAVAILABLE' using errcode='42501'; end if;
 perform 1 from public.voting_questions where id=p_question and consultation_id=c.id and archived_at is null for share;
 if not found then raise exception 'QUESTION_UNAVAILABLE'; end if;
 if not exists(select 1 from public.voting_live_state s where s.consultation_id=c.id and s.active_question_id=p_question) then raise exception 'QUESTION_NOT_ACTIVE' using errcode='42501'; end if;
 insert into public.voting_votes(consultation_id,question_id,affiliate_id,actor_auth_user_id,answer,identity_snapshot)
 values(c.id,p_question,a.id,auth.uid(),p_answer,jsonb_build_object('numero_control',a.numero_control,'name',coalesce(a.full_name,a.display_name),'email',a.historical_email_raw,'union',a.financial_union_code,'category',a.financial_employee_category_code)) returning * into v;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting','VOTE',v.id::text,'SUCCESS',jsonb_build_object('consultation_id',c.id,'question_id',p_question));
 -- The running count is shown only on the Admin live screen.
 return jsonb_build_object('answer',v.answer,'folio',v.folio,'cast_at',v.cast_at);
end $$;

create or replace function public.save_voting_consultation(p_id uuid,p_version integer,p_value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.voting_consultations%rowtype;cid uuid:=p_id; q jsonb; qid uuid; kept uuid[]:='{}'; oldq public.voting_questions%rowtype; aud jsonb:=p_value->'audience'; k text;vals jsonb;ord integer:=0; v_published boolean:=coalesce((p_value->>'published')::boolean,false); v_electorate integer;
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
 -- The payload electorate is ignored: the total of voters always comes from the audience.
 v_electorate:=public.voting_electorate(aud);
 if p_id is null then
 insert into public.voting_consultations(title,closes_on,electorate,published,audience,created_by) values(btrim(p_value->>'title'),(p_value->>'closes_on')::date,v_electorate,v_published,aud,auth.uid()) returning id into cid;
 else
 update public.voting_consultations set title=btrim(p_value->>'title'),closes_on=(p_value->>'closes_on')::date,electorate=v_electorate,published=v_published,audience=aud,version=version+1,updated_at=clock_timestamp() where id=cid;
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
 perform public.voting_live_touch(cid);
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting',case when p_id is null then 'CREATE' else 'UPDATE' end,cid::text,'SUCCESS',jsonb_build_object('published',v_published));
 if v_published is distinct from coalesce(c.published,false) then insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'voting',case when v_published then 'PUBLISH' else 'HIDE' end,cid::text,'SUCCESS'); end if;
 return cid;
end $$;

create or replace function public.voting_consultation_action(p_id uuid,p_version integer,p_action text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.voting_consultations%rowtype; cid uuid;
begin
 if p_action not in ('publish','hide','archive','duplicate') or not public.voting_can(case when p_action='archive' then 'delete' when p_action='duplicate' then 'create' else 'publish' end) or not public.voting_can('read') then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 select * into c from public.voting_consultations where id=p_id and archived_at is null for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'VOTING_CHANGED' using errcode='40001'; end if;
 cid:=c.id;
 if p_action='duplicate' then
 -- The copy starts hidden, without votes and with no question on air.
 insert into public.voting_consultations(title,closes_on,electorate,audience,created_by) values(left(c.title,232)||' (copia)',c.closes_on,public.voting_electorate(c.audience),c.audience,auth.uid()) returning id into cid;
 insert into public.voting_questions(consultation_id,title,detail,sort_order) select cid,title,detail,sort_order from public.voting_questions where consultation_id=c.id and archived_at is null;
 elsif p_action='archive' then update public.voting_consultations set archived_at=clock_timestamp(),published=false,version=version+1 where id=c.id;
 else
 if p_action='publish' and not exists(select 1 from public.voting_questions where consultation_id=c.id and archived_at is null) then raise exception 'INVALID_QUESTIONS'; end if;
 update public.voting_consultations set published=p_action='publish',version=version+1,updated_at=clock_timestamp() where id=c.id;
 end if;
 perform public.voting_live_touch(cid);
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'voting',upper(p_action),cid::text,'SUCCESS');
 return cid;
end $$;

create or replace function public.export_voting_consultation(p_id uuid,p_identified boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;c public.voting_consultations%rowtype; v_electorate integer;
begin
 if not public.voting_can(case when p_identified then 'export_identified_votes' else 'results' end) then raise exception 'VOTING_EXPORT_DENIED' using errcode='42501'; end if;
 select * into c from public.voting_consultations where id=p_id;
 if c.id is null then raise exception 'VOTING_UNAVAILABLE'; end if;
 if p_identified then
 select coalesce(jsonb_agg(jsonb_build_object('Folio',v.folio,'Fecha',to_char(v.cast_at at time zone 'America/Hermosillo','YYYY-MM-DD'),'Hora',to_char(v.cast_at at time zone 'America/Hermosillo','HH24:MI:SS'),'Consulta',c.title,'Pregunta',q.title,'Respuesta',case v.answer when 'si' then 'Sí' when 'no' then 'No' else 'Abstención' end,'Número de control',v.identity_snapshot->>'numero_control','Nombre',v.identity_snapshot->>'name','Correo',v.identity_snapshot->>'email','Sindicato',v.identity_snapshot->>'union','Nivel/tipo de empleado',v.identity_snapshot->>'category') order by v.cast_at,v.id),'[]') into result from public.voting_votes v join public.voting_questions q on q.id=v.question_id where v.consultation_id=c.id;
 else
 v_electorate:=public.voting_electorate(c.audience);
 select coalesce(jsonb_agg(jsonb_build_object('Consulta',c.title,'Pregunta',q.title,'Sí',r->'si','No',r->'no','Abstención',r->'abs','Total',r->'total','Participación %',r->'participation') order by q.sort_order,q.id),'[]') into result from public.voting_questions q cross join lateral public.voting_question_result(q.id,v_electorate) r where q.consultation_id=c.id;
 end if;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting',case when p_identified then 'EXPORT_IDENTIFIED' else 'EXPORT_RESULTS' end,c.id::text,'SUCCESS',jsonb_build_object('rows',jsonb_array_length(result)));
 return result;
end $$;

create function public.set_voting_active_question(p_consultation uuid,p_question uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.voting_consultations%rowtype; previous uuid; s public.voting_live_state%rowtype;
begin
 -- Putting a question on air is a publication act: same permission as publishing the consultation.
 if not public.voting_can('read') or not public.voting_can('publish') then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 -- Exclusive lock waits for votes in flight, so no vote is accepted for a question after it leaves the air.
 select * into c from public.voting_consultations where id=p_consultation and archived_at is null for update;
 if c.id is null then raise exception 'VOTING_UNAVAILABLE' using errcode='42501'; end if;
 if p_question is not null and not exists(select 1 from public.voting_questions where id=p_question and consultation_id=c.id and archived_at is null) then raise exception 'QUESTION_UNAVAILABLE'; end if;
 perform public.voting_live_touch(c.id);
 select active_question_id into previous from public.voting_live_state where consultation_id=c.id;
 update public.voting_live_state set active_question_id=p_question,last_question_id=coalesce(p_question,previous,last_question_id),changed_at=clock_timestamp()
 where consultation_id=c.id returning * into s;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting',case when p_question is null then 'DEACTIVATE_QUESTION' else 'ACTIVATE_QUESTION' end,c.id::text,'SUCCESS',jsonb_build_object('question_id',p_question,'previous_question_id',previous));
 return jsonb_build_object('consultation_id',c.id,'active_question_id',s.active_question_id,'last_question_id',s.last_question_id,'changed_at',s.changed_at);
end $$;

create function public.get_voting_live(p_consultation uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.voting_consultations%rowtype; s public.voting_live_state%rowtype; q public.voting_questions%rowtype; v_electorate integer; v_total integer; v_number integer; shown uuid;
begin
 if not public.voting_can('read') or not public.voting_can('results') then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 select * into c from public.voting_consultations where id=p_consultation and archived_at is null;
 if c.id is null then raise exception 'VOTING_UNAVAILABLE' using errcode='42501'; end if;
 select * into s from public.voting_live_state where consultation_id=c.id;
 v_electorate:=public.voting_electorate(c.audience);
 select count(*) into v_total from public.voting_questions where consultation_id=c.id and archived_at is null;
 -- Between questions the big screen keeps the last question that was on air.
 shown:=coalesce(s.active_question_id,s.last_question_id);
 if shown is not null then
  select * into q from public.voting_questions where id=shown and consultation_id=c.id and archived_at is null;
  if q.id is not null then
   select count(*)+1 into v_number from public.voting_questions x where x.consultation_id=c.id and x.archived_at is null and (x.sort_order<q.sort_order or (x.sort_order=q.sort_order and x.id<q.id));
  end if;
 end if;
 return jsonb_build_object('id',c.id,'title',c.title,'published',c.published,'closes_on',c.closes_on,
  'open',c.published and c.closes_on>=(clock_timestamp() at time zone 'America/Hermosillo')::date,
  'electorate',v_electorate,'question_count',v_total,'changed_at',s.changed_at,
  'active',coalesce(q.id is not null and q.id=s.active_question_id,false),
  'question',case when q.id is null then null else jsonb_build_object('id',q.id,'number',v_number,'title',q.title,'detail',q.detail,'results',public.voting_question_result(q.id,v_electorate)) end);
end $$;

create function public.count_voting_electorate(p_audience jsonb) returns integer language plpgsql stable security definer set search_path='' as $$
begin
 if not public.voting_can('read') then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 if p_audience is null or jsonb_typeof(p_audience)<>'object' or coalesce(p_audience->>'mode','') not in ('all','registered','segment','emails') then raise exception 'INVALID_AUDIENCE'; end if;
 return public.voting_electorate(p_audience);
end $$;

revoke all on function public.voting_electorate(jsonb),public.voting_live_touch(uuid) from public,anon,authenticated;
revoke all on function public.voting_live_visible(uuid),public.set_voting_active_question(uuid,uuid),public.get_voting_live(uuid),public.count_voting_electorate(jsonb) from public,anon;
grant execute on function public.voting_live_visible(uuid),public.set_voting_active_question(uuid,uuid),public.get_voting_live(uuid),public.count_voting_electorate(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
