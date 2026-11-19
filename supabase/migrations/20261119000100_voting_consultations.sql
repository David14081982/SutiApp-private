begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

-- H-SUTIAPP-VOTACIONES-CONSULTAS-004 (ADR-114). «Votaciones y consultas»: card texts per consultation, optional close date,
-- answer type per question (options with editable labels, or free text) and «respuesta definitiva» per question.
-- Additive: no consultation, question or vote is deleted or rewritten. Defaults (presentation {}, options NULL,
-- answer_kind 'options', final true, closes_on present) reproduce the previous behavior exactly.
-- Baseline = production functions on 2026-11-19 (restore point voting_restore_private.*_20261119).
do $guard$ declare expected jsonb:='{
 "voting_question_result(uuid,integer)":"f2a8130e6d3413df662e8b14b8ac09dc",
 "list_voting_consultations(boolean)":"ba2783ee52e10870ef37bb3e3a5d7dac",
 "cast_voting_vote(uuid,uuid,text)":"4d663d4bc203763476e3235d1b502d93",
 "save_voting_consultation(uuid,integer,jsonb)":"7acefa470678b2b16d401c1a909fa662",
 "voting_consultation_action(uuid,integer,text)":"b6845e680b49fed6a6f787e4d1d63e88",
 "export_voting_consultation(uuid,boolean)":"8268f0674e69120a810f1e18c186c7e5",
 "get_voting_live(uuid)":"fbd3736f291eef4772625d5dbc15f0d9",
 "list_voting_votes(uuid)":"95c3a713802450483641d75d01695d78",
 "voting_immutable_vote()":"9b94484bdeed75665eb8a4b5eaeb0d9d"
}'; k text;
begin
 for k in select jsonb_object_keys(expected) loop
  if to_regprocedure('public.'||k) is null or md5(pg_get_functiondef(('public.'||k)::regprocedure)) is distinct from expected->>k then raise exception 'VOTING_CONSULTAS_BASELINE_CHANGED:%',k; end if;
 end loop;
 if to_regprocedure('public.cast_voting_answer(uuid,uuid,text,text)') is not null then raise exception 'VOTING_CONSULTAS_ALREADY_APPLIED'; end if;
 if (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.voting_votes'::regclass and conname='voting_votes_answer_check')
  is distinct from 'CHECK ((answer = ANY (ARRAY[''si''::text, ''no''::text, ''abs''::text])))' then raise exception 'VOTING_CONSULTAS_BASELINE_CHANGED:voting_votes_answer_check'; end if;
end $guard$;

-- Close date becomes optional. Without it a consultation stays open while published; it stops receiving answers when its
-- question leaves the air or the consultation is hidden (owner decision).
alter table public.voting_consultations alter column closes_on drop not null;
-- Texts of the affiliate card. {} = the original voting texts (frontend defaults).
alter table public.voting_consultations add column presentation jsonb not null default '{}'::jsonb;
alter table public.voting_consultations add constraint voting_consultations_presentation_check check(jsonb_typeof(presentation)='object');
-- Answer type per question. options NULL = the original Sí / No / Abstención. final = the answer cannot be changed.
alter table public.voting_questions add column answer_kind text not null default 'options';
alter table public.voting_questions add column options jsonb;
alter table public.voting_questions add column final boolean not null default true;
alter table public.voting_questions add constraint voting_questions_answer_kind_check check(answer_kind in ('options','text'));
alter table public.voting_questions add constraint voting_questions_options_check check(options is null or (answer_kind='options' and case when jsonb_typeof(options)='array' then jsonb_array_length(options) between 2 and 20 else false end));
-- An answer is an option id of its question (validated by cast_voting_answer) or 'text' together with its free text.
alter table public.voting_votes drop constraint voting_votes_answer_check;
alter table public.voting_votes add constraint voting_votes_answer_check check(answer ~ '^[a-z0-9_-]{1,40}$');
alter table public.voting_votes add column answer_text text;
alter table public.voting_votes add column changed_at timestamptz;
alter table public.voting_votes add constraint voting_votes_answer_text_check check((answer='text')=(answer_text is not null) and (answer_text is null or length(btrim(answer_text)) between 1 and 500));

-- Effective options of a question: the stored list, the original Sí / No / Abstención, or none for free text.
create function public.voting_question_options(p_kind text,p_options jsonb) returns jsonb language sql immutable set search_path='' as $$
 select case when p_kind='text' then '[]'::jsonb when p_options is null then '[{"id":"si","label":"Sí"},{"id":"no","label":"No"},{"id":"abs","label":"Abstención"}]'::jsonb else p_options end;
$$;

create function public.voting_clean_options(p_kind text,p_options jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb;
begin
 if p_kind is null or p_kind not in ('options','text') then raise exception 'INVALID_QUESTION'; end if;
 if p_kind='text' then
  if p_options is not null and p_options<>'null'::jsonb then raise exception 'INVALID_OPTIONS'; end if;
  return null;
 end if;
 if p_options is null or p_options='null'::jsonb then return null; end if;
 if jsonb_typeof(p_options)<>'array' then raise exception 'INVALID_OPTIONS'; end if;
 if jsonb_array_length(p_options) not between 2 and 20 then raise exception 'INVALID_OPTIONS'; end if;
 if exists(select 1 from jsonb_array_elements(p_options) o where jsonb_typeof(o)<>'object' or jsonb_typeof(o->'id') is distinct from 'string' or jsonb_typeof(o->'label') is distinct from 'string'
  or (o->>'id') !~ '^[a-z0-9_-]{1,40}$' or o->>'id'='text' or length(btrim(o->>'label')) not between 1 and 120) then raise exception 'INVALID_OPTIONS'; end if;
 if (select count(distinct o->>'id') from jsonb_array_elements(p_options) o)<>jsonb_array_length(p_options)
  or (select count(distinct lower(btrim(o->>'label'))) from jsonb_array_elements(p_options) o)<>jsonb_array_length(p_options) then raise exception 'INVALID_OPTIONS'; end if;
 select jsonb_agg(jsonb_build_object('id',x.o->>'id','label',btrim(x.o->>'label')) order by x.n) into result from jsonb_array_elements(p_options) with ordinality x(o,n);
 -- The original Sí / No / Abstención is stored as NULL, so voting consultations keep their exact export format.
 if result=public.voting_question_options('options',null) then return null; end if;
 return result;
end $$;

create function public.voting_clean_presentation(p_value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare limits constant jsonb:='{"kind":20,"header":80,"open_label":40,"closed_label":40,"closed_title":120,"closed_text":240,"footer":400,"confirm_title":80,"confirm_button":40,"success":80}'; k text; v text; result jsonb:='{}';
begin
 if p_value is null or p_value='null'::jsonb then return '{}'::jsonb; end if;
 if jsonb_typeof(p_value)<>'object' then raise exception 'INVALID_PRESENTATION'; end if;
 for k in select jsonb_object_keys(p_value) loop
  if not (limits ? k) or jsonb_typeof(p_value->k)<>'string' then raise exception 'INVALID_PRESENTATION'; end if;
  v:=btrim(p_value->>k);
  if length(v)>(limits->>k)::integer or (k='kind' and v not in ('voting','consultation')) then raise exception 'INVALID_PRESENTATION'; end if;
  -- An empty text means «use the suggested text».
  if v<>'' then result:=result||jsonb_build_object(k,v); end if;
 end loop;
 return result;
end $$;

-- 'counts' adds the total per answer id; si/no/abs/total/participation stay for existing readers.
create or replace function public.voting_question_result(p_question uuid,p_electorate integer) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('si',count(*) filter(where answer='si'),'no',count(*) filter(where answer='no'),'abs',count(*) filter(where answer='abs'),'total',count(*),
  'participation',case when coalesce(p_electorate,0)>0 then round(100.0*count(*)/p_electorate,1) else 0 end,
  'counts',coalesce((select jsonb_object_agg(x.answer,x.n) from (select answer,count(*) n from public.voting_votes where question_id=p_question group by answer) x),'{}'::jsonb))
 from public.voting_votes where question_id=p_question;
$$;

create or replace function public.list_voting_consultations(p_admin boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare aid uuid:=public.get_effective_affiliate_id(); result jsonb; can_results boolean;
begin
 if auth.uid() is null or (p_admin and not public.voting_can('read')) or (not p_admin and aid is null) then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 can_results:=p_admin and public.voting_can('results');
 select coalesce(jsonb_agg(item order by created_at desc),'[]') into result from (
 select c.created_at,jsonb_build_object('id',c.id,'title',c.title,'closes_on',c.closes_on,'electorate',e.electorate,'published',c.published,'version',c.version,
 'open',c.published and (c.closes_on is null or c.closes_on >= (clock_timestamp() at time zone 'America/Hermosillo')::date),
 'presentation',c.presentation,
 'audience',case when p_admin then c.audience else null end,
 'active_question_id',live.active_id,
 'last_question_id',case when p_admin then live.last_id else null end,
 'live_changed_at',live.changed_at,
 'questions',coalesce((select jsonb_agg(case when p_admin then
   jsonb_build_object('id',q.id,'title',q.title,'detail',q.detail,'sort_order',q.sort_order,'active',q.id is not distinct from live.active_id,
    'answer_kind',q.answer_kind,'options',public.voting_question_options(q.answer_kind,q.options),'final',q.final,
    'results',case when can_results then public.voting_question_result(q.id,e.electorate) else null end,
    'locked',exists(select 1 from public.voting_votes v where v.question_id=q.id))
  else
   -- Affiliates never receive results, and only the question on air carries its text and its answer options.
   jsonb_build_object('id',q.id,'sort_order',q.sort_order,'active',q.id is not distinct from live.active_id,
    'title',case when q.id is not distinct from live.active_id then q.title else null end,
    'detail',case when q.id is not distinct from live.active_id then q.detail else null end,
    'answer_kind',case when q.id is not distinct from live.active_id then q.answer_kind else null end,
    'options',case when q.id is not distinct from live.active_id then public.voting_question_options(q.answer_kind,q.options) else null end,
    'final',case when q.id is not distinct from live.active_id then q.final else null end,
    'mine',(select jsonb_build_object('answer',v.answer,'answer_text',v.answer_text,'folio',v.folio,'cast_at',v.cast_at) from public.voting_votes v where v.question_id=q.id and v.affiliate_id=aid))
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

-- Single writer of answers. Same identity, audience, open and on-air rules as before; the answer must be an option of the
-- question (or free text for a free-text question). A non-final answer may be changed while its question is on air.
create function public.cast_voting_answer(p_consultation uuid,p_question uuid,p_answer text,p_text text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.affiliates%rowtype;c public.voting_consultations%rowtype;q public.voting_questions%rowtype;v public.voting_votes%rowtype;v_text text:=nullif(btrim(coalesce(p_text,'')),'');
begin
 if auth.uid() is null or exists(select 1 from public.get_impersonation_context()) then raise exception 'VOTING_IMPERSONATION_DENIED' using errcode='42501'; end if;
 select * into a from public.affiliates where id=public.get_effective_affiliate_id() and auth_user_id=auth.uid();
 if a.id is null then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 if p_answer is null then raise exception 'INVALID_VOTE'; end if;
 -- Shared consultation locks allow simultaneous voters, but serialize against editing, closing and switching the question on air.
 select * into c from public.voting_consultations where id=p_consultation for share;
 if c.id is null or c.archived_at is not null or not c.published or (c.closes_on is not null and c.closes_on<(clock_timestamp() at time zone 'America/Hermosillo')::date) or not public.voting_audience_matches(c.audience) then raise exception 'VOTING_UNAVAILABLE' using errcode='42501'; end if;
 select * into q from public.voting_questions where id=p_question and consultation_id=c.id and archived_at is null for share;
 if q.id is null then raise exception 'QUESTION_UNAVAILABLE'; end if;
 if not exists(select 1 from public.voting_live_state s where s.consultation_id=c.id and s.active_question_id=p_question) then raise exception 'QUESTION_NOT_ACTIVE' using errcode='42501'; end if;
 if q.answer_kind='text' then
  if p_answer<>'text' or v_text is null or length(v_text)>500 then raise exception 'INVALID_VOTE'; end if;
 elsif v_text is not null or not exists(select 1 from jsonb_array_elements(public.voting_question_options(q.answer_kind,q.options)) o where o->>'id'=p_answer) then
  raise exception 'INVALID_VOTE';
 end if;
 if not q.final then
  select * into v from public.voting_votes where affiliate_id=a.id and consultation_id=c.id and question_id=q.id for update;
  if v.id is not null then
   -- Same row and folio; only the answer changes. The change is audited without its content.
   if v.answer is distinct from p_answer or v.answer_text is distinct from v_text then
    perform set_config('suti.voting_change_answer','on',true);
    update public.voting_votes set answer=p_answer,answer_text=v_text,changed_at=clock_timestamp() where id=v.id returning * into v;
    perform set_config('suti.voting_change_answer','off',true);
    insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting','CHANGE_VOTE',v.id::text,'SUCCESS',jsonb_build_object('consultation_id',c.id,'question_id',q.id));
   end if;
   return jsonb_build_object('answer',v.answer,'answer_text',v.answer_text,'folio',v.folio,'cast_at',v.cast_at,'changed_at',v.changed_at);
  end if;
 end if;
 insert into public.voting_votes(consultation_id,question_id,affiliate_id,actor_auth_user_id,answer,answer_text,identity_snapshot)
 values(c.id,q.id,a.id,auth.uid(),p_answer,v_text,jsonb_build_object('numero_control',a.numero_control,'name',coalesce(a.full_name,a.display_name),'email',a.historical_email_raw,'union',a.financial_union_code,'category',a.financial_employee_category_code)) returning * into v;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting','VOTE',v.id::text,'SUCCESS',jsonb_build_object('consultation_id',c.id,'question_id',q.id));
 -- The running count is shown only on the Admin live screen.
 return jsonb_build_object('answer',v.answer,'answer_text',v.answer_text,'folio',v.folio,'cast_at',v.cast_at,'changed_at',v.changed_at);
end $$;

-- Kept for clients published before cast_voting_answer: same rules, no free text.
create or replace function public.cast_voting_vote(p_consultation uuid,p_question uuid,p_answer text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 return public.cast_voting_answer(p_consultation,p_question,p_answer,null);
end $$;

create or replace function public.voting_immutable_vote() returns trigger language plpgsql set search_path='' as $$
begin
 -- The transaction-local gate is opened only by delete_voting_votes (browsers have no table privileges on voting_votes).
 if tg_op='DELETE' and current_setting('suti.voting_delete_votes',true)='on' then return old; end if;
 -- Changing a non-final answer: the gate is opened only by cast_voting_answer, and only answer, answer_text and changed_at move.
 if tg_op='UPDATE' and current_setting('suti.voting_change_answer',true)='on' and new.changed_at is not null and new.changed_at is distinct from old.changed_at
  and (new.id,new.consultation_id,new.question_id,new.affiliate_id,new.actor_auth_user_id,new.folio,new.cast_at,new.identity_snapshot)
   is not distinct from (old.id,old.consultation_id,old.question_id,old.affiliate_id,old.actor_auth_user_id,old.folio,old.cast_at,old.identity_snapshot)
  and exists(select 1 from public.voting_questions q where q.id=old.question_id and not q.final) then return new; end if;
 raise exception 'VOTE_IS_FINAL' using errcode='42501';
end $$;

create or replace function public.save_voting_consultation(p_id uuid,p_version integer,p_value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.voting_consultations%rowtype;cid uuid:=p_id; q jsonb; qid uuid; kept uuid[]:='{}'; oldq public.voting_questions%rowtype; aud jsonb:=p_value->'audience'; k text;vals jsonb;ord integer:=0; v_published boolean:=coalesce((p_value->>'published')::boolean,false); v_electorate integer;
 v_closes date; v_presentation jsonb; v_kind text; v_options jsonb; v_final boolean;
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
 -- No close date = open while published.
 v_closes:=nullif(btrim(coalesce(p_value->>'closes_on','')),'')::date;
 -- Clients that do not send card texts keep the stored ones.
 v_presentation:=case when p_value ? 'presentation' then public.voting_clean_presentation(p_value->'presentation') else coalesce(c.presentation,'{}'::jsonb) end;
 if p_id is null then
 insert into public.voting_consultations(title,closes_on,electorate,published,audience,presentation,created_by) values(btrim(p_value->>'title'),v_closes,v_electorate,v_published,aud,v_presentation,auth.uid()) returning id into cid;
 else
 update public.voting_consultations set title=btrim(p_value->>'title'),closes_on=v_closes,electorate=v_electorate,published=v_published,audience=aud,presentation=v_presentation,version=version+1,updated_at=clock_timestamp() where id=cid;
 end if;
 for q in select value from jsonb_array_elements(p_value->'questions') loop
 qid:=nullif(q->>'id','')::uuid;
 oldq:=null;
 if qid is not null then
 select * into oldq from public.voting_questions where id=qid and consultation_id=cid and archived_at is null for update;
 if oldq.id is null or qid=any(kept) then raise exception 'INVALID_QUESTION'; end if;
 end if;
 -- Clients that do not send the answer type keep the stored one; new questions default to Sí / No / Abstención, final.
 if q ? 'answer_kind' then
 v_kind:=q->>'answer_kind'; v_options:=public.voting_clean_options(v_kind,q->'options'); v_final:=coalesce((q->>'final')::boolean,true);
 elsif oldq.id is not null then
 v_kind:=oldq.answer_kind; v_options:=oldq.options; v_final:=oldq.final;
 else
 v_kind:='options'; v_options:=null; v_final:=true;
 end if;
 if qid is null then
 insert into public.voting_questions(consultation_id,title,detail,sort_order,answer_kind,options,final) values(cid,btrim(q->>'title'),coalesce(q->>'detail',''),ord,v_kind,v_options,v_final) returning id into qid;
 else
 -- A question with answers keeps its text, its answer type and its options.
 if exists(select 1 from public.voting_votes where question_id=qid) and (oldq.title is distinct from btrim(q->>'title') or oldq.detail is distinct from coalesce(q->>'detail','')
  or oldq.answer_kind is distinct from v_kind or oldq.options is distinct from v_options) then raise exception 'QUESTION_HAS_VOTES'; end if;
 update public.voting_questions set title=btrim(q->>'title'),detail=coalesce(q->>'detail',''),sort_order=ord,answer_kind=v_kind,options=v_options,final=v_final where id=qid;
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
 -- The copy starts hidden, without votes and with no question on air; texts, close date and answer types are copied.
 insert into public.voting_consultations(title,closes_on,electorate,audience,presentation,created_by) values(left(c.title,232)||' (copia)',c.closes_on,public.voting_electorate(c.audience),c.audience,c.presentation,auth.uid()) returning id into cid;
 insert into public.voting_questions(consultation_id,title,detail,sort_order,answer_kind,options,final) select cid,title,detail,sort_order,answer_kind,options,final from public.voting_questions where consultation_id=c.id and archived_at is null;
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
 -- «Respuesta» = label of the chosen option (Sí / No / Abstención for original questions) or the free text.
 select coalesce(jsonb_agg(jsonb_build_object('Folio',v.folio,'Fecha',to_char(v.cast_at at time zone 'America/Hermosillo','YYYY-MM-DD'),'Hora',to_char(v.cast_at at time zone 'America/Hermosillo','HH24:MI:SS'),'Consulta',c.title,'Pregunta',q.title,
  'Respuesta',coalesce(v.answer_text,(select o->>'label' from jsonb_array_elements(public.voting_question_options(q.answer_kind,q.options)) o where o->>'id'=v.answer limit 1),v.answer),
  'Número de control',v.identity_snapshot->>'numero_control','Nombre',v.identity_snapshot->>'name','Correo',v.identity_snapshot->>'email','Sindicato',v.identity_snapshot->>'union','Nivel/tipo de empleado',v.identity_snapshot->>'category') order by v.cast_at,v.id),'[]') into result
 from public.voting_votes v join public.voting_questions q on q.id=v.question_id where v.consultation_id=c.id;
 else
 v_electorate:=public.voting_electorate(c.audience);
 if not exists(select 1 from public.voting_questions q where q.consultation_id=c.id and (q.answer_kind<>'options' or q.options is not null)) then
 -- Only original Sí / No / Abstención questions: the original format, unchanged.
 select coalesce(jsonb_agg(jsonb_build_object('Consulta',c.title,'Pregunta',q.title,'Sí',r->'si','No',r->'no','Abstención',r->'abs','Total',r->'total','Participación %',r->'participation') order by q.sort_order,q.id),'[]') into result from public.voting_questions q cross join lateral public.voting_question_result(q.id,v_electorate) r where q.consultation_id=c.id;
 else
 -- One row per answer option; a free-text question gives one row with its number of answers (never the texts).
 select coalesce(jsonb_agg(x.line order by x.qorder,x.qid,x.n),'[]') into result from (
  select q.sort_order qorder,q.id qid,o.n,jsonb_build_object('Consulta',c.title,'Pregunta',q.title,
   'Respuesta',case when q.answer_kind='text' then 'Respuesta libre' else o.opt->>'label' end,
   'Respuestas',case when q.answer_kind='text' then r->'total' else coalesce(r->'counts'->(o.opt->>'id'),'0'::jsonb) end,
   '% de respuestas',case when q.answer_kind='text' then null when (r->>'total')::integer>0 then to_jsonb(round(100.0*coalesce((r->'counts'->>(o.opt->>'id'))::integer,0)/(r->>'total')::integer,1)) else to_jsonb(0) end,
   'Total',r->'total','Participación %',r->'participation') line
  from public.voting_questions q cross join lateral public.voting_question_result(q.id,v_electorate) r
  cross join lateral jsonb_array_elements(case when q.answer_kind='text' then '[{}]'::jsonb else public.voting_question_options(q.answer_kind,q.options) end) with ordinality o(opt,n)
  where q.consultation_id=c.id) x;
 end if;
 end if;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details) values(auth.uid(),'voting',case when p_identified then 'EXPORT_IDENTIFIED' else 'EXPORT_RESULTS' end,c.id::text,'SUCCESS',jsonb_build_object('rows',jsonb_array_length(result)));
 return result;
end $$;

create or replace function public.get_voting_live(p_consultation uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 -- Free-text answers reach the big screen only as a count.
 return jsonb_build_object('id',c.id,'title',c.title,'published',c.published,'closes_on',c.closes_on,
  'open',c.published and (c.closes_on is null or c.closes_on>=(clock_timestamp() at time zone 'America/Hermosillo')::date),
  'presentation',c.presentation,
  'electorate',v_electorate,'question_count',v_total,'changed_at',s.changed_at,
  'active',coalesce(q.id is not null and q.id=s.active_question_id,false),
  'question',case when q.id is null then null else jsonb_build_object('id',q.id,'number',v_number,'title',q.title,'detail',q.detail,
   'answer_kind',q.answer_kind,'options',public.voting_question_options(q.answer_kind,q.options),'results',public.voting_question_result(q.id,v_electorate)) end);
end $$;

create or replace function public.list_voting_votes(p_consultation uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.voting_consultations%rowtype; result jsonb;
begin
 -- Seeing who voted what is the same grant as the nominal export.
 if not public.voting_can('read') or not public.voting_can('export_identified_votes') then raise exception 'VOTING_DENIED' using errcode='42501'; end if;
 select * into c from public.voting_consultations where id=p_consultation and archived_at is null;
 if c.id is null then raise exception 'VOTING_UNAVAILABLE' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'folio',v.folio,'cast_at',v.cast_at,'answer',v.answer,'affiliate_id',v.affiliate_id,
   'answer_text',v.answer_text,'answer_kind',q.answer_kind,
   'answer_label',(select o->>'label' from jsonb_array_elements(public.voting_question_options(q.answer_kind,q.options)) o where o->>'id'=v.answer limit 1),
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

-- Admin menu and role permissions screen: «Votaciones» → «Votaciones y consultas» (owner decision). Keys are unchanged.
update public.admin_section_definitions set display_name='Votaciones y consultas' where section_key='admin_votaciones' and display_name='Votaciones';

revoke all on function public.voting_question_options(text,jsonb),public.voting_clean_options(text,jsonb),public.voting_clean_presentation(jsonb) from public,anon,authenticated;
revoke all on function public.cast_voting_answer(uuid,uuid,text,text) from public,anon;
grant execute on function public.cast_voting_answer(uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
