begin;

-- RLS selects the rows; column grants keep signatures, idempotency and internal
-- source context out of every browser response.
revoke select on public.program_requests from authenticated;
grant select (
  id,folio,actor_real_auth_user_id,affiliate_id,numero_control,program_id,
  program_item_id,product_id,company_id,request_type,status,quantity,notes,
  terms_accepted,financial_processing_status,legacy_reference,quoted_amount,
  quote_note,valid_until,responded_at,created_at,updated_at
) on public.program_requests to authenticated;

notify pgrst, 'reload schema';
commit;
