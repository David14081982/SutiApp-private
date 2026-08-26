begin;

-- Canonical document catalog. Historical affiliate_files remain immutable provenance;
-- this layer adds workflow semantics and may point at an existing historical relation.
create table public.document_types (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text not null default '',
  icon text not null default 'doc',
  required_by_default boolean not null default false,
  accepted_mime_types text[] not null default array['image/jpeg','image/png','image/webp','application/pdf'],
  enabled boolean not null default true,
  sort_order integer not null,
  system_type boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_types_code_check check(code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint document_types_label_check check(length(btrim(label)) between 1 and 100),
  constraint document_types_order_check check(sort_order > 0),
  constraint document_types_mimes_check check(cardinality(accepted_mime_types) between 1 and 20)
);

insert into public.document_types(code,label,description,icon,required_by_default,sort_order,system_type) values
('membership_form','Hoja de Afiliación','Documento de afiliación firmado.','doc',true,1,true),
('ine_front','INE FRENTE','Identificación oficial, lado frontal.','idcard',true,2,true),
('ine_back','INE REVERSO','Identificación oficial, lado reverso.','idcard',true,3,true),
('tribunal_form','Hoja Tribunal','Hoja emitida para validación del Tribunal.','doc',true,4,true),
('payroll_latest','TALON ULTIMA QUINCENA','Talón correspondiente a la última quincena.','receipt',true,5,true),
('payroll_previous','TALON PENULTIMA QUINCENA','Talón correspondiente a la penúltima quincena.','receipt',true,6,true),
('profile_photo','Photo','Fotografía vigente del afiliado.','camera',true,7,true),
('affiliate_credential','Credencial Afiliado','Credencial vigente del afiliado.','idcard',true,8,true),
('guarantor_photo','Foto del aval','Fotografía vigente del aval.','camera',false,9,true),
('guarantor_ine_front','INE frente del aval','Identificación frontal del aval.','idcard',false,10,true),
('guarantor_ine_back','INE reverso del aval','Identificación reversa del aval.','idcard',false,11,true),
('guarantor_payroll_latest','Último talón del aval','Talón más reciente del aval.','receipt',false,12,true);

create table public.affiliate_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  affiliate_file_id uuid null references public.affiliate_files(id) on delete restrict,
  private_asset_id uuid null references public.private_assets(id) on delete restrict,
  status text not null default 'PENDING_REVIEW',
  review_observation text null,
  reviewed_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  created_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_documents_asset_check check((affiliate_file_id is null) <> (private_asset_id is null)),
  constraint affiliate_documents_status_check check(status in ('PENDING_REVIEW','UNDER_REVIEW','VERIFIED','REJECTED','REUPLOAD_REQUIRED')),
  constraint affiliate_documents_review_check check(
    (status='VERIFIED' and affiliate_file_id is not null and created_by_auth_user_id is null)
    or (status in ('PENDING_REVIEW','UNDER_REVIEW') and reviewed_by_auth_user_id is null and reviewed_at is null)
    or (status in ('VERIFIED','REJECTED','REUPLOAD_REQUIRED') and reviewed_by_auth_user_id is not null and reviewed_at is not null)
  )
);
create unique index affiliate_documents_current_type_idx on public.affiliate_documents(affiliate_id,document_type_id)
where status in ('PENDING_REVIEW','UNDER_REVIEW','VERIFIED','REUPLOAD_REQUIRED');
create index affiliate_documents_review_idx on public.affiliate_documents(status,created_at);

-- Reuse historical relations without copying or uploading a physical object.
with mapped as (
  select af.*,case lower(af.file_key)
  when 'profile_photo' then 'profile_photo'
  when 'ine_front' then 'ine_front'
  when 'ine_back' then 'ine_back'
  when 'payroll_receipt' then 'payroll_latest'
  when 'payroll_receipt_latest' then 'payroll_latest'
  when 'membership_form' then 'membership_form'
  when 'tribunal_form' then 'tribunal_form'
  when 'credential' then 'affiliate_credential'
  else null end as type_code,
  row_number() over(partition by af.affiliate_id,case lower(af.file_key)
    when 'profile_photo' then 'profile_photo' when 'ine_front' then 'ine_front' when 'ine_back' then 'ine_back'
    when 'payroll_receipt' then 'payroll_latest' when 'payroll_receipt_latest' then 'payroll_latest'
    when 'membership_form' then 'membership_form' when 'tribunal_form' then 'tribunal_form' when 'credential' then 'affiliate_credential' else null end
    order by af.sort_order,af.url_order,af.created_at,af.id) as rn
  from public.affiliate_files af where af.status='READY'
)
insert into public.affiliate_documents(affiliate_id,document_type_id,affiliate_file_id,status,created_at,updated_at)
select af.affiliate_id,dt.id,af.id,'VERIFIED',af.created_at,af.updated_at
from mapped af join public.document_types dt on dt.code=af.type_code
where af.rn=1
on conflict do nothing;

create table public.program_document_requirements (
  id uuid primary key default extensions.gen_random_uuid(),
  program_id text not null,
  membership_offering_id uuid null references public.membership_offerings(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  required boolean not null default true,
  allow_verified_reuse boolean not null default true,
  sort_order integer not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_document_requirements_program_check check(length(btrim(program_id)) between 1 and 80),
  constraint program_document_requirements_order_check check(sort_order > 0),
  constraint program_document_requirements_scope_check check((program_id='membership')=(membership_offering_id is not null)),
  unique(program_id,membership_offering_id,document_type_id)
);
create unique index program_document_requirements_scope_idx on public.program_document_requirements(program_id,coalesce(membership_offering_id,'00000000-0000-0000-0000-000000000000'::uuid),document_type_id);

-- Membership requirements are explicit per offering, never inferred in the UI.
insert into public.program_document_requirements(program_id,membership_offering_id,document_type_id,required,sort_order)
select 'membership',m.id,d.id,true,x.ord
from public.membership_offerings m
cross join (values('profile_photo',1),('ine_front',2),('ine_back',3),('payroll_latest',4)) x(code,ord)
join public.document_types d on d.code=x.code;

insert into public.program_document_requirements(program_id,document_type_id,required,sort_order)
select 'prestamo',d.id,true,x.ord from (values
('profile_photo',1),('ine_front',2),('ine_back',3),('payroll_latest',4),('payroll_previous',5)
) x(code,ord) join public.document_types d on d.code=x.code;

create table public.request_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null references public.program_requests(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  affiliate_document_id uuid not null references public.affiliate_documents(id) on delete restrict,
  private_asset_id uuid not null references public.private_assets(id) on delete restrict,
  asset_sha256 text not null,
  status_at_submission text not null,
  created_at timestamptz not null default now(),
  unique(request_id,document_type_id),
  constraint request_documents_sha_check check(asset_sha256 ~ '^[A-F0-9]{64}$'),
  constraint request_documents_status_check check(status_at_submission in ('PENDING_REVIEW','UNDER_REVIEW','VERIFIED'))
);

create table public.affiliate_bank_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  account_holder text not null,
  bank_name text not null,
  clabe text null,
  account_number text null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_bank_holder_check check(length(btrim(account_holder)) between 2 and 160),
  constraint affiliate_bank_name_check check(length(btrim(bank_name)) between 2 and 100),
  constraint affiliate_bank_clabe_check check(clabe is null or clabe ~ '^[0-9]{18}$'),
  constraint affiliate_bank_account_check check(account_number is null or account_number ~ '^[0-9]{4,20}$'),
  constraint affiliate_bank_identifier_check check(clabe is not null or account_number is not null)
);
create unique index affiliate_bank_one_primary_idx on public.affiliate_bank_accounts(affiliate_id) where is_primary;
create unique index affiliate_bank_clabe_idx on public.affiliate_bank_accounts(affiliate_id,clabe) where clabe is not null;

create table public.program_terms_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  program_id text not null,
  membership_offering_id uuid null references public.membership_offerings(id) on delete cascade,
  version integer not null,
  title text not null,
  body text null,
  private_asset_id uuid null references public.private_assets(id) on delete restrict,
  published boolean not null default false,
  published_at timestamptz null,
  created_by_auth_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint program_terms_program_check check(length(btrim(program_id)) between 1 and 80),
  constraint program_terms_content_check check((body is null) <> (private_asset_id is null)),
  constraint program_terms_version_check check(version > 0),
  constraint program_terms_publish_check check(published= (published_at is not null)),
  constraint program_terms_scope_check check((program_id='membership')=(membership_offering_id is not null)),
  unique(program_id,membership_offering_id,version)
);
create unique index program_terms_one_published_idx on public.program_terms_versions(program_id,coalesce(membership_offering_id,'00000000-0000-0000-0000-000000000000'::uuid)) where published;

create table public.credential_qr_settings (
  id boolean primary key default true check(id),
  destination_path text not null default '/SutiApp.html#credencial',
  ttl_seconds integer not null default 30,
  updated_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint credential_qr_destination_check check(destination_path ~ '^/[-A-Za-z0-9_./#?=&]{1,255}$' and destination_path !~ '//'),
  constraint credential_qr_ttl_check check(ttl_seconds between 15 and 120)
);
insert into public.credential_qr_settings(id) values(true);

create table public.credential_qr_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  token_hash text not null unique,
  destination_path text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint credential_qr_hash_check check(token_hash ~ '^[A-F0-9]{64}$')
);
create index credential_qr_expiry_idx on public.credential_qr_tokens(expires_at);

alter table public.program_requests
  add column membership_offering_id uuid null references public.membership_offerings(id) on delete restrict,
  add column terms_version_id uuid null references public.program_terms_versions(id) on delete restrict,
  add column applicant_profile_snapshot jsonb null;
alter table public.program_requests drop constraint program_requests_target_check;
alter table public.program_requests add constraint program_requests_target_check check(
  num_nonnulls(program_item_id,product_id,membership_offering_id)=1
);

create function public.set_completion_updated_at() returns trigger language plpgsql set search_path=''
as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['document_types','affiliate_documents','program_document_requirements','affiliate_bank_accounts'] loop
  execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_completion_updated_at()',t,t);
end loop; end $$;

create table public.sensitive_change_audit (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  affiliate_id uuid null references public.affiliates(id) on delete restrict,
  resource text not null,
  action text not null,
  target_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index sensitive_change_audit_affiliate_idx on public.sensitive_change_audit(affiliate_id,created_at desc);

-- Backend writer for a user upload already placed in the private bucket.
create function public.register_affiliate_document(
  p_document_type_id uuid,p_storage_path text,p_mime_type text,p_file_size bigint,p_sha256 text
) returns public.affiliate_documents language plpgsql security definer set search_path=''
as $$ declare v_affiliate uuid;v_type public.document_types%rowtype;v_asset public.private_assets%rowtype;v_doc public.affiliate_documents%rowtype;v_path text:=btrim(p_storage_path); begin
  v_affiliate:=public.get_effective_affiliate_id();
  if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  select * into v_type from public.document_types where id=p_document_type_id and enabled;
  if v_type.id is null then raise exception 'DOCUMENT_TYPE_UNAVAILABLE' using errcode='22023'; end if;
  if not(p_mime_type=any(v_type.accepted_mime_types)) or p_file_size<1 or p_file_size>10485760 or upper(p_sha256)!~'^[A-F0-9]{64}$' then raise exception 'INVALID_DOCUMENT_FILE' using errcode='22023'; end if;
  if v_path!~('^affiliate-documents/'||v_affiliate::text||'/[A-Za-z0-9._-]+$') then raise exception 'INVALID_STORAGE_PATH' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text) then raise exception 'UPLOAD_NOT_FOUND' using errcode='22023'; end if;
  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256);
  if v_asset.id is null then
    insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset;
  end if;
  if exists(select 1 from public.affiliate_documents where affiliate_id=v_affiliate and document_type_id=p_document_type_id and status='VERIFIED') then raise exception 'VERIFIED_DOCUMENT_IMMUTABLE' using errcode='42501'; end if;
  update public.affiliate_documents set status='REJECTED',review_observation='Reemplazado por una nueva carga.',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
  where affiliate_id=v_affiliate and document_type_id=p_document_type_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');
  insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id)
  values(v_affiliate,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid()) returning * into v_doc;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_affiliate,'affiliate_documents','UPLOAD',v_doc.id,jsonb_build_object('document_type_id',p_document_type_id,'mime_type',p_mime_type,'file_size',p_file_size));
  return v_doc;
end $$;

create function public.review_affiliate_document(p_document_id uuid,p_status text,p_observation text default null)
returns public.affiliate_documents language plpgsql security definer set search_path=''
as $$ declare v_doc public.affiliate_documents%rowtype; begin
  if not public.has_admin_permission('documents.write') then raise exception 'DOCUMENT_REVIEW_DENIED' using errcode='42501'; end if;
  if p_status not in('VERIFIED','REJECTED','REUPLOAD_REQUIRED') then raise exception 'INVALID_REVIEW_STATUS' using errcode='22023'; end if;
  update public.affiliate_documents set status=p_status,review_observation=nullif(left(btrim(coalesce(p_observation,'')),1000),''),reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
  where id=p_document_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') returning * into v_doc;
  if v_doc.id is null then raise exception 'DOCUMENT_NOT_REVIEWABLE' using errcode='P0001'; end if;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_doc.affiliate_id,'affiliate_documents','REVIEW',v_doc.id,jsonb_build_object('status',p_status,'has_observation',p_observation is not null));
  return v_doc;
end $$;

create function public.save_program_document_requirement(p_program_id text,p_membership_offering_id uuid,p_document_type_id uuid,p_required boolean,p_allow_reuse boolean,p_sort_order integer,p_enabled boolean)
returns public.program_document_requirements language plpgsql security definer set search_path=''
as $$ declare v_row public.program_document_requirements%rowtype; begin
  if not public.has_admin_permission('documents.write') then raise exception 'DOCUMENT_CONFIG_DENIED' using errcode='42501'; end if;
  select * into v_row from public.program_document_requirements where program_id=p_program_id and membership_offering_id is not distinct from p_membership_offering_id and document_type_id=p_document_type_id;
  if v_row.id is null then insert into public.program_document_requirements(program_id,membership_offering_id,document_type_id,required,allow_verified_reuse,sort_order,enabled) values(p_program_id,p_membership_offering_id,p_document_type_id,p_required,p_allow_reuse,p_sort_order,p_enabled) returning * into v_row;
  else update public.program_document_requirements set required=p_required,allow_verified_reuse=p_allow_reuse,sort_order=p_sort_order,enabled=p_enabled where id=v_row.id returning * into v_row;end if;return v_row;
end $$;

create function public.publish_program_terms(p_program_id text,p_membership_offering_id uuid,p_title text,p_body text)
returns public.program_terms_versions language plpgsql security definer set search_path=''
as $$ declare v_row public.program_terms_versions%rowtype;v_version integer; begin
  if not public.has_admin_permission('documents.write') then raise exception 'TERMS_CONFIG_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_title,'')))<3 or length(btrim(coalesce(p_body,'')))<20 then raise exception 'TERMS_CONTENT_REQUIRED' using errcode='22023'; end if;
  update public.program_terms_versions set published=false,published_at=null where program_id=p_program_id and membership_offering_id is not distinct from p_membership_offering_id and published;
  select coalesce(max(version),0)+1 into v_version from public.program_terms_versions where program_id=p_program_id and membership_offering_id is not distinct from p_membership_offering_id;
  insert into public.program_terms_versions(program_id,membership_offering_id,version,title,body,published,published_at,created_by_auth_user_id) values(p_program_id,p_membership_offering_id,v_version,btrim(p_title),btrim(p_body),true,now(),auth.uid()) returning * into v_row;return v_row;
end $$;

create function public.save_affiliate_bank_account(p_id uuid,p_holder text,p_bank text,p_clabe text,p_account text,p_primary boolean)
returns public.affiliate_bank_accounts language plpgsql security definer set search_path=''
as $$ declare v_affiliate uuid;v_row public.affiliate_bank_accounts%rowtype; begin
  v_affiliate:=public.get_effective_affiliate_id();if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if p_primary then update public.affiliate_bank_accounts set is_primary=false where affiliate_id=v_affiliate and is_primary; end if;
  if p_id is null then
    insert into public.affiliate_bank_accounts(affiliate_id,account_holder,bank_name,clabe,account_number,is_primary)
    values(v_affiliate,btrim(p_holder),btrim(p_bank),nullif(regexp_replace(coalesce(p_clabe,''),'\D','','g'),''),nullif(regexp_replace(coalesce(p_account,''),'\D','','g'),''),p_primary)
    returning * into v_row;
  else
    update public.affiliate_bank_accounts set account_holder=btrim(p_holder),bank_name=btrim(p_bank),clabe=nullif(regexp_replace(coalesce(p_clabe,''),'\D','','g'),''),account_number=nullif(regexp_replace(coalesce(p_account,''),'\D','','g'),''),is_primary=p_primary
    where id=p_id and affiliate_id=v_affiliate returning * into v_row;
  end if;
  if v_row.id is null then raise exception 'BANK_ACCOUNT_NOT_FOUND' using errcode='P0001'; end if;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_affiliate,'affiliate_bank_accounts',case when p_id is null then 'INSERT' else 'UPDATE' end,v_row.id,jsonb_build_object('bank_name',v_row.bank_name,'has_clabe',v_row.clabe is not null,'has_account',v_row.account_number is not null,'is_primary',v_row.is_primary));
  return v_row;
end $$;

create function public.delete_affiliate_bank_account(p_id uuid) returns boolean language plpgsql security definer set search_path=''
as $$ declare v_affiliate uuid;v_deleted uuid; begin
  v_affiliate:=public.get_effective_affiliate_id();if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  delete from public.affiliate_bank_accounts where id=p_id and affiliate_id=v_affiliate returning id into v_deleted;
  if v_deleted is null then raise exception 'BANK_ACCOUNT_NOT_FOUND' using errcode='P0001'; end if;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id) values(auth.uid(),v_affiliate,'affiliate_bank_accounts','DELETE',v_deleted);
  return true;
end $$;

create function public.issue_credential_qr() returns table(token text,destination_path text,expires_at timestamptz)
language plpgsql security definer set search_path=''
as $$ declare v_affiliate uuid;v_raw text;v_ttl integer; begin
  v_affiliate:=public.get_effective_affiliate_id();if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  select s.destination_path,s.ttl_seconds into destination_path,v_ttl from public.credential_qr_settings s where s.id;
  v_raw:=replace(extensions.gen_random_uuid()::text,'-','')||replace(extensions.gen_random_uuid()::text,'-','');expires_at:=now()+make_interval(secs=>v_ttl);
  delete from public.credential_qr_tokens q where q.affiliate_id=v_affiliate or q.expires_at<now();
  insert into public.credential_qr_tokens(affiliate_id,token_hash,destination_path,expires_at) values(v_affiliate,upper(encode(extensions.digest(v_raw,'sha256'),'hex')),destination_path,expires_at);
  token:=v_raw;return next;
end $$;

create function public.attach_request_documents(p_request_id uuid,p_affiliate_document_ids uuid[])
returns integer language plpgsql security definer set search_path=''
as $$ declare v_affiliate uuid;v_count integer; begin
  v_affiliate:=public.get_effective_affiliate_id();
  if not exists(select 1 from public.program_requests where id=p_request_id and affiliate_id=v_affiliate and actor_real_auth_user_id=auth.uid()) then raise exception 'REQUEST_ACCESS_DENIED' using errcode='42501'; end if;
  insert into public.request_documents(request_id,document_type_id,affiliate_document_id,private_asset_id,asset_sha256,status_at_submission)
  select p_request_id,d.document_type_id,d.id,coalesce(d.private_asset_id,af.private_asset_id),pa.content_sha256,d.status
  from public.affiliate_documents d left join public.affiliate_files af on af.id=d.affiliate_file_id
  join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  where d.id=any(p_affiliate_document_ids) and d.affiliate_id=v_affiliate and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
  on conflict(request_id,document_type_id) do nothing;
  get diagnostics v_count=row_count;return v_count;
end $$;

create function public.finalize_program_request_context(p_request_id uuid,p_terms_version_id uuid,p_document_ids uuid[])
returns public.program_requests language plpgsql security definer set search_path=''
as $$ declare v_row public.program_requests%rowtype;v_missing integer; begin
  select * into v_row from public.program_requests where id=p_request_id and affiliate_id=public.get_effective_affiliate_id() and actor_real_auth_user_id=auth.uid() for update;
  if v_row.id is null then raise exception 'REQUEST_ACCESS_DENIED' using errcode='42501'; end if;
  if not exists(select 1 from public.program_terms_versions t where t.id=p_terms_version_id and t.program_id=v_row.program_id and t.membership_offering_id is not distinct from v_row.membership_offering_id and t.published) then raise exception 'TERMS_VERSION_REQUIRED' using errcode='22023'; end if;
  select count(*) into v_missing from public.program_document_requirements r where r.program_id=v_row.program_id and r.membership_offering_id is not distinct from v_row.membership_offering_id and r.enabled and r.required and not exists(
    select 1 from public.affiliate_documents d where d.id=any(p_document_ids) and d.affiliate_id=v_row.affiliate_id and d.document_type_id=r.document_type_id and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED'));
  if v_missing>0 then raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023'; end if;
  update public.program_requests set terms_version_id=p_terms_version_id,updated_at=now() where id=v_row.id returning * into v_row;
  perform public.attach_request_documents(v_row.id,p_document_ids);return v_row;
end $$;

create function public.create_membership_request(p_membership_offering_id uuid,p_document_ids uuid[],p_phone text,p_rfc text,p_curp text,p_terms_version_id uuid,p_idempotency_key uuid)
returns public.program_requests language plpgsql security definer set search_path=''
as $$ declare v_affiliate public.affiliates%rowtype;v_row public.program_requests%rowtype;v_missing integer; begin
  select a.* into v_affiliate from public.affiliates a where a.id=public.get_effective_affiliate_id();
  if auth.uid() is null or v_affiliate.id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.membership_offerings where id=p_membership_offering_id and enabled) then raise exception 'MEMBERSHIP_UNAVAILABLE' using errcode='22023'; end if;
  if regexp_replace(coalesce(p_phone,''),'\D','','g')!~'^[0-9]{10}$' or upper(btrim(p_rfc))!~'^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$' or upper(btrim(p_curp))!~'^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$' then raise exception 'INVALID_APPLICANT_PROFILE' using errcode='22023'; end if;
  if not exists(select 1 from public.program_terms_versions where id=p_terms_version_id and program_id='membership' and membership_offering_id=p_membership_offering_id and published) then raise exception 'TERMS_VERSION_REQUIRED' using errcode='22023'; end if;
  select count(*) into v_missing from public.program_document_requirements r where r.program_id='membership' and r.membership_offering_id=p_membership_offering_id and r.enabled and r.required and not exists(
    select 1 from public.affiliate_documents d where d.id=any(p_document_ids) and d.affiliate_id=v_affiliate.id and d.document_type_id=r.document_type_id and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED'));
  if v_missing>0 then raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023'; end if;
  select * into v_row from public.program_requests where affiliate_id=v_affiliate.id and idempotency_key=p_idempotency_key;
  if v_row.id is null then
    insert into public.program_requests(actor_real_auth_user_id,affiliate_id,numero_control,program_id,membership_offering_id,request_type,status,terms_accepted,terms_version_id,idempotency_key,applicant_profile_snapshot,source_context)
    values(auth.uid(),v_affiliate.id,v_affiliate.numero_control,'membership',p_membership_offering_id,'benefit','submitted',true,p_terms_version_id,p_idempotency_key,
      jsonb_build_object('phone',regexp_replace(p_phone,'\D','','g'),'rfc',upper(btrim(p_rfc)),'curp',upper(btrim(p_curp)),'source','request_snapshot'),jsonb_build_object('surface','membership_application')) returning * into v_row;
    perform public.attach_request_documents(v_row.id,p_document_ids);
  end if;return v_row;
end $$;

alter table public.document_types enable row level security;alter table public.document_types force row level security;
alter table public.affiliate_documents enable row level security;alter table public.affiliate_documents force row level security;
alter table public.program_document_requirements enable row level security;alter table public.program_document_requirements force row level security;
alter table public.request_documents enable row level security;alter table public.request_documents force row level security;
alter table public.affiliate_bank_accounts enable row level security;alter table public.affiliate_bank_accounts force row level security;
alter table public.program_terms_versions enable row level security;alter table public.program_terms_versions force row level security;
alter table public.credential_qr_settings enable row level security;alter table public.credential_qr_settings force row level security;
alter table public.credential_qr_tokens enable row level security;alter table public.credential_qr_tokens force row level security;
alter table public.sensitive_change_audit enable row level security;alter table public.sensitive_change_audit force row level security;

revoke all on public.document_types,public.affiliate_documents,public.program_document_requirements,public.request_documents,public.affiliate_bank_accounts,public.program_terms_versions,public.credential_qr_settings,public.credential_qr_tokens,public.sensitive_change_audit from public,anon,authenticated;
grant select on public.document_types,public.program_document_requirements,public.program_terms_versions to authenticated;
grant select on public.affiliate_documents,public.request_documents,public.affiliate_bank_accounts to authenticated;
grant select on public.credential_qr_settings to authenticated;
grant insert,update,delete on public.document_types,public.program_document_requirements,public.program_terms_versions to authenticated;
grant update on public.credential_qr_settings to authenticated;
grant execute on function public.register_affiliate_document(uuid,text,text,bigint,text),public.review_affiliate_document(uuid,text,text),public.save_program_document_requirement(text,uuid,uuid,boolean,boolean,integer,boolean),public.publish_program_terms(text,uuid,text,text),public.save_affiliate_bank_account(uuid,text,text,text,text,boolean),public.delete_affiliate_bank_account(uuid),public.issue_credential_qr(),public.attach_request_documents(uuid,uuid[]),public.finalize_program_request_context(uuid,uuid,uuid[]),public.create_membership_request(uuid,uuid[],text,text,text,uuid,uuid) to authenticated;

create policy document_types_read on public.document_types for select to authenticated using(enabled or public.has_admin_permission('documents.read'));
create policy document_types_admin_write on public.document_types for all to authenticated using(public.has_admin_permission('documents.write')) with check(public.has_admin_permission('documents.write'));
create policy affiliate_documents_read on public.affiliate_documents for select to authenticated using(affiliate_id=public.get_effective_affiliate_id() or public.has_admin_permission('documents.read'));
create policy requirements_read on public.program_document_requirements for select to authenticated using(enabled or public.has_admin_permission('documents.read'));
create policy requirements_admin_write on public.program_document_requirements for all to authenticated using(public.has_admin_permission('documents.write')) with check(public.has_admin_permission('documents.write'));
create policy request_documents_read on public.request_documents for select to authenticated using(exists(select 1 from public.program_requests r where r.id=request_id and (r.affiliate_id=public.get_effective_affiliate_id() or public.has_admin_permission('program_requests.read'))));
create policy bank_accounts_self_read on public.affiliate_bank_accounts for select to authenticated using(affiliate_id=public.get_effective_affiliate_id());
create policy terms_read on public.program_terms_versions for select to authenticated using(published or public.has_admin_permission('documents.read'));
create policy terms_admin_write on public.program_terms_versions for all to authenticated using(public.has_admin_permission('documents.write')) with check(public.has_admin_permission('documents.write'));
create policy qr_settings_read on public.credential_qr_settings for select to authenticated using(true);
create policy qr_settings_admin_update on public.credential_qr_settings for update to authenticated using(public.has_admin_permission('content.write')) with check(public.has_admin_permission('content.write'));
create policy sensitive_audit_admin_read on public.sensitive_change_audit for select to authenticated using(public.has_admin_permission('documents.read'));

-- Extend existing private-asset and Storage authorization to canonical documents.
drop policy private_assets_authorized_read on public.private_assets;
create policy private_assets_authorized_read on public.private_assets for select to authenticated using(
  public.has_admin_permission('assets.read')
  or exists(select 1 from public.affiliate_files af where af.private_asset_id=private_assets.id and af.affiliate_id=public.get_effective_affiliate_id() and af.status='READY')
  or exists(select 1 from public.affiliate_documents d left join public.affiliate_files af on af.id=d.affiliate_file_id where coalesce(d.private_asset_id,af.private_asset_id)=private_assets.id and d.affiliate_id=public.get_effective_affiliate_id() and d.status<>'REJECTED')
);
drop policy master_private_storage_authorized_read on storage.objects;
create policy master_private_storage_authorized_read on storage.objects for select to authenticated using(
  bucket_id='private-assets' and (public.has_admin_permission('assets.read') or exists(
    select 1 from public.private_assets pa left join public.affiliate_files af on af.private_asset_id=pa.id left join public.affiliate_documents d on d.private_asset_id=pa.id or d.affiliate_file_id=af.id
    where pa.storage_path=name and pa.storage_bucket=bucket_id and pa.status='READY' and (af.affiliate_id=public.get_effective_affiliate_id() or d.affiliate_id=public.get_effective_affiliate_id())
  ))
);
create policy affiliate_document_storage_insert on storage.objects for insert to authenticated with check(
  bucket_id='private-assets' and name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%') and owner_id=auth.uid()::text
);
create policy affiliate_document_storage_cleanup on storage.objects for delete to authenticated using(
  bucket_id='private-assets' and name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%') and owner_id=auth.uid()::text
  and not exists(select 1 from public.private_assets pa where pa.storage_bucket=bucket_id and pa.storage_path=name)
);

do $$ declare t text; begin foreach t in array array['document_types','program_document_requirements','program_terms_versions'] loop
  execute format('create trigger %I_admin_audit after insert or update or delete on public.%I for each row execute function public.audit_admin_write()',t,t);
end loop; end $$;

notify pgrst,'reload schema';
commit;
