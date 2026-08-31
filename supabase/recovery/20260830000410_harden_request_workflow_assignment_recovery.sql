begin;

create or replace function public.validate_operational_workflow_configuration(p_workflow_id uuid)
returns void language plpgsql stable security definer set search_path=''
as $$
declare v_enabled boolean;v_keys text[];
begin
  select enabled,service_keys into v_enabled,v_keys from public.operational_workflows where id=p_workflow_id;
  if not found or not v_enabled then return; end if;
  if cardinality(v_keys)=0 then raise exception 'WORKFLOW_SERVICE_REQUIRED' using errcode='22023'; end if;
  if not exists(select 1 from public.operational_workflow_stages where workflow_id=p_workflow_id and enabled) then
    raise exception 'WORKFLOW_STAGE_REQUIRED' using errcode='22023';
  end if;
  if exists(
    select 1 from public.operational_workflow_stages s cross join lateral regexp_split_to_table(coalesce(s.status_reference,''),'\s*,\s*') token
    where s.workflow_id=p_workflow_id and s.enabled and token<>'' and token not in('submitted','in_review','approved','rejected','cancelled','requires_financial_processing')
  ) then raise exception 'WORKFLOW_STATUS_REFERENCE_INVALID' using errcode='22023'; end if;
  if exists(
    select 1 from public.operational_workflow_stages a join public.operational_workflow_stages b
      on b.workflow_id=a.workflow_id and b.id>a.id and b.enabled and a.enabled and b.sort_order=a.sort_order
      and (cardinality(a.service_keys)=0 or cardinality(b.service_keys)=0 or a.service_keys&&b.service_keys)
    where a.workflow_id=p_workflow_id
  ) then raise exception 'WORKFLOW_STAGE_ORDER_CONFLICT' using errcode='22023'; end if;
  if exists(
    select 1 from public.operational_workflow_stages a join public.operational_workflow_stages b
      on b.workflow_id=a.workflow_id and b.id>a.id and b.enabled and a.enabled
      and (cardinality(a.service_keys)=0 or cardinality(b.service_keys)=0 or a.service_keys&&b.service_keys)
      and string_to_array(replace(coalesce(a.status_reference,''),' ',''),',')&&string_to_array(replace(coalesce(b.status_reference,''),' ',''),',')
    where a.workflow_id=p_workflow_id and coalesce(a.status_reference,'')<>'' and coalesce(b.status_reference,'')<>''
  ) then raise exception 'WORKFLOW_STATUS_REFERENCE_CONFLICT' using errcode='22023'; end if;
end $$;

comment on function public.validate_operational_workflow_configuration(uuid) is null;

notify pgrst,'reload schema';
commit;
