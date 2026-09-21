begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
do $recovery$ declare r record;begin
 if (select count(*) from public.savings_certification_function_backup where signature like 'P1_RECEIPT_20260921:%')<>3
 then raise exception 'SAVINGS_RECEIPT_RECOVERY_REQUIRED';end if;
 for r in select definition from public.savings_certification_function_backup
  where signature like 'P1_RECEIPT_20260921:%' order by signature loop execute r.definition;end loop;
end $recovery$;
drop function public.savings_receipt_assert_identity(uuid);
-- Genuine receipts and private backup definitions are preserved.
notify pgrst,'reload schema';
commit;
