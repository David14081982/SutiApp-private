begin;
-- Restore the prior frontend first. Remove only new readers; no business data exist here.
drop function public.get_affiliate_seniority(integer, integer);
drop function seniority_private.entry_date(text);
drop schema seniority_private;
commit;
