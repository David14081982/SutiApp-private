begin;
-- Private administrative projection. No financial cutover or history rewrite.
create function public.savings_panel_number(v jsonb) returns numeric
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(v)='number' then (v::text)::numeric end;
$$;
create function public.savings_panel_date(v text) returns date
language plpgsql immutable set search_path='' as $$
declare d date; begin
 if v ~ '^\d{4}-\d{2}-\d{2}$' then d:=v::date;
 elsif v ~ '^\d{1,2}/\d{1,2}/\d{4}$' then
  d:=make_date(split_part(v,'/',3)::int,split_part(v,'/',2)::int,split_part(v,'/',1)::int);
 end if; return d;
 exception when datetime_field_overflow or invalid_datetime_format then return null;
end $$;

create function public.savings_panel_people(p_record_id uuid default null) returns setof jsonb
language sql stable security definer set search_path='' as $$
 with base as (
  select r.*,b.observed_at, r.source_data || case when (r.source_data||r.proposed_data)->>'A' is distinct from r.source_folio then '{}'::jsonb else r.proposed_data end d,
   public.savings_review_identity(r.source_folio) identity
  from public.savings_review_records r join public.savings_review_batches b on b.id=r.batch_id
  where r.source_sheet='Ahorro' and (p_record_id is null or r.id=p_record_id)
 ), detail as (
  select b.*,h.last_date,h.delta,h.matrix,h.future_date,h.future_amount,h.last_scheduled,
   public.savings_panel_number(b.source_data->'Q') balance,
   coalesce(public.savings_panel_number(b.source_data->'H'),0)+coalesce(public.savings_panel_number(b.source_data->'I'),0)+coalesce(public.savings_panel_number(b.source_data->'J'),0) withdrawn
  from base b cross join lateral (
   select max(left(f->>'label',10)::date) filter(where f->>'label' like '%Descuento registrado%' and public.savings_panel_number(b.d->(f->>'key'))>0) last_date,
    sum(coalesce(public.savings_panel_number(b.d->(f->>'key')),0)-coalesce(public.savings_panel_number(b.source_data->(f->>'key')),0)) filter(where f->>'label' like '%Descuento registrado%' and b.source_data->>'W'='Ahorrando' and left(f->>'label',10)::date>=public.savings_panel_date(b.source_data->>'X')) delta,
    sum(public.savings_panel_number(b.source_data->(f->>'key'))) filter(where f->>'label' like '%Descuento registrado%' and b.source_data->>'W'='Ahorrando' and left(f->>'label',10)::date>=public.savings_panel_date(b.source_data->>'X')) matrix,
    min(left(f->>'label',10)::date) filter(where f->>'label' like '%Proyección futura%' and public.savings_panel_number(b.d->(f->>'key'))>0) future_date,
    (array_agg(public.savings_panel_number(b.d->(f->>'key')) order by f->>'label') filter(where f->>'label' like '%Proyección futura%' and public.savings_panel_number(b.d->(f->>'key'))>0))[1] future_amount,
    (array_agg(jsonb_build_object('key',f->>'key','fecha',left(f->>'label',10),'monto',b.d->(f->>'key'),'original',b.source_data->(f->>'key'),'corregido',b.proposed_data ? (f->>'key')) order by f->>'label' desc)
     filter(where f->>'label' like '%Descuento registrado%' and left(f->>'label',10)::date>=public.savings_panel_date(b.source_data->>'X')
      and (upper(b.source_data->>'D')='JUB' and substring(f->>'label',9,2)='05' or b.source_data->>'D' in ('1','3') and substring(f->>'label',9,2)<>'05')))[1] last_scheduled
   from jsonb_array_elements(b.field_defs) f where f->>'label' ~ '^\d{4}-\d{2}-\d{2}'
  ) h
 )
 select jsonb_build_object('id',id,'folio',source_folio,'nombre',identity->>'name','identity',identity,
  'identity_pending',(source_data||proposed_data)->>'A' is distinct from source_folio,
  'proposed_folio',proposed_data->>'A','source_row',source_row,'version',version,'status',status,
  'estado',case when d->>'W'='Ahorrando' then 'ahorrando' when d->>'W'='Terminado' or lower(d->>'W') like '%dej%' or lower(d->>'W') like '%baja%' or lower(d->>'W') like '%no ahorr%' then 'baja' else 'revision' end,
  'estado_original',d->>'W','proceso',upper(d->>'D'),'aporte',public.savings_panel_number(d->'R'),
  'last_scheduled',last_scheduled,'zero_recorded',d->>'W'='Ahorrando' and public.savings_panel_number(last_scheduled->'monto')=0,
  'inicio',public.savings_panel_date(d->>'F'),'plan_inicio',public.savings_panel_date(d->>'X'),
  'bajaAt',public.savings_panel_date(d->>'Y'),'ultimo',last_date,'prox',future_date,'porRecibir',future_amount,
  'saldo',balance,'saldo_revision',balance+coalesce(delta,0),'correccion',coalesce(delta,0),
  'retirado',withdrawn,'acumulado',public.savings_panel_number(source_data->'G'),
  'rendimiento',case when source_data->>'W'='Ahorrando' and public.savings_panel_date(source_data->>'X')<='2026-06-30'::date and public.savings_panel_number(source_data->'AR')>=public.savings_panel_number(source_data->'DT') then public.savings_panel_number(source_data->'DT') end,
  'aportado',case when source_data->>'W'='Ahorrando' and public.savings_panel_date(source_data->>'X')<='2026-06-30'::date and public.savings_panel_number(source_data->'AR')>=public.savings_panel_number(source_data->'DT') then public.savings_panel_number(source_data->'G')-public.savings_panel_number(source_data->'DT') end,
  'issues',issues,'observed_at',observed_at,
  'needs_review',jsonb_array_length(issues)>0 or (identity->>'match_count')::int<>1 or (identity->>'active_match_count')::int<>1 or (source_data||proposed_data)->>'A' is distinct from source_folio or (d->>'W'='Ahorrando' and public.savings_panel_date(d->>'F') is null) or (d->>'W' in ('Terminado','Dejó de ahorrar') and public.savings_panel_date(d->>'Y') is null) or d->>'W' not in ('Ahorrando','Terminado','Dejó de ahorrar'))
 from detail;
$$;

create function public.get_admin_savings_panel(p_tab text default 'padron',p_search text default '',p_filter text default 'todos',p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; k jsonb; cut timestamptz; collection jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_PANEL_DENIED' using errcode='42501'; end if;
 if p_tab is null or p_tab not in ('padron','cobranza','solicitudes','revision') or p_filter is null or p_filter not in ('todos','ahorrando','pausado','baja','pendientes','resueltas') or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 or length(coalesce(p_search,''))>200 then raise exception 'SAVINGS_PANEL_INVALID'; end if;
 if (select count(distinct batch_id) from public.savings_review_records where source_sheet='Ahorro')>1 then raise exception 'SAVINGS_PANEL_MULTIPLE_BASELINES';end if;
 select max(observed_at) into cut from public.savings_review_batches;
 with people as materialized (select value a from public.savings_panel_people() value), next_day as (select min((a->>'prox')::date) d from people)
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
  with people as materialized (select value a from public.savings_panel_people() value), filtered as materialized (
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
end $$;

create function public.get_admin_savings_panel_detail(p_record_id uuid,p_history_limit integer default 6,p_history_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;r public.savings_review_records;person jsonb;withdrawals jsonb;withdrawn_total numeric;begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_PANEL_DENIED' using errcode='42501'; end if;
 if p_history_limit is null or p_history_limit not between 1 and 50 or p_history_offset is null or p_history_offset<0 then raise exception 'SAVINGS_PANEL_INVALID'; end if;
 select * into r from public.savings_review_records where id=p_record_id and source_sheet='Ahorro';
 if not found then raise exception 'SAVINGS_PANEL_NOT_FOUND';end if;
 select a into person from public.savings_panel_people(p_record_id) a;
 withdrawals:=public.get_admin_savings_review_withdrawals(p_record_id);
 select case when count(distinct w->'batch'->>'id')<=1
  and count(*) filter(where w->'source_data'->>'H'='Completado')=count(public.savings_panel_number(w->'source_data'->'G')) filter(where w->'source_data'->>'H'='Completado')
  then coalesce(sum(public.savings_panel_number(w->'source_data'->'G')) filter(where w->'source_data'->>'H'='Completado'),0) end
 into withdrawn_total from jsonb_array_elements(withdrawals->'records') w;
 with dates as materialized (
  select f->>'key' key,left(f->>'label',10)::date fecha,f->>'label' label,r.source_data->(f->>'key') original,
   case when person->>'identity_pending'='true' then r.source_data->(f->>'key') else (r.source_data||r.proposed_data)->(f->>'key') end monto,
   coalesce(r.proposed_data ? (f->>'key') and r.proposed_data->(f->>'key') is distinct from r.source_data->(f->>'key'),false) corregido
  from jsonb_array_elements(r.field_defs) f where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%'
 ), page as (select * from dates order by fecha desc,key offset p_history_offset limit p_history_limit)
 select jsonb_build_object('person',person,'record',public.get_admin_savings_review(p_record_id),'dates',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb),'date_count',(select count(*) from dates),'withdrawals',withdrawals,'withdrawn_total',withdrawn_total,'can_write',public.savings_review_edit_allowed(),'can_identity',public.savings_review_identity_allowed()) into result;
 return result;
end $$;

create function public.get_admin_savings_panel_affiliate(p_affiliate_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_PANEL_DENIED' using errcode='42501';end if;
 select jsonb_build_object('folio',a.numero_control,'records',coalesce((select jsonb_agg(jsonb_build_object('id',r.id) order by r.source_row,r.id) from public.savings_review_records r where r.source_sheet='Ahorro' and r.source_folio=a.numero_control and a.numero_control<>''),'[]'::jsonb)) into result from public.affiliates a where a.id=p_affiliate_id;
 if result is null then raise exception 'SAVINGS_PANEL_NOT_FOUND';end if;return result;
end $$;

create function public.get_admin_savings_panel_neighbor(p_record_id uuid,p_tab text,p_search text,p_filter text,p_direction integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare anchor jsonb;result jsonb;begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_PANEL_DENIED' using errcode='42501';end if;
 if p_record_id is null or p_direction is null or p_direction not in (-1,1) or p_tab is null or p_tab not in ('padron','revision','cobranza') or p_filter is null or p_filter not in ('todos','ahorrando','pausado','baja','pendientes','resueltas') or length(coalesce(p_search,''))>200 then raise exception 'SAVINGS_PANEL_INVALID';end if;
 if (select count(distinct batch_id) from public.savings_review_records where source_sheet='Ahorro')>1 then raise exception 'SAVINGS_PANEL_MULTIPLE_BASELINES';end if;
 select a into anchor from public.savings_panel_people(p_record_id) a;
 if anchor is null then raise exception 'SAVINGS_PANEL_NOT_FOUND';end if;
 with filtered as materialized (
  select a from public.savings_panel_people() a where
   (coalesce(p_search,'')='' or position(lower(p_search) in lower(coalesce(a->>'nombre','')))>0 or position(p_search in coalesce(a->>'folio',''))>0)
   and (p_tab<>'revision' or ((a->>'needs_review')::boolean or a->>'status'='RESOLVED'))
   and (p_tab<>'cobranza' or a->>'zero_recorded'='true')
   and (p_filter='todos' or p_filter='pendientes' and a->>'status'<>'RESOLVED' or p_filter='resueltas' and a->>'status'='RESOLVED' or p_filter='pausado' and a->>'zero_recorded'='true' or a->>'estado'=p_filter)
 ), numbered as (
  select a,row_number() over(order by a->>'nombre',a->>'folio',(a->>'source_row')::int,a->>'id') n,count(*) over() total from filtered
 ), candidates as (
  select * from numbered where case when p_direction=1 then
   row(a->>'nombre',a->>'folio' is null,coalesce(a->>'folio',''),(a->>'source_row')::int,a->>'id')>
   row(anchor->>'nombre',anchor->>'folio' is null,coalesce(anchor->>'folio',''),(anchor->>'source_row')::int,anchor->>'id')
  else
   row(a->>'nombre',a->>'folio' is null,coalesce(a->>'folio',''),(a->>'source_row')::int,a->>'id')<
   row(anchor->>'nombre',anchor->>'folio' is null,coalesce(anchor->>'folio',''),(anchor->>'source_row')::int,anchor->>'id') end
 ) select jsonb_build_object('id',a->>'id','has_prev',n>1,'has_next',n<total) into result from candidates order by case when p_direction=1 then n end,case when p_direction=-1 then n end desc limit 1;
 return result;
end $$;

create function public.get_admin_savings_panel_request(p_record_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.savings_review_records;begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_PANEL_DENIED' using errcode='42501';end if;
 select * into r from public.savings_review_records where id=p_record_id and source_sheet in ('Solicitud de retiro','Solicitud Cambio ahorro');
 if not found then raise exception 'SAVINGS_PANEL_NOT_FOUND';end if;
 return (public.get_admin_savings_review(p_record_id)-'raw_source')||jsonb_build_object('identity',public.savings_review_identity(r.source_folio),'identity_pending',(r.source_data||r.proposed_data)->>'A' is distinct from r.source_folio);
end $$;

create function public.admin_save_savings_panel(p_record_id uuid,p_version integer,p_changes jsonb,p_status text,p_observation text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.savings_review_records;f record;prior public.savings_review_events;begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') or not public.savings_review_edit_allowed() then raise exception 'SAVINGS_PANEL_DENIED' using errcode='42501';end if;
 if p_changes is null or jsonb_typeof(p_changes)<>'object' or p_version is null or p_client_action_id is null then raise exception 'SAVINGS_PANEL_INVALID';end if;
 -- Share the existing writer's lock namespace so simultaneous retries also succeed.
 perform pg_advisory_xact_lock(hashtextextended(p_client_action_id::text,605));
 select * into prior from public.savings_review_events where client_action_id=p_client_action_id;
 if found then return public.admin_save_savings_review(p_record_id,p_version,p_changes,p_status,p_observation,p_client_action_id);end if;
 select * into r from public.savings_review_records where id=p_record_id for update;
 if not found or r.source_sheet<>'Ahorro' then raise exception 'SAVINGS_PANEL_NOT_FOUND';end if;
 for f in select * from jsonb_each(p_changes) loop
  if f.key not in ('A','R','W','F') and not exists(select 1 from jsonb_array_elements(r.field_defs) d where d->>'key'=f.key and d->>'label' like '%Descuento registrado%' and d->>'label' ~ '^\d{4}-\d{2}-\d{2}') then raise exception 'SAVINGS_PANEL_DERIVED_READONLY';end if;
  if f.key<>'A' and (r.source_data||r.proposed_data)->>'A' is distinct from r.source_folio then raise exception 'SAVINGS_PANEL_IDENTITY_PENDING';end if;
  if f.key not in ('A','W','F') and (jsonb_typeof(f.value) is distinct from 'number' or public.savings_panel_number(f.value)<0) then raise exception 'SAVINGS_PANEL_AMOUNT_INVALID';end if;
  if f.key='W' and (f.value#>>'{}') not in ('Ahorrando','Dejó de ahorrar') then raise exception 'SAVINGS_PANEL_STATE_INVALID';end if;
 end loop;
 if not exists(select 1 from jsonb_each(p_changes) c where c.value is distinct from (r.source_data||r.proposed_data)->c.key) and p_status=r.status and nullif(btrim(p_observation),'') is null then raise exception 'SAVINGS_PANEL_NO_CHANGES';end if;
 return public.admin_save_savings_review(p_record_id,p_version,p_changes,p_status,p_observation,p_client_action_id);
end $$;
create function public.admin_reset_savings_panel_discount(p_record_id uuid,p_version integer,p_field text,p_observation text,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.savings_review_records;prior public.savings_review_events;command jsonb;before_state jsonb;after_state jsonb;begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') or not public.savings_review_edit_allowed() then raise exception 'SAVINGS_PANEL_DENIED' using errcode='42501';end if;
 if p_version is null or p_field is null or p_client_action_id is null or length(coalesce(p_observation,''))>4000 then raise exception 'SAVINGS_PANEL_INVALID';end if;
 command:=jsonb_build_object('operation','RESET_REVIEW_DISCOUNT','record',p_record_id,'version',p_version,'field',p_field,'observation',nullif(btrim(p_observation),''));
 perform pg_advisory_xact_lock(hashtextextended(p_client_action_id::text,605));
 select * into prior from public.savings_review_events where client_action_id=p_client_action_id;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.command<>command then raise exception 'SAVINGS_REVIEW_RETRY_CONFLICT';end if;
  return prior.after_data;
 end if;
 select * into r from public.savings_review_records where id=p_record_id and source_sheet='Ahorro' for update;
 if not found then raise exception 'SAVINGS_PANEL_NOT_FOUND';end if;
 if r.version<>p_version then raise exception 'SAVINGS_REVIEW_CHANGED';end if;
 if (r.source_data||r.proposed_data)->>'A' is distinct from r.source_folio then raise exception 'SAVINGS_PANEL_IDENTITY_PENDING';end if;
 if not exists(select 1 from jsonb_array_elements(r.field_defs) d where d->>'key'=p_field and d->>'label' ~ '^\d{4}-\d{2}-\d{2}' and d->>'label' like '%Descuento registrado%') then raise exception 'SAVINGS_PANEL_DERIVED_READONLY';end if;
 if not r.proposed_data ? p_field then raise exception 'SAVINGS_PANEL_NO_CHANGES';end if;
 before_state:=jsonb_build_object('proposed_data',r.proposed_data,'status',r.status,'version',r.version);
 after_state:=jsonb_build_object('proposed_data',r.proposed_data-p_field,'status',case when r.status='RESOLVED' then 'IN_REVIEW' else r.status end,'version',r.version+1,'publication','PRIVATE_REVIEW_ONLY');
 update public.savings_review_records set proposed_data=proposed_data-p_field,status=after_state->>'status',version=version+1,updated_at=clock_timestamp() where id=r.id;
 insert into public.savings_review_events(record_id,actor_real_auth_user_id,usuario_contexto_affiliate_id,observation,before_data,after_data,command,client_action_id)
 values(r.id,auth.uid(),public.get_effective_affiliate_id(),nullif(btrim(p_observation),''),before_state,after_state,command,p_client_action_id);
 return after_state;
end $$;
revoke all on function public.admin_reset_savings_panel_discount(uuid,integer,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_reset_savings_panel_discount(uuid,integer,text,text,uuid) to authenticated;
revoke all on function public.savings_panel_number(jsonb),public.savings_panel_date(text),public.savings_panel_people(uuid),public.get_admin_savings_panel(text,text,text,integer,integer),public.get_admin_savings_panel_detail(uuid,integer,integer),public.admin_save_savings_panel(uuid,integer,jsonb,text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_admin_savings_panel_affiliate(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_admin_savings_panel_request(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_admin_savings_panel_neighbor(uuid,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_panel_affiliate(uuid),public.get_admin_savings_panel_request(uuid),public.get_admin_savings_panel_neighbor(uuid,text,text,text,integer) to authenticated;
grant execute on function public.get_admin_savings_panel(text,text,text,integer,integer),public.get_admin_savings_panel_detail(uuid,integer,integer),public.admin_save_savings_panel(uuid,integer,jsonb,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
