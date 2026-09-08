-- Caller installs the candidate in BEGIN and always ROLLBACKs this complete test.
do $$
declare actor uuid:=auth.uid(); r public.program_requests%rowtype; result jsonb; job uuid; before_request jsonb; dossier_hash text; files_hash text; assets_hash text; others_hash text; deleted_snapshot jsonb; doc_count int;
begin
  select * into r from public.program_requests where folio='SR-2026-000175';
  if r.id is null then raise exception 'TEST_REQUEST_UNAVAILABLE';end if;
  before_request:=to_jsonb(r);select count(*) into doc_count from public.request_documents where request_id=r.id;
  select md5(string_agg(to_jsonb(x)::text,',' order by x.id)) into dossier_hash from public.affiliate_documents x where affiliate_id=r.affiliate_id;
  select md5(string_agg(to_jsonb(x)::text,',' order by x.id)) into files_hash from public.affiliate_files x where affiliate_id=r.affiliate_id;
  select md5(string_agg(to_jsonb(x)::text,',' order by x.id)) into assets_hash from public.private_assets x;
  select md5(string_agg(to_jsonb(x)::text,',' order by x.id)) into others_hash from public.program_requests x where id<>r.id;
  perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claim.sub','',true);
  begin perform public.get_admin_request_delete_preview(r.id);raise exception 'UNAUTHENTICATED_ACCEPTED';exception when insufficient_privilege then null;end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  result:=public.get_admin_request_delete_preview(r.id);if result->>'folio'<>r.folio then raise exception 'PREVIEW_FAILED';end if;
  begin perform public.prepare_admin_request_delete(r.id,'WRONG',r.updated_at,'Prueba transaccional');raise exception 'WRONG_FOLIO_ACCEPTED';exception when raise_exception then if sqlerrm<>'REQUEST_DELETE_CONFIRMATION_MISMATCH' then raise;end if;end;
  begin perform public.prepare_admin_request_delete(r.id,r.folio,r.updated_at-interval '1 second','Prueba transaccional');raise exception 'STALE_REQUEST_ACCEPTED';exception when raise_exception then if sqlerrm<>'REQUEST_DELETE_CHANGED' then raise;end if;end;
  update public.program_request_google_sync set lease_until=now()+interval '90 seconds' where request_id=r.id;
  begin perform public.prepare_admin_request_delete(r.id,r.folio,r.updated_at,'Prueba transaccional');raise exception 'ACTIVE_SYNC_ACCEPTED';exception when raise_exception then if sqlerrm<>'REQUEST_DELETE_SYNC_BUSY' then raise;end if;end;
  update public.program_request_google_sync set lease_until=null,next_attempt_at=now() where request_id=r.id;
  result:=public.prepare_admin_request_delete(r.id,r.folio,r.updated_at,'Prueba transaccional de eliminación');job:=(result->>'id')::uuid;
  if job is null then raise exception 'PREPARE_FAILED';end if;
  if (public.prepare_admin_request_delete(r.id,r.folio,r.updated_at,'Reintento')->>'id')::uuid<>job then raise exception 'DUPLICATE_JOB';end if;
  begin update public.program_requests set notes='interfering update' where id=r.id;raise exception 'CONCURRENT_REQUEST_WRITE_ACCEPTED';exception when raise_exception then if sqlerrm<>'REQUEST_DELETE_IN_PROGRESS' then raise;end if;end;
  begin update public.request_documents set status_at_submission=status_at_submission where request_id=r.id;raise exception 'CONCURRENT_DOCUMENT_WRITE_ACCEPTED';exception when raise_exception then if sqlerrm<>'REQUEST_DELETE_IN_PROGRESS' then raise;end if;end;
  perform set_config('request.jwt.claim.role','service_role',true);
  if public.claim_program_request_google_sync(r.id) is not null then raise exception 'DELETE_SYNC_LEASE_GRANTED';end if;
  begin perform public.finish_admin_request_delete(job);raise exception 'UNCONFIRMED_GOOGLE_ACCEPTED';exception when raise_exception then if sqlerrm<>'REQUEST_DELETE_GOOGLE_NOT_CONFIRMED' then raise;end if;end;
  perform public.record_request_delete_google(job,jsonb_build_object('program_request_id',r.id,'operation_id',job,'test','isolated Google receipt; caller rolls back'),false);
  perform public.record_request_delete_google(job,null,true);
  result:=public.finish_admin_request_delete(job);
  if result->>'deleted'<>'true' or exists(select 1 from public.program_requests where id=r.id) or exists(select 1 from public.request_documents where request_id=r.id) then raise exception 'DELETE_FAILED';end if;
  if (result->>'documents_removed')::int<>doc_count then raise exception 'ATTACHMENT_COUNT_FAILED';end if;
  if public.finish_admin_request_delete(job)->>'deleted'<>'true' then raise exception 'RETRY_FAILED';end if;
  select snapshot into deleted_snapshot from public.program_request_deletions where id=job and phase='completed';
  if deleted_snapshot->'request' is distinct from before_request or jsonb_array_length(deleted_snapshot->'documents')<>doc_count then raise exception 'RECOVERY_SNAPSHOT_FAILED';end if;
  -- Full typed reconstruction proves the private snapshot retains the removed request and attachments.
  if to_jsonb(jsonb_populate_record(null::public.program_requests,deleted_snapshot->'request')) is distinct from before_request then raise exception 'RECOVERY_REQUEST_ROUNDTRIP_FAILED';end if;
  if (select count(*) from jsonb_populate_recordset(null::public.request_documents,deleted_snapshot->'documents'))<>doc_count then raise exception 'RECOVERY_DOCUMENT_ROUNDTRIP_FAILED';end if;
  if dossier_hash is distinct from (select md5(string_agg(to_jsonb(x)::text,',' order by x.id)) from public.affiliate_documents x where affiliate_id=r.affiliate_id) or files_hash is distinct from (select md5(string_agg(to_jsonb(x)::text,',' order by x.id)) from public.affiliate_files x where affiliate_id=r.affiliate_id) or assets_hash is distinct from (select md5(string_agg(to_jsonb(x)::text,',' order by x.id)) from public.private_assets x) or others_hash is distinct from (select md5(string_agg(to_jsonb(x)::text,',' order by x.id)) from public.program_requests x where id<>r.id) then raise exception 'UNRELATED_DATA_CHANGED';end if;
  if has_table_privilege('authenticated','public.program_request_deletions','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.program_request_deletions','SELECT') or has_function_privilege('authenticated','public.finish_admin_request_delete(uuid)','EXECUTE') or not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.program_request_deletions'::regclass) then raise exception 'DELETION_SECURITY_FAILED';end if;
end $$;
