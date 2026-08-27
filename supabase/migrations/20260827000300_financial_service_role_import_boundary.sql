begin;

do $$
declare v_name text; v_definition text;
begin
  foreach v_name in array array[
    'public.stage_financial_criteria_import(jsonb,text)',
    'public.get_financial_runtime_rules()',
    'public.activate_financial_criteria_import(uuid,text,text)'
  ] loop
    v_definition:=pg_get_functiondef(v_name::regprocedure);
    if position('coalesce(auth.role(),'''') not in(''service_role'',''postgres'')' in v_definition)>0 then
      v_definition:=replace(v_definition,
        'coalesce(auth.role(),'''') not in(''service_role'',''postgres'')',
        'current_user<>''postgres'' and coalesce(auth.role(),'''')<>''service_role''');
      execute v_definition;
    elsif position('current_user<>''postgres'' and coalesce(auth.role(),'''')<>''service_role''' in v_definition)=0 then
      raise exception 'FINANCIAL_SERVICE_BOUNDARY_DEFINITION_UNEXPECTED: %',v_name using errcode='P0001';
    end if;
  end loop;
end $$;
comment on function public.stage_financial_criteria_import(jsonb,text) is
  'Shadow importer v3: effective-rate equivalence; callable only by PostgreSQL owner or service_role, never browser roles.';

commit;
