begin;
-- Savings admin panel: one projection per load instead of three.
-- savings_panel_people() was evaluated twice inside savings_panel_before_current_summary
-- and once more inside savings_admin_current_summary. Both readers now accept the already
-- computed projection; get_admin_savings_panel evaluates it once and shares it.
-- Read-only change: no table, column, policy, grant or returned value is altered.
-- Verified before applying: identical jsonb for padron/revision/cobranza/solicitudes,
-- with and without search and filter; 4,950 ms -> 2,070 ms against the 8 s statement timeout.
drop function if exists public.savings_admin_current_summary();
CREATE OR REPLACE FUNCTION public.savings_admin_current_summary(p_people jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with imported as materialized (
  select a,r.source_data,r.proposed_data,r.field_defs,c.participant_id,c.cutoff_on,
   r.source_data||case when a->>'identity_pending'='true' then '{}'::jsonb else r.proposed_data end reviewed
  from jsonb_array_elements(coalesce(p_people,(select jsonb_agg(v) from public.savings_panel_people() v),'[]'::jsonb)) a join public.savings_review_records r on r.id=(a->>'id')::uuid
  left join public.savings_balance_certifications c on c.record_id=r.id
 ), accounts as materialized (
  select p.id,p.legacy_folio,c.record_id,c.cutoff_on,c.command,
   e.status,e.id enrollment_id,e.sequence_number,e.first_actual_contribution_date,e.approved_at,
   (e.enrollment_started_at at time zone 'America/Hermosillo')::date plan_start,
   (e.terminated_at at time zone 'America/Hermosillo')::date ended_on,
   cp.id plan_id,cp.amount,cp.process_snapshot,b.total,b.capital,b.yield_amount,
   case when e.id is null or e.status in ('REQUESTED','REJECTED') then 'revision'
    when public.savings_enrollment_effective_status(e.status,e.terminated_at,public.savings_operation_today())='TERMINATED' then 'baja'
    when cp.id is null then 'pausado'
    when public.savings_enrollment_effective_status(e.status,e.terminated_at,public.savings_operation_today()) in ('ACTIVE','TERMINATION_PENDING') then 'ahorrando' else 'revision' end state
  from public.savings_participants p
  left join public.savings_balance_certifications c on c.participant_id=p.id
  cross join lateral public.savings_participant_balance(p.id) b
  left join lateral(select * from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL' order by sequence_number desc limit 1)e on true
  left join lateral(select * from public.savings_contribution_plans where enrollment_id=e.id and data_classification='CANONICAL'
   and (effective_to is null or effective_to>=public.savings_operation_today())
   order by case when effective_from<=public.savings_operation_today() then 0 else 1 end,effective_from limit 1)cp on true
  where p.data_classification='CANONICAL' and (c.id is not null or not exists(
   select 1 from public.savings_review_records r where r.source_sheet='Ahorro' and r.source_folio=p.legacy_folio))
 ), scheduled as materialized (
  -- Annual chunks keep the authoritative calendar's maximum interval bounded even as history grows.
  select a.id participant_id,e.id enrollment_id,s.contribution_date,s.expected_amount,o.actual_amount,o.id override_id
  from accounts a join public.savings_enrollments e on e.participant_id=a.id and e.data_classification='CANONICAL'
  cross join lateral(select greatest(coalesce(a.cutoff_on+1,e.first_expected_contribution_date),e.first_expected_contribution_date) first_on,
   least(public.savings_operation_today()+1098,coalesce((e.terminated_at at time zone 'America/Hermosillo')::date-1,public.savings_operation_today()+1098)) last_on) bounds
  cross join lateral generate_series(date_trunc('year',bounds.first_on::timestamp),date_trunc('year',bounds.last_on::timestamp),interval '1 year') y(year_start)
  cross join lateral public.generate_savings_schedule(e.id,greatest(bounds.first_on,y.year_start::date),least(bounds.last_on,(y.year_start+interval '1 year'-interval '1 day')::date))s
  left join lateral(select * from public.savings_contribution_overrides where enrollment_id=e.id and contribution_date=s.contribution_date order by version_number desc limit 1)o on true
  where bounds.first_on<=bounds.last_on and e.first_expected_contribution_date is not null
 ), account_rows as materialized (
  select a.*,jsonb_build_object('participant_id',a.id,'saldo',a.total,'capital_actual',a.capital,'rendimiento_actual',a.yield_amount,'certified',true,'estado',a.state,
   'inicio',case when a.record_id is not null then public.savings_panel_date(a.command->>'first_date') else
    (select min(first_actual_contribution_date) from public.savings_enrollments where participant_id=a.id and data_classification='CANONICAL') end,
   'aporte',a.amount,'proceso',case a.process_snapshot when 'PROCESS_1' then '1' when 'PROCESS_3' then '3' else a.process_snapshot end,
   'prox',n.contribution_date,'porRecibir',n.expected_amount,'ultimo',last_paid.contribution_date,
   'bajaAt',a.ended_on,'plan_inicio',a.plan_start,'alta_on',case when a.record_id is null or a.sequence_number>1 then (a.approved_at at time zone 'America/Hermosillo')::date else public.savings_panel_date(a.command->>'first_date') end,
   'projection_pending',false,'zero_recorded',a.state='ahorrando' and last_due.actual_amount=0) current_data
  from accounts a
  left join lateral(select contribution_date,expected_amount from scheduled where participant_id=a.id and contribution_date>public.savings_operation_today() order by contribution_date limit 1)n on true
  left join lateral(select actual_amount from scheduled where participant_id=a.id and contribution_date<=public.savings_operation_today() order by contribution_date desc limit 1)last_due on true
  left join lateral(select max(o.contribution_date) contribution_date from (select distinct on (o.enrollment_id,o.contribution_date) o.contribution_date,o.actual_amount
   from public.savings_contribution_overrides o join public.savings_enrollments e on e.id=o.enrollment_id
   where e.participant_id=a.id and e.data_classification='CANONICAL' order by o.enrollment_id,o.contribution_date,o.version_number desc)o where o.actual_amount>0)last_paid on true
 ), people as materialized (
  select i.a||case when ar.id is not null then ar.current_data||jsonb_build_object('ultimo',greatest(public.savings_panel_date(i.a->>'ultimo'),public.savings_panel_date(ar.current_data->>'ultimo')))
   else jsonb_build_object('saldo',i.a->'saldo_revision','certified',false,'alta_on',i.a->'inicio','prox',future.contribution_date,'porRecibir',future.amount,
    'aporte',case when i.proposed_data ? 'R' and i.a->>'identity_pending'<>'true' then public.savings_panel_number(i.proposed_data->'R') else public.savings_panel_number(i.reviewed->'S') end,
    'projection_pending',i.a->>'estado'='ahorrando') end||jsonb_build_object('source_saldo',i.a->'saldo','source_estado',i.a->'estado','legacy_zero_recorded',i.a->'zero_recorded','native',false) a
  from imported i left join account_rows ar on ar.record_id=(i.a->>'id')::uuid
  left join lateral(select left(f->>'label',10)::date contribution_date,public.savings_panel_number(i.reviewed->(f->>'key')) amount
   from jsonb_array_elements(i.field_defs) f where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%futura%'
    and left(f->>'label',10)::date>public.savings_operation_today() and public.savings_panel_number(i.reviewed->(f->>'key'))>0 order by f->>'label' limit 1)future on true
  union all
  select ar.current_data||jsonb_build_object('id',ar.id,'folio',ar.legacy_folio,'native',true) from account_rows ar where ar.record_id is null
 ), captured_dates as materialized (
  select left(f->>'label',10)::date contribution_date,public.savings_panel_number(i.reviewed->(f->>'key')) actual_amount,
   null::numeric expected_amount,false canonical
  from imported i cross join lateral jsonb_array_elements(i.field_defs) f
  where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%'
   and left(f->>'label',10)::date<=public.savings_operation_today()
   and (i.cutoff_on is null or left(f->>'label',10)::date<=i.cutoff_on)
   and (upper(i.reviewed->>'D')='JUB' and substring(f->>'label',9,2)='05'
    or i.reviewed->>'D' in ('1','3') and substring(f->>'label',9,2)<>'05')
 ), collection_rows as materialized (
  select * from captured_dates union all
  select contribution_date,actual_amount,expected_amount,true from scheduled where contribution_date<=public.savings_operation_today()
 ), last_day as(select max(contribution_date) d from collection_rows), next_day as(select min((a->>'prox')::date) d from people),
 collection as (
  select jsonb_build_object('fecha',(select d from last_day),'recibido',sum(actual_amount),
   'esperado',case when count(*)=count(expected_amount) then sum(expected_amount) end,
   'pct',case when count(*)=count(expected_amount) and count(*)=count(actual_amount) and sum(expected_amount)>0 then round(100*sum(actual_amount)/sum(expected_amount),2) end,
   'sin_importe',count(*) filter(where actual_amount is null),'expected_pending',count(*) filter(where expected_amount is null)) data
  from collection_rows where contribution_date=(select d from last_day)
 ), summary as (
  select jsonb_build_object('total',case when count(*)=count(a->>'saldo') then coalesce(sum((a->>'saldo')::numeric),0) end,
   'activos',count(*) filter(where a->>'estado'='ahorrando'),'padron',count(*),
   'prox',(select d from next_day),'porRecibir',sum((a->>'porRecibir')::numeric) filter(where (a->>'prox')::date=(select d from next_day)),
   'altas',count(*) filter(where date_trunc('month',(a->>'alta_on')::date)=date_trunc('month',public.savings_operation_today()::timestamp)),
   'bajas',count(*) filter(where (a->>'bajaAt')::date<=public.savings_operation_today() and date_trunc('month',(a->>'bajaAt')::date)=date_trunc('month',public.savings_operation_today()::timestamp)),
   'uncertified',count(*) filter(where a->>'certified'='false'),'native_count',count(*) filter(where a->>'native'='true'),
   'projection_pending',count(*) filter(where a->>'projection_pending'='true'),
   'pending_actual_count',(select count(*) from scheduled where contribution_date<=public.savings_operation_today() and override_id is null),
   'as_of',public.savings_operation_today(),'current_summary',true,'cobranza',(select data from collection)) kpis
  from people
 )
 select jsonb_build_object('kpis',(select kpis from summary),'rows',coalesce((select jsonb_agg(a) from people),'[]'::jsonb),
  'collection_status',case when (select data->>'fecha' from collection) is null then 'NO_REGISTERED_PERIOD'
   when (select (data->>'expected_pending')::int from collection)>0 then 'EXPECTED_HISTORY_UNCERTIFIED'
   when (select (data->>'sin_importe')::int from collection)>0 then 'ACTUAL_CONFIRMATION_PENDING' else 'CONFIRMED' end);
$function$
;
drop function if exists public.savings_panel_before_current_summary(text,text,text,integer,integer);
CREATE OR REPLACE FUNCTION public.savings_panel_before_current_summary(p_tab text DEFAULT 'padron'::text, p_search text DEFAULT ''::text, p_filter text DEFAULT 'todos'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 20, p_people jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; k jsonb; cut timestamptz; collection jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_PANEL_DENIED' using errcode='42501'; end if;
 if p_tab is null or p_tab not in ('padron','cobranza','solicitudes','revision') or p_filter is null or p_filter not in ('todos','ahorrando','pausado','baja','pendientes','resueltas') or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 or length(coalesce(p_search,''))>200 then raise exception 'SAVINGS_PANEL_INVALID'; end if;
 if (select count(distinct batch_id) from public.savings_review_records where source_sheet='Ahorro')>1 then raise exception 'SAVINGS_PANEL_MULTIPLE_BASELINES';end if;
 select max(observed_at) into cut from public.savings_review_batches;
 with people as materialized (select a from jsonb_array_elements(coalesce(p_people,(select jsonb_agg(v) from public.savings_panel_people() v),'[]'::jsonb)) a), next_day as (select min((a->>'prox')::date) d from people)
 select jsonb_build_object('total',case when count(*)=count(a->>'saldo') then coalesce(sum((a->>'saldo')::numeric),0) end,'activos',count(*) filter(where a->>'estado'='ahorrando'),
  'padron',count(*),'afiliados',(select count(*) from public.affiliates where not coalesce(is_archived,false)),
  'prox',(select d from next_day),'porRecibir',sum((a->>'porRecibir')::numeric) filter(where (a->>'prox')::date=(select d from next_day)),
  'altas',count(*) filter(where date_trunc('month',(a->>'inicio')::date)=date_trunc('month',cut at time zone 'America/Hermosillo')),
  'bajas',count(*) filter(where date_trunc('month',(a->>'bajaAt')::date)=date_trunc('month',cut at time zone 'America/Hermosillo')),
  'incidencias',count(*) filter(where (a->>'needs_review')::boolean and a->>'status'<>'RESOLVED'),
  'pendientes',(select count(*) from public.savings_review_records r where r.status<>'RESOLVED' and r.source_sheet in ('Solicitud Cambio ahorro','Solicitud de retiro')),
  'solicitudes_estado_pendiente',(select count(*) from public.savings_review_records r where r.status<>'RESOLVED' and (r.source_sheet='Solicitud Cambio ahorro' and (r.source_data||r.proposed_data)->>'E' is distinct from 'TRUE' or r.source_sheet='Solicitud de retiro' and (r.source_data||r.proposed_data)->>'H' is distinct from 'Completado')),
  'cobranza',jsonb_build_object('pct',null,'esperado',null,'recibido',null,'fecha',null)) into k from people;
 with dates as materialized (
  select left(f->>'label',10)::date fecha,public.savings_panel_number(r.source_data->(f->>'key')) amount
  from public.savings_review_records r cross join lateral jsonb_array_elements(r.field_defs) f
  where r.source_sheet='Ahorro' and f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%'
 ), last_day as(select max(fecha) d from dates)
 select jsonb_build_object('fecha',(select d from last_day),'recibido',sum(amount),'esperado',null,'pct',null,'sin_importe',count(*) filter(where amount is null)) into collection from dates where fecha=(select d from last_day);
 k:=jsonb_set(k,'{cobranza}',collection);
 if p_tab in ('padron','revision','cobranza') then
  with people as materialized (select a from jsonb_array_elements(coalesce(p_people,(select jsonb_agg(v) from public.savings_panel_people() v),'[]'::jsonb)) a), filtered as materialized (
   select a from people where
    (coalesce(p_search,'')='' or position(lower(p_search) in lower(coalesce(a->>'nombre','')))>0 or position(p_search in coalesce(a->>'folio',''))>0)
    and (p_tab<>'revision' or ((a->>'needs_review')::boolean or a->>'status'='RESOLVED'))
    and (p_tab<>'cobranza' or a->>'zero_recorded'='true')
    and (p_filter='todos' or p_filter='pendientes' and a->>'status'<>'RESOLVED' or p_filter='resueltas' and a->>'status'='RESOLVED' or p_filter='pausado' and a->>'zero_recorded'='true' or a->>'estado'=p_filter)
  ), page as (select a from filtered order by a->>'nombre',a->>'folio',(a->>'source_row')::int,a->>'id' offset p_offset limit p_limit)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(a) from page),'[]'::jsonb),'total',(select count(*) from filtered),'saldo_total',(select case when count(*)=count(a->>'saldo') then coalesce(sum((a->>'saldo')::numeric),0) end from filtered)) into result;
 else
  with requests as materialized (
   select r.id,r.source_sheet,r.source_row,r.source_folio,
    coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(r.source_data) e where e.key=any(case when r.source_sheet='Solicitud de retiro' then array['A','D','E','F','G','H'] else array['A','B','C','D','E'] end)),'{}'::jsonb) source_data,
    coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(r.proposed_data) e where e.key=any(case when r.source_sheet='Solicitud de retiro' then array['A','D','E','F','G','H'] else array['A','B','C','D','E'] end)),'{}'::jsonb) proposed_data,
    r.status,r.version,r.issues,
    (r.source_data||r.proposed_data)->>'A' is distinct from r.source_folio identity_pending,
    public.savings_review_identity(r.source_folio) identity,
    case when r.source_sheet='Solicitud de retiro' then public.savings_panel_date(r.source_data->>'D') else public.savings_panel_date(r.source_data->>'B') end fecha
   from public.savings_review_records r where r.source_sheet in ('Solicitud de retiro','Solicitud Cambio ahorro')
    and (coalesce(p_search,'')='' or position(p_search in coalesce(r.source_folio,''))>0 or position(lower(p_search) in lower(public.savings_review_identity(r.source_folio)->>'name'))>0)
    and (p_filter='todos' or p_filter='resueltas' and r.status='RESOLVED' or p_filter='pendientes' and r.status<>'RESOLVED')
  ), page as(select * from requests order by fecha desc nulls last,source_sheet,source_row,id offset p_offset limit p_limit)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb),'total',(select count(*) from requests)) into result;
 end if;
 return result||jsonb_build_object('kpis',k,'cutoff',cut,'publication','PRIVATE_REVIEW_ONLY','can_write',public.savings_review_edit_allowed(),'can_identity',public.savings_review_identity_allowed(),'collection_status','EXPECTED_HISTORY_UNCERTIFIED');
end $function$
;
CREATE OR REPLACE FUNCTION public.get_admin_savings_panel(p_tab text DEFAULT 'padron'::text, p_search text DEFAULT ''::text, p_filter text DEFAULT 'todos'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; summary jsonb; people jsonb; rows jsonb; balance_total numeric; mode text; filtered_total integer;
begin
 -- The preserved reader performs permission, scope and duplicate-baseline checks first.
 -- Guards replicated so an unauthorised or invalid call never pays for the projection.
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_PANEL_DENIED' using errcode='42501'; end if;
 if p_tab is null or p_tab not in ('padron','cobranza','solicitudes','revision') or p_filter is null or p_filter not in ('todos','ahorrando','pausado','baja','pendientes','resueltas') or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 or length(coalesce(p_search,''))>200 then raise exception 'SAVINGS_PANEL_INVALID'; end if;
 if (select count(distinct batch_id) from public.savings_review_records where source_sheet='Ahorro')>1 then raise exception 'SAVINGS_PANEL_MULTIPLE_BASELINES';end if;
 -- One projection per load, shared by both readers. Previously each computed its own.
 people:=coalesce((select jsonb_agg(v) from public.savings_panel_people() v),'[]'::jsonb);
 result:=public.savings_panel_before_current_summary(p_tab,p_search,p_filter,p_offset,p_limit,people);
 summary:=public.savings_admin_current_summary(people);
 if p_tab in ('padron','revision','cobranza') then
  -- Effective state, filtering and neighbours share this exact reader. Date correction targets stay historical.
  with filtered as materialized(select a from public.savings_admin_filtered_people(p_tab,p_search,p_filter,summary)a),
   page as(select a from filtered order by a->>'nombre',a->>'folio',(a->>'source_row')::int,a->>'id' offset p_offset limit p_limit)
  select coalesce((select jsonb_agg(a) from page),'[]'::jsonb),count(*),
   case when count(*)=count(a->>'saldo') then coalesce(sum((a->>'saldo')::numeric),0) end into rows,filtered_total,balance_total from filtered;
  result:=result||jsonb_build_object('rows',rows,'total',filtered_total,'saldo_total',balance_total);
 end if;
 select s.mode into mode from public.savings_publication_state s where id;
 return result||jsonb_build_object('kpis',(result->'kpis')||(summary->'kpis'),'collection_status',summary->>'collection_status','publication_mode',mode);
end $function$
;
notify pgrst,'reload schema';
commit;
