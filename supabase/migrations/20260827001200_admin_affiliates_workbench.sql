begin;

-- H-ADMIN-AFFILIATES-MODULE-001
-- public.affiliates remains the only master. This migration only adds an
-- administrative projection/writer boundary and durable audit events.

alter table public.affiliates
  add column record_origin text not null default 'HISTORICAL_IMPORT';

alter table public.affiliates
  drop constraint affiliates_source_identity_unique,
  drop constraint affiliates_source_row_ordinal_check,
  drop constraint affiliates_source_file_hash_check,
  alter column source_row_ordinal drop not null,
  alter column source_file_hash drop not null;

alter table public.affiliates
  add constraint affiliates_record_origin_check check(record_origin in ('HISTORICAL_IMPORT','ADMIN_AFFILIATES')),
  add constraint affiliates_source_provenance_check check(
    (record_origin='HISTORICAL_IMPORT' and source_row_ordinal is not null and source_row_ordinal>0
      and source_file_hash is not null and source_file_hash ~ '^[A-F0-9]{64}$')
    or
    (record_origin='ADMIN_AFFILIATES' and source_row_ordinal is null and source_file_hash is null)
  );

create unique index affiliates_historical_source_identity_unique
  on public.affiliates(source_file_hash,source_row_ordinal)
  where record_origin='HISTORICAL_IMPORT';

create index affiliates_admin_status_idx on public.affiliates(affiliate_status_raw);
create index affiliates_admin_union_category_idx on public.affiliates(financial_union_code,financial_employee_category_code);

create table public.affiliate_admin_events (
  event_id uuid primary key default extensions.gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check(action in ('CREATE','UPDATE','STATUS_CHANGE')),
  before_values jsonb null check(before_values is null or jsonb_typeof(before_values)='object'),
  after_values jsonb not null check(jsonb_typeof(after_values)='object'),
  changed_fields text[] not null check(cardinality(changed_fields)>0),
  reason text not null check(length(btrim(reason)) between 8 and 500),
  created_at timestamptz not null default now()
);
create index affiliate_admin_events_affiliate_created_idx
  on public.affiliate_admin_events(affiliate_id,created_at desc);

alter table public.affiliate_admin_events enable row level security;
alter table public.affiliate_admin_events force row level security;
revoke all on public.affiliate_admin_events from public,anon,authenticated;
grant select on public.affiliate_admin_events to authenticated;
create policy affiliate_admin_events_read on public.affiliate_admin_events
  for select to authenticated using(public.has_admin_permission('affiliates.read'));

create function public.list_admin_affiliates(
  p_query text default null,
  p_status text default null,
  p_auth_linked boolean default null,
  p_document_state text default null,
  p_has_pending_documents boolean default null,
  p_union_code text default null,
  p_category_code text default null,
  p_page integer default 1,
  p_page_size integer default 25,
  p_sort text default 'name'
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_query text:=lower(btrim(coalesce(p_query,'')));
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_page_size integer:=least(greatest(coalesce(p_page_size,25),10),100);
  v_result jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then
    raise exception 'AFFILIATE_READ_DENIED' using errcode='42501';
  end if;
  if p_document_state is not null and upper(p_document_state) not in ('COMPLETE','INCOMPLETE','NOT_CONFIGURED') then
    raise exception 'AFFILIATE_DOCUMENT_FILTER_INVALID' using errcode='22023';
  end if;
  if coalesce(p_sort,'name') not in ('name','control','recent') then
    raise exception 'AFFILIATE_SORT_INVALID' using errcode='22023';
  end if;

  with required as (
    select count(*)::integer required_count
    from public.document_types where enabled and required_by_default
  ), docs as (
    select d.affiliate_id,
      count(*) filter(where d.status<>'REJECTED')::integer document_count,
      count(*) filter(where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED'))::integer pending_document_count,
      count(distinct d.document_type_id) filter(where d.status='VERIFIED' and t.enabled and t.required_by_default)::integer verified_required_count
    from public.affiliate_documents d
    join public.document_types t on t.id=d.document_type_id
    group by d.affiliate_id
  ), requests as (
    select r.affiliate_id,count(*)::integer request_count,
      count(*) filter(where r.status in('submitted','in_review','requires_financial_processing'))::integer pending_request_count
    from public.program_requests r group by r.affiliate_id
  ), base as (
    select a.id,a.numero_control,a.full_name,a.display_name,a.historical_email_raw,a.phone_raw,a.rfc_raw,a.curp_raw,
      a.affiliate_status_raw,a.affiliation_raw,a.financial_union_code,a.financial_employee_category_code,
      a.financial_affiliation_status,a.financial_employment_status,a.updated_at,a.record_origin,
      (a.auth_user_id is not null) auth_linked,
      coalesce(d.document_count,0) document_count,coalesce(d.pending_document_count,0) pending_document_count,
      coalesce(d.verified_required_count,0) verified_required_count,required.required_count,
      case when required.required_count=0 then 'NOT_CONFIGURED'
        when coalesce(d.verified_required_count,0)>=required.required_count then 'COMPLETE' else 'INCOMPLETE' end document_state,
      coalesce(r.request_count,0) request_count,coalesce(r.pending_request_count,0) pending_request_count,
      lower(coalesce(a.full_name,a.display_name,'')) sort_name
    from public.affiliates a cross join required
    left join docs d on d.affiliate_id=a.id
    left join requests r on r.affiliate_id=a.id
  ), filtered as (
    select * from base b where
      (v_query='' or position(v_query in lower(concat_ws(' ',b.full_name,b.display_name,b.numero_control,b.historical_email_raw,b.phone_raw,b.rfc_raw,b.curp_raw)))>0)
      and (p_status is null or b.affiliate_status_raw=p_status)
      and (p_auth_linked is null or b.auth_linked=p_auth_linked)
      and (p_document_state is null or b.document_state=upper(p_document_state))
      and (p_has_pending_documents is null or (b.pending_document_count>0)=p_has_pending_documents)
      and (p_union_code is null or b.financial_union_code=p_union_code)
      and (p_category_code is null or b.financial_employee_category_code=p_category_code)
  ), page_rows as (
    select * from filtered
    order by
      case when p_sort='control' then coalesce(numero_control,'') end,
      case when p_sort='recent' then updated_at end desc,
      case when p_sort='name' then sort_name end,
      sort_name,id
    offset (v_page-1)*v_page_size limit v_page_size
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(x)-'sort_name') from (select * from page_rows) x),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'page',v_page,'page_size',v_page_size,
    'filter_options',jsonb_build_object(
      'statuses',coalesce((select jsonb_agg(value order by value) from (select distinct affiliate_status_raw value from public.affiliates where affiliate_status_raw is not null and btrim(affiliate_status_raw)<>'') s),'[]'::jsonb),
      'unions',coalesce((select jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) from public.segmentation_catalog_entries where catalog_type='union' and enabled),'[]'::jsonb),
      'categories',coalesce((select jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) from public.segmentation_catalog_entries where catalog_type='employment_category' and enabled),'[]'::jsonb)
    )
  ) into v_result;
  return v_result;
end $$;

create function public.find_admin_affiliate_duplicates(p_values jsonb,p_exclude_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_values)<>'object' then raise exception 'AFFILIATE_VALUES_REQUIRED' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'numero_control',a.numero_control,'name',coalesce(a.full_name,a.display_name,'Sin nombre'),
    'matches',array_remove(array[
      case when nullif(btrim(p_values->>'numero_control'),'') is not null and a.numero_control=p_values->>'numero_control' then 'numero_control' end,
      case when nullif(upper(btrim(p_values->>'rfc_raw')),'') is not null and upper(btrim(a.rfc_raw))=upper(btrim(p_values->>'rfc_raw')) then 'rfc' end,
      case when nullif(upper(btrim(p_values->>'curp_raw')),'') is not null and upper(btrim(a.curp_raw))=upper(btrim(p_values->>'curp_raw')) then 'curp' end,
      case when nullif(lower(btrim(p_values->>'historical_email_raw')),'') is not null and a.historical_email_normalized=lower(btrim(p_values->>'historical_email_raw')) then 'email' end
    ],null)
  ) order by a.source_row_ordinal nulls last,a.created_at),'[]'::jsonb) into v_result
  from public.affiliates a
  where (p_exclude_id is null or a.id<>p_exclude_id) and (
    (nullif(btrim(p_values->>'numero_control'),'') is not null and a.numero_control=p_values->>'numero_control')
    or (nullif(upper(btrim(p_values->>'rfc_raw')),'') is not null and upper(btrim(a.rfc_raw))=upper(btrim(p_values->>'rfc_raw')))
    or (nullif(upper(btrim(p_values->>'curp_raw')),'') is not null and upper(btrim(a.curp_raw))=upper(btrim(p_values->>'curp_raw')))
    or (nullif(lower(btrim(p_values->>'historical_email_raw')),'') is not null and a.historical_email_normalized=lower(btrim(p_values->>'historical_email_raw')))
  );
  return v_result;
end $$;

create function public.get_admin_affiliate_workbench(p_affiliate_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_profile jsonb;v_options jsonb;v_documents jsonb;v_requests jsonb;v_audit jsonb;
  v_can_documents boolean;v_can_requests boolean;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  v_can_documents:=public.has_admin_permission('documents.read') or public.has_admin_permission('assets.read');
  v_can_requests:=public.has_admin_permission('program_requests.read');
  select (to_jsonb(a)-array['auth_user_id','historical_email_normalized','source_file_hash','source_row_ordinal','financial_profile_updated_by','financial_profile_seed_source_hash','financial_profile_seed_row_ordinal']::text[])
    || jsonb_build_object('auth_linked',a.auth_user_id is not null)
  into v_profile from public.affiliates a where a.id=p_affiliate_id;
  if v_profile is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  select coalesce(jsonb_object_agg(catalog_type,items),'{}'::jsonb) into v_options from (
    select catalog_type,jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) items
    from public.segmentation_catalog_entries where enabled and catalog_type in('union','employment_category') group by catalog_type
  ) q;
  if v_can_documents then
    select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'type_id',d.document_type_id,'type_code',t.code,'type_label',t.label,
      'required',t.required_by_default,'status',d.status,'observation',d.review_observation,'created_at',d.created_at,'updated_at',d.updated_at)
      order by d.created_at desc),'[]'::jsonb) into v_documents
    from public.affiliate_documents d join public.document_types t on t.id=d.document_type_id where d.affiliate_id=p_affiliate_id;
  end if;
  if v_can_requests then
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'folio',x.folio,'program_id',x.program_id,'request_type',x.request_type,
      'status',x.status,'financial_processing_status',x.financial_processing_status,'created_at',x.created_at,'updated_at',x.updated_at)
      order by x.created_at desc),'[]'::jsonb) into v_requests
    from (select * from public.program_requests where affiliate_id=p_affiliate_id order by created_at desc limit 50) x;
  end if;
  select coalesce(jsonb_agg(event order by event_at desc),'[]'::jsonb) into v_audit from (
    select e.created_at event_at,jsonb_build_object('id',e.event_id,'at',e.created_at,'action',e.action,'reason',e.reason,
      'actor',e.actor_auth_user_id,'changed_fields',e.changed_fields,'before',e.before_values,'after',e.after_values) event
    from public.affiliate_admin_events e where e.affiliate_id=p_affiliate_id
    union all
    select l.changed_at,jsonb_build_object('id',l.id,'at',l.changed_at,'action','PROFILE_FIELD_CHANGE','reason',l.reason,
      'actor',l.changed_by,'changed_fields',array[l.field_name],'before',jsonb_build_object(l.field_name,l.old_value),
      'after',jsonb_build_object(l.field_name,l.new_value))
    from public.affiliate_profile_audit_log l where l.affiliate_id=p_affiliate_id
  ) q;
  return jsonb_build_object('profile',v_profile,'options',v_options,'documents',v_documents,'requests',v_requests,'audit',v_audit,
    'capabilities',jsonb_build_object('documents',v_can_documents,'requests',v_can_requests));
end $$;

create function public.create_admin_affiliate(p_values jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_row public.affiliates%rowtype;v_duplicates jsonb;v_email text;v_eligibility text;v_reason text:=btrim(coalesce(p_reason,''));
  v_status text:=nullif(btrim(p_values->>'affiliate_status_raw'),'');
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_values)<>'object' then raise exception 'AFFILIATE_VALUES_REQUIRED' using errcode='22023'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_REASON_REQUIRED' using errcode='22023'; end if;
  if length(btrim(coalesce(p_values->>'numero_control',''))) not between 1 and 80 then raise exception 'AFFILIATE_CONTROL_REQUIRED' using errcode='22023'; end if;
  if length(btrim(coalesce(p_values->>'full_name',''))) not between 3 and 240 then raise exception 'AFFILIATE_NAME_REQUIRED' using errcode='22023'; end if;
  if v_status is null or not exists(select 1 from public.affiliates where affiliate_status_raw=v_status) then raise exception 'AFFILIATE_STATUS_INVALID' using errcode='22023'; end if;
  if nullif(btrim(p_values->>'financial_union_code'),'') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='union' and code=p_values->>'financial_union_code' and enabled) then raise exception 'AFFILIATE_UNION_INVALID' using errcode='22023'; end if;
  if nullif(btrim(p_values->>'financial_employee_category_code'),'') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='employment_category' and code=p_values->>'financial_employee_category_code' and enabled) then raise exception 'AFFILIATE_CATEGORY_INVALID' using errcode='22023'; end if;
  v_duplicates:=public.find_admin_affiliate_duplicates(p_values,null);
  if exists(select 1 from jsonb_array_elements(v_duplicates) d(value) where (d.value->'matches') ?| array['numero_control','rfc','curp']) then
    raise exception 'AFFILIATE_DUPLICATE_REVIEW_REQUIRED' using errcode='23505';
  end if;
  v_email:=nullif(lower(btrim(p_values->>'historical_email_raw')),'');
  v_eligibility:=case when v_email is null then 'missing_email' when v_email!~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then 'invalid_email'
    when exists(select 1 from public.affiliates where historical_email_normalized=v_email) then 'duplicate_email' else 'eligible' end;
  insert into public.affiliates(
    numero_control,full_name,display_name,affiliate_status_raw,historical_email_raw,historical_email_normalized,phone_raw,address_raw,
    birth_date_raw,gender_raw,marital_status_raw,children_count_raw,rfc_raw,curp_raw,unit_raw,city_raw,employment_position_raw,
    employment_entry_date_raw,occupation_raw,institute_entry_date_raw,employment_area_raw,employment_level_raw,pension_raw,subdirectorate_raw,
    union_enrollment_date_raw,capture_date_raw,affiliation_raw,union_position_raw,termination_date_raw,financial_union_code,
    financial_employee_category_code,financial_employee_type,financial_affiliation_status,financial_employment_status,
    auth_eligibility,auth_ineligibility_reason,record_origin,source_row_ordinal,source_file_hash
  ) values(
    btrim(p_values->>'numero_control'),btrim(p_values->>'full_name'),nullif(btrim(p_values->>'display_name'),''),v_status,
    nullif(btrim(p_values->>'historical_email_raw'),''),v_email,nullif(btrim(p_values->>'phone_raw'),''),nullif(btrim(p_values->>'address_raw'),''),
    nullif(btrim(p_values->>'birth_date_raw'),''),nullif(btrim(p_values->>'gender_raw'),''),nullif(btrim(p_values->>'marital_status_raw'),''),nullif(btrim(p_values->>'children_count_raw'),''),
    nullif(upper(btrim(p_values->>'rfc_raw')),''),nullif(upper(btrim(p_values->>'curp_raw')),''),nullif(btrim(p_values->>'unit_raw'),''),nullif(btrim(p_values->>'city_raw'),''),
    nullif(btrim(p_values->>'employment_position_raw'),''),nullif(btrim(p_values->>'employment_entry_date_raw'),''),nullif(btrim(p_values->>'occupation_raw'),''),nullif(btrim(p_values->>'institute_entry_date_raw'),''),
    nullif(btrim(p_values->>'employment_area_raw'),''),nullif(btrim(p_values->>'employment_level_raw'),''),nullif(btrim(p_values->>'pension_raw'),''),nullif(btrim(p_values->>'subdirectorate_raw'),''),
    nullif(btrim(p_values->>'union_enrollment_date_raw'),''),nullif(btrim(p_values->>'capture_date_raw'),''),nullif(btrim(p_values->>'affiliation_raw'),''),nullif(btrim(p_values->>'union_position_raw'),''),
    nullif(btrim(p_values->>'termination_date_raw'),''),nullif(btrim(p_values->>'financial_union_code'),''),nullif(btrim(p_values->>'financial_employee_category_code'),''),
    nullif(btrim(p_values->>'financial_employee_type'),''),nullif(btrim(p_values->>'financial_affiliation_status'),''),nullif(btrim(p_values->>'financial_employment_status'),''),
    v_eligibility,case when v_eligibility='eligible' then null else v_eligibility end,'ADMIN_AFFILIATES',null,null
  ) returning * into v_row;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(v_row.id,auth.uid(),'CREATE',null,to_jsonb(v_row)-array['auth_user_id','historical_email_normalized','source_file_hash']::text[],
    array['numero_control','full_name','affiliate_status_raw'],v_reason);
  return public.get_admin_affiliate_workbench(v_row.id);
end $$;

create function public.update_admin_affiliate(p_affiliate_id uuid,p_expected_updated_at timestamptz,p_patch jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_key text;v_value text;v_reason text:=btrim(coalesce(p_reason,''));
  v_allowed constant text[]:=array['full_name','display_name','historical_email_raw','phone_raw','address_raw','birth_date_raw','gender_raw','marital_status_raw','children_count_raw','rfc_raw','curp_raw','unit_raw','city_raw','employment_position_raw','employment_entry_date_raw','occupation_raw','institute_entry_date_raw','employment_area_raw','employment_level_raw','pension_raw','subdirectorate_raw','union_enrollment_date_raw','capture_date_raw','affiliation_raw','union_position_raw','termination_date_raw','financial_union_code','financial_employee_category_code','financial_employee_type','financial_affiliation_status','financial_employment_status'];
  v_profile_fields constant text[]:=array['full_name','display_name','phone_raw','unit_raw','city_raw','employment_position_raw','employment_area_raw','financial_union_code','financial_employee_category_code','financial_employee_type','financial_affiliation_status','financial_employment_status'];
  v_changed text[]:=array[]::text[];v_before jsonb:='{}'::jsonb;v_after jsonb:='{}'::jsonb;v_profile_change boolean:=false;v_email text;v_eligibility text;
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'AFFILIATE_PATCH_REQUIRED' using errcode='22023'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='40001'; end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if not(v_key=any(v_allowed)) then raise exception 'AFFILIATE_FIELD_DENIED: %',v_key using errcode='22023'; end if;
    v_value:=nullif(btrim(p_patch->>v_key),'');
    if v_key in ('rfc_raw','curp_raw') then v_value:=upper(v_value); end if;
    if to_jsonb(v_old)->>v_key is distinct from v_value then
      v_changed:=array_append(v_changed,v_key);v_before:=v_before||jsonb_build_object(v_key,to_jsonb(v_old)->v_key);v_after:=v_after||jsonb_build_object(v_key,to_jsonb(v_value));
      if v_key=any(v_profile_fields) then v_profile_change:=true; end if;
    end if;
  end loop;
  if cardinality(v_changed)=0 then raise exception 'AFFILIATE_NO_CHANGE' using errcode='22023'; end if;
  if p_patch?'rfc_raw' and nullif(upper(btrim(p_patch->>'rfc_raw')),'') is not null and exists(select 1 from public.affiliates where id<>p_affiliate_id and upper(btrim(rfc_raw))=upper(btrim(p_patch->>'rfc_raw'))) then raise exception 'AFFILIATE_RFC_DUPLICATE' using errcode='23505'; end if;
  if p_patch?'curp_raw' and nullif(upper(btrim(p_patch->>'curp_raw')),'') is not null and exists(select 1 from public.affiliates where id<>p_affiliate_id and upper(btrim(curp_raw))=upper(btrim(p_patch->>'curp_raw'))) then raise exception 'AFFILIATE_CURP_DUPLICATE' using errcode='23505'; end if;
  if p_patch?'financial_union_code' and nullif(btrim(p_patch->>'financial_union_code'),'') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='union' and code=p_patch->>'financial_union_code' and enabled) then raise exception 'AFFILIATE_UNION_INVALID' using errcode='22023'; end if;
  if p_patch?'financial_employee_category_code' and nullif(btrim(p_patch->>'financial_employee_category_code'),'') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='employment_category' and code=p_patch->>'financial_employee_category_code' and enabled) then raise exception 'AFFILIATE_CATEGORY_INVALID' using errcode='22023'; end if;
  v_email:=case when p_patch?'historical_email_raw' then nullif(lower(btrim(p_patch->>'historical_email_raw')),'') else v_old.historical_email_normalized end;
  v_eligibility:=case when v_old.auth_user_id is not null then v_old.auth_eligibility when v_email is null then 'missing_email'
    when v_email!~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then 'invalid_email'
    when exists(select 1 from public.affiliates where id<>p_affiliate_id and historical_email_normalized=v_email) then 'duplicate_email' else 'eligible' end;
  update public.affiliates set
    full_name=case when p_patch?'full_name' then nullif(btrim(p_patch->>'full_name'),'') else full_name end,
    display_name=case when p_patch?'display_name' then nullif(btrim(p_patch->>'display_name'),'') else display_name end,
    historical_email_raw=case when p_patch?'historical_email_raw' then nullif(btrim(p_patch->>'historical_email_raw'),'') else historical_email_raw end,
    historical_email_normalized=case when p_patch?'historical_email_raw' then v_email else historical_email_normalized end,
    phone_raw=case when p_patch?'phone_raw' then nullif(btrim(p_patch->>'phone_raw'),'') else phone_raw end,
    address_raw=case when p_patch?'address_raw' then nullif(btrim(p_patch->>'address_raw'),'') else address_raw end,
    birth_date_raw=case when p_patch?'birth_date_raw' then nullif(btrim(p_patch->>'birth_date_raw'),'') else birth_date_raw end,
    gender_raw=case when p_patch?'gender_raw' then nullif(btrim(p_patch->>'gender_raw'),'') else gender_raw end,
    marital_status_raw=case when p_patch?'marital_status_raw' then nullif(btrim(p_patch->>'marital_status_raw'),'') else marital_status_raw end,
    children_count_raw=case when p_patch?'children_count_raw' then nullif(btrim(p_patch->>'children_count_raw'),'') else children_count_raw end,
    rfc_raw=case when p_patch?'rfc_raw' then nullif(upper(btrim(p_patch->>'rfc_raw')),'') else rfc_raw end,
    curp_raw=case when p_patch?'curp_raw' then nullif(upper(btrim(p_patch->>'curp_raw')),'') else curp_raw end,
    unit_raw=case when p_patch?'unit_raw' then nullif(btrim(p_patch->>'unit_raw'),'') else unit_raw end,
    city_raw=case when p_patch?'city_raw' then nullif(btrim(p_patch->>'city_raw'),'') else city_raw end,
    employment_position_raw=case when p_patch?'employment_position_raw' then nullif(btrim(p_patch->>'employment_position_raw'),'') else employment_position_raw end,
    employment_entry_date_raw=case when p_patch?'employment_entry_date_raw' then nullif(btrim(p_patch->>'employment_entry_date_raw'),'') else employment_entry_date_raw end,
    occupation_raw=case when p_patch?'occupation_raw' then nullif(btrim(p_patch->>'occupation_raw'),'') else occupation_raw end,
    institute_entry_date_raw=case when p_patch?'institute_entry_date_raw' then nullif(btrim(p_patch->>'institute_entry_date_raw'),'') else institute_entry_date_raw end,
    employment_area_raw=case when p_patch?'employment_area_raw' then nullif(btrim(p_patch->>'employment_area_raw'),'') else employment_area_raw end,
    employment_level_raw=case when p_patch?'employment_level_raw' then nullif(btrim(p_patch->>'employment_level_raw'),'') else employment_level_raw end,
    pension_raw=case when p_patch?'pension_raw' then nullif(btrim(p_patch->>'pension_raw'),'') else pension_raw end,
    subdirectorate_raw=case when p_patch?'subdirectorate_raw' then nullif(btrim(p_patch->>'subdirectorate_raw'),'') else subdirectorate_raw end,
    union_enrollment_date_raw=case when p_patch?'union_enrollment_date_raw' then nullif(btrim(p_patch->>'union_enrollment_date_raw'),'') else union_enrollment_date_raw end,
    capture_date_raw=case when p_patch?'capture_date_raw' then nullif(btrim(p_patch->>'capture_date_raw'),'') else capture_date_raw end,
    affiliation_raw=case when p_patch?'affiliation_raw' then nullif(btrim(p_patch->>'affiliation_raw'),'') else affiliation_raw end,
    union_position_raw=case when p_patch?'union_position_raw' then nullif(btrim(p_patch->>'union_position_raw'),'') else union_position_raw end,
    termination_date_raw=case when p_patch?'termination_date_raw' then nullif(btrim(p_patch->>'termination_date_raw'),'') else termination_date_raw end,
    financial_union_code=case when p_patch?'financial_union_code' then nullif(btrim(p_patch->>'financial_union_code'),'') else financial_union_code end,
    financial_employee_category_code=case when p_patch?'financial_employee_category_code' then nullif(btrim(p_patch->>'financial_employee_category_code'),'') else financial_employee_category_code end,
    financial_employee_type=case when p_patch?'financial_employee_type' then nullif(btrim(p_patch->>'financial_employee_type'),'') else financial_employee_type end,
    financial_affiliation_status=case when p_patch?'financial_affiliation_status' then nullif(btrim(p_patch->>'financial_affiliation_status'),'') else financial_affiliation_status end,
    financial_employment_status=case when p_patch?'financial_employment_status' then nullif(btrim(p_patch->>'financial_employment_status'),'') else financial_employment_status end,
    auth_eligibility=case when p_patch?'historical_email_raw' and auth_user_id is null then v_eligibility else auth_eligibility end,
    auth_ineligibility_reason=case when p_patch?'historical_email_raw' and auth_user_id is null then case when v_eligibility='eligible' then null else v_eligibility end else auth_ineligibility_reason end,
    financial_profile_version=financial_profile_version+case when v_profile_change then 1 else 0 end,
    financial_profile_updated_at=case when v_profile_change then now() else financial_profile_updated_at end,
    financial_profile_updated_by=case when v_profile_change then auth.uid() else financial_profile_updated_by end
  where id=p_affiliate_id returning * into v_new;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),'UPDATE',v_before,v_after,v_changed,v_reason);
  for v_key in select unnest(v_changed) loop
    if v_key=any(v_profile_fields) then
      insert into public.affiliate_profile_audit_log(affiliate_id,field_name,old_value,new_value,changed_by,reason,profile_version)
      values(p_affiliate_id,v_key,v_before->v_key,v_after->v_key,auth.uid(),v_reason,v_new.financial_profile_version);
    end if;
  end loop;
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $$;

create function public.change_admin_affiliate_status(p_affiliate_id uuid,p_expected_updated_at timestamptz,p_new_status text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_status text:=btrim(coalesce(p_new_status,''));v_reason text:=btrim(coalesce(p_reason,''));
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_REASON_REQUIRED' using errcode='22023'; end if;
  if v_status='' or not exists(select 1 from public.affiliates where affiliate_status_raw=v_status) then raise exception 'AFFILIATE_STATUS_INVALID' using errcode='22023'; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='40001'; end if;
  if v_old.affiliate_status_raw is not distinct from v_status then raise exception 'AFFILIATE_STATUS_NO_CHANGE' using errcode='22023'; end if;
  update public.affiliates set affiliate_status_raw=v_status where id=p_affiliate_id returning * into v_new;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),'STATUS_CHANGE',jsonb_build_object('affiliate_status_raw',v_old.affiliate_status_raw),jsonb_build_object('affiliate_status_raw',v_new.affiliate_status_raw),array['affiliate_status_raw'],v_reason);
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $$;

revoke all on function public.list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text) from public,anon;
revoke all on function public.find_admin_affiliate_duplicates(jsonb,uuid) from public,anon;
revoke all on function public.get_admin_affiliate_workbench(uuid) from public,anon;
revoke all on function public.create_admin_affiliate(jsonb,text) from public,anon;
revoke all on function public.update_admin_affiliate(uuid,timestamptz,jsonb,text) from public,anon;
revoke all on function public.change_admin_affiliate_status(uuid,timestamptz,text,text) from public,anon;
grant execute on function public.list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text) to authenticated;
grant execute on function public.find_admin_affiliate_duplicates(jsonb,uuid) to authenticated;
grant execute on function public.get_admin_affiliate_workbench(uuid) to authenticated;
grant execute on function public.create_admin_affiliate(jsonb,text) to authenticated;
grant execute on function public.update_admin_affiliate(uuid,timestamptz,jsonb,text) to authenticated;
grant execute on function public.change_admin_affiliate_status(uuid,timestamptz,text,text) to authenticated;

comment on column public.affiliates.record_origin is 'HISTORICAL_IMPORT preserves source coordinates; ADMIN_AFFILIATES never fabricates them.';
comment on table public.affiliate_admin_events is 'Durable before/after audit for Admin affiliate create, edit and status changes; never an affiliate master.';
comment on function public.list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text) is 'Permission-gated, server-paginated Admin read model over public.affiliates and authoritative summaries.';

notify pgrst,'reload schema';
commit;
