begin;

create or replace function public.get_admin_financial_request_detail(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.read') then
    raise exception 'FINANCIAL_REQUEST_READ_DENIED' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'FINANCIAL_REQUEST_REQUIRED' using errcode='22023'; end if;
  select jsonb_build_object(
    'id',r.id,'folio',r.folio,'affiliate_id',r.affiliate_id,'numero_control',r.numero_control,
    'program_id',r.program_id,'program_item_id',r.program_item_id,'terms_version_id',r.terms_version_id,
    'request_type',r.request_type,'status',r.status,'notes',r.notes,'terms_accepted',r.terms_accepted,
    'financial_processing_status',r.financial_processing_status,
    'requested_amount',r.requested_amount,'requested_term',r.requested_term,
    'requested_term_semantics',r.requested_term_semantics,
    'financial_submission_snapshot',case when r.financial_submission_snapshot is null then null else jsonb_build_object(
      'confirmed_at',r.financial_submission_snapshot->'confirmed_at',
      'financialResult',r.financial_submission_snapshot->'financialResult'
    ) end,
    'financial_approval_snapshot',case when r.financial_approval_snapshot is null then null else jsonb_build_object(
      'financialResult',r.financial_approval_snapshot->'financialResult'
    ) end,
    'financial_approved_at',r.financial_approved_at,
    'impersonation_session_id',r.impersonation_session_id,
    'usuario_contexto_affiliate_id',r.usuario_contexto_affiliate_id,
    'created_at',r.created_at,'updated_at',r.updated_at,
    'affiliate',jsonb_build_object('full_name',a.full_name,'display_name',a.display_name,'numero_control',a.numero_control),
    'program_item',case when i.id is null then null else jsonb_build_object('name',i.name,'program_key',i.program_key) end,
    'financial_export',case when e.program_request_id is null then null else jsonb_build_object(
      'export_status',e.export_status,'attempt_count',e.attempt_count,'error_code',e.error_code,'updated_at',e.updated_at
    ) end
  ) into v_result
  from public.program_requests r
  join public.affiliates a on a.id=r.affiliate_id
  left join public.program_catalog_items i on i.id=r.program_item_id
  left join public.financial_request_export_audit e on e.program_request_id=r.id
  where r.id=p_request_id and r.financial_processing_status is not null;
  if v_result is null then raise exception 'FINANCIAL_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  return v_result;
end $$;

comment on column public.program_requests.financial_approval_snapshot is
  'Immutable approved financial contract derived from the validated submission snapshot and Google export response.';
comment on function public.get_admin_financial_request_detail(uuid) is
  'Returns the authorized least-privilege detail for one financial request without signature or unrestricted snapshots.';

commit;
