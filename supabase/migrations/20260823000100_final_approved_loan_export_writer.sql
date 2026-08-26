begin;

alter table public.program_requests drop constraint program_requests_financial_status_check;
alter table public.program_requests add constraint program_requests_financial_status_check check (
  financial_processing_status is null or financial_processing_status in
    ('pending','ready_for_handoff','in_progress','handed_off','failed')
);

create table public.financial_request_export_audit (
  program_request_id uuid primary key references public.program_requests(id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  numero_control text not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[A-F0-9]{64}$'),
  export_status text not null check (export_status in ('in_progress','exported','failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  started_at timestamptz not null default now(),
  exported_at timestamptz null,
  google_row integer null check (google_row is null or google_row > 1),
  legacy_reference text null,
  error_code text null,
  error_message text null,
  last_actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_request_export_result_check check (
    (export_status = 'exported' and exported_at is not null and google_row is not null and legacy_reference is not null and error_code is null)
    or (export_status = 'failed' and exported_at is null and google_row is null and legacy_reference is null and error_code is not null)
    or (export_status = 'in_progress' and exported_at is null and google_row is null and legacy_reference is null and error_code is null)
  )
);
create index financial_request_export_audit_status_idx
  on public.financial_request_export_audit(export_status,updated_at desc);

alter table public.financial_request_export_audit enable row level security;
alter table public.financial_request_export_audit force row level security;
revoke all on public.financial_request_export_audit from public,anon,authenticated;
grant select on public.financial_request_export_audit to authenticated;
create policy financial_request_export_audit_admin_read on public.financial_request_export_audit
for select to authenticated using (public.has_admin_permission('program_requests.read'));

create function public.protect_approved_financial_request_state()
returns trigger language plpgsql set search_path=''
as $$ begin
  if old.financial_approval_snapshot is not null and new.status is distinct from old.status then
    raise exception 'APPROVED_FINANCIAL_REQUEST_STATUS_IMMUTABLE' using errcode='P0001';
  end if;
  return new;
end $$;
create trigger program_requests_01_protect_approved_financial_state before update on public.program_requests
for each row execute function public.protect_approved_financial_request_state();

create or replace function public.approve_financial_program_request(p_request_id uuid,p_snapshot jsonb,p_approved_by uuid)
returns public.program_requests language plpgsql security definer set search_path=''
as $$ declare v_row public.program_requests%rowtype; v_required text[]:=array[
  'affiliate_id','numero_control','financial_union','financial_employee_category','affiliation_status','fund','rate','term',
  'maxAmount','requestedAmount','administrativeFee','financialResult','google_export'];
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_row from public.program_requests where id=p_request_id for update;
  if v_row.id is null or v_row.financial_processing_status is null then raise exception 'FINANCIAL_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  if v_row.financial_approval_snapshot is not null then return v_row; end if;
  if v_row.status not in ('requires_financial_processing','in_review') then raise exception 'FINANCIAL_REQUEST_NOT_APPROVABLE' using errcode='P0001'; end if;
  if jsonb_typeof(p_snapshot)<>'object' or exists(select 1 from unnest(v_required) k where not(p_snapshot?k)) then raise exception 'FINANCIAL_APPROVAL_SNAPSHOT_INCOMPLETE' using errcode='22023'; end if;
  if p_snapshot->>'affiliate_id'<>v_row.affiliate_id::text or p_snapshot->>'numero_control'<>v_row.numero_control then raise exception 'FINANCIAL_SNAPSHOT_IDENTITY_MISMATCH' using errcode='22023'; end if;
  if jsonb_typeof(p_snapshot->'administrativeFee')<>'object' or not((p_snapshot->'administrativeFee')?'rule') or not((p_snapshot->'administrativeFee')?'version') then raise exception 'ADMINISTRATIVE_FEE_CONTRACT_INCOMPLETE' using errcode='22023'; end if;
  if jsonb_typeof(p_snapshot->'google_export')<>'object' or jsonb_typeof(p_snapshot->'google_export'->'row')<>'array'
     or jsonb_array_length(p_snapshot->'google_export'->'row')<>38
     or p_snapshot->'google_export'->>'contract_version'<>'FINAL_APPROVED_LOAN_EXPORT_V1'
  then raise exception 'GOOGLE_EXPORT_CONTRACT_INCOMPLETE' using errcode='22023'; end if;
  if p_approved_by is null or not exists(select 1 from auth.users where id=p_approved_by) then raise exception 'APPROVAL_ACTOR_REQUIRED' using errcode='22023'; end if;
  update public.program_requests set status='approved',financial_processing_status='ready_for_handoff',financial_approval_snapshot=p_snapshot,
    financial_approved_at=now(),financial_approved_by=p_approved_by,updated_at=now() where id=p_request_id returning * into v_row;
  return v_row;
end $$;

create function public.begin_financial_request_export(p_request_id uuid,p_payload_sha256 text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_request public.program_requests%rowtype; v_audit public.financial_request_export_audit%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_payload_sha256 !~ '^[A-F0-9]{64}$' then raise exception 'EXPORT_HASH_INVALID' using errcode='22023'; end if;
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'EXPORT_ACTOR_REQUIRED' using errcode='22023'; end if;
  select * into v_request from public.program_requests where id=p_request_id for update;
  if v_request.id is null or v_request.financial_processing_status is null then raise exception 'FINANCIAL_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  select * into v_audit from public.financial_request_export_audit where program_request_id=p_request_id for update;
  if v_request.financial_processing_status='handed_off' and v_audit.export_status='exported' then
    return jsonb_build_object('idempotent',true,'google_row',v_audit.google_row,'legacy_reference',v_audit.legacy_reference);
  end if;
  if v_request.status<>'approved' or v_request.financial_approval_snapshot is null
     or v_request.financial_processing_status not in ('ready_for_handoff','in_progress','failed')
  then raise exception 'APPROVED_PENDING_EXPORT_REQUIRED' using errcode='P0001'; end if;
  if v_audit.program_request_id is not null and v_audit.payload_sha256<>p_payload_sha256 then raise exception 'EXPORT_PAYLOAD_HASH_MISMATCH' using errcode='22023'; end if;
  insert into public.financial_request_export_audit(program_request_id,affiliate_id,numero_control,approved_by,approved_at,payload_sha256,
    export_status,attempt_count,started_at,last_actor_auth_user_id)
  values(v_request.id,v_request.affiliate_id,v_request.numero_control,v_request.financial_approved_by,v_request.financial_approved_at,
    p_payload_sha256,'in_progress',1,now(),p_actor)
  on conflict(program_request_id) do update set export_status='in_progress',attempt_count=public.financial_request_export_audit.attempt_count+1,
    started_at=now(),error_code=null,error_message=null,last_actor_auth_user_id=excluded.last_actor_auth_user_id,updated_at=now();
  update public.program_requests set financial_processing_status='in_progress',updated_at=now() where id=p_request_id;
  return jsonb_build_object('idempotent',false,'resumed',v_request.financial_processing_status='in_progress');
end $$;

create function public.complete_financial_request_export(p_request_id uuid,p_payload_sha256 text,p_google_row integer,p_legacy_reference text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_request public.program_requests%rowtype; v_audit public.financial_request_export_audit%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_request from public.program_requests where id=p_request_id for update;
  select * into v_audit from public.financial_request_export_audit where program_request_id=p_request_id for update;
  if v_request.financial_processing_status='handed_off' and v_audit.export_status='exported' then
    if v_audit.payload_sha256<>p_payload_sha256 then raise exception 'EXPORT_PAYLOAD_HASH_MISMATCH' using errcode='22023'; end if;
    return jsonb_build_object('idempotent',true,'google_row',v_audit.google_row,'legacy_reference',v_audit.legacy_reference);
  end if;
  if v_request.status<>'approved' or v_request.financial_processing_status<>'in_progress' or v_audit.export_status<>'in_progress'
     or v_audit.payload_sha256<>p_payload_sha256 then raise exception 'EXPORT_COMPLETION_STATE_INVALID' using errcode='P0001'; end if;
  if p_google_row<=1 or btrim(coalesce(p_legacy_reference,''))<>('Historial de solicitudes!A'||p_google_row::text)
     or p_actor is null then raise exception 'EXPORT_RESULT_INVALID' using errcode='22023'; end if;
  update public.program_requests set financial_processing_status='handed_off',legacy_reference=p_legacy_reference,updated_at=now() where id=p_request_id;
  update public.financial_request_export_audit set export_status='exported',exported_at=now(),google_row=p_google_row,
    legacy_reference=p_legacy_reference,error_code=null,error_message=null,last_actor_auth_user_id=p_actor,updated_at=now()
  where program_request_id=p_request_id;
  return jsonb_build_object('idempotent',false,'google_row',p_google_row,'legacy_reference',p_legacy_reference);
end $$;

create function public.fail_financial_request_export(p_request_id uuid,p_payload_sha256 text,p_error_code text,p_error_message text,p_actor uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_error_code,''))) not between 3 and 100 then raise exception 'EXPORT_ERROR_CODE_INVALID' using errcode='22023'; end if;
  update public.program_requests set financial_processing_status='failed',updated_at=now()
  where id=p_request_id and status='approved' and financial_processing_status='in_progress';
  update public.financial_request_export_audit set export_status='failed',error_code=btrim(p_error_code),
    error_message=left(btrim(coalesce(p_error_message,'')),500),last_actor_auth_user_id=p_actor,updated_at=now()
  where program_request_id=p_request_id and payload_sha256=p_payload_sha256 and export_status='in_progress';
end $$;

grant execute on function public.begin_financial_request_export(uuid,text,uuid) to service_role;
grant execute on function public.complete_financial_request_export(uuid,text,integer,text,uuid) to service_role;
grant execute on function public.fail_financial_request_export(uuid,text,text,text,uuid) to service_role;
revoke execute on function public.begin_financial_request_export(uuid,text,uuid) from public,anon,authenticated;
revoke execute on function public.complete_financial_request_export(uuid,text,integer,text,uuid) from public,anon,authenticated;
revoke execute on function public.fail_financial_request_export(uuid,text,text,text,uuid) from public,anon,authenticated;

comment on table public.financial_request_export_audit is 'Immutable-identity audit and recovery state for the one-row approved-loan Google projection.';
comment on function public.begin_financial_request_export(uuid,text,uuid) is 'Service-only serialized state transition; Google UUID registry remains the external idempotency authority.';

notify pgrst, 'reload schema';
commit;
