begin;

-- Owner: membership amounts already include $15 per payment; never add it again.
-- Additive membership-only contract. No catalog/rule/history/workflow updates.
create function public.membership_payment_contract(p_affiliate_id uuid,p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare a public.affiliates%rowtype;o public.membership_offerings%rowtype;
  v_period text;v_process text;v_fee numeric;v_regular numeric;v_last numeric;v_result jsonb;v_quote jsonb;
begin
  select * into a from public.affiliates where id=p_affiliate_id and not is_archived;
  if a.id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501';end if;
  select * into o from public.membership_offerings where id=p_offering_id and enabled;
  if o.id is null then raise exception 'MEMBERSHIP_UNAVAILABLE' using errcode='22023';end if;
  v_process:=case a.financial_employee_category_code
    when 'BASE' then '1' when 'EVENTUALES' then '1' when 'SUPLENTES_FIJOS' then '1'
    when 'SUPLENTES_VARIABLES' then '3' when 'JUBILADOS_PENSIONADOS' then 'JUB'
    when 'CONFIANZA' then 'Confianza' else null end;
  if v_process is null then raise exception 'MEMBERSHIP_PAYROLL_CATEGORY_UNRESOLVED' using errcode='22023';end if;
  v_period:=case when v_process='JUB' then 'mensual' else 'quincenal' end;
  v_fee:=15*o.installments;
  if o.amount<v_fee then raise exception 'MEMBERSHIP_INCLUDED_FEES_EXCEED_TOTAL' using errcode='22023';end if;
  v_regular:=round(o.amount/o.installments,2);
  v_last:=round(o.amount-v_regular*(o.installments-1),2);
  v_result:=jsonb_build_object(
    'source','SUPABASE_MEMBERSHIP_OFFERING','fund','Vales y membresias','program','membership',
    'amount',o.amount,'total',o.amount,'rate',0,'interest',0,'ratePeriod',v_period,
    'paymentCount',o.installments,'paymentPeriod',v_period,'paymentPerPeriod',v_regular,
    'lastPayment',v_last,'administrativeFeePerPayment',15,'administrativeFeeTotal',v_fee,
    'administrativeFeeIncluded',true,'capital',o.amount-v_fee,
    'administrativeFeeRule','$15 incluidos por pago','administrativeFeeVersion','MEMBERSHIP_INCLUDED_15_V1');
  v_quote:=jsonb_build_object('contract_version','MEMBERSHIP_PAYMENT_V1',
    'affiliate_id',a.id,'membership_offering_id',o.id,'profile_version',a.financial_profile_version,
    'category_code',a.financial_employee_category_code,'process',v_process,
    'source_updated_at',o.updated_at,'financialResult',v_result,
    'offering',jsonb_build_object('id',o.id,'company',o.company_raw,'concept',o.concept,'amount',o.amount,'installments',o.installments));
  return v_quote||jsonb_build_object('quote_hash',encode(extensions.digest(convert_to(v_quote::text,'UTF8'),'sha256'),'hex'));
end $$;
revoke all on function public.membership_payment_contract(uuid,uuid) from public,anon,authenticated,service_role;

create function public.get_current_membership_payment_quote(p_membership_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_affiliate uuid:=public.get_effective_affiliate_id();begin
  if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501';end if;
  return public.membership_payment_contract(v_affiliate,p_membership_offering_id);
end $$;
revoke all on function public.get_current_membership_payment_quote(uuid) from public,anon;
grant execute on function public.get_current_membership_payment_quote(uuid) to authenticated;

-- Captures every NEW membership, including calls through the existing seven-argument RPC.
-- WHEN excludes all other programs; no historical backfill and no UPDATE trigger.
create function public.capture_membership_payment_contract()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_quote jsonb;a public.affiliates%rowtype;v_profile jsonb;
begin
  if new.program_id<>'membership' or new.membership_offering_id is null then
    raise exception 'MEMBERSHIP_REQUEST_CONTRACT_INVALID' using errcode='22023';end if;
  if auth.uid() is null or new.actor_real_auth_user_id is distinct from auth.uid()
     or new.affiliate_id is distinct from public.get_effective_affiliate_id() then
    raise exception 'AFFILIATE_CONTEXT_DENIED' using errcode='42501';end if;
  select * into a from public.affiliates where id=new.affiliate_id for share;
  perform 1 from public.membership_offerings where id=new.membership_offering_id for share;
  v_quote:=public.membership_payment_contract(new.affiliate_id,new.membership_offering_id);
  select jsonb_build_object('affiliate_id',a.id,'numero_control',a.numero_control,
    'financial_union_code',a.financial_union_code,'financial_union',u.label,
    'financial_employee_category_code',a.financial_employee_category_code,'financial_employee_category',c.label,
    'financial_profile_version',a.financial_profile_version)
    into v_profile from (select 1) one
    left join public.segmentation_catalog_entries u on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled
    left join public.segmentation_catalog_entries c on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled;
  if new.numero_control is distinct from a.numero_control then raise exception 'AFFILIATE_CONTEXT_DENIED' using errcode='42501';end if;
  new.requested_amount:=(v_quote->'financialResult'->>'amount')::numeric;
  new.requested_term:=(v_quote->'financialResult'->>'paymentCount')::integer;
  new.requested_term_semantics:=v_quote->'financialResult'->>'paymentPeriod';
  new.financial_profile_snapshot:=v_profile;
  new.financial_submission_snapshot:=v_quote||jsonb_build_object('actor_real_auth_user_id',auth.uid(),'confirmed_at',now());
  -- Preserve membership workflow; never dispatch to the loan approval/export engine.
  if new.financial_processing_status is not null then raise exception 'MEMBERSHIP_REQUEST_CONTRACT_INVALID' using errcode='22023';end if;
  return new;
end $$;
revoke all on function public.capture_membership_payment_contract() from public,anon,authenticated,service_role;
create trigger program_requests_03_membership_payment_contract
before insert on public.program_requests for each row
when (new.program_id='membership' or new.membership_offering_id is not null)
execute function public.capture_membership_payment_contract();

-- Eight-argument overload protects the quote shown by the new UI; existing signature remains intact.
create function public.create_membership_request(p_membership_offering_id uuid,p_document_ids uuid[],p_phone text,
  p_rfc text,p_curp text,p_terms_version_id uuid,p_idempotency_key uuid,p_expected_payment_quote_hash text)
returns public.program_requests language plpgsql security definer set search_path=''
as $$ declare v_affiliate uuid:=public.get_effective_affiliate_id();v_quote jsonb;r public.program_requests%rowtype;
begin
  if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501';end if;
  if p_idempotency_key is null or coalesce(p_expected_payment_quote_hash,'')!~'^[a-f0-9]{64}$' then
    raise exception 'MEMBERSHIP_PAYMENT_QUOTE_REQUIRED' using errcode='22023';end if;
  -- Serialize retries for this actor/affiliate/key without locking unrelated requests.
  perform pg_advisory_xact_lock(hashtextextended(v_affiliate::text||':'||p_idempotency_key::text,0));
  select * into r from public.program_requests where affiliate_id=v_affiliate and idempotency_key=p_idempotency_key;
  if r.id is not null then
    if r.program_id<>'membership' or r.membership_offering_id is distinct from p_membership_offering_id
       or r.actor_real_auth_user_id is distinct from auth.uid()
       or r.financial_submission_snapshot->>'quote_hash' is distinct from p_expected_payment_quote_hash
       or r.terms_version_id is distinct from p_terms_version_id
       or r.applicant_profile_snapshot->>'phone' is distinct from regexp_replace(coalesce(p_phone,''),'\D','','g')
       or r.applicant_profile_snapshot->>'rfc' is distinct from upper(btrim(p_rfc))
       or r.applicant_profile_snapshot->>'curp' is distinct from upper(btrim(p_curp)) then
      raise exception 'IDEMPOTENCY_CONTRACT_MISMATCH' using errcode='22023';end if;
    return r;
  end if;
  perform 1 from public.affiliates where id=v_affiliate for share;
  perform 1 from public.membership_offerings where id=p_membership_offering_id for share;
  v_quote:=public.membership_payment_contract(v_affiliate,p_membership_offering_id);
  if v_quote->>'quote_hash' is distinct from p_expected_payment_quote_hash then
    raise exception 'MEMBERSHIP_CONDITIONS_CHANGED' using errcode='40001';end if;
  return public.create_membership_request(p_membership_offering_id,p_document_ids,p_phone,p_rfc,p_curp,p_terms_version_id,p_idempotency_key);
end $$;
revoke all on function public.create_membership_request(uuid,uuid[],text,text,text,uuid,uuid,text) from public,anon;
grant execute on function public.create_membership_request(uuid,uuid[],text,text,text,uuid,uuid,text) to authenticated;
comment on function public.membership_payment_contract(uuid,uuid) is
  'Owner H-MEMBERSHIP-PAYMENT-CONTRACT-001. Catalog commercial amount includes $15/installment; zero interest. Private derived quote, not loan rules.';
notify pgrst,'reload schema';
commit;
