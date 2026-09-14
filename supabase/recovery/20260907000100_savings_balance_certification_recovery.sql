begin;
do $$ begin
 if exists(select 1 from public.savings_balance_certifications) then raise exception 'RECOVERY_BLOCKED_CERTIFIED_BALANCES'; end if;
end $$;
drop function public.admin_confirm_savings_receipt(uuid,date,numeric,integer,text,uuid);
drop function public.get_admin_savings_financial_account(uuid,date);
drop function public.admin_confirm_savings_balance(uuid,jsonb,text,uuid);
drop function public.preview_savings_balance_certification(uuid,jsonb);
drop function public.savings_certification_context(uuid);
drop function public.get_self_savings_dashboard();
alter function public.savings_dashboard_before_certification() rename to get_self_savings_dashboard;
drop function public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid);
alter function public.savings_submit_before_certification(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid) rename to submit_self_savings_request;
do $$ declare d record; begin
 for d in select * from public.savings_certification_function_backup loop execute d.definition; end loop;
end $$;
grant execute on function public.get_self_savings_dashboard(),public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid) to authenticated;
drop table public.savings_balance_certifications;
drop table public.savings_certification_function_backup;
notify pgrst,'reload schema';
commit;
