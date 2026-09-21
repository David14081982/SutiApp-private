begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Owner-authorized removal from Savings only. Private durable recovery, not a reader fallback.
create table public.savings_registration_removal_archive(
 id uuid primary key,
 created_at timestamptz not null default clock_timestamp(),
 actor_real_auth_user_id uuid not null references auth.users(id),
 reason text not null check(length(reason)>20),
 record_count integer not null check(record_count>0),
 snapshots jsonb not null check(jsonb_typeof(snapshots)='object')
);
alter table public.savings_registration_removal_archive enable row level security;
alter table public.savings_registration_removal_archive force row level security;
revoke all on public.savings_registration_removal_archive from public,anon,authenticated,service_role;
create trigger savings_registration_archive_immutable before update or delete on public.savings_registration_removal_archive
 for each row execute function public.reject_savings_history_mutation();
commit;
