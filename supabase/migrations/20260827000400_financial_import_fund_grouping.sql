begin;

do $$
declare v_definition text;
begin
  v_definition:=pg_get_functiondef('public.stage_financial_criteria_import(jsonb,text)'::regprocedure);
  if position('select distinct x.program_id,x.fund_code,x.fund,x.fund_order,v_batch' in v_definition)>0 then
    v_definition:=replace(v_definition,
      'select distinct x.program_id,x.fund_code,x.fund,x.fund_order,v_batch
  from jsonb_to_recordset(p_rules) as x(program_id text,fund_code text,fund text,fund_order integer)',
      'select x.program_id,x.fund_code,x.fund,min(x.fund_order),v_batch
  from jsonb_to_recordset(p_rules) as x(program_id text,fund_code text,fund text,fund_order integer)
  group by x.program_id,x.fund_code,x.fund');
    execute v_definition;
  elsif position('min(x.fund_order)' in v_definition)=0 then
    raise exception 'FINANCIAL_FUND_IMPORT_DEFINITION_UNEXPECTED' using errcode='P0001';
  end if;
end $$;
comment on function public.stage_financial_criteria_import(jsonb,text) is
  'Shadow importer v4: effective-rate equivalence, service boundary, and one deterministic fund per program/code.';

commit;
