begin;

do $$
begin
  if exists(select 1 from public.program_catalog_items where program_key='cirugias')
     or exists(select 1 from public.admin_audit_log where resource='program_catalog_items' and details->>'program_key'='cirugias')
  then raise exception 'RECOVERY_BLOCKED_CIRUGIAS_ADMIN_HISTORY_EXISTS' using errcode='P0001'; end if;
end $$;

revoke all on function public.create_first_cirugias_program_catalog_item(jsonb,jsonb) from public,anon,authenticated;
drop function public.create_first_cirugias_program_catalog_item(jsonb,jsonb);

notify pgrst,'reload schema';
commit;
