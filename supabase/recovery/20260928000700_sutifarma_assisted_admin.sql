begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
do $recovery$ declare definition text; begin
 select b.definition into definition from farma_private.definition_backup b where b.signature='farma_private.allowed(text)';
 if definition is null then raise exception 'FARMA_ASSISTED_BACKUP_MISSING'; end if;
 execute definition;
 delete from farma_private.definition_backup where signature='farma_private.allowed(text)';
 if md5(pg_get_functiondef('farma_private.allowed(text)'::regprocedure))<>'6ca73476d701cb7cee2ffbc943936720' then
  raise exception 'FARMA_ASSISTED_RECOVERY_FAILED';
 end if;
end $recovery$;
commit;
