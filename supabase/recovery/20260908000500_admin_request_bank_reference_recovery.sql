begin;
CREATE OR REPLACE FUNCTION public.get_admin_finance_request_flow_detail(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.read') then
    raise exception 'PROGRAM_REQUEST_READ_DENIED' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'PROGRAM_REQUEST_REQUIRED' using errcode='22023'; end if;
  select jsonb_strip_nulls(jsonb_build_object(
    'id',r.id,'folio',r.folio,'affiliate_id',r.affiliate_id,'numero_control',r.numero_control,
    'program_id',r.program_id,'program_item_id',r.program_item_id,'product_id',r.product_id,
    'membership_offering_id',r.membership_offering_id,'company_id',r.company_id,
    'terms_version_id',r.terms_version_id,'document_requirements_snapshot',r.document_requirements_snapshot,
    'request_type',r.request_type,'status',r.status,'quantity',r.quantity,'notes',r.notes,'terms_accepted',r.terms_accepted,
    'financial_processing_status',r.financial_processing_status,
    'requested_amount',r.requested_amount,'requested_term',r.requested_term,'requested_term_semantics',r.requested_term_semantics,
    'quoted_amount',r.quoted_amount,'quote_note',r.quote_note,'valid_until',r.valid_until,'responded_at',r.responded_at,
    'financial_submission_snapshot',case when r.financial_submission_snapshot is null then null else jsonb_build_object(
      'contract_version',r.financial_submission_snapshot->'contract_version','confirmed_at',r.financial_submission_snapshot->'confirmed_at',
      'financialResult',r.financial_submission_snapshot->'financialResult','product',r.financial_submission_snapshot->'product',
      'price_source',r.financial_submission_snapshot->'price_source','authorized_price',r.financial_submission_snapshot->'authorized_price',
      'down_payment',r.financial_submission_snapshot->'down_payment','financed_amount',r.financial_submission_snapshot->'financed_amount',
      'term',r.financial_submission_snapshot->'term','payment_schedule',r.financial_submission_snapshot->'payment_schedule'
    ) end,
    'financial_approval_snapshot',case when r.financial_approval_snapshot is null then null else jsonb_build_object(
      'financialResult',r.financial_approval_snapshot->'financialResult'
    ) end,'financial_approved_at',r.financial_approved_at,
    'impersonation_session_id',r.impersonation_session_id,'created_at',r.created_at,'updated_at',r.updated_at,
    'affiliate',jsonb_build_object('full_name',a.full_name,'display_name',a.display_name,'numero_control',a.numero_control),
    'program_item',case when pi.id is null then null else jsonb_build_object('name',pi.name,'program_key',pi.program_key,'price_cash',pi.price_cash) end,
    'product',case when p.id is null then null else jsonb_build_object('name',p.name,'price',p.price) end,
    'membership',case when m.id is null then null else jsonb_build_object('company_raw',m.company_raw,'concept',m.concept,'amount',m.amount) end,
    'company',case when c.id is null then null else jsonb_build_object('display_name',c.display_name) end,
    'financial_export',case when ex.program_request_id is null then null else jsonb_build_object(
      'export_status',ex.export_status,'attempt_count',ex.attempt_count,'error_code',ex.error_code,'updated_at',ex.updated_at) end,
    'workflow_state',public.resolve_program_request_workflow_state(r.id)
  )) into v_result
  from public.program_requests r
  join public.affiliates a on a.id=r.affiliate_id
  left join public.program_catalog_items pi on pi.id=r.program_item_id
  left join public.marketplace_products p on p.id=r.product_id
  left join public.membership_offerings m on m.id=r.membership_offering_id
  left join public.companies c on c.id=r.company_id
  left join public.financial_request_export_audit ex on ex.program_request_id=r.id
  where r.id=p_request_id;
  if v_result is null then raise exception 'PROGRAM_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  return v_result;
end $function$
;
commit;
