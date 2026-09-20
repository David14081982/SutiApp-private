begin;
-- Definition guards
do $guard$ begin
if (select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from public.program_requests t)<> '82a70047c837686e4abc65a99252b1ec' then raise exception 'RECOVERY_BLOCKED_REQUEST_HISTORY_CHANGED';end if;
if md5(pg_get_functiondef(24639))<> 'f5730ddf1d17475640d46a173725b3c5' then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT: capture_document_requirements_snapshot';end if;
if md5(pg_get_functiondef(21761))<> '05f0a5ef888debd7be87eec58908f3b0' then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT: create_membership_request';end if;
if md5(pg_get_functiondef(25096))<> 'c03569e4cbfe42551f55c5f9f659b88d' then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT: create_validated_financial_program_request';end if;
if md5(pg_get_functiondef(25007))<> '1a0d80cfac75af11fa0e4f973e29aa6b' then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT: create_validated_financial_program_request_bank_required';end if;
if md5(pg_get_functiondef(21932))<> '87df717a2dd44da6ac5fc2d589344d23' then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT: create_validated_financial_program_request_v1_engine';end if;
if md5(pg_get_functiondef(25465))<> '57e93a27997124f94aea2146f2854dfb' then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT: create_validated_program_product_payment_request';end if;
if md5(pg_get_functiondef(21760))<> '279c168e30eb7618ef3730c54d6326e9' then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT: finalize_program_request_context';end if;
if md5(pg_get_functiondef(24634))<> 'ff2523c9d7015435e1cffc09dd5af0a4' then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT: get_document_requirement_impact';end if;
if md5(pg_get_functiondef(24631))<> '09d305d5bea930beb812c427cf7a5d64' then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT: resolve_effective_document_requirements';end if;
end $guard$;

-- Restore exact preceding definitions. Never delete request/document history.
CREATE OR REPLACE FUNCTION public.finalize_program_request_context(p_request_id uuid, p_terms_version_id uuid, p_document_ids uuid[])
 RETURNS program_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_row public.program_requests%rowtype;v_missing integer; begin
  select * into v_row from public.program_requests where id=p_request_id and affiliate_id=public.get_effective_affiliate_id() and actor_real_auth_user_id=auth.uid() for update;
  if v_row.id is null then raise exception 'REQUEST_ACCESS_DENIED' using errcode='42501'; end if;
  if not exists(select 1 from public.program_terms_versions t where t.id=p_terms_version_id and t.program_id=v_row.program_id and t.membership_offering_id is not distinct from v_row.membership_offering_id and t.published) then raise exception 'TERMS_VERSION_REQUIRED' using errcode='22023'; end if;
  select count(*) into v_missing from public.program_document_requirements r where r.program_id=v_row.program_id and r.membership_offering_id is not distinct from v_row.membership_offering_id and r.enabled and r.required and not exists(
    select 1 from public.affiliate_documents d where d.id=any(p_document_ids) and d.affiliate_id=v_row.affiliate_id and d.document_type_id=r.document_type_id and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED'));
  if v_missing>0 then raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023'; end if;
  update public.program_requests set terms_version_id=p_terms_version_id,updated_at=now() where id=v_row.id returning * into v_row;
  perform public.attach_request_documents(v_row.id,p_document_ids);return v_row;
end $function$;
CREATE OR REPLACE FUNCTION public.create_membership_request(p_membership_offering_id uuid, p_document_ids uuid[], p_phone text, p_rfc text, p_curp text, p_terms_version_id uuid, p_idempotency_key uuid)
 RETURNS program_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_affiliate public.affiliates%rowtype;v_row public.program_requests%rowtype;v_missing integer; begin
  select a.* into v_affiliate from public.affiliates a where a.id=public.get_effective_affiliate_id();
  if auth.uid() is null or v_affiliate.id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.membership_offerings where id=p_membership_offering_id and enabled) then raise exception 'MEMBERSHIP_UNAVAILABLE' using errcode='22023'; end if;
  if regexp_replace(coalesce(p_phone,''),'\D','','g')!~'^[0-9]{10}$' or upper(btrim(p_rfc))!~'^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$' or upper(btrim(p_curp))!~'^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$' then raise exception 'INVALID_APPLICANT_PROFILE' using errcode='22023'; end if;
  if not exists(select 1 from public.program_terms_versions where id=p_terms_version_id and program_id='membership' and membership_offering_id=p_membership_offering_id and published) then raise exception 'TERMS_VERSION_REQUIRED' using errcode='22023'; end if;
  select count(*) into v_missing from public.program_document_requirements r where r.program_id='membership' and r.membership_offering_id=p_membership_offering_id and r.enabled and r.required and not exists(
    select 1 from public.affiliate_documents d where d.id=any(p_document_ids) and d.affiliate_id=v_affiliate.id and d.document_type_id=r.document_type_id and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED'));
  if v_missing>0 then raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023'; end if;
  select * into v_row from public.program_requests where affiliate_id=v_affiliate.id and idempotency_key=p_idempotency_key;
  if v_row.id is null then
    insert into public.program_requests(actor_real_auth_user_id,affiliate_id,numero_control,program_id,membership_offering_id,request_type,status,terms_accepted,terms_version_id,idempotency_key,applicant_profile_snapshot,source_context)
    values(auth.uid(),v_affiliate.id,v_affiliate.numero_control,'membership',p_membership_offering_id,'benefit','submitted',true,p_terms_version_id,p_idempotency_key,
      jsonb_build_object('phone',regexp_replace(p_phone,'\D','','g'),'rfc',upper(btrim(p_rfc)),'curp',upper(btrim(p_curp)),'source','request_snapshot'),jsonb_build_object('surface','membership_application')) returning * into v_row;
    perform public.attach_request_documents(v_row.id,p_document_ids);
  end if;return v_row;
end $function$;
CREATE OR REPLACE FUNCTION public.create_validated_program_product_payment_request(p_actor_real_auth_user_id uuid, p_affiliate_id uuid, p_impersonation_session_id uuid, p_program_item_id uuid, p_notes text, p_signature_data text, p_terms_version_id uuid, p_document_ids uuid[], p_idempotency_key uuid, p_down_payment numeric, p_term integer, p_expected_profile_version integer, p_schedule_anchor_date date)
 RETURNS program_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_affiliate public.affiliates%rowtype;
  v_item public.program_catalog_items%rowtype;
  v_ctx public.impersonation_sessions%rowtype;
  v_quote public.program_requests%rowtype;
  v_row public.program_requests%rowtype;
  v_policy public.loan_term_policy%rowtype;
  v_rules jsonb;
  v_rule jsonb;
  v_rule_count integer;
  v_price numeric(14,2);
  v_amount numeric(14,2);
  v_source text;
  v_result jsonb;
  v_schedule jsonb;
  v_process text;
  v_period text;
  v_union_label text;
  v_category_label text;
  v_missing integer;
  v_snapshot jsonb;
  v_business_date date:=(now() at time zone 'America/Hermosillo')::date;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_actor_real_auth_user_id is null or not exists(select 1 from auth.users where id=p_actor_real_auth_user_id) then
    raise exception 'AUTH_ACTOR_REQUIRED' using errcode='42501';
  end if;
  select * into v_affiliate from public.affiliates where id=p_affiliate_id for update;
  if v_affiliate.id is null or v_affiliate.financial_profile_version<>p_expected_profile_version then
    raise exception 'CONDITIONS_CHANGED' using errcode='PT409';
  end if;
  if p_impersonation_session_id is null then
    if v_affiliate.auth_user_id is distinct from p_actor_real_auth_user_id then raise exception 'AFFILIATE_CONTEXT_DENIED' using errcode='42501'; end if;
  else
    select * into v_ctx from public.impersonation_sessions where id=p_impersonation_session_id for share;
    if v_ctx.id is null or v_ctx.actor_real_auth_user_id<>p_actor_real_auth_user_id
       or v_ctx.usuario_contexto_affiliate_id<>p_affiliate_id or v_ctx.ended_at is not null or v_ctx.expires_at<=now()
       or not exists(select 1 from public.admin_assignments a join public.admin_roles r on r.id=a.role_id and r.enabled
         where a.auth_user_id=p_actor_real_auth_user_id and a.enabled) then
      raise exception 'IMPERSONATION_CONTEXT_INVALID' using errcode='42501';
    end if;
  end if;
  select * into v_item from public.program_catalog_items where id=p_program_item_id and enabled and request_mode='supabase' for share;
  if v_item.id is null or v_item.program_key='prestamo' then raise exception 'PROGRAM_PRODUCT_NOT_FINANCEABLE' using errcode='22023'; end if;
  if v_item.requires_quote then
    select * into v_quote from public.program_requests
    where affiliate_id=p_affiliate_id and program_item_id=v_item.id and request_type='quote' and status='approved'
      and quoted_amount>0 and (valid_until is null or valid_until>=v_business_date)
    order by responded_at desc nulls last,created_at desc,id desc limit 1 for share;
    if v_quote.id is null then raise exception 'AUTHORIZED_PRODUCT_PRICE_UNAVAILABLE' using errcode='P0001'; end if;
    v_price:=v_quote.quoted_amount;v_source:='APPROVED_QUOTE';
  else
    if v_item.price_cash is null or v_item.price_cash<=0 then raise exception 'AUTHORIZED_PRODUCT_PRICE_UNAVAILABLE' using errcode='P0001'; end if;
    v_price:=v_item.price_cash;v_source:='PRICE_CASH';
  end if;
  if p_down_payment is null or p_down_payment<0 or p_down_payment>=v_price then raise exception 'DOWN_PAYMENT_OUT_OF_RANGE' using errcode='22023'; end if;
  v_amount:=round(v_price-p_down_payment,2);
  select * into v_policy from public.loan_term_policy where id='primary' and enabled;
  if v_policy.id is null then raise exception 'LOAN_TERM_POLICY_UNAVAILABLE' using errcode='P0001'; end if;
  select u.label,c.label into v_union_label,v_category_label
  from public.affiliates a
  left join public.segmentation_catalog_entries u on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled
  left join public.segmentation_catalog_entries c on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled
  where a.id=v_affiliate.id;
  if v_union_label is null or v_category_label is null then raise exception 'AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE' using errcode='P0001'; end if;
  v_rules:=public.get_financial_runtime_rules();
  select count(*) into v_rule_count
  from jsonb_array_elements(v_rules) candidate(value)
  where value->>'program_id'='caja'
    and public.normalize_suti_financial_key(value->>'category')=public.normalize_suti_financial_key(v_category_label)
    and public.normalize_suti_financial_key(value->>'union')=public.normalize_suti_financial_key(v_union_label)
    and case upper(coalesce(value->>'visibility_mode','AUTO'))
      when 'MOSTRAR' then true when 'OCULTAR' then false
      else value->>'available_on' is null or (value->>'available_on')::date between v_business_date
        and (date_trunc('month',v_business_date)+interval '5 months - 1 day')::date end;
  if v_rule_count<>1 then raise exception 'CAJA_CHICA_RULE_NOT_ELIGIBLE' using errcode='P0001'; end if;
  select value into v_rule
  from jsonb_array_elements(v_rules) candidate(value)
  where value->>'program_id'='caja'
    and public.normalize_suti_financial_key(value->>'category')=public.normalize_suti_financial_key(v_category_label)
    and public.normalize_suti_financial_key(value->>'union')=public.normalize_suti_financial_key(v_union_label)
    and case upper(coalesce(value->>'visibility_mode','AUTO'))
      when 'MOSTRAR' then true when 'OCULTAR' then false
      else value->>'available_on' is null or (value->>'available_on')::date between v_business_date
        and (date_trunc('month',v_business_date)+interval '5 months - 1 day')::date end
  limit 1;
  v_rule:=v_rule||jsonb_build_object('status','AVAILABLE');
  v_result:=public.resolve_suti_loan_quote_contract(
    jsonb_build_array(v_rule),v_union_label,v_category_label,
    v_rule->>'id',v_amount,p_term,jsonb_build_object(
      'source','SUPABASE_LOAN_TERM_POLICY','standardTerms',v_policy.standard_terms,
      'customMinTerm',v_policy.custom_min_term,'customStep',v_policy.custom_step,
      'decisionReference',v_policy.decision_reference
    )
  );
  v_process:=case v_affiliate.financial_employee_category_code
    when 'SUPLENTES_VARIABLES' then '3' when 'JUBILADOS_PENSIONADOS' then 'JUB'
    when 'SUPLENTES_FIJOS' then '1' when 'EVENTUALES' then '1' when 'BASE' then '1'
    else null end;
  if v_process is null then raise exception 'PAYROLL_PROCESS_UNRESOLVED' using errcode='P0001'; end if;
  v_period:=case when v_process='JUB' then 'mensual' else 'quincenal' end;
  v_result:=(v_result||jsonb_build_object('paymentPeriod',v_period,'ratePeriod',v_period,'source','SUPABASE_FINANCIAL_CRITERIA'));
  if p_schedule_anchor_date is distinct from v_business_date then raise exception 'SCHEDULE_ANCHOR_CHANGED' using errcode='PT409'; end if;
  v_schedule:=public.generate_program_product_payment_schedule(
    p_schedule_anchor_date,v_process,(v_result->>'paymentCount')::integer,
    (v_result->>'total')::numeric,(v_result->>'paymentPerPeriod')::numeric
  );
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023'; end if;
  if nullif(btrim(coalesce(p_signature_data,'')),'') is null then raise exception 'SIGNATURE_AND_TERMS_REQUIRED' using errcode='22023'; end if;
  if not exists(select 1 from public.program_terms_versions where id=p_terms_version_id and program_id='prestamo'
    and membership_offering_id is null and published) then raise exception 'TERMS_VERSION_REQUIRED' using errcode='22023'; end if;
  select count(*) into v_missing
  from public.resolve_effective_document_requirements('PROGRAM','prestamo') requirement
  where requirement.required and not exists(
    select 1 from public.affiliate_documents d
    left join public.affiliate_files af on af.id=d.affiliate_file_id
    join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id) and pa.status='READY'
    join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
    where d.id=any(coalesce(p_document_ids,array[]::uuid[])) and d.affiliate_id=p_affiliate_id
      and d.document_type_id=requirement.document_type_id and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
      and not exists(select 1 from public.affiliate_documents newer where newer.affiliate_id=d.affiliate_id
        and newer.document_type_id=d.document_type_id and (newer.created_at,newer.id)>(d.created_at,d.id))
  );
  if v_missing>0 then raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023'; end if;
  v_snapshot:=jsonb_build_object(
    'contract_version','PROGRAM_PRODUCT_PAYMENT_V1','calculation_contract_version','SUTI_LOAN_QUOTE_V1',
    'calendar_contract_version','PROGRAM_PRODUCT_PAYROLL_CALENDAR_V1','affiliate_id',p_affiliate_id,
    'actor_real_auth_user_id',p_actor_real_auth_user_id,'impersonation_session_id',p_impersonation_session_id,
    'profile_version',v_affiliate.financial_profile_version,'product',jsonb_build_object(
      'program_item_id',v_item.id,'program_key',v_item.program_key,'name',v_item.name
    ),'authorized_price',v_price,'price_source',v_source,'quote_request_id',v_quote.id,
    'down_payment',round(p_down_payment,2),'financed_amount',v_amount,'fund_program_id','caja',
    'fund_rule_id',v_rule->>'rule_id','criterion_identity',v_rule->>'criterion_identity',
    'financial_authority','SUPABASE','financial_rules_source_hash',v_rule->>'source_snapshot_hash',
    'financialResult',v_result,'payment_schedule',v_schedule,'terms_version_id',p_terms_version_id,
    'confirmed_at',now()
  );
  select * into v_row from public.program_requests where affiliate_id=p_affiliate_id and idempotency_key=p_idempotency_key;
  if v_row.id is not null then
    if v_row.actor_real_auth_user_id<>p_actor_real_auth_user_id or v_row.program_item_id<>p_program_item_id
       or v_row.requested_amount<>v_amount or v_row.requested_term<>p_term
       or (v_row.financial_submission_snapshot->>'down_payment')::numeric<>round(p_down_payment,2)
       or v_row.financial_submission_snapshot->>'price_source'<>v_source
       or coalesce(v_row.financial_submission_snapshot->>'quote_request_id','')<>coalesce(v_quote.id::text,'') then
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
    v_affiliate.numero_control,v_item.program_key,v_item.id,'benefit','requires_financial_processing',1,
    left(nullif(btrim(coalesce(p_notes,'')),''),2000),p_signature_data,true,p_terms_version_id,
    jsonb_build_object('source','sutiapp','flow','PROGRAM_PRODUCT_PAYMENT_V1','price_source',v_source,
      'quote_request_id',v_quote.id,'fund_program_id','caja','assisted',v_ctx.id is not null),
    'pending',p_idempotency_key,v_amount,p_term,v_period,v_snapshot
  ) returning * into v_row;
  insert into public.request_documents(request_id,document_type_id,affiliate_document_id,private_asset_id,asset_sha256,status_at_submission)
  select v_row.id,d.document_type_id,d.id,coalesce(d.private_asset_id,af.private_asset_id),pa.content_sha256,d.status
  from public.affiliate_documents d left join public.affiliate_files af on af.id=d.affiliate_file_id
  join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.id=any(coalesce(p_document_ids,array[]::uuid[])) and d.affiliate_id=p_affiliate_id
    and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
  on conflict(request_id,document_type_id) do nothing;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(p_actor_real_auth_user_id,p_affiliate_id,'program_requests','PROGRAM_PRODUCT_PAYMENT_CONFIRMED',v_row.id,
    jsonb_build_object('program_item_id',v_item.id,'price_source',v_source,'quote_request_id',v_quote.id,
      'payment_count',p_term,'payment_period',v_period,'assisted',v_ctx.id is not null));
  return v_row;
exception when unique_violation then
  select * into v_row from public.program_requests where affiliate_id=p_affiliate_id and idempotency_key=p_idempotency_key;
  if v_row.id is not null and v_row.program_item_id=p_program_item_id and v_row.requested_amount=v_amount
     and v_row.requested_term=p_term and (v_row.financial_submission_snapshot->>'down_payment')::numeric=round(p_down_payment,2) then
    return v_row;
  end if;
  raise;
end $function$;
CREATE OR REPLACE FUNCTION public.create_validated_financial_program_request_v1_engine(p_actor_real_auth_user_id uuid, p_affiliate_id uuid, p_impersonation_session_id uuid, p_program_item_id uuid, p_notes text, p_signature_data text, p_terms_version_id uuid, p_document_ids uuid[], p_idempotency_key uuid, p_amount numeric, p_term integer, p_term_semantics text, p_expected_profile_version integer, p_financial_submission_snapshot jsonb)
 RETURNS program_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise exception 'CONDITIONS_CHANGED' using errcode='PT409';
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
end $function$;
CREATE OR REPLACE FUNCTION public.create_validated_financial_program_request_bank_required(p_actor_real_auth_user_id uuid, p_affiliate_id uuid, p_impersonation_session_id uuid, p_program_item_id uuid, p_notes text, p_signature_data text, p_terms_version_id uuid, p_document_ids uuid[], p_idempotency_key uuid, p_amount numeric, p_term integer, p_term_semantics text, p_expected_profile_version integer, p_financial_submission_snapshot jsonb)
 RETURNS program_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise exception 'CONDITIONS_CHANGED' using errcode='PT409';
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
     and (card_number ~ '^[0-9]{16}$' or public.is_valid_clabe(clabe))
     and (card_number is null or card_number ~ '^[0-9]{16}$')
     and (clabe is null or public.is_valid_clabe(clabe))
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
end $function$;
CREATE OR REPLACE FUNCTION public.create_validated_financial_program_request(p_actor_real_auth_user_id uuid, p_affiliate_id uuid, p_impersonation_session_id uuid, p_program_item_id uuid, p_notes text, p_signature_data text, p_terms_version_id uuid, p_document_ids uuid[], p_idempotency_key uuid, p_amount numeric, p_term integer, p_term_semantics text, p_expected_profile_version integer, p_financial_submission_snapshot jsonb)
 RETURNS program_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise exception 'CONDITIONS_CHANGED' using errcode='PT409';
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
end $function$;
CREATE OR REPLACE FUNCTION public.capture_document_requirements_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_type text;v_key text;
begin
  if new.document_requirements_snapshot is not null then raise exception 'DOCUMENT_REQUIREMENTS_SNAPSHOT_SERVER_ONLY' using errcode='42501'; end if;
  if new.membership_offering_id is not null then v_type:='MEMBERSHIP';v_key:=new.membership_offering_id::text;
  elsif new.program_id='prestamo' then v_type:='PROGRAM';v_key:='prestamo';
  elsif new.financial_submission_snapshot->>'contract_version'='PROGRAM_PRODUCT_PAYMENT_V1' then v_type:='PROGRAM';v_key:='prestamo';
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
end $function$;
CREATE OR REPLACE FUNCTION public.get_document_requirement_impact(p_scope_type text, p_scope_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_scope jsonb;v_type text;v_key text;v_active bigint:=0;v_requirements bigint:=0;
begin
  if not public.has_admin_permission('documents.read') then raise exception 'DOCUMENT_CONFIG_DENIED' using errcode='42501'; end if;
  v_scope:=public.assert_document_requirement_scope(p_scope_type,p_scope_key);v_type:=v_scope->>'scope_type';v_key:=v_scope->>'scope_key';
  select count(*) into v_requirements from public.resolve_effective_document_requirements(v_type,v_key);
  if v_type='MEMBERSHIP' then select count(*) into v_active from public.program_requests where membership_offering_id::text=v_key and status in('submitted','in_review');
  elsif v_type='PRODUCT' then select count(*) into v_active from public.program_requests where product_id::text=v_key and status in('submitted','in_review');
  elsif v_type='PROGRAM' and v_key='prestamo' then select count(*) into v_active from public.program_requests where program_id='prestamo' and status in('submitted','in_review','requires_financial_processing');
  elsif v_type='PROGRAM' then select count(*) into v_active from public.program_requests where program_item_id::text=v_key and status in('submitted','in_review');
  elsif v_type='COMPANY' then select count(*) into v_active from public.program_requests where company_id::text=v_key and status in('submitted','in_review'); end if;
  return v_scope||jsonb_build_object('effective_requirements',v_requirements,'active_requests',v_active);
end $function$;
CREATE OR REPLACE FUNCTION public.resolve_effective_document_requirements(p_scope_type text, p_scope_key text)
 RETURNS TABLE(requirement_id uuid, scope_type text, scope_key text, document_type_id uuid, required boolean, allow_verified_reuse boolean, sort_order integer, inherited boolean, source_scope_type text, source_scope_key text, document_type_code text, document_type_label text, document_type_description text, document_type_icon text, accepted_mime_types text[], camera_allowed boolean, file_upload_allowed boolean, max_file_size_bytes bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_scope jsonb;v_type text;v_key text;v_parent_type text;v_parent_key text;
begin
  v_scope:=public.assert_document_requirement_scope(p_scope_type,p_scope_key);
  v_type:=v_scope->>'scope_type';v_key:=v_scope->>'scope_key';
  v_parent_type:=v_scope->>'parent_scope_type';v_parent_key:=v_scope->>'parent_scope_key';
  return query
  with candidates as(
    select r.*,false as is_inherited,2 as priority from public.program_document_requirements r
      where r.scope_type=v_type and r.scope_key=v_key and r.enabled and r.effect='INCLUDE'
    union all
    select r.*,true,1 from public.program_document_requirements r
      where v_parent_type is not null and r.scope_type=v_parent_type and r.scope_key=v_parent_key and r.enabled and r.effect='INCLUDE'
      and not exists(select 1 from public.program_document_requirements x where x.scope_type=v_type and x.scope_key=v_key and x.document_type_id=r.document_type_id and x.enabled and x.effect='EXCLUDE')
  ), chosen as(
    select distinct on(c.document_type_id)c.* from candidates c order by c.document_type_id,c.priority desc,c.sort_order,c.id
  )
  select c.id,v_type,v_key,c.document_type_id,c.required,c.allow_verified_reuse,c.sort_order,c.is_inherited,
    c.scope_type,c.scope_key,d.code,d.label,d.description,d.icon,d.accepted_mime_types,d.camera_allowed,d.file_upload_allowed,d.max_file_size_bytes
  from chosen c join public.document_types d on d.id=c.document_type_id and d.enabled
  order by c.sort_order,d.sort_order,d.label;
end $function$;
drop function public.resolve_affiliate_document_requirements(text,text,uuid);
drop function public.required_guarantor_document_codes(uuid);
commit;
