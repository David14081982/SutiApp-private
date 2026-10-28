begin;
set local lock_timeout='2s';
set local statement_timeout='90s';

-- H-REPORTS-JC-HISTORICAL-001: dates/evidence only. No financial writer.
do $$ begin
 if to_regprocedure('public.get_admin_reports_jc_savings(integer)') is null
  or to_regprocedure('savings_refunds_private.authorize(text)') is null
  or to_regprocedure('public.get_impersonation_context()') is null
 then raise exception 'SAVINGS_REGULARIZATION_DEPENDENCY_MISSING';end if;
end $$;

create table savings_refunds_private.termination_versions (
 id uuid primary key default extensions.gen_random_uuid(),
 source_record_id uuid not null references public.savings_review_records(id) on delete restrict,
 source_fingerprint text not null check(length(source_fingerprint)=32),
 numero_control text not null check(length(numero_control) between 1 and 80),
 version integer not null check(version>0),
 mode text not null check(mode in ('LINK','ATTESTED','VOID')),
 enrollment_id uuid references public.savings_enrollments(id) on delete restrict,
 effective_on date not null,
 reason text not null check(length(btrim(reason)) between 3 and 1000),
 evidence_reference text not null check(length(btrim(evidence_reference)) between 3 and 500),
 created_at timestamptz not null default clock_timestamp(),
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
 usuario_contexto_affiliate_id uuid references public.affiliates(id) on delete restrict,
 command jsonb not null,
 client_action_id uuid not null unique,
 unique(source_record_id,version),
 check(mode<>'LINK' or enrollment_id is not null)
);
create index savings_termination_enrollment_history on savings_refunds_private.termination_versions(enrollment_id) where enrollment_id is not null;
alter table savings_refunds_private.termination_versions enable row level security;
alter table savings_refunds_private.termination_versions force row level security;
revoke all on savings_refunds_private.termination_versions from public,anon,authenticated,service_role;
create trigger savings_termination_versions_immutable before update or delete on savings_refunds_private.termination_versions for each row execute function savings_refunds_private.immutable();

create function savings_refunds_private.regularization_authorize(p_action text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 perform savings_refunds_private.authorize(p_action);
 if exists(select 1 from public.get_impersonation_context()) then raise exception 'SAVINGS_REGULARIZATION_IMPERSONATION_DENIED' using errcode='42501';end if;
end $$;

create function savings_refunds_private.regularization_batch() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare b public.savings_review_batches%rowtype; actual integer; archived integer;
begin
 select * into b from public.savings_review_batches where source_name='SutiApp Final' order by observed_at desc,created_at desc,id desc limit 1;
 if b.id is null then raise exception 'REPORTS_JC_SAVINGS_IMPORT_UNAVAILABLE';end if;
 select count(*) into actual from public.savings_review_records where batch_id=b.id;
 -- Archive establishes transport completeness only; never a row/event fallback.
 select count(distinct removed->>'id') into archived from public.savings_registration_removal_archive a
 cross join lateral jsonb_array_elements(coalesce(a.snapshots->'savings_review_records','[]'::jsonb)) removed
 where removed->>'batch_id'=b.id::text and nullif(removed->>'id','') is not null
 and not exists(select 1 from public.savings_review_records live where live.id::text=removed->>'id');
 if actual+archived<>b.expected_records then raise exception 'REPORTS_JC_SAVINGS_IMPORT_INCOMPLETE';end if;
 return b.id;
end $$;

create function savings_refunds_private.termination_rows() returns jsonb
language sql stable security definer set search_path='' as $$
 with src as materialized (
  select r.id,r.source_sheet,r.source_row,r.source_data||r.proposed_data d,md5(to_jsonb(r)::text) fingerprint,
   coalesce(nullif((r.source_data||r.proposed_data)->>'A',''),r.source_folio) control,
   public.savings_panel_date((r.source_data||r.proposed_data)->>'B') requested
  from public.savings_review_records r where r.batch_id=savings_refunds_private.regularization_batch()
  and r.source_sheet='Solicitud de Ahorro'
  and (lower(btrim((r.source_data||r.proposed_data)->>'G'))='terminado'
   or exists(select 1 from savings_refunds_private.termination_versions v where v.source_record_id=r.id))
 ), latest as materialized (
  select distinct on(source_record_id) * from savings_refunds_private.termination_versions order by source_record_id,version desc
 ), mapped as (
  select r.*,v.id annotation_id,v.version,v.mode,v.enrollment_id,v.effective_on,v.reason,v.evidence_reference,v.source_fingerprint,
   coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'terminated_on',(e.terminated_at at time zone 'America/Hermosillo')::date,
    'started_on',(e.enrollment_started_at at time zone 'America/Hermosillo')::date,'status',e.status,
    'linked',exists(select 1 from public.savings_requests q where q.enrollment_id=e.id and q.metadata->>'source_record_id'=r.id::text)) order by e.sequence_number,e.id)
    from public.savings_enrollments e join public.savings_participants p on p.id=e.participant_id
    where p.legacy_folio=r.control and p.data_classification='CANONICAL' and p.identity_status='RESOLVED' and e.data_classification='CANONICAL'
    and (exists(select 1 from public.savings_requests q where q.enrollment_id=e.id and q.metadata->>'source_record_id'=r.id::text)
     or ((e.enrollment_started_at at time zone 'America/Hermosillo')::date<=public.savings_operation_today()
      and (r.requested is null or e.terminated_at is null or (e.terminated_at at time zone 'America/Hermosillo')::date>=r.requested)))), '[]'::jsonb) candidates,
   exists(select 1 from public.savings_requests q join public.savings_enrollments e on e.id=q.enrollment_id join public.savings_participants p on p.id=e.participant_id
    where q.metadata->>'source_record_id'=r.id::text and (p.legacy_folio is distinct from r.control or p.data_classification<>'CANONICAL' or e.data_classification<>'CANONICAL')) identity_conflict,
   (select case when count(*)=1 then min(coalesce(to_jsonb(a)->>'full_name',to_jsonb(a)->>'name')) end from public.affiliates a where a.numero_control=r.control) person_name
  from src r left join latest v on v.source_record_id=r.id
 ), evaluated as (
  select m.*,case
   when annotation_id is not null and mode='VOID' then case when source_fingerprint=fingerprint and lower(btrim(d->>'G')) is distinct from 'terminado' then 'VOIDED' else 'CONFLICT' end
   when nullif(control,'') is null or identity_conflict or lower(btrim(d->>'G')) is distinct from 'terminado' then 'CONFLICT'
   when annotation_id is not null and (source_fingerprint is distinct from fingerprint
    or effective_on>public.savings_operation_today() or (requested is not null and effective_on<requested)) then 'CONFLICT'
   when annotation_id is not null and enrollment_id is not null and not exists(select 1 from jsonb_array_elements(candidates)c where c->>'id'=enrollment_id::text) then 'CONFLICT'
   when annotation_id is not null and enrollment_id is not null and exists(select 1 from jsonb_array_elements(candidates)c where c->>'id'=enrollment_id::text and (c->>'started_on')::date>effective_on) then 'CONFLICT'
   when annotation_id is not null and exists(select 1 from jsonb_array_elements(candidates)c where (c->>'linked')::boolean and c->>'id' is distinct from enrollment_id::text) then 'CONFLICT'
   when annotation_id is not null and mode='LINK' and not exists(select 1 from jsonb_array_elements(candidates)c where c->>'id'=enrollment_id::text and c->>'terminated_on'=effective_on::text) then 'CONFLICT'
   when annotation_id is not null and mode='ATTESTED' and exists(select 1 from jsonb_array_elements(candidates)c where
    (c->>'id'=enrollment_id::text and nullif(c->>'terminated_on','') is not null)
    or (enrollment_id is null and (c->>'started_on' is null or (c->>'started_on')::date<=effective_on))) then 'CONFLICT'
   when annotation_id is not null and mode='ATTESTED' and enrollment_id is not null and exists(select 1 from latest other where other.source_record_id<>m.id and other.enrollment_id=m.enrollment_id and other.mode='ATTESTED') then 'CONFLICT'
   when annotation_id is not null then 'RESOLVED'
   when (select count(*) from jsonb_array_elements(candidates)c where (c->>'linked')::boolean and nullif(c->>'terminated_on','') is not null)=1
    and not exists(select 1 from jsonb_array_elements(candidates)c where (c->>'linked')::boolean and ((c->>'terminated_on')::date>public.savings_operation_today() or (requested is not null and (c->>'terminated_on')::date<requested))) then 'RESOLVED'
   when (select count(*) from jsonb_array_elements(candidates)c where (c->>'linked')::boolean and nullif(c->>'terminated_on','') is not null)>1 then 'CONFLICT'
   else 'PENDING' end resolution
  from mapped m
 )
 select coalesce(jsonb_agg(jsonb_build_object('source_record_id',id,'source_fingerprint',fingerprint,'numero_control',control,'name',person_name,
  'requested_on',requested,'source_sheet',source_sheet,'source_row',source_row,'status',resolution,'source_state',d->>'G',
  'can_void',annotation_id is not null and lower(btrim(d->>'G')) is distinct from 'terminado' and (mode<>'VOID' or source_fingerprint is distinct from fingerprint),
  'effective_on',coalesce(effective_on,(select (c->>'terminated_on')::date from jsonb_array_elements(candidates)c where (c->>'linked')::boolean and c->>'terminated_on' is not null limit 1)),
  'version',coalesce(version,0),'mode',coalesce(mode,case when resolution='RESOLVED' then 'LINK' end),
  'enrollment_id',coalesce(enrollment_id,(select (c->>'id')::uuid from jsonb_array_elements(candidates)c where (c->>'linked')::boolean and c->>'terminated_on' is not null limit 1)),
  'reason',reason,'evidence_reference',evidence_reference,'candidates',candidates,
  'history',coalesce((select jsonb_agg(to_jsonb(h)-'command' order by h.version desc) from savings_refunds_private.termination_versions h where h.source_record_id=e.id),'[]'::jsonb)) order by requested nulls first,control,id),'[]'::jsonb)
 from evaluated e;
$$;

create function public.get_admin_savings_regularization(p_year integer,p_folio text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare all_rows jsonb; rows jsonb; months jsonb; today date:=public.savings_operation_today();
begin
 perform savings_refunds_private.regularization_authorize('read');
 if p_year is null or p_year not between 2000 and 2100 or length(coalesce(p_folio,''))>80 then raise exception 'SAVINGS_REGULARIZATION_FILTER_INVALID';end if;
 select coalesce(jsonb_agg(r),'[]'::jsonb) into all_rows from jsonb_array_elements(savings_refunds_private.termination_rows())r
 where (case when r->>'status' in ('RESOLVED','VOIDED') then extract(year from (r->>'effective_on')::date)=p_year
 else p_year<=extract(year from today) and (r->>'requested_on' is null or (r->>'requested_on')::date<=make_date(p_year,12,31)) end);
 select coalesce(jsonb_agg(r),'[]'::jsonb) into rows from jsonb_array_elements(all_rows)r where p_folio is null or r->>'numero_control'=p_folio;
 select jsonb_agg(jsonb_build_object('period',m.day::date,'refund_count',counts.cnt,'confirmed_count',p.confirmed_case_count,
  'pending_termination_count',pending.cnt,'status',case when m.day::date>date_trunc('month',today)::date then 'FUTURE'
   when m.day::date=date_trunc('month',today)::date then 'CURRENT'
   when p.invalidated_at is not null then 'REOPENED'
   when pending.cnt>0 or p.period is null then 'PENDING'
   when counts.cnt=0 then 'REVIEWED_ZERO' else 'REVIEWED' end,
  'confirmed_at',p.confirmed_at,'invalidated_at',p.invalidated_at) order by m.day) into months
 from generate_series(make_date(p_year,1,1)::timestamp,make_date(p_year,12,1)::timestamp,interval '1 month')m(day)
 left join savings_refunds_private.reporting_periods p on p.period=m.day::date
 cross join lateral(select count(*) cnt from savings_refunds_private.cases c where c.status='PAID'
  and (c.paid_at at time zone 'America/Hermosillo')::date>=m.day::date and (c.paid_at at time zone 'America/Hermosillo')::date<(m.day+interval '1 month')::date)counts
 -- Month completeness always covers the whole program, even when cases are filtered.
 cross join lateral(select count(*) cnt from jsonb_array_elements(all_rows)r where r->>'status' not in ('RESOLVED','VOIDED')
  and m.day::date<=today and (r->>'requested_on' is null or (r->>'requested_on')::date<(m.day+interval '1 month')::date))pending;
 return jsonb_build_object('year',p_year,'today',today,'months',months,'terminations',rows,
  'permissions',jsonb_build_object('can_write',public.has_admin_permission('savings.write') and public.admin_module_boundary(array['savings'],'update'),
   'can_approve',public.has_admin_permission('savings.approve') and public.admin_module_boundary(array['savings'],'update')));
end $$;

create function public.save_admin_savings_termination(p_command jsonb,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); context_id uuid:=public.get_effective_affiliate_id(); src public.savings_review_records%rowtype;
 prior savings_refunds_private.termination_versions%rowtype; previous savings_refunds_private.termination_versions%rowtype;
 entry jsonb; candidates jsonb; selected jsonb; mode text:=p_command->>'mode'; enrollment uuid:=(p_command->>'enrollment_id')::uuid;
 effective date:=(p_command->>'effective_on')::date; requested date; control text; fingerprint text; new_version integer; review_period date;
begin
 perform savings_refunds_private.regularization_authorize('write');perform savings_refunds_private.regularization_authorize('approve');
 if jsonb_typeof(p_command) is distinct from 'object' or pg_column_size(p_command)>20000 or p_command->>'kind' is distinct from 'SAVE_TERMINATION'
  or p_client_action_id is null or mode is null or mode not in ('LINK','ATTESTED','VOID')
  or length(btrim(coalesce(p_command->>'reason',''))) not between 3 and 1000
  or length(btrim(coalesce(p_command->>'evidence_reference',''))) not between 3 and 500
 then raise exception 'SAVINGS_TERMINATION_COMMAND_INVALID';end if;
 -- Serializes dedup across source rows/enrollments; no business-table writes.
 perform pg_advisory_xact_lock(hashtextextended('savings-termination-regularization',0));
 select * into prior from savings_refunds_private.termination_versions where client_action_id=p_client_action_id;
 if found then
  if prior.command is distinct from p_command or prior.actor_real_auth_user_id<>actor or prior.usuario_contexto_affiliate_id is distinct from context_id then raise exception 'SAVINGS_TERMINATION_IDEMPOTENCY_CONFLICT';end if;
  return to_jsonb(prior)-'command';
 end if;
 select * into src from public.savings_review_records where id=(p_command->>'source_record_id')::uuid for share;
 if src.id is null or src.batch_id is distinct from savings_refunds_private.regularization_batch()
  or src.source_sheet<>'Solicitud de Ahorro' or (mode<>'VOID' and lower(btrim((src.source_data||src.proposed_data)->>'G')) is distinct from 'terminado')
 then raise exception 'SAVINGS_TERMINATION_SOURCE_INVALID';end if;
 fingerprint:=md5(to_jsonb(src)::text);
 if p_command->>'source_fingerprint' is distinct from fingerprint then raise exception 'SAVINGS_TERMINATION_SOURCE_CONFLICT';end if;
 control:=coalesce(nullif((src.source_data||src.proposed_data)->>'A',''),src.source_folio);
 if mode<>'VOID' and (nullif(control,'') is null or length(control)>80) then raise exception 'SAVINGS_TERMINATION_IDENTITY_REQUIRED';end if;
 select * into previous from savings_refunds_private.termination_versions where source_record_id=src.id order by version desc limit 1;
 if (p_command->>'expected_version')::integer is distinct from coalesce(previous.version,0) then raise exception 'SAVINGS_TERMINATION_VERSION_CONFLICT';end if;
 if mode='VOID' then
  if previous.id is null or lower(btrim((src.source_data||src.proposed_data)->>'G')) is not distinct from 'terminado' then raise exception 'SAVINGS_TERMINATION_VOID_INVALID';end if;
  -- Withdrawal documents a superseded date assertion only. In particular it
  -- never cancels a canonical termination or changes its financial effects.
  effective:=previous.effective_on;enrollment:=previous.enrollment_id;control:=previous.numero_control;
 else
 requested:=public.savings_panel_date((src.source_data||src.proposed_data)->>'B');
 if effective is null or effective<date '2000-01-01' or effective>public.savings_operation_today() or (requested is not null and effective<requested) then raise exception 'SAVINGS_TERMINATION_DATE_INVALID';end if;
 select r into entry from jsonb_array_elements(savings_refunds_private.termination_rows())r where r->>'source_record_id'=src.id::text;
 candidates:=entry->'candidates';
 if exists(select 1 from public.savings_requests q join public.savings_enrollments e on e.id=q.enrollment_id join public.savings_participants p on p.id=e.participant_id
  where q.metadata->>'source_record_id'=src.id::text and (p.legacy_folio is distinct from control or p.data_classification<>'CANONICAL' or e.data_classification<>'CANONICAL')) then raise exception 'SAVINGS_TERMINATION_IDENTITY_CONFLICT';end if;
 if enrollment is not null then
  perform 1 from public.savings_enrollments where id=enrollment for share;
  -- Re-read after acquiring the lock: an ordinary canonical writer may have
  -- committed a termination while this command waited for its row.
  select r into entry from jsonb_array_elements(savings_refunds_private.termination_rows())r where r->>'source_record_id'=src.id::text;
  candidates:=entry->'candidates';
  select c into selected from jsonb_array_elements(candidates)c where c->>'id'=enrollment::text;
  if selected is null then raise exception 'SAVINGS_TERMINATION_CYCLE_MISMATCH';end if;
  if (selected->>'started_on')::date>effective then raise exception 'SAVINGS_TERMINATION_DATE_INVALID';end if;
  if mode='ATTESTED' and (exists(select 1 from (select distinct on(vv.source_record_id) vv.source_record_id,vv.enrollment_id,vv.mode from savings_refunds_private.termination_versions vv order by vv.source_record_id,vv.version desc)v where v.source_record_id<>src.id and v.enrollment_id=enrollment and v.mode='ATTESTED')
   or exists(select 1 from public.savings_requests q where q.enrollment_id=enrollment and q.metadata->>'source_record_id' is not null and q.metadata->>'source_record_id'<>src.id::text))
  then raise exception 'SAVINGS_TERMINATION_ENROLLMENT_ALREADY_LINKED';end if;
 end if;
 if exists(select 1 from jsonb_array_elements(candidates)c where (c->>'linked')::boolean and c->>'id' is distinct from enrollment::text) then raise exception 'SAVINGS_TERMINATION_CANONICAL_CONFLICT';end if;
 if mode='LINK' then
  if enrollment is null or selected->>'terminated_on' is null or (selected->>'terminated_on')::date is distinct from effective then raise exception 'SAVINGS_TERMINATION_CANONICAL_DATE_REQUIRED';end if;
  if exists(select 1 from jsonb_array_elements(candidates)c where c->>'id'<>enrollment::text and (c->>'linked')::boolean and c->>'terminated_on' is not null) then raise exception 'SAVINGS_TERMINATION_CANONICAL_CONFLICT';end if;
 else
  if (selected->>'terminated_on' is not null) or (enrollment is null and exists(select 1 from jsonb_array_elements(candidates)c where c->>'terminated_on' is not null and (c->>'started_on' is null or (c->>'started_on')::date<=effective))) then raise exception 'SAVINGS_TERMINATION_USE_CANONICAL_LINK';end if;
  if enrollment is null and exists(select 1 from jsonb_array_elements(candidates)c where c->>'started_on' is null or (c->>'started_on')::date<=effective) then raise exception 'SAVINGS_TERMINATION_CYCLE_REQUIRED';end if;
 end if;
 end if;
 new_version:=coalesce(previous.version,0)+1;
 insert into savings_refunds_private.termination_versions(source_record_id,source_fingerprint,numero_control,version,mode,enrollment_id,effective_on,reason,evidence_reference,actor_real_auth_user_id,usuario_contexto_affiliate_id,command,client_action_id)
 values(src.id,fingerprint,control,new_version,mode,enrollment,effective,btrim(p_command->>'reason'),btrim(p_command->>'evidence_reference'),actor,context_id,p_command,p_client_action_id) returning * into prior;
 -- A date correction reopens both old and new closed-month review receipts.
 for review_period in select distinct x from unnest(array[date_trunc('month',previous.effective_on)::date,date_trunc('month',effective)::date])x where x is not null order by x loop
  perform pg_advisory_xact_lock(hashtextextended('savings-refund-month:'||review_period,0));
 end loop;
 update savings_refunds_private.reporting_periods set invalidated_at=clock_timestamp()
 where period in (date_trunc('month',previous.effective_on)::date,date_trunc('month',effective)::date) and invalidated_at is null;
 return to_jsonb(prior)-'command';
end $$;

-- Keep the original body/OID as a private dependency; no duplicated report logic.
alter function public.get_admin_reports_jc_savings(integer) set schema savings_refunds_private;
alter function savings_refunds_private.get_admin_reports_jc_savings(integer) rename to reports_base;
revoke all on function savings_refunds_private.reports_base(integer) from public,anon,authenticated,service_role;
create function public.get_admin_reports_jc_savings(p_year integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rows jsonb; added jsonb; pending jsonb; issues jsonb;
begin
 result:=savings_refunds_private.reports_base(p_year); -- Retains all report-specific backend authorization.
 rows:=savings_refunds_private.termination_rows();
 select coalesce(jsonb_agg(jsonb_build_object('id','termination-attested:'||(r->>'source_record_id'),'kind','cancellation','occurred_on',r->>'effective_on',
  'source_table','savings_refunds_private.termination_versions','source_id',r->>'source_record_id','numero_control',r->>'numero_control',
  'detail',jsonb_build_object('historical',true,'mode','ATTESTED','version',r->'version','source_record_id',r->>'source_record_id','evidence_reference',r->>'evidence_reference'))),'[]'::jsonb) into added
 from jsonb_array_elements(rows)r where r->>'status'='RESOLVED' and r->>'mode'='ATTESTED' and extract(year from (r->>'effective_on')::date)=p_year;
 select coalesce(jsonb_agg(r),'[]'::jsonb) into pending from jsonb_array_elements(rows)r where r->>'status' not in ('RESOLVED','VOIDED') and p_year<=extract(year from public.savings_operation_today())
 and (r->>'requested_on' is null or (r->>'requested_on')::date<=make_date(p_year,12,31));
 select coalesce(jsonb_agg(i),'[]'::jsonb) into issues from jsonb_array_elements(result->'issues')i where i->>'code'<>'HISTORICAL_TERMINATION_UNMAPPED';
 if jsonb_array_length(pending)>0 then
  issues:=issues||jsonb_build_array(jsonb_build_object('code','HISTORICAL_TERMINATION_UNMAPPED','count',jsonb_array_length(pending),'scope','savings','severity','blocking',
   'months',(select coalesce(jsonb_agg(extract(month from m.day)::integer order by m.day),'[]'::jsonb)
    from generate_series(make_date(p_year,1,1)::timestamp,make_date(p_year,12,1)::timestamp,interval '1 month')m(day)
    where m.day::date<=public.savings_operation_today() and exists(select 1 from jsonb_array_elements(pending)r
     where r->>'requested_on' is null or (r->>'requested_on')::date<(m.day+interval '1 month')::date)),
   'sourceIds',(select jsonb_agg(r->'source_record_id') from jsonb_array_elements(pending)r),
   'detail',jsonb_build_object('metric','cancellation','columns',jsonb_build_array('G','H'),'severity','blocking','action','OPEN_SAVINGS_REGULARIZATION',
    'records',(select jsonb_agg(jsonb_build_object('source_record_id',r->>'source_record_id','numero_control',r->>'numero_control','status',r->>'status','requested_on',r->>'requested_on')) from jsonb_array_elements(pending)r),
    'note','Completar o revisar la constancia de fecha efectiva en Caja de Ahorro. No se infiere de la fecha de finalización.')));
 end if;
 return jsonb_set(jsonb_set(result,'{events}',(result->'events')||added),'{issues}',issues)
  ||jsonb_build_object('regularization',jsonb_build_object('pending_termination_count',jsonb_array_length(pending),'authority','IMMUTABLE_EXACT_SOURCE_TERMINATION_EVIDENCE','financial_writes',false));
end $$;

revoke all on all functions in schema savings_refunds_private from public,anon,authenticated,service_role;
revoke all on function public.get_admin_savings_regularization(integer,text),public.save_admin_savings_termination(jsonb,uuid),public.get_admin_reports_jc_savings(integer) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_regularization(integer,text),public.save_admin_savings_termination(jsonb,uuid),public.get_admin_reports_jc_savings(integer) to authenticated;
commit;
