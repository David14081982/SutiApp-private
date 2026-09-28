-- Presentation only. Immutable versions and event-time activations; no request/financial writes.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
create table document_private.layouts(
 id uuid primary key,program text not null,document_type text not null,
 version integer not null check(version>0),template_id uuid not null references document_private.templates(id),
 contract_version text not null check(contract_version='1'),engine_version text not null check(engine_version='suti-layout-1'),
 definition jsonb not null check(jsonb_typeof(definition)='object' and octet_length(definition::text)<200000),
 created_by uuid not null,context_affiliate uuid,created_at timestamptz not null default clock_timestamp(),
 unique(program,document_type,version),unique(program,document_type,id));
create table document_private.layout_activations(
 id uuid primary key,program text not null,document_type text not null,layout_id uuid,
 created_by uuid not null,context_affiliate uuid,created_at timestamptz not null default clock_timestamp(),
 foreign key(program,document_type,layout_id) references document_private.layouts(program,document_type,id));
create index document_layout_active_scope on document_private.layout_activations(program,document_type,created_at desc);
alter table document_private.layouts enable row level security;
alter table document_private.layouts force row level security;
alter table document_private.layout_activations enable row level security;
alter table document_private.layout_activations force row level security;
revoke all on document_private.layouts,document_private.layout_activations from public,anon,authenticated,service_role;
create trigger document_layout_immutable before update or delete on document_private.layouts for each row execute function document_private.immutable();
create trigger document_layout_activation_immutable before update or delete on document_private.layout_activations for each row execute function document_private.immutable();

alter function document_private.resolve_configuration(text,text,timestamptz) rename to resolve_configuration_without_layout;
create function document_private.resolve_configuration(p_program text,p_type text,p_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;v document_private.layouts%rowtype;t jsonb;
begin
 result:=document_private.resolve_configuration_without_layout(p_program,p_type,p_at);
 select l.* into v from document_private.layouts l where l.id=(select a.layout_id from document_private.layout_activations a where a.program=p_program and a.document_type=p_type and a.created_at<=p_at order by a.created_at desc,a.id desc limit 1);
 if v.id is null then return result||jsonb_build_object('layout',jsonb_build_object('mode','SYSTEM','version','1'));end if;
 select to_jsonb(x)||jsonb_build_object('asset',to_jsonb(a)) into t from document_private.templates x join document_private.assets a on a.id=x.asset_id where x.id=v.template_id;
 return result||jsonb_build_object('template',t,'layout',to_jsonb(v)-array['created_by','context_affiliate']);
end $$;
revoke all on function document_private.resolve_configuration(text,text,timestamptz),document_private.resolve_configuration_without_layout(text,text,timestamptz) from public,anon,authenticated,service_role;

-- This gate derives actor/context from the authenticated request. No service privilege in browser.
create function public.document_layout_context(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare prog text:=p_data->>'program';typ text:=p_data->>'document_type';v document_private.layouts%rowtype;result jsonb;config jsonb;
begin
 if auth.uid() is null then raise exception 'DOCUMENT_AUTH_REQUIRED' using errcode='42501';end if;
 if p_action not in ('READ','WRITE','VERSION') then raise exception 'DOCUMENT_ACTION_INVALID';end if;
 if not public.has_admin_permission('document_generation.config.read') or (p_action='WRITE' and not public.has_admin_permission('document_generation.config.write')) then raise exception 'DOCUMENT_PERMISSION_DENIED' using errcode='42501';end if;
 -- Resolution enforces existing configuration, template and signer authority.
 config:=document_private.resolve_configuration_without_layout(prog,typ,now());
 config:=jsonb_set(config,'{signers}',coalesce((select jsonb_agg(jsonb_build_object('version_id',s->>'id','role',s->>'role')) from jsonb_array_elements(config->'signers') s),'[]'));
 if p_action='VERSION' then
  select * into v from document_private.layouts where id=(p_data->>'id')::uuid and program=prog and document_type=typ;
  if v.id is null then raise exception 'DOCUMENT_LAYOUT_SCOPE_DENIED';end if;
  return to_jsonb(v)-array['created_by','context_affiliate'];
 end if;
 result:=jsonb_build_object('actor',auth.uid(),'context_affiliate',public.get_effective_affiliate_id(),
  'config',config,'can_write',public.has_admin_permission('document_generation.config.write'),
  'versions',coalesce((select jsonb_agg(to_jsonb(l)-array['created_by','context_affiliate'] order by l.version desc) from document_private.layouts l where l.program=prog and l.document_type=typ),'[]'),
  'active_id',(select a.layout_id from document_private.layout_activations a where a.program=prog and a.document_type=typ order by a.created_at desc,a.id desc limit 1));
 return result;
end $$;
revoke all on function public.document_layout_context(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.document_layout_context(text,jsonb) to authenticated;

-- Only the Edge may call this, after contract/layout validation and the user-bound gate above.
create function public.document_layout_persist(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare prog text:=p_data->>'program';typ text:=p_data->>'document_type';actor uuid:=(p_data->>'actor')::uuid;context_id uuid:=(p_data->>'context_affiliate')::uuid;resource uuid:=(p_data->>'id')::uuid;v document_private.layouts%rowtype;revision integer;layout_id uuid;existing document_private.layout_activations%rowtype;
begin
 if actor is null or resource is null or p_action not in ('SAVE','ACTIVATE','SYSTEM') then raise exception 'DOCUMENT_LAYOUT_WRITE_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('document_layout:'||prog||':'||typ,0));
 if not exists(select 1 from document_private.configurations where program=prog and document_type=typ) then raise exception 'DOCUMENT_CONFIGURATION_MISSING';end if;
 if p_action='SAVE' then
  select * into v from document_private.layouts where id=resource;
  if v.id is not null then
   if v.program is distinct from prog or v.document_type is distinct from typ or v.created_by is distinct from actor or v.definition is distinct from p_data->'definition' or v.template_id is distinct from (p_data->>'template_id')::uuid then raise exception 'DOCUMENT_LAYOUT_RETRY_CONFLICT';end if;
   return to_jsonb(v)-array['created_by','context_affiliate'];
  end if;
  select coalesce(max(version),0)+1 into revision from document_private.layouts where program=prog and document_type=typ;
  insert into document_private.layouts(id,program,document_type,version,template_id,contract_version,engine_version,definition,created_by,context_affiliate)
  values(resource,prog,typ,revision,(p_data->>'template_id')::uuid,'1','suti-layout-1',p_data->'definition',actor,context_id) returning * into v;
 else
  layout_id:=case when p_action='SYSTEM' then null else (p_data->>'layout_id')::uuid end;
  if p_action='ACTIVATE' and not exists(select 1 from document_private.layouts where id=layout_id and program=prog and document_type=typ) then raise exception 'DOCUMENT_LAYOUT_SCOPE_DENIED';end if;
  select * into existing from document_private.layout_activations where id=resource;
  if existing.id is not null then
   if existing.program is distinct from prog or existing.document_type is distinct from typ or existing.layout_id is distinct from layout_id or existing.created_by is distinct from actor then raise exception 'DOCUMENT_LAYOUT_RETRY_CONFLICT';end if;
   return jsonb_build_object('id',resource,'layout_id',layout_id);
  end if;
  insert into document_private.layout_activations(id,program,document_type,layout_id,created_by,context_affiliate) values(resource,prog,typ,layout_id,actor,context_id);
 end if;
 insert into document_private.audit(actor,context_affiliate,action,resource_id,details) values(actor,context_id,'LAYOUT_'||p_action,resource,jsonb_build_object('program',prog,'document_type',typ));
 return case when p_action='SAVE' then to_jsonb(v)-array['created_by','context_affiliate'] else jsonb_build_object('id',resource,'layout_id',layout_id) end;
end $$;
revoke all on function public.document_layout_persist(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.document_layout_persist(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
