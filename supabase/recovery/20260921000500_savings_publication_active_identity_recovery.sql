begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Function recovery preserves publication events, real ledger and affiliate history.
do $recovery$ declare r record;begin
 if (select count(*) from public.savings_certification_function_backup where signature like 'P1_PUBLICATION_20260921:%')<>3
 then raise exception 'SAVINGS_PUBLICATION_RECOVERY_REQUIRED';end if;
 for r in select definition from public.savings_certification_function_backup
  where signature like 'P1_PUBLICATION_20260921:%' order by signature loop
  execute r.definition;
 end loop;
end $recovery$;
notify pgrst,'reload schema';
commit;
