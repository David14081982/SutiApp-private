begin;

create table public.loan_deposit_validation_migration_backup (
  migration_key text primary key check (migration_key='20260901000100'),
  applied_at timestamptz not null default now(),
  previous_writer_definition text not null,
  previous_constraint_definition text not null,
  baseline_account_count bigint not null check (baseline_account_count>=0)
);

alter table public.loan_deposit_validation_migration_backup enable row level security;
alter table public.loan_deposit_validation_migration_backup force row level security;
revoke all on table public.loan_deposit_validation_migration_backup from public,anon,authenticated;

insert into public.loan_deposit_validation_migration_backup(
  migration_key,previous_writer_definition,previous_constraint_definition,baseline_account_count
)
select
  '20260901000100',
  pg_get_functiondef('public.save_affiliate_deposit_account(uuid,text,text,text)'::regprocedure),
  pg_get_constraintdef(c.oid,true),
  (select count(*) from public.affiliate_bank_accounts)
from pg_constraint c
where c.conrelid='public.affiliate_bank_accounts'::regclass
  and c.conname='affiliate_bank_complete_check';

do $$ begin
  if not exists(select 1 from public.loan_deposit_validation_migration_backup where migration_key='20260901000100') then
    raise exception 'LOAN_DEPOSIT_PREVIOUS_CONTRACT_MISSING';
  end if;
end $$;

alter table public.affiliate_bank_accounts
  drop constraint affiliate_bank_complete_check,
  add constraint affiliate_bank_complete_check check(
    (data_status='COMPLETE' and account_holder is not null and bank_name is not null
      and (account_number is not null or card_number is not null or clabe is not null)
      and cardinality(incomplete_fields)=0)
    or (data_status='INCOMPLETE_HISTORICAL_DATA' and source_kind='HISTORICAL_SEED'
      and (bank_name is not null or clabe is not null or account_number is not null))
  );

create or replace function public.save_affiliate_deposit_account(p_id uuid,p_bank text,p_card text,p_clabe text)
returns public.affiliate_bank_accounts
language plpgsql
security definer
set search_path=''
as $$
declare
  v_affiliate public.affiliates%rowtype;
  v_row public.affiliate_bank_accounts%rowtype;
  v_action text;
  v_bank text:=btrim(coalesce(p_bank,''));
  v_card text:=nullif(btrim(coalesce(p_card,'')),'');
  v_clabe text:=nullif(btrim(coalesce(p_clabe,'')),'');
begin
  select * into v_affiliate from public.affiliates where id=public.get_effective_affiliate_id();
  if auth.uid() is null or v_affiliate.id is null then
    raise exception 'AFFILIATE_REQUIRED' using errcode='42501';
  end if;
  if length(v_bank) not between 2 and 100 then
    raise exception 'INVALID_DEPOSIT_BANK' using errcode='22023';
  end if;
  if v_card is null and v_clabe is null then
    raise exception 'DEPOSIT_INSTRUMENT_REQUIRED' using errcode='22023';
  end if;
  if v_card is not null and v_card !~ '^[0-9]{16}$' then
    raise exception 'INVALID_DEPOSIT_CARD' using errcode='22023';
  end if;
  if v_clabe is not null and not public.is_valid_clabe(v_clabe) then
    raise exception 'INVALID_DEPOSIT_CLABE' using errcode='22023';
  end if;
  if length(btrim(coalesce(v_affiliate.full_name,''))) not between 2 and 160 then
    raise exception 'ACCOUNT_HOLDER_REQUIRED' using errcode='22023';
  end if;

  if p_id is null then
    insert into public.affiliate_bank_accounts(
      affiliate_id,account_holder,bank_name,clabe,account_number,card_number,is_primary,
      data_status,incomplete_fields,source_kind,user_maintained_at
    ) values(
      v_affiliate.id,btrim(v_affiliate.full_name),v_bank,v_clabe,null,v_card,false,
      'COMPLETE','{}','USER_MAINTAINED',now()
    ) returning * into v_row;
    v_action:='BANK_ACCOUNT_CREATED';
  else
    update public.affiliate_bank_accounts set
      account_holder=btrim(v_affiliate.full_name),bank_name=v_bank,clabe=v_clabe,card_number=v_card,
      data_status='COMPLETE',incomplete_fields='{}',user_maintained_at=now(),updated_at=now()
    where id=p_id and affiliate_id=v_affiliate.id returning * into v_row;
    v_action:='BANK_ACCOUNT_UPDATED';
  end if;
  if v_row.id is null then
    raise exception 'BANK_ACCOUNT_NOT_FOUND' using errcode='P0001';
  end if;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_affiliate.id,'affiliate_bank_accounts',v_action,v_row.id,
    jsonb_build_object(
      'has_clabe',v_clabe is not null,
      'has_card',v_card is not null,
      'completed_for_deposit',true
    ));
  return v_row;
end $$;

revoke all on function public.save_affiliate_deposit_account(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.save_affiliate_deposit_account(uuid,text,text,text) to authenticated;

comment on function public.save_affiliate_deposit_account(uuid,text,text,text) is
  'Self-service deposit account writer. Requires bank plus a valid 16-digit card or valid CLABE; when both are supplied both are validated.';

notify pgrst, 'reload schema';
commit;
