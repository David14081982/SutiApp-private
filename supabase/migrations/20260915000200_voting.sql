begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

create table public.voting_consultations (
 id uuid primary key default extensions.gen_random_uuid(),
 title text not null check(length(btrim(title)) between 1 and 240),
 closes_on date not null, electorate integer not null check(electorate>0),
 published boolean not null default false,
 audience jsonb not null default '{"mode":"all","unions":[],"categories":[],"positions":[],"emails":[]}',
 archived_at timestamptz, version integer not null default 1,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (audience->>'mode' in ('all','registered','segment','emails'))
);
create table public.voting_questions (
 id uuid primary key default extensions.gen_random_uuid(),
 consultation_id uuid not null references public.voting_consultations(id) on delete restrict,
 title text not null check(length(btrim(title)) between 1 and 1000),
 detail text not null default '' check(length(detail)<=4000),
 sort_order integer not null check(sort_order>=0), archived_at timestamptz,
 unique(consultation_id,id)
);
create index voting_questions_order on public.voting_questions(consultation_id,sort_order) where archived_at is null;
create table public.voting_votes (
 id uuid primary key default extensions.gen_random_uuid(),
 consultation_id uuid not null, question_id uuid not null,
 affiliate_id uuid not null references public.affiliates(id) on delete restrict,
 actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
 answer text not null check(answer in ('si','no','abs')),
 folio text not null unique default ('V-'||extensions.gen_random_uuid()::text),
 cast_at timestamptz not null default clock_timestamp(),
 identity_snapshot jsonb not null,
 foreign key(consultation_id,question_id) references public.voting_questions(consultation_id,id) on delete restrict,
 unique(affiliate_id,consultation_id,question_id)
);
create index voting_votes_question on public.voting_votes(question_id,answer);
create index voting_votes_export on public.voting_votes(consultation_id,cast_at,id);

alter table public.voting_consultations enable row level security;
alter table public.voting_consultations force row level security;
alter table public.voting_questions enable row level security;
alter table public.voting_questions force row level security;
alter table public.voting_votes enable row level security;
alter table public.voting_votes force row level security;
revoke all on public.voting_consultations,public.voting_questions,public.voting_votes from public,anon,authenticated;

-- Reuse the existing account/screen/action catalog. Nominal export is a separate grant.
insert into public.admin_section_definitions(section_key,display_name,data_boundary,allowed_actions,enforcement_status,module_key,module_read_permissions,module_write_permissions,module_sections,module_total_only,module_order) values
 ('admin_votaciones','Votaciones','Consultas, preguntas y resultados agregados',array['read','update'],'ENFORCED','votaciones',array['votaciones.read','votaciones.results'],array['votaciones.create','votaciones.update','votaciones.delete','votaciones.publish'],array[]::text[],false,34),
 ('admin_votaciones_nominal','Votaciones · votos identificados','Permiso independiente para conocer y exportar votos nominales',array['read','update'],'ENFORCED','votaciones_nominal',array['votaciones.read'],array['votaciones.export_identified_votes'],array[]::text[],false,35),
 ('votaciones','Votaciones · acciones','Consultas y preguntas',array['read','create','update','delete','publish'],'ENFORCED',null,'{}','{}','{}',false,null),
 ('votaciones_results','Votaciones · resultados','Conteos agregados',array['read','export'],'ENFORCED',null,'{}','{}','{}',false,null),
 ('votaciones_identified','Votaciones · exportación nominal','Votos identificados, permiso separado',array['export'],'ENFORCED',null,'{}','{}','{}',false,null);
insert into public.admin_role_permissions(role_id,permission)
 select r.id,p from public.admin_roles r cross join unnest(array['votaciones.read','votaciones.create','votaciones.update','votaciones.delete','votaciones.publish','votaciones.results','votaciones.export_identified_votes']) p
 where r.code='principal_admin' on conflict do nothing;

create function public.voting_can(p_action text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.has_admin_permission('votaciones.'||p_action)
 or case when p_action='results' then public.has_section_action('votaciones_results','read')
 when p_action='export_identified_votes' then public.has_section_action('votaciones_identified','export')
 else public.has_section_action('votaciones',p_action) end);
$$;

create function public.voting_audience_matches(p_audience jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare a public.affiliates%rowtype; unions text[]; categories text[]; positions text[]; mode text:=p_audience->>'mode';
begin
 select * into a from public.affiliates where id=public.get_effective_affiliate_id();
 if a.id is null then return false; end if;
 if mode in ('all','registered') then return true; end if;
 if mode='emails' then return exists(select 1 from jsonb_array_elements_text(p_audience->'emails') x where x=lower(btrim(a.historical_email_raw))); end if;
 if mode<>'segment' then return false; end if;
 select coalesce(array_agg(x),'{}') into unions from jsonb_array_elements_text(p_audience->'unions') x;
 select coalesce(array_agg(x),'{}') into categories from jsonb_array_elements_text(p_audience->'categories') x;
 select coalesce(array_agg(x),'{}') into positions from jsonb_array_elements_text(p_audience->'positions') x;
 -- Existing engine is actor-based; preview uses the same authoritative codes for the effective affiliate.
 return (case when a.auth_user_id=auth.uid() then public.matches_current_affiliate_audience('segment',unions,categories,'{}','{}')
 else (cardinality(unions)=0 or a.financial_union_code=any(unions)) and (cardinality(categories)=0 or a.financial_employee_category_code=any(categories)) end)
 and (cardinality(positions)=0 or btrim(a.union_position_raw)=any(positions));
end $$;

create function public.voting_question_result(p_question uuid,p_electorate integer) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('si',count(*) filter(where answer='si'),'no',count(*) filter(where answer='no'),'abs',count(*) filter(where answer='abs'),'total',count(*),'participation',round(100.0*count(*)/p_electorate,1)) from public.voting_votes where question_id=p_question;
$$;

create function public.list_voting_consultations(p_admin boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
end $$;

create function public.voting_immutable_vote() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'VOTE_IS_FINAL' using errcode='42501'; end $$;
create trigger voting_votes_immutable before update or delete on public.voting_votes for each row execute function public.voting_immutable_vote();

create function public.cast_voting_vote(p_consultation uuid,p_question uuid,p_answer text) returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;

create function public.save_voting_consultation(p_id uuid,p_version integer,p_value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
end $$;

create function public.voting_consultation_action(p_id uuid,p_version integer,p_action text) returns uuid language plpgsql security definer set search_path='' as $$
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
end $$;

create function public.export_voting_consultation(p_id uuid,p_identified boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;

revoke all on function public.voting_can(text),public.voting_audience_matches(jsonb),public.voting_question_result(uuid,integer),public.voting_immutable_vote() from public,anon,authenticated;
revoke all on function public.list_voting_consultations(boolean),public.cast_voting_vote(uuid,uuid,text),public.save_voting_consultation(uuid,integer,jsonb),public.voting_consultation_action(uuid,integer,text),public.export_voting_consultation(uuid,boolean) from public,anon;
grant execute on function public.list_voting_consultations(boolean),public.cast_voting_vote(uuid,uuid,text),public.save_voting_consultation(uuid,integer,jsonb),public.voting_consultation_action(uuid,integer,text),public.export_voting_consultation(uuid,boolean) to authenticated;
commit;
