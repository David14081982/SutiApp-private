begin;

-- H-DOCUMENT-REQUIREMENTS-PLATFORM-AND-UNIFIED-UI-001
-- Evolve the existing authority in place. No second requirements store is created.
alter table public.document_types
  add column camera_allowed boolean not null default true,
  add column file_upload_allowed boolean not null default true,
  add column max_file_size_bytes bigint not null default 10485760,
  add constraint document_types_capture_check check(camera_allowed or file_upload_allowed),
  add constraint document_types_max_file_check check(max_file_size_bytes between 1024 and 10485760);

alter table public.program_document_requirements
  drop constraint program_document_requirements_program_id_membership_offerin_key,
  drop constraint program_document_requirements_scope_check;
drop index public.program_document_requirements_scope_idx;

alter table public.program_document_requirements
  add column scope_type text,
  add column scope_key text,
  add column effect text not null default 'INCLUDE';

update public.program_document_requirements
set scope_type=case when program_id='membership' then 'MEMBERSHIP' else 'PROGRAM' end,
    scope_key=case when program_id='membership' then membership_offering_id::text else program_id end;

alter table public.program_document_requirements
  alter column scope_type set not null,
  alter column scope_key set not null,
  add constraint program_document_requirements_scope_type_check
    check(scope_type in('PROGRAM','COMPANY','PRODUCT','SERVICE','MEMBERSHIP')),
  add constraint program_document_requirements_scope_key_check
    check(length(btrim(scope_key)) between 1 and 100),
  add constraint program_document_requirements_effect_check check(effect in('INCLUDE','EXCLUDE')),
  add constraint program_document_requirements_legacy_membership_check
    check((program_id='membership')=(membership_offering_id is not null));

create unique index program_document_requirements_generic_scope_idx
  on public.program_document_requirements(scope_type,scope_key,document_type_id);
create index program_document_requirements_scope_order_idx
  on public.program_document_requirements(scope_type,scope_key,enabled,sort_order);

alter table public.program_requests
  add column document_requirements_snapshot jsonb null,
  add constraint program_requests_document_snapshot_check
    check(document_requirements_snapshot is null or jsonb_typeof(document_requirements_snapshot)='array');

create table public.document_configuration_audit_log(
  audit_id uuid primary key default extensions.gen_random_uuid(),
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  resource_type text not null,
  resource_id uuid null,
  scope_type text null,
  scope_key text null,
  document_type_id uuid null references public.document_types(id) on delete restrict,
  action text not null,
  reason text not null,
  before_state jsonb null,
  after_state jsonb null,
  created_at timestamptz not null default now(),
  constraint document_configuration_audit_resource_check check(resource_type in('DOCUMENT_TYPE','REQUIREMENT')),
  constraint document_configuration_audit_action_check check(action in('CREATE','UPDATE','DEACTIVATE','INCLUDE','EXCLUDE','RESTORE')),
  constraint document_configuration_audit_reason_check check(length(btrim(reason)) between 8 and 500)
);
create index document_configuration_audit_scope_idx
  on public.document_configuration_audit_log(scope_type,scope_key,created_at desc);
alter table public.document_configuration_audit_log enable row level security;
alter table public.document_configuration_audit_log force row level security;
revoke all on public.document_configuration_audit_log from public,anon,authenticated;

create function public.assert_document_requirement_scope(p_scope_type text,p_scope_key text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_type text:=upper(btrim(coalesce(p_scope_type,'')));v_key text:=btrim(coalesce(p_scope_key,''));v_row jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if v_type='PROGRAM' and v_key='prestamo' then
    return jsonb_build_object('scope_type',v_type,'scope_key',v_key,'label','Suti Préstamo','parent_scope_type',null,'parent_scope_key',null);
  elsif v_type='PROGRAM' then
    select jsonb_build_object('scope_type',v_type,'scope_key',i.id::text,'label',i.name,'parent_scope_type',null,'parent_scope_key',null)
      into v_row from public.program_catalog_items i where i.id::text=v_key and i.enabled;
  elsif v_type='MEMBERSHIP' then
    select jsonb_build_object('scope_type',v_type,'scope_key',m.id::text,'label',m.company_raw||' · '||m.concept,'parent_scope_type',null,'parent_scope_key',null)
      into v_row from public.membership_offerings m where m.id::text=v_key and m.enabled;
  elsif v_type='COMPANY' then
    select jsonb_build_object('scope_type',v_type,'scope_key',c.id::text,'label',c.display_name,'parent_scope_type',null,'parent_scope_key',null)
      into v_row from public.companies c where c.id::text=v_key and c.enabled;
  elsif v_type='PRODUCT' then
    select jsonb_build_object('scope_type',v_type,'scope_key',p.id::text,'label',p.name,'parent_scope_type','COMPANY','parent_scope_key',p.company_id::text)
      into v_row from public.marketplace_products p join public.companies c on c.id=p.company_id and c.enabled
      where p.id::text=v_key and p.enabled;
  elsif v_type='SERVICE' then
    raise exception 'DOCUMENT_SCOPE_NOT_AVAILABLE' using errcode='22023';
  else
    raise exception 'INVALID_DOCUMENT_SCOPE' using errcode='22023';
  end if;
  if v_row is null then raise exception 'DOCUMENT_SCOPE_NOT_AVAILABLE' using errcode='22023'; end if;
  return v_row;
end $$;

create function public.resolve_effective_document_requirements(p_scope_type text,p_scope_key text)
returns table(
  requirement_id uuid,scope_type text,scope_key text,document_type_id uuid,required boolean,
  allow_verified_reuse boolean,sort_order integer,inherited boolean,source_scope_type text,source_scope_key text,
  document_type_code text,document_type_label text,document_type_description text,document_type_icon text,
  accepted_mime_types text[],camera_allowed boolean,file_upload_allowed boolean,max_file_size_bytes bigint
) language plpgsql stable security definer set search_path=''
as $$
declare v_scope jsonb;v_type text;v_key text;v_parent_type text;v_parent_key text;
begin
  v_scope:=public.assert_document_requirement_scope(p_scope_type,p_scope_key);
  v_type:=v_scope->>'scope_type';v_key:=v_scope->>'scope_key';
  v_parent_type:=v_scope->>'parent_scope_type';v_parent_key:=v_scope->>'parent_scope_key';
  return query
  with candidates as(
    select r.*,false as is_inherited,2 as priority from public.program_document_requirements r
      where r.scope_type=v_type and r.scope_key=v_key and r.enabled and r.effect='INCLUDE'
    union all
    select r.*,true,1 from public.program_document_requirements r
      where v_parent_type is not null and r.scope_type=v_parent_type and r.scope_key=v_parent_key and r.enabled and r.effect='INCLUDE'
      and not exists(select 1 from public.program_document_requirements x where x.scope_type=v_type and x.scope_key=v_key and x.document_type_id=r.document_type_id and x.enabled and x.effect='EXCLUDE')
  ), chosen as(
    select distinct on(c.document_type_id)c.* from candidates c order by c.document_type_id,c.priority desc,c.sort_order,c.id
  )
  select c.id,v_type,v_key,c.document_type_id,c.required,c.allow_verified_reuse,c.sort_order,c.is_inherited,
    c.scope_type,c.scope_key,d.code,d.label,d.description,d.icon,d.accepted_mime_types,d.camera_allowed,d.file_upload_allowed,d.max_file_size_bytes
  from chosen c join public.document_types d on d.id=c.document_type_id and d.enabled
  order by c.sort_order,d.sort_order,d.label;
end $$;

create function public.list_document_requirement_targets()
returns table(scope_type text,scope_key text,label text,parent_scope_type text,parent_scope_key text,enabled boolean)
language plpgsql stable security definer set search_path=''
as $$ begin
  if not public.has_admin_permission('documents.read') then raise exception 'DOCUMENT_CONFIG_DENIED' using errcode='42501'; end if;
  return query
    select 'PROGRAM'::text,'prestamo'::text,'Suti Préstamo'::text,null::text,null::text,true
    union all select 'PROGRAM',i.id::text,i.name,null,null,i.enabled from public.program_catalog_items i where i.enabled
    union all select 'MEMBERSHIP',m.id::text,m.company_raw||' · '||m.concept,null,null,m.enabled from public.membership_offerings m where m.enabled
    union all select 'COMPANY',c.id::text,c.display_name,null,null,c.enabled from public.companies c where c.enabled
    union all select 'PRODUCT',p.id::text,p.name,'COMPANY',p.company_id::text,p.enabled from public.marketplace_products p where p.enabled
    order by 1,3;
end $$;

create function public.get_document_requirement_configuration(p_scope_type text,p_scope_key text)
returns table(rule_id uuid,document_type_id uuid,effect text,required boolean,allow_verified_reuse boolean,sort_order integer,enabled boolean,inherited boolean,source_scope_type text,source_scope_key text)
language plpgsql stable security definer set search_path=''
as $$
declare v_scope jsonb;v_type text;v_key text;v_parent_type text;v_parent_key text;
begin
  if not public.has_admin_permission('documents.read') then raise exception 'DOCUMENT_CONFIG_DENIED' using errcode='42501'; end if;
  v_scope:=public.assert_document_requirement_scope(p_scope_type,p_scope_key);v_type:=v_scope->>'scope_type';v_key:=v_scope->>'scope_key';v_parent_type:=v_scope->>'parent_scope_type';v_parent_key:=v_scope->>'parent_scope_key';
  return query
    select r.id,r.document_type_id,r.effect,r.required,r.allow_verified_reuse,r.sort_order,r.enabled,false,r.scope_type,r.scope_key
      from public.program_document_requirements r where r.scope_type=v_type and r.scope_key=v_key
    union all
    select r.id,r.document_type_id,r.effect,r.required,r.allow_verified_reuse,r.sort_order,r.enabled,true,r.scope_type,r.scope_key
      from public.program_document_requirements r where v_parent_type is not null and r.scope_type=v_parent_type and r.scope_key=v_parent_key and r.enabled
      and not exists(select 1 from public.program_document_requirements x where x.scope_type=v_type and x.scope_key=v_key and x.document_type_id=r.document_type_id)
    order by 6,2;
end $$;

create function public.get_document_requirement_impact(p_scope_type text,p_scope_key text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_scope jsonb;v_type text;v_key text;v_active bigint:=0;v_requirements bigint:=0;
begin
  if not public.has_admin_permission('documents.read') then raise exception 'DOCUMENT_CONFIG_DENIED' using errcode='42501'; end if;
  v_scope:=public.assert_document_requirement_scope(p_scope_type,p_scope_key);v_type:=v_scope->>'scope_type';v_key:=v_scope->>'scope_key';
  select count(*) into v_requirements from public.resolve_effective_document_requirements(v_type,v_key);
  if v_type='MEMBERSHIP' then select count(*) into v_active from public.program_requests where membership_offering_id::text=v_key and status in('submitted','in_review');
  elsif v_type='PRODUCT' then select count(*) into v_active from public.program_requests where product_id::text=v_key and status in('submitted','in_review');
  elsif v_type='PROGRAM' and v_key='prestamo' then select count(*) into v_active from public.program_requests where program_id='prestamo' and status in('submitted','in_review','requires_financial_processing');
  elsif v_type='PROGRAM' then select count(*) into v_active from public.program_requests where program_item_id::text=v_key and status in('submitted','in_review');
  elsif v_type='COMPANY' then select count(*) into v_active from public.program_requests where company_id::text=v_key and status in('submitted','in_review'); end if;
  return v_scope||jsonb_build_object('effective_requirements',v_requirements,'active_requests',v_active);
end $$;

create function public.save_document_requirement_rule(
  p_scope_type text,p_scope_key text,p_document_type_id uuid,p_effect text,p_required boolean,
  p_allow_verified_reuse boolean,p_sort_order integer,p_reason text
) returns public.program_document_requirements language plpgsql security definer set search_path=''
as $$
declare v_scope jsonb;v_before jsonb;v_row public.program_document_requirements%rowtype;v_type text;v_key text;v_program text;v_membership uuid;
begin
  if not public.has_admin_permission('documents.write') then raise exception 'DOCUMENT_CONFIG_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'DOCUMENT_CONFIG_REASON_REQUIRED' using errcode='22023'; end if;
  if upper(p_effect) not in('INCLUDE','EXCLUDE') or p_sort_order<1 or not exists(select 1 from public.document_types where id=p_document_type_id) then raise exception 'INVALID_DOCUMENT_RULE' using errcode='22023'; end if;
  v_scope:=public.assert_document_requirement_scope(p_scope_type,p_scope_key);v_type:=v_scope->>'scope_type';v_key:=v_scope->>'scope_key';
  select to_jsonb(r) into v_before from public.program_document_requirements r where r.scope_type=v_type and r.scope_key=v_key and r.document_type_id=p_document_type_id;
  v_program:=case when v_type='MEMBERSHIP' then 'membership' when v_type='PROGRAM' and v_key='prestamo' then 'prestamo' else lower(v_type)||':'||v_key end;
  v_membership:=case when v_type='MEMBERSHIP' then v_key::uuid else null end;
  insert into public.program_document_requirements(program_id,membership_offering_id,document_type_id,required,allow_verified_reuse,sort_order,enabled,scope_type,scope_key,effect)
  values(v_program,v_membership,p_document_type_id,case when upper(p_effect)='EXCLUDE' then false else coalesce(p_required,true) end,coalesce(p_allow_verified_reuse,true),p_sort_order,true,v_type,v_key,upper(p_effect))
  on conflict(scope_type,scope_key,document_type_id) do update set required=excluded.required,allow_verified_reuse=excluded.allow_verified_reuse,sort_order=excluded.sort_order,enabled=true,effect=excluded.effect
  returning * into v_row;
  insert into public.document_configuration_audit_log(actor_auth_user_id,resource_type,resource_id,scope_type,scope_key,document_type_id,action,reason,before_state,after_state)
  values(auth.uid(),'REQUIREMENT',v_row.id,v_type,v_key,p_document_type_id,upper(p_effect),btrim(p_reason),v_before,to_jsonb(v_row));
  return v_row;
end $$;

create function public.restore_document_requirement_rule(p_scope_type text,p_scope_key text,p_document_type_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_scope jsonb;v_before jsonb;v_id uuid;v_type text;v_key text;
begin
  if not public.has_admin_permission('documents.write') then raise exception 'DOCUMENT_CONFIG_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'DOCUMENT_CONFIG_REASON_REQUIRED' using errcode='22023'; end if;
  v_scope:=public.assert_document_requirement_scope(p_scope_type,p_scope_key);v_type:=v_scope->>'scope_type';v_key:=v_scope->>'scope_key';
  select r.id,to_jsonb(r) into v_id,v_before from public.program_document_requirements r where r.scope_type=v_type and r.scope_key=v_key and r.document_type_id=p_document_type_id;
  if v_id is null then raise exception 'DOCUMENT_RULE_NOT_FOUND' using errcode='P0001'; end if;
  delete from public.program_document_requirements where id=v_id;
  insert into public.document_configuration_audit_log(actor_auth_user_id,resource_type,resource_id,scope_type,scope_key,document_type_id,action,reason,before_state)
  values(auth.uid(),'REQUIREMENT',v_id,v_type,v_key,p_document_type_id,'RESTORE',btrim(p_reason),v_before);
  return true;
end $$;

create function public.save_document_type_configuration(p_value jsonb,p_reason text)
returns public.document_types language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_before jsonb;v_row public.document_types%rowtype;v_code text:=lower(btrim(coalesce(p_value->>'code','')));v_label text:=btrim(coalesce(p_value->>'label',''));
begin
  if not public.has_admin_permission('documents.write') then raise exception 'DOCUMENT_CONFIG_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'DOCUMENT_CONFIG_REASON_REQUIRED' using errcode='22023'; end if;
  if nullif(p_value->>'id','') is not null then v_id:=(p_value->>'id')::uuid; end if;
  if v_code!~'^[a-z][a-z0-9_]{1,63}$' or length(v_label) not between 1 and 100 then raise exception 'INVALID_DOCUMENT_TYPE' using errcode='22023'; end if;
  if v_id is not null then select to_jsonb(d) into v_before from public.document_types d where d.id=v_id; end if;
  if v_id is null then
    insert into public.document_types(code,label,description,icon,required_by_default,accepted_mime_types,enabled,sort_order,system_type,camera_allowed,file_upload_allowed,max_file_size_bytes)
    values(v_code,v_label,coalesce(p_value->>'description',''),coalesce(nullif(p_value->>'icon',''),'doc'),coalesce((p_value->>'required_by_default')::boolean,false),
      array(select jsonb_array_elements_text(p_value->'accepted_mime_types')),coalesce((p_value->>'enabled')::boolean,true),coalesce((p_value->>'sort_order')::integer,1),false,
      coalesce((p_value->>'camera_allowed')::boolean,true),coalesce((p_value->>'file_upload_allowed')::boolean,true),coalesce((p_value->>'max_file_size_bytes')::bigint,10485760)) returning * into v_row;
  else
    update public.document_types set code=v_code,label=v_label,description=coalesce(p_value->>'description',''),icon=coalesce(nullif(p_value->>'icon',''),'doc'),
      required_by_default=coalesce((p_value->>'required_by_default')::boolean,false),accepted_mime_types=array(select jsonb_array_elements_text(p_value->'accepted_mime_types')),
      enabled=coalesce((p_value->>'enabled')::boolean,true),sort_order=coalesce((p_value->>'sort_order')::integer,sort_order),
      camera_allowed=coalesce((p_value->>'camera_allowed')::boolean,camera_allowed),file_upload_allowed=coalesce((p_value->>'file_upload_allowed')::boolean,file_upload_allowed),
      max_file_size_bytes=coalesce((p_value->>'max_file_size_bytes')::bigint,max_file_size_bytes)
    where id=v_id returning * into v_row;
  end if;
  if v_row.id is null then raise exception 'DOCUMENT_TYPE_NOT_FOUND' using errcode='P0001'; end if;
  insert into public.document_configuration_audit_log(actor_auth_user_id,resource_type,resource_id,action,reason,before_state,after_state)
  values(auth.uid(),'DOCUMENT_TYPE',v_row.id,case when v_before is null then 'CREATE' when v_row.enabled then 'UPDATE' else 'DEACTIVATE' end,btrim(p_reason),v_before,to_jsonb(v_row));
  return v_row;
end $$;

create function public.register_affiliate_document(
  p_document_type_id uuid,p_storage_path text,p_mime_type text,p_file_size bigint,p_sha256 text,p_source text
) returns public.affiliate_documents language plpgsql security definer set search_path=''
as $$
declare v_affiliate uuid;v_type public.document_types%rowtype;v_asset public.private_assets%rowtype;v_doc public.affiliate_documents%rowtype;v_replaced uuid;v_path text:=btrim(p_storage_path);
begin
  v_affiliate:=public.get_effective_affiliate_id();
  if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  select * into v_type from public.document_types where id=p_document_type_id and enabled;
  if v_type.id is null then raise exception 'DOCUMENT_TYPE_UNAVAILABLE' using errcode='22023'; end if;
  if upper(coalesce(p_source,'')) not in('CAMERA','FILE')
    or (upper(p_source)='CAMERA' and not v_type.camera_allowed)
    or (upper(p_source)='FILE' and not v_type.file_upload_allowed)
    or (upper(p_source)='CAMERA' and p_mime_type not like 'image/%')
    or not(p_mime_type=any(v_type.accepted_mime_types)) or p_file_size<1 or p_file_size>v_type.max_file_size_bytes or upper(p_sha256)!~'^[A-F0-9]{64}$' then raise exception 'INVALID_DOCUMENT_FILE' using errcode='22023'; end if;
  if v_path!~('^affiliate-documents/'||v_affiliate::text||'/[A-Za-z0-9._-]+$') then raise exception 'INVALID_STORAGE_PATH' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text) then raise exception 'UPLOAD_NOT_FOUND' using errcode='22023'; end if;
  select d.id into v_replaced from public.affiliate_documents d where d.affiliate_id=v_affiliate and d.document_type_id=p_document_type_id order by d.created_at desc,d.id desc limit 1;
  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256);
  if v_asset.id is null then insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset; end if;
  update public.affiliate_documents set status='REJECTED',review_observation='Reemplazado por una nueva carga.',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
    where affiliate_id=v_affiliate and document_type_id=p_document_type_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');
  insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id)
    values(v_affiliate,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid(),v_replaced) returning * into v_doc;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
    values(auth.uid(),v_affiliate,'affiliate_documents',case when v_replaced is null then 'UPLOAD' else 'REPLACEMENT_UPLOAD' end,v_doc.id,
      jsonb_strip_nulls(jsonb_build_object('document_type_id',p_document_type_id,'mime_type',p_mime_type,'file_size',p_file_size,'source',upper(p_source),'replaces_document_id',v_replaced)));
  return v_doc;
end $$;

create function public.capture_document_requirements_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_type text;v_key text;
begin
  if new.document_requirements_snapshot is not null then raise exception 'DOCUMENT_REQUIREMENTS_SNAPSHOT_SERVER_ONLY' using errcode='42501'; end if;
  if new.membership_offering_id is not null then v_type:='MEMBERSHIP';v_key:=new.membership_offering_id::text;
  elsif new.program_id='prestamo' then v_type:='PROGRAM';v_key:='prestamo';
  elsif new.product_id is not null then v_type:='PRODUCT';v_key:=new.product_id::text;
  elsif new.program_item_id is not null then v_type:='PROGRAM';v_key:=new.program_item_id::text;
  else raise exception 'DOCUMENT_SCOPE_NOT_AVAILABLE' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requirement_id',r.requirement_id,'document_type_id',r.document_type_id,'code',r.document_type_code,'label',r.document_type_label,
    'required',r.required,'allow_verified_reuse',r.allow_verified_reuse,'sort_order',r.sort_order,'inherited',r.inherited,
    'source_scope_type',r.source_scope_type,'source_scope_key',r.source_scope_key,'scope_type',v_type,'scope_key',v_key
  ) order by r.sort_order,r.document_type_label),'[]'::jsonb) into new.document_requirements_snapshot
  from public.resolve_effective_document_requirements(v_type,v_key) r;
  return new;
end $$;
create trigger program_requests_capture_document_requirements
before insert on public.program_requests for each row execute function public.capture_document_requirements_snapshot();

create function public.create_program_request_with_documents(
  p_program_item_id uuid,p_product_id uuid,p_quantity integer,p_notes text,p_signature_data text,
  p_terms_accepted boolean,p_idempotency_key uuid,p_document_ids uuid[]
) returns public.program_requests language plpgsql security definer set search_path=''
as $$
declare v_row public.program_requests%rowtype;v_missing integer;
begin
  v_row:=public.create_program_request(p_program_item_id,p_product_id,p_quantity,p_notes,p_signature_data,p_terms_accepted,p_idempotency_key);
  select count(*) into v_missing from jsonb_array_elements(coalesce(v_row.document_requirements_snapshot,'[]'::jsonb)) requirement
  where coalesce((requirement->>'required')::boolean,true) and not exists(
    select 1 from public.affiliate_documents d
    left join public.affiliate_files af on af.id=d.affiliate_file_id
    join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id) and pa.status='READY'
    join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
    where d.id=any(coalesce(p_document_ids,array[]::uuid[])) and d.affiliate_id=v_row.affiliate_id
      and d.document_type_id=(requirement->>'document_type_id')::uuid and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
      and not exists(select 1 from public.affiliate_documents newer where newer.affiliate_id=d.affiliate_id and newer.document_type_id=d.document_type_id and (newer.created_at,newer.id)>(d.created_at,d.id))
  );
  if v_missing>0 then raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023'; end if;
  perform public.attach_request_documents(v_row.id,coalesce(p_document_ids,array[]::uuid[]));
  return v_row;
end $$;

revoke insert,update,delete on public.document_types,public.program_document_requirements from authenticated;
revoke execute on function public.create_program_request(uuid,uuid,integer,text,text,boolean,uuid) from authenticated;
revoke execute on function public.register_affiliate_document(uuid,text,text,bigint,text) from authenticated;

revoke all on function public.assert_document_requirement_scope(text,text),public.resolve_effective_document_requirements(text,text),
  public.list_document_requirement_targets(),public.get_document_requirement_configuration(text,text),public.get_document_requirement_impact(text,text),
  public.save_document_requirement_rule(text,text,uuid,text,boolean,boolean,integer,text),public.restore_document_requirement_rule(text,text,uuid,text),
  public.save_document_type_configuration(jsonb,text),public.capture_document_requirements_snapshot(),
  public.create_program_request_with_documents(uuid,uuid,integer,text,text,boolean,uuid,uuid[]),
  public.register_affiliate_document(uuid,text,text,bigint,text,text) from public,anon;
grant execute on function public.resolve_effective_document_requirements(text,text),public.create_program_request_with_documents(uuid,uuid,integer,text,text,boolean,uuid,uuid[]) to authenticated;
grant execute on function public.list_document_requirement_targets(),public.get_document_requirement_configuration(text,text),public.get_document_requirement_impact(text,text),
  public.save_document_requirement_rule(text,text,uuid,text,boolean,boolean,integer,text),public.restore_document_requirement_rule(text,text,uuid,text),
  public.save_document_type_configuration(jsonb,text) to authenticated;
grant execute on function public.register_affiliate_document(uuid,text,text,bigint,text,text) to authenticated;
revoke all on function public.assert_document_requirement_scope(text,text),public.capture_document_requirements_snapshot() from authenticated;

comment on table public.program_document_requirements is 'Single configurable authority for document requirements across program, company, product, service and membership scopes; product inherits company rules and explicit exclusions win.';
comment on column public.program_requests.document_requirements_snapshot is 'Immutable server-captured requirement configuration for this request; null only for requests created before H-DOCUMENT-REQUIREMENTS-PLATFORM-AND-UNIFIED-UI-001.';
comment on table public.document_configuration_audit_log is 'Append-only before/after audit of document catalog and requirement configuration changes.';

commit;
