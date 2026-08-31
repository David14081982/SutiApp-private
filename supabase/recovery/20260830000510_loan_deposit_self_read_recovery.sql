begin;
drop function public.list_current_deposit_accounts();
notify pgrst, 'reload schema';
commit;
