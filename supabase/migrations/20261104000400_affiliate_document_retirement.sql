begin;
set local lock_timeout='3s';
set local statement_timeout='60s';

create schema document_retirement_private;
revoke all on schema document_retirement_private from public,anon,authenticated;
create table document_retirement_private.operations(
 id uuid primary key,affiliate_id uuid not null references public.affiliates(id),
 document_id uuid not null references public.affiliate_documents(id),
 actor_auth_user_id uuid not null references auth.users(id),effective_affiliate_id uuid,
 reason text not null check(length(btrim(reason)) between 8 and 500),
 fingerprint text not null,created_at timestamptz not null default now(),completed_at timestamptz
);
create table document_retirement_private.documents(
 document_id uuid primary key references public.affiliate_documents(id),
 operation_id uuid not null references document_retirement_private.operations(id),
 affiliate_file_id uuid references public.affiliate_files(id),asset_id uuid references public.private_assets(id)
);
create table document_retirement_private.assets(
 asset_id uuid primary key references public.private_assets(id),
 operation_id uuid not null references document_retirement_private.operations(id),
 storage_bucket text not null,original_path text not null,quarantine_path text not null unique,
 original_sha256 text,original_status text not null,
 unique(storage_bucket,original_path)
);
create table document_retirement_private.function_backup(signature text primary key,definition text not null,applied_md5 text);
-- Withdrawn hashes live in the private journal; active upload RPCs continue to
-- require a validated SHA-256. This releases deduplication for a corrected upload.
alter table public.private_assets alter column content_sha256 drop not null;
alter table public.private_assets add constraint private_assets_live_sha256_check check(status='DISABLED' or content_sha256 is not null);
alter table document_retirement_private.operations enable row level security;
alter table document_retirement_private.operations force row level security;
alter table document_retirement_private.documents enable row level security;
alter table document_retirement_private.documents force row level security;
alter table document_retirement_private.assets enable row level security;
alter table document_retirement_private.assets force row level security;
alter table document_retirement_private.function_backup enable row level security;
alter table document_retirement_private.function_backup force row level security;
revoke all on all tables in schema document_retirement_private from public,anon,authenticated,service_role;

create function public.affiliate_document_is_active(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from document_retirement_private.documents where document_id=p_id)
$$;
create function public.affiliate_document_asset_is_active(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from document_retirement_private.assets where asset_id=p_id)
$$;
create function public.affiliate_document_file_is_active(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from document_retirement_private.documents where affiliate_file_id=p_id)
$$;
create function public.affiliate_document_storage_is_active(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_bucket<>'private-assets' or (p_path not like 'retired-documents/%' and not exists(
  select 1 from document_retirement_private.assets where storage_bucket=p_bucket and original_path=p_path))
$$;
revoke all on function public.affiliate_document_is_active(uuid),public.affiliate_document_asset_is_active(uuid),public.affiliate_document_file_is_active(uuid),public.affiliate_document_storage_is_active(text,text) from public,anon;
grant execute on function public.affiliate_document_is_active(uuid),public.affiliate_document_asset_is_active(uuid),public.affiliate_document_file_is_active(uuid),public.affiliate_document_storage_is_active(text,text) to authenticated,service_role;
create policy document_retirement_filter on public.affiliate_documents as restrictive for select to authenticated using(public.affiliate_document_is_active(id));
create policy document_retirement_filter on public.affiliate_files as restrictive for select to authenticated using(public.affiliate_document_file_is_active(id) and public.affiliate_document_asset_is_active(private_asset_id));
create policy document_retirement_filter on public.private_assets as restrictive for select to authenticated using(public.affiliate_document_asset_is_active(id));
create policy document_retirement_filter on storage.objects as restrictive for select to authenticated using(public.affiliate_document_storage_is_active(bucket_id,name));
create view document_retirement_private.active_documents as select * from public.affiliate_documents where public.affiliate_document_is_active(id);
revoke all on document_retirement_private.active_documents from public,anon,authenticated,service_role;

create function document_retirement_private.authorized() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(admin_support_private.module_visible(auth.uid(),'affiliates'),false)
$$;

create function document_retirement_private.scope(p_affiliate uuid,p_document uuid)
returns table(document_id uuid,affiliate_file_id uuid,asset_id uuid)
language sql stable security definer set search_path='' as $$
 with recursive chain as (
  select d.*,array[d.id] visited from public.affiliate_documents d where d.id=p_document and d.affiliate_id=p_affiliate
  union all
  select d.*,c.visited||d.id from public.affiliate_documents d join chain c on c.replaces_document_id=d.id
  where d.affiliate_id=p_affiliate and d.document_type_id=c.document_type_id and not d.id=any(c.visited)
 ) select c.id,c.affiliate_file_id,coalesce(c.private_asset_id,af.private_asset_id)
 from chain c left join public.affiliate_files af on af.id=c.affiliate_file_id
 where public.affiliate_document_is_active(c.id)
$$;

create function public.preview_admin_affiliate_document_delete(p_affiliate_id uuid,p_document_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ids uuid[];assets uuid[];files uuid[];v_rows jsonb;v_fingerprint text;v_shared boolean;begin
 if not document_retirement_private.authorized() then raise exception 'AFFILIATE_DOCUMENT_DELETE_DENIED' using errcode='42501';end if;
 if not exists(select 1 from public.affiliate_documents where id=p_document_id and affiliate_id=p_affiliate_id and public.affiliate_document_is_active(id)) then raise exception 'DOCUMENT_CONTEXT_MISMATCH' using errcode='42501';end if;
 select array_agg(document_id order by document_id),array_agg(distinct asset_id) filter(where asset_id is not null),array_agg(distinct affiliate_file_id) filter(where affiliate_file_id is not null)
 into ids,assets,files from document_retirement_private.scope(p_affiliate_id,p_document_id);
 -- A broken/cross-affiliate predecessor link must never silently expand the scope.
 if exists(select 1 from public.affiliate_documents d join public.affiliate_documents prior on prior.id=d.replaces_document_id where d.id=any(ids) and (prior.affiliate_id<>p_affiliate_id or prior.document_type_id<>d.document_type_id)) then raise exception 'DOCUMENT_VERSION_SCOPE_INVALID';end if;
 select jsonb_agg(jsonb_build_object('id',d.id,'label',t.label,'created_at',d.created_at,'updated_at',d.updated_at,'status',d.status,'replaces_document_id',d.replaces_document_id) order by d.created_at desc,d.id desc),
 md5(string_agg(d.id::text||':'||d.updated_at::text||':'||coalesce(d.replaces_document_id::text,'')||':'||coalesce(s.asset_id::text,''),'|' order by d.id))
 into v_rows,v_fingerprint from document_retirement_private.scope(p_affiliate_id,p_document_id) s join public.affiliate_documents d on d.id=s.document_id join public.document_types t on t.id=d.document_type_id;
 v_shared:=exists(select 1 from public.affiliate_documents d left join public.affiliate_files af on af.id=d.affiliate_file_id
  where public.affiliate_document_is_active(d.id) and not d.id=any(ids) and (coalesce(d.private_asset_id,af.private_asset_id)=any(assets) or d.affiliate_file_id=any(files)))
 or exists(select 1 from public.affiliate_files f where f.private_asset_id=any(assets) and not f.id=any(coalesce(files,'{}'::uuid[])) and public.affiliate_document_file_is_active(f.id))
 or exists(select 1 from public.request_documents where affiliate_document_id=any(ids) or private_asset_id=any(assets))
 or exists(select 1 from public.savings_requests where supporting_document_id=any(ids))
 or exists(select 1 from public.program_terms_versions where private_asset_id=any(assets))
 or exists(select 1 from public.program_catalog_item_assets where private_asset_id=any(assets))
 or exists(select 1 from public.financial_programs where icon_asset_id=any(assets));
 return jsonb_build_object('affiliate_id',p_affiliate_id,'document_id',p_document_id,'documents',v_rows,'fingerprint',v_fingerprint,'blocked',v_shared,'blocker',case when v_shared then 'DOCUMENT_SHARED_REFERENCE' end);
end $$;

create function public.prepare_admin_affiliate_document_delete(p_affiliate_id uuid,p_document_id uuid,p_fingerprint text,p_reason text,p_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare report jsonb;v_op document_retirement_private.operations%rowtype;ids uuid[];assets uuid[];begin
 if not document_retirement_private.authorized() then raise exception 'AFFILIATE_DOCUMENT_DELETE_DENIED' using errcode='42501';end if;
 if p_action_id is null or length(btrim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'DOCUMENT_DELETE_REASON_REQUIRED' using errcode='22023';end if;
 -- Serialize retries before examining the immutable action identity.
 perform pg_advisory_xact_lock(hashtextextended(p_action_id::text,0));
 select * into v_op from document_retirement_private.operations where id=p_action_id;
 if found then
  if v_op.affiliate_id<>p_affiliate_id or v_op.document_id<>p_document_id or v_op.actor_auth_user_id<>auth.uid() or v_op.fingerprint is distinct from p_fingerprint or v_op.reason is distinct from btrim(p_reason) then raise exception 'DOCUMENT_DELETE_RETRY_MISMATCH' using errcode='42501';end if;
  return jsonb_build_object('operation_id',v_op.id,'status',case when v_op.completed_at is null then 'PENDING_STORAGE' else 'COMPLETE' end);
 end if;
 select array_agg(document_id),array_agg(distinct asset_id) filter(where asset_id is not null) into ids,assets from document_retirement_private.scope(p_affiliate_id,p_document_id);
 perform 1 from public.affiliate_documents where id=any(ids) order by id for update;
 perform 1 from public.private_assets where id=any(assets) order by id for update;
 report:=public.preview_admin_affiliate_document_delete(p_affiliate_id,p_document_id);
 if report->>'fingerprint' is distinct from p_fingerprint then raise exception 'DOCUMENT_DELETE_PREVIEW_STALE';end if;
 if (report->>'blocked')::boolean then raise exception 'DOCUMENT_SHARED_REFERENCE';end if;
 insert into document_retirement_private.operations(id,affiliate_id,document_id,actor_auth_user_id,effective_affiliate_id,reason,fingerprint)
 values(p_action_id,p_affiliate_id,p_document_id,auth.uid(),public.get_effective_affiliate_id(),btrim(p_reason),p_fingerprint);
 insert into document_retirement_private.documents(document_id,operation_id,affiliate_file_id,asset_id)
 select document_id,p_action_id,affiliate_file_id,asset_id from document_retirement_private.scope(p_affiliate_id,p_document_id);
 insert into document_retirement_private.assets(asset_id,operation_id,storage_bucket,original_path,quarantine_path,original_sha256,original_status)
 select pa.id,p_action_id,pa.storage_bucket,pa.storage_path,'retired-documents/'||p_action_id::text||'/'||pa.id::text,pa.content_sha256,pa.status
 from public.private_assets pa where pa.id=any(assets);
 -- Preserve the original hash privately while allowing the same bytes to be
 -- uploaded under their correct owner with a new, independent object/path.
 update public.private_assets set status='DISABLED',content_sha256=null where id=any(assets);
 insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
 values(auth.uid(),p_affiliate_id,'affiliate_documents','ADMIN_DOCUMENT_DELETE',p_document_id,
 jsonb_build_object('operation_id',p_action_id,'reason',btrim(p_reason),'document_ids',ids,'effective_affiliate_id',public.get_effective_affiliate_id(),'storage_state','PENDING_STORAGE'));
 return jsonb_build_object('operation_id',p_action_id,'status','PENDING_STORAGE');
end $$;

-- Only the trusted Edge can obtain Storage keys. User RPCs never return paths.
create function public.affiliate_document_delete_storage(p_operation_id uuid,p_actor_id uuid,p_finish boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare op document_retirement_private.operations%rowtype;begin
 if auth.role()<>'service_role' then raise exception 'DOCUMENT_DELETE_SERVICE_REQUIRED' using errcode='42501';end if;
 if not coalesce(admin_support_private.module_visible(p_actor_id,'affiliates'),false) then raise exception 'DOCUMENT_DELETE_OPERATION_DENIED' using errcode='42501';end if;
 select * into op from document_retirement_private.operations where id=p_operation_id for update;
 if not found then raise exception 'DOCUMENT_DELETE_OPERATION_DENIED' using errcode='42501';end if;
 if p_finish then
  if exists(select 1 from document_retirement_private.assets a join storage.objects o on o.bucket_id=a.storage_bucket and o.name=a.original_path where a.operation_id=op.id) then raise exception 'DOCUMENT_DELETE_STORAGE_PENDING';end if;
  if op.completed_at is null then
   update document_retirement_private.operations set completed_at=now() where id=op.id;
   insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
   values(p_actor_id,op.affiliate_id,'affiliate_documents','ADMIN_DOCUMENT_DELETE_COMPLETE',op.document_id,jsonb_build_object('operation_id',op.id));
  end if;
  return jsonb_build_object('operation_id',op.id,'status','COMPLETE');
 end if;
 return jsonb_build_object('operation_id',op.id,'status',case when op.completed_at is null then 'PENDING_STORAGE' else 'COMPLETE' end,'assets',coalesce((select jsonb_agg(jsonb_build_object('bucket',a.storage_bucket,'source',a.original_path,'destination',a.quarantine_path,'source_exists',exists(select 1 from storage.objects o where o.bucket_id=a.storage_bucket and o.name=a.original_path),'destination_exists',exists(select 1 from storage.objects o where o.bucket_id=a.storage_bucket and o.name=a.quarantine_path))) from document_retirement_private.assets a where a.operation_id=op.id),'[]'));
end $$;
revoke all on function public.preview_admin_affiliate_document_delete(uuid,uuid),public.prepare_admin_affiliate_document_delete(uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.preview_admin_affiliate_document_delete(uuid,uuid),public.prepare_admin_affiliate_document_delete(uuid,uuid,text,text,uuid) to authenticated;
revoke all on function public.affiliate_document_delete_storage(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.affiliate_document_delete_storage(uuid,uuid,boolean) to service_role;

create function public.resume_admin_affiliate_document_delete(p_affiliate_id uuid,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare op document_retirement_private.operations%rowtype;begin
 if not document_retirement_private.authorized() then raise exception 'AFFILIATE_DOCUMENT_DELETE_DENIED' using errcode='42501';end if;
 select * into op from document_retirement_private.operations where id=p_operation_id and affiliate_id=p_affiliate_id;
 if not found then raise exception 'DOCUMENT_DELETE_OPERATION_DENIED' using errcode='42501';end if;
 return jsonb_build_object('operation_id',op.id,'status',case when op.completed_at is null then 'PENDING_STORAGE' else 'COMPLETE' end);
end $$;
revoke all on function public.resume_admin_affiliate_document_delete(uuid,uuid) from public,anon;
grant execute on function public.resume_admin_affiliate_document_delete(uuid,uuid) to authenticated;

-- No writer, including a pre-existing definer RPC, may attach retired bytes or
-- review a withdrawn document. Asset locks serialize links with retirement.
create function document_retirement_private.guard_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare v uuid;kind text;begin
 for i in 0..tg_nargs-1 by 2 loop
  v:=nullif(to_jsonb(new)->>tg_argv[i],'')::uuid;kind:=tg_argv[i+1];
  if v is null then continue;end if;
  if tg_op='UPDATE' and tg_argv[i]<>'id' and (to_jsonb(old)->>tg_argv[i]) is not distinct from (to_jsonb(new)->>tg_argv[i]) then continue;end if;
  if kind='asset' then
   perform 1 from public.private_assets where id=v for key share;
   if not public.affiliate_document_asset_is_active(v) then raise exception 'DOCUMENT_RETIRED' using errcode='42501';end if;
  elsif kind='file' then
   perform 1 from public.affiliate_files where id=v for key share;
   if not public.affiliate_document_file_is_active(v) then raise exception 'DOCUMENT_RETIRED' using errcode='42501';end if;
  else
   perform 1 from public.affiliate_documents where id=v for key share;
   if not public.affiliate_document_is_active(v) then raise exception 'DOCUMENT_RETIRED' using errcode='42501';end if;
  end if;
 end loop;
 return new;
end $$;
create trigger retirement_reference_guard before insert or update on public.affiliate_documents for each row execute function document_retirement_private.guard_reference('id','document','private_asset_id','asset','affiliate_file_id','file','replaces_document_id','document');
create trigger retirement_reference_guard before insert or update on public.affiliate_files for each row execute function document_retirement_private.guard_reference('private_asset_id','asset');
create trigger retirement_reference_guard before insert or update on public.request_documents for each row execute function document_retirement_private.guard_reference('affiliate_document_id','document','private_asset_id','asset');
create trigger retirement_reference_guard before insert or update on public.savings_requests for each row execute function document_retirement_private.guard_reference('supporting_document_id','document');
create trigger retirement_reference_guard before insert or update on public.program_terms_versions for each row execute function document_retirement_private.guard_reference('private_asset_id','asset');
create trigger retirement_reference_guard before insert or update on public.program_catalog_item_assets for each row execute function document_retirement_private.guard_reference('private_asset_id','asset');
create trigger retirement_reference_guard before insert or update on public.financial_programs for each row execute function document_retirement_private.guard_reference('icon_asset_id','asset');

-- Exact captured reader/writer changes are appended by the scoped generator.
-- GENERATED_FUNCTIONS
do $guard$ begin if md5(pg_get_functiondef('get_admin_affiliate_workbench(uuid)'::regprocedure))<>'96499ab470210588cd484802ad10497f' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:get_admin_affiliate_workbench';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('get_admin_affiliate_workbench(uuid)',pg_get_functiondef('get_admin_affiliate_workbench(uuid)'::regprocedure));
CREATE OR REPLACE FUNCTION public.get_admin_affiliate_workbench(p_affiliate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile jsonb;v_options jsonb;v_documents jsonb;v_requests jsonb;v_audit jsonb;
  v_can_documents boolean;v_can_requests boolean;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  v_can_documents:=document_retirement_private.authorized() or public.has_admin_permission('documents.read') or public.has_admin_permission('assets.read');
  v_can_requests:=public.has_admin_permission('program_requests.read');
  select (to_jsonb(a)-array['auth_user_id','historical_email_normalized','source_file_hash','source_row_ordinal','financial_profile_updated_by','financial_profile_seed_source_hash','financial_profile_seed_row_ordinal']::text[])
    || jsonb_build_object('auth_linked',a.auth_user_id is not null)
  into v_profile from public.affiliates a where a.id=p_affiliate_id;
  if v_profile is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  select coalesce(jsonb_object_agg(catalog_type,items),'{}'::jsonb) into v_options from (
    select catalog_type,jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) items
    from public.segmentation_catalog_entries where enabled and catalog_type in('union','employment_category') group by catalog_type
  ) q;
  if v_can_documents then
    select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'type_id',d.document_type_id,'type_code',t.code,'type_label',t.label,
      'required',t.required_by_default,'status',d.status,'observation',d.review_observation,'created_at',d.created_at,'updated_at',d.updated_at)
      order by d.created_at desc),'[]'::jsonb) into v_documents
    from document_retirement_private.active_documents d join public.document_types t on t.id=d.document_type_id where d.affiliate_id=p_affiliate_id;
  end if;
  if v_can_requests then
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'folio',x.folio,'program_id',x.program_id,'request_type',x.request_type,
      'status',x.status,'financial_processing_status',x.financial_processing_status,'created_at',x.created_at,'updated_at',x.updated_at)
      order by x.created_at desc),'[]'::jsonb) into v_requests
    from (select * from public.program_requests where affiliate_id=p_affiliate_id order by created_at desc limit 50) x;
  end if;
  select coalesce(jsonb_agg(event order by event_at desc),'[]'::jsonb) into v_audit from (
    select e.created_at event_at,jsonb_build_object('id',e.event_id,'at',e.created_at,'action',e.action,'reason',e.reason,
      'actor',e.actor_auth_user_id,'changed_fields',e.changed_fields,'before',e.before_values,'after',e.after_values) event
    from public.affiliate_admin_events e where e.affiliate_id=p_affiliate_id
    union all
    select l.changed_at,jsonb_build_object('id',l.id,'at',l.changed_at,'action','PROFILE_FIELD_CHANGE','reason',l.reason,
      'actor',l.changed_by,'changed_fields',array[l.field_name],'before',jsonb_build_object(l.field_name,l.old_value),
      'after',jsonb_build_object(l.field_name,l.new_value))
    from public.affiliate_profile_audit_log l where l.affiliate_id=p_affiliate_id
    union all
    select o.created_at,jsonb_build_object('id',o.id,'at',o.created_at,'action','ADMIN_DOCUMENT_DELETE','reason',o.reason,'actor',o.actor_auth_user_id,'changed_fields',array['documents'],'before',jsonb_build_object('document_id',o.document_id),'after',jsonb_build_object('status',case when o.completed_at is null then 'PENDING_STORAGE' else 'COMPLETE' end)) from document_retirement_private.operations o where o.affiliate_id=p_affiliate_id
  ) q;
  return jsonb_build_object('profile',v_profile,'options',v_options,'documents',v_documents,'requests',v_requests,'audit',v_audit,
    'document_summary',jsonb_build_object('required_count',(select count(*) from public.document_types where enabled and required_by_default),'verified_required_count',(select count(*) from public.document_types t join lateral (select d.* from document_retirement_private.active_documents d where d.affiliate_id=p_affiliate_id and d.document_type_id=t.id order by d.created_at desc,d.id desc limit 1) latest on true left join public.affiliate_files af on af.id=latest.affiliate_file_id join public.private_assets pa on pa.id=coalesce(latest.private_asset_id,af.private_asset_id) and pa.status='READY' where t.enabled and t.required_by_default and latest.status='VERIFIED' and exists(select 1 from storage.objects so where so.bucket_id=pa.storage_bucket and so.name=pa.storage_path))),'empty_document_slots',coalesce((select jsonb_agg(s) from (select distinct d.document_type_id type_id,t.label type_label from document_retirement_private.documents r join public.affiliate_documents d on d.id=r.document_id join public.document_types t on t.id=d.document_type_id where d.affiliate_id=p_affiliate_id and not exists(select 1 from document_retirement_private.active_documents current_doc where current_doc.affiliate_id=p_affiliate_id and current_doc.document_type_id=d.document_type_id)) s),'[]'::jsonb),'pending_document_deletions',case when document_retirement_private.authorized() then coalesce((select jsonb_agg(jsonb_build_object('operation_id',o.id,'document_id',o.document_id,'created_at',o.created_at)) from document_retirement_private.operations o where o.affiliate_id=p_affiliate_id and o.completed_at is null),'[]'::jsonb) else '[]'::jsonb end,'capabilities',jsonb_build_object('documents',v_can_documents,'requests',v_can_requests));
end $function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('get_admin_affiliate_workbench(uuid)'::regprocedure)) where signature='get_admin_affiliate_workbench(uuid)';

do $guard$ begin if md5(pg_get_functiondef('list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text)'::regprocedure))<>'96a494c0de9581d547fa04f656afb8eb' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:list_admin_affiliates';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text)',pg_get_functiondef('list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text)'::regprocedure));
CREATE OR REPLACE FUNCTION public.list_admin_affiliates(p_query text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_auth_linked boolean DEFAULT NULL::boolean, p_document_state text DEFAULT NULL::text, p_has_pending_documents boolean DEFAULT NULL::boolean, p_union_code text DEFAULT NULL::text, p_category_code text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_sort text DEFAULT 'name'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_query text:=lower(btrim(coalesce(p_query,'')));v_page integer:=greatest(coalesce(p_page,1),1);v_page_size integer:=least(greatest(coalesce(p_page_size,25),10),100);v_result jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  if p_document_state is not null and upper(p_document_state) not in('COMPLETE','INCOMPLETE','NOT_CONFIGURED') then raise exception 'AFFILIATE_DOCUMENT_FILTER_INVALID' using errcode='22023'; end if;
  if coalesce(p_sort,'name') not in('name','control','recent') then raise exception 'AFFILIATE_SORT_INVALID' using errcode='22023'; end if;
  with required as(select count(*)::integer required_count from public.document_types where enabled and required_by_default),
  docs as(select d.affiliate_id,count(*) filter(where d.status<>'REJECTED')::integer document_count,count(*) filter(where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED'))::integer pending_document_count,count(distinct d.document_type_id) filter(where d.status='VERIFIED' and t.enabled and t.required_by_default)::integer verified_required_count from document_retirement_private.active_documents d join public.document_types t on t.id=d.document_type_id group by d.affiliate_id),
  requests as(select r.affiliate_id,count(*)::integer request_count,count(*) filter(where r.status in('submitted','in_review','requires_financial_processing'))::integer pending_request_count from public.program_requests r group by r.affiliate_id),
  base as(select a.id,a.numero_control,a.full_name,a.display_name,a.historical_email_raw,a.phone_raw,a.rfc_raw,a.curp_raw,a.affiliate_status_raw,a.affiliation_raw,a.financial_union_code,a.financial_employee_category_code,a.financial_affiliation_status,a.financial_employment_status,a.updated_at,a.record_origin,(a.auth_user_id is not null) auth_linked,coalesce(d.document_count,0) document_count,coalesce(d.pending_document_count,0) pending_document_count,coalesce(d.verified_required_count,0) verified_required_count,required.required_count,case when required.required_count=0 then 'NOT_CONFIGURED' when coalesce(d.verified_required_count,0)>=required.required_count then 'COMPLETE' else 'INCOMPLETE' end document_state,coalesce(r.request_count,0) request_count,coalesce(r.pending_request_count,0) pending_request_count,lower(coalesce(a.full_name,a.display_name,'')) sort_name from public.affiliates a cross join required left join docs d on d.affiliate_id=a.id left join requests r on r.affiliate_id=a.id where not a.is_archived),
  filtered as(select * from base b where (v_query='' or position(v_query in lower(concat_ws(' ',b.full_name,b.display_name,b.numero_control,b.historical_email_raw,b.phone_raw,b.rfc_raw,b.curp_raw)))>0) and (p_status is null or b.affiliate_status_raw=p_status) and (p_auth_linked is null or b.auth_linked=p_auth_linked) and (p_document_state is null or b.document_state=upper(p_document_state)) and (p_has_pending_documents is null or (b.pending_document_count>0)=p_has_pending_documents) and (p_union_code is null or b.financial_union_code=p_union_code) and (p_category_code is null or b.financial_employee_category_code=p_category_code)),
  page_rows as(select * from filtered order by case when p_sort='control' then coalesce(numero_control,'') end,case when p_sort='recent' then updated_at end desc,case when p_sort='name' then sort_name end,sort_name,id offset (v_page-1)*v_page_size limit v_page_size)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)-'sort_name') from(select * from page_rows)x),'[]'::jsonb),'total',(select count(*) from filtered),'page',v_page,'page_size',v_page_size,'filter_options',jsonb_build_object('statuses',coalesce((select jsonb_agg(value order by value) from(select distinct affiliate_status_raw value from public.affiliates where not is_archived and affiliate_status_raw is not null and btrim(affiliate_status_raw)<>'')s),'[]'::jsonb),'unions',coalesce((select jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) from public.segmentation_catalog_entries where catalog_type='union' and enabled),'[]'::jsonb),'categories',coalesce((select jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) from public.segmentation_catalog_entries where catalog_type='employment_category' and enabled),'[]'::jsonb))) into v_result;
  return v_result;
end $function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text)'::regprocedure)) where signature='list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text)';

do $guard$ begin if md5(pg_get_functiondef('list_admin_archived_affiliates(text,integer,integer,text)'::regprocedure))<>'c1226b13edde22532c90ccf19cee3314' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:list_admin_archived_affiliates';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('list_admin_archived_affiliates(text,integer,integer,text)',pg_get_functiondef('list_admin_archived_affiliates(text,integer,integer,text)'::regprocedure));
CREATE OR REPLACE FUNCTION public.list_admin_archived_affiliates(p_query text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_sort text DEFAULT 'recent'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_query text:=lower(btrim(coalesce(p_query,'')));v_page integer:=greatest(coalesce(p_page,1),1);v_page_size integer:=least(greatest(coalesce(p_page_size,25),10),100);v_result jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  if coalesce(p_sort,'recent') not in('name','control','recent') then raise exception 'AFFILIATE_SORT_INVALID' using errcode='22023'; end if;
  with docs as(select affiliate_id,count(*)::integer document_count from document_retirement_private.active_documents group by affiliate_id),requests as(select affiliate_id,count(*)::integer request_count from public.program_requests group by affiliate_id),base as(
    select a.id,a.numero_control,a.full_name,a.display_name,a.historical_email_raw,a.rfc_raw,a.curp_raw,a.affiliate_status_raw,a.archive_previous_status_raw,a.archived_at,a.archived_by_auth_user_id,a.archive_reason,a.updated_at,a.record_origin,(a.auth_user_id is not null) auth_linked,coalesce(d.document_count,0) document_count,coalesce(r.request_count,0) request_count,lower(coalesce(a.full_name,a.display_name,'')) sort_name
    from public.affiliates a left join docs d on d.affiliate_id=a.id left join requests r on r.affiliate_id=a.id where a.is_archived
  ),filtered as(select * from base b where v_query='' or position(v_query in lower(concat_ws(' ',b.full_name,b.display_name,b.numero_control,b.historical_email_raw,b.rfc_raw,b.curp_raw)))>0),page_rows as(
    select * from filtered order by case when p_sort='control' then coalesce(numero_control,'') end,case when p_sort='recent' then archived_at end desc,case when p_sort='name' then sort_name end,sort_name,id offset (v_page-1)*v_page_size limit v_page_size)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)-'sort_name') from(select * from page_rows)x),'[]'::jsonb),'total',(select count(*) from filtered),'page',v_page,'page_size',v_page_size,'filter_options','{}'::jsonb) into v_result;
  return v_result;
end $function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('list_admin_archived_affiliates(text,integer,integer,text)'::regprocedure)) where signature='list_admin_archived_affiliates(text,integer,integer,text)';

do $guard$ begin if md5(pg_get_functiondef('list_admin_affiliate_documents(uuid,text)'::regprocedure))<>'7ca8337bef947bfbddbc6a6764f5ea71' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:list_admin_affiliate_documents';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('list_admin_affiliate_documents(uuid,text)',pg_get_functiondef('list_admin_affiliate_documents(uuid,text)'::regprocedure));
CREATE OR REPLACE FUNCTION public.list_admin_affiliate_documents(p_target_affiliate_id uuid, p_purpose text)
 RETURNS TABLE(document_id uuid, affiliate_id uuid, document_type_id uuid, affiliate_file_id uuid, private_asset_id uuid, replaces_document_id uuid, document_status text, review_observation text, reviewed_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, document_type_code text, document_type_label text, document_type_description text, document_type_icon text, accepted_mime_types text[], mime_type text, sha256 text, available boolean, availability text, verification_provenance text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  from document_retirement_private.active_documents d
  join public.document_types dt on dt.id=d.document_type_id
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  left join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  left join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.affiliate_id=p_target_affiliate_id
  order by d.created_at desc,d.id desc;
end $function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('list_admin_affiliate_documents(uuid,text)'::regprocedure)) where signature='list_admin_affiliate_documents(uuid,text)';

do $guard$ begin if md5(pg_get_functiondef('list_effective_affiliate_documents(text)'::regprocedure))<>'2e7e71163f6549e0d619d415e54e0cf6' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:list_effective_affiliate_documents';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('list_effective_affiliate_documents(text)',pg_get_functiondef('list_effective_affiliate_documents(text)'::regprocedure));
CREATE OR REPLACE FUNCTION public.list_effective_affiliate_documents(p_purpose text)
 RETURNS TABLE(document_id uuid, affiliate_id uuid, document_type_id uuid, affiliate_file_id uuid, private_asset_id uuid, replaces_document_id uuid, document_status text, review_observation text, reviewed_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, document_type_code text, document_type_label text, document_type_description text, document_type_icon text, accepted_mime_types text[], mime_type text, sha256 text, available boolean, availability text, verification_provenance text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  from document_retirement_private.active_documents d
  join public.document_types dt on dt.id=d.document_type_id
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  left join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  left join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.affiliate_id=v_target
  order by d.created_at desc,d.id desc;
end $function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('list_effective_affiliate_documents(text)'::regprocedure)) where signature='list_effective_affiliate_documents(text)';

do $guard$ begin if md5(pg_get_functiondef('authorize_admin_document_preview(uuid,uuid,text)'::regprocedure))<>'cbae021a3636cd98161345f87e8246ec' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:authorize_admin_document_preview';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('authorize_admin_document_preview(uuid,uuid,text)',pg_get_functiondef('authorize_admin_document_preview(uuid,uuid,text)'::regprocedure));
CREATE OR REPLACE FUNCTION public.authorize_admin_document_preview(p_document_id uuid, p_target_affiliate_id uuid, p_purpose text)
 RETURNS TABLE(actor_auth_user_id uuid, effective_affiliate_id uuid, target_affiliate_id uuid, authorized_document_id uuid, storage_bucket text, storage_path text, mime_type text, impersonation_session_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not exists(select 1 from document_retirement_private.active_documents d where d.id=p_document_id and d.affiliate_id=p_target_affiliate_id) then
    raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';
  end if;
  select s.id into v_session from public.impersonation_sessions s
   where s.actor_real_auth_user_id=v_actor and s.ended_at is null and s.expires_at>now() limit 1;
  return query
  select v_actor,v_effective,p_target_affiliate_id,d.id,pa.storage_bucket,pa.storage_path,pa.mime_type,v_session
  from document_retirement_private.active_documents d
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id) and pa.status='READY'
  join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.id=p_document_id and d.affiliate_id=p_target_affiliate_id and pa.storage_bucket='private-assets';
  if not found then raise exception 'DOCUMENT_OBJECT_MISSING' using errcode='P0001'; end if;
end $function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('authorize_admin_document_preview(uuid,uuid,text)'::regprocedure)) where signature='authorize_admin_document_preview(uuid,uuid,text)';

do $guard$ begin if md5(pg_get_functiondef('authorize_self_document_preview(uuid,text)'::regprocedure))<>'bde2e211fb862668d272361bd229e5be' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:authorize_self_document_preview';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('authorize_self_document_preview(uuid,text)',pg_get_functiondef('authorize_self_document_preview(uuid,text)'::regprocedure));
CREATE OR REPLACE FUNCTION public.authorize_self_document_preview(p_document_id uuid, p_purpose text)
 RETURNS TABLE(actor_auth_user_id uuid, effective_affiliate_id uuid, target_affiliate_id uuid, authorized_document_id uuid, storage_bucket text, storage_path text, mime_type text, impersonation_session_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not exists(select 1 from document_retirement_private.active_documents d where d.id=p_document_id and d.affiliate_id=v_target) then
    raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';
  end if;
  select s.id into v_session from public.impersonation_sessions s
   where s.actor_real_auth_user_id=v_actor and s.usuario_contexto_affiliate_id=v_target
     and s.ended_at is null and s.expires_at>now() limit 1;
  return query
  select v_actor,v_target,v_target,d.id,pa.storage_bucket,pa.storage_path,pa.mime_type,v_session
  from document_retirement_private.active_documents d
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id) and pa.status='READY'
  join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.id=p_document_id and d.affiliate_id=v_target and pa.storage_bucket='private-assets';
  if not found then raise exception 'DOCUMENT_OBJECT_MISSING' using errcode='P0001'; end if;
end $function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('authorize_self_document_preview(uuid,text)'::regprocedure)) where signature='authorize_self_document_preview(uuid,text)';

do $guard$ begin if md5(pg_get_functiondef('get_affiliate_document_availability(uuid[])'::regprocedure))<>'9b12f6b031770338c6b179f5dc17cdf6' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:get_affiliate_document_availability';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('get_affiliate_document_availability(uuid[])',pg_get_functiondef('get_affiliate_document_availability(uuid[])'::regprocedure));
CREATE OR REPLACE FUNCTION public.get_affiliate_document_availability(p_document_ids uuid[])
 RETURNS TABLE(document_id uuid, document_status text, available boolean, reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select d.id,d.status,
    (pa.id is not null and pa.status='READY' and so.id is not null) as available,
    case
      when pa.id is null then 'ASSET_METADATA_MISSING'
      when pa.status<>'READY' then 'ASSET_DISABLED'
      when so.id is null then 'OBJECT_MISSING'
      else 'AVAILABLE'
    end as reason
  from document_retirement_private.active_documents d
  left join public.affiliate_files af on af.id=d.affiliate_file_id
  left join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  left join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.id=any(coalesce(p_document_ids,array[]::uuid[]))
    and (
      d.affiliate_id=public.get_effective_affiliate_id()
      or public.has_admin_permission('documents.read')
    );
$function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('get_affiliate_document_availability(uuid[])'::regprocedure)) where signature='get_affiliate_document_availability(uuid[])';

do $guard$ begin if md5(pg_get_functiondef('register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'::regprocedure))<>'e9d646240b1a6fe917d5fcdafa801aff' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:register_admin_affiliate_document';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)',pg_get_functiondef('register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'::regprocedure));
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
  select d.id into v_replaced from document_retirement_private.active_documents d where d.affiliate_id=p_affiliate_id and d.document_type_id=p_document_type_id order by d.created_at desc,d.id desc limit 1;
  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;
  if v_asset.id is null then begin
    insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset;
  exception when unique_violation then select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;end;end if;
  if v_asset.id is null then raise exception 'DOCUMENT_ASSET_REGISTRATION_FAILED'; end if;
  if v_asset.storage_path is distinct from v_path then v_cleanup_path:=v_path; end if;
  update public.affiliate_documents set status='REJECTED',review_observation='Reemplazado por una nueva carga administrativa.',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
   where public.affiliate_document_is_active(id) and affiliate_id=p_affiliate_id and document_type_id=p_document_type_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');
  insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id)
   values(p_affiliate_id,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid(),v_replaced) returning * into v_doc;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
   values(auth.uid(),p_affiliate_id,'affiliate_documents',case when v_replaced is null then 'ADMIN_UPLOAD' else 'ADMIN_REPLACEMENT_UPLOAD' end,v_doc.id,jsonb_strip_nulls(jsonb_build_object('document_type_id',p_document_type_id,'mime_type',p_mime_type,'file_size',p_file_size,'reason',v_reason,'replaces_document_id',v_replaced)));
  return jsonb_build_object('document',to_jsonb(v_doc),'cleanup_storage_path',v_cleanup_path);
end $function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'::regprocedure)) where signature='register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)';

do $guard$ begin if md5(pg_get_functiondef('register_affiliate_document(uuid,text,text,bigint,text,text)'::regprocedure))<>'964ad12dedb8a535ff7f9b702587d368' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:register_affiliate_document';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('register_affiliate_document(uuid,text,text,bigint,text,text)',pg_get_functiondef('register_affiliate_document(uuid,text,text,bigint,text,text)'::regprocedure));
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
  select d.id into v_replaced from document_retirement_private.active_documents d where d.affiliate_id=v_affiliate and d.document_type_id=p_document_type_id order by d.created_at desc,d.id desc limit 1;
  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256);
  if v_asset.id is null then insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset; end if;
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
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('register_affiliate_document(uuid,text,text,bigint,text,text)'::regprocedure)) where signature='register_affiliate_document(uuid,text,text,bigint,text,text)';

do $guard$ begin if md5(pg_get_functiondef('review_affiliate_document(uuid,text,text)'::regprocedure))<>'031fadffdf35f4516a61890b1647ce1d' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:review_affiliate_document';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('review_affiliate_document(uuid,text,text)',pg_get_functiondef('review_affiliate_document(uuid,text,text)'::regprocedure));
CREATE OR REPLACE FUNCTION public.review_affiliate_document(p_document_id uuid, p_status text, p_observation text DEFAULT NULL::text)
 RETURNS affiliate_documents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_doc public.affiliate_documents%rowtype; begin
  if not public.has_admin_permission('documents.write') then raise exception 'DOCUMENT_REVIEW_DENIED' using errcode='42501'; end if;
  if p_status not in('VERIFIED','REJECTED','REUPLOAD_REQUIRED') then raise exception 'INVALID_REVIEW_STATUS' using errcode='22023'; end if;
  update public.affiliate_documents set status=p_status,review_observation=nullif(left(btrim(coalesce(p_observation,'')),1000),''),reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
  where public.affiliate_document_is_active(id) and id=p_document_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') returning * into v_doc;
  if v_doc.id is null then raise exception 'DOCUMENT_NOT_REVIEWABLE' using errcode='P0001'; end if;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_doc.affiliate_id,'affiliate_documents','REVIEW',v_doc.id,jsonb_build_object('status',p_status,'has_observation',p_observation is not null));
  return v_doc;
end $function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('review_affiliate_document(uuid,text,text)'::regprocedure)) where signature='review_affiliate_document(uuid,text,text)';

do $guard$ begin if md5(pg_get_functiondef('refresh_affiliate_expediente_classification(uuid)'::regprocedure))<>'757da6a781ca11541459ee72a7207d45' then raise exception 'DOCUMENT_RETIREMENT_FUNCTION_DRIFT:refresh_affiliate_expediente_classification';end if;end $guard$;
insert into document_retirement_private.function_backup(signature,definition) values('refresh_affiliate_expediente_classification(uuid)',pg_get_functiondef('refresh_affiliate_expediente_classification(uuid)'::regprocedure));
CREATE OR REPLACE FUNCTION public.refresh_affiliate_expediente_classification(p_affiliate_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update public.affiliate_files af
  set expediente_classification = 'HISTORICAL_DOCUMENT_VERSION'
  where af.affiliate_id = p_affiliate_id
    and exists (
      select 1 from document_retirement_private.active_documents d
      where d.affiliate_file_id = af.id
    );

  update public.affiliate_files af
  set expediente_classification = 'CURRENT_DOCUMENT'
  where af.id in (
    select distinct on (d.document_type_id) d.affiliate_file_id
    from document_retirement_private.active_documents d
    where d.affiliate_id = p_affiliate_id
      and d.affiliate_file_id is not null
    order by d.document_type_id,d.created_at desc,d.id desc
  );
end;
$function$
;
update document_retirement_private.function_backup set applied_md5=md5(pg_get_functiondef('refresh_affiliate_expediente_classification(uuid)'::regprocedure)) where signature='refresh_affiliate_expediente_classification(uuid)';

notify pgrst,'reload schema';
commit;
