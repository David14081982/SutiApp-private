begin;
do $$ begin if exists(select 1 from public.company_benefit_profiles) or exists(select 1 from public.company_benefits) then raise exception 'RECOVERY_REFUSED: productive company benefit data exists'; end if; end $$;
drop table public.company_benefits,public.company_benefit_profiles;
commit;
