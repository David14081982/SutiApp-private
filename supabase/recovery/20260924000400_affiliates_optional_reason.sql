begin;

set local lock_timeout='2s';

set local statement_timeout='60s';

-- Restore only while all existing history satisfies the former constraints. Never rewrite history.

do $guard$ begin if pg_get_functiondef('public.archive_admin_affiliate(uuid,timestamp with time zone,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.archive_admin_affiliate(p_affiliate_id uuid, p_expected_updated_at timestamp with time zone, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_reason text:=btrim(coalesce(p_reason,''''));
begin
  if not public.has_admin_permission(''affiliates.write'') then raise exception ''AFFILIATE_WRITE_DENIED'' using errcode=''42501''; end if;
  if length(v_reason)>500 then raise exception ''AFFILIATE_ARCHIVE_REASON_TOO_LONG'' using errcode=''22023''; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception ''AFFILIATE_NOT_FOUND'' using errcode=''P0001''; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception ''AFFILIATE_VERSION_CONFLICT'' using errcode=''PT409''; end if;
  if v_old.is_archived then raise exception ''AFFILIATE_ALREADY_ARCHIVED'' using errcode=''22023''; end if;
  update public.affiliates set is_archived=true,archived_at=now(),archived_by_auth_user_id=auth.uid(),
    archive_reason=v_reason,archive_previous_status_raw=coalesce(affiliate_status_raw,''Sin estado''),
    restored_at=null,restored_by_auth_user_id=null,restore_reason=null
  where id=p_affiliate_id returning * into v_new;
  update public.impersonation_sessions set ended_at=now(),ended_by_auth_user_id=auth.uid()
   where usuario_contexto_affiliate_id=p_affiliate_id and ended_at is null;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),''ARCHIVE'',
    jsonb_build_object(''is_archived'',false,''affiliate_status_raw'',v_old.affiliate_status_raw),
    jsonb_build_object(''is_archived'',true,''archived_at'',v_new.archived_at,''archive_previous_status_raw'',v_new.archive_previous_status_raw),
    array[''is_archived'',''archived_at'',''archived_by_auth_user_id'',''archive_reason'',''archive_previous_status_raw''],v_reason);
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $function$
' then raise exception 'OPTIONAL_REASON_FUNCTION_DRIFT:archive_admin_affiliate'; end if; end $guard$;

CREATE OR REPLACE FUNCTION public.archive_admin_affiliate(p_affiliate_id uuid, p_expected_updated_at timestamp with time zone, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_reason text:=btrim(coalesce(p_reason,''));
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_ARCHIVE_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='PT409'; end if;
  if v_old.is_archived then raise exception 'AFFILIATE_ALREADY_ARCHIVED' using errcode='22023'; end if;
  update public.affiliates set is_archived=true,archived_at=now(),archived_by_auth_user_id=auth.uid(),
    archive_reason=v_reason,archive_previous_status_raw=coalesce(affiliate_status_raw,'Sin estado'),
    restored_at=null,restored_by_auth_user_id=null,restore_reason=null
  where id=p_affiliate_id returning * into v_new;
  update public.impersonation_sessions set ended_at=now(),ended_by_auth_user_id=auth.uid()
   where usuario_contexto_affiliate_id=p_affiliate_id and ended_at is null;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),'ARCHIVE',
    jsonb_build_object('is_archived',false,'affiliate_status_raw',v_old.affiliate_status_raw),
    jsonb_build_object('is_archived',true,'archived_at',v_new.archived_at,'archive_previous_status_raw',v_new.archive_previous_status_raw),
    array['is_archived','archived_at','archived_by_auth_user_id','archive_reason','archive_previous_status_raw'],v_reason);
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $function$
;

do $guard$ begin if pg_get_functiondef('public.change_admin_affiliate_status(uuid,timestamp with time zone,text,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.change_admin_affiliate_status(p_affiliate_id uuid, p_expected_updated_at timestamp with time zone, p_new_status text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_status text:=btrim(coalesce(p_new_status,''''));v_reason text:=btrim(coalesce(p_reason,''''));
begin
  if not public.has_admin_permission(''affiliates.write'') then raise exception ''AFFILIATE_WRITE_DENIED'' using errcode=''42501''; end if;
  if length(v_reason)>500 then raise exception ''AFFILIATE_REASON_TOO_LONG'' using errcode=''22023''; end if;
  if v_status='''' or not exists(select 1 from public.affiliates where affiliate_status_raw=v_status) then raise exception ''AFFILIATE_STATUS_INVALID'' using errcode=''22023''; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception ''AFFILIATE_NOT_FOUND'' using errcode=''P0001''; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception ''AFFILIATE_VERSION_CONFLICT'' using errcode=''PT409''; end if;
  if v_old.affiliate_status_raw is not distinct from v_status then raise exception ''AFFILIATE_STATUS_NO_CHANGE'' using errcode=''22023''; end if;
  update public.affiliates set affiliate_status_raw=v_status where id=p_affiliate_id returning * into v_new;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),''STATUS_CHANGE'',jsonb_build_object(''affiliate_status_raw'',v_old.affiliate_status_raw),jsonb_build_object(''affiliate_status_raw'',v_new.affiliate_status_raw),array[''affiliate_status_raw''],v_reason);
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $function$
' then raise exception 'OPTIONAL_REASON_FUNCTION_DRIFT:change_admin_affiliate_status'; end if; end $guard$;

CREATE OR REPLACE FUNCTION public.change_admin_affiliate_status(p_affiliate_id uuid, p_expected_updated_at timestamp with time zone, p_new_status text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_status text:=btrim(coalesce(p_new_status,''));v_reason text:=btrim(coalesce(p_reason,''));
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_REASON_REQUIRED' using errcode='22023'; end if;
  if v_status='' or not exists(select 1 from public.affiliates where affiliate_status_raw=v_status) then raise exception 'AFFILIATE_STATUS_INVALID' using errcode='22023'; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='PT409'; end if;
  if v_old.affiliate_status_raw is not distinct from v_status then raise exception 'AFFILIATE_STATUS_NO_CHANGE' using errcode='22023'; end if;
  update public.affiliates set affiliate_status_raw=v_status where id=p_affiliate_id returning * into v_new;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),'STATUS_CHANGE',jsonb_build_object('affiliate_status_raw',v_old.affiliate_status_raw),jsonb_build_object('affiliate_status_raw',v_new.affiliate_status_raw),array['affiliate_status_raw'],v_reason);
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $function$
;

do $guard$ begin if pg_get_functiondef('public.create_admin_affiliate(jsonb,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.create_admin_affiliate(p_values jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare
  v_row public.affiliates%rowtype;v_duplicates jsonb;v_email text;v_eligibility text;v_reason text:=btrim(coalesce(p_reason,''''));
  v_status text:=nullif(btrim(p_values->>''affiliate_status_raw''),'''');
begin
  if not public.has_admin_permission(''affiliates.write'') then raise exception ''AFFILIATE_WRITE_DENIED'' using errcode=''42501''; end if;
  if jsonb_typeof(p_values)<>''object'' then raise exception ''AFFILIATE_VALUES_REQUIRED'' using errcode=''22023''; end if;
  if length(v_reason)>500 then raise exception ''AFFILIATE_REASON_TOO_LONG'' using errcode=''22023''; end if;
  if length(btrim(coalesce(p_values->>''numero_control'',''''))) not between 1 and 80 then raise exception ''AFFILIATE_CONTROL_REQUIRED'' using errcode=''22023''; end if;
  if length(btrim(coalesce(p_values->>''full_name'',''''))) not between 3 and 240 then raise exception ''AFFILIATE_NAME_REQUIRED'' using errcode=''22023''; end if;
  if v_status is null or not exists(select 1 from public.affiliates where affiliate_status_raw=v_status) then raise exception ''AFFILIATE_STATUS_INVALID'' using errcode=''22023''; end if;
  if nullif(btrim(p_values->>''financial_union_code''),'''') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type=''union'' and code=p_values->>''financial_union_code'' and enabled) then raise exception ''AFFILIATE_UNION_INVALID'' using errcode=''22023''; end if;
  if nullif(btrim(p_values->>''financial_employee_category_code''),'''') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type=''employment_category'' and code=p_values->>''financial_employee_category_code'' and enabled) then raise exception ''AFFILIATE_CATEGORY_INVALID'' using errcode=''22023''; end if;
  v_duplicates:=public.find_admin_affiliate_duplicates(p_values,null);
  if exists(select 1 from jsonb_array_elements(v_duplicates) d(value) where (d.value->''matches'') ?| array[''numero_control'',''rfc'',''curp'']) then
    raise exception ''AFFILIATE_DUPLICATE_REVIEW_REQUIRED'' using errcode=''23505'';
  end if;
  v_email:=nullif(lower(btrim(p_values->>''historical_email_raw'')),'''');
  v_eligibility:=case when v_email is null then ''missing_email'' when v_email!~ ''^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'' then ''invalid_email''
    when exists(select 1 from public.affiliates where historical_email_normalized=v_email) then ''duplicate_email'' else ''eligible'' end;
  insert into public.affiliates(
    numero_control,full_name,display_name,affiliate_status_raw,historical_email_raw,historical_email_normalized,phone_raw,address_raw,
    birth_date_raw,gender_raw,marital_status_raw,children_count_raw,rfc_raw,curp_raw,unit_raw,city_raw,employment_position_raw,
    employment_entry_date_raw,occupation_raw,institute_entry_date_raw,employment_area_raw,employment_level_raw,pension_raw,subdirectorate_raw,
    union_enrollment_date_raw,capture_date_raw,affiliation_raw,union_position_raw,termination_date_raw,financial_union_code,
    financial_employee_category_code,financial_employee_type,financial_affiliation_status,financial_employment_status,
    auth_eligibility,auth_ineligibility_reason,record_origin,source_row_ordinal,source_file_hash
  ) values(
    btrim(p_values->>''numero_control''),btrim(p_values->>''full_name''),nullif(btrim(p_values->>''display_name''),''''),v_status,
    nullif(btrim(p_values->>''historical_email_raw''),''''),v_email,nullif(btrim(p_values->>''phone_raw''),''''),nullif(btrim(p_values->>''address_raw''),''''),
    nullif(btrim(p_values->>''birth_date_raw''),''''),nullif(btrim(p_values->>''gender_raw''),''''),nullif(btrim(p_values->>''marital_status_raw''),''''),nullif(btrim(p_values->>''children_count_raw''),''''),
    nullif(upper(btrim(p_values->>''rfc_raw'')),''''),nullif(upper(btrim(p_values->>''curp_raw'')),''''),nullif(btrim(p_values->>''unit_raw''),''''),nullif(btrim(p_values->>''city_raw''),''''),
    nullif(btrim(p_values->>''employment_position_raw''),''''),nullif(btrim(p_values->>''employment_entry_date_raw''),''''),nullif(btrim(p_values->>''occupation_raw''),''''),nullif(btrim(p_values->>''institute_entry_date_raw''),''''),
    nullif(btrim(p_values->>''employment_area_raw''),''''),nullif(btrim(p_values->>''employment_level_raw''),''''),nullif(btrim(p_values->>''pension_raw''),''''),nullif(btrim(p_values->>''subdirectorate_raw''),''''),
    nullif(btrim(p_values->>''union_enrollment_date_raw''),''''),nullif(btrim(p_values->>''capture_date_raw''),''''),nullif(btrim(p_values->>''affiliation_raw''),''''),nullif(btrim(p_values->>''union_position_raw''),''''),
    nullif(btrim(p_values->>''termination_date_raw''),''''),nullif(btrim(p_values->>''financial_union_code''),''''),nullif(btrim(p_values->>''financial_employee_category_code''),''''),
    nullif(btrim(p_values->>''financial_employee_type''),''''),nullif(btrim(p_values->>''financial_affiliation_status''),''''),nullif(btrim(p_values->>''financial_employment_status''),''''),
    v_eligibility,case when v_eligibility=''eligible'' then null else v_eligibility end,''ADMIN_AFFILIATES'',null,null
  ) returning * into v_row;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(v_row.id,auth.uid(),''CREATE'',null,to_jsonb(v_row)-array[''auth_user_id'',''historical_email_normalized'',''source_file_hash'']::text[],
    array[''numero_control'',''full_name'',''affiliate_status_raw''],v_reason);
  return public.get_admin_affiliate_workbench(v_row.id);
end $function$
' then raise exception 'OPTIONAL_REASON_FUNCTION_DRIFT:create_admin_affiliate'; end if; end $guard$;

CREATE OR REPLACE FUNCTION public.create_admin_affiliate(p_values jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row public.affiliates%rowtype;v_duplicates jsonb;v_email text;v_eligibility text;v_reason text:=btrim(coalesce(p_reason,''));
  v_status text:=nullif(btrim(p_values->>'affiliate_status_raw'),'');
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_values)<>'object' then raise exception 'AFFILIATE_VALUES_REQUIRED' using errcode='22023'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_REASON_REQUIRED' using errcode='22023'; end if;
  if length(btrim(coalesce(p_values->>'numero_control',''))) not between 1 and 80 then raise exception 'AFFILIATE_CONTROL_REQUIRED' using errcode='22023'; end if;
  if length(btrim(coalesce(p_values->>'full_name',''))) not between 3 and 240 then raise exception 'AFFILIATE_NAME_REQUIRED' using errcode='22023'; end if;
  if v_status is null or not exists(select 1 from public.affiliates where affiliate_status_raw=v_status) then raise exception 'AFFILIATE_STATUS_INVALID' using errcode='22023'; end if;
  if nullif(btrim(p_values->>'financial_union_code'),'') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='union' and code=p_values->>'financial_union_code' and enabled) then raise exception 'AFFILIATE_UNION_INVALID' using errcode='22023'; end if;
  if nullif(btrim(p_values->>'financial_employee_category_code'),'') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='employment_category' and code=p_values->>'financial_employee_category_code' and enabled) then raise exception 'AFFILIATE_CATEGORY_INVALID' using errcode='22023'; end if;
  v_duplicates:=public.find_admin_affiliate_duplicates(p_values,null);
  if exists(select 1 from jsonb_array_elements(v_duplicates) d(value) where (d.value->'matches') ?| array['numero_control','rfc','curp']) then
    raise exception 'AFFILIATE_DUPLICATE_REVIEW_REQUIRED' using errcode='23505';
  end if;
  v_email:=nullif(lower(btrim(p_values->>'historical_email_raw')),'');
  v_eligibility:=case when v_email is null then 'missing_email' when v_email!~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then 'invalid_email'
    when exists(select 1 from public.affiliates where historical_email_normalized=v_email) then 'duplicate_email' else 'eligible' end;
  insert into public.affiliates(
    numero_control,full_name,display_name,affiliate_status_raw,historical_email_raw,historical_email_normalized,phone_raw,address_raw,
    birth_date_raw,gender_raw,marital_status_raw,children_count_raw,rfc_raw,curp_raw,unit_raw,city_raw,employment_position_raw,
    employment_entry_date_raw,occupation_raw,institute_entry_date_raw,employment_area_raw,employment_level_raw,pension_raw,subdirectorate_raw,
    union_enrollment_date_raw,capture_date_raw,affiliation_raw,union_position_raw,termination_date_raw,financial_union_code,
    financial_employee_category_code,financial_employee_type,financial_affiliation_status,financial_employment_status,
    auth_eligibility,auth_ineligibility_reason,record_origin,source_row_ordinal,source_file_hash
  ) values(
    btrim(p_values->>'numero_control'),btrim(p_values->>'full_name'),nullif(btrim(p_values->>'display_name'),''),v_status,
    nullif(btrim(p_values->>'historical_email_raw'),''),v_email,nullif(btrim(p_values->>'phone_raw'),''),nullif(btrim(p_values->>'address_raw'),''),
    nullif(btrim(p_values->>'birth_date_raw'),''),nullif(btrim(p_values->>'gender_raw'),''),nullif(btrim(p_values->>'marital_status_raw'),''),nullif(btrim(p_values->>'children_count_raw'),''),
    nullif(upper(btrim(p_values->>'rfc_raw')),''),nullif(upper(btrim(p_values->>'curp_raw')),''),nullif(btrim(p_values->>'unit_raw'),''),nullif(btrim(p_values->>'city_raw'),''),
    nullif(btrim(p_values->>'employment_position_raw'),''),nullif(btrim(p_values->>'employment_entry_date_raw'),''),nullif(btrim(p_values->>'occupation_raw'),''),nullif(btrim(p_values->>'institute_entry_date_raw'),''),
    nullif(btrim(p_values->>'employment_area_raw'),''),nullif(btrim(p_values->>'employment_level_raw'),''),nullif(btrim(p_values->>'pension_raw'),''),nullif(btrim(p_values->>'subdirectorate_raw'),''),
    nullif(btrim(p_values->>'union_enrollment_date_raw'),''),nullif(btrim(p_values->>'capture_date_raw'),''),nullif(btrim(p_values->>'affiliation_raw'),''),nullif(btrim(p_values->>'union_position_raw'),''),
    nullif(btrim(p_values->>'termination_date_raw'),''),nullif(btrim(p_values->>'financial_union_code'),''),nullif(btrim(p_values->>'financial_employee_category_code'),''),
    nullif(btrim(p_values->>'financial_employee_type'),''),nullif(btrim(p_values->>'financial_affiliation_status'),''),nullif(btrim(p_values->>'financial_employment_status'),''),
    v_eligibility,case when v_eligibility='eligible' then null else v_eligibility end,'ADMIN_AFFILIATES',null,null
  ) returning * into v_row;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(v_row.id,auth.uid(),'CREATE',null,to_jsonb(v_row)-array['auth_user_id','historical_email_normalized','source_file_hash']::text[],
    array['numero_control','full_name','affiliate_status_raw'],v_reason);
  return public.get_admin_affiliate_workbench(v_row.id);
end $function$
;

do $guard$ begin if pg_get_functiondef('public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.register_admin_affiliate_document(p_affiliate_id uuid, p_document_type_id uuid, p_storage_path text, p_mime_type text, p_file_size bigint, p_sha256 text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare v_type public.document_types%rowtype;v_asset public.private_assets%rowtype;v_doc public.affiliate_documents%rowtype;v_replaced uuid;v_path text:=btrim(coalesce(p_storage_path,''''));v_reason text:=btrim(coalesce(p_reason,''''));v_cleanup_path text;
begin
  if not public.has_admin_permission(''documents.write'') then raise exception ''ADMIN_DOCUMENT_WRITE_DENIED'' using errcode=''42501''; end if;
  if auth.uid() is null or not exists(select 1 from public.affiliates where id=p_affiliate_id) then raise exception ''AFFILIATE_NOT_FOUND'' using errcode=''22023''; end if;
  if length(v_reason)>500 then raise exception ''DOCUMENT_REASON_TOO_LONG'' using errcode=''22023''; end if;
  select * into v_type from public.document_types where id=p_document_type_id and enabled;
  if v_type.id is null then raise exception ''DOCUMENT_TYPE_UNAVAILABLE'' using errcode=''22023''; end if;
  if not v_type.file_upload_allowed or not(p_mime_type=any(v_type.accepted_mime_types)) or p_file_size<1 or p_file_size>v_type.max_file_size_bytes or upper(coalesce(p_sha256,''''))!~''^[A-F0-9]{64}$'' then raise exception ''INVALID_DOCUMENT_FILE'' using errcode=''22023''; end if;
  if v_path!~(''^affiliate-documents/''||p_affiliate_id::text||''/[A-Za-z0-9._-]+$'') then raise exception ''INVALID_STORAGE_PATH'' using errcode=''22023''; end if;
  if not exists(select 1 from storage.objects where bucket_id=''private-assets'' and name=v_path and owner_id=auth.uid()::text) then raise exception ''UPLOAD_NOT_FOUND'' using errcode=''22023''; end if;
  select d.id into v_replaced from public.affiliate_documents d where d.affiliate_id=p_affiliate_id and d.document_type_id=p_document_type_id order by d.created_at desc,d.id desc limit 1;
  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;
  if v_asset.id is null then begin
    insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values(''affiliate_document_''||replace(extensions.gen_random_uuid()::text,''-'',''''),''AFFILIATE_DOCUMENT'',v_type.label,''private-assets'',v_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset;
  exception when unique_violation then select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;end;end if;
  if v_asset.id is null then raise exception ''DOCUMENT_ASSET_REGISTRATION_FAILED''; end if;
  if v_asset.storage_path is distinct from v_path then v_cleanup_path:=v_path; end if;
  update public.affiliate_documents set status=''REJECTED'',review_observation=''Reemplazado por una nueva carga administrativa.'',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
   where affiliate_id=p_affiliate_id and document_type_id=p_document_type_id and status in(''PENDING_REVIEW'',''UNDER_REVIEW'',''REUPLOAD_REQUIRED'');
  insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id)
   values(p_affiliate_id,p_document_type_id,v_asset.id,''PENDING_REVIEW'',auth.uid(),v_replaced) returning * into v_doc;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
   values(auth.uid(),p_affiliate_id,''affiliate_documents'',case when v_replaced is null then ''ADMIN_UPLOAD'' else ''ADMIN_REPLACEMENT_UPLOAD'' end,v_doc.id,jsonb_strip_nulls(jsonb_build_object(''document_type_id'',p_document_type_id,''mime_type'',p_mime_type,''file_size'',p_file_size,''reason'',v_reason,''replaces_document_id'',v_replaced)));
  return jsonb_build_object(''document'',to_jsonb(v_doc),''cleanup_storage_path'',v_cleanup_path);
end $function$
' then raise exception 'OPTIONAL_REASON_FUNCTION_DRIFT:register_admin_affiliate_document'; end if; end $guard$;

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
  if length(v_reason) not between 8 and 500 then raise exception 'DOCUMENT_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_type from public.document_types where id=p_document_type_id and enabled;
  if v_type.id is null then raise exception 'DOCUMENT_TYPE_UNAVAILABLE' using errcode='22023'; end if;
  if not v_type.file_upload_allowed or not(p_mime_type=any(v_type.accepted_mime_types)) or p_file_size<1 or p_file_size>v_type.max_file_size_bytes or upper(coalesce(p_sha256,''))!~'^[A-F0-9]{64}$' then raise exception 'INVALID_DOCUMENT_FILE' using errcode='22023'; end if;
  if v_path!~('^affiliate-documents/'||p_affiliate_id::text||'/[A-Za-z0-9._-]+$') then raise exception 'INVALID_STORAGE_PATH' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text) then raise exception 'UPLOAD_NOT_FOUND' using errcode='22023'; end if;
  select d.id into v_replaced from public.affiliate_documents d where d.affiliate_id=p_affiliate_id and d.document_type_id=p_document_type_id order by d.created_at desc,d.id desc limit 1;
  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;
  if v_asset.id is null then begin
    insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset;
  exception when unique_violation then select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;end;end if;
  if v_asset.id is null then raise exception 'DOCUMENT_ASSET_REGISTRATION_FAILED'; end if;
  if v_asset.storage_path is distinct from v_path then v_cleanup_path:=v_path; end if;
  update public.affiliate_documents set status='REJECTED',review_observation='Reemplazado por una nueva carga administrativa.',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
   where affiliate_id=p_affiliate_id and document_type_id=p_document_type_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');
  insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id)
   values(p_affiliate_id,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid(),v_replaced) returning * into v_doc;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
   values(auth.uid(),p_affiliate_id,'affiliate_documents',case when v_replaced is null then 'ADMIN_UPLOAD' else 'ADMIN_REPLACEMENT_UPLOAD' end,v_doc.id,jsonb_strip_nulls(jsonb_build_object('document_type_id',p_document_type_id,'mime_type',p_mime_type,'file_size',p_file_size,'reason',v_reason,'replaces_document_id',v_replaced)));
  return jsonb_build_object('document',to_jsonb(v_doc),'cleanup_storage_path',v_cleanup_path);
end $function$
;

do $guard$ begin if pg_get_functiondef('public.restore_admin_affiliate(uuid,timestamp with time zone,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.restore_admin_affiliate(p_affiliate_id uuid, p_expected_updated_at timestamp with time zone, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_reason text:=btrim(coalesce(p_reason,''''));v_email text;v_eligibility text;
begin
  if not public.has_admin_permission(''affiliates.write'') then raise exception ''AFFILIATE_WRITE_DENIED'' using errcode=''42501''; end if;
  if length(v_reason)>500 then raise exception ''AFFILIATE_RESTORE_REASON_TOO_LONG'' using errcode=''22023''; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception ''AFFILIATE_NOT_FOUND'' using errcode=''P0001''; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception ''AFFILIATE_VERSION_CONFLICT'' using errcode=''PT409''; end if;
  if not v_old.is_archived then raise exception ''AFFILIATE_NOT_ARCHIVED'' using errcode=''22023''; end if;
  v_email:=v_old.historical_email_normalized;
  v_eligibility:=case when v_email is null then ''missing_email''
    when v_email!~ ''^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'' then ''invalid_email''
    when exists(select 1 from public.affiliates a where a.id<>p_affiliate_id and a.historical_email_normalized=v_email) then ''duplicate_email''
    else ''eligible'' end;
  update public.affiliates set is_archived=false,archived_at=null,archived_by_auth_user_id=null,
    archive_reason=null,archive_previous_status_raw=null,restored_at=now(),
    restored_by_auth_user_id=auth.uid(),restore_reason=v_reason,auth_eligibility=v_eligibility,
    auth_ineligibility_reason=case when v_eligibility=''eligible'' then null else v_eligibility end
  where id=p_affiliate_id returning * into v_new;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),''RESTORE'',
    jsonb_build_object(''is_archived'',true,''archived_at'',v_old.archived_at,''archive_previous_status_raw'',v_old.archive_previous_status_raw),
    jsonb_build_object(''is_archived'',false,''restored_at'',v_new.restored_at,''affiliate_status_raw'',v_new.affiliate_status_raw,''auth_eligibility'',v_new.auth_eligibility),
    array[''is_archived'',''restored_at'',''restored_by_auth_user_id'',''restore_reason'',''auth_eligibility''],v_reason);
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $function$
' then raise exception 'OPTIONAL_REASON_FUNCTION_DRIFT:restore_admin_affiliate'; end if; end $guard$;

CREATE OR REPLACE FUNCTION public.restore_admin_affiliate(p_affiliate_id uuid, p_expected_updated_at timestamp with time zone, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_reason text:=btrim(coalesce(p_reason,''));v_email text;v_eligibility text;
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_RESTORE_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='PT409'; end if;
  if not v_old.is_archived then raise exception 'AFFILIATE_NOT_ARCHIVED' using errcode='22023'; end if;
  v_email:=v_old.historical_email_normalized;
  v_eligibility:=case when v_email is null then 'missing_email'
    when v_email!~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then 'invalid_email'
    when exists(select 1 from public.affiliates a where a.id<>p_affiliate_id and a.historical_email_normalized=v_email) then 'duplicate_email'
    else 'eligible' end;
  update public.affiliates set is_archived=false,archived_at=null,archived_by_auth_user_id=null,
    archive_reason=null,archive_previous_status_raw=null,restored_at=now(),
    restored_by_auth_user_id=auth.uid(),restore_reason=v_reason,auth_eligibility=v_eligibility,
    auth_ineligibility_reason=case when v_eligibility='eligible' then null else v_eligibility end
  where id=p_affiliate_id returning * into v_new;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),'RESTORE',
    jsonb_build_object('is_archived',true,'archived_at',v_old.archived_at,'archive_previous_status_raw',v_old.archive_previous_status_raw),
    jsonb_build_object('is_archived',false,'restored_at',v_new.restored_at,'affiliate_status_raw',v_new.affiliate_status_raw,'auth_eligibility',v_new.auth_eligibility),
    array['is_archived','restored_at','restored_by_auth_user_id','restore_reason','auth_eligibility'],v_reason);
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $function$
;

do $guard$ begin if pg_get_functiondef('public.start_affiliate_impersonation(uuid,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.start_affiliate_impersonation(p_affiliate_id uuid, p_reason text)
 RETURNS TABLE(session_id uuid, affiliate_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$

declare
  v_actor uuid:=auth.uid();v_auth_session text:=nullif(auth.jwt()->>''session_id'','''');v_created public.impersonation_sessions%rowtype;v_archived boolean;
begin
  if v_actor is null or not public.admin_actor_can_impersonate() then raise exception ''IMPERSONATION_DENIED'' using errcode=''42501''; end if;
  if v_auth_session is null then raise exception ''AUTH_SESSION_REQUIRED'' using errcode=''42501''; end if;
  if char_length(btrim(coalesce(p_reason,'''')))>500 then raise exception ''REASON_TOO_LONG'' using errcode=''22023''; end if;
  select a.is_archived into v_archived from public.affiliates a where a.id=p_affiliate_id;
  if v_archived is null then raise exception ''AFFILIATE_NOT_FOUND'' using errcode=''P0001''; end if;
  if v_archived then raise exception ''AFFILIATE_ARCHIVED'' using errcode=''42501''; end if;
  with closed as (
    update public.impersonation_sessions s set ended_at=now(),ended_by_auth_user_id=v_actor
    where s.actor_real_auth_user_id=v_actor and s.ended_at is null
      and (s.expires_at<=now() or s.actor_auth_session_id is distinct from v_auth_session)
    returning s.*
  ) insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
    select v_actor,c.usuario_contexto_affiliate_id,''IMPERSONATION_STOPPED'',''SUCCESS'',jsonb_build_object(
      ''session_id'',c.id,''reason'',c.reason,''automatic'',true,''cause'',''AUTH_SESSION_REPLACED_OR_EXPIRED'') from closed c;
  if exists(select 1 from public.impersonation_sessions s where s.actor_real_auth_user_id=v_actor and s.ended_at is null) then
    raise exception ''IMPERSONATION_ALREADY_ACTIVE'' using errcode=''P0001'';
  end if;
  insert into public.impersonation_sessions(actor_real_auth_user_id,usuario_contexto_affiliate_id,reason,expires_at,actor_auth_session_id)
  values(v_actor,p_affiliate_id,btrim(coalesce(p_reason,'''')),now()+interval ''30 minutes'',v_auth_session) returning * into v_created;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(v_actor,p_affiliate_id,''IMPERSONATION_STARTED'',''SUCCESS'',jsonb_build_object(
    ''session_id'',v_created.id,''expires_at'',v_created.expires_at,''reason'',v_created.reason,
    ''actor_auth_session_id'',v_auth_session,''scope'',''ASSISTED_AFFILIATE_SERVICE''));
  return query select v_created.id,v_created.usuario_contexto_affiliate_id,v_created.expires_at;
end 
$function$
' then raise exception 'OPTIONAL_REASON_FUNCTION_DRIFT:start_affiliate_impersonation'; end if; end $guard$;

CREATE OR REPLACE FUNCTION public.start_affiliate_impersonation(p_affiliate_id uuid, p_reason text)
 RETURNS TABLE(session_id uuid, affiliate_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare
  v_actor uuid:=auth.uid();v_auth_session text:=nullif(auth.jwt()->>'session_id','');v_created public.impersonation_sessions%rowtype;v_archived boolean;
begin
  if v_actor is null or not public.admin_actor_can_impersonate() then raise exception 'IMPERSONATION_DENIED' using errcode='42501'; end if;
  if v_auth_session is null then raise exception 'AUTH_SESSION_REQUIRED' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<8 then raise exception 'REASON_REQUIRED' using errcode='22023'; end if;
  select a.is_archived into v_archived from public.affiliates a where a.id=p_affiliate_id;
  if v_archived is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_archived then raise exception 'AFFILIATE_ARCHIVED' using errcode='42501'; end if;
  with closed as (
    update public.impersonation_sessions s set ended_at=now(),ended_by_auth_user_id=v_actor
    where s.actor_real_auth_user_id=v_actor and s.ended_at is null
      and (s.expires_at<=now() or s.actor_auth_session_id is distinct from v_auth_session)
    returning s.*
  ) insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
    select v_actor,c.usuario_contexto_affiliate_id,'IMPERSONATION_STOPPED','SUCCESS',jsonb_build_object(
      'session_id',c.id,'reason',c.reason,'automatic',true,'cause','AUTH_SESSION_REPLACED_OR_EXPIRED') from closed c;
  if exists(select 1 from public.impersonation_sessions s where s.actor_real_auth_user_id=v_actor and s.ended_at is null) then
    raise exception 'IMPERSONATION_ALREADY_ACTIVE' using errcode='P0001';
  end if;
  insert into public.impersonation_sessions(actor_real_auth_user_id,usuario_contexto_affiliate_id,reason,expires_at,actor_auth_session_id)
  values(v_actor,p_affiliate_id,btrim(p_reason),now()+interval '30 minutes',v_auth_session) returning * into v_created;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(v_actor,p_affiliate_id,'IMPERSONATION_STARTED','SUCCESS',jsonb_build_object(
    'session_id',v_created.id,'expires_at',v_created.expires_at,'reason',v_created.reason,
    'actor_auth_session_id',v_auth_session,'scope','ASSISTED_AFFILIATE_SERVICE'));
  return query select v_created.id,v_created.usuario_contexto_affiliate_id,v_created.expires_at;
end 
$function$
;

do $guard$ begin if pg_get_functiondef('public.update_admin_affiliate(uuid,timestamp with time zone,jsonb,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.update_admin_affiliate(p_affiliate_id uuid, p_expected_updated_at timestamp with time zone, p_patch jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare
  v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_key text;v_value text;v_reason text:=btrim(coalesce(p_reason,''''));
  v_allowed constant text[]:=array[''full_name'',''display_name'',''historical_email_raw'',''phone_raw'',''address_raw'',''birth_date_raw'',''gender_raw'',''marital_status_raw'',''children_count_raw'',''rfc_raw'',''curp_raw'',''unit_raw'',''city_raw'',''employment_position_raw'',''employment_entry_date_raw'',''occupation_raw'',''institute_entry_date_raw'',''employment_area_raw'',''employment_level_raw'',''pension_raw'',''subdirectorate_raw'',''union_enrollment_date_raw'',''capture_date_raw'',''affiliation_raw'',''union_position_raw'',''termination_date_raw'',''financial_union_code'',''financial_employee_category_code'',''financial_employee_type'',''financial_affiliation_status'',''financial_employment_status''];
  v_profile_fields constant text[]:=array[''full_name'',''display_name'',''phone_raw'',''unit_raw'',''city_raw'',''employment_position_raw'',''employment_area_raw'',''financial_union_code'',''financial_employee_category_code'',''financial_employee_type'',''financial_affiliation_status'',''financial_employment_status''];
  v_changed text[]:=array[]::text[];v_before jsonb:=''{}''::jsonb;v_after jsonb:=''{}''::jsonb;v_profile_change boolean:=false;v_email text;v_eligibility text;
begin
  if not public.has_admin_permission(''affiliates.write'') then raise exception ''AFFILIATE_WRITE_DENIED'' using errcode=''42501''; end if;
  if jsonb_typeof(p_patch)<>''object'' or p_patch=''{}''::jsonb then raise exception ''AFFILIATE_PATCH_REQUIRED'' using errcode=''22023''; end if;
  if length(v_reason)>500 then raise exception ''AFFILIATE_REASON_TOO_LONG'' using errcode=''22023''; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception ''AFFILIATE_NOT_FOUND'' using errcode=''P0001''; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception ''AFFILIATE_VERSION_CONFLICT'' using errcode=''PT409''; end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if not(v_key=any(v_allowed)) then raise exception ''AFFILIATE_FIELD_DENIED: %'',v_key using errcode=''22023''; end if;
    v_value:=nullif(btrim(p_patch->>v_key),'''');
    if v_key in (''rfc_raw'',''curp_raw'') then v_value:=upper(v_value); end if;
    if to_jsonb(v_old)->>v_key is distinct from v_value then
      v_changed:=array_append(v_changed,v_key);v_before:=v_before||jsonb_build_object(v_key,to_jsonb(v_old)->v_key);v_after:=v_after||jsonb_build_object(v_key,to_jsonb(v_value));
      if v_key=any(v_profile_fields) then v_profile_change:=true; end if;
    end if;
  end loop;
  if cardinality(v_changed)=0 then raise exception ''AFFILIATE_NO_CHANGE'' using errcode=''22023''; end if;
  if p_patch?''rfc_raw'' and nullif(upper(btrim(p_patch->>''rfc_raw'')),'''') is not null and exists(select 1 from public.affiliates where id<>p_affiliate_id and upper(btrim(rfc_raw))=upper(btrim(p_patch->>''rfc_raw''))) then raise exception ''AFFILIATE_RFC_DUPLICATE'' using errcode=''23505''; end if;
  if p_patch?''curp_raw'' and nullif(upper(btrim(p_patch->>''curp_raw'')),'''') is not null and exists(select 1 from public.affiliates where id<>p_affiliate_id and upper(btrim(curp_raw))=upper(btrim(p_patch->>''curp_raw''))) then raise exception ''AFFILIATE_CURP_DUPLICATE'' using errcode=''23505''; end if;
  if p_patch?''financial_union_code'' and nullif(btrim(p_patch->>''financial_union_code''),'''') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type=''union'' and code=p_patch->>''financial_union_code'' and enabled) then raise exception ''AFFILIATE_UNION_INVALID'' using errcode=''22023''; end if;
  if p_patch?''financial_employee_category_code'' and nullif(btrim(p_patch->>''financial_employee_category_code''),'''') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type=''employment_category'' and code=p_patch->>''financial_employee_category_code'' and enabled) then raise exception ''AFFILIATE_CATEGORY_INVALID'' using errcode=''22023''; end if;
  v_email:=case when p_patch?''historical_email_raw'' then nullif(lower(btrim(p_patch->>''historical_email_raw'')),'''') else v_old.historical_email_normalized end;
  v_eligibility:=case when v_old.auth_user_id is not null then v_old.auth_eligibility when v_email is null then ''missing_email''
    when v_email!~ ''^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'' then ''invalid_email''
    when exists(select 1 from public.affiliates where id<>p_affiliate_id and historical_email_normalized=v_email) then ''duplicate_email'' else ''eligible'' end;
  update public.affiliates set
    full_name=case when p_patch?''full_name'' then nullif(btrim(p_patch->>''full_name''),'''') else full_name end,
    display_name=case when p_patch?''display_name'' then nullif(btrim(p_patch->>''display_name''),'''') else display_name end,
    historical_email_raw=case when p_patch?''historical_email_raw'' then nullif(btrim(p_patch->>''historical_email_raw''),'''') else historical_email_raw end,
    historical_email_normalized=case when p_patch?''historical_email_raw'' then v_email else historical_email_normalized end,
    phone_raw=case when p_patch?''phone_raw'' then nullif(btrim(p_patch->>''phone_raw''),'''') else phone_raw end,
    address_raw=case when p_patch?''address_raw'' then nullif(btrim(p_patch->>''address_raw''),'''') else address_raw end,
    birth_date_raw=case when p_patch?''birth_date_raw'' then nullif(btrim(p_patch->>''birth_date_raw''),'''') else birth_date_raw end,
    gender_raw=case when p_patch?''gender_raw'' then nullif(btrim(p_patch->>''gender_raw''),'''') else gender_raw end,
    marital_status_raw=case when p_patch?''marital_status_raw'' then nullif(btrim(p_patch->>''marital_status_raw''),'''') else marital_status_raw end,
    children_count_raw=case when p_patch?''children_count_raw'' then nullif(btrim(p_patch->>''children_count_raw''),'''') else children_count_raw end,
    rfc_raw=case when p_patch?''rfc_raw'' then nullif(upper(btrim(p_patch->>''rfc_raw'')),'''') else rfc_raw end,
    curp_raw=case when p_patch?''curp_raw'' then nullif(upper(btrim(p_patch->>''curp_raw'')),'''') else curp_raw end,
    unit_raw=case when p_patch?''unit_raw'' then nullif(btrim(p_patch->>''unit_raw''),'''') else unit_raw end,
    city_raw=case when p_patch?''city_raw'' then nullif(btrim(p_patch->>''city_raw''),'''') else city_raw end,
    employment_position_raw=case when p_patch?''employment_position_raw'' then nullif(btrim(p_patch->>''employment_position_raw''),'''') else employment_position_raw end,
    employment_entry_date_raw=case when p_patch?''employment_entry_date_raw'' then nullif(btrim(p_patch->>''employment_entry_date_raw''),'''') else employment_entry_date_raw end,
    occupation_raw=case when p_patch?''occupation_raw'' then nullif(btrim(p_patch->>''occupation_raw''),'''') else occupation_raw end,
    institute_entry_date_raw=case when p_patch?''institute_entry_date_raw'' then nullif(btrim(p_patch->>''institute_entry_date_raw''),'''') else institute_entry_date_raw end,
    employment_area_raw=case when p_patch?''employment_area_raw'' then nullif(btrim(p_patch->>''employment_area_raw''),'''') else employment_area_raw end,
    employment_level_raw=case when p_patch?''employment_level_raw'' then nullif(btrim(p_patch->>''employment_level_raw''),'''') else employment_level_raw end,
    pension_raw=case when p_patch?''pension_raw'' then nullif(btrim(p_patch->>''pension_raw''),'''') else pension_raw end,
    subdirectorate_raw=case when p_patch?''subdirectorate_raw'' then nullif(btrim(p_patch->>''subdirectorate_raw''),'''') else subdirectorate_raw end,
    union_enrollment_date_raw=case when p_patch?''union_enrollment_date_raw'' then nullif(btrim(p_patch->>''union_enrollment_date_raw''),'''') else union_enrollment_date_raw end,
    capture_date_raw=case when p_patch?''capture_date_raw'' then nullif(btrim(p_patch->>''capture_date_raw''),'''') else capture_date_raw end,
    affiliation_raw=case when p_patch?''affiliation_raw'' then nullif(btrim(p_patch->>''affiliation_raw''),'''') else affiliation_raw end,
    union_position_raw=case when p_patch?''union_position_raw'' then nullif(btrim(p_patch->>''union_position_raw''),'''') else union_position_raw end,
    termination_date_raw=case when p_patch?''termination_date_raw'' then nullif(btrim(p_patch->>''termination_date_raw''),'''') else termination_date_raw end,
    financial_union_code=case when p_patch?''financial_union_code'' then nullif(btrim(p_patch->>''financial_union_code''),'''') else financial_union_code end,
    financial_employee_category_code=case when p_patch?''financial_employee_category_code'' then nullif(btrim(p_patch->>''financial_employee_category_code''),'''') else financial_employee_category_code end,
    financial_employee_type=case when p_patch?''financial_employee_type'' then nullif(btrim(p_patch->>''financial_employee_type''),'''') else financial_employee_type end,
    financial_affiliation_status=case when p_patch?''financial_affiliation_status'' then nullif(btrim(p_patch->>''financial_affiliation_status''),'''') else financial_affiliation_status end,
    financial_employment_status=case when p_patch?''financial_employment_status'' then nullif(btrim(p_patch->>''financial_employment_status''),'''') else financial_employment_status end,
    auth_eligibility=case when p_patch?''historical_email_raw'' and auth_user_id is null then v_eligibility else auth_eligibility end,
    auth_ineligibility_reason=case when p_patch?''historical_email_raw'' and auth_user_id is null then case when v_eligibility=''eligible'' then null else v_eligibility end else auth_ineligibility_reason end,
    financial_profile_version=financial_profile_version+case when v_profile_change then 1 else 0 end,
    financial_profile_updated_at=case when v_profile_change then now() else financial_profile_updated_at end,
    financial_profile_updated_by=case when v_profile_change then auth.uid() else financial_profile_updated_by end
  where id=p_affiliate_id returning * into v_new;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),''UPDATE'',v_before,v_after,v_changed,v_reason);
  for v_key in select unnest(v_changed) loop
    if v_key=any(v_profile_fields) then
      insert into public.affiliate_profile_audit_log(affiliate_id,field_name,old_value,new_value,changed_by,reason,profile_version)
      values(p_affiliate_id,v_key,v_before->v_key,v_after->v_key,auth.uid(),v_reason,v_new.financial_profile_version);
    end if;
  end loop;
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $function$
' then raise exception 'OPTIONAL_REASON_FUNCTION_DRIFT:update_admin_affiliate'; end if; end $guard$;

CREATE OR REPLACE FUNCTION public.update_admin_affiliate(p_affiliate_id uuid, p_expected_updated_at timestamp with time zone, p_patch jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_key text;v_value text;v_reason text:=btrim(coalesce(p_reason,''));
  v_allowed constant text[]:=array['full_name','display_name','historical_email_raw','phone_raw','address_raw','birth_date_raw','gender_raw','marital_status_raw','children_count_raw','rfc_raw','curp_raw','unit_raw','city_raw','employment_position_raw','employment_entry_date_raw','occupation_raw','institute_entry_date_raw','employment_area_raw','employment_level_raw','pension_raw','subdirectorate_raw','union_enrollment_date_raw','capture_date_raw','affiliation_raw','union_position_raw','termination_date_raw','financial_union_code','financial_employee_category_code','financial_employee_type','financial_affiliation_status','financial_employment_status'];
  v_profile_fields constant text[]:=array['full_name','display_name','phone_raw','unit_raw','city_raw','employment_position_raw','employment_area_raw','financial_union_code','financial_employee_category_code','financial_employee_type','financial_affiliation_status','financial_employment_status'];
  v_changed text[]:=array[]::text[];v_before jsonb:='{}'::jsonb;v_after jsonb:='{}'::jsonb;v_profile_change boolean:=false;v_email text;v_eligibility text;
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'AFFILIATE_PATCH_REQUIRED' using errcode='22023'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='PT409'; end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if not(v_key=any(v_allowed)) then raise exception 'AFFILIATE_FIELD_DENIED: %',v_key using errcode='22023'; end if;
    v_value:=nullif(btrim(p_patch->>v_key),'');
    if v_key in ('rfc_raw','curp_raw') then v_value:=upper(v_value); end if;
    if to_jsonb(v_old)->>v_key is distinct from v_value then
      v_changed:=array_append(v_changed,v_key);v_before:=v_before||jsonb_build_object(v_key,to_jsonb(v_old)->v_key);v_after:=v_after||jsonb_build_object(v_key,to_jsonb(v_value));
      if v_key=any(v_profile_fields) then v_profile_change:=true; end if;
    end if;
  end loop;
  if cardinality(v_changed)=0 then raise exception 'AFFILIATE_NO_CHANGE' using errcode='22023'; end if;
  if p_patch?'rfc_raw' and nullif(upper(btrim(p_patch->>'rfc_raw')),'') is not null and exists(select 1 from public.affiliates where id<>p_affiliate_id and upper(btrim(rfc_raw))=upper(btrim(p_patch->>'rfc_raw'))) then raise exception 'AFFILIATE_RFC_DUPLICATE' using errcode='23505'; end if;
  if p_patch?'curp_raw' and nullif(upper(btrim(p_patch->>'curp_raw')),'') is not null and exists(select 1 from public.affiliates where id<>p_affiliate_id and upper(btrim(curp_raw))=upper(btrim(p_patch->>'curp_raw'))) then raise exception 'AFFILIATE_CURP_DUPLICATE' using errcode='23505'; end if;
  if p_patch?'financial_union_code' and nullif(btrim(p_patch->>'financial_union_code'),'') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='union' and code=p_patch->>'financial_union_code' and enabled) then raise exception 'AFFILIATE_UNION_INVALID' using errcode='22023'; end if;
  if p_patch?'financial_employee_category_code' and nullif(btrim(p_patch->>'financial_employee_category_code'),'') is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='employment_category' and code=p_patch->>'financial_employee_category_code' and enabled) then raise exception 'AFFILIATE_CATEGORY_INVALID' using errcode='22023'; end if;
  v_email:=case when p_patch?'historical_email_raw' then nullif(lower(btrim(p_patch->>'historical_email_raw')),'') else v_old.historical_email_normalized end;
  v_eligibility:=case when v_old.auth_user_id is not null then v_old.auth_eligibility when v_email is null then 'missing_email'
    when v_email!~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then 'invalid_email'
    when exists(select 1 from public.affiliates where id<>p_affiliate_id and historical_email_normalized=v_email) then 'duplicate_email' else 'eligible' end;
  update public.affiliates set
    full_name=case when p_patch?'full_name' then nullif(btrim(p_patch->>'full_name'),'') else full_name end,
    display_name=case when p_patch?'display_name' then nullif(btrim(p_patch->>'display_name'),'') else display_name end,
    historical_email_raw=case when p_patch?'historical_email_raw' then nullif(btrim(p_patch->>'historical_email_raw'),'') else historical_email_raw end,
    historical_email_normalized=case when p_patch?'historical_email_raw' then v_email else historical_email_normalized end,
    phone_raw=case when p_patch?'phone_raw' then nullif(btrim(p_patch->>'phone_raw'),'') else phone_raw end,
    address_raw=case when p_patch?'address_raw' then nullif(btrim(p_patch->>'address_raw'),'') else address_raw end,
    birth_date_raw=case when p_patch?'birth_date_raw' then nullif(btrim(p_patch->>'birth_date_raw'),'') else birth_date_raw end,
    gender_raw=case when p_patch?'gender_raw' then nullif(btrim(p_patch->>'gender_raw'),'') else gender_raw end,
    marital_status_raw=case when p_patch?'marital_status_raw' then nullif(btrim(p_patch->>'marital_status_raw'),'') else marital_status_raw end,
    children_count_raw=case when p_patch?'children_count_raw' then nullif(btrim(p_patch->>'children_count_raw'),'') else children_count_raw end,
    rfc_raw=case when p_patch?'rfc_raw' then nullif(upper(btrim(p_patch->>'rfc_raw')),'') else rfc_raw end,
    curp_raw=case when p_patch?'curp_raw' then nullif(upper(btrim(p_patch->>'curp_raw')),'') else curp_raw end,
    unit_raw=case when p_patch?'unit_raw' then nullif(btrim(p_patch->>'unit_raw'),'') else unit_raw end,
    city_raw=case when p_patch?'city_raw' then nullif(btrim(p_patch->>'city_raw'),'') else city_raw end,
    employment_position_raw=case when p_patch?'employment_position_raw' then nullif(btrim(p_patch->>'employment_position_raw'),'') else employment_position_raw end,
    employment_entry_date_raw=case when p_patch?'employment_entry_date_raw' then nullif(btrim(p_patch->>'employment_entry_date_raw'),'') else employment_entry_date_raw end,
    occupation_raw=case when p_patch?'occupation_raw' then nullif(btrim(p_patch->>'occupation_raw'),'') else occupation_raw end,
    institute_entry_date_raw=case when p_patch?'institute_entry_date_raw' then nullif(btrim(p_patch->>'institute_entry_date_raw'),'') else institute_entry_date_raw end,
    employment_area_raw=case when p_patch?'employment_area_raw' then nullif(btrim(p_patch->>'employment_area_raw'),'') else employment_area_raw end,
    employment_level_raw=case when p_patch?'employment_level_raw' then nullif(btrim(p_patch->>'employment_level_raw'),'') else employment_level_raw end,
    pension_raw=case when p_patch?'pension_raw' then nullif(btrim(p_patch->>'pension_raw'),'') else pension_raw end,
    subdirectorate_raw=case when p_patch?'subdirectorate_raw' then nullif(btrim(p_patch->>'subdirectorate_raw'),'') else subdirectorate_raw end,
    union_enrollment_date_raw=case when p_patch?'union_enrollment_date_raw' then nullif(btrim(p_patch->>'union_enrollment_date_raw'),'') else union_enrollment_date_raw end,
    capture_date_raw=case when p_patch?'capture_date_raw' then nullif(btrim(p_patch->>'capture_date_raw'),'') else capture_date_raw end,
    affiliation_raw=case when p_patch?'affiliation_raw' then nullif(btrim(p_patch->>'affiliation_raw'),'') else affiliation_raw end,
    union_position_raw=case when p_patch?'union_position_raw' then nullif(btrim(p_patch->>'union_position_raw'),'') else union_position_raw end,
    termination_date_raw=case when p_patch?'termination_date_raw' then nullif(btrim(p_patch->>'termination_date_raw'),'') else termination_date_raw end,
    financial_union_code=case when p_patch?'financial_union_code' then nullif(btrim(p_patch->>'financial_union_code'),'') else financial_union_code end,
    financial_employee_category_code=case when p_patch?'financial_employee_category_code' then nullif(btrim(p_patch->>'financial_employee_category_code'),'') else financial_employee_category_code end,
    financial_employee_type=case when p_patch?'financial_employee_type' then nullif(btrim(p_patch->>'financial_employee_type'),'') else financial_employee_type end,
    financial_affiliation_status=case when p_patch?'financial_affiliation_status' then nullif(btrim(p_patch->>'financial_affiliation_status'),'') else financial_affiliation_status end,
    financial_employment_status=case when p_patch?'financial_employment_status' then nullif(btrim(p_patch->>'financial_employment_status'),'') else financial_employment_status end,
    auth_eligibility=case when p_patch?'historical_email_raw' and auth_user_id is null then v_eligibility else auth_eligibility end,
    auth_ineligibility_reason=case when p_patch?'historical_email_raw' and auth_user_id is null then case when v_eligibility='eligible' then null else v_eligibility end else auth_ineligibility_reason end,
    financial_profile_version=financial_profile_version+case when v_profile_change then 1 else 0 end,
    financial_profile_updated_at=case when v_profile_change then now() else financial_profile_updated_at end,
    financial_profile_updated_by=case when v_profile_change then auth.uid() else financial_profile_updated_by end
  where id=p_affiliate_id returning * into v_new;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),'UPDATE',v_before,v_after,v_changed,v_reason);
  for v_key in select unnest(v_changed) loop
    if v_key=any(v_profile_fields) then
      insert into public.affiliate_profile_audit_log(affiliate_id,field_name,old_value,new_value,changed_by,reason,profile_version)
      values(p_affiliate_id,v_key,v_before->v_key,v_after->v_key,auth.uid(),v_reason,v_new.financial_profile_version);
    end if;
  end loop;
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $function$
;

do $guard$ begin if (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.affiliate_admin_events'::regclass and conname='affiliate_admin_events_reason_check') is distinct from 'CHECK (((length(btrim(reason)) >= 0) AND (length(btrim(reason)) <= 500)))' then raise exception 'OPTIONAL_REASON_CONSTRAINT_DRIFT:affiliate_admin_events_reason_check'; end if; end $guard$;

alter table public.affiliate_admin_events drop constraint affiliate_admin_events_reason_check;

alter table public.affiliate_admin_events add constraint affiliate_admin_events_reason_check CHECK (((length(btrim(reason)) >= 8) AND (length(btrim(reason)) <= 500)));

do $guard$ begin if (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.affiliate_profile_audit_log'::regclass and conname='affiliate_profile_audit_log_reason_check') is distinct from 'CHECK (((length(btrim(reason)) >= 0) AND (length(btrim(reason)) <= 500)))' then raise exception 'OPTIONAL_REASON_CONSTRAINT_DRIFT:affiliate_profile_audit_log_reason_check'; end if; end $guard$;

alter table public.affiliate_profile_audit_log drop constraint affiliate_profile_audit_log_reason_check;

alter table public.affiliate_profile_audit_log add constraint affiliate_profile_audit_log_reason_check CHECK (((length(btrim(reason)) >= 8) AND (length(btrim(reason)) <= 500)));

do $guard$ begin if (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.affiliates'::regclass and conname='affiliates_archive_state_check') is distinct from 'CHECK (((is_archived AND (archived_at IS NOT NULL) AND (archived_by_auth_user_id IS NOT NULL) AND ((length(btrim(archive_reason)) >= 0) AND (length(btrim(archive_reason)) <= 500)) AND (archive_previous_status_raw IS NOT NULL)) OR ((NOT is_archived) AND (archived_at IS NULL) AND (archived_by_auth_user_id IS NULL) AND (archive_reason IS NULL) AND (archive_previous_status_raw IS NULL))))' then raise exception 'OPTIONAL_REASON_CONSTRAINT_DRIFT:affiliates_archive_state_check'; end if; end $guard$;

alter table public.affiliates drop constraint affiliates_archive_state_check;

alter table public.affiliates add constraint affiliates_archive_state_check CHECK (((is_archived AND (archived_at IS NOT NULL) AND (archived_by_auth_user_id IS NOT NULL) AND ((length(btrim(archive_reason)) >= 8) AND (length(btrim(archive_reason)) <= 500)) AND (archive_previous_status_raw IS NOT NULL)) OR ((NOT is_archived) AND (archived_at IS NULL) AND (archived_by_auth_user_id IS NULL) AND (archive_reason IS NULL) AND (archive_previous_status_raw IS NULL))));

do $guard$ begin if (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.affiliates'::regclass and conname='affiliates_restore_state_check') is distinct from 'CHECK ((((restored_at IS NULL) AND (restored_by_auth_user_id IS NULL) AND (restore_reason IS NULL)) OR ((restored_at IS NOT NULL) AND (restored_by_auth_user_id IS NOT NULL) AND ((length(btrim(restore_reason)) >= 0) AND (length(btrim(restore_reason)) <= 500)))))' then raise exception 'OPTIONAL_REASON_CONSTRAINT_DRIFT:affiliates_restore_state_check'; end if; end $guard$;

alter table public.affiliates drop constraint affiliates_restore_state_check;

alter table public.affiliates add constraint affiliates_restore_state_check CHECK ((((restored_at IS NULL) AND (restored_by_auth_user_id IS NULL) AND (restore_reason IS NULL)) OR ((restored_at IS NOT NULL) AND (restored_by_auth_user_id IS NOT NULL) AND ((length(btrim(restore_reason)) >= 8) AND (length(btrim(restore_reason)) <= 500)))));

do $guard$ begin if (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.impersonation_sessions'::regclass and conname='impersonation_reason_check') is distinct from 'CHECK (((char_length(btrim(reason)) >= 0) AND (char_length(btrim(reason)) <= 500)))' then raise exception 'OPTIONAL_REASON_CONSTRAINT_DRIFT:impersonation_reason_check'; end if; end $guard$;

alter table public.impersonation_sessions drop constraint impersonation_reason_check;

alter table public.impersonation_sessions add constraint impersonation_reason_check CHECK (((char_length(btrim(reason)) >= 8) AND (char_length(btrim(reason)) <= 500)));

notify pgrst, 'reload schema';

commit;
