begin;
do $$ begin if exists(select 1 from public.savings_review_import_normalizations) then raise exception 'SAVINGS_REVIEW_NORMALIZATION_PRESERVE_HISTORY'; end if; end $$;
drop table public.savings_review_import_normalizations;
drop function public.savings_review_normalization_immutable();
commit;
