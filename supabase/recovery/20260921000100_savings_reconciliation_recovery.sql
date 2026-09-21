begin;
-- Retain all receipts, review history and bank batch audits if the UI is withdrawn.
drop function public.admin_confirm_savings_reconciliation(date,jsonb,boolean,uuid);
drop function public.get_admin_savings_reconciliation(date);
notify pgrst,'reload schema';
commit;
