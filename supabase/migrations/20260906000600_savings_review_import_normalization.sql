begin;
-- Backup for one-time correction of the unpublished import projection only.
create table public.savings_review_import_normalizations (
 record_id uuid primary key references public.savings_review_records(id),
 source_data_before jsonb not null, field_defs_before jsonb not null,
 source_data_after jsonb not null, field_defs_after jsonb not null,
 repaired_at timestamptz not null default clock_timestamp(),
 reason text not null default 'Prepublication import parser fix: retain blank as null; AA:DO use correct column indexes'
);
alter table public.savings_review_import_normalizations enable row level security;
alter table public.savings_review_import_normalizations force row level security;
revoke all on public.savings_review_import_normalizations from public,anon,authenticated,service_role;
create function public.savings_review_normalization_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'SAVINGS_REVIEW_NORMALIZATION_HISTORY_IMMUTABLE'; end $$;
revoke all on function public.savings_review_normalization_immutable() from public,anon,authenticated,service_role;
create trigger savings_review_normalization_guard before update or delete on public.savings_review_import_normalizations for each row execute function public.savings_review_normalization_immutable();
commit;
