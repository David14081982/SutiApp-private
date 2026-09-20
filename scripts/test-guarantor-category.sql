-- Run only inside the caller's BEGIN/ROLLBACK transaction.
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.role','service_role',true);

create temporary table guarantor_test_scopes as
  select 'PROGRAM'::text scope_type,'prestamo'::text scope_key
  union all select 'MEMBERSHIP',id::text from public.membership_offerings where enabled
  union all select 'PROGRAM',id::text from public.program_catalog_items where enabled
  union all select 'PRODUCT',p.id::text from public.marketplace_products p
    join public.companies c on c.id=p.company_id and c.enabled where p.enabled;
create temporary table guarantor_matrix(category text,scopes integer,required_count integer);

do $test$
declare a record;s record;v_rows jsonb;v_base jsonb;v_other jsonb;v_codes text[];v_expected integer;v_count integer;
begin
  if has_function_privilege('anon','public.required_guarantor_document_codes(uuid)','execute')
    or has_function_privilege('authenticated','public.required_guarantor_document_codes(uuid)','execute')
    or has_function_privilege('authenticated','public.resolve_affiliate_document_requirements(text,text,uuid)','execute')
    or has_function_privilege('anon','public.resolve_effective_document_requirements(text,text)','execute') then
    raise exception 'GUARANTOR_PRIVATE_BOUNDARY_BROKEN';
  end if;
  for a in select distinct on(financial_employee_category_code) id,financial_employee_category_code category
    from public.affiliates order by financial_employee_category_code,id loop
    v_expected:=case when a.category in ('SUPLENTES_VARIABLES','SUPLENTES_FIJOS') then 3 else 0 end;
    v_codes:=public.required_guarantor_document_codes(a.id);
    if cardinality(v_codes)<>v_expected then raise exception 'POLICY_CATEGORY_MISMATCH: %',a.category;end if;
    v_count:=0;
    for s in select * from guarantor_test_scopes loop
      select coalesce(jsonb_agg(to_jsonb(r) order by r.document_type_code),'[]') into v_rows
        from public.resolve_affiliate_document_requirements(s.scope_type,s.scope_key,a.id) r;
      if (select count(*) from jsonb_array_elements(v_rows) r
        where r->>'document_type_code' in ('guarantor_ine_front','guarantor_ine_back','guarantor_photo'))<>v_expected then
        raise exception 'SCOPE_CATEGORY_MISMATCH: % / %',a.category,s.scope_type;
      end if;
      if exists(select 1 from jsonb_array_elements(v_rows) r
        where r->>'document_type_code'=any(v_codes) and (r->>'required')::boolean is not true) then
        raise exception 'GUARANTOR_NOT_REQUIRED';
      end if;
      if (select count(*) from jsonb_array_elements(v_rows))<>
        (select count(distinct r->>'document_type_id') from jsonb_array_elements(v_rows) r) then
        raise exception 'DUPLICATE_REQUIREMENT';
      end if;
      select coalesce(jsonb_agg(to_jsonb(r) order by r.document_type_code),'[]') into v_base
        from public.resolve_affiliate_document_requirements(s.scope_type,s.scope_key,null) r
        where r.document_type_code not in ('guarantor_ine_front','guarantor_ine_back','guarantor_photo');
      select coalesce(jsonb_agg(r order by r->>'document_type_code'),'[]') into v_other
        from jsonb_array_elements(v_rows) r
        where r->>'document_type_code' not in ('guarantor_ine_front','guarantor_ine_back','guarantor_photo');
      if v_other<>v_base then raise exception 'OTHER_DOCUMENTS_CHANGED';end if;
      v_count:=v_count+1;
    end loop;
    insert into guarantor_matrix values(a.category,v_count,v_expected);
  end loop;
  if (select count(*) from guarantor_matrix where required_count=3)<>2 then
    raise exception 'BOTH_SUPLENTE_CATEGORIES_NOT_TESTED';
  end if;
end $test$;

-- Exercise the real trigger on an isolated table with the same row shape.
create temporary table guarantor_snapshot_test as select * from public.program_requests where false;
create trigger capture_test before insert on guarantor_snapshot_test
  for each row execute function public.capture_document_requirements_snapshot();
do $test$
declare a record;s record;r record;v_expected integer;
begin
  for a in select distinct on(financial_employee_category_code) id,financial_employee_category_code category
    from public.affiliates order by financial_employee_category_code,id loop
    for s in select * from guarantor_test_scopes where scope_type in ('PROGRAM','MEMBERSHIP') loop
      insert into guarantor_snapshot_test(affiliate_id,program_id,program_item_id,membership_offering_id)
        values(a.id,case when s.scope_key='prestamo' then 'prestamo' when s.scope_type='MEMBERSHIP' then 'membership' else 'program' end,
          case when s.scope_type='PROGRAM' and s.scope_key<>'prestamo' then s.scope_key::uuid else null end,
          case when s.scope_type='MEMBERSHIP' then s.scope_key::uuid else null end)
        returning document_requirements_snapshot into r;
      v_expected:=case when a.category in ('SUPLENTES_VARIABLES','SUPLENTES_FIJOS') then 3 else 0 end;
      if (select count(*) from jsonb_array_elements(r.document_requirements_snapshot) d
        where d->>'code' in ('guarantor_ine_front','guarantor_ine_back','guarantor_photo'))<>v_expected then
        raise exception 'REQUEST_SNAPSHOT_CATEGORY_MISMATCH';
      end if;
    end loop;
  end loop;
end $test$;

-- The browser RPC derives identity; its private variant never accepts browser IDs.
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('test.guarantor_actor'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.guarantor_actor'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $test$
declare v_actual jsonb;v_affiliate uuid;v_expected integer;
begin
  v_affiliate:=public.get_effective_affiliate_id();
  if v_affiliate is null then raise exception 'TEST_AUTH_IDENTITY_UNAVAILABLE';end if;
  select case when financial_employee_category_code in ('SUPLENTES_VARIABLES','SUPLENTES_FIJOS') then 3 else 0 end
    into v_expected from public.affiliates where id=v_affiliate;
  select jsonb_agg(to_jsonb(r)) into v_actual from public.resolve_effective_document_requirements('PROGRAM','prestamo') r;
  if (select count(*) from jsonb_array_elements(v_actual) d
    where d->>'document_type_code' in ('guarantor_ine_front','guarantor_ine_back','guarantor_photo'))<>v_expected then
    raise exception 'SELF_CONTEXT_WRONG_CATEGORY';
  end if;
  begin
    perform public.resolve_affiliate_document_requirements('PROGRAM','prestamo',v_affiliate);
    raise exception 'PRIVATE_RESOLVER_ALLOWED_BROWSER';
  exception when insufficient_privilege then null;end;
  begin
    perform public.required_guarantor_document_codes(v_affiliate);
    raise exception 'PRIVATE_POLICY_ALLOWED_BROWSER';
  exception when insufficient_privilege then null;end;
end $test$;
reset role;
select category,scopes,required_count from guarantor_matrix order by category;
