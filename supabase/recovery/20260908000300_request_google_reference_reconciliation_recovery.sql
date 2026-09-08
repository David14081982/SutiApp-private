begin;
-- Candidate recovery from committed baseline; live definition must match before application.
-- Preserve reconciliation audit history.
create or replace function public.finish_program_request_google_sync(p_request_id uuid,p_revision bigint,p_initial_row jsonb,p_google_row integer,p_error_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.program_request_google_sync%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into s from public.program_request_google_sync where request_id=p_request_id for update;
  if s.request_id is null or p_revision is null or p_revision<1 or p_revision>s.revision then raise exception 'REQUEST_SYNC_REVISION_INVALID' using errcode='22023'; end if;
  if p_initial_row is not null and (jsonb_typeof(p_initial_row)<>'array' or jsonb_array_length(p_initial_row)<>33 or p_initial_row->>0<>p_request_id::text)
  then raise exception 'REQUEST_SYNC_ROW_INVALID' using errcode='22023'; end if;
  if p_error_code is null and (p_google_row is null or p_google_row<=1) then raise exception 'REQUEST_SYNC_RESULT_INVALID' using errcode='22023'; end if;
  if p_revision<=s.synced_revision then return public.get_program_request_google_sync(p_request_id); end if;
  if s.initial_row is not null and p_initial_row is distinct from s.initial_row then raise exception 'REQUEST_SYNC_INITIAL_ROW_CHANGED' using errcode='22023'; end if;
  if s.google_row is not null and p_google_row is not null and p_google_row<>s.google_row then raise exception 'REQUEST_SYNC_GOOGLE_ROW_CHANGED' using errcode='22023'; end if;
  -- An expired delivery may finish after a newer revision has acquired the lease.
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
