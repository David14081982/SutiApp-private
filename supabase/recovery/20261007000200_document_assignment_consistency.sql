-- Restore exact definitions/privileges. Immutable configurations/layouts/history are retained.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
do $assignment_recovery$
declare saved jsonb; signature text; entry jsonb; actual jsonb;
begin
 select assignment_consistency_recovery into strict saved from document_private.installation;
 if saved is null then raise exception 'DOCUMENT_ASSIGNMENT_RECOVERY_MISSING';end if;
 for signature,entry in select key,value from jsonb_each(saved) loop
  if md5(replace(pg_get_functiondef(signature::regprocedure),chr(13),'')) is distinct from entry->>'applied_hash' then raise exception 'DOCUMENT_ASSIGNMENT_RECOVERY_DRIFT: %',signature;end if;
  select jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',to_jsonb(p.proacl)) into actual from pg_proc p where p.oid=signature::regprocedure;
  if actual is distinct from entry-array['definition','applied_hash'] then raise exception 'DOCUMENT_ASSIGNMENT_RECOVERY_SECURITY_DRIFT';end if;
  execute entry->>'definition';
  if pg_get_functiondef(signature::regprocedure) is distinct from entry->>'definition' then raise exception 'DOCUMENT_ASSIGNMENT_RECOVERY_POSTCONDITION';end if;
 end loop;
end $assignment_recovery$;
alter table document_private.installation drop column assignment_consistency_recovery;
notify pgrst,'reload schema';
commit;
