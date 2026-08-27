begin;

-- ADR-069 · Contención del snapshot durante la cotizacion interactiva.
--
-- `resolve_current_loan_snapshot_quote` SOLO LEE la fila del snapshot: no la
-- modifica, y el paso de confirmacion (`loanSessionConfirm`) revalida todo bajo
-- su propia transaccion, de modo que una cotizacion nunca puede convertirse en
-- una solicitud con condiciones vencidas.
--
-- `for share` tomaba un lock que ENTRA EN CONFLICTO con `for no key update`,
-- que es exactamente el lock que toma el `update ... set invalidated_at` de
-- `openPersonalizedLoanSession` / `invalidateLoanSession`. Resultado: abrir una
-- sesion nueva y cotizar se bloqueaban mutuamente.
--
-- `for key share` solo entra en conflicto con `for update`, que es el lock que
-- toma un DELETE. Es decir: la fila sigue sin poder desaparecer a mitad de la
-- cotizacion (la garantia que se necesita), pero deja de serializarse contra la
-- invalidacion de sesiones. Se mantiene la consistencia y se elimina la espera.
--
-- Sin cambios en reglas financieras, tasas, montos, elegibilidad ni formula.

create or replace function public.resolve_current_loan_snapshot_quote(
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

  select * into v_snapshot from public.financial_session_snapshots where id=p_snapshot_id for key share;
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

comment on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) is
  'Authenticated interactive quote over the current actor/effective-affiliate personalized 15-minute snapshot; zero Google calls. Read-only over the snapshot row: FOR KEY SHARE pins it against deletion without serializing behind session invalidation.';

notify pgrst, 'reload schema';
commit;
