begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- H-FLUJO-EFECTIVO-CONSOLIDADO-001: additive reader, no business data changes.
create function public.get_admin_reports_jc_cash_flow_contracts() returns jsonb
language plpgsql stable security definer set search_path='' as $contracts$
declare result jsonb;
begin
 perform public.get_admin_reports_jc_context();
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'reference',r.folio,'numeroControl',r.numero_control,
  'status',r.status,'program',r.program_id,
  'createdOn',(r.created_at at time zone 'America/Hermosillo')::date,
  'approvedAt',r.financial_approved_at,
  'category',r.financial_approval_snapshot->'financial_employee_category',
  'financial',r.financial_approval_snapshot->'financialResult',
  'fingerprint',md5(r.financial_approval_snapshot::text)
 ) order by r.id),'[]'::jsonb) into result
 from public.program_requests r
 where r.status='approved' and r.program_id='prestamo'
 and r.financial_approval_snapshot is not null;
 return jsonb_build_object('authority','program_requests.financial_approval_snapshot','snapshots',result);
end $contracts$;
revoke all on function public.get_admin_reports_jc_cash_flow_contracts() from public,anon,authenticated,service_role;
grant execute on function public.get_admin_reports_jc_cash_flow_contracts() to authenticated;
comment on function public.get_admin_reports_jc_cash_flow_contracts() is 'Admin-only read of immutable approved loan financial terms for read-only cash flow; no documents, signatures, other modules or writes.';
notify pgrst,'reload schema';
commit;
