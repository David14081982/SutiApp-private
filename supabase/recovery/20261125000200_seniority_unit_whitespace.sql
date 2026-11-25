begin;
do $migration$
declare v_definition text;
begin
  v_definition := pg_get_functiondef('public.get_affiliate_seniority(integer,integer)'::regprocedure);
  if position($expression$btrim(a.unit_raw, E' \t\n\r')$expression$ in v_definition) = 0 then
    raise exception 'SENIORITY_DEFINITION_DRIFT';
  end if;
  execute replace(v_definition, $expression$btrim(a.unit_raw, E' \t\n\r')$expression$, 'btrim(a.unit_raw)');
end;
$migration$;
commit;
