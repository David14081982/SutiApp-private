begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- H-SAVINGS-JC-REPORT-001 · Reporte JC de Ahorro (Admin > Ahorro, Excel).
-- Read-only projection: Supabase ledger, certified pre-cutoff history and the imported
-- withdrawal records. No table, row, grant or existing function changes.
do $guard$ begin
 if to_regprocedure('public.get_admin_savings_jc_report()') is not null then
  raise exception 'SAVINGS_JC_REPORT_ALREADY_INSTALLED';
 end if;
end $guard$;

create function public.get_admin_savings_jc_report()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 -- Owner decision 2026-11-27: columns start with the first discount after the June 2026 close.
 start_on constant date:=date '2026-07-05';
 today date:=(now() at time zone 'America/Hermosillo')::date;
 result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.reports') then
  raise exception 'SAVINGS_REPORT_DENIED' using errcode='42501';
 end if;

 with part as materialized (
  select p.id,p.legacy_folio folio,p.current_process,public.savings_affiliate_display_name(p.id) nombre,
   a.financial_employee_category_code categoria
  from public.savings_participants p
  left join public.affiliates a on a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false)
  where p.data_classification='CANONICAL'
 ), cert as materialized (
  select c.participant_id,c.cutoff_on,c.record_id,
   c.source_snapshot->'source'||coalesce(c.source_snapshot->'proposal','{}'::jsonb) approved
  from public.savings_balance_certifications c join part on part.id=c.participant_id
 ), hist as materialized (
  -- Dated discounts recorded before the certification cutoff (already inside the certified opening).
  select c.participant_id,left(f->>'label',10)::date on_date,
   coalesce(public.savings_panel_number(c.approved->(f->>'key')),0) amount
  from cert c join public.savings_review_records r on r.id=c.record_id
  cross join lateral jsonb_array_elements(r.field_defs) f
  where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%'
   and left(f->>'label',10)::date between start_on and c.cutoff_on
 ), tx as materialized (
  select t.participant_id,t.transaction_type,t.contribution_date,t.idempotency_key,
   case when t.direction='CREDIT' then t.amount else -t.amount end signed,
   case
    when t.transaction_type='REGULARIZATION' then 'OPENING'
    when t.transaction_type='WITHDRAWAL' then 'WITHDRAWAL'
    when t.transaction_type in ('CONTRIBUTION','ADJUSTMENT','REVERSAL') and t.contribution_date>=start_on then 'DATED'
    when t.transaction_type in ('ADJUSTMENT','REVERSAL') and t.contribution_date is null then 'ADJUSTMENT'
    else 'UNSUPPORTED' end kind
  from public.savings_transactions t join part on part.id=t.participant_id
 ), cells as materialized (
  select participant_id,on_date,sum(amount) amount from (
   select participant_id,on_date,amount from hist
   union all select participant_id,contribution_date,signed from tx where kind='DATED') z
  group by 1,2
 ), report_dates as (
  select d::date on_date from generate_series(start_on::timestamp,today::timestamp,interval '1 day') g(d)
  where public.savings_next_contribution_date(d::date,'PROCESS_1')=d::date
   or public.savings_next_contribution_date(d::date,'JUB')=d::date
  union select on_date from cells
 ), imported as materialized (
  select r.source_row,x.d,p.id participant_id,p.current_process,c.cutoff_on,
   public.savings_panel_date(x.d->>'D') on_date,public.savings_panel_number(x.d->'G') amount
  from public.savings_review_records r
  cross join lateral (select r.source_data||coalesce(r.proposed_data,'{}'::jsonb) d) x
  left join public.savings_participants p on p.legacy_folio=x.d->>'A' and p.data_classification='CANONICAL'
  left join cert c on c.participant_id=p.id
  where r.source_sheet='Solicitud de retiro'
 ), runtime as materialized (
  select q.id,q.participant_id,q.request_type,q.withdrawal_kind,q.continue_saving,q.status,q.metadata,
   q.requested_amount,q.submitted_at,q.settled_at,p.folio,p.current_process,p.nombre,
   (select -sum(t.signed) from tx t where t.kind='WITHDRAWAL' and t.participant_id=q.participant_id
     and split_part(t.idempotency_key,':',1) in ('SAVINGS_RUNTIME_PAYMENT','SAVINGS_SETTLEMENT')
     and split_part(t.idempotency_key,':',2)=q.id::text) paid
  from public.savings_requests q join part p on p.id=q.participant_id
  where q.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL') and q.status not in ('REJECTED','CANCELLED')
 ), withdrawal_rows as materialized (
  select 'IMPORT' origen,i.source_row::bigint ord,i.participant_id,i.d->>'A' folio,
   case when upper(btrim(coalesce(i.d->>'B',''))) in ('1','3','JUB') then upper(btrim(i.d->>'B'))
    else coalesce(case i.current_process when 'PROCESS_1' then '1' when 'PROCESS_3' then '3' when 'JUB' then 'JUB' end,nullif(btrim(i.d->>'B'),'')) end proceso,
   coalesce(case when i.participant_id is not null then public.savings_affiliate_display_name(i.participant_id) end,
    (select case when count(*)=1 then max(a.full_name) end from public.affiliates a where a.numero_control=i.d->>'A' and not coalesce(a.is_archived,false)),
    'Identidad por revisar') nombre,
   i.on_date fecha,nullif(btrim(coalesce(i.d->>'E','')),'') categoria,nullif(btrim(coalesce(i.d->>'F','')),'') continua,
   i.amount monto,nullif(btrim(coalesce(i.d->>'H','')),'') estado,
   case when i.on_date is null or i.amount is null then 'INVALID'
    when i.on_date<start_on then 'INITIAL'
    when i.cutoff_on is not null and i.on_date<=i.cutoff_on then 'COLUMN'
    else 'INVALID' end aplica
  from imported i
  union all
  select 'APP',extract(epoch from r.submitted_at)::bigint,r.participant_id,r.folio,
   case coalesce(r.metadata->>'process',r.current_process) when 'PROCESS_1' then '1' when 'PROCESS_3' then '3' when 'JUB' then 'JUB' end,
   r.nombre,
   (coalesce(r.settled_at,r.submitted_at) at time zone 'America/Hermosillo')::date,
   case when r.withdrawal_kind='TOTAL' then 'Completo' when r.withdrawal_kind='PARTIAL' then 'Parcial'
    when r.withdrawal_kind='EXTRAORDINARY' or r.request_type='EXTRAORDINARY_WITHDRAWAL' then 'Extraordinario' end,
   case when r.continue_saving then 'SI' when r.continue_saving is false then 'NO' end,
   case when r.status='SETTLED' then r.paid else r.requested_amount end,
   case r.status when 'SETTLED' then 'Completado' when 'APPROVED' then 'Aprobado, sin entregar'
    when 'UNDER_REVIEW' then 'En revisión, sin entregar' else 'Solicitado, sin entregar' end,
   case when r.status<>'SETTLED' then 'PENDING' when coalesce(r.paid,0)<=0 then 'INVALID' else 'COLUMN' end
  from runtime r
 ), people as (
  select part.*,
   coalesce((select sum(signed) from tx where tx.participant_id=part.id),0) saldo,
   coalesce((select sum(signed) from tx where tx.participant_id=part.id and kind='OPENING'),0)
    -coalesce((select sum(amount) from hist where hist.participant_id=part.id),0)
    +coalesce((select sum(monto) from withdrawal_rows w where w.participant_id=part.id and w.origen='IMPORT' and w.aplica='COLUMN'),0) inicial,
   coalesce((select sum(amount) from cells where cells.participant_id=part.id),0) celdas_total,
   coalesce((select sum(monto) from withdrawal_rows w where w.participant_id=part.id and w.aplica='COLUMN'),0) retiros,
   coalesce((select sum(signed) from tx where tx.participant_id=part.id and kind='ADJUSTMENT'),0) ajustes,
   (select coalesce(jsonb_object_agg(on_date::text,amount),'{}'::jsonb) from cells where cells.participant_id=part.id and amount<>0) celdas
  from part
 )
 select jsonb_build_object(
  'today',today,'start_on',start_on,'generated_at',now(),
  'dates',(select coalesce(jsonb_agg(on_date order by on_date),'[]'::jsonb) from report_dates),
  'people',(select coalesce(jsonb_agg(jsonb_build_object('folio',folio,'nombre',nombre,
     'proceso',case current_process when 'PROCESS_1' then '1' when 'PROCESS_3' then '3' when 'JUB' then 'JUB' else current_process end,
     'categoria',categoria,'saldo',saldo,'inicial',inicial,'retiros',retiros,'ajustes',ajustes,'celdas',celdas)),'[]'::jsonb) from people),
  'withdrawals',(select coalesce(jsonb_agg(jsonb_build_object('origen',origen,'folio',folio,'proceso',proceso,'nombre',nombre,
     'fecha',fecha,'categoria',categoria,'continua',continua,'monto',monto,'estado',estado,'aplica',aplica)
     order by fecha,origen desc,ord),'[]'::jsonb) from withdrawal_rows),
  'unsupported',exists(select 1 from tx where kind='UNSUPPORTED'),
  'withdrawal_invalid',exists(select 1 from withdrawal_rows where aplica='INVALID'),
  'mismatch',exists(select 1 from people where inicial+celdas_total-retiros+ajustes<>saldo)
 ) into result;
 if (result->>'unsupported')::boolean then raise exception 'SAVINGS_JC_UNSUPPORTED_MOVEMENT';end if;
 if (result->>'withdrawal_invalid')::boolean then raise exception 'SAVINGS_JC_WITHDRAWAL_INVALID';end if;
 if (result->>'mismatch')::boolean then raise exception 'SAVINGS_JC_RECONCILIATION_FAILED';end if;
 return result-'unsupported'-'withdrawal_invalid'-'mismatch';
end $$;
revoke all on function public.get_admin_savings_jc_report() from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_jc_report() to authenticated;
comment on function public.get_admin_savings_jc_report() is
 'Reporte JC de Ahorro, savings.reports only. Ledger + certified history from 2026-07-05 + imported/runtime withdrawals. Fails instead of returning rows that do not reconcile with the ledger. No financial writes.';
notify pgrst,'reload schema';
commit;
