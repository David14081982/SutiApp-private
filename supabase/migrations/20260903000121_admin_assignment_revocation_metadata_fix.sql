begin;

-- Surgical follow-up for H-ADMIN-ACCESS-IMPERSONATION-GLOBAL-PERMISSIONS-001.
-- Revocation must preserve who assigned the administrator and when.

create table public.admin_assignment_metadata_fix_state_20260903000121 (
  singleton boolean primary key default true check (singleton),
  applied_at timestamptz not null default now(),
  prior_function_definition text not null
);
alter table public.admin_assignment_metadata_fix_state_20260903000121 enable row level security;
alter table public.admin_assignment_metadata_fix_state_20260903000121 force row level security;
revoke all on public.admin_assignment_metadata_fix_state_20260903000121 from public,anon,authenticated;

insert into public.admin_assignment_metadata_fix_state_20260903000121(prior_function_definition)
select pg_get_functiondef('public.assign_admin_role(uuid,uuid,boolean)'::regprocedure);

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

revoke all on function public.assign_admin_role(uuid,uuid,boolean) from public,anon;
grant execute on function public.assign_admin_role(uuid,uuid,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
