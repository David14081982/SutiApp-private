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
    if position('current_user<>''postgres'' and coalesce(auth.role(),'''')<>''service_role''' in v_definition)>0 then
      v_definition:=replace(v_definition,
        'current_user<>''postgres'' and coalesce(auth.role(),'''')<>''service_role''',
        'coalesce(auth.role(),'''') not in(''service_role'',''postgres'')');
      execute v_definition;
    end if;
  end loop;
end $$;

commit;
