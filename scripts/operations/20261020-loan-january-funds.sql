-- H-LOAN-JANUARY-FUNDS-001. Run inside a transaction with a verified admin JWT context.
-- Only owner-approved January funds; no historical edits, copied legacy provenance or Google calls.
do $january$
declare
  v_year integer; v_union text; v_code text; v_name text; v_date date;
  v_fund public.financial_funds%rowtype; v_rule public.financial_rules%rowtype;
  v_json jsonb; v_count integer; v_batch uuid; v_category text;
  v_before_funds jsonb; v_before_rules jsonb; v_after jsonb;
  v_fund_ids uuid[]; v_rule_ids uuid[];
  v_created_funds integer:=0; v_created_rules integer:=0;
  v_reason text:='H-LOAN-JANUARY-FUNDS-001: alta autorizada de enero 2027/2028, Base, tres sindicatos; conservar fondos e historicos existentes';
begin
  if auth.uid() is null or not public.has_admin_permission('financial_programs.write')
    or not public.has_admin_permission('financial_rules.write')
    or not public.has_admin_permission('financial_rates.write')
    or not public.has_admin_permission('financial_rules.publish') then
    raise exception 'JANUARY_AUTHORIZED_ADMIN_REQUIRED' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('H-LOAN-JANUARY-FUNDS-001'));
  lock table public.financial_funds,public.financial_rules in share row exclusive mode;
  select active_import_batch_id into v_batch from public.financial_criteria_authority
    where id='primary' and authority='SUPABASE' for share;
  if v_batch is null then raise exception 'JANUARY_AUTHORITY_UNAVAILABLE'; end if;
  select code into v_category from public.segmentation_catalog_entries
    where catalog_type='employment_category' and code='BASE' and enabled;
  if v_category is null then raise exception 'JANUARY_CATEGORY_UNAVAILABLE'; end if;
  select array_agg(id order by id),jsonb_agg(to_jsonb(f) order by id) into v_fund_ids,v_before_funds from public.financial_funds f;
  select array_agg(id order by id),jsonb_agg(to_jsonb(r) order by id) into v_rule_ids,v_before_rules from public.financial_rules r;

  foreach v_year in array array[2027,2028] loop
    v_date:=make_date(v_year,1,15);
    v_code:='15-01-'||v_year||'-incentivos-trimestrales';
    v_name:='15/01/'||v_year||' — Incentivos trimestrales';
    -- Normalize punctuation and spacing to prevent another label for the same fund.
    select count(*) into v_count from public.financial_funds
      where program_id='prestamo' and (code=v_code or
        regexp_replace(lower(name),'[^a-z0-9]','','g')=regexp_replace(lower(v_name),'[^a-z0-9]','','g'));
    if v_count>1 then raise exception 'JANUARY_DUPLICATE_FUND: %',v_year; end if;
    if v_count=0 then
      v_json:=public.save_financial_fund(null,'prestamo',v_code,v_name,true,'PUBLISHED',100,v_reason,'CONFIRMAR');
      select * into v_fund from public.financial_funds where id=(v_json->>'id')::uuid;
      v_created_funds:=v_created_funds+1;
    else
      select * into v_fund from public.financial_funds where program_id='prestamo' and (code=v_code or
        regexp_replace(lower(name),'[^a-z0-9]','','g')=regexp_replace(lower(v_name),'[^a-z0-9]','','g'));
      if not v_fund.enabled or v_fund.publication_status<>'PUBLISHED' or v_fund.imported_batch_id is distinct from v_batch then
        raise exception 'JANUARY_EXISTING_FUND_CONFLICT: %',v_year;
      end if;
    end if;
    foreach v_union in array array['SUTISSSTESON','SUEISSSTESON','SITISSSTESON'] loop
      if not exists(select 1 from public.segmentation_catalog_entries where catalog_type='union' and code=v_union and enabled) then
        raise exception 'JANUARY_UNION_UNAVAILABLE: %',v_union;
      end if;
      select count(*) into v_count from public.financial_rules where fund_id=v_fund.id
        and financial_union_code=v_union and financial_employee_category_code=v_category
        and lifecycle_status in('DRAFT','PUBLISHED','SCHEDULED');
      if v_count>1 then raise exception 'JANUARY_DUPLICATE_RULE: % %',v_year,v_union; end if;
      if v_count=1 then
        select * into v_rule from public.financial_rules where fund_id=v_fund.id
          and financial_union_code=v_union and financial_employee_category_code=v_category
          and lifecycle_status in('DRAFT','PUBLISHED','SCHEDULED');
        if not v_rule.enabled or v_rule.lifecycle_status not in('PUBLISHED','SCHEDULED')
          or v_rule.imported_batch_id is distinct from v_batch or v_rule.max_amount<>10000 or v_rule.rate_factor<>0.06
          or v_rule.payment_count<>1 or v_rule.max_term<>1 or v_rule.term_label<>'1 Qnas'
          or v_rule.available_on is distinct from v_date or v_rule.visibility_mode<>'AUTO' then
          raise exception 'JANUARY_EXISTING_RULE_CONFLICT: % %',v_year,v_union;
        end if;
      else
        -- An expired historical combination requires review, never implicit resurrection.
        if exists(select 1 from public.financial_rules where fund_id=v_fund.id and financial_union_code=v_union
          and financial_employee_category_code=v_category) then raise exception 'JANUARY_HISTORICAL_RULE_REQUIRES_REVIEW'; end if;
        v_json:=public.save_financial_rule_draft(null,v_fund.id,v_union,v_category,10000,0.06,'1 Qnas',1,1,v_date,'AUTO',v_reason,'CONFIRMAR');
        perform public.publish_financial_rule((v_json->>'id')::uuid,v_reason,'PUBLICAR');
        v_created_rules:=v_created_rules+1;
      end if;
    end loop;
  end loop;
  select jsonb_agg(to_jsonb(f) order by id) into v_after from public.financial_funds f where id=any(v_fund_ids);
  if v_after is distinct from v_before_funds then raise exception 'JANUARY_PREEXISTING_FUNDS_CHANGED'; end if;
  select jsonb_agg(to_jsonb(r) order by id) into v_after from public.financial_rules r where id=any(v_rule_ids);
  if v_after is distinct from v_before_rules then raise exception 'JANUARY_PREEXISTING_RULES_CHANGED'; end if;
  perform public.get_financial_runtime_rules();
  perform set_config('sutiapp.january_result',jsonb_build_object('created_funds',v_created_funds,'created_rules',v_created_rules,'preserved_existing',true)::text,true);
end $january$;
