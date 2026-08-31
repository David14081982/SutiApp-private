begin;

create or replace function public.is_valid_clabe(p_clabe text)
returns boolean
language sql
immutable
strict
set search_path=''
as $$
  select p_clabe ~ '^[0-9]{18}$'
    and (
      10 - (
        (
          (substr(p_clabe,1,1)::integer * 3) + (substr(p_clabe,2,1)::integer * 7) + (substr(p_clabe,3,1)::integer * 1) +
          (substr(p_clabe,4,1)::integer * 3) + (substr(p_clabe,5,1)::integer * 7) + (substr(p_clabe,6,1)::integer * 1) +
          (substr(p_clabe,7,1)::integer * 3) + (substr(p_clabe,8,1)::integer * 7) + (substr(p_clabe,9,1)::integer * 1) +
          (substr(p_clabe,10,1)::integer * 3) + (substr(p_clabe,11,1)::integer * 7) + (substr(p_clabe,12,1)::integer * 1) +
          (substr(p_clabe,13,1)::integer * 3) + (substr(p_clabe,14,1)::integer * 7) + (substr(p_clabe,15,1)::integer * 1) +
          (substr(p_clabe,16,1)::integer * 3) + (substr(p_clabe,17,1)::integer * 7)
        ) % 10
      )
    ) % 10 = substr(p_clabe,18,1)::integer;
$$;

revoke all on function public.is_valid_clabe(text) from public,anon,authenticated;

alter table public.affiliate_bank_accounts
  add column card_number text null,
  drop constraint affiliate_bank_complete_check,
  add constraint affiliate_bank_card_check check(card_number is null or card_number ~ '^[0-9]{16}$'),
  add constraint affiliate_bank_complete_check check(
    (data_status='COMPLETE' and account_holder is not null and bank_name is not null
      and (account_number is not null or card_number is not null) and cardinality(incomplete_fields)=0)
    or (data_status='INCOMPLETE_HISTORICAL_DATA' and source_kind='HISTORICAL_SEED'
      and (bank_name is not null or clabe is not null or account_number is not null))
  );

create unique index affiliate_bank_card_idx
  on public.affiliate_bank_accounts(affiliate_id,card_number)
  where card_number is not null;

alter table public.affiliates
  add column notification_phone text null,
  add constraint affiliates_notification_phone_check
    check(notification_phone is null or notification_phone ~ '^[0-9]{10}$');

comment on column public.affiliate_bank_accounts.card_number is
  'Normalized 16-digit bank card number. It is distinct from account_number and never changes that field semantic.';
comment on column public.affiliates.notification_phone is
  'Current mutable 10-digit notification phone; phone_raw remains imported/historical profile data.';

create table public.loan_request_deposit_snapshots (
  request_id uuid primary key references public.program_requests(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  source_bank_account_id uuid not null,
  bank_name text not null,
  account_holder text not null,
  card_number text not null check(card_number ~ '^[0-9]{16}$'),
  clabe text not null check(public.is_valid_clabe(clabe)),
  notification_phone text not null check(notification_phone ~ '^[0-9]{10}$'),
  created_at timestamptz not null default now()
);

comment on table public.loan_request_deposit_snapshots is
  'Private immutable request-time deposit snapshot. It is not a bank-account authority and has no browser grants.';

create function public.reject_loan_deposit_snapshot_mutation()
returns trigger language plpgsql set search_path=''
as $$ begin
  if tg_op='DELETE' and not exists(select 1 from public.program_requests where id=old.request_id) then return old; end if;
  raise exception 'LOAN_DEPOSIT_SNAPSHOT_IMMUTABLE' using errcode='P0001';
end $$;

create trigger loan_request_deposit_snapshots_immutable
before update or delete on public.loan_request_deposit_snapshots
for each row execute function public.reject_loan_deposit_snapshot_mutation();

alter table public.loan_request_deposit_snapshots enable row level security;
alter table public.loan_request_deposit_snapshots force row level security;
revoke all on table public.loan_request_deposit_snapshots from public,anon,authenticated;

create function public.get_current_notification_phone()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_affiliate public.affiliates%rowtype; v_suggested text;
begin
  if auth.uid() is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  select * into v_affiliate from public.affiliates where id=public.get_effective_affiliate_id();
  if v_affiliate.id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  v_suggested:=regexp_replace(coalesce(v_affiliate.phone_raw,''),'\D','','g');
  if v_suggested !~ '^[0-9]{10}$' then v_suggested:=null; end if;
  return jsonb_build_object(
    'notification_phone',coalesce(v_affiliate.notification_phone,v_suggested),
    'source',case when v_affiliate.notification_phone is not null then 'CURRENT_NOTIFICATION_PHONE'
      when v_suggested is not null then 'HISTORICAL_SUGGESTION' else 'NONE' end
  );
end $$;

create function public.save_current_notification_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_affiliate uuid; v_phone text;
begin
  v_affiliate:=public.get_effective_affiliate_id();
  v_phone:=regexp_replace(coalesce(p_phone,''),'\D','','g');
  if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if v_phone !~ '^[0-9]{10}$' then raise exception 'INVALID_NOTIFICATION_PHONE' using errcode='22023'; end if;
  update public.affiliates set notification_phone=v_phone where id=v_affiliate;
  if not found then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,metadata)
  values(auth.uid(),v_affiliate,'affiliate_notification_phone','NOTIFICATION_PHONE_CONFIRMED',jsonb_build_object('phone_last4',right(v_phone,4)));
  return v_phone;
end $$;

create function public.save_affiliate_deposit_account(p_id uuid,p_bank text,p_card text,p_clabe text)
returns public.affiliate_bank_accounts
language plpgsql
security definer
set search_path=''
as $$
declare v_affiliate public.affiliates%rowtype; v_row public.affiliate_bank_accounts%rowtype; v_action text;
begin
  select * into v_affiliate from public.affiliates where id=public.get_effective_affiliate_id();
  if auth.uid() is null or v_affiliate.id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_bank,''))) not between 2 and 100
     or coalesce(p_card,'') !~ '^[0-9]{16}$'
     or not public.is_valid_clabe(coalesce(p_clabe,'')) then
    raise exception 'INVALID_DEPOSIT_ACCOUNT' using errcode='22023';
  end if;
  if p_id is null then
    if length(btrim(coalesce(v_affiliate.full_name,''))) not between 2 and 160 then
      raise exception 'ACCOUNT_HOLDER_REQUIRED' using errcode='22023';
    end if;
    insert into public.affiliate_bank_accounts(
      affiliate_id,account_holder,bank_name,clabe,account_number,card_number,is_primary,
      data_status,incomplete_fields,source_kind,user_maintained_at
    ) values(
      v_affiliate.id,btrim(v_affiliate.full_name),btrim(p_bank),p_clabe,null,p_card,false,
      'COMPLETE','{}','USER_MAINTAINED',now()
    ) returning * into v_row;
    v_action:='BANK_ACCOUNT_CREATED';
  else
    update public.affiliate_bank_accounts set
      account_holder=coalesce(account_holder,nullif(btrim(v_affiliate.full_name),'')),
      bank_name=btrim(p_bank),clabe=p_clabe,card_number=p_card,
      data_status='COMPLETE',incomplete_fields='{}',user_maintained_at=now(),updated_at=now()
    where id=p_id and affiliate_id=v_affiliate.id returning * into v_row;
    v_action:='BANK_ACCOUNT_UPDATED';
  end if;
  if v_row.id is null then raise exception 'BANK_ACCOUNT_NOT_FOUND' using errcode='P0001'; end if;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_affiliate.id,'affiliate_bank_accounts',v_action,v_row.id,
    jsonb_build_object('has_clabe',true,'has_card',true,'completed_for_deposit',true));
  return v_row;
end $$;

revoke all on function public.get_current_notification_phone(),public.save_current_notification_phone(text),public.save_affiliate_deposit_account(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.get_current_notification_phone(),public.save_current_notification_phone(text),public.save_affiliate_deposit_account(uuid,text,text,text) to authenticated;

alter function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
  rename to create_validated_financial_program_request_pre_deposit;
revoke all on function public.create_validated_financial_program_request_pre_deposit(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) from public,anon,authenticated;

create function public.create_validated_financial_program_request(
  p_actor_real_auth_user_id uuid,
  p_affiliate_id uuid,
  p_impersonation_session_id uuid,
  p_program_item_id uuid,
  p_notes text,
  p_signature_data text,
  p_terms_version_id uuid,
  p_document_ids uuid[],
  p_idempotency_key uuid,
  p_amount numeric,
  p_term integer,
  p_term_semantics text,
  p_expected_profile_version integer,
  p_financial_submission_snapshot jsonb
) returns public.program_requests
language plpgsql security definer set search_path=''
as $$
declare
  v_affiliate public.affiliates%rowtype;
  v_item public.program_catalog_items%rowtype;
  v_ctx public.impersonation_sessions%rowtype;
  v_row public.program_requests%rowtype;
  v_bank public.affiliate_bank_accounts%rowtype;
  v_deposit public.loan_request_deposit_snapshots%rowtype;
  v_submission jsonb;
  v_phone text;
  v_bank_id uuid;
  v_missing integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_actor_real_auth_user_id is null or not exists(select 1 from auth.users where id=p_actor_real_auth_user_id) then
    raise exception 'AUTH_ACTOR_REQUIRED' using errcode='42501';
  end if;
  select * into v_affiliate from public.affiliates where id=p_affiliate_id for update;
  if v_affiliate.id is null or v_affiliate.financial_profile_version<>p_expected_profile_version then
    raise exception 'CONDITIONS_CHANGED' using errcode='40001';
  end if;
  if p_impersonation_session_id is null then
    if v_affiliate.auth_user_id is distinct from p_actor_real_auth_user_id then raise exception 'AFFILIATE_CONTEXT_DENIED' using errcode='42501'; end if;
  else
    select * into v_ctx from public.impersonation_sessions where id=p_impersonation_session_id for share;
    if v_ctx.id is null or v_ctx.actor_real_auth_user_id<>p_actor_real_auth_user_id
       or v_ctx.usuario_contexto_affiliate_id<>p_affiliate_id or v_ctx.ended_at is not null or v_ctx.expires_at<=now()
       or not exists(select 1 from public.admin_assignments a join public.admin_roles r on r.id=a.role_id and r.enabled where a.auth_user_id=p_actor_real_auth_user_id and a.enabled) then
      raise exception 'IMPERSONATION_CONTEXT_INVALID' using errcode='42501';
    end if;
  end if;
  select * into v_item from public.program_catalog_items
   where id=p_program_item_id and program_key='prestamo' and enabled and request_mode='supabase' and legacy_boundary;
  if v_item.id is null then raise exception 'PROGRAM_NOT_REQUESTABLE' using errcode='22023'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023'; end if;
  if nullif(btrim(coalesce(p_signature_data,'')),'') is null then raise exception 'SIGNATURE_AND_TERMS_REQUIRED' using errcode='22023'; end if;
  if p_amount is null or p_amount<=0 or p_term is null or p_term<=0 or length(btrim(coalesce(p_term_semantics,''))) not between 3 and 80 then
    raise exception 'FINANCIAL_REQUEST_TERMS_INVALID' using errcode='22023';
  end if;
  if not exists(select 1 from public.program_terms_versions where id=p_terms_version_id and program_id='prestamo' and membership_offering_id is null and published) then
    raise exception 'TERMS_VERSION_REQUIRED' using errcode='22023';
  end if;
  if p_financial_submission_snapshot is null
     or jsonb_typeof(p_financial_submission_snapshot)<>'object'
     or not(p_financial_submission_snapshot ?& array[
       'affiliate_id','actor_real_auth_user_id','profile_version','profile_fingerprint',
       'criteria_source_fingerprint','term_policy_fingerprint','calculation_contract_version',
       'criterion_identity','financialResult','confirmed_at','deposit_selection'
     ])
     or jsonb_typeof(p_financial_submission_snapshot->'financialResult')<>'object'
     or jsonb_typeof(p_financial_submission_snapshot->'deposit_selection')<>'object'
     or p_financial_submission_snapshot->>'affiliate_id'<>p_affiliate_id::text
     or p_financial_submission_snapshot->>'actor_real_auth_user_id'<>p_actor_real_auth_user_id::text
     or coalesce(p_financial_submission_snapshot->>'impersonation_session_id','')<>coalesce(p_impersonation_session_id::text,'')
     or (p_financial_submission_snapshot->>'profile_version')::integer<>p_expected_profile_version
     or (p_financial_submission_snapshot->'financialResult'->>'amount')::numeric<>p_amount
     or (p_financial_submission_snapshot->'financialResult'->>'paymentCount')::integer<>p_term then
    raise exception 'FINANCIAL_SUBMISSION_CONTRACT_MISMATCH' using errcode='22023';
  end if;
  begin
    v_bank_id:=(p_financial_submission_snapshot->'deposit_selection'->>'bank_account_id')::uuid;
  exception when others then
    raise exception 'INVALID_DEPOSIT_ACCOUNT' using errcode='22023';
  end;
  v_phone:=p_financial_submission_snapshot->'deposit_selection'->>'notification_phone';
  if coalesce(v_phone,'') !~ '^[0-9]{10}$' then raise exception 'INVALID_NOTIFICATION_PHONE' using errcode='22023'; end if;
  select * into v_bank from public.affiliate_bank_accounts
   where id=v_bank_id and affiliate_id=p_affiliate_id and data_status='COMPLETE'
     and card_number ~ '^[0-9]{16}$' and public.is_valid_clabe(clabe)
   for share;
  if v_bank.id is null then raise exception 'DEPOSIT_ACCOUNT_UNAVAILABLE' using errcode='42501'; end if;

  v_submission:=(p_financial_submission_snapshot-'deposit_selection') || jsonb_build_object('deposit',jsonb_build_object(
    'bank_account_id',v_bank.id,'bank_name',v_bank.bank_name,
    'masked_card','•••• '||right(v_bank.card_number,4),
    'masked_clabe','•••• •••• •••• ••'||right(v_bank.clabe,4),
    'masked_phone','••• ••• '||right(v_phone,4)
  ));

  select count(*) into v_missing from public.program_document_requirements r
   where r.program_id='prestamo' and r.membership_offering_id is null and r.enabled and r.required and not exists(
     select 1 from public.affiliate_documents d where d.id=any(coalesce(p_document_ids,array[]::uuid[]))
       and d.affiliate_id=p_affiliate_id and d.document_type_id=r.document_type_id
       and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED'));
  if v_missing>0 then raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023'; end if;

  select * into v_row from public.program_requests where affiliate_id=p_affiliate_id and idempotency_key=p_idempotency_key;
  if v_row.id is not null then
    if v_row.actor_real_auth_user_id<>p_actor_real_auth_user_id or v_row.program_id<>'prestamo'
       or v_row.program_item_id<>p_program_item_id or v_row.requested_amount<>p_amount or v_row.requested_term<>p_term then
      raise exception 'IDEMPOTENCY_CONTRACT_MISMATCH' using errcode='22023';
    end if;
    select * into v_deposit from public.loan_request_deposit_snapshots where request_id=v_row.id;
    if v_deposit.request_id is null or v_deposit.source_bank_account_id<>v_bank.id or v_deposit.notification_phone<>v_phone then
      raise exception 'IDEMPOTENCY_CONTRACT_MISMATCH' using errcode='22023';
    end if;
    return v_row;
  end if;

  insert into public.program_requests(
    actor_real_auth_user_id,affiliate_id,usuario_contexto_affiliate_id,impersonation_session_id,impersonation_reason,
    numero_control,program_id,program_item_id,request_type,status,quantity,notes,signature_data,terms_accepted,
    terms_version_id,source_context,financial_processing_status,idempotency_key,requested_amount,requested_term,
    requested_term_semantics,financial_submission_snapshot
  ) values(
    p_actor_real_auth_user_id,p_affiliate_id,case when v_ctx.id is null then null else p_affiliate_id end,v_ctx.id,v_ctx.reason,
    v_affiliate.numero_control,'prestamo',v_item.id,'quote','requires_financial_processing',1,
    left(nullif(btrim(coalesce(p_notes,'')),''),2000),p_signature_data,true,p_terms_version_id,
    jsonb_build_object('source','sutiapp','financial_confirmation','SUPABASE_REVALIDATED','assisted',v_ctx.id is not null),
    'pending',p_idempotency_key,p_amount,p_term,btrim(p_term_semantics),v_submission
  ) returning * into v_row;

  insert into public.loan_request_deposit_snapshots(
    request_id,affiliate_id,source_bank_account_id,bank_name,account_holder,card_number,clabe,notification_phone
  ) values(
    v_row.id,p_affiliate_id,v_bank.id,v_bank.bank_name,v_bank.account_holder,v_bank.card_number,v_bank.clabe,v_phone
  );
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(p_actor_real_auth_user_id,p_affiliate_id,'program_requests','LOAN_DEPOSIT_SELECTED',v_row.id,
    jsonb_build_object('bank_account_id',v_bank.id,'card_last4',right(v_bank.card_number,4),'clabe_last4',right(v_bank.clabe,4),'phone_last4',right(v_phone,4)));

  insert into public.request_documents(request_id,document_type_id,affiliate_document_id,private_asset_id,asset_sha256,status_at_submission)
  select v_row.id,d.document_type_id,d.id,coalesce(d.private_asset_id,af.private_asset_id),pa.content_sha256,d.status
  from public.affiliate_documents d left join public.affiliate_files af on af.id=d.affiliate_file_id
  join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  where d.id=any(coalesce(p_document_ids,array[]::uuid[])) and d.affiliate_id=p_affiliate_id
    and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
  on conflict(request_id,document_type_id) do nothing;
  return v_row;
exception when unique_violation then
  select * into v_row from public.program_requests where affiliate_id=p_affiliate_id and idempotency_key=p_idempotency_key;
  if v_row.id is not null then
    if v_row.actor_real_auth_user_id<>p_actor_real_auth_user_id or v_row.program_id<>'prestamo'
       or v_row.program_item_id<>p_program_item_id or v_row.requested_amount<>p_amount or v_row.requested_term<>p_term then
      raise exception 'IDEMPOTENCY_CONTRACT_MISMATCH' using errcode='22023';
    end if;
    select * into v_deposit from public.loan_request_deposit_snapshots where request_id=v_row.id;
    if v_deposit.request_id is null or v_deposit.source_bank_account_id<>v_bank.id or v_deposit.notification_phone<>v_phone then
      raise exception 'IDEMPOTENCY_CONTRACT_MISMATCH' using errcode='22023';
    end if;
    return v_row;
  end if;
  raise;
end $$;

revoke all on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
