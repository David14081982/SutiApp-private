begin;

-- Preserve every prior document while allowing the affiliate to create a newer
-- candidate. The old VERIFIED row is never updated or deleted.
alter table public.affiliate_documents
  add column replaces_document_id uuid null
  references public.affiliate_documents(id) on delete restrict;

drop index public.affiliate_documents_current_type_idx;
create unique index affiliate_documents_current_review_idx
  on public.affiliate_documents(affiliate_id,document_type_id)
  where status in ('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');
create index affiliate_documents_latest_type_idx
  on public.affiliate_documents(affiliate_id,document_type_id,created_at desc,id desc);

create or replace function public.register_affiliate_document(
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

  select d.id into v_replaced
  from public.affiliate_documents d
  where d.affiliate_id=v_affiliate and d.document_type_id=p_document_type_id
  order by d.created_at desc,d.id desc limit 1;

  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256);
  if v_asset.id is null then
    insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset;
  end if;

  update public.affiliate_documents
  set status='REJECTED',review_observation='Reemplazado por una nueva carga.',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
  where affiliate_id=v_affiliate and document_type_id=p_document_type_id
    and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');

  insert into public.affiliate_documents(
    affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id
  ) values(
    v_affiliate,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid(),v_replaced
  ) returning * into v_doc;

  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(
    auth.uid(),v_affiliate,'affiliate_documents',
    case when v_replaced is null then 'UPLOAD' else 'REPLACEMENT_UPLOAD' end,
    v_doc.id,
    jsonb_strip_nulls(jsonb_build_object(
      'document_type_id',p_document_type_id,'mime_type',p_mime_type,
      'file_size',p_file_size,'replaces_document_id',v_replaced
    ))
  );
  return v_doc;
end $$;

-- Availability is determined from metadata plus the physical Storage object.
-- It never downloads the file and never returns a path or signed URL.
create function public.get_affiliate_document_availability(p_document_ids uuid[])
returns table(document_id uuid,document_status text,available boolean,reason text)
language sql stable security definer set search_path=''
as $$
  select d.id,d.status,
    (pa.id is not null and pa.status='READY' and so.id is not null) as available,
    case
      when pa.id is null then 'ASSET_METADATA_MISSING'
      when pa.status<>'READY' then 'ASSET_DISABLED'
      when so.id is null then 'OBJECT_MISSING'
      else 'AVAILABLE'
    end as reason
  from public.affiliate_documents d
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  left join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  left join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.id=any(coalesce(p_document_ids,array[]::uuid[]))
    and (
      d.affiliate_id=public.get_effective_affiliate_id()
      or public.has_admin_permission('documents.read')
    );
$$;
revoke all on function public.get_affiliate_document_availability(uuid[]) from public,anon;
grant execute on function public.get_affiliate_document_availability(uuid[]) to authenticated;

-- Final request attachment fails closed if the selected row is not the newest
-- version or its physical object is absent. The enclosing request transaction
-- rolls back, so no partial financial request can survive.
create function public.enforce_request_document_availability()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_doc public.affiliate_documents%rowtype;
  v_asset_id uuid;
begin
  select * into v_doc from public.affiliate_documents where id=new.affiliate_document_id;
  if v_doc.id is null or v_doc.document_type_id<>new.document_type_id then
    raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023';
  end if;
  if exists(
    select 1 from public.affiliate_documents newer
    where newer.affiliate_id=v_doc.affiliate_id
      and newer.document_type_id=v_doc.document_type_id
      and (newer.created_at,newer.id)>(v_doc.created_at,v_doc.id)
  ) then
    raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023';
  end if;
  select coalesce(v_doc.private_asset_id,af.private_asset_id) into v_asset_id
  from public.affiliate_files af where af.id=v_doc.affiliate_file_id;
  v_asset_id:=coalesce(v_doc.private_asset_id,v_asset_id);
  if v_asset_id is null or v_asset_id<>new.private_asset_id or not exists(
    select 1 from public.private_assets pa
    join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
    where pa.id=v_asset_id and pa.status='READY'
  ) then
    raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023';
  end if;
  return new;
end $$;
revoke all on function public.enforce_request_document_availability() from public,anon,authenticated;

create trigger request_documents_require_available_object
before insert or update of affiliate_document_id,private_asset_id,document_type_id
on public.request_documents
for each row execute function public.enforce_request_document_availability();

comment on column public.affiliate_documents.replaces_document_id is
  'Previous immutable document version replaced by this affiliate upload; null for the first version.';

commit;
