begin;
set local lock_timeout='2s';
-- Restore the previous functions exactly. Registrations, plans, requests,
-- document records and audit events created since installation are preserved.
do $restore$
declare backup record;
begin
 if (select count(*) from public.savings_auto_enrollment_backup)<>4
 then raise exception 'SAVINGS_AUTO_JOIN_RECOVERY_BACKUP_INCOMPLETE';end if;
 for backup in select * from public.savings_auto_enrollment_backup loop
  if md5(pg_get_functiondef(backup.signature::regprocedure)) is distinct from backup.installed_hash
  then raise exception 'SAVINGS_AUTO_JOIN_RECOVERY_DEFINITION_DRIFT: %',backup.signature;end if;
 end loop;
 for backup in select * from public.savings_auto_enrollment_backup loop execute backup.definition;end loop;
end $restore$;
drop function public.savings_activate_join(uuid,text,date);
drop table public.savings_auto_enrollment_backup;
notify pgrst,'reload schema';
commit;
