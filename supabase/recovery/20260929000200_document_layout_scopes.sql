-- Fail closed during rollback; retain all layouts, assignments, documents and audit.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
update document_private.installation set enabled=false;
do $$ declare x record;begin
 for x in select key,value from jsonb_each_text((select layout_scope_recovery from document_private.installation)) loop
  execute x.value;
 end loop;
end $$;
-- Keep readers/helpers and added columns for sealed snapshots and forensic recovery.
notify pgrst,'reload schema';
commit;
