begin;

-- H-MASTER-REM-SEC-002 / DESIGN FOUNDATION ONLY.
-- This additive migration does not replace content policies and does not grant
-- content writes. A section must be ENFORCED by a later, section-specific
-- migration before assignments are accepted or evaluated.

create table public.admin_section_definitions (
  section_key text primary key check (section_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  display_name text not null check (length(btrim(display_name)) between 3 and 100),
  data_boundary text not null check (length(btrim(data_boundary)) between 3 and 500),
  allowed_actions text[] not null check (
    allowed_actions <@ array['read','create','update','delete','publish','order','assets']::text[]
    and cardinality(allowed_actions) > 0
  ),
  enforcement_status text not null default 'DESIGN_ONLY'
    check (enforcement_status in ('DESIGN_ONLY','ENFORCED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_section_responsibilities (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  section_key text not null references public.admin_section_definitions(section_key) on delete restrict,
  action text not null check (action in ('read','create','update','delete','publish','order','assets')),
  enabled boolean not null default true,
  granted_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  revoked_at timestamptz null,
  updated_at timestamptz not null default now(),
  check ((enabled and revoked_at is null and revoked_by_auth_user_id is null)
      or (not enabled and revoked_at is not null and revoked_by_auth_user_id is not null)),
  unique (auth_user_id, section_key, action)
);

create index admin_section_responsibilities_actor_idx
  on public.admin_section_responsibilities(auth_user_id, section_key, action)
  where enabled;

insert into public.admin_section_definitions
  (section_key, display_name, data_boundary, allowed_actions)
values
  ('news','Noticias','news_articles + news_settings',array['read','create','update','delete','publish','order','assets']),
  ('education','Educación','educational_resources where resource_kind=education',array['read','create','update','delete','publish','order','assets']),
  ('tutorials','Tutoriales','educational_resources where resource_kind=tutorial',array['read','create','update','delete','publish','order','assets']),
  ('companies','Empresas','companies + company_assets; excludes benefit/audience configuration',array['read','create','update','delete','publish','order','assets']),
  ('agreements','Convenios y beneficios','company_benefit_profiles + company_benefits + company_audience_rules; companies is read-only',array['read','create','update','delete','publish','order','assets']),
  ('banners','Banners','banners',array['read','create','update','delete','publish','order','assets']),
  ('popups','Pop-ups','popups',array['read','create','update','delete','publish','order','assets']),
  ('documents','Documentos','institutional_documents',array['read','create','update','delete','publish','order','assets']),
  ('programs','Programas institucionales','institutional_programs and non-financial presentation only',array['read','create','update','delete','publish','order','assets']),
  ('marketplace','Marketplace','marketplace catalog; excludes quote/request adjudication',array['read','create','update','delete','publish','order','assets']);

create or replace function public.has_section_action(p_section_key text, p_action text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists (
    select 1
    from public.admin_section_responsibilities r
    join public.admin_section_definitions d on d.section_key=r.section_key
    where r.auth_user_id=(select auth.uid())
      and r.section_key=p_section_key
      and r.action=p_action
      and r.enabled
      and d.enforcement_status='ENFORCED'
      and p_action=any(d.allowed_actions)
  )
$$;

create or replace function public.get_admin_access_context()
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'technical_permissions', coalesce((
      select jsonb_agg(rp.permission order by rp.permission)
      from public.admin_assignments a
      join public.admin_roles ar on ar.id=a.role_id and ar.enabled
      join public.admin_role_permissions rp on rp.role_id=ar.id
      where a.auth_user_id=(select auth.uid()) and a.enabled
    ), '[]'::jsonb),
    'section_actions', coalesce((
      select jsonb_agg(
        jsonb_build_object('section_key',r.section_key,'action',r.action)
        order by r.section_key,r.action
      )
      from public.admin_section_responsibilities r
      join public.admin_section_definitions d on d.section_key=r.section_key
      where r.auth_user_id=(select auth.uid()) and r.enabled
        and d.enforcement_status='ENFORCED'
    ), '[]'::jsonb)
  )
$$;

create or replace function public.set_section_responsibilities(
  p_email text,
  p_section_key text,
  p_actions text[]
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_subject uuid;
  v_subjects uuid[];
  v_allowed text[];
begin
  if v_actor is null or not public.has_admin_permission('authorization.write') then
    raise exception 'AUTHORIZATION_DENIED' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_email,'')),'') is null then
    raise exception 'EMAIL_REQUIRED' using errcode='22023';
  end if;
  select array_agg(id order by id) into v_subjects from auth.users
   where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
  if coalesce(cardinality(v_subjects),0)=0 then
    raise exception 'CONFIRMED_AUTH_USER_NOT_FOUND' using errcode='P0001';
  end if;
  if cardinality(v_subjects)<>1 then
    raise exception 'AUTH_USER_EMAIL_AMBIGUOUS' using errcode='P0001';
  end if;
  v_subject:=v_subjects[1];
  if v_subject=v_actor then raise exception 'SELF_ASSIGNMENT_DENIED' using errcode='42501'; end if;

  select allowed_actions into v_allowed from public.admin_section_definitions
   where section_key=p_section_key and enforcement_status='ENFORCED';
  if v_allowed is null then raise exception 'SECTION_NOT_ENFORCED' using errcode='P0001'; end if;
  if p_actions is null or cardinality(p_actions)=0
     or exists(select 1 from unnest(p_actions) a where not(a=any(v_allowed))) then
    raise exception 'INVALID_SECTION_ACTION' using errcode='22023';
  end if;

  update public.admin_section_responsibilities
     set enabled=false, updated_at=now(), revoked_at=now(), revoked_by_auth_user_id=v_actor
   where auth_user_id=v_subject and section_key=p_section_key and enabled;
  insert into public.admin_section_responsibilities
    (auth_user_id,section_key,action,enabled,granted_by_auth_user_id)
  select v_subject,p_section_key,a,true,v_actor from (select distinct unnest(p_actions) a) q
  on conflict(auth_user_id,section_key,action) do update
    set enabled=true, assigned_at=now(), updated_at=now(),
        granted_by_auth_user_id=excluded.granted_by_auth_user_id,
        revoked_at=null, revoked_by_auth_user_id=null;

  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'admin_section_responsibilities','SET',v_subject::text,'SUCCESS',
    jsonb_build_object('section_key',p_section_key,'actions',to_jsonb(p_actions)));
  return v_subject;
end
$$;

create or replace function public.revoke_section_responsibilities(p_auth_user_id uuid, p_section_key text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_count integer;
begin
  if v_actor is null or not public.has_admin_permission('authorization.write') then
    raise exception 'AUTHORIZATION_DENIED' using errcode='42501';
  end if;
  if p_auth_user_id=v_actor then raise exception 'SELF_ASSIGNMENT_DENIED' using errcode='42501'; end if;
  update public.admin_section_responsibilities
     set enabled=false,updated_at=now(),revoked_at=now(),revoked_by_auth_user_id=v_actor
   where auth_user_id=p_auth_user_id and section_key=p_section_key and enabled;
  get diagnostics v_count=row_count;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'admin_section_responsibilities','REVOKE',p_auth_user_id::text,'SUCCESS',
    jsonb_build_object('section_key',p_section_key,'disabled_actions',v_count));
end
$$;

create trigger admin_section_definitions_updated_at before update on public.admin_section_definitions
for each row execute function public.set_h0072_updated_at();
create trigger admin_section_responsibilities_updated_at before update on public.admin_section_responsibilities
for each row execute function public.set_h0072_updated_at();

alter table public.admin_section_definitions enable row level security;
alter table public.admin_section_definitions force row level security;
alter table public.admin_section_responsibilities enable row level security;
alter table public.admin_section_responsibilities force row level security;
revoke all on public.admin_section_definitions, public.admin_section_responsibilities from public, anon, authenticated;
grant select on public.admin_section_definitions, public.admin_section_responsibilities to authenticated;

create policy admin_section_definitions_authorized_read on public.admin_section_definitions
for select to authenticated using (
  public.has_admin_permission('authorization.read')
  or exists(select 1 from public.admin_section_responsibilities r
    where r.auth_user_id=(select auth.uid()) and r.section_key=admin_section_definitions.section_key and r.enabled
      and admin_section_definitions.enforcement_status='ENFORCED')
);
create policy admin_section_responsibilities_authorized_read on public.admin_section_responsibilities
for select to authenticated using (
  auth_user_id=(select auth.uid()) or public.has_admin_permission('authorization.read')
);

revoke execute on function public.has_section_action(text,text) from public, anon;
revoke execute on function public.get_admin_access_context() from public, anon;
revoke execute on function public.set_section_responsibilities(text,text,text[]) from public, anon;
revoke execute on function public.revoke_section_responsibilities(uuid,text) from public, anon;
grant execute on function public.has_section_action(text,text) to authenticated;
grant execute on function public.get_admin_access_context() to authenticated;
grant execute on function public.set_section_responsibilities(text,text,text[]) to authenticated;
grant execute on function public.revoke_section_responsibilities(uuid,text) to authenticated;

comment on table public.admin_section_responsibilities is
  'Durable Auth UUID capabilities only. Email is resolution input and is never stored as authority.';
comment on function public.has_section_action(text,text) is
  'Returns only enforced section capability; it never mutates or replaces has_admin_permission.';

commit;
