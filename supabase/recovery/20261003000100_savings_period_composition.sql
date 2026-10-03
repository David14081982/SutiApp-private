begin;
set local lock_timeout='5s';
-- Retain all classification history. Recovery never drops tables or money.
do $$ declare b record; begin
 for b in select * from savings_period_private.function_backup loop
  if pg_get_functiondef(to_regprocedure('public.'||b.signature)) is distinct from b.installed_definition
   or (select proacl from pg_proc where oid=to_regprocedure('public.'||b.signature)) is distinct from b.original_acl
   or (select pg_get_userbyid(proowner) from pg_proc where oid=to_regprocedure('public.'||b.signature)) is distinct from b.original_owner
  then raise exception 'SAVINGS_PERIOD_RECOVERY_DRIFT';end if;
 end loop;
 for b in select * from savings_period_private.function_backup loop execute b.definition;end loop;
end $$;
revoke all on function public.get_admin_savings_period_composition(uuid,date),
 public.admin_attribute_savings_opening(uuid,jsonb,text,text,uuid),public.admin_attribute_savings_withdrawal(uuid,jsonb,text,text,uuid)
 from public,anon,authenticated,service_role;
revoke all on all functions in schema savings_period_private from public,anon,authenticated,service_role;
revoke all on all tables in schema savings_period_private from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
