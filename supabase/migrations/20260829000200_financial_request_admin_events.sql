begin;

-- Administrative decisions are an immutable audit stream. The request remains
-- authoritative in program_requests; applicant notes are never repurposed as
-- reviewer comments.
create table public.program_request_admin_events (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null references public.program_requests(id) on delete restrict,
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  actor_label text not null check(length(btrim(actor_label)) between 1 and 160),
  action text not null check(action in ('COMMENT','MARK_IN_REVIEW','REJECT','CANCEL','APPROVE')),
  from_status text not null,
  to_status text not null,
  comment text null check(comment is null or length(btrim(comment)) between 3 and 2000),
  client_action_id uuid not null,
  created_at timestamptz not null default now()
);

create unique index program_request_admin_events_client_action_unique
  on public.program_request_admin_events(client_action_id);
create unique index program_request_admin_events_single_approval
  on public.program_request_admin_events(request_id) where action='APPROVE';
create index program_request_admin_events_request_created_idx
  on public.program_request_admin_events(request_id,created_at,id);

alter table public.program_request_admin_events enable row level security;
alter table public.program_request_admin_events force row level security;
revoke all on public.program_request_admin_events from public,anon,authenticated;

create function public.get_program_request_admin_events(p_request_id uuid)
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

create function public.record_program_request_admin_action(
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

-- Four-argument approval keeps the existing certified approval writer as the
-- authority and adds the audit event in the same database transaction.
create function public.approve_financial_program_request(
  p_request_id uuid,
  p_snapshot jsonb,
  p_approved_by uuid,
  p_comment text
) returns public.program_requests language plpgsql security definer set search_path=''
as $$
declare
  v_row public.program_requests%rowtype;
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');
  v_actor_label text;
  v_from_status text;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if v_comment is not null and length(v_comment) not between 3 and 2000 then
    raise exception 'PROGRAM_REQUEST_COMMENT_INVALID' using errcode='22023';
  end if;
  select status into v_from_status from public.program_requests where id=p_request_id for update;
  v_row:=public.approve_financial_program_request(p_request_id,p_snapshot,p_approved_by);
  select coalesce(
    nullif(btrim(raw_user_meta_data->>'display_name'),''),
    nullif(btrim(raw_user_meta_data->>'full_name'),''),
    nullif(btrim(raw_user_meta_data->>'name'),''),
    'Personal autorizado'
  ) into v_actor_label from auth.users where id=p_approved_by;
  insert into public.program_request_admin_events(
    request_id,actor_auth_user_id,actor_label,action,from_status,to_status,comment,client_action_id,created_at
  ) values(
    v_row.id,p_approved_by,left(coalesce(v_actor_label,'Personal autorizado'),160),'APPROVE',coalesce(v_from_status,'in_review'),'approved',
    v_comment,extensions.gen_random_uuid(),coalesce(v_row.financial_approved_at,now())
  ) on conflict(request_id) where action='APPROVE' do nothing;
  return v_row;
end $$;

revoke all on function public.get_program_request_admin_events(uuid) from public,anon;
revoke all on function public.record_program_request_admin_action(uuid,text,text,uuid) from public,anon;
revoke all on function public.approve_financial_program_request(uuid,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.get_program_request_admin_events(uuid) to authenticated;
grant execute on function public.record_program_request_admin_action(uuid,text,text,uuid) to authenticated;
grant execute on function public.approve_financial_program_request(uuid,jsonb,uuid,text) to service_role;

comment on table public.program_request_admin_events is
  'Immutable administrative audit stream; program_requests remains request/status authority and notes remains applicant-authored.';
comment on function public.record_program_request_admin_action(uuid,text,text,uuid) is
  'Permission-gated atomic financial review/comment/reject/cancel writer with idempotency.';

notify pgrst,'reload schema';
commit;
