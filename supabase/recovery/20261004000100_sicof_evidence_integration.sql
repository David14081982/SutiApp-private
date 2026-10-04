begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
do $$ declare b sicof_private.evidence_reader_backup%rowtype; begin
 select * into strict b from sicof_private.evidence_reader_backup where id;
 if not exists(select 1 from pg_proc p where p.oid='sicof_private.context(date,date)'::regprocedure
  and p.oid=b.original_oid and md5(pg_get_functiondef(p.oid))=b.installed_hash
  and pg_get_userbyid(p.proowner)=b.original_owner and p.proacl=b.original_acl)
  or not exists(select 1 from pg_proc p where p.oid='sicof_private.evidence_history(uuid)'::regprocedure
   and md5(pg_get_functiondef(p.oid))=b.helper_hash and pg_get_userbyid(p.proowner)='postgres'
   and p.proacl='{postgres=X/postgres}'::aclitem[]) then
  raise exception 'SICOF_EVIDENCE_RECOVERY_DRIFT';
 end if;
 execute b.definition;
end $$;
drop function sicof_private.evidence_history(uuid);
drop table sicof_private.evidence_reader_backup;
notify pgrst,'reload schema';
commit;
