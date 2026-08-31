begin;

-- H-REQUEST-WORKFLOW-TIMELINE-CUTOVER-001
-- Supabase remains the only request/workflow authority. These columns capture
-- an immutable definition snapshot; they do not duplicate mutable request data.
alter table public.operational_workflows
  add column version integer not null default 1 check(version>=1);

alter table public.operational_workflow_stages
  add column enabled boolean not null default true;

alter table public.program_requests
  add column workflow_id uuid null references public.operational_workflows(id) on delete restrict,
  add column workflow_version integer null check(workflow_version is null or workflow_version>=1),
  add column workflow_snapshot jsonb null check(workflow_snapshot is null or jsonb_typeof(workflow_snapshot)='object');

create index program_requests_workflow_created_idx on public.program_requests(workflow_id,created_at desc);
create index workflow_stages_enabled_sort_idx on public.operational_workflow_stages(workflow_id,enabled,sort_order,id);

-- Durable before/after evidence for workflow administration. The generic
-- admin_audit_log remains active as the global actor/resource audit.
create table public.operational_workflow_change_audit (
  id bigint generated always as identity primary key,
  actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
  resource text not null check(resource in('operational_workflows','operational_workflow_stages','operational_request_tracking')),
  action text not null check(action in('INSERT','UPDATE','DELETE')),
  target_id text null,
  workflow_id uuid null,
  before_data jsonb null,
  after_data jsonb null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index operational_workflow_change_audit_created_idx on public.operational_workflow_change_audit(created_at desc,id desc);
alter table public.operational_workflow_change_audit enable row level security;
alter table public.operational_workflow_change_audit force row level security;
revoke all on public.operational_workflow_change_audit from public,anon,authenticated;
revoke all on sequence public.operational_workflow_change_audit_id_seq from public,anon,authenticated;
grant select on public.operational_workflow_change_audit to authenticated;
create policy operational_workflow_change_audit_read on public.operational_workflow_change_audit
for select to authenticated using(public.has_admin_permission('workflow.read'));

create function public.audit_operational_workflow_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_before jsonb;v_after jsonb;v_target text;v_workflow uuid;v_reason text;
begin
  if auth.uid() is null then return coalesce(new,old); end if;
  v_before:=case when tg_op='INSERT' then null else to_jsonb(old) end;
  v_after:=case when tg_op='DELETE' then null else to_jsonb(new) end;
  v_target:=coalesce(v_after->>'id',v_before->>'id',v_after->>'request_id',v_before->>'request_id');
  v_workflow:=nullif(coalesce(v_after->>'workflow_id',v_before->>'workflow_id',case when tg_table_name='operational_workflows' then v_target end),'')::uuid;
  v_reason:=coalesce(nullif(btrim(current_setting('app.workflow_change_reason',true)),''),'Administración de etapas y seguimiento');
  insert into public.operational_workflow_change_audit(
    actor_real_auth_user_id,resource,action,target_id,workflow_id,before_data,after_data,reason
  ) values(auth.uid(),tg_table_name,tg_op,v_target,v_workflow,v_before,v_after,v_reason);
  return coalesce(new,old);
end $$;

-- Four initial definitions migrate the previously approved timelines into the
-- real authority. Canonical request:* keys are explicit fallbacks, not implicit
-- first-row selection. Specific service keys configured in Admin rank higher.
insert into public.operational_workflows(id,name,description,workflow_type,service_keys,enabled,sort_order,version) values
('10000000-0000-4000-8000-000000000001','Financiamiento vía nómina','Seguimiento de solicitudes con revisión financiera y depósito vía nómina.','request',array['request:loan'],true,10,1),
('10000000-0000-4000-8000-000000000002','Solicitud de membresía','Seguimiento de alta y activación de membresías.','request',array['request:membership'],true,20,1),
('10000000-0000-4000-8000-000000000003','Cotización comercial','Seguimiento de solicitudes que requieren una cotización.','request',array['request:quote'],true,30,1),
('10000000-0000-4000-8000-000000000004','Solicitud de beneficio','Seguimiento general de beneficios y servicios.','request',array['request:benefit'],true,40,1);

insert into public.operational_workflow_stages(
  id,workflow_id,name,description,responsible,outcome,sla_days,service_keys,status_reference,captures_date,sort_order,enabled
) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Solicitud enviada','La solicitud quedó registrada con su folio.','Sistema','process',null,'{}',null,true,10,true),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Revisión de documentos','El comité revisa el expediente de la solicitud.','Finanzas','process',1,'{}','submitted,in_review,requires_financial_processing',true,20,true),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Autorización','El área responsable comunica la resolución de la solicitud.','Finanzas','success',null,'{}','approved',true,30,true),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Depósito vía nómina','El depósito se gestiona conforme al proceso autorizado.','Finanzas','success',null,'{}',null,true,40,true),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Solicitud no aprobada','La solicitud fue cerrada sin autorización.','Finanzas','failure',null,'{}','rejected,cancelled',true,50,true),
('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000002','Solicitud enviada','La solicitud quedó registrada con su folio.','Sistema','process',null,'{}',null,true,10,true),
('20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000002','Revisión de documentos','El área responsable revisa la información y los documentos enviados.','Sindicato','process',2,'{}','submitted,in_review,requires_financial_processing',true,20,true),
('20000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000002','Resolución','Se comunica la resolución de la membresía.','Sindicato','success',null,'{}','approved',true,30,true),
('20000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000002','Activación de membresía','La membresía queda disponible después de su aprobación.','Sistema','success',null,'{}',null,true,40,true),
('20000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000002','Solicitud no aprobada','La solicitud de membresía fue cerrada sin aprobación.','Sindicato','failure',null,'{}','rejected,cancelled',true,50,true),
('20000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000003','Solicitud enviada','La solicitud de cotización quedó registrada con su folio.','Sistema','process',null,'{}',null,true,10,true),
('20000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000003','Preparación de cotización','La empresa o proveedor prepara el presupuesto solicitado.','Empresa / proveedor','process',2,'{}','submitted,in_review,requires_financial_processing',true,20,true),
('20000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000003','Cotización disponible','El presupuesto ya está disponible para continuar.','Empresa / proveedor','success',null,'{}','approved',true,30,true),
('20000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000003','Simulación de financiamiento','La persona afiliada puede revisar las opciones aplicables.','Afiliado','success',null,'{}',null,true,40,true),
('20000000-0000-4000-8000-000000000025','10000000-0000-4000-8000-000000000003','Cotización cerrada','La solicitud de cotización fue cerrada.','Empresa / proveedor','failure',null,'{}','rejected,cancelled',true,50,true),
('20000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000004','Solicitud enviada','La solicitud quedó registrada con su folio.','Sistema','process',null,'{}',null,true,10,true),
('20000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000004','Revisión del área responsable','El área responsable revisa la solicitud y sus requisitos.','Sindicato','process',2,'{}','submitted,in_review,requires_financial_processing',true,20,true),
('20000000-0000-4000-8000-000000000033','10000000-0000-4000-8000-000000000004','Resolución','Se comunica la resolución de la solicitud.','Sindicato','success',null,'{}','approved',true,30,true),
('20000000-0000-4000-8000-000000000034','10000000-0000-4000-8000-000000000004','Seguimiento','El área responsable completa el seguimiento correspondiente.','Sindicato','success',null,'{}',null,true,40,true),
('20000000-0000-4000-8000-000000000035','10000000-0000-4000-8000-000000000004','Solicitud no aprobada','La solicitud fue cerrada sin aprobación.','Sindicato','failure',null,'{}','rejected,cancelled',true,50,true);

create function public.request_workflow_candidate_keys(p_request public.program_requests)
returns table(service_key text,priority integer)
language sql immutable set search_path=''
as $$
  select candidate.service_key,min(candidate.priority)::integer
  from (values
    (p_request.membership_offering_id::text,1),('membership:'||p_request.membership_offering_id::text,2),
    (p_request.product_id::text,3),('product:'||p_request.product_id::text,4),
    (p_request.program_item_id::text,5),('program-item:'||p_request.program_item_id::text,6),
    (p_request.company_id::text,7),('company:'||p_request.company_id::text,8),
    (nullif(btrim(p_request.program_id),''),20),('program:'||nullif(btrim(p_request.program_id),''),21),
    (case when p_request.financial_processing_status is not null or p_request.status='requires_financial_processing' or p_request.requested_amount is not null then 'request:loan' end,90),
    (case when p_request.membership_offering_id is not null then 'request:membership' end,91),
    (case when p_request.membership_offering_id is null and p_request.request_type='quote' then 'request:quote' end,92),
    (case when p_request.membership_offering_id is null and p_request.request_type<>'quote' then 'request:benefit' end,93)
  ) candidate(service_key,priority)
  where candidate.service_key is not null and candidate.service_key<>''
  group by candidate.service_key
$$;

create function public.build_program_request_workflow_snapshot(p_request public.program_requests)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_workflow public.operational_workflows%rowtype;v_best integer;v_matches integer;v_keys text[];v_stages jsonb;v_mapped integer;
begin
  select array_agg(service_key order by priority,service_key) into v_keys from public.request_workflow_candidate_keys(p_request);
  select min(c.priority) into v_best
  from public.operational_workflows w join public.request_workflow_candidate_keys(p_request) c on c.service_key=any(w.service_keys)
  where w.enabled and w.workflow_type='request';
  if v_best is null then raise exception 'REQUEST_WORKFLOW_NOT_CONFIGURED' using errcode='P0001'; end if;
  select count(distinct w.id),(array_agg(distinct w.id order by w.id))[1] into v_matches,v_workflow.id
  from public.operational_workflows w join public.request_workflow_candidate_keys(p_request) c on c.service_key=any(w.service_keys)
  where w.enabled and w.workflow_type='request' and c.priority=v_best;
  if v_matches<>1 then raise exception 'REQUEST_WORKFLOW_AMBIGUOUS' using errcode='P0001'; end if;
  select * into v_workflow from public.operational_workflows where id=v_workflow.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'label',s.name,'description',s.description,'responsible',s.responsible,'outcome',s.outcome,
    'sla_days',s.sla_days,'status_references',to_jsonb(array(select btrim(x) from unnest(string_to_array(coalesce(s.status_reference,''),',')) x where btrim(x)<>'')),
    'captures_date',s.captures_date,'sort_order',s.sort_order
  ) order by s.sort_order,s.id),'[]'::jsonb) into v_stages
  from public.operational_workflow_stages s
  where s.workflow_id=v_workflow.id and s.enabled and (cardinality(s.service_keys)=0 or s.service_keys&&v_keys);
  if jsonb_array_length(v_stages)=0 then raise exception 'REQUEST_WORKFLOW_HAS_NO_STAGES' using errcode='P0001'; end if;

  select count(*) into v_mapped from jsonb_array_elements(v_stages) stage
  where stage->'status_references'?p_request.status
    and (case when p_request.status in('rejected','cancelled') then stage->>'outcome'<>'success' else stage->>'outcome'<>'failure' end);
  if v_mapped<>1 then raise exception 'REQUEST_WORKFLOW_STATUS_MAPPING_INVALID' using errcode='P0001'; end if;

  return jsonb_build_object(
    'workflow_id',v_workflow.id,'workflow_version',v_workflow.version,'workflow_name',v_workflow.name,
    'workflow_description',v_workflow.description,'assignment_priority',v_best,'candidate_keys',to_jsonb(v_keys),'stages',v_stages
  );
end $$;

create function public.capture_program_request_workflow_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_snapshot jsonb;
begin
  v_snapshot:=public.build_program_request_workflow_snapshot(new);
  new.workflow_id:=(v_snapshot->>'workflow_id')::uuid;
  new.workflow_version:=(v_snapshot->>'workflow_version')::integer;
  new.workflow_snapshot:=v_snapshot;
  return new;
end $$;

create trigger program_requests_capture_workflow_snapshot
before insert on public.program_requests for each row execute function public.capture_program_request_workflow_snapshot();

-- Owner confirmed and the live preflight proved every pre-cutover request is a
-- controlled fixture. Only the new workflow fields are normalized here.
do $$
declare r public.program_requests%rowtype;v_snapshot jsonb;
begin
  for r in select * from public.program_requests where workflow_snapshot is null order by created_at,id for update loop
    v_snapshot:=public.build_program_request_workflow_snapshot(r);
    update public.program_requests set
      workflow_id=(v_snapshot->>'workflow_id')::uuid,
      workflow_version=(v_snapshot->>'workflow_version')::integer,
      workflow_snapshot=v_snapshot
    where id=r.id;
  end loop;
end $$;

insert into public.operational_request_tracking(request_id,workflow_id,current_stage_id,stage_dates)
select r.id,r.workflow_id,null,
  case when first_stage.id is null or not first_stage.captures_date then '{}'::jsonb
       else jsonb_build_object(first_stage.id,r.created_at) end
from public.program_requests r
left join lateral (
  select stage->>'id' id,coalesce((stage->>'captures_date')::boolean,false) captures_date
  from jsonb_array_elements(r.workflow_snapshot->'stages') stage
  order by (stage->>'sort_order')::integer,stage->>'id' limit 1
) first_stage on true
on conflict(request_id) do nothing;

alter table public.program_requests
  alter column workflow_id set not null,
  alter column workflow_version set not null,
  alter column workflow_snapshot set not null;

create function public.protect_program_request_workflow_snapshot()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.workflow_id is distinct from old.workflow_id or new.workflow_version is distinct from old.workflow_version or new.workflow_snapshot is distinct from old.workflow_snapshot then
    raise exception 'REQUEST_WORKFLOW_SNAPSHOT_IMMUTABLE' using errcode='42501';
  end if;
  return new;
end $$;
create trigger program_requests_protect_workflow_snapshot
before update on public.program_requests for each row execute function public.protect_program_request_workflow_snapshot();

create function public.validate_operational_workflow_configuration(p_workflow_id uuid)
returns void language plpgsql stable security definer set search_path=''
as $$
declare v_enabled boolean;v_keys text[];
begin
  select enabled,service_keys into v_enabled,v_keys from public.operational_workflows where id=p_workflow_id;
  if not found or not v_enabled then return; end if;
  if cardinality(v_keys)=0 then raise exception 'WORKFLOW_SERVICE_REQUIRED' using errcode='22023'; end if;
  if not exists(select 1 from public.operational_workflow_stages where workflow_id=p_workflow_id and enabled) then
    raise exception 'WORKFLOW_STAGE_REQUIRED' using errcode='22023';
  end if;
  if exists(
    select 1 from public.operational_workflow_stages s cross join lateral regexp_split_to_table(coalesce(s.status_reference,''),'\s*,\s*') token
    where s.workflow_id=p_workflow_id and s.enabled and token<>'' and token not in('submitted','in_review','approved','rejected','cancelled','requires_financial_processing')
  ) then raise exception 'WORKFLOW_STATUS_REFERENCE_INVALID' using errcode='22023'; end if;
  if exists(
    select 1 from public.operational_workflow_stages a join public.operational_workflow_stages b
      on b.workflow_id=a.workflow_id and b.id>a.id and b.enabled and a.enabled and b.sort_order=a.sort_order
      and (cardinality(a.service_keys)=0 or cardinality(b.service_keys)=0 or a.service_keys&&b.service_keys)
    where a.workflow_id=p_workflow_id
  ) then raise exception 'WORKFLOW_STAGE_ORDER_CONFLICT' using errcode='22023'; end if;
  if exists(
    select 1 from public.operational_workflow_stages a join public.operational_workflow_stages b
      on b.workflow_id=a.workflow_id and b.id>a.id and b.enabled and a.enabled
      and (cardinality(a.service_keys)=0 or cardinality(b.service_keys)=0 or a.service_keys&&b.service_keys)
      and string_to_array(replace(coalesce(a.status_reference,''),' ',''),',')&&string_to_array(replace(coalesce(b.status_reference,''),' ',''),',')
    where a.workflow_id=p_workflow_id and coalesce(a.status_reference,'')<>'' and coalesce(b.status_reference,'')<>''
  ) then raise exception 'WORKFLOW_STATUS_REFERENCE_CONFLICT' using errcode='22023'; end if;
end $$;

create function public.validate_operational_workflow_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_new jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;v_old jsonb:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;v_id uuid;
begin
  v_id:=nullif(coalesce(v_new->>'workflow_id',v_new->>'id',v_old->>'workflow_id',v_old->>'id'),'')::uuid;
  perform public.validate_operational_workflow_configuration(v_id);
  return coalesce(new,old);
end $$;

create constraint trigger operational_workflows_validate
after insert or update on public.operational_workflows deferrable initially deferred
for each row execute function public.validate_operational_workflow_trigger();
create constraint trigger operational_workflow_stages_validate
after insert or update or delete on public.operational_workflow_stages deferrable initially deferred
for each row execute function public.validate_operational_workflow_trigger();

create function public.bump_operational_workflow_version()
returns trigger language plpgsql set search_path=''
as $$
begin
  if row(new.name,new.description,new.workflow_type,new.service_keys,new.enabled,new.sort_order)
     is distinct from row(old.name,old.description,old.workflow_type,old.service_keys,old.enabled,old.sort_order) then
    new.version:=old.version+1;
  end if;
  return new;
end $$;
create trigger operational_workflows_bump_version
before update on public.operational_workflows for each row execute function public.bump_operational_workflow_version();

create function public.bump_operational_workflow_version_from_stage()
returns trigger language plpgsql security definer set search_path=''
as $$ begin update public.operational_workflows set version=version+1 where id=coalesce(new.workflow_id,old.workflow_id);return coalesce(new,old);end $$;
create trigger operational_workflow_stages_bump_version
after insert or update or delete on public.operational_workflow_stages
for each row execute function public.bump_operational_workflow_version_from_stage();

create function public.validate_operational_request_tracking()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_snapshot jsonb;
begin
  select workflow_snapshot into v_snapshot from public.program_requests where id=new.request_id;
  if v_snapshot is null or (v_snapshot->>'workflow_id')::uuid is distinct from new.workflow_id then
    raise exception 'REQUEST_TRACKING_WORKFLOW_MISMATCH' using errcode='22023';
  end if;
  if new.current_stage_id is not null and not exists(select 1 from jsonb_array_elements(v_snapshot->'stages') s where (s->>'id')::uuid=new.current_stage_id) then
    raise exception 'REQUEST_TRACKING_STAGE_MISMATCH' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(coalesce(new.stage_dates,'{}'::jsonb)) key where not exists(select 1 from jsonb_array_elements(v_snapshot->'stages') s where s->>'id'=key)) then
    raise exception 'REQUEST_TRACKING_DATE_STAGE_MISMATCH' using errcode='22023';
  end if;
  return new;
end $$;
create trigger operational_request_tracking_validate
before insert or update on public.operational_request_tracking for each row execute function public.validate_operational_request_tracking();

create function public.reorder_operational_workflow_stages(p_workflow_id uuid,p_stage_ids uuid[])
returns integer language plpgsql security definer set search_path=''
as $$ declare v_total integer;v_distinct integer;v_changed integer;
begin
  if not public.has_admin_permission('workflow.write') then raise exception 'WORKFLOW_WRITE_DENIED' using errcode='42501'; end if;
  select count(*) into v_total from public.operational_workflow_stages where workflow_id=p_workflow_id;
  select count(distinct id) into v_distinct from unnest(coalesce(p_stage_ids,array[]::uuid[])) id;
  if v_total=0 or cardinality(coalesce(p_stage_ids,array[]::uuid[]))<>v_total or v_distinct<>v_total or exists(
    select 1 from unnest(p_stage_ids) id where not exists(select 1 from public.operational_workflow_stages s where s.id=id and s.workflow_id=p_workflow_id)
  ) then raise exception 'WORKFLOW_STAGE_ORDER_INVALID' using errcode='22023'; end if;
  perform set_config('app.workflow_change_reason','Reordenamiento de etapas',true);
  update public.operational_workflow_stages s set sort_order=(ordered.ordinality*10)::integer
  from unnest(p_stage_ids) with ordinality ordered(id,ordinality)
  where s.id=ordered.id and s.workflow_id=p_workflow_id;
  get diagnostics v_changed=row_count;
  return v_changed;
end $$;

-- Physical deletion is replaced by enabled=false retirement. Historical stage
-- IDs and immutable snapshots therefore remain resolvable.
revoke delete on public.operational_workflows,public.operational_workflow_stages from authenticated;

create function public.resolve_program_request_workflow_state(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare r public.program_requests%rowtype;t public.operational_request_tracking%rowtype;v_stages jsonb;v_current text;v_current_order integer;v_current_stage jsonb;v_resolved jsonb;
begin
  select * into r from public.program_requests where id=p_request_id;
  if r.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  if auth.role()<>'service_role' and not(
    auth.uid() is not null and (r.affiliate_id=public.get_effective_affiliate_id() or public.has_admin_permission('workflow.read') or public.has_admin_permission('program_requests.read'))
  ) then raise exception 'REQUEST_WORKFLOW_DENIED' using errcode='42501'; end if;
  if r.workflow_snapshot is null then return jsonb_build_object('available',false,'reason','WORKFLOW_SNAPSHOT_MISSING','message','Seguimiento no disponible'); end if;
  select * into t from public.operational_request_tracking where request_id=r.id;
  select coalesce(jsonb_agg(stage order by (stage->>'sort_order')::integer,stage->>'id'),'[]'::jsonb) into v_stages
  from jsonb_array_elements(r.workflow_snapshot->'stages') stage
  where case when r.status in('rejected','cancelled') then stage->>'outcome'<>'success' else stage->>'outcome'<>'failure' end;
  if t.current_stage_id is not null and exists(select 1 from jsonb_array_elements(v_stages) stage where stage->>'id'=t.current_stage_id::text) then
    v_current:=t.current_stage_id::text;
  else
    select stage->>'id' into v_current from jsonb_array_elements(v_stages) stage
    where stage->'status_references'?r.status order by (stage->>'sort_order')::integer,stage->>'id' limit 1;
  end if;
  if v_current is null then return jsonb_build_object('available',false,'reason','WORKFLOW_STATUS_UNMAPPED','message','Seguimiento no disponible'); end if;
  select (stage->>'sort_order')::integer,stage into v_current_order,v_current_stage from jsonb_array_elements(v_stages) stage where stage->>'id'=v_current;
  select coalesce(jsonb_agg(
    stage||jsonb_build_object(
      'state',case when (stage->>'sort_order')::integer<v_current_order then 'done' when stage->>'id'=v_current then 'current' else 'upcoming' end,
      'date',t.stage_dates->>(stage->>'id')
    ) order by (stage->>'sort_order')::integer,stage->>'id'
  ),'[]'::jsonb) into v_resolved from jsonb_array_elements(v_stages) stage;
  return jsonb_strip_nulls(jsonb_build_object(
    'available',true,'workflow_id',r.workflow_id,'workflow_version',r.workflow_version,
    'workflow_name',r.workflow_snapshot->>'workflow_name','workflow_description',r.workflow_snapshot->>'workflow_description',
    'request_status',r.status,'current_stage_id',v_current,'current_stage',v_current_stage,
    'active_note',nullif(v_current_stage->>'description',''),'stages',v_resolved
  ));
end $$;

create function public.get_self_request_workflow_state(p_request_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$ select public.resolve_program_request_workflow_state(p_request_id) $$;

create or replace function public.list_self_program_request_history()
returns setof jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_affiliate_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  v_affiliate_id:=public.get_effective_affiliate_id();
  if v_affiliate_id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  return query
  select jsonb_strip_nulls(jsonb_build_object(
    'id',r.id,'folio',r.folio,'program_id',r.program_id,'program_item_id',r.program_item_id,'product_id',r.product_id,
    'membership_offering_id',r.membership_offering_id,'company_id',r.company_id,'request_type',r.request_type,'status',r.status,
    'quantity',r.quantity,'notes',r.notes,'financial_processing_status',r.financial_processing_status,
    'requested_amount',r.requested_amount,'requested_term',r.requested_term,'requested_term_semantics',r.requested_term_semantics,
    'quoted_amount',r.quoted_amount,'quote_note',r.quote_note,'valid_until',r.valid_until,'responded_at',r.responded_at,
    'created_at',r.created_at,'updated_at',r.updated_at,
    'workflow_state',public.resolve_program_request_workflow_state(r.id),
    'program_item',case when pi.id is null then null else jsonb_build_object('name',pi.name,'program_key',pi.program_key,'price_cash',pi.price_cash) end,
    'product',case when p.id is null then null else jsonb_build_object('name',p.name,'price',p.price) end,
    'membership',case when m.id is null then null else jsonb_build_object('company_raw',m.company_raw,'concept',m.concept,'amount',m.amount) end,
    'company',case when c.id is null then null else jsonb_build_object('display_name',c.display_name) end
  ))
  from public.program_requests r
  left join public.program_catalog_items pi on pi.id=r.program_item_id
  left join public.marketplace_products p on p.id=r.product_id
  left join public.membership_offerings m on m.id=r.membership_offering_id
  left join public.companies c on c.id=r.company_id
  where r.affiliate_id=v_affiliate_id order by r.created_at desc,r.id desc;
end $$;

create function public.list_admin_request_workflow_tracking()
returns setof jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.has_admin_permission('workflow.read') then raise exception 'WORKFLOW_READ_DENIED' using errcode='42501'; end if;
  return query select jsonb_strip_nulls(jsonb_build_object(
    'id',r.id,'folio',r.folio,'program_id',r.program_id,'request_type',r.request_type,'status',r.status,'created_at',r.created_at,
    'context_label',coalesce(pi.name,p.name,m.company_raw||' - '||m.concept,c.display_name,r.program_id),
    'workflow_state',public.resolve_program_request_workflow_state(r.id)
  ))
  from public.program_requests r
  left join public.program_catalog_items pi on pi.id=r.program_item_id
  left join public.marketplace_products p on p.id=r.product_id
  left join public.membership_offerings m on m.id=r.membership_offering_id
  left join public.companies c on c.id=r.company_id
  order by r.created_at desc,r.id desc;
end $$;

revoke all on function public.request_workflow_candidate_keys(public.program_requests),public.build_program_request_workflow_snapshot(public.program_requests),
  public.capture_program_request_workflow_snapshot(),public.protect_program_request_workflow_snapshot(),
  public.validate_operational_workflow_configuration(uuid),public.validate_operational_workflow_trigger(),
  public.bump_operational_workflow_version(),public.bump_operational_workflow_version_from_stage(),
  public.validate_operational_request_tracking(),public.resolve_program_request_workflow_state(uuid),
  public.audit_operational_workflow_change() from public,anon,authenticated,service_role;
revoke all on function public.get_self_request_workflow_state(uuid),public.list_admin_request_workflow_tracking() from public,anon,authenticated,service_role;
revoke all on function public.reorder_operational_workflow_stages(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.get_self_request_workflow_state(uuid),public.list_self_program_request_history(),public.list_admin_request_workflow_tracking(),public.reorder_operational_workflow_stages(uuid,uuid[]) to authenticated;

create trigger operational_workflows_change_audit after insert or update or delete on public.operational_workflows
for each row execute function public.audit_operational_workflow_change();
create trigger operational_workflow_stages_change_audit after insert or update or delete on public.operational_workflow_stages
for each row execute function public.audit_operational_workflow_change();
create trigger operational_request_tracking_change_audit after insert or update or delete on public.operational_request_tracking
for each row execute function public.audit_operational_workflow_change();

comment on column public.program_requests.workflow_snapshot is 'Immutable versioned stage-definition snapshot captured server-side at request creation; mutable Admin definitions never rewrite it.';
comment on column public.operational_workflows.version is 'Monotonic configuration version incremented by workflow or stage changes.';
comment on column public.operational_workflow_stages.enabled is 'Retirement flag. Historical snapshots retain prior stage content and IDs.';
comment on table public.operational_workflow_change_audit is 'Append-only before/after audit of workflow, stage and request-tracking administration with actor_real.';
comment on function public.resolve_program_request_workflow_state(uuid) is 'Central request timeline resolver over immutable snapshot, real request status and optional audited tracking override.';

notify pgrst,'reload schema';
commit;
