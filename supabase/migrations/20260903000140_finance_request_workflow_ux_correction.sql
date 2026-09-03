begin;

-- H-FINANCE-REQUESTS-FLOW-UX-CORRECTION-001
-- Requests keep one status authority and one immutable workflow snapshot. This
-- change adds an atomic operational transition boundary and least-privilege
-- Admin projections; it does not rewrite any historical snapshot.

-- Membership and program semantics must win before type fallbacks. Specific
-- configured UUID/program/company keys still rank first.
create or replace function public.request_workflow_candidate_keys(p_request public.program_requests)
returns table(service_key text,priority integer)
language sql immutable set search_path=''
as $$
  select candidate.service_key,min(candidate.priority)::integer
  from (values
    (p_request.membership_offering_id::text,1),('membership:'||p_request.membership_offering_id::text,2),
    (p_request.product_id::text,3),('product:'||p_request.product_id::text,4),
    (p_request.program_item_id::text,5),('program-item:'||p_request.program_item_id::text,6),
    (p_request.company_id::text,7),('company:'||p_request.company_id::text,8),
    (nullif(btrim(p_request.program_id),''),20),('program:'||nullif(btrim(p_request.program_id),''),21),
    (case when p_request.membership_offering_id is not null then 'request:membership' end,90),
    (case when p_request.membership_offering_id is null and p_request.program_id='prestamo' then 'request:loan' end,91),
    (case when p_request.membership_offering_id is null and p_request.request_type='quote' and p_request.program_id<>'prestamo' then 'request:quote' end,92),
    (case when p_request.membership_offering_id is null and p_request.request_type<>'quote' and p_request.program_id<>'prestamo' then 'request:benefit' end,93)
  ) candidate(service_key,priority)
  where candidate.service_key is not null and candidate.service_key<>''
  group by candidate.service_key
$$;

alter table public.program_request_admin_events
  add column from_stage_id uuid null references public.operational_workflow_stages(id) on delete restrict,
  add column to_stage_id uuid null references public.operational_workflow_stages(id) on delete restrict;

alter table public.program_request_admin_events
  drop constraint program_request_admin_events_action_check,
  add constraint program_request_admin_events_action_check
    check(action in ('COMMENT','MARK_IN_REVIEW','REJECT','CANCEL','APPROVE','ADVANCE_STAGE'));

-- A tracking override can only point at a stage compatible with the canonical
-- request status. This prevents the old Admin tracking editor from presenting a
-- success stage while the request remains pending (or the inverse).
create or replace function public.validate_operational_request_tracking()
returns trigger language plpgsql security definer set search_path=''
as $$
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
      coalesce(v_stage->>'outcome','process')='process' and v_status in('submitted','in_review','requires_financial_processing') or
      coalesce(v_stage->>'outcome','process')='success' and v_status='approved' or
      coalesce(v_stage->>'outcome','process')='failure' and v_status in('rejected','cancelled')
    ) then raise exception 'REQUEST_TRACKING_STATUS_MISMATCH' using errcode='22023'; end if;
  end if;
  if exists(select 1 from jsonb_object_keys(coalesce(new.stage_dates,'{}'::jsonb)) key where not exists(select 1 from jsonb_array_elements(v_snapshot->'stages') s where s->>'id'=key)) then
    raise exception 'REQUEST_TRACKING_DATE_STAGE_MISMATCH' using errcode='22023';
  end if;
  return new;
end $$;

-- Every new request receives tracking continuously. Every writer that changes
-- status (loan Edge, product approval, quote response or Admin decision) moves
-- the same tracking row in the same transaction, so Admin and self projections
-- cannot diverge.
create function public.sync_program_request_tracking_from_status()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_stage jsonb;v_first jsonb;v_dates jsonb;v_at timestamptz;
begin
  select s into v_stage from jsonb_array_elements(new.workflow_snapshot->'stages') s
  where s->'status_references'?new.status
    and (case when new.status in('rejected','cancelled') then s->>'outcome'<>'success' else s->>'outcome'<>'failure' end)
  order by (s->>'sort_order')::integer,s->>'id' limit 1;
  if v_stage is null then raise exception 'REQUEST_WORKFLOW_STATUS_UNMAPPED' using errcode='22023'; end if;
  select s into v_first from jsonb_array_elements(new.workflow_snapshot->'stages') s
    order by (s->>'sort_order')::integer,s->>'id' limit 1;
  select coalesce(stage_dates,'{}'::jsonb) into v_dates from public.operational_request_tracking where request_id=new.id;
  v_dates:=coalesce(v_dates,'{}'::jsonb);
  if coalesce((v_first->>'captures_date')::boolean,false) and not(v_dates?(v_first->>'id')) then
    v_dates:=v_dates||jsonb_build_object(v_first->>'id',new.created_at);
  end if;
  v_at:=case when tg_op='INSERT' then new.created_at else now() end;
  if coalesce((v_stage->>'captures_date')::boolean,false) and not(v_dates?(v_stage->>'id')) then
    v_dates:=v_dates||jsonb_build_object(v_stage->>'id',v_at);
  end if;
  perform set_config('app.workflow_change_reason',case when tg_op='INSERT' then 'Alta de solicitud' else 'Estado de solicitud: '||old.status||' -> '||new.status end,true);
  insert into public.operational_request_tracking(request_id,workflow_id,current_stage_id,stage_dates)
  values(new.id,new.workflow_id,(v_stage->>'id')::uuid,v_dates)
  on conflict(request_id) do update set workflow_id=excluded.workflow_id,current_stage_id=excluded.current_stage_id,stage_dates=excluded.stage_dates;
  return new;
end $$;

create trigger program_requests_sync_workflow_tracking
after insert or update of status on public.program_requests
for each row execute function public.sync_program_request_tracking_from_status();

-- Existing rows are not rewritten. Their immutable snapshots remain the exact
-- flow applied at submission and the central resolver continues to project them.

create or replace function public.record_program_request_admin_action(
  p_request_id uuid,p_action text,p_comment text,p_client_action_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_request public.program_requests%rowtype;v_existing public.program_request_admin_events%rowtype;
  v_event public.program_request_admin_events%rowtype;v_action text:=upper(btrim(coalesce(p_action,'')));
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');v_to_status text;v_actor_label text;
  v_from_stage uuid;v_to_stage uuid;
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.write') then raise exception 'PROGRAM_REQUEST_WRITE_DENIED' using errcode='42501'; end if;
  if p_client_action_id is null then raise exception 'CLIENT_ACTION_ID_REQUIRED' using errcode='22023'; end if;
  if v_action not in('COMMENT','MARK_IN_REVIEW','REJECT','CANCEL') then raise exception 'PROGRAM_REQUEST_ACTION_INVALID' using errcode='22023'; end if;
  if v_comment is not null and length(v_comment) not between 3 and 2000 then raise exception 'PROGRAM_REQUEST_COMMENT_INVALID' using errcode='22023'; end if;
  if v_action in('COMMENT','REJECT','CANCEL') and v_comment is null then raise exception 'PROGRAM_REQUEST_COMMENT_REQUIRED' using errcode='22023'; end if;
  select * into v_existing from public.program_request_admin_events where client_action_id=p_client_action_id;
  if v_existing.id is not null then
    if v_existing.request_id<>p_request_id or v_existing.actor_auth_user_id<>auth.uid() or v_existing.action<>v_action then raise exception 'CLIENT_ACTION_ID_CONFLICT' using errcode='23505'; end if;
    return to_jsonb(v_existing)-'actor_auth_user_id'-'client_action_id';
  end if;
  select * into v_request from public.program_requests where id=p_request_id for update;
  if v_request.id is null then raise exception 'PROGRAM_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  if v_action<>'COMMENT' and (v_request.financial_approval_snapshot is not null or v_request.status='approved') then raise exception 'APPROVED_FINANCIAL_REQUEST_STATUS_IMMUTABLE' using errcode='P0001'; end if;
  v_from_stage:=nullif(public.resolve_program_request_workflow_state(v_request.id)->>'current_stage_id','')::uuid;
  v_to_status:=v_request.status;
  if v_action='MARK_IN_REVIEW' then
    if v_request.status not in('submitted','requires_financial_processing') then raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001'; end if;
    v_to_status:='in_review';
  elsif v_action='REJECT' then
    if v_request.status not in('submitted','requires_financial_processing','in_review') then raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001'; end if;
    v_to_status:='rejected';
  elsif v_action='CANCEL' then
    if v_request.status not in('submitted','requires_financial_processing','in_review') then raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001'; end if;
    v_to_status:='cancelled';
  end if;
  select coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),nullif(btrim(raw_user_meta_data->>'full_name'),''),nullif(btrim(raw_user_meta_data->>'name'),''),'Personal autorizado') into v_actor_label from auth.users where id=auth.uid();
  if v_to_status is distinct from v_request.status then update public.program_requests set status=v_to_status,updated_at=now() where id=v_request.id; end if;
  v_to_stage:=nullif(public.resolve_program_request_workflow_state(v_request.id)->>'current_stage_id','')::uuid;
  insert into public.program_request_admin_events(request_id,actor_auth_user_id,actor_label,action,from_status,to_status,comment,client_action_id,from_stage_id,to_stage_id)
  values(v_request.id,auth.uid(),left(coalesce(v_actor_label,'Personal autorizado'),160),v_action,v_request.status,v_to_status,v_comment,p_client_action_id,v_from_stage,v_to_stage)
  returning * into v_event;
  return to_jsonb(v_event)-'actor_auth_user_id'-'client_action_id';
end $$;

create or replace function public.get_program_request_admin_events(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
  if not public.has_admin_permission('program_requests.read') then
    raise exception 'PROGRAM_REQUEST_READ_DENIED' using errcode='42501';
  end if;
  if not exists(select 1 from public.program_requests where id=p_request_id) then
    raise exception 'REQUEST_NOT_FOUND' using errcode='P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id',e.id,'request_id',e.request_id,'action',e.action,'from_status',e.from_status,
    'to_status',e.to_status,'comment',e.comment,'actor_label',e.actor_label,'created_at',e.created_at,
    'from_stage_id',e.from_stage_id,'to_stage_id',e.to_stage_id,
    'from_stage_label',(select s->>'label' from jsonb_array_elements(r.workflow_snapshot->'stages') s where s->>'id'=e.from_stage_id::text),
    'to_stage_label',(select s->>'label' from jsonb_array_elements(r.workflow_snapshot->'stages') s where s->>'id'=e.to_stage_id::text)
  )) order by e.created_at,e.id),'[]'::jsonb) into v_result
  from public.program_request_admin_events e
  join public.program_requests r on r.id=e.request_id
  where e.request_id=p_request_id;
  return v_result;
end $$;

create function public.list_admin_finance_request_flow_queue()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_rows jsonb;
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.read') then
    raise exception 'PROGRAM_REQUEST_READ_DENIED' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(q.payload order by q.created_at desc,q.id desc),'[]'::jsonb) into v_rows
  from (
    select r.id,r.created_at,jsonb_strip_nulls(jsonb_build_object(
      'id',r.id,'folio',r.folio,'affiliate_id',r.affiliate_id,'numero_control',r.numero_control,
      'program_id',r.program_id,'program_item_id',r.program_item_id,'product_id',r.product_id,
      'membership_offering_id',r.membership_offering_id,'company_id',r.company_id,'request_type',r.request_type,
      'status',r.status,'financial_processing_status',r.financial_processing_status,
      'requested_amount',r.requested_amount,'requested_term',r.requested_term,'requested_term_semantics',r.requested_term_semantics,
      'quoted_amount',r.quoted_amount,'created_at',r.created_at,'updated_at',r.updated_at,
      'affiliate',jsonb_build_object('full_name',a.full_name,'display_name',a.display_name,'numero_control',a.numero_control),
      'program_item',case when pi.id is null then null else jsonb_build_object('name',pi.name,'program_key',pi.program_key,'price_cash',pi.price_cash) end,
      'product',case when p.id is null then null else jsonb_build_object('name',p.name,'price',p.price) end,
      'membership',case when m.id is null then null else jsonb_build_object('company_raw',m.company_raw,'concept',m.concept,'amount',m.amount) end,
      'company',case when c.id is null then null else jsonb_build_object('display_name',c.display_name) end,
      'workflow_state',public.resolve_program_request_workflow_state(r.id)
    )) payload
    from public.program_requests r
    join public.affiliates a on a.id=r.affiliate_id
    left join public.program_catalog_items pi on pi.id=r.program_item_id
    left join public.marketplace_products p on p.id=r.product_id
    left join public.membership_offerings m on m.id=r.membership_offering_id
    left join public.companies c on c.id=r.company_id
    order by r.created_at desc,r.id desc limit 250
  ) q;
  return v_rows;
end $$;

create function public.get_admin_finance_request_flow_detail(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
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
end $$;

create function public.transition_program_request_workflow(
  p_request_id uuid,p_action text,p_comment text,p_client_action_id uuid,
  p_quote_amount numeric default null,p_quote_valid_until date default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_request public.program_requests%rowtype;v_existing public.program_request_admin_events%rowtype;
  v_event public.program_request_admin_events%rowtype;v_state jsonb;v_current jsonb;v_target jsonb;v_first jsonb;
  v_action text:=upper(btrim(coalesce(p_action,'')));v_event_action text;v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');
  v_to_status text;v_actor_label text;v_dates jsonb;v_expected_existing text[];
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.write') then
    raise exception 'PROGRAM_REQUEST_WRITE_DENIED' using errcode='42501';
  end if;
  if p_client_action_id is null then raise exception 'CLIENT_ACTION_ID_REQUIRED' using errcode='22023'; end if;
  if v_action not in('ADVANCE','REJECT') then raise exception 'PROGRAM_REQUEST_WORKFLOW_ACTION_INVALID' using errcode='22023'; end if;
  if v_comment is not null and length(v_comment) not between 3 and 2000 then raise exception 'PROGRAM_REQUEST_COMMENT_INVALID' using errcode='22023'; end if;
  if v_action='REJECT' and v_comment is null then raise exception 'PROGRAM_REQUEST_COMMENT_REQUIRED' using errcode='22023'; end if;

  select * into v_existing from public.program_request_admin_events where client_action_id=p_client_action_id;
  if v_existing.id is not null then
    v_expected_existing:=case when v_action='REJECT' then array['REJECT'] else array['APPROVE','ADVANCE_STAGE'] end;
    if v_existing.request_id<>p_request_id or v_existing.actor_auth_user_id<>auth.uid() or not(v_existing.action=any(v_expected_existing)) then
      raise exception 'CLIENT_ACTION_ID_CONFLICT' using errcode='23505';
    end if;
    return jsonb_build_object('idempotent',true,'event',to_jsonb(v_existing)-'actor_auth_user_id'-'client_action_id',
      'workflow_state',public.resolve_program_request_workflow_state(p_request_id));
  end if;

  select * into v_request from public.program_requests where id=p_request_id for update;
  if v_request.id is null then raise exception 'PROGRAM_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  v_state:=public.resolve_program_request_workflow_state(v_request.id);
  if not coalesce((v_state->>'available')::boolean,false) then raise exception 'REQUEST_WORKFLOW_UNAVAILABLE' using errcode='P0001'; end if;
  v_current:=v_state->'current_stage';
  if v_current is null then raise exception 'REQUEST_WORKFLOW_CURRENT_STAGE_MISSING' using errcode='P0001'; end if;

  if v_action='REJECT' then
    if v_request.status in('approved','rejected','cancelled') then raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001'; end if;
    select s into v_target from jsonb_array_elements(v_request.workflow_snapshot->'stages') s
      where s->>'outcome'='failure' and s->'status_references'?'rejected'
      order by (s->>'sort_order')::integer,s->>'id' limit 1;
    if v_target is null then raise exception 'REQUEST_WORKFLOW_REJECT_STAGE_MISSING' using errcode='P0001'; end if;
    v_to_status:='rejected';v_event_action:='REJECT';
  else
    if v_request.status in('rejected','cancelled') then raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001'; end if;
    select s into v_target from jsonb_array_elements(v_state->'stages') s
      where (s->>'sort_order')::integer>(v_current->>'sort_order')::integer and s->>'outcome'<>'failure'
      order by (s->>'sort_order')::integer,s->>'id' limit 1;
    if v_target is null then raise exception 'REQUEST_WORKFLOW_ALREADY_COMPLETE' using errcode='P0001'; end if;
    v_to_status:=v_request.status;
    if v_target->'status_references'?'approved' then
      if v_request.financial_processing_status is not null then
        raise exception 'SPECIALIZED_FINANCIAL_APPROVAL_REQUIRED' using errcode='P0001';
      elsif v_request.request_type='quote' then
        if p_quote_amount is null or p_quote_amount<=0 then raise exception 'QUOTE_AMOUNT_REQUIRED' using errcode='22023'; end if;
      end if;
      v_to_status:='approved';v_event_action:='APPROVE';
    elsif v_target->'status_references'?'in_review' and v_request.status in('submitted','requires_financial_processing') then
      v_to_status:='in_review';v_event_action:='ADVANCE_STAGE';
    else v_event_action:='ADVANCE_STAGE'; end if;
  end if;

  select coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),nullif(btrim(raw_user_meta_data->>'full_name'),''),
    nullif(btrim(raw_user_meta_data->>'name'),''),'Personal autorizado') into v_actor_label from auth.users where id=auth.uid();
  perform set_config('app.workflow_change_reason',coalesce(v_comment,case when v_action='REJECT' then 'Rechazo de etapa' else 'Avance de etapa' end),true);

  if v_to_status is distinct from v_request.status then
    if v_request.request_type='quote' and v_to_status='approved' then
      update public.program_requests set status='approved',quoted_amount=round(p_quote_amount,2),quote_note=v_comment,
        valid_until=coalesce(p_quote_valid_until,current_date+15),responded_by_auth_user_id=auth.uid(),responded_at=now(),seen_at=null,updated_at=now()
      where id=v_request.id;
    else
      update public.program_requests set status=v_to_status,updated_at=now() where id=v_request.id;
    end if;
  else
    select coalesce(stage_dates,'{}'::jsonb) into v_dates from public.operational_request_tracking where request_id=v_request.id;
    v_dates:=coalesce(v_dates,'{}'::jsonb);
    select s into v_first from jsonb_array_elements(v_request.workflow_snapshot->'stages') s order by (s->>'sort_order')::integer,s->>'id' limit 1;
    if coalesce((v_first->>'captures_date')::boolean,false) and not(v_dates?(v_first->>'id')) then v_dates:=v_dates||jsonb_build_object(v_first->>'id',v_request.created_at); end if;
    if coalesce((v_target->>'captures_date')::boolean,false) and not(v_dates?(v_target->>'id')) then v_dates:=v_dates||jsonb_build_object(v_target->>'id',now()); end if;
    insert into public.operational_request_tracking(request_id,workflow_id,current_stage_id,stage_dates)
      values(v_request.id,v_request.workflow_id,(v_target->>'id')::uuid,v_dates)
      on conflict(request_id) do update set workflow_id=excluded.workflow_id,current_stage_id=excluded.current_stage_id,stage_dates=excluded.stage_dates;
  end if;

  insert into public.program_request_admin_events(
    request_id,actor_auth_user_id,actor_label,action,from_status,to_status,comment,client_action_id,from_stage_id,to_stage_id
  ) values(v_request.id,auth.uid(),left(coalesce(v_actor_label,'Personal autorizado'),160),v_event_action,v_request.status,v_to_status,
    v_comment,p_client_action_id,(v_current->>'id')::uuid,(v_target->>'id')::uuid) returning * into v_event;
  return jsonb_build_object('idempotent',false,'event',to_jsonb(v_event)-'actor_auth_user_id'-'client_action_id',
    'workflow_state',public.resolve_program_request_workflow_state(v_request.id));
end $$;

revoke all on function public.sync_program_request_tracking_from_status() from public,anon,authenticated,service_role;
revoke all on function public.list_admin_finance_request_flow_queue(),public.get_admin_finance_request_flow_detail(uuid),
  public.transition_program_request_workflow(uuid,text,text,uuid,numeric,date) from public,anon,authenticated,service_role;
grant execute on function public.list_admin_finance_request_flow_queue(),public.get_admin_finance_request_flow_detail(uuid),
  public.transition_program_request_workflow(uuid,text,text,uuid,numeric,date) to authenticated;

comment on function public.transition_program_request_workflow(uuid,text,text,uuid,numeric,date) is
  'Atomic, idempotent Admin transition over the immutable per-request workflow snapshot; specialized financial approvals remain in their certified writers.';
comment on function public.list_admin_finance_request_flow_queue() is
  'Unified workflow-aware request queue for program_requests.read administrators; no global workflow configuration, secrets or full financial snapshot.';

notify pgrst,'reload schema';
commit;
