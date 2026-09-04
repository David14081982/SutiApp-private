begin;

create table public.affiliate_csv_email_update_batches (
  id uuid primary key,
  h_code text not null unique check (h_code = 'H-AFFILIATES-CSV-UPDATE-APPLY-001'),
  source_filename text not null check (source_filename = 'Usuarios (8).csv'),
  source_sha256 text not null check (source_sha256 ~ '^[A-F0-9]{64}$'),
  source_rows integer not null check (source_rows = 947),
  execution_authority text not null check (execution_authority = 'OWNER_INSTRUCTION_SERVICE_ROLE'),
  status text not null check (status in ('APPLIED', 'RECOVERED')),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  applied_at timestamptz not null,
  recovered_at timestamptz null
);

create table public.affiliate_csv_email_update_snapshot (
  batch_id uuid not null references public.affiliate_csv_email_update_batches(id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  source_row_ordinal integer not null check (source_row_ordinal > 0),
  numero_control text not null,
  outcome text not null check (outcome in ('UPDATED_EMAIL', 'NEEDS_AUTH_SYNC', 'SKIPPED_AMBIGUOUS_EMAIL')),
  detail text not null,
  old_email_raw text null,
  old_email_normalized text null,
  old_auth_eligibility text not null,
  old_auth_ineligibility_reason text null,
  old_auth_user_id uuid null references auth.users(id) on delete restrict,
  old_updated_at timestamptz not null,
  proposed_email_raw text null,
  proposed_email_normalized text null,
  applied_auth_eligibility text null,
  applied_auth_ineligibility_reason text null,
  applied_updated_at timestamptz null,
  captured_at timestamptz not null default now(),
  primary key (batch_id, affiliate_id),
  unique (batch_id, source_row_ordinal)
);

comment on table public.affiliate_csv_email_update_batches is
  'Service-only audit record for the owner-authorized, hash-pinned Usuarios (8).csv email update; never an affiliate authority.';
comment on table public.affiliate_csv_email_update_snapshot is
  'Logical before/proposed snapshot for reversible affiliate email updates and explicitly skipped resolved mismatches.';

alter table public.affiliate_csv_email_update_batches enable row level security;
alter table public.affiliate_csv_email_update_batches force row level security;
alter table public.affiliate_csv_email_update_snapshot enable row level security;
alter table public.affiliate_csv_email_update_snapshot force row level security;

revoke all on table public.affiliate_csv_email_update_batches from public, anon, authenticated;
revoke all on table public.affiliate_csv_email_update_snapshot from public, anon, authenticated;
grant select on table public.affiliate_csv_email_update_batches to authenticated;
grant select on table public.affiliate_csv_email_update_snapshot to authenticated;

create policy affiliate_csv_email_update_batches_admin_read
on public.affiliate_csv_email_update_batches
for select to authenticated
using (public.has_admin_permission('affiliates.read'));

create policy affiliate_csv_email_update_snapshot_admin_read
on public.affiliate_csv_email_update_snapshot
for select to authenticated
using (public.has_admin_permission('affiliates.read'));

create function public.apply_affiliate_csv_email_update(
  p_batch_id uuid,
  p_h_code text,
  p_source_filename text,
  p_source_sha256 text,
  p_source_rows integer,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.affiliate_csv_email_update_batches%rowtype;
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
  v_identity_before jsonb;
  v_identity_after jsonb;
  v_updated integer;
  v_needs_auth integer;
  v_ambiguous_control integer;
  v_ambiguous_email integer;
  v_csv_only integer;
  v_unchanged integer;
  v_extra integer;
  v_qa_extra integer;
  v_identity_mismatch integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_batch_id is null
    or p_h_code <> 'H-AFFILIATES-CSV-UPDATE-APPLY-001'
    or p_source_filename <> 'Usuarios (8).csv'
    or p_source_sha256 <> '3AB97E9F16951E523301E1A080A1DB965F12739207798490022308FCF1F28E29'
    or p_source_rows <> 947
  then
    raise exception 'CSV_UPDATE_IDENTITY_INVALID' using errcode = '22023';
  end if;

  select * into v_existing
  from public.affiliate_csv_email_update_batches
  where id = p_batch_id
  for update;
  if v_existing.id is not null then
    if v_existing.h_code <> p_h_code or v_existing.source_sha256 <> p_source_sha256 then
      raise exception 'CSV_UPDATE_BATCH_CONFLICT' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object(
      'batch_id', v_existing.id,
      'status', v_existing.status,
      'idempotent', true
    );
  end if;
  if exists (
    select 1 from public.affiliate_csv_email_update_batches
    where h_code = p_h_code or source_sha256 = p_source_sha256
  ) then
    raise exception 'CSV_UPDATE_BATCH_ID_MISMATCH' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) <> 947 then
    raise exception 'CSV_UPDATE_EXACT_947_ROWS_REQUIRED' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_rows) value
    cross join lateral jsonb_object_keys(value) key
    where key not in ('ordinal', 'numero_control', 'email_raw')
  ) then
    raise exception 'CSV_UPDATE_FIELDS_DENIED' using errcode = '22023';
  end if;

  lock table public.affiliates in share row exclusive mode;
  if (select count(*) from public.affiliates) <> 954 then
    raise exception 'AFFILIATE_UNIVERSE_CHANGED' using errcode = 'P0001';
  end if;

  drop table if exists pg_temp.affiliate_csv_email_input;
  create temporary table affiliate_csv_email_input (
    ordinal integer primary key,
    numero_control text not null,
    email_raw text null,
    email_normalized text null
  ) on commit drop;

  insert into pg_temp.affiliate_csv_email_input(ordinal, numero_control, email_raw, email_normalized)
  select
    x.ordinal,
    coalesce(x.numero_control, ''),
    nullif(btrim(x.email_raw), ''),
    nullif(lower(btrim(x.email_raw)), '')
  from jsonb_to_recordset(p_rows) as x(ordinal integer, numero_control text, email_raw text);

  if (select count(*) from pg_temp.affiliate_csv_email_input) <> 947
    or (select min(ordinal) from pg_temp.affiliate_csv_email_input) <> 1
    or (select max(ordinal) from pg_temp.affiliate_csv_email_input) <> 947
    or exists (
      select 1 from jsonb_to_recordset(p_rows) as x(email_raw text)
      where x.email_raw is not null and x.email_raw is distinct from nullif(btrim(x.email_raw), '')
    )
  then
    raise exception 'CSV_UPDATE_INPUT_INVALID' using errcode = '22023';
  end if;

  drop table if exists pg_temp.affiliate_csv_email_classified;
  create temporary table affiliate_csv_email_classified on commit drop as
  with csv_counts as (
    select numero_control, count(*)::integer as row_count
    from pg_temp.affiliate_csv_email_input
    group by numero_control
  ),
  db_counts as (
    select numero_control, count(*)::integer as row_count
    from public.affiliates
    group by numero_control
  )
  select
    i.ordinal,
    i.numero_control,
    i.email_raw,
    i.email_normalized,
    a.id as affiliate_id,
    a.historical_email_raw as old_email_raw,
    a.historical_email_normalized as old_email_normalized,
    a.auth_eligibility as old_auth_eligibility,
    a.auth_ineligibility_reason as old_auth_ineligibility_reason,
    a.auth_user_id as old_auth_user_id,
    a.updated_at as old_updated_at,
    case
      when i.numero_control = '' or cc.row_count <> 1 or coalesce(dc.row_count, 0) > 1
        then 'SKIPPED_AMBIGUOUS_CONTROL'
      when coalesce(dc.row_count, 0) = 0 then 'CSV_ONLY'
      when i.email_raw is not distinct from a.historical_email_raw
        and i.email_normalized is not distinct from a.historical_email_normalized then 'UNCHANGED'
      when a.auth_user_id is not null then 'NEEDS_AUTH_SYNC'
      else 'PENDING_SAFE_CHECK'
    end::text as outcome,
    case
      when i.numero_control = '' then 'EMPTY_NUMERO_CONTROL'
      when cc.row_count <> 1 then 'DUPLICATE_NUMERO_CONTROL_CSV'
      when coalesce(dc.row_count, 0) > 1 then 'DUPLICATE_NUMERO_CONTROL_SUPABASE'
      when coalesce(dc.row_count, 0) = 0 then 'NUMERO_CONTROL_MISSING_IN_SUPABASE'
      when i.email_raw is not distinct from a.historical_email_raw
        and i.email_normalized is not distinct from a.historical_email_normalized then 'EMAIL_ALREADY_EQUAL'
      when a.auth_user_id is not null then 'LINKED_AUTH_EMAIL_CHANGE_REQUIRES_EXPLICIT_SYNC'
      else 'PENDING_COLLISION_CHECK'
    end::text as detail
  from pg_temp.affiliate_csv_email_input i
  join csv_counts cc on cc.numero_control = i.numero_control
  left join db_counts dc on dc.numero_control is not distinct from i.numero_control
  left join public.affiliates a
    on a.numero_control = i.numero_control
   and coalesce(dc.row_count, 0) = 1;

  update pg_temp.affiliate_csv_email_classified c
  set outcome = case
        when (
          c.email_normalized is not null
          and exists (
            select 1 from public.affiliates owner
            where owner.historical_email_normalized = c.email_normalized
              and owner.id <> c.affiliate_id
          )
        ) or (
          c.email_normalized is not null
          and (
            select count(*) from pg_temp.affiliate_csv_email_classified proposed
            where proposed.outcome = 'PENDING_SAFE_CHECK'
              and proposed.email_normalized = c.email_normalized
          ) > 1
        ) then 'SKIPPED_AMBIGUOUS_EMAIL'
        else 'UPDATED_EMAIL'
      end,
      detail = case
        when c.email_normalized is not null
          and exists (
            select 1 from public.affiliates owner
            where owner.historical_email_normalized = c.email_normalized
              and owner.id <> c.affiliate_id
          ) then 'PROPOSED_EMAIL_OWNED_BY_OTHER_AFFILIATE'
        when c.email_normalized is not null
          and (
            select count(*) from pg_temp.affiliate_csv_email_classified proposed
            where proposed.outcome = 'PENDING_SAFE_CHECK'
              and proposed.email_normalized = c.email_normalized
          ) > 1 then 'DUPLICATE_PROPOSED_EMAIL'
        else 'UNIQUE_CONTROL_UNLINKED_AND_EMAIL_UNAMBIGUOUS'
      end
  where c.outcome = 'PENDING_SAFE_CHECK';

  select count(*) filter (where outcome = 'UPDATED_EMAIL'),
         count(*) filter (where outcome = 'NEEDS_AUTH_SYNC'),
         count(*) filter (where outcome = 'SKIPPED_AMBIGUOUS_CONTROL'),
         count(*) filter (where outcome = 'SKIPPED_AMBIGUOUS_EMAIL'),
         count(*) filter (where outcome = 'CSV_ONLY'),
         count(*) filter (where outcome = 'UNCHANGED')
    into v_updated, v_needs_auth, v_ambiguous_control, v_ambiguous_email, v_csv_only, v_unchanged
  from pg_temp.affiliate_csv_email_classified;

  select count(*)::integer,
         count(*) filter (where a.numero_control like 'AUTHCERT-%')::integer
    into v_extra, v_qa_extra
  from public.affiliates a
  where a.numero_control is not null
    and not exists (
      select 1 from pg_temp.affiliate_csv_email_input i
      where i.numero_control = a.numero_control
    );

  if v_updated <> 1 or v_needs_auth <> 8
    or v_ambiguous_control <> 33 or v_ambiguous_email <> 112
    or v_csv_only <> 7 or v_unchanged <> 786
    or v_extra <> 10 or v_qa_extra <> 7
  then
    raise exception 'CSV_UPDATE_PREFLIGHT_COUNTS_CHANGED:%', jsonb_build_object(
      'updated_emails', v_updated,
      'needs_auth_sync', v_needs_auth,
      'skipped_ambiguous_control', v_ambiguous_control,
      'skipped_ambiguous_email', v_ambiguous_email,
      'csv_only', v_csv_only,
      'unchanged', v_unchanged,
      'extra_supabase_rows', v_extra,
      'qa_fixtures', v_qa_extra
    ) using errcode = 'P0001';
  end if;

  select count(*)::integer into v_identity_mismatch
  from public.affiliates a
  left join auth.users u on u.id = a.auth_user_id
  where a.auth_user_id is not null
    and (
      u.id is null
      or u.email_confirmed_at is null
      or a.historical_email_normalized is distinct from nullif(lower(btrim(u.email)), '')
      or (
        select count(*) from public.affiliates same_email
        where same_email.historical_email_normalized = a.historical_email_normalized
      ) <> 1
    );
  if v_identity_mismatch <> 0 then
    raise exception 'PREEXISTING_AUTH_IDENTITY_MISMATCH:%', v_identity_mismatch using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('affiliate_id', a.id, 'auth_user_id', a.auth_user_id)
    order by a.id
  ), '[]'::jsonb)
  into v_identity_before
  from public.affiliates a
  where a.auth_user_id is not null;

  v_result := jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'APPLIED',
    'source_rows', 947,
    'supabase_rows', 954,
    'updated_emails', v_updated,
    'needs_auth_sync', v_needs_auth,
    'skipped_ambiguous', v_ambiguous_control + v_ambiguous_email,
    'skipped_ambiguous_control', v_ambiguous_control,
    'skipped_ambiguous_email', v_ambiguous_email,
    'csv_only', v_csv_only,
    'unchanged', v_unchanged,
    'extra_supabase_rows_preserved', v_extra,
    'qa_fixtures_preserved', v_qa_extra,
    'auth_identity_mismatch_created', 0,
    'idempotent', false
  );

  insert into public.affiliate_csv_email_update_batches(
    id, h_code, source_filename, source_sha256, source_rows,
    execution_authority, status, result, applied_at
  ) values (
    p_batch_id, p_h_code, p_source_filename, p_source_sha256, p_source_rows,
    'OWNER_INSTRUCTION_SERVICE_ROLE', 'APPLIED', v_result, v_now
  );

  insert into public.affiliate_csv_email_update_snapshot(
    batch_id, affiliate_id, source_row_ordinal, numero_control, outcome, detail,
    old_email_raw, old_email_normalized, old_auth_eligibility, old_auth_ineligibility_reason,
    old_auth_user_id, old_updated_at, proposed_email_raw, proposed_email_normalized,
    applied_auth_eligibility, applied_auth_ineligibility_reason, captured_at
  )
  select
    p_batch_id, c.affiliate_id, c.ordinal, c.numero_control, c.outcome, c.detail,
    c.old_email_raw, c.old_email_normalized, c.old_auth_eligibility, c.old_auth_ineligibility_reason,
    c.old_auth_user_id, c.old_updated_at, c.email_raw, c.email_normalized,
    case when c.outcome = 'UPDATED_EMAIL' then
      case
        when c.email_normalized is null then 'missing_email'
        when c.email_normalized !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then 'invalid_email'
        else 'eligible'
      end
    else null end,
    case when c.outcome = 'UPDATED_EMAIL' then
      case
        when c.email_normalized is null then 'missing_email'
        when c.email_normalized !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then 'invalid_email'
        else null
      end
    else null end,
    v_now
  from pg_temp.affiliate_csv_email_classified c
  where c.outcome in ('UPDATED_EMAIL', 'NEEDS_AUTH_SYNC', 'SKIPPED_AMBIGUOUS_EMAIL');
  if (select count(*) from public.affiliate_csv_email_update_snapshot where batch_id = p_batch_id) <> 121 then
    raise exception 'CSV_UPDATE_SNAPSHOT_INCOMPLETE' using errcode = 'P0001';
  end if;

  update public.affiliates a
  set historical_email_raw = s.proposed_email_raw,
      historical_email_normalized = s.proposed_email_normalized,
      auth_eligibility = s.applied_auth_eligibility,
      auth_ineligibility_reason = s.applied_auth_ineligibility_reason,
      updated_at = v_now
  from public.affiliate_csv_email_update_snapshot s
  where s.batch_id = p_batch_id
    and s.outcome = 'UPDATED_EMAIL'
    and a.id = s.affiliate_id
    and a.auth_user_id is null
    and a.historical_email_raw is not distinct from s.old_email_raw
    and a.historical_email_normalized is not distinct from s.old_email_normalized
    and a.auth_eligibility = s.old_auth_eligibility
    and a.auth_ineligibility_reason is not distinct from s.old_auth_ineligibility_reason;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'CSV_UPDATE_ROW_COUNT_MISMATCH:%', v_updated using errcode = 'P0001';
  end if;

  update public.affiliate_csv_email_update_snapshot s
  set applied_updated_at = a.updated_at
  from public.affiliates a
  where s.batch_id = p_batch_id
    and s.outcome = 'UPDATED_EMAIL'
    and a.id = s.affiliate_id;

  if exists (
    select 1
    from public.affiliate_csv_email_update_snapshot s
    join public.affiliates a on a.id = s.affiliate_id
    where s.batch_id = p_batch_id
      and (
        a.auth_user_id is distinct from s.old_auth_user_id
        or (s.outcome = 'UPDATED_EMAIL' and (
          a.historical_email_raw is distinct from s.proposed_email_raw
          or a.historical_email_normalized is distinct from s.proposed_email_normalized
          or a.auth_eligibility is distinct from s.applied_auth_eligibility
          or a.auth_ineligibility_reason is distinct from s.applied_auth_ineligibility_reason
        ))
        or (s.outcome <> 'UPDATED_EMAIL' and (
          a.historical_email_raw is distinct from s.old_email_raw
          or a.historical_email_normalized is distinct from s.old_email_normalized
          or a.auth_eligibility is distinct from s.old_auth_eligibility
          or a.auth_ineligibility_reason is distinct from s.old_auth_ineligibility_reason
        ))
      )
  ) then
    raise exception 'CSV_UPDATE_POSTCONDITION_FAILED' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('affiliate_id', a.id, 'auth_user_id', a.auth_user_id)
    order by a.id
  ), '[]'::jsonb)
  into v_identity_after
  from public.affiliates a
  where a.auth_user_id is not null;
  if v_identity_after is distinct from v_identity_before then
    raise exception 'AUTH_IDENTITY_MAPPING_CHANGED' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_identity_mismatch
  from public.affiliates a
  left join auth.users u on u.id = a.auth_user_id
  where a.auth_user_id is not null
    and (
      u.id is null
      or u.email_confirmed_at is null
      or a.historical_email_normalized is distinct from nullif(lower(btrim(u.email)), '')
      or (
        select count(*) from public.affiliates same_email
        where same_email.historical_email_normalized = a.historical_email_normalized
      ) <> 1
    );
  if v_identity_mismatch <> 0 then
    raise exception 'AUTH_IDENTITY_MISMATCH_CREATED:%', v_identity_mismatch using errcode = 'P0001';
  end if;

  return v_result;
end
$$;

create function public.recover_affiliate_csv_email_update(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.affiliate_csv_email_update_batches%rowtype;
  v_now timestamptz := clock_timestamp();
  v_identity_before jsonb;
  v_identity_after jsonb;
  v_restored integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  lock table public.affiliates in share row exclusive mode;
  select * into v_batch
  from public.affiliate_csv_email_update_batches
  where id = p_batch_id
  for update;
  if v_batch.id is null then
    raise exception 'CSV_UPDATE_BATCH_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_batch.status = 'RECOVERED' then
    return jsonb_build_object('batch_id', p_batch_id, 'status', 'RECOVERED', 'idempotent', true);
  end if;
  if (select count(*) from public.affiliate_csv_email_update_snapshot where batch_id = p_batch_id) <> 121
    or (select count(*) from public.affiliate_csv_email_update_snapshot where batch_id = p_batch_id and outcome = 'UPDATED_EMAIL') <> 1
  then
    raise exception 'CSV_UPDATE_RECOVERY_SNAPSHOT_INCOMPLETE' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.affiliate_csv_email_update_snapshot s
    join public.affiliates a on a.id = s.affiliate_id
    where s.batch_id = p_batch_id
      and s.outcome = 'UPDATED_EMAIL'
      and (
        a.auth_user_id is distinct from s.old_auth_user_id
        or a.historical_email_raw is distinct from s.proposed_email_raw
        or a.historical_email_normalized is distinct from s.proposed_email_normalized
        or a.auth_eligibility is distinct from s.applied_auth_eligibility
        or a.auth_ineligibility_reason is distinct from s.applied_auth_ineligibility_reason
      )
  ) then
    raise exception 'CSV_UPDATE_RECOVERY_BLOCKED_BY_LATER_EMAIL_OR_IDENTITY_CHANGE' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('affiliate_id', a.id, 'auth_user_id', a.auth_user_id)
    order by a.id
  ), '[]'::jsonb)
  into v_identity_before
  from public.affiliates a
  where a.auth_user_id is not null;

  update public.affiliates a
  set historical_email_raw = s.old_email_raw,
      historical_email_normalized = s.old_email_normalized,
      auth_eligibility = s.old_auth_eligibility,
      auth_ineligibility_reason = s.old_auth_ineligibility_reason,
      updated_at = v_now
  from public.affiliate_csv_email_update_snapshot s
  where s.batch_id = p_batch_id
    and s.outcome = 'UPDATED_EMAIL'
    and a.id = s.affiliate_id;
  get diagnostics v_restored = row_count;
  if v_restored <> 1 then
    raise exception 'CSV_UPDATE_RECOVERY_ROW_COUNT_MISMATCH:%', v_restored using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('affiliate_id', a.id, 'auth_user_id', a.auth_user_id)
    order by a.id
  ), '[]'::jsonb)
  into v_identity_after
  from public.affiliates a
  where a.auth_user_id is not null;
  if v_identity_after is distinct from v_identity_before then
    raise exception 'AUTH_IDENTITY_MAPPING_CHANGED_DURING_RECOVERY' using errcode = 'P0001';
  end if;

  update public.affiliate_csv_email_update_batches
  set status = 'RECOVERED',
      recovered_at = v_now,
      result = result || jsonb_build_object('status', 'RECOVERED', 'recovered_at', v_now)
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'RECOVERED',
    'affiliates_restored', v_restored,
    'auth_identity_mapping_changed', false,
    'idempotent', false
  );
end
$$;

revoke all on function public.apply_affiliate_csv_email_update(uuid, text, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.recover_affiliate_csv_email_update(uuid) from public, anon, authenticated;
grant execute on function public.apply_affiliate_csv_email_update(uuid, text, text, text, integer, jsonb) to service_role;
grant execute on function public.recover_affiliate_csv_email_update(uuid) to service_role;

comment on function public.apply_affiliate_csv_email_update(uuid, text, text, text, integer, jsonb) is
  'Atomic, hash-pinned CSV email update. It uses numero_control only, snapshots before state, skips Auth-linked and ambiguous rows, and rejects any identity mapping change.';
comment on function public.recover_affiliate_csv_email_update(uuid) is
  'Restores only the one email row changed by H-AFFILIATES-CSV-UPDATE-APPLY-001 after verifying no later email or identity change.';

notify pgrst, 'reload schema';
commit;
