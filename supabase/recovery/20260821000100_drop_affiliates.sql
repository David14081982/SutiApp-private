-- Recovery for H-004 only. Run only before any Auth link or downstream consumer exists.
begin;

drop table if exists public.affiliates;
drop function if exists public.set_affiliates_updated_at();

commit;

