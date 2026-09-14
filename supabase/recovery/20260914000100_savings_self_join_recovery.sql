begin;
do $$ declare r record;begin
 for r in select definition from public.savings_self_join_backup loop execute r.definition;end loop;
end $$;
drop function public.get_self_savings_join_context(numeric);
drop function public.submit_self_savings_join(numeric,uuid,text,uuid);
-- Keep restricted backup and all registrations/history. Never delete business data.
notify pgrst,'reload schema';
commit;
