begin;
do $$ begin if exists(select 1 from public.savings_source_observations) or exists(select 1 from public.savings_source_acceptances) then raise exception 'RECOVERY_BLOCKED_SOURCE_HISTORY';end if;end $$;
drop function public.admin_accept_savings_source(uuid,uuid,integer,uuid);
drop function public.import_savings_source_observations(text,timestamptz,jsonb);
drop function public.savings_certification_context(uuid);
alter function public.savings_context_before_source_refresh(uuid) rename to savings_certification_context;
drop table public.savings_source_acceptances;
drop table public.savings_source_observations;
commit;
