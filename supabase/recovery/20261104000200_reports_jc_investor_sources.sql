begin;
-- H-CASH-FLOW-PV2-SOURCE-20261104. Report-only source projection; no financial DML.
set local lock_timeout='2s';
set local statement_timeout='60s';
do $guard$
declare p pg_proc%rowtype;begin
 select * into p from pg_proc where oid=to_regprocedure('public.get_admin_reports_jc_cash_flow_investors(date)');
 if p.oid is null or md5(pg_get_functiondef(p.oid))<>'1dbe64575f780f8db2faac1f2a3e70bb' or pg_get_userbyid(p.proowner)<>'postgres'
  or p.proacl::text is distinct from '{postgres=X/postgres,authenticated=X/postgres}'
  or p.provolatile<>'s' or not p.prosecdef or p.proconfig::text is distinct from '{"search_path=\"\""}'
 then raise exception 'REPORTS_JC_INVESTOR_SOURCE_DRIFT';end if;
 perform set_config('reports_jc.investor_source_identity',jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'volatility',p.provolatile,'security',p.prosecdef,'config',p.proconfig)::text,true);
end $guard$;
CREATE OR REPLACE FUNCTION public.get_admin_reports_jc_cash_flow_investors(p_from date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_today date:=(transaction_timestamp() at time zone 'America/Hermosillo')::date;
  v_result jsonb;
begin
  perform public.get_admin_reports_jc_context();
  if p_from is null or not isfinite(p_from) or p_from<>date_trunc('month',p_from)::date
    or p_from<date '2000-01-01' or p_from>date '2100-12-01' then
    raise exception 'CASH_FLOW_RANGE_INVALID' using errcode='22023';
  end if;
  with contracts as (
    select c.id,c.investor_id,c.code,c.starts_on,c.ends_on,c.months,c.principal,c.monthly_rate,
      c.payment_mode,c.status,c.opening_balance,c.balance_on,c.history_complete,c.parent_id,
      c.source->>'status' as source_status,
      case when jsonb_typeof(c.source->'contributed')='number' then (c.source->>'contributed')::numeric end as registered_contribution,
      case when jsonb_typeof(c.source->'current_capital')='number' then (c.source->>'current_capital')::numeric end as registered_current_capital,
      coalesce(c.balance_on,case when batch.manifest->>'snapshot_observed_on' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
        then (batch.manifest->>'snapshot_observed_on')::date end) as registered_balance_on,
      (select min((a.created_at at time zone 'America/Hermosillo')::date)
        from investors_private.audit a where a.entity='contract' and a.entity_id=c.id and a.action='close') as closed_on,
      (select min(child.starts_on) from investors_private.contracts child where child.parent_id=c.id) as renewed_on,
      case when c.balance_on<=v_today then investors_private.balance(c.id,v_today) end as balance,
      coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'effective_on',t.effective_on,'monthly_rate',t.monthly_rate) order by t.effective_on)
        from investors_private.terms t where t.contract_id=c.id),'[]'::jsonb) as terms
    from investors_private.contracts c
      join investors_private.investors i on i.id=c.investor_id
      left join investors_private.imports batch on batch.sha256=i.source->>'sha256'
  ), movements as (
    -- A correction replaces its predecessor, including a voided replacement. Neither is counted twice.
    select m.id,m.contract_id,m.obligation_id,m.effective_on,m.concept,m.direction,m.amount,m.period_start,m.period_end
    from investors_private.movements m where not m.voided
      and not exists(select 1 from investors_private.movements next where next.replaces_id=m.id)
  ), obligations as (
    select o.id,o.contract_id,o.period_start,o.period_end,o.due_on,o.concept,o.amount,
      o.principal_basis,o.rate_snapshot,o.origin,
      coalesce((select sum(m.amount) from movements m where m.obligation_id=o.id and m.effective_on<=v_today),0) as paid
    from investors_private.obligations o where not o.cancelled
  ), months as (
    select d::date as month,least((d+interval '1 month'-interval '1 day')::date,v_today) as cutoff
    from generate_series(p_from,p_from+interval '11 months',interval '1 month') d
  ), capital_details as (
    select m.month,c.id,
      case
        when m.month>date_trunc('month',v_today)::date then null
        when c.starts_on>m.cutoff then 0
        when c.closed_on<=m.cutoff or c.renewed_on<=m.cutoff then 0
        when c.opening_balance is not null and c.balance_on<=m.cutoff then investors_private.balance(c.id,m.cutoff)
        when c.registered_current_capital is not null and c.registered_balance_on<=m.cutoff then c.registered_current_capital+
          coalesce((select sum(case when x.direction='in' then x.amount else -x.amount end) from movements x
            where x.contract_id=c.id and x.concept in('contribution','withdrawal','adjustment')
              and x.effective_on between c.registered_balance_on and m.cutoff),0)
        when c.principal is not null and c.starts_on<=m.cutoff then
          case when exists(select 1 from movements x where x.contract_id=c.id and x.concept='contribution' and x.effective_on=c.starts_on) then 0 else c.principal end+
          coalesce((select sum(case when x.direction='in' then x.amount else -x.amount end) from movements x
            where x.contract_id=c.id and x.concept in('contribution','withdrawal','adjustment')
              and x.effective_on between c.starts_on and m.cutoff),0)
        else null
      end as amount
    from months m cross join contracts c
  ), balances as (
    select m.month,'investor_capital_balance'::text as kind,
      case when m.month>date_trunc('month',v_today)::date or count(d.id) filter(where d.amount is null)>0 then null else coalesce(sum(d.amount),0) end as amount,
      case when m.month>date_trunc('month',v_today)::date then null else coalesce(sum(d.amount),0) end as known_amount,
      count(d.id) filter(where d.amount is null)::integer as unknown_count,
      coalesce(jsonb_agg(d.id) filter(where d.amount is null),'[]'::jsonb) as unknown_contract_ids,
      coalesce(jsonb_agg(d.id) filter(where d.amount<>0),'[]'::jsonb) as source_ids,
      coalesce(jsonb_agg(jsonb_build_object('contract_id',d.id,'amount',d.amount,'cutoff',m.cutoff)) filter(where d.amount<>0),'[]'::jsonb) as details
    from months m left join capital_details d on d.month=m.month group by m.month
  )
  select jsonb_build_object(
    'as_of',v_today,
    'contracts',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from contracts c),'[]'::jsonb),
    'movements',coalesce((select jsonb_agg(to_jsonb(m) order by m.effective_on,m.id) from movements m),'[]'::jsonb),
    'obligations',coalesce((select jsonb_agg(to_jsonb(o) order by o.due_on,o.id) from obligations o),'[]'::jsonb),
    'balances',coalesce((select jsonb_agg(to_jsonb(b) order by b.month) from balances b),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'contract_id',r.contract_id,'kind',r.kind) order by r.id)
      from investors_private.reviews r where r.resolved_at is null),'[]'::jsonb),
    'authority','SUPABASE_INVESTORS','financial_writes',0
  ) into v_result;
  return v_result;
end $function$;
do $verify$
declare p pg_proc%rowtype;begin
 select * into p from pg_proc where oid=to_regprocedure('public.get_admin_reports_jc_cash_flow_investors(date)');
 if md5(pg_get_functiondef(p.oid))<>'d52c28f82848ebdd1450ba8a657dff4c' or jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'volatility',p.provolatile,'security',p.prosecdef,'config',p.proconfig) is distinct from current_setting('reports_jc.investor_source_identity')::jsonb
 then raise exception 'REPORTS_JC_INVESTOR_SOURCE_INVARIANT';end if;
end $verify$;
notify pgrst,'reload schema';
commit;
