begin;
set local lock_timeout='5s';
do $$ declare saved sicof_private.context_read_backup%rowtype;begin
 select * into strict saved from sicof_private.context_read_backup where id;
 if pg_get_functiondef('sicof_private.context(date,date)'::regprocedure) is distinct from saved.installed_definition
  or (select proacl from pg_proc where oid='sicof_private.context(date,date)'::regprocedure) is distinct from saved.original_acl
  or (select pg_get_userbyid(proowner) from pg_proc where oid='sicof_private.context(date,date)'::regprocedure) is distinct from saved.original_owner
 then raise exception 'SICOF_CONTEXT_RECOVERY_DRIFT';end if;
 execute saved.definition;
end $$;
-- Preserve backup, savings ledger, attribution journal and historical report.
notify pgrst,'reload schema';
commit;
