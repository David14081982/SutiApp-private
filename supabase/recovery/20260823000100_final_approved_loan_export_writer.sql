begin;

do $$ begin
  if exists(select 1 from public.financial_request_export_audit where export_status='exported') then
    raise exception 'RECOVERY_BLOCKED_EXPORTED_GOOGLE_ROWS_REQUIRE_OWNER_RECONCILIATION';
  end if;
end $$;

drop function if exists public.fail_financial_request_export(uuid,text,text,text,uuid);
drop function if exists public.complete_financial_request_export(uuid,text,integer,text,uuid);
drop function if exists public.begin_financial_request_export(uuid,text,uuid);
drop trigger if exists program_requests_01_protect_approved_financial_state on public.program_requests;
drop function if exists public.protect_approved_financial_request_state();
drop table public.financial_request_export_audit;

update public.program_requests set financial_processing_status='ready_for_handoff',updated_at=now()
where financial_processing_status='in_progress';
alter table public.program_requests drop constraint program_requests_financial_status_check;
alter table public.program_requests add constraint program_requests_financial_status_check check (
  financial_processing_status is null or financial_processing_status in ('pending','ready_for_handoff','handed_off','failed')
);

create or replace function public.approve_financial_program_request(p_request_id uuid,p_snapshot jsonb,p_approved_by uuid)
returns public.program_requests language plpgsql security definer set search_path=''
as $$ declare v_row public.program_requests%rowtype; v_required text[]:=array[
  'affiliate_id','numero_control','financial_union','financial_employee_category','affiliation_status','fund','rate','term','maxAmount','requestedAmount','administrativeFee','financialResult'];
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_row from public.program_requests where id=p_request_id for update;
  if v_row.id is null or v_row.financial_processing_status is null then raise exception 'FINANCIAL_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  if v_row.financial_approval_snapshot is not null then return v_row; end if;
  if jsonb_typeof(p_snapshot)<>'object' or exists(select 1 from unnest(v_required) k where not(p_snapshot?k)) then raise exception 'FINANCIAL_APPROVAL_SNAPSHOT_INCOMPLETE' using errcode='22023'; end if;
  if p_snapshot->>'affiliate_id'<>v_row.affiliate_id::text or p_snapshot->>'numero_control'<>v_row.numero_control then raise exception 'FINANCIAL_SNAPSHOT_IDENTITY_MISMATCH' using errcode='22023'; end if;
  if jsonb_typeof(p_snapshot->'administrativeFee')<>'object' or not((p_snapshot->'administrativeFee')?'rule') or not((p_snapshot->'administrativeFee')?'version') then raise exception 'ADMINISTRATIVE_FEE_CONTRACT_INCOMPLETE' using errcode='22023'; end if;
  if p_approved_by is null or not exists(select 1 from auth.users where id=p_approved_by) then raise exception 'APPROVAL_ACTOR_REQUIRED' using errcode='22023'; end if;
  update public.program_requests set status='approved',financial_processing_status='pending',financial_approval_snapshot=p_snapshot,
    financial_approved_at=now(),financial_approved_by=p_approved_by,updated_at=now() where id=p_request_id returning * into v_row;
  return v_row;
end $$;

notify pgrst, 'reload schema';
commit;
