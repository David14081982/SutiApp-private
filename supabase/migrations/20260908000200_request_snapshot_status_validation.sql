begin;
-- Honor the explicit approved mapping in the immutable snapshot, including v16 process stages.
CREATE OR REPLACE FUNCTION public.resolve_program_request_workflow_state(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.program_requests%rowtype;t public.operational_request_tracking%rowtype;v_stages jsonb;v_current text;v_current_order integer;v_current_stage jsonb;v_resolved jsonb;
begin
  select * into r from public.program_requests where id=p_request_id;
  if r.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  if coalesce(auth.role(),'')<>'service_role' and not coalesce(
    auth.uid() is not null and (r.affiliate_id=public.get_effective_affiliate_id() or public.has_admin_permission('workflow.read') or public.has_admin_permission('program_requests.read'))
  ,false) then raise exception 'REQUEST_WORKFLOW_DENIED' using errcode='42501'; end if;
  if r.workflow_snapshot is null then return jsonb_build_object('available',false,'reason','WORKFLOW_SNAPSHOT_MISSING','message','Seguimiento no disponible'); end if;
  select * into t from public.operational_request_tracking where request_id=r.id;
  select coalesce(jsonb_agg(stage order by (stage->>'sort_order')::integer,stage->>'id'),'[]'::jsonb) into v_stages
  from jsonb_array_elements(r.workflow_snapshot->'stages') stage
  where case when r.status in('rejected','cancelled') then stage->>'outcome'<>'success' else stage->>'outcome'<>'failure' end;
  if t.current_stage_id is not null and exists(select 1 from jsonb_array_elements(v_stages) stage where stage->>'id'=t.current_stage_id::text) then
    v_current:=t.current_stage_id::text;
  else
    select stage->>'id' into v_current from jsonb_array_elements(v_stages) stage
    where stage->'status_references'?r.status order by (stage->>'sort_order')::integer,stage->>'id' limit 1;
  end if;
  if v_current is null then return jsonb_build_object('available',false,'reason','WORKFLOW_STATUS_UNMAPPED','message','Seguimiento no disponible'); end if;
  select (stage->>'sort_order')::integer,stage into v_current_order,v_current_stage from jsonb_array_elements(v_stages) stage where stage->>'id'=v_current;
  select coalesce(jsonb_agg(
    stage||jsonb_build_object(
      'state',case
        when stage->>'id'=v_current and r.status in('approved','rejected','cancelled') and (stage->>'outcome' in('success','failure') or (r.status='approved' and stage->'status_references'?'approved')) then 'done'
        when (stage->>'sort_order')::integer<v_current_order and (r.status not in('rejected','cancelled') or t.stage_dates?(stage->>'id') or exists(select 1 from public.program_request_admin_events e where e.request_id=r.id and e.action<>'COMMENT' and (e.from_stage_id::text=stage->>'id' or e.to_stage_id::text=stage->>'id'))) then 'done'
        when stage->>'id'=v_current then 'current' else 'upcoming' end,
      'date',coalesce((select min(e.created_at)::text from public.program_request_admin_events e
        where e.request_id=r.id and e.action='MARK_IN_REVIEW' and e.to_stage_id::text=stage->>'id'),t.stage_dates->>(stage->>'id'))
    ) order by (stage->>'sort_order')::integer,stage->>'id'
  ),'[]'::jsonb) into v_resolved from jsonb_array_elements(v_stages) stage;
  return jsonb_strip_nulls(jsonb_build_object(
    'available',true,'workflow_id',r.workflow_id,'workflow_version',r.workflow_version,
    'workflow_name',r.workflow_snapshot->>'workflow_name','workflow_description',r.workflow_snapshot->>'workflow_description',
    'can_reject',r.status not in('approved','rejected','cancelled') and exists(select 1 from jsonb_array_elements(r.workflow_snapshot->'stages') s where s->>'outcome'='failure' and s->'status_references'?'rejected'),
    'can_quote',r.request_type='quote' and r.program_id<>'prestamo' and r.financial_submission_snapshot is null and r.requested_amount is null and r.financial_approval_snapshot is null,
    'request_status',r.status,'current_stage_id',v_current,'current_stage',v_current_stage,
    'active_note',nullif(v_current_stage->>'description',''),'stages',v_resolved
  ));
end $function$;

CREATE OR REPLACE FUNCTION public.validate_operational_request_tracking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_snapshot jsonb;v_status text;v_stage jsonb;
begin
  select workflow_snapshot,status into v_snapshot,v_status from public.program_requests where id=new.request_id;
  if v_snapshot is null or (v_snapshot->>'workflow_id')::uuid is distinct from new.workflow_id then
    raise exception 'REQUEST_TRACKING_WORKFLOW_MISMATCH' using errcode='22023';
  end if;
  if new.current_stage_id is not null then
    select s into v_stage from jsonb_array_elements(v_snapshot->'stages') s where (s->>'id')::uuid=new.current_stage_id;
    if v_stage is null then raise exception 'REQUEST_TRACKING_STAGE_MISMATCH' using errcode='22023'; end if;
    if not (
      coalesce(v_stage->>'outcome','process')='process' and (v_status in('submitted','in_review','requires_financial_processing') or (v_status='approved' and v_stage->'status_references'?'approved')) or
      coalesce(v_stage->>'outcome','process')='success' and v_status='approved' or
      coalesce(v_stage->>'outcome','process')='failure' and v_status in('rejected','cancelled')
    ) then raise exception 'REQUEST_TRACKING_STATUS_MISMATCH' using errcode='22023'; end if;
  end if;
  if exists(select 1 from jsonb_object_keys(coalesce(new.stage_dates,'{}'::jsonb)) key where not exists(select 1 from jsonb_array_elements(v_snapshot->'stages') s where s->>'id'=key)) then
    raise exception 'REQUEST_TRACKING_DATE_STAGE_MISMATCH' using errcode='22023';
  end if;
  return new;
end $function$;
notify pgrst,'reload schema';
commit;
