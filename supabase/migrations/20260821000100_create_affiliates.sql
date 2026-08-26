begin;

create extension if not exists pgcrypto with schema extensions;

create table public.affiliates (
  id uuid primary key default extensions.gen_random_uuid(),
  numero_control text null,

  full_name text null,
  display_name text null,
  historical_status_raw text null,
  affiliate_status_raw text null,

  historical_email_raw text null,
  historical_email_normalized text null,
  phone_raw text null,
  address_raw text null,

  birth_date_raw text null,
  gender_raw text null,
  marital_status_raw text null,
  children_count_raw text null,
  rfc_raw text null,
  curp_raw text null,

  unit_raw text null,
  city_raw text null,
  employment_position_raw text null,
  employment_entry_date_raw text null,
  occupation_raw text null,
  institute_entry_date_raw text null,
  employment_area_raw text null,
  employment_level_raw text null,
  pension_raw text null,
  subdirectorate_raw text null,

  union_enrollment_date_raw text null,
  capture_date_raw text null,
  affiliation_raw text null,
  union_position_raw text null,
  termination_date_raw text null,

  auth_user_id uuid null references auth.users(id) on delete set null,
  auth_eligibility text not null,
  auth_ineligibility_reason text null,

  source_row_ordinal integer not null,
  source_file_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint affiliates_auth_eligibility_check check (
    auth_eligibility in ('eligible', 'missing_email', 'invalid_email', 'duplicate_email')
  ),
  constraint affiliates_auth_reason_check check (
    (auth_eligibility = 'eligible' and auth_ineligibility_reason is null)
    or
    (auth_eligibility <> 'eligible' and auth_ineligibility_reason = auth_eligibility)
  ),
  constraint affiliates_source_row_ordinal_check check (source_row_ordinal > 0),
  constraint affiliates_source_file_hash_check check (source_file_hash ~ '^[A-F0-9]{64}$'),
  constraint affiliates_source_identity_unique unique (source_file_hash, source_row_ordinal)
);

comment on table public.affiliates is
  'Authoritative affiliate entity after a reconciled import; Auth linkage is optional.';
comment on column public.affiliates.numero_control is
  'Historical business identifier preserved as nullable, non-unique TEXT.';
comment on column public.affiliates.auth_user_id is
  'Optional link to auth.users; never derived from numero_control.';

create unique index affiliates_auth_user_id_unique
  on public.affiliates (auth_user_id)
  where auth_user_id is not null;

create unique index affiliates_eligible_email_unique
  on public.affiliates (historical_email_normalized)
  where auth_eligibility = 'eligible';

create index affiliates_numero_control_idx
  on public.affiliates (numero_control);

create index affiliates_historical_email_normalized_idx
  on public.affiliates (historical_email_normalized);

create function public.set_affiliates_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger affiliates_set_updated_at
before update on public.affiliates
for each row execute function public.set_affiliates_updated_at();

alter table public.affiliates enable row level security;
alter table public.affiliates force row level security;

revoke all on table public.affiliates from public, anon, authenticated;
grant select on table public.affiliates to authenticated;

create policy affiliates_select_own
on public.affiliates
for select
to authenticated
using ((select auth.uid()) = auth_user_id);

commit;

