begin;

-- H-REQUEST-SUBMISSION-CRITICAL-REMEDIATION-001
-- Align the final loan request transaction with ADR-092: bank + (card OR CLABE).
-- No business row is rewritten.
create table public.request_submission_deposit_contract_backup (
  migration_key text primary key check (migration_key='20260903000100'),
  applied_at timestamptz not null default now(),
  previous_writer_definition text not null,
  previous_constraint_definition text not null,
  baseline_request_count bigint not null check (baseline_request_count>=0),
  baseline_snapshot_count bigint not null check (baseline_snapshot_count>=0)
);

alter table public.request_submission_deposit_contract_backup enable row level security;
alter table public.request_submission_deposit_contract_backup force row level security;
revoke all on table public.request_submission_deposit_contract_backup from public,anon,authenticated;

insert into public.request_submission_deposit_contract_backup(
  migration_key,previous_writer_definition,previous_constraint_definition,
  baseline_request_count,baseline_snapshot_count
)
select
  '20260903000100',
  pg_get_functiondef('public.create_validated_financial_program_request_bank_required(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)'::regprocedure),
  pg_get_constraintdef(c.oid,true),
  (select count(*) from public.program_requests),
  (select count(*) from public.loan_request_deposit_snapshots)
from pg_constraint c
where c.conrelid='public.loan_request_deposit_snapshots'::regclass
  and c.conname='loan_deposit_optional_bank_coherence';

do $guard$
declare
  v_definition text;
  v_updated text;
  v_old text:=$old$and card_number ~ '^[0-9]{16}$' and public.is_valid_clabe(clabe)$old$;
  v_new text:=$new$and (card_number ~ '^[0-9]{16}$' or public.is_valid_clabe(clabe))
     and (card_number is null or card_number ~ '^[0-9]{16}$')
     and (clabe is null or public.is_valid_clabe(clabe))$new$;
begin
  select previous_writer_definition into v_definition
  from public.request_submission_deposit_contract_backup
  where migration_key='20260903000100';
  if v_definition is null then raise exception 'REQUEST_SUBMISSION_PREVIOUS_CONTRACT_MISSING'; end if;
  if position(v_old in v_definition)=0 then raise exception 'REQUEST_SUBMISSION_WRITER_PRECONDITION_CHANGED'; end if;
  v_updated:=replace(v_definition,v_old,v_new);
  if v_updated=v_definition or position(v_new in v_updated)=0 then
    raise exception 'REQUEST_SUBMISSION_WRITER_PATCH_FAILED';
  end if;
  execute v_updated;
end $guard$;

alter table public.loan_request_deposit_snapshots
  drop constraint loan_deposit_optional_bank_coherence,
  add constraint loan_deposit_optional_bank_coherence check (
    (source_bank_account_id is null and bank_name is null and account_holder is null
      and card_number is null and clabe is null)
    or
    (source_bank_account_id is not null and bank_name is not null and account_holder is not null
      and (card_number ~ '^[0-9]{16}$' or public.is_valid_clabe(clabe))
      and (card_number is null or card_number ~ '^[0-9]{16}$')
      and (clabe is null or public.is_valid_clabe(clabe)))
  );

create or replace function public.get_request_submission_backend_contract()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_writer text;
  v_constraint text;
  v_ready boolean;
  v_writer_ready boolean;
  v_constraint_ready boolean;
  v_wrapper_ready boolean;
  v_idempotency_ready boolean;
begin
  select pg_get_functiondef(p.oid) into v_writer
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.oid=to_regprocedure(
    'public.create_validated_financial_program_request_bank_required(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)');
  select pg_get_constraintdef(c.oid,true) into v_constraint
  from pg_constraint c
  where c.conrelid='public.loan_request_deposit_snapshots'::regclass
    and c.conname='loan_deposit_optional_bank_coherence';
  v_writer_ready:=coalesce(v_writer like '%card_number is null or card_number ~%'
    and v_writer like '%clabe is null or public.is_valid_clabe(clabe)%',false);
  v_constraint_ready:=coalesce(v_constraint like '%card_number IS NULL OR card_number ~%'
    and v_constraint like '%clabe IS NULL OR%is_valid_clabe(clabe)%',false);
  v_wrapper_ready:=to_regprocedure('public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)') is not null;
  v_idempotency_ready:=exists(
      select 1 from pg_index i
      where i.indrelid='public.program_requests'::regclass and i.indisunique
        and pg_get_indexdef(i.indexrelid) like '%(affiliate_id, idempotency_key)%'
    );
  v_ready:=v_writer_ready and v_constraint_ready and v_wrapper_ready and v_idempotency_ready;
  return jsonb_build_object(
    'contract_version','SUTI_REQUEST_SUBMISSION_V2',
    'ready',v_ready,
    'checks',jsonb_build_object('writer',v_writer_ready,'snapshot',v_constraint_ready,'wrapper',v_wrapper_ready,'idempotency',v_idempotency_ready),
    'writer','create_validated_financial_program_request',
    'edge_action','loanSessionConfirm',
    'deposit_contract','BANK_AND_CARD_OR_CLABE',
    'idempotency_scope','affiliate_id+idempotency_key',
    'response_fields',jsonb_build_array('request_id','folio','status','confirmed_amount','correlation_id')
  );
end $$;

revoke all on function public.get_request_submission_backend_contract() from public,anon,authenticated,service_role;
grant execute on function public.get_request_submission_backend_contract() to anon,authenticated;

comment on function public.get_request_submission_backend_contract() is
  'Non-sensitive deploy guard for the critical request submission backend contract.';

notify pgrst,'reload schema';
commit;
