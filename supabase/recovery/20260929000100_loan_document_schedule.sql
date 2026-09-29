-- Disable future enrichment only. Retain all historical JSON, PDFs and financial data.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
drop trigger document_loan_payment_schedule on document_private.records;
drop function document_private.capture_loan_payment_schedule();
drop function document_private.loan_payment_schedule(jsonb,date);
commit;
