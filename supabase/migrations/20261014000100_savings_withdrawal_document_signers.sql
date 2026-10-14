-- H-SAVINGS-DOCUMENT-SIGNERS-UX-001: explicit withdrawal corrections use the assigned signers.
-- Existing PDFs, approval events and financial values remain sealed; loans retain their behavior.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
do $migration$
declare definition text;prior_scope text:=$scope$old.program='membership' and old.document_type='MEMBERSHIP_APPROVAL'$scope$;
 next_scope text:=$scope$(old.program='membership' and old.document_type='MEMBERSHIP_APPROVAL') or (old.program='caja' and old.document_type='SAVINGS_WITHDRAWAL_APPROVAL')$scope$;
begin
 definition:=pg_get_functiondef('document_private.reissue(jsonb)'::regprocedure);
 if md5(definition)<>'dbfb7bb11deca7837ef4b5e0c184b6eb' then raise exception 'SAVINGS_DOCUMENT_SIGNERS_BASELINE_DRIFT';end if;
 if (length(definition)-length(replace(definition,prior_scope,'')))/length(prior_scope)<>2 then raise exception 'SAVINGS_DOCUMENT_SIGNERS_SCOPE_DRIFT';end if;
 definition:=replace(definition,prior_scope,next_scope);
 definition:=replace(definition,'-- Membership corrections use current configured signers; other authorizations retain historical signers.','-- Membership and Caja withdrawal corrections use current configured signers; other authorizations retain historical signers.');
 execute definition;
 if md5(pg_get_functiondef('document_private.reissue(jsonb)'::regprocedure))<>'d6daed09f48ea4b9c89846cf75515c19' then raise exception 'SAVINGS_DOCUMENT_SIGNERS_DEFINITION_MISMATCH';end if;
end $migration$;
notify pgrst,'reload schema';
commit;
