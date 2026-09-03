begin;

-- H-ADMIN-ACCESS-IMPERSONATION-GLOBAL-PERMISSIONS-001
-- Manual close is bound to the same explicit capability and Auth session as start.

create table public.impersonation_stop_binding_state_20260903000122 (
  singleton boolean primary key default true check (singleton),
  applied_at timestamptz not null default now(),
  prior_function_definition text not null
);
alter table public.impersonation_stop_binding_state_20260903000122 enable row level security;
alter table public.impersonation_stop_binding_state_20260903000122 force row level security;
revoke all on public.impersonation_stop_binding_state_20260903000122 from public,anon,authenticated;

insert into public.impersonation_stop_binding_state_20260903000122(prior_function_definition)
select pg_get_functiondef('public.stop_affiliate_impersonation()'::regprocedure);

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
    'session_id',v_active.id,'reason',v_active.reason,'manual',true,'actor_auth_session_id',v_active.actor_auth_session_id));
  return true;
end $$;

revoke all on function public.stop_affiliate_impersonation() from public,anon;
grant execute on function public.stop_affiliate_impersonation() to authenticated;
notify pgrst,'reload schema';
commit;
