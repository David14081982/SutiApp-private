begin;
set local lock_timeout='2s';set local statement_timeout='60s';
do $recover$ declare b record;p oid;begin
 if (select count(*) from savings_read_private.function_backup)<>2 then raise exception 'SAVINGS_READ_BACKUP_REQUIRED';end if;
 for b in select * from savings_read_private.function_backup loop
  p:=to_regprocedure(b.signature);
  if p is null or md5(pg_get_functiondef(p)) is distinct from b.installed_md5
   or (select pg_get_userbyid(proowner) from pg_proc where oid=p) is distinct from b.owner_name
   or (select proacl::text from pg_proc where oid=p) is distinct from b.original_acl then raise exception 'SAVINGS_READ_RECOVERY_DRIFT';end if;
  execute b.definition;
 end loop;
end $recover$;
drop function savings_read_private.self_version(uuid,jsonb,date);
drop table savings_read_private.function_backup;
drop schema savings_read_private;
notify pgrst,'reload schema';commit;
