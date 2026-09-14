begin;
do $$ declare saved record;begin
 if exists(select 1 from public.savings_audit_events where resource='savings_account_receipts') then raise exception 'RECOVERY_BLOCKED_SAVINGS_ACCOUNT_RECEIPTS_EXIST';end if;
 for saved in select definition from public.savings_account_receipts_backup where signature<>'get_admin_savings_financial_account(uuid,date)' loop execute saved.definition;end loop;
end $$;
drop function public.get_admin_savings_financial_account(uuid,date);
alter function public.savings_financial_before_accounts(uuid,date) rename to get_admin_savings_financial_account;
grant execute on function public.get_admin_savings_financial_account(uuid,date) to authenticated;
drop function public.get_admin_savings_native_accounts(text,integer,integer,text);
drop function public.get_admin_savings_account(uuid,date);
drop function public.admin_confirm_savings_account_receipt(uuid,uuid,date,numeric,integer,text,uuid);
drop function public.savings_enrollment_effective_status(text,timestamptz,date);
drop table public.savings_account_receipts_backup;
notify pgrst,'reload schema';
commit;
