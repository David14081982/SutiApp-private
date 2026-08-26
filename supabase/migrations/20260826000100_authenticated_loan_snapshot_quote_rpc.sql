begin;

-- Owner-authorized interactive resolver. Google remains the financial authority;
-- this resolver only evaluates Google-derived rules already held by the existing
-- personalized, expiring snapshot or freshly supplied by the service-role Edge.
create function public.normalize_suti_financial_key(p_value text)
returns text
language sql
immutable
set search_path=''
as $$
  select upper(regexp_replace(
    translate(btrim(coalesce(p_value,'')),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNAEIOUUN'),
    '\s+',' ','g'
  ))
$$;

create function public.resolve_suti_loan_quote_contract(
  p_eligible_rules jsonb,
  p_financial_union text,
  p_financial_employee_category text,
  p_program_id text,
  p_amount numeric,
  p_term integer,
  p_policy jsonb
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_rule jsonb;
  v_match_count integer;
  v_max_amount numeric;
  v_rate_factor numeric;
  v_rate numeric;
  v_payment_count integer;
  v_payment_period text;
  v_custom_min integer;
  v_custom_step integer;
  v_standard_terms integer[];
  v_interest numeric;
  v_fee_per_payment numeric := 15;
  v_fee_total numeric;
  v_total numeric;
  v_payment numeric;
  v_term_options jsonb;
begin
  if jsonb_typeof(p_eligible_rules) <> 'array' or jsonb_array_length(p_eligible_rules) < 1 then
    raise exception 'FINANCIAL_RULES_INVALID' using errcode='22023';
  end if;
  if nullif(btrim(p_financial_union),'') is null or nullif(btrim(p_financial_employee_category),'') is null then
    raise exception 'AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE' using errcode='P0001';
  end if;
  if nullif(btrim(p_program_id),'') is null or p_amount is null or p_amount::text='NaN' or p_term is null then
    raise exception 'FINANCIAL_REQUEST_OUT_OF_RANGE' using errcode='22023';
  end if;
  if jsonb_typeof(p_policy) <> 'object'
     or p_policy->>'source' <> 'SUPABASE_LOAN_TERM_POLICY'
     or jsonb_typeof(p_policy->'standardTerms') <> 'array' then
    raise exception 'LOAN_TERM_POLICY_UNAVAILABLE' using errcode='P0001';
  end if;

  begin
    v_custom_min := (p_policy->>'customMinTerm')::integer;
    v_custom_step := (p_policy->>'customStep')::integer;
    select coalesce(array_agg(value::integer order by ordinal),array[]::integer[])
      into v_standard_terms
      from jsonb_array_elements_text(p_policy->'standardTerms') with ordinality as terms(value,ordinal);
  exception when others then
    raise exception 'LOAN_TERM_POLICY_UNAVAILABLE' using errcode='P0001';
  end;
  if v_custom_min <= 0 or v_custom_step <= 0 or cardinality(v_standard_terms) < 1 then
    raise exception 'LOAN_TERM_POLICY_UNAVAILABLE' using errcode='P0001';
  end if;

  select count(*) into v_match_count
  from jsonb_array_elements(p_eligible_rules) as candidate(value)
  where public.normalize_suti_financial_key(value->>'category')=public.normalize_suti_financial_key(p_financial_employee_category)
    and public.normalize_suti_financial_key(value->>'union')=public.normalize_suti_financial_key(p_financial_union)
    and value->>'status'='AVAILABLE'
    and value->>'id'=p_program_id;

  if v_match_count > 0 then
    select value into v_rule
    from jsonb_array_elements(p_eligible_rules) as candidate(value)
    where public.normalize_suti_financial_key(value->>'category')=public.normalize_suti_financial_key(p_financial_employee_category)
      and public.normalize_suti_financial_key(value->>'union')=public.normalize_suti_financial_key(p_financial_union)
      and value->>'status'='AVAILABLE'
      and value->>'id'=p_program_id
    limit 1;
  else
    select count(*) into v_match_count
    from jsonb_array_elements(p_eligible_rules) as candidate(value)
    where public.normalize_suti_financial_key(value->>'category')=public.normalize_suti_financial_key(p_financial_employee_category)
      and public.normalize_suti_financial_key(value->>'union')=public.normalize_suti_financial_key(p_financial_union)
      and value->>'status'='AVAILABLE'
      and value->>'program_id'=p_program_id;
    if v_match_count = 1 then
      select value into v_rule
      from jsonb_array_elements(p_eligible_rules) as candidate(value)
      where public.normalize_suti_financial_key(value->>'category')=public.normalize_suti_financial_key(p_financial_employee_category)
        and public.normalize_suti_financial_key(value->>'union')=public.normalize_suti_financial_key(p_financial_union)
        and value->>'status'='AVAILABLE'
        and value->>'program_id'=p_program_id
      limit 1;
    else
      v_rule := null;
    end if;
  end if;

  if v_rule is null then raise exception 'FINANCIAL_PROGRAM_NOT_ELIGIBLE' using errcode='P0001'; end if;
  if jsonb_typeof(v_rule->'max_amount') <> 'number'
     or jsonb_typeof(v_rule->'rate_factor') <> 'number'
     or jsonb_typeof(v_rule->'rate') <> 'number'
     or jsonb_typeof(v_rule->'payment_count') <> 'number'
     or nullif(btrim(v_rule->>'fund'),'') is null
     or nullif(btrim(v_rule->>'program_id'),'') is null
     or nullif(btrim(v_rule->>'payment_period'),'') is null then
    raise exception 'FINANCIAL_RULES_INVALID' using errcode='22023';
  end if;

  begin
    v_max_amount := (v_rule->>'max_amount')::numeric;
    v_rate_factor := (v_rule->>'rate_factor')::numeric;
    v_rate := (v_rule->>'rate')::numeric;
    v_payment_count := (v_rule->>'payment_count')::integer;
    v_payment_period := v_rule->>'payment_period';
  exception when others then
    raise exception 'FINANCIAL_RULES_INVALID' using errcode='22023';
  end;
  if p_amount <= 0 or p_amount > v_max_amount or p_term < v_custom_min or p_term > v_payment_count
     or mod(p_term-v_custom_min,v_custom_step) <> 0 then
    raise exception 'FINANCIAL_REQUEST_OUT_OF_RANGE' using errcode='22023';
  end if;

  -- Exact current contract: positive currency values rounded half-up to cents.
  v_interest := round(p_amount*v_rate_factor*p_term,2);
  v_fee_total := round(v_fee_per_payment*p_term,2);
  v_total := round(p_amount+v_interest+v_fee_total,2);
  v_payment := round(v_total/p_term,2);

  select coalesce(jsonb_agg(jsonb_build_object(
    'term',candidate_term,
    'paymentCount',candidate_term,
    'interest',round(p_amount*v_rate_factor*candidate_term,2),
    'administrativeFeePerPayment',v_fee_per_payment,
    'administrativeFeeTotal',round(v_fee_per_payment*candidate_term,2),
    'total',round(p_amount+round(p_amount*v_rate_factor*candidate_term,2)+round(v_fee_per_payment*candidate_term,2),2),
    'paymentPerPeriod',round(round(p_amount+round(p_amount*v_rate_factor*candidate_term,2)+round(v_fee_per_payment*candidate_term,2),2)/candidate_term,2)
  ) order by ordinal),'[]'::jsonb)
  into v_term_options
  from unnest(v_standard_terms) with ordinality as terms(candidate_term,ordinal)
  where candidate_term >= v_custom_min and candidate_term <= v_payment_count;

  return jsonb_build_object(
    'source','GOOGLE_LEGACY','action','quote','amount',p_amount,
    'paymentCount',p_term,'paymentPeriod',v_payment_period,
    'rate',v_rate,'ratePeriod',v_payment_period,
    'interest',v_interest,'administrativeFeePerPayment',v_fee_per_payment,
    'administrativeFeeTotal',v_fee_total,'total',v_total,
    'paymentPerPeriod',v_payment,'fund',v_rule->>'fund',
    'program',v_rule->>'program_id','maxAmount',v_max_amount,'maxTerm',v_payment_count,
    'termOptions',v_term_options,
    'customTerm',jsonb_build_object('min',v_custom_min,'max',v_payment_count,'step',v_custom_step),
    'eligibility',jsonb_build_object('status','AVAILABLE','eligible',true),
    'administrativeFeeRule','$15 por pago',
    'administrativeFeeVersion','LEGACY_EQUIVALENCE_2026-08-23',
    'criteria',jsonb_build_object('termLabel',v_rule->>'term_label'),
    'resolved_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end $$;

create function public.resolve_current_loan_snapshot_quote(
  p_snapshot_id uuid,
  p_program_id text,
  p_amount numeric,
  p_term integer
) returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_affiliate_id uuid;
  v_impersonation_id uuid;
  v_snapshot public.financial_session_snapshots%rowtype;
  v_affiliate record;
  v_policy public.loan_term_policy%rowtype;
  v_policy_json jsonb;
  v_profile_canonical text;
  v_policy_canonical text;
  v_profile_fingerprint text;
  v_policy_fingerprint text;
  v_quote jsonb;
  v_payroll jsonb;
begin
  if v_actor is null or coalesce(auth.role(),'') <> 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_snapshot_id is null or nullif(btrim(p_program_id),'') is null or p_amount is null or p_amount<=0 or p_term is null or p_term<=0 then
    raise exception 'INVALID_REQUEST' using errcode='22023';
  end if;

  v_affiliate_id := public.get_effective_affiliate_id();
  if v_affiliate_id is null then raise exception 'AFFILIATE_CONTEXT_UNAVAILABLE' using errcode='42501'; end if;
  select s.id into v_impersonation_id
  from public.impersonation_sessions s
  where s.actor_real_auth_user_id=v_actor and s.ended_at is null and s.expires_at>now()
    and public.has_admin_permission('affiliates.impersonate')
  limit 1;

  select a.*,u.label as current_financial_union,c.label as current_financial_category
    into v_affiliate
  from public.affiliates a
  left join public.segmentation_catalog_entries u
    on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled
  left join public.segmentation_catalog_entries c
    on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled
  where a.id=v_affiliate_id;
  if v_affiliate.id is null or v_affiliate.current_financial_union is null or v_affiliate.current_financial_category is null then
    raise exception 'AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE' using errcode='P0001';
  end if;

  select * into v_snapshot from public.financial_session_snapshots where id=p_snapshot_id for share;
  if v_snapshot.id is null
     or v_snapshot.actor_real_auth_user_id<>v_actor
     or v_snapshot.affiliate_id<>v_affiliate_id
     or v_snapshot.impersonation_session_id is distinct from v_impersonation_id
     or v_snapshot.invalidated_at is not null
     or v_snapshot.expires_at<=now()
     or v_snapshot.financial_profile_version<>v_affiliate.financial_profile_version
     or v_snapshot.calculation_contract_version<>'SUTI_LOAN_QUOTE_V1' then
    raise exception 'SNAPSHOT_INVALID' using errcode='P0001';
  end if;

  v_profile_canonical := '{'
    ||'"actor_real_auth_user_id":'||to_jsonb(v_actor::text)::text
    ||',"affiliate_id":'||to_jsonb(v_affiliate_id::text)::text
    ||',"financial_affiliation_status":'||coalesce(to_jsonb(v_affiliate.financial_affiliation_status)::text,'null')
    ||',"financial_employee_category":'||coalesce(to_jsonb(v_affiliate.current_financial_category)::text,'null')
    ||',"financial_employee_category_code":'||coalesce(to_jsonb(v_affiliate.financial_employee_category_code)::text,'null')
    ||',"financial_employee_type":'||coalesce(to_jsonb(v_affiliate.financial_employee_type)::text,'null')
    ||',"financial_employment_status":'||coalesce(to_jsonb(v_affiliate.financial_employment_status)::text,'null')
    ||',"financial_profile_version":'||to_jsonb(v_affiliate.financial_profile_version)::text
    ||',"financial_union":'||coalesce(to_jsonb(v_affiliate.current_financial_union)::text,'null')
    ||',"financial_union_code":'||coalesce(to_jsonb(v_affiliate.financial_union_code)::text,'null')
    ||',"impersonation_session_id":'||coalesce(to_jsonb(v_impersonation_id::text)::text,'null')||'}';
  v_profile_fingerprint := upper(encode(extensions.digest(convert_to(v_profile_canonical,'UTF8'),'sha256'),'hex'));
  if v_snapshot.profile_fingerprint<>v_profile_fingerprint then
    raise exception 'SNAPSHOT_INVALID' using errcode='P0001';
  end if;
  if exists(
    select 1 from jsonb_array_elements(v_snapshot.eligible_rules) as candidate(value)
    where public.normalize_suti_financial_key(value->>'union')<>public.normalize_suti_financial_key(v_affiliate.current_financial_union)
       or public.normalize_suti_financial_key(value->>'category')<>public.normalize_suti_financial_key(v_affiliate.current_financial_category)
  ) then raise exception 'SNAPSHOT_INVALID' using errcode='P0001'; end if;

  select * into v_policy from public.loan_term_policy where id='primary' and enabled;
  if v_policy.id is null then raise exception 'LOAN_TERM_POLICY_UNAVAILABLE' using errcode='P0001'; end if;
  v_policy_json := jsonb_build_object(
    'source','SUPABASE_LOAN_TERM_POLICY','standardTerms',v_policy.standard_terms,
    'customMinTerm',v_policy.custom_min_term,'customStep',v_policy.custom_step,
    'decisionReference',v_policy.decision_reference
  );
  v_policy_canonical := '{'
    ||'"customMinTerm":'||v_policy.custom_min_term::text
    ||',"customStep":'||v_policy.custom_step::text
    ||',"decisionReference":'||to_jsonb(v_policy.decision_reference)::text
    ||',"source":"SUPABASE_LOAN_TERM_POLICY"'
    ||',"standardTerms":['||array_to_string(v_policy.standard_terms,',')||']}';
  v_policy_fingerprint := upper(encode(extensions.digest(convert_to(v_policy_canonical,'UTF8'),'sha256'),'hex'));
  if v_snapshot.term_policy_fingerprint<>v_policy_fingerprint then
    raise exception 'SNAPSHOT_INVALID' using errcode='P0001';
  end if;

  v_quote := public.resolve_suti_loan_quote_contract(
    v_snapshot.eligible_rules,v_affiliate.current_financial_union,v_affiliate.current_financial_category,
    p_program_id,p_amount,p_term,v_policy_json
  );
  begin
    v_payroll := public.get_current_declared_payroll_impact((v_quote->>'paymentPerPeriod')::numeric);
  exception when others then
    v_payroll := jsonb_build_object('status','ERROR','source','SUPABASE_DECLARED_PAYROLL','guidelinePercent',30);
  end;
  return v_quote || jsonb_build_object(
    'payrollImpact',v_payroll,
    'loanSession',jsonb_build_object('id',v_snapshot.id,'expires_at',v_snapshot.expires_at,
      'financial_profile_version',v_snapshot.financial_profile_version),
    'googleResolutionCount',0
  );
end $$;

revoke all on function public.normalize_suti_financial_key(text) from public,anon,authenticated;
revoke all on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) to service_role;
revoke all on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) from public,anon;
grant execute on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) to authenticated;

comment on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) is
  'Single certified SUTI_LOAN_QUOTE_V1 calculator. Internal/service use only; never a financial authority.';
comment on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) is
  'Authenticated interactive quote over the current actor/effective-affiliate personalized 15-minute snapshot; zero Google calls.';

notify pgrst, 'reload schema';
commit;
