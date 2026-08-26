begin;
update public.historical_asset_sources
set linked_entity_table=null,linked_entity_id=null,migration_status='PENDING_DOMAIN_LINK',ownership_status='PENDING_SECURITY_CLASSIFICATION'
where linked_entity_table='program_catalog_items';
drop policy if exists program_catalog_linked_private_storage_read on storage.objects;
drop policy if exists program_catalog_linked_private_asset_read on public.private_assets;
drop function if exists public.create_program_benefit_request(uuid,integer,text,text,boolean);
drop table if exists public.program_benefit_requests;
drop sequence if exists public.program_benefit_folio_seq;
drop table if exists public.program_catalog_item_assets;
drop table if exists public.program_catalog_items;
commit;
