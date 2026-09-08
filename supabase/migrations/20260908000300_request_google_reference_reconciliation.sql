begin;

-- Transport provenance only; no business decision or source payload is duplicated here.
create table public.program_request_google_reference_audit (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null references public.program_requests(id) on delete restrict,
  old_google_row integer null check(old_google_row is null or old_google_row>1),
  new_google_row integer null check(new_google_row is null or new_google_row>1),
  action text not null check(action in('RELOCATED','TARGET_MISSING','TARGET_RESTORED')),
  actor_kind text not null check(actor_kind in('WORKER','OWNER_RECONCILIATION')),
  revision bigint not null,
  created_at timestamptz not null default now()
);
alter table public.program_request_google_reference_audit enable row level security;
alter table public.program_request_google_reference_audit force row level security;
revoke all on public.program_request_google_reference_audit from public,anon,authenticated,service_role;
grant select on public.program_request_google_reference_audit to service_role;
create index program_request_google_reference_audit_request_idx on public.program_request_google_reference_audit(request_id,created_at);

create or replace function public.finish_program_request_google_sync(p_request_id uuid,p_revision bigint,p_initial_row jsonb,p_google_row integer,p_error_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.program_request_google_sync%rowtype; relocated boolean;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  -- Match the request->outbox order used by status writers to avoid cross-lock deadlocks.
  perform 1 from public.program_requests where id=p_request_id for update;
  select * into s from public.program_request_google_sync where request_id=p_request_id for update;
  if s.request_id is null or p_revision is null or p_revision<1 or p_revision>s.revision then raise exception 'REQUEST_SYNC_REVISION_INVALID' using errcode='22023'; end if;
  if p_initial_row is not null and (jsonb_typeof(p_initial_row)<>'array' or jsonb_array_length(p_initial_row)<>33 or p_initial_row->>0<>p_request_id::text)
  then raise exception 'REQUEST_SYNC_ROW_INVALID' using errcode='22023'; end if;
  if p_error_code is null and (p_google_row is null or p_google_row<=1) then raise exception 'REQUEST_SYNC_RESULT_INVALID' using errcode='22023'; end if;
  if s.initial_row is not null and p_initial_row is distinct from s.initial_row then raise exception 'REQUEST_SYNC_INITIAL_ROW_CHANGED' using errcode='22023'; end if;
  relocated:=s.google_row is not null and p_google_row is not null and p_google_row<>s.google_row;
  if relocated then
    if p_error_code is not null or s.leased_revision is distinct from p_revision or s.revision<>p_revision
      or s.lease_until is null or s.lease_until<now()
    then raise exception 'REQUEST_SYNC_REFERENCE_LEASE_REQUIRED' using errcode='22023'; end if;
    insert into public.program_request_google_reference_audit(request_id,old_google_row,new_google_row,action,actor_kind,revision)
      values(p_request_id,s.google_row,p_google_row,'RELOCATED','WORKER',p_revision);
    update public.program_request_google_sync set google_row=p_google_row where request_id=p_request_id;
    update public.program_requests set legacy_reference='Historial de solicitudes!A'||p_google_row::text
      where id=p_request_id and legacy_reference='Historial de solicitudes!A'||s.google_row::text;
  end if;
  if p_revision<=s.synced_revision then
    -- A manual retry of an already delivered revision must complete its new lease too.
    if s.leased_revision=p_revision and s.revision=p_revision then
      if p_error_code='REQUEST_SYNC_TARGET_MISSING' and s.error_code is distinct from p_error_code then
        insert into public.program_request_google_reference_audit(request_id,old_google_row,new_google_row,action,actor_kind,revision)
          values(p_request_id,s.google_row,null,'TARGET_MISSING','WORKER',p_revision);
      end if;
      if p_error_code is null and s.error_code='REQUEST_SYNC_TARGET_MISSING' then
        insert into public.program_request_google_reference_audit(request_id,old_google_row,new_google_row,action,actor_kind,revision)
          values(p_request_id,s.google_row,p_google_row,'TARGET_RESTORED','WORKER',p_revision);
      end if;
      update public.program_request_google_sync set
        phase=case when p_error_code is null then 'synced' else 'error' end,error_code=left(p_error_code,100),
        lease_until=null,leased_revision=null,next_attempt_at=case when p_error_code is null then now() else now()+interval '15 minutes' end,updated_at=now()
        where request_id=p_request_id;
    end if;
    return public.get_program_request_google_sync(p_request_id);
  end if;
  -- Preserve prior monotonic completion behavior for an expired, superseded delivery.
  if s.leased_revision is distinct from p_revision then
    update public.program_request_google_sync set initial_row=coalesce(initial_row,p_initial_row),google_row=coalesce(google_row,p_google_row),
      synced_revision=case when p_error_code is null then greatest(synced_revision,p_revision) else synced_revision end
      where request_id=p_request_id;
    return public.get_program_request_google_sync(p_request_id);
  end if;
  update public.program_request_google_sync set initial_row=coalesce(initial_row,p_initial_row),
    google_row=coalesce(p_google_row,google_row),synced_revision=case when p_error_code is null then greatest(synced_revision,p_revision) else synced_revision end,
    phase=case when revision<>p_revision then 'pending' when p_error_code is null then 'synced' else 'error' end,
    error_code=case when revision=p_revision then left(p_error_code,100) else null end,
    lease_until=null,leased_revision=null,next_attempt_at=case when revision<>p_revision or p_error_code is null then now() else now()+make_interval(secs=>least(900,15*greatest(attempts,1))) end,
    updated_at=now() where request_id=p_request_id;
  if p_error_code is null and s.revision=p_revision then
    update public.program_requests set financial_processing_status='handed_off',legacy_reference='Historial de solicitudes!A'||p_google_row::text
      where id=p_request_id and program_id='prestamo' and status='approved' and financial_processing_status in('ready_for_handoff','in_progress','failed');
  end if;
  return public.get_program_request_google_sync(p_request_id);
end $$;

commit;
