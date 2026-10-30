begin;
-- H-FLUJO-EFECTIVO-CRITERIO-001 recovery: report reader only, no financial data writes.
-- Same function OID, owner, ACL, authorization, STABLE/SECURITY DEFINER and empty search_path.
set local lock_timeout='2s';
set local statement_timeout='60s';
do $guard$
declare p pg_proc%rowtype; begin
 select * into p from pg_proc where oid=to_regprocedure('public.get_admin_reports_jc_cash_flow(date)');
 if p.oid is null or md5(pg_get_functiondef(p.oid))<>'94b10b95af8b16883ace97c8f85f67ab'
  or pg_get_userbyid(p.proowner)<>'postgres'
  or p.proacl::text is distinct from '{postgres=X/postgres,authenticated=X/postgres}'
 then raise exception 'REPORTS_JC_SAVINGS_DEFINITION_DRIFT';end if;
 perform set_config('reports_jc.savings_before',jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl)::text,true);
end $guard$;
create or replace function public.get_admin_reports_jc_cash_flow(p_from date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 first_day date:=p_from; last_day date; present date:=public.savings_operation_today();
 source_batch public.savings_review_batches%rowtype; source_count integer:=0; archived_count integer:=0;
 import_complete boolean:=false; result jsonb;
begin
 perform public.get_admin_reports_jc_context();
 if first_day is null or first_day<>date_trunc('month',first_day)::date
  or first_day<date '2000-01-01' or first_day>date '2100-12-01'
 then raise exception 'REPORTS_JC_CASH_FLOW_RANGE_INVALID' using errcode='22023';end if;
 last_day:=(first_day+interval '12 months - 1 day')::date;
 select * into source_batch from public.savings_review_batches where source_name='SutiApp Final'
  order by observed_at desc,created_at desc,id desc limit 1;
 if source_batch.id is not null then
  select count(*) into source_count from public.savings_review_records where batch_id=source_batch.id;
  select count(distinct removed->>'id') into archived_count
   from public.savings_registration_removal_archive a
   cross join lateral jsonb_array_elements(coalesce(a.snapshots->'savings_review_records','[]'::jsonb)) removed
   where removed->>'batch_id'=source_batch.id::text and nullif(removed->>'id','') is not null
    and not exists(select 1 from public.savings_review_records r where r.id::text=removed->>'id');
  import_complete:=source_count+archived_count=source_batch.expected_records;
 end if;

 with persons as materialized (
  select p.id,p.legacy_folio,c.cutoff_on,
   coalesce(c.cutoff_on,
    (select min(t.effective_date) from public.savings_transactions t where t.participant_id=p.id
      and t.data_classification='CANONICAL' and t.transaction_type='REGULARIZATION'),
    (select min((e.enrollment_started_at at time zone 'America/Hermosillo')::date) from public.savings_enrollments e
      where e.participant_id=p.id and e.data_classification='CANONICAL')) supported_from,
   exists(select 1 from public.savings_transactions t where t.participant_id=p.id
    and (t.data_classification<>'CANONICAL' or t.effective_date>present)) unsupported_movements
  from public.savings_participants p left join public.savings_balance_certifications c on c.participant_id=p.id
  where p.data_classification='CANONICAL'
 ), history as materialized (
  select p.id participant_id,h.* from persons p cross join lateral public.savings_workspace_history(p.id)h
  where h.date between first_day and least(last_day,present)
 ), scheduled as materialized (
  select e.id enrollment_id,s.contribution_date,s.plan_id,v.instruction
  from public.savings_enrollments e join persons p on p.id=e.participant_id
  cross join lateral public.generate_savings_schedule(e.id,first_day,last_day)s
  cross join lateral(select savings_automatic_private.scheduled(e.id,s.contribution_date) instruction)v
  where e.data_classification='CANONICAL' and e.status not in ('REQUESTED','REJECTED') and s.contribution_date>present
 ), transactions as materialized (
  select t.*,q.withdrawal_kind from public.savings_transactions t join persons p on p.id=t.participant_id
  left join public.savings_requests q on q.data_classification='CANONICAL' and q.status='SETTLED'
   and t.idempotency_key='SAVINGS_RUNTIME_PAYMENT:'||q.id||':'||t.component
  where t.data_classification='CANONICAL' and t.effective_date between first_day and least(last_day,present)
 ), historical as materialized (
  select r.id,r.source_folio,r.source_data||r.proposed_data d,
   public.savings_panel_date((r.source_data||r.proposed_data)->>'D') paid_on,
   public.savings_panel_number((r.source_data||r.proposed_data)->'G') amount
  from public.savings_review_records r where import_complete and r.batch_id=source_batch.id
   and r.source_sheet='Solicitud de retiro'
   and lower(btrim(coalesce((r.source_data||r.proposed_data)->>'H','')))='completado'
   and not exists(select 1 from public.savings_requests q where q.metadata->>'source_record_id'=r.id::text)
 ), historical_paid as materialized (
  select h.*,exists(select 1 from public.savings_transactions t join persons p on p.id=t.participant_id
   where p.legacy_folio=coalesce(nullif(h.d->>'A',''),h.source_folio)
    and t.data_classification='CANONICAL' and t.transaction_type='WITHDRAWAL' and t.effective_date=h.paid_on) possible_duplicate
  from historical h where h.paid_on between first_day and last_day or h.paid_on is null
 ), pending as materialized (
  select q.* from public.savings_requests q join persons p on p.id=q.participant_id
  where q.data_classification='CANONICAL' and q.status='APPROVED'
   and q.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL')
 ), events as materialized (
  select 'history:'||h.id id,case when h.includes_yield then 'contribution_mixed' else 'contribution' end kind,
   h.date,h.amount,case when h.amount is null then 'UNKNOWN' else 'RECORDED' end status,
   h.source,h.id source_id,h.includes_yield,null::text withdrawal_kind
  from history h
  union all
  select 'scheduled:'||s.enrollment_id||':'||s.contribution_date,'contribution_scheduled',s.contribution_date,
   (s.instruction->>'scheduled_amount')::numeric,
   case when s.instruction->>'scheduled_amount' is null then 'UNKNOWN' else 'SCHEDULED' end,
   'savings_contribution_plans',s.plan_id::text,false,null from scheduled s
  union all
  select 'transaction:'||t.id,
   case when t.transaction_type='WITHDRAWAL' and t.direction='DEBIT' then
     case t.withdrawal_kind when 'PARTIAL' then 'withdrawal_partial' when 'TOTAL' then 'withdrawal_total' else 'withdrawal_unspecified' end
    when t.transaction_type='YIELD_CREDIT' and t.component='YIELD' and t.direction='CREDIT' then 'yield_credited'
    else 'adjustment' end,
   t.effective_date,
   case when t.transaction_type='WITHDRAWAL' and t.direction='DEBIT' then t.amount
    when t.direction='CREDIT' then t.amount else -t.amount end,
   'RECORDED','savings_transactions',t.id::text,false,t.withdrawal_kind
  from transactions t where
   (t.transaction_type='WITHDRAWAL' and t.direction='DEBIT')
   or (t.transaction_type='YIELD_CREDIT' and t.component='YIELD' and t.direction='CREDIT')
   or (t.transaction_type in ('ADJUSTMENT','REVERSAL','HOLD_SETTLEMENT')
    -- Dated contribution corrections are already netted once in history.
    and not(t.component='CAPITAL' and t.contribution_date is not null and t.enrollment_id is not null))
  union all
  select 'historical-withdrawal:'||h.id,'withdrawal_unspecified',h.paid_on,
   case when h.possible_duplicate or h.amount is null or h.amount<0 or h.paid_on>present or h.paid_on is null then null else h.amount end,
   case when h.possible_duplicate or h.amount is null or h.amount<0 or h.paid_on>present or h.paid_on is null then 'UNKNOWN' else 'RECORDED' end,
   'savings_review_records',h.id::text,false,null from historical_paid h
  union all
  select 'pending:'||q.id,'withdrawal_pending',
   q.effective_from,q.requested_amount,
   case when q.requested_amount is null then 'UNKNOWN' else 'SCHEDULED' end,
   'savings_requests',q.id::text,false,q.withdrawal_kind from pending q
 ), months as (
  select d::date as month,least((d+interval '1 month - 1 day')::date,present) cutoff
  from generate_series(first_day::timestamp,(first_day+interval '11 months')::timestamp,interval '1 month')d
 ), balances_per_person as materialized (
  select m.month,p.id,p.supported_from,p.unsupported_movements,m.cutoff,
   coalesce(sum(case t.direction when 'CREDIT' then t.amount else -t.amount end),0) amount
  from months m cross join persons p left join public.savings_transactions t
   on t.participant_id=p.id and t.data_classification='CANONICAL' and t.effective_date<=m.cutoff
  group by m.month,p.id,p.supported_from,p.unsupported_movements,m.cutoff
 ), current_balances as materialized (
  -- The current balance already has a productive authority. A future start
  -- with an empty ledger is its valid zero, not an unknown historical opening.
  select p.id,b.total amount from persons p cross join lateral public.savings_participant_balance(p.id)b
 ), balances as materialized (
  select m.month,
   case when m.month=date_trunc('month',present)::date then
     (select case when count(*) filter(where amount is null)>0 then null else coalesce(sum(amount),0) end from current_balances)
    when m.month>date_trunc('month',present)::date or count(b.id) filter(where b.supported_from is null or b.supported_from>b.cutoff or b.unsupported_movements)>0
    then null else coalesce(sum(b.amount),0) end amount,
   case when m.month=date_trunc('month',present)::date then (select coalesce(sum(amount),0) from current_balances)
    when m.month>date_trunc('month',present)::date then null
    else coalesce(sum(b.amount) filter(where b.supported_from<=b.cutoff and not b.unsupported_movements),0) end known_amount,
   case when m.month=date_trunc('month',present)::date then (select count(*) from current_balances where amount is null)
    when m.month>date_trunc('month',present)::date then 0
    else count(b.id) filter(where b.supported_from is null or b.supported_from>b.cutoff or b.unsupported_movements) end unknown_count
  from months m left join balances_per_person b using(month) group by m.month
 ), issues as (
  select 'SAVINGS_HISTORICAL_IMPORT_UNAVAILABLE' code,
   'El historial de retiros no tiene un lote completo; los importes canónicos se conservan y la cobertura histórica queda pendiente.' message,
   '[]'::jsonb "sourceIds",'[]'::jsonb months where not import_complete
  union all
  select 'SAVINGS_MIXED_CONTRIBUTION_YIELD','Importe histórico registrado que incluye rendimiento; no se inventa su desglose.',
   jsonb_agg(id),jsonb_agg(distinct to_char(date,'YYYY-MM')) from history where includes_yield having count(*)>0
  union all
  select 'SAVINGS_CONTRIBUTION_NOT_RECORDED','Existen fechas de aportación sin importe registrado; no se sustituyen por cero.',
   jsonb_agg(id),jsonb_agg(distinct to_char(date,'YYYY-MM')) from history where amount is null having count(*)>0
  union all
  select 'SAVINGS_RECEIPT_LEDGER_DIFFERENCE','La aportación registrada y el ledger difieren; se conserva el importe registrado sin modificar el saldo.',
   jsonb_agg(id),jsonb_agg(distinct to_char(date,'YYYY-MM')) from history where data_conflict having count(*)>0
  union all
  select 'SAVINGS_SCHEDULE_UNRESOLVED','Existe una instrucción futura cuyo plan no puede resolverse; su importe permanece sin determinar.',
   jsonb_agg(enrollment_id::text||':'||contribution_date),jsonb_agg(distinct to_char(contribution_date,'YYYY-MM'))
   from scheduled where instruction->>'scheduled_amount' is null having count(*)>0
  union all
  select 'SAVINGS_HISTORICAL_WITHDRAWAL_UNRESOLVED','Retiro histórico sin fecha o importe suficiente, futuro marcado completado o posible coincidencia con el ledger; no se suma como salida confirmada.',
   jsonb_agg(id::text),coalesce(jsonb_agg(distinct to_char(paid_on,'YYYY-MM')) filter(where paid_on is not null),'[]')
   from historical_paid where possible_duplicate or amount is null or amount<0 or paid_on is null or paid_on>present having count(*)>0
  union all
  select 'SAVINGS_WITHDRAWAL_KIND_UNKNOWN','Hay retiros registrados cuyo tipo parcial o total no está documentado; se muestran sin clasificar.',
   jsonb_agg(source_id),coalesce(jsonb_agg(distinct to_char(date,'YYYY-MM')) filter(where date is not null),'[]')
   from events where kind='withdrawal_unspecified' having count(*)>0
  union all
  select 'SAVINGS_PENDING_WITHDRAWAL_UNDATED','Obligaciones autorizadas sin fecha; se muestran aparte sin inventar un mes.',
   jsonb_agg(id::text),'[]'::jsonb from pending where effective_from is null having count(*)>0
  union all
  select 'SAVINGS_HISTORICAL_BALANCE_UNAVAILABLE','El saldo mensual completo no está respaldado para todas las cuentas; se conserva el subtotal conocido.',
   '[]'::jsonb,jsonb_agg(to_char(month,'YYYY-MM')) from balances where unknown_count>0 having count(*)>0
 )
 select jsonb_build_object('as_of',present,'events',coalesce((select jsonb_agg(to_jsonb(e) order by date nulls last,id) from events e),'[]'),
  'balances',(select jsonb_agg(to_jsonb(b) order by month) from balances b),
  'issues',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('affectedKinds',case i.code
   when 'SAVINGS_HISTORICAL_IMPORT_UNAVAILABLE' then jsonb_build_array('withdrawal_partial','withdrawal_total','withdrawal_unspecified')
   when 'SAVINGS_MIXED_CONTRIBUTION_YIELD' then jsonb_build_array('contribution','yield_credited')
   when 'SAVINGS_CONTRIBUTION_NOT_RECORDED' then jsonb_build_array('contribution')
   when 'SAVINGS_SCHEDULE_UNRESOLVED' then jsonb_build_array('contribution_scheduled')
   when 'SAVINGS_HISTORICAL_WITHDRAWAL_UNRESOLVED' then jsonb_build_array('withdrawal_partial','withdrawal_total','withdrawal_unspecified')
   when 'SAVINGS_WITHDRAWAL_KIND_UNKNOWN' then jsonb_build_array('withdrawal_partial','withdrawal_total')
   when 'SAVINGS_PENDING_WITHDRAWAL_UNDATED' then jsonb_build_array('withdrawal_pending')
   else '[]'::jsonb end) order by code) from issues i),'[]')) into result;
 return result;
end $function$;
do $verify$
declare p pg_proc%rowtype; begin
 select * into p from pg_proc where oid=to_regprocedure('public.get_admin_reports_jc_cash_flow(date)');
 if md5(pg_get_functiondef(p.oid))<>'544ddf4e1946ff5cf5ea760bf154fc58' or
  jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl) is distinct from current_setting('reports_jc.savings_before')::jsonb
 then raise exception 'REPORTS_JC_SAVINGS_REPLACEMENT_INVARIANT';end if;
end $verify$;
notify pgrst,'reload schema';
commit;
