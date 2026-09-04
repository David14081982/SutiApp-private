begin;

create or replace function public.get_current_affiliate_access_state()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with principal as (
    select
      u.id,
      lower(btrim(u.email)) as email,
      u.email_confirmed_at
    from auth.users u
    where u.id = (select auth.uid())
  ),
  direct_link as (
    select a.*
    from public.affiliates a
    where a.auth_user_id = (select auth.uid())
  )
  select case
    when exists(
      select 1
      from public.impersonation_sessions s
      join public.affiliates a on a.id = s.usuario_contexto_affiliate_id
      where s.actor_real_auth_user_id = (select auth.uid())
        and s.ended_at is null
        and s.expires_at > now()
        and s.actor_auth_session_id = nullif((select auth.jwt()->>'session_id'), '')
        and public.has_admin_permission('affiliates.impersonate')
        and a.is_archived
    ) then 'ARCHIVED'
    when exists(
      select 1
      from public.impersonation_sessions s
      join public.affiliates a on a.id = s.usuario_contexto_affiliate_id
      where s.actor_real_auth_user_id = (select auth.uid())
        and s.ended_at is null
        and s.expires_at > now()
        and s.actor_auth_session_id = nullif((select auth.jwt()->>'session_id'), '')
        and public.has_admin_permission('affiliates.impersonate')
        and not a.is_archived
    ) then 'ACTIVE'
    when (select count(*) from direct_link) = 0 then 'UNLINKED'
    when (select count(*) from direct_link) <> 1 then 'IDENTITY_MISMATCH'
    when (select is_archived from direct_link limit 1) then 'ARCHIVED'
    when not exists(
      select 1
      from principal p
      join direct_link a
        on a.auth_user_id = p.id
       and a.historical_email_normalized = p.email
      where p.email is not null
        and p.email <> ''
        and p.email_confirmed_at is not null
    ) then 'IDENTITY_MISMATCH'
    when (
      select count(*)
      from public.affiliates a
      join principal p on a.historical_email_normalized = p.email
    ) <> 1 then 'AMBIGUOUS_IDENTITY'
    else 'ACTIVE'
  end
$$;

create or replace function public.get_effective_affiliate_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select s.usuario_contexto_affiliate_id
      from public.impersonation_sessions s
      join public.affiliates a
        on a.id = s.usuario_contexto_affiliate_id
       and not a.is_archived
      where s.actor_real_auth_user_id = (select auth.uid())
        and s.ended_at is null
        and s.expires_at > now()
        and s.actor_auth_session_id = nullif((select auth.jwt()->>'session_id'), '')
        and public.has_admin_permission('affiliates.impersonate')
      limit 1
    ),
    (
      select a.id
      from public.affiliates a
      join auth.users u on u.id = (select auth.uid())
      where a.auth_user_id = u.id
        and not a.is_archived
        and u.email_confirmed_at is not null
        and lower(btrim(u.email)) <> ''
        and a.historical_email_normalized = lower(btrim(u.email))
        and (
          select count(*)
          from public.affiliates candidate
          where candidate.historical_email_normalized = lower(btrim(u.email))
        ) = 1
      limit 1
    )
  )
$$;

create or replace function public.claim_affiliate_identity()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  principal uuid := (select auth.uid());
  principal_email text;
  confirmed timestamptz;
  candidate public.affiliates%rowtype;
  matches integer;
  updated_rows integer;
begin
  if principal is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select lower(btrim(u.email)), u.email_confirmed_at
    into principal_email, confirmed
  from auth.users u
  where u.id = principal;

  if principal_email is null or principal_email = '' or confirmed is null then
    raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode = 'P0001';
  end if;

  select count(*) into matches
  from public.affiliates a
  where a.historical_email_normalized = principal_email;

  if matches <> 1 then
    raise exception 'AFFILIATE_IDENTITY_AMBIGUOUS' using errcode = '42501';
  end if;

  select * into candidate
  from public.affiliates a
  where a.historical_email_normalized = principal_email
  for update;

  if candidate.is_archived then
    raise exception 'AFFILIATE_ARCHIVED' using errcode = '42501';
  end if;
  if candidate.auth_eligibility <> 'eligible' then
    raise exception 'AFFILIATE_NOT_ELIGIBLE' using errcode = '42501';
  end if;
  if exists(
    select 1
    from public.affiliates a
    where a.auth_user_id = principal
      and a.id <> candidate.id
  ) then
    raise exception 'AUTH_IDENTITY_LINK_CONFLICT' using errcode = '42501';
  end if;
  if candidate.auth_user_id is not null and candidate.auth_user_id <> principal then
    raise exception 'AFFILIATE_ALREADY_LINKED' using errcode = '42501';
  end if;

  update public.affiliates
  set auth_user_id = principal,
      updated_at = now()
  where id = candidate.id
    and not is_archived
    and auth_eligibility = 'eligible'
    and historical_email_normalized = principal_email
    and (auth_user_id is null or auth_user_id = principal);
  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    raise exception 'AUTH_IDENTITY_LINK_CONFLICT' using errcode = '42501';
  end if;

  insert into public.identity_audit_log(
    actor_real_auth_user_id,
    usuario_contexto_affiliate_id,
    action,
    result
  ) values (
    principal,
    candidate.id,
    'AFFILIATE_CLAIMED',
    'SUCCESS'
  );

  return candidate.id;
end;
$$;

revoke all on function public.get_current_affiliate_access_state() from public, anon;
revoke all on function public.get_effective_affiliate_id() from public, anon;
revoke all on function public.claim_affiliate_identity() from public, anon;
grant execute on function public.get_current_affiliate_access_state() to authenticated;
grant execute on function public.get_effective_affiliate_id() to authenticated;
grant execute on function public.claim_affiliate_identity() to authenticated;

comment on function public.get_current_affiliate_access_state() is
  'Fail-closed session identity state. Normal sessions require one exact Auth link, confirmed matching email and globally unambiguous historical email; valid session-bound impersonation is the only context exception.';
comment on function public.get_effective_affiliate_id() is
  'Central self-service identity boundary. Normal sessions resolve only an exact, confirmed and globally unambiguous Auth-to-affiliate link; authorized session-bound impersonation remains the sole exception.';
comment on function public.claim_affiliate_identity() is
  'Links a verified Auth principal only when its historical email corresponds to exactly one affiliate across the entire roster; ambiguous email never selects an eligible row.';

notify pgrst, 'reload schema';
commit;
