begin;

-- H-FINANCIAL-SUPABASE-CUTOVER-001
-- Shadow-first authority cutover for the nine fields actually consumed by SutiApp:
-- A/B/C/D/E/F/H/N/P. Google is not modified by this migration.

create table public.financial_criteria_import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  source text not null check(source='GOOGLE_CRITERIA_DE_FONDOS'),
  source_snapshot_hash text not null unique check(source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  rule_count integer not null check(rule_count=146),
  fund_count integer not null check(fund_count>0),
  duplicate_group_count integer not null check(duplicate_group_count=2),
  conflict_group_count integer not null check(conflict_group_count=1),
  status text not null check(status in('STAGED','ACTIVE','ROLLED_BACK')),
  imported_at timestamptz not null default now(),
  activated_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object')
);

create table public.financial_criteria_authority (
  id text primary key check(id='primary'),
  authority text not null check(authority in('GOOGLE_SHADOW','SUPABASE')),
  active_import_batch_id uuid null references public.financial_criteria_import_batches(id),
  source_snapshot_hash text null check(source_snapshot_hash is null or source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  changed_at timestamptz not null default now(),
  changed_reason text not null check(length(btrim(changed_reason)) between 8 and 500),
  constraint financial_criteria_authority_batch_check check(
    (authority='GOOGLE_SHADOW' and active_import_batch_id is null)
    or (authority='SUPABASE' and active_import_batch_id is not null and source_snapshot_hash is not null)
  )
);
insert into public.financial_criteria_authority(id,authority,changed_reason)
values('primary','GOOGLE_SHADOW','Owner-authorized shadow import before equivalence gate');

create table public.financial_programs (
  id text primary key check(id ~ '^[a-z][a-z0-9_-]{1,49}$'),
  name text not null check(length(btrim(name)) between 2 and 120),
  description text not null default '' check(length(description)<=1000),
  enabled boolean not null default true,
  publication_status text not null default 'PUBLISHED' check(publication_status in('DRAFT','PUBLISHED','UNPUBLISHED')),
  sort_order integer not null default 0 check(sort_order between 0 and 10000),
  icon_asset_id uuid null references public.private_assets(id) on delete restrict,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

insert into public.financial_programs(id,name,description,sort_order) values
  ('prestamo','Suti Préstamo','Programa general de préstamos SutiApp.',10),
  ('caja','Caja de ahorro','Programa asociado al fondo legacy CAJA CHICA.',20),
  ('nomina','Financiamiento vía nómina','Programa asociado al fondo legacy SUTIEXPRESS.',30);

create table public.financial_funds (
  id uuid primary key default extensions.gen_random_uuid(),
  program_id text not null references public.financial_programs(id) on delete restrict,
  code text not null check(code ~ '^[a-z0-9][a-z0-9_-]{1,99}$'),
  name text not null check(length(btrim(name)) between 2 and 160),
  enabled boolean not null default true,
  publication_status text not null default 'PUBLISHED' check(publication_status in('DRAFT','PUBLISHED','UNPUBLISHED')),
  sort_order integer not null default 0 check(sort_order between 0 and 10000),
  version integer not null default 1 check(version>0),
  imported_batch_id uuid null references public.financial_criteria_import_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  unique(program_id,code),
  unique(program_id,name)
);

create table public.financial_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  lineage_id uuid not null default extensions.gen_random_uuid(),
  version integer not null default 1 check(version>0),
  supersedes_rule_id uuid null references public.financial_rules(id) on delete restrict,
  program_id text not null references public.financial_programs(id) on delete restrict,
  fund_id uuid not null references public.financial_funds(id) on delete restrict,
  financial_union_code text not null,
  financial_union_label text not null check(length(btrim(financial_union_label)) between 2 and 160),
  financial_employee_category_code text not null,
  financial_employee_category_label text not null check(length(btrim(financial_employee_category_label)) between 2 and 160),
  max_amount numeric(14,2) not null check(max_amount>0),
  raw_rate numeric(14,8) not null check(raw_rate>=0),
  rate_factor numeric(14,10) generated always as (case when raw_rate>1 then raw_rate/100 else raw_rate end) stored,
  rate_percent numeric(14,8) generated always as ((case when raw_rate>1 then raw_rate/100 else raw_rate end)*100) stored,
  term_label text not null check(length(btrim(term_label)) between 1 and 100),
  payment_count integer not null check(payment_count>0),
  max_term integer not null check(max_term>0),
  payment_period text not null default 'quincenal' check(payment_period='quincenal'),
  source_date_h text null,
  source_date_n text null,
  available_on date null,
  visibility_mode text not null default 'AUTO' check(visibility_mode in('AUTO','MOSTRAR','OCULTAR')),
  lifecycle_status text not null default 'DRAFT' check(lifecycle_status in('DRAFT','PUBLISHED','SCHEDULED','EXPIRED')),
  enabled boolean not null default true,
  legacy_sheet_row integer null check(legacy_sheet_row is null or legacy_sheet_row>=2),
  legacy_criterion_identity text null check(legacy_criterion_identity is null or legacy_criterion_identity ~ '^CRITERIA_V1:[0-9]+:[A-F0-9]{64}$'),
  source_snapshot_hash text null check(source_snapshot_hash is null or source_snapshot_hash ~ '^[A-F0-9]{64}$'),
  imported_batch_id uuid null references public.financial_criteria_import_batches(id) on delete restrict,
  review_required boolean not null default false,
  review_signals text[] not null default '{}'::text[] check(review_signals <@ array['DUPLICATE','CONFLICT']::text[]),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  published_at timestamptz null,
  published_by uuid null references auth.users(id) on delete set null,
  unique(lineage_id,version),
  unique(imported_batch_id,legacy_sheet_row),
  unique(imported_batch_id,legacy_criterion_identity),
  constraint financial_rule_program_fund_guard unique(id,program_id,fund_id)
);
create index financial_rules_runtime_idx on public.financial_rules(program_id,financial_union_code,financial_employee_category_code,lifecycle_status,enabled);
create index financial_rules_fund_idx on public.financial_rules(fund_id,lifecycle_status,version desc);
create index financial_rules_legacy_idx on public.financial_rules(legacy_sheet_row) where legacy_sheet_row is not null;
create unique index financial_rules_one_live_version_idx on public.financial_rules(lineage_id)
where lifecycle_status in('PUBLISHED','SCHEDULED');

create function public.enforce_financial_rule_program_fund()
returns trigger language plpgsql set search_path=''
as $$ begin
  if not exists(select 1 from public.financial_funds f where f.id=new.fund_id and f.program_id=new.program_id) then
    raise exception 'FINANCIAL_FUND_PROGRAM_MISMATCH' using errcode='23514';
  end if;
  return new;
end $$;
create trigger financial_rules_01_program_fund before insert or update of program_id,fund_id on public.financial_rules
for each row execute function public.enforce_financial_rule_program_fund();

create table public.financial_configuration_audit (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_auth_user_id uuid null references auth.users(id) on delete set null,
  resource_type text not null check(resource_type in('AUTHORITY','PROGRAM','FUND','RULE','IMPORT')),
  resource_id text not null,
  action text not null,
  old_value jsonb null check(old_value is null or jsonb_typeof(old_value)='object'),
  new_value jsonb null check(new_value is null or jsonb_typeof(new_value)='object'),
  reason text not null check(length(btrim(reason)) between 8 and 500),
  created_at timestamptz not null default now()
);
create index financial_configuration_audit_resource_idx on public.financial_configuration_audit(resource_type,resource_id,created_at desc);
create index financial_configuration_audit_actor_idx on public.financial_configuration_audit(actor_auth_user_id,created_at desc);

do $$
declare v_table text;
begin
  foreach v_table in array array['financial_criteria_import_batches','financial_criteria_authority','financial_programs','financial_funds','financial_rules','financial_configuration_audit'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('alter table public.%I force row level security',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated',v_table);
    execute format('grant select,insert,update,delete on public.%I to service_role',v_table);
  end loop;
end $$;

-- Transactional shadow importer. It accepts only the certified 146-row contract;
-- no legacy auxiliary columns become product authority.
create function public.stage_financial_criteria_import(p_rules jsonb,p_source_snapshot_hash text)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_batch uuid;
  v_rule_count integer;
  v_fund_count integer;
  v_duplicates integer;
  v_conflicts integer;
begin
  if current_user<>'postgres' and coalesce(auth.role(),'')<>'service_role' then raise exception 'IMPORT_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules)<>146 or coalesce(p_source_snapshot_hash,'')!~'^[A-F0-9]{64}$' then
    raise exception 'FINANCIAL_IMPORT_CONTRACT_INVALID' using errcode='22023';
  end if;
  if (select authority from public.financial_criteria_authority where id='primary')<>'GOOGLE_SHADOW' then
    raise exception 'FINANCIAL_AUTHORITY_ALREADY_CUT_OVER' using errcode='P0001';
  end if;
  insert into public.financial_criteria_import_batches(source,source_snapshot_hash,rule_count,fund_count,duplicate_group_count,conflict_group_count,status,metadata)
  values('GOOGLE_CRITERIA_DE_FONDOS',upper(p_source_snapshot_hash),146,1,2,1,'STAGED',jsonb_build_object('columns',jsonb_build_array('A','B','C','D','E','F','H','N','P'),'excluded_columns',jsonb_build_array('G','I','J','K','L','M','O')))
  returning id into v_batch;

  insert into public.financial_funds(program_id,code,name,sort_order,imported_batch_id)
  select x.program_id,x.fund_code,x.fund,min(x.fund_order),v_batch
  from jsonb_to_recordset(p_rules) as x(program_id text,fund_code text,fund text,fund_order integer)
  group by x.program_id,x.fund_code,x.fund
  on conflict(program_id,code) do update set name=excluded.name,sort_order=excluded.sort_order,imported_batch_id=excluded.imported_batch_id,updated_at=now();

  insert into public.financial_rules(
    lineage_id,program_id,fund_id,financial_union_code,financial_union_label,
    financial_employee_category_code,financial_employee_category_label,max_amount,raw_rate,
    term_label,payment_count,max_term,source_date_h,source_date_n,available_on,visibility_mode,
    lifecycle_status,legacy_sheet_row,legacy_criterion_identity,source_snapshot_hash,imported_batch_id,
    review_required,review_signals,published_at
  )
  select extensions.gen_random_uuid(),x.program_id,f.id,x.union_code,x.union_label,x.category_code,x.category_label,
    x.max_amount,x.raw_rate,x.term_label,x.payment_count,x.max_term,nullif(x.source_date_h,''),nullif(x.source_date_n,''),x.available_on,
    x.visibility_mode,'PUBLISHED',x.legacy_sheet_row,x.legacy_criterion_identity,upper(x.source_snapshot_hash),v_batch,
    coalesce(cardinality(x.review_signals),0)>0,coalesce(x.review_signals,'{}'::text[]),now()
  from jsonb_to_recordset(p_rules) as x(
    program_id text,fund_code text,union_code text,union_label text,category_code text,category_label text,
    max_amount numeric,raw_rate numeric,term_label text,payment_count integer,max_term integer,
    source_date_h text,source_date_n text,available_on date,visibility_mode text,legacy_sheet_row integer,
    legacy_criterion_identity text,source_snapshot_hash text,review_signals text[]
  )
  join public.financial_funds f on f.program_id=x.program_id and f.code=x.fund_code;

  select count(*),count(distinct fund_id) into v_rule_count,v_fund_count from public.financial_rules where imported_batch_id=v_batch;
  select count(*) into v_duplicates from (
    select 1 from public.financial_rules r where r.imported_batch_id=v_batch
    group by r.program_id,r.fund_id,public.normalize_suti_financial_key(r.financial_union_label),
      public.normalize_suti_financial_key(r.financial_employee_category_label),r.max_amount,r.rate_percent,r.term_label,
      r.payment_count,r.available_on,r.visibility_mode having count(*)>1
  ) groups;
  select count(*) into v_conflicts from (
    select 1 from public.financial_rules r where r.imported_batch_id=v_batch
    group by r.program_id,r.fund_id,public.normalize_suti_financial_key(r.financial_union_label),
      public.normalize_suti_financial_key(r.financial_employee_category_label),r.available_on
    having count(distinct concat_ws('|',r.max_amount,r.rate_percent,r.term_label,r.payment_count,r.visibility_mode))>1
  ) groups;
  if v_rule_count<>146 or v_fund_count<>35 or v_duplicates<>2 or v_conflicts<>1 then
    raise exception 'FINANCIAL_IMPORT_EQUIVALENCE_FAILED rules=% funds=% duplicates=% conflicts=%',v_rule_count,v_fund_count,v_duplicates,v_conflicts using errcode='P0001';
  end if;
  update public.financial_criteria_import_batches set fund_count=v_fund_count where id=v_batch;
  insert into public.financial_configuration_audit(resource_type,resource_id,action,new_value,reason)
  values('IMPORT',v_batch::text,'STAGE',jsonb_build_object('rules',v_rule_count,'funds',v_fund_count,'duplicates',v_duplicates,'conflicts',v_conflicts,'source_snapshot_hash',upper(p_source_snapshot_hash)),'Certified shadow import of consumed Google criteria fields');
  return jsonb_build_object('batch_id',v_batch,'rules',v_rule_count,'funds',v_fund_count,'duplicates',v_duplicates,'conflicts',v_conflicts,'source_snapshot_hash',upper(p_source_snapshot_hash));
end $$;

create function public.get_financial_runtime_rules()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_authority public.financial_criteria_authority%rowtype; v_result jsonb;
begin
  if current_user<>'postgres' and coalesce(auth.role(),'')<>'service_role' then raise exception 'FINANCIAL_RUNTIME_RULES_DENIED' using errcode='42501'; end if;
  select * into v_authority from public.financial_criteria_authority where id='primary';
  if v_authority.authority<>'SUPABASE' or v_authority.active_import_batch_id is null then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.program_id||'--'||f.code||'--r'||coalesce(r.legacy_sheet_row,r.version),
    'rule_id',r.id,'program_id',r.program_id,'fund',f.name,'category',r.financial_employee_category_label,
    'union',r.financial_union_label,'financial_union_code',r.financial_union_code,
    'financial_employee_category_code',r.financial_employee_category_code,
    'max_amount',r.max_amount,'rate_factor',r.rate_factor,'rate',r.rate_percent,
    'payment_count',r.payment_count,'payment_period',r.payment_period,'max_term',r.max_term,'term_label',r.term_label,
    'available_on',r.available_on,'criterion_identity',coalesce(r.legacy_criterion_identity,'SUPABASE_RULE:'||r.id::text),
    'sheet_row',r.legacy_sheet_row,'visibility_mode',r.visibility_mode,'lifecycle_status',r.lifecycle_status,
    'source_snapshot_hash',r.source_snapshot_hash,'review_required',r.review_required,'review_signals',r.review_signals
  ) order by r.legacy_sheet_row nulls last,r.created_at,r.id),'[]'::jsonb) into v_result
  from public.financial_rules r join public.financial_funds f on f.id=r.fund_id
  join public.financial_programs p on p.id=r.program_id
  where r.imported_batch_id=v_authority.active_import_batch_id and r.lifecycle_status in('PUBLISHED','SCHEDULED')
    and r.enabled and f.enabled and f.publication_status='PUBLISHED' and p.enabled and p.publication_status='PUBLISHED';
  if jsonb_array_length(v_result)<1 then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
  return v_result;
end $$;

create function public.activate_financial_criteria_import(p_batch_id uuid,p_source_snapshot_hash text,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$ declare v_batch public.financial_criteria_import_batches%rowtype;
begin
  if current_user<>'postgres' and coalesce(auth.role(),'')<>'service_role' then raise exception 'CUTOVER_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'CUTOVER_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_batch from public.financial_criteria_import_batches where id=p_batch_id for update;
  if v_batch.id is null or v_batch.status<>'STAGED' or v_batch.source_snapshot_hash<>upper(p_source_snapshot_hash)
     or v_batch.rule_count<>146 or v_batch.fund_count<>35 or v_batch.duplicate_group_count<>2 or v_batch.conflict_group_count<>1 then
    raise exception 'CUTOVER_EQUIVALENCE_EVIDENCE_INVALID' using errcode='P0001';
  end if;
  update public.financial_criteria_import_batches set status='ACTIVE',activated_at=now() where id=v_batch.id;
  update public.financial_criteria_authority set authority='SUPABASE',active_import_batch_id=v_batch.id,
    source_snapshot_hash=v_batch.source_snapshot_hash,changed_at=now(),changed_reason=btrim(p_reason) where id='primary';
  update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_AUTHORITY_CUTOVER'
  where invalidated_at is null;
  insert into public.financial_configuration_audit(resource_type,resource_id,action,new_value,reason)
  values('AUTHORITY','primary','CUTOVER',jsonb_build_object('authority','SUPABASE','batch_id',v_batch.id,'source_snapshot_hash',v_batch.source_snapshot_hash),btrim(p_reason));
  return jsonb_build_object('authority','SUPABASE','batch_id',v_batch.id,'source_snapshot_hash',v_batch.source_snapshot_hash,'rules',v_batch.rule_count,'funds',v_batch.fund_count);
end $$;

-- Keep the certified mathematical engine; wrap it only to change the authority marker.
alter function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)
rename to resolve_suti_loan_quote_contract_v1_engine;
revoke all on function public.resolve_suti_loan_quote_contract_v1_engine(jsonb,text,text,text,numeric,integer,jsonb) from public,anon,authenticated,service_role;
create function public.resolve_suti_loan_quote_contract(
  p_eligible_rules jsonb,p_financial_union text,p_financial_employee_category text,p_program_id text,
  p_amount numeric,p_term integer,p_policy jsonb
) returns jsonb language sql stable security definer set search_path=''
as $$
  select public.resolve_suti_loan_quote_contract_v1_engine($1,$2,$3,$4,$5,$6,$7)
    || jsonb_build_object('source','SUPABASE_FINANCIAL_CRITERIA')
$$;
revoke all on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) to service_role;

-- Preserve the certified atomic request writer and replace only its authority
-- provenance marker inside the same database transaction.
alter function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
rename to create_validated_financial_program_request_v1_engine;
revoke all on function public.create_validated_financial_program_request_v1_engine(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) from public,anon,authenticated,service_role;
create function public.create_validated_financial_program_request(
  p_actor_real_auth_user_id uuid,p_affiliate_id uuid,p_impersonation_session_id uuid,p_program_item_id uuid,
  p_notes text,p_signature_data text,p_terms_version_id uuid,p_document_ids uuid[],p_idempotency_key uuid,
  p_amount numeric,p_term integer,p_term_semantics text,p_expected_profile_version integer,p_financial_submission_snapshot jsonb
) returns public.program_requests language plpgsql volatile security definer set search_path=''
as $$ declare v_row public.program_requests;
begin
  v_row:=public.create_validated_financial_program_request_v1_engine($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14);
  update public.program_requests set source_context=coalesce(source_context,'{}'::jsonb)
    || jsonb_build_object('financial_confirmation','SUPABASE_REVALIDATED','financial_criteria_source','SUPABASE')
  where id=v_row.id returning * into v_row;
  return v_row;
end $$;
revoke all on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) to service_role;

-- Admin permissions are capabilities, never UI-only authorization.
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check(permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read'
]::text[]);
insert into public.admin_role_permissions(role_id,permission)
select id,permission from public.admin_roles cross join unnest(array[
  'financial_programs.read','financial_programs.write','financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write'
]::text[]) permission where code='principal_admin' on conflict do nothing;
update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=a.role_id),updated_at=now() where a.enabled;

create or replace function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_allowed text[]:=array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read'];
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
  insert into public.admin_role_permissions(role_id,permission) select v_id,p from(select distinct unnest(p_permissions) p) q;
  update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=v_id),updated_at=now() where role_id=v_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'admin_roles',case when p_role_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS');
  return v_id;
end $$;

create function public.set_financial_rule_visibility(p_criterion_identity text,p_visibility_mode text,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$ declare v_old public.financial_rules%rowtype; v_new public.financial_rules%rowtype;
begin
  if not public.has_admin_permission('financial_criteria.visibility.write') then raise exception 'VISIBILITY_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_visibility_mode not in('AUTO','MOSTRAR','OCULTAR') or length(btrim(coalesce(p_reason,'')))<8 then raise exception 'VISIBILITY_CHANGE_INVALID' using errcode='22023'; end if;
  select r.* into v_old from public.financial_rules r join public.financial_criteria_authority a on a.id='primary' and a.authority='SUPABASE' and a.active_import_batch_id=r.imported_batch_id
  where r.legacy_criterion_identity=p_criterion_identity and r.lifecycle_status in('PUBLISHED','SCHEDULED') for update of r;
  if v_old.id is null then raise exception 'CRITERION_FINGERPRINT_MISMATCH' using errcode='P0001'; end if;
  update public.financial_rules set visibility_mode=p_visibility_mode where id=v_old.id returning * into v_new;
  update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_VISIBILITY_CHANGED' where invalidated_at is null;
  insert into public.financial_configuration_audit(actor_auth_user_id,resource_type,resource_id,action,old_value,new_value,reason)
  values(auth.uid(),'RULE',v_old.id::text,'VISIBILITY_CHANGE',jsonb_build_object('visibility_mode',v_old.visibility_mode),jsonb_build_object('visibility_mode',v_new.visibility_mode),btrim(p_reason));
  return jsonb_build_object('criterion_identity',v_new.legacy_criterion_identity,'sheet_row',v_new.legacy_sheet_row,
    'previous_visibility',v_old.visibility_mode,'visibility_mode',v_new.visibility_mode,'changed_at',now(),'source','SUPABASE_FINANCIAL_CRITERIA');
end $$;

create function public.get_financial_admin_catalog()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_result jsonb;
begin
  if not(public.has_admin_permission('financial_programs.read') or public.has_admin_permission('financial_rules.read') or public.has_admin_permission('financial_criteria.visibility.read')) then
    raise exception 'ADMIN_READ_REQUIRED' using errcode='42501';
  end if;
  select jsonb_build_object(
    'authority',(select authority from public.financial_criteria_authority where id='primary'),
    'programs',(select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order,p.name),'[]'::jsonb) from public.financial_programs p),
    'funds',(select coalesce(jsonb_agg(to_jsonb(f) order by f.program_id,f.sort_order,f.name),'[]'::jsonb) from public.financial_funds f),
    'rules',(select coalesce(jsonb_agg(to_jsonb(r) order by r.legacy_sheet_row nulls last,r.created_at),'[]'::jsonb) from public.financial_rules r
      where r.lifecycle_status in('DRAFT','PUBLISHED','SCHEDULED') and (r.imported_batch_id is null or r.imported_batch_id=(select active_import_batch_id from public.financial_criteria_authority where id='primary')))
  ) into v_result;
  return v_result;
end $$;

create function public.preview_financial_rule_impact(p_rule_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_rule public.financial_rules%rowtype; v_count integer;
begin
  if not public.has_admin_permission('financial_rules.read') then raise exception 'FINANCIAL_RULES_READ_REQUIRED' using errcode='42501'; end if;
  select * into v_rule from public.financial_rules where id=p_rule_id;
  if v_rule.id is null then raise exception 'FINANCIAL_RULE_NOT_FOUND' using errcode='P0001'; end if;
  select count(*) into v_count from public.affiliates where financial_union_code=v_rule.financial_union_code and financial_employee_category_code=v_rule.financial_employee_category_code;
  return jsonb_build_object('rule_id',v_rule.id,'matching_affiliates',v_count,'source','SUPABASE_AFFILIATES');
end $$;

create function public.save_financial_program(
  p_id text,p_name text,p_description text,p_enabled boolean,p_publication_status text,p_sort_order integer,
  p_reason text,p_confirmation text
) returns jsonb language plpgsql volatile security definer set search_path=''
as $$ declare v_old public.financial_programs%rowtype; v_new public.financial_programs%rowtype;
begin
  if not public.has_admin_permission('financial_programs.write') then raise exception 'FINANCIAL_PROGRAMS_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_confirmation<>'CONFIRMAR' or length(btrim(coalesce(p_reason,'')))<8 or coalesce(p_id,'')!~'^[a-z][a-z0-9_-]{1,49}$'
     or length(btrim(coalesce(p_name,'')))<2 or p_publication_status not in('DRAFT','PUBLISHED','UNPUBLISHED') or p_sort_order not between 0 and 10000 then
    raise exception 'FINANCIAL_PROGRAM_CHANGE_INVALID' using errcode='22023';
  end if;
  select * into v_old from public.financial_programs where id=p_id for update;
  insert into public.financial_programs(id,name,description,enabled,publication_status,sort_order,updated_by)
  values(p_id,btrim(p_name),coalesce(p_description,''),p_enabled,p_publication_status,p_sort_order,auth.uid())
  on conflict(id) do update set name=excluded.name,description=excluded.description,enabled=excluded.enabled,
    publication_status=excluded.publication_status,sort_order=excluded.sort_order,version=public.financial_programs.version+1,
    updated_at=now(),updated_by=auth.uid() returning * into v_new;
  insert into public.financial_configuration_audit(actor_auth_user_id,resource_type,resource_id,action,old_value,new_value,reason)
  values(auth.uid(),'PROGRAM',v_new.id,case when v_old.id is null then 'CREATE' else 'UPDATE' end,
    case when v_old.id is null then null else to_jsonb(v_old) end,to_jsonb(v_new),btrim(p_reason));
  update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_PROGRAM_CHANGED' where invalidated_at is null;
  return to_jsonb(v_new);
end $$;

create function public.save_financial_fund(
  p_id uuid,p_program_id text,p_code text,p_name text,p_enabled boolean,p_publication_status text,p_sort_order integer,
  p_reason text,p_confirmation text
) returns jsonb language plpgsql volatile security definer set search_path=''
as $$ declare v_old public.financial_funds%rowtype; v_new public.financial_funds%rowtype; v_batch uuid;
begin
  if not public.has_admin_permission('financial_programs.write') then raise exception 'FINANCIAL_PROGRAMS_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_confirmation<>'CONFIRMAR' or length(btrim(coalesce(p_reason,'')))<8 or coalesce(p_code,'')!~'^[a-z0-9][a-z0-9_-]{1,99}$'
     or length(btrim(coalesce(p_name,'')))<2 or p_publication_status not in('DRAFT','PUBLISHED','UNPUBLISHED') or p_sort_order not between 0 and 10000
     or not exists(select 1 from public.financial_programs where id=p_program_id) then
    raise exception 'FINANCIAL_FUND_CHANGE_INVALID' using errcode='22023';
  end if;
  select active_import_batch_id into v_batch from public.financial_criteria_authority where id='primary' and authority='SUPABASE';
  if v_batch is null then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
  if p_id is not null then select * into v_old from public.financial_funds where id=p_id for update; end if;
  if p_id is not null and v_old.id is null then raise exception 'FINANCIAL_FUND_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.id is not null and v_old.program_id<>p_program_id and exists(select 1 from public.financial_rules where fund_id=v_old.id) then
    raise exception 'FINANCIAL_FUND_REASSOCIATION_BLOCKED' using errcode='P0001';
  end if;
  if p_id is null then
    insert into public.financial_funds(program_id,code,name,enabled,publication_status,sort_order,imported_batch_id,updated_by)
    values(p_program_id,p_code,btrim(p_name),p_enabled,p_publication_status,p_sort_order,v_batch,auth.uid()) returning * into v_new;
  else
    update public.financial_funds set program_id=p_program_id,code=p_code,name=btrim(p_name),enabled=p_enabled,
      publication_status=p_publication_status,sort_order=p_sort_order,version=version+1,updated_at=now(),updated_by=auth.uid()
    where id=p_id returning * into v_new;
  end if;
  insert into public.financial_configuration_audit(actor_auth_user_id,resource_type,resource_id,action,old_value,new_value,reason)
  values(auth.uid(),'FUND',v_new.id::text,case when v_old.id is null then 'CREATE' else 'UPDATE' end,
    case when v_old.id is null then null else to_jsonb(v_old) end,to_jsonb(v_new),btrim(p_reason));
  update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_FUND_CHANGED' where invalidated_at is null;
  return to_jsonb(v_new);
end $$;

create function public.save_financial_rule_draft(
  p_existing_rule_id uuid,p_fund_id uuid,p_union_code text,p_category_code text,p_max_amount numeric,p_raw_rate numeric,
  p_term_label text,p_payment_count integer,p_max_term integer,p_available_on date,p_visibility_mode text,
  p_reason text,p_confirmation text
) returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare v_old public.financial_rules%rowtype; v_new public.financial_rules%rowtype; v_fund public.financial_funds%rowtype;
  v_union_label text; v_category_label text; v_lineage uuid; v_version integer; v_batch uuid;
begin
  if not public.has_admin_permission('financial_rules.write') then raise exception 'FINANCIAL_RULES_WRITE_REQUIRED' using errcode='42501'; end if;
  if not public.has_admin_permission('financial_rates.write') then raise exception 'FINANCIAL_RATES_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_confirmation<>'CONFIRMAR' or length(btrim(coalesce(p_reason,'')))<8 or p_max_amount<=0 or p_raw_rate<0
     or p_payment_count<=0 or p_max_term<=0 or length(btrim(coalesce(p_term_label,'')))<1
     or p_visibility_mode not in('AUTO','MOSTRAR','OCULTAR') then raise exception 'FINANCIAL_RULE_CHANGE_INVALID' using errcode='22023'; end if;
  select * into v_fund from public.financial_funds where id=p_fund_id and enabled;
  if v_fund.id is null then raise exception 'FINANCIAL_FUND_NOT_FOUND' using errcode='P0001'; end if;
  select label into v_union_label from public.segmentation_catalog_entries where catalog_type='union' and code=p_union_code and enabled;
  select label into v_category_label from public.segmentation_catalog_entries where catalog_type='employment_category' and code=p_category_code and enabled;
  if v_union_label is null or v_category_label is null then raise exception 'FINANCIAL_SEGMENTATION_INVALID' using errcode='22023'; end if;
  select active_import_batch_id into v_batch from public.financial_criteria_authority where id='primary' and authority='SUPABASE';
  if v_batch is null then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
  if p_existing_rule_id is not null then
    select * into v_old from public.financial_rules where id=p_existing_rule_id;
    if v_old.id is null then raise exception 'FINANCIAL_RULE_NOT_FOUND' using errcode='P0001'; end if;
    v_lineage:=v_old.lineage_id; select coalesce(max(version),0)+1 into v_version from public.financial_rules where lineage_id=v_lineage;
  else v_lineage:=extensions.gen_random_uuid();v_version:=1; end if;
  insert into public.financial_rules(lineage_id,version,supersedes_rule_id,program_id,fund_id,financial_union_code,financial_union_label,
    financial_employee_category_code,financial_employee_category_label,max_amount,raw_rate,term_label,payment_count,max_term,
    available_on,visibility_mode,lifecycle_status,imported_batch_id,created_by)
  values(v_lineage,v_version,v_old.id,v_fund.program_id,v_fund.id,p_union_code,v_union_label,p_category_code,v_category_label,
    p_max_amount,p_raw_rate,btrim(p_term_label),p_payment_count,p_max_term,p_available_on,p_visibility_mode,'DRAFT',v_batch,auth.uid()) returning * into v_new;
  insert into public.financial_configuration_audit(actor_auth_user_id,resource_type,resource_id,action,old_value,new_value,reason)
  values(auth.uid(),'RULE',v_new.id::text,'DRAFT_CREATE',case when v_old.id is null then null else to_jsonb(v_old) end,to_jsonb(v_new),btrim(p_reason));
  return to_jsonb(v_new);
end $$;

create function public.publish_financial_rule(p_rule_id uuid,p_reason text,p_confirmation text)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$ declare v_draft public.financial_rules%rowtype; v_previous jsonb; v_published public.financial_rules%rowtype;
begin
  if not public.has_admin_permission('financial_rules.publish') then raise exception 'FINANCIAL_RULES_PUBLISH_REQUIRED' using errcode='42501'; end if;
  if p_confirmation<>'PUBLICAR' or length(btrim(coalesce(p_reason,'')))<8 then raise exception 'FINANCIAL_RULE_PUBLISH_INVALID' using errcode='22023'; end if;
  select * into v_draft from public.financial_rules where id=p_rule_id and lifecycle_status='DRAFT' for update;
  if v_draft.id is null then raise exception 'FINANCIAL_RULE_DRAFT_NOT_FOUND' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into v_previous from public.financial_rules r
    where r.lineage_id=v_draft.lineage_id and r.lifecycle_status in('PUBLISHED','SCHEDULED');
  update public.financial_rules set lifecycle_status='EXPIRED' where lineage_id=v_draft.lineage_id and lifecycle_status in('PUBLISHED','SCHEDULED');
  update public.financial_rules set lifecycle_status=case when available_on is not null and available_on>current_date then 'SCHEDULED' else 'PUBLISHED' end,
    published_at=now(),published_by=auth.uid() where id=v_draft.id returning * into v_published;
  update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_RULE_PUBLISHED' where invalidated_at is null;
  insert into public.financial_configuration_audit(actor_auth_user_id,resource_type,resource_id,action,old_value,new_value,reason)
  values(auth.uid(),'RULE',v_published.id::text,'PUBLISH',jsonb_build_object('previous_live_versions',v_previous),to_jsonb(v_published),btrim(p_reason));
  return to_jsonb(v_published);
end $$;

revoke all on function public.stage_financial_criteria_import(jsonb,text) from public,anon,authenticated;
grant execute on function public.stage_financial_criteria_import(jsonb,text) to service_role;
revoke all on function public.get_financial_runtime_rules() from public,anon,authenticated;
grant execute on function public.get_financial_runtime_rules() to service_role;
revoke all on function public.activate_financial_criteria_import(uuid,text,text) from public,anon,authenticated;
grant execute on function public.activate_financial_criteria_import(uuid,text,text) to service_role;
revoke all on function public.set_financial_rule_visibility(text,text,text) from public,anon;
grant execute on function public.set_financial_rule_visibility(text,text,text) to authenticated;
revoke all on function public.get_financial_admin_catalog() from public,anon;
grant execute on function public.get_financial_admin_catalog() to authenticated;
revoke all on function public.preview_financial_rule_impact(uuid) from public,anon;
grant execute on function public.preview_financial_rule_impact(uuid) to authenticated;
revoke all on function public.save_financial_program(text,text,text,boolean,text,integer,text,text) from public,anon;
grant execute on function public.save_financial_program(text,text,text,boolean,text,integer,text,text) to authenticated;
revoke all on function public.save_financial_fund(uuid,text,text,text,boolean,text,integer,text,text) from public,anon;
grant execute on function public.save_financial_fund(uuid,text,text,text,boolean,text,integer,text,text) to authenticated;
revoke all on function public.save_financial_rule_draft(uuid,uuid,text,text,numeric,numeric,text,integer,integer,date,text,text,text) from public,anon;
grant execute on function public.save_financial_rule_draft(uuid,uuid,text,text,numeric,numeric,text,integer,integer,date,text,text,text) to authenticated;
revoke all on function public.publish_financial_rule(uuid,text,text) from public,anon;
grant execute on function public.publish_financial_rule(uuid,text,text) to authenticated;

comment on table public.financial_programs is 'Supabase authority for SutiApp financial programs after the explicit cutover marker is activated.';
comment on table public.financial_funds is 'Funds explicitly owned by one financial program; no permanent inference from fund names.';
comment on table public.financial_rules is 'Version-ready financial criteria using only certified source columns A/B/C/D/E/F/H/N/P plus Supabase governance metadata.';
comment on column public.financial_rules.source_date_h is 'Legacy H fallback provenance; never a formula or independent authority.';
comment on column public.financial_rules.source_date_n is 'Legacy N primary-date provenance.';
comment on table public.financial_session_snapshots is 'Derived, personalized, server-generated Suti Prestamo cache over Supabase-authoritative rules; never a financial authority.';
comment on column public.financial_session_snapshots.eligible_rules is 'Only Supabase-authoritative rules matched to the effective affiliate before cache persistence.';
comment on column public.program_requests.financial_submission_snapshot is 'Immutable request-time contract recalculated from current Supabase-authoritative financial rules.';
comment on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) is 'Atomic certified request writer with SUPABASE_REVALIDATED financial authority provenance.';
comment on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) is 'Single certified SUTI_LOAN_QUOTE_V1 calculator; source marker is SUPABASE_FINANCIAL_CRITERIA and math remains the certified V1 engine.';

notify pgrst,'reload schema';
commit;
