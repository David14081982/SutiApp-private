begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- H-FINANCIAL-MOSTRAR-OVERRIDE-001. No business rows/history or grants change.
-- Deploy/recover together with financial-legacy/visibility-policy.js.
do $patch$
declare
 signature text := 'public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)';
 original text; original_acl text; original_owner oid; original_oid oid;
 anchor text := E'begin\n result:=public.resolve_suti_loan_quote_contract_v1_engine';
 previous_guard text := $previous$begin
 -- H-FINANCIAL-MOSTRAR-OVERRIDE-001: explicit admin MOSTRAR overrides the automatic cutoff.
 -- Keep array order and all financial values; invalidate only closed options.
 if jsonb_typeof(p_eligible_rules)='array' then
  p_eligible_rules := (select coalesce(jsonb_agg(
   case when value->>'available_on' is not null
    and coalesce(value->>'visibility_mode','AUTO') <> 'MOSTRAR'
    and today >= ((value->>'available_on')::date - interval '1 month')::date
   then value || jsonb_build_object('status','UNAVAILABLE') else value end
   order by ordinal),'[]'::jsonb)
   from jsonb_array_elements(p_eligible_rules) with ordinality as candidate(value,ordinal));
 end if;
 result:=public.resolve_suti_loan_quote_contract_v1_engine$previous$;
 next_guard text := $next$begin
 -- H-LOAN-DATED-FUND-CUTOFF-001: MOSTRAR cannot bypass the payroll deadline.
 -- Keep array order and all financial values; invalidate only closed options.
 if jsonb_typeof(p_eligible_rules)='array' then
  p_eligible_rules := (select coalesce(jsonb_agg(
   case when value->>'available_on' is not null
    and today >= ((value->>'available_on')::date - interval '1 month')::date
   then value || jsonb_build_object('status','UNAVAILABLE') else value end
   order by ordinal),'[]'::jsonb)
   from jsonb_array_elements(p_eligible_rules) with ordinality as candidate(value,ordinal));
 end if;
 result:=public.resolve_suti_loan_quote_contract_v1_engine$next$;
begin
 select p.oid,pg_get_functiondef(p.oid),p.proacl::text,p.proowner
 into original_oid,original,original_acl,original_owner from pg_proc p where p.oid=signature::regprocedure;
 previous_guard:=replace(previous_guard,E'\r','');
 next_guard:=replace(next_guard,E'\r','');
 if position(E'begin\r\n -- H-' in original)>0 then
  previous_guard:=replace(previous_guard,E'\n',E'\r\n');
  next_guard:=replace(next_guard,E'\n',E'\r\n');
  anchor:=replace(anchor,E'\n',E'\r\n');
 end if;
 if (length(original)-length(replace(original,previous_guard,'')))<>length(previous_guard)
  or md5(replace(replace(original,previous_guard,anchor),E'\r',''))<>'e9be0f63a8904007d23b1f9497032b76'
 then raise exception 'RECOVERY_BLOCKED_FINANCIAL_MOSTRAR_DRIFT';end if;
 execute replace(original,previous_guard,next_guard);
 if (select p.oid<>original_oid or p.proacl::text is distinct from original_acl or p.proowner<>original_owner
     from pg_proc p where p.oid=signature::regprocedure)
 then raise exception 'FINANCIAL_MOSTRAR_PRIVILEGE_DRIFT';end if;
end $patch$;

notify pgrst,'reload schema';
commit;
