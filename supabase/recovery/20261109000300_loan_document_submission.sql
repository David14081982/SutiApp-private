-- H-LOAN-DOCUMENT-SUBMIT-001: loan-only, no business-data backfill.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE current_definition text;BEGIN
 select pg_get_functiondef('prepare_document_submission(uuid,text,jsonb)'::regprocedure) into current_definition;
 if md5(current_definition)='f10ad75941ed3a120c4a531e9f193f48' then return;end if;
 if md5(current_definition)<>'9c94b797f4f15ed1a9ed2cfc5dee1ac3' then raise exception 'LOAN_DOCUMENT_FUNCTION_DRIFT';end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.prepare_document_submission(p_id uuid, p_function text, p_arguments jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o document_integration_private.submissions;ids uuid[];id uuid;d public.affiliate_documents;a public.private_assets;docs jsonb:='[]';begin
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
  d:=document_evidence_private.lock_document(id);
  if d.affiliate_id is distinct from public.get_effective_affiliate_id() or document_integration_private.current_document(d.affiliate_id,d.document_type_id) is distinct from id then raise exception 'DOCUMENT_NOT_CURRENT' using errcode='42501';end if;
  select * into a from public.private_assets where private_assets.id=coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where affiliate_files.id=d.affiliate_file_id));
  if (a.owner_affiliate_id is not null and a.owner_affiliate_id<>d.affiliate_id) or a.status<>'READY' then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
  docs:=docs||jsonb_build_array(jsonb_build_object('document_id',id,'asset',a.id,'bucket',a.storage_bucket,'path',a.storage_path,'mime',a.mime_type,'size',a.file_size,'sha256',lower(a.content_sha256)));
 end loop;
 insert into document_integration_private.submissions(id,actor,claims,function_name,arguments,documents) values(p_id,auth.uid(),auth.jwt(),p_function,p_arguments,docs);
 return jsonb_build_object('id',p_id,'documents',docs,'completed',false);
end$function$
$definition$;
END $guard$;

DO $guard$
DECLARE current_definition text;BEGIN
 select pg_get_functiondef('complete_document_financial_submission(uuid,jsonb)'::regprocedure) into current_definition;
 if md5(current_definition)='9b72c1d11d93dbf1cf08a327ad0e440c' then return;end if;
 if md5(current_definition)<>'6c4217613145cfc38796b156c3130199' then raise exception 'LOAN_DOCUMENT_FUNCTION_DRIFT';end if;
 execute $definition$CREATE OR REPLACE FUNCTION public.complete_document_financial_submission(p_id uuid, p_receipts jsonb)
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
$definition$;
END $guard$;
COMMIT;
