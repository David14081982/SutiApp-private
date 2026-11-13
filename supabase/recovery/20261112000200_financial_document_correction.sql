-- Stop corrections; preserve the replacement, never restore intentionally deleted bytes.
begin;
revoke execute on function public.prepare_financial_document_correction(uuid,uuid,uuid,text,text,bigint,text) from authenticated;
revoke execute on function public.complete_financial_document_correction(uuid,jsonb) from service_role;
drop trigger evidence_immutable on public.request_documents;
create trigger evidence_immutable before update or delete on public.request_documents for each row execute function document_evidence_private.immutable();
-- Keep the new REPLACED state and private journal. Finish LINKED purges through the
-- narrowly scoped service endpoint; no new document replacements can begin.
-- Keep the discarded-candidate operation/Storage guards so an old upload cannot
-- be resurrected. They do not restrict unrelated uploads.
commit;
