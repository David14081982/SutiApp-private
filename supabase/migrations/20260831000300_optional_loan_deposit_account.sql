begin;

alter table public.loan_request_deposit_snapshots
  alter column source_bank_account_id drop not null,
  alter column bank_name drop not null,
  alter column account_holder drop not null,
  alter column card_number drop not null,
  alter column clabe drop not null,
  add constraint loan_deposit_optional_bank_coherence check (
    (source_bank_account_id is null and bank_name is null and account_holder is null and card_number is null and clabe is null)
    or
    (source_bank_account_id is not null and bank_name is not null and account_holder is not null
      and card_number ~ '^[0-9]{16}$' and public.is_valid_clabe(clabe))
  );

alter function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
  rename to create_validated_financial_program_request_bank_required;
revoke all on function public.create_validated_financial_program_request_bank_required(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
  from public,anon,authenticated,service_role;

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
  v_deposit public.loan_request_deposit_snapshots%rowtype;
  v_submission jsonb;
  v_phone text;
  v_bank_text text;
  v_missing integer;
begin
  v_bank_text:=nullif(btrim(coalesce(p_financial_submission_snapshot->'deposit_selection'->>'bank_account_id','')),'');
  if v_bank_text is not null then
    return public.create_validated_financial_program_request_bank_required(
      p_actor_real_auth_user_id,p_affiliate_id,p_impersonation_session_id,p_program_item_id,p_notes,
      p_signature_data,p_terms_version_id,p_document_ids,p_idempotency_key,p_amount,p_term,
      p_term_semantics,p_expected_profile_version,p_financial_submission_snapshot
    );
  end if;

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
     or nullif(btrim(coalesce(p_financial_submission_snapshot->'deposit_selection'->>'bank_account_id','')),'') is not null
     or p_financial_submission_snapshot->>'affiliate_id'<>p_affiliate_id::text
     or p_financial_submission_snapshot->>'actor_real_auth_user_id'<>p_actor_real_auth_user_id::text
     or coalesce(p_financial_submission_snapshot->>'impersonation_session_id','')<>coalesce(p_impersonation_session_id::text,'')
     or (p_financial_submission_snapshot->>'profile_version')::integer<>p_expected_profile_version
     or (p_financial_submission_snapshot->'financialResult'->>'amount')::numeric<>p_amount
     or (p_financial_submission_snapshot->'financialResult'->>'paymentCount')::integer<>p_term then
    raise exception 'FINANCIAL_SUBMISSION_CONTRACT_MISMATCH' using errcode='22023';
  end if;
  v_phone:=p_financial_submission_snapshot->'deposit_selection'->>'notification_phone';
  if coalesce(v_phone,'') !~ '^[0-9]{10}$' then raise exception 'INVALID_NOTIFICATION_PHONE' using errcode='22023'; end if;

  v_submission:=(p_financial_submission_snapshot-'deposit_selection') || jsonb_build_object('deposit',jsonb_build_object(
    'bank_account_id',null,'bank_name',null,'masked_card',null,'masked_clabe',null,
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
    if v_deposit.request_id is null or v_deposit.source_bank_account_id is not null or v_deposit.notification_phone<>v_phone then
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

  insert into public.loan_request_deposit_snapshots(request_id,affiliate_id,notification_phone)
  values(v_row.id,p_affiliate_id,v_phone);
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(p_actor_real_auth_user_id,p_affiliate_id,'program_requests','LOAN_DEPOSIT_CONFIRMED',v_row.id,
    jsonb_build_object('has_bank_account',false,'phone_last4',right(v_phone,4)));

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
    if v_deposit.request_id is null or v_deposit.source_bank_account_id is not null or v_deposit.notification_phone<>v_phone then
      raise exception 'IDEMPOTENCY_CONTRACT_MISMATCH' using errcode='22023';
    end if;
    return v_row;
  end if;
  raise;
end $$;

revoke all on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
  from public,anon,authenticated;
grant execute on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
  to service_role;

comment on table public.loan_request_deposit_snapshots is
  'Private immutable request-time notification/deposit snapshot. Bank data is optional by owner rule; when present it is complete and authoritative.';

notify pgrst, 'reload schema';
commit;
