begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- H-LOAN-DATED-FUND-CUTOFF-001. No business rows or historical contracts change.
-- Preserve the installed engine, signature, OID, owner and grants. The matching
-- recovery removes only this exact guard and rejects unrelated definition drift.
do $migration$
declare
 signature text := 'public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)';
 original text; patched text; original_acl text; original_owner oid;
 anchor text := E'begin\n result:=public.resolve_suti_loan_quote_contract_v1_engine';
 guard text := $guard$begin
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
 result:=public.resolve_suti_loan_quote_contract_v1_engine$guard$;
begin
 select pg_get_functiondef(p.oid),p.proacl::text,p.proowner
 into original,original_acl,original_owner from pg_proc p where p.oid=signature::regprocedure;
 guard:=replace(guard,E'\r','');
 if position(E'begin\r\n result:=' in original)>0 then
  anchor:=replace(anchor,E'\n',E'\r\n');
  guard:=replace(guard,E'\n',E'\r\n');
 end if;
 if md5(replace(original,E'\r',''))<>'e9be0f63a8904007d23b1f9497032b76'
  or original not like '%ADVANCE_PAYROLL_INTEREST_V1%'
  or original not like '%today date:=(now() at time zone ''America/Hermosillo'')::date;%'
  or original like '%H-LOAN-DATED-FUND-CUTOFF-001%'
  or (length(original)-length(replace(original,anchor,'')))<>length(anchor)
 then raise exception 'DATED_FUND_CUTOFF_FUNCTION_DRIFT';end if;
 patched:=replace(original,anchor,guard);
 execute patched;
 if (select p.proacl::text is distinct from original_acl or p.proowner<>original_owner
     from pg_proc p where p.oid=signature::regprocedure)
 then raise exception 'DATED_FUND_CUTOFF_PRIVILEGE_DRIFT';end if;
end $migration$;

notify pgrst,'reload schema';
commit;
