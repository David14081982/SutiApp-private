begin;

do $recovery$
declare v_definition text;
begin
  select previous_definition into v_definition from public.request_submission_contract_probe_backup
   where migration_key='20260903000110' for update;
  if v_definition is null then raise exception 'REQUEST_CONTRACT_PROBE_RECOVERY_BACKUP_MISSING'; end if;
  execute v_definition;
end $recovery$;

drop table public.request_submission_contract_probe_backup;
notify pgrst,'reload schema';
commit;
