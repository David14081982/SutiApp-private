begin;
-- H-FLUJO-EFECTIVO-CRITERIO-001 forward: report reader performance only, no financial data writes.
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
  select p.id,p.legacy_folio,c.record_id,c.cutoff_on,
   (select min((e.enrollment_started_at at time zone 'America/Hermosillo')::date)
    from public.savings_enrollments e where e.participant_id=p.id and e.data_classification='CANONICAL') started_on,
   (select min(t.effective_date) from public.savings_transactions t where t.participant_id=p.id
    and t.data_classification='CANONICAL' and t.transaction_type='REGULARIZATION') opening_on
  from public.savings_participants p left join public.savings_balance_certifications c on c.participant_id=p.id
  where p.data_classification='CANONICAL'
 ), review_people as materialized (
  select r.id,r.source_folio,r.source_data,r.proposed_data,r.field_defs,r.source_data||r.proposed_data d,
   linked.participant_id,case when p.record_id=r.id then p.cutoff_on end cutoff_on,
   public.savings_panel_date((r.source_data||r.proposed_data)->>'F') started_on,
   (select min(public.savings_panel_date(left(f->>'label',10))) from jsonb_array_elements(r.field_defs) f
    where f->>'label' like '%Descuento registrado%') history_from,
   public.savings_panel_number(r.source_data->'Q')+coalesce(delta.amount,0) registered_balance,
   (source_batch.observed_at at time zone 'America/Hermosillo')::date registered_on
  from public.savings_review_records r
  -- A record ID or unique historical folio links the account, never a name/date coincidence.
  cross join lateral(select case when count(*)=1 then (array_agg(p.id))[1] end participant_id
   from persons p where p.record_id=r.id or p.legacy_folio=r.source_folio
    and not exists(select 1 from persons direct where direct.record_id=r.id)) linked
  left join persons p on p.id=linked.participant_id
  cross join lateral(select sum(coalesce(public.savings_panel_number((r.source_data||r.proposed_data)->(f->>'key')),0)
    -coalesce(public.savings_panel_number(r.source_data->(f->>'key')),0)) amount
   from jsonb_array_elements(r.field_defs) f
   where f->>'label' like '%Descuento registrado%' and r.source_data->>'W'='Ahorrando'
    and public.savings_panel_date(left(f->>'label',10))>=public.savings_panel_date(r.source_data->>'X')) delta
  where r.batch_id=source_batch.id and r.source_sheet='Ahorro'
 ), native_history as materialized (
  -- Same native receipt projection as workspace_history, read once for all accounts.
  select r.participant_id,'receipt:'||r.enrollment_id||':'||r.contribution_date id,
   r.contribution_date date,r.actual_amount amount,r.source,false includes_yield,r.conflict data_conflict
  from public.savings_workspace_receipts(null::uuid) r join persons p on p.id=r.participant_id
  where r.contribution_date<=present
 ), official_history as materialized (
  select r.participant_id,'registered:'||r.id||':'||(f->>'key') id,
   public.savings_panel_date(left(f->>'label',10)) date,
   public.savings_panel_number(r.d->(f->>'key')) amount,
   'savings_review_records'::text source,(f->>'key')='AR' includes_yield,false data_conflict,
   coalesce(r.participant_id::text,'review:'||r.id) account_id
  from review_people r cross join lateral jsonb_array_elements(r.field_defs) f
  where f->>'label' like '%Descuento registrado%'
   and (public.savings_panel_date(left(f->>'label',10))<=present
    or public.savings_panel_date(left(f->>'label',10)) is null)
   -- Cutoff partitions imported/native representations; it never certifies the amount.
   and (r.cutoff_on is null or public.savings_panel_date(left(f->>'label',10))<=r.cutoff_on
    or public.savings_panel_date(left(f->>'label',10)) is null)
   and public.savings_panel_number(r.d->(f->>'key')) is not null
   and not exists(select 1 from native_history n where r.cutoff_on is null
    and n.participant_id=r.participant_id and n.date=public.savings_panel_date(left(f->>'label',10)) and n.amount is not null)
 ), history_all as materialized (
  select participant_id,id,date,amount,source,includes_yield,data_conflict,account_id from official_history
  union all
  select participant_id,id,date,amount,source,includes_yield,data_conflict,participant_id::text from native_history n
  where n.amount is not null or not exists(select 1 from official_history h
   where h.participant_id=n.participant_id and h.date=n.date)
 ), history as materialized (
  select * from history_all where date between first_day and least(last_day,present) or date is null
 ), scheduled as materialized (
  select e.id enrollment_id,s.contribution_date,s.plan_id,v.instruction
  from public.savings_enrollments e join persons p on p.id=e.participant_id
  cross join lateral public.generate_savings_schedule(e.id,first_day,last_day)s
  cross join lateral(select savings_automatic_private.scheduled(e.id,s.contribution_date) instruction)v
  where e.data_classification='CANONICAL' and e.status not in ('REQUESTED','REJECTED') and s.contribution_date>present
 ), transactions_all as materialized (
  select t.*,q.withdrawal_kind from public.savings_transactions t join persons p on p.id=t.participant_id
  left join public.savings_requests q on q.data_classification='CANONICAL' and q.status='SETTLED'
   and t.idempotency_key='SAVINGS_RUNTIME_PAYMENT:'||q.id||':'||t.component
  where t.data_classification='CANONICAL' and t.effective_date<=present
 ), historical as materialized (
  select r.id,r.source_folio,r.source_data||r.proposed_data d,
   public.savings_panel_date((r.source_data||r.proposed_data)->>'D') paid_on,
   public.savings_panel_number((r.source_data||r.proposed_data)->'G') amount,
   coalesce(linked.participant_id::text,linked.review_id) account_id
  from public.savings_review_records r
  cross join lateral(select
   (select case when count(*)=1 then (array_agg(p.id))[1] end from persons p
    where p.legacy_folio=r.source_folio) participant_id,
   (select case when count(*)=1 then 'review:'||(array_agg(p.id))[1] end from review_people p
    where p.source_folio=r.source_folio and p.participant_id is null) review_id) linked
  where r.batch_id=source_batch.id and r.source_sheet='Solicitud de retiro'
   and lower(btrim(coalesce((r.source_data||r.proposed_data)->>'H','')))='completado'
   and not exists(select 1 from public.savings_requests q join public.savings_transactions t
    on t.idempotency_key='SAVINGS_RUNTIME_PAYMENT:'||q.id||':'||t.component
    where q.metadata->>'source_record_id'=r.id::text and q.data_classification='CANONICAL'
     and t.data_classification='CANONICAL' and t.transaction_type='WITHDRAWAL' and t.direction='DEBIT')
 ), historical_paid as materialized (
  select * from historical where paid_on between first_day and last_day or paid_on is null
 ), pending as materialized (
  select q.* from public.savings_requests q join persons p on p.id=q.participant_id
  where q.data_classification='CANONICAL' and q.status='APPROVED'
   and q.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL')
 ), events as materialized (
  select 'history:'||h.id id,case when h.includes_yield then 'contribution_mixed' else 'contribution' end kind,
   h.date,h.amount,case when h.amount is null or h.date is null then 'UNKNOWN' else 'RECORDED' end status,
   h.source,h.id source_id,h.includes_yield,null::text withdrawal_kind,null::text withdrawal_component
  from history h
  union all
  select 'scheduled:'||s.enrollment_id||':'||s.contribution_date,'contribution_scheduled',s.contribution_date,
   (s.instruction->>'scheduled_amount')::numeric,
   case when s.instruction->>'scheduled_amount' is null then 'UNKNOWN' else 'SCHEDULED' end,
   'savings_contribution_plans',s.plan_id::text,false,null,null from scheduled s
  union all
  select 'transaction:'||t.id,
   case when t.transaction_type='WITHDRAWAL' and t.direction='DEBIT' then
     case t.withdrawal_kind when 'PARTIAL' then 'withdrawal_partial' when 'TOTAL' then 'withdrawal_total' else 'withdrawal_unspecified' end
    when t.transaction_type='YIELD_CREDIT' and t.component='YIELD' and t.direction='CREDIT' then 'yield_credited'
    else 'adjustment' end,
   t.effective_date,
   case when t.transaction_type='WITHDRAWAL' and t.direction='DEBIT' then t.amount
    when t.direction='CREDIT' then t.amount else -t.amount end,
   'RECORDED','savings_transactions',t.id::text,false,t.withdrawal_kind,
   case when t.transaction_type='WITHDRAWAL' and t.direction='DEBIT' then t.component end
  from transactions_all t where t.effective_date>=first_day and t.effective_date<=last_day and (
   (t.transaction_type='WITHDRAWAL' and t.direction='DEBIT')
   or (t.transaction_type='YIELD_CREDIT' and t.component='YIELD' and t.direction='CREDIT')
   or (t.transaction_type in ('ADJUSTMENT','REVERSAL','HOLD_SETTLEMENT')
    and not(t.component='CAPITAL' and t.contribution_date is not null and t.enrollment_id is not null)))
  union all
  select 'historical-withdrawal:'||h.id,'withdrawal_unspecified',h.paid_on,h.amount,
   case when h.amount is null or h.paid_on is null then 'UNKNOWN'
    when h.paid_on>present then 'SCHEDULED' else 'RECORDED' end,
   'savings_review_records',h.id::text,false,null,null from historical_paid h
  union all
  select 'pending:'||q.id,'withdrawal_pending',q.effective_from,q.requested_amount,
   case when q.requested_amount is null then 'UNKNOWN' else 'SCHEDULED' end,
   'savings_requests',q.id::text,false,q.withdrawal_kind,null from pending q
 ), months as (
  select d::date as month,least((d+interval '1 month - 1 day')::date,present) cutoff
  from generate_series(first_day::timestamp,(first_day+interval '11 months')::timestamp,interval '1 month')d
 ), accounts as materialized (
  select p.id::text id,p.id participant_id,p.opening_on,
   case when count(r.id)>0 then min(r.started_on) else p.started_on end started_on,
   count(r.id)>0 imported,min(r.history_from) history_from
  from persons p left join review_people r on r.participant_id=p.id group by p.id,p.opening_on,p.started_on
  union all
  select 'review:'||r.id,null::uuid,null::date,r.started_on,true,r.history_from from review_people r where r.participant_id is null
 ), balance_entries as materialized (
  select t.participant_id::text account_id,t.effective_date date,
   case t.direction when 'CREDIT' then t.amount else -t.amount end amount,'LEDGER'::text stream
  from transactions_all t
  union all
  select h.account_id,h.date,h.amount,'HISTORY' from history_all h
  union all
  select w.account_id,w.paid_on,-w.amount,'WITHDRAWAL' from historical w
  union all
  select t.participant_id::text,t.effective_date,
   case t.direction when 'CREDIT' then t.amount else -t.amount end,'OTHER'
  from transactions_all t where t.transaction_type not in ('REGULARIZATION','CONTRIBUTION')
   and not(t.component='CAPITAL' and t.contribution_date is not null and t.enrollment_id is not null)
 ), dated_balances as materialized (
  -- One grouped join replaces four correlated scans for each account and month.
  select m.month,a.id,
   case when a.opening_on<=m.cutoff then
    coalesce(sum(e.amount) filter(where e.stream='LEDGER' and e.date>=a.opening_on),0)
    else coalesce(sum(e.amount) filter(where e.stream<>'LEDGER' and e.date is not null),0) end known_amount,
   case when a.opening_on<=m.cutoff then
    count(*) filter(where e.stream='LEDGER' and e.date>=a.opening_on and e.amount is null)>0
    else a.started_on is null
     or count(*) filter(where e.stream<>'LEDGER' and (e.amount is null or e.date is null))>0
     or (a.imported and m.cutoff>=a.started_on and (a.history_from is null or a.started_on<a.history_from)) end incomplete
  from months m cross join accounts a left join balance_entries e
   on e.account_id=a.id and (e.date<=m.cutoff or e.date is null)
  group by m.month,m.cutoff,a.id,a.opening_on,a.started_on,a.imported,a.history_from
 ), current_balances as materialized (
  -- Current canonical balances retain their existing authority; a future empty account is zero.
  select p.id::text id,b.total-coalesce(future.amount,0) amount from persons p
  cross join lateral public.savings_participant_balance(p.id)b
  cross join lateral(select sum(case t.direction when 'CREDIT' then t.amount else -t.amount end) amount
   from public.savings_transactions t where t.participant_id=p.id and t.effective_date>present) future
  union all
  -- Existing imported balances use the same source Q plus captured corrections as the savings panel.
  select 'review:'||r.id,r.registered_balance from review_people r where r.participant_id is null
 ), unassigned_balance_withdrawals as materialized (
  select m.month,count(h.id) missing from months m left join historical h
   on h.account_id is null and (h.paid_on<=m.cutoff or h.paid_on is null) group by m.month
 ), balances as materialized (
  select m.month,
   case when m.month=date_trunc('month',present)::date then
     (select case when count(*) filter(where amount is null)>0 then null else coalesce(sum(amount),0) end from current_balances)
    when m.month>date_trunc('month',present)::date or bool_or(b.incomplete) or u.missing>0 then null
    else coalesce(sum(b.known_amount),0) end amount,
   case when m.month=date_trunc('month',present)::date then (select coalesce(sum(amount),0) from current_balances)
    when m.month>date_trunc('month',present)::date then null else coalesce(sum(b.known_amount),0) end known_amount,
   case when m.month=date_trunc('month',present)::date then (select count(*) from current_balances where amount is null)
    when m.month>date_trunc('month',present)::date then 0 else count(b.id) filter(where b.incomplete)+u.missing end unknown_count
  from months m join unassigned_balance_withdrawals u using(month) left join dated_balances b using(month)
  group by m.month,u.missing
 ), issues as (
  select 'SAVINGS_HISTORICAL_IMPORT_UNAVAILABLE' code,
   'El lote histórico está incompleto; los importes oficiales disponibles se conservan. Esta observación no bloquea su uso.' message,
   '[]'::jsonb "sourceIds",'[]'::jsonb months where not import_complete
  union all
  select 'SAVINGS_MIXED_CONTRIBUTION_YIELD','Importe histórico registrado que incluye rendimiento; se conserva el total sin inventar su desglose.',
   jsonb_agg(id),jsonb_agg(distinct to_char(date,'YYYY-MM')) from history where includes_yield having count(*)>0
  union all
  select 'SAVINGS_CONTRIBUTION_NOT_RECORDED','Existen fechas de aportación sin importe registrado; se conservan los demás importes disponibles.',
   jsonb_agg(id),jsonb_agg(distinct to_char(date,'YYYY-MM')) from history where amount is null having count(*)>0
  union all
  select 'SAVINGS_CONTRIBUTION_UNDATED','Aportación registrada sin fecha utilizable; su importe se conserva aparte sin inventar un mes.',
   jsonb_agg(id),'[]'::jsonb from history where date is null having count(*)>0
  union all
  select 'SAVINGS_RECEIPT_LEDGER_DIFFERENCE','La aportación registrada y el ledger difieren; se conserva el importe registrado sin modificar el saldo.',
   jsonb_agg(id),jsonb_agg(distinct to_char(date,'YYYY-MM')) from history where data_conflict having count(*)>0
  union all
  select 'SAVINGS_SCHEDULE_UNRESOLVED','Existe una instrucción futura cuyo plan no puede resolverse; su importe permanece sin determinar.',
   jsonb_agg(enrollment_id::text||':'||contribution_date),jsonb_agg(distinct to_char(contribution_date,'YYYY-MM'))
   from scheduled where instruction->>'scheduled_amount' is null having count(*)>0
  union all
  select 'SAVINGS_HISTORICAL_WITHDRAWAL_UNRESOLVED','Retiro histórico sin fecha o importe; el importe existente se conserva sin inventar su mes.',
   jsonb_agg(id::text),coalesce(jsonb_agg(distinct to_char(paid_on,'YYYY-MM')) filter(where paid_on is not null),'[]')
   from historical_paid where amount is null or paid_on is null having count(*)>0
  union all
  select 'SAVINGS_HISTORICAL_WITHDRAWAL_FUTURE','Un retiro marcado completado tiene fecha futura; se conserva programado y no se contabiliza como pagado.',
   jsonb_agg(id::text),jsonb_agg(distinct to_char(paid_on,'YYYY-MM')) from historical_paid where paid_on>present having count(*)>0
  union all
  select 'SAVINGS_WITHDRAWAL_KIND_UNKNOWN','Hay retiros registrados sin tipo parcial o total; sus importes se muestran sin clasificar.',
   jsonb_agg(source_id),coalesce(jsonb_agg(distinct to_char(date,'YYYY-MM')) filter(where date is not null),'[]')
   from events where kind='withdrawal_unspecified' having count(*)>0
  union all
  select 'SAVINGS_PENDING_WITHDRAWAL_UNDATED','Obligaciones autorizadas sin fecha; se muestran aparte sin inventar un mes.',
   jsonb_agg(id::text),'[]'::jsonb from pending where effective_from is null having count(*)>0
  union all
  select 'SAVINGS_HISTORICAL_BALANCE_UNAVAILABLE','Faltan datos para completar algunos saldos históricos; se conserva la suma de movimientos oficiales fechados.',
   '[]'::jsonb,jsonb_agg(to_char(month,'YYYY-MM')) from balances where unknown_count>0 having count(*)>0
 )
 select jsonb_build_object('as_of',present,'events',coalesce((select jsonb_agg(to_jsonb(e) order by date nulls last,id) from events e),'[]'),
  'balances',(select jsonb_agg(to_jsonb(b) order by month) from balances b),
  'issues',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('affectedKinds',case i.code
   when 'SAVINGS_MIXED_CONTRIBUTION_YIELD' then jsonb_build_array('contribution','yield_credited')
   when 'SAVINGS_CONTRIBUTION_NOT_RECORDED' then jsonb_build_array('contribution')
   when 'SAVINGS_SCHEDULE_UNRESOLVED' then jsonb_build_array('contribution_scheduled')
   when 'SAVINGS_HISTORICAL_WITHDRAWAL_UNRESOLVED' then jsonb_build_array('withdrawal_partial','withdrawal_total','withdrawal_unspecified')
   when 'SAVINGS_PENDING_WITHDRAWAL_UNDATED' then jsonb_build_array('withdrawal_pending')
   else '[]'::jsonb end) order by code) from issues i),'[]')) into result;
 return result;
end $function$;
do $verify$
declare p pg_proc%rowtype; begin
 select * into p from pg_proc where oid=to_regprocedure('public.get_admin_reports_jc_cash_flow(date)');
 if md5(pg_get_functiondef(p.oid))<>'5bf922aa77016e0453acc141227ed944' or
  jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl) is distinct from current_setting('reports_jc.savings_before')::jsonb
 then raise exception 'REPORTS_JC_SAVINGS_REPLACEMENT_INVARIANT';end if;
end $verify$;
notify pgrst,'reload schema';
commit;
