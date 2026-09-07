-- Revert the matching frontend reader first. No historical records are modified.
begin;
drop function public.get_admin_savings_recorded_history(uuid);
notify pgrst,'reload schema';
commit;
