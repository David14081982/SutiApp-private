-- Restore exact prior definition; retain all document revisions.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('document_private.reissue(jsonb)'::regprocedure);
 if md5(definition)<>'dbfb7bb11deca7837ef4b5e0c184b6eb' then raise exception 'MEMBERSHIP_REISSUE_BASELINE_DRIFT';end if;
 definition:=replace(definition,$before$jsonb_build_object('parent_id',parent,'business_version',revision+1)||case when old.program='membership' and old.document_type='MEMBERSHIP_APPROVAL' then jsonb_build_object('signer_source','CURRENT_CONFIGURATION','configuration_id',cfg->'configuration_id') else '{}'::jsonb end$before$,$after$jsonb_build_object('parent_id',parent,'business_version',revision+1)$after$);
 definition:=replace(definition,$before$jsonb_build_object('signers',case when old.program='membership' and old.document_type='MEMBERSHIP_APPROVAL' then cfg->'signers' else old.document_snapshot->'signers' end)$before$,$after$jsonb_build_object('signers',old.document_snapshot->'signers')$after$);
 definition:=replace(definition,$before$-- Membership corrections use current configured signers; other authorizations retain historical signers.$before$,$after$-- Historical signers stay attached to the authorization, even if the current roster changed.$after$);
 execute definition;
 if md5(pg_get_functiondef('document_private.reissue(jsonb)'::regprocedure))<>'747af0c6945a5e007bd009a2674f8a4c' then raise exception 'MEMBERSHIP_REISSUE_DEFINITION_MISMATCH';end if;
end $migration$;
notify pgrst,'reload schema';
commit;
