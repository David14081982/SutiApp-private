begin;
-- Recovery disables new entry points first. Historical affiliate_files/private_assets
-- and existing program_requests rows are deliberately retained.
revoke execute on function public.register_affiliate_document(uuid,text,text,bigint,text),public.review_affiliate_document(uuid,text,text),public.save_program_document_requirement(text,uuid,uuid,boolean,boolean,integer,boolean),public.publish_program_terms(text,uuid,text,text),public.save_affiliate_bank_account(uuid,text,text,text,text,boolean),public.delete_affiliate_bank_account(uuid),public.issue_credential_qr(),public.attach_request_documents(uuid,uuid[]),public.finalize_program_request_context(uuid,uuid,uuid[]),public.create_membership_request(uuid,uuid[],text,text,text,uuid,uuid) from authenticated;
drop policy if exists affiliate_document_storage_insert on storage.objects;
drop policy if exists affiliate_document_storage_cleanup on storage.objects;
update public.document_types set enabled=false;
update public.program_document_requirements set enabled=false;
update public.credential_qr_settings set destination_path='/SutiApp.html#credencial',ttl_seconds=30;
-- New tables contain user/audit history and are retained for recovery and reconciliation.
commit;
