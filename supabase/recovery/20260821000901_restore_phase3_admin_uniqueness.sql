begin;
do $$ begin
  if (select count(*) from public.marketplace_categories where record_origin='ADMIN_PHASE3') > 1 or (select count(*) from public.marketplace_products where record_origin='ADMIN_PHASE3') > 1 then
    raise exception 'RECOVERY_REQUIRES_PHASE3_ADMIN_ROWS_BACKUP_AND_RECONCILIATION';
  end if;
end $$;
drop index if exists public.marketplace_categories_historical_source_idx;
drop index if exists public.marketplace_products_historical_source_idx;
alter table public.marketplace_categories add constraint marketplace_categories_source_snapshot_hash_source_sheet_sour_key unique nulls not distinct (source_snapshot_hash,source_sheet,source_row_ordinal);
alter table public.marketplace_products add constraint marketplace_products_source_snapshot_hash_source_sheet_sour_key unique nulls not distinct (source_snapshot_hash,source_sheet,source_row_ordinal);
commit;
