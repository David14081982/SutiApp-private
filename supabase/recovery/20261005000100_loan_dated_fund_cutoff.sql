begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- Restore the previous visibility-policy.js together with this reverse patch.
-- Historical requests and financial data are never rewritten by recovery.
do $recovery$
declare
 signature text := 'public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)';
 original text; original_acl text; original_owner oid;
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
 if position(E'begin\r\n -- H-LOAN-DATED-FUND-CUTOFF-001' in original)>0 then
  anchor:=replace(anchor,E'\n',E'\r\n');
  guard:=replace(guard,E'\n',E'\r\n');
 end if;
 if md5(replace(replace(original,guard,anchor),E'\r',''))<>'e9be0f63a8904007d23b1f9497032b76'
  or original not like '%ADVANCE_PAYROLL_INTEREST_V1%'
  or (length(original)-length(replace(original,guard,'')))<>length(guard)
 then raise exception 'RECOVERY_BLOCKED_DATED_FUND_CUTOFF_DRIFT';end if;
 execute replace(original,guard,anchor);
 if (select p.proacl::text is distinct from original_acl or p.proowner<>original_owner
     from pg_proc p where p.oid=signature::regprocedure)
 then raise exception 'RECOVERY_BLOCKED_DATED_FUND_CUTOFF_PRIVILEGES';end if;
end $recovery$;

notify pgrst,'reload schema';
commit;
