begin;

do $$
declare v_backup public.program_catalog_commercial_mode_migration_backup%rowtype;
begin
  select * into v_backup from public.program_catalog_commercial_mode_migration_backup where singleton;
  if v_backup.singleton is null then raise exception 'COMMERCIAL_MODE_RECOVERY_BACKUP_MISSING' using errcode='P0001'; end if;
  if (select count(*) from public.program_catalog_items)<>v_backup.item_count
     or (select array_agg(id order by id) from public.program_catalog_items)<>v_backup.item_ids
     or (select md5(string_agg(id::text||'|'||program_key||'|'||name||'|'||coalesce(price_cash::text,'')||'|'||requires_quote::text||'|'||enabled::text||'|'||sort_order::text||'|'||updated_at::text,';' order by id)) from public.program_catalog_items)<>v_backup.item_hash then
    raise exception 'RECOVERY_BLOCKED_PROGRAM_CATALOG_ROWS_CHANGED' using errcode='P0001';
  end if;
  if exists(select 1 from public.program_catalog_items where sold or sold_at is not null or sold_by is not null
    or commercial_mode<>case when program_key='casa' then 'DIRECT_CONTACT' when requires_quote then 'PAYROLL_QUOTE' else 'PAYROLL_FIXED' end) then
    raise exception 'RECOVERY_BLOCKED_COMMERCIAL_MODE_OR_SOLD_CHANGED' using errcode='P0001';
  end if;
  if exists(select 1 from public.admin_audit_log where created_at>=v_backup.applied_at and resource='program_catalog_items'
    and ((details->'after') ? 'commercial_mode' or (details->'after') ? 'sold')) then
    raise exception 'RECOVERY_BLOCKED_PROGRAM_CATALOG_ADMIN_HISTORY_EXISTS' using errcode='P0001';
  end if;
  execute v_backup.general_writer_definition;
  execute v_backup.cirugias_writer_definition;
end $$;

drop trigger program_requests_catalog_requestability on public.program_requests;
drop function public.enforce_program_catalog_requestability();

revoke select(commercial_mode,sold,sold_at) on public.program_catalog_items from authenticated;
alter table public.program_catalog_items
  drop constraint program_catalog_items_sold_audit_check,
  drop constraint program_catalog_items_commercial_mode_check,
  drop column sold_by,
  drop column sold_at,
  drop column sold,
  drop column commercial_mode;

comment on function public.save_program_catalog_item(uuid,jsonb,jsonb) is 'Only browser Admin writer for SutiApp-owned program products; provenance fields are never accepted from the client.';
comment on function public.create_first_cirugias_program_catalog_item(jsonb,jsonb) is 'One-time browser Admin bootstrap for the first real Cirugias product. Requires program_catalog.write, creates ADMIN_PROGRAM_CATALOG provenance, audits the insert, and refuses every other program key.';

drop table public.program_catalog_commercial_mode_migration_backup;
notify pgrst,'reload schema';
commit;
