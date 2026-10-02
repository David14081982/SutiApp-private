begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Read-only payroll projection. Certified history before cutoff; dated plans after it.
-- No receipt, balance, enrollment, plan or legacy writer is changed.
create function public.get_admin_savings_rh_report(p_type text,p_year integer,p_month integer default null,p_day integer default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare first_on date; last_on date; result jsonb; history_start date;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.reports') then
  raise exception 'SAVINGS_REPORT_DENIED' using errcode='42501';
 end if;
 if p_type is null or p_type not in ('mensual','anual') or p_year is null or p_year not between 2000 and 2100 then
  raise exception 'SAVINGS_RH_SELECTION_INVALID' using errcode='22023';
 end if;
 if p_type='mensual' then
  if p_month is null or p_month not between 1 and 12 or p_day is null or p_day not in (5,15,28,30) then
   raise exception 'SAVINGS_RH_DATE_INVALID' using errcode='22023';
  end if;
  begin first_on:=make_date(p_year,p_month,p_day);
  exception when datetime_field_overflow then raise exception 'SAVINGS_RH_DATE_INVALID' using errcode='22023';end;
  last_on:=first_on;
 else first_on:=make_date(p_year,1,1);last_on:=make_date(p_year,12,31);end if;

 -- Earlier annual totals cannot reconstruct a payroll date. Never divide balances.
 select min(date_trunc('month',left(f->>'label',10)::date)::date) into history_start
 from public.savings_balance_certifications c join public.savings_review_records r on r.id=c.record_id
 cross join lateral jsonb_array_elements(r.field_defs) f
 where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%';
 if history_start is not null and first_on<history_start then raise exception 'SAVINGS_RH_HISTORY_UNAVAILABLE';end if;

 with certified as materialized (
  select c.*,c.source_snapshot->'source'||coalesce(c.source_snapshot->'proposal','{}'::jsonb) approved,
   r.field_defs,case upper(coalesce(c.command->>'process',c.source_snapshot->'source'->>'D'))
    when '1' then 'PROCESS_1' when '3' then 'PROCESS_3'
    else upper(coalesce(c.command->>'process',c.source_snapshot->'source'->>'D')) end process
  from public.savings_balance_certifications c join public.savings_review_records r on r.id=c.record_id
  join public.savings_participants p on p.id=c.participant_id and p.data_classification='CANONICAL'
 ), historical_cells as (
  select c.participant_id,c.enrollment_id,c.process,left(f->>'label',10)::date date,
   f->>'key' field,c.approved->(f->>'key') raw,
   public.savings_panel_number(c.approved->(f->>'key')) amount,
   public.savings_panel_number(c.approved->'DT') included_yield,
   public.savings_panel_date(c.approved->>'X') jub_start
  from certified c cross join lateral jsonb_array_elements(c.field_defs) f
  where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%'
   -- Owner confirmed AB (15 January 2026) is opening balance, not a payroll deduction.
   and f->>'key'<>'AB'
   and left(f->>'label',10)::date between first_on and least(last_on,c.cutoff_on)
   and (c.process='JUB' and substring(f->>'label',9,2)='05'
    or c.process in ('PROCESS_1','PROCESS_3') and substring(f->>'label',9,2)<>'05')
 ), historical as (
  select participant_id,enrollment_id,process,date,jub_start,
   case when field='AR' and amount>0 then amount-included_yield else amount end amount,
   (amount is null and coalesce(raw#>>'{}','') not in ('','-'))
    or (field='AR' and amount>0 and (included_yield is null or included_yield<0 or included_yield>amount)) invalid,
   false conflict
  from historical_cells
 ), scheduled as (
  select e.participant_id,e.id enrollment_id,cp.process_snapshot process,d.date::date date,cp.amount,
   coalesce(public.savings_panel_date(c.approved->>'X'),e.first_expected_contribution_date) jub_start,
   cp.amount is null or cp.amount<0 or cp.amount<>round(cp.amount,2) invalid,
   count(*) over(partition by e.participant_id,d.date)>1 conflict
  from public.savings_enrollments e
  join public.savings_participants p on p.id=e.participant_id and p.data_classification='CANONICAL'
  left join certified c on c.participant_id=p.id
  cross join lateral generate_series(first_on::timestamp,last_on::timestamp,interval '1 day') d(date)
  join public.savings_contribution_plans cp on cp.enrollment_id=e.id and cp.data_classification='CANONICAL'
   and cp.effective_from<=d.date::date and (cp.effective_to is null or cp.effective_to>=d.date::date)
  where e.data_classification='CANONICAL' and e.status in ('ACTIVE','TERMINATED')
   and d.date::date>=e.first_expected_contribution_date
   and (e.terminated_at is null or d.date::date<(e.terminated_at at time zone 'America/Hermosillo')::date)
   and (c.id is null or d.date::date>c.cutoff_on)
   and public.savings_next_contribution_date(d.date::date,cp.process_snapshot)=d.date::date
 ), instructions as (
  select participant_id,enrollment_id,process,date,jub_start,amount,invalid,conflict from historical
  union all select participant_id,enrollment_id,process,date,jub_start,amount,invalid,conflict from scheduled
 ), checked as (
  select i.*,p.legacy_folio folio,a.full_name name,
   p.identity_status='RESOLVED' and nullif(btrim(p.legacy_folio),'') is not null
    and a.id is not null and nullif(btrim(a.full_name),'') is not null
    and (select count(*) from public.affiliates other where other.numero_control=p.legacy_folio and not coalesce(other.is_archived,false))=1 identity_ok,
   row_number() over(partition by p.id,i.process order by i.date desc,i.enrollment_id) latest
  from instructions i join public.savings_participants p on p.id=i.participant_id
  left join public.affiliates a on a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false)
  where i.amount>0 or i.invalid or i.amount<0 or i.conflict
 ), selected as (
  select *,extract(year from date)::integer::text||lpad((extract(month from date)::integer*2-case when extract(day from date)<=15 then 1 else 0 end)::text,3,'0') quincena
  from checked where p_type='mensual' or process='PROCESS_3' or latest=1
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object(
  'Clave',case when process='JUB' then '580' else '573' end,
  'Proceso',case process when 'JUB' then 'JUB' when 'PROCESS_1' then 'proceso 1' when 'PROCESS_3' then 'proceso 3' end,
  'Folio',folio,'Nombre',btrim(name),'Monto',amount,
  'Inicio',case when process<>'JUB' then quincena when p_type='mensual' then to_char(jub_start,'DD/MM/YYYY')
   else extract(year from jub_start)::integer::text||lpad((extract(month from jub_start)::integer*2-case when extract(day from jub_start)<=15 then 1 else 0 end)::text,3,'0') end,
  'Final',case process when 'JUB' then '' when 'PROCESS_1' then '2999999' else quincena end)
  order by date,name,folio) from selected),'[]'::jsonb),
  'identity_invalid',exists(select 1 from checked where identity_ok is not true),
  'amount_invalid',exists(select 1 from checked where invalid or amount<0 or amount<>round(amount,2)),
  'plan_conflict',exists(select 1 from checked where conflict or process not in ('JUB','PROCESS_1','PROCESS_3') or process='JUB' and jub_start is null)) into result;
 if (result->>'identity_invalid')::boolean then raise exception 'SAVINGS_RH_IDENTITY_INVALID';end if;
 if (result->>'amount_invalid')::boolean then raise exception 'SAVINGS_RH_AMOUNT_INVALID';end if;
 if (result->>'plan_conflict')::boolean then raise exception 'SAVINGS_RH_PLAN_CONFLICT';end if;
 return jsonb_build_object('type',p_type,'year',p_year,'from',first_on,'to',last_on,'rows',result->'rows');
end $$;
revoke all on function public.get_admin_savings_rh_report(text,integer,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_rh_report(text,integer,integer,integer) to authenticated;
comment on function public.get_admin_savings_rh_report(text,integer,integer,integer) is
 'RH instructions, savings.reports only. Positive amounts; certified history excludes AB opening balance and AR embedded DT yield; dated plans after cutoff. No financial writes.';
notify pgrst,'reload schema';
commit;
