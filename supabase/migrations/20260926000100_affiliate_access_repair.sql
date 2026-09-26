begin;

set local lock_timeout='2s';

set local statement_timeout='60s';

-- Owner instruction H-AFFILIATE-ACCESS-REPAIR-001: diagnose and repair affiliate app access
-- from Admin > Afiliados. Additive only: no existing function, table, grant or policy changes
-- and no business DML. Permission reuses affiliates.read / affiliates.write (owner decision).

create table public.affiliate_access_repairs (
  id bigint generated always as identity primary key,
  action text not null check (action in (
    'ACCOUNT_RELINKED','ACCOUNT_RELEASED','ELIGIBILITY_RECALCULATED','ELIGIBILITY_AUTO_RELEASED'
  )),
  actor_auth_user_id uuid null references auth.users(id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  source_affiliate_id uuid null references public.affiliates(id) on delete restrict,
  auth_user_id uuid null references auth.users(id) on delete restrict,
  before_state jsonb not null check (jsonb_typeof(before_state) = 'object'),
  after_state jsonb not null check (jsonb_typeof(after_state) = 'object'),
  reason text not null default '' check (length(reason) <= 500),
  created_at timestamptz not null default now(),
  reverted_at timestamptz null
);

create index affiliate_access_repairs_affiliate_idx on public.affiliate_access_repairs(affiliate_id, created_at desc);

comment on table public.affiliate_access_repairs is
  'Service-only evidence of every access repair (manual or automatic). Holds the exact before/after state so each repair can be reverted by revert_affiliate_access_repair.';

alter table public.affiliate_access_repairs enable row level security;
alter table public.affiliate_access_repairs force row level security;
revoke all on table public.affiliate_access_repairs from public, anon, authenticated;

-- Eligibility the current contract assigns to an unlinked row. Never returns 'eligible'
-- while another row shares the email, so it cannot violate affiliates_eligible_email_unique.
create function public.affiliate_access_expected_eligibility(p_affiliate_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when a.historical_email_normalized is null then 'missing_email'
    when a.historical_email_normalized !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then 'invalid_email'
    when exists(
      select 1 from public.affiliates b
      where b.id <> a.id and b.historical_email_normalized = a.historical_email_normalized
    ) then 'duplicate_email'
    else 'eligible'
  end
  from public.affiliates a
  where a.id = p_affiliate_id
$$;

-- When an email stops being shared (edited or removed from one row), the remaining row
-- kept 'duplicate_email' forever. Release it: only unlinked rows blocked as duplicate.
create function public.affiliates_release_stale_duplicate_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := old.historical_email_normalized;
  v_row public.affiliates%rowtype;
  v_count integer;
begin
  if v_email is null then return null; end if;
  if tg_op = 'UPDATE' and new.historical_email_normalized is not distinct from v_email then return null; end if;

  select count(*) into v_count from public.affiliates where historical_email_normalized = v_email;
  if v_count <> 1 then return null; end if;

  select * into v_row from public.affiliates where historical_email_normalized = v_email for update;
  if v_row.auth_user_id is not null
    or v_row.auth_eligibility <> 'duplicate_email'
    or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    return null;
  end if;

  update public.affiliates
  set auth_eligibility = 'eligible', auth_ineligibility_reason = null
  where id = v_row.id;

  insert into public.affiliate_access_repairs(
    action, actor_auth_user_id, affiliate_id, source_affiliate_id,
    before_state, after_state, reason
  ) values (
    'ELIGIBILITY_AUTO_RELEASED', auth.uid(), v_row.id, old.id,
    jsonb_build_object('auth_eligibility', 'duplicate_email'),
    jsonb_build_object('auth_eligibility', 'eligible'),
    'Automático: el correo dejó de estar duplicado'
  );

  if auth.uid() is not null then
    insert into public.affiliate_admin_events(
      affiliate_id, actor_auth_user_id, action, before_values, after_values, changed_fields, reason
    ) values (
      v_row.id, auth.uid(), 'UPDATE',
      jsonb_build_object('acceso_app', 'Bloqueado por correo duplicado'),
      jsonb_build_object('acceso_app', 'Puede activar su cuenta'),
      array['acceso_app'],
      'Acceso a la app · bloqueo retirado automáticamente: el correo ya no está en el control '
        || coalesce(old.numero_control, 'sin número')
    );
  end if;
  return null;
end;
$$;

create trigger affiliates_release_stale_duplicate_email
after update of historical_email_normalized or delete on public.affiliates
for each row execute function public.affiliates_release_stale_duplicate_email();

create function public.get_admin_affiliate_access_diagnosis(p_affiliate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.affiliates%rowtype;
  v_holder public.affiliates%rowtype;
  v_email text;
  v_email_valid boolean;
  v_link_email text;
  v_link_confirmed timestamptz;
  v_link_last timestamptz;
  v_link_certified boolean := false;
  v_link_matches boolean := false;
  v_accounts integer := 0;
  v_account uuid;
  v_account_confirmed timestamptz;
  v_account_last timestamptz;
  v_holder_certified boolean := false;
  v_siblings jsonb := '[]'::jsonb;
  v_sibling_count integer := 0;
  v_expected text;
  v_activation text;
  v_issues text[] := array[]::text[];
  v_can_relink boolean := false;
  v_can_release boolean := false;
  v_can_recalculate boolean := false;
  v_state text;
begin
  if not public.has_admin_permission('affiliates.read') then
    raise exception 'AFFILIATE_READ_DENIED' using errcode = '42501';
  end if;
  select * into v_row from public.affiliates where id = p_affiliate_id;
  if v_row.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0001'; end if;

  v_email := v_row.historical_email_normalized;
  v_email_valid := v_email is not null and v_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$';
  v_expected := public.affiliate_access_expected_eligibility(v_row.id);

  if v_row.auth_user_id is not null then
    select lower(btrim(u.email)), u.email_confirmed_at, u.last_sign_in_at
      into v_link_email, v_link_confirmed, v_link_last
    from auth.users u where u.id = v_row.auth_user_id;
    v_link_certified := public.has_certified_affiliate_auth_link(v_row.auth_user_id, v_row.id, v_link_email);
    v_link_matches := v_link_email is not distinct from v_email;
  end if;

  if v_email is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', b.id, 'numero_control', b.numero_control,
             'name', coalesce(b.display_name, b.full_name),
             'is_archived', b.is_archived, 'linked', b.auth_user_id is not null
           ) order by b.numero_control), '[]'::jsonb), count(*)
      into v_siblings, v_sibling_count
    from public.affiliates b
    where b.id <> v_row.id and b.historical_email_normalized = v_email;

    select count(*), min(u.id::text)::uuid into v_accounts, v_account
    from auth.users u where lower(btrim(u.email)) = v_email;
    if v_accounts = 1 then
      select u.email_confirmed_at, u.last_sign_in_at into v_account_confirmed, v_account_last
      from auth.users u where u.id = v_account;
      select * into v_holder from public.affiliates where auth_user_id = v_account;
      if v_holder.id is not null then
        v_holder_certified := public.has_certified_affiliate_auth_link(v_account, v_holder.id, v_email);
      end if;
    end if;
    v_activation := public.get_affiliate_activation_status(v_email)->>'status';
  end if;

  if v_row.is_archived then v_issues := array_append(v_issues, 'ARCHIVED'); end if;
  if v_email is null and v_row.auth_user_id is null then v_issues := array_append(v_issues, 'MISSING_EMAIL'); end if;
  if v_email is not null and not v_email_valid then v_issues := array_append(v_issues, 'INVALID_EMAIL'); end if;
  if v_sibling_count > 0 then v_issues := array_append(v_issues, 'SHARED_EMAIL'); end if;
  if v_row.auth_user_id is null and v_row.auth_eligibility <> 'eligible' and v_expected = 'eligible' then
    v_issues := array_append(v_issues, 'STALE_BLOCK');
  end if;
  if v_row.auth_user_id is not null and not v_link_matches and not v_link_certified then
    v_issues := array_append(v_issues, 'LINK_EMAIL_MISMATCH');
  end if;
  if v_accounts = 1 and v_holder.id is not null and v_holder.id <> v_row.id then
    v_issues := array_append(v_issues, 'ACCOUNT_ON_OTHER_AFFILIATE');
  end if;
  if v_accounts = 1 and v_holder.id is null and v_row.auth_user_id is null and v_account_confirmed is not null then
    v_issues := array_append(v_issues, 'ACCOUNT_WITHOUT_AFFILIATE');
  end if;

  v_can_relink := not v_row.is_archived
    and v_row.auth_user_id is null
    and v_email_valid
    and v_sibling_count = 0
    and v_accounts = 1
    and v_account_confirmed is not null
    and (v_holder.id is null or (v_holder.id <> v_row.id and not v_holder_certified));
  v_can_release := v_row.auth_user_id is not null and not v_link_matches and not v_link_certified;
  v_can_recalculate := not v_row.is_archived and v_row.auth_user_id is null
    and v_row.auth_eligibility <> 'eligible' and v_expected = 'eligible';

  v_state := case
    when v_row.is_archived then 'ARCHIVED'
    when v_row.auth_user_id is not null and (v_link_certified or (v_link_matches and v_sibling_count = 0)) then 'ACTIVE'
    when v_row.auth_user_id is null and v_activation = 'ELIGIBLE' then 'READY'
    else 'BLOCKED'
  end;

  return jsonb_build_object(
    'affiliate_id', v_row.id,
    'updated_at', v_row.updated_at,
    'state', v_state,
    'email', v_email,
    'auth_eligibility', v_row.auth_eligibility,
    'expected_eligibility', v_expected,
    'activation_status', v_activation,
    'issues', to_jsonb(v_issues),
    'siblings', v_siblings,
    'linked_account', case when v_row.auth_user_id is null then null else jsonb_build_object(
      'email', v_link_email, 'confirmed', v_link_confirmed is not null,
      'last_sign_in_at', v_link_last, 'matches_email', v_link_matches, 'certified', v_link_certified
    ) end,
    'email_account', case when v_accounts = 0 then null else jsonb_build_object(
      'ambiguous', v_accounts > 1,
      'confirmed', v_account_confirmed is not null,
      'last_sign_in_at', v_account_last,
      'holder', case when v_holder.id is null then null else jsonb_build_object(
        'id', v_holder.id, 'numero_control', v_holder.numero_control,
        'name', coalesce(v_holder.display_name, v_holder.full_name),
        'is_self', v_holder.id = v_row.id, 'certified', v_holder_certified
      ) end
    ) end,
    'actions', jsonb_build_object(
      'relink', v_can_relink, 'release', v_can_release, 'recalculate', v_can_recalculate
    )
  );
end;
$$;

create function public.list_admin_affiliate_access_issues()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then
    raise exception 'AFFILIATE_READ_DENIED' using errcode = '42501';
  end if;
  with emails as (
    select historical_email_normalized as email, count(*) as rows_count
    from public.affiliates
    where historical_email_normalized is not null
    group by historical_email_normalized
  ),
  issues as (
    select a.id, 'SHARED_EMAIL'::text as code
    from public.affiliates a join emails e on e.email = a.historical_email_normalized
    where e.rows_count > 1 and not a.is_archived
    union all
    select a.id, 'STALE_BLOCK'
    from public.affiliates a join emails e on e.email = a.historical_email_normalized
    where e.rows_count = 1 and not a.is_archived and a.auth_user_id is null
      and a.auth_eligibility <> 'eligible'
      and a.historical_email_normalized ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    union all
    select a.id, 'LINK_EMAIL_MISMATCH'
    from public.affiliates a join auth.users u on u.id = a.auth_user_id
    where not a.is_archived
      and a.historical_email_normalized is distinct from lower(btrim(u.email))
      and not public.has_certified_affiliate_auth_link(u.id, a.id, u.email)
    union all
    select a.id, 'ACCOUNT_ON_OTHER_AFFILIATE'
    from public.affiliates a
    join emails e on e.email = a.historical_email_normalized and e.rows_count = 1
    join auth.users u on lower(btrim(u.email)) = a.historical_email_normalized
    join public.affiliates holder on holder.auth_user_id = u.id and holder.id <> a.id
    where not a.is_archived and a.auth_user_id is null
  ),
  grouped as (
    select id, array_agg(distinct code order by code) as codes from issues group by id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'numero_control', a.numero_control,
           'name', coalesce(a.display_name, a.full_name),
           'email', a.historical_email_normalized,
           'linked', a.auth_user_id is not null,
           'issues', to_jsonb(g.codes)
         ) order by coalesce(a.display_name, a.full_name), a.numero_control), '[]'::jsonb)
    into v_result
  from grouped g join public.affiliates a on a.id = g.id;
  return v_result;
end;
$$;

create function public.admin_relink_affiliate_account(
  p_affiliate_id uuid, p_expected_updated_at timestamptz, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.affiliates%rowtype;
  v_source public.affiliates%rowtype;
  v_email text;
  v_user uuid;
  v_users integer;
  v_confirmed timestamptz;
  v_source_next text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_note text;
begin
  if not public.has_admin_permission('affiliates.write') then
    raise exception 'AFFILIATE_WRITE_DENIED' using errcode = '42501';
  end if;
  if length(v_reason) > 400 then raise exception 'AFFILIATE_REASON_TOO_LONG' using errcode = '22023'; end if;

  select * into v_target from public.affiliates where id = p_affiliate_id for update;
  if v_target.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_target.updated_at is distinct from p_expected_updated_at then
    raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode = 'PT409';
  end if;
  if v_target.is_archived then raise exception 'AFFILIATE_ACCESS_ARCHIVED' using errcode = '22023'; end if;
  if v_target.auth_user_id is not null then raise exception 'AFFILIATE_ACCESS_ALREADY_LINKED' using errcode = '22023'; end if;

  v_email := v_target.historical_email_normalized;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'AFFILIATE_ACCESS_EMAIL_INVALID' using errcode = '22023';
  end if;
  if exists(select 1 from public.affiliates where id <> v_target.id and historical_email_normalized = v_email) then
    raise exception 'AFFILIATE_ACCESS_EMAIL_SHARED' using errcode = '22023';
  end if;

  select count(*), min(u.id::text)::uuid into v_users, v_user
  from auth.users u where lower(btrim(u.email)) = v_email;
  if v_users = 0 then raise exception 'AFFILIATE_ACCESS_ACCOUNT_NOT_FOUND' using errcode = '22023'; end if;
  if v_users > 1 then raise exception 'AFFILIATE_ACCESS_ACCOUNT_AMBIGUOUS' using errcode = '22023'; end if;
  select u.email_confirmed_at into v_confirmed from auth.users u where u.id = v_user;
  if v_confirmed is null then raise exception 'AFFILIATE_ACCESS_ACCOUNT_UNCONFIRMED' using errcode = '22023'; end if;

  select * into v_source from public.affiliates where auth_user_id = v_user for update;
  if v_source.id is not null and public.has_certified_affiliate_auth_link(v_user, v_source.id, v_email) then
    raise exception 'AFFILIATE_ACCESS_CERTIFIED_LINK_PROTECTED' using errcode = '42501';
  end if;

  if v_source.id is not null then
    v_source_next := public.affiliate_access_expected_eligibility(v_source.id);
    update public.affiliates
    set auth_user_id = null,
        auth_eligibility = v_source_next,
        auth_ineligibility_reason = case when v_source_next = 'eligible' then null else v_source_next end
    where id = v_source.id and auth_user_id = v_user;
  end if;

  update public.affiliates
  set auth_user_id = v_user, auth_eligibility = 'eligible', auth_ineligibility_reason = null
  where id = v_target.id and auth_user_id is null;

  insert into public.affiliate_access_repairs(
    action, actor_auth_user_id, affiliate_id, source_affiliate_id, auth_user_id,
    before_state, after_state, reason
  ) values (
    'ACCOUNT_RELINKED', auth.uid(), v_target.id, v_source.id, v_user,
    jsonb_build_object(
      'auth_eligibility', v_target.auth_eligibility,
      'source_auth_eligibility', v_source.auth_eligibility
    ),
    jsonb_build_object('auth_eligibility', 'eligible', 'source_auth_eligibility', v_source_next),
    v_reason
  );

  v_note := case when v_source.id is null then 'Acceso a la app · cuenta ' || v_email || ' vinculada a este afiliado'
    else 'Acceso a la app · cuenta ' || v_email || ' movida desde el control '
      || coalesce(v_source.numero_control, 'sin número') end;
  insert into public.affiliate_admin_events(
    affiliate_id, actor_auth_user_id, action, before_values, after_values, changed_fields, reason
  ) values (
    v_target.id, auth.uid(), 'UPDATE',
    jsonb_build_object('acceso_app', case when v_source.id is null then 'Sin cuenta vinculada'
      else 'Cuenta vinculada al control ' || coalesce(v_source.numero_control, 'sin número') end),
    jsonb_build_object('acceso_app', 'Cuenta vinculada a este afiliado'),
    array['acceso_app'],
    left(v_note || case when v_reason <> '' then ' · ' || v_reason else '' end, 500)
  );
  if v_source.id is not null then
    insert into public.affiliate_admin_events(
      affiliate_id, actor_auth_user_id, action, before_values, after_values, changed_fields, reason
    ) values (
      v_source.id, auth.uid(), 'UPDATE',
      jsonb_build_object('acceso_app', 'Cuenta ' || v_email || ' vinculada por error'),
      jsonb_build_object('acceso_app', 'Sin cuenta vinculada'),
      array['acceso_app'],
      left('Acceso a la app · la cuenta ' || v_email || ' pasó al control '
        || coalesce(v_target.numero_control, 'sin número')
        || case when v_reason <> '' then ' · ' || v_reason else '' end, 500)
    );
  end if;

  return public.get_admin_affiliate_workbench(v_target.id);
end;
$$;

create function public.admin_release_affiliate_account(
  p_affiliate_id uuid, p_expected_updated_at timestamptz, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.affiliates%rowtype;
  v_link_email text;
  v_next text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.has_admin_permission('affiliates.write') then
    raise exception 'AFFILIATE_WRITE_DENIED' using errcode = '42501';
  end if;
  if length(v_reason) > 400 then raise exception 'AFFILIATE_REASON_TOO_LONG' using errcode = '22023'; end if;

  select * into v_row from public.affiliates where id = p_affiliate_id for update;
  if v_row.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode = 'PT409';
  end if;
  if v_row.auth_user_id is null then raise exception 'AFFILIATE_ACCESS_NOT_LINKED' using errcode = '22023'; end if;

  select lower(btrim(u.email)) into v_link_email from auth.users u where u.id = v_row.auth_user_id;
  if v_link_email is not distinct from v_row.historical_email_normalized then
    raise exception 'AFFILIATE_ACCESS_LINK_HEALTHY' using errcode = '22023';
  end if;
  if public.has_certified_affiliate_auth_link(v_row.auth_user_id, v_row.id, v_link_email) then
    raise exception 'AFFILIATE_ACCESS_CERTIFIED_LINK_PROTECTED' using errcode = '42501';
  end if;

  v_next := public.affiliate_access_expected_eligibility(v_row.id);
  update public.affiliates
  set auth_user_id = null,
      auth_eligibility = v_next,
      auth_ineligibility_reason = case when v_next = 'eligible' then null else v_next end
  where id = v_row.id;

  insert into public.affiliate_access_repairs(
    action, actor_auth_user_id, affiliate_id, auth_user_id, before_state, after_state, reason
  ) values (
    'ACCOUNT_RELEASED', auth.uid(), v_row.id, v_row.auth_user_id,
    jsonb_build_object('auth_eligibility', v_row.auth_eligibility),
    jsonb_build_object('auth_eligibility', v_next),
    v_reason
  );
  insert into public.affiliate_admin_events(
    affiliate_id, actor_auth_user_id, action, before_values, after_values, changed_fields, reason
  ) values (
    v_row.id, auth.uid(), 'UPDATE',
    jsonb_build_object('acceso_app', 'Cuenta ' || coalesce(v_link_email, 'sin correo') || ' vinculada por error'),
    jsonb_build_object('acceso_app', 'Sin cuenta vinculada'),
    array['acceso_app'],
    left('Acceso a la app · se separó la cuenta ' || coalesce(v_link_email, 'sin correo')
      || case when v_reason <> '' then ' · ' || v_reason else '' end, 500)
  );

  return public.get_admin_affiliate_workbench(v_row.id);
end;
$$;

create function public.admin_recalculate_affiliate_access(
  p_affiliate_id uuid, p_expected_updated_at timestamptz, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.affiliates%rowtype;
  v_next text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.has_admin_permission('affiliates.write') then
    raise exception 'AFFILIATE_WRITE_DENIED' using errcode = '42501';
  end if;
  if length(v_reason) > 400 then raise exception 'AFFILIATE_REASON_TOO_LONG' using errcode = '22023'; end if;

  select * into v_row from public.affiliates where id = p_affiliate_id for update;
  if v_row.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode = 'PT409';
  end if;
  if v_row.is_archived then raise exception 'AFFILIATE_ACCESS_ARCHIVED' using errcode = '22023'; end if;
  if v_row.auth_user_id is not null then raise exception 'AFFILIATE_ACCESS_ALREADY_LINKED' using errcode = '22023'; end if;

  v_next := public.affiliate_access_expected_eligibility(v_row.id);
  -- Only lifts a block that no longer applies; never adds a new one.
  if v_next <> 'eligible' or v_row.auth_eligibility = 'eligible' then
    raise exception 'AFFILIATE_ACCESS_NO_CHANGE' using errcode = '22023';
  end if;

  update public.affiliates
  set auth_eligibility = 'eligible', auth_ineligibility_reason = null
  where id = v_row.id;

  insert into public.affiliate_access_repairs(
    action, actor_auth_user_id, affiliate_id, before_state, after_state, reason
  ) values (
    'ELIGIBILITY_RECALCULATED', auth.uid(), v_row.id,
    jsonb_build_object('auth_eligibility', v_row.auth_eligibility),
    jsonb_build_object('auth_eligibility', 'eligible'),
    v_reason
  );
  insert into public.affiliate_admin_events(
    affiliate_id, actor_auth_user_id, action, before_values, after_values, changed_fields, reason
  ) values (
    v_row.id, auth.uid(), 'UPDATE',
    jsonb_build_object('acceso_app', 'Bloqueado (' || v_row.auth_eligibility || ')'),
    jsonb_build_object('acceso_app', 'Puede activar su cuenta'),
    array['acceso_app'],
    left('Acceso a la app · bloqueo retirado' || case when v_reason <> '' then ' · ' || v_reason else '' end, 500)
  );

  return public.get_admin_affiliate_workbench(v_row.id);
end;
$$;

-- Technical undo, service_role only. Refuses if any affected row moved on since the repair.
create function public.revert_affiliate_access_repair(p_repair_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.affiliate_access_repairs%rowtype;
  v_row public.affiliates%rowtype;
  v_source public.affiliates%rowtype;
  v_before text;
  v_source_before text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  select * into r from public.affiliate_access_repairs where id = p_repair_id for update;
  if r.id is null then raise exception 'REPAIR_NOT_FOUND' using errcode = 'P0001'; end if;
  if r.reverted_at is not null then return jsonb_build_object('status', 'REVERTED', 'idempotent', true); end if;

  select * into v_row from public.affiliates where id = r.affiliate_id for update;
  v_before := r.before_state->>'auth_eligibility';

  if r.action = 'ACCOUNT_RELINKED' then
    if v_row.auth_user_id is distinct from r.auth_user_id then
      raise exception 'REVERT_BLOCKED_TARGET_CHANGED' using errcode = 'P0001';
    end if;
    if r.source_affiliate_id is not null then
      select * into v_source from public.affiliates where id = r.source_affiliate_id for update;
      if v_source.auth_user_id is not null then
        raise exception 'REVERT_BLOCKED_SOURCE_CHANGED' using errcode = 'P0001';
      end if;
    end if;
    update public.affiliates
    set auth_user_id = null, auth_eligibility = v_before,
        auth_ineligibility_reason = case when v_before = 'eligible' then null else v_before end
    where id = v_row.id;
    if r.source_affiliate_id is not null then
      v_source_before := r.before_state->>'source_auth_eligibility';
      update public.affiliates
      set auth_user_id = r.auth_user_id, auth_eligibility = v_source_before,
          auth_ineligibility_reason = case when v_source_before = 'eligible' then null else v_source_before end
      where id = r.source_affiliate_id;
    end if;
  elsif r.action = 'ACCOUNT_RELEASED' then
    if v_row.auth_user_id is not null
      or exists(select 1 from public.affiliates where auth_user_id = r.auth_user_id) then
      raise exception 'REVERT_BLOCKED_ACCOUNT_CHANGED' using errcode = 'P0001';
    end if;
    update public.affiliates
    set auth_user_id = r.auth_user_id, auth_eligibility = v_before,
        auth_ineligibility_reason = case when v_before = 'eligible' then null else v_before end
    where id = v_row.id;
  else
    if v_row.auth_user_id is not null or v_row.auth_eligibility is distinct from r.after_state->>'auth_eligibility' then
      raise exception 'REVERT_BLOCKED_ELIGIBILITY_CHANGED' using errcode = 'P0001';
    end if;
    update public.affiliates
    set auth_eligibility = v_before,
        auth_ineligibility_reason = case when v_before = 'eligible' then null else v_before end
    where id = v_row.id;
  end if;

  update public.affiliate_access_repairs set reverted_at = now() where id = r.id;
  return jsonb_build_object('status', 'REVERTED', 'repair_id', r.id, 'action', r.action, 'idempotent', false);
end;
$$;

revoke all on function public.affiliate_access_expected_eligibility(uuid) from public, anon, authenticated;
revoke all on function public.affiliates_release_stale_duplicate_email() from public, anon, authenticated;
revoke all on function public.revert_affiliate_access_repair(bigint) from public, anon, authenticated;
grant execute on function public.revert_affiliate_access_repair(bigint) to service_role;

revoke all on function public.get_admin_affiliate_access_diagnosis(uuid) from public, anon;
revoke all on function public.list_admin_affiliate_access_issues() from public, anon;
revoke all on function public.admin_relink_affiliate_account(uuid,timestamptz,text) from public, anon;
revoke all on function public.admin_release_affiliate_account(uuid,timestamptz,text) from public, anon;
revoke all on function public.admin_recalculate_affiliate_access(uuid,timestamptz,text) from public, anon;
grant execute on function public.get_admin_affiliate_access_diagnosis(uuid) to authenticated;
grant execute on function public.list_admin_affiliate_access_issues() to authenticated;
grant execute on function public.admin_relink_affiliate_account(uuid,timestamptz,text) to authenticated;
grant execute on function public.admin_release_affiliate_account(uuid,timestamptz,text) to authenticated;
grant execute on function public.admin_recalculate_affiliate_access(uuid,timestamptz,text) to authenticated;

comment on function public.get_admin_affiliate_access_diagnosis(uuid) is
  'Read-only access diagnosis for Admin > Afiliados > Acceso. Requires affiliates.read.';
comment on function public.admin_relink_affiliate_account(uuid,timestamptz,text) is
  'Moves the confirmed Auth account whose email uniquely matches this affiliate from the wrong row to this one. Refuses shared emails and certified repairs. Requires affiliates.write.';
comment on function public.admin_release_affiliate_account(uuid,timestamptz,text) is
  'Detaches an Auth account whose email no longer matches the row. Healthy and certified links are refused. Requires affiliates.write.';
comment on function public.admin_recalculate_affiliate_access(uuid,timestamptz,text) is
  'Lifts a stale activation block when the current contract already allows the row. Never adds a block. Requires affiliates.write.';

notify pgrst, 'reload schema';
commit;
