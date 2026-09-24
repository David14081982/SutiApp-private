-- OWNER: real editing from Secciones, Menús and Formularios. Additive authority.
-- No assignment/role/financial/account rows are changed. Not applied automatically.
begin;
set local lock_timeout='2s';set local statement_timeout='60s';
create table public.app_editorial_screens(
 screen_id text primary key, label text not null, navigable boolean not null default false,
 version bigint not null default 1 check(version>0), nodes jsonb not null default '[]' check(jsonb_typeof(nodes)='array'),
 updated_at timestamptz not null default now()
);
create table public.app_editorial_revisions(
 screen_id text not null references public.app_editorial_screens on delete restrict,
 version bigint not null, nodes jsonb not null, actor_auth_user_id uuid references auth.users on delete restrict,
 created_at timestamptz not null default now(), primary key(screen_id,version)
);
create table public.app_editorial_submissions(
 id uuid primary key, screen_id text not null, version bigint not null, node_id text not null,
 auth_user_id uuid not null references auth.users on delete restrict, answers jsonb not null check(jsonb_typeof(answers)='object'),
 created_at timestamptz not null default now(),
 foreign key(screen_id,version) references public.app_editorial_revisions on delete restrict
);
create index app_editorial_submissions_actor on public.app_editorial_submissions(auth_user_id,created_at desc);
create index app_editorial_submissions_form on public.app_editorial_submissions(screen_id,node_id,created_at desc);
insert into public.app_editorial_screens(screen_id,label,navigable) values
 ('home','Inicio',true),('financiera','Mi Financiera',true),('convenios','Convenios',true),
 ('historial','Mi Historial',true),('credencial','Mi Credencial',true),('documentos','Mis Documentos',true),
 ('perfil','Mi Perfil',true),('terreno','Suti Terrenos',true),('notifs','Notificaciones',true),
 ('loan','Solicitud de préstamo',false),('savings','Mi Ahorro',true),('product','Detalle de producto',false),
 ('convenio','Detalle de convenio',false),('tracking','Seguimiento de solicitud',false),
 ('modulo','Tu Sindicato',false),('articulo','Artículo',false),('catitem','Detalle de catálogo',false),
 ('membership','Afiliación',true),('settings','Configuración',true),('investment','Suti Inversión',true);
update public.app_editorial_screens set nodes='[
 {"id":"banner_convenio","type":"component","builtin":"banner_convenio","label":"Banner de Inicio","visible":true,"parentId":null,"order":1,"audience":{"mode":"all"}},
 {"id":"ecosistema","type":"component","builtin":"ecosistema","label":"Votaciones y ecosistema","visible":true,"parentId":null,"order":2,"audience":{"mode":"all"}},
 {"id":"comite","type":"component","builtin":"comite","label":"Comité","visible":true,"parentId":null,"order":3,"audience":{"mode":"all"}},
 {"id":"noticias","type":"component","builtin":"noticias","label":"Noticias","visible":true,"parentId":null,"order":4,"audience":{"mode":"all"}}
]' where screen_id='home';
insert into public.app_editorial_revisions(screen_id,version,nodes) select screen_id,version,nodes from public.app_editorial_screens;

create function public.editorial_module(p_type text) returns text language sql immutable set search_path='' as $$
 select case when p_type in('menu','button') then 'menus' when p_type='form' then 'formularios'
 when p_type in('section','container','component','banner') then 'secciones' else null end
$$;
create function public.can_edit_editorial(p_type text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.editorial_module(p_type) is not null and (
 public.has_admin_module(public.editorial_module(p_type),'update') or
 (public.has_admin_permission('content.write') and public.admin_module_boundary(array[public.editorial_module(p_type)],'update')))
$$;
create function public.can_read_editorial_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.has_admin_permission('content.read')
 and public.admin_module_boundary(array['secciones','menus','formularios'])
$$;
create function public.editorial_audience_matches(p_audience jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select public.matches_current_affiliate_audience(coalesce(p_audience->>'mode','all'),
 array(select jsonb_array_elements_text(coalesce(p_audience->'union_codes','[]'))),
 array(select jsonb_array_elements_text(coalesce(p_audience->'employment_category_codes','[]'))),
 array(select jsonb_array_elements_text(coalesce(p_audience->'gender_codes','[]'))),
 array(select jsonb_array_elements_text(coalesce(p_audience->'tag_codes','[]'))))
$$;
create function public.validate_editorial_nodes(p_screen text,p_nodes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare n jsonb;f jsonb;v text;walk text;seen text[];k text;
begin
 if jsonb_typeof(p_nodes) is distinct from 'array' or jsonb_array_length(p_nodes)>100 or octet_length(p_nodes::text)>200000 then raise exception 'EDITORIAL_SIZE_INVALID';end if;
 if exists(select 1 from jsonb_array_elements(p_nodes) candidate group by candidate->>'id' having count(*)>1) then raise exception 'EDITORIAL_DUPLICATE_ID';end if;
 for n in select * from jsonb_array_elements(p_nodes) loop
  if jsonb_typeof(n)<>'object' or coalesce(n->>'id','')!~'^[a-zA-Z0-9_-]{1,80}$' or public.editorial_module(n->>'type') is null
   or length(btrim(coalesce(n->>'label',''))) not between 1 and 120 or jsonb_typeof(n->'visible') is distinct from 'boolean'
   or jsonb_typeof(n->'order') is distinct from 'number' or (n->>'order')::numeric not between 0 and 10000 then raise exception 'EDITORIAL_NODE_INVALID';end if;
  if exists(select 1 from jsonb_object_keys(n) field_key where field_key not in('id','type','builtin','label','visible','parentId','order','audience','text','target','fields','submitLabel')) then raise exception 'EDITORIAL_UNKNOWN_FIELD';end if;
  if length(coalesce(n->>'text',''))>10000 then raise exception 'EDITORIAL_TEXT_TOO_LONG';end if;
  if n?'builtin' and not(p_screen='home' and n->>'id'=n->>'builtin' and n->>'builtin' in('banner_convenio','ecosistema','comite','noticias') and n->>'type'='component' and n->>'parentId' is null) then raise exception 'EDITORIAL_BUILTIN_INVALID';end if;
  walk:=n->>'parentId';seen:=array[n->>'id'];
  while walk is not null loop
   if walk=any(seen) then raise exception 'EDITORIAL_PARENT_CYCLE';end if;
   seen:=array_append(seen,walk);
   select x->>'parentId' into walk from jsonb_array_elements(p_nodes) x where x->>'id'=walk and x->>'type' in('section','container');
   if not found then raise exception 'EDITORIAL_PARENT_INVALID';end if;
   if cardinality(seen)>5 then raise exception 'EDITORIAL_DEPTH_LIMIT';end if;
  end loop;
  if jsonb_typeof(n->'audience') is distinct from 'object' or coalesce(n->'audience'->>'mode','') not in('all','registered','segment') then raise exception 'EDITORIAL_AUDIENCE_INVALID';end if;
  for k in select jsonb_object_keys(n->'audience') loop
   if k not in('mode','union_codes','employment_category_codes','gender_codes','tag_codes') then raise exception 'EDITORIAL_AUDIENCE_FIELD_INVALID';end if;
   if k<>'mode' then
    if jsonb_typeof(n->'audience'->k)<>'array' or jsonb_array_length(n->'audience'->k)>100 then raise exception 'EDITORIAL_AUDIENCE_INVALID';end if;
    for v in select jsonb_array_elements_text(n->'audience'->k) loop
     if not exists(select 1 from public.segmentation_catalog_entries c where c.code=v and c.enabled and c.catalog_type=case k when 'union_codes' then 'union' when 'employment_category_codes' then 'employment_category' when 'gender_codes' then 'gender' else 'tag' end) then raise exception 'EDITORIAL_SEGMENT_UNKNOWN';end if;
    end loop;
   end if;
  end loop;
  if n->>'type' in('menu','button') and not exists(select 1 from public.app_editorial_screens where screen_id=n->>'target' and navigable) then raise exception 'EDITORIAL_TARGET_INVALID';end if;
  if n->>'type'='form' then
   if jsonb_typeof(n->'fields') is distinct from 'array' or jsonb_array_length(n->'fields') not between 1 and 25 then raise exception 'EDITORIAL_FORM_INVALID';end if;
   if exists(select 1 from jsonb_array_elements(n->'fields') x group by x->>'id' having count(*)>1) then raise exception 'EDITORIAL_FIELD_DUPLICATE';end if;
   for f in select * from jsonb_array_elements(n->'fields') loop
    if coalesce(f->>'id','')!~'^[a-zA-Z][a-zA-Z0-9_]{0,49}$' or length(btrim(coalesce(f->>'label',''))) not between 1 and 120
     or coalesce(f->>'type','') not in('text','textarea','email','tel','date','select','checkbox') or jsonb_typeof(f->'required') is distinct from 'boolean'
     or exists(select 1 from jsonb_object_keys(f) field_key where field_key not in('id','label','type','required','options')) then raise exception 'EDITORIAL_FIELD_INVALID';end if;
    if f->>'type'='select' then
     if jsonb_typeof(f->'options') is distinct from 'array' or jsonb_array_length(f->'options') not between 1 and 50 then raise exception 'EDITORIAL_OPTIONS_INVALID';end if;
     if exists(select 1 from jsonb_array_elements(f->'options') o where jsonb_typeof(o)<>'string' or length(btrim(o#>>'{}')) not between 1 and 150) then raise exception 'EDITORIAL_OPTIONS_INVALID';end if;
    end if;
   end loop;
  end if;
 end loop;
end $$;
create function public.get_app_editorial(p_screen text,p_admin boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.app_editorial_screens%rowtype;result jsonb;
begin
 if p_admin and not public.can_read_editorial_admin() then raise exception 'EDITORIAL_ADMIN_DENIED';end if;
 select * into s from public.app_editorial_screens where screen_id=p_screen;
 if not found then raise exception 'EDITORIAL_SCREEN_UNKNOWN';end if;
 if p_admin then result:=s.nodes;
 else
  if not public.can_access_app_screen(p_screen) then raise exception 'EDITORIAL_SCREEN_DENIED';end if;
  with recursive visible(node) as (
   select n from jsonb_array_elements(s.nodes) n where n->>'parentId' is null and (n->>'visible')::boolean and public.editorial_audience_matches(n->'audience')
   union all select n from jsonb_array_elements(s.nodes) n join visible v on n->>'parentId'=v.node->>'id' where (n->>'visible')::boolean and public.editorial_audience_matches(n->'audience')
  ) select coalesce(jsonb_agg(node order by (node->>'order')::numeric,node->>'id'),'[]') into result from visible;
 end if;
 return jsonb_build_object('screen',s.screen_id,'version',s.version,'nodes',result,'editableTypes',case when p_admin then
 (select coalesce(jsonb_agg(t),'[]') from unnest(array['section','container','component','banner','menu','button','form']) t where public.can_edit_editorial(t)) else '[]'::jsonb end);
end $$;
create function public.list_app_editorial_screens() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',screen_id,'label',label,'navigable',navigable) order by label),'[]') from public.app_editorial_screens
$$;
create function public.list_app_editorial_segments() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_read_editorial_admin() then raise exception 'EDITORIAL_ADMIN_DENIED';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('type',catalog_type,'code',code,'label',label) order by catalog_type,label),'[]') from public.segmentation_catalog_entries where enabled and catalog_type in('union','employment_category','gender','tag'));
end $$;
create function public.save_app_editorial(p_screen text,p_expected_version bigint,p_nodes jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.app_editorial_screens%rowtype;o jsonb;n jsonb;ctx public.impersonation_sessions%rowtype;
begin
 if not public.can_read_editorial_admin() then raise exception 'EDITORIAL_ADMIN_DENIED';end if;
 select * into s from public.app_editorial_screens where screen_id=p_screen for update;
 if not found then raise exception 'EDITORIAL_SCREEN_UNKNOWN';end if;
 if p_expected_version is distinct from s.version then raise exception 'EDITORIAL_VERSION_CONFLICT';end if;
 perform public.validate_editorial_nodes(p_screen,p_nodes);
 -- Check BOTH old and new types; parent deletions/moves cannot bypass other panels.
 for o,n in select a.node,b.node from jsonb_array_elements(s.nodes) a(node) full join jsonb_array_elements(p_nodes) b(node) on a.node->>'id'=b.node->>'id' where a.node is distinct from b.node loop
  if (o is not null and not public.can_edit_editorial(o->>'type')) or (n is not null and not public.can_edit_editorial(n->>'type')) then raise exception 'EDITORIAL_MODULE_DENIED';end if;
  if o?'builtin' and (n is null or n->>'builtin' is distinct from o->>'builtin') then raise exception 'EDITORIAL_BUILTIN_PRESERVED';end if;
  if n?'builtin' and o is null then raise exception 'EDITORIAL_BUILTIN_CREATE_DENIED';end if;
 end loop;
 if p_nodes=s.nodes then return public.get_app_editorial(p_screen,true);end if;
 update public.app_editorial_screens set nodes=p_nodes,version=version+1,updated_at=now() where screen_id=p_screen returning * into s;
 insert into public.app_editorial_revisions(screen_id,version,nodes,actor_auth_user_id) values(p_screen,s.version,s.nodes,auth.uid());
 select * into ctx from public.impersonation_sessions where actor_real_auth_user_id=auth.uid() and ended_at is null and expires_at>now() limit 1;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details,usuario_contexto_affiliate_id,impersonation_session_id,reason)
 values(auth.uid(),'app_editorial_screens','EDITORIAL_SAVE',p_screen,'SUCCESS',jsonb_build_object('version',s.version),ctx.usuario_contexto_affiliate_id,ctx.id,ctx.reason);
 return public.get_app_editorial(p_screen,true);
end $$;
create function public.submit_app_editorial_form(p_id uuid,p_screen text,p_version bigint,p_node_id text,p_answers jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare current_form jsonb;f jsonb;v jsonb;k text;s public.app_editorial_screens%rowtype;prior public.app_editorial_submissions%rowtype;
begin
 if auth.uid() is null or p_id is null then raise exception 'AUTH_REQUIRED';end if;
 if exists(select 1 from public.impersonation_sessions where actor_real_auth_user_id=auth.uid() and ended_at is null and expires_at>now()) then raise exception 'EDITORIAL_SUBMISSION_DURING_IMPERSONATION_DENIED';end if;
 -- Serializes retries and saves; validates current publication before accepting new answers.
 select * into s from public.app_editorial_screens where screen_id=p_screen for share;
 select * into prior from public.app_editorial_submissions where id=p_id;
 if found then
  if prior.auth_user_id=auth.uid() and prior.screen_id=p_screen and prior.version=p_version and prior.node_id=p_node_id and prior.answers=p_answers then return p_id;end if;
  raise exception 'EDITORIAL_SUBMISSION_CONFLICT';
 end if;
 if p_version is distinct from s.version then raise exception 'EDITORIAL_FORM_CHANGED';end if;
 select n into current_form from jsonb_array_elements(public.get_app_editorial(p_screen,false)->'nodes') n where n->>'id'=p_node_id and n->>'type'='form';
 if current_form is null then raise exception 'EDITORIAL_FORM_DENIED';end if;
 if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>50000 then raise exception 'EDITORIAL_ANSWERS_INVALID';end if;
 for k in select jsonb_object_keys(p_answers) loop
  if not exists(select 1 from jsonb_array_elements(current_form->'fields') candidate_field where candidate_field->>'id'=k) then raise exception 'EDITORIAL_ANSWER_UNKNOWN';end if;
 end loop;
 for f in select * from jsonb_array_elements(current_form->'fields') loop
  v:=p_answers->(f->>'id');
  if (f->>'required')::boolean and (v is null or v='null'::jsonb or btrim(v#>>'{}')='' or (f->>'type'='checkbox' and v<>'true'::jsonb)) then raise exception 'EDITORIAL_REQUIRED:%',f->>'label';end if;
  if v is null or v='null'::jsonb or v='""'::jsonb then continue;end if;
  if f->>'type'='checkbox' then
   if jsonb_typeof(v)<>'boolean' then raise exception 'EDITORIAL_ANSWER_TYPE';end if;
  else
   if jsonb_typeof(v)<>'string' or length(v#>>'{}')>4000 then raise exception 'EDITORIAL_ANSWER_TYPE';end if;
   if f->>'type'='email' and (v#>>'{}')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'EDITORIAL_EMAIL_INVALID';end if;
   if f->>'type'='date' then
    if (v#>>'{}')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'EDITORIAL_DATE_INVALID';end if;
    perform (v#>>'{}')::date;
   end if;
   if f->>'type'='select' and not(f->'options' @> jsonb_build_array(v)) then raise exception 'EDITORIAL_OPTION_INVALID';end if;
  end if;
 end loop;
 insert into public.app_editorial_submissions(id,screen_id,version,node_id,auth_user_id,answers) values(p_id,p_screen,p_version,p_node_id,auth.uid(),p_answers)
 on conflict(id) do nothing;
 if not found then
  select * into prior from public.app_editorial_submissions where id=p_id;
  if prior.auth_user_id<>auth.uid() or prior.screen_id<>p_screen or prior.version<>p_version or prior.node_id<>p_node_id or prior.answers<>p_answers then raise exception 'EDITORIAL_SUBMISSION_CONFLICT';end if;
 end if;
 return p_id;
end $$;

alter table public.app_editorial_screens enable row level security;alter table public.app_editorial_screens force row level security;
alter table public.app_editorial_revisions enable row level security;alter table public.app_editorial_revisions force row level security;
alter table public.app_editorial_submissions enable row level security;alter table public.app_editorial_submissions force row level security;
revoke all on public.app_editorial_screens,public.app_editorial_revisions,public.app_editorial_submissions from public,anon,authenticated,service_role;
grant select on public.app_editorial_revisions,public.app_editorial_submissions to authenticated;
create policy editorial_revision_admin on public.app_editorial_revisions for select to authenticated using(public.can_read_editorial_admin());
create policy editorial_submission_owner_or_forms on public.app_editorial_submissions for select to authenticated using(auth_user_id=auth.uid() or (public.can_read_editorial_admin() and public.can_edit_editorial('form')));
revoke all on function public.editorial_module(text),public.can_edit_editorial(text),public.can_read_editorial_admin(),public.editorial_audience_matches(jsonb),public.validate_editorial_nodes(text,jsonb),public.get_app_editorial(text,boolean),public.list_app_editorial_screens(),public.save_app_editorial(text,bigint,jsonb),public.submit_app_editorial_form(uuid,text,bigint,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.get_app_editorial(text,boolean),public.list_app_editorial_screens() to anon,authenticated;
revoke all on function public.list_app_editorial_segments() from public,anon,authenticated,service_role;
grant execute on function public.list_app_editorial_segments() to authenticated;
grant execute on function public.can_read_editorial_admin(),public.can_edit_editorial(text),public.save_app_editorial(text,bigint,jsonb),public.submit_app_editorial_form(uuid,text,bigint,text,jsonb) to authenticated;

create function public.app_editorial_schema_fingerprint() returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object(
 'columns',(select jsonb_agg(to_jsonb(a) order by a.table_name,a.ordinal_position) from information_schema.columns a where a.table_schema='public' and a.table_name in('app_editorial_screens','app_editorial_revisions','app_editorial_submissions')),
 'constraints',(select jsonb_agg(jsonb_build_array(c.conrelid::regclass::text,c.conname,pg_get_constraintdef(c.oid)) order by c.conrelid,c.conname) from pg_constraint c where c.conrelid in('public.app_editorial_screens'::regclass,'public.app_editorial_revisions'::regclass,'public.app_editorial_submissions'::regclass)),
 'indexes',(select jsonb_agg(to_jsonb(i) order by i.indexname) from pg_indexes i where i.schemaname='public' and i.tablename in('app_editorial_screens','app_editorial_revisions','app_editorial_submissions')),
 'policies',(select jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname) from pg_policies p where p.schemaname='public' and p.tablename in('app_editorial_screens','app_editorial_revisions','app_editorial_submissions')),
 'security',(select jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,c.relowner) order by c.relname) from pg_class c where c.oid in('public.app_editorial_screens'::regclass,'public.app_editorial_revisions'::regclass,'public.app_editorial_submissions'::regclass)),
 'triggers',(select jsonb_agg(jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled) order by t.tgrelid,t.tgname) from pg_trigger t where not t.tgisinternal and t.tgrelid in('public.app_editorial_screens'::regclass,'public.app_editorial_revisions'::regclass,'public.app_editorial_submissions'::regclass))
 )::text)
$$;
revoke all on function public.app_editorial_schema_fingerprint() from public,anon,authenticated,service_role;

-- Recovery proof includes schema definitions, grants and initial authority content.
create table public.app_editorial_installation_20260924000300(key text primary key,value text not null);
alter table public.app_editorial_installation_20260924000300 enable row level security;
alter table public.app_editorial_installation_20260924000300 force row level security;
revoke all on public.app_editorial_installation_20260924000300 from public,anon,authenticated,service_role;
insert into public.app_editorial_installation_20260924000300 values('screens',(select md5(jsonb_agg(to_jsonb(s) order by screen_id)::text) from public.app_editorial_screens s));
insert into public.app_editorial_installation_20260924000300 values('revisions',(select md5(jsonb_agg(to_jsonb(r) order by screen_id,version)::text) from public.app_editorial_revisions r));
insert into public.app_editorial_installation_20260924000300 select p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('editorial_module','can_edit_editorial','can_read_editorial_admin','editorial_audience_matches','validate_editorial_nodes','get_app_editorial','list_app_editorial_screens','list_app_editorial_segments','save_app_editorial','submit_app_editorial_form','app_editorial_schema_fingerprint');
insert into public.app_editorial_installation_20260924000300 values('schema',public.app_editorial_schema_fingerprint());
commit;
