begin;

create table public.affiliate_financial_profile_seed_batches (
  id uuid primary key,
  batch_code text not null unique check(batch_code='BULK_INITIAL_FINANCIAL_PROFILE_SEED'),
  source_file_hash text not null check(source_file_hash ~ '^[A-F0-9]{64}$'),
  source_sheet text not null check(source_sheet='Usuarios'),
  expected_affiliates integer not null check(expected_affiliates=947),
  expected_categories integer not null check(expected_categories=931),
  expected_unions integer not null check(expected_unions=770),
  actor text not null check(actor='SYSTEM_SEED'),
  status text not null check(status in('APPLIED','RECOVERED')),
  result jsonb not null check(jsonb_typeof(result)='object'),
  created_at timestamptz not null default now(),
  applied_at timestamptz not null,
  recovered_at timestamptz null
);

create table public.affiliate_financial_profile_seed_snapshot (
  batch_id uuid not null references public.affiliate_financial_profile_seed_batches(id) on delete restrict,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  source_row_ordinal integer not null check(source_row_ordinal>0),
  old_financial_union_code text null,
  old_financial_employee_category_code text null,
  old_financial_profile_version integer not null,
  old_financial_profile_updated_at timestamptz null,
  old_financial_profile_updated_by uuid null references auth.users(id) on delete restrict,
  old_seed_source_hash text null,
  old_seed_row_ordinal integer null,
  old_seeded_at timestamptz null,
  old_updated_at timestamptz not null,
  new_financial_union_code text null,
  new_financial_employee_category_code text null,
  seeded_profile_version integer not null,
  captured_at timestamptz not null default now(),
  primary key(batch_id,affiliate_id),
  unique(batch_id,source_row_ordinal)
);

alter table public.affiliate_profile_audit_log alter column changed_by drop not null;
alter table public.affiliate_profile_audit_log
  add column batch_id uuid null references public.affiliate_financial_profile_seed_batches(id) on delete restrict,
  add column change_source text not null default 'ADMIN',
  add constraint affiliate_profile_audit_actor_source_check check(
    (change_source='ADMIN' and changed_by is not null and batch_id is null)
    or
    (change_source='BULK_INITIAL_FINANCIAL_PROFILE_SEED' and changed_by is null and batch_id is not null)
  );
create index affiliate_profile_audit_batch_idx on public.affiliate_profile_audit_log(batch_id) where batch_id is not null;

create function public.bulk_seed_affiliate_financial_profiles(
  p_batch_id uuid,
  p_source_hash text,
  p_rows jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_existing public.affiliate_financial_profile_seed_batches%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_result jsonb;
  v_affiliates integer;
  v_categories integer;
  v_unions integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_batch_id is null or p_source_hash<>'F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591' then raise exception 'SEED_IDENTITY_INVALID' using errcode='22023'; end if;

  select * into v_existing from public.affiliate_financial_profile_seed_batches where id=p_batch_id for update;
  if v_existing.id is not null then
    if v_existing.source_file_hash<>p_source_hash then raise exception 'SEED_BATCH_CONFLICT' using errcode='22023'; end if;
    return v_existing.result || jsonb_build_object('idempotent',true,'batch_id',v_existing.id,'status',v_existing.status);
  end if;

  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<>947 then raise exception 'SEED_ROWS_EXACT_947_REQUIRED' using errcode='22023'; end if;
  select count(*),count(financial_employee_category_code),count(financial_union_code)
    into v_affiliates,v_categories,v_unions
  from jsonb_to_recordset(p_rows) as x(affiliate_id uuid,source_row_ordinal integer,financial_employee_category_code text,financial_union_code text);
  if v_affiliates<>947 or v_categories<>931 or v_unions<>770 then raise exception 'SEED_COUNTS_MISMATCH' using errcode='22023'; end if;
  if (select count(distinct affiliate_id) from jsonb_to_recordset(p_rows) as x(affiliate_id uuid))<>947
    or (select count(distinct source_row_ordinal) from jsonb_to_recordset(p_rows) as x(source_row_ordinal integer))<>947
  then raise exception 'SEED_MAPPING_NOT_ONE_TO_ONE' using errcode='22023'; end if;
  if (select count(*) from public.affiliates)<>947
    or (select count(*) from public.affiliates where source_file_hash=p_source_hash)<>947
  then raise exception 'AFFILIATE_UNIVERSE_MISMATCH' using errcode='P0001'; end if;
  if (select count(*) from jsonb_to_recordset(p_rows) as x(affiliate_id uuid,source_row_ordinal integer)
      join public.affiliates a on a.id=x.affiliate_id and a.source_file_hash=p_source_hash and a.source_row_ordinal=x.source_row_ordinal)<>947
  then raise exception 'AFFILIATE_ID_ORDINAL_MISMATCH' using errcode='P0001'; end if;
  if exists(
    select 1 from jsonb_to_recordset(p_rows) as x(financial_employee_category_code text,financial_union_code text)
    where (x.financial_employee_category_code is not null and not exists(select 1 from public.segmentation_catalog_entries c where c.catalog_type='employment_category' and c.code=x.financial_employee_category_code and c.enabled))
       or (x.financial_union_code is not null and not exists(select 1 from public.segmentation_catalog_entries c where c.catalog_type='union' and c.code=x.financial_union_code and c.enabled))
  ) then raise exception 'SEED_CATALOG_VALUE_INVALID' using errcode='22023'; end if;
  if exists(
    select 1 from public.affiliates a join jsonb_to_recordset(p_rows) as x(affiliate_id uuid) on x.affiliate_id=a.id
    where a.financial_union_code is not null or a.financial_employee_category_code is not null or a.financial_profile_seed_source_hash is not null
  ) then raise exception 'AFFILIATE_FINANCIAL_PROFILE_ALREADY_MATERIALIZED' using errcode='P0001'; end if;

  v_result:=jsonb_build_object('affiliates_total',947,'categories_seeded',931,'category_null',16,'unions_seeded',770,'union_null',177,'source_errors_inferred',0,'mapping_mismatches',0,'batch_id',p_batch_id,'idempotent',false,'status','APPLIED');
  insert into public.affiliate_financial_profile_seed_batches(id,batch_code,source_file_hash,source_sheet,expected_affiliates,expected_categories,expected_unions,actor,status,result,applied_at)
  values(p_batch_id,'BULK_INITIAL_FINANCIAL_PROFILE_SEED',p_source_hash,'Usuarios',947,931,770,'SYSTEM_SEED','APPLIED',v_result,v_now);

  insert into public.affiliate_financial_profile_seed_snapshot(
    batch_id,affiliate_id,source_row_ordinal,old_financial_union_code,old_financial_employee_category_code,
    old_financial_profile_version,old_financial_profile_updated_at,old_financial_profile_updated_by,
    old_seed_source_hash,old_seed_row_ordinal,old_seeded_at,old_updated_at,
    new_financial_union_code,new_financial_employee_category_code,seeded_profile_version,captured_at
  )
  select p_batch_id,a.id,a.source_row_ordinal,a.financial_union_code,a.financial_employee_category_code,
    a.financial_profile_version,a.financial_profile_updated_at,a.financial_profile_updated_by,
    a.financial_profile_seed_source_hash,a.financial_profile_seed_row_ordinal,a.financial_profile_seeded_at,a.updated_at,
    x.financial_union_code,x.financial_employee_category_code,a.financial_profile_version+1,v_now
  from public.affiliates a join jsonb_to_recordset(p_rows) as x(
    affiliate_id uuid,source_row_ordinal integer,financial_employee_category_code text,financial_union_code text
  ) on x.affiliate_id=a.id and x.source_row_ordinal=a.source_row_ordinal;
  if not found then raise exception 'SEED_SNAPSHOT_FAILED' using errcode='P0001'; end if;

  update public.affiliates a set
    financial_union_code=x.financial_union_code,
    financial_employee_category_code=x.financial_employee_category_code,
    financial_profile_version=a.financial_profile_version+1,
    financial_profile_updated_at=v_now,
    financial_profile_updated_by=null,
    financial_profile_seed_source_hash=p_source_hash,
    financial_profile_seed_row_ordinal=a.source_row_ordinal,
    financial_profile_seeded_at=v_now,
    updated_at=v_now
  from jsonb_to_recordset(p_rows) as x(affiliate_id uuid,financial_employee_category_code text,financial_union_code text)
  where a.id=x.affiliate_id;
  if not found then raise exception 'SEED_UPDATE_FAILED' using errcode='P0001'; end if;

  insert into public.affiliate_profile_audit_log(affiliate_id,field_name,old_value,new_value,changed_by,reason,profile_version,batch_id,change_source,changed_at)
  select s.affiliate_id,'financial_employee_category_code',to_jsonb(s.old_financial_employee_category_code),to_jsonb(s.new_financial_employee_category_code),null,
    'BULK_INITIAL_FINANCIAL_PROFILE_SEED',s.seeded_profile_version,p_batch_id,'BULK_INITIAL_FINANCIAL_PROFILE_SEED',v_now
  from public.affiliate_financial_profile_seed_snapshot s where s.batch_id=p_batch_id and s.old_financial_employee_category_code is distinct from s.new_financial_employee_category_code;
  insert into public.affiliate_profile_audit_log(affiliate_id,field_name,old_value,new_value,changed_by,reason,profile_version,batch_id,change_source,changed_at)
  select s.affiliate_id,'financial_union_code',to_jsonb(s.old_financial_union_code),to_jsonb(s.new_financial_union_code),null,
    'BULK_INITIAL_FINANCIAL_PROFILE_SEED',s.seeded_profile_version,p_batch_id,'BULK_INITIAL_FINANCIAL_PROFILE_SEED',v_now
  from public.affiliate_financial_profile_seed_snapshot s where s.batch_id=p_batch_id and s.old_financial_union_code is distinct from s.new_financial_union_code;
  return v_result;
end $$;

create function public.recover_affiliate_financial_profile_seed(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_batch public.affiliate_financial_profile_seed_batches%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_batch from public.affiliate_financial_profile_seed_batches where id=p_batch_id for update;
  if v_batch.id is null then raise exception 'SEED_BATCH_NOT_FOUND' using errcode='P0001'; end if;
  if v_batch.status='RECOVERED' then return jsonb_build_object('batch_id',p_batch_id,'status','RECOVERED','idempotent',true); end if;
  if (select count(*) from public.affiliate_financial_profile_seed_snapshot where batch_id=p_batch_id)<>947 then raise exception 'RECOVERY_SNAPSHOT_INCOMPLETE' using errcode='P0001'; end if;
  if exists(
    select 1 from public.affiliate_financial_profile_seed_snapshot s join public.affiliates a on a.id=s.affiliate_id
    where s.batch_id=p_batch_id and (a.financial_profile_version<>s.seeded_profile_version
      or a.financial_union_code is distinct from s.new_financial_union_code
      or a.financial_employee_category_code is distinct from s.new_financial_employee_category_code
      or a.financial_profile_seed_source_hash<>v_batch.source_file_hash
      or a.financial_profile_seed_row_ordinal<>s.source_row_ordinal)
  ) then raise exception 'RECOVERY_BLOCKED_BY_LATER_PROFILE_CHANGE' using errcode='P0001'; end if;
  update public.affiliates a set
    financial_union_code=s.old_financial_union_code,financial_employee_category_code=s.old_financial_employee_category_code,
    financial_profile_version=s.old_financial_profile_version,financial_profile_updated_at=s.old_financial_profile_updated_at,
    financial_profile_updated_by=s.old_financial_profile_updated_by,financial_profile_seed_source_hash=s.old_seed_source_hash,
    financial_profile_seed_row_ordinal=s.old_seed_row_ordinal,financial_profile_seeded_at=s.old_seeded_at,updated_at=s.old_updated_at
  from public.affiliate_financial_profile_seed_snapshot s where s.batch_id=p_batch_id and a.id=s.affiliate_id;
  update public.affiliate_financial_profile_seed_batches set status='RECOVERED',recovered_at=v_now,
    result=result||jsonb_build_object('status','RECOVERED','recovered_at',v_now) where id=p_batch_id;
  return jsonb_build_object('batch_id',p_batch_id,'status','RECOVERED','affiliates_restored',947,'idempotent',false);
end $$;

do $$ declare t text; begin foreach t in array array['affiliate_financial_profile_seed_batches','affiliate_financial_profile_seed_snapshot'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
end loop; end $$;
grant select on public.affiliate_financial_profile_seed_batches,public.affiliate_financial_profile_seed_snapshot to authenticated;
create policy affiliate_financial_seed_batches_admin_read on public.affiliate_financial_profile_seed_batches for select to authenticated using(public.has_admin_permission('affiliates.read'));
create policy affiliate_financial_seed_snapshot_admin_read on public.affiliate_financial_profile_seed_snapshot for select to authenticated using(public.has_admin_permission('affiliates.read'));

grant execute on function public.bulk_seed_affiliate_financial_profiles(uuid,text,jsonb) to service_role;
grant execute on function public.recover_affiliate_financial_profile_seed(uuid) to service_role;
revoke execute on function public.bulk_seed_affiliate_financial_profiles(uuid,text,jsonb) from public,anon,authenticated;
revoke execute on function public.recover_affiliate_financial_profile_seed(uuid) from public,anon,authenticated;

notify pgrst, 'reload schema';
commit;
