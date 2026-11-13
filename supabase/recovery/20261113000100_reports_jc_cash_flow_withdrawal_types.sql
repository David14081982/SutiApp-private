begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Prepared only. Preserves all financial rows, amounts, dates and authorization.
do $patch$
declare definition text; original text; p pg_proc%rowtype; old_text text; new_text text;
begin
 select * into p from pg_proc where oid=to_regprocedure('public.get_admin_reports_jc_cash_flow(date)');
 if p.oid is null or not p.prosecdef or p.provolatile<>'s' or pg_get_userbyid(p.proowner)<>'postgres'
  or p.proacl::text is distinct from '{postgres=X/postgres,authenticated=X/postgres}'
  or not(p.proconfig=array['search_path=""'] or p.proconfig=array['search_path=""','statement_timeout=30s'])
 then raise exception 'CASH_FLOW_WITHDRAWAL_SECURITY_DRIFT';end if;
 original:=pg_get_functiondef(p.oid);definition:=original;
 old_text:=$old$'historical-withdrawal:'||h.id,case lower(btrim(h.d->>'E')) when 'completo' then 'withdrawal_total' when 'parcial' then 'withdrawal_partial' else 'withdrawal_unspecified' end,h.paid_on,h.amount,$old$;
 new_text:=$new$'historical-withdrawal:'||h.id,'withdrawal_unspecified',h.paid_on,h.amount,$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'CASH_FLOW_WITHDRAWAL_READER_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);
 old_text:=$old$'id',h.id,'source_folio',h.source_folio,'date',h.paid_on,'amount',h.amount,'account_id',h.account_id,'original_withdrawal_type',h.d->>'E','name'$old$;
 new_text:=$new$'id',h.id,'source_folio',h.source_folio,'date',h.paid_on,'amount',h.amount,'account_id',h.account_id,'name'$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'CASH_FLOW_WITHDRAWAL_READER_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);
 if md5(replace(definition, E' SET statement_timeout TO ''30s''\n',''))<>'e488e949179fc8d780aa2cacdaf28f14' then raise exception 'CASH_FLOW_WITHDRAWAL_BODY_DRIFT';end if;
 execute definition;
 if exists(select 1 from pg_proc n where n.oid=p.oid and (n.proacl is distinct from p.proacl or n.proconfig is distinct from p.proconfig or n.proowner<>p.proowner or n.prosecdef<>p.prosecdef)) then raise exception 'CASH_FLOW_WITHDRAWAL_SECURITY_CHANGED';end if;
end $patch$;
notify pgrst,'reload schema';
commit;
