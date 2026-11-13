-- Pause new processing without removing derived reviews or any business history.
begin;
update financial_review_private.settings set enabled=false where id;
revoke execute on function public.claim_financial_document_review() from service_role;
-- Requests and documents continue through their existing human workflow.
commit;
