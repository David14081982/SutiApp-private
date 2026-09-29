-- One documentary presentation authority. No financial or historical document writes.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
alter table document_private.installation add column layout_scope_recovery jsonb;
update document_private.installation set layout_scope_recovery=(select jsonb_object_agg(s,pg_get_functiondef(s::regprocedure)) from unnest(array[
 'public.document_layout_context(text,jsonb)','public.document_layout_persist(text,jsonb)',
 'document_private.capture_event()','public.document_generation_worker(text,jsonb)','document_private.reissue(jsonb)']) s);
alter table document_private.layouts add column name text not null default 'Diseño documental' check(length(btrim(name)) between 1 and 120);
alter table document_private.layout_activations add column fund_key text not null default '' check(length(fund_key)<=160);
alter table document_private.layout_activations drop constraint layout_activations_program_document_type_layout_id_fkey;
alter table document_private.layouts add constraint layout_document_type_version_unique unique(document_type,id);
alter table document_private.layout_activations add constraint layout_activation_version_fk foreign key(document_type,layout_id) references document_private.layouts(document_type,id);
create index document_layout_fund_scope on document_private.layout_activations(program,document_type,fund_key,created_at desc,id desc);

create function document_private.layout_assignment(p_program text,p_type text,p_fund text,p_at timestamptz)
returns document_private.layout_activations language sql stable security definer set search_path='' as $$
 select a from document_private.layout_activations a where a.program=p_program and a.document_type=p_type
 and a.fund_key in ('',coalesce(p_fund,'')) and a.created_at<=p_at
 order by (a.fund_key=coalesce(p_fund,'')) desc,a.created_at desc,a.id desc limit 1
$$;
create function document_private.resolve_scoped_layout(p_program text,p_type text,p_at timestamptz,p_source jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg jsonb;a document_private.layout_activations%rowtype;l document_private.layouts%rowtype;t jsonb;fund text:='';layout_at timestamptz:=p_at;
begin
 if p_type='LOAN_APPROVAL' then
  fund:=public.normalize_suti_financial_key(p_source#>>'{operation,financial,financialResult,fund}');
  if coalesce(fund,'')='' then raise exception 'DOCUMENT_LAYOUT_FUND_MISSING';end if;
 end if;
 if p_source->>'layout_resolution_at' is not null then layout_at:=(p_source->>'layout_resolution_at')::timestamptz;end if;
 a:=document_private.layout_assignment(p_program,p_type,fund,layout_at);
 if a.layout_id is null then raise exception 'DOCUMENT_LAYOUT_ASSIGNMENT_MISSING';end if;
 select * into l from document_private.layouts where id=a.layout_id and document_type=p_type;
 if l.id is null then raise exception 'DOCUMENT_LAYOUT_SCOPE_DENIED';end if;
 cfg:=document_private.resolve_configuration_without_layout(p_program,p_type,p_at);
 select to_jsonb(v)||jsonb_build_object('asset',to_jsonb(x)) into t from document_private.templates v join document_private.assets x on x.id=v.asset_id where v.id=l.template_id;
 return cfg||jsonb_build_object('template',t,'layout',to_jsonb(l)-array['created_by','context_affiliate'],'layout_assignment',jsonb_build_object('id',a.id,'program',p_program,'document_type',p_type,'fund_key',a.fund_key));
end $$;

create or replace function public.document_layout_context(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare prog text:=p_data->>'program';typ text:=p_data->>'document_type';fund text:=coalesce(p_data->>'fund_key','');v document_private.layouts%rowtype;cfg jsonb;a document_private.layout_activations%rowtype;destinations jsonb;
begin
 if auth.uid() is null then raise exception 'DOCUMENT_AUTH_REQUIRED' using errcode='42501';end if;
 if p_action not in ('READ','WRITE','VERSION') then raise exception 'DOCUMENT_ACTION_INVALID';end if;
 if not public.has_admin_permission('document_generation.config.read') or (p_action='WRITE' and not public.has_admin_permission('document_generation.config.write')) then raise exception 'DOCUMENT_PERMISSION_DENIED' using errcode='42501';end if;
 cfg:=document_private.resolve_configuration_without_layout(prog,typ,now());
 cfg:=jsonb_set(cfg,'{signers}',coalesce((select jsonb_agg(jsonb_build_object('version_id',s->>'id','role',s->>'role')) from jsonb_array_elements(cfg->'signers') s),'[]'));
 if p_action='VERSION' then
  select * into v from document_private.layouts where id=(p_data->>'id')::uuid and document_type=typ;
  if v.id is null then raise exception 'DOCUMENT_LAYOUT_SCOPE_DENIED';end if;
  return to_jsonb(v)-array['created_by','context_affiliate'];
 end if;
 a:=document_private.layout_assignment(prog,typ,fund,now());
 select coalesce(jsonb_agg(jsonb_build_object('program',d.program,'fund_key',d.fund_key,'label',d.label,
  'expected_id',(select x.id from document_private.layout_activations x where x.program=d.program and x.document_type=typ and x.fund_key=d.fund_key order by x.created_at desc,x.id desc limit 1),
  'layout_id',(document_private.layout_assignment(d.program,typ,d.fund_key,now())).layout_id) order by d.program,d.fund_key),'[]') into destinations
 from (select distinct c.program,''::text fund_key,'General del programa'::text label from document_private.configurations c where c.document_type=typ
 -- The canonical loan writer stores every financial fund under request program 'prestamo'.
 -- Catalog ownership (caja/nomina/prestamo) remains unchanged; this is a documentary projection.
 union select c.program,public.normalize_suti_financial_key(f.name),min(f.name) from public.financial_funds f
 join document_private.configurations c on c.document_type=typ and (c.program='prestamo' or c.program=f.program_id)
 where typ='LOAN_APPROVAL' and f.enabled and f.publication_status='PUBLISHED'
 group by c.program,public.normalize_suti_financial_key(f.name)) d;
 return jsonb_build_object('actor',auth.uid(),'context_affiliate',public.get_effective_affiliate_id(),'config',cfg,
 'can_write',public.has_admin_permission('document_generation.config.write'),'destinations',destinations,
 'versions',coalesce((select jsonb_agg(to_jsonb(l)-array['created_by','context_affiliate'] order by l.created_at desc,l.id) from document_private.layouts l where l.document_type=typ),'[]'),
 'active_id',a.layout_id,'assignment_id',a.id,'assignment_fund_key',a.fund_key);
end $$;

create or replace function public.document_layout_persist(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare prog text:=p_data->>'program';typ text:=p_data->>'document_type';actor uuid:=(p_data->>'actor')::uuid;context_id uuid:=(p_data->>'context_affiliate')::uuid;resource uuid:=(p_data->>'id')::uuid;v document_private.layouts%rowtype;revision integer;layout_id uuid;target jsonb;targets jsonb;prior jsonb;current_id uuid;fund text;name text:=btrim(coalesce(p_data->>'name','Diseño documental'));
begin
 if actor is null or resource is null or p_action not in ('SAVE','ACTIVATE','UNASSIGN') then raise exception 'DOCUMENT_LAYOUT_WRITE_INVALID';end if;
 -- Serialize the small documentary activation domain; avoids opposite-order batch deadlocks.
 perform pg_advisory_xact_lock(hashtextextended('document_layout_scopes',0));
 if not exists(select 1 from document_private.configurations where program=prog and document_type=typ) then raise exception 'DOCUMENT_CONFIGURATION_MISSING';end if;
 if p_action='SAVE' then
  select * into v from document_private.layouts where id=resource;
  if v.id is not null then
   if v.program is distinct from prog or v.document_type is distinct from typ or v.created_by is distinct from actor or v.definition is distinct from p_data->'definition' or v.template_id is distinct from (p_data->>'template_id')::uuid or v.name is distinct from name then raise exception 'DOCUMENT_LAYOUT_RETRY_CONFLICT';end if;
   return to_jsonb(v)-array['created_by','context_affiliate'];
  end if;
  select coalesce(max(version),0)+1 into revision from document_private.layouts where program=prog and document_type=typ;
  insert into document_private.layouts(id,program,document_type,version,template_id,contract_version,engine_version,definition,created_by,context_affiliate,name)
  values(resource,prog,typ,revision,(p_data->>'template_id')::uuid,'2',p_data#>>'{definition,version}',p_data->'definition',actor,context_id,name) returning * into v;
 else
  targets:=p_data->'assignments';layout_id:=case when p_action='ACTIVATE' then (p_data->>'layout_id')::uuid end;
  if jsonb_typeof(targets) is distinct from 'array' or jsonb_array_length(targets) not between 1 and 200 then raise exception 'DOCUMENT_LAYOUT_ASSIGNMENTS_REQUIRED';end if;
  if (select count(distinct (x->>'program',coalesce(x->>'fund_key',''))) from jsonb_array_elements(targets) x)<>jsonb_array_length(targets) then raise exception 'DOCUMENT_LAYOUT_DUPLICATE_SCOPE';end if;
  if p_action='ACTIVATE' and not exists(select 1 from document_private.layouts where id=layout_id and document_type=typ) then raise exception 'DOCUMENT_LAYOUT_SCOPE_DENIED';end if;
  select details into prior from document_private.audit where action='LAYOUT_'||p_action and resource_id=resource;
  if prior is not null then
   if prior->'assignments' is distinct from targets or prior->>'layout_id' is distinct from layout_id::text or prior->>'actor' is distinct from actor::text then raise exception 'DOCUMENT_LAYOUT_RETRY_CONFLICT';end if;
   return jsonb_build_object('id',resource,'layout_id',layout_id);
  end if;
  for target in select value from jsonb_array_elements(targets) loop
   fund:=coalesce(target->>'fund_key','');
   if not exists(select 1 from document_private.configurations where program=target->>'program' and document_type=typ) then raise exception 'DOCUMENT_CONFIGURATION_MISSING';end if;
   if fund<>'' and (typ<>'LOAN_APPROVAL' or not exists(select 1 from public.financial_funds f where (target->>'program'='prestamo' or f.program_id=target->>'program') and public.normalize_suti_financial_key(f.name)=fund and f.enabled and f.publication_status='PUBLISHED')) then raise exception 'DOCUMENT_LAYOUT_FUND_INVALID';end if;
   select a.id into current_id from document_private.layout_activations a where a.program=target->>'program' and a.document_type=typ and a.fund_key=fund order by a.created_at desc,a.id desc limit 1;
   if current_id is distinct from nullif(target->>'expected_id','')::uuid then raise exception 'DOCUMENT_LAYOUT_ASSIGNMENT_CHANGED';end if;
   insert into document_private.layout_activations(id,program,document_type,fund_key,layout_id,created_by,context_affiliate)
   values(gen_random_uuid(),target->>'program',typ,fund,layout_id,actor,context_id);
  end loop;
 end if;
 insert into document_private.audit(actor,context_affiliate,action,resource_id,details) values(actor,context_id,'LAYOUT_'||p_action,resource,jsonb_build_object('program',prog,'document_type',typ,'layout_id',layout_id,'assignments',targets,'actor',actor));
 return case when p_action='SAVE' then to_jsonb(v)-array['created_by','context_affiliate'] else jsonb_build_object('id',resource,'layout_id',layout_id) end;
end $$;
revoke all on function document_private.layout_assignment(text,text,text,timestamptz),document_private.resolve_scoped_layout(text,text,timestamptz,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.document_layout_context(text,jsonb),public.document_layout_persist(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.document_layout_context(text,jsonb) to authenticated;
grant execute on function public.document_layout_persist(text,jsonb) to service_role;

-- Guarded patches change document resolution only, never event capture/business payloads.
do $$ declare definition text;patched text;begin
 definition:=pg_get_functiondef('document_private.capture_event()'::regprocedure);
 patched:=replace(definition,'begin config:=document_private.resolve_configuration(prog,typ,happened);','source:=source||jsonb_build_object(''layout_scope_version'',''1''); begin config:=document_private.resolve_scoped_layout(prog,typ,happened,source);');
 if patched=definition then raise exception 'DOCUMENT_CAPTURE_BASELINE_DRIFT';end if;execute patched;
 definition:=pg_get_functiondef('public.document_generation_worker(text,jsonb)'::regprocedure);
 patched:=replace(definition,'config:=document_private.resolve_configuration(r.program,r.document_type,r.occurred_at);','config:=case when r.source_snapshot->>''layout_scope_version''=''1'' then document_private.resolve_scoped_layout(r.program,r.document_type,r.occurred_at,r.source_snapshot||jsonb_build_object(''layout_resolution_at'',clock_timestamp())) else document_private.resolve_configuration(r.program,r.document_type,r.occurred_at) end;');
 if patched=definition then raise exception 'DOCUMENT_WORKER_BASELINE_DRIFT';end if;execute patched;
 definition:=pg_get_functiondef('document_private.reissue(jsonb)'::regprocedure);
 patched:=replace(definition,'cfg:=document_private.resolve_configuration(old.program,old.document_type,clock_timestamp());','cfg:=document_private.resolve_scoped_layout(old.program,old.document_type,clock_timestamp(),old.source_snapshot);');
 if patched=definition then raise exception 'DOCUMENT_REISSUE_BASELINE_DRIFT';end if;execute patched;
end $$;
notify pgrst,'reload schema';
commit;
