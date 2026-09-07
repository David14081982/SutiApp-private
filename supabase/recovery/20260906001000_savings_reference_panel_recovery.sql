begin;
-- Roll back the panel frontend first. Source and private review/history remain.
drop function public.admin_save_savings_panel(uuid,integer,jsonb,text,text,uuid);
drop function public.admin_reset_savings_panel_discount(uuid,integer,text,text,uuid);
drop function public.get_admin_savings_panel_affiliate(uuid);
drop function public.get_admin_savings_panel_request(uuid);
drop function public.get_admin_savings_panel_neighbor(uuid,text,text,text,integer);
drop function public.get_admin_savings_panel_detail(uuid,integer,integer);
drop function public.get_admin_savings_panel(text,text,text,integer,integer);
drop function public.savings_panel_people(uuid);
drop function public.savings_panel_date(text);
drop function public.savings_panel_number(jsonb);
notify pgrst,'reload schema';
commit;
