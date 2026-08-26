begin;

-- Owner-authorized, derived and expiring cache. Google remains authoritative.
create table public.financial_session_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  actor_real_auth_user_id uuid not null references auth.users(id) on delete cascade,
  impersonation_session_id uuid null references public.impersonation_sessions(id) on delete cascade,
  financial_profile_version integer not null check(financial_profile_version >= 0),
  profile_fingerprint text not null check(profile_fingerprint ~ '^[A-F0-9]{64}$'),
  eligible_rules jsonb not null check(jsonb_typeof(eligible_rules)='array' and jsonb_array_length(eligible_rules) between 1 and 146),
  criteria_source_fingerprint text not null check(criteria_source_fingerprint ~ '^[A-F0-9]{64}$'),
  term_policy_fingerprint text not null check(term_policy_fingerprint ~ '^[A-F0-9]{64}$'),
  calculation_contract_version text not null check(length(btrim(calculation_contract_version)) between 3 and 100),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '15 minutes'),
  invalidated_at timestamptz null,
  invalidation_reason text null,
  constraint financial_session_snapshot_ttl_check check(expires_at>created_at and expires_at<=created_at+interval '15 minutes'),
  constraint financial_session_snapshot_invalidation_check check(
    (invalidated_at is null and invalidation_reason is null)
    or (invalidated_at is not null and invalidated_at>=created_at and length(btrim(invalidation_reason)) between 3 and 100)
  )
);

create index financial_session_snapshots_active_context_idx
on public.financial_session_snapshots(affiliate_id,actor_real_auth_user_id,expires_at desc)
where invalidated_at is null;
create index financial_session_snapshots_expiry_idx on public.financial_session_snapshots(expires_at);

alter table public.financial_session_snapshots enable row level security;
alter table public.financial_session_snapshots force row level security;
revoke all on public.financial_session_snapshots from public,anon,authenticated;
grant select,insert,update,delete on public.financial_session_snapshots to service_role;

comment on table public.financial_session_snapshots is
  'Derived, personalized, server-generated Suti Prestamo cache. Never a financial authority or global catalog; hard TTL 15 minutes.';
comment on column public.financial_session_snapshots.eligible_rules is
  'Only Google-derived rules matched to the effective affiliate before persistence.';

-- A confirmed request owns an immutable contractual submission snapshot. It never
-- depends on the expiring session cache for historical reconstruction.
alter table public.program_requests
  add column financial_submission_snapshot jsonb null
  check(financial_submission_snapshot is null or jsonb_typeof(financial_submission_snapshot)='object');

create function public.enforce_personalized_financial_submission()
returns trigger language plpgsql set search_path=''
as $$ begin
  if tg_op='INSERT' and new.program_id='prestamo' then
    if coalesce(auth.role(),'')<>'service_role' then
      raise exception 'FINANCIAL_CONFIRMATION_REQUIRED' using errcode='42501';
    end if;
    if new.financial_submission_snapshot is null
       or not(new.financial_submission_snapshot?'financialResult')
       or not(new.financial_submission_snapshot?'criteria_source_fingerprint')
       or not(new.financial_submission_snapshot?'profile_fingerprint')
       or not(new.financial_submission_snapshot?'confirmed_at') then
      raise exception 'FINANCIAL_SUBMISSION_SNAPSHOT_REQUIRED' using errcode='22023';
    end if;
  elsif tg_op='UPDATE' and new.financial_submission_snapshot is distinct from old.financial_submission_snapshot then
    raise exception 'FINANCIAL_SUBMISSION_SNAPSHOT_IMMUTABLE' using errcode='P0001';
  end if;
  return new;
end $$;

create trigger program_requests_02_personalized_financial_submission
before insert or update on public.program_requests
for each row execute function public.enforce_personalized_financial_submission();

-- Service-only transaction boundary called by financial-legacy after it has
-- re-read Google, recalculated the quote and bound the request to the JWT context.
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
       'criterion_identity','financialResult','confirmed_at'
     ])
     or jsonb_typeof(p_financial_submission_snapshot->'financialResult')<>'object'
     or p_financial_submission_snapshot->>'affiliate_id'<>p_affiliate_id::text
     or p_financial_submission_snapshot->>'actor_real_auth_user_id'<>p_actor_real_auth_user_id::text
     or coalesce(p_financial_submission_snapshot->>'impersonation_session_id','')<>coalesce(p_impersonation_session_id::text,'')
     or (p_financial_submission_snapshot->>'profile_version')::integer<>p_expected_profile_version
     or (p_financial_submission_snapshot->'financialResult'->>'amount')::numeric<>p_amount
     or (p_financial_submission_snapshot->'financialResult'->>'paymentCount')::integer<>p_term then
    raise exception 'FINANCIAL_SUBMISSION_CONTRACT_MISMATCH' using errcode='22023';
  end if;
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
    jsonb_build_object('source','sutiapp','financial_confirmation','GOOGLE_REVALIDATED','assisted',v_ctx.id is not null),
    'pending',p_idempotency_key,p_amount,p_term,btrim(p_term_semantics),p_financial_submission_snapshot
  ) returning * into v_row;

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
    return v_row;
  end if;
  raise;
end $$;

revoke execute on function public.set_financial_program_request_terms(uuid,numeric,numeric,text) from authenticated;
revoke all on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) to service_role;

comment on column public.program_requests.financial_submission_snapshot is
  'Immutable request-time contract recalculated from current Google rules; independent from the expiring session snapshot.';

notify pgrst, 'reload schema';
commit;
