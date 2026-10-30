begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- Additive read model. The Inversores writers, schedules and private tables remain unchanged.
create or replace function public.get_admin_reports_jc_cash_flow_investors(p_from date) returns jsonb
language plpgsql stable security definer set search_path='' as $investor_flow$
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
      (select min((a.created_at at time zone 'America/Hermosillo')::date)
        from investors_private.audit a where a.entity='contract' and a.entity_id=c.id and a.action='close') as closed_on,
      (select min(child.starts_on) from investors_private.contracts child where child.parent_id=c.id) as renewed_on,
      case when c.balance_on<=v_today then investors_private.balance(c.id,v_today) end as balance,
      coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'effective_on',t.effective_on,'monthly_rate',t.monthly_rate) order by t.effective_on)
        from investors_private.terms t where t.contract_id=c.id),'[]'::jsonb) as terms
    from investors_private.contracts c
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
        -- Historical is an archive state, not proof of the month a principal return occurred.
        -- At today's cut it is excluded exactly as in the existing Inversores current summary.
        when m.cutoff=v_today and c.status='historical' and coalesce(c.source_status,'')<>'Vigente' then 0
        when c.status='review' or c.starts_on is null or c.balance_on is null or c.balance_on>m.cutoff
          or (c.status='closed' and c.closed_on is null) or (c.status='renewed' and c.renewed_on is null)
          or c.status='historical' then null
        else investors_private.balance(c.id,m.cutoff)
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
end $investor_flow$;
revoke all on function public.get_admin_reports_jc_cash_flow_investors(date) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_reports_jc_cash_flow_investors(date) to authenticated;
comment on function public.get_admin_reports_jc_cash_flow_investors(date) is 'H-FLUJO-EFECTIVO-CONSOLIDADO-001: financial-only Inversores read model, existing Reports JC guard, no source or schedule writes.';
notify pgrst,'reload schema';
commit;
