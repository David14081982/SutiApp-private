begin;
-- H-CASH-FLOW-PV2-SOURCE-20261104. Only this report reader receives a 30s RPC budget.
-- No body, source data, business writer, ACL, role or global setting changes.
set local lock_timeout='2s';
set local statement_timeout='60s';
do $guard$
declare p pg_proc%rowtype;begin
 select * into p from pg_proc where oid=to_regprocedure('public.get_admin_reports_jc_cash_flow(date)');
 if p.oid is null or md5(pg_get_functiondef(p.oid))<>'e488e949179fc8d780aa2cacdaf28f14'
  or pg_get_userbyid(p.proowner)<>'postgres'
  or p.proacl::text is distinct from '{postgres=X/postgres,authenticated=X/postgres}'
  or p.provolatile<>'s' or not p.prosecdef or p.proconfig is distinct from array['search_path=""']
 then raise exception 'REPORTS_JC_CASH_FLOW_TIMEOUT_DRIFT';end if;
 perform set_config('reports_jc.cash_flow_timeout_identity',(to_jsonb(p)-'proconfig')::text,true);
end $guard$;
alter function public.get_admin_reports_jc_cash_flow(date) set statement_timeout to '30s';
do $verify$
declare p pg_proc%rowtype;begin
 select * into p from pg_proc where oid=to_regprocedure('public.get_admin_reports_jc_cash_flow(date)');
 if (to_jsonb(p)-'proconfig') is distinct from current_setting('reports_jc.cash_flow_timeout_identity')::jsonb
  or p.proconfig is distinct from array['search_path=""','statement_timeout=30s']
 then raise exception 'REPORTS_JC_CASH_FLOW_TIMEOUT_IDENTITY_CHANGED';end if;
end $verify$;
notify pgrst,'reload schema';
commit;
