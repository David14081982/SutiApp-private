begin;

do $recovery$
declare
  v_backup public.loan_deposit_validation_migration_backup%rowtype;
begin
  select * into v_backup
  from public.loan_deposit_validation_migration_backup
  where migration_key='20260901000100'
  for update;
  if v_backup.migration_key is null then
    raise exception 'LOAN_DEPOSIT_RECOVERY_BACKUP_MISSING';
  end if;
  if exists(
    select 1 from public.sensitive_change_audit
    where resource='affiliate_bank_accounts'
      and action in('BANK_ACCOUNT_CREATED','BANK_ACCOUNT_UPDATED')
      and created_at>=v_backup.applied_at
  ) then
    raise exception 'RECOVERY_BLOCKED_LOAN_DEPOSIT_ACTIVITY_EXISTS';
  end if;
  if (select count(*) from public.affiliate_bank_accounts)<>v_backup.baseline_account_count then
    raise exception 'RECOVERY_BLOCKED_LOAN_DEPOSIT_ACCOUNT_COUNT_CHANGED';
  end if;

  execute v_backup.previous_writer_definition;
  alter table public.affiliate_bank_accounts drop constraint affiliate_bank_complete_check;
  execute 'alter table public.affiliate_bank_accounts add constraint affiliate_bank_complete_check '
    ||v_backup.previous_constraint_definition;
end $recovery$;

revoke all on function public.save_affiliate_deposit_account(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.save_affiliate_deposit_account(uuid,text,text,text) to authenticated;

drop table public.loan_deposit_validation_migration_backup;

notify pgrst, 'reload schema';
commit;
