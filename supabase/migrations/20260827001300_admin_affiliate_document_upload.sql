begin;

create function public.register_admin_affiliate_document(
  p_affiliate_id uuid,
  p_document_type_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_size bigint,
  p_sha256 text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_type public.document_types%rowtype;
  v_asset public.private_assets%rowtype;
  v_doc public.affiliate_documents%rowtype;
  v_path text:=btrim(coalesce(p_storage_path,''));
  v_reason text:=btrim(coalesce(p_reason,''));
  v_cleanup_path text;
begin
  if not public.has_admin_permission('documents.write') then
    raise exception 'ADMIN_DOCUMENT_WRITE_DENIED' using errcode='42501';
  end if;
  if auth.uid() is null or not exists(select 1 from public.affiliates where id=p_affiliate_id) then
    raise exception 'AFFILIATE_NOT_FOUND' using errcode='22023';
  end if;
  if length(v_reason) not between 8 and 500 then
    raise exception 'DOCUMENT_REASON_REQUIRED' using errcode='22023';
  end if;
  select * into v_type from public.document_types where id=p_document_type_id and enabled;
  if v_type.id is null then raise exception 'DOCUMENT_TYPE_UNAVAILABLE' using errcode='22023'; end if;
  if not(p_mime_type=any(v_type.accepted_mime_types))
     or p_file_size<1 or p_file_size>10485760
     or upper(coalesce(p_sha256,''))!~'^[A-F0-9]{64}$' then
    raise exception 'INVALID_DOCUMENT_FILE' using errcode='22023';
  end if;
  if v_path!~('^affiliate-documents/'||p_affiliate_id::text||'/[A-Za-z0-9._-]+$') then
    raise exception 'INVALID_STORAGE_PATH' using errcode='22023';
  end if;
  if not exists(
    select 1 from storage.objects
    where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text
  ) then raise exception 'UPLOAD_NOT_FOUND' using errcode='22023'; end if;
  if exists(
    select 1 from public.affiliate_documents
    where affiliate_id=p_affiliate_id and document_type_id=p_document_type_id and status='VERIFIED'
  ) then raise exception 'VERIFIED_DOCUMENT_IMMUTABLE' using errcode='42501'; end if;

  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;
  if v_asset.id is null then
    begin
      insert into public.private_assets(
        asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256
      ) values(
        'affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),
        'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256)
      ) returning * into v_asset;
    exception when unique_violation then
      select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;
    end;
  end if;
  if v_asset.id is null then raise exception 'DOCUMENT_ASSET_REGISTRATION_FAILED'; end if;
  if v_asset.storage_path is distinct from v_path then v_cleanup_path:=v_path; end if;

  update public.affiliate_documents
  set status='REJECTED',review_observation='Reemplazado por una nueva carga administrativa.',
      reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
  where affiliate_id=p_affiliate_id and document_type_id=p_document_type_id
    and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');

  insert into public.affiliate_documents(
    affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id
  ) values(
    p_affiliate_id,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid()
  ) returning * into v_doc;

  insert into public.sensitive_change_audit(
    actor_auth_user_id,affiliate_id,resource,action,target_id,metadata
  ) values(
    auth.uid(),p_affiliate_id,'affiliate_documents','ADMIN_UPLOAD',v_doc.id,
    jsonb_build_object(
      'document_type_id',p_document_type_id,'mime_type',p_mime_type,
      'file_size',p_file_size,'reason',v_reason
    )
  );

  return jsonb_build_object('document',to_jsonb(v_doc),'cleanup_storage_path',v_cleanup_path);
end $$;

revoke all on function public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text) from public,anon;
grant execute on function public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text) to authenticated;

drop policy if exists affiliate_document_storage_insert on storage.objects;
create policy affiliate_document_storage_insert on storage.objects
for insert to authenticated with check(
  bucket_id='private-assets' and owner_id=auth.uid()::text and (
    name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%')
    or (
      public.has_admin_permission('documents.write')
      and name ~ '^affiliate-documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
      and exists(select 1 from public.affiliates where id::text=split_part(name,'/',2))
    )
  )
);

drop policy if exists affiliate_document_storage_cleanup on storage.objects;
create policy affiliate_document_storage_cleanup on storage.objects
for delete to authenticated using(
  bucket_id='private-assets' and owner_id=auth.uid()::text
  and not exists(
    select 1 from public.private_assets pa
    where pa.storage_bucket=bucket_id and pa.storage_path=name
  )
  and (
    name like ('affiliate-documents/'||public.get_effective_affiliate_id()::text||'/%')
    or (
      public.has_admin_permission('documents.write')
      and name ~ '^affiliate-documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
      and exists(select 1 from public.affiliates where id::text=split_part(name,'/',2))
    )
  )
);

comment on function public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)
is 'Permission-gated Admin upload into an existing affiliate expediente; preserves verified documents and audits actor/reason.';

notify pgrst,'reload schema';
commit;
