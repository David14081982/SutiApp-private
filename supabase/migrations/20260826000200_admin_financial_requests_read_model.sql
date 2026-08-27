begin;

-- Financial columns remain denied through direct browser table grants. These
-- projections expose only the operational fields required by an authorized
-- financial reviewer and never recalculate historical financial conditions.
create function public.list_admin_financial_request_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_rows jsonb;
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.read') then
    raise exception 'FINANCIAL_REQUEST_READ_DENIED' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(q.payload order by q.created_at desc,q.id desc),'[]'::jsonb)
    into v_rows
  from (
    select r.id,r.created_at,jsonb_build_object(
      'id',r.id,'folio',r.folio,'affiliate_id',r.affiliate_id,'numero_control',r.numero_control,
      'program_id',r.program_id,'program_item_id',r.program_item_id,'request_type',r.request_type,
      'status',r.status,'financial_processing_status',r.financial_processing_status,
      'requested_amount',r.requested_amount,'requested_term',r.requested_term,
      'requested_term_semantics',r.requested_term_semantics,'created_at',r.created_at,'updated_at',r.updated_at,
      'affiliate',jsonb_build_object('full_name',a.full_name,'display_name',a.display_name,'numero_control',a.numero_control),
      'program_item',case when i.id is null then null else jsonb_build_object('name',i.name,'program_key',i.program_key) end
    ) payload
    from public.program_requests r
    join public.affiliates a on a.id=r.affiliate_id
    left join public.program_catalog_items i on i.id=r.program_item_id
    where r.financial_processing_status is not null
    order by r.created_at desc,r.id desc
    limit 250
  ) q;
  return v_rows;
end $$;

create function public.get_admin_financial_request_detail(p_request_id uuid)
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

create function public.list_admin_financial_requests_mobile()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_rows jsonb;
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.read') then
    raise exception 'FINANCIAL_REQUEST_READ_DENIED' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(q.payload order by q.created_at desc,q.id desc),'[]'::jsonb)
    into v_rows
  from (
    select r.id,r.created_at,jsonb_build_object(
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
      'created_at',r.created_at,'updated_at',r.updated_at,
      'affiliate',jsonb_build_object('full_name',a.full_name,'display_name',a.display_name,'numero_control',a.numero_control),
      'program_item',case when i.id is null then null else jsonb_build_object('name',i.name,'program_key',i.program_key) end,
      'financial_export',case when e.program_request_id is null then null else jsonb_build_object(
        'export_status',e.export_status,'attempt_count',e.attempt_count,'error_code',e.error_code,'updated_at',e.updated_at
      ) end
    ) payload
    from public.program_requests r
    join public.affiliates a on a.id=r.affiliate_id
    left join public.program_catalog_items i on i.id=r.program_item_id
    left join public.financial_request_export_audit e on e.program_request_id=r.id
    where r.financial_processing_status is not null
    order by r.created_at desc,r.id desc
    limit 250
  ) q;
  return v_rows;
end $$;

revoke all on function public.list_admin_financial_request_queue() from public,anon;
revoke all on function public.get_admin_financial_request_detail(uuid) from public,anon;
revoke all on function public.list_admin_financial_requests_mobile() from public,anon;
grant execute on function public.list_admin_financial_request_queue() to authenticated;
grant execute on function public.get_admin_financial_request_detail(uuid) to authenticated;
grant execute on function public.list_admin_financial_requests_mobile() to authenticated;

comment on function public.list_admin_financial_request_queue() is
  'Metadata-only financial request queue for program_requests.read administrators; maximum 250 rows and no snapshots.';
comment on function public.get_admin_financial_request_detail(uuid) is
  'Least-privilege financial request detail for program_requests.read administrators; immutable snapshots are PII-reduced and never recalculated.';
comment on function public.list_admin_financial_requests_mobile() is
  'Compatibility projection for the approved sequential mobile Admin financial flow; unavailable to normal affiliates.';

notify pgrst, 'reload schema';
commit;
