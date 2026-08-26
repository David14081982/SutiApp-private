begin;
create or replace function public.start_affiliate_impersonation(p_affiliate_id uuid, p_reason text)
returns table(session_id uuid, affiliate_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare principal uuid := (select auth.uid()); created public.impersonation_sessions%rowtype;
begin
  if principal is null or not public.has_admin_permission('affiliates.impersonate') then raise exception 'ADMIN_DENIED' using errcode='P0001'; end if;
  if char_length(btrim(coalesce(p_reason,''))) < 8 then raise exception 'REASON_REQUIRED' using errcode='P0001'; end if;
  if not exists(select 1 from public.affiliates a where a.id=p_affiliate_id) then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  update public.impersonation_sessions s set ended_at=now(), ended_by_auth_user_id=principal
   where s.actor_real_auth_user_id=principal and s.ended_at is null and s.expires_at <= now();
  if exists(select 1 from public.impersonation_sessions s where s.actor_real_auth_user_id=principal and s.ended_at is null) then
    raise exception 'IMPERSONATION_ALREADY_ACTIVE' using errcode='P0001';
  end if;
  insert into public.impersonation_sessions(actor_real_auth_user_id,usuario_contexto_affiliate_id,reason,expires_at)
  values(principal,p_affiliate_id,btrim(p_reason),now()+interval '30 minutes') returning * into created;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(principal,p_affiliate_id,'IMPERSONATION_STARTED','SUCCESS',jsonb_build_object('session_id',created.id,'expires_at',created.expires_at,'reason',created.reason));
  return query select created.id, created.usuario_contexto_affiliate_id, created.expires_at;
end;
$$;
revoke all on function public.start_affiliate_impersonation(uuid,text) from public, anon;
grant execute on function public.start_affiliate_impersonation(uuid,text) to authenticated;
commit;
