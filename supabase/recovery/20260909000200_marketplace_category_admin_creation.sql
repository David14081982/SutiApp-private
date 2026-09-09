begin;
do $$begin
 if (select count(*) from public.marketplace_categories where record_origin='ADMIN_PHASE3')>1 then
  raise exception 'RECOVERY_BLOCKED_NEW_ADMIN_CATEGORIES: preserve new business rows; use a forward correction';
 end if;
end$$;
alter table public.marketplace_categories add constraint marketplace_categories_source_snapshot_hash_source_sheet_so_key
 unique nulls not distinct(source_snapshot_hash,source_sheet,source_row_ordinal);
drop index public.marketplace_categories_historical_source_idx;
create unique index marketplace_categories_historical_source_idx on public.marketplace_categories(source_snapshot_hash,source_sheet,source_row_ordinal) where record_origin='HISTORICAL_IMPORT';
commit;
