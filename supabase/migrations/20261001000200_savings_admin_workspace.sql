begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Additive administrative projections. No financial writer, table, cache or historical rewrite.
-- Receipts and dated ledger entries after certification remain distinct from the opening balance.
create function public.savings_workspace_receipts(p_participant_id uuid default null)
returns table(participant_id uuid,enrollment_id uuid,contribution_date date,expected_amount numeric,
 actual_amount numeric,has_actual boolean,corrected boolean,conflict boolean,source text)
language sql stable security definer set search_path='' as $$
 with accounts as materialized (
  select p.id,c.cutoff_on from public.savings_participants p
  left join public.savings_balance_certifications c on c.participant_id=p.id
  where p.data_classification='CANONICAL' and (p_participant_id is null or p.id=p_participant_id)
 ), enrollments as materialized (
  select e.*,a.cutoff_on from accounts a join public.savings_enrollments e on e.participant_id=a.id
  where e.data_classification='CANONICAL'
 ), scheduled as materialized (
  select e.participant_id,e.id enrollment_id,s.contribution_date,s.expected_amount
  from enrollments e
  cross join lateral(select greatest(e.first_expected_contribution_date,e.cutoff_on+1) first_on,
   least(public.savings_operation_today(),coalesce((e.terminated_at at time zone 'America/Hermosillo')::date-1,public.savings_operation_today())) last_on)b
  cross join lateral generate_series(date_trunc('year',b.first_on::timestamp),date_trunc('year',b.last_on::timestamp),interval '1 year')y(first_on)
  cross join lateral public.generate_savings_schedule(e.id,greatest(b.first_on,y.first_on::date),least(b.last_on,(y.first_on+interval '1 year'-interval '1 day')::date))s
  where e.first_expected_contribution_date is not null and b.first_on<=b.last_on
 ), receipts as materialized (
  select distinct on(o.enrollment_id,o.contribution_date) e.participant_id,o.enrollment_id,o.contribution_date,o.expected_amount,o.actual_amount,o.version_number
  from enrollments e join public.savings_contribution_overrides o on o.enrollment_id=e.id
  where o.contribution_date<=public.savings_operation_today() and (e.cutoff_on is null or o.contribution_date>e.cutoff_on)
  order by o.enrollment_id,o.contribution_date,o.version_number desc
 ), ledger as materialized (
  select t.participant_id,t.enrollment_id,t.contribution_date,
   sum(case t.direction when 'CREDIT' then t.amount else -t.amount end) amount,
   bool_or(t.transaction_type in ('ADJUSTMENT','REVERSAL')) corrected
  from accounts a join public.savings_transactions t on t.participant_id=a.id
  where t.data_classification='CANONICAL' and t.component='CAPITAL' and t.contribution_date is not null
   and t.enrollment_id is not null and t.transaction_type in ('CONTRIBUTION','ADJUSTMENT','REVERSAL')
   and t.contribution_date<=public.savings_operation_today() and (a.cutoff_on is null or t.contribution_date>a.cutoff_on)
  group by t.participant_id,t.enrollment_id,t.contribution_date
 ), keys as (
  select participant_id,enrollment_id,contribution_date from scheduled union
  select participant_id,enrollment_id,contribution_date from receipts union
  select participant_id,enrollment_id,contribution_date from ledger
 )
 select k.participant_id,k.enrollment_id,k.contribution_date,coalesce(s.expected_amount,r.expected_amount),
  case when r.enrollment_id is not null then r.actual_amount else l.amount end,
  r.enrollment_id is not null or l.enrollment_id is not null,
  coalesce(r.version_number>1,false) or coalesce(l.corrected,false),
  r.enrollment_id is not null and r.actual_amount<>coalesce(l.amount,0),
  case when r.enrollment_id is not null then 'CANONICAL_RECEIPT' when l.enrollment_id is not null then 'CANONICAL_LEDGER' else 'CANONICAL_SCHEDULE' end
 from keys k left join scheduled s using(participant_id,enrollment_id,contribution_date)
 left join receipts r using(participant_id,enrollment_id,contribution_date)
 left join ledger l using(participant_id,enrollment_id,contribution_date);
$$;

create function public.savings_workspace_history(p_participant_id uuid)
returns table(id text,date date,amount numeric,expected numeric,status text,source text,includes_yield boolean,data_conflict boolean)
language sql stable security definer set search_path='' as $$
 with certified as (
  select c.*,r.field_defs,c.source_snapshot->'source'||coalesce(c.source_snapshot->'proposal','{}'::jsonb) approved
  from public.savings_balance_certifications c join public.savings_review_records r on r.id=c.record_id
  where c.participant_id=p_participant_id
 ), historical as (
  select c.record_id,f->>'key' field,public.savings_panel_date(left(f->>'label',10)) contribution_on,
   public.savings_panel_number(c.approved->(f->>'key')) value,
   (c.source_snapshot->'proposal') ? (f->>'key') and c.approved->(f->>'key') is distinct from c.source_snapshot->'source'->(f->>'key') corrected
  from certified c cross join lateral jsonb_array_elements(c.field_defs) f
  where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%'
   and public.savings_panel_date(left(f->>'label',10))<=least(c.cutoff_on,public.savings_operation_today())
   and (upper(coalesce(c.command->>'process',c.approved->>'D'))='JUB' and substring(f->>'label',9,2)='05'
    or upper(coalesce(c.command->>'process',c.approved->>'D')) in ('1','3','PROCESS_1','PROCESS_3') and substring(f->>'label',9,2)<>'05')
 )
 select 'certified:'||record_id||':'||field,contribution_on,value,null::numeric,
  case when value=0 then 'NO_DEDUCTION' when corrected then 'CORRECTED' else 'RECEIVED' end,
  'CERTIFIED_HISTORY',field='AR',false from historical where value is not null
 union all
 select 'receipt:'||r.enrollment_id||':'||r.contribution_date,r.contribution_date,r.actual_amount,r.expected_amount,
  case when not r.has_actual then 'PENDING' when r.actual_amount=0 then 'NO_DEDUCTION' when r.corrected then 'CORRECTED' else 'RECEIVED' end,
  r.source,false,r.conflict from public.savings_workspace_receipts(p_participant_id)r;
$$;

create function public.savings_workspace_person_row(p_participant_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.savings_participants%rowtype; e public.savings_enrollments%rowtype; c public.savings_balance_certifications%rowtype;
 plan public.savings_contribution_plans%rowtype; balance jsonb; following jsonb; previous date; pending jsonb; state text; identity_ok boolean; person_name text;
begin
 select * into p from public.savings_participants where id=p_participant_id and data_classification='CANONICAL';
 if not found then raise exception 'SAVINGS_WORKSPACE_PERSON_NOT_FOUND';end if;
 select * into c from public.savings_balance_certifications where participant_id=p.id;
 select * into e from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL' order by sequence_number desc limit 1;
 select * into plan from public.savings_contribution_plans where enrollment_id=e.id and data_classification='CANONICAL'
  and (effective_to is null or effective_to>=public.savings_operation_today())
  order by case when effective_from<=public.savings_operation_today() then 0 else 1 end,effective_from limit 1;
 identity_ok:=p.identity_status='RESOLVED' and exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))
  and (select count(*) from public.affiliates a where a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))=1;
 select coalesce(nullif(a.full_name,''),p.display_name) into person_name from public.affiliates a where a.id=p.affiliate_id;
 state:=case when not identity_ok or p.certification_status<>'CERTIFIED' or e.id is null or e.status in ('REQUESTED','REJECTED') then 'revision'
  when public.savings_enrollment_effective_status(e.status,e.terminated_at,public.savings_operation_today())='TERMINATED' then 'baja'
  when plan.id is null then 'pausado' else 'ahorrando' end;
 if p.certification_status='CERTIFIED' and (c.id is not null or e.id is not null) then select to_jsonb(b) into balance from public.savings_participant_balance(p.id)b;end if;
 select jsonb_build_object('date',s.contribution_date,'amount',s.expected_amount) into following
 from public.savings_contribution_plans cp
 cross join lateral(select greatest(public.savings_operation_today()+1,cp.effective_from,e.first_expected_contribution_date) first_on)b
 cross join lateral public.generate_savings_schedule(e.id,b.first_on,b.first_on+70)s
 where cp.enrollment_id=e.id and cp.data_classification='CANONICAL' and s.plan_id=cp.id
  and e.status not in ('REQUESTED','REJECTED') and (cp.effective_to is null or cp.effective_to>=b.first_on)
 order by s.contribution_date limit 1;
 select max(h.date) filter(where h.amount>0),jsonb_build_object('count',count(*) filter(where h.status='PENDING'),
  'first_date',min(h.date) filter(where h.status='PENDING'),'expected_amount',sum(h.expected) filter(where h.status='PENDING'),
  'conflict_count',count(*) filter(where h.data_conflict)) into previous,pending from public.savings_workspace_history(p.id)h;
 return jsonb_build_object('id',p.id,'participant_id',p.id,'record_id',c.record_id,'native',c.id is null,
  'folio',p.legacy_folio,'nombre',coalesce(person_name,p.display_name,'Sin nombre'),'estado',state,'aporte',plan.amount,
  'proceso',case coalesce(plan.process_snapshot,p.current_process) when 'PROCESS_1' then '1' when 'PROCESS_3' then '3' else coalesce(plan.process_snapshot,p.current_process) end,
  'saldo',balance->'total','capital_actual',balance->'capital','rendimiento_actual',balance->'yield_amount','balance',balance,
  'certified',balance is not null,'ultimo',previous,'prox',following->'date','porRecibir',following->'amount','next_expected',following,
  'inicio',case when c.id is not null then c.command->>'first_date' else e.first_actual_contribution_date::text end,
  'plan_inicio',(e.enrollment_started_at at time zone 'America/Hermosillo')::date,'bajaAt',(e.terminated_at at time zone 'America/Hermosillo')::date,
  'pending',pending,'identity_conflict',not identity_ok,'certification_pending',p.certification_status<>'CERTIFIED','enrollment_id',e.id,'today',public.savings_operation_today());
end $$;

create function public.get_admin_savings_workspace_people(p_search text default '',p_filter text default 'todos',p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 if p_filter is null or p_filter not in ('todos','ahorrando','pausado','baja','revision','incidencias') or p_offset is null or p_offset<0
  or p_limit is null or p_limit not between 1 and 50 or length(coalesce(p_search,''))>200 then raise exception 'SAVINGS_PAGE_INVALID' using errcode='22023';end if;
 with issues as materialized (
  select distinct participant_id from public.savings_workspace_receipts(null) where p_filter='incidencias' and (not has_actual or conflict)
 ), base as materialized (
  select p.id,p.legacy_folio,coalesce(nullif(a.full_name,''),p.display_name,'Sin nombre') name,p.certification_status<>'CERTIFIED' certification_pending,
   p.identity_status<>'RESOLVED' or a.id is null or a.numero_control is distinct from p.legacy_folio or coalesce(a.is_archived,false)
    or (select count(*) from public.affiliates af where af.numero_control=p.legacy_folio and not coalesce(af.is_archived,false))<>1 identity_conflict,
   case when p.certification_status<>'CERTIFIED' or e.id is null or e.status in ('REQUESTED','REJECTED') then 'revision'
    when public.savings_enrollment_effective_status(e.status,e.terminated_at,public.savings_operation_today())='TERMINATED' then 'baja'
    when cp.id is null then 'pausado' else 'ahorrando' end state
  from public.savings_participants p left join public.affiliates a on a.id=p.affiliate_id
  left join lateral(select * from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL' order by sequence_number desc limit 1)e on true
  left join lateral(select id from public.savings_contribution_plans where enrollment_id=e.id and data_classification='CANONICAL' and (effective_to is null or effective_to>=public.savings_operation_today()) limit 1)cp on true
  where p.data_classification='CANONICAL' and (coalesce(p_search,'')='' or position(lower(p_search) in lower(coalesce(a.full_name,p.display_name,'')))>0 or position(p_search in coalesce(p.legacy_folio,''))>0)
 ), filtered as materialized (
  select * from base where p_filter='todos' or p_filter=case when identity_conflict then 'revision' else state end
   or p_filter='incidencias' and (identity_conflict or certification_pending or exists(select 1 from issues where participant_id=base.id))
 ), page as materialized (select * from filtered order by name,legacy_folio,id offset p_offset limit p_limit)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(public.savings_workspace_person_row(id) order by name,legacy_folio,id) from page),'[]'::jsonb),
  'total',(select count(*) from filtered),'offset',p_offset,'limit',p_limit,'today',public.savings_operation_today()) into result;
 return result;
end $$;

create function public.get_admin_savings_workspace_person(p_participant_id uuid,p_history_offset integer default 0,p_history_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare person jsonb; rows jsonb; total integer;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 if p_participant_id is null or p_history_offset is null or p_history_offset<0 or p_history_limit is null or p_history_limit not between 1 and 50 then raise exception 'SAVINGS_PAGE_INVALID' using errcode='22023';end if;
 person:=public.savings_workspace_person_row(p_participant_id);
 if person->>'identity_conflict'='true' then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='42501';end if;
 with history as materialized(select * from public.savings_workspace_history(p_participant_id)),
 page as(select * from history order by date desc,id offset p_history_offset limit p_history_limit)
 select coalesce((select jsonb_agg(to_jsonb(p) order by p.date desc,p.id) from page p),'[]'::jsonb),(select count(*) from history) into rows,total;
 return jsonb_build_object('person',person,'balance',person->'balance','last_received',person->'ultimo','next_expected',person->'next_expected',
  'pending',person->'pending','history',rows,'history_total',total,'record_id',person->'record_id','enrollment_id',person->'enrollment_id',
  'history_offset',p_history_offset,'history_limit',p_history_limit,'today',public.savings_operation_today());
end $$;

create function public.get_admin_savings_workspace_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare summary jsonb; pending bigint; conflicts bigint; periods jsonb; requests bigint; decisions bigint; deliveries bigint;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 summary:=public.get_admin_savings_panel('padron','','todos',0,1);
 with due as materialized(select * from public.savings_workspace_receipts(null)),
 grouped as(select contribution_date date,count(*) count,sum(expected_amount) expected_amount from due where not has_actual group by contribution_date)
 select (select count(*) from due where not has_actual),(select count(*) from due where conflict),
  coalesce((select jsonb_agg(to_jsonb(g) order by g.date) from grouped g),'[]'::jsonb) into pending,conflicts,periods;
 select count(*) filter(where r.status in ('SUBMITTED','UNDER_REVIEW')),
  count(*) filter(where r.status='APPROVED' and r.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL')) into decisions,deliveries
 from public.savings_requests r join public.savings_participants p on p.id=r.participant_id
 where p.data_classification='CANONICAL' and r.data_classification='CANONICAL' and r.metadata->>'origin'='SAVINGS_RUNTIME_V1';
 -- An approved TERMINATE already schedules cessation; it has no delivery step.
 requests:=decisions+deliveries;
 return jsonb_build_object('kpis',summary->'kpis','collection_status',summary->'collection_status','publication_mode',summary->'publication_mode',
  'attention',jsonb_build_object('pending_receipts',pending,'receipt_conflicts',conflicts,'request_count',requests,
   'pending_decisions',decisions,'awaiting_delivery',deliveries,'periods',periods),'today',public.savings_operation_today());
end $$;

revoke all on function public.savings_workspace_receipts(uuid),public.savings_workspace_history(uuid),public.savings_workspace_person_row(uuid),
 public.get_admin_savings_workspace_people(text,text,integer,integer),public.get_admin_savings_workspace_person(uuid,integer,integer),public.get_admin_savings_workspace_summary()
 from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_workspace_people(text,text,integer,integer),public.get_admin_savings_workspace_person(uuid,integer,integer),public.get_admin_savings_workspace_summary() to authenticated;
notify pgrst,'reload schema';
commit;
