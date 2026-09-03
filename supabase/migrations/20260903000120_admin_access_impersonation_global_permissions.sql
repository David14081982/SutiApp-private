begin;

-- H-ADMIN-ACCESS-IMPERSONATION-GLOBAL-PERMISSIONS-001
-- Additive hardening of the existing authorization and identity authorities.

create table public.admin_access_migration_state_20260903000120 (
  singleton boolean primary key default true check (singleton),
  applied_at timestamptz not null default now(),
  prior_function_definitions jsonb not null
);
alter table public.admin_access_migration_state_20260903000120 enable row level security;
alter table public.admin_access_migration_state_20260903000120 force row level security;
revoke all on public.admin_access_migration_state_20260903000120 from public,anon,authenticated;

insert into public.admin_access_migration_state_20260903000120(prior_function_definitions)
select jsonb_object_agg(p.oid::regprocedure::text,pg_get_functiondef(p.oid))
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in(
  'get_admin_access_context','save_admin_role','assign_admin_role','get_current_affiliate_access_state',
  'get_effective_affiliate_id','get_impersonation_context','start_affiliate_impersonation',
  'stop_affiliate_impersonation','search_affiliates_for_impersonation'
);

alter table public.admin_assignments
  add column assigned_at timestamptz null,
  add column assigned_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  add column revoked_at timestamptz null,
  add column revoked_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  add column protected_assignment boolean not null default false;

update public.admin_assignments
set assigned_at=created_at,
    revoked_at=case when enabled then null else updated_at end;
alter table public.admin_assignments alter column assigned_at set not null;
alter table public.admin_assignments alter column assigned_at set default now();
alter table public.admin_assignments add constraint admin_assignments_revocation_coherence_check
  check ((enabled and revoked_at is null) or (not enabled and revoked_at is not null));

do $$
declare v_protected uuid;
begin
  select a.id into v_protected
  from public.admin_assignments a
  join public.admin_roles r on r.id=a.role_id
  where a.enabled and r.code='principal_admin'
  order by a.created_at,a.id limit 1;
  if v_protected is null then
    raise exception 'PRINCIPAL_ADMIN_ASSIGNMENT_REQUIRED' using errcode='23514';
  end if;
  update public.admin_assignments set protected_assignment=true where id=v_protected;
end $$;
create unique index admin_assignments_one_protected_idx
  on public.admin_assignments(protected_assignment) where protected_assignment;

alter table public.impersonation_sessions add column actor_auth_session_id text null;

create or replace function public.has_admin_permission(required_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.admin_assignments a
    join public.admin_roles r on r.id=a.role_id and r.enabled
    join public.admin_role_permissions rp on rp.role_id=r.id
    where a.auth_user_id=(select auth.uid()) and a.enabled and rp.permission=required_permission
  )
$$;

create or replace function public.get_admin_access_context()
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'role_code',(
      select r.code from public.admin_assignments a join public.admin_roles r on r.id=a.role_id and r.enabled
      where a.auth_user_id=(select auth.uid()) and a.enabled limit 1
    ),
    'full_access',coalesce((
      select r.code='principal_admin' from public.admin_assignments a join public.admin_roles r on r.id=a.role_id and r.enabled
      where a.auth_user_id=(select auth.uid()) and a.enabled limit 1
    ),false),
    'technical_permissions',coalesce((
      select jsonb_agg(rp.permission order by rp.permission)
      from public.admin_assignments a
      join public.admin_roles ar on ar.id=a.role_id and ar.enabled
      join public.admin_role_permissions rp on rp.role_id=ar.id
      where a.auth_user_id=(select auth.uid()) and a.enabled
    ),'[]'::jsonb),
    'section_actions',coalesce((
      select jsonb_agg(jsonb_build_object('section_key',r.section_key,'action',r.action) order by r.section_key,r.action)
      from public.admin_section_responsibilities r
      join public.admin_section_definitions d on d.section_key=r.section_key
      where r.auth_user_id=(select auth.uid()) and r.enabled and d.enforcement_status='ENFORCED'
    ),'[]'::jsonb)
  )
$$;

create or replace function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_id uuid;v_allowed text[];v_before jsonb;v_after jsonb;
begin
  if v_actor is null or not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  select array_agg(rp.permission order by rp.permission) into v_allowed
  from public.admin_role_permissions rp join public.admin_roles r on r.id=rp.role_id where r.code='principal_admin';
  if p_permissions is null or exists(select 1 from unnest(p_permissions) p where not(p=any(coalesce(v_allowed,'{}')))) then
    raise exception 'INVALID_PERMISSION' using errcode='22023';
  end if;
  if p_role_id is null then
    insert into public.admin_roles(code,name,description)
    values('role_'||replace(extensions.gen_random_uuid()::text,'-',''),btrim(p_name),coalesce(p_description,'')) returning id into v_id;
  else
    select to_jsonb(r) into v_before from public.admin_roles r where r.id=p_role_id for update;
    if coalesce((v_before->>'system_role')::boolean,false) then raise exception 'SYSTEM_ROLE_IMMUTABLE' using errcode='P0001'; end if;
    update public.admin_roles set name=btrim(p_name),description=coalesce(p_description,''),updated_at=now()
    where id=p_role_id returning id into v_id;
    if v_id is null then raise exception 'ROLE_NOT_FOUND' using errcode='P0001'; end if;
    delete from public.admin_role_permissions where role_id=v_id;
  end if;
  insert into public.admin_role_permissions(role_id,permission)
  select v_id,p from(select distinct unnest(p_permissions) p) q;
  update public.admin_assignments a set
    permissions=(select coalesce(array_agg(permission order by permission),'{}') from public.admin_role_permissions where role_id=v_id),updated_at=now()
  where role_id=v_id;
  if not ('affiliates.impersonate'=any(coalesce(p_permissions,'{}'))) then
    with closed as (
      update public.impersonation_sessions s set ended_at=now(),ended_by_auth_user_id=v_actor
      where s.ended_at is null and exists(select 1 from public.admin_assignments a where a.auth_user_id=s.actor_real_auth_user_id and a.role_id=v_id)
      returning s.*
    ) insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
      select v_actor,c.usuario_contexto_affiliate_id,'IMPERSONATION_STOPPED','SUCCESS',jsonb_build_object(
        'session_id',c.id,'reason',c.reason,'automatic',true,'cause','ROLE_PERMISSION_REVOKED','session_actor_auth_user_id',c.actor_real_auth_user_id)
      from closed c;
  end if;
  select to_jsonb(r) into v_after from public.admin_roles r where r.id=v_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'admin_roles',case when p_role_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS',
    jsonb_build_object('before',v_before,'after',v_after,'permissions',to_jsonb(p_permissions)));
  return v_id;
end $$;

create or replace function public.assign_admin_role(p_auth_user_id uuid,p_role_id uuid,p_enabled boolean default true)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();v_id uuid;v_permissions text[];v_before jsonb;v_after jsonb;
begin
  if v_actor is null or not public.has_admin_permission('authorization.write') then
    raise exception 'AUTHORIZATION_DENIED' using errcode='42501';
  end if;
  if p_auth_user_id=v_actor then raise exception 'SELF_ASSIGNMENT_DENIED' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=p_auth_user_id and email_confirmed_at is not null) then
    raise exception 'CONFIRMED_AUTH_USER_NOT_FOUND' using errcode='P0001';
  end if;
  if not exists(select 1 from public.admin_roles where id=p_role_id and enabled) then
    raise exception 'ROLE_NOT_FOUND' using errcode='P0001';
  end if;
  select to_jsonb(a) into v_before from public.admin_assignments a where a.auth_user_id=p_auth_user_id for update;
  if coalesce((v_before->>'protected_assignment')::boolean,false) and
     (not p_enabled or (v_before->>'role_id')::uuid is distinct from p_role_id) then
    raise exception 'PROTECTED_SUPERADMIN' using errcode='42501';
  end if;
  select array_agg(permission order by permission) into v_permissions
  from public.admin_role_permissions where role_id=p_role_id;
  insert into public.admin_assignments(
    auth_user_id,role,role_id,permissions,enabled,assigned_at,assigned_by_auth_user_id,
    revoked_at,revoked_by_auth_user_id,protected_assignment
  ) values(
    p_auth_user_id,'visual_admin',p_role_id,coalesce(v_permissions,'{}'),p_enabled,now(),v_actor,
    case when p_enabled then null else now() end,case when p_enabled then null else v_actor end,false
  )
  on conflict(auth_user_id) do update set
    role_id=excluded.role_id,permissions=excluded.permissions,enabled=excluded.enabled,
    assigned_at=case when excluded.enabled then now() else admin_assignments.assigned_at end,
    assigned_by_auth_user_id=case when excluded.enabled then v_actor else admin_assignments.assigned_by_auth_user_id end,
    revoked_at=excluded.revoked_at,revoked_by_auth_user_id=excluded.revoked_by_auth_user_id,updated_at=now()
  returning id into v_id;
  select to_jsonb(a) into v_after from public.admin_assignments a where a.id=v_id;
  if not exists(
    select 1 from public.admin_assignments a join public.admin_roles r on r.id=a.role_id
    where a.enabled and r.code='principal_admin'
  ) then raise exception 'LAST_PRINCIPAL_ADMIN_REQUIRED' using errcode='23514'; end if;
  if not p_enabled or not ('affiliates.impersonate'=any(coalesce(v_permissions,'{}'))) then
    with closed as (
      update public.impersonation_sessions s set ended_at=now(),ended_by_auth_user_id=v_actor
      where s.actor_real_auth_user_id=p_auth_user_id and s.ended_at is null returning s.*
    ) insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
      select v_actor,c.usuario_contexto_affiliate_id,'IMPERSONATION_STOPPED','SUCCESS',jsonb_build_object(
        'session_id',c.id,'reason',c.reason,'automatic',true,'cause','ADMIN_ASSIGNMENT_REVOKED','session_actor_auth_user_id',c.actor_real_auth_user_id)
      from closed c;
  end if;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'admin_assignments',case when p_enabled then 'UPSERT' else 'REVOKE' end,v_id::text,'SUCCESS',
    jsonb_build_object('subject_auth_user_id',p_auth_user_id,'before',v_before,'after',v_after,'assigned_by_auth_user_id',v_actor));
  return v_id;
end $$;

create function public.list_admin_assignments()
returns table(
  assignment_id uuid,auth_user_id uuid,email text,display_name text,role_id uuid,role_code text,
  role_name text,system_role boolean,enabled boolean,protected_assignment boolean,
  assigned_at timestamptz,assigned_by_email text,revoked_at timestamptz
)
language plpgsql stable security definer set search_path=''
as $$ begin
  if not public.has_admin_permission('authorization.read') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  return query select a.id,a.auth_user_id,u.email::text,
    coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),u.email)::text,
    r.id,r.code,r.name,r.system_role,a.enabled,a.protected_assignment,a.assigned_at,assigner.email::text,a.revoked_at
  from public.admin_assignments a
  join auth.users u on u.id=a.auth_user_id
  join public.admin_roles r on r.id=a.role_id
  left join auth.users assigner on assigner.id=a.assigned_by_auth_user_id
  order by a.enabled desc,a.protected_assignment desc,a.assigned_at,a.id;
end $$;

create function public.set_total_admin_by_email(p_email text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_ids uuid[];v_role uuid;
begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_email,'')),'') is null then raise exception 'EMAIL_REQUIRED' using errcode='22023'; end if;
  select array_agg(id order by id) into v_ids from auth.users
  where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
  if coalesce(cardinality(v_ids),0)=0 then raise exception 'CONFIRMED_AUTH_USER_NOT_FOUND' using errcode='P0001'; end if;
  if cardinality(v_ids)<>1 then raise exception 'AUTH_USER_EMAIL_AMBIGUOUS' using errcode='P0001'; end if;
  select id into v_role from public.admin_roles where code='principal_admin' and enabled;
  if v_role is null then raise exception 'PRINCIPAL_ADMIN_ROLE_REQUIRED' using errcode='P0001'; end if;
  return public.assign_admin_role(v_ids[1],v_role,true);
end $$;

create function public.revoke_admin_assignment(p_auth_user_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_role uuid;
begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  select role_id into v_role from public.admin_assignments where auth_user_id=p_auth_user_id;
  if v_role is null then raise exception 'ADMIN_ASSIGNMENT_NOT_FOUND' using errcode='P0001'; end if;
  perform public.assign_admin_role(p_auth_user_id,v_role,false);
  return true;
end $$;

create function public.list_admin_section_definitions()
returns table(section_key text,display_name text,data_boundary text,allowed_actions text[],enforcement_status text)
language plpgsql stable security definer set search_path=''
as $$ begin
  if not public.has_admin_permission('authorization.read') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  return query select d.section_key,d.display_name,d.data_boundary,d.allowed_actions,d.enforcement_status
  from public.admin_section_definitions d where d.enforcement_status='ENFORCED' order by d.display_name,d.section_key;
end $$;

create function public.list_section_responsibility_groups(p_section_key text)
returns table(
  auth_user_id uuid,email text,display_name text,actions text[],assigned_at timestamptz,assigned_by_email text
)
language plpgsql stable security definer set search_path=''
as $$ begin
  if not public.has_admin_permission('authorization.read') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  if not exists(select 1 from public.admin_section_definitions where section_key=p_section_key and enforcement_status='ENFORCED') then
    raise exception 'SECTION_NOT_ENFORCED' using errcode='P0001';
  end if;
  return query select r.auth_user_id,u.email::text,
    coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),u.email)::text,
    array_agg(r.action order by r.action),min(r.assigned_at),min(granter.email)::text
  from public.admin_section_responsibilities r
  join auth.users u on u.id=r.auth_user_id
  left join auth.users granter on granter.id=r.granted_by_auth_user_id
  where r.section_key=p_section_key and r.enabled
  group by r.auth_user_id,u.email,u.raw_user_meta_data
  order by min(r.assigned_at),r.auth_user_id;
end $$;

create or replace function public.get_current_affiliate_access_state()
returns text language sql stable security definer set search_path=''
as $$
  select case
    when exists(
      select 1 from public.impersonation_sessions s join public.affiliates a on a.id=s.usuario_contexto_affiliate_id
      where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now()
        and s.actor_auth_session_id=nullif((select auth.jwt()->>'session_id'),'')
        and public.has_admin_permission('affiliates.impersonate') and a.is_archived
    ) then 'ARCHIVED'
    when exists(
      select 1 from public.impersonation_sessions s join public.affiliates a on a.id=s.usuario_contexto_affiliate_id
      where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now()
        and s.actor_auth_session_id=nullif((select auth.jwt()->>'session_id'),'')
        and public.has_admin_permission('affiliates.impersonate') and not a.is_archived
    ) then 'ACTIVE'
    when exists(select 1 from public.affiliates a where a.auth_user_id=(select auth.uid()) and a.is_archived) then 'ARCHIVED'
    when exists(select 1 from public.affiliates a where a.auth_user_id=(select auth.uid()) and not a.is_archived) then 'ACTIVE'
    else 'UNLINKED' end
$$;

create or replace function public.get_effective_affiliate_id()
returns uuid language sql stable security definer set search_path=''
as $$ select coalesce(
  (select s.usuario_contexto_affiliate_id from public.impersonation_sessions s
   join public.affiliates a on a.id=s.usuario_contexto_affiliate_id and not a.is_archived
   where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now()
     and s.actor_auth_session_id=nullif((select auth.jwt()->>'session_id'),'')
     and public.has_admin_permission('affiliates.impersonate') limit 1),
  (select a.id from public.affiliates a where a.auth_user_id=(select auth.uid()) and not a.is_archived limit 1)
) $$;

create or replace function public.get_impersonation_context()
returns table(session_id uuid,actor_real_auth_user_id uuid,usuario_contexto_affiliate_id uuid,reason text,expires_at timestamptz)
language sql stable security definer set search_path=''
as $$ select s.id,s.actor_real_auth_user_id,s.usuario_contexto_affiliate_id,s.reason,s.expires_at
 from public.impersonation_sessions s join public.affiliates a on a.id=s.usuario_contexto_affiliate_id and not a.is_archived
 where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now()
   and s.actor_auth_session_id=nullif((select auth.jwt()->>'session_id'),'')
   and public.has_admin_permission('affiliates.impersonate') limit 1 $$;

create or replace function public.start_affiliate_impersonation(p_affiliate_id uuid,p_reason text)
returns table(session_id uuid,affiliate_id uuid,expires_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();v_auth_session text:=nullif(auth.jwt()->>'session_id','');v_created public.impersonation_sessions%rowtype;v_archived boolean;
begin
  if v_actor is null or not public.has_admin_permission('affiliates.impersonate') then raise exception 'IMPERSONATION_DENIED' using errcode='42501'; end if;
  if v_auth_session is null then raise exception 'AUTH_SESSION_REQUIRED' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<8 then raise exception 'REASON_REQUIRED' using errcode='22023'; end if;
  select a.is_archived into v_archived from public.affiliates a where a.id=p_affiliate_id;
  if v_archived is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_archived then raise exception 'AFFILIATE_ARCHIVED' using errcode='42501'; end if;
  with closed as (
    update public.impersonation_sessions s set ended_at=now(),ended_by_auth_user_id=v_actor
    where s.actor_real_auth_user_id=v_actor and s.ended_at is null
      and (s.expires_at<=now() or s.actor_auth_session_id is distinct from v_auth_session)
    returning s.*
  ) insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
    select v_actor,c.usuario_contexto_affiliate_id,'IMPERSONATION_STOPPED','SUCCESS',jsonb_build_object(
      'session_id',c.id,'reason',c.reason,'automatic',true,'cause','AUTH_SESSION_REPLACED_OR_EXPIRED') from closed c;
  if exists(select 1 from public.impersonation_sessions s where s.actor_real_auth_user_id=v_actor and s.ended_at is null) then
    raise exception 'IMPERSONATION_ALREADY_ACTIVE' using errcode='P0001';
  end if;
  insert into public.impersonation_sessions(actor_real_auth_user_id,usuario_contexto_affiliate_id,reason,expires_at,actor_auth_session_id)
  values(v_actor,p_affiliate_id,btrim(p_reason),now()+interval '30 minutes',v_auth_session) returning * into v_created;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(v_actor,p_affiliate_id,'IMPERSONATION_STARTED','SUCCESS',jsonb_build_object(
    'session_id',v_created.id,'expires_at',v_created.expires_at,'reason',v_created.reason,
    'actor_auth_session_id',v_auth_session,'scope','ASSISTED_AFFILIATE_SERVICE'));
  return query select v_created.id,v_created.usuario_contexto_affiliate_id,v_created.expires_at;
end $$;

create or replace function public.stop_affiliate_impersonation()
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_active public.impersonation_sessions%rowtype;
begin
  if v_actor is null or not public.has_admin_permission('affiliates.impersonate') then
    raise exception 'IMPERSONATION_DENIED' using errcode='42501';
  end if;
  if nullif(auth.jwt()->>'session_id','') is null then raise exception 'AUTH_SESSION_REQUIRED' using errcode='42501'; end if;
  select * into v_active from public.impersonation_sessions
  where actor_real_auth_user_id=v_actor and ended_at is null
    and actor_auth_session_id=nullif(auth.jwt()->>'session_id','')
  order by started_at desc limit 1 for update;
  if v_active.id is null then return false; end if;
  update public.impersonation_sessions set ended_at=now(),ended_by_auth_user_id=v_actor where id=v_active.id;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(v_actor,v_active.usuario_contexto_affiliate_id,'IMPERSONATION_STOPPED','SUCCESS',jsonb_build_object(
    'session_id',v_active.id,'reason',v_active.reason,'manual',true));
  return true;
end $$;

drop function public.search_affiliates_for_impersonation(text);
create function public.search_affiliates_for_impersonation(p_query text)
returns table(id uuid,numero_control text,display_name text,full_name text,auth_eligibility text,email text)
language plpgsql stable security definer set search_path=''
as $$ begin
  if not public.has_admin_permission('affiliates.impersonate') then raise exception 'IMPERSONATION_DENIED' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_query,'')))<2 then return; end if;
  return query select a.id,a.numero_control,a.display_name,a.full_name,a.auth_eligibility,u.email::text
  from public.affiliates a left join auth.users u on u.id=a.auth_user_id
  where not a.is_archived and (
    a.numero_control ilike '%'||btrim(p_query)||'%' or a.display_name ilike '%'||btrim(p_query)||'%'
    or a.full_name ilike '%'||btrim(p_query)||'%' or u.email ilike '%'||btrim(p_query)||'%')
  order by a.source_row_ordinal limit 20;
end $$;

revoke all on function public.list_admin_assignments(),public.set_total_admin_by_email(text),
  public.revoke_admin_assignment(uuid),public.list_admin_section_definitions(),
  public.list_section_responsibility_groups(text),public.save_admin_role(uuid,text,text,text[]),public.assign_admin_role(uuid,uuid,boolean),
  public.get_admin_access_context(),public.get_current_affiliate_access_state(),
  public.get_effective_affiliate_id(),public.get_impersonation_context(),
  public.start_affiliate_impersonation(uuid,text),public.stop_affiliate_impersonation(),
  public.search_affiliates_for_impersonation(text)
from public,anon;
grant execute on function public.list_admin_assignments(),public.set_total_admin_by_email(text),
  public.revoke_admin_assignment(uuid),public.list_admin_section_definitions(),
  public.list_section_responsibility_groups(text),public.save_admin_role(uuid,text,text,text[]),public.assign_admin_role(uuid,uuid,boolean),
  public.get_admin_access_context(),public.get_current_affiliate_access_state(),
  public.get_effective_affiliate_id(),public.get_impersonation_context(),
  public.start_affiliate_impersonation(uuid,text),public.stop_affiliate_impersonation(),
  public.search_affiliates_for_impersonation(text)
to authenticated;

notify pgrst,'reload schema';
commit;
