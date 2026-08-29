begin;

do $$
begin
  if exists(select 1 from public.affiliate_documents where replaces_document_id is not null) then
    raise exception 'RECOVERY_BLOCKED_REPLACEMENT_HISTORY_EXISTS';
  end if;
end $$;

drop trigger if exists request_documents_require_available_object on public.request_documents;
drop function if exists public.enforce_request_document_availability();
revoke all on function public.get_affiliate_document_availability(uuid[]) from public,anon,authenticated;
drop function public.get_affiliate_document_availability(uuid[]);

drop index public.affiliate_documents_latest_type_idx;
drop index public.affiliate_documents_current_review_idx;
create unique index affiliate_documents_current_type_idx on public.affiliate_documents(affiliate_id,document_type_id)
where status in ('PENDING_REVIEW','UNDER_REVIEW','VERIFIED','REUPLOAD_REQUIRED');

create or replace function public.register_affiliate_document(
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

alter table public.affiliate_documents drop column replaces_document_id;

commit;
