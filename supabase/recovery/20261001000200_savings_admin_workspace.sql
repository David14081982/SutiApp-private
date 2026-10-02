begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Revert the matching frontend first. Existing authorities, RPCs and every row remain untouched.
drop function public.get_admin_savings_workspace_summary();
drop function public.get_admin_savings_workspace_person(uuid,integer,integer);
drop function public.get_admin_savings_workspace_people(text,text,integer,integer);
drop function public.savings_workspace_person_row(uuid);
drop function public.savings_workspace_history(uuid);
drop function public.savings_workspace_receipts(uuid);
notify pgrst,'reload schema';
commit;
