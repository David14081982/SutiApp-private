begin;

do $$ begin
  if exists(select 1 from public.program_requests where financial_submission_snapshot->>'contract_version'='PROGRAM_PRODUCT_PAYMENT_V1') then
    raise exception 'RECOVERY_BLOCKED_PROGRAM_PRODUCT_PAYMENT_HISTORY_EXISTS';
  end if;
end $$;

delete from public.financial_session_snapshots where session_purpose='PROGRAM_PRODUCT_PAYMENT';

drop function public.approve_program_product_payment_request(uuid,text,uuid);
drop function public.create_validated_program_product_payment_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,integer,date);
drop function public.generate_program_product_payment_schedule(date,text,integer,numeric,numeric);

alter table public.program_requests drop constraint program_requests_financial_status_check;
alter table public.program_requests add constraint program_requests_financial_status_check check (
  financial_processing_status is null or financial_processing_status in
    ('pending','ready_for_handoff','in_progress','handed_off','failed')
);

create or replace function public.capture_document_requirements_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_type text;v_key text;
begin
  if new.document_requirements_snapshot is not null then raise exception 'DOCUMENT_REQUIREMENTS_SNAPSHOT_SERVER_ONLY' using errcode='42501'; end if;
  if new.membership_offering_id is not null then v_type:='MEMBERSHIP';v_key:=new.membership_offering_id::text;
  elsif new.program_id='prestamo' then v_type:='PROGRAM';v_key:='prestamo';
  elsif new.product_id is not null then v_type:='PRODUCT';v_key:=new.product_id::text;
  elsif new.program_item_id is not null then v_type:='PROGRAM';v_key:=new.program_item_id::text;
  else raise exception 'DOCUMENT_SCOPE_NOT_AVAILABLE' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requirement_id',r.requirement_id,'document_type_id',r.document_type_id,'code',r.document_type_code,'label',r.document_type_label,
    'required',r.required,'allow_verified_reuse',r.allow_verified_reuse,'sort_order',r.sort_order,'inherited',r.inherited,
    'source_scope_type',r.source_scope_type,'source_scope_key',r.source_scope_key,'scope_type',v_type,'scope_key',v_key
  ) order by r.sort_order,r.document_type_label),'[]'::jsonb) into new.document_requirements_snapshot
  from public.resolve_effective_document_requirements(v_type,v_key) r;
  return new;
end $$;

drop index public.financial_session_product_context_idx;
alter table public.financial_session_snapshots
  drop constraint financial_session_product_context_check,
  drop constraint financial_session_purpose_check,
  drop column schedule_anchor_date,
  drop column product_fingerprint,
  drop column quote_request_id,
  drop column price_source,
  drop column authorized_price,
  drop column program_item_id,
  drop column session_purpose;

notify pgrst, 'reload schema';
commit;
