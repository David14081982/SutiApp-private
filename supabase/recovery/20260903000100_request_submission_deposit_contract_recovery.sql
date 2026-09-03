begin;

do $recovery$
declare
  v_backup public.request_submission_deposit_contract_backup%rowtype;
begin
  select * into v_backup
  from public.request_submission_deposit_contract_backup
  where migration_key='20260903000100'
  for update;
  if v_backup.migration_key is null then
    raise exception 'REQUEST_SUBMISSION_RECOVERY_BACKUP_MISSING';
  end if;
  if exists(
    select 1 from public.loan_request_deposit_snapshots
    where created_at>=v_backup.applied_at and source_bank_account_id is not null
      and ((card_number is null)<>(clabe is null))
  ) then
    raise exception 'RECOVERY_BLOCKED_REQUEST_HISTORY_USES_CARD_OR_CLABE';
  end if;
  execute v_backup.previous_writer_definition;
  alter table public.loan_request_deposit_snapshots
    drop constraint loan_deposit_optional_bank_coherence;
  execute 'alter table public.loan_request_deposit_snapshots add constraint loan_deposit_optional_bank_coherence '
    ||v_backup.previous_constraint_definition;
end $recovery$;

drop function public.get_request_submission_backend_contract();
drop table public.request_submission_deposit_contract_backup;

notify pgrst,'reload schema';
commit;
