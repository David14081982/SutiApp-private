begin;

drop trigger if exists operational_workflows_change_audit on public.operational_workflows;
drop trigger if exists operational_workflow_stages_change_audit on public.operational_workflow_stages;
drop trigger if exists operational_request_tracking_change_audit on public.operational_request_tracking;
drop trigger if exists operational_request_tracking_validate on public.operational_request_tracking;
drop trigger if exists operational_workflow_stages_bump_version on public.operational_workflow_stages;
drop trigger if exists operational_workflow_stages_validate on public.operational_workflow_stages;
drop trigger if exists operational_workflows_bump_version on public.operational_workflows;
drop trigger if exists operational_workflows_validate on public.operational_workflows;
drop trigger if exists program_requests_protect_workflow_snapshot on public.program_requests;
drop trigger if exists program_requests_capture_workflow_snapshot on public.program_requests;

drop function if exists public.list_admin_request_workflow_tracking();
drop function if exists public.get_self_request_workflow_state(uuid);
drop function if exists public.reorder_operational_workflow_stages(uuid,uuid[]);

create or replace function public.list_self_program_request_history()
returns setof jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_affiliate_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  v_affiliate_id:=public.get_effective_affiliate_id();
  if v_affiliate_id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  return query
  select jsonb_strip_nulls(jsonb_build_object(
    'id',r.id,'folio',r.folio,'program_id',r.program_id,'program_item_id',r.program_item_id,'product_id',r.product_id,
    'membership_offering_id',r.membership_offering_id,'company_id',r.company_id,'request_type',r.request_type,'status',r.status,
    'quantity',r.quantity,'notes',r.notes,'financial_processing_status',r.financial_processing_status,
    'requested_amount',r.requested_amount,'requested_term',r.requested_term,'requested_term_semantics',r.requested_term_semantics,
    'quoted_amount',r.quoted_amount,'quote_note',r.quote_note,'valid_until',r.valid_until,'responded_at',r.responded_at,
    'created_at',r.created_at,'updated_at',r.updated_at,
    'program_item',case when pi.id is null then null else jsonb_build_object('name',pi.name,'program_key',pi.program_key,'price_cash',pi.price_cash) end,
    'product',case when p.id is null then null else jsonb_build_object('name',p.name,'price',p.price) end,
    'membership',case when m.id is null then null else jsonb_build_object('company_raw',m.company_raw,'concept',m.concept,'amount',m.amount) end,
    'company',case when c.id is null then null else jsonb_build_object('display_name',c.display_name) end
  ))
  from public.program_requests r
  left join public.program_catalog_items pi on pi.id=r.program_item_id
  left join public.marketplace_products p on p.id=r.product_id
  left join public.membership_offerings m on m.id=r.membership_offering_id
  left join public.companies c on c.id=r.company_id
  where r.affiliate_id=v_affiliate_id order by r.created_at desc,r.id desc;
end $$;

revoke all on function public.list_self_program_request_history() from public,anon,authenticated,service_role;
grant execute on function public.list_self_program_request_history() to authenticated;

drop function if exists public.resolve_program_request_workflow_state(uuid);
drop function if exists public.validate_operational_request_tracking();
drop function if exists public.bump_operational_workflow_version_from_stage();
drop function if exists public.bump_operational_workflow_version();
drop function if exists public.validate_operational_workflow_trigger();
drop function if exists public.validate_operational_workflow_configuration(uuid);
drop function if exists public.protect_program_request_workflow_snapshot();
drop function if exists public.capture_program_request_workflow_snapshot();
drop function if exists public.build_program_request_workflow_snapshot(public.program_requests);
drop function if exists public.request_workflow_candidate_keys(public.program_requests);

delete from public.operational_request_tracking
where workflow_id in(
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004'
);

alter table public.program_requests
  drop column if exists workflow_snapshot,
  drop column if exists workflow_version,
  drop column if exists workflow_id;
drop index if exists public.program_requests_workflow_created_idx;

delete from public.operational_workflow_stages
where workflow_id in(
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004'
);
delete from public.operational_workflows
where id in(
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004'
);

drop index if exists public.workflow_stages_enabled_sort_idx;
alter table public.operational_workflow_stages drop column if exists enabled;
alter table public.operational_workflows drop column if exists version;
grant delete on public.operational_workflows,public.operational_workflow_stages to authenticated;

drop function if exists public.audit_operational_workflow_change();
drop table if exists public.operational_workflow_change_audit;

notify pgrst,'reload schema';
commit;
