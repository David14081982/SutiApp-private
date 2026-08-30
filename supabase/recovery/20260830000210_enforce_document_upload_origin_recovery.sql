begin;

-- Restore the pre-platform five-argument contract only when rolling back the
-- upload-origin hardening. The immutable replacement behavior is preserved.
create function public.register_affiliate_document(
  p_document_type_id uuid,p_storage_path text,p_mime_type text,p_file_size bigint,p_sha256 text
) returns public.affiliate_documents language plpgsql security definer set search_path=''
as $$
declare
  v_affiliate uuid;
  v_type public.document_types%rowtype;
  v_asset public.private_assets%rowtype;
  v_doc public.affiliate_documents%rowtype;
  v_replaced uuid;
  v_path text:=btrim(p_storage_path);
begin
  v_affiliate:=public.get_effective_affiliate_id();
  if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  select * into v_type from public.document_types where id=p_document_type_id and enabled;
  if v_type.id is null then raise exception 'DOCUMENT_TYPE_UNAVAILABLE' using errcode='22023'; end if;
  if not(p_mime_type=any(v_type.accepted_mime_types)) or p_file_size<1 or p_file_size>10485760 or upper(p_sha256)!~'^[A-F0-9]{64}$' then raise exception 'INVALID_DOCUMENT_FILE' using errcode='22023'; end if;
  if v_path!~('^affiliate-documents/'||v_affiliate::text||'/[A-Za-z0-9._-]+$') then raise exception 'INVALID_STORAGE_PATH' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text) then raise exception 'UPLOAD_NOT_FOUND' using errcode='22023'; end if;
  select d.id into v_replaced from public.affiliate_documents d where d.affiliate_id=v_affiliate and d.document_type_id=p_document_type_id order by d.created_at desc,d.id desc limit 1;
  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256);
  if v_asset.id is null then
    insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset;
  end if;
  update public.affiliate_documents set status='REJECTED',review_observation='Reemplazado por una nueva carga.',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
  where affiliate_id=v_affiliate and document_type_id=p_document_type_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');
  insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id)
  values(v_affiliate,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid(),v_replaced) returning * into v_doc;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_affiliate,'affiliate_documents',case when v_replaced is null then 'UPLOAD' else 'REPLACEMENT_UPLOAD' end,v_doc.id,
    jsonb_strip_nulls(jsonb_build_object('document_type_id',p_document_type_id,'mime_type',p_mime_type,'file_size',p_file_size,'replaces_document_id',v_replaced)));
  return v_doc;
end $$;
revoke all on function public.register_affiliate_document(uuid,text,text,bigint,text) from public,anon;
grant execute on function public.register_affiliate_document(uuid,text,text,bigint,text) to authenticated;

commit;
