begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
do $$ declare b record; begin
 if exists(select 1 from public.program_requests where financial_submission_snapshot ? 'financing_conditions')
 or exists(select 1 from public.program_catalog_items where financing_config is not null) then
  raise exception 'RECOVERY_BLOCKED_PRODUCT_FINANCING_HISTORY_EXISTS';
 end if;
 for b in select * from program_financing_private.function_backup loop
  if pg_get_functiondef(b.signature::regprocedure) is distinct from b.applied_definition then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT'; end if;
  execute b.definition;
 end loop;
end $$;
drop function public.confirm_program_product_financing(jsonb,jsonb,jsonb);
drop function public.save_program_catalog_item_financing(uuid,jsonb,jsonb,jsonb,jsonb,boolean);
drop function public.get_program_product_financing_options();
drop function public.resolve_program_product_financing(uuid,uuid,jsonb,numeric);
drop function public.validate_program_product_financing(jsonb);
alter table public.program_catalog_items drop column financing_config;
drop table program_financing_private.function_backup;
drop schema program_financing_private;
commit;
