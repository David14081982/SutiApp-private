begin;
-- Read-only change: restore the exact prior reader without touching any financial history.
drop function public.get_admin_savings_panel(text,text,text,integer,integer);
alter function public.savings_panel_before_current_summary(text,text,text,integer,integer) rename to get_admin_savings_panel;
grant execute on function public.get_admin_savings_panel(text,text,text,integer,integer) to authenticated;
drop function public.get_admin_savings_panel_detail(uuid,integer,integer);
drop function public.get_admin_savings_panel_neighbor(uuid,text,text,text,integer);
alter function public.savings_detail_before_current_summary(uuid,integer,integer) rename to get_admin_savings_panel_detail;
alter function public.savings_neighbor_before_current_summary(uuid,text,text,text,integer) rename to get_admin_savings_panel_neighbor;
grant execute on function public.get_admin_savings_panel_detail(uuid,integer,integer),public.get_admin_savings_panel_neighbor(uuid,text,text,text,integer) to authenticated;
drop function public.savings_admin_filtered_people(text,text,text,jsonb);
drop function public.savings_admin_current_summary();
notify pgrst,'reload schema';
commit;
