begin;
-- Revert the focal UI first. Preserve all historical availability and audit records.
drop function public.admin_set_savings_individual_withdrawal(text,boolean,date,text,text,uuid);
drop function public.get_admin_savings_individual_withdrawal(text);
notify pgrst,'reload schema';
commit;
