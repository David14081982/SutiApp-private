begin;
set local lock_timeout='3s';set local statement_timeout='90s';
create schema document_isolation_private;
revoke all on schema document_isolation_private from public,anon,authenticated,service_role;
create table document_isolation_private.function_backup(signature text primary key,definition text not null,applied_md5 text);
create table document_isolation_private.batches(id uuid primary key,actor_auth_user_id uuid not null references auth.users(id),reason text not null,created_at timestamptz not null default now(),completed_at timestamptz);
create table document_isolation_private.items(batch_id uuid not null references document_isolation_private.batches(id),unit_kind text not null check(unit_kind in('file','document')),unit_id uuid not null,affiliate_id uuid not null references public.affiliates(id),old_asset_id uuid not null references public.private_assets(id),new_asset_id uuid not null unique references public.private_assets(id),before_file jsonb,before_documents jsonb not null,source_hash text not null,created_at timestamptz not null default now(),primary key(batch_id,unit_kind,unit_id));
alter table document_isolation_private.function_backup enable row level security;
alter table document_isolation_private.function_backup force row level security;
alter table document_isolation_private.batches enable row level security;
alter table document_isolation_private.batches force row level security;
alter table document_isolation_private.items enable row level security;
alter table document_isolation_private.items force row level security;
revoke all on all tables in schema document_isolation_private from public,anon,authenticated,service_role;
alter table public.private_assets add column owner_affiliate_id uuid references public.affiliates(id);
alter table public.private_assets add constraint private_assets_owned_path_check check(owner_affiliate_id is null or storage_path like 'affiliate-documents/'||owner_affiliate_id::text||'/%');
alter table public.private_assets drop constraint private_assets_hash_unique;
-- Original non-expediente hashes retain uniqueness; every owned upload is independent.
create unique index private_assets_legacy_hash_unique on public.private_assets(content_sha256) where owner_affiliate_id is null;
create index private_assets_owner_idx on public.private_assets(owner_affiliate_id) where owner_affiliate_id is not null;
create function document_isolation_private.guard_asset_owner() returns trigger language plpgsql security definer set search_path='' as $guard$
begin
 if new.owner_affiliate_id is distinct from old.owner_affiliate_id or (old.owner_affiliate_id is not null and (new.storage_path is distinct from old.storage_path or new.storage_bucket is distinct from old.storage_bucket)) then raise exception 'DOCUMENT_ASSET_OWNER_IMMUTABLE' using errcode='42501';end if;
 return new;
end $guard$;
create trigger document_isolation_asset_owner before update on public.private_assets for each row execute function document_isolation_private.guard_asset_owner();
create function document_isolation_private.guard_reference() returns trigger language plpgsql security definer set search_path='' as $guard$
declare v_asset uuid;v_owner uuid;v_file public.affiliate_files%rowtype;
begin
 if tg_op='UPDATE' and new.affiliate_id is not distinct from old.affiliate_id and new.private_asset_id is not distinct from old.private_asset_id and (tg_table_name='affiliate_files' or to_jsonb(new)->>'affiliate_file_id' is not distinct from to_jsonb(old)->>'affiliate_file_id') then return new;end if;
 v_asset:=new.private_asset_id;
 if tg_table_name='affiliate_documents' then
  if new.affiliate_file_id is not null then
   select * into v_file from public.affiliate_files where id=new.affiliate_file_id for key share;
   if v_file.id is null or v_file.affiliate_id is distinct from new.affiliate_id or (v_asset is not null and v_asset is distinct from v_file.private_asset_id) then raise exception 'DOCUMENT_FILE_OWNER_MISMATCH' using errcode='42501';end if;
   v_asset:=coalesce(v_asset,v_file.private_asset_id);
  end if;
 end if;
 if v_asset is null then
  if tg_table_name='affiliate_documents' then raise exception 'DOCUMENT_ASSET_REQUIRED' using errcode='42501';end if;
  return new;
 end if;
 select owner_affiliate_id into v_owner from public.private_assets where id=v_asset for update;
 if v_owner is null or v_owner is distinct from new.affiliate_id then raise exception 'DOCUMENT_ASSET_OWNER_MISMATCH' using errcode='42501';end if;
 if tg_table_name='affiliate_documents' then
  if exists(select 1 from public.affiliate_documents d left join public.affiliate_files f on f.id=d.affiliate_file_id where d.id<>new.id and coalesce(d.private_asset_id,f.private_asset_id)=v_asset)
    or exists(select 1 from public.affiliate_files f where f.private_asset_id=v_asset and f.id is distinct from new.affiliate_file_id) then raise exception 'DOCUMENT_ASSET_ALREADY_LINKED' using errcode='42501';end if;
 else
  if exists(select 1 from public.affiliate_files f where f.private_asset_id=v_asset and f.id<>new.id)
    or exists(select 1 from public.affiliate_documents d where d.private_asset_id=v_asset and d.affiliate_file_id is distinct from new.id) then raise exception 'DOCUMENT_ASSET_ALREADY_LINKED' using errcode='42501';end if;
 end if;
 return new;
end $guard$;
create trigger document_isolation_reference before insert or update on public.affiliate_documents for each row execute function document_isolation_private.guard_reference();
create trigger document_isolation_reference before insert or update on public.affiliate_files for each row execute function document_isolation_private.guard_reference();
revoke all on all functions in schema document_isolation_private from public,anon,authenticated,service_role;
-- GENERATED_WRITERS

do $check$ begin if md5(pg_get_functiondef('register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'::regprocedure))<>'add7205980680bccb0abf6dd64e5b104' then raise exception 'ISOLATION_BASE_DRIFT:register_admin_affiliate_document';end if;end $check$;
insert into document_isolation_private.function_backup(signature,definition) select 'register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)',pg_get_functiondef('register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'::regprocedure);
CREATE OR REPLACE FUNCTION public.register_admin_affiliate_document(p_affiliate_id uuid, p_document_type_id uuid, p_storage_path text, p_mime_type text, p_file_size bigint, p_sha256 text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_type public.document_types%rowtype;v_asset public.private_assets%rowtype;v_doc public.affiliate_documents%rowtype;v_replaced uuid;v_path text:=btrim(coalesce(p_storage_path,''));v_reason text:=btrim(coalesce(p_reason,''));v_cleanup_path text;
begin
  if not public.has_admin_permission('documents.write') then raise exception 'ADMIN_DOCUMENT_WRITE_DENIED' using errcode='42501'; end if;
  if auth.uid() is null or not exists(select 1 from public.affiliates where id=p_affiliate_id) then raise exception 'AFFILIATE_NOT_FOUND' using errcode='22023'; end if;
  if length(v_reason)>500 then raise exception 'DOCUMENT_REASON_TOO_LONG' using errcode='22023'; end if;
  select * into v_type from public.document_types where id=p_document_type_id and enabled;
  if v_type.id is null then raise exception 'DOCUMENT_TYPE_UNAVAILABLE' using errcode='22023'; end if;
  if not v_type.file_upload_allowed or not(p_mime_type=any(v_type.accepted_mime_types)) or p_file_size<1 or p_file_size>v_type.max_file_size_bytes or upper(coalesce(p_sha256,''))!~'^[A-F0-9]{64}$' then raise exception 'INVALID_DOCUMENT_FILE' using errcode='22023'; end if;
  if v_path!~('^affiliate-documents/'||p_affiliate_id::text||'/[A-Za-z0-9._-]+$') then raise exception 'INVALID_STORAGE_PATH' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text) then raise exception 'UPLOAD_NOT_FOUND' using errcode='22023'; end if;
  perform 1 from storage.objects where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text for update;
  select d.* into v_doc from public.affiliate_documents d join public.private_assets a on a.id=d.private_asset_id where a.storage_bucket='private-assets' and a.storage_path=v_path and a.owner_affiliate_id=p_affiliate_id and d.affiliate_id=p_affiliate_id and d.document_type_id=p_document_type_id and a.content_sha256=upper(p_sha256) and a.mime_type=p_mime_type and a.file_size=p_file_size and public.affiliate_document_is_active(d.id);
  if v_doc.id is not null then return jsonb_build_object('document',to_jsonb(v_doc),'cleanup_storage_path',null);end if;
  select d.id into v_replaced from document_retirement_private.active_documents d where d.affiliate_id=p_affiliate_id and d.document_type_id=p_document_type_id order by d.created_at desc,d.id desc limit 1;
  insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256,owner_affiliate_id)
  values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256),p_affiliate_id) returning * into v_asset;
  update public.affiliate_documents set status='REJECTED',review_observation='Reemplazado por una nueva carga administrativa.',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
   where public.affiliate_document_is_active(id) and affiliate_id=p_affiliate_id and document_type_id=p_document_type_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');
  insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id)
   values(p_affiliate_id,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid(),v_replaced) returning * into v_doc;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
   values(auth.uid(),p_affiliate_id,'affiliate_documents',case when v_replaced is null then 'ADMIN_UPLOAD' else 'ADMIN_REPLACEMENT_UPLOAD' end,v_doc.id,jsonb_strip_nulls(jsonb_build_object('document_type_id',p_document_type_id,'mime_type',p_mime_type,'file_size',p_file_size,'reason',v_reason,'replaces_document_id',v_replaced)));
  return jsonb_build_object('document',to_jsonb(v_doc),'cleanup_storage_path',v_cleanup_path);
end $function$
;
update document_isolation_private.function_backup set applied_md5=md5(pg_get_functiondef(signature::regprocedure)) where signature='register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)';

do $check$ begin if md5(pg_get_functiondef('register_affiliate_document(uuid,text,text,bigint,text,text)'::regprocedure))<>'865e2d8062e95215079a7a8fdb0c2af0' then raise exception 'ISOLATION_BASE_DRIFT:register_affiliate_document';end if;end $check$;
insert into document_isolation_private.function_backup(signature,definition) select 'register_affiliate_document(uuid,text,text,bigint,text,text)',pg_get_functiondef('register_affiliate_document(uuid,text,text,bigint,text,text)'::regprocedure);
CREATE OR REPLACE FUNCTION public.register_affiliate_document(p_document_type_id uuid, p_storage_path text, p_mime_type text, p_file_size bigint, p_sha256 text, p_source text)
 RETURNS affiliate_documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform 1 from storage.objects where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text for update;
  select d.* into v_doc from public.affiliate_documents d join public.private_assets a on a.id=d.private_asset_id where a.storage_bucket='private-assets' and a.storage_path=v_path and a.owner_affiliate_id=v_affiliate and d.affiliate_id=v_affiliate and d.document_type_id=p_document_type_id and a.content_sha256=upper(p_sha256) and a.mime_type=p_mime_type and a.file_size=p_file_size and public.affiliate_document_is_active(d.id);
  if v_doc.id is not null then return v_doc;end if;
  select d.id into v_replaced from document_retirement_private.active_documents d where d.affiliate_id=v_affiliate and d.document_type_id=p_document_type_id order by d.created_at desc,d.id desc limit 1;
  insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256,owner_affiliate_id)
  values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256),v_affiliate) returning * into v_asset;
  update public.affiliate_documents set status='REJECTED',review_observation='Reemplazado por una nueva carga.',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
    where public.affiliate_document_is_active(id) and affiliate_id=v_affiliate and document_type_id=p_document_type_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');
  insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id)
    values(v_affiliate,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid(),v_replaced) returning * into v_doc;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
    values(auth.uid(),v_affiliate,'affiliate_documents',case when v_replaced is null then 'UPLOAD' else 'REPLACEMENT_UPLOAD' end,v_doc.id,
      jsonb_strip_nulls(jsonb_build_object('document_type_id',p_document_type_id,'mime_type',p_mime_type,'file_size',p_file_size,'source',upper(p_source),'replaces_document_id',v_replaced)));
  return v_doc;
end $function$
;
update document_isolation_private.function_backup set applied_md5=md5(pg_get_functiondef(signature::regprocedure)) where signature='register_affiliate_document(uuid,text,text,bigint,text,text)';

do $check$ begin if md5(pg_get_functiondef('set_self_profile_photo(text,text,bigint,text)'::regprocedure))<>'80cd58e6d5ad55c6c7bae9af6697fb83' then raise exception 'ISOLATION_BASE_DRIFT:set_self_profile_photo';end if;end $check$;
insert into document_isolation_private.function_backup(signature,definition) select 'set_self_profile_photo(text,text,bigint,text)',pg_get_functiondef('set_self_profile_photo(text,text,bigint,text)'::regprocedure);
CREATE OR REPLACE FUNCTION public.set_self_profile_photo(p_storage_path text, p_mime_type text, p_file_size bigint, p_sha256 text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_affiliate public.affiliates%rowtype;
  v_asset public.private_assets%rowtype;
  v_previous uuid; v_result uuid; v_meta jsonb;
begin
  select * into v_affiliate from public.affiliates where id=public.get_effective_affiliate_id() for update;
  if auth.uid() is null or v_affiliate.id is null or v_affiliate.auth_user_id is distinct from auth.uid()
    or exists(select 1 from public.get_impersonation_context()) then
    raise exception 'PROFILE_PHOTO_SELF_ONLY' using errcode='42501';
  end if;
  if p_storage_path is null or p_storage_path!~('^affiliate-documents/'||v_affiliate.id::text||'/[a-f0-9-]+\.(jpg|png|webp)$')
    or p_mime_type is null or p_mime_type not in('image/jpeg','image/png','image/webp')
    or p_file_size is null or p_file_size<1 or p_file_size>5242880
    or p_sha256 is null or upper(p_sha256)!~'^[A-F0-9]{64}$' then
    raise exception 'INVALID_PROFILE_PHOTO' using errcode='22023';
  end if;
  select metadata into v_meta from storage.objects where bucket_id='private-assets' and name=p_storage_path and owner_id=auth.uid()::text;
  if v_meta is null or (v_meta->>'size')::bigint is distinct from p_file_size or v_meta->>'mimetype' is distinct from p_mime_type then
    raise exception 'PROFILE_PHOTO_UPLOAD_NOT_FOUND' using errcode='42501';
  end if;
  select id into v_result from public.affiliate_files where affiliate_id=v_affiliate.id and storage_path=p_storage_path and is_current_profile_photo;
  if v_result is not null then return v_result; end if;
  insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256,owner_affiliate_id)
  values('profile_photo_'||extensions.gen_random_uuid()::text,'AFFILIATE_DOCUMENT','Foto de perfil','private-assets',p_storage_path,p_mime_type,p_file_size,upper(p_sha256),v_affiliate.id) returning * into v_asset;
  select id into v_previous from public.affiliate_files where affiliate_id=v_affiliate.id and is_current_profile_photo;
  update public.affiliate_files set is_current_profile_photo=false where affiliate_id=v_affiliate.id and is_current_profile_photo;
  insert into public.affiliate_files(affiliate_id,numero_control,private_asset_id,classification,file_key,file_type,source_column,source_column_letter,title,storage_bucket,storage_path,mime_type,sha256,file_size,source_url,source_row_ordinal,source_file_hash,expediente_classification,is_current_profile_photo)
  values(v_affiliate.id,v_affiliate.numero_control,v_asset.id,'PRIVATE','profile_photo','image','Photo','DK','Foto de perfil',v_asset.storage_bucket,v_asset.storage_path,v_asset.mime_type,v_asset.content_sha256,v_asset.file_size,
    'supabase://private-assets/'||p_storage_path,coalesce(v_affiliate.source_row_ordinal,1),upper(encode(extensions.digest('PROFILE_UPLOAD:'||p_storage_path,'sha256'),'hex')),'CURRENT_DOCUMENT',true)
  returning id into v_result;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_affiliate.id,'profile_photo','SELF_REPLACE',v_result,jsonb_build_object('previous_file_id',v_previous,'private_asset_id',v_asset.id));
  return v_result;
end $function$
;
update document_isolation_private.function_backup set applied_md5=md5(pg_get_functiondef(signature::regprocedure)) where signature='set_self_profile_photo(text,text,bigint,text)';

commit;
