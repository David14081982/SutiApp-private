-- Explicit owner authorization: 100 MiB existing and new documents.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN IF EXISTS(SELECT 1 FROM document_lab_integrity.assets WHERE size>10485760) OR EXISTS(SELECT 1 FROM document_lab_integrity.operations WHERE size>10485760) THEN RAISE EXCEPTION 'RETAIN_ACCEPTED_DOCUMENTS';END IF;END $guard$;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='2ef7ecbd-e7d6-4f10-8279-8a2b47d7edf2' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='ca9330d2-18c6-48b9-8ab5-34d0eaaac950' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='e92a7a7a-192d-41a1-8d1a-1776cf92e87c' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='3f2fc8ac-9556-4788-bbba-e849a9b0e699' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='ca19cabb-c516-4bea-a640-b80c759b13fd' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='c121155a-c53b-48b8-a4ba-23e973183e19' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='f1db1d43-282a-4c19-97d3-1babef4526ce' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='a8a954d3-4094-4d5a-b0dc-73aa73fb1dee' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='5b2cbd37-c01e-4115-93ef-327e6922ecd4' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='4d6e052a-68a0-4bac-b2a5-38a5ad6e7f07' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='d63a7e93-f0d1-4482-81aa-4cd178615634' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='735caeed-01c0-43dc-8172-3e339f6b1a63' AND max_file_size_bytes=104857600;
UPDATE public.document_types SET max_file_size_bytes=10485760 WHERE id='02a83837-6194-4216-9001-7e00c87741a7' AND max_file_size_bytes=104857600;
DO $guard$ BEGIN IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='document_types'::regclass AND conname='document_types_max_file_check') IS DISTINCT FROM 'CHECK (((max_file_size_bytes >= 1024) AND (max_file_size_bytes <= 104857600)))' THEN RAISE EXCEPTION 'DOCUMENT_CONSTRAINT_DRIFT';END IF;END $guard$;
ALTER TABLE document_types DROP CONSTRAINT document_types_max_file_check;
ALTER TABLE document_types ADD CONSTRAINT document_types_max_file_check CHECK (((max_file_size_bytes >= 1024) AND (max_file_size_bytes <= 10485760)));
DO $guard$ BEGIN IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='document_lab_integrity.assets'::regclass AND conname='assets_size_check') IS DISTINCT FROM 'CHECK (((size > 0) AND (size <= 104857600)))' THEN RAISE EXCEPTION 'DOCUMENT_CONSTRAINT_DRIFT';END IF;END $guard$;
ALTER TABLE document_lab_integrity.assets DROP CONSTRAINT assets_size_check;
ALTER TABLE document_lab_integrity.assets ADD CONSTRAINT assets_size_check CHECK (((size > 0) AND (size <= 10485760)));
DO $guard$ BEGIN IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='document_lab_integrity.operations'::regclass AND conname='operations_size_check') IS DISTINCT FROM 'CHECK (((size > 0) AND (size <= 104857600)))' THEN RAISE EXCEPTION 'DOCUMENT_CONSTRAINT_DRIFT';END IF;END $guard$;
ALTER TABLE document_lab_integrity.operations DROP CONSTRAINT operations_size_check;
ALTER TABLE document_lab_integrity.operations ADD CONSTRAINT operations_size_check CHECK (((size > 0) AND (size <= 10485760)));
DO $guard$ BEGIN IF md5(pg_get_functiondef('save_document_type_configuration(jsonb,text)'::regprocedure))<>'0565797b7ad638e0663738beac3357a9' THEN RAISE EXCEPTION 'DOCUMENT_FUNCTION_DRIFT';END IF;EXECUTE $definition$CREATE OR REPLACE FUNCTION public.save_document_type_configuration(p_value jsonb, p_reason text)
 RETURNS document_types
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;v_before jsonb;v_row public.document_types%rowtype;v_code text:=lower(btrim(coalesce(p_value->>'code','')));v_label text:=btrim(coalesce(p_value->>'label',''));
begin
  if not public.has_admin_permission('documents.write') then raise exception 'DOCUMENT_CONFIG_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'DOCUMENT_CONFIG_REASON_REQUIRED' using errcode='22023'; end if;
  if nullif(p_value->>'id','') is not null then v_id:=(p_value->>'id')::uuid; end if;
  if v_code!~'^[a-z][a-z0-9_]{1,63}$' or length(v_label) not between 1 and 100 then raise exception 'INVALID_DOCUMENT_TYPE' using errcode='22023'; end if;
  if v_id is not null then select to_jsonb(d) into v_before from public.document_types d where d.id=v_id; end if;
  if v_id is null then
    insert into public.document_types(code,label,description,icon,required_by_default,accepted_mime_types,enabled,sort_order,system_type,camera_allowed,file_upload_allowed,max_file_size_bytes)
    values(v_code,v_label,coalesce(p_value->>'description',''),coalesce(nullif(p_value->>'icon',''),'doc'),coalesce((p_value->>'required_by_default')::boolean,false),
      array(select jsonb_array_elements_text(p_value->'accepted_mime_types')),coalesce((p_value->>'enabled')::boolean,true),coalesce((p_value->>'sort_order')::integer,1),false,
      coalesce((p_value->>'camera_allowed')::boolean,true),coalesce((p_value->>'file_upload_allowed')::boolean,true),coalesce((p_value->>'max_file_size_bytes')::bigint,10485760)) returning * into v_row;
  else
    update public.document_types set code=v_code,label=v_label,description=coalesce(p_value->>'description',''),icon=coalesce(nullif(p_value->>'icon',''),'doc'),
      required_by_default=coalesce((p_value->>'required_by_default')::boolean,false),accepted_mime_types=array(select jsonb_array_elements_text(p_value->'accepted_mime_types')),
      enabled=coalesce((p_value->>'enabled')::boolean,true),sort_order=coalesce((p_value->>'sort_order')::integer,sort_order),
      camera_allowed=coalesce((p_value->>'camera_allowed')::boolean,camera_allowed),file_upload_allowed=coalesce((p_value->>'file_upload_allowed')::boolean,file_upload_allowed),
      max_file_size_bytes=coalesce((p_value->>'max_file_size_bytes')::bigint,max_file_size_bytes)
    where id=v_id returning * into v_row;
  end if;
  if v_row.id is null then raise exception 'DOCUMENT_TYPE_NOT_FOUND' using errcode='P0001'; end if;
  insert into public.document_configuration_audit_log(actor_auth_user_id,resource_type,resource_id,action,reason,before_state,after_state)
  values(auth.uid(),'DOCUMENT_TYPE',v_row.id,case when v_before is null then 'CREATE' when v_row.enabled then 'UPDATE' else 'DEACTIVATE' end,btrim(p_reason),v_before,to_jsonb(v_row));
  return v_row;
end $function$
$definition$;END $guard$;
DO $guard$ BEGIN IF md5(pg_get_functiondef('prepare_document_submission(uuid,text,jsonb)'::regprocedure))<>'a34f7cf0360b5c9113970ee16ab68a56' THEN RAISE EXCEPTION 'DOCUMENT_FUNCTION_DRIFT';END IF;EXECUTE $definition$CREATE OR REPLACE FUNCTION public.prepare_document_submission(p_id uuid, p_function text, p_arguments jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o document_integration_private.submissions;ids uuid[];id uuid;d public.affiliate_documents;a public.private_assets;asset_id uuid;loan_document_id uuid;docs jsonb:='[]';begin
 perform document_integration_private.session_required();
 if p_id is null or p_function not in('attach_request_documents','create_program_request_with_documents','create_membership_request','submit_self_savings_request','finalize_program_request_context','renta_car_submit','create_validated_financial_program_request','confirm_program_product_financing') or jsonb_typeof(p_arguments)<>'object' then raise exception 'SUBMISSION_CONTRACT_DENIED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-submission:'||p_id,0));
 select * into o from document_integration_private.submissions where submissions.id=p_id;
 if o.id is not null then
  if o.actor<>auth.uid() or o.claims->>'session_id' is distinct from auth.jwt()->>'session_id' or o.function_name<>p_function or o.arguments<>p_arguments then raise exception 'IDEMPOTENCY_ARGUMENT_MISMATCH';end if;
  return jsonb_build_object('id',o.id,'documents',o.documents,'completed',o.completed_at is not null);
 end if;
 if p_function='submit_self_savings_request' then ids:=case when p_arguments->>'p_supporting_document_id' is null then '{}'::uuid[] else array[(p_arguments->>'p_supporting_document_id')::uuid] end;
 else select coalesce(array_agg(x::uuid),'{}') into ids from jsonb_array_elements_text(coalesce(p_arguments->'p_submission'->'p_document_ids',p_arguments->'p_document_ids',p_arguments->'p_affiliate_document_ids',p_arguments->'p_documents','[]'::jsonb)) x;end if;
 for id in select distinct unnest(ids) order by 1 loop
  -- Existing loan documents are physically verified by Edge after preparation.
  -- Do not enroll here: authenticated clients cannot attest physical bytes.
  if p_function='create_validated_financial_program_request' then
   loan_document_id:=id;
   select coalesce(x.private_asset_id,f.private_asset_id) into asset_id
    from public.affiliate_documents x left join public.affiliate_files f on f.id=x.affiliate_file_id where x.id=loan_document_id;
   if asset_id is null then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
   perform pg_advisory_xact_lock(hashtextextended('document-asset:'||asset_id,0));
   select * into strict d from public.affiliate_documents where affiliate_documents.id=loan_document_id for update;
   if coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where affiliate_files.id=d.affiliate_file_id)) is distinct from asset_id
    then raise exception 'DOCUMENT_OPERATION_CHANGED';end if;
   if exists(select 1 from document_lab_integrity.assets where assets.id=asset_id and state<>'AVAILABLE')
    then raise exception 'PHYSICAL_ASSET_NOT_VERIFIED';end if;
  else
   d:=document_evidence_private.lock_document(id);
  end if;
  if d.affiliate_id is distinct from public.get_effective_affiliate_id() or document_integration_private.current_document(d.affiliate_id,d.document_type_id) is distinct from id then raise exception 'DOCUMENT_NOT_CURRENT' using errcode='42501';end if;
  select * into a from public.private_assets where private_assets.id=coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where affiliate_files.id=d.affiliate_file_id));
  if (a.owner_affiliate_id is not null and a.owner_affiliate_id<>d.affiliate_id) or a.status<>'READY' then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
  docs:=docs||jsonb_build_array(jsonb_build_object('document_id',id,'asset',a.id,'bucket',a.storage_bucket,'path',a.storage_path,'mime',a.mime_type,'size',a.file_size,'sha256',lower(a.content_sha256)));
 end loop;
 insert into document_integration_private.submissions(id,actor,claims,function_name,arguments,documents) values(p_id,auth.uid(),auth.jwt(),p_function,p_arguments,docs);
 return jsonb_build_object('id',p_id,'documents',docs,'completed',false);
end$function$
$definition$;END $guard$;
DO $guard$ BEGIN IF md5(pg_get_functiondef('complete_document_financial_submission(uuid,jsonb)'::regprocedure))<>'8a3d1fc41f9963f23b4de0758a670f7e' THEN RAISE EXCEPTION 'DOCUMENT_FUNCTION_DRIFT';END IF;EXECUTE $definition$CREATE OR REPLACE FUNCTION public.complete_document_financial_submission(p_id uuid, p_receipts jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o document_integration_private.submissions;d jsonb;r jsonb;proc record;calls text;v_result jsonb;matches integer;doc public.affiliate_documents;asset public.private_assets;begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-submission:'||p_id,0));
 select * into o from document_integration_private.submissions where id=p_id for update;
 if o.id is null then raise exception 'SUBMISSION_NOT_FOUND';end if;
 perform set_config('request.jwt.claims',o.claims::text,true);perform set_config('request.jwt.claim.sub',o.actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 perform document_integration_private.session_required();
 if o.function_name not in('create_validated_financial_program_request','confirm_program_product_financing')
 or coalesce(o.arguments->'p_submission'->>'p_actor_real_auth_user_id',o.arguments->>'p_actor_real_auth_user_id') is distinct from o.actor::text
 or coalesce(o.arguments->'p_submission'->>'p_affiliate_id',o.arguments->>'p_affiliate_id') is distinct from public.get_effective_affiliate_id()::text then raise exception 'FINANCIAL_DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
 if jsonb_typeof(p_receipts) is distinct from 'array' or jsonb_array_length(p_receipts)<>jsonb_array_length(o.documents) then raise exception 'VERIFICATION_RECEIPT_INVALID';end if;
 for d in select value from jsonb_array_elements(o.documents) loop
  select value into r from jsonb_array_elements(p_receipts) where value->>'document_id'=d->>'document_id';
  if r->>'verified' is distinct from 'true' or r->>'sha256' is distinct from d->>'sha256' or r->>'size' is distinct from d->>'size' or r->>'mime' is distinct from d->>'mime' then raise exception 'VERIFICATION_RECEIPT_INVALID';end if;
 end loop;
 if o.completed_at is not null then return o.result;end if;
 -- Only the loan path enrolls existing files, after all service receipts pass.
 if o.function_name='create_validated_financial_program_request' then
  for d in select value from jsonb_array_elements(o.documents) order by value->>'asset',value->>'document_id' loop
   perform pg_advisory_xact_lock(hashtextextended('document-asset:'||(d->>'asset'),0));
   select * into strict doc from public.affiliate_documents where id=(d->>'document_id')::uuid for update;
   if doc.affiliate_id is distinct from public.get_effective_affiliate_id()
    or document_integration_private.current_document(doc.affiliate_id,doc.document_type_id) is distinct from doc.id
    or coalesce(doc.private_asset_id,(select private_asset_id from public.affiliate_files where id=doc.affiliate_file_id)) is distinct from (d->>'asset')::uuid
    then raise exception 'DOCUMENT_NOT_CURRENT' using errcode='42501';end if;
   select * into strict asset from public.private_assets where id=(d->>'asset')::uuid for share;
   if asset.status is distinct from 'READY'
    or (asset.owner_affiliate_id is not null and asset.owner_affiliate_id<>doc.affiliate_id)
    or asset.storage_bucket is distinct from d->>'bucket' or asset.storage_path is distinct from d->>'path'
    or lower(asset.content_sha256) is distinct from d->>'sha256'
    or asset.file_size::text is distinct from d->>'size' or asset.mime_type is distinct from d->>'mime'
    then raise exception 'DOCUMENT_OPERATION_CHANGED';end if;
   insert into document_lab_integrity.assets(id,affiliate_id,bucket,path,sha256,size,mime)
    values(asset.id,doc.affiliate_id,asset.storage_bucket,asset.storage_path,lower(asset.content_sha256),asset.file_size,asset.mime_type)
    on conflict(id) do nothing;
   perform 1 from document_lab_integrity.assets i where i.id=asset.id and i.affiliate_id=doc.affiliate_id
    and i.state='AVAILABLE' and i.bucket=asset.storage_bucket and i.path=asset.storage_path
    and i.sha256=lower(asset.content_sha256) and i.size=asset.file_size and i.mime=asset.mime_type for update;
   if not found then raise exception 'PHYSICAL_ASSET_NOT_VERIFIED';end if;
  end loop;
 end if;
 -- Dispatch only to an existing allowlisted public signature whose complete named arguments match.
 select count(*) into matches from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=o.function_name and p.proargnames is not null
 and (select array_agg(k order by k) from jsonb_object_keys(o.arguments) k)=(select array_agg(k order by k) from unnest(p.proargnames) k);
 if matches<>1 then raise exception 'SUBMISSION_SIGNATURE_DRIFT';end if;
 select p.* into proc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=o.function_name
 and (select array_agg(k order by k) from jsonb_object_keys(o.arguments) k)=(select array_agg(k order by k) from unnest(p.proargnames) k);
 select string_agg(format('%I => %s',proc.proargnames[k+1],case when proc.proargtypes[k]='uuid[]'::regtype then format('(select array_agg(v::uuid) from jsonb_array_elements_text($1->%L) v)',proc.proargnames[k+1]) else format('($1->>%L)::%s',proc.proargnames[k+1],format_type(proc.proargtypes[k],null)) end),', ' order by k) into calls from generate_series(0,proc.pronargs-1) k;
 perform set_config('document.verified_submission',o.id::text,true);
 perform set_config('request.jwt.claims',(o.claims||jsonb_build_object('role','service_role'))::text,true);perform set_config('request.jwt.claim.role','service_role',true);
 execute format('select to_jsonb(public.%I(%s))',o.function_name,calls) into v_result using o.arguments;
 update document_integration_private.submissions set result=coalesce(v_result,'null'::jsonb),completed_at=clock_timestamp() where id=o.id;
 return v_result;
end$function$
$definition$;END $guard$;
DO $guard$ BEGIN IF md5(pg_get_functiondef('prepare_document_operation(uuid,text,uuid,uuid,text,bigint,text,uuid,text,text)'::regprocedure))<>'c690e1cc84d3c3de1700d5406d4c718b' THEN RAISE EXCEPTION 'DOCUMENT_FUNCTION_DRIFT';END IF;EXECUTE $definition$CREATE OR REPLACE FUNCTION public.prepare_document_operation(p_id uuid, p_mode text, p_affiliate uuid, p_type uuid, p_mime text, p_size bigint, p_sha text, p_expected uuid, p_source text DEFAULT 'FILE'::text, p_reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a uuid;t public.document_types;o document_lab_integrity.operations;ctx jsonb;args jsonb;fp text;ext text;begin
 a:=case when p_mode='SELF_SERVICE' then public.get_effective_affiliate_id() else p_affiliate end;
 if a is null or (p_mode='SELF_SERVICE' and p_affiliate is not null and p_affiliate<>a) then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
 perform document_integration_private.writer(a,p_mode);
 select * into t from public.document_types where id=p_type and enabled;
 if t.id is null or p_size<1 or p_size>least(t.max_file_size_bytes,10485760) or lower(p_sha)!~'^[a-f0-9]{64}$' or not(p_mime=any(t.accepted_mime_types)) or p_mime not in('image/png','image/jpeg','application/pdf','image/webp') or p_source not in('FILE','CAMERA') or (p_source='FILE' and not t.file_upload_allowed) or (p_source='CAMERA' and (not t.camera_allowed or p_mime not like 'image/%')) then raise exception 'INVALID_DOCUMENT_FILE';end if;
 if p_id is null or length(p_reason)>500 then raise exception 'INVALID_OPERATION';end if;
 args:=jsonb_build_object('affiliate',a,'type',p_type,'mode',p_mode,'mime',p_mime,'size',p_size,'sha',lower(p_sha),'expected',p_expected,'source',p_source,'reason',p_reason);
 fp:=encode(extensions.digest(args::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('document-operation:'||p_id,0));
 select * into o from document_lab_integrity.operations where id=p_id for update;
 if o.id is not null then
  if o.actor_id<>auth.uid() or o.arguments_hash<>fp or o.registration_context->'claims'->>'session_id' is distinct from auth.jwt()->>'session_id' then raise exception 'IDEMPOTENCY_ARGUMENT_MISMATCH' using errcode='42501';end if;
 else
  perform pg_advisory_xact_lock(hashtextextended('document-slot:'||a||':'||p_type,0));
  if document_integration_private.current_document(a,p_type) is distinct from p_expected then raise exception 'DOCUMENT_VERSION_CONFLICT' using errcode='PT409';end if;
  ext:=case p_mime when 'image/png' then '.png' when 'image/jpeg' then '.jpg' when 'image/webp' then '.webp' else '.pdf' end;
  ctx:=args||jsonb_build_object('claims',auth.jwt());
  insert into document_lab_integrity.operations(id,actor_id,affiliate_id,kind,source,sha256,size,mime,arguments_hash,registration_context)
   values(p_id,auth.uid(),a,'UPLOAD','affiliate-documents/'||a||'/'||p_id||ext,lower(p_sha),p_size,p_mime,fp,ctx) returning * into o;
  insert into document_lab_integrity.events(operation_id,fence,event) values(p_id,0,'PREPARED');
 end if;
 return jsonb_build_object('operation_id',o.id,'state',o.state,'path',o.source,'bucket','private-assets','sha256',o.sha256,'size',o.size,'mime',o.mime,'document_id',o.document_id);
end$function$
$definition$;END $guard$;
DO $guard$ BEGIN IF md5(pg_get_functiondef('complete_document_submission(uuid,jsonb)'::regprocedure))<>'eba6b5829063342368622096a51c4dd1' THEN RAISE EXCEPTION 'DOCUMENT_FUNCTION_DRIFT';END IF;EXECUTE $definition$CREATE OR REPLACE FUNCTION public.complete_document_submission(p_id uuid, p_receipts jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o document_integration_private.submissions;d jsonb;r jsonb;proc record;calls text;v_result jsonb;matches integer;begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-submission:'||p_id,0));
 select * into o from document_integration_private.submissions where id=p_id for update;
 if o.id is null then raise exception 'SUBMISSION_NOT_FOUND';end if;
 perform set_config('request.jwt.claims',o.claims::text,true);perform set_config('request.jwt.claim.sub',o.actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 perform document_integration_private.session_required();if o.function_name in('create_validated_financial_program_request','confirm_program_product_financing') then raise exception 'FINANCIAL_WRITER_REQUIRED' using errcode='42501';end if;
 if jsonb_typeof(p_receipts) is distinct from 'array' or jsonb_array_length(p_receipts)<>jsonb_array_length(o.documents) then raise exception 'VERIFICATION_RECEIPT_INVALID';end if;
 for d in select value from jsonb_array_elements(o.documents) loop
  select value into r from jsonb_array_elements(p_receipts) where value->>'document_id'=d->>'document_id';
  if r->>'verified' is distinct from 'true' or r->>'sha256' is distinct from d->>'sha256' or r->>'size' is distinct from d->>'size' or r->>'mime' is distinct from d->>'mime' then raise exception 'VERIFICATION_RECEIPT_INVALID';end if;
 end loop;
 if o.completed_at is not null then return o.result;end if;
 -- Dispatch only to an existing allowlisted public signature whose complete named arguments match.
 select count(*) into matches from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=o.function_name and p.proargnames is not null
 and (select array_agg(k order by k) from jsonb_object_keys(o.arguments) k)=(select array_agg(k order by k) from unnest(p.proargnames) k);
 if matches<>1 then raise exception 'SUBMISSION_SIGNATURE_DRIFT';end if;
 select p.* into proc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=o.function_name
 and (select array_agg(k order by k) from jsonb_object_keys(o.arguments) k)=(select array_agg(k order by k) from unnest(p.proargnames) k);
 select string_agg(format('%I => %s',proc.proargnames[k+1],case when proc.proargtypes[k]='uuid[]'::regtype then format('(select array_agg(v::uuid) from jsonb_array_elements_text($1->%L) v)',proc.proargnames[k+1]) else format('($1->>%L)::%s',proc.proargnames[k+1],format_type(proc.proargtypes[k],null)) end),', ' order by k) into calls from generate_series(0,proc.pronargs-1) k;
 perform set_config('document.verified_submission',o.id::text,true);
 execute format('select to_jsonb(public.%I(%s))',o.function_name,calls) into v_result using o.arguments;
 update document_integration_private.submissions set result=coalesce(v_result,'null'::jsonb),completed_at=clock_timestamp() where id=o.id;
 return v_result;
end$function$
$definition$;END $guard$;
ALTER TABLE public.document_types ALTER COLUMN max_file_size_bytes SET DEFAULT 10485760;
UPDATE storage.buckets SET file_size_limit=52428800 WHERE id='documents';
UPDATE storage.buckets SET file_size_limit=104857600 WHERE id='private-assets';
UPDATE storage.buckets SET file_size_limit=8388608 WHERE id='generated-documents';
COMMIT;
