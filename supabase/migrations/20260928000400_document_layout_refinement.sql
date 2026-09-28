-- Optional document bindings frozen at the final event. No affiliate or financial writes.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
alter table document_private.layouts drop constraint layouts_contract_version_check;
alter table document_private.layouts add constraint layouts_contract_version_check check(contract_version in ('1','2'));
alter table document_private.layouts drop constraint layouts_engine_version_check;
alter table document_private.layouts add constraint layouts_engine_version_check check(engine_version in ('suti-layout-1','suti-layout-2'));
create or replace function public.document_layout_persist(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  values(resource,prog,typ,revision,(p_data->>'template_id')::uuid,case when p_data#>>'{definition,version}'='suti-layout-2' then '2' else '1' end,p_data#>>'{definition,version}',p_data->'definition',actor,context_id) returning * into v;
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

create function document_private.capture_affiliate_fields() returns trigger language plpgsql security definer set search_path='' as $$
declare identity jsonb;extra jsonb;
begin
 select jsonb_build_object('affiliate',jsonb_build_object(
   'rfc',a.rfc_raw,
   'curp',a.curp_raw,
   'phone',a.phone_raw,
   'email',a.historical_email_raw,
   'address',a.address_raw,
   'city',a.city_raw,
   'employment_position',a.employment_position_raw,
   'employment_area',a.employment_area_raw,
   'employment_level',a.employment_level_raw,
   'occupation',a.occupation_raw,
   'subdirectorate',a.subdirectorate_raw,
   'employment_entry_date',a.employment_entry_date_raw,
   'institute_entry_date',a.institute_entry_date_raw,
   'union_position',a.union_position_raw,
   'union_enrollment_date',a.union_enrollment_date_raw),
   'union_label',(select c.label from public.segmentation_catalog_entries c where c.catalog_type='union' and c.code=a.financial_union_code and c.enabled limit 1),
   'category_label',(select c.label from public.segmentation_catalog_entries c where c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled limit 1))
 into extra from public.affiliates a where a.id=new.affiliate_id;
 identity:=coalesce(new.source_snapshot->'identity','{}')||coalesce(extra,'{}');
 new.source_snapshot:=jsonb_set(new.source_snapshot,'{identity}',identity)||jsonb_build_object('affiliate_fields_version','1');
 if new.document_snapshot is not null then new.document_snapshot:=jsonb_set(new.document_snapshot,'{identity}',identity)||jsonb_build_object('affiliate_fields_version','1');end if;
 return new;
end $$;
revoke all on function document_private.capture_affiliate_fields() from public,anon,authenticated,service_role;
create trigger document_affiliate_fields before insert on document_private.records for each row execute function document_private.capture_affiliate_fields();
notify pgrst,'reload schema';
commit;
