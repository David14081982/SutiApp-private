begin;
-- Real unit_raw values contain trailing tabs. Normalize only surrounding whitespace.
do $migration$
declare v_definition text;
begin
  v_definition := pg_get_functiondef('public.get_affiliate_seniority(integer,integer)'::regprocedure);
  if position('btrim(a.unit_raw)' in v_definition) = 0 then
    raise exception 'SENIORITY_DEFINITION_DRIFT';
  end if;
  execute replace(v_definition, 'btrim(a.unit_raw)', $expression$btrim(a.unit_raw, E' \t\n\r')$expression$);
end;
$migration$;
commit;
