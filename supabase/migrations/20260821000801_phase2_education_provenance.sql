begin;

alter table public.educational_resources
  add column source_sheet text null,
  add column source_row_ordinal integer null check (source_row_ordinal is null or source_row_ordinal > 1),
  add column source_snapshot_hash text null check (source_snapshot_hash is null or source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  add column source_payload jsonb null;

alter table public.educational_resources add constraint educational_resources_origin_check check (
  (provenance = 'HISTORICAL_IMPORT' and source_sheet is not null and source_row_ordinal is not null and source_snapshot_hash is not null and source_payload is not null)
  or
  (provenance = 'ADMIN_PHASE2' and source_sheet is null and source_row_ordinal is null and source_snapshot_hash is null and source_payload is null)
);

create unique index educational_resources_historical_source_idx
on public.educational_resources(source_snapshot_hash, source_sheet, source_row_ordinal)
where provenance = 'HISTORICAL_IMPORT';

comment on column public.educational_resources.source_payload is 'Exact historical row values. Provenance only; never a runtime fallback.';

commit;
