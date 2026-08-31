begin;
drop trigger if exists program_catalog_asset_owner_guard on public.program_catalog_item_assets;
drop function if exists public.enforce_program_catalog_asset_owner();
commit;
