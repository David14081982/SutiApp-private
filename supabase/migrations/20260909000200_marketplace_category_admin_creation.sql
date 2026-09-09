begin;
-- Administrative rows must have NULL source coordinates. Only imported rows
-- participate in historical source identity; their NULL semantics are preserved.
drop index public.marketplace_categories_historical_source_idx;
create unique index marketplace_categories_historical_source_idx
 on public.marketplace_categories(source_snapshot_hash,source_sheet,source_row_ordinal)
 nulls not distinct where record_origin='HISTORICAL_IMPORT';
alter table public.marketplace_categories drop constraint marketplace_categories_source_snapshot_hash_source_sheet_so_key;
commit;
