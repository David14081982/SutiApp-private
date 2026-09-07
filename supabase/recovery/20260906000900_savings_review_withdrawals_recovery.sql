-- Revert the matching frontend consumer first. Historical data remains untouched.
begin;
drop function public.get_admin_savings_review_withdrawals(uuid);
notify pgrst,'reload schema';
commit;
