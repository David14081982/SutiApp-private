begin;

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write',
  'affiliates.read','affiliates.impersonate'
]::text[]);

do $$
declare affected integer;
begin
  if (select count(*) from public.admin_assignments where enabled and role='visual_admin') <> 1 then
    raise exception 'EXPECTED_EXACTLY_ONE_PREAUTHORIZED_H008_ADMIN';
  end if;
  update public.admin_assignments
  set permissions = array(select distinct p from unnest(permissions || array['affiliates.read','affiliates.impersonate']) p), updated_at=now()
  where enabled and role='visual_admin';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'ADMIN_PERMISSION_RECONCILIATION_FAILED'; end if;
end $$;

create table public.identity_audit_log (
  id bigint generated always as identity primary key,
  actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
  usuario_contexto_affiliate_id uuid null references public.affiliates(id) on delete restrict,
  action text not null,
  result text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint identity_audit_action_check check (action in ('AFFILIATE_CLAIMED','IMPERSONATION_STARTED','IMPERSONATION_STOPPED')),
  constraint identity_audit_result_check check (result in ('SUCCESS','DENIED','FAILURE'))
);

create table public.impersonation_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
  usuario_contexto_affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  reason text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz null,
  ended_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  constraint impersonation_reason_check check (char_length(btrim(reason)) between 8 and 500),
  constraint impersonation_ttl_check check (expires_at > started_at and expires_at <= started_at + interval '30 minutes')
);
create unique index impersonation_one_open_per_actor_idx on public.impersonation_sessions(actor_real_auth_user_id) where ended_at is null;
create index impersonation_context_idx on public.impersonation_sessions(usuario_contexto_affiliate_id, expires_at desc);

alter table public.admin_audit_log
  add column usuario_contexto_affiliate_id uuid null references public.affiliates(id) on delete restrict,
  add column impersonation_session_id uuid null references public.impersonation_sessions(id) on delete restrict,
  add column reason text null;

create or replace function public.claim_affiliate_identity()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  principal uuid := (select auth.uid());
  principal_email text;
  confirmed timestamptz;
  candidate public.affiliates%rowtype;
  matches integer;
begin
  if principal is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  select lower(btrim(u.email)), u.email_confirmed_at into principal_email, confirmed from auth.users u where u.id = principal;
  if principal_email is null or principal_email = '' or confirmed is null then raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode = 'P0001'; end if;

  select count(*) into matches from public.affiliates a
  where a.historical_email_normalized = principal_email and a.auth_eligibility = 'eligible';
  if matches <> 1 then raise exception 'AFFILIATE_NOT_UNIQUELY_ELIGIBLE' using errcode = 'P0001'; end if;

  select * into candidate from public.affiliates a
  where a.historical_email_normalized = principal_email and a.auth_eligibility = 'eligible'
  for update;
  if candidate.auth_user_id is not null and candidate.auth_user_id <> principal then
    raise exception 'AFFILIATE_ALREADY_LINKED' using errcode = 'P0001';
  end if;
  update public.affiliates set auth_user_id = principal, updated_at = now()
  where id = candidate.id and (auth_user_id is null or auth_user_id = principal);
  insert into public.identity_audit_log(actor_real_auth_user_id, usuario_contexto_affiliate_id, action, result)
  values (principal, candidate.id, 'AFFILIATE_CLAIMED', 'SUCCESS');
  return candidate.id;
end;
$$;

create or replace function public.start_affiliate_impersonation(p_affiliate_id uuid, p_reason text)
returns table(session_id uuid, affiliate_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare principal uuid := (select auth.uid()); created public.impersonation_sessions%rowtype;
begin
  if principal is null or not public.has_admin_permission('affiliates.impersonate') then raise exception 'ADMIN_DENIED' using errcode='P0001'; end if;
  if char_length(btrim(coalesce(p_reason,''))) < 8 then raise exception 'REASON_REQUIRED' using errcode='P0001'; end if;
  if not exists(select 1 from public.affiliates where id=p_affiliate_id) then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
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

create or replace function public.stop_affiliate_impersonation()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare principal uuid := (select auth.uid()); active public.impersonation_sessions%rowtype;
begin
  select * into active from public.impersonation_sessions
   where actor_real_auth_user_id=principal and ended_at is null and expires_at > now() for update;
  if active.id is null then return false; end if;
  update public.impersonation_sessions set ended_at=now(), ended_by_auth_user_id=principal where id=active.id;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(principal,active.usuario_contexto_affiliate_id,'IMPERSONATION_STOPPED','SUCCESS',jsonb_build_object('session_id',active.id));
  return true;
end;
$$;

create or replace function public.get_impersonation_context()
returns table(session_id uuid, actor_real_auth_user_id uuid, usuario_contexto_affiliate_id uuid, reason text, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$ select s.id,s.actor_real_auth_user_id,s.usuario_contexto_affiliate_id,s.reason,s.expires_at
 from public.impersonation_sessions s where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now()
 and public.has_admin_permission('affiliates.impersonate') limit 1 $$;

create or replace function public.get_effective_affiliate_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select coalesce(
 (select s.usuario_contexto_affiliate_id from public.impersonation_sessions s where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now() and public.has_admin_permission('affiliates.impersonate') limit 1),
 (select a.id from public.affiliates a where a.auth_user_id=(select auth.uid()) limit 1)
) $$;

create or replace function public.search_affiliates_for_impersonation(p_query text)
returns table(id uuid, numero_control text, display_name text, full_name text, auth_eligibility text)
language plpgsql stable security definer set search_path = ''
as $$ begin
 if not public.has_admin_permission('affiliates.read') then raise exception 'ADMIN_DENIED' using errcode='P0001'; end if;
 if char_length(btrim(coalesce(p_query,''))) < 2 then return; end if;
 return query select a.id,a.numero_control,a.display_name,a.full_name,a.auth_eligibility from public.affiliates a
 where a.numero_control ilike '%'||btrim(p_query)||'%' or a.display_name ilike '%'||btrim(p_query)||'%' or a.full_name ilike '%'||btrim(p_query)||'%'
 order by a.source_row_ordinal limit 20;
end $$;

drop policy affiliates_select_own on public.affiliates;
create policy affiliates_select_effective on public.affiliates for select to authenticated
using (id = public.get_effective_affiliate_id());

create or replace function public.audit_admin_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare row_data jsonb; target text; ctx public.impersonation_sessions%rowtype;
begin
  if (select auth.uid()) is null then return coalesce(new, old); end if;
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target := coalesce(row_data->>'id', row_data->>'company_id', row_data->>'asset_id', row_data->>'asset_key');
  select * into ctx from public.impersonation_sessions where actor_real_auth_user_id=(select auth.uid()) and ended_at is null and expires_at>now() limit 1;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,usuario_contexto_affiliate_id,impersonation_session_id,reason)
  values ((select auth.uid()),tg_table_name,tg_op,target,'SUCCESS',ctx.usuario_contexto_affiliate_id,ctx.id,ctx.reason);
  return coalesce(new, old);
end;
$$;

alter table public.identity_audit_log enable row level security;
alter table public.identity_audit_log force row level security;
alter table public.impersonation_sessions enable row level security;
alter table public.impersonation_sessions force row level security;
revoke all on public.identity_audit_log, public.impersonation_sessions from public, anon, authenticated;
grant select on public.identity_audit_log to authenticated;
create policy identity_audit_admin_read on public.identity_audit_log for select to authenticated using (public.has_admin_permission('affiliates.read'));

revoke all on function public.claim_affiliate_identity(), public.start_affiliate_impersonation(uuid,text), public.stop_affiliate_impersonation(), public.get_impersonation_context(), public.get_effective_affiliate_id(), public.search_affiliates_for_impersonation(text) from public, anon;
grant execute on function public.claim_affiliate_identity(), public.start_affiliate_impersonation(uuid,text), public.stop_affiliate_impersonation(), public.get_impersonation_context(), public.get_effective_affiliate_id(), public.search_affiliates_for_impersonation(text) to authenticated;

comment on function public.claim_affiliate_identity() is 'Links only a verified Auth email to exactly one eligible historical affiliate; never uses numero_control as a credential.';
comment on table public.impersonation_sessions is 'Backend-authorized, reason-bound, non-nested administrative context with a hard 30-minute TTL.';
comment on column public.admin_audit_log.actor_auth_user_id is 'actor_real: immutable authenticated principal; never replaced by impersonated context.';
comment on column public.admin_audit_log.usuario_contexto_affiliate_id is 'Optional affiliate context active during an audited administrative action.';

commit;
