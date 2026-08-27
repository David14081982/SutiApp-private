begin;

do $$
declare v_definition text;
begin
  v_definition:=pg_get_functiondef('public.stage_financial_criteria_import(jsonb,text)'::regprocedure);
  if position('r.rate_percent,r.term_label' in v_definition)>0 then
    v_definition:=replace(v_definition,'r.rate_percent,r.term_label','r.raw_rate,r.term_label');
    execute v_definition;
  elsif position('r.raw_rate,r.term_label' in v_definition)=0 then
    raise exception 'FINANCIAL_IMPORTER_DEFINITION_UNEXPECTED' using errcode='P0001';
  end if;
end $$;
comment on function public.stage_financial_criteria_import(jsonb,text) is null;

commit;
