begin;

drop function if exists public.list_self_marketplace_quote_notifications();

notify pgrst, 'reload schema';

commit;
