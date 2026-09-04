begin;

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

create or replace function public.claim_affiliate_identity()
returns uuid language plpgsql security definer set search_path=''
as $$
declare principal uuid:=(select auth.uid());principal_email text;confirmed timestamptz;candidate public.affiliates%rowtype;matches integer;
begin
  if principal is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  select lower(btrim(u.email)),u.email_confirmed_at into principal_email,confirmed from auth.users u where u.id=principal;
  if principal_email is null or principal_email='' or confirmed is null then raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode='P0001'; end if;
  select count(*) into matches from public.affiliates a
   where a.historical_email_normalized=principal_email and a.auth_eligibility='eligible' and not a.is_archived;
  if matches=0 and exists(select 1 from public.affiliates a where a.historical_email_normalized=principal_email and a.is_archived) then
    raise exception 'AFFILIATE_ARCHIVED' using errcode='42501';
  end if;
  if matches<>1 then raise exception 'AFFILIATE_NOT_UNIQUELY_ELIGIBLE' using errcode='P0001'; end if;
  select * into candidate from public.affiliates a
   where a.historical_email_normalized=principal_email and a.auth_eligibility='eligible' and not a.is_archived for update;
  if candidate.auth_user_id is not null and candidate.auth_user_id<>principal then raise exception 'AFFILIATE_ALREADY_LINKED' using errcode='P0001'; end if;
  update public.affiliates set auth_user_id=principal,updated_at=now()
   where id=candidate.id and not is_archived and (auth_user_id is null or auth_user_id=principal);
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result)
  values(principal,candidate.id,'AFFILIATE_CLAIMED','SUCCESS');
  return candidate.id;
end $$;

revoke all on function public.get_current_affiliate_access_state() from public, anon;
revoke all on function public.get_effective_affiliate_id() from public, anon;
revoke all on function public.claim_affiliate_identity() from public, anon;
grant execute on function public.get_current_affiliate_access_state() to authenticated;
grant execute on function public.get_effective_affiliate_id() to authenticated;
grant execute on function public.claim_affiliate_identity() to authenticated;

comment on function public.get_current_affiliate_access_state() is null;
comment on function public.get_effective_affiliate_id() is
  'Central self-service identity boundary; archived affiliates resolve to no effective business identity.';
comment on function public.claim_affiliate_identity() is
  'Links only a verified Auth email to exactly one eligible historical affiliate; never uses numero_control as a credential.';

notify pgrst, 'reload schema';
commit;
