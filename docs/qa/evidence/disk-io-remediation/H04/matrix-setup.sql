-- All rows in this harness are rolled back. No Auth/affiliate row is changed.
create temporary table h04_actors(label text primary key,auth_id uuid,affiliate_id uuid) on commit drop;
insert into h04_actors
select case row_number() over(order by a.id) when 1 then 'owner' else 'other' end,u.id,a.id
from public.affiliates a join auth.users u on u.id=a.auth_user_id and u.email_confirmed_at is not null
where not a.is_archived and a.historical_email_normalized=lower(btrim(u.email))
 and (select count(*) from public.affiliates x where x.historical_email_normalized=a.historical_email_normalized)=1
 and not exists(select 1 from public.admin_assignments x where x.auth_user_id=u.id)
 and not exists(select 1 from public.impersonation_sessions s where s.actor_real_auth_user_id=u.id and s.ended_at is null)
order by a.id limit 2;
insert into h04_actors select 'principal',a.auth_user_id,null from public.admin_assignments a
join public.admin_roles r on r.id=a.role_id where a.enabled and r.enabled and r.code='principal_admin' limit 1;
create temporary table h04_objects(label text primary key,storage_path text,asset_id uuid,document_id uuid) on commit drop;
create temporary table h04_results(label text primary key,value jsonb) on commit drop;
create temporary table h04_ids(label text primary key,id uuid) on commit drop;
grant select on h04_actors,h04_objects,h04_ids to authenticated,anon;
grant select,insert on h04_results to authenticated,anon;
do $fixtures$
declare owner_id uuid;other_id uuid;reviewer uuid;type_id uuid;pa uuid;af uuid;doc uuid;item uuid;
 label text;object_path text;ordinal integer:=0;labels text[]:=array[
 'photo_current','direct_ine_verified','indirect_verified','direct_rejected',
 'rejected_with_current_photo','archived_file','direct_with_archived_file',
 'disabled_asset','disabled_file_indirect','old_verified_document',
 'program_enabled','program_disabled','program_link_disabled','program_asset_disabled',
 'orphan','indirect_file_other_owner'];
begin
 select affiliate_id into strict owner_id from h04_actors where h04_actors.label='owner';
 select affiliate_id into strict other_id from h04_actors where h04_actors.label='other';
 select auth_id into strict reviewer from h04_actors where h04_actors.label='principal';
 select id into strict type_id from public.document_types order by (code ilike '%INE%') desc,id limit 1;
 foreach label in array labels loop
  ordinal:=ordinal+1;pa:=extensions.gen_random_uuid();af:=null;doc:=null;
  object_path:='h04-rollback-only/'||pa::text;
  insert into public.private_assets(id,asset_key,asset_type,storage_bucket,storage_path,mime_type,file_size,content_sha256,status)
  values(pa,'h04_rollback_'||pa::text,'H04_PROBE','private-assets',object_path,'image/jpeg',1,upper(md5(pa::text)||md5(pa::text||':h04')),
   case when label in ('disabled_asset','program_asset_disabled') then 'DISABLED' else 'READY' end);
  insert into storage.objects(bucket_id,name,metadata) values('private-assets',object_path,'{"mimetype":"image/jpeg","size":1}'::jsonb);
  if label in ('photo_current','indirect_verified','rejected_with_current_photo','archived_file','direct_with_archived_file','disabled_file_indirect','indirect_file_other_owner') then
   insert into public.affiliate_files(affiliate_id,private_asset_id,classification,file_key,file_type,source_column,source_column_letter,
    storage_bucket,storage_path,mime_type,sha256,file_size,source_url,source_row_ordinal,source_file_hash,url_order,status,sort_order,expediente_classification)
   values(case when label='indirect_file_other_owner' then other_id else owner_id end,pa,'PRIVATE','profile_photo','IMAGE','H04','H04',
    'private-assets',object_path,'image/jpeg',upper(md5(pa::text)||md5(pa::text||':h04')),1,'https://example.invalid/h04-rollback',ordinal,repeat('B',64),1,
    case when label='disabled_file_indirect' then 'DISABLED' else 'READY' end,1,
    case when label in ('archived_file','direct_with_archived_file') then 'HISTORICAL_DOCUMENT_VERSION' else 'CURRENT_DOCUMENT' end) returning id into af;
  end if;
  if label not in ('photo_current','program_enabled','program_disabled','program_link_disabled','program_asset_disabled','orphan') then
   insert into public.affiliate_documents(affiliate_id,document_type_id,affiliate_file_id,private_asset_id,status,reviewed_by_auth_user_id,reviewed_at,created_at)
   values(owner_id,type_id,
    case when label in ('indirect_verified','archived_file','disabled_file_indirect','indirect_file_other_owner') then af else null end,
    case when label in ('indirect_verified','archived_file','disabled_file_indirect','indirect_file_other_owner') then null else pa end,
    case when label in ('direct_rejected','rejected_with_current_photo') then 'REJECTED' else 'VERIFIED' end,reviewer,now(),
    case when label='old_verified_document' then '1970-01-01'::timestamptz else now() end) returning id into doc;
  end if;
  if label like 'program_%' then
   insert into public.program_catalog_items(program_key,name,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash)
   values('computo','H04 rollback-only',label<>'program_disabled',1,'H04_PROBE','H04_ROLLBACK_ONLY',ordinal+100000,repeat('B',64)) returning id into item;
   insert into public.program_catalog_item_assets(item_id,private_asset_id,source_column,source_column_letter,enabled)
   values(item,pa,'H04','H04',label<>'program_link_disabled');
  end if;
  insert into h04_objects values(label,object_path,pa,doc);
 end loop;
end;
$fixtures$;
-- The existing document trigger classifies the latest document per type.
-- Normalize only our new rollback fixtures after all inserts so each label
-- represents its specified case, independently of UUID/timestamp ordering.
update public.affiliate_files af set expediente_classification=
 case when h.label in ('archived_file','direct_with_archived_file')
 then 'HISTORICAL_DOCUMENT_VERSION' else 'CURRENT_DOCUMENT' end
from h04_objects h where af.private_asset_id=h.asset_id;
create function pg_temp.h04_evaluate() returns jsonb language plpgsql security invoker set search_path='' as $evaluate$
declare result jsonb;item record;allowed boolean;
begin
 if current_user='anon' then
  result:=jsonb_build_object('_owner_context',false,'_assets_permission',false,'_documents_permission',false);
 else
  result:=jsonb_build_object('_owner_context',coalesce(public.get_effective_affiliate_id()=(select affiliate_id from pg_temp.h04_actors where label='owner'),false),
   '_assets_permission',public.has_admin_permission('assets.read'),'_documents_permission',public.has_admin_permission('documents.read'));
 end if;
 for item in select label,storage_path from pg_temp.h04_objects order by label loop
  begin
   select exists(select 1 from storage.objects o where o.bucket_id='private-assets' and o.name=item.storage_path) into allowed;
   result:=result||jsonb_build_object(item.label,allowed);
  exception when insufficient_privilege then
   result:=result||jsonb_build_object(item.label,'SQLSTATE:42501');
  end;
 end loop;
 return result;
end;
$evaluate$;
grant execute on function pg_temp.h04_evaluate() to authenticated,anon;
