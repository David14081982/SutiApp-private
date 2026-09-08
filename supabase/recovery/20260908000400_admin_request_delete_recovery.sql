begin;
do $$ begin if exists(select 1 from public.program_request_deletions) then raise exception 'REQUEST_DELETE_HISTORY_MUST_BE_PRESERVED';end if;end $$;
drop trigger request_delete_guard on public.request_documents;
drop trigger request_delete_guard on public.program_request_admin_events;
drop trigger request_delete_guard on public.operational_request_tracking;
drop trigger request_delete_guard on public.loan_request_deposit_snapshots;
drop trigger request_delete_guard on public.program_request_google_sync;
drop trigger request_delete_guard on public.financial_request_export_audit;
drop trigger request_delete_guard on public.program_request_google_reference_audit;
drop trigger request_delete_guard on public.financial_session_snapshots;
drop trigger program_requests_00_deletion_guard on public.program_requests;
CREATE OR REPLACE FUNCTION public.claim_program_request_google_sync(p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.program_request_google_sync%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into s from public.program_request_google_sync
  where (p_request_id is null or request_id=p_request_id) and phase<>'synced'
    and (lease_until is null or lease_until<now()) and next_attempt_at<=now()
  order by next_attempt_at,request_id for update skip locked limit 1;
  if s.request_id is null then return null; end if;
  update public.program_request_google_sync set phase='processing',lease_until=now()+interval '90 seconds',leased_revision=revision,
    attempts=attempts+1,updated_at=now() where request_id=s.request_id returning * into s;
  return to_jsonb(s);
end $function$
;
drop function public.finish_admin_request_delete(uuid),public.record_request_delete_google(uuid,jsonb,boolean),public.prepare_admin_request_delete(uuid,text,timestamptz,text),public.get_admin_request_delete_preview(uuid),public.guard_request_deletion(),public.guard_request_deletion_child();
drop table public.program_request_deletions;
commit;
