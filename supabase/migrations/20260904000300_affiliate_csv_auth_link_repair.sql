begin;

create table public.affiliate_csv_auth_link_repair_batches (
  id uuid primary key,
  h_code text not null check (h_code = 'H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001'),
  source_name text not null,
  source_sha256 text not null check (source_sha256 ~ '^[A-F0-9]{64}$'),
  source_row_count integer not null check (source_row_count > 0),
  auth_links_checked integer not null check (auth_links_checked >= 0),
  correct_before integer not null check (correct_before >= 0),
  wrong_control_links_found integer not null check (wrong_control_links_found >= 0),
  repaired_count integer not null check (repaired_count >= 0),
  ambiguous_skipped integer not null check (ambiguous_skipped >= 0),
  correct_after integer null check (correct_after is null or correct_after >= 0),
  deterministic_cross_links_after integer null check (deterministic_cross_links_after is null or deterministic_cross_links_after >= 0),
  affected_affiliate_rows integer not null check (affected_affiliate_rows >= 0),
  status text not null check (status in ('APPLIED','RECOVERED')),
  applied_at timestamptz not null default now(),
  recovered_at timestamptz null,
  constraint affiliate_csv_auth_link_repair_batch_recovery_check check (
    (status = 'APPLIED' and recovered_at is null)
    or (status = 'RECOVERED' and recovered_at is not null)
  )
);

create table public.affiliate_csv_auth_link_repair_snapshot (
  batch_id uuid not null references public.affiliate_csv_auth_link_repair_batches(id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  numero_control text null,
  old_auth_user_id uuid null references auth.users(id) on delete restrict,
  expected_auth_user_id_after uuid null references auth.users(id) on delete restrict,
  old_updated_at timestamptz not null,
  applied_updated_at timestamptz null,
  recovered_updated_at timestamptz null,
  primary key (batch_id, affiliate_id)
);

create table public.affiliate_csv_auth_link_repairs (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.affiliate_csv_auth_link_repair_batches(id) on delete restrict,
  source_row_ordinal integer not null check (source_row_ordinal > 0),
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  auth_email_normalized text not null check (auth_email_normalized = lower(btrim(auth_email_normalized)) and auth_email_normalized <> ''),
  from_affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  from_numero_control text not null check (from_numero_control <> ''),
  to_affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  to_numero_control text not null check (to_numero_control <> ''),
  created_at timestamptz not null default now(),
  recovered_at timestamptz null,
  constraint affiliate_csv_auth_link_repair_distinct_check check (from_affiliate_id <> to_affiliate_id),
  unique (batch_id, auth_user_id),
  unique (batch_id, to_affiliate_id)
);

create unique index affiliate_csv_auth_link_repairs_active_auth_idx
  on public.affiliate_csv_auth_link_repairs(auth_user_id)
  where recovered_at is null;
create unique index affiliate_csv_auth_link_repairs_active_target_idx
  on public.affiliate_csv_auth_link_repairs(to_affiliate_id)
  where recovered_at is null;
create unique index affiliate_csv_auth_link_repairs_active_email_idx
  on public.affiliate_csv_auth_link_repairs(auth_email_normalized)
  where recovered_at is null;

comment on table public.affiliate_csv_auth_link_repair_batches is
  'Service-only manifest for the owner-authorized one-time CSV/Auth identity reconciliation. It is recovery evidence, not a roster or runtime email authority.';
comment on table public.affiliate_csv_auth_link_repair_snapshot is
  'Logical before/expected-after snapshot of every affiliate row touched by an Auth UUID reassignment.';
comment on table public.affiliate_csv_auth_link_repairs is
  'Append-only certified repair evidence binding one existing Auth UUID and confirmed email to the CSV-authorized target control. Historical email remains unchanged.';

alter table public.affiliate_csv_auth_link_repair_batches enable row level security;
alter table public.affiliate_csv_auth_link_repair_batches force row level security;
alter table public.affiliate_csv_auth_link_repair_snapshot enable row level security;
alter table public.affiliate_csv_auth_link_repair_snapshot force row level security;
alter table public.affiliate_csv_auth_link_repairs enable row level security;
alter table public.affiliate_csv_auth_link_repairs force row level security;

revoke all on table public.affiliate_csv_auth_link_repair_batches from public, anon, authenticated;
revoke all on table public.affiliate_csv_auth_link_repair_snapshot from public, anon, authenticated;
revoke all on table public.affiliate_csv_auth_link_repairs from public, anon, authenticated;

create function public.has_certified_affiliate_auth_link(
  p_auth_user_id uuid,
  p_affiliate_id uuid,
  p_auth_email_normalized text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.affiliate_csv_auth_link_repairs r
    join public.affiliate_csv_auth_link_repair_batches b
      on b.id = r.batch_id
     and b.status = 'APPLIED'
    join public.affiliates a
      on a.id = r.to_affiliate_id
     and a.auth_user_id = r.auth_user_id
     and a.numero_control = r.to_numero_control
    where r.recovered_at is null
      and r.auth_user_id = p_auth_user_id
      and r.to_affiliate_id = p_affiliate_id
      and r.auth_email_normalized = lower(btrim(coalesce(p_auth_email_normalized, '')))
  )
$$;

revoke all on function public.has_certified_affiliate_auth_link(uuid,uuid,text) from public, anon, authenticated;

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
      where p.email is not null
        and p.email <> ''
        and p.email_confirmed_at is not null
    ) then 'IDENTITY_MISMATCH'
    when exists(
      select 1
      from principal p
      join direct_link a on a.auth_user_id = p.id
      where public.has_certified_affiliate_auth_link(p.id, a.id, p.email)
    ) then 'ACTIVE'
    when not exists(
      select 1
      from principal p
      join direct_link a
        on a.auth_user_id = p.id
       and a.historical_email_normalized = p.email
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
        and (
          (
            a.historical_email_normalized = lower(btrim(u.email))
            and (
              select count(*)
              from public.affiliates candidate
              where candidate.historical_email_normalized = lower(btrim(u.email))
            ) = 1
          )
          or public.has_certified_affiliate_auth_link(u.id, a.id, u.email)
        )
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

  select a.* into candidate
  from public.affiliates a
  where a.auth_user_id = principal
    and public.has_certified_affiliate_auth_link(principal, a.id, principal_email);

  if candidate.id is not null then
    if candidate.is_archived then
      raise exception 'AFFILIATE_ARCHIVED' using errcode = '42501';
    end if;
    return candidate.id;
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

create or replace function public.get_affiliate_activation_status(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_count integer;
  v_candidate public.affiliates%rowtype;
begin
  if length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    return jsonb_build_object('status', 'INVALID_EMAIL');
  end if;

  if exists(
    select 1
    from public.affiliate_csv_auth_link_repairs r
    join public.affiliate_csv_auth_link_repair_batches b
      on b.id = r.batch_id
     and b.status = 'APPLIED'
    join auth.users u
      on u.id = r.auth_user_id
     and u.email_confirmed_at is not null
     and lower(btrim(u.email)) = r.auth_email_normalized
    join public.affiliates a
      on a.id = r.to_affiliate_id
     and a.auth_user_id = r.auth_user_id
     and a.numero_control = r.to_numero_control
    where r.recovered_at is null
      and r.auth_email_normalized = v_email
  ) then
    return jsonb_build_object('status', 'ALREADY_ACTIVATED');
  end if;

  select count(*) into v_count
  from public.affiliates a
  where a.historical_email_normalized = v_email;

  if v_count = 0 then
    return jsonb_build_object('status', 'NOT_REGISTERED');
  end if;
  if v_count <> 1 then
    return jsonb_build_object('status', 'AMBIGUOUS');
  end if;

  select * into v_candidate
  from public.affiliates a
  where a.historical_email_normalized = v_email;

  if v_candidate.is_archived or v_candidate.auth_eligibility <> 'eligible' then
    return jsonb_build_object('status', 'NOT_ELIGIBLE');
  end if;
  if v_candidate.auth_user_id is not null then
    return jsonb_build_object('status', 'ALREADY_ACTIVATED');
  end if;

  return jsonb_build_object('status', 'ELIGIBLE');
end;
$$;

create function public.apply_affiliate_csv_auth_link_repair(
  p_batch_id uuid,
  p_source_name text,
  p_source_sha256 text,
  p_source_row_count integer,
  p_expected_auth_links_checked integer,
  p_expected_correct_before integer,
  p_expected_wrong_control_links_found integer,
  p_expected_repaired_count integer,
  p_expected_ambiguous_skipped integer,
  p_source_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checked integer;
  v_correct_before integer;
  v_wrong_found integer;
  v_repair_count integer;
  v_ambiguous integer;
  v_affected integer;
  v_correct_after integer;
  v_cross_after integer;
  v_cleared integer;
  v_assigned integer;
  v_existing public.affiliate_csv_auth_link_repair_batches%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_batch_id is null
    or p_source_name <> 'Usuarios (8).csv'
    or p_source_sha256 <> '3AB97E9F16951E523301E1A080A1DB965F12739207798490022308FCF1F28E29'
    or p_source_row_count <> 947
    or jsonb_typeof(p_source_rows) <> 'array'
    or jsonb_array_length(p_source_rows) <> 947 then
    raise exception 'SOURCE_CONTRACT_MISMATCH' using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.affiliate_csv_auth_link_repair_batches
  where id = p_batch_id;
  if v_existing.id is not null then
    if v_existing.source_sha256 = p_source_sha256
      and v_existing.source_row_count = p_source_row_count
      and v_existing.status = 'APPLIED' then
      return jsonb_build_object(
        'status', v_existing.status,
        'auth_links_checked', v_existing.auth_links_checked,
        'correct_before', v_existing.correct_before,
        'wrong_control_links_found', v_existing.wrong_control_links_found,
        'repaired', v_existing.repaired_count,
        'ambiguous_skipped', v_existing.ambiguous_skipped,
        'correct_after', v_existing.correct_after,
        'deterministic_cross_links_after', v_existing.deterministic_cross_links_after,
        'affected_affiliate_rows', v_existing.affected_affiliate_rows,
        'idempotent', true
      );
    end if;
    raise exception 'BATCH_ID_CONFLICT' using errcode = 'P0001';
  end if;
  if exists(
    select 1
    from public.affiliate_csv_auth_link_repair_batches
    where status = 'APPLIED'
  ) then
    raise exception 'ACTIVE_REPAIR_BATCH_ALREADY_EXISTS' using errcode = 'P0001';
  end if;

  lock table public.affiliates in share row exclusive mode;

  create temporary table _csv_auth_source(
    ordinal integer primary key,
    numero_control text not null,
    email_raw text null,
    email_normalized text null
  ) on commit drop;

  insert into _csv_auth_source(ordinal, numero_control, email_raw, email_normalized)
  select
    x.ordinal,
    coalesce(x.numero_control, ''),
    nullif(btrim(x.email_raw), ''),
    nullif(lower(btrim(x.email_raw)), '')
  from jsonb_to_recordset(p_source_rows) as x(
    ordinal integer,
    numero_control text,
    email_raw text
  );

  if (select count(*) from _csv_auth_source) <> 947
    or (select min(ordinal) from _csv_auth_source) <> 1
    or (select max(ordinal) from _csv_auth_source) <> 947 then
    raise exception 'SOURCE_ROWS_INVALID' using errcode = 'P0001';
  end if;

  perform 1
  from auth.users u
  join public.affiliates a on a.auth_user_id = u.id
  for share of u;

  create temporary table _csv_auth_email_stats on commit drop as
  select
    email_normalized,
    count(*)::integer as email_count,
    min(ordinal)::integer as ordinal,
    min(numero_control) as numero_control
  from _csv_auth_source
  where email_normalized is not null
  group by email_normalized;

  create temporary table _csv_auth_control_stats on commit drop as
  select numero_control, count(*)::integer as control_count
  from _csv_auth_source
  where numero_control <> ''
  group by numero_control;

  create temporary table _db_auth_control_stats on commit drop as
  select numero_control, count(*)::integer as control_count, min(id::text)::uuid as affiliate_id
  from public.affiliates
  where numero_control is not null and numero_control <> ''
  group by numero_control;

  create temporary table _csv_auth_links_before on commit drop as
  select
    a.id as current_affiliate_id,
    a.numero_control as current_numero_control,
    a.auth_user_id,
    lower(btrim(u.email)) as auth_email_normalized,
    u.email_confirmed_at,
    es.ordinal as source_row_ordinal,
    es.numero_control as target_numero_control,
    ds_target.affiliate_id as target_affiliate_id,
    target.auth_user_id as target_auth_user_id,
    (
      es.email_count = 1
      and es.numero_control <> ''
      and cs_target.control_count = 1
      and ds_target.control_count = 1
    ) as target_is_unique,
    (
      a.numero_control is not null
      and a.numero_control <> ''
      and cs_current.control_count = 1
      and ds_current.control_count = 1
      and current_source.email_normalized is not null
      and current_email_stats.email_count = 1
    ) as current_is_unique,
    a.is_archived as current_is_archived,
    target.is_archived as target_is_archived,
    target.auth_eligibility as target_auth_eligibility
  from public.affiliates a
  join auth.users u on u.id = a.auth_user_id
  left join _csv_auth_email_stats es
    on es.email_normalized = lower(btrim(u.email))
  left join _csv_auth_control_stats cs_target
    on cs_target.numero_control = es.numero_control
  left join _db_auth_control_stats ds_target
    on ds_target.numero_control = es.numero_control
  left join public.affiliates target
    on target.id = ds_target.affiliate_id
  left join _csv_auth_control_stats cs_current
    on cs_current.numero_control = a.numero_control
  left join _csv_auth_source current_source
    on current_source.numero_control = a.numero_control
   and cs_current.control_count = 1
  left join _csv_auth_email_stats current_email_stats
    on current_email_stats.email_normalized = current_source.email_normalized
  left join _db_auth_control_stats ds_current
    on ds_current.numero_control = a.numero_control;

  alter table _csv_auth_links_before add primary key(auth_user_id);

  select count(*)::integer into v_checked from _csv_auth_links_before;
  select count(*)::integer into v_correct_before
  from _csv_auth_links_before
  where target_is_unique
    and target_affiliate_id = current_affiliate_id;
  select count(*)::integer into v_wrong_found
  from _csv_auth_links_before
  where target_is_unique
    and target_affiliate_id <> current_affiliate_id;

  create temporary table _csv_auth_repairs on commit drop as
  select *
  from _csv_auth_links_before
  where target_is_unique
    and current_is_unique
    and email_confirmed_at is not null
    and not current_is_archived
    and not target_is_archived
    and target_auth_eligibility = 'eligible'
    and target_affiliate_id <> current_affiliate_id;

  alter table _csv_auth_repairs add primary key(auth_user_id);
  create unique index _csv_auth_repairs_target_idx on _csv_auth_repairs(target_affiliate_id);

  select count(*)::integer into v_repair_count from _csv_auth_repairs;
  v_ambiguous := v_checked - v_correct_before - v_repair_count;

  if v_checked <> p_expected_auth_links_checked
    or v_correct_before <> p_expected_correct_before
    or v_wrong_found <> p_expected_wrong_control_links_found
    or v_repair_count <> p_expected_repaired_count
    or v_ambiguous <> p_expected_ambiguous_skipped then
    raise exception 'LIVE_PREFLIGHT_CHANGED:checked=% correct=% wrong=% repaired=% ambiguous=%',
      v_checked, v_correct_before, v_wrong_found, v_repair_count, v_ambiguous
      using errcode = 'P0001';
  end if;

  if v_repair_count < 1 then
    raise exception 'NO_DETERMINISTIC_REPAIRS' using errcode = 'P0001';
  end if;
  if not exists(
    select 1
    from _csv_auth_repairs
    where auth_email_normalized = 'cosaf@hotmail.com'
      and current_numero_control = '224761'
      and target_numero_control = '1536'
  ) then
    raise exception 'CONFIRMED_COSAF_REPAIR_NOT_PRESENT' using errcode = 'P0001';
  end if;
  if exists(
    select 1
    from _csv_auth_repairs r
    where r.target_auth_user_id is not null
      and not exists(
        select 1
        from _csv_auth_repairs occupant
        where occupant.auth_user_id = r.target_auth_user_id
      )
  ) then
    raise exception 'TARGET_OCCUPIED_OUTSIDE_DETERMINISTIC_REPAIR_SET' using errcode = 'P0001';
  end if;

  create temporary table _csv_auth_affected on commit drop as
  select current_affiliate_id as affiliate_id from _csv_auth_repairs
  union
  select target_affiliate_id from _csv_auth_repairs;
  alter table _csv_auth_affected add primary key(affiliate_id);
  select count(*)::integer into v_affected from _csv_auth_affected;

  insert into public.affiliate_csv_auth_link_repair_batches(
    id, h_code, source_name, source_sha256, source_row_count,
    auth_links_checked, correct_before, wrong_control_links_found,
    repaired_count, ambiguous_skipped, affected_affiliate_rows,
    status
  ) values (
    p_batch_id, 'H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001', p_source_name,
    p_source_sha256, p_source_row_count, v_checked, v_correct_before,
    v_wrong_found, v_repair_count, v_ambiguous, v_affected, 'APPLIED'
  );

  insert into public.affiliate_csv_auth_link_repair_snapshot(
    batch_id, affiliate_id, numero_control, old_auth_user_id,
    expected_auth_user_id_after, old_updated_at
  )
  select
    p_batch_id,
    a.id,
    a.numero_control,
    a.auth_user_id,
    (
      select r.auth_user_id
      from _csv_auth_repairs r
      where r.target_affiliate_id = a.id
    ),
    a.updated_at
  from public.affiliates a
  join _csv_auth_affected x on x.affiliate_id = a.id;

  insert into public.affiliate_csv_auth_link_repairs(
    batch_id, source_row_ordinal, auth_user_id, auth_email_normalized,
    from_affiliate_id, from_numero_control, to_affiliate_id, to_numero_control
  )
  select
    p_batch_id, source_row_ordinal, auth_user_id, auth_email_normalized,
    current_affiliate_id, current_numero_control, target_affiliate_id, target_numero_control
  from _csv_auth_repairs
  order by source_row_ordinal;

  update public.affiliates a
  set auth_user_id = null
  from _csv_auth_repairs r
  where a.id = r.current_affiliate_id
    and a.auth_user_id = r.auth_user_id;
  get diagnostics v_cleared = row_count;
  if v_cleared <> v_repair_count then
    raise exception 'AUTH_LINK_CLEAR_COUNT_MISMATCH:%', v_cleared using errcode = 'P0001';
  end if;

  update public.affiliates a
  set auth_user_id = r.auth_user_id
  from _csv_auth_repairs r
  where a.id = r.target_affiliate_id
    and a.auth_user_id is null;
  get diagnostics v_assigned = row_count;
  if v_assigned <> v_repair_count then
    raise exception 'AUTH_LINK_ASSIGN_COUNT_MISMATCH:%', v_assigned using errcode = 'P0001';
  end if;

  update public.affiliate_csv_auth_link_repair_snapshot s
  set applied_updated_at = a.updated_at
  from public.affiliates a
  where s.batch_id = p_batch_id
    and a.id = s.affiliate_id;

  if exists(
    select 1
    from public.affiliate_csv_auth_link_repair_snapshot s
    join public.affiliates a on a.id = s.affiliate_id
    where s.batch_id = p_batch_id
      and a.auth_user_id is distinct from s.expected_auth_user_id_after
  ) then
    raise exception 'POST_APPLY_SNAPSHOT_MISMATCH' using errcode = 'P0001';
  end if;
  if (select count(*) from public.affiliate_csv_auth_link_repairs where batch_id = p_batch_id) <> v_repair_count then
    raise exception 'REPAIR_AUDIT_COUNT_MISMATCH' using errcode = 'P0001';
  end if;
  if exists(
    select 1
    from _csv_auth_links_before before_link
    where not exists(
      select 1
      from public.affiliates a
      where a.auth_user_id = before_link.auth_user_id
    )
  ) or exists(
    select 1
    from public.affiliates a
    where a.auth_user_id is not null
      and not exists(
        select 1
        from _csv_auth_links_before before_link
        where before_link.auth_user_id = a.auth_user_id
      )
  ) then
    raise exception 'AUTH_PRINCIPAL_SET_CHANGED' using errcode = 'P0001';
  end if;

  create temporary table _csv_auth_links_after on commit drop as
  select
    a.id as current_affiliate_id,
    a.numero_control as current_numero_control,
    a.auth_user_id,
    es.numero_control as target_numero_control,
    ds_target.affiliate_id as target_affiliate_id,
    (
      es.email_count = 1
      and es.numero_control <> ''
      and cs_target.control_count = 1
      and ds_target.control_count = 1
    ) as target_is_unique,
    (
      a.numero_control is not null
      and a.numero_control <> ''
      and cs_current.control_count = 1
      and ds_current.control_count = 1
      and current_source.email_normalized is not null
      and current_email_stats.email_count = 1
    ) as current_is_unique
  from public.affiliates a
  join auth.users u on u.id = a.auth_user_id
  left join _csv_auth_email_stats es
    on es.email_normalized = lower(btrim(u.email))
  left join _csv_auth_control_stats cs_target
    on cs_target.numero_control = es.numero_control
  left join _db_auth_control_stats ds_target
    on ds_target.numero_control = es.numero_control
  left join _csv_auth_control_stats cs_current
    on cs_current.numero_control = a.numero_control
  left join _csv_auth_source current_source
    on current_source.numero_control = a.numero_control
   and cs_current.control_count = 1
  left join _csv_auth_email_stats current_email_stats
    on current_email_stats.email_normalized = current_source.email_normalized
  left join _db_auth_control_stats ds_current
    on ds_current.numero_control = a.numero_control;

  select count(*)::integer into v_correct_after
  from _csv_auth_links_after
  where target_is_unique and target_affiliate_id = current_affiliate_id;
  select count(*)::integer into v_cross_after
  from _csv_auth_links_after
  where target_is_unique
    and current_is_unique
    and target_affiliate_id <> current_affiliate_id;

  if (select count(*) from _csv_auth_links_after) <> v_checked
    or v_correct_after <> v_correct_before + v_repair_count
    or v_cross_after <> 0 then
    raise exception 'POST_APPLY_IDENTITY_RECONCILIATION_FAILED:correct=% cross=%',
      v_correct_after, v_cross_after using errcode = 'P0001';
  end if;
  if not exists(
    select 1
    from auth.users u
    join public.affiliates a on a.auth_user_id = u.id
    where lower(btrim(u.email)) = 'cosaf@hotmail.com'
      and a.numero_control = '1536'
      and public.has_certified_affiliate_auth_link(u.id, a.id, u.email)
  ) then
    raise exception 'COSAF_POST_APPLY_VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  update public.affiliate_csv_auth_link_repair_batches
  set correct_after = v_correct_after,
      deterministic_cross_links_after = v_cross_after
  where id = p_batch_id;

  return jsonb_build_object(
    'status', 'APPLIED',
    'auth_links_checked', v_checked,
    'correct_before', v_correct_before,
    'wrong_control_links_found', v_wrong_found,
    'repaired', v_repair_count,
    'ambiguous_skipped', v_ambiguous,
    'correct_after', v_correct_after,
    'deterministic_cross_links_after', v_cross_after,
    'affected_affiliate_rows', v_affected,
    'cosaf_control_1536', true,
    'idempotent', false
  );
end;
$$;

create function public.recover_affiliate_csv_auth_link_repair(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.affiliate_csv_auth_link_repair_batches%rowtype;
  v_restored integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  lock table public.affiliates in share row exclusive mode;
  select * into v_batch
  from public.affiliate_csv_auth_link_repair_batches
  where id = p_batch_id
  for update;

  if v_batch.id is null then
    raise exception 'BATCH_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_batch.status = 'RECOVERED' then
    return jsonb_build_object('status', 'RECOVERED', 'idempotent', true);
  end if;
  if v_batch.status <> 'APPLIED'
    or v_batch.deterministic_cross_links_after <> 0
    or (select count(*) from public.affiliate_csv_auth_link_repairs where batch_id = p_batch_id and recovered_at is null) <> v_batch.repaired_count
    or (select count(*) from public.affiliate_csv_auth_link_repair_snapshot where batch_id = p_batch_id) <> v_batch.affected_affiliate_rows then
    raise exception 'RECOVERY_MANIFEST_MISMATCH' using errcode = 'P0001';
  end if;
  if exists(
    select 1
    from public.affiliate_csv_auth_link_repair_snapshot s
    join public.affiliates a on a.id = s.affiliate_id
    where s.batch_id = p_batch_id
      and (
        a.auth_user_id is distinct from s.expected_auth_user_id_after
        or a.updated_at is distinct from s.applied_updated_at
      )
  ) then
    raise exception 'RECOVERY_BLOCKED_AFFECTED_ROW_CHANGED' using errcode = 'P0001';
  end if;

  update public.affiliates a
  set auth_user_id = null
  from public.affiliate_csv_auth_link_repair_snapshot s
  where s.batch_id = p_batch_id
    and a.id = s.affiliate_id
    and a.auth_user_id is not null;

  update public.affiliates a
  set auth_user_id = s.old_auth_user_id
  from public.affiliate_csv_auth_link_repair_snapshot s
  where s.batch_id = p_batch_id
    and a.id = s.affiliate_id
    and s.old_auth_user_id is not null
    and a.auth_user_id is null;
  get diagnostics v_restored = row_count;

  if v_restored <> v_batch.repaired_count
    or exists(
      select 1
      from public.affiliate_csv_auth_link_repair_snapshot s
      join public.affiliates a on a.id = s.affiliate_id
      where s.batch_id = p_batch_id
        and a.auth_user_id is distinct from s.old_auth_user_id
    ) then
    raise exception 'RECOVERY_RESTORE_MISMATCH:%', v_restored using errcode = 'P0001';
  end if;

  update public.affiliate_csv_auth_link_repairs
  set recovered_at = now()
  where batch_id = p_batch_id
    and recovered_at is null;

  update public.affiliate_csv_auth_link_repair_snapshot s
  set recovered_updated_at = a.updated_at
  from public.affiliates a
  where s.batch_id = p_batch_id
    and a.id = s.affiliate_id;

  update public.affiliate_csv_auth_link_repair_batches
  set status = 'RECOVERED', recovered_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'status', 'RECOVERED',
    'restored_auth_links', v_restored,
    'idempotent', false
  );
end;
$$;

revoke all on function public.get_current_affiliate_access_state() from public, anon;
revoke all on function public.get_effective_affiliate_id() from public, anon;
revoke all on function public.claim_affiliate_identity() from public, anon;
revoke all on function public.get_affiliate_activation_status(text) from public;
grant execute on function public.get_current_affiliate_access_state() to authenticated;
grant execute on function public.get_effective_affiliate_id() to authenticated;
grant execute on function public.claim_affiliate_identity() to authenticated;
grant execute on function public.get_affiliate_activation_status(text) to anon, authenticated;

revoke all on function public.apply_affiliate_csv_auth_link_repair(uuid,text,text,integer,integer,integer,integer,integer,integer,jsonb) from public, anon, authenticated;
revoke all on function public.recover_affiliate_csv_auth_link_repair(uuid) from public, anon, authenticated;
grant execute on function public.apply_affiliate_csv_auth_link_repair(uuid,text,text,integer,integer,integer,integer,integer,integer,jsonb) to service_role;
grant execute on function public.recover_affiliate_csv_auth_link_repair(uuid) to service_role;

comment on function public.get_current_affiliate_access_state() is
  'Fail-closed session identity state. Normal sessions require either the globally unique historical-email proof or an active hash-certified UUID/control repair; valid session-bound impersonation remains the only context exception.';
comment on function public.get_effective_affiliate_id() is
  'Central self-service identity boundary. A repaired normal session must match Auth UUID, confirmed Auth email, target affiliate and CSV-authorized control in active service-only evidence.';
comment on function public.claim_affiliate_identity() is
  'Returns an already certified repaired link without rewriting it; new claims retain the globally unique historical-email contract.';
comment on function public.get_affiliate_activation_status(text) is
  'Minimal public activation preflight. Active certified repairs report ALREADY_ACTIVATED without exposing identity; all other candidates retain the historical fail-closed contract.';
comment on function public.apply_affiliate_csv_auth_link_repair(uuid,text,text,integer,integer,integer,integer,integer,integer,jsonb) is
  'Service-only, hash-pinned, lock-protected one-time repair of existing Auth UUID links for unique CSV control/email pairs. Ambiguous and empty controls are never changed.';
comment on function public.recover_affiliate_csv_auth_link_repair(uuid) is
  'Service-only guarded data recovery. Restores the logical snapshot only while every affected row still equals the exact applied state.';

notify pgrst, 'reload schema';
commit;
