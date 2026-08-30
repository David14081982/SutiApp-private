begin;

-- Context-bound audit for private affiliate-document metadata and previews.
-- Signed URLs and Storage paths are never persisted here.
create table public.document_access_audit_log (
  access_id uuid primary key default extensions.gen_random_uuid(),
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  effective_affiliate_id uuid null references public.affiliates(id) on delete restrict,
  target_affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  document_id uuid null references public.affiliate_documents(id) on delete restrict,
  action text not null check (action in ('LIST_METADATA','SIGN_PREVIEW')),
  purpose text not null check (purpose in (
    'SELF_SERVICE_EXPEDIENTE','SELF_SERVICE_LOAN','SELF_SERVICE_MEMBERSHIP',
    'ADMIN_DOCUMENT_REVIEW','ADMIN_AFFILIATE_PROFILE','ADMIN_FINANCIAL_REQUEST'
  )),
  context_mode text not null check (context_mode in ('SELF_SERVICE','ADMIN')),
  impersonation_session_id uuid null references public.impersonation_sessions(id) on delete restrict,
  access_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint document_access_context_check check (
    (context_mode='SELF_SERVICE' and purpose like 'SELF_SERVICE_%')
    or (context_mode='ADMIN' and purpose like 'ADMIN_%')
  )
);
create index document_access_audit_actor_created_idx
  on public.document_access_audit_log(actor_auth_user_id,created_at desc);
create index document_access_audit_target_created_idx
  on public.document_access_audit_log(target_affiliate_id,created_at desc);
create index document_access_audit_document_created_idx
  on public.document_access_audit_log(document_id,created_at desc)
  where document_id is not null;

alter table public.document_access_audit_log enable row level security;
alter table public.document_access_audit_log force row level security;
revoke all on public.document_access_audit_log from public,anon,authenticated;
grant select on public.document_access_audit_log to authenticated;
create policy document_access_audit_admin_read on public.document_access_audit_log
for select to authenticated using(public.has_admin_permission('documents.read'));

-- The projection deliberately omits Storage paths and signed URLs. The target
-- is always derived from the authenticated/impersonated server context.
create function public.list_effective_affiliate_documents(p_purpose text)
returns table(
  document_id uuid,affiliate_id uuid,document_type_id uuid,affiliate_file_id uuid,
  private_asset_id uuid,replaces_document_id uuid,document_status text,
  review_observation text,reviewed_at timestamptz,created_at timestamptz,updated_at timestamptz,
  document_type_code text,document_type_label text,document_type_description text,
  document_type_icon text,accepted_mime_types text[],mime_type text,sha256 text,
  available boolean,availability text,verification_provenance text
)
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_target uuid:=public.get_effective_affiliate_id();
  v_session uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if v_target is null then raise exception 'AFFILIATE_IDENTITY_REQUIRED' using errcode='42501'; end if;
  if p_purpose not in('SELF_SERVICE_EXPEDIENTE','SELF_SERVICE_LOAN','SELF_SERVICE_MEMBERSHIP') then
    raise exception 'INVALID_DOCUMENT_ACCESS_PURPOSE' using errcode='22023';
  end if;
  select s.id into v_session from public.impersonation_sessions s
   where s.actor_real_auth_user_id=v_actor and s.usuario_contexto_affiliate_id=v_target
     and s.ended_at is null and s.expires_at>now() limit 1;
  insert into public.document_access_audit_log(
    actor_auth_user_id,effective_affiliate_id,target_affiliate_id,action,purpose,
    context_mode,impersonation_session_id,access_context
  ) values(
    v_actor,v_target,v_target,'LIST_METADATA',p_purpose,'SELF_SERVICE',v_session,
    jsonb_build_object('source','list_effective_affiliate_documents')
  );
  return query
  select d.id,d.affiliate_id,d.document_type_id,d.affiliate_file_id,d.private_asset_id,
    d.replaces_document_id,d.status,d.review_observation,d.reviewed_at,d.created_at,d.updated_at,
    dt.code,dt.label,dt.description,dt.icon,dt.accepted_mime_types,pa.mime_type,
    coalesce(pa.content_sha256,af.sha256),
    (pa.id is not null and pa.status='READY' and so.id is not null),
    case when pa.id is null then 'ASSET_METADATA_MISSING'
      when pa.status<>'READY' then 'ASSET_DISABLED'
      when so.id is null then 'OBJECT_MISSING' else 'AVAILABLE' end,
    case when d.status='VERIFIED' and d.reviewed_by_auth_user_id is not null and d.reviewed_at is not null then 'HUMAN_REVIEWED'
      when d.status='VERIFIED' and d.affiliate_file_id is not null and d.reviewed_by_auth_user_id is null and d.reviewed_at is null then 'HISTORICAL_IMPORT'
      else 'WORKFLOW_STATUS' end
  from public.affiliate_documents d
  join public.document_types dt on dt.id=d.document_type_id
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  left join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  left join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.affiliate_id=v_target
  order by d.created_at desc,d.id desc;
end $$;

-- Admin metadata access is a distinct explicit-target contract. It preserves
-- documents.read without letting that capability widen a self-service query.
create function public.list_admin_affiliate_documents(p_target_affiliate_id uuid,p_purpose text)
returns table(
  document_id uuid,affiliate_id uuid,document_type_id uuid,affiliate_file_id uuid,
  private_asset_id uuid,replaces_document_id uuid,document_status text,
  review_observation text,reviewed_at timestamptz,created_at timestamptz,updated_at timestamptz,
  document_type_code text,document_type_label text,document_type_description text,
  document_type_icon text,accepted_mime_types text[],mime_type text,sha256 text,
  available boolean,availability text,verification_provenance text
)
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_effective uuid:=public.get_effective_affiliate_id();
  v_session uuid;
begin
  if v_actor is null or not public.has_admin_permission('documents.read') then
    raise exception 'ADMIN_DOCUMENT_ACCESS_DENIED' using errcode='42501';
  end if;
  if p_target_affiliate_id is null or not exists(select 1 from public.affiliates a where a.id=p_target_affiliate_id) then
    raise exception 'TARGET_AFFILIATE_REQUIRED' using errcode='22023';
  end if;
  if p_purpose not in('ADMIN_DOCUMENT_REVIEW','ADMIN_AFFILIATE_PROFILE','ADMIN_FINANCIAL_REQUEST') then
    raise exception 'INVALID_DOCUMENT_ACCESS_PURPOSE' using errcode='22023';
  end if;
  select s.id into v_session from public.impersonation_sessions s
   where s.actor_real_auth_user_id=v_actor and s.ended_at is null and s.expires_at>now() limit 1;
  insert into public.document_access_audit_log(
    actor_auth_user_id,effective_affiliate_id,target_affiliate_id,action,purpose,
    context_mode,impersonation_session_id,access_context
  ) values(
    v_actor,v_effective,p_target_affiliate_id,'LIST_METADATA',p_purpose,'ADMIN',v_session,
    jsonb_build_object('source','list_admin_affiliate_documents')
  );
  return query
  select d.id,d.affiliate_id,d.document_type_id,d.affiliate_file_id,d.private_asset_id,
    d.replaces_document_id,d.status,d.review_observation,d.reviewed_at,d.created_at,d.updated_at,
    dt.code,dt.label,dt.description,dt.icon,dt.accepted_mime_types,pa.mime_type,
    coalesce(pa.content_sha256,af.sha256),
    (pa.id is not null and pa.status='READY' and so.id is not null),
    case when pa.id is null then 'ASSET_METADATA_MISSING'
      when pa.status<>'READY' then 'ASSET_DISABLED'
      when so.id is null then 'OBJECT_MISSING' else 'AVAILABLE' end,
    case when d.status='VERIFIED' and d.reviewed_by_auth_user_id is not null and d.reviewed_at is not null then 'HUMAN_REVIEWED'
      when d.status='VERIFIED' and d.affiliate_file_id is not null and d.reviewed_by_auth_user_id is null and d.reviewed_at is null then 'HISTORICAL_IMPORT'
      else 'WORKFLOW_STATUS' end
  from public.affiliate_documents d
  join public.document_types dt on dt.id=d.document_type_id
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  left join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  left join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.affiliate_id=p_target_affiliate_id
  order by d.created_at desc,d.id desc;
end $$;

-- These authorization RPCs return one private path only to the trusted Edge.
-- Self-service never accepts an affiliate selector and never honors Admin read.
create function public.authorize_self_document_preview(p_document_id uuid,p_purpose text)
returns table(
  actor_auth_user_id uuid,effective_affiliate_id uuid,target_affiliate_id uuid,
  authorized_document_id uuid,storage_bucket text,storage_path text,mime_type text,
  impersonation_session_id uuid
)
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_target uuid:=public.get_effective_affiliate_id();
  v_session uuid;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if v_target is null then raise exception 'AFFILIATE_IDENTITY_REQUIRED' using errcode='42501'; end if;
  if p_purpose not in('SELF_SERVICE_EXPEDIENTE','SELF_SERVICE_LOAN','SELF_SERVICE_MEMBERSHIP') then
    raise exception 'INVALID_DOCUMENT_ACCESS_PURPOSE' using errcode='22023';
  end if;
  if not exists(select 1 from public.affiliate_documents d where d.id=p_document_id and d.affiliate_id=v_target) then
    raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';
  end if;
  select s.id into v_session from public.impersonation_sessions s
   where s.actor_real_auth_user_id=v_actor and s.usuario_contexto_affiliate_id=v_target
     and s.ended_at is null and s.expires_at>now() limit 1;
  return query
  select v_actor,v_target,v_target,d.id,pa.storage_bucket,pa.storage_path,pa.mime_type,v_session
  from public.affiliate_documents d
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id) and pa.status='READY'
  join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.id=p_document_id and d.affiliate_id=v_target and pa.storage_bucket='private-assets';
  if not found then raise exception 'DOCUMENT_OBJECT_MISSING' using errcode='P0001'; end if;
end $$;

create function public.authorize_admin_document_preview(
  p_document_id uuid,p_target_affiliate_id uuid,p_purpose text
)
returns table(
  actor_auth_user_id uuid,effective_affiliate_id uuid,target_affiliate_id uuid,
  authorized_document_id uuid,storage_bucket text,storage_path text,mime_type text,
  impersonation_session_id uuid
)
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_effective uuid:=public.get_effective_affiliate_id();
  v_session uuid;
begin
  if v_actor is null or not public.has_admin_permission('documents.read') then
    raise exception 'ADMIN_DOCUMENT_ACCESS_DENIED' using errcode='42501';
  end if;
  if p_target_affiliate_id is null then raise exception 'TARGET_AFFILIATE_REQUIRED' using errcode='22023'; end if;
  if p_purpose not in('ADMIN_DOCUMENT_REVIEW','ADMIN_AFFILIATE_PROFILE','ADMIN_FINANCIAL_REQUEST') then
    raise exception 'INVALID_DOCUMENT_ACCESS_PURPOSE' using errcode='22023';
  end if;
  if not exists(select 1 from public.affiliate_documents d where d.id=p_document_id and d.affiliate_id=p_target_affiliate_id) then
    raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';
  end if;
  select s.id into v_session from public.impersonation_sessions s
   where s.actor_real_auth_user_id=v_actor and s.ended_at is null and s.expires_at>now() limit 1;
  return query
  select v_actor,v_effective,p_target_affiliate_id,d.id,pa.storage_bucket,pa.storage_path,pa.mime_type,v_session
  from public.affiliate_documents d
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id) and pa.status='READY'
  join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.id=p_document_id and d.affiliate_id=p_target_affiliate_id and pa.storage_bucket='private-assets';
  if not found then raise exception 'DOCUMENT_OBJECT_MISSING' using errcode='P0001'; end if;
end $$;

revoke all on function public.list_effective_affiliate_documents(text),
  public.list_admin_affiliate_documents(uuid,text),
  public.authorize_self_document_preview(uuid,text),
  public.authorize_admin_document_preview(uuid,uuid,text)
from public,anon,authenticated;
grant execute on function public.list_effective_affiliate_documents(text),
  public.list_admin_affiliate_documents(uuid,text),
  public.authorize_self_document_preview(uuid,text),
  public.authorize_admin_document_preview(uuid,uuid,text)
to authenticated;

comment on table public.document_access_audit_log is
  'Append-only context audit for affiliate-document metadata access and successful preview signing; never stores URLs, tokens or Storage paths.';
comment on function public.list_effective_affiliate_documents(text) is
  'Self-service document projection bound server-side to the effective affiliate; Admin permissions never widen the result.';
comment on function public.list_admin_affiliate_documents(uuid,text) is
  'Explicit-target administrative document projection protected by documents.read.';

commit;
