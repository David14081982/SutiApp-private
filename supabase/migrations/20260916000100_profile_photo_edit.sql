begin;
set local lock_timeout='5s';
alter table public.affiliate_files add column is_current_profile_photo boolean not null default false;
-- Preserve historical timestamps while initializing the derived current marker.
alter table public.affiliate_files disable trigger affiliate_files_updated_at;
update public.affiliate_files set is_current_profile_photo=true
where file_key='profile_photo' and source_column='Photo' and source_column_letter='DK'
  and classification='PRIVATE' and file_type='image' and status='READY';
alter table public.affiliate_files enable trigger affiliate_files_updated_at;
create unique index affiliate_files_current_profile_photo on public.affiliate_files(affiliate_id) where is_current_profile_photo;
grant select(is_current_profile_photo) on public.affiliate_files to authenticated;

create function public.set_self_profile_photo(p_storage_path text,p_mime_type text,p_file_size bigint,p_sha256 text)
returns uuid language plpgsql security definer set search_path=''
as $$
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
  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256);
  if v_asset.id is not null then
    -- Never attach another user's private asset by guessing its hash.
    if not exists(select 1 from public.affiliate_files where affiliate_id=v_affiliate.id and private_asset_id=v_asset.id)
      and not exists(select 1 from public.affiliate_documents where affiliate_id=v_affiliate.id and private_asset_id=v_asset.id) then
      raise exception 'PROFILE_PHOTO_CONTENT_UNAVAILABLE' using errcode='42501';
    end if;
    if v_asset.status<>'READY' or v_asset.mime_type<>p_mime_type or v_asset.file_size<>p_file_size then
      raise exception 'INVALID_PROFILE_PHOTO' using errcode='22023';
    end if;
  else
    insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values('profile_photo_'||extensions.gen_random_uuid()::text,'AFFILIATE_DOCUMENT','Foto de perfil','private-assets',p_storage_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset;
  end if;
  select id into v_previous from public.affiliate_files where affiliate_id=v_affiliate.id and is_current_profile_photo;
  update public.affiliate_files set is_current_profile_photo=false where affiliate_id=v_affiliate.id and is_current_profile_photo;
  insert into public.affiliate_files(affiliate_id,numero_control,private_asset_id,classification,file_key,file_type,source_column,source_column_letter,title,storage_bucket,storage_path,mime_type,sha256,file_size,source_url,source_row_ordinal,source_file_hash,expediente_classification,is_current_profile_photo)
  values(v_affiliate.id,v_affiliate.numero_control,v_asset.id,'PRIVATE','profile_photo','image','Photo','DK','Foto de perfil',v_asset.storage_bucket,v_asset.storage_path,v_asset.mime_type,v_asset.content_sha256,v_asset.file_size,
    'supabase://private-assets/'||p_storage_path,coalesce(v_affiliate.source_row_ordinal,1),upper(encode(extensions.digest('PROFILE_UPLOAD:'||p_storage_path,'sha256'),'hex')),'CURRENT_DOCUMENT',true)
  returning id into v_result;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_affiliate.id,'profile_photo','SELF_REPLACE',v_result,jsonb_build_object('previous_file_id',v_previous,'private_asset_id',v_asset.id));
  return v_result;
end $$;
revoke all on function public.set_self_profile_photo(text,text,bigint,text) from public,anon;
grant execute on function public.set_self_profile_photo(text,text,bigint,text) to authenticated;
commit;
