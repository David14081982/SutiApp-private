begin;
do $$ begin
 if exists(select 1 from public.savings_review_batches) or exists(select 1 from public.savings_review_records) or exists(select 1 from public.savings_review_events) then raise exception 'SAVINGS_REVIEW_RECOVERY_PRESERVE_HISTORY'; end if;
end $$;
drop function public.admin_save_savings_review(uuid,integer,jsonb,text,text,uuid);
drop function public.get_admin_savings_review(uuid);
drop function public.savings_review_identity(text);
drop table public.savings_review_events;
drop table public.savings_review_records;
drop table public.savings_review_batches;
drop function public.savings_review_immutable();
notify pgrst,'reload schema';
commit;
