begin;

do $$ begin
  if exists(select 1 from public.loan_request_deposit_snapshots)
     or exists(select 1 from public.affiliate_bank_accounts where card_number is not null)
     or exists(select 1 from public.affiliates where notification_phone is not null) then
    raise exception 'RECOVERY_BLOCKED_LOAN_DEPOSIT_DATA_EXISTS';
  end if;
end $$;

drop function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb);
alter function public.create_validated_financial_program_request_pre_deposit(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
  rename to create_validated_financial_program_request;
revoke all on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) to service_role;

drop function public.save_affiliate_deposit_account(uuid,text,text,text);
drop function public.save_current_notification_phone(text);
drop function public.get_current_notification_phone();
drop table public.loan_request_deposit_snapshots;
drop function public.reject_loan_deposit_snapshot_mutation();

drop index public.affiliate_bank_card_idx;
alter table public.affiliate_bank_accounts
  drop constraint affiliate_bank_complete_check,
  drop constraint affiliate_bank_card_check,
  drop column card_number,
  add constraint affiliate_bank_complete_check check(
    (data_status='COMPLETE' and account_holder is not null and bank_name is not null and account_number is not null and cardinality(incomplete_fields)=0)
    or (data_status='INCOMPLETE_HISTORICAL_DATA' and source_kind='HISTORICAL_SEED' and (bank_name is not null or clabe is not null or account_number is not null))
  );
alter table public.affiliates drop constraint affiliates_notification_phone_check,drop column notification_phone;
drop function public.is_valid_clabe(text);

notify pgrst, 'reload schema';
commit;
