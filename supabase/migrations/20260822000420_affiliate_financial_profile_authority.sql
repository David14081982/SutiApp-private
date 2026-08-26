begin;

-- Current employment attributes are mutable profile data. They never grant Admin rights.
alter table public.affiliates
  add column financial_union_code text null,
  add column financial_employee_category_code text null,
  add column financial_employee_type text null,
  add column financial_affiliation_status text null,
  add column financial_employment_status text null,
  add column financial_profile_version integer not null default 0,
  add column financial_profile_updated_at timestamptz null,
  add column financial_profile_updated_by uuid null references auth.users(id) on delete restrict,
  add column financial_profile_seed_source_hash text null,
  add column financial_profile_seed_row_ordinal integer null,
  add column financial_profile_seeded_at timestamptz null,
  add constraint affiliates_financial_profile_version_check check(financial_profile_version >= 0),
  add constraint affiliates_financial_employee_type_check check(financial_employee_type is null or length(btrim(financial_employee_type)) between 1 and 120),
  add constraint affiliates_financial_affiliation_status_check check(financial_affiliation_status is null or length(btrim(financial_affiliation_status)) between 1 and 80),
  add constraint affiliates_financial_employment_status_check check(financial_employment_status is null or length(btrim(financial_employment_status)) between 1 and 80),
  add constraint affiliates_financial_seed_check check(
    (financial_profile_seed_source_hash is null and financial_profile_seed_row_ordinal is null and financial_profile_seeded_at is null)
    or
    (financial_profile_seed_source_hash ~ '^[A-F0-9]{64}$' and financial_profile_seed_row_ordinal > 0 and financial_profile_seeded_at is not null)
  );

create table public.affiliate_profile_audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  field_name text not null check(field_name in(
    'full_name','display_name','phone_raw','unit_raw','city_raw','employment_position_raw','employment_area_raw',
    'financial_union_code','financial_employee_category_code','financial_employee_type',
    'financial_affiliation_status','financial_employment_status'
  )),
  old_value jsonb null,
  new_value jsonb null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  reason text not null check(length(btrim(reason)) between 8 and 500),
  profile_version integer not null check(profile_version > 0)
);
create index affiliate_profile_audit_affiliate_changed_idx on public.affiliate_profile_audit_log(affiliate_id,changed_at desc);

-- Add the technical permission without deriving it from union/category/status.
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write',
  'authorization.read','authorization.write','segmentation.read','segmentation.write',
  'workflow.read','workflow.write','union_content.read','union_content.write'
]::text[]);
insert into public.admin_role_permissions(role_id,permission)
select id,'affiliates.write' from public.admin_roles where code='principal_admin'
on conflict do nothing;
update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=a.role_id),updated_at=now()
where a.enabled;

create or replace function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_allowed text[]:=array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write'];
begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  if p_permissions is null or exists(select 1 from unnest(p_permissions) p where not(p=any(v_allowed))) then raise exception 'INVALID_PERMISSION' using errcode='22023'; end if;
  if p_role_id is null then
    insert into public.admin_roles(code,name,description) values('role_'||replace(extensions.gen_random_uuid()::text,'-',''),btrim(p_name),coalesce(p_description,'')) returning id into v_id;
  else
    if exists(select 1 from public.admin_roles where id=p_role_id and system_role) then raise exception 'SYSTEM_ROLE_IMMUTABLE' using errcode='P0001'; end if;
    update public.admin_roles set name=btrim(p_name),description=coalesce(p_description,''),updated_at=now() where id=p_role_id returning id into v_id;
    if v_id is null then raise exception 'ROLE_NOT_FOUND' using errcode='P0001'; end if;
    delete from public.admin_role_permissions where role_id=v_id;
  end if;
  insert into public.admin_role_permissions(role_id,permission) select v_id,p from (select distinct unnest(p_permissions) p) q;
  update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=v_id),updated_at=now() where role_id=v_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'admin_roles',case when p_role_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS');
  return v_id;
end $$;

create function public.get_affiliate_admin_profile(p_affiliate_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_profile jsonb; v_options jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  select to_jsonb(a) - array['historical_email_raw','historical_email_normalized','source_file_hash','source_row_ordinal']::text[] into v_profile
  from public.affiliates a where a.id=p_affiliate_id;
  if v_profile is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  select coalesce(jsonb_object_agg(catalog_type,items),'{}'::jsonb) into v_options from (
    select catalog_type,jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) items
    from public.segmentation_catalog_entries where enabled and catalog_type in('union','employment_category') group by catalog_type
  ) q;
  return jsonb_build_object('profile',v_profile,'options',v_options);
end $$;

create function public.update_affiliate_admin_profile(p_affiliate_id uuid,p_expected_version integer,p_patch jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_old public.affiliates%rowtype; v_new public.affiliates%rowtype; v_key text; v_changed boolean:=false; v_allowed constant text[]:=array[
  'full_name','display_name','phone_raw','unit_raw','city_raw','employment_position_raw','employment_area_raw',
  'financial_union_code','financial_employee_category_code','financial_employee_type','financial_affiliation_status','financial_employment_status'];
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'PROFILE_PATCH_REQUIRED' using errcode='22023'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'PROFILE_REASON_REQUIRED' using errcode='22023'; end if;
  for v_key in select jsonb_object_keys(p_patch) loop if not(v_key=any(v_allowed)) then raise exception 'PROFILE_FIELD_DENIED: %',v_key using errcode='22023'; end if; end loop;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.financial_profile_version<>coalesce(p_expected_version,-1) then raise exception 'PROFILE_VERSION_CONFLICT' using errcode='40001'; end if;
  if p_patch ? 'financial_union_code' and nullif(btrim(p_patch->>'financial_union_code'),'') is not null and not exists(
    select 1 from public.segmentation_catalog_entries where catalog_type='union' and code=p_patch->>'financial_union_code' and enabled
  ) then raise exception 'FINANCIAL_UNION_INVALID' using errcode='22023'; end if;
  if p_patch ? 'financial_employee_category_code' and nullif(btrim(p_patch->>'financial_employee_category_code'),'') is not null and not exists(
    select 1 from public.segmentation_catalog_entries where catalog_type='employment_category' and code=p_patch->>'financial_employee_category_code' and enabled
  ) then raise exception 'FINANCIAL_CATEGORY_INVALID' using errcode='22023'; end if;
  update public.affiliates set
    full_name=case when p_patch?'full_name' then nullif(btrim(p_patch->>'full_name'),'') else full_name end,
    display_name=case when p_patch?'display_name' then nullif(btrim(p_patch->>'display_name'),'') else display_name end,
    phone_raw=case when p_patch?'phone_raw' then nullif(btrim(p_patch->>'phone_raw'),'') else phone_raw end,
    unit_raw=case when p_patch?'unit_raw' then nullif(btrim(p_patch->>'unit_raw'),'') else unit_raw end,
    city_raw=case when p_patch?'city_raw' then nullif(btrim(p_patch->>'city_raw'),'') else city_raw end,
    employment_position_raw=case when p_patch?'employment_position_raw' then nullif(btrim(p_patch->>'employment_position_raw'),'') else employment_position_raw end,
    employment_area_raw=case when p_patch?'employment_area_raw' then nullif(btrim(p_patch->>'employment_area_raw'),'') else employment_area_raw end,
    financial_union_code=case when p_patch?'financial_union_code' then nullif(btrim(p_patch->>'financial_union_code'),'') else financial_union_code end,
    financial_employee_category_code=case when p_patch?'financial_employee_category_code' then nullif(btrim(p_patch->>'financial_employee_category_code'),'') else financial_employee_category_code end,
    financial_employee_type=case when p_patch?'financial_employee_type' then nullif(btrim(p_patch->>'financial_employee_type'),'') else financial_employee_type end,
    financial_affiliation_status=case when p_patch?'financial_affiliation_status' then nullif(btrim(p_patch->>'financial_affiliation_status'),'') else financial_affiliation_status end,
    financial_employment_status=case when p_patch?'financial_employment_status' then nullif(btrim(p_patch->>'financial_employment_status'),'') else financial_employment_status end,
    financial_profile_version=financial_profile_version+1,financial_profile_updated_at=now(),financial_profile_updated_by=auth.uid(),updated_at=now()
  where id=p_affiliate_id returning * into v_new;
  for v_key in select unnest(v_allowed) loop
    if to_jsonb(v_old)->v_key is distinct from to_jsonb(v_new)->v_key then
      v_changed:=true;
      insert into public.affiliate_profile_audit_log(affiliate_id,field_name,old_value,new_value,changed_by,reason,profile_version)
      values(p_affiliate_id,v_key,to_jsonb(v_old)->v_key,to_jsonb(v_new)->v_key,auth.uid(),btrim(p_reason),v_new.financial_profile_version);
    end if;
  end loop;
  if not v_changed then raise exception 'PROFILE_NO_CHANGE' using errcode='22023'; end if;
  return public.get_affiliate_admin_profile(p_affiliate_id);
end $$;

create function public.get_current_affiliate_financial_context()
returns jsonb language sql stable security definer set search_path=''
as $$ select jsonb_build_object(
  'affiliate_id',a.id,'numero_control',a.numero_control,
  'financial_union_code',a.financial_union_code,'financial_union',u.label,
  'financial_employee_category_code',a.financial_employee_category_code,'financial_employee_category',c.label,
  'financial_employee_type',a.financial_employee_type,'financial_affiliation_status',a.financial_affiliation_status,
  'financial_employment_status',a.financial_employment_status,'financial_profile_version',a.financial_profile_version
) from public.affiliates a
left join public.segmentation_catalog_entries u on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled
left join public.segmentation_catalog_entries c on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled
where a.id=public.get_effective_affiliate_id() $$;

-- Financial requests preserve request-time and approval-time facts; both snapshots are immutable.
alter table public.program_requests
  add column requested_amount numeric(14,2) null check(requested_amount is null or requested_amount>0),
  add column requested_term numeric(10,2) null check(requested_term is null or requested_term>0),
  add column requested_term_semantics text null,
  add column financial_profile_snapshot jsonb null check(financial_profile_snapshot is null or jsonb_typeof(financial_profile_snapshot)='object'),
  add column financial_approval_snapshot jsonb null check(financial_approval_snapshot is null or jsonb_typeof(financial_approval_snapshot)='object'),
  add column financial_approved_at timestamptz null,
  add column financial_approved_by uuid null references auth.users(id) on delete restrict;

create function public.protect_financial_request_snapshots() returns trigger language plpgsql set search_path=''
as $$ begin
  if tg_op='INSERT' and new.financial_processing_status is not null then
    select jsonb_build_object('affiliate_id',a.id,'numero_control',a.numero_control,'financial_union_code',a.financial_union_code,
      'financial_union',u.label,'financial_employee_category_code',a.financial_employee_category_code,
      'financial_employee_category',c.label,'financial_employee_type',a.financial_employee_type,
      'financial_affiliation_status',a.financial_affiliation_status,'financial_employment_status',a.financial_employment_status,
      'profile_version',a.financial_profile_version,'captured_at',now()) into new.financial_profile_snapshot
    from public.affiliates a
    left join public.segmentation_catalog_entries u on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled
    left join public.segmentation_catalog_entries c on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled
    where a.id=new.affiliate_id;
  elsif tg_op='UPDATE' then
    if new.financial_profile_snapshot is distinct from old.financial_profile_snapshot or old.financial_approval_snapshot is not null and new.financial_approval_snapshot is distinct from old.financial_approval_snapshot then
      raise exception 'FINANCIAL_SNAPSHOT_IMMUTABLE' using errcode='P0001';
    end if;
    if new.financial_processing_status is not null and new.status='approved' and old.status is distinct from 'approved' and new.financial_approval_snapshot is null then
      raise exception 'FINANCIAL_APPROVAL_SNAPSHOT_REQUIRED' using errcode='P0001';
    end if;
    if old.requested_amount is not null and (new.requested_amount is distinct from old.requested_amount or new.requested_term is distinct from old.requested_term or new.requested_term_semantics is distinct from old.requested_term_semantics) then
      raise exception 'FINANCIAL_REQUEST_TERMS_IMMUTABLE' using errcode='P0001';
    end if;
  end if;
  return new;
end $$;
create trigger program_requests_00_financial_snapshot before insert or update on public.program_requests
for each row execute function public.protect_financial_request_snapshots();

create function public.set_financial_program_request_terms(p_request_id uuid,p_amount numeric,p_term numeric,p_term_semantics text)
returns public.program_requests language plpgsql security definer set search_path=''
as $$ declare v_row public.program_requests%rowtype;
begin
  select * into v_row from public.program_requests where id=p_request_id for update;
  if v_row.id is null or v_row.affiliate_id<>public.get_effective_affiliate_id() or v_row.financial_processing_status is null then raise exception 'FINANCIAL_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  if p_amount is null or p_amount<=0 or p_term is null or p_term<=0 or length(btrim(coalesce(p_term_semantics,''))) not between 3 and 80 then raise exception 'FINANCIAL_REQUEST_TERMS_INVALID' using errcode='22023'; end if;
  if upper(btrim(p_term_semantics)) like '%UNKNOWN%' then raise exception 'FINANCIAL_TERM_SEMANTICS_UNRESOLVED' using errcode='22023'; end if;
  if v_row.requested_amount is not null then
    if v_row.requested_amount=p_amount and v_row.requested_term=p_term and v_row.requested_term_semantics=btrim(p_term_semantics) then return v_row; end if;
    raise exception 'FINANCIAL_REQUEST_TERMS_IMMUTABLE' using errcode='P0001';
  end if;
  update public.program_requests set requested_amount=p_amount,requested_term=p_term,requested_term_semantics=btrim(p_term_semantics),updated_at=now()
  where id=p_request_id returning * into v_row;
  return v_row;
end $$;

create function public.approve_financial_program_request(p_request_id uuid,p_snapshot jsonb,p_approved_by uuid)
returns public.program_requests language plpgsql security definer set search_path=''
as $$ declare v_row public.program_requests%rowtype; v_required text[]:=array[
  'affiliate_id','numero_control','financial_union','financial_employee_category','affiliation_status','fund','rate','term','maxAmount','requestedAmount','administrativeFee','financialResult'];
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_row from public.program_requests where id=p_request_id for update;
  if v_row.id is null or v_row.financial_processing_status is null then raise exception 'FINANCIAL_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  if v_row.financial_approval_snapshot is not null then return v_row; end if;
  if jsonb_typeof(p_snapshot)<>'object' or exists(select 1 from unnest(v_required) k where not(p_snapshot?k)) then raise exception 'FINANCIAL_APPROVAL_SNAPSHOT_INCOMPLETE' using errcode='22023'; end if;
  if p_snapshot->>'affiliate_id'<>v_row.affiliate_id::text or p_snapshot->>'numero_control'<>v_row.numero_control then raise exception 'FINANCIAL_SNAPSHOT_IDENTITY_MISMATCH' using errcode='22023'; end if;
  if jsonb_typeof(p_snapshot->'administrativeFee')<>'object' or not((p_snapshot->'administrativeFee')?'rule') or not((p_snapshot->'administrativeFee')?'version') then raise exception 'ADMINISTRATIVE_FEE_CONTRACT_INCOMPLETE' using errcode='22023'; end if;
  if p_approved_by is null or not exists(select 1 from auth.users where id=p_approved_by) then raise exception 'APPROVAL_ACTOR_REQUIRED' using errcode='22023'; end if;
  update public.program_requests set status='approved',financial_processing_status='pending',financial_approval_snapshot=p_snapshot,
    financial_approved_at=now(),financial_approved_by=p_approved_by,updated_at=now() where id=p_request_id returning * into v_row;
  return v_row;
end $$;

-- Current values drive future audience/eligibility checks. Historical raw columns are provenance only.
create or replace function public.matches_current_affiliate_audience(p_mode text,p_unions text[],p_categories text[],p_genders text[],p_tags text[])
returns boolean language sql stable security definer set search_path=''
as $$ select case
  when p_mode in('all','public') then true when p_mode='guest' then auth.uid() is null
  when auth.uid() is null then false
  when p_mode='registered' then exists(select 1 from public.affiliates where auth_user_id=auth.uid())
  else exists(select 1 from public.affiliates a where a.auth_user_id=auth.uid()
    and (cardinality(p_unions)=0 or a.financial_union_code=any(p_unions))
    and (cardinality(p_categories)=0 or a.financial_employee_category_code=any(p_categories))
    and (cardinality(p_genders)=0 or exists(select 1 from public.segmentation_catalog_entries c where c.catalog_type='gender' and c.code=any(p_genders) and lower(btrim(c.label))=lower(btrim(coalesce(a.gender_raw,'')))))
    and (cardinality(p_tags)=0 or exists(select 1 from public.affiliate_segment_tags t where t.affiliate_id=a.id and t.tag_code=any(p_tags)))) end $$;

alter table public.affiliate_profile_audit_log enable row level security;
alter table public.affiliate_profile_audit_log force row level security;
revoke all on public.affiliate_profile_audit_log from public,anon,authenticated;
grant select on public.affiliate_profile_audit_log to authenticated;
create policy affiliate_profile_audit_admin_read on public.affiliate_profile_audit_log for select to authenticated using(public.has_admin_permission('affiliates.read'));

grant execute on function public.get_affiliate_admin_profile(uuid) to authenticated;
grant execute on function public.update_affiliate_admin_profile(uuid,integer,jsonb,text) to authenticated;
grant execute on function public.get_current_affiliate_financial_context() to authenticated;
grant execute on function public.set_financial_program_request_terms(uuid,numeric,numeric,text) to authenticated;
grant execute on function public.approve_financial_program_request(uuid,jsonb,uuid) to service_role;
revoke execute on function public.get_affiliate_admin_profile(uuid) from public,anon;
revoke execute on function public.update_affiliate_admin_profile(uuid,integer,jsonb,text) from public,anon;
revoke execute on function public.get_current_affiliate_financial_context() from public,anon;
revoke execute on function public.set_financial_program_request_terms(uuid,numeric,numeric,text) from public,anon;
revoke execute on function public.approve_financial_program_request(uuid,jsonb,uuid) from public,anon,authenticated;

comment on column public.affiliates.financial_union_code is 'Current mutable union code. Seeded once from the exact authorized workbook, then Supabase is authority.';
comment on column public.affiliates.financial_employee_category_code is 'Current mutable employee category code. Not an Admin role or permission.';
comment on column public.program_requests.financial_profile_snapshot is 'Immutable request-time affiliate context; later affiliate edits never rewrite it.';
comment on column public.program_requests.financial_approval_snapshot is 'Immutable complete Google-derived financial contract confirmed at approval.';

notify pgrst, 'reload schema';
commit;
