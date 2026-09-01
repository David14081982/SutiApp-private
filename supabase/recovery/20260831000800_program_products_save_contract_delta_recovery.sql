begin;

do $$
declare
  v_backup public.program_catalog_save_contract_migration_backup%rowtype;
  v_item_count integer;
  v_item_hash text;
  v_asset_count integer;
  v_asset_hash text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('program_catalog_items:save_contract_delta',0));
  select * into v_backup from public.program_catalog_save_contract_migration_backup where singleton for update;
  if v_backup.singleton is null then raise exception 'PROGRAM_CATALOG_SAVE_CONTRACT_BACKUP_MISSING'; end if;
  if exists(
    select 1 from public.admin_audit_log
    where resource='program_catalog_items' and created_at>=v_backup.applied_at
  ) then
    raise exception 'RECOVERY_BLOCKED_PROGRAM_CATALOG_ADMIN_HISTORY_EXISTS';
  end if;

  select count(*)::integer,md5(coalesce(string_agg(to_jsonb(i)::text,';' order by i.id),''))
    into v_item_count,v_item_hash from public.program_catalog_items i;
  select count(*)::integer,md5(coalesce(string_agg(to_jsonb(a)::text,';' order by a.id),''))
    into v_asset_count,v_asset_hash from public.program_catalog_item_assets a;
  if v_item_count<>v_backup.item_count or v_item_hash<>v_backup.item_hash
     or v_asset_count<>v_backup.asset_count or v_asset_hash<>v_backup.asset_hash then
    raise exception 'RECOVERY_BLOCKED_PROGRAM_CATALOG_STATE_CHANGED';
  end if;

  execute v_backup.general_writer_definition;
  execute v_backup.cirugias_writer_definition;
  alter table public.program_catalog_items drop constraint program_catalog_items_program_check;
  execute format(
    'alter table public.program_catalog_items add constraint program_catalog_items_program_check %s',
    v_backup.program_constraint_definition
  );
end $$;

drop table public.program_catalog_save_contract_migration_backup;
notify pgrst,'reload schema';
commit;
