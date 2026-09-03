begin;

do $$
begin
  if exists(select 1 from public.program_request_admin_events where action='ADVANCE_STAGE' or from_stage_id is not null or to_stage_id is not null) then
    raise exception 'RECOVERY_BLOCKED_REQUEST_WORKFLOW_TRANSITION_HISTORY_EXISTS';
  end if;
end $$;

drop trigger if exists program_requests_sync_workflow_tracking on public.program_requests;
drop function if exists public.sync_program_request_tracking_from_status();
drop function if exists public.transition_program_request_workflow(uuid,text,text,uuid,numeric,date);
drop function if exists public.list_admin_finance_request_flow_queue();
drop function if exists public.get_admin_finance_request_flow_detail(uuid);

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
    (case when p_request.financial_processing_status is not null or p_request.status='requires_financial_processing' or p_request.requested_amount is not null then 'request:loan' end,90),
    (case when p_request.membership_offering_id is not null then 'request:membership' end,91),
    (case when p_request.membership_offering_id is null and p_request.request_type='quote' then 'request:quote' end,92),
    (case when p_request.membership_offering_id is null and p_request.request_type<>'quote' then 'request:benefit' end,93)
  ) candidate(service_key,priority)
  where candidate.service_key is not null and candidate.service_key<>''
  group by candidate.service_key
$$;

create or replace function public.validate_operational_request_tracking()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_snapshot jsonb;
begin
  select workflow_snapshot into v_snapshot from public.program_requests where id=new.request_id;
  if v_snapshot is null or (v_snapshot->>'workflow_id')::uuid is distinct from new.workflow_id then
    raise exception 'REQUEST_TRACKING_WORKFLOW_MISMATCH' using errcode='22023';
  end if;
  if new.current_stage_id is not null and not exists(select 1 from jsonb_array_elements(v_snapshot->'stages') s where (s->>'id')::uuid=new.current_stage_id) then
    raise exception 'REQUEST_TRACKING_STAGE_MISMATCH' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(coalesce(new.stage_dates,'{}'::jsonb)) key where not exists(select 1 from jsonb_array_elements(v_snapshot->'stages') s where s->>'id'=key)) then
    raise exception 'REQUEST_TRACKING_DATE_STAGE_MISMATCH' using errcode='22023';
  end if;
  return new;
end $$;

create or replace function public.record_program_request_admin_action(
  p_request_id uuid,
  p_action text,
  p_comment text,
  p_client_action_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_request public.program_requests%rowtype;
  v_existing public.program_request_admin_events%rowtype;
  v_event public.program_request_admin_events%rowtype;
  v_action text:=upper(btrim(coalesce(p_action,'')));
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');
  v_to_status text;
  v_actor_label text;
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.write') then
    raise exception 'PROGRAM_REQUEST_WRITE_DENIED' using errcode='42501';
  end if;
  if p_client_action_id is null then raise exception 'CLIENT_ACTION_ID_REQUIRED' using errcode='22023'; end if;
  if v_action not in ('COMMENT','MARK_IN_REVIEW','REJECT','CANCEL') then
    raise exception 'PROGRAM_REQUEST_ACTION_INVALID' using errcode='22023';
  end if;
  if v_comment is not null and length(v_comment) not between 3 and 2000 then
    raise exception 'PROGRAM_REQUEST_COMMENT_INVALID' using errcode='22023';
  end if;
  if v_action in ('COMMENT','REJECT','CANCEL') and v_comment is null then
    raise exception 'PROGRAM_REQUEST_COMMENT_REQUIRED' using errcode='22023';
  end if;

  select * into v_existing from public.program_request_admin_events where client_action_id=p_client_action_id;
  if v_existing.id is not null then
    if v_existing.request_id<>p_request_id or v_existing.actor_auth_user_id<>auth.uid() or v_existing.action<>v_action then
      raise exception 'CLIENT_ACTION_ID_CONFLICT' using errcode='23505';
    end if;
    return to_jsonb(v_existing)-'actor_auth_user_id'-'client_action_id';
  end if;

  select * into v_request from public.program_requests where id=p_request_id for update;
  if v_request.id is null or v_request.financial_processing_status is null then
    raise exception 'FINANCIAL_REQUEST_NOT_FOUND' using errcode='P0001';
  end if;
  if v_action<>'COMMENT' and (v_request.financial_approval_snapshot is not null or v_request.status='approved') then
    raise exception 'APPROVED_FINANCIAL_REQUEST_STATUS_IMMUTABLE' using errcode='P0001';
  end if;

  v_to_status:=v_request.status;
  if v_action='MARK_IN_REVIEW' then
    if v_request.status not in ('submitted','requires_financial_processing') then
      raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001';
    end if;
    v_to_status:='in_review';
  elsif v_action='REJECT' then
    if v_request.status not in ('submitted','requires_financial_processing','in_review') then
      raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001';
    end if;
    v_to_status:='rejected';
  elsif v_action='CANCEL' then
    if v_request.status not in ('submitted','requires_financial_processing','in_review') then
      raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001';
    end if;
    v_to_status:='cancelled';
  end if;

  select coalesce(
    nullif(btrim(raw_user_meta_data->>'display_name'),''),
    nullif(btrim(raw_user_meta_data->>'full_name'),''),
    nullif(btrim(raw_user_meta_data->>'name'),''),
    'Personal autorizado'
  ) into v_actor_label from auth.users where id=auth.uid();

  if v_to_status is distinct from v_request.status then
    update public.program_requests set status=v_to_status,updated_at=now() where id=v_request.id;
  end if;
  insert into public.program_request_admin_events(
    request_id,actor_auth_user_id,actor_label,action,from_status,to_status,comment,client_action_id
  ) values(
    v_request.id,auth.uid(),left(coalesce(v_actor_label,'Personal autorizado'),160),v_action,
    v_request.status,v_to_status,v_comment,p_client_action_id
  ) returning * into v_event;
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
  if not exists(select 1 from public.program_requests where id=p_request_id and financial_processing_status is not null) then
    raise exception 'FINANCIAL_REQUEST_NOT_FOUND' using errcode='P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'request_id',e.request_id,'action',e.action,'from_status',e.from_status,
    'to_status',e.to_status,'comment',e.comment,'actor_label',e.actor_label,'created_at',e.created_at
  ) order by e.created_at,e.id),'[]'::jsonb) into v_result
  from public.program_request_admin_events e where e.request_id=p_request_id;
  return v_result;
end $$;

alter table public.program_request_admin_events
  drop constraint program_request_admin_events_action_check,
  add constraint program_request_admin_events_action_check
    check(action in ('COMMENT','MARK_IN_REVIEW','REJECT','CANCEL','APPROVE'));
alter table public.program_request_admin_events
  drop column to_stage_id,
  drop column from_stage_id;

notify pgrst,'reload schema';
commit;
